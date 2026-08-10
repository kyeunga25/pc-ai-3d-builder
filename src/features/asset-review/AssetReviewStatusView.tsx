import { AlertCircle, AlertTriangle, CircleCheck, Info } from "lucide-react";

import type { AssetReviewNotice } from "./asset-review-status";

export function AssetReviewStatusView({
  englishSuffix,
  notice,
  zhHantSuffix,
}: {
  englishSuffix: string;
  notice: AssetReviewNotice;
  zhHantSuffix: string;
}) {
  const StatusIcon =
    notice.tone === "error"
      ? AlertCircle
      : notice.tone === "warning"
        ? AlertTriangle
        : notice.tone === "success"
          ? CircleCheck
          : Info;

  return (
    <span
      className={`asset-review-status is-${notice.tone}`}
      role={notice.tone === "error" ? "alert" : "status"}
      aria-live={notice.tone === "error" ? "assertive" : "polite"}
    >
      <StatusIcon aria-hidden="true" />
      <span className="asset-review-status__copy">
        <span>
          {notice.zhHant}
          {zhHantSuffix}
        </span>
        <small lang="en">
          {notice.english}
          {englishSuffix}
        </small>
      </span>
    </span>
  );
}
