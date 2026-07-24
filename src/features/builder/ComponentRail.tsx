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

import { catalogParts, componentSteps } from "../../shared/domain/mockData";
import type { ComponentCategory } from "../../shared/domain/schemas";
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

export function ComponentRail({
  selected,
  onSelect,
}: {
  selected: StepId;
  onSelect: (step: StepId) => void;
}) {
  return (
    <aside className="component-rail" aria-label="組裝組件">
      <div className="component-rail__heading">
        <span>組件</span>
        <strong>已選 8 / 9 項</strong>
      </div>

      <div className="component-rail__body">
        <div className="component-steps">
          {componentSteps.map((step, index) => {
            const Icon = iconByStep[step.id];
            const isSelected = selected === step.id;
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
                  <small>
                    {step.id === "gpu"
                      ? "警告"
                      : step.state === "complete"
                        ? "已選"
                        : "待審"}
                  </small>
                </span>
                <span
                  className={`component-step__state component-step__state--${step.id === "gpu" ? "warning" : step.state}`}
                  aria-label={
                    step.id === "gpu"
                      ? "一項警告"
                      : step.state === "complete"
                        ? "已完成"
                        : "待處理"
                  }
                />
              </button>
            );
          })}
        </div>

        <div className="component-candidates" aria-label="顯示卡候選項目">
          <div className="component-candidates__heading">
            <span>顯示卡選項</span>
            <strong>顯示 3 項</strong>
          </div>
          {catalogParts
            .filter((part) => part.category === "gpu")
            .map((part, index) => (
              <article
                className={`candidate-part${index === 0 ? " is-selected" : ""}${
                  part.stockStatus === "out_of_stock" ? " is-incompatible" : ""
                }`}
                key={part.id}
              >
                <span className="candidate-part__visual" aria-hidden="true">
                  <Gauge />
                </span>
                <div>
                  <strong>{part.model}</strong>
                  <span className="mono">{formatHkd(part.priceMinor)}</span>
                  <small>
                    {part.stockStatus === "out_of_stock"
                      ? "不相容"
                      : `${part.stockCount ?? 0} 件現貨`}
                  </small>
                </div>
              </article>
            ))}
          <div className="candidate-note">
            只使用已核實的示範目錄資料；目前選擇不會寫入資料庫。
          </div>
        </div>
      </div>

      <div className="component-rail__selection">
        <span>已選組件</span>
        <strong>
          {selected === "gpu"
            ? "ASUS ProArt RTX 4070 SUPER"
            : componentSteps.find((step) => step.id === selected)?.label}
        </strong>
        <small>
          {selected === "gpu"
            ? `${formatHkd(549_900)} · 5 件現貨`
            : "模擬組件狀態"}
        </small>
      </div>
    </aside>
  );
}
