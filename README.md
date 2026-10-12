# ASAR Explorer

A local ASAR file browser. Drop an Electron application's `.asar` file to search its directory tree, preview code and images, and download individual files. Archives stay on your device and are never uploaded to a server.

- Rsbuild + TanStack Start, with the homepage prerendered at build time (SSG).
- `@rsbuild/plugin-tailwindcss` + Tailwind CSS v4.
- English and Simplified Chinese localization with i18next and react-i18next.
- shadcn/ui source components (Button, Input, and Select), configured in `components.json`.
- TanStack Virtual for the file list, with expandable directories, path search, and a resizable split view.
- Read-only text previews in Monaco Editor. The editor and its workers are served locally without an external CDN.
- Rstest for unit tests and Playwright for browser tests.
- Support for UTF-8 / UTF-16 text, raster images, symbolic links, and empty files, with explanatory messages for binary files and external unpacked files.

## Development

Requires Node.js 22.12+ and pnpm 10.

```sh
pnpm install
pnpm dev
```

Open http://localhost:3000. To use the example archive in development, generate it first with `node scripts/create-demo.mjs`.

```sh
pnpm test       # Real Electron ASAR compatibility and malformed input tests
pnpm build      # Generate the demo, prerender, typecheck, and verify static HTML and assets
pnpm preview    # Serve dist/client as static files without an SSR server
pnpm exec playwright install chromium
pnpm test:e2e   # Drag and drop, Monaco, images, downloads, 3,000 virtualized files, and mobile layout
```

Monaco loads on demand. Text previews are limited to 2 MiB and image previews to 20 MiB; larger files can still be downloaded in full. Parsing reads only the archive header, and file contents are read when selected. Files marked as unpacked are stored in the accompanying `.asar.unpacked` directory, so their contents cannot be extracted from the ASAR file alone.

## Localization

Translation files live in `src/i18n/locales/en.toml` and `src/i18n/locales/zh-CN.toml`. Rsbuild parses TOML into bundled resources at build time with `smol-toml`; the browser does not need a TOML parser or a translation server.

Use the language selector in the workspace toolbar to switch languages. The app detects supported browser languages and remembers your choice in local storage. The SSG page and initial client render use Simplified Chinese; browser preferences are restored after hydration. File names and file contents remain unchanged when switching languages.

Add strings to both TOML files using matching keys. Interpolation uses i18next syntax, such as `{{name}}`, and plurals use `_one` / `_other` keys. Parser errors carry translation keys so existing error messages also update when the language changes.

## GitHub Pages

`.github/workflows/deploy.yml` runs only when manually triggered. It runs tests, builds the static site, runs browser tests, and publishes `dist/client`. Pushing code does not trigger a deployment. SSR is used only during the build; the deployed site is entirely static.

1. Push the project to the target GitHub repository's `main` branch.
2. In **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**.
3. Open **Actions → Deploy GitHub Pages → Run workflow**, select `main`, and run the workflow manually.

The workflow derives the github.io base path from the repository name. Building and testing do not require Pages to be enabled; the deployment job checks the Pages configuration with `actions/configure-pages`. For example, `owner/asar-explorer` uses `/asar-explorer/`, while `owner/owner.github.io` uses `/`. To verify a project site's base path locally:

```sh
PUBLIC_BASE_PATH=/asar-explorer/ pnpm build
PUBLIC_BASE_PATH=/asar-explorer/ pnpm preview
# http://127.0.0.1:3000/asar-explorer/
```

After building, the static verifier checks that the prerendered HTML contains the complete homepage and that local assets exist and use the correct prefix. It also creates `.nojekyll`.

Live site: [ASAR Explorer](https://intellild.github.io/asar-explorer/). After deployment, run the same browser tests against the live site:

```sh
E2E_BASE_URL=https://intellild.github.io/asar-explorer/ pnpm test:e2e
```

Live tests also read test files locally in the browser without uploading archives.

## File structure

```text
Drop or select a file
  src/components/Explorer.tsx
       ↓
Read the Pickle header; validate the directory index and content ranges
  src/lib/asar.ts
       ↓
Expand directories / search paths → TanStack Virtual file list
  src/components/Explorer.tsx
       ↓
Read the selected file using offset + size
  src/lib/asar.ts → src/lib/preview.ts
       ↓
Monaco text preview / image preview / status messages
  src/components/FilePreview.tsx → MonacoPreview.tsx
```
