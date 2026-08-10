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
import { componentSteps } from "../../shared/domain/mockData";
import type {
  CatalogPart,
  ComponentCategory,
} from "../../shared/domain/schemas";
import { createSyntheticDraftGlb } from "../../shared/domain/synthetic-glb";
import { formatHkd } from "../../shared/i18n/locale";
import { createAbortBoundObjectUrl } from "../../shared/lib/private-object-url";

type StepId = ComponentCategory | "summary";
export type BuilderDisplayMode = "著色" | "線框" | "靜態預覽";

const cameraPresets = ["等角", "正面", "左側", "頂部"];
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
  selectedCategory: StepId;
  camera: string;
  setCamera: Dispatch<SetStateAction<string>>;
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

  return (
    <section className="builder-viewport" aria-label="3D 組件預覽視窗">
      <div className="builder-viewport__top">
        <div
          className="viewport-control-group"
          role="group"
          aria-label="鏡頭預設角度"
        >
          <span className="viewport-control-group__label">
            <Camera aria-hidden="true" />
            鏡頭
          </span>
          {cameraPresets.map((preset) => (
            <button
              className={camera === preset ? "is-active" : ""}
              key={preset}
              type="button"
              aria-pressed={camera === preset}
              disabled={!modelUrl}
              onClick={() => setCamera(preset)}
            >
              {preset}
            </button>
          ))}
        </div>

        <label className="viewport-display-control">
          <span>顯示</span>
          <select
            value={displayMode}
            disabled={!modelUrl}
            onChange={(event) =>
              setDisplayMode(event.target.value as BuilderDisplayMode)
            }
          >
            <option>著色</option>
            <option>線框</option>
            <option>靜態預覽</option>
          </select>
          <ChevronDown aria-hidden="true" />
        </label>

        <button
          className="viewport-icon-button"
          type="button"
          aria-label="調整至合適視野"
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
                  正在載入 3D 預覽元件…
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
              {isLocalSyntheticModel
                ? "已核准本機合成 GLB · 不含真實供應商輸出"
                : "已核准私人 GLB · 只在目前瀏覽器工作階段解碼"}
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
              {modelState === "loading"
                ? "正在透過授權 API 載入私人 GLB…"
                : modelState === "error"
                  ? "無法讀取已核准 GLB；已保留靜態後備預覽。"
                  : selectedPart?.assetStatus === "approved" && isLocalPreview
                    ? "本地預覽不讀取私人 GLB；顯示合成幾何後備。"
                    : "此組件未有可用的已核准 GLB；顯示靜態幾何後備。"}
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
          <span>
            鏡頭 <strong>{camera}</strong>
          </span>
          <span>
            模式 <strong>{displayMode}</strong>
          </span>
          <span className="mono">網格 10 毫米</span>
        </div>

        <div className="tablet-selected-part">
          <div className="tablet-selected-part__icon">
            <Box aria-hidden="true" />
          </div>
          <div>
            <span>目前類別組件</span>
            <strong>
              {selectedPart
                ? `${selectedPart.manufacturer} ${selectedPart.model}`
                : "尚未選擇"}
            </strong>
          </div>
          <strong>
            {selectedPart ? formatHkd(selectedPart.priceMinor) : "—"}
          </strong>
          {selectedPart ? (
            <>
              <span className="stock-inline">
                <i aria-hidden="true" />
                {selectedPart.stockStatus === "out_of_stock"
                  ? "缺貨"
                  : "可選目錄記錄"}
              </span>
              <span className="mono">{selectedPart.sku}</span>
            </>
          ) : null}
        </div>

        <span className="selected-category-readout">
          <Rotate3D aria-hidden="true" />
          正在編輯{" "}
          <strong>
            {componentSteps.find((step) => step.id === selectedCategory)
              ?.label ?? "總覽"}
          </strong>
        </span>
      </div>

      <div className="builder-viewport__footer">
        <span>
          <Image aria-hidden="true" />
          {modelUrl
            ? isLocalSyntheticModel
              ? "本機合成的已核准組件預覽"
              : "受保護的已核准組件預覽"
            : "提供靜態後備預覽"}
        </span>
        <span className="mono">場景 v1 · +Y 向上 · 單位：米</span>
      </div>
    </section>
  );
}
