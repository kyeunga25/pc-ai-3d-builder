import {
  dashboardResponseSchema,
  type DashboardResponse,
} from "../../shared/domain/dashboard";

export async function fetchDashboard(
  signal: AbortSignal,
  workspaceId: string,
): Promise<DashboardResponse> {
  const response = await fetch("/api/dashboard", {
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      "x-rigstage-workspace-id": workspaceId,
    },
    signal,
  });
  if (!response.ok) {
    throw new Error("無法載入工作空間儀表板。");
  }
  return dashboardResponseSchema.parse(await response.json());
}
