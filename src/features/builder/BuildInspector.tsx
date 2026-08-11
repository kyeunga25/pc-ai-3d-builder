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
import {
  bilingualBuilderCopy,
  bilingualBuilderTitle,
  builderInspectorAssetQualityCopy,
  builderInspectorAssetStatusCopy,
  builderInspectorCopy,
  builderInspectorSeverityCopy,
  builderInspectorSpecificationLabelCopy,
  builderInspectorSpecificationStatusCopy,
  builderInspectorStockCopy,
  builderInspectorTabCopy,
  builderInspectorUsageCopy,
  type BuilderInspectorCopy,
  type BuilderInspectorTab,
} from "./builder-inspector-copy";

function InspectorCopy({ copy }: { copy: BuilderInspectorCopy }) {
  return (
    <span className="builder-inspector-copy">
      <span>{copy.zhHant}</span>
      <span lang="en">{copy.english}</span>
    </span>
  );
}

function FindingMessage({ finding }: { finding: CompatibilityFinding }) {
  return (
    <span className="builder-finding-copy">
      <strong>{finding.messageZhHant}</strong>
      <small lang="en">{finding.messageEn}</small>
    </span>
  );
}

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

function findingClassTone(finding: CompatibilityFinding) {
  return finding.severity === "pass" ? "success" : finding.severity;
}

export function BuildInspectorPanel({
  tab,
  part,
  findings,
}: {
  tab: BuilderInspectorTab;
  part: CatalogPart;
  findings: CompatibilityFinding[];
}) {
  if (tab === "details") {
    return (
      <div
        className="inspector-panel"
        id="inspector-details-panel"
        role="tabpanel"
        aria-labelledby="inspector-details-tab"
      >
        <section className="inspector-section">
          <h3>
            <InspectorCopy
              copy={builderInspectorCopy.structuredSpecificationsHeading}
            />
          </h3>
          <dl className="inspector-specs">
            <div>
              <dt>
                <InspectorCopy copy={builderInspectorCopy.skuLabel} />
              </dt>
              <dd>{part.sku}</dd>
            </div>
            {Object.entries(part.specifications).map(([key, value]) => (
              <div key={key}>
                <dt>
                  <InspectorCopy
                    copy={builderInspectorSpecificationLabelCopy(key)}
                  />
                </dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
          <StatusBadge
            tone={
              part.specificationStatus === "verified" ? "success" : "warning"
            }
          >
            <InspectorCopy
              copy={
                builderInspectorSpecificationStatusCopy[
                  part.specificationStatus
                ]
              }
            />
          </StatusBadge>
        </section>

        <section className="inspector-section">
          <h3>
            <InspectorCopy copy={builderInspectorCopy.relatedRulesHeading} />
          </h3>
          {findings.length > 0 ? (
            findings.map((finding) => (
              <div
                className={`finding-row finding-row--${findingClassTone(finding)}`}
                key={`${finding.ruleId}-${finding.categories.join("-")}`}
              >
                {findingIcon(finding)}
                <FindingMessage finding={finding} />
                <StatusBadge tone={findingTone(finding)}>
                  <InspectorCopy
                    copy={builderInspectorSeverityCopy[finding.severity]}
                  />
                </StatusBadge>
              </div>
            ))
          ) : (
            <p className="inspector-empty-copy">
              <InspectorCopy copy={builderInspectorCopy.noRules} />
            </p>
          )}
        </section>
      </div>
    );
  }

  if (tab === "compatibility") {
    return (
      <div
        className="inspector-panel inspector-panel--focused"
        id="inspector-compatibility-panel"
        role="tabpanel"
        aria-labelledby="inspector-compatibility-tab"
      >
        <CircleGauge aria-hidden="true" />
        <h3>
          <InspectorCopy copy={builderInspectorCopy.compatibilityHeading} />
        </h3>
        <p>
          <InspectorCopy copy={builderInspectorCopy.compatibilityGuidance} />
        </p>
        {findings.length > 0 ? (
          findings.map((finding) => (
            <section
              className="compatibility-evidence"
              key={`${finding.ruleId}-${finding.categories.join("-")}`}
            >
              <StatusBadge tone={findingTone(finding)}>
                <InspectorCopy
                  copy={builderInspectorSeverityCopy[finding.severity]}
                />
              </StatusBadge>
              <FindingMessage finding={finding} />
              {finding.evidence.map((evidence) => (
                <dl className="inspector-specs" key={evidence.labelEn}>
                  <div>
                    <dt>
                      <InspectorCopy
                        copy={bilingualBuilderCopy(
                          evidence.labelZhHant,
                          evidence.labelEn,
                        )}
                      />
                    </dt>
                    <dd>
                      {evidence.actual} / {evidence.expected}
                    </dd>
                  </div>
                </dl>
              ))}
            </section>
          ))
        ) : (
          <p className="inspector-empty-copy">
            <InspectorCopy copy={builderInspectorCopy.noRules} />
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className="inspector-panel inspector-panel--focused"
      id="inspector-asset-panel"
      role="tabpanel"
      aria-labelledby="inspector-asset-tab"
    >
      <SlidersHorizontal aria-hidden="true" />
      <h3>
        <InspectorCopy copy={builderInspectorCopy.assetHeading} />
      </h3>
      <p>
        <InspectorCopy copy={builderInspectorCopy.assetGuidance} />
      </p>
      <dl className="inspector-specs">
        <div>
          <dt>
            <InspectorCopy copy={builderInspectorCopy.assetStatusLabel} />
          </dt>
          <dd>
            <InspectorCopy
              copy={builderInspectorAssetStatusCopy[part.assetStatus]}
            />
          </dd>
        </div>
        <div>
          <dt>
            <InspectorCopy copy={builderInspectorCopy.assetQualityLabel} />
          </dt>
          <dd>
            <InspectorCopy
              copy={builderInspectorAssetQualityCopy[part.assetQuality]}
            />
          </dd>
        </div>
        <div>
          <dt>
            <InspectorCopy copy={builderInspectorCopy.assetUsageLabel} />
          </dt>
          <dd>
            <InspectorCopy copy={builderInspectorUsageCopy(part.assetStatus)} />
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function BuildInspector({
  part,
  findings,
}: {
  part: CatalogPart | null;
  findings: CompatibilityFinding[];
}) {
  const [tab, setTab] = useState<BuilderInspectorTab>("details");

  if (!part) {
    return (
      <div className="build-inspector build-inspector--empty">
        <CircleGauge aria-hidden="true" />
        <h2>
          <InspectorCopy copy={builderInspectorCopy.emptyHeading} />
        </h2>
        <p>
          <InspectorCopy copy={builderInspectorCopy.emptyGuidance} />
        </p>
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
          <InspectorCopy copy={builderInspectorCopy.selectedComponent} />
          <h2>
            {part.manufacturer} {part.model}
          </h2>
          <p>
            <span className="stock-inline">
              <i aria-hidden="true" />
              <InspectorCopy
                copy={builderInspectorStockCopy(part.stockCount)}
              />
            </span>
            <strong>{formatHkd(part.priceMinor)}</strong>
          </p>
        </div>
      </div>

      <div
        className="inspector-tabs"
        role="tablist"
        aria-label={bilingualBuilderTitle(
          builderInspectorCopy.inspectorTabsLabel,
        )}
      >
        {(Object.keys(builderInspectorTabCopy) as BuilderInspectorTab[]).map(
          (id) => (
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
              <InspectorCopy copy={builderInspectorTabCopy[id]} />
            </button>
          ),
        )}
      </div>
      <BuildInspectorPanel tab={tab} part={part} findings={findings} />
    </div>
  );
}
