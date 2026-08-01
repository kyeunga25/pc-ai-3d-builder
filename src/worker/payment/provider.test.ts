import { describe, expect, it } from "vitest";

import { createPaymentProvider } from "./provider";

describe("payment provider boundary", () => {
  it("remains disabled without creating a hosted payment request", async () => {
    await expect(
      createPaymentProvider().createHostedRequest({
        amountMinor: 100,
        currency: "HKD",
        reference: "synthetic-reference",
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_DISABLED" });
  });
});
