import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

import type { CompatibilityFinding } from "../../shared/domain/builds";
import type { CatalogPart } from "../../shared/domain/schemas";
import { BuildInspector } from "./BuildInspector";
import {
  bilingualInspectorDrawerTitle,
  builderInspectorDrawerCopy,
  builderInspectorDrawerKeyboardAction,
  builderInspectorDrawerWrappedFocusTarget,
  type BuilderInspectorDrawerCopy,
} from "./builder-inspector-drawer";

const drawerFocusableSelector =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

function InspectorDrawerCopy({ copy }: { copy: BuilderInspectorDrawerCopy }) {
  return (
    <span className="inspector-drawer-copy">
      <span>{copy.zhHant}</span>
      <span lang="en">{copy.english}</span>
    </span>
  );
}

export function BuilderInspectorDrawer({
  part,
  findings,
  onClose,
}: {
  part: CatalogPart | null;
  findings: CompatibilityFinding[];
  onClose: () => void;
}) {
  const titleId = useId();
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    const compactViewport = window.matchMedia("(max-width: 1099px)");
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (!event.matches) {
        onClose();
      }
    };
    if (!compactViewport.matches) {
      onClose();
      return;
    }
    compactViewport.addEventListener("change", handleViewportChange);
    return () =>
      compactViewport.removeEventListener("change", handleViewportChange);
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const action = builderInspectorDrawerKeyboardAction(event.key);
      if (action === "close") {
        event.preventDefault();
        onClose();
        return;
      }
      if (action !== "trap-focus") {
        return;
      }

      const focusable = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          drawerFocusableSelector,
        ) ?? [],
      );
      if (focusable.length === 0) {
        event.preventDefault();
        drawerRef.current?.focus();
        return;
      }

      const active =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const target = builderInspectorDrawerWrappedFocusTarget(
        focusable,
        active,
        event.shiftKey,
      );
      if (target) {
        event.preventDefault();
        target.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const closeLabel = bilingualInspectorDrawerTitle(
    builderInspectorDrawerCopy.close,
  );

  return (
    <div className="inspector-drawer-layer">
      <button
        className="inspector-drawer-backdrop"
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
      />
      <aside
        ref={drawerRef}
        className="inspector-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="inspector-drawer__top">
          <strong id={titleId}>
            <InspectorDrawerCopy copy={builderInspectorDrawerCopy.title} />
          </strong>
          <button
            ref={closeButtonRef}
            className="icon-button"
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <BuildInspector part={part} findings={findings} />
      </aside>
    </div>
  );
}
