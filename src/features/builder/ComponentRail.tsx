import {
  Box,
  CircuitBoard,
  ClipboardCheck,
  Cpu,
  Fan,
  Gauge,
  HardDrive,
  MemoryStick,
  PackageCheck,
  Snowflake,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { componentSteps } from "../../shared/domain/mockData";
import type { CompatibilityFinding } from "../../shared/domain/builds";
import type {
  CatalogPart,
  ComponentCategory,
} from "../../shared/domain/schemas";
import { formatHkd } from "../../shared/i18n/locale";

type StepId = ComponentCategory | "summary";

const iconByStep: Record<StepId, ComponentType<SVGProps<SVGSVGElement>>> = {
  case: Box,
  motherboard: CircuitBoard,
  cpu: Cpu,
  gpu: Gauge,
  memory: MemoryStick,
  cooling: Snowflake,
  storage: HardDrive,
  psu: PackageCheck,
  fans: Fan,
  summary: ClipboardCheck,
};

function stepState(
  step: StepId,
  selectedParts: CatalogPart[],
  findings: CompatibilityFinding[],
) {
  if (step === "summary") {
    if (findings.some((finding) => finding.severity === "error")) {
      return { label: "有錯誤", tone: "error" };
    }
    if (findings.some((finding) => finding.severity === "unknown")) {
      return { label: "待核實", tone: "unknown" };
    }
    if (findings.some((finding) => finding.severity === "warning")) {
      return { label: "有警告", tone: "warning" };
    }
    return { label: "可匯出", tone: "complete" };
  }
  const related = findings.filter((finding) =>
    finding.categories.includes(step),
  );
  if (related.some((finding) => finding.severity === "error")) {
    return { label: "錯誤", tone: "error" };
  }
  if (!selectedParts.some((part) => part.category === step)) {
    return { label: "未選", tone: "pending" };
  }
  if (related.some((finding) => finding.severity === "unknown")) {
    return { label: "待核實", tone: "unknown" };
  }
  if (related.some((finding) => finding.severity === "warning")) {
    return { label: "警告", tone: "warning" };
  }
  return { label: "已選", tone: "complete" };
}

export function ComponentRail({
  selected,
  catalogueParts,
  selectedParts,
  findings,
  canWrite,
  onSelect,
  onChoosePart,
}: {
  selected: StepId;
  catalogueParts: CatalogPart[];
  selectedParts: CatalogPart[];
  findings: CompatibilityFinding[];
  canWrite: boolean;
  onSelect: (step: StepId) => void;
  onChoosePart: (part: CatalogPart) => void;
}) {
  const selectedPart =
    selected === "summary"
      ? null
      : (selectedParts.find((part) => part.category === selected) ?? null);
  const candidates =
    selected === "summary"
      ? []
      : catalogueParts.filter((part) => part.category === selected);

  return (
    <aside className="component-rail" aria-label="組裝組件">
      <div className="component-rail__heading">
        <span>組件</span>
        <strong>已選 {selectedParts.length} / 9 項</strong>
      </div>

      <div className="component-rail__body">
        <div className="component-steps">
          {componentSteps.map((step, index) => {
            const Icon = iconByStep[step.id];
            const isSelected = selected === step.id;
            const state = stepState(step.id, selectedParts, findings);
            return (
              <button
                className={`component-step${isSelected ? " is-selected" : ""}`}
                key={step.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(step.id)}
              >
                <span className="component-step__number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Icon aria-hidden="true" />
                <span className="component-step__labels">
                  <strong className="component-step__full-label">
                    {step.label}
                  </strong>
                  <strong className="component-step__short-label">
                    {step.shortLabel}
                  </strong>
                  <small>{state.label}</small>
                </span>
                <span
                  className={`component-step__state component-step__state--${state.tone}`}
                  aria-label={state.label}
                />
              </button>
            );
          })}
        </div>

        <div className="component-candidates" aria-label="產品候選項目">
          <div className="component-candidates__heading">
            <span>
              {selected === "summary"
                ? "組裝總覽"
                : `${componentSteps.find((step) => step.id === selected)?.label}選項`}
            </span>
            <strong>{candidates.length} 項</strong>
          </div>
          {candidates.map((part) => {
            const isSelected = selectedPart?.id === part.id;
            return (
              <button
                className={`candidate-part${isSelected ? " is-selected" : ""}${
                  part.stockStatus === "out_of_stock" ? " is-unavailable" : ""
                }`}
                key={part.id}
                type="button"
                aria-pressed={isSelected}
                disabled={!canWrite}
                onClick={() => onChoosePart(part)}
              >
                <span className="candidate-part__visual" aria-hidden="true">
                  {(() => {
                    const Icon = iconByStep[part.category];
                    return <Icon />;
                  })()}
                </span>
                <span>
                  <strong>{part.model}</strong>
                  <span className="mono">{formatHkd(part.priceMinor)}</span>
                  <small>
                    {part.stockStatus === "out_of_stock"
                      ? "目前缺貨"
                      : part.stockCount === null
                        ? "庫存未提供"
                        : `${part.stockCount} 件現貨`}
                  </small>
                </span>
              </button>
            );
          })}
          {candidates.length === 0 ? (
            <div className="candidate-note">
              {selected === "summary"
                ? "總覽會列出可解釋的規則結果；相容性不會由 3D 外觀推斷。"
                : "目錄內暫時沒有此類別的可選產品。"}
            </div>
          ) : (
            <div className="candidate-note">
              只會使用目前工作空間的目錄記錄；選擇要按「儲存」才會寫入 D1。
            </div>
          )}
        </div>
      </div>

      <div className="component-rail__selection">
        <span>{selected === "summary" ? "目前組裝" : "已選組件"}</span>
        <strong>
          {selected === "summary"
            ? `${selectedParts.length} 個類別`
            : selectedPart
              ? `${selectedPart.manufacturer} ${selectedPart.model}`
              : "尚未選擇"}
        </strong>
        <small>
          {selectedPart
            ? `${formatHkd(selectedPart.priceMinor)} · ${selectedPart.sku}`
            : "從上方目錄候選項目選擇"}
        </small>
      </div>
    </aside>
  );
}
