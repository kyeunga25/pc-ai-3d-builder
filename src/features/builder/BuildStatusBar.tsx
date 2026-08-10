import {
  AlertTriangle,
  Boxes,
  Download,
  Save,
  WalletCards,
} from "lucide-react";

import type { BuildCompatibilitySummary } from "../../shared/domain/builds";
import { formatHkd } from "../../shared/i18n/locale";

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
  const compatibilityMessage =
    summary.errorCount > 0
      ? `${summary.errorCount} 項嚴重錯誤`
      : summary.unknownCount > 0
        ? `${summary.unknownCount} 項結果未知`
        : summary.warningCount > 0
          ? `可繼續，尚有 ${summary.warningCount} 項警告`
          : "已通過所有可用規則";

  return (
    <footer className="build-status-bar">
      <div
        className={`build-status-item${
          summary.errorCount > 0 || summary.unknownCount > 0
            ? " build-status-item--warning"
            : ""
        }`}
      >
        <AlertTriangle aria-hidden="true" />
        <span>
          <small>相容性</small>
          <strong>{compatibilityMessage}</strong>
        </span>
      </div>
      <div className="build-status-item">
        <Boxes aria-hidden="true" />
        <span>
          <small>已選組件</small>
          <strong>{selectedCount} / 9</strong>
        </span>
      </div>
      <div className="build-status-item">
        <WalletCards aria-hidden="true" />
        <span>
          <small>工作空間總價</small>
          <strong>{formatHkd(totalPriceMinor)}</strong>
        </span>
      </div>
      <div className="build-status-actions">
        <button
          className="button button--secondary"
          type="button"
          disabled={!canSave || busy}
          onClick={onSave}
        >
          <Save aria-hidden="true" />
          儲存 <span lang="en">Save</span>
        </button>
        <button
          className="button button--primary"
          type="button"
          disabled={!canExport || busy}
          title={
            canExport
              ? "匯出不含身份、價格、庫存及私人素材的 JSON / Export JSON without identity, pricing, stock or private assets"
              : "先儲存變更，並解決嚴重錯誤及未知相容性結果 / Save changes and resolve errors and unknown compatibility results first"
          }
          onClick={onExport}
        >
          <Download aria-hidden="true" />
          匯出 <span lang="en">Export</span>
        </button>
      </div>
    </footer>
  );
}
