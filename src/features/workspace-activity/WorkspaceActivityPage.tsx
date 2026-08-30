import {
  Clock3,
  Info,
  LoaderCircle,
  RefreshCw,
  ScrollText,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAuthenticatedSession } from "../auth/session-context";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../shared/components/AsyncState";
import { StatusBadge } from "../../shared/components/StatusBadge";
import {
  workspaceActivityResponseSchema,
  type WorkspaceActivityCategory,
  type WorkspaceActivityItem,
  type WorkspaceActivityResponse,
} from "../../shared/domain/workspace-activity";
import { isPublicDemoPath } from "../../shared/lib/demo-mode";
import { fetchWorkspaceActivityPage } from "./workspace-activity-api";
import {
  workspaceActivityActionCopy,
  workspaceActivityCategoryCopy,
  workspaceActivityFailureNotice,
  workspaceActivityInterfaceCopy,
  workspaceActivityNoticeCopy,
  workspaceActivityTimeCopy,
  type WorkspaceActivityBilingualCopy,
  type WorkspaceActivityNotice,
} from "./workspace-activity-copy";
import "./workspace-activity.css";

type ActivityState =
  | { status: "loading"; workspaceId: string; data: null }
  | { status: "error"; workspaceId: string; data: null }
  | {
      status: "ready";
      workspaceId: string;
      data: WorkspaceActivityResponse;
    };

type ActivityFilter = WorkspaceActivityCategory | "all";

const filters: readonly ActivityFilter[] = [
  "all",
  "access",
  "catalogue",
  "asset",
  "build",
  "generation",
  "other",
];

function BilingualText({ copy }: { copy: WorkspaceActivityBilingualCopy }) {
  return (
    <span className="workspace-activity-copy">
      <span>{copy.zhHant}</span>
      <span lang="en">{copy.english}</span>
    </span>
  );
}

function bilingualLabel(copy: WorkspaceActivityBilingualCopy): string {
  return `${copy.zhHant} / ${copy.english}`;
}

function localActivity(displayName: string): WorkspaceActivityResponse {
  return workspaceActivityResponseSchema.parse({
    nextCursor: null,
    items: [
      {
        action: "workspace.member.invite",
        category: "access",
        actorDisplayName: displayName,
        createdAt: "2026-08-30 05:10:00",
      },
      {
        action: "catalogue.part.update",
        category: "catalogue",
        actorDisplayName: "合成營運員",
        createdAt: "2026-08-30 04:45:00",
      },
      {
        action: "asset.file.model.upload",
        category: "asset",
        actorDisplayName: "合成營運員",
        createdAt: "2026-08-30 04:20:00",
      },
      {
        action: "asset.review.approve",
        category: "asset",
        actorDisplayName: displayName,
        createdAt: "2026-08-30 03:50:00",
      },
      {
        action: "build.create",
        category: "build",
        actorDisplayName: "Synthetic Builder",
        createdAt: "2026-08-30 03:15:00",
      },
      {
        action: "generation.draft.ready",
        category: "generation",
        actorDisplayName: null,
        createdAt: "2026-08-30 02:30:00",
      },
    ],
  });
}

function ActivityNotice({ notice }: { notice: WorkspaceActivityNotice }) {
  return (
    <section
      className={`workspace-activity-notice is-${notice.tone}`}
      role={notice.tone === "error" ? "alert" : "status"}
      aria-atomic="true"
    >
      {notice.tone === "error" ? (
        <ShieldAlert aria-hidden="true" />
      ) : (
        <Info aria-hidden="true" />
      )}
      <BilingualText copy={notice.copy} />
    </section>
  );
}

function categoryTone(
  category: WorkspaceActivityCategory,
): "info" | "neutral" | "success" | "warning" {
  if (category === "access" || category === "asset") return "info";
  if (category === "build") return "success";
  if (category === "catalogue" || category === "generation") return "warning";
  return "neutral";
}

function ActivityCard({ item }: { item: WorkspaceActivityItem }) {
  const time = workspaceActivityTimeCopy(item.createdAt);
  return (
    <article className="workspace-activity-card">
      <span className="workspace-activity-card__marker" aria-hidden="true" />
      <div className="workspace-activity-card__body">
        <header>
          <h3>
            <BilingualText copy={workspaceActivityActionCopy[item.action]} />
          </h3>
          <StatusBadge tone={categoryTone(item.category)}>
            <BilingualText
              copy={workspaceActivityCategoryCopy[item.category]}
            />
          </StatusBadge>
        </header>
        <dl>
          <div>
            <dt>
              <BilingualText copy={workspaceActivityInterfaceCopy.actor} />
            </dt>
            <dd>
              {item.actorDisplayName ?? (
                <BilingualText
                  copy={workspaceActivityInterfaceCopy.systemActor}
                />
              )}
            </dd>
          </div>
          <div>
            <dt>
              <Clock3 aria-hidden="true" />
              <span className="sr-only">Timestamp</span>
            </dt>
            <dd>
              <time dateTime={item.createdAt}>
                <BilingualText copy={time} />
              </time>
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

export function WorkspaceActivityPage() {
  const { currentWorkspace, user } = useAuthenticatedSession();
  const isLocalPreview = import.meta.env.DEV || isPublicDemoPath();
  const canViewActivity =
    currentWorkspace.role === "owner" || currentWorkspace.role === "admin";
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [reloadToken, setReloadToken] = useState(0);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const olderRequestRef = useRef<AbortController | null>(null);
  const [notice, setNotice] = useState<WorkspaceActivityNotice | null>(null);
  const [state, setState] = useState<ActivityState>(() =>
    isLocalPreview
      ? {
          status: "ready",
          workspaceId: currentWorkspace.id,
          data: localActivity(user.displayName),
        }
      : {
          status: "loading",
          workspaceId: currentWorkspace.id,
          data: null,
        },
  );

  useEffect(() => {
    if (isLocalPreview || !canViewActivity) return;
    const controller = new AbortController();
    void fetchWorkspaceActivityPage(controller.signal, currentWorkspace.id)
      .then((data) => {
        setState({
          status: "ready",
          workspaceId: currentWorkspace.id,
          data,
        });
        setNotice(null);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            status: "error",
            workspaceId: currentWorkspace.id,
            data: null,
          });
          setNotice(workspaceActivityFailureNotice(error));
        }
      });
    return () => controller.abort();
  }, [canViewActivity, currentWorkspace.id, isLocalPreview, reloadToken]);

  useEffect(
    () => () => {
      olderRequestRef.current?.abort();
      olderRequestRef.current = null;
    },
    [currentWorkspace.id],
  );

  const visibleStatus =
    state.workspaceId === currentWorkspace.id ? state.status : "loading";
  const data = state.status === "ready" ? state.data : null;
  const visibleItems = useMemo(
    () =>
      data?.items.filter(
        (item) => filter === "all" || item.category === filter,
      ) ?? [],
    [data, filter],
  );

  if (!canViewActivity) {
    return (
      <div className="page workspace-activity-page workspace-activity-page--state">
        <EmptyState
          title={workspaceActivityInterfaceCopy.forbiddenHeading.zhHant}
          titleEnglish={workspaceActivityInterfaceCopy.forbiddenHeading.english}
          message={workspaceActivityInterfaceCopy.forbiddenBody.zhHant}
          messageEnglish={workspaceActivityInterfaceCopy.forbiddenBody.english}
        />
      </div>
    );
  }

  if (visibleStatus === "loading" || !data) {
    if (visibleStatus === "error") {
      return (
        <div className="page workspace-activity-page workspace-activity-page--state">
          <ErrorState
            title="無法載入活動記錄"
            titleEnglish="Unable to load the activity log"
            onRetry={() => {
              setState({
                status: "loading",
                workspaceId: currentWorkspace.id,
                data: null,
              });
              setReloadToken((value) => value + 1);
            }}
          />
        </div>
      );
    }
    return (
      <div className="page workspace-activity-page workspace-activity-page--state">
        <LoadingState
          label="正在載入受保護的活動記錄"
          labelEnglish="Loading the protected activity log"
        />
      </div>
    );
  }

  const loadOlder = async () => {
    if (!data.nextCursor || loadingOlder || isLocalPreview) return;
    const controller = new AbortController();
    olderRequestRef.current?.abort();
    olderRequestRef.current = controller;
    setLoadingOlder(true);
    setNotice(workspaceActivityNoticeCopy.loadingOlder);
    try {
      const page = await fetchWorkspaceActivityPage(
        controller.signal,
        currentWorkspace.id,
        data.nextCursor,
      );
      setState((current) =>
        current.status === "ready" &&
        current.workspaceId === currentWorkspace.id
          ? {
              ...current,
              data: {
                items: [...current.data.items, ...page.items],
                nextCursor: page.nextCursor,
              },
            }
          : current,
      );
      setNotice(null);
    } catch (error) {
      if (!controller.signal.aborted) {
        setNotice(workspaceActivityFailureNotice(error));
      }
    } finally {
      if (olderRequestRef.current === controller) {
        olderRequestRef.current = null;
        setLoadingOlder(false);
      }
    }
  };

  return (
    <div className="page workspace-activity-page">
      <header className="page-header workspace-activity-header">
        <div>
          <span className="eyebrow">
            <BilingualText copy={workspaceActivityInterfaceCopy.eyebrow} />
          </span>
          <h1>
            <BilingualText copy={workspaceActivityInterfaceCopy.heading} />
          </h1>
          <p>
            <BilingualText copy={workspaceActivityInterfaceCopy.introduction} />
          </p>
        </div>
        <button
          className="button button--secondary"
          type="button"
          disabled={loadingOlder}
          onClick={() => {
            setFilter("all");
            setNotice(null);
            if (isLocalPreview) {
              setState({
                status: "ready",
                workspaceId: currentWorkspace.id,
                data: localActivity(user.displayName),
              });
            } else {
              setState({
                status: "loading",
                workspaceId: currentWorkspace.id,
                data: null,
              });
              setReloadToken((value) => value + 1);
            }
          }}
        >
          <RefreshCw aria-hidden="true" />
          <BilingualText copy={workspaceActivityInterfaceCopy.refresh} />
        </button>
      </header>

      {notice ? <ActivityNotice notice={notice} /> : null}

      <section className="workspace-activity-panel" aria-busy={loadingOlder}>
        <header className="workspace-activity-panel__header">
          <div>
            <ScrollText aria-hidden="true" />
            <div>
              <h2>
                <BilingualText
                  copy={workspaceActivityInterfaceCopy.latestHeading}
                />
              </h2>
              <p>
                <BilingualText
                  copy={workspaceActivityInterfaceCopy.loadedCount}
                />
                <strong>{data.items.length}</strong>
              </p>
            </div>
          </div>
          <label>
            <BilingualText copy={workspaceActivityInterfaceCopy.filter} />
            <select
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as ActivityFilter)
              }
            >
              {filters.map((value) => {
                const label =
                  value === "all"
                    ? workspaceActivityInterfaceCopy.allCategories
                    : workspaceActivityCategoryCopy[value];
                return (
                  <option key={value} value={value}>
                    {bilingualLabel(label)}
                  </option>
                );
              })}
            </select>
          </label>
        </header>

        {data.items.length === 0 ? (
          <EmptyState
            title={workspaceActivityInterfaceCopy.noActivityHeading.zhHant}
            titleEnglish={
              workspaceActivityInterfaceCopy.noActivityHeading.english
            }
            message={workspaceActivityInterfaceCopy.noActivityBody.zhHant}
            messageEnglish={
              workspaceActivityInterfaceCopy.noActivityBody.english
            }
          />
        ) : visibleItems.length === 0 ? (
          <EmptyState
            title={workspaceActivityInterfaceCopy.noFilteredHeading.zhHant}
            titleEnglish={
              workspaceActivityInterfaceCopy.noFilteredHeading.english
            }
            message={workspaceActivityInterfaceCopy.noFilteredBody.zhHant}
            messageEnglish={
              workspaceActivityInterfaceCopy.noFilteredBody.english
            }
          />
        ) : (
          <div className="workspace-activity-list">
            {visibleItems.map((item, index) => (
              <ActivityCard
                key={`${item.createdAt}:${item.action}:${item.actorDisplayName ?? "system"}:${index}`}
                item={item}
              />
            ))}
          </div>
        )}

        {data.nextCursor ? (
          <footer className="workspace-activity-panel__footer">
            <button
              className="button button--secondary"
              type="button"
              disabled={loadingOlder}
              onClick={() => void loadOlder()}
            >
              {loadingOlder ? (
                <LoaderCircle aria-hidden="true" />
              ) : (
                <Clock3 aria-hidden="true" />
              )}
              <BilingualText
                copy={
                  loadingOlder
                    ? workspaceActivityInterfaceCopy.loadingOlder
                    : workspaceActivityInterfaceCopy.loadOlder
                }
              />
            </button>
          </footer>
        ) : null}
      </section>
    </div>
  );
}
