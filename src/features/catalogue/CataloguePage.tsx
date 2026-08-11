import {
  Box,
  ChevronDown,
  FileDown,
  Filter,
  ListFilter,
  Plus,
  Search,
  Upload,
} from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { createAssetFromSource } from "../asset-review/asset-review-api";
import { useAssetReviewNavigation } from "../asset-review/asset-review-navigation";
import { useAuthenticatedSession } from "../auth/session-context";
import { isPublicDemoPath } from "../../shared/lib/demo-mode";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../shared/components/AsyncState";
import { StatusBadge } from "../../shared/components/StatusBadge";
import {
  AssetFileValidationError,
  assetFileLimits,
  validateAssetFileBytes,
} from "../../shared/domain/asset-files";
import type { AssetReviewItem } from "../../shared/domain/assets";
import {
  catalogueCsvTemplate,
  parseCatalogueCsvFile,
} from "../../shared/domain/catalogue-csv";
import { catalogParts } from "../../shared/domain/mockData";
import type {
  CataloguePartInput,
  CatalogPart,
  ComponentCategory,
} from "../../shared/domain/schemas";
import { formatHkd } from "../../shared/i18n/locale";
import {
  createCataloguePart,
  fetchCataloguePage,
  importCatalogueCsv,
  mutateCataloguePart,
} from "./catalogue-api";
import { CatalogueEditorDialog } from "./CatalogueEditorDialog";
import {
  bilingualCataloguePageTitle,
  catalogueAssetQualityCopy,
  catalogueAssetStatusPresentation,
  catalogueCategoryCopy,
  catalogueLoadMoreCopy,
  cataloguePageCopy,
  catalogueStockCountCopy,
  catalogueStockStatusPresentation,
  catalogueVerifiedFilterCopy,
  catalogueViewProductTitle,
  type CataloguePageCopy,
} from "./catalogue-page-copy";
import {
  catalogueArchivedStatus,
  catalogueCountStatus,
  catalogueCreatedStatus,
  catalogueFailureStatus,
  catalogueImportedStatus,
  catalogueStatusCopy,
  catalogueUpdatedStatus,
  type CatalogueOperationStatus,
} from "./catalogue-status";
import { CatalogueStatusView } from "./CatalogueStatusView";
import "./catalogue.css";

function CatalogueCopy({ copy }: { copy: CataloguePageCopy }) {
  return (
    <span className="catalogue-page-copy">
      <span>{copy.zhHant}</span>
      <span lang="en">{copy.english}</span>
    </span>
  );
}

export function CataloguePage() {
  const { currentWorkspace } = useAuthenticatedSession();
  const { selectAssetReviewTarget } = useAssetReviewNavigation();
  const navigate = useNavigate();
  const isLocalPreview = import.meta.env.DEV || isPublicDemoPath();
  const canWrite = currentWorkspace.role !== "viewer";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ComponentCategory | "all">("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [editorState, setEditorState] = useState<
    { workspaceId: string; part: CatalogPart | null } | undefined
  >();
  const editorPart =
    editorState?.workspaceId === currentWorkspace.id
      ? editorState.part
      : undefined;
  const editorAssetId = editorPart?.assetId ?? null;
  const [importing, setImporting] = useState(false);
  const [parts, setParts] = useState<CatalogPart[]>(() =>
    isLocalPreview ? catalogParts : [],
  );
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"error" | "loading" | "ready">(
    isLocalPreview ? "ready" : "loading",
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadMoreControllerRef = useRef<AbortController | null>(null);
  const requestGenerationRef = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [loadedWorkspaceId, setLoadedWorkspaceId] = useState<string | null>(
    isLocalPreview ? currentWorkspace.id : null,
  );
  const [notice, setNotice] = useState<CatalogueOperationStatus>(() =>
    isLocalPreview
      ? catalogueCountStatus(catalogParts.length, true)
      : catalogueStatusCopy.loading,
  );

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    if (isLocalPreview) {
      return;
    }

    const controller = new AbortController();
    const requestGeneration = ++requestGenerationRef.current;
    loadMoreControllerRef.current?.abort();

    void fetchCataloguePage(controller.signal, currentWorkspace.id)
      .then((page) => {
        if (requestGeneration !== requestGenerationRef.current) {
          return;
        }
        setParts(page.items);
        setNextCursor(page.nextCursor);
        setNotice(catalogueCountStatus(page.items.length, false));
        setLoadedWorkspaceId(currentWorkspace.id);
        setLoadState("ready");
      })
      .catch(() => {
        if (
          !controller.signal.aborted &&
          requestGeneration === requestGenerationRef.current
        ) {
          setLoadedWorkspaceId(currentWorkspace.id);
          setLoadState("error");
        }
      });

    return () => controller.abort();
  }, [currentWorkspace.id, isLocalPreview, reloadToken]);

  const retryCatalogue = () => {
    requestGenerationRef.current += 1;
    loadMoreControllerRef.current?.abort();
    setLoadState("loading");
    setParts([]);
    setNextCursor(null);
    setLoadedWorkspaceId(null);
    setReloadToken((token) => token + 1);
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMoreRef.current) {
      return;
    }

    const controller = new AbortController();
    const requestGeneration = requestGenerationRef.current;
    loadingMoreRef.current = true;
    loadMoreControllerRef.current = controller;
    setLoadingMore(true);
    setNotice(catalogueStatusCopy.loadingMore);

    try {
      const page = await fetchCataloguePage(
        controller.signal,
        currentWorkspace.id,
        nextCursor,
      );
      if (requestGeneration !== requestGenerationRef.current) {
        return;
      }
      setParts((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
      setNotice(catalogueCountStatus(parts.length + page.items.length, false));
    } catch {
      if (
        !controller.signal.aborted &&
        requestGeneration === requestGenerationRef.current
      ) {
        setNotice(catalogueStatusCopy.loadMoreFailed);
      }
    } finally {
      loadingMoreRef.current = false;
      if (loadMoreControllerRef.current === controller) {
        loadMoreControllerRef.current = null;
      }
      setLoadingMore(false);
    }
  };

  const savePart = async (input: CataloguePartInput) => {
    if (editorPart) {
      const updated = isLocalPreview
        ? {
            ...editorPart,
            ...input,
            assetQuality: editorPart.assetQuality,
            assetStatus: editorPart.assetStatus,
            verified: input.specificationStatus === "verified",
            version: editorPart.version + 1,
          }
        : await mutateCataloguePart(currentWorkspace.id, editorPart.id, {
            action: "update",
            expectedVersion: editorPart.version,
            ...input,
          });
      if (!updated) {
        throw new Error(
          "產品更新沒有回傳有效資料。 / The product update did not return valid data.",
        );
      }
      setParts((current) =>
        current.map((part) => (part.id === updated.id ? updated : part)),
      );
      setNotice(catalogueUpdatedStatus(updated.sku));
    } else {
      const created = isLocalPreview
        ? {
            id: `part_local_${crypto.randomUUID()}`,
            ...input,
            catalogueStatus: "active" as const,
            assetId: null,
            assetQuality: "unreviewed" as const,
            assetStatus: "proxy" as const,
            verified: input.specificationStatus === "verified",
            version: 0,
          }
        : await createCataloguePart(currentWorkspace.id, input);
      setParts((current) => [...current, created]);
      setNotice(catalogueCreatedStatus(created.sku));
    }
    setEditorState(undefined);
  };

  const archivePart = async () => {
    if (!editorPart) {
      return;
    }
    if (!isLocalPreview) {
      await mutateCataloguePart(currentWorkspace.id, editorPart.id, {
        action: "archive",
        expectedVersion: editorPart.version,
      });
    }
    setParts((current) => current.filter((part) => part.id !== editorPart.id));
    setNotice(catalogueArchivedStatus(editorPart.sku));
    setEditorState(undefined);
  };

  const createAssetDraft = async (file: File) => {
    if (!editorPart) {
      throw new Error(
        "請先儲存產品，然後再建立素材草稿。 / Save the product before creating an asset draft.",
      );
    }
    if (file.size > assetFileLimits.source) {
      throw new AssetFileValidationError(
        "來源圖片必須小於或等於 10 MiB。 / The source image must be 10 MiB or smaller.",
      );
    }
    const contentType = validateAssetFileBytes(
      "source",
      file.type,
      new Uint8Array(await file.arrayBuffer()),
    );

    let asset: AssetReviewItem;
    let sourceUrl: string | undefined;
    if (isLocalPreview) {
      sourceUrl = URL.createObjectURL(file);
      asset = {
        id: `asset_local_${crypto.randomUUID()}`,
        part: {
          id: editorPart.id,
          sku: editorPart.sku,
          manufacturer: editorPart.manufacturer,
          model: editorPart.model,
        },
        status: "draft",
        quality: "unreviewed",
        sourceKind: "uploaded",
        completedChecks: [],
        sourceRightsConfirmed: false,
        files: {
          source: { contentType, sizeBytes: file.size },
          model: null,
        },
        dimensionsMm: { width: null, height: null, depth: null },
        version: 0,
      };
    } else {
      asset = await createAssetFromSource(
        currentWorkspace.id,
        editorPart.id,
        file,
      );
    }

    setParts((current) =>
      current.map((part) =>
        part.id === editorPart.id
          ? {
              ...part,
              assetId: asset.id,
              assetQuality: asset.quality,
              assetStatus: "draft",
            }
          : part,
      ),
    );
    setEditorState(undefined);
    selectAssetReviewTarget(currentWorkspace.id, asset.id);
    void navigate("/asset-review", {
      state: isLocalPreview ? { localAsset: asset, sourceUrl } : undefined,
    });
  };

  const importCsvFile = async (file: File) => {
    if (file.size > 256 * 1024) {
      throw new Error(
        "CSV 檔案不可超過 256 KiB。 / The CSV file must be 256 KiB or smaller.",
      );
    }

    if (isLocalPreview) {
      const inputs = parseCatalogueCsvFile(await file.text());
      const existingSkus = new Set(parts.map((part) => part.sku.toLowerCase()));
      if (inputs.some((input) => existingSkus.has(input.sku.toLowerCase()))) {
        throw new Error(
          "目前目錄已經存在 CSV 內的其中一個 SKU。 / The current catalogue already contains a SKU from the CSV file.",
        );
      }

      const created = inputs.map((input) => ({
        id: `part_local_${crypto.randomUUID()}`,
        ...input,
        catalogueStatus: "active" as const,
        assetId: null,
        assetQuality: "unreviewed" as const,
        assetStatus: "proxy" as const,
        verified: input.specificationStatus === "verified",
        version: 0,
      }));
      setParts((current) => [...current, ...created]);
      return created.length;
    }

    const response = await importCatalogueCsv(currentWorkspace.id, file);
    setParts((current) => [...current, ...response.created]);
    return response.created.length;
  };

  const handleCsvSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const inputElement = event.currentTarget;
    const file = inputElement.files?.[0];
    if (!file) {
      return;
    }

    setImporting(true);
    setNotice(catalogueStatusCopy.validatingImport);
    try {
      const createdCount = await importCsvFile(file);
      setNotice(catalogueImportedStatus(createdCount));
    } catch (error) {
      setNotice(catalogueFailureStatus(error, "import"));
    } finally {
      inputElement.value = "";
      setImporting(false);
    }
  };

  const downloadCsvTemplate = () => {
    const blob = new Blob([`${catalogueCsvTemplate}\n`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rigstage-catalogue-template.csv";
    link.click();
    URL.revokeObjectURL(url);
    setNotice(catalogueStatusCopy.templateDownloadStarted);
  };

  const filteredParts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return parts.filter((part) => {
      const matchesCategory = category === "all" || part.category === category;
      const matchesVerification = !verifiedOnly || part.verified;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        `${part.manufacturer} ${part.model} ${part.sku}`
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesCategory && matchesVerification && matchesQuery;
    });
  }, [category, parts, query, verifiedOnly]);
  const visibleLoadState =
    loadedWorkspaceId === currentWorkspace.id ? loadState : "loading";

  return (
    <div className="page catalogue-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">
            <CatalogueCopy copy={cataloguePageCopy.pageEyebrow} />
          </span>
          <h1>
            <CatalogueCopy copy={cataloguePageCopy.pageTitle} />
          </h1>
          <p>
            <CatalogueCopy copy={cataloguePageCopy.pageSummary} />
          </p>
        </div>
        <div className="page-header__actions">
          <input
            ref={fileInputRef}
            hidden
            type="file"
            accept=".csv,text/csv"
            disabled={!canWrite || importing}
            onChange={(event) => void handleCsvSelection(event)}
          />
          <button
            className="button button--secondary"
            type="button"
            aria-label={bilingualCataloguePageTitle(cataloguePageCopy.template)}
            onClick={downloadCsvTemplate}
          >
            <FileDown aria-hidden="true" />
            <CatalogueCopy copy={cataloguePageCopy.template} />
          </button>
          <button
            className="button button--secondary"
            type="button"
            aria-label={bilingualCataloguePageTitle(
              importing
                ? cataloguePageCopy.importing
                : cataloguePageCopy.importCsv,
            )}
            disabled={!canWrite || importing}
            title={bilingualCataloguePageTitle(
              canWrite
                ? cataloguePageCopy.importTitle
                : cataloguePageCopy.viewerOnlyTitle,
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload aria-hidden="true" />
            <CatalogueCopy
              copy={
                importing
                  ? cataloguePageCopy.importing
                  : cataloguePageCopy.importCsv
              }
            />
          </button>
          <button
            className="button button--primary"
            type="button"
            aria-label={bilingualCataloguePageTitle(
              cataloguePageCopy.addProduct,
            )}
            disabled={!canWrite}
            title={bilingualCataloguePageTitle(
              canWrite
                ? cataloguePageCopy.addProductTitle
                : cataloguePageCopy.viewerOnlyTitle,
            )}
            onClick={() =>
              setEditorState({
                workspaceId: currentWorkspace.id,
                part: null,
              })
            }
          >
            <Plus aria-hidden="true" />
            <CatalogueCopy copy={cataloguePageCopy.addProduct} />
          </button>
        </div>
      </header>

      {visibleLoadState === "loading" ? (
        <LoadingState
          label={cataloguePageCopy.loadingLabel.zhHant}
          labelEnglish={cataloguePageCopy.loadingLabel.english}
        />
      ) : visibleLoadState === "error" ? (
        <ErrorState
          title={cataloguePageCopy.errorTitle.zhHant}
          titleEnglish={cataloguePageCopy.errorTitle.english}
          onRetry={retryCatalogue}
        />
      ) : (
        <>
          <section
            className="catalogue-toolbar"
            aria-label={bilingualCataloguePageTitle(
              cataloguePageCopy.toolbarLabel,
            )}
          >
            <label className="search-control">
              <Search aria-hidden="true" />
              <span className="sr-only">
                {bilingualCataloguePageTitle(cataloguePageCopy.searchLabel)}
              </span>
              <input
                ref={searchInputRef}
                type="search"
                placeholder={bilingualCataloguePageTitle(
                  cataloguePageCopy.searchPlaceholder,
                )}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <kbd>⌘ K</kbd>
            </label>
            <label className="select-control">
              <ListFilter aria-hidden="true" />
              <span className="sr-only">
                {bilingualCataloguePageTitle(
                  cataloguePageCopy.categoryFilterLabel,
                )}
              </span>
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as ComponentCategory | "all")
                }
              >
                <option value="all">
                  {bilingualCataloguePageTitle(cataloguePageCopy.allCategories)}
                </option>
                {Object.entries(catalogueCategoryCopy).map(([value, copy]) => (
                  <option key={value} value={value}>
                    {bilingualCataloguePageTitle(copy)}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" />
            </label>
            <button
              className="button catalogue-filter-button"
              type="button"
              aria-pressed={verifiedOnly}
              aria-label={bilingualCataloguePageTitle(
                catalogueVerifiedFilterCopy(verifiedOnly),
              )}
              onClick={() => setVerifiedOnly((current) => !current)}
            >
              <Filter aria-hidden="true" />
              <CatalogueCopy copy={catalogueVerifiedFilterCopy(verifiedOnly)} />
            </button>
            <CatalogueStatusView
              className="catalogue-toolbar__notice"
              status={notice}
            />
          </section>

          {filteredParts.length === 0 ? (
            <EmptyState
              title={
                parts.length === 0
                  ? cataloguePageCopy.emptyCatalogueTitle.zhHant
                  : cataloguePageCopy.noMatchesTitle.zhHant
              }
              titleEnglish={
                parts.length === 0
                  ? cataloguePageCopy.emptyCatalogueTitle.english
                  : cataloguePageCopy.noMatchesTitle.english
              }
              message={
                parts.length === 0
                  ? cataloguePageCopy.emptyCatalogueMessage.zhHant
                  : cataloguePageCopy.noMatchesMessage.zhHant
              }
              messageEnglish={
                parts.length === 0
                  ? cataloguePageCopy.emptyCatalogueMessage.english
                  : cataloguePageCopy.noMatchesMessage.english
              }
            />
          ) : (
            <section
              className="catalogue-table"
              aria-label={bilingualCataloguePageTitle(
                cataloguePageCopy.resultsLabel,
              )}
            >
              <div className="catalogue-table__head">
                <CatalogueCopy copy={cataloguePageCopy.productColumn} />
                <CatalogueCopy copy={cataloguePageCopy.categoryColumn} />
                <CatalogueCopy copy={cataloguePageCopy.stockColumn} />
                <CatalogueCopy copy={cataloguePageCopy.assetColumn} />
                <CatalogueCopy copy={cataloguePageCopy.priceColumn} />
                <CatalogueCopy copy={cataloguePageCopy.actionsColumn} />
              </div>
              {filteredParts.map((part) => {
                const stock =
                  catalogueStockStatusPresentation[part.stockStatus];
                const asset =
                  catalogueAssetStatusPresentation[part.assetStatus];

                return (
                  <article className="catalogue-row" key={part.id}>
                    <span className="part-thumbnail" aria-hidden="true">
                      <Box />
                    </span>
                    <div className="catalogue-row__product">
                      <strong>
                        {part.manufacturer} {part.model}
                      </strong>
                      <span className="mono">{part.sku}</span>
                    </div>
                    <span className="catalogue-row__category">
                      <CatalogueCopy
                        copy={catalogueCategoryCopy[part.category]}
                      />
                    </span>
                    <div className="catalogue-row__stock">
                      <StatusBadge tone={stock.tone}>
                        <CatalogueCopy copy={stock.copy} />
                      </StatusBadge>
                      <small>
                        <CatalogueCopy
                          copy={catalogueStockCountCopy(part.stockCount)}
                        />
                      </small>
                    </div>
                    <div className="catalogue-row__asset">
                      <StatusBadge tone={asset.tone}>
                        <CatalogueCopy copy={asset.copy} />
                      </StatusBadge>
                      <small>
                        <CatalogueCopy
                          copy={catalogueAssetQualityCopy[part.assetQuality]}
                        />
                      </small>
                    </div>
                    <strong className="catalogue-row__price">
                      {formatHkd(part.priceMinor)}
                    </strong>
                    <button
                      className="catalogue-row__action"
                      type="button"
                      aria-label={catalogueViewProductTitle(
                        part.manufacturer,
                        part.model,
                      )}
                      onClick={() =>
                        setEditorState({
                          workspaceId: currentWorkspace.id,
                          part,
                        })
                      }
                    >
                      <CatalogueCopy copy={cataloguePageCopy.view} />
                    </button>
                  </article>
                );
              })}
              {nextCursor ? (
                <div className="catalogue-table__more">
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={loadingMore}
                    onClick={() => void loadMore()}
                  >
                    <CatalogueCopy copy={catalogueLoadMoreCopy(loadingMore)} />
                  </button>
                </div>
              ) : null}
            </section>
          )}
        </>
      )}
      {editorPart !== undefined ? (
        <CatalogueEditorDialog
          part={editorPart}
          readOnly={!canWrite}
          onClose={() => setEditorState(undefined)}
          onSave={savePart}
          onArchive={editorPart ? archivePart : undefined}
          onCreateAssetFromSource={
            editorPart && editorPart.assetId === null
              ? createAssetDraft
              : undefined
          }
          onOpenAssetReview={
            editorAssetId
              ? () => {
                  setEditorState(undefined);
                  selectAssetReviewTarget(currentWorkspace.id, editorAssetId);
                  void navigate("/asset-review");
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
