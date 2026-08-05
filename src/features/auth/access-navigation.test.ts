import { describe, expect, it } from "vitest";

import { accessLogoutPath, workspaceLoginPath } from "./access-navigation";

describe("Access navigation", () => {
  it("uses top-level application login and logout paths", () => {
    expect(workspaceLoginPath).toBe("/dashboard");
    expect(accessLogoutPath).toBe("/cdn-cgi/access/logout");
  });
});
