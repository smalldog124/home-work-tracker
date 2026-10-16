import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";
export default defineConfig(({ mode, command }) => {
  const lan = command === "serve" && mode === "lan";
  const proxy = (port: number) => ({
    target: `http://127.0.0.1:${port}`,
    changeOrigin: true,
    headers: { origin: "http://127.0.0.1:5173" },
  });
  return {
    define: lan
      ? {
          "import.meta.env.VITE_USE_EMULATORS": JSON.stringify("true"),
          "import.meta.env.VITE_LAN_EMULATORS": JSON.stringify("true"),
        }
      : {},
    server: lan
      ? {
          host: "0.0.0.0",
          port: 5174,
          strictPort: true,
          https: {
            key: readFileSync(
              new URL("../.tools/lan/key.pem", import.meta.url),
            ),
            cert: readFileSync(
              new URL("../.tools/lan/cert.pem", import.meta.url),
            ),
          },
          proxy: {
            "/identitytoolkit.googleapis.com": proxy(9099),
            "/securetoken.googleapis.com": proxy(9099),
            "/emulator/auth": proxy(9099),
            "/google.firestore.v1.Firestore": proxy(8080),
            "/__emulator/functions": {
              ...proxy(5001),
              rewrite: (path: string) =>
                path.replace(
                  /^\/__emulator\/functions/,
                  "/demo-home-work/asia-southeast1",
                ),
            },
          },
        }
      : undefined,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@home-work/shared": fileURLToPath(
          new URL("../shared/src/index.ts", import.meta.url),
        ),
      },
    },
    build: { target: "es2022" },
  };
});
