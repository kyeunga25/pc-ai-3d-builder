import { describe, expect, it } from "vitest";

import { healthResponse } from "./health";

describe("healthResponse", () => {
  it("returns a no-store JSON health contract", async () => {
    const response = healthResponse("req_test");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      service: "rigstage",
      requestId: "req_test",
    });
  });
});
