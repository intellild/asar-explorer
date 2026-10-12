import { readFile, access, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.PUBLIC_BASE_PATH || "/";
const html = await readFile("dist/client/index.html", "utf8");
assert(
  html.includes("把 ASAR 文件拖到这里"),
  "SSG must include the rendered application, not an empty shell",
);
assert(html.includes("ASAR Explorer"), "Expected app title in static HTML");
const assets = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
  .map((match) => match[1])
  .filter((url) => !url.startsWith("http"));
for (const asset of assets) {
  assert(asset.startsWith(base), `Asset must use Pages base path: ${asset}`);
  const path = asset.slice(base.length).split("?")[0];
  if (path) await access(`dist/client/${path}`);
}
await access("dist/client/demo.asar");
await writeFile("dist/client/.nojekyll", "");
console.log(
  `Verified SSG HTML and ${assets.length} asset references under ${base}`,
);
