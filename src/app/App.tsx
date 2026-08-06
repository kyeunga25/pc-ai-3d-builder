import { BrowserRouter } from "react-router";

import { isPublicDemoPath, publicDemoRoot } from "../shared/lib/demo-mode";
import { AppRouter } from "./router/AppRouter";

export function App() {
  const demoMode = isPublicDemoPath();

  return (
    <BrowserRouter basename={demoMode ? publicDemoRoot : undefined}>
      <AppRouter demoMode={demoMode} />
    </BrowserRouter>
  );
}
