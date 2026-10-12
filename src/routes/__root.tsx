import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary";
import { NotFound } from "~/components/NotFound";
import "~/styles/app.css";
import { LocaleProvider } from "~/i18n/Provider";
import { DEFAULT_LANGUAGE, staticT } from "~/i18n";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: staticT("app.title") },
      {
        name: "description",
        content: staticT("app.description"),
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
    <html lang={DEFAULT_LANGUAGE}>
      <head>
        <HeadContent />
      </head>
      <body>
        <LocaleProvider>{children}</LocaleProvider>
        <Scripts />
      </body>
    </html>
  );
}
