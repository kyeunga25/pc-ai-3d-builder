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

import { useAuthenticatedSession } from "../auth/session-context";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../shared/components/AsyncState";
import { StatusBadge } from "../../shared/components/StatusBadge";
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
import { categoryLabels } from "./catalogue-options";
import "./catalogue.css";

function stockLabel(status: CatalogPart["stockStatus"]) {
  switch (status) {
    case "in_stock":
      return { label: "有現貨", tone: "success" as const };
    case "low_stock":
      return { label: "少量現貨", tone: "warning" as const };
    case "out_of_stock":
      return { label: "暫時缺貨", tone: "danger" as const };
    case "unknown":
      return { label: "未確認", tone: "neutral" as const };
  }
}

function assetLabel(status: CatalogPart["assetStatus"]) {
  switch (status) {
    case "approved":
      return { label: "已核准", tone: "success" as const };
    case "needs_review":
      return { label: "待審核", tone: "warning" as const };
    case "draft":
      return { label: "草稿", tone: "info" as const };
    case "proxy":
      return { label: "替代模型", tone: "neutral" as const };
  }
}

function assetQualityLabel(quality: CatalogPart["assetQuality"]) {
  switch (quality) {
    case "unreviewed":
      return "尚未評級";
    case "draft":
      return "草稿品質";
    case "reviewed":
      return "已審核品質";
    case "approved":
      return "已核准品質";
  }
}

export function CataloguePage() {
  const { currentWorkspace } = useAuthenticatedSession();
  const isLocalPreview = import.meta.env.DEV;
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
  const [notice, setNotice] = useState(() =>
    isLocalPreview
      ? `${catalogParts.length} 件產品 · 合成示範資料`
      : "正在讀取工作空間目錄",
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
        setNotice(`${page.items.length} 件工作空間產品`);
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
      setNotice(`${parts.length + page.items.length} 件工作空間產品`);
    } catch {
      if (requestGeneration === requestGenerationRef.current) {
        setNotice("未能載入更多產品；現有資料未有變更");
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
        throw new Error("產品更新沒有回傳有效資料。");
      }
      setParts((current) =>
        current.map((part) => (part.id === updated.id ? updated : part)),
      );
      setNotice(`已更新 ${updated.sku}`);
    } else {
      const created = isLocalPreview
        ? {
            id: `part_local_${crypto.randomUUID()}`,
            ...input,
            assetQuality: "unreviewed" as const,
            assetStatus: "proxy" as const,
            verified: input.specificationStatus === "verified",
            version: 0,
          }
        : await createCataloguePart(currentWorkspace.id, input);
      setParts((current) => [...current, created]);
      setNotice(`已新增 ${created.sku}`);
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
    setNotice(`已封存 ${editorPart.sku}`);
    setEditorState(undefined);
  };

  const importCsvFile = async (file: File) => {
    if (file.size > 256 * 1024) {
      throw new Error("CSV 檔案不可超過 256 KiB。");
    }

    if (isLocalPreview) {
      const inputs = parseCatalogueCsvFile(await file.text());
      const existingSkus = new Set(parts.map((part) => part.sku.toLowerCase()));
      if (inputs.some((input) => existingSkus.has(input.sku.toLowerCase()))) {
        throw new Error("目前目錄已經存在 CSV 內的其中一個 SKU。");
      }

      const created = inputs.map((input) => ({
        id: `part_local_${crypto.randomUUID()}`,
        ...input,
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
    setNotice("正在驗證 CSV 及工作空間資料");
    try {
      const createdCount = await importCsvFile(file);
      setNotice(`已匯入 ${createdCount} 件產品`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "無法匯入 CSV 檔案。");
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
    setNotice("已下載不含真實資料的 CSV 範本");
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
          <span className="eyebrow">工作空間資料 · 人手核實狀態</span>
          <h1>產品目錄</h1>
          <p>在組件加入組裝方案前，先檢查庫存、規格及經人工核准的 3D 素材。</p>
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
            onClick={downloadCsvTemplate}
          >
            <FileDown aria-hidden="true" />
            CSV 範本
          </button>
          <button
            className="button button--secondary"
            type="button"
            disabled={!canWrite || importing}
            title={canWrite ? "匯入最多 50 項產品" : "目前角色只可查看產品目錄"}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload aria-hidden="true" />
            {importing ? "正在匯入…" : "匯入 CSV"}
          </button>
          <button
            className="button button--primary"
            type="button"
            disabled={!canWrite}
            title={canWrite ? "新增工作空間產品" : "目前角色只可查看產品目錄"}
            onClick={() =>
              setEditorState({
                workspaceId: currentWorkspace.id,
                part: null,
              })
            }
          >
            <Plus aria-hidden="true" />
            新增產品
          </button>
        </div>
      </header>

      {visibleLoadState === "loading" ? (
        <LoadingState label="正在載入工作空間產品目錄" />
      ) : visibleLoadState === "error" ? (
        <ErrorState title="無法載入工作空間產品目錄" onRetry={retryCatalogue} />
      ) : (
        <>
          <section className="catalogue-toolbar" aria-label="產品目錄篩選器">
            <label className="search-control">
              <Search aria-hidden="true" />
              <span className="sr-only">搜尋產品目錄</span>
              <input
                ref={searchInputRef}
                type="search"
                placeholder="搜尋 SKU、品牌或型號"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <kbd>⌘ K</kbd>
            </label>
            <label className="select-control">
              <ListFilter aria-hidden="true" />
              <span className="sr-only">組件分類</span>
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as ComponentCategory | "all")
                }
              >
                <option value="all">所有分類</option>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" />
            </label>
            <button
              className="button catalogue-filter-button"
              type="button"
              aria-pressed={verifiedOnly}
              onClick={() => setVerifiedOnly((current) => !current)}
            >
              <Filter aria-hidden="true" />
              {verifiedOnly ? "顯示全部規格" : "只顯示已核實"}
            </button>
            <span className="catalogue-toolbar__notice" aria-live="polite">
              {notice}
            </span>
          </section>

          {filteredParts.length === 0 ? (
            <EmptyState
              title={
                parts.length === 0 ? "產品目錄仍是空白" : "找不到相符的目錄組件"
              }
              message={
                parts.length === 0
                  ? "使用「新增產品」或 CSV 匯入，建立這個工作空間的第一項產品。"
                  : "請嘗試其他 SKU、品牌或組件分類。"
              }
            />
          ) : (
            <section className="catalogue-table" aria-label="產品目錄結果">
              <div className="catalogue-table__head">
                <span>產品</span>
                <span>分類</span>
                <span>庫存</span>
                <span>3D 素材</span>
                <span>售價</span>
                <span aria-hidden="true" />
              </div>
              {filteredParts.map((part) => {
                const stock = stockLabel(part.stockStatus);
                const asset = assetLabel(part.assetStatus);

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
                      {categoryLabels[part.category]}
                    </span>
                    <div className="catalogue-row__stock">
                      <StatusBadge tone={stock.tone}>{stock.label}</StatusBadge>
                      <small>
                        {part.stockCount === null
                          ? "數量尚未核實"
                          : `${part.stockCount} 件`}
                      </small>
                    </div>
                    <div className="catalogue-row__asset">
                      <StatusBadge tone={asset.tone}>{asset.label}</StatusBadge>
                      <small>{assetQualityLabel(part.assetQuality)}</small>
                    </div>
                    <strong className="catalogue-row__price">
                      {formatHkd(part.priceMinor)}
                    </strong>
                    <button
                      className="catalogue-row__action"
                      type="button"
                      aria-label={`查看 ${part.manufacturer} ${part.model}`}
                      onClick={() =>
                        setEditorState({
                          workspaceId: currentWorkspace.id,
                          part,
                        })
                      }
                    >
                      查看
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
                    {loadingMore ? "正在載入…" : "載入更多產品"}
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
        />
      ) : null}
    </div>
  );
}
