import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createInstance } from "i18next";
import { parse } from "smol-toml";
import { ArchiveError, errorMessage } from "../src/lib/errors";

const locales = Object.fromEntries(
  ["en", "zh-CN"].map((language) => [
    language,
    parse(
      readFileSync(
        new URL(`../src/i18n/locales/${language}.toml`, import.meta.url),
        "utf8",
      ),
    ),
  ]),
);
function flatten(
  table: Record<string, unknown>,
  prefix = "",
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(table).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "object" && value !== null)
        return Object.entries(flatten(value as Record<string, unknown>, path));
      expect(typeof value, `Translation ${path} must be a string`).toBe(
        "string",
      );
      return [[path, value as string]];
    }),
  );
}
describe("TOML translations", () => {
  it("keeps locale keys and interpolation placeholders in sync", () => {
    const en = flatten(locales.en);
    const zh = flatten(locales["zh-CN"]);
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
    for (const key of Object.keys(en)) {
      const placeholders = (text: string) =>
        [...text.matchAll(/{{([^}]+)}}/g)].map((match) => match[1]).sort();
      expect(placeholders(en[key]), key).toEqual(placeholders(zh[key]));
    }
  });
  it("handles English plurals, locale-aware counts, and errors in both languages", async () => {
    const instance = createInstance();
    await instance.init({
      resources: {
        en: { translation: locales.en },
        "zh-CN": { translation: locales["zh-CN"] },
      },
      lng: "en",
      initAsync: false,
      interpolation: { escapeValue: false },
    });
    expect(instance.t("files.count", { count: 1 })).toBe("1 file");
    expect(instance.t("files.count", { count: 3000 })).toBe("3,000 files");
    const error = new ArchiveError("errors.linkMissing", { path: "main.js" });
    expect(errorMessage(error, instance.t)).toBe(
      "The link target does not exist: main.js",
    );
    await instance.changeLanguage("zh-CN");
    expect(instance.t("files.count", { count: 3000 })).toBe("3,000 个文件");
    expect(errorMessage(error, instance.t)).toBe("链接目标不存在：main.js");
  });
});
