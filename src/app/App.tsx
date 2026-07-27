import { BrowserRouter } from "react-router";

import { AppRouter } from "./router/AppRouter";

export function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}
