import { describe, expect, it } from "vitest";

import {
  bilingualInspectorDrawerTitle,
  builderInspectorDrawerCopy,
  builderInspectorDrawerKeyboardAction,
  builderInspectorDrawerWrappedFocusTarget,
} from "./builder-inspector-drawer";

describe("Builder inspector drawer contract", () => {
  it("keeps every fixed label bilingual", () => {
    for (const copy of Object.values(builderInspectorDrawerCopy)) {
      expect(copy.zhHant).toMatch(/[\u3400-\u9fff]/u);
      expect(copy.english).toMatch(/[A-Za-z]/u);
      expect(bilingualInspectorDrawerTitle(copy)).toBe(
        `${copy.zhHant} / ${copy.english}`,
      );
    }
  });

  it("maps Escape and Tab without treating other keys as modal actions", () => {
    expect(builderInspectorDrawerKeyboardAction("Escape")).toBe("close");
    expect(builderInspectorDrawerKeyboardAction("Tab")).toBe("trap-focus");
    expect(builderInspectorDrawerKeyboardAction("Enter")).toBe("ignore");
  });

  it("wraps focus only at the first and last drawer controls", () => {
    const focusable = ["first", "middle", "last"] as const;

    expect(
      builderInspectorDrawerWrappedFocusTarget(focusable, "first", true),
    ).toBe("last");
    expect(
      builderInspectorDrawerWrappedFocusTarget(focusable, "last", false),
    ).toBe("first");
    expect(
      builderInspectorDrawerWrappedFocusTarget(focusable, "middle", false),
    ).toBeNull();
    expect(
      builderInspectorDrawerWrappedFocusTarget(focusable, null, false),
    ).toBe("first");
    expect(
      builderInspectorDrawerWrappedFocusTarget(focusable, null, true),
    ).toBe("last");
    expect(
      builderInspectorDrawerWrappedFocusTarget([], null, false),
    ).toBeNull();
  });
});
