import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import "./shared/design-system/global.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("找不到 RigStage 根元素。");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
