import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router";

import { MerchantShell } from "../shell/MerchantShell";
import { AssetReviewPage } from "../../features/asset-review/AssetReviewPage";
import { SessionGate } from "../../features/auth/SessionGate";
import { SessionProvider } from "../../features/auth/SessionProvider";
import { LoginPage } from "../../features/auth/LoginPage";
import { CataloguePage } from "../../features/catalogue/CataloguePage";
import { DashboardPage } from "../../features/dashboard/DashboardPage";
import { LandingPage } from "../../features/landing/LandingPage";
import { LoadingState } from "../../shared/components/AsyncState";

const BuilderPage = lazy(async () => {
  const module = await import("../../features/builder/BuilderPage");
  return { default: module.BuilderPage };
});

function ProtectedWorkspace() {
  return (
    <SessionProvider>
      <SessionGate>
        <Outlet />
      </SessionGate>
    </SessionProvider>
  );
}

export function AppRouter({ demoMode = false }: { demoMode?: boolean }) {
  return (
    <Routes>
      <Route
        path="/"
        element={
          demoMode ? <Navigate replace to="/dashboard" /> : <LandingPage />
        }
      />
      <Route
        path="/login"
        element={
          demoMode ? <Navigate replace to="/dashboard" /> : <LoginPage />
        }
      />
      <Route element={<ProtectedWorkspace />}>
        <Route element={<MerchantShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/catalogue" element={<CataloguePage />} />
          <Route path="/asset-review" element={<AssetReviewPage />} />
        </Route>
        <Route
          path="/builder"
          element={
            <Suspense
              fallback={
                <LoadingState
                  label="正在載入電腦組裝工作空間"
                  labelEnglish="Loading PC builder workspace"
                />
              }
            >
              <BuilderPage />
            </Suspense>
          }
        />
      </Route>
      <Route
        path="*"
        element={<Navigate replace to={demoMode ? "/dashboard" : "/"} />}
      />
    </Routes>
  );
}
