import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { existsSync, openSync, closeSync } from "node:fs";
import { resolve, delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { createServer } from "node:net";
const root = fileURLToPath(new URL("../", import.meta.url));
for (const port of [5173, 4400, 4410, 8080, 9099, 5001]) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(
        new Error(
          `Port ${port} is already in use. Stop the existing local session before running E2E.`,
        ),
      ),
    );
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
}
const temporary = resolve(root, ".e2e");
await mkdir(resolve(temporary, "functions"), { recursive: true });
const clock = resolve(temporary, "clock.txt");
await writeFile(clock, "2026-10-10T05:00:00.000Z");
await writeFile(
  resolve(temporary, "functions/.env.local"),
  `E2E_CLOCK_FILE=${clock}\n`,
);
const originalPackage = JSON.parse(
  await readFile(resolve(root, "functions/package.json"), "utf8"),
);
await writeFile(
  resolve(temporary, "functions/package.json"),
  JSON.stringify({
    name: "home-work-e2e-only",
    main: "index.js",
    engines: { node: "22" },
    dependencies: {
      "firebase-admin": originalPackage.dependencies["firebase-admin"],
      "firebase-functions": originalPackage.dependencies["firebase-functions"],
    },
  }),
);
await build({
  entryPoints: [resolve(root, "tests/e2e/support/functions-entry.ts")],
  outfile: resolve(temporary, "functions/index.js"),
  bundle: true,
  platform: "node",
  target: "node22",
  external: [
    "firebase-admin",
    "firebase-admin/*",
    "firebase-functions",
    "firebase-functions/*",
  ],
});
await build({
  entryPoints: [resolve(root, "tests/e2e/support/harness.ts")],
  outfile: resolve(temporary, "harness.cjs"),
  bundle: true,
  platform: "node",
  target: "node22",
  packages: "external",
});
const configuration = JSON.parse(
  await readFile(resolve(root, "firebase.json"), "utf8"),
);
configuration.functions = [
  { source: "functions", codebase: "default", runtime: "nodejs22" },
];
await copyFile(
  resolve(root, "firestore.rules"),
  resolve(temporary, "firestore.rules"),
);
await copyFile(
  resolve(root, "firestore.indexes.json"),
  resolve(temporary, "firestore.indexes.json"),
);
configuration.firestore.rules = "firestore.rules";
configuration.firestore.indexes = "firestore.indexes.json";
delete configuration.hosting;
configuration.emulators.hub = { host: "127.0.0.1", port: 4410 };
await writeFile(
  resolve(temporary, "firebase.json"),
  JSON.stringify(configuration),
);
const localJava = resolve(root, ".tools/java21/Contents/Home/bin");
const env = {
  ...process.env,
  E2E_CLOCK_FILE: clock,
  E2E_RULES_FILE: resolve(root, "firestore.rules"),
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  GCLOUD_PROJECT: "demo-home-work",
  FUNCTIONS_DISCOVERY_TIMEOUT: process.env.FUNCTIONS_DISCOVERY_TIMEOUT || "60",
};
if (existsSync(resolve(localJava, "java")))
  env.PATH = `${localJava}${delimiter}${env.PATH}`;
const children = [];
const serviceLog = openSync(resolve(temporary, "services.log"), "w");
function launch(command, args, environment = env, quiet = true) {
  const child = spawn(command, args, {
    cwd: root,
    env: environment,
    stdio: quiet ? ["ignore", serviceLog, serviceLog] : "inherit",
  });
  children.push(child);
  child.on("error", (e) => console.error(e));
  return child;
}
let stopping;
function stop() {
  stopping ??= Promise.all(
    children.map((child) => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      return new Promise((resolve) => {
        child.once("exit", resolve);
        child.kill("SIGTERM");
      });
    }),
  );
  return stopping;
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stop();
    process.exitCode = 1;
  });
async function ready(url) {
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Local service not ready: ${url}`);
}
try {
  launch(resolve(root, "node_modules/.bin/firebase"), [
    "emulators:start",
    "--config",
    resolve(temporary, "firebase.json"),
    "--project",
    "demo-home-work",
    "--only",
    "auth,firestore,functions",
  ]);
  launch(process.execPath, [resolve(temporary, "harness.cjs")]);
  launch(
    resolve(root, "node_modules/.bin/vite"),
    [
      "--config",
      "web/vite.config.ts",
      "web",
      "--host",
      "127.0.0.1",
      "--port",
      "5173",
      "--strictPort",
    ],
    { ...env, VITE_USE_EMULATORS: "true", VITE_E2E_PROXY: "true" },
  );
  await ready("http://127.0.0.1:4400/__e2e/health");
  await ready("http://127.0.0.1:5173");
  const browserEnv = {
    ...env,
    PLAYWRIGHT_BROWSERS_PATH:
      process.env.PLAYWRIGHT_BROWSERS_PATH ||
      resolve(root, ".tools/playwright"),
    E2E_BROWSER_CHANNEL:
      process.env.E2E_BROWSER_CHANNEL ||
      (existsSync("/Applications/Google Chrome.app") ? "chrome" : ""),
  };
  console.log(
    "Local app and Emulator harness ready. Service logs: .e2e/services.log",
  );
  const tests = launch(
    resolve(root, "node_modules/.bin/playwright"),
    ["test", ...process.argv.slice(2)],
    browserEnv,
    false,
  );
  process.exitCode = await new Promise((resolve) =>
    tests.on("exit", (code) => resolve(code ?? 1)),
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await stop();
  closeSync(serviceLog);
}
