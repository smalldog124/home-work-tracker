import { readFile, writeFile, mkdir, copyFile, access, rm } from 'node:fs/promises';
const source = JSON.parse(await readFile(new URL('../functions/package.json', import.meta.url), 'utf8'));
const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
const dependencies = {};
for (const name of ['firebase-admin', 'firebase-functions']) {
  const entry = lock.packages[`functions/node_modules/${name}`] ?? lock.packages[`node_modules/${name}`];
  if (!entry?.version) throw new Error(`Missing installed lockfile version for ${name}`);
  dependencies[name] = entry.version;
}
const directory = new URL('../functions/deploy/', import.meta.url);
await mkdir(directory, { recursive: true });
await copyFile(new URL('../functions/lib/index.js', import.meta.url), new URL('index.js', directory));
await writeFile(new URL('package.json', directory), JSON.stringify({ name: 'home-work-functions-runtime', private: true, main: 'index.js', engines: source.engines, dependencies }, null, 2) + '\n');
// Environment settings are copied into the ignored deployment artifact, never the bundle.
const environment = new URL('../functions/.env', import.meta.url);
try { await access(environment); await copyFile(environment, new URL('.env', directory)); } catch (error) { if (error.code !== 'ENOENT') throw error; await rm(new URL('.env', directory), { force: true }); }
