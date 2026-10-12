import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("dist/client");
const base = process.env.PUBLIC_BASE_PATH || "/";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".asar": "application/octet-stream",
  ".woff2": "font/woff2",
};
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (!pathname.startsWith(base)) {
      res.writeHead(404).end();
      return;
    }
    const relative = pathname.slice(base.length);
    const path = resolve(root, relative || "index.html");
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    const contents = await readFile(path);
    res
      .writeHead(200, {
        "Content-Type": types[extname(path)] || "application/octet-stream",
        "Cache-Control": "no-store",
      })
      .end(contents);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(Number(process.env.PORT || 3000), "127.0.0.1", () =>
  console.log(
    `Static preview: http://127.0.0.1:${process.env.PORT || 3000}${base}`,
  ),
);
