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

import { useAssetReviewNavigation } from "../asset-review/asset-review-navigation";
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
  dashboardAssetReviewWorkCopy,
  dashboardBuildWorkCopy,
} from "../../shared/domain/dashboard-work-copy";
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
import {
  dashboardApprovedAssetCopy,
  dashboardAttentionBuildCopy,
  dashboardEvaluatedBuildCopy,
  dashboardInterfaceCopy,
  dashboardReadinessAriaCopy,
  dashboardReadinessNoteCopy,
  dashboardUsableCatalogueCopy,
  dashboardVerifiedCatalogueCopy,
  dashboardWorkCountCopy,
  relativeDashboardUpdateCopy,
  type DashboardBilingualCopy,
} from "./dashboard-copy";
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
  const assetWorkCopy = dashboardAssetReviewWorkCopy("in_review");
  const buildWorkCopy = dashboardBuildWorkCopy({
    errorCount: build.summary.errorCount,
    partCount: build.selectedParts.length,
    unknownCount: build.summary.unknownCount,
  });

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
        ...assetWorkCopy,
        title: `${reviewAsset.part.manufacturer} ${reviewAsset.part.model}`,
        detailZhHant: `${assetWorkCopy.detailZhHant} · 合成示範資料`,
        detailEnglish: `${assetWorkCopy.detailEnglish} · Synthetic demo data`,
        href: "/asset-review",
        targetAssetId: reviewAsset.id,
        updatedAt: "2026-07-26T05:00:00Z",
      },
      {
        ...buildWorkCopy,
        title: build.name,
        detailZhHant: `${build.selectedParts.length} 個組件 · 合成示範組裝`,
        detailEnglish: `${build.selectedParts.length} components · Synthetic demo build`,
        href: "/builder",
        targetAssetId: null,
        updatedAt: build.updatedAt,
      },
    ],
  });
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

function DashboardBilingualText({ copy }: { copy: DashboardBilingualCopy }) {
  return (
    <span className="dashboard-bilingual-copy">
      <span>{copy.zhHant}</span>
      <span lang="en">{copy.english}</span>
    </span>
  );
}

function bilingualTitle(copy: DashboardBilingualCopy): string {
  return `${copy.zhHant} / ${copy.english}`;
}

export function DashboardPage() {
  const { currentWorkspace } = useAuthenticatedSession();
  const { selectAssetReviewTarget } = useAssetReviewNavigation();
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
  const evaluatedLabel = dashboardEvaluatedBuildCopy(metrics);
  const verifiedCatalogueLabel = dashboardVerifiedCatalogueCopy(
    metrics.verifiedCatalogueCount,
  );
  const approvedAssetLabel = dashboardApprovedAssetCopy(
    metrics.approvedAssetCount,
  );
  const attentionBuildLabel = dashboardAttentionBuildCopy(
    metrics.attentionBuildCount,
  );
  const recentWorkCountLabel = dashboardWorkCountCopy(data.recentWork.length);
  const usableCatalogueLabel = dashboardUsableCatalogueCopy(
    metrics.catalogueReadyCount,
  );
  const readinessNote = dashboardReadinessNoteCopy(metrics);
  const readinessAria = dashboardReadinessAriaCopy(readiness);
  const recentWorkNeedsAttention = data.recentWork.some(
    (item) => item.tone === "danger" || item.tone === "warning",
  );

  return (
    <div className="page dashboard-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">
            {isLocalPreview ? (
              <DashboardBilingualText
                copy={dashboardInterfaceCopy.syntheticDemoData}
              />
            ) : (
              currentWorkspace.name
            )}
          </span>
          <h1>
            <DashboardBilingualText copy={dashboardInterfaceCopy.heading} />
          </h1>
          <p>
            <DashboardBilingualText
              copy={dashboardInterfaceCopy.introduction}
            />
          </p>
        </div>
        <div className="page-header__actions">
          <Link className="button button--secondary" to="/catalogue">
            <Plus aria-hidden="true" />
            <DashboardBilingualText
              copy={dashboardInterfaceCopy.addCatalogueProduct}
            />
          </Link>
          <Link className="button button--primary" to="/builder">
            <Wrench aria-hidden="true" />
            <DashboardBilingualText copy={dashboardInterfaceCopy.openBuilder} />
          </Link>
        </div>
      </header>

      <section
        className="dashboard-metrics"
        aria-label={bilingualTitle(dashboardInterfaceCopy.workspaceMetrics)}
      >
        <article>
          <Boxes aria-hidden="true" />
          <div>
            <DashboardBilingualText
              copy={dashboardInterfaceCopy.catalogueComponents}
            />
            <strong>{metrics.activeCatalogueCount}</strong>
            <small>
              <DashboardBilingualText copy={verifiedCatalogueLabel} />
            </small>
          </div>
        </article>
        <article>
          <Cuboid aria-hidden="true" />
          <div>
            <DashboardBilingualText
              copy={dashboardInterfaceCopy.pendingAssetReview}
            />
            <strong>{metrics.pendingAssetCount}</strong>
            <small>
              <DashboardBilingualText copy={approvedAssetLabel} />
            </small>
          </div>
        </article>
        <article>
          <CheckCircle2 aria-hidden="true" />
          <div>
            <DashboardBilingualText
              copy={dashboardInterfaceCopy.safeToExport}
            />
            <strong>{metrics.readyBuildCount}</strong>
            <small>
              <DashboardBilingualText copy={evaluatedLabel} />
            </small>
          </div>
        </article>
        <article>
          <Clock3 aria-hidden="true" />
          <div>
            <DashboardBilingualText copy={dashboardInterfaceCopy.buildDrafts} />
            <strong>{metrics.draftBuildCount}</strong>
            <small>
              <DashboardBilingualText copy={attentionBuildLabel} />
            </small>
          </div>
        </article>
      </section>

      <div className="dashboard-grid">
        <section className="work-queue">
          <div className="dashboard-section-heading">
            <div>
              <h2 className="section-title">
                <DashboardBilingualText
                  copy={dashboardInterfaceCopy.recentWork}
                />
              </h2>
              <p className="section-subtitle">
                <DashboardBilingualText
                  copy={dashboardInterfaceCopy.recentWorkSubtitle}
                />
              </p>
            </div>
            <StatusBadge
              tone={recentWorkNeedsAttention ? "warning" : "success"}
            >
              <DashboardBilingualText copy={recentWorkCountLabel} />
            </StatusBadge>
          </div>
          {data.recentWork.length > 0 ? (
            <div className="queue-list">
              {data.recentWork.map((item) => {
                const relativeUpdate = relativeDashboardUpdateCopy(
                  item.updatedAt,
                );
                return (
                  <Link
                    className="queue-row"
                    key={`${item.kind}-${item.title}-${item.updatedAt}`}
                    to={item.href}
                    onClick={(event) => {
                      if (
                        item.targetAssetId &&
                        event.button === 0 &&
                        !event.metaKey &&
                        !event.ctrlKey &&
                        !event.shiftKey &&
                        !event.altKey
                      ) {
                        selectAssetReviewTarget(
                          currentWorkspace.id,
                          item.targetAssetId,
                        );
                      }
                    }}
                  >
                    <span className="queue-row__icon">{workIcon(item)}</span>
                    <div>
                      <strong>{item.title}</strong>
                      <span className="queue-row__details">
                        <span>
                          {item.detailZhHant} · {relativeUpdate.zhHant}
                        </span>
                        <small lang="en">
                          {item.detailEnglish} · {relativeUpdate.english}
                        </small>
                      </span>
                    </div>
                    <StatusBadge tone={item.tone}>
                      <span className="queue-row__status-copy">
                        <span>{item.statusZhHant}</span>
                        <small lang="en">{item.statusEnglish}</small>
                      </span>
                    </StatusBadge>
                    <ArrowRight aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="目前沒有待辦工作"
              titleEnglish="No tasks need attention"
              message="新增目錄產品或建立組裝草稿後，最近工作會顯示在此。"
              messageEnglish="Recent work will appear here after you add catalogue products or create build drafts."
            />
          )}
          <Link className="text-link" to="/asset-review">
            <DashboardBilingualText
              copy={dashboardInterfaceCopy.openAssetReview}
            />
            <ArrowRight aria-hidden="true" />
          </Link>
        </section>

        <aside className="pilot-readiness">
          <div className="dashboard-section-heading">
            <div>
              <h2 className="section-title">
                <DashboardBilingualText
                  copy={dashboardInterfaceCopy.dataReadiness}
                />
              </h2>
              <p className="section-subtitle">
                <DashboardBilingualText
                  copy={dashboardInterfaceCopy.readinessSubtitle}
                />
              </p>
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
            aria-label={bilingualTitle(readinessAria)}
          >
            <span>{metrics.catalogueReadyCount}</span>
            <small>
              <DashboardBilingualText copy={usableCatalogueLabel} />
            </small>
          </div>
          <dl className="readiness-list">
            <div>
              <dt>
                <DashboardBilingualText
                  copy={dashboardInterfaceCopy.verifiedSpecifications}
                />
              </dt>
              <dd>
                {metrics.verifiedCatalogueCount} /{" "}
                {metrics.activeCatalogueCount}
              </dd>
            </div>
            <div>
              <dt>
                <DashboardBilingualText
                  copy={dashboardInterfaceCopy.approvedAssets}
                />
              </dt>
              <dd>
                {metrics.approvedAssetCount} / {metrics.activeCatalogueCount}
              </dd>
            </div>
            <div>
              <dt>
                <DashboardBilingualText
                  copy={dashboardInterfaceCopy.evaluatedBuilds}
                />
              </dt>
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
              <DashboardBilingualText copy={readinessNote} />
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
