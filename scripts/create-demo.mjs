import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPackage } from "@electron/asar";
const source = await mkdtemp(join(tmpdir(), "asar-demo-"));
try {
  const files = {
    "package.json":
      JSON.stringify(
        {
          name: "hello-electron",
          version: "1.0.0",
          description: "A tiny Electron application",
          main: "src/main.js",
          scripts: { start: "electron ." },
        },
        null,
        2,
      ) + "\n",
    "README.md":
      "# Hello, Electron!\n\nWelcome to the example archive.\n\nExplore the source code and resources using ASAR Explorer.\n\n- src/main.js: application entry\n- src/preload.js: secure IPC bridge\n- assets/: app resources\n\nAll files are read locally in your browser.\n",
    "src/main.js":
      "const { app, BrowserWindow } = require('electron')\nconst path = require('node:path')\n\n// Create a window after Electron is ready.\nfunction createWindow() {\n  const window = new BrowserWindow({\n    width: 960,\n    height: 640,\n    webPreferences: {\n      preload: path.join(__dirname, 'preload.js'),\n      contextIsolation: true,\n      nodeIntegration: false,\n    },\n  })\n\n  window.loadFile('src/renderer/index.html')\n}\n\napp.whenReady().then(createWindow)\napp.on('window-all-closed', () => {\n  if (process.platform !== 'darwin') app.quit()\n})\n",
    "src/preload.js":
      "const { contextBridge } = require('electron')\n\ncontextBridge.exposeInMainWorld('desktop', {\n  platform: process.platform,\n  version: '1.0.0',\n})\n",
    "src/renderer/index.html":
      '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Hello, Electron!</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  <h1>Hello from inside the archive 👋</h1>\n  <p>A small app. A whole world to explore.</p>\n</body>\n</html>\n',
    "src/renderer/styles.css":
      "body {\n  font-family: system-ui, sans-serif;\n  background: #f5f8f2;\n  color: #30533d;\n  display: grid;\n  place-content: center;\n  min-height: 100vh;\n}\n",
    "assets/config.json": JSON.stringify(
      { theme: "light", locale: "zh-CN", features: { localPreview: true } },
      null,
      2,
    ),
    "assets/logo.svg":
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#235c4b"/><text x="32" y="42" text-anchor="middle" font-family="sans-serif" font-size="32" fill="#fff">A</text></svg>',
    "assets/pixel.png": Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1sAAAAASUVORK5CYII=",
      "base64",
    ),
    "assets/data.bin": Buffer.from([0, 1, 2, 255, 128, 64]),
    LICENSE:
      "MIT License\n\nCopyright (c) 2026 ASAR Explorer contributors\n\nThis example is provided for demonstration purposes.\n",
  };
  for (const [path, contents] of Object.entries(files)) {
    await mkdir(join(source, path, ".."), { recursive: true });
    await writeFile(join(source, path), contents);
  }
  await mkdir("public", { recursive: true });
  await createPackage(source, "public/demo.asar");
  console.log("Created real Electron ASAR demo.");
} finally {
  await rm(source, { recursive: true, force: true });
}
