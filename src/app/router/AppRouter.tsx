import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";

import { MerchantShell } from "../shell/MerchantShell";
import { AssetReviewPage } from "../../features/asset-review/AssetReviewPage";
import { CataloguePage } from "../../features/catalogue/CataloguePage";
import { DashboardPage } from "../../features/dashboard/DashboardPage";
import { LoadingState } from "../../shared/components/AsyncState";

const BuilderPage = lazy(async () => {
  const module = await import("../../features/builder/BuilderPage");
  return { default: module.BuilderPage };
});

export function AppRouter() {
  return (
    <Routes>
      <Route element={<MerchantShell />}>
        <Route index element={<Navigate replace to="/dashboard" />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/catalogue" element={<CataloguePage />} />
        <Route path="/asset-review" element={<AssetReviewPage />} />
      </Route>
      <Route
        path="/builder"
        element={
          <Suspense
            fallback={<LoadingState label="正在載入電腦組裝工作空間" />}
          >
            <BuilderPage />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate replace to="/dashboard" />} />
    </Routes>
  );
}
