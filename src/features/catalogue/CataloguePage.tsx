import {
  Box,
  ChevronDown,
  Filter,
  ListFilter,
  Plus,
  Search,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAuthenticatedSession } from "../auth/session-context";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../shared/components/AsyncState";
import { StatusBadge } from "../../shared/components/StatusBadge";
import { catalogParts } from "../../shared/domain/mockData";
import type {
  CatalogPart,
  ComponentCategory,
} from "../../shared/domain/schemas";
import { formatHkd } from "../../shared/i18n/locale";
import { fetchCataloguePage } from "./catalogue-api";
import "./catalogue.css";

const categoryLabels: Record<ComponentCategory, string> = {
  case: "機箱",
  motherboard: "主機板",
  cpu: "處理器（CPU）",
  gpu: "顯示卡（GPU）",
  memory: "記憶體",
  cooling: "散熱器",
  storage: "儲存裝置",
  psu: "電源供應器（PSU）",
  fans: "風扇",
};

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
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ComponentCategory | "all">("all");
  const [parts, setParts] = useState<CatalogPart[]>(() =>
    isLocalPreview ? catalogParts : [],
  );
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"error" | "loading" | "ready">(
    isLocalPreview ? "ready" : "loading",
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const loadMoreControllerRef = useRef<AbortController | null>(null);
  const requestGenerationRef = useRef(0);
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

  const filteredParts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return parts.filter((part) => {
      const matchesCategory = category === "all" || part.category === category;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        `${part.manufacturer} ${part.model} ${part.sku}`
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [category, parts, query]);
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
          <button
            className="button button--secondary"
            type="button"
            disabled
            title="目錄寫入流程尚未啟用"
          >
            <Upload aria-hidden="true" />
            匯入 CSV
          </button>
          <button
            className="button button--primary"
            type="button"
            disabled
            title="目錄寫入流程尚未啟用"
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
              disabled
              title="進階篩選尚未啟用"
            >
              <Filter aria-hidden="true" />
              更多篩選
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
                  ? "這個工作空間尚未加入產品；目錄寫入流程會在後續階段啟用。"
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
                      onClick={() => setNotice(`已選擇 ${part.sku} 供查看`)}
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
    </div>
  );
}
