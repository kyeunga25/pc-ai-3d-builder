import { AlertTriangle, Download, Save, WalletCards, Zap } from "lucide-react";

import { currentBuild } from "../../shared/domain/mockData";
import { formatHkd } from "../../shared/i18n/locale";

export function BuildStatusBar({
  onSave,
  onExport,
}: {
  onSave: () => void;
  onExport: () => void;
}) {
  return (
    <footer className="build-status-bar">
      <div className="build-status-item build-status-item--warning">
        <AlertTriangle aria-hidden="true" />
        <span>
          <small>相容性</small>
          <strong>可繼續，尚有 1 項警告</strong>
        </span>
      </div>
      <div className="build-status-item">
        <Zap aria-hidden="true" />
        <span>
          <small>估算功耗</small>
          <strong>{currentBuild.estimatedWatts} W</strong>
        </span>
      </div>
      <div className="build-status-item">
        <WalletCards aria-hidden="true" />
        <span>
          <small>總價</small>
          <strong>{formatHkd(currentBuild.totalPriceMinor)}</strong>
        </span>
      </div>
      <div className="build-status-actions">
        <button
          className="button button--secondary"
          type="button"
          onClick={onSave}
        >
          <Save aria-hidden="true" />
          儲存
        </button>
        <button
          className="button button--primary"
          type="button"
          onClick={onExport}
        >
          <Download aria-hidden="true" />
          匯出
        </button>
      </div>
    </footer>
  );
}
