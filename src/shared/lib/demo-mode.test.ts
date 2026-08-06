import { describe, expect, it } from "vitest";

import { isPublicDemoPath, publicDemoRoot } from "./demo-mode";

describe("public demo mode", () => {
  it("matches only the dedicated public demo route", () => {
    expect(publicDemoRoot).toBe("/demo");
    expect(isPublicDemoPath("/demo")).toBe(true);
    expect(isPublicDemoPath("/demo/dashboard")).toBe(true);
    expect(isPublicDemoPath("/dashboard")).toBe(false);
    expect(isPublicDemoPath("/demonstration")).toBe(false);
  });
});
