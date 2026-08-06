import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from "jose";

import { ApiError } from "../lib/api-error";

export type AccessIdentity = {
  subject: string;
  email: string;
  displayName: string | null;
};

type AccessConfig = {
  issuer: string;
  audience: string | string[];
};

type AccessEnv = {
  TEAM_DOMAIN: string;
  POLICY_AUD: string;
};

export type AccessTokenVerifier = (
  token: string,
  config: AccessConfig,
) => Promise<JWTPayload>;

const jwksByIssuer = new Map<string, JWTVerifyGetKey>();

const MAX_ACCESS_AUDIENCES = 16;
const MAX_ACCESS_AUDIENCE_LENGTH = 256;

function parseAccessAudiences(value: unknown): string | string[] {
  if (typeof value !== "string") {
    throw new ApiError(
      503,
      "AUTH_CONFIGURATION_MISSING",
      "身份驗證服務尚未完成設定。",
    );
  }

  const audiences = value.split(",").map((audience) => audience.trim());

  if (
    audiences.length === 0 ||
    audiences.length > MAX_ACCESS_AUDIENCES ||
    audiences.some(
      (audience) =>
        audience.length === 0 || audience.length > MAX_ACCESS_AUDIENCE_LENGTH,
    ) ||
    new Set(audiences).size !== audiences.length
  ) {
    throw new ApiError(
      503,
      "AUTH_CONFIGURATION_MISSING",
      "身份驗證服務尚未完成設定。",
    );
  }

  return audiences.length === 1 ? audiences[0]! : audiences;
}

function accessConfig(env: AccessEnv): AccessConfig {
  const audience = parseAccessAudiences(env.POLICY_AUD);
  const teamDomain =
    typeof env.TEAM_DOMAIN === "string" ? env.TEAM_DOMAIN.trim() : "";
  let issuer: URL;

  try {
    issuer = new URL(teamDomain);
  } catch {
    throw new ApiError(
      503,
      "AUTH_CONFIGURATION_MISSING",
      "身份驗證服務尚未完成設定。",
    );
  }

  if (
    issuer.protocol !== "https:" ||
    !issuer.hostname.endsWith(".cloudflareaccess.com") ||
    issuer.pathname !== "/" ||
    issuer.search !== "" ||
    issuer.hash !== "" ||
    issuer.username !== "" ||
    issuer.password !== "" ||
    issuer.port !== ""
  ) {
    throw new ApiError(
      503,
      "AUTH_CONFIGURATION_MISSING",
      "身份驗證服務尚未完成設定。",
    );
  }

  return {
    issuer: issuer.origin,
    audience,
  };
}

async function verifyWithCloudflareAccess(
  token: string,
  config: AccessConfig,
): Promise<JWTPayload> {
  let jwks = jwksByIssuer.get(config.issuer);

  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL("/cdn-cgi/access/certs", `${config.issuer}/`),
    );
    jwksByIssuer.set(config.issuer, jwks);
  }

  const { payload } = await jwtVerify(token, jwks, {
    issuer: config.issuer,
    audience: config.audience,
    algorithms: ["RS256"],
    requiredClaims: ["sub", "exp", "iat"],
  });

  return payload;
}

export async function authenticateAccessRequest(
  request: Request,
  env: AccessEnv,
  verify: AccessTokenVerifier = verifyWithCloudflareAccess,
): Promise<AccessIdentity> {
  const token = request.headers.get("cf-access-jwt-assertion");

  if (!token) {
    throw new ApiError(
      401,
      "ACCESS_TOKEN_REQUIRED",
      "此要求需要有效的 Cloudflare Access 身份。",
    );
  }

  try {
    const payload = await verify(token, accessConfig(env));
    const subject = typeof payload.sub === "string" ? payload.sub.trim() : "";
    const email =
      typeof payload.email === "string"
        ? payload.email.trim().toLowerCase()
        : "";
    const displayName =
      typeof payload.name === "string" && payload.name.trim().length > 0
        ? payload.name.trim()
        : null;
    const tokenType =
      typeof payload.type === "string" ? payload.type.trim() : "";

    if (!subject || !email || tokenType !== "app") {
      throw new Error("Access identity claims are incomplete");
    }

    return { subject, email, displayName };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      401,
      "ACCESS_TOKEN_INVALID",
      "Cloudflare Access 身份無效或已過期。",
    );
  }
}
