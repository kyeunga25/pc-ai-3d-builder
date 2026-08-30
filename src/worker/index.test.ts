import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AssetGenerationParams } from "../shared/domain/generation-jobs";

declare global {
  interface Env {
    PRIVATE_ASSETS: R2Bucket;
    DB: D1Database;
    PILOT_RATE_LIMITER: RateLimit;
    ASSETS: Fetcher;
    GENERATION_MODE: string;
    GENERATION_MAX_COST_MINOR: string;
    TEAM_DOMAIN: string;
    POLICY_AUD: string;
    ASSET_GENERATION: Workflow<AssetGenerationParams>;
  }
}

const mocks = vi.hoisted(() => ({
  authenticateAccessRequest: vi.fn(),
  enforcePilotRateLimit: vi.fn(),
  resolveRequestContext: vi.fn(),
}));

vi.mock("./auth/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./auth/access")>()),
  authenticateAccessRequest: mocks.authenticateAccessRequest,
}));

vi.mock("./auth/workspace", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./auth/workspace")>()),
  resolveRequestContext: mocks.resolveRequestContext,
}));

vi.mock("./lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lib/rate-limit")>()),
  enforcePilotRateLimit: mocks.enforcePilotRateLimit,
}));

import { routeRequest } from "./router";

const rateLimiter = {} as RateLimit;
const env = {
  DB: {} as D1Database,
  PILOT_RATE_LIMITER: rateLimiter,
} as Env;

describe("Worker API preflight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateAccessRequest.mockResolvedValue({
      subject: "access-subject-fixture",
      email: "fixture@example.com",
      displayName: null,
    });
    mocks.enforcePilotRateLimit.mockResolvedValue(undefined);
    mocks.resolveRequestContext.mockRejectedValue(
      new Error("Workspace resolution must not run during API preflight"),
    );
  });

  it("rejects an unknown protected API path after Access and rate limiting but before D1", async () => {
    const response = await routeRequest(
      new Request("https://rigstage.test/api/assets/item/private-fixture"),
      env,
      "request-unknown-route",
    );

    expect(mocks.authenticateAccessRequest).toHaveBeenCalledTimes(1);
    expect(mocks.enforcePilotRateLimit).toHaveBeenCalledWith(
      rateLimiter,
      "access-subject-fixture",
    );
    expect(mocks.resolveRequestContext).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "NOT_FOUND",
        message:
          "所要求的 API 路徑不存在。 / The requested API path does not exist.",
        requestId: "request-unknown-route",
      },
    });
  });

  it("rejects a disallowed protected method before D1 with its exact Allow policy", async () => {
    const response = await routeRequest(
      new Request("https://rigstage.test/api/assets/item/file", {
        method: "POST",
      }),
      env,
      "request-invalid-method",
    );

    expect(mocks.authenticateAccessRequest).toHaveBeenCalledTimes(1);
    expect(mocks.enforcePilotRateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.resolveRequestContext).not.toHaveBeenCalled();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, PUT, DELETE");
  });

  it("keeps the health method check public and free of protected bindings", async () => {
    const response = await routeRequest(
      new Request("https://rigstage.test/api/health", { method: "POST" }),
      env,
      "request-health-method",
    );

    expect(mocks.authenticateAccessRequest).not.toHaveBeenCalled();
    expect(mocks.enforcePilotRateLimit).not.toHaveBeenCalled();
    expect(mocks.resolveRequestContext).not.toHaveBeenCalled();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "METHOD_NOT_ALLOWED",
        requestId: "request-health-method",
      },
    });
  });
});
