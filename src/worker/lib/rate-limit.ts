import { ApiError } from "./api-error";

const RATE_LIMIT_KEY_DOMAIN = "rigstage:pilot-rate-limit:v1:";
const RATE_LIMIT_KEY_PREFIX = "subject-sha256-v1:";

function hexDigest(buffer: ArrayBuffer): string {
  let value = "";
  for (const byte of new Uint8Array(buffer)) {
    value += byte.toString(16).padStart(2, "0");
  }
  return value;
}

export async function pilotRateLimitKey(subject: string): Promise<string> {
  if (subject.length === 0 || subject !== subject.trim()) {
    throw new Error("Access subject must be normalized for rate limiting");
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${RATE_LIMIT_KEY_DOMAIN}${subject}`),
  );
  return `${RATE_LIMIT_KEY_PREFIX}${hexDigest(digest)}`;
}

export async function enforcePilotRateLimit(
  rateLimiter: RateLimit,
  subject: string,
): Promise<void> {
  const key = await pilotRateLimitKey(subject);
  const result = await rateLimiter.limit({ key });

  if (!result.success) {
    throw new ApiError(429, "RATE_LIMITED", "要求過於頻密，請稍後再試。");
  }
}
