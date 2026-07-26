import {
  Axis3D,
  Box,
  Camera,
  Check,
  CircleDot,
  Cuboid,
  FileBox,
  Image,
  RefreshCw,
  Rotate3D,
  Save,
  Scan,
  Upload,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation, useSearchParams } from "react-router";

import { useAuthenticatedSession } from "../auth/session-context";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../shared/components/AsyncState";
import { StatusBadge } from "../../shared/components/StatusBadge";
import {
  AssetFileValidationError,
  assetFileLimits,
  assetModelContentType,
  validateAssetFileBytes,
  type AssetFileKind,
} from "../../shared/domain/asset-files";
import {
  assetReviewChecks,
  type AssetReviewCheck,
  type AssetReviewItem,
  type AssetReviewMutation,
} from "../../shared/domain/assets";
import { reviewAsset } from "../../shared/domain/mockData";
import {
  AssetReviewApiError,
  fetchAssetFileBlob,
  fetchAssetReview,
  fetchAssetReviewQueue,
  uploadAssetFile,
  updateAssetReview,
} from "./asset-review-api";
import "./asset-review.css";

const AssetModelPreview = lazy(async () => {
  const module = await import("./AssetModelPreview");
  return { default: module.AssetModelPreview };
});

const checklist: Array<{ id: AssetReviewCheck; label: string }> = [
  { id: "model_identity", label: "型號及 SKU 正確" },
  { id: "variant_identity", label: "顏色及版本正確" },
  { id: "standard_orientation", label: "已設定標準方向" },
  { id: "verified_dimensions", label: "已輸入核實尺寸" },
  { id: "installation_pivot", label: "樞軸適合作安裝" },
  { id: "source_rights", label: "已確認圖片使用權" },
];

const cameraPresets = ["正面", "左側", "頂部", "等角"];
const sourceViews = ["正面", "背面", "左側", "三分之四角度"];
const dimensions = [
  { key: "width", label: "闊度" },
  { key: "height", label: "高度" },
  { key: "depth", label: "深度" },
] as const;

type ReviewForm = {
  asset: AssetReviewItem;
  checks: Set<AssetReviewCheck>;
  dimensions: Record<(typeof dimensions)[number]["key"], string>;
};

type AssetFileUrls = {
  assetKey: string;
  model: string | null;
  source: string | null;
};

type LocalAssetNavigationState = {
  localAsset?: AssetReviewItem;
  sourceUrl?: string;
};

function assetKey(asset: AssetReviewItem): string {
  return `${asset.id}:${asset.version}`;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  }
  return `${Math.max(1, Math.ceil(bytes / 1024))} KiB`;
}

function createReviewForm(asset: AssetReviewItem): ReviewForm {
  return {
    asset,
    checks: new Set(asset.completedChecks),
    dimensions: {
      width: asset.dimensionsMm.width?.toString() ?? "",
      height: asset.dimensionsMm.height?.toString() ?? "",
      depth: asset.dimensionsMm.depth?.toString() ?? "",
    },
  };
}

function parseDimension(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 10_000
    ? parsed
    : null;
}

function reviewBadge(status: AssetReviewItem["status"]) {
  switch (status) {
    case "draft":
      return { label: "草稿", tone: "info" as const };
    case "in_review":
      return { label: "需要審核", tone: "warning" as const };
    case "approved":
      return { label: "已核准", tone: "success" as const };
    case "rejected":
      return { label: "已拒絕", tone: "danger" as const };
  }
}

const sourceKindLabels: Record<AssetReviewItem["sourceKind"], string> = {
  synthetic: "合成測試素材",
  uploaded: "私人上載素材",
  generated: "供應商生成草稿",
};

const qualityLabels: Record<AssetReviewItem["quality"], string> = {
  unreviewed: "未審核",
  draft: "草稿品質",
  reviewed: "已審核",
  approved: "已核准",
};

export function AssetReviewPage() {
  const { currentWorkspace } = useAuthenticatedSession();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isLocalPreview = import.meta.env.DEV;
  const targetAssetId = searchParams.get("asset");
  const localNavigationState =
    (location.state as LocalAssetNavigationState | null) ?? null;
  const initialAsset = isLocalPreview
    ? (localNavigationState?.localAsset ?? reviewAsset)
    : null;
  const [camera, setCamera] = useState("等角");
  const [form, setForm] = useState<ReviewForm | null>(() =>
    initialAsset ? createReviewForm(initialAsset) : null,
  );
  const [fileUrls, setFileUrls] = useState<AssetFileUrls>(() => ({
    assetKey: initialAsset ? assetKey(initialAsset) : "",
    model: null,
    source: localNavigationState?.sourceUrl ?? null,
  }));
  const [loadState, setLoadState] = useState<"error" | "loading" | "ready">(
    isLocalPreview ? "ready" : "loading",
  );
  const [queueCount, setQueueCount] = useState(isLocalPreview ? 1 : 0);
  const [reloadToken, setReloadToken] = useState(0);
  const [loadedWorkspaceId, setLoadedWorkspaceId] = useState<string | null>(
    isLocalPreview ? currentWorkspace.id : null,
  );
  const [uploadingKind, setUploadingKind] = useState<AssetFileKind | null>(
    null,
  );
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const localObjectUrlsRef = useRef(
    new Set(
      localNavigationState?.sourceUrl ? [localNavigationState.sourceUrl] : [],
    ),
  );
  const [submitting, setSubmitting] = useState(false);
  const [reviewStatus, setReviewStatus] = useState(() =>
    isLocalPreview
      ? localNavigationState?.localAsset
        ? "私人上載預覽只保留在目前本地工作階段"
        : "合成資料變更只保留在本機"
      : "已載入工作空間審核狀態",
  );

  useEffect(() => {
    if (isLocalPreview) {
      return;
    }

    const controller = new AbortController();
    const loadItems = targetAssetId
      ? fetchAssetReview(
          controller.signal,
          currentWorkspace.id,
          targetAssetId,
        ).then((asset) => [asset])
      : fetchAssetReviewQueue(controller.signal, currentWorkspace.id);

    void loadItems
      .then((items) => {
        setQueueCount(items.length);
        setForm(items[0] ? createReviewForm(items[0]) : null);
        setLoadedWorkspaceId(currentWorkspace.id);
        setLoadState("ready");
        setReviewStatus(
          targetAssetId && items[0]
            ? `已載入指定素材 ${items[0].id}`
            : items.length > 0
              ? `審核佇列共有 ${items.length} 項素材`
              : "審核佇列目前沒有項目",
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadedWorkspaceId(currentWorkspace.id);
          setLoadState("error");
        }
      });

    return () => controller.abort();
  }, [currentWorkspace.id, isLocalPreview, reloadToken, targetAssetId]);

  useEffect(
    () => () => {
      for (const url of localObjectUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      localObjectUrlsRef.current.clear();
    },
    [],
  );

  const activeAsset = form?.asset ?? null;

  useEffect(() => {
    if (isLocalPreview || !activeAsset) {
      return;
    }

    const controller = new AbortController();
    const currentAsset = activeAsset;
    const currentAssetKey = assetKey(currentAsset);
    const createdUrls: string[] = [];
    const loadFile = async (kind: AssetFileKind, available: boolean) => {
      if (!available) {
        return null;
      }
      try {
        const blob = await fetchAssetFileBlob(
          controller.signal,
          currentWorkspace.id,
          currentAsset.id,
          kind,
        );
        const url = URL.createObjectURL(blob);
        createdUrls.push(url);
        return url;
      } catch {
        return null;
      }
    };

    void Promise.all([
      loadFile("source", currentAsset.files.source !== null),
      loadFile("model", currentAsset.files.model !== null),
    ]).then(([source, model]) => {
      if (!controller.signal.aborted) {
        setFileUrls({
          assetKey: currentAssetKey,
          model,
          source,
        });
      }
    });

    return () => {
      controller.abort();
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [activeAsset, currentWorkspace.id, isLocalPreview]);

  const retryQueue = () => {
    setLoadState("loading");
    setForm(null);
    setLoadedWorkspaceId(null);
    setReloadToken((token) => token + 1);
  };

  const visibleLoadState =
    loadedWorkspaceId === currentWorkspace.id ? loadState : "loading";

  if (visibleLoadState === "loading") {
    return (
      <div className="page asset-review-page">
        <LoadingState label="正在載入素材審核佇列" />
      </div>
    );
  }

  if (visibleLoadState === "error") {
    return (
      <div className="page asset-review-page">
        <ErrorState title="無法載入素材審核佇列" onRetry={retryQueue} />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="page asset-review-page">
        <EmptyState
          title="沒有等待審核的素材"
          message="請先在產品目錄為一項產品上載私人來源圖片，建立新的素材草稿。"
        />
      </div>
    );
  }

  const { asset } = form;
  const badge = reviewBadge(asset.status);
  const visibleFileUrls =
    fileUrls.assetKey === assetKey(asset)
      ? fileUrls
      : { assetKey: "", model: null, source: null };
  const canEdit =
    currentWorkspace.role !== "viewer" && asset.status !== "approved";
  const canDecide =
    (currentWorkspace.role === "owner" || currentWorkspace.role === "admin") &&
    asset.status !== "approved";
  const parsedDimensions = {
    width: parseDimension(form.dimensions.width),
    height: parseDimension(form.dimensions.height),
    depth: parseDimension(form.dimensions.depth),
  };
  const approvalReady =
    asset.files.model !== null &&
    assetReviewChecks.every((check) => form.checks.has(check)) &&
    parsedDimensions.width !== null &&
    parsedDimensions.height !== null &&
    parsedDimensions.depth !== null;

  const toggleCheck = (check: AssetReviewCheck) => {
    if (!canEdit) {
      return;
    }

    setForm((current) => {
      if (!current) {
        return current;
      }

      const checks = new Set(current.checks);
      if (checks.has(check)) {
        checks.delete(check);
      } else {
        checks.add(check);
      }
      return { ...current, checks };
    });
    setReviewStatus("核准清單有未儲存變更");
  };

  const updateDimension = (
    key: (typeof dimensions)[number]["key"],
    value: string,
  ) => {
    if (!canEdit) {
      return;
    }

    setForm((current) =>
      current
        ? {
            ...current,
            dimensions: { ...current.dimensions, [key]: value },
          }
        : current,
    );
    setReviewStatus("核實尺寸有未儲存變更");
  };

  const handleFileSelection = async (
    kind: AssetFileKind,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const inputElement = event.currentTarget;
    const file = inputElement.files?.[0];
    const currentForm = form;
    if (!file || !currentForm || !canEdit || uploadingKind) {
      inputElement.value = "";
      return;
    }

    setUploadingKind(kind);
    setReviewStatus(
      kind === "source" ? "正在驗證及上載來源圖片…" : "正在驗證及上載 GLB…",
    );
    try {
      if (file.size > assetFileLimits[kind]) {
        throw new AssetFileValidationError(
          kind === "source"
            ? "來源圖片必須小於或等於 10 MiB。"
            : "GLB 模型必須小於或等於 25 MiB。",
        );
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const contentType = validateAssetFileBytes(
        kind,
        kind === "model" ? file.type || assetModelContentType : file.type,
        bytes,
      );

      let updated: AssetReviewItem;
      if (isLocalPreview) {
        const objectUrl = URL.createObjectURL(file);
        localObjectUrlsRef.current.add(objectUrl);
        updated = {
          ...currentForm.asset,
          status: "draft",
          quality: "unreviewed",
          sourceKind: "uploaded",
          completedChecks: [],
          sourceRightsConfirmed: false,
          dimensionsMm: { width: null, height: null, depth: null },
          files: {
            ...currentForm.asset.files,
            [kind]: {
              contentType,
              sizeBytes: file.size,
            },
          },
          version: currentForm.asset.version + 1,
        };
        setFileUrls((current) => {
          const currentKey = assetKey(currentForm.asset);
          const source =
            kind === "source"
              ? objectUrl
              : current.assetKey === currentKey
                ? current.source
                : null;
          const model =
            kind === "model"
              ? objectUrl
              : current.assetKey === currentKey
                ? current.model
                : null;
          const replaced = kind === "source" ? current.source : current.model;
          if (replaced && localObjectUrlsRef.current.has(replaced)) {
            URL.revokeObjectURL(replaced);
            localObjectUrlsRef.current.delete(replaced);
          }
          return { assetKey: assetKey(updated), model, source };
        });
      } else {
        updated = await uploadAssetFile(
          currentWorkspace.id,
          currentForm.asset.id,
          kind,
          currentForm.asset.version,
          file,
        );
      }

      setForm(createReviewForm(updated));
      setReviewStatus(
        kind === "source"
          ? "私人來源圖片已上載；核准清單已重設"
          : "私人 GLB 已上載；請重新檢查方向、樞軸及尺寸",
      );
    } catch (error) {
      setReviewStatus(
        error instanceof Error
          ? error.message
          : kind === "source"
            ? "無法上載來源圖片"
            : "無法上載 GLB 模型",
      );
    } finally {
      inputElement.value = "";
      setUploadingKind(null);
    }
  };

  const submitReview = async (action: AssetReviewMutation["action"]) => {
    const currentForm = form;
    if (!currentForm || submitting) {
      return;
    }

    const mutation: AssetReviewMutation = {
      action,
      expectedVersion: currentForm.asset.version,
      completedChecks: assetReviewChecks.filter((check) =>
        currentForm.checks.has(check),
      ),
      dimensionsMm: parsedDimensions,
    };
    setSubmitting(true);
    setReviewStatus("正在儲存審核結果…");

    try {
      let updated: AssetReviewItem;
      if (isLocalPreview) {
        const status =
          action === "approve"
            ? "approved"
            : action === "reject"
              ? "rejected"
              : "draft";
        const quality =
          action === "approve"
            ? "approved"
            : action === "reject"
              ? "reviewed"
              : "draft";
        updated = {
          ...currentForm.asset,
          status,
          quality,
          completedChecks: mutation.completedChecks,
          sourceRightsConfirmed:
            mutation.completedChecks.includes("source_rights"),
          dimensionsMm: mutation.dimensionsMm,
          version: currentForm.asset.version + 1,
        };
      } else {
        updated = await updateAssetReview(
          currentWorkspace.id,
          currentForm.asset.id,
          mutation,
        );
      }

      if (isLocalPreview) {
        setFileUrls((current) =>
          current.assetKey === assetKey(currentForm.asset)
            ? { ...current, assetKey: assetKey(updated) }
            : current,
        );
      }
      setForm(createReviewForm(updated));
      setReviewStatus(
        action === "approve"
          ? "素材已核准並記錄審核事件"
          : action === "reject"
            ? "素材已拒絕並記錄審核事件"
            : "審核草稿已儲存",
      );
    } catch (error) {
      const message =
        error instanceof AssetReviewApiError &&
        error.code === "ASSET_VERSION_CONFLICT"
          ? "素材已被另一個審核動作更新，請重新載入"
          : error instanceof AssetReviewApiError
            ? error.message
            : "無法儲存審核結果；原有資料未有變更";
      setReviewStatus(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="asset-review-page">
      <input
        ref={sourceInputRef}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={!canEdit || uploadingKind !== null}
        onChange={(event) => void handleFileSelection("source", event)}
      />
      <input
        ref={modelInputRef}
        hidden
        type="file"
        accept=".glb,model/gltf-binary,application/octet-stream"
        disabled={!canEdit || uploadingKind !== null}
        onChange={(event) => void handleFileSelection("model", event)}
      />
      <header className="asset-review-header">
        <div>
          <span className="eyebrow">
            素材 {asset.id} · 版本 {asset.version}
          </span>
          <h1>
            {asset.part.manufacturer} {asset.part.model}
          </h1>
          <p>所有生成或上載素材均為草稿，必須經授權人員核准才可使用。</p>
        </div>
        <div className="asset-review-header__meta">
          <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
          <span aria-live="polite">
            {reviewStatus}
            {targetAssetId ? " · 指定素材" : ` · 佇列 ${queueCount} 項`}
          </span>
        </div>
      </header>

      <div className="review-workspace">
        <aside className="source-filmstrip" aria-label="來源圖片">
          <div className="review-panel-heading">
            <Image aria-hidden="true" />
            <div>
              <strong>來源圖片</strong>
              <span>
                {visibleFileUrls.source
                  ? "已透過授權 API 載入"
                  : "尚未載入私人來源圖片"}
              </span>
            </div>
          </div>
          {sourceViews.map((view, index) => (
            <button
              className={`source-frame${index === 0 ? " is-selected" : ""}`}
              key={view}
              type="button"
              aria-label={
                index === 0 && visibleFileUrls.source
                  ? `${view}私人來源圖片`
                  : `${view}來源圖片介面佔位`
              }
              disabled
            >
              {index === 0 && visibleFileUrls.source ? (
                <img
                  src={visibleFileUrls.source}
                  alt={`${asset.part.manufacturer} ${asset.part.model} 私人來源預覽`}
                />
              ) : (
                <span
                  className={`source-frame__object source-frame__object--${index + 1}`}
                >
                  <Box aria-hidden="true" />
                </span>
              )}
              <small>{view}</small>
            </button>
          ))}
          <div className="source-rights">
            {form.checks.has("source_rights") ? (
              <Check aria-hidden="true" />
            ) : (
              <X aria-hidden="true" />
            )}
            {form.checks.has("source_rights")
              ? "已記錄商業使用權確認"
              : "尚未確認圖片使用權"}
          </div>
        </aside>

        <section className="review-viewport" aria-label="3D 素材審核視窗">
          <div className="review-viewport__toolbar">
            <div role="group" aria-label="鏡頭預設角度">
              {cameraPresets.map((preset) => (
                <button
                  className={camera === preset ? "is-active" : ""}
                  key={preset}
                  type="button"
                  aria-pressed={camera === preset}
                  onClick={() => setCamera(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
            <div>
              <button type="button" aria-label="切換座標軸顯示">
                <Axis3D aria-hidden="true" />
              </button>
              <button type="button" aria-label="切換邊界框顯示">
                <Scan aria-hidden="true" />
              </button>
              <button type="button" aria-label="切換線框顯示">
                <Cuboid aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="review-stage">
            <div className="review-grid" aria-hidden="true" />
            {visibleFileUrls.model ? (
              <Suspense
                fallback={
                  <span className="asset-model-preview__state is-loading">
                    正在載入 3D 預覽元件…
                  </span>
                }
              >
                <AssetModelPreview
                  key={visibleFileUrls.model}
                  cameraPreset={camera}
                  url={visibleFileUrls.model}
                />
              </Suspense>
            ) : (
              <div className="cooler-model" aria-hidden="true">
                <span className="cooler-model__tower cooler-model__tower--left" />
                <span className="cooler-model__fan">
                  <CircleDot />
                </span>
                <span className="cooler-model__tower cooler-model__tower--right" />
                <span className="cooler-model__base" />
              </div>
            )}
            <div className="review-axis" aria-hidden="true">
              <span className="axis-x">X</span>
              <span className="axis-y">Y</span>
              <span className="axis-z">Z</span>
            </div>
            <div className="viewport-readout">
              <Rotate3D aria-hidden="true" />
              <span>
                鏡頭 <strong>{camera}</strong>
              </span>
              <span className="mono">
                {parsedDimensions.width ?? "—"} ×{" "}
                {parsedDimensions.height ?? "—"} ×{" "}
                {parsedDimensions.depth ?? "—"} mm
              </span>
            </div>
          </div>
          <div className="review-viewport__footer">
            <span>
              {visibleFileUrls.model
                ? "授權讀取的私人 GLB · 只在目前瀏覽器工作階段解碼"
                : "尚未上載私人 GLB · 顯示合成幾何佔位"}
            </span>
            <span className="mono">視覺素材不構成相容性證明</span>
          </div>
        </section>

        <aside className="review-inspector">
          <div className="review-inspector__section">
            <div className="review-panel-heading">
              <Camera aria-hidden="true" />
              <div>
                <strong>素材資料</strong>
                <span>{sourceKindLabels[asset.sourceKind]}</span>
              </div>
            </div>
            <dl className="technical-list">
              <div>
                <dt>SKU</dt>
                <dd className="mono">{asset.part.sku}</dd>
              </div>
              <div>
                <dt>品質</dt>
                <dd>{qualityLabels[asset.quality]}</dd>
              </div>
              <div>
                <dt>素材 ID</dt>
                <dd className="mono">{asset.id}</dd>
              </div>
            </dl>
          </div>

          <div className="review-inspector__section asset-file-controls">
            <div className="review-panel-heading">
              <FileBox aria-hidden="true" />
              <div>
                <strong>私人素材檔案</strong>
                <span>Access 及 workspace 驗證後才可讀取</span>
              </div>
            </div>
            <div className="asset-file-control">
              <div>
                <strong>來源圖片</strong>
                <span>
                  {asset.files.source
                    ? `${asset.files.source.contentType} · ${formatFileSize(asset.files.source.sizeBytes)}`
                    : "JPEG、PNG 或 WebP · 最多 10 MiB"}
                </span>
              </div>
              <button
                className="button button--secondary"
                type="button"
                disabled={!canEdit || uploadingKind !== null}
                onClick={() => sourceInputRef.current?.click()}
              >
                <Upload aria-hidden="true" />
                {uploadingKind === "source"
                  ? "上載中…"
                  : asset.files.source
                    ? "取代圖片"
                    : "上載圖片"}
              </button>
            </div>
            <div className="asset-file-control">
              <div>
                <strong>3D 模型</strong>
                <span>
                  {asset.files.model
                    ? `GLB · ${formatFileSize(asset.files.model.sizeBytes)}`
                    : "自包含 glTF 2.0 GLB · 最多 25 MiB"}
                </span>
              </div>
              <button
                className="button button--secondary"
                type="button"
                disabled={!canEdit || uploadingKind !== null}
                onClick={() => modelInputRef.current?.click()}
              >
                <Upload aria-hidden="true" />
                {uploadingKind === "model"
                  ? "上載中…"
                  : asset.files.model
                    ? "取代 GLB"
                    : "上載 GLB"}
              </button>
            </div>
            <small>
              取代任何檔案會重設核准清單及已核實尺寸，避免沿用舊版本判斷。
            </small>
          </div>

          <div className="review-inspector__section">
            <div className="review-panel-heading">
              <Scan aria-hidden="true" />
              <div>
                <strong>核實尺寸</strong>
                <span>只接受經人手核對的數值</span>
              </div>
            </div>
            <div className="dimension-grid">
              {dimensions.map(({ key, label }) => (
                <label key={key}>
                  <span>{label}</span>
                  <span>
                    <input
                      value={form.dimensions[key]}
                      inputMode="decimal"
                      disabled={!canEdit || submitting}
                      aria-invalid={
                        form.dimensions[key].trim().length > 0 &&
                        parseDimension(form.dimensions[key]) === null
                      }
                      onChange={(event) =>
                        updateDimension(key, event.target.value)
                      }
                    />
                    mm
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="review-inspector__section review-checklist">
            <div className="review-panel-heading">
              <Check aria-hidden="true" />
              <div>
                <strong>核准清單</strong>
                <span>
                  已完成 {form.checks.size} / {checklist.length} 項
                </span>
              </div>
            </div>
            {checklist.map((item) => (
              <label key={item.id}>
                <input
                  type="checkbox"
                  checked={form.checks.has(item.id)}
                  disabled={!canEdit || submitting}
                  onChange={() => toggleCheck(item.id)}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </aside>
      </div>

      <footer className="review-actions">
        <div>
          <button
            className="button button--danger"
            type="button"
            disabled={!canDecide || submitting}
            onClick={() => void submitReview("reject")}
          >
            <X aria-hidden="true" />
            拒絕
          </button>
          <button
            className="button"
            type="button"
            disabled
            title="外部 3D 供應商尚未啟用"
          >
            <RefreshCw aria-hidden="true" />
            供應商重試未啟用
          </button>
        </div>
        <div>
          <button
            className="button button--secondary"
            type="button"
            disabled={!canEdit || submitting}
            onClick={() => void submitReview("save_draft")}
          >
            <Save aria-hidden="true" />
            {submitting ? "儲存中…" : "儲存草稿"}
          </button>
          <button
            className="button button--primary"
            type="button"
            disabled={!approvalReady || !canDecide || submitting}
            title={
              asset.files.model
                ? "所有清單及尺寸完成後可核准"
                : "上載並檢查 GLB 模型後才可核准"
            }
            onClick={() => void submitReview("approve")}
          >
            <Check aria-hidden="true" />
            核准素材
          </button>
        </div>
      </footer>
    </div>
  );
}
