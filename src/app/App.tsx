import { BrowserRouter } from "react-router";

import { SessionGate } from "../features/auth/SessionGate";
import { SessionProvider } from "../features/auth/SessionProvider";
import { AppRouter } from "./router/AppRouter";

export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <SessionGate>
          <AppRouter />
        </SessionGate>
      </SessionProvider>
    </BrowserRouter>
  );
}
