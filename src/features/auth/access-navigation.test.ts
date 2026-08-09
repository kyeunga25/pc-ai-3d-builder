import { describe, expect, it } from "vitest";

import {
  accessLogoutPath,
  createLoginPagePath,
  loginPagePath,
  parseLoginReason,
  workspaceLoginPath,
} from "./access-navigation";

describe("Access navigation", () => {
  it("uses top-level application login and logout paths", () => {
    expect(workspaceLoginPath).toBe("/dashboard");
    expect(accessLogoutPath).toBe("/cdn-cgi/access/logout");
    expect(loginPagePath).toBe("/login");
  });

  it("builds a bounded login route and rejects unknown reasons", () => {
    expect(
      createLoginPagePath(
        "session-expired",
        "/asset-review/draft/private_asset?asset=private_asset",
      ),
    ).toBe("/login?reason=session-expired&next=%2Fasset-review");
    expect(
      createLoginPagePath("access-required", "//example.com/builder"),
    ).toBe("/login?reason=access-required&next=%2Fdashboard");
    expect(parseLoginReason("not-authorized")).toBe("not-authorized");
    expect(parseLoginReason("unknown")).toBe("sign-in");
  });
});
