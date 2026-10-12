# ASAR Explorer

一个纯本地的 ASAR 文件浏览器。拖入 Electron 应用的 `.asar` 文件，即可搜索目录、预览代码与图片、下载单个文件。归档不会上传到服务器。

- Rsbuild + TanStack Start，首页在构建时预渲染（SSG）。
- `@rsbuild/plugin-tailwindcss` + Tailwind CSS v4。
- shadcn/ui 的源码组件（Button、Input），配置见 `components.json`。
- TanStack Virtual 渲染文件列表；支持目录展开、折叠、路径搜索与可调整双栏。
- Monaco Editor 只读文本预览，编辑器和 worker 都由本站提供，无需外部 CDN。
- 支持 UTF-8 / UTF-16 文本、栅格图片、符号链接、空文件；二进制与外部 unpacked 文件有对应提示。

## 开发

需要 Node.js 22.12+ 与 pnpm 10。

```sh
pnpm install
pnpm dev
```

打开 http://localhost:3000。开发模式的示例归档可先通过 `node scripts/create-demo.mjs` 生成。

```sh
pnpm test       # 真实 Electron ASAR 兼容性与异常输入测试
pnpm build      # 生成示例、SSG、类型检查、校验静态 HTML 与资源引用
pnpm preview    # 仅提供 dist/client 的静态文件，无需 SSR 服务
pnpm exec playwright install chromium
pnpm test:e2e  # 拖放、Monaco、图片、下载、3000 条虚拟列表和手机布局
```

Monaco 按需加载；文本预览上限为 2 MiB，图片预览上限为 20 MiB，较大的文件仍可下载完整内容。解析只读取归档头；选择文件时才读取相应内容。`.asar.unpacked` 中的文件不在归档内，因此不能从单独的 ASAR 中提取。

## GitHub Pages

`.github/workflows/deploy.yml` 在 `main` 分支推送或手动触发时执行测试、SSG 构建、浏览器测试并发布 `dist/client`。仅构建阶段使用 SSR，线上是静态站点。

1. 将项目推送到目标 GitHub 仓库的 `main` 分支。
2. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. 在 Actions 中运行 **Deploy GitHub Pages**。

工作流从 `actions/configure-pages` 读取实际子路径。例如 `owner/asar-explorer` 会使用 `/asar-explorer/`，而 `owner/owner.github.io` 会使用 `/`。本地可用同样的配置验证项目站点：

```sh
PUBLIC_BASE_PATH=/asar-explorer/ pnpm build
PUBLIC_BASE_PATH=/asar-explorer/ pnpm preview
# http://127.0.0.1:3000/asar-explorer/
```

构建后会检查预渲染页面包含完整首页内容、每个本地资源存在且使用正确前缀，并生成 `.nojekyll`。

## 文件结构

```text
拖入 / 选择文件
  src/components/Explorer.tsx
       ↓
读取 Pickle 文件头、验证目录与内容范围
  src/lib/asar.ts
       ↓
目录展开 / 路径搜索 → TanStack Virtual 文件列表
  src/components/Explorer.tsx
       ↓
按 offset + size 读取选中文件
  src/lib/asar.ts → src/lib/preview.ts
       ↓
Monaco 文本预览 / 图片预览 / 状态提示
  src/components/FilePreview.tsx → MonacoPreview.tsx
```
