import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";

export function LoadingState({
  label = "正在載入工作空間",
  labelEnglish = "Loading workspace",
}: {
  label?: string;
  labelEnglish?: string;
}) {
  return (
    <div className="async-state" role="status">
      <LoaderCircle className="async-state__spinner" aria-hidden="true" />
      <strong>
        {label}
        <small lang="en">{labelEnglish}</small>
      </strong>
      <span className="async-state__message">正在準備已核實的商戶資料。</span>
      <span className="async-state__secondary" lang="en">
        Preparing verified merchant data.
      </span>
    </div>
  );
}

export function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="async-state">
      <Inbox aria-hidden="true" />
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}

export function ErrorState({
  title = "無法載入此頁面",
  titleEnglish = "Unable to load this page",
  onRetry,
}: {
  title?: string;
  titleEnglish?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="async-state" role="alert">
      <AlertCircle aria-hidden="true" />
      <strong>
        {title}
        <small lang="en">{titleEnglish}</small>
      </strong>
      <span className="async-state__message">商戶資料未有任何變更。</span>
      <span className="async-state__secondary" lang="en">
        No merchant data was changed.
      </span>
      {onRetry ? (
        <button
          className="button button--secondary"
          type="button"
          onClick={onRetry}
        >
          重試 <span lang="en">Retry</span>
        </button>
      ) : null}
    </div>
  );
}
