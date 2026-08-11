export type BuilderInspectorDrawerCopy = {
  readonly english: string;
  readonly zhHant: string;
};

export type BuilderInspectorDrawerKeyboardAction =
  "close" | "ignore" | "trap-focus";

function inspectorDrawerCopy(
  zhHant: string,
  english: string,
): BuilderInspectorDrawerCopy {
  return { english, zhHant };
}

export function bilingualInspectorDrawerTitle(
  copy: BuilderInspectorDrawerCopy,
): string {
  return `${copy.zhHant} / ${copy.english}`;
}

export const builderInspectorDrawerCopy = {
  close: inspectorDrawerCopy("關閉檢查器", "Close inspector"),
  title: inspectorDrawerCopy("組裝檢查器", "Build inspector"),
} as const satisfies Record<string, BuilderInspectorDrawerCopy>;

export function builderInspectorDrawerKeyboardAction(
  key: string,
): BuilderInspectorDrawerKeyboardAction {
  if (key === "Escape") {
    return "close";
  }
  if (key === "Tab") {
    return "trap-focus";
  }
  return "ignore";
}

export function builderInspectorDrawerWrappedFocusTarget<T>(
  focusable: readonly T[],
  active: T | null,
  shiftKey: boolean,
): T | null {
  const first = focusable.at(0);
  const last = focusable.at(-1);
  if (first === undefined || last === undefined) {
    return null;
  }
  if (!focusable.includes(active as T)) {
    return shiftKey ? last : first;
  }
  if (shiftKey && active === first) {
    return last;
  }
  if (!shiftKey && active === last) {
    return first;
  }
  return null;
}
