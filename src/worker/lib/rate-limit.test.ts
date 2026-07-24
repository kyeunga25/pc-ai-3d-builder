import { describe, expect, it, vi } from "vitest";

import { enforcePilotRateLimit } from "./rate-limit";

describe("pilot API rate limit", () => {
  it("uses the Access subject as the private rate-limit key", async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });

    await enforcePilotRateLimit({ limit } as unknown as RateLimit, "subject-1");

    expect(limit).toHaveBeenCalledWith({ key: "subject-1" });
  });

  it("rejects requests after the allowance is exhausted", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });

    await expect(
      enforcePilotRateLimit({ limit } as unknown as RateLimit, "subject-1"),
    ).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
    });
  });
});
