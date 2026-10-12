import { tanstackStart } from "@tanstack/react-start/plugin/rsbuild";
import { parse as parseToml } from "smol-toml";
import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { pluginTailwindcss } from "@rsbuild/plugin-tailwindcss";

const base = process.env.PUBLIC_BASE_PATH || "/";
export default defineConfig({
  server: { port: 3000, base },
  source: {
    define: { "import.meta.env.PUBLIC_BASE_PATH": JSON.stringify(base) },
  },
  tools: {
    rspack: {
      module: {
        rules: [
          { test: /\.toml$/, type: "json", parser: { parse: parseToml } },
        ],
      },
    },
  },
  plugins: [
    pluginTailwindcss(),
    pluginReact(),
    tanstackStart({
      srcDirectory: "src",
      router: { basepath: base },
      prerender: {
        enabled: true,
        crawlLinks: false,
        autoStaticPathsDiscovery: false,
        failOnError: true,
      },
      pages: [
        { path: base, prerender: { enabled: true, outputPath: "/index.html" } },
      ],
    }),
  ],
});
