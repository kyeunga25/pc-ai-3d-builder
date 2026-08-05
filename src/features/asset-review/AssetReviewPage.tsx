import {
  ArrowRight,
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
  Sparkles,
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
import { useLocation, useNavigate, useSearchParams } from "react-router";

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
import {
  type GenerationJob,
  type GenerationJobListResponse,
} from "../../shared/domain/generation-jobs";
import { reviewAsset } from "../../shared/domain/mockData";
import { createSyntheticDraftGlb } from "../../shared/domain/synthetic-glb";
import {
  AssetReviewApiError,
  fetchAssetFileBlob,
  fetchAssetReview,
  fetchAssetReviewQueue,
  fetchGenerationJobs,
  startGenerationJob,
  uploadAssetFile,
  updateAssetReview,
} from "./asset-review-api";
import "./asset-review.css";

const AssetModelPreview = lazy(async () => {
  const module = await import("../../shared/components/AssetModelPreview");
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

const syntheticSourcePngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function createSyntheticSourcePng(): Uint8Array {
  const raw = atob(syntheticSourcePngBase64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

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
  generated: "生成流程草稿",
};

const generationStatusLabels: Record<GenerationJob["status"], string> = {
  queued: "已排入佇列",
  running: "正在建立草稿",
  validating: "正在驗證 GLB",
  awaiting_review: "等待人工審核",
  failed: "工作失敗",
  cancelled: "工作已取消",
};

const generationEntitlementLabels: Record<
  NonNullable<GenerationJob["entitlementStatus"]>,
  string
> = {
  reserved: "已保留，等待人工決定",
  settled: "已結算",
  released: "已釋放",
};

function generationStatusLabel(job: GenerationJob) {
  if (job.status === "awaiting_review" && job.entitlementStatus === "settled") {
    return "人工審核已核准";
  }

  return generationStatusLabels[job.status];
}

const qualityLabels: Record<AssetReviewItem["quality"], string> = {
  unreviewed: "未審核",
  draft: "草稿品質",
  reviewed: "已審核",
  approved: "已核准",
};

export function AssetReviewPage() {
  const { currentWorkspace } = useAuthenticatedSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isLocalPreview = import.meta.env.DEV;
  const targetAssetId = searchParams.get("asset");
  const localNavigationState =
    (location.state as LocalAssetNavigationState | null) ?? null;
  const initialAsset = isLocalPreview
    ? (localNavigationState?.localAsset ?? reviewAsset)
    : null;
  const [camera, setCamera] = useState("等角");
  const [modelRenderMode, setModelRenderMode] = useState<
    "shaded" | "wireframe"
  >("shaded");
  const [modelResetToken, setModelResetToken] = useState(0);
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
  const [generationState, setGenerationState] =
    useState<GenerationJobListResponse>(() => ({
      capability: {
        mode: isLocalPreview ? "simulation" : "disabled",
        maxCostMinor: 0,
        credits: {
          availableUnits: isLocalPreview ? 2 : 0,
          reservedUnits: 0,
          settledUnits: 0,
          releasedUnits: 0,
        },
      },
      items: [],
    }));
  const [generationSubmitting, setGenerationSubmitting] = useState(false);
  const appliedGenerationJobRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (isLocalPreview || !activeAsset) {
      return;
    }
    const controller = new AbortController();
    void fetchGenerationJobs(
      controller.signal,
      currentWorkspace.id,
      activeAsset.id,
    )
      .then(setGenerationState)
      .catch(() => {
        if (!controller.signal.aborted) {
          setGenerationState({
            capability: {
              mode: "disabled",
              maxCostMinor: 0,
              credits: {
                availableUnits: 0,
                reservedUnits: 0,
                settledUnits: 0,
                releasedUnits: 0,
              },
            },
            items: [],
          });
        }
      });
    return () => controller.abort();
  }, [activeAsset, currentWorkspace.id, isLocalPreview, reloadToken]);

  useEffect(() => {
    const activeJob = generationState.items.find((job) =>
      ["queued", "running", "validating"].includes(job.status),
    );
    if (isLocalPreview || !activeAsset || !activeJob) {
      return;
    }
    const controller = new AbortController();
    let refreshing = false;
    const refresh = async () => {
      if (refreshing) {
        return;
      }
      refreshing = true;
      try {
        const next = await fetchGenerationJobs(
          controller.signal,
          currentWorkspace.id,
          activeAsset.id,
        );
        if (controller.signal.aborted) {
          return;
        }
        setGenerationState(next);
        const latest = next.items[0];
        if (
          latest?.status === "awaiting_review" &&
          latest.outputReady &&
          appliedGenerationJobRef.current !== latest.id
        ) {
          const updated = await fetchAssetReview(
            controller.signal,
            currentWorkspace.id,
            activeAsset.id,
          );
          if (!controller.signal.aborted) {
            appliedGenerationJobRef.current = latest.id;
            setForm(createReviewForm(updated));
            setReviewStatus(
              "模擬 GLB 草稿已通過格式驗證；必須重新完成人工審核",
            );
          }
        } else if (latest?.status === "failed") {
          setReviewStatus(
            `模擬生成失敗：${latest.failureCode ?? "GENERATION_WORKFLOW_FAILED"}`,
          );
        }
      } catch {
        if (!controller.signal.aborted) {
          setReviewStatus("暫時無法更新生成工作狀態");
        }
      } finally {
        refreshing = false;
      }
    };
    const timer = window.setInterval(() => void refresh(), 2_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [activeAsset, currentWorkspace.id, generationState.items, isLocalPreview]);

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
  const latestGenerationJob = generationState.items[0] ?? null;
  const generationActive = generationState.items.some(
    (job) =>
      ["queued", "running", "validating"].includes(job.status) ||
      (job.status === "awaiting_review" &&
        job.entitlementStatus === "reserved"),
  );
  const persistedChecks = new Set(asset.completedChecks);
  const reviewHasUnsavedChanges =
    form.checks.size !== persistedChecks.size ||
    [...form.checks].some((check) => !persistedChecks.has(check)) ||
    parsedDimensions.width !== asset.dimensionsMm.width ||
    parsedDimensions.height !== asset.dimensionsMm.height ||
    parsedDimensions.depth !== asset.dimensionsMm.depth;
  const canRequestGeneration =
    canDecide &&
    asset.files.source !== null &&
    asset.sourceRightsConfirmed &&
    !reviewHasUnsavedChanges &&
    generationState.capability.mode === "simulation" &&
    generationState.capability.credits.availableUnits >= 1 &&
    !generationActive &&
    !generationSubmitting;

  const transitionLocalReservedGeneration = (
    transition: "released" | "settled",
    failureCode: string | null = null,
  ) => {
    if (!isLocalPreview) {
      return;
    }
    setGenerationState((current) => {
      let transitionedUnits = 0;
      const items = current.items.map((job) => {
        if (job.assetId !== asset.id || job.entitlementStatus !== "reserved") {
          return job;
        }
        transitionedUnits += 1;
        return {
          ...job,
          entitlementStatus: transition,
          status: failureCode ? ("failed" as const) : job.status,
          failureCode: failureCode ?? job.failureCode,
          updatedAt: new Date().toISOString(),
        };
      });
      if (transitionedUnits === 0) {
        return current;
      }
      const credits = current.capability.credits;
      return {
        ...current,
        capability: {
          ...current.capability,
          credits: {
            ...credits,
            availableUnits:
              credits.availableUnits +
              (transition === "released" ? transitionedUnits : 0),
            reservedUnits: Math.max(
              0,
              credits.reservedUnits - transitionedUnits,
            ),
            settledUnits:
              credits.settledUnits +
              (transition === "settled" ? transitionedUnits : 0),
            releasedUnits:
              credits.releasedUnits +
              (transition === "released" ? transitionedUnits : 0),
          },
        },
        items,
      };
    });
  };

  const createLocalSyntheticSource = () => {
    const currentForm = form;
    if (!isLocalPreview || !currentForm || !canEdit || uploadingKind) {
      return;
    }
    const bytes = createSyntheticSourcePng();
    const contentType = validateAssetFileBytes("source", "image/png", bytes);
    const objectUrl = URL.createObjectURL(
      new Blob(
        [
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ) as ArrayBuffer,
        ],
        { type: contentType },
      ),
    );
    localObjectUrlsRef.current.add(objectUrl);
    if (currentForm.asset.sourceKind === "generated") {
      transitionLocalReservedGeneration(
        "released",
        "GENERATION_DRAFT_SUPERSEDED",
      );
    }
    const updated: AssetReviewItem = {
      ...currentForm.asset,
      status: "draft",
      quality: "unreviewed",
      sourceKind: "synthetic",
      completedChecks: [],
      sourceRightsConfirmed: false,
      dimensionsMm: { width: null, height: null, depth: null },
      files: {
        ...currentForm.asset.files,
        source: { contentType, sizeBytes: bytes.byteLength },
      },
      version: currentForm.asset.version + 1,
    };
    setFileUrls((current) => {
      if (current.source && localObjectUrlsRef.current.has(current.source)) {
        URL.revokeObjectURL(current.source);
        localObjectUrlsRef.current.delete(current.source);
      }
      return {
        assetKey: assetKey(updated),
        model:
          current.assetKey === assetKey(currentForm.asset)
            ? current.model
            : null,
        source: objectUrl,
      };
    });
    setForm(createReviewForm(updated));
    setReviewStatus(
      "本機合成 PNG 已建立；請明確確認使用權並儲存後再建立 3D 草稿",
    );
  };

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
        if (currentForm.asset.sourceKind === "generated") {
          transitionLocalReservedGeneration(
            "released",
            "GENERATION_DRAFT_SUPERSEDED",
          );
        }
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

  const requestGeneration = async () => {
    const currentForm = form;
    if (!currentForm || !canRequestGeneration) {
      return;
    }
    setGenerationSubmitting(true);
    setReviewStatus("正在建立零成本模擬生成工作…");
    try {
      if (isLocalPreview) {
        const bytes = createSyntheticDraftGlb();
        const objectUrl = URL.createObjectURL(
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
        localObjectUrlsRef.current.add(objectUrl);
        const updated: AssetReviewItem = {
          ...currentForm.asset,
          status: "draft",
          quality: "unreviewed",
          sourceKind: "generated",
          completedChecks: [],
          sourceRightsConfirmed: false,
          dimensionsMm: { width: null, height: null, depth: null },
          files: {
            ...currentForm.asset.files,
            model: {
              contentType: assetModelContentType,
              sizeBytes: bytes.byteLength,
            },
          },
          version: currentForm.asset.version + 1,
        };
        setFileUrls((current) => {
          if (current.model && localObjectUrlsRef.current.has(current.model)) {
            URL.revokeObjectURL(current.model);
            localObjectUrlsRef.current.delete(current.model);
          }
          return {
            assetKey: assetKey(updated),
            model: objectUrl,
            source:
              current.assetKey === assetKey(currentForm.asset)
                ? current.source
                : null,
          };
        });
        const now = new Date().toISOString();
        const job: GenerationJob = {
          id: `simulation_${crypto.randomUUID()}`,
          assetId: updated.id,
          status: "awaiting_review",
          kind: "simulation",
          outputReady: true,
          failureCode: null,
          entitlementStatus: "reserved",
          providerCostUnits: 1,
          validationCode: "GLB_VALID",
          createdAt: now,
          updatedAt: now,
        };
        setGenerationState((current) => ({
          ...current,
          capability: {
            ...current.capability,
            credits: {
              ...current.capability.credits,
              availableUnits: Math.max(
                0,
                current.capability.credits.availableUnits - 1,
              ),
              reservedUnits: current.capability.credits.reservedUnits + 1,
            },
          },
          items: [job, ...current.items].slice(0, 20),
        }));
        setForm(createReviewForm(updated));
      } else {
        const job = await startGenerationJob(
          currentWorkspace.id,
          currentForm.asset.id,
          { expectedVersion: currentForm.asset.version },
        );
        setGenerationState((current) => ({
          ...current,
          items: [job, ...current.items.filter((item) => item.id !== job.id)],
        }));
      }
      setReviewStatus(
        isLocalPreview
          ? "本地模擬 GLB 已建立；核准證據已重設"
          : "模擬生成工作已排入 Workflow；不會產生供應商費用",
      );
    } catch (error) {
      setReviewStatus(
        error instanceof AssetReviewApiError
          ? error.message
          : "無法建立模擬生成工作；沒有產生供應商費用",
      );
    } finally {
      setGenerationSubmitting(false);
    }
  };

  const submitReview = async (action: AssetReviewMutation["action"]) => {
    const currentForm = form;
    if (!currentForm || submitting) {
      return;
    }
    const hadReservedGeneration = generationState.items.some(
      (job) =>
        job.assetId === currentForm.asset.id &&
        job.entitlementStatus === "reserved",
    );

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
        if (action === "approve") {
          transitionLocalReservedGeneration("settled");
        } else if (action === "reject") {
          transitionLocalReservedGeneration(
            "released",
            "GENERATION_REVIEW_REJECTED",
          );
        }
      }
      setForm(createReviewForm(updated));
      setReviewStatus(
        action === "approve"
          ? hadReservedGeneration
            ? "素材已核准；已結算保留 credit 並記錄審核事件"
            : "素材已核准並記錄審核事件"
          : action === "reject"
            ? hadReservedGeneration
              ? "素材已拒絕；已釋放保留 credit 並記錄審核事件"
              : "素材已拒絕並記錄審核事件"
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
                  disabled={!visibleFileUrls.model}
                  onClick={() => setCamera(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
            <div>
              <button
                type="button"
                aria-label="調整模型至合適視野"
                disabled={!visibleFileUrls.model}
                onClick={() => {
                  setCamera("等角");
                  setModelResetToken((token) => token + 1);
                }}
              >
                <Scan aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="切換線框顯示"
                aria-pressed={modelRenderMode === "wireframe"}
                disabled={!visibleFileUrls.model}
                onClick={() =>
                  setModelRenderMode((mode) =>
                    mode === "wireframe" ? "shaded" : "wireframe",
                  )
                }
              >
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
                  renderMode={modelRenderMode}
                  resetToken={modelResetToken}
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
              <div className="asset-file-control__actions">
                {isLocalPreview ? (
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={!canEdit || uploadingKind !== null}
                    onClick={createLocalSyntheticSource}
                  >
                    <Sparkles aria-hidden="true" />
                    合成圖片
                  </button>
                ) : null}
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

          <div className="review-inspector__section generation-job-panel">
            <div className="review-panel-heading">
              <Sparkles aria-hidden="true" />
              <div>
                <strong>生成工作</strong>
                <span>只顯示中立狀態，不公開供應商或私人物件資料</span>
              </div>
            </div>
            <dl className="technical-list">
              <div>
                <dt>執行模式</dt>
                <dd>
                  {generationState.capability.mode === "simulation"
                    ? "零成本模擬"
                    : "未啟用"}
                </dd>
              </div>
              <div>
                <dt>最新狀態</dt>
                <dd>
                  {latestGenerationJob
                    ? generationStatusLabel(latestGenerationJob)
                    : "沒有工作"}
                </dd>
              </div>
              <div>
                <dt>Credit</dt>
                <dd className="mono">
                  {generationState.capability.credits.availableUnits} 可用 ·{" "}
                  {generationState.capability.credits.reservedUnits} 保留
                </dd>
              </div>
              <div>
                <dt>累計</dt>
                <dd className="mono">
                  {generationState.capability.credits.settledUnits} 結算 ·{" "}
                  {generationState.capability.credits.releasedUnits} 釋放
                </dd>
              </div>
              <div>
                <dt>權益狀態</dt>
                <dd>
                  {latestGenerationJob?.entitlementStatus
                    ? generationEntitlementLabels[
                        latestGenerationJob.entitlementStatus
                      ]
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>模擬成本單位</dt>
                <dd className="mono">
                  {latestGenerationJob?.providerCostUnits ?? "—"}
                </dd>
              </div>
              <div>
                <dt>GLB 驗證</dt>
                <dd className="mono">
                  {latestGenerationJob?.validationCode ?? "—"}
                </dd>
              </div>
            </dl>
            <small>
              模擬輸出仍是草稿，格式驗證通過後亦須重新核對身份、方向、尺寸、樞軸及使用權。
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
            disabled={!canRequestGeneration}
            title={
              generationState.capability.mode !== "simulation"
                ? "Production kill switch 維持關閉"
                : !canDecide
                  ? "只有 owner 或 admin 可建立生成工作"
                  : asset.files.source === null
                    ? "先上載私人來源圖片"
                    : generationState.capability.credits.availableUnits < 1
                      ? "沒有可保留的本機測試 credit"
                      : generationActive
                        ? "已有進行中或等待人工決定的生成工作"
                        : !asset.sourceRightsConfirmed ||
                            reviewHasUnsavedChanges
                          ? "先儲存來源圖片使用權確認及其他審核變更"
                          : "建立零成本合成 GLB 草稿，不呼叫外部供應商"
            }
            onClick={() => void requestGeneration()}
          >
            <RefreshCw aria-hidden="true" />
            {generationSubmitting
              ? "建立中…"
              : generationActive
                ? "模擬工作進行中"
                : "建立模擬 GLB 草稿"}
          </button>
        </div>
        <div>
          {isLocalPreview && asset.status === "approved" ? (
            <button
              className="button button--primary"
              type="button"
              onClick={() =>
                void navigate("/builder", {
                  state: { localApprovedAssetId: asset.id },
                })
              }
            >
              在 Builder 檢查
              <ArrowRight aria-hidden="true" />
            </button>
          ) : (
            <>
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
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
