import { AlertCircle, AlertTriangle, CircleCheck, Info } from "lucide-react";

import type { CatalogueOperationStatus } from "./catalogue-status";

export function CatalogueStatusView({
  className,
  status,
}: {
  className?: string;
  status: CatalogueOperationStatus;
}) {
  const StatusIcon =
    status.tone === "error"
      ? AlertCircle
      : status.tone === "warning"
        ? AlertTriangle
        : status.tone === "success"
          ? CircleCheck
          : Info;

  return (
    <span
      className={["catalogue-status", `is-${status.tone}`, className]
        .filter(Boolean)
        .join(" ")}
      role={status.tone === "error" ? "alert" : "status"}
    >
      <StatusIcon aria-hidden="true" />
      <span title={status.message}>{status.message}</span>
    </span>
  );
}
