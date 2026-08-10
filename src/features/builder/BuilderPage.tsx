import { Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";

import { useAuthenticatedSession } from "../auth/session-context";
import { isPublicDemoPath } from "../../shared/lib/demo-mode";
import { fetchCataloguePage } from "../catalogue/catalogue-api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../shared/components/AsyncState";
import {
  composeBuildRecord,
  isBuildExportReady,
  portableBuildExport,
  type BuildListItem,
  type BuildRecord,
} from "../../shared/domain/builds";
import { catalogParts, currentBuild } from "../../shared/domain/mockData";
import type {
  CatalogPart,
  ComponentCategory,
} from "../../shared/domain/schemas";
import {
  BuildRequestError,
  createBuild,
  fetchBuild,
  fetchBuildExport,
  fetchBuildList,
  mutateBuild,
} from "./build-api";
import { BuildInspector } from "./BuildInspector";
import { BuilderCommandBar } from "./BuilderCommandBar";
import {
  BuilderViewport,
  type BuilderCameraPreset,
  type BuilderDisplayMode,
} from "./BuilderViewport";
import { BuildStatusBar } from "./BuildStatusBar";
import { ComponentRail } from "./ComponentRail";
import {
  builderArchivedStatus,
  builderFailureStatus,
  builderLoadedStatus,
  builderSavedStatus,
  builderStatusCopy,
  type BuilderOperationStatus,
} from "./builder-status";
import "./builder.css";

type StepId = ComponentCategory | "summary";

type LocalBuilderNavigationState = {
  localApprovedAssetId?: string;
};

function buildListItem(build: BuildRecord): BuildListItem {
  return {
    id: build.id,
    name: build.name,
    selectedCount: build.selectedParts.length,
    version: build.version,
    updatedAt: build.updatedAt,
  };
}

function replaceListItem(
  items: BuildListItem[],
  build: BuildRecord,
): BuildListItem[] {
  const next = items.filter((item) => item.id !== build.id);
  return [buildListItem(build), ...next];
}

function downloadBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "rigstage-build.json";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function fetchBuilderCatalogue(
  signal: AbortSignal,
  workspaceId: string,
): Promise<CatalogPart[]> {
  const parts: CatalogPart[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 10; page += 1) {
    const response = await fetchCataloguePage(signal, workspaceId, cursor);
    parts.push(...response.items);
    cursor = response.nextCursor;
    if (!cursor) {
      return parts;
    }
  }
  throw new Error(
    "產品目錄超出組裝工具的 1,000 項讀取上限。 / The catalogue exceeds the builder read limit of 1,000 products.",
  );
}

function createLocalInitialBuild(parts: CatalogPart[]): BuildRecord {
  return composeBuildRecord({
    id: currentBuild.id,
    name: currentBuild.name,
    status: "draft",
    selectedParts: parts.filter((part) =>
      currentBuild.selectedPartIds.includes(part.id),
    ),
    version: 0,
    updatedAt: "2026-07-26T00:00:00Z",
  });
}

export function BuilderPage() {
  const { currentWorkspace } = useAuthenticatedSession();
  const location = useLocation();
  const isLocalPreview = import.meta.env.DEV || isPublicDemoPath();
  const localApprovedAssetId = isLocalPreview
    ? ((location.state as LocalBuilderNavigationState | null)
        ?.localApprovedAssetId ?? null)
    : null;
  const localCatalogue = useMemo(
    () =>
      catalogParts.map((part) =>
        part.assetId === localApprovedAssetId
          ? {
              ...part,
              assetQuality: "approved" as const,
              assetStatus: "approved" as const,
            }
          : part,
      ),
    [localApprovedAssetId],
  );
  const localInitialBuild = useMemo(
    () => createLocalInitialBuild(localCatalogue),
    [localCatalogue],
  );
  const canWrite = currentWorkspace.role !== "viewer";
  const [selectedCategory, setSelectedCategory] = useState<StepId>(
    localApprovedAssetId ? "cooling" : "gpu",
  );
  const [camera, setCamera] = useState<BuilderCameraPreset>("等角");
  const [displayMode, setDisplayMode] = useState<BuilderDisplayMode>("著色");
  const [saveState, setSaveState] = useState<BuilderOperationStatus>(
    isLocalPreview
      ? localApprovedAssetId
        ? builderStatusCopy.localApprovedLoaded
        : builderStatusCopy.localBuildLoaded
      : builderStatusCopy.loading,
  );
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [catalogue, setCatalogue] = useState<CatalogPart[]>(
    isLocalPreview ? localCatalogue : [],
  );
  const [builds, setBuilds] = useState<BuildListItem[]>(
    isLocalPreview ? [buildListItem(localInitialBuild)] : [],
  );
  const [build, setBuild] = useState<BuildRecord | null>(
    isLocalPreview ? localInitialBuild : null,
  );
  const [buildCache, setBuildCache] = useState<Record<string, BuildRecord>>(
    isLocalPreview ? { [localInitialBuild.id]: localInitialBuild } : {},
  );
  const [draftName, setDraftName] = useState(
    isLocalPreview ? localInitialBuild.name : "",
  );
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [archiveArmed, setArchiveArmed] = useState(false);
  const [loadState, setLoadState] = useState<"error" | "loading" | "ready">(
    isLocalPreview ? "ready" : "loading",
  );
  const [loadedWorkspaceId, setLoadedWorkspaceId] = useState<string | null>(
    isLocalPreview ? currentWorkspace.id : null,
  );
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (isLocalPreview) {
      return;
    }
    const controller = new AbortController();
    void Promise.all([
      fetchBuilderCatalogue(controller.signal, currentWorkspace.id),
      fetchBuildList(controller.signal, currentWorkspace.id),
    ])
      .then(async ([parts, list]) => {
        const initial = list[0]
          ? await fetchBuild(controller.signal, currentWorkspace.id, list[0].id)
          : null;
        setCatalogue(parts);
        setBuilds(list);
        setBuild(initial);
        setDraftName(initial?.name ?? "");
        setBuildCache(initial ? { [initial.id]: initial } : {});
        setDirty(false);
        setArchiveArmed(false);
        setSaveState(
          initial
            ? builderLoadedStatus(initial.version)
            : builderStatusCopy.emptyRead,
        );
        setLoadedWorkspaceId(currentWorkspace.id);
        setLoadState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadedWorkspaceId(currentWorkspace.id);
          setLoadState("error");
        }
      });
    return () => controller.abort();
  }, [currentWorkspace.id, isLocalPreview, reloadToken]);

  const visibleLoadState =
    loadedWorkspaceId === currentWorkspace.id ? loadState : "loading";
  const selectedPart = useMemo(
    () =>
      selectedCategory === "summary"
        ? null
        : (build?.selectedParts.find(
            (part) => part.category === selectedCategory,
          ) ?? null),
    [build?.selectedParts, selectedCategory],
  );
  const visibleFindings = useMemo(
    () =>
      build
        ? selectedCategory === "summary"
          ? build.findings
          : build.findings.filter((finding) =>
              finding.categories.includes(selectedCategory),
            )
        : [],
    [build, selectedCategory],
  );

  const markDirty = (status: BuilderOperationStatus) => {
    setArchiveArmed(false);
    setDirty(true);
    setSaveState(status);
  };

  const choosePart = (part: CatalogPart) => {
    if (!build || !canWrite) {
      return;
    }
    const selectedParts = [
      ...build.selectedParts.filter(
        (selected) => selected.category !== part.category,
      ),
      part,
    ];
    setBuild(
      composeBuildRecord({
        ...build,
        selectedParts,
        name: build.name,
      }),
    );
    markDirty(builderStatusCopy.partSelectionDirty);
  };

  const changeBuildName = (name: string) => {
    setDraftName(name);
    markDirty(builderStatusCopy.buildNameDirty);
  };

  const createNewBuild = async () => {
    if (!canWrite || busy) {
      return;
    }
    if (dirty) {
      setSaveState(builderStatusCopy.saveBeforeCreate);
      return;
    }
    setBusy(true);
    setSaveState(builderStatusCopy.creating);
    try {
      const created = isLocalPreview
        ? composeBuildRecord({
            id: `build_local_${crypto.randomUUID()}`,
            name: "新組裝方案",
            status: "draft",
            selectedParts: [],
            version: 0,
            updatedAt: new Date().toISOString(),
          })
        : await createBuild(currentWorkspace.id, {
            name: "新組裝方案",
            selectedPartIds: [],
          });
      setBuild(created);
      setDraftName(created.name);
      setBuilds((current) => replaceListItem(current, created));
      setBuildCache((current) => ({ ...current, [created.id]: created }));
      setDirty(false);
      setArchiveArmed(false);
      setSelectedCategory("case");
      setSaveState(
        isLocalPreview
          ? builderStatusCopy.localCreated
          : builderStatusCopy.created,
      );
    } catch (error) {
      setSaveState(builderFailureStatus(error, "create"));
    } finally {
      setBusy(false);
    }
  };

  const selectBuild = async (buildId: string) => {
    if (!buildId || buildId === build?.id || busy) {
      return;
    }
    if (dirty) {
      setSaveState(builderStatusCopy.saveBeforeSwitch);
      return;
    }
    setArchiveArmed(false);
    const cached = buildCache[buildId];
    if (cached) {
      setBuild(cached);
      setDraftName(cached.name);
      setSaveState(builderLoadedStatus(cached.version));
      return;
    }
    setBusy(true);
    setSaveState(builderStatusCopy.switching);
    const controller = new AbortController();
    try {
      const loaded = await fetchBuild(
        controller.signal,
        currentWorkspace.id,
        buildId,
      );
      setBuild(loaded);
      setDraftName(loaded.name);
      setBuildCache((current) => ({ ...current, [loaded.id]: loaded }));
      setSaveState(builderLoadedStatus(loaded.version));
    } catch (error) {
      setSaveState(builderFailureStatus(error, "switch"));
    } finally {
      controller.abort();
      setBusy(false);
    }
  };

  const saveBuild = async () => {
    if (!build || !canWrite || busy || !draftName.trim()) {
      return;
    }
    setBusy(true);
    setSaveState(builderStatusCopy.saving);
    try {
      const updated = isLocalPreview
        ? composeBuildRecord({
            ...build,
            name: draftName.trim(),
            version: build.version + 1,
            updatedAt: new Date().toISOString(),
          })
        : await mutateBuild(currentWorkspace.id, build.id, {
            action: "update",
            expectedVersion: build.version,
            name: draftName.trim(),
            selectedPartIds: build.selectedParts.map((part) => part.id),
          });
      if (!updated) {
        throw new Error(
          "組裝未有回傳更新內容。 / The build update did not return updated data.",
        );
      }
      setBuild(updated);
      setDraftName(updated.name);
      setBuilds((current) => replaceListItem(current, updated));
      setBuildCache((current) => ({ ...current, [updated.id]: updated }));
      setDirty(false);
      setArchiveArmed(false);
      setSaveState(builderSavedStatus(updated.version, isLocalPreview));
    } catch (error) {
      setSaveState(
        error instanceof BuildRequestError &&
          error.code === "BUILD_VERSION_CONFLICT"
          ? builderStatusCopy.versionConflict
          : builderFailureStatus(error, "save"),
      );
    } finally {
      setBusy(false);
    }
  };

  const archiveBuild = async () => {
    if (!build || !canWrite || busy) {
      return;
    }
    if (dirty) {
      setSaveState(builderStatusCopy.saveBeforeArchive);
      return;
    }
    if (!archiveArmed) {
      setArchiveArmed(true);
      setSaveState(builderStatusCopy.confirmArchive);
      return;
    }

    setBusy(true);
    setSaveState(builderStatusCopy.archiving);
    const controller = new AbortController();
    try {
      if (!isLocalPreview) {
        await mutateBuild(currentWorkspace.id, build.id, {
          action: "archive",
          expectedVersion: build.version,
        });
      }
      const remaining = builds.filter((item) => item.id !== build.id);
      const nextSummary = remaining[0] ?? null;
      const nextBuild = nextSummary
        ? (buildCache[nextSummary.id] ??
          (isLocalPreview
            ? null
            : await fetchBuild(
                controller.signal,
                currentWorkspace.id,
                nextSummary.id,
              )))
        : null;

      setBuilds(remaining);
      setBuildCache((current) => {
        const next = { ...current };
        delete next[build.id];
        if (nextBuild) {
          next[nextBuild.id] = nextBuild;
        }
        return next;
      });
      setBuild(nextBuild);
      setDraftName(nextBuild?.name ?? "");
      setDirty(false);
      setSelectedCategory(nextBuild?.selectedParts[0]?.category ?? "case");
      setSaveState(builderArchivedStatus(nextBuild?.version ?? null));
    } catch (error) {
      setSaveState(
        error instanceof BuildRequestError &&
          error.code === "BUILD_VERSION_CONFLICT"
          ? builderStatusCopy.versionConflict
          : builderFailureStatus(error, "archive"),
      );
    } finally {
      controller.abort();
      setArchiveArmed(false);
      setBusy(false);
    }
  };

  const exportBuild = async () => {
    if (!build || !isBuildExportReady(build) || dirty || busy) {
      return;
    }
    setBusy(true);
    setSaveState(builderStatusCopy.exporting);
    try {
      const blob = isLocalPreview
        ? new Blob(
            [
              `${JSON.stringify(portableBuildExport(build), null, 2)}
`,
            ],
            { type: "application/json" },
          )
        : await fetchBuildExport(currentWorkspace.id, build.id);
      downloadBlob(blob);
      setSaveState(builderStatusCopy.exported);
    } catch (error) {
      setSaveState(builderFailureStatus(error, "export"));
    } finally {
      setBusy(false);
    }
  };

  if (visibleLoadState === "loading") {
    return (
      <div className="page builder-page builder-page--state">
        <LoadingState
          label="正在載入組裝及產品目錄"
          labelEnglish="Loading builds and catalogue"
        />
      </div>
    );
  }

  if (visibleLoadState === "error") {
    return (
      <div className="page builder-page builder-page--state">
        <ErrorState
          title="無法載入組裝工具"
          titleEnglish="Unable to load the PC builder"
          onRetry={() => {
            setLoadState("loading");
            setLoadedWorkspaceId(null);
            setReloadToken((token) => token + 1);
          }}
        />
      </div>
    );
  }

  if (!build) {
    return (
      <div className="page builder-page builder-page--state">
        <EmptyState
          title="目前沒有組裝草稿"
          titleEnglish="No build drafts yet"
          message={
            canWrite
              ? "讀取空清單不會自動建立資料。按下方按鈕明確建立第一個工作空間組裝草稿。"
              : "你的角色可查看組裝，但目前工作空間尚未建立任何草稿。"
          }
          messageEnglish={
            canWrite
              ? "Reading an empty list does not create data. Use the button below to create the first workspace build draft explicitly."
              : "Your role can view builds, but this workspace does not have any drafts yet."
          }
        />
        {canWrite ? (
          <button
            className="button button--primary builder-empty-action"
            type="button"
            disabled={busy}
            onClick={() => void createNewBuild()}
          >
            <Plus aria-hidden="true" />
            建立新組裝草稿 <span lang="en">Create build draft</span>
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="builder-page">
      <BuilderCommandBar
        saveState={saveState}
        buildName={draftName}
        buildId={build.id}
        builds={builds}
        canWrite={canWrite}
        archiveArmed={archiveArmed}
        onBuildNameChange={changeBuildName}
        onBuildSelect={(buildId) => void selectBuild(buildId)}
        onCreateBuild={() => void createNewBuild()}
        onArchiveBuild={() => void archiveBuild()}
        onOpenInspector={() => setInspectorOpen(true)}
      />

      <main className="builder-main">
        <ComponentRail
          selected={selectedCategory}
          catalogueParts={catalogue}
          selectedParts={build.selectedParts}
          findings={build.findings}
          canWrite={canWrite}
          onSelect={setSelectedCategory}
          onChoosePart={choosePart}
        />
        <BuilderViewport
          selectedCategory={selectedCategory}
          camera={camera}
          setCamera={setCamera}
          displayMode={displayMode}
          setDisplayMode={setDisplayMode}
          selectedPart={selectedPart}
          workspaceId={currentWorkspace.id}
          isLocalPreview={isLocalPreview}
          localApprovedAssetId={localApprovedAssetId}
        />
        <aside className="desktop-inspector" aria-label="組裝檢查器">
          <BuildInspector part={selectedPart} findings={visibleFindings} />
        </aside>
      </main>

      <BuildStatusBar
        summary={build.summary}
        selectedCount={build.selectedParts.length}
        totalPriceMinor={build.totalPriceMinor}
        canSave={canWrite && dirty && draftName.trim().length > 0}
        canExport={isBuildExportReady(build) && !dirty}
        busy={busy}
        onSave={() => void saveBuild()}
        onExport={() => void exportBuild()}
      />

      {inspectorOpen ? (
        <div className="inspector-drawer-layer">
          <button
            className="inspector-drawer-backdrop"
            type="button"
            aria-label="關閉檢查器"
            onClick={() => setInspectorOpen(false)}
          />
          <aside className="inspector-drawer" aria-label="組裝檢查器">
            <div className="inspector-drawer__top">
              <strong>組裝檢查器</strong>
              <button
                className="icon-button"
                type="button"
                aria-label="關閉檢查器"
                onClick={() => setInspectorOpen(false)}
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <BuildInspector part={selectedPart} findings={visibleFindings} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
