import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Info,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";

type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const iconByTone: Record<StatusTone, ReactNode> = {
  success: <CheckCircle2 aria-hidden="true" />,
  warning: <AlertTriangle aria-hidden="true" />,
  danger: <XCircle aria-hidden="true" />,
  info: <Info aria-hidden="true" />,
  neutral: <CircleDashed aria-hidden="true" />,
};

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: StatusTone;
}) {
  return (
    <span className={`status-badge status-badge--${tone}`}>
      {iconByTone[tone]}
      {children}
    </span>
  );
}
