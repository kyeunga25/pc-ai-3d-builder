import { describe, expect, it, vi } from "vitest";

import { authenticateAccessRequest } from "./access";

const env = {
  TEAM_DOMAIN: "https://rigstage-test.cloudflareaccess.com",
  POLICY_AUD: "test-audience",
};

const validClaims = {
  sub: "access-user-1",
  email: "pilot@example.com",
  type: "app",
};

function accessRequest(token = "signed-token"): Request {
  return new Request("https://rigstage.test/api/session", {
    headers: { "Cf-Access-Jwt-Assertion": token },
  });
}

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
      message:
        "此要求需要有效的 Cloudflare Access 身份。 / This request requires a valid Cloudflare Access identity.",
    });
  });

  it("normalises concurrent verified identity claim replays deterministically", async () => {
    const verify = vi.fn().mockResolvedValue({
      sub: "access-user-1",
      email: "  PILOT@EXAMPLE.COM ",
      name: " 試行用戶 ",
      type: "app",
    });

    await expect(
      Promise.all([
        authenticateAccessRequest(accessRequest(), env, verify),
        authenticateAccessRequest(accessRequest(), env, verify),
      ]),
    ).resolves.toEqual([
      {
        subject: "access-user-1",
        email: "pilot@example.com",
        displayName: "試行用戶",
      },
      {
        subject: "access-user-1",
        email: "pilot@example.com",
        displayName: "試行用戶",
      },
    ]);
    expect(verify).toHaveBeenCalledTimes(2);
    expect(verify).toHaveBeenCalledWith("signed-token", {
      issuer: env.TEAM_DOMAIN,
      audience: env.POLICY_AUD,
    });
  });

  it("accepts the documented RigStage identity boundaries", async () => {
    const verify = vi.fn().mockResolvedValue({
      sub: "s".repeat(256),
      email: `${"e".repeat(242)}@example.com`,
      name: "n".repeat(128),
      type: "app",
    });

    await expect(
      authenticateAccessRequest(
        accessRequest("t".repeat(16 * 1024)),
        env,
        verify,
      ),
    ).resolves.toMatchObject({
      subject: "s".repeat(256),
      email: `${"e".repeat(242)}@example.com`,
      displayName: "n".repeat(128),
    });
  });

  it("rejects an oversized assertion before verification", async () => {
    const verify = vi.fn().mockResolvedValue(validClaims);

    await expect(
      authenticateAccessRequest(
        accessRequest("t".repeat(16 * 1024 + 1)),
        env,
        verify,
      ),
    ).rejects.toMatchObject({
      status: 401,
      code: "ACCESS_TOKEN_INVALID",
      message:
        "Cloudflare Access 身份無效或已過期。 / The Cloudflare Access identity is invalid or expired.",
    });
    expect(verify).not.toHaveBeenCalled();
  });

  it.each([
    ["oversized subject", { ...validClaims, sub: "s".repeat(257) }],
    [
      "oversized email",
      { ...validClaims, email: `${"e".repeat(243)}@example.com` },
    ],
    ["malformed email", { ...validClaims, email: "not-an-email" }],
    ["oversized display name", { ...validClaims, name: "n".repeat(129) }],
    ["subject control character", { ...validClaims, sub: "user\nother" }],
    [
      "display-name control character",
      { ...validClaims, name: "Pilot\u0000User" },
    ],
  ])("rejects a verified token with %s", async (_case, claims) => {
    const verify = vi.fn().mockResolvedValue(claims);

    await expect(
      authenticateAccessRequest(accessRequest(), env, verify),
    ).rejects.toMatchObject({
      status: 401,
      code: "ACCESS_TOKEN_INVALID",
    });
  });

  it("accepts a bounded comma-separated audience allowlist", async () => {
    const verify = vi.fn().mockResolvedValue({
      sub: "access-user-1",
      email: "pilot@example.com",
      type: "app",
    });
    const request = accessRequest();

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
    const request = accessRequest("invalid-token");
    const verify = vi.fn().mockRejectedValue(new Error("signature mismatch"));

    await expect(
      authenticateAccessRequest(request, env, verify),
    ).rejects.toMatchObject({
      status: 401,
      code: "ACCESS_TOKEN_INVALID",
    });
  });

  it("rejects an expired application token", async () => {
    const request = accessRequest("expired-token");
    const verify = vi.fn().mockRejectedValue(new Error("JWT expired"));

    await expect(
      authenticateAccessRequest(request, env, verify),
    ).rejects.toMatchObject({
      status: 401,
      code: "ACCESS_TOKEN_INVALID",
    });
  });

  it("accepts only an identity-based Access application token", async () => {
    const request = accessRequest("non-identity-token");
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
    const request = accessRequest();
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
      message:
        "身份驗證服務尚未完成設定。 / Authentication service is not configured.",
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
    const request = accessRequest();
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
