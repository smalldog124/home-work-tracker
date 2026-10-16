import ReactDOM from "react-dom/client";
import { Providers } from "./app/providers";
import { Router } from "./app/router";
import "./styles/globals.css";
import { unlockScanSounds } from "./features/scan/sounds";
document.addEventListener("pointerdown", unlockScanSounds, { once: true });
ReactDOM.createRoot(document.getElementById("root")!).render(
  <Providers>
    <Router />
  </Providers>,
);
