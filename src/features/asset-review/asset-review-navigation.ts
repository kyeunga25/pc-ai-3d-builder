import { createContext, useContext } from "react";

export type AssetReviewNavigationTarget = {
  workspaceId: string;
  assetId: string;
};

export type AssetReviewNavigationContextValue = {
  target: AssetReviewNavigationTarget | null;
  selectAssetReviewTarget: (workspaceId: string, assetId: string) => void;
  clearAssetReviewTarget: (expected: AssetReviewNavigationTarget) => void;
};

export const AssetReviewNavigationContext =
  createContext<AssetReviewNavigationContextValue | null>(null);

export function targetAssetIdForWorkspace(
  target: AssetReviewNavigationTarget | null,
  workspaceId: string,
): string | null {
  return target?.workspaceId === workspaceId ? target.assetId : null;
}

export function useAssetReviewNavigation(): AssetReviewNavigationContextValue {
  const value = useContext(AssetReviewNavigationContext);
  if (!value) {
    throw new Error(
      "useAssetReviewNavigation must be used within AssetReviewNavigationProvider",
    );
  }
  return value;
}
