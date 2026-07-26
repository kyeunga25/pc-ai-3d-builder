import {
  AlertTriangle,
  Box,
  CheckCircle2,
  CircleGauge,
  HelpCircle,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { StatusBadge } from "../../shared/components/StatusBadge";
import type { CompatibilityFinding } from "../../shared/domain/builds";
import type { CatalogPart } from "../../shared/domain/schemas";
import { formatHkd } from "../../shared/i18n/locale";

type InspectorTab = "details" | "compatibility" | "asset";

const specificationLabels: Record<string, string> = {
  capacityGb: "容量（GB）",
  capacityWatts: "容量（W）",
  coolerHeightMm: "散熱器高度（mm）",
  count: "數量",
  formFactor: "尺寸規格",
  interface: "介面",
  lengthMm: "長度（mm）",
  maxCoolerHeightMm: "散熱器淨空（mm）",
  maxGpuLengthMm: "顯示卡淨空（mm）",
  memoryType: "記憶體類型",
  recommendedPsuWatts: "建議電源（W）",
  sizeMm: "尺寸（mm）",
  slotWidth: "插槽厚度",
  socket: "插槽",
  speedMts: "速度（MT/s）",
  supportedMotherboardFormFactors: "支援主機板尺寸",
  tdpWatts: "TDP（W）",
};

function findingIcon(finding: CompatibilityFinding) {
  switch (finding.severity) {
    case "pass":
      return <CheckCircle2 aria-hidden="true" />;
    case "warning":
      return <AlertTriangle aria-hidden="true" />;
    case "error":
      return <XCircle aria-hidden="true" />;
    case "unknown":
      return <HelpCircle aria-hidden="true" />;
  }
}

function findingTone(finding: CompatibilityFinding) {
  return finding.severity === "pass"
    ? "success"
    : finding.severity === "warning" || finding.severity === "unknown"
      ? "warning"
      : "danger";
}

export function BuildInspector({
  part,
  findings,
}: {
  part: CatalogPart | null;
  findings: CompatibilityFinding[];
}) {
  const [tab, setTab] = useState<InspectorTab>("details");

  if (!part) {
    return (
      <div className="build-inspector build-inspector--empty">
        <CircleGauge aria-hidden="true" />
        <h2>尚未選擇組件</h2>
        <p>先選擇左側類別及目錄產品，再查看規格與相容性證據。</p>
      </div>
    );
  }

  return (
    <div className="build-inspector">
      <div className="build-inspector__header">
        <span className="inspector-product-icon" aria-hidden="true">
          <Box />
        </span>
        <div>
          <span>已選組件</span>
          <h2>
            {part.manufacturer} {part.model}
          </h2>
          <p>
            <span className="stock-inline">
              <i aria-hidden="true" />
              {part.stockCount === null
                ? "庫存未提供"
                : `${part.stockCount} 件庫存`}
            </span>
            <strong>{formatHkd(part.priceMinor)}</strong>
          </p>
        </div>
      </div>

      <div className="inspector-tabs" role="tablist" aria-label="檢查器分頁">
        {(
          [
            ["details", "詳情"],
            ["compatibility", "相容性"],
            ["asset", "3D 素材"],
          ] as const
        ).map(([id, label]) => (
          <button
            id={`inspector-${id}-tab`}
            className={tab === id ? "is-active" : ""}
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`inspector-${id}-panel`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "details" ? (
        <div
          className="inspector-panel"
          id="inspector-details-panel"
          role="tabpanel"
          aria-labelledby="inspector-details-tab"
        >
          <section className="inspector-section">
            <h3>結構化規格</h3>
            <dl className="inspector-specs">
              <div>
                <dt>SKU</dt>
                <dd>{part.sku}</dd>
              </div>
              {Object.entries(part.specifications).map(([key, value]) => (
                <div key={key}>
                  <dt>{specificationLabels[key] ?? key}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
            </dl>
            <StatusBadge
              tone={
                part.specificationStatus === "verified" ? "success" : "warning"
              }
            >
              {part.specificationStatus === "verified"
                ? "規格已核實"
                : "規格未核實"}
            </StatusBadge>
          </section>

          <section className="inspector-section">
            <h3>相關規則結果</h3>
            {findings.length > 0 ? (
              findings.map((finding) => (
                <div
                  className={`finding-row finding-row--${finding.severity}`}
                  key={`${finding.ruleId}-${finding.categories.join("-")}`}
                >
                  {findingIcon(finding)}
                  <span>
                    <strong>{finding.messageZhHant}</strong>
                    <small>{finding.messageEn}</small>
                  </span>
                  <StatusBadge tone={findingTone(finding)}>
                    {finding.severity}
                  </StatusBadge>
                </div>
              ))
            ) : (
              <p>此類別目前沒有結構化相容性規則。</p>
            )}
          </section>
        </div>
      ) : tab === "compatibility" ? (
        <div
          className="inspector-panel inspector-panel--focused"
          id="inspector-compatibility-panel"
          role="tabpanel"
          aria-labelledby="inspector-compatibility-tab"
        >
          <CircleGauge aria-hidden="true" />
          <h3>可解釋相容性證據</h3>
          <p>只使用已核實的目錄欄位；缺少資料會顯示為未知，不會猜測。</p>
          {findings.map((finding) => (
            <section
              className="compatibility-evidence"
              key={`${finding.ruleId}-${finding.categories.join("-")}`}
            >
              <StatusBadge tone={findingTone(finding)}>
                {finding.severity}
              </StatusBadge>
              <strong>{finding.messageZhHant}</strong>
              {finding.evidence.map((evidence) => (
                <dl className="inspector-specs" key={evidence.labelEn}>
                  <div>
                    <dt>{evidence.labelZhHant}</dt>
                    <dd>
                      {evidence.actual} / {evidence.expected}
                    </dd>
                  </div>
                </dl>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <div
          className="inspector-panel inspector-panel--focused"
          id="inspector-asset-panel"
          role="tabpanel"
          aria-labelledby="inspector-asset-tab"
        >
          <SlidersHorizontal aria-hidden="true" />
          <h3>3D 素材狀態</h3>
          <p>
            組裝相容性不會由視覺模型推斷。私人 GLB 只可在素材審核頁經授權載入。
          </p>
          <dl className="inspector-specs">
            <div>
              <dt>素材狀態</dt>
              <dd>{part.assetStatus}</dd>
            </div>
            <div>
              <dt>品質</dt>
              <dd>{part.assetQuality}</dd>
            </div>
            <div>
              <dt>使用條件</dt>
              <dd>
                {part.assetStatus === "approved"
                  ? "已核准，可供人手預覽"
                  : "不可當作已核准素材"}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
