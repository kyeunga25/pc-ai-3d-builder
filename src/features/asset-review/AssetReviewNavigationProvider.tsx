import { type ReactNode, useCallback, useMemo, useState } from "react";

import {
  AssetReviewNavigationContext,
  type AssetReviewNavigationTarget,
} from "./asset-review-navigation";

function targetsMatch(
  left: AssetReviewNavigationTarget,
  right: AssetReviewNavigationTarget,
): boolean {
  return (
    left.workspaceId === right.workspaceId && left.assetId === right.assetId
  );
}

export function AssetReviewNavigationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [target, setTarget] = useState<AssetReviewNavigationTarget | null>(
    null,
  );
  const selectAssetReviewTarget = useCallback(
    (workspaceId: string, assetId: string) => {
      setTarget({ workspaceId, assetId });
    },
    [],
  );
  const clearAssetReviewTarget = useCallback(
    (expected: AssetReviewNavigationTarget) => {
      setTarget((current) =>
        current && targetsMatch(current, expected) ? null : current,
      );
    },
    [],
  );
  const value = useMemo(
    () => ({ target, selectAssetReviewTarget, clearAssetReviewTarget }),
    [clearAssetReviewTarget, selectAssetReviewTarget, target],
  );

  return (
    <AssetReviewNavigationContext.Provider value={value}>
      {children}
    </AssetReviewNavigationContext.Provider>
  );
}
