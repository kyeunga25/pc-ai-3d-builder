import { describe, expect, it, vi } from "vitest";

import { authenticateAccessRequest } from "./access";

const env = {
  TEAM_DOMAIN: "https://rigstage-test.cloudflareaccess.com",
  POLICY_AUD: "test-audience",
};

describe("Cloudflare Access identity", () => {
  it("rejects requests without the signed Access assertion", async () => {
    await expect(
      authenticateAccessRequest(
        new Request("https://rigstage.test/api/session"),
        env,
      ),
    ).rejects.toMatchObject({
      status: 401,
      code: "ACCESS_TOKEN_REQUIRED",
    });
  });

  it("normalises verified identity claims", async () => {
    const verify = vi.fn().mockResolvedValue({
      sub: "access-user-1",
      email: "  PILOT@EXAMPLE.COM ",
      name: " 試行用戶 ",
      type: "app",
    });
    const request = new Request("https://rigstage.test/api/session", {
      headers: { "Cf-Access-Jwt-Assertion": "signed-token" },
    });

    await expect(
      authenticateAccessRequest(request, env, verify),
    ).resolves.toEqual({
      subject: "access-user-1",
      email: "pilot@example.com",
      displayName: "試行用戶",
    });
    expect(verify).toHaveBeenCalledWith("signed-token", {
      issuer: env.TEAM_DOMAIN,
      audience: env.POLICY_AUD,
    });
  });

  it("accepts a bounded comma-separated audience allowlist", async () => {
    const verify = vi.fn().mockResolvedValue({
      sub: "access-user-1",
      email: "pilot@example.com",
      type: "app",
    });
    const request = new Request("https://rigstage.test/api/session", {
      headers: { "Cf-Access-Jwt-Assertion": "signed-token" },
    });

    await authenticateAccessRequest(
      request,
      {
        ...env,
        POLICY_AUD: "workspace-audience, api-audience",
      },
      verify,
    );

    expect(verify).toHaveBeenCalledWith("signed-token", {
      issuer: env.TEAM_DOMAIN,
      audience: ["workspace-audience", "api-audience"],
    });
  });

  it("fails closed when token verification fails", async () => {
    const request = new Request("https://rigstage.test/api/session", {
      headers: { "Cf-Access-Jwt-Assertion": "invalid-token" },
    });
    const verify = vi.fn().mockRejectedValue(new Error("signature mismatch"));

    await expect(
      authenticateAccessRequest(request, env, verify),
    ).rejects.toMatchObject({
      status: 401,
      code: "ACCESS_TOKEN_INVALID",
    });
  });

  it("rejects an expired application token", async () => {
    const request = new Request("https://rigstage.test/api/session", {
      headers: { "Cf-Access-Jwt-Assertion": "expired-token" },
    });
    const verify = vi.fn().mockRejectedValue(new Error("JWT expired"));

    await expect(
      authenticateAccessRequest(request, env, verify),
    ).rejects.toMatchObject({
      status: 401,
      code: "ACCESS_TOKEN_INVALID",
    });
  });

  it("accepts only an identity-based Access application token", async () => {
    const request = new Request("https://rigstage.test/api/session", {
      headers: { "Cf-Access-Jwt-Assertion": "non-identity-token" },
    });
    const verify = vi.fn().mockResolvedValue({
      sub: "access-user-1",
      email: "pilot@example.com",
      type: "org",
    });

    await expect(
      authenticateAccessRequest(request, env, verify),
    ).rejects.toMatchObject({
      status: 401,
      code: "ACCESS_TOKEN_INVALID",
    });
  });

  it("fails closed when required Access configuration is missing", async () => {
    const request = new Request("https://rigstage.test/api/session", {
      headers: { "Cf-Access-Jwt-Assertion": "signed-token" },
    });
    const verify = vi.fn();

    await expect(
      authenticateAccessRequest(
        request,
        { TEAM_DOMAIN: "", POLICY_AUD: "" },
        verify,
      ),
    ).rejects.toMatchObject({
      status: 503,
      code: "AUTH_CONFIGURATION_MISSING",
    });
    expect(verify).not.toHaveBeenCalled();
  });

  it.each([
    "workspace-audience,",
    "workspace-audience,,api-audience",
    "workspace-audience,workspace-audience",
    Array.from({ length: 17 }, (_, index) => `audience-${index}`).join(","),
    "a".repeat(257),
  ])("fails closed for an invalid audience allowlist: %s", async (audience) => {
    const request = new Request("https://rigstage.test/api/session", {
      headers: { "Cf-Access-Jwt-Assertion": "signed-token" },
    });
    const verify = vi.fn();

    await expect(
      authenticateAccessRequest(
        request,
        { ...env, POLICY_AUD: audience },
        verify,
      ),
    ).rejects.toMatchObject({
      status: 503,
      code: "AUTH_CONFIGURATION_MISSING",
    });
    expect(verify).not.toHaveBeenCalled();
  });
});
