import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";

export function LoadingState({
  label = "正在載入工作空間",
}: {
  label?: string;
}) {
  return (
    <div className="async-state" role="status">
      <LoaderCircle className="async-state__spinner" aria-hidden="true" />
      <strong>{label}</strong>
      <span>正在準備已核實的商戶資料。</span>
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
  onRetry,
}: {
  title?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="async-state" role="alert">
      <AlertCircle aria-hidden="true" />
      <strong>{title}</strong>
      <span>商戶資料未有任何變更。</span>
      {onRetry ? (
        <button
          className="button button--secondary"
          type="button"
          onClick={onRetry}
        >
          重試
        </button>
      ) : null}
    </div>
  );
}
