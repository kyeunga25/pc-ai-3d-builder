import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock3,
  Cuboid,
  FileWarning,
  Plus,
  Wrench,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { useAuthenticatedSession } from "../auth/session-context";
import { isPublicDemoPath } from "../../shared/lib/demo-mode";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../shared/components/AsyncState";
import { StatusBadge } from "../../shared/components/StatusBadge";
import { composeBuildRecord } from "../../shared/domain/builds";
import {
  dashboardResponseSchema,
  type DashboardResponse,
  type DashboardWorkItem,
} from "../../shared/domain/dashboard";
import {
  catalogParts,
  currentBuild,
  reviewAsset,
} from "../../shared/domain/mockData";
import { fetchDashboard } from "./dashboard-api";
import "./dashboard.css";

function localDashboardFixture(): DashboardResponse {
  const build = composeBuildRecord({
    id: currentBuild.id,
    name: currentBuild.name,
    status: "draft",
    selectedParts: catalogParts.filter((part) =>
      currentBuild.selectedPartIds.includes(part.id),
    ),
    version: 0,
    updatedAt: "2026-07-26T04:00:00Z",
  });
  const catalogueReadyCount = catalogParts.filter(
    (part) =>
      part.specificationStatus === "verified" &&
      part.assetStatus === "approved",
  ).length;

  return dashboardResponseSchema.parse({
    metrics: {
      activeCatalogueCount: catalogParts.length,
      verifiedCatalogueCount: catalogParts.filter(
        (part) => part.specificationStatus === "verified",
      ).length,
      approvedAssetCount: catalogParts.filter(
        (part) => part.assetStatus === "approved",
      ).length,
      catalogueReadyCount,
      pendingAssetCount: 1,
      draftBuildCount: 1,
      evaluatedBuildCount: 1,
      readyBuildCount: 1,
      attentionBuildCount: 0,
    },
    recentWork: [
      {
        kind: "asset_review",
        title: `${reviewAsset.part.manufacturer} ${reviewAsset.part.model}`,
        detailZhHant: "3D 素材正在審核 · 合成示範資料",
        statusZhHant: "審核中",
        tone: "warning",
        href: `/asset-review?asset=${encodeURIComponent(reviewAsset.id)}`,
        updatedAt: "2026-07-26T05:00:00Z",
      },
      {
        kind: "build_ready",
        title: build.name,
        detailZhHant: `${build.selectedParts.length} 個組件 · 合成示範組裝`,
        statusZhHant: "可匯出",
        tone: "success",
        href: "/builder",
        updatedAt: build.updatedAt,
      },
    ],
  });
}

function relativeUpdate(value: string): string {
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) {
    return "最近更新";
  }
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) {
    return "剛剛";
  }
  if (minutes < 60) {
    return `${minutes} 分鐘前`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} 小時前`;
  }
  const days = Math.floor(hours / 24);
  return days <= 7 ? `${days} 日前` : "較早更新";
}

function workIcon(item: DashboardWorkItem) {
  if (item.kind === "asset_review") {
    return <FileWarning aria-hidden="true" />;
  }
  if (item.kind === "build_ready") {
    return <CheckCircle2 aria-hidden="true" />;
  }
  return <Cuboid aria-hidden="true" />;
}

const localFixture = localDashboardFixture();

export function DashboardPage() {
  const { currentWorkspace } = useAuthenticatedSession();
  const isLocalPreview = import.meta.env.DEV || isPublicDemoPath();
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<
    | { status: "loading"; data: null; workspaceId: string }
    | { status: "error"; data: null; workspaceId: string }
    | { status: "ready"; data: DashboardResponse; workspaceId: string }
  >(() =>
    isLocalPreview
      ? {
          status: "ready",
          data: localFixture,
          workspaceId: currentWorkspace.id,
        }
      : {
          status: "loading",
          data: null,
          workspaceId: currentWorkspace.id,
        },
  );

  useEffect(() => {
    if (isLocalPreview) {
      return;
    }
    const controller = new AbortController();
    void fetchDashboard(controller.signal, currentWorkspace.id)
      .then((data) => {
        setState({
          status: "ready",
          data,
          workspaceId: currentWorkspace.id,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({
            status: "error",
            data: null,
            workspaceId: currentWorkspace.id,
          });
        }
      });
    return () => controller.abort();
  }, [currentWorkspace.id, isLocalPreview, reloadToken]);

  const visibleState =
    state.workspaceId === currentWorkspace.id ? state.status : "loading";
  const data = state.status === "ready" ? state.data : null;
  const readiness = useMemo(() => {
    if (!data || data.metrics.activeCatalogueCount === 0) {
      return 0;
    }
    return Math.round(
      (data.metrics.catalogueReadyCount / data.metrics.activeCatalogueCount) *
        100,
    );
  }, [data]);

  if (visibleState === "loading" || !data) {
    if (visibleState === "error") {
      return (
        <div className="page dashboard-page dashboard-page--state">
          <ErrorState
            title="無法載入商戶儀表板"
            titleEnglish="Unable to load the merchant dashboard"
            onRetry={() => {
              setState({
                status: "loading",
                data: null,
                workspaceId: currentWorkspace.id,
              });
              setReloadToken((token) => token + 1);
            }}
          />
        </div>
      );
    }
    return (
      <div className="page dashboard-page dashboard-page--state">
        <LoadingState
          label="正在載入工作空間指標"
          labelEnglish="Loading workspace metrics"
        />
      </div>
    );
  }

  const metrics = data.metrics;
  const evaluatedLabel =
    metrics.evaluatedBuildCount === metrics.draftBuildCount
      ? `${metrics.readyBuildCount} 個草稿通過匯出閘門`
      : `最近 ${metrics.evaluatedBuildCount} 個草稿中有 ${metrics.readyBuildCount} 個通過`;
  const recentWorkNeedsAttention = data.recentWork.some(
    (item) => item.tone === "danger" || item.tone === "warning",
  );

  return (
    <div className="page dashboard-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">
            {isLocalPreview ? "合成示範資料" : currentWorkspace.name}
          </span>
          <h1>商戶儀表板</h1>
          <p>集中查看產品目錄準備度、待審工作及進行中的電腦組裝。</p>
        </div>
        <div className="page-header__actions">
          <Link className="button button--secondary" to="/catalogue">
            <Plus aria-hidden="true" />
            新增目錄產品
          </Link>
          <Link className="button button--primary" to="/builder">
            <Wrench aria-hidden="true" />
            開啟組裝工具
          </Link>
        </div>
      </header>

      <section className="dashboard-metrics" aria-label="工作空間即時指標">
        <article>
          <Boxes aria-hidden="true" />
          <div>
            <span>目錄組件</span>
            <strong>{metrics.activeCatalogueCount}</strong>
            <small>{metrics.verifiedCatalogueCount} 項規格已核實</small>
          </div>
        </article>
        <article>
          <Cuboid aria-hidden="true" />
          <div>
            <span>等待素材審核</span>
            <strong>{metrics.pendingAssetCount}</strong>
            <small>{metrics.approvedAssetCount} 項素材已核准</small>
          </div>
        </article>
        <article>
          <CheckCircle2 aria-hidden="true" />
          <div>
            <span>可安全匯出</span>
            <strong>{metrics.readyBuildCount}</strong>
            <small>{evaluatedLabel}</small>
          </div>
        </article>
        <article>
          <Clock3 aria-hidden="true" />
          <div>
            <span>組裝草稿</span>
            <strong>{metrics.draftBuildCount}</strong>
            <small>{metrics.attentionBuildCount} 個最近草稿需要處理</small>
          </div>
        </article>
      </section>

      <div className="dashboard-grid">
        <section className="work-queue">
          <div className="dashboard-section-heading">
            <div>
              <h2 className="section-title">最近工作</h2>
              <p className="section-subtitle">此工作空間需要處理的項目。</p>
            </div>
            <StatusBadge
              tone={recentWorkNeedsAttention ? "warning" : "success"}
            >
              {data.recentWork.length} 項
            </StatusBadge>
          </div>
          {data.recentWork.length > 0 ? (
            <div className="queue-list">
              {data.recentWork.map((item) => (
                <Link
                  className="queue-row"
                  key={`${item.kind}-${item.title}-${item.updatedAt}`}
                  to={item.href}
                >
                  <span className="queue-row__icon">{workIcon(item)}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <span>
                      {item.detailZhHant} · {relativeUpdate(item.updatedAt)}
                    </span>
                  </div>
                  <StatusBadge tone={item.tone}>
                    {item.statusZhHant}
                  </StatusBadge>
                  <ArrowRight aria-hidden="true" />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="目前沒有待辦工作"
              message="新增目錄產品或建立組裝草稿後，最近工作會顯示在此。"
            />
          )}
          <Link className="text-link" to="/asset-review">
            開啟 3D 素材審核工作室 <ArrowRight aria-hidden="true" />
          </Link>
        </section>

        <aside className="pilot-readiness">
          <div className="dashboard-section-heading">
            <div>
              <h2 className="section-title">資料準備度</h2>
              <p className="section-subtitle">規格已核實並有核准素材的比例。</p>
            </div>
            <span className="readiness-score">{readiness}%</span>
          </div>
          <div
            className="readiness-ring"
            style={
              {
                "--readiness-angle": `${readiness * 3.6}deg`,
              } as CSSProperties
            }
            aria-label={`目錄資料準備度百分之${readiness}`}
          >
            <span>{metrics.catalogueReadyCount}</span>
            <small>項可使用</small>
          </div>
          <dl className="readiness-list">
            <div>
              <dt>規格已核實</dt>
              <dd>
                {metrics.verifiedCatalogueCount} /{" "}
                {metrics.activeCatalogueCount}
              </dd>
            </div>
            <div>
              <dt>素材已核准</dt>
              <dd>
                {metrics.approvedAssetCount} / {metrics.activeCatalogueCount}
              </dd>
            </div>
            <div>
              <dt>最近評估組裝</dt>
              <dd>{metrics.evaluatedBuildCount}</dd>
            </div>
          </dl>
          <div
            className={`readiness-note${readiness === 100 ? " is-ready" : ""}`}
          >
            {readiness === 100 ? (
              <CheckCircle2 aria-hidden="true" />
            ) : (
              <FileWarning aria-hidden="true" />
            )}
            <span>
              {metrics.activeCatalogueCount === 0
                ? "先新增產品，再核實規格及完成素材審批。"
                : readiness === 100
                  ? "所有現行目錄項目均具備已核實規格及核准素材。"
                  : `尚有 ${metrics.activeCatalogueCount - metrics.catalogueReadyCount} 項目錄記錄需要補齊。`}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
