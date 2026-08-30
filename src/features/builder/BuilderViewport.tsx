import {
  Box,
  Camera,
  ChevronDown,
  Expand,
  Image,
  Move3D,
  Rotate3D,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import type { CatalogPart } from "../../shared/domain/schemas";
import { formatHkd } from "../../shared/i18n/locale";
import {
  loadBuilderModelResources,
  selectBuilderModelCandidates,
  type BuilderModelResource,
} from "./builder-model-scene";
import {
  bilingualViewportTitle,
  builderCameraPresets,
  builderViewportCameraCopy,
  builderViewportCameraReadoutCopy,
  builderViewportCopy,
  builderViewportDisplayModeCopy,
  builderViewportDisplayReadoutCopy,
  builderViewportEditingCopy,
  builderViewportFooterPreviewCopy,
  builderViewportLayoutBoundaryCopy,
  builderViewportModelCaptionCopy,
  builderViewportPlaceholderCopy,
  builderViewportSceneDetailsCopy,
  builderViewportSelectionLabelCopy,
  builderViewportStockCopy,
  builderViewportSummarySelectionCopy,
  type BuilderCameraPreset,
  type BuilderDisplayMode,
  type BuilderStepId,
  type BuilderViewportCopy,
} from "./builder-viewport-copy";

export type {
  BuilderCameraPreset,
  BuilderDisplayMode,
} from "./builder-viewport-copy";

function ViewportCopy({ copy }: { copy: BuilderViewportCopy }) {
  return (
    <span className="builder-viewport-copy">
      <span>{copy.zhHant}</span>
      <span lang="en">{copy.english}</span>
    </span>
  );
}
const AssetModelPreview = lazy(async () => {
  const module = await import("../../shared/components/AssetModelPreview");
  return { default: module.AssetModelPreview };
});

export function BuilderViewport({
  selectedCategory,
  camera,
  setCamera,
  displayMode,
  setDisplayMode,
  selectedPart,
  selectedParts,
  workspaceId,
  isLocalPreview,
}: {
  selectedCategory: BuilderStepId;
  camera: BuilderCameraPreset;
  setCamera: Dispatch<SetStateAction<BuilderCameraPreset>>;
  displayMode: BuilderDisplayMode;
  setDisplayMode: Dispatch<SetStateAction<BuilderDisplayMode>>;
  selectedPart: CatalogPart | null;
  selectedParts: readonly CatalogPart[];
  workspaceId: string;
  isLocalPreview: boolean;
}) {
  const isSummary = selectedCategory === "summary";
  const modelCandidates = useMemo(
    () =>
      selectBuilderModelCandidates({
        isLocalPreview,
        selectedCategory,
        selectedParts,
      }),
    [isLocalPreview, selectedCategory, selectedParts],
  );
  const modelKey = useMemo(
    () =>
      `${workspaceId}:${selectedCategory}:${modelCandidates
        .map(
          (candidate) =>
            `${candidate.category}:${candidate.assetId}:${candidate.source}`,
        )
        .join("|")}`,
    [modelCandidates, selectedCategory, workspaceId],
  );
  const [modelResource, setModelResource] = useState<{
    key: string;
    failedCount: number;
    models: readonly BuilderModelResource[];
  } | null>(null);
  const [previewResult, setPreviewResult] = useState<{
    key: string;
    failedCount: number;
    loadedCount: number;
  } | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const currentModelResource =
    modelResource?.key === modelKey ? modelResource : null;
  const modelResources = currentModelResource?.models ?? [];
  const modelUrl = modelResources[0]?.url ?? null;
  const hasModelResource = modelResources.length > 0;
  const currentPreviewResult =
    previewResult?.key === modelKey ? previewResult : null;
  const renderedModelCount = currentPreviewResult?.loadedCount ?? 0;
  const hasRenderedModel = renderedModelCount > 0;
  const previewLoading = hasModelResource && !currentPreviewResult;
  const failedModelCount =
    (currentModelResource?.failedCount ?? 0) +
    (currentPreviewResult?.failedCount ?? 0);
  const modelState =
    modelCandidates.length === 0
      ? "none"
      : !currentModelResource
        ? "loading"
        : hasModelResource
          ? "ready"
          : "error";
  const isLocalSyntheticModel =
    modelCandidates.length > 0 &&
    modelCandidates.every(
      (candidate) => candidate.source === "local-synthetic",
    );

  useEffect(() => {
    if (modelCandidates.length === 0) {
      return;
    }
    const controller = new AbortController();
    let loaded: Awaited<ReturnType<typeof loadBuilderModelResources>> | null =
      null;
    void loadBuilderModelResources({
      candidates: modelCandidates,
      signal: controller.signal,
      workspaceId,
    }).then((resources) => {
      loaded = resources;
      if (!controller.signal.aborted) {
        setModelResource({
          key: modelKey,
          failedCount: resources.failedCount,
          models: resources.models,
        });
      }
    });

    return () => {
      controller.abort();
      loaded?.release();
    };
  }, [modelCandidates, modelKey, workspaceId]);

  const recordPreviewResult = useCallback(
    (result: {
      readonly failedCount: number;
      readonly loadedCount: number;
    }) => {
      setPreviewResult({ key: modelKey, ...result });
    },
    [modelKey],
  );

  const renderMode =
    displayMode === "線框"
      ? "wireframe"
      : displayMode === "靜態預覽"
        ? "static"
        : "shaded";
  const placeholderCopy = builderViewportPlaceholderCopy({
    candidateCount: modelCandidates.length,
    hasApprovedAsset: selectedPart?.assetStatus === "approved",
    isLocalPreview,
    isLocalSyntheticModel,
    isSummary,
    modelState: modelState === "ready" ? "none" : modelState,
  });

  return (
    <section
      className="builder-viewport"
      aria-label={bilingualViewportTitle(builderViewportCopy.viewportLabel)}
    >
      <div className="builder-viewport__top">
        <div
          className="viewport-control-group"
          role="group"
          aria-label={bilingualViewportTitle(
            builderViewportCopy.cameraGroupLabel,
          )}
        >
          <span className="viewport-control-group__label">
            <Camera aria-hidden="true" />
            <ViewportCopy copy={builderViewportCopy.cameraLabel} />
          </span>
          {builderCameraPresets.map((preset) => (
            <button
              className={camera === preset ? "is-active" : ""}
              key={preset}
              type="button"
              aria-pressed={camera === preset}
              disabled={!hasRenderedModel}
              onClick={() => setCamera(preset)}
            >
              <ViewportCopy copy={builderViewportCameraCopy[preset]} />
            </button>
          ))}
        </div>

        <label className="viewport-display-control">
          <ViewportCopy copy={builderViewportCopy.displayLabel} />
          <select
            value={displayMode}
            disabled={!hasRenderedModel}
            onChange={(event) =>
              setDisplayMode(event.target.value as BuilderDisplayMode)
            }
          >
            {(
              Object.keys(
                builderViewportDisplayModeCopy,
              ) as BuilderDisplayMode[]
            ).map((mode) => (
              <option key={mode} value={mode}>
                {bilingualViewportTitle(builderViewportDisplayModeCopy[mode])}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" />
        </label>

        <button
          className="viewport-icon-button"
          type="button"
          aria-label={bilingualViewportTitle(builderViewportCopy.fitView)}
          disabled={!hasRenderedModel}
          onClick={() => {
            setCamera("等角");
            setResetToken((token) => token + 1);
          }}
        >
          <Expand aria-hidden="true" />
        </button>
      </div>

      <div className="builder-stage">
        <div className="builder-stage__grid" aria-hidden="true" />
        <div className="builder-stage__glow" aria-hidden="true" />

        {hasModelResource ? (
          <figure className="builder-private-model">
            <Suspense
              fallback={
                <span className="builder-model-state">
                  <ViewportCopy
                    copy={builderViewportCopy.modelComponentLoading}
                  />
                </span>
              }
            >
              {isSummary ? (
                <AssetModelPreview
                  cameraPreset={camera}
                  layout="review-grid"
                  models={modelResources}
                  onLoadResult={recordPreviewResult}
                  renderMode={renderMode}
                  resetToken={resetToken}
                />
              ) : (
                <AssetModelPreview
                  cameraPreset={camera}
                  onLoadResult={recordPreviewResult}
                  renderMode={renderMode}
                  resetToken={resetToken}
                  url={modelUrl ?? undefined}
                />
              )}
            </Suspense>
            <figcaption>
              <ViewportCopy
                copy={builderViewportModelCaptionCopy({
                  candidateCount: modelCandidates.length,
                  failedCount: failedModelCount,
                  isLocalSyntheticModel,
                  isSummary,
                  isLoading: previewLoading,
                  loadedCount: renderedModelCount,
                })}
              />
            </figcaption>
          </figure>
        ) : (
          <figure className="pc-case-placeholder">
            <div className="pc-case-placeholder__glass">
              <div className="pc-motherboard" />
              <div className="pc-cooler">
                <span />
              </div>
              <div className="pc-memory">
                <i />
                <i />
              </div>
              <div className="pc-gpu">
                <span>GPU</span>
                <i />
                <i />
                <i />
              </div>
              <div className="pc-psu">PSU</div>
              <div className="pc-fans">
                <i />
                <i />
                <i />
              </div>
            </div>
            <figcaption>
              <ViewportCopy copy={placeholderCopy} />
            </figcaption>
          </figure>
        )}

        <div className="builder-axis" aria-hidden="true">
          <span>X</span>
          <span>Y</span>
          <span>Z</span>
        </div>

        <div className="builder-stage__readout">
          <Move3D aria-hidden="true" />
          <ViewportCopy copy={builderViewportCameraReadoutCopy(camera)} />
          <ViewportCopy copy={builderViewportDisplayReadoutCopy(displayMode)} />
          <span className="mono">
            <ViewportCopy copy={builderViewportCopy.gridReadout} />
          </span>
        </div>

        <div className="tablet-selected-part">
          <div className="tablet-selected-part__icon">
            <Box aria-hidden="true" />
          </div>
          <div>
            <ViewportCopy copy={builderViewportSelectionLabelCopy(isSummary)} />
            <strong>
              {selectedPart ? (
                `${selectedPart.manufacturer} ${selectedPart.model}`
              ) : isSummary ? (
                <ViewportCopy
                  copy={builderViewportSummarySelectionCopy(
                    modelCandidates.length,
                  )}
                />
              ) : (
                <ViewportCopy copy={builderViewportCopy.noSelection} />
              )}
            </strong>
          </div>
          <strong>
            {selectedPart ? formatHkd(selectedPart.priceMinor) : "—"}
          </strong>
          {selectedPart ? (
            <>
              <span className="stock-inline">
                <i aria-hidden="true" />
                <ViewportCopy
                  copy={builderViewportStockCopy[selectedPart.stockStatus]}
                />
              </span>
              <span className="mono">{selectedPart.sku}</span>
            </>
          ) : null}
        </div>

        <span className="selected-category-readout">
          <Rotate3D aria-hidden="true" />
          <ViewportCopy copy={builderViewportEditingCopy(selectedCategory)} />
        </span>
      </div>

      <div className="builder-viewport__footer">
        <span>
          <Image aria-hidden="true" />
          <ViewportCopy
            copy={builderViewportFooterPreviewCopy({
              hasModel: hasModelResource,
              isLocalSyntheticModel,
              isSummary,
              isLoading: previewLoading,
              loadedCount: renderedModelCount,
            })}
          />
        </span>
        <span>
          <ViewportCopy copy={builderViewportLayoutBoundaryCopy(isSummary)} />
        </span>
        <span className="mono">
          <ViewportCopy copy={builderViewportSceneDetailsCopy(isSummary)} />
        </span>
      </div>
    </section>
  );
}
