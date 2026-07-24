import { ApiError } from "./api-error";

export async function enforcePilotRateLimit(
  rateLimiter: RateLimit,
  subject: string,
): Promise<void> {
  const result = await rateLimiter.limit({ key: subject });

  if (!result.success) {
    throw new ApiError(429, "RATE_LIMITED", "要求過於頻密，請稍後再試。");
  }
}
