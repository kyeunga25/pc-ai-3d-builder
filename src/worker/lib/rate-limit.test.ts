import { afterEach, describe, expect, it, vi } from "vitest";

import { enforcePilotRateLimit, pilotRateLimitKey } from "./rate-limit";

function createRateLimiter(success: boolean) {
  const limit = vi.fn(async (): Promise<{ success: boolean }> => ({
    success,
  }));
  const rateLimiter: RateLimit = { limit };

  return { limit, rateLimiter };
}

describe("pilot API rate limit", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses a versioned domain-separated digest instead of the Access subject", async () => {
    const { limit, rateLimiter } = createRateLimiter(true);

    await enforcePilotRateLimit(rateLimiter, "subject-1");

    expect(limit).toHaveBeenCalledWith({
      key: "subject-sha256-v1:6ceb43c7a4737b71055760577b226839f6d6272d23ebf40973026ea7919d3b2a",
    });
    expect(JSON.stringify(limit.mock.calls)).not.toContain("subject-1");
  });

  it("keeps replayed and concurrent subjects stable while separating actors", async () => {
    const [first, replay, concurrent, other] = await Promise.all([
      pilotRateLimitKey("subject-1"),
      pilotRateLimitKey("subject-1"),
      pilotRateLimitKey("subject-1"),
      pilotRateLimitKey("subject-2"),
    ]);

    expect(replay).toBe(first);
    expect(concurrent).toBe(first);
    expect(other).not.toBe(first);
    expect(first).toMatch(/^subject-sha256-v1:[0-9a-f]{64}$/u);
    expect(other).toMatch(/^subject-sha256-v1:[0-9a-f]{64}$/u);
  });

  it.each(["", " ", " subject-1"])(
    "rejects a malformed internal subject before calling the binding: %j",
    async (subject) => {
      const { limit, rateLimiter } = createRateLimiter(true);

      await expect(enforcePilotRateLimit(rateLimiter, subject)).rejects.toThrow(
        "Access subject must be normalized for rate limiting",
      );
      expect(limit).not.toHaveBeenCalled();
    },
  );

  it("fails closed before the binding when digest derivation fails", async () => {
    const { limit, rateLimiter } = createRateLimiter(true);
    vi.spyOn(crypto.subtle, "digest").mockRejectedValueOnce(
      new Error("digest unavailable"),
    );

    await expect(
      enforcePilotRateLimit(rateLimiter, "subject-1"),
    ).rejects.toThrow("digest unavailable");
    expect(limit).not.toHaveBeenCalled();
  });

  it("rejects requests after the allowance is exhausted", async () => {
    const { rateLimiter } = createRateLimiter(false);

    await expect(
      enforcePilotRateLimit(rateLimiter, "subject-1"),
    ).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
      message: expect.stringMatching(/稍後再試.+again later/iu),
    });
  });
});
