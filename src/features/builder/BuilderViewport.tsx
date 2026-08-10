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
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import { fetchAssetFileBlob } from "../asset-review/asset-review-api";
import { assetModelContentType } from "../../shared/domain/asset-files";
import type { CatalogPart } from "../../shared/domain/schemas";
import { createSyntheticDraftGlb } from "../../shared/domain/synthetic-glb";
import { formatHkd } from "../../shared/i18n/locale";
import { createAbortBoundObjectUrl } from "../../shared/lib/private-object-url";
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
  builderViewportModelCaptionCopy,
  builderViewportPlaceholderCopy,
  builderViewportStockCopy,
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
  workspaceId,
  isLocalPreview,
  localApprovedAssetId,
}: {
  selectedCategory: BuilderStepId;
  camera: BuilderCameraPreset;
  setCamera: Dispatch<SetStateAction<BuilderCameraPreset>>;
  displayMode: BuilderDisplayMode;
  setDisplayMode: Dispatch<SetStateAction<BuilderDisplayMode>>;
  selectedPart: CatalogPart | null;
  workspaceId: string;
  isLocalPreview: boolean;
  localApprovedAssetId: string | null;
}) {
  const isLocalSyntheticModel =
    isLocalPreview &&
    selectedPart?.assetId === localApprovedAssetId &&
    selectedPart.assetStatus === "approved";
  const modelKey =
    selectedPart?.assetId && selectedPart.assetStatus === "approved"
      ? isLocalSyntheticModel
        ? `local:${selectedPart.assetId}`
        : !isLocalPreview
          ? `${workspaceId}:${selectedPart.assetId}`
          : null
      : null;
  const [modelResource, setModelResource] = useState<{
    key: string;
    state: "error" | "ready";
    url: string | null;
  } | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const currentModelResource =
    modelResource?.key === modelKey ? modelResource : null;
  const modelUrl =
    currentModelResource?.state === "ready" ? currentModelResource.url : null;
  const modelState = modelKey
    ? (currentModelResource?.state ?? "loading")
    : "none";

  useEffect(() => {
    if (!modelKey || !selectedPart?.assetId) {
      return;
    }

    if (isLocalSyntheticModel) {
      let createdUrl: string | null = null;
      let cancelled = false;
      void Promise.resolve().then(() => {
        if (cancelled) {
          return;
        }

        const bytes = createSyntheticDraftGlb();
        createdUrl = URL.createObjectURL(
          new Blob(
            [
              bytes.buffer.slice(
                bytes.byteOffset,
                bytes.byteOffset + bytes.byteLength,
              ) as ArrayBuffer,
            ],
            { type: assetModelContentType },
          ),
        );
        setModelResource({ key: modelKey, state: "ready", url: createdUrl });
      });

      return () => {
        cancelled = true;
        if (createdUrl) {
          URL.revokeObjectURL(createdUrl);
        }
      };
    }

    const controller = new AbortController();
    let privateUrl: ReturnType<typeof createAbortBoundObjectUrl> = null;
    void fetchAssetFileBlob(
      controller.signal,
      workspaceId,
      selectedPart.assetId,
      "model",
    )
      .then((blob) => {
        privateUrl = createAbortBoundObjectUrl(blob, controller.signal);
        if (!privateUrl) {
          return;
        }
        setModelResource({
          key: modelKey,
          state: "ready",
          url: privateUrl.url,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setModelResource({
            key: modelKey,
            state: "error",
            url: null,
          });
        }
      });

    return () => {
      controller.abort();
      privateUrl?.revoke();
    };
  }, [isLocalSyntheticModel, modelKey, selectedPart?.assetId, workspaceId]);

  const renderMode =
    displayMode === "線框"
      ? "wireframe"
      : displayMode === "靜態預覽"
        ? "static"
        : "shaded";
  const placeholderCopy = builderViewportPlaceholderCopy({
    hasApprovedAsset: selectedPart?.assetStatus === "approved",
    isLocalPreview,
    isLocalSyntheticModel,
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
              disabled={!modelUrl}
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
            disabled={!modelUrl}
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
          disabled={!modelUrl}
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

        {modelUrl ? (
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
              <AssetModelPreview
                cameraPreset={camera}
                renderMode={renderMode}
                resetToken={resetToken}
                url={modelUrl}
              />
            </Suspense>
            <figcaption>
              <ViewportCopy
                copy={builderViewportModelCaptionCopy(isLocalSyntheticModel)}
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
            <ViewportCopy copy={builderViewportCopy.currentCategoryComponent} />
            <strong>
              {selectedPart ? (
                `${selectedPart.manufacturer} ${selectedPart.model}`
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
            copy={builderViewportFooterPreviewCopy(
              modelUrl !== null,
              isLocalSyntheticModel,
            )}
          />
        </span>
        <span>
          <ViewportCopy copy={builderViewportCopy.evidenceBoundary} />
        </span>
        <span className="mono">
          <ViewportCopy copy={builderViewportCopy.sceneDetails} />
        </span>
      </div>
    </section>
  );
}
