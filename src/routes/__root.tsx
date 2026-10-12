import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary";
import { NotFound } from "~/components/NotFound";
import "~/styles/app.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ASAR Explorer — 本地 ASAR 文件浏览器" },
      {
        name: "description",
        content:
          "在浏览器中打开 ASAR 归档，搜索文件、预览代码与图片。文件始终留在你的设备。",
      },
      { name: "theme-color", content: "#f7f8fa" },
    ],
    links: [
      {
        rel: "icon",
        type: "image/svg+xml",
        href: `${import.meta.env.PUBLIC_BASE_PATH}favicon.svg`,
      },
    ],
  }),
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  shellComponent: RootDocument,
});
function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
