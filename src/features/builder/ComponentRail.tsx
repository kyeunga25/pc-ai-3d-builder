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

import type { CompatibilityFinding } from "../../shared/domain/builds";
import type { CatalogPart } from "../../shared/domain/schemas";
import { formatHkd } from "../../shared/i18n/locale";
import {
  builderComponentCandidateStockCopy,
  builderComponentCandidatesCountCopy,
  builderComponentOptionsCopy,
  builderComponentRailCopy,
  builderComponentSelectedCategoriesCopy,
  builderComponentSelectedCountCopy,
  builderComponentStepCopy,
  builderComponentStepOrder,
  builderComponentStepState,
  builderComponentTitle,
  type BuilderComponentCopy,
  type BuilderComponentStepId,
} from "./builder-component-rail-copy";

function RailCopy({ copy }: { copy: BuilderComponentCopy }) {
  return (
    <span className="component-rail-copy">
      <span>{copy.zhHant}</span>
      <span lang="en">{copy.english}</span>
    </span>
  );
}

const iconByStep: Record<
  BuilderComponentStepId,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
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
  catalogueParts,
  selectedParts,
  findings,
  canWrite,
  onSelect,
  onChoosePart,
}: {
  selected: BuilderComponentStepId;
  catalogueParts: CatalogPart[];
  selectedParts: CatalogPart[];
  findings: CompatibilityFinding[];
  canWrite: boolean;
  onSelect: (step: BuilderComponentStepId) => void;
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
    <aside
      className="component-rail"
      aria-label={builderComponentTitle(
        builderComponentRailCopy.buildComponents,
      )}
    >
      <div className="component-rail__heading">
        <RailCopy copy={builderComponentRailCopy.buildComponents} />
        <strong>
          <RailCopy
            copy={builderComponentSelectedCountCopy(selectedParts.length)}
          />
        </strong>
      </div>

      <div className="component-rail__body">
        <div className="component-steps">
          {builderComponentStepOrder.map((step, index) => {
            const Icon = iconByStep[step];
            const isSelected = selected === step;
            const state = builderComponentStepState(
              step,
              selectedParts,
              findings,
            );
            const copy = builderComponentStepCopy[step];
            return (
              <button
                className={`component-step${isSelected ? " is-selected" : ""}`}
                key={step}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(step)}
              >
                <span className="component-step__number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Icon aria-hidden="true" />
                <span className="component-step__labels">
                  <strong className="component-step__full-label">
                    <RailCopy copy={copy.full} />
                  </strong>
                  <strong className="component-step__short-label">
                    <RailCopy copy={copy.short} />
                  </strong>
                  <small>
                    <RailCopy copy={state.copy} />
                  </small>
                </span>
                <span
                  className={`component-step__state component-step__state--${state.tone}`}
                  aria-label={builderComponentTitle(state.copy)}
                />
              </button>
            );
          })}
        </div>

        <div
          className="component-candidates"
          aria-label={builderComponentTitle(
            builderComponentRailCopy.candidateItems,
          )}
        >
          <div className="component-candidates__heading">
            <RailCopy copy={builderComponentOptionsCopy(selected)} />
            <strong>
              <RailCopy
                copy={builderComponentCandidatesCountCopy(candidates.length)}
              />
            </strong>
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
                  <small className={`candidate-stock--${part.stockStatus}`}>
                    <RailCopy copy={builderComponentCandidateStockCopy(part)} />
                  </small>
                </span>
              </button>
            );
          })}
          {candidates.length === 0 ? (
            <div className="candidate-note">
              <RailCopy
                copy={
                  selected === "summary"
                    ? builderComponentRailCopy.summaryGuidance
                    : builderComponentRailCopy.noCandidates
                }
              />
            </div>
          ) : (
            <div className="candidate-note">
              <RailCopy copy={builderComponentRailCopy.saveBoundary} />
            </div>
          )}
        </div>
      </div>

      <div className="component-rail__selection">
        <RailCopy
          copy={
            selected === "summary"
              ? builderComponentRailCopy.currentBuild
              : builderComponentRailCopy.selectedComponent
          }
        />
        <strong>
          {selected === "summary" ? (
            <RailCopy
              copy={builderComponentSelectedCategoriesCopy(
                selectedParts.length,
              )}
            />
          ) : selectedPart ? (
            `${selectedPart.manufacturer} ${selectedPart.model}`
          ) : (
            <RailCopy copy={builderComponentRailCopy.noSelection} />
          )}
        </strong>
        <small>
          {selectedPart ? (
            `${formatHkd(selectedPart.priceMinor)} · ${selectedPart.sku}`
          ) : (
            <RailCopy copy={builderComponentRailCopy.chooseCandidate} />
          )}
        </small>
      </div>
    </aside>
  );
}
