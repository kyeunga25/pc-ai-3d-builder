import {
  AlertTriangle,
  Boxes,
  CircleCheck,
  CircleQuestionMark,
  Download,
  Save,
  WalletCards,
} from "lucide-react";

import type { BuildCompatibilitySummary } from "../../shared/domain/builds";
import { formatHkd } from "../../shared/i18n/locale";
import {
  bilingualStatusBarTitle,
  builderCompatibilitySummaryPresentation,
  builderSelectedComponentsCopy,
  builderStatusBarCopy,
  builderStatusBarExportTitle,
  type BuilderStatusBarCopy,
} from "./builder-status-bar-copy";

function StatusCopy({ copy }: { copy: BuilderStatusBarCopy }) {
  return (
    <span className="build-status-copy">
      <span>{copy.zhHant}</span>
      <span lang="en">{copy.english}</span>
    </span>
  );
}

export function BuildStatusBar({
  summary,
  selectedCount,
  totalPriceMinor,
  canSave,
  canExport,
  busy,
  onSave,
  onExport,
}: {
  summary: BuildCompatibilitySummary;
  selectedCount: number;
  totalPriceMinor: number;
  canSave: boolean;
  canExport: boolean;
  busy: boolean;
  onSave: () => void;
  onExport: () => void;
}) {
  const compatibility = builderCompatibilitySummaryPresentation(summary);
  const selectedComponents = builderSelectedComponentsCopy(selectedCount);
  const CompatibilityIcon =
    compatibility.tone === "success"
      ? CircleCheck
      : compatibility.tone === "unknown"
        ? CircleQuestionMark
        : AlertTriangle;

  return (
    <footer
      aria-label={bilingualStatusBarTitle(builderStatusBarCopy.barLabel)}
      className="build-status-bar"
    >
      <div
        className={`build-status-item build-status-item--${compatibility.tone}`}
      >
        <CompatibilityIcon aria-hidden="true" />
        <span>
          <small>
            <StatusCopy copy={builderStatusBarCopy.compatibility} />
          </small>
          <strong title={bilingualStatusBarTitle(compatibility.copy)}>
            <StatusCopy copy={compatibility.copy} />
          </strong>
        </span>
      </div>
      <div className="build-status-item">
        <Boxes aria-hidden="true" />
        <span>
          <small>
            <StatusCopy copy={builderStatusBarCopy.selectedComponents} />
          </small>
          <strong title={bilingualStatusBarTitle(selectedComponents)}>
            <StatusCopy copy={selectedComponents} />
          </strong>
        </span>
      </div>
      <div className="build-status-item">
        <WalletCards aria-hidden="true" />
        <span>
          <small>
            <StatusCopy copy={builderStatusBarCopy.workspaceTotal} />
          </small>
          <strong>{formatHkd(totalPriceMinor)}</strong>
        </span>
      </div>
      <div className="build-status-actions">
        <button
          className="button button--secondary"
          type="button"
          aria-label={bilingualStatusBarTitle(builderStatusBarCopy.save)}
          disabled={!canSave || busy}
          onClick={onSave}
        >
          <Save aria-hidden="true" />
          <StatusCopy copy={builderStatusBarCopy.save} />
        </button>
        <button
          className="button button--primary"
          type="button"
          aria-label={bilingualStatusBarTitle(builderStatusBarCopy.export)}
          disabled={!canExport || busy}
          title={builderStatusBarExportTitle(canExport)}
          onClick={onExport}
        >
          <Download aria-hidden="true" />
          <StatusCopy copy={builderStatusBarCopy.export} />
        </button>
      </div>
    </footer>
  );
}
