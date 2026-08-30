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
  Trash2,
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
import { useLocation, useNavigate } from "react-router";

import { useAuthenticatedSession } from "../auth/session-context";
import { isPublicDemoPath } from "../../shared/lib/demo-mode";
import {
  createAbortBoundObjectUrl,
  type AbortBoundObjectUrl,
} from "../../shared/lib/private-object-url";
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
  type AssetSourceView,
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
import { createSyntheticSourcePng } from "../../shared/domain/synthetic-image";
import {
  acquireGenerationRequestLease,
  AssetReviewApiError,
  cancelGenerationJob,
  fetchAssetFileBlob,
  fetchAssetReview,
  fetchAssetReviewQueue,
  fetchGenerationJobs,
  removeAssetFile,
  shouldRetainGenerationRequestLease,
  startGenerationJob,
  type GenerationRequestLease,
  uploadAssetFile,
  updateAssetReview,
} from "./asset-review-api";
import {
  assetReviewChecklistCopy,
  assetReviewChecklistProgressCopy,
  assetReviewDimensionItems,
  assetReviewEvidenceCopy,
  type AssetReviewDimensionKey,
} from "./asset-review-evidence-copy";
import {
  assetReviewFileActionCopy,
  assetReviewFileControlCopy,
  assetReviewFileRemoveActionCopy,
  nextAssetReviewFileRemoveIntent,
} from "./asset-review-file-copy";
import {
  assetReviewGenerationCancelActionCopy,
  assetReviewGenerationCreditHistoryCopy,
  assetReviewGenerationCreditSummaryCopy,
  assetReviewGenerationEntitlementCopy,
  assetReviewGenerationModeCopy,
  assetReviewGenerationStatusCopy,
  generationInspectorCopy,
  nextAssetReviewGenerationCancelIntent,
} from "./asset-review-generation-copy";
import {
  assetReviewGenerationHistoryCountCopy,
  assetReviewGenerationHistoryForAsset,
  assetReviewGenerationTime,
  generationHistoryCopy,
} from "./asset-review-generation-history";
import {
  assetReviewHeaderCopy,
  assetReviewHeaderEyebrowCopy,
  assetReviewQualityCopy,
  assetReviewQueueSuffixCopy,
  assetReviewSourceKindCopy,
  assetReviewStatusPresentation,
} from "./asset-review-metadata-copy";
import {
  assetReviewErrorNotice,
  assetReviewFileRemovedNotice,
  assetReviewGenerationFailureNotice,
  assetReviewQueueNotice,
  assetReviewRejectActionLabel,
  assetReviewSavedNotice,
  assetReviewSavingNotice,
  assetReviewStatusCopy,
  bilingualCopy,
  bilingualTitle,
  nextAssetReviewRejectIntent,
  type AssetReviewNotice,
  type BilingualCopy,
} from "./asset-review-status";
import {
  assetReviewSourceCopy,
  assetReviewSourceFrameCopy,
  assetReviewSourcePreviewAltCopy,
  assetReviewSourceViewCopy,
  assetReviewSourceViews,
} from "./asset-review-source-copy";
import {
  assetReviewCameraPresetCopy,
  assetReviewCameraPresets,
  assetReviewCameraReadoutCopy,
  assetReviewViewportCopy,
  type AssetReviewCameraPreset,
} from "./asset-review-viewport-copy";
import {
  targetAssetIdForWorkspace,
  useAssetReviewNavigation,
} from "./asset-review-navigation";
import { AssetReviewStatusView } from "./AssetReviewStatusView";
import "./asset-review.css";

const AssetModelPreview = lazy(async () => {
  const module = await import("../../shared/components/AssetModelPreview");
  return { default: module.AssetModelPreview };
});

type ReviewForm = {
  asset: AssetReviewItem;
  checks: Set<AssetReviewCheck>;
  dimensions: Record<AssetReviewDimensionKey, string>;
};

type AssetFileUrls = {
  assetKey: string;
  model: string | null;
  sources: Record<AssetSourceView, string | null>;
};

type LocalAssetNavigationState = {
  generationState?: GenerationJobListResponse;
  localAsset?: AssetReviewItem;
  sourceUrl?: string;
};

const reviewActionCopy = {
  approve: bilingualCopy("核准素材", "Approve asset"),
  approving: bilingualCopy("核准中…", "Approving…"),
  builder: bilingualCopy("在 Builder 檢查", "Check in Builder"),
  create: bilingualCopy("建立模擬 GLB 草稿", "Create simulated GLB draft"),
  creating: bilingualCopy("建立中…", "Creating…"),
  running: bilingualCopy("模擬工作進行中", "Simulation in progress"),
  save: bilingualCopy("儲存草稿", "Save draft"),
  saving: bilingualCopy("儲存中…", "Saving…"),
} as const;

function BilingualActionLabel({ copy }: { copy: BilingualCopy }) {
  return (
    <span className="review-action-label">
      <span>{copy.zhHant}</span>
      <small lang="en">{copy.english}</small>
    </span>
  );
}

function BilingualInterfaceText({
  copy,
  className,
}: {
  copy: BilingualCopy;
  className?: string;
}) {
  return (
    <span
      className={`review-bilingual-copy${className ? ` ${className}` : ""}`}
    >
      <span>{copy.zhHant}</span>
      <span lang="en">{copy.english}</span>
    </span>
  );
}

function BilingualStrongText({ copy }: { copy: BilingualCopy }) {
  return (
    <strong className="review-bilingual-copy">
      <span>{copy.zhHant}</span>
      <span lang="en">{copy.english}</span>
    </strong>
  );
}

function assetKey(asset: AssetReviewItem): string {
  return `${asset.id}:${asset.version}`;
}

function emptyAssetSourceUrls(
  front: string | null = null,
): Record<AssetSourceView, string | null> {
  return {
    front,
    back: null,
    left: null,
    "three-quarter": null,
  };
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

export function AssetReviewPage() {
  const { currentWorkspace } = useAuthenticatedSession();
  const location = useLocation();
  const navigate = useNavigate();
  const { target, clearAssetReviewTarget } = useAssetReviewNavigation();
  const [initialNavigationTarget] = useState(() => target);
  const isLocalPreview = import.meta.env.DEV || isPublicDemoPath();
  const targetAssetId = targetAssetIdForWorkspace(
    initialNavigationTarget,
    currentWorkspace.id,
  );
  const localNavigationState =
    (location.state as LocalAssetNavigationState | null) ?? null;
  const initialAsset = isLocalPreview
    ? (localNavigationState?.localAsset ?? reviewAsset)
    : null;
  const [camera, setCamera] = useState<AssetReviewCameraPreset>("等角");
  const [selectedSourceView, setSelectedSourceView] =
    useState<AssetSourceView>("front");
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
    sources: emptyAssetSourceUrls(localNavigationState?.sourceUrl ?? null),
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
  const [removingKind, setRemovingKind] = useState<AssetFileKind | null>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const localObjectUrlsRef = useRef(
    new Set(
      localNavigationState?.sourceUrl ? [localNavigationState.sourceUrl] : [],
    ),
  );
  const [submittingAction, setSubmittingAction] = useState<
    AssetReviewMutation["action"] | null
  >(null);
  const submitting = submittingAction !== null;
  const [rejectArmedKey, setRejectArmedKey] = useState<string | null>(null);
  const [removeArmedKey, setRemoveArmedKey] = useState<string | null>(null);
  const [generationCancelArmedKey, setGenerationCancelArmedKey] = useState<
    string | null
  >(null);
  const [reviewNotice, setReviewNotice] = useState<AssetReviewNotice>(() =>
    isLocalPreview
      ? localNavigationState?.localAsset?.sourceKind === "uploaded"
        ? assetReviewStatusCopy.localUploadSession
        : assetReviewStatusCopy.localSyntheticSession
      : assetReviewStatusCopy.workspaceLoaded,
  );
  const [generationState, setGenerationState] =
    useState<GenerationJobListResponse>(() =>
      isLocalPreview && localNavigationState?.generationState
        ? localNavigationState.generationState
        : {
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
          },
    );
  const [generationOperation, setGenerationOperation] = useState<
    "cancel" | "start" | null
  >(null);
  const generationSubmitting = generationOperation !== null;
  const fileOperationPending = uploadingKind !== null || removingKind !== null;
  const appliedGenerationJobRef = useRef<string | null>(null);
  const generationRequestLeaseRef = useRef<GenerationRequestLease | null>(null);

  useEffect(() => {
    if (initialNavigationTarget) {
      clearAssetReviewTarget(initialNavigationTarget);
    }
  }, [clearAssetReviewTarget, initialNavigationTarget]);

  useEffect(() => {
    if (location.search || location.hash) {
      void navigate("/asset-review", {
        replace: true,
        state: location.state,
      });
    }
  }, [location.hash, location.search, location.state, navigate]);

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
        setSelectedSourceView("front");
        setRejectArmedKey(null);
        setRemoveArmedKey(null);
        setGenerationCancelArmedKey(null);
        setForm(items[0] ? createReviewForm(items[0]) : null);
        setLoadedWorkspaceId(currentWorkspace.id);
        setLoadState("ready");
        setReviewNotice(
          targetAssetId && items[0]
            ? assetReviewStatusCopy.selectedLoaded
            : items.length > 0
              ? assetReviewQueueNotice(items.length)
              : assetReviewStatusCopy.queueEmpty,
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
    const privateUrls: AbortBoundObjectUrl[] = [];
    const loadFile = async (
      kind: AssetFileKind,
      available: boolean,
      sourceView: AssetSourceView = "front",
    ) => {
      if (!available) {
        return null;
      }
      try {
        const blob = await fetchAssetFileBlob(
          controller.signal,
          currentWorkspace.id,
          currentAsset.id,
          kind,
          sourceView,
        );
        const privateUrl = createAbortBoundObjectUrl(blob, controller.signal);
        if (!privateUrl) {
          return null;
        }
        privateUrls.push(privateUrl);
        return privateUrl.url;
      } catch {
        return null;
      }
    };

    void Promise.all([
      loadFile("source", currentAsset.files.sources.front !== null, "front"),
      loadFile("source", currentAsset.files.sources.back !== null, "back"),
      loadFile("source", currentAsset.files.sources.left !== null, "left"),
      loadFile(
        "source",
        currentAsset.files.sources["three-quarter"] !== null,
        "three-quarter",
      ),
      loadFile("model", currentAsset.files.model !== null),
    ]).then(([front, back, left, threeQuarter, model]) => {
      if (!controller.signal.aborted) {
        setFileUrls({
          assetKey: currentAssetKey,
          model,
          sources: {
            front,
            back,
            left,
            "three-quarter": threeQuarter,
          },
        });
      }
    });

    return () => {
      controller.abort();
      privateUrls.forEach((privateUrl) => privateUrl.revoke());
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
    const activeJob = activeAsset
      ? assetReviewGenerationHistoryForAsset(
          generationState.items,
          activeAsset.id,
        ).find((job) =>
          ["queued", "running", "validating"].includes(job.status),
        )
      : undefined;
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
        const latest = assetReviewGenerationHistoryForAsset(
          next.items,
          activeAsset.id,
        )[0];
        if (latest?.status !== "queued") {
          setGenerationCancelArmedKey(null);
        }
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
            setRejectArmedKey(null);
            setRemoveArmedKey(null);
            setGenerationCancelArmedKey(null);
            setForm(createReviewForm(updated));
            setReviewNotice(assetReviewStatusCopy.generatedDraftValidated);
          }
        } else if (latest?.status === "failed") {
          const failureCode =
            latest.failureCode ?? "GENERATION_WORKFLOW_FAILED";
          setReviewNotice(assetReviewGenerationFailureNotice(failureCode));
        } else if (latest?.status === "cancelled") {
          setGenerationCancelArmedKey(null);
          setReviewNotice(assetReviewStatusCopy.generationCancelled);
        }
      } catch {
        if (!controller.signal.aborted) {
          setReviewNotice(assetReviewStatusCopy.generationPollFailed);
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
    setRejectArmedKey(null);
    setRemoveArmedKey(null);
    setGenerationCancelArmedKey(null);
    setLoadedWorkspaceId(null);
    setReloadToken((token) => token + 1);
  };

  const visibleLoadState =
    loadedWorkspaceId === currentWorkspace.id ? loadState : "loading";

  if (visibleLoadState === "loading") {
    return (
      <div className="page asset-review-page">
        <LoadingState
          label="正在載入素材審核佇列"
          labelEnglish="Loading asset review queue"
        />
      </div>
    );
  }

  if (visibleLoadState === "error") {
    return (
      <div className="page asset-review-page">
        <ErrorState
          title="無法載入素材審核佇列"
          titleEnglish="Unable to load the asset review queue"
          onRetry={retryQueue}
        />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="page asset-review-page">
        <EmptyState
          title="沒有等待審核的素材"
          titleEnglish="No assets are waiting for review"
          message="請先在產品目錄為一項產品上載私人來源圖片，建立新的素材草稿。"
          messageEnglish="First upload a private source image to a catalogue product to create a new asset draft."
        />
      </div>
    );
  }

  const { asset } = form;
  const currentRejectKey = `${currentWorkspace.id}:${assetKey(asset)}`;
  const currentSourceRemoveKey = `${currentWorkspace.id}:${assetKey(asset)}:source:${selectedSourceView}`;
  const currentModelRemoveKey = `${currentWorkspace.id}:${assetKey(asset)}:model`;
  const rejectArmed = rejectArmedKey === currentRejectKey;
  const sourceRemoveArmed = removeArmedKey === currentSourceRemoveKey;
  const modelRemoveArmed = removeArmedKey === currentModelRemoveKey;
  const badge = assetReviewStatusPresentation[asset.status];
  const queueSuffix = assetReviewQueueSuffixCopy(
    targetAssetId !== null,
    queueCount,
  );
  const visibleFileUrls =
    fileUrls.assetKey === assetKey(asset)
      ? fileUrls
      : { assetKey: "", model: null, sources: emptyAssetSourceUrls() };
  const canEdit =
    currentWorkspace.role !== "viewer" && asset.status !== "approved";
  const canDecide =
    (currentWorkspace.role === "owner" || currentWorkspace.role === "admin") &&
    asset.status !== "approved";
  const sourceRightsRecorded = form.checks.has("source_rights");
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
  const generationHistoryJobs = assetReviewGenerationHistoryForAsset(
    generationState.items,
    asset.id,
  );
  const latestGenerationJob = generationHistoryJobs[0] ?? null;
  const queuedGenerationJob = generationHistoryJobs.find(
    (job) =>
      job.assetId === asset.id &&
      job.status === "queued" &&
      job.entitlementStatus === "reserved",
  );
  const currentGenerationCancelKey = queuedGenerationJob
    ? `${currentWorkspace.id}:${assetKey(asset)}:${queuedGenerationJob.id}`
    : null;
  const generationCancelArmed =
    currentGenerationCancelKey !== null &&
    generationCancelArmedKey === currentGenerationCancelKey;
  const generationModeLabel = assetReviewGenerationModeCopy(
    generationState.capability.mode,
  );
  const generationStatusLabel = latestGenerationJob
    ? assetReviewGenerationStatusCopy(latestGenerationJob)
    : generationInspectorCopy.noJob;
  const generationCreditLabel = assetReviewGenerationCreditSummaryCopy(
    generationState.capability.credits,
  );
  const generationCreditHistoryLabel = assetReviewGenerationCreditHistoryCopy(
    generationState.capability.credits,
  );
  const generationEntitlementLabel = latestGenerationJob?.entitlementStatus
    ? assetReviewGenerationEntitlementCopy(
        latestGenerationJob.entitlementStatus,
      )
    : generationInspectorCopy.notApplicable;
  const generationActive = generationHistoryJobs.some(
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
    asset.files.sources.front !== null &&
    asset.sourceRightsConfirmed &&
    !reviewHasUnsavedChanges &&
    generationState.capability.mode === "simulation" &&
    generationState.capability.credits.availableUnits >= 1 &&
    !generationActive &&
    !fileOperationPending &&
    !submitting &&
    !generationSubmitting;
  const canCancelQueuedGeneration =
    canDecide &&
    queuedGenerationJob !== undefined &&
    !fileOperationPending &&
    !submitting &&
    !generationSubmitting;
  const generationActionLabel =
    generationOperation === "start"
      ? reviewActionCopy.creating
      : generationActive
        ? reviewActionCopy.running
        : reviewActionCopy.create;
  const generationCancelActionLabel = assetReviewGenerationCancelActionCopy(
    generationCancelArmed,
    generationOperation === "cancel",
  );
  const approveActionLabel =
    submittingAction === "approve"
      ? reviewActionCopy.approving
      : reviewActionCopy.approve;
  const rejectActionLabel = assetReviewRejectActionLabel(
    rejectArmed,
    submittingAction === "reject",
  );
  const saveActionLabel =
    submittingAction === "save_draft"
      ? reviewActionCopy.saving
      : reviewActionCopy.save;
  const sourceFileActionLabel = assetReviewFileActionCopy(
    "source",
    asset.files.sources[selectedSourceView] !== null,
    uploadingKind === "source",
  );
  const selectedSourceFile = asset.files.sources[selectedSourceView];
  const sourceFileRemoveActionLabel = assetReviewFileRemoveActionCopy(
    "source",
    sourceRemoveArmed,
    removingKind === "source",
  );
  const modelFileActionLabel = assetReviewFileActionCopy(
    "model",
    asset.files.model !== null,
    uploadingKind === "model",
  );
  const modelFileRemoveActionLabel = assetReviewFileRemoveActionCopy(
    "model",
    modelRemoveArmed,
    removingKind === "model",
  );
  const generationActionTitle =
    generationState.capability.mode !== "simulation"
      ? bilingualTitle(
          "Production kill switch 維持關閉",
          "Production generation remains disabled",
        )
      : !canDecide
        ? bilingualTitle(
            "只有 owner 或 admin 可建立生成工作",
            "Only an owner or admin can create a generation job",
          )
        : asset.files.sources.front === null
          ? bilingualTitle(
              "先上載私人來源圖片",
              "Upload a private source image first",
            )
          : generationState.capability.credits.availableUnits < 1
            ? bilingualTitle(
                "沒有可保留的本機測試 credit",
                "No local test credit is available to reserve",
              )
            : generationActive
              ? bilingualTitle(
                  "已有進行中或等待人工決定的生成工作",
                  "A generation job is active or awaiting a human decision",
                )
              : !asset.sourceRightsConfirmed || reviewHasUnsavedChanges
                ? bilingualTitle(
                    "先儲存來源圖片使用權確認及其他審核變更",
                    "Save the source-rights confirmation and other review changes first",
                  )
                : bilingualTitle(
                    "建立零成本合成 GLB 草稿，不呼叫外部供應商",
                    "Create a zero-cost synthetic GLB draft without an external provider",
                  );
  const generationCancelActionTitle = generationCancelArmed
    ? bilingualTitle(
        "再次按下才會取消仍在排隊的工作並釋放 credit",
        "Press again to cancel the still-queued job and release its credit",
      )
    : bilingualTitle(
        "只可取消尚未由 Workflow 開始的工作",
        "Only a job not yet started by Workflow can be cancelled",
      );
  const approveActionTitle = asset.files.model
    ? bilingualTitle(
        "所有清單及尺寸完成後可核准",
        "Complete every check and dimension before approval",
      )
    : bilingualTitle(
        "上載並檢查 GLB 模型後才可核准",
        "Upload and inspect a GLB model before approval",
      );
  const rejectActionTitle = rejectArmed
    ? bilingualTitle(
        "再次按下以確認拒絕；私人檔案不會被刪除",
        "Press again to confirm rejection; private files will not be deleted",
      )
    : bilingualTitle(
        "拒絕會更新審核狀態",
        "Rejection updates the review status",
      );

  const clearConfirmationIntents = () => {
    setRejectArmedKey(null);
    setRemoveArmedKey(null);
    setGenerationCancelArmedKey(null);
  };

  const cancelConfirmationIntents = () => {
    const hadConfirmation =
      rejectArmedKey !== null ||
      removeArmedKey !== null ||
      generationCancelArmedKey !== null;
    clearConfirmationIntents();
    if (hadConfirmation) {
      setReviewNotice(assetReviewStatusCopy.confirmationCanceled);
    }
  };

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
    if (
      !isLocalPreview ||
      !currentForm ||
      !canEdit ||
      fileOperationPending ||
      submitting ||
      generationSubmitting
    ) {
      return;
    }
    clearConfirmationIntents();
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
        sources: {
          ...currentForm.asset.files.sources,
          [selectedSourceView]: {
            contentType,
            sizeBytes: bytes.byteLength,
          },
        },
      },
      version: currentForm.asset.version + 1,
    };
    setFileUrls((current) => {
      const sameAsset = current.assetKey === assetKey(currentForm.asset);
      const currentSources = sameAsset
        ? current.sources
        : emptyAssetSourceUrls();
      const replaced = currentSources[selectedSourceView];
      if (replaced && localObjectUrlsRef.current.has(replaced)) {
        URL.revokeObjectURL(replaced);
        localObjectUrlsRef.current.delete(replaced);
      }
      return {
        assetKey: assetKey(updated),
        model: sameAsset ? current.model : null,
        sources: {
          ...currentSources,
          [selectedSourceView]: objectUrl,
        },
      };
    });
    setForm(createReviewForm(updated));
    setReviewNotice(assetReviewStatusCopy.localSourceCreated);
  };

  const toggleCheck = (check: AssetReviewCheck) => {
    if (
      !canEdit ||
      fileOperationPending ||
      submitting ||
      generationSubmitting
    ) {
      return;
    }
    clearConfirmationIntents();

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
    setReviewNotice(assetReviewStatusCopy.checklistDirty);
  };

  const updateDimension = (key: AssetReviewDimensionKey, value: string) => {
    if (
      !canEdit ||
      fileOperationPending ||
      submitting ||
      generationSubmitting
    ) {
      return;
    }
    clearConfirmationIntents();

    setForm((current) =>
      current
        ? {
            ...current,
            dimensions: { ...current.dimensions, [key]: value },
          }
        : current,
    );
    setReviewNotice(assetReviewStatusCopy.dimensionsDirty);
  };

  const handleFileSelection = async (
    kind: AssetFileKind,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const inputElement = event.currentTarget;
    const file = inputElement.files?.[0];
    const currentForm = form;
    if (
      !file ||
      !currentForm ||
      !canEdit ||
      fileOperationPending ||
      submitting ||
      generationSubmitting
    ) {
      inputElement.value = "";
      return;
    }
    const sourceView = selectedSourceView;

    clearConfirmationIntents();
    setUploadingKind(kind);
    setReviewNotice(
      kind === "source"
        ? assetReviewStatusCopy.uploadingSource
        : assetReviewStatusCopy.uploadingModel,
    );
    try {
      if (file.size > assetFileLimits[kind]) {
        throw new AssetFileValidationError(
          kind === "source"
            ? "來源圖片必須小於或等於 10 MiB。 / The source image must be 10 MiB or smaller."
            : "GLB 模型必須小於或等於 25 MiB。 / The GLB model must be 25 MiB or smaller.",
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
          files:
            kind === "source"
              ? {
                  ...currentForm.asset.files,
                  sources: {
                    ...currentForm.asset.files.sources,
                    [sourceView]: {
                      contentType,
                      sizeBytes: file.size,
                    },
                  },
                }
              : {
                  ...currentForm.asset.files,
                  model: {
                    contentType: assetModelContentType,
                    sizeBytes: file.size,
                  },
                },
          version: currentForm.asset.version + 1,
        };
        setFileUrls((current) => {
          const currentKey = assetKey(currentForm.asset);
          const sameAsset = current.assetKey === currentKey;
          const sources = sameAsset ? current.sources : emptyAssetSourceUrls();
          const model =
            kind === "model" ? objectUrl : sameAsset ? current.model : null;
          const replaced =
            kind === "source" ? sources[sourceView] : current.model;
          if (replaced && localObjectUrlsRef.current.has(replaced)) {
            URL.revokeObjectURL(replaced);
            localObjectUrlsRef.current.delete(replaced);
          }
          return {
            assetKey: assetKey(updated),
            model,
            sources:
              kind === "source"
                ? { ...sources, [sourceView]: objectUrl }
                : sources,
          };
        });
      } else {
        updated = await uploadAssetFile(
          currentWorkspace.id,
          currentForm.asset.id,
          kind,
          currentForm.asset.version,
          file,
          sourceView,
        );
      }

      setForm(createReviewForm(updated));
      setReviewNotice(
        kind === "source"
          ? assetReviewStatusCopy.sourceUploaded
          : assetReviewStatusCopy.modelUploaded,
      );
    } catch (error) {
      setReviewNotice(
        assetReviewErrorNotice(
          error,
          kind === "source" ? "source-upload" : "model-upload",
        ),
      );
    } finally {
      inputElement.value = "";
      setUploadingKind(null);
    }
  };

  const requestFileRemoval = async (kind: AssetFileKind) => {
    const currentForm = form;
    const sourceView = selectedSourceView;
    const selectedFile =
      kind === "source"
        ? currentForm?.asset.files.sources[sourceView]
        : currentForm?.asset.files.model;
    if (
      !currentForm ||
      !selectedFile ||
      !canEdit ||
      fileOperationPending ||
      submitting ||
      generationSubmitting
    ) {
      return;
    }

    const removalKey =
      kind === "source"
        ? `${currentWorkspace.id}:${assetKey(currentForm.asset)}:source:${sourceView}`
        : `${currentWorkspace.id}:${assetKey(currentForm.asset)}:model`;
    const intent = nextAssetReviewFileRemoveIntent(removeArmedKey, removalKey);
    setRejectArmedKey(null);
    setGenerationCancelArmedKey(null);
    setRemoveArmedKey(intent.nextArmedKey);
    if (!intent.shouldSubmit) {
      setReviewNotice(
        kind === "source"
          ? assetReviewStatusCopy.confirmSourceRemoval
          : assetReviewStatusCopy.confirmModelRemoval,
      );
      return;
    }

    const hadReservedGeneration = generationState.items.some(
      (job) =>
        job.assetId === currentForm.asset.id &&
        job.entitlementStatus === "reserved",
    );
    setRemovingKind(kind);
    setReviewNotice(
      kind === "source"
        ? assetReviewStatusCopy.removingSource
        : assetReviewStatusCopy.removingModel,
    );
    try {
      let updated: AssetReviewItem;
      let reservedGenerationReleased = false;
      if (isLocalPreview) {
        if (hadReservedGeneration) {
          transitionLocalReservedGeneration(
            "released",
            "GENERATION_DRAFT_SUPERSEDED",
          );
          reservedGenerationReleased = true;
        }
        updated = {
          ...currentForm.asset,
          status: "draft",
          quality: "unreviewed",
          sourceKind: "uploaded",
          completedChecks: [],
          sourceRightsConfirmed: false,
          dimensionsMm: { width: null, height: null, depth: null },
          files:
            kind === "source"
              ? {
                  ...currentForm.asset.files,
                  sources: {
                    ...currentForm.asset.files.sources,
                    [sourceView]: null,
                  },
                }
              : { ...currentForm.asset.files, model: null },
          version: currentForm.asset.version + 1,
        };
        setFileUrls((current) => {
          const sameAsset = current.assetKey === assetKey(currentForm.asset);
          const sources = sameAsset ? current.sources : emptyAssetSourceUrls();
          const model = sameAsset ? current.model : null;
          const removed = kind === "source" ? sources[sourceView] : model;
          if (removed && localObjectUrlsRef.current.has(removed)) {
            URL.revokeObjectURL(removed);
            localObjectUrlsRef.current.delete(removed);
          }
          return {
            assetKey: assetKey(updated),
            model: kind === "model" ? null : model,
            sources:
              kind === "source" ? { ...sources, [sourceView]: null } : sources,
          };
        });
      } else {
        const result = await removeAssetFile(
          currentWorkspace.id,
          currentForm.asset.id,
          kind,
          currentForm.asset.version,
          sourceView,
        );
        updated = result.asset;
        reservedGenerationReleased = result.reservedGenerationReleased;
      }

      setForm(createReviewForm(updated));
      setReviewNotice(
        assetReviewFileRemovedNotice(kind, reservedGenerationReleased),
      );
    } catch (error) {
      const notice =
        error instanceof AssetReviewApiError &&
        error.code === "ASSET_VERSION_CONFLICT"
          ? assetReviewStatusCopy.versionConflict
          : assetReviewErrorNotice(
              error,
              kind === "source" ? "source-remove" : "model-remove",
            );
      setReviewNotice(notice);
    } finally {
      setRemovingKind(null);
    }
  };

  const requestGenerationCancellation = async () => {
    const currentForm = form;
    const job = queuedGenerationJob;
    const cancellationKey = currentGenerationCancelKey;
    if (
      !currentForm ||
      !job ||
      !cancellationKey ||
      !canCancelQueuedGeneration
    ) {
      return;
    }

    const intent = nextAssetReviewGenerationCancelIntent(
      generationCancelArmedKey,
      cancellationKey,
    );
    setRejectArmedKey(null);
    setRemoveArmedKey(null);
    setGenerationCancelArmedKey(intent.nextArmedKey);
    if (!intent.shouldSubmit) {
      setReviewNotice(assetReviewStatusCopy.confirmGenerationCancel);
      return;
    }

    setGenerationOperation("cancel");
    setReviewNotice(assetReviewStatusCopy.cancelingGeneration);
    try {
      const cancelled = isLocalPreview
        ? {
            ...job,
            status: "cancelled" as const,
            entitlementStatus: "released" as const,
            updatedAt: new Date().toISOString(),
          }
        : await cancelGenerationJob(
            currentWorkspace.id,
            currentForm.asset.id,
            job.id,
          );
      setGenerationState((current) => {
        const previous = current.items.find((item) => item.id === cancelled.id);
        const releasedReservation =
          previous?.entitlementStatus === "reserved" &&
          cancelled.entitlementStatus === "released";
        const credits = current.capability.credits;
        return {
          capability: {
            ...current.capability,
            credits: releasedReservation
              ? {
                  ...credits,
                  availableUnits: credits.availableUnits + 1,
                  reservedUnits: Math.max(0, credits.reservedUnits - 1),
                  releasedUnits: credits.releasedUnits + 1,
                }
              : credits,
          },
          items: current.items.map((item) =>
            item.id === cancelled.id ? cancelled : item,
          ),
        };
      });
      setReviewNotice(assetReviewStatusCopy.generationCancelled);
    } catch (error) {
      if (
        error instanceof AssetReviewApiError &&
        error.code === "GENERATION_CANCEL_TOO_LATE"
      ) {
        setReloadToken((token) => token + 1);
      }
      setReviewNotice(assetReviewErrorNotice(error, "generation-cancel"));
    } finally {
      setGenerationOperation(null);
    }
  };

  const requestGeneration = async () => {
    const currentForm = form;
    if (!currentForm || !canRequestGeneration) {
      return;
    }
    clearConfirmationIntents();
    setGenerationOperation("start");
    setReviewNotice(assetReviewStatusCopy.creatingGeneration);
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
            sources:
              current.assetKey === assetKey(currentForm.asset)
                ? current.sources
                : emptyAssetSourceUrls(),
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
        const lease = acquireGenerationRequestLease(
          generationRequestLeaseRef.current,
          {
            workspaceId: currentWorkspace.id,
            assetId: currentForm.asset.id,
            expectedVersion: currentForm.asset.version,
          },
        );
        generationRequestLeaseRef.current = lease;
        const job = await startGenerationJob(
          currentWorkspace.id,
          currentForm.asset.id,
          { expectedVersion: currentForm.asset.version },
          lease.idempotencyKey,
        );
        generationRequestLeaseRef.current = null;
        setGenerationState((current) => ({
          ...current,
          items: [job, ...current.items.filter((item) => item.id !== job.id)],
        }));
      }
      setReviewNotice(
        isLocalPreview
          ? assetReviewStatusCopy.localGenerationCreated
          : assetReviewStatusCopy.generationQueued,
      );
    } catch (error) {
      if (!isLocalPreview && !shouldRetainGenerationRequestLease(error)) {
        generationRequestLeaseRef.current = null;
      }
      setReviewNotice(assetReviewErrorNotice(error, "generation"));
    } finally {
      setGenerationOperation(null);
    }
  };

  const submitReview = async (action: AssetReviewMutation["action"]) => {
    const currentForm = form;
    if (
      !currentForm ||
      submitting ||
      fileOperationPending ||
      generationSubmitting
    ) {
      return;
    }
    clearConfirmationIntents();
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
    setSubmittingAction(action);
    setReviewNotice(assetReviewSavingNotice(action));

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
      setReviewNotice(assetReviewSavedNotice(action, hadReservedGeneration));
    } catch (error) {
      const failureOperation =
        action === "approve"
          ? "approve"
          : action === "reject"
            ? "reject"
            : "save";
      const notice =
        error instanceof AssetReviewApiError &&
        error.code === "ASSET_VERSION_CONFLICT"
          ? assetReviewStatusCopy.versionConflict
          : assetReviewErrorNotice(error, failureOperation);
      setReviewNotice(notice);
    } finally {
      setSubmittingAction(null);
    }
  };

  const requestReject = () => {
    if (
      !canDecide ||
      submitting ||
      fileOperationPending ||
      generationSubmitting
    ) {
      return;
    }
    const intent = nextAssetReviewRejectIntent(
      rejectArmedKey,
      currentRejectKey,
    );
    setRemoveArmedKey(null);
    setGenerationCancelArmedKey(null);
    setRejectArmedKey(intent.nextArmedKey);
    if (!intent.shouldSubmit) {
      setReviewNotice(assetReviewStatusCopy.confirmReject);
      return;
    }
    void submitReview("reject");
  };

  return (
    <div className="asset-review-page">
      <input
        ref={sourceInputRef}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={
          !canEdit || fileOperationPending || submitting || generationSubmitting
        }
        onChange={(event) => void handleFileSelection("source", event)}
      />
      <input
        ref={modelInputRef}
        hidden
        type="file"
        accept=".glb,model/gltf-binary,application/octet-stream"
        disabled={
          !canEdit || fileOperationPending || submitting || generationSubmitting
        }
        onChange={(event) => void handleFileSelection("model", event)}
      />
      <header className="asset-review-header">
        <div>
          <BilingualInterfaceText
            className="eyebrow"
            copy={assetReviewHeaderEyebrowCopy(asset.version)}
          />
          <h1>
            {asset.part.manufacturer} {asset.part.model}
          </h1>
          <p>
            <BilingualInterfaceText copy={assetReviewHeaderCopy.guidance} />
          </p>
        </div>
        <div className="asset-review-header__meta">
          <StatusBadge tone={badge.tone}>
            <BilingualInterfaceText copy={badge.copy} />
          </StatusBadge>
          <AssetReviewStatusView
            notice={reviewNotice}
            zhHantSuffix={queueSuffix.zhHant}
            englishSuffix={queueSuffix.english}
          />
        </div>
      </header>

      <div className="review-workspace">
        <aside
          className="source-filmstrip"
          aria-label={bilingualTitle(
            assetReviewSourceCopy.heading.zhHant,
            assetReviewSourceCopy.heading.english,
          )}
        >
          <div className="review-panel-heading">
            <Image aria-hidden="true" />
            <div>
              <BilingualStrongText copy={assetReviewSourceCopy.heading} />
              <BilingualInterfaceText
                copy={
                  Object.values(visibleFileUrls.sources).some(Boolean)
                    ? assetReviewSourceCopy.loaded
                    : assetReviewSourceCopy.missing
                }
              />
            </div>
          </div>
          {assetReviewSourceViews.map((view, index) => {
            const sourceUrl = visibleFileUrls.sources[view];
            const hasPrivateImage = sourceUrl !== null;
            const frameCopy = assetReviewSourceFrameCopy(view, hasPrivateImage);
            const previewAltCopy = assetReviewSourcePreviewAltCopy(
              asset.part.manufacturer,
              asset.part.model,
              view,
            );
            return (
              <button
                className={`source-frame${selectedSourceView === view ? " is-selected" : ""}`}
                key={view}
                type="button"
                aria-label={bilingualTitle(frameCopy.zhHant, frameCopy.english)}
                aria-controls="asset-source-file-control"
                aria-pressed={selectedSourceView === view}
                disabled={
                  fileOperationPending || submitting || generationSubmitting
                }
                onClick={() => {
                  cancelConfirmationIntents();
                  setSelectedSourceView(view);
                }}
              >
                {hasPrivateImage && sourceUrl ? (
                  <img
                    src={sourceUrl}
                    alt={bilingualTitle(
                      previewAltCopy.zhHant,
                      previewAltCopy.english,
                    )}
                  />
                ) : (
                  <span
                    className={`source-frame__object source-frame__object--${index + 1}`}
                  >
                    <Box aria-hidden="true" />
                  </span>
                )}
                <small>
                  <BilingualInterfaceText
                    copy={assetReviewSourceViewCopy[view]}
                  />
                </small>
              </button>
            );
          })}
          <div
            className={`source-rights is-${sourceRightsRecorded ? "confirmed" : "missing"}`}
          >
            {sourceRightsRecorded ? (
              <Check aria-hidden="true" />
            ) : (
              <X aria-hidden="true" />
            )}
            <BilingualInterfaceText
              copy={
                sourceRightsRecorded
                  ? assetReviewSourceCopy.rightsConfirmed
                  : assetReviewSourceCopy.rightsMissing
              }
            />
          </div>
        </aside>

        <section
          className="review-viewport"
          aria-label={bilingualTitle(
            assetReviewViewportCopy.viewportLabel.zhHant,
            assetReviewViewportCopy.viewportLabel.english,
          )}
        >
          <div className="review-viewport__toolbar">
            <div
              role="group"
              aria-label={bilingualTitle(
                assetReviewViewportCopy.cameraGroupLabel.zhHant,
                assetReviewViewportCopy.cameraGroupLabel.english,
              )}
            >
              {assetReviewCameraPresets.map((preset) => (
                <button
                  className={camera === preset ? "is-active" : ""}
                  key={preset}
                  type="button"
                  aria-pressed={camera === preset}
                  disabled={!visibleFileUrls.model}
                  onClick={() => setCamera(preset)}
                >
                  <BilingualActionLabel
                    copy={assetReviewCameraPresetCopy[preset]}
                  />
                </button>
              ))}
            </div>
            <div>
              <button
                type="button"
                aria-label={bilingualTitle(
                  assetReviewViewportCopy.fitModel.zhHant,
                  assetReviewViewportCopy.fitModel.english,
                )}
                title={bilingualTitle(
                  assetReviewViewportCopy.fitModel.zhHant,
                  assetReviewViewportCopy.fitModel.english,
                )}
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
                aria-label={bilingualTitle(
                  assetReviewViewportCopy.toggleWireframe.zhHant,
                  assetReviewViewportCopy.toggleWireframe.english,
                )}
                title={bilingualTitle(
                  assetReviewViewportCopy.toggleWireframe.zhHant,
                  assetReviewViewportCopy.toggleWireframe.english,
                )}
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
                    <BilingualInterfaceText
                      copy={assetReviewViewportCopy.loadingComponent}
                    />
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
              <BilingualInterfaceText
                copy={assetReviewCameraReadoutCopy(camera)}
              />
              <span className="mono">
                {parsedDimensions.width ?? "—"} ×{" "}
                {parsedDimensions.height ?? "—"} ×{" "}
                {parsedDimensions.depth ?? "—"} mm
              </span>
            </div>
          </div>
          <div className="review-viewport__footer">
            <BilingualInterfaceText
              copy={
                visibleFileUrls.model
                  ? assetReviewViewportCopy.authorizedModel
                  : assetReviewViewportCopy.missingModel
              }
            />
            <BilingualInterfaceText
              copy={assetReviewViewportCopy.evidenceLimit}
            />
          </div>
        </section>

        <aside className="review-inspector">
          <div className="review-inspector__section">
            <div className="review-panel-heading">
              <Camera aria-hidden="true" />
              <div>
                <BilingualStrongText
                  copy={assetReviewHeaderCopy.metadataHeading}
                />
                <BilingualInterfaceText
                  copy={assetReviewSourceKindCopy[asset.sourceKind]}
                />
              </div>
            </div>
            <dl className="technical-list">
              <div>
                <dt>
                  <BilingualInterfaceText
                    copy={assetReviewHeaderCopy.skuLabel}
                  />
                </dt>
                <dd className="mono">{asset.part.sku}</dd>
              </div>
              <div>
                <dt>
                  <BilingualInterfaceText
                    copy={assetReviewHeaderCopy.qualityLabel}
                  />
                </dt>
                <dd>
                  <BilingualInterfaceText
                    copy={assetReviewQualityCopy[asset.quality]}
                  />
                </dd>
              </div>
              <div>
                <dt>
                  <BilingualInterfaceText
                    copy={assetReviewHeaderCopy.reviewVersionLabel}
                  />
                </dt>
                <dd className="mono">v{asset.version}</dd>
              </div>
            </dl>
          </div>

          <div className="review-inspector__section asset-file-controls">
            <div className="review-panel-heading">
              <FileBox aria-hidden="true" />
              <div>
                <BilingualStrongText
                  copy={assetReviewFileControlCopy.heading}
                />
                <BilingualInterfaceText
                  copy={assetReviewFileControlCopy.accessBoundary}
                />
              </div>
            </div>
            <div className="asset-file-control" id="asset-source-file-control">
              <div>
                <BilingualStrongText
                  copy={assetReviewFileControlCopy.sourceImage}
                />
                <BilingualInterfaceText
                  copy={assetReviewSourceViewCopy[selectedSourceView]}
                />
                {selectedSourceFile ? (
                  <span>
                    {selectedSourceFile.contentType} ·{" "}
                    {formatFileSize(selectedSourceFile.sizeBytes)}
                  </span>
                ) : (
                  <BilingualInterfaceText
                    copy={assetReviewFileControlCopy.sourceRequirements}
                  />
                )}
              </div>
              <div className="asset-file-control__actions">
                {isLocalPreview ? (
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={
                      !canEdit ||
                      fileOperationPending ||
                      submitting ||
                      generationSubmitting
                    }
                    title={bilingualTitle(
                      assetReviewFileControlCopy.syntheticImageTitle.zhHant,
                      assetReviewFileControlCopy.syntheticImageTitle.english,
                    )}
                    onClick={createLocalSyntheticSource}
                  >
                    <Sparkles aria-hidden="true" />
                    <BilingualActionLabel
                      copy={assetReviewFileControlCopy.syntheticImage}
                    />
                  </button>
                ) : null}
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={
                    !canEdit ||
                    fileOperationPending ||
                    submitting ||
                    generationSubmitting
                  }
                  title={bilingualTitle(
                    assetReviewFileControlCopy.sourceUploadTitle.zhHant,
                    assetReviewFileControlCopy.sourceUploadTitle.english,
                  )}
                  onClick={() => {
                    cancelConfirmationIntents();
                    sourceInputRef.current?.click();
                  }}
                >
                  <Upload aria-hidden="true" />
                  <BilingualActionLabel copy={sourceFileActionLabel} />
                </button>
                {selectedSourceFile ? (
                  <button
                    className={`button button--danger${sourceRemoveArmed ? " is-armed" : ""}`}
                    type="button"
                    disabled={
                      !canEdit ||
                      fileOperationPending ||
                      submitting ||
                      generationSubmitting
                    }
                    aria-pressed={sourceRemoveArmed}
                    title={bilingualTitle(
                      assetReviewFileControlCopy.sourceRemoveTitle.zhHant,
                      assetReviewFileControlCopy.sourceRemoveTitle.english,
                    )}
                    onClick={() => void requestFileRemoval("source")}
                  >
                    <Trash2 aria-hidden="true" />
                    <BilingualActionLabel copy={sourceFileRemoveActionLabel} />
                  </button>
                ) : null}
              </div>
            </div>
            <div className="asset-file-control">
              <div>
                <BilingualStrongText copy={assetReviewFileControlCopy.model} />
                {asset.files.model ? (
                  <span>
                    GLB · {formatFileSize(asset.files.model.sizeBytes)}
                  </span>
                ) : (
                  <BilingualInterfaceText
                    copy={assetReviewFileControlCopy.modelRequirements}
                  />
                )}
              </div>
              <div className="asset-file-control__actions">
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={
                    !canEdit ||
                    fileOperationPending ||
                    submitting ||
                    generationSubmitting
                  }
                  title={bilingualTitle(
                    assetReviewFileControlCopy.modelUploadTitle.zhHant,
                    assetReviewFileControlCopy.modelUploadTitle.english,
                  )}
                  onClick={() => {
                    cancelConfirmationIntents();
                    modelInputRef.current?.click();
                  }}
                >
                  <Upload aria-hidden="true" />
                  <BilingualActionLabel copy={modelFileActionLabel} />
                </button>
                {asset.files.model ? (
                  <button
                    className={`button button--danger${modelRemoveArmed ? " is-armed" : ""}`}
                    type="button"
                    disabled={
                      !canEdit ||
                      fileOperationPending ||
                      submitting ||
                      generationSubmitting
                    }
                    aria-pressed={modelRemoveArmed}
                    title={bilingualTitle(
                      assetReviewFileControlCopy.modelRemoveTitle.zhHant,
                      assetReviewFileControlCopy.modelRemoveTitle.english,
                    )}
                    onClick={() => void requestFileRemoval("model")}
                  >
                    <Trash2 aria-hidden="true" />
                    <BilingualActionLabel copy={modelFileRemoveActionLabel} />
                  </button>
                ) : null}
              </div>
            </div>
            <small>
              <BilingualInterfaceText
                copy={assetReviewFileControlCopy.replacementWarning}
              />
            </small>
          </div>

          <div className="review-inspector__section generation-job-panel">
            <div className="review-panel-heading">
              <Sparkles aria-hidden="true" />
              <div>
                <strong className="review-bilingual-copy">
                  <span>{generationInspectorCopy.heading.zhHant}</span>
                  <span lang="en">
                    {generationInspectorCopy.heading.english}
                  </span>
                </strong>
                <BilingualInterfaceText
                  copy={generationInspectorCopy.description}
                />
              </div>
            </div>
            <dl className="technical-list">
              <div>
                <dt>
                  <BilingualInterfaceText
                    copy={generationInspectorCopy.executionMode}
                  />
                </dt>
                <dd>
                  <BilingualInterfaceText copy={generationModeLabel} />
                </dd>
              </div>
              <div>
                <dt>
                  <BilingualInterfaceText
                    copy={generationInspectorCopy.latestStatus}
                  />
                </dt>
                <dd>
                  <BilingualInterfaceText copy={generationStatusLabel} />
                </dd>
              </div>
              <div>
                <dt>
                  <BilingualInterfaceText
                    copy={generationInspectorCopy.credit}
                  />
                </dt>
                <dd className="mono">
                  <BilingualInterfaceText copy={generationCreditLabel} />
                </dd>
              </div>
              <div>
                <dt>
                  <BilingualInterfaceText
                    copy={generationInspectorCopy.cumulativeCredit}
                  />
                </dt>
                <dd className="mono">
                  <BilingualInterfaceText copy={generationCreditHistoryLabel} />
                </dd>
              </div>
              <div>
                <dt>
                  <BilingualInterfaceText
                    copy={generationInspectorCopy.entitlementStatus}
                  />
                </dt>
                <dd>
                  <BilingualInterfaceText copy={generationEntitlementLabel} />
                </dd>
              </div>
              <div>
                <dt>
                  <BilingualInterfaceText
                    copy={generationInspectorCopy.simulationCostUnits}
                  />
                </dt>
                <dd className="mono">
                  {latestGenerationJob?.providerCostUnits === null ||
                  latestGenerationJob?.providerCostUnits === undefined ? (
                    <BilingualInterfaceText
                      copy={generationInspectorCopy.noCostRecorded}
                    />
                  ) : (
                    latestGenerationJob.providerCostUnits
                  )}
                </dd>
              </div>
              <div>
                <dt>
                  <BilingualInterfaceText
                    copy={generationInspectorCopy.glbValidation}
                  />
                </dt>
                <dd className="mono">
                  {latestGenerationJob?.validationCode ? (
                    latestGenerationJob.validationCode
                  ) : (
                    <BilingualInterfaceText
                      copy={generationInspectorCopy.notValidated}
                    />
                  )}
                </dd>
              </div>
            </dl>
            <div className="generation-job-history">
              <div className="generation-job-history__heading">
                <BilingualStrongText copy={generationHistoryCopy.heading} />
                <BilingualInterfaceText
                  copy={assetReviewGenerationHistoryCountCopy(
                    generationHistoryJobs.length,
                  )}
                />
              </div>
              <BilingualInterfaceText
                copy={generationHistoryCopy.description}
                className="generation-job-history__description"
              />
              {generationHistoryJobs.length === 0 ? (
                <BilingualInterfaceText
                  copy={generationHistoryCopy.empty}
                  className="generation-job-history__empty"
                />
              ) : (
                <ol
                  aria-label={bilingualTitle(
                    generationHistoryCopy.heading.zhHant,
                    generationHistoryCopy.heading.english,
                  )}
                >
                  {generationHistoryJobs.map((job, index) => {
                    const updated = assetReviewGenerationTime(job.updatedAt);
                    const entitlement = job.entitlementStatus
                      ? assetReviewGenerationEntitlementCopy(
                          job.entitlementStatus,
                        )
                      : generationInspectorCopy.notApplicable;
                    return (
                      <li key={job.id}>
                        <div className="generation-job-history__status">
                          {index === 0 ? (
                            <BilingualInterfaceText
                              copy={generationHistoryCopy.latest}
                              className="generation-job-history__latest"
                            />
                          ) : null}
                          <BilingualInterfaceText
                            copy={assetReviewGenerationStatusCopy(job)}
                          />
                        </div>
                        <BilingualInterfaceText
                          copy={entitlement}
                          className="generation-job-history__entitlement"
                        />
                        <div className="generation-job-history__time">
                          <BilingualInterfaceText
                            copy={generationHistoryCopy.updated}
                          />
                          <time dateTime={updated.dateTime ?? undefined}>
                            <BilingualInterfaceText copy={updated.copy} />
                          </time>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
            <small>
              <BilingualInterfaceText
                copy={generationInspectorCopy.explanation}
              />
            </small>
          </div>

          <div className="review-inspector__section">
            <div className="review-panel-heading">
              <Scan aria-hidden="true" />
              <div>
                <BilingualStrongText
                  copy={assetReviewEvidenceCopy.dimensionsHeading}
                />
                <BilingualInterfaceText
                  copy={assetReviewEvidenceCopy.dimensionsGuidance}
                />
              </div>
            </div>
            <div className="dimension-grid">
              {assetReviewDimensionItems.map(({ key, copy }) => (
                <label key={key}>
                  <BilingualInterfaceText copy={copy} />
                  <span>
                    <input
                      value={form.dimensions[key]}
                      inputMode="decimal"
                      disabled={
                        !canEdit ||
                        submitting ||
                        fileOperationPending ||
                        generationSubmitting
                      }
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
                <BilingualStrongText
                  copy={assetReviewEvidenceCopy.checklistHeading}
                />
                <BilingualInterfaceText
                  copy={assetReviewChecklistProgressCopy(
                    form.checks.size,
                    assetReviewChecks.length,
                  )}
                />
              </div>
            </div>
            {assetReviewChecks.map((check) => (
              <label key={check}>
                <input
                  type="checkbox"
                  checked={form.checks.has(check)}
                  disabled={
                    !canEdit ||
                    submitting ||
                    fileOperationPending ||
                    generationSubmitting
                  }
                  onChange={() => toggleCheck(check)}
                />
                <BilingualInterfaceText
                  copy={assetReviewChecklistCopy[check]}
                />
              </label>
            ))}
          </div>
        </aside>
      </div>

      <footer className="review-actions">
        <div>
          <button
            className={`button button--danger${rejectArmed ? " is-armed" : ""}`}
            type="button"
            disabled={
              !canDecide ||
              submitting ||
              fileOperationPending ||
              generationSubmitting
            }
            aria-pressed={rejectArmed}
            title={rejectActionTitle}
            onClick={requestReject}
          >
            <X aria-hidden="true" />
            <BilingualActionLabel copy={rejectActionLabel} />
          </button>
          {queuedGenerationJob ? (
            <button
              className={`button button--danger${generationCancelArmed ? " is-armed" : ""}`}
              type="button"
              disabled={!canCancelQueuedGeneration}
              aria-pressed={generationCancelArmed}
              title={generationCancelActionTitle}
              onClick={() => void requestGenerationCancellation()}
            >
              <X aria-hidden="true" />
              <BilingualActionLabel copy={generationCancelActionLabel} />
            </button>
          ) : null}
          <button
            className="button"
            type="button"
            disabled={!canRequestGeneration}
            title={generationActionTitle}
            onClick={() => void requestGeneration()}
          >
            <RefreshCw aria-hidden="true" />
            <BilingualActionLabel copy={generationActionLabel} />
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
              <BilingualActionLabel copy={reviewActionCopy.builder} />
              <ArrowRight aria-hidden="true" />
            </button>
          ) : (
            <>
              <button
                className="button button--secondary"
                type="button"
                disabled={
                  !canEdit ||
                  submitting ||
                  fileOperationPending ||
                  generationSubmitting
                }
                onClick={() => void submitReview("save_draft")}
              >
                <Save aria-hidden="true" />
                <BilingualActionLabel copy={saveActionLabel} />
              </button>
              <button
                className="button button--primary"
                type="button"
                disabled={
                  !approvalReady ||
                  !canDecide ||
                  submitting ||
                  fileOperationPending ||
                  generationSubmitting
                }
                title={approveActionTitle}
                onClick={() => void submitReview("approve")}
              >
                <Check aria-hidden="true" />
                <BilingualActionLabel copy={approveActionLabel} />
              </button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
