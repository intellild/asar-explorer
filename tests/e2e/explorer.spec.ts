import { test, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPackageWithOptions } from "@electron/asar";
let temp: string;
let manyFiles: string;
let specialFiles: string;
test.beforeAll(async () => {
  temp = await mkdtemp(join(tmpdir(), "asar-browser-test-"));
  const many = join(temp, "many");
  await mkdir(many);
  await Promise.all(
    Array.from({ length: 3000 }, (_, i) =>
      writeFile(
        join(many, `file-${String(i).padStart(4, "0")}.txt`),
        `content ${i}`,
      ),
    ),
  );
  manyFiles = join(temp, "many.asar");
  await createPackageWithOptions(many, manyFiles, {});
  const special = join(temp, "special");
  await mkdir(special);
  await writeFile(join(special, "huge.txt"), "x".repeat(2 * 1024 * 1024 + 1));
  await writeFile(join(special, "external.node"), "external");
  await writeFile(join(special, "empty.txt"), "");
  specialFiles = join(temp, "special.asar");
  await createPackageWithOptions(special, specialFiles, { unpack: "*.node" });
});
test.afterAll(async () => {
  if (temp) await rm(temp, { recursive: true, force: true });
});
test("SSG landing, demo, local Monaco, download, image and binary previews", async ({
  page,
  baseURL,
}) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      failures.push(`${response.status()}: ${response.url()}`);
  });
  page.on("console", (message) => {
    if (
      /Could not create web worker|Falling back to loading web worker/.test(
        message.text(),
      )
    )
      failures.push(message.text());
  });
  const workers: string[] = [];
  page.on("worker", (worker) => workers.push(worker.url()));
  await page.route("https://**/*", (route) => {
    if (new URL(route.request().url()).origin === new URL(baseURL!).origin)
      return route.continue();
    return route.abort();
  });
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "把 ASAR 文件拖到这里" }),
  ).toBeVisible();
  const viewport = page.viewportSize()!;
  expect(await page.locator(".workspace").boundingBox()).toEqual({
    x: 0,
    y: 0,
    width: viewport.width,
    height: viewport.height,
  });
  await expect(page.getByText("打开归档，探索里面。")).toHaveCount(0);
  await page.screenshot({ path: "test-results/landing.png", fullPage: true });
  await page.getByRole("button", { name: "试试示例归档" }).click();
  await expect(page.getByText("hello-electron.asar 已就绪")).toBeVisible();
  await page
    .getByTestId("file-row")
    .filter({ hasText: "package.json" })
    .click();
  await expect(page.locator(".monaco-editor")).toBeVisible();
  await expect(page.locator(".view-lines")).toContainText("hello-electron");
  await expect
    .poll(() => workers.length, { timeout: 15_000 })
    .toBeGreaterThan(0);
  await expect(page.locator(".workspace-bar")).toContainText("package.json");
  await expect(
    page
      .locator(".workspace-bar")
      .getByRole("button", { name: "下载", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".workspace-status")).toContainText("172 B");
  await page.screenshot({ path: "test-results/preview.png", fullPage: true });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("package.json");
  await page.getByRole("textbox", { name: "搜索文件" }).fill("pixel.png");
  await page.getByTestId("file-row").click();
  await expect(page.getByRole("img", { name: "pixel.png" })).toBeVisible();
  expect(
    await page
      .getByRole("img", { name: "pixel.png" })
      .evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBe(1);
  await page.getByRole("textbox", { name: "搜索文件" }).fill("data.bin");
  await page.getByTestId("file-row").click();
  await expect(page.getByText("这是一个二进制文件")).toBeVisible();
  expect(workers.length).toBeGreaterThan(0);
  expect(failures).toEqual([]);
});
test("file input, 3000 virtualized rows, scrolling, search, and replacing archives", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByLabel("选择 ASAR 文件", { exact: true })
    .setInputFiles(manyFiles);
  await expect(page.getByText("3,000 个文件", { exact: false })).toBeVisible();
  expect(await page.getByTestId("file-row").count()).toBeLessThan(80);
  await page.locator(".file-list").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await page
    .getByTestId("file-row")
    .filter({ hasText: "file-2999.txt" })
    .click();
  await expect(page.locator(".view-lines")).toContainText("content 2999");
  await page.getByRole("textbox", { name: "搜索文件" }).fill("file-0234");
  await expect(page.getByTestId("file-row")).toHaveCount(1);
  await page.getByTestId("file-row").click();
  await expect(page.locator(".view-lines")).toContainText("content 234");
  await page
    .getByLabel("选择 ASAR 文件", { exact: true })
    .setInputFiles("public/demo.asar");
  await expect(page.getByRole("textbox", { name: "搜索文件" })).toHaveValue("");
  await page.getByTestId("file-row").filter({ hasText: /^src$/ }).click();
  await page.getByTestId("file-row").filter({ hasText: "main.js" }).click();
  await expect(page.locator(".view-lines")).toContainText("createWindow");
});
test("drag and drop, invalid archives and small screens", async ({ page }) => {
  await page.goto("./");
  const buffer = await import("node:fs/promises").then((fs) =>
    fs.readFile("public/demo.asar"),
  );
  const dt = await page.evaluateHandle((bytes) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(bytes)], "dropped.asar"));
    return transfer;
  }, Array.from(buffer));
  await page.locator("main").dispatchEvent("dragenter", { dataTransfer: dt });
  await expect(page.getByText("松开鼠标，打开归档")).toBeVisible();
  await page.locator("main").dispatchEvent("drop", { dataTransfer: dt });
  await expect(page.getByText("dropped.asar 已就绪")).toBeVisible();
  await expect(page.locator(".drag-overlay")).toHaveCount(0);
  await page.getByLabel("选择 ASAR 文件", { exact: true }).setInputFiles({
    name: "broken.asar",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("broken"),
  });
  await expect(page.getByRole("alert")).toContainText("文件头不完整");
  await expect(page.getByText("dropped.asar 已就绪")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
test("large, external and empty files have usable preview states", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByLabel("选择 ASAR 文件", { exact: true })
    .setInputFiles(specialFiles);
  await page.getByTestId("file-row").filter({ hasText: "huge.txt" }).click();
  await expect(page.getByText("文件较大，暂不预览")).toBeVisible();
  await page
    .getByTestId("file-row")
    .filter({ hasText: "external.node" })
    .click();
  await expect(page.getByRole("alert")).toContainText(".asar.unpacked");
  await expect(
    page.getByRole("button", { name: "下载", exact: true }),
  ).toBeDisabled();
  await page.getByTestId("file-row").filter({ hasText: "empty.txt" }).click();
  await expect(page.locator(".monaco-editor")).toBeVisible();
});

test("language switching preserves previews, translates existing errors, and persists", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await page.getByRole("button", { name: "试试示例归档" }).click();
  await page
    .getByTestId("file-row")
    .filter({ hasText: "package.json" })
    .click();
  await expect(page.locator(".view-lines")).toContainText("hello-electron");
  const languageSelect = page.getByRole("combobox", { name: "语言" });
  await languageSelect.press("ArrowDown");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.screenshot({
    path: "test-results/language-menu.png",
    fullPage: true,
  });
  await page
    .getByRole("option", { name: "English", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("button", { name: "Download", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".view-lines")).toContainText("hello-electron");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveTitle("ASAR Explorer — Local ASAR file browser");
  await expect(page.locator(".workspace-status")).toContainText("11 files");
  await page
    .getByLabel("Choose an ASAR file", { exact: true })
    .setInputFiles(specialFiles);
  await page
    .getByTestId("file-row")
    .filter({ hasText: "external.node" })
    .click();
  await expect(
    page.getByTestId("file-preview").getByRole("alert"),
  ).toContainText(
    "This file is stored in the external .asar.unpacked directory",
  );
  await expect(
    page.getByTestId("file-row").filter({ hasText: "external.node" }),
  ).toContainText("External");
  await page.getByRole("combobox", { name: "Language" }).click();
  await page.getByRole("option", { name: "简体中文", exact: true }).click();
  await expect(
    page.getByTestId("file-preview").getByRole("alert"),
  ).toContainText("该文件位于外部 .asar.unpacked 目录");
  await page.getByRole("combobox", { name: "语言" }).click();
  await page.getByRole("option", { name: "English", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Drop an ASAR file here" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(errors).toEqual([]);
});

test.describe("browser language detection", () => {
  test.use({ locale: "en-US" });
  test("uses English browser preferences after SSG hydration on mobile", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("./");
    await expect(
      page.getByRole("heading", { name: "Drop an ASAR file here" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Try the example archive" }).click();
    await page
      .getByTestId("file-row")
      .filter({ hasText: "package.json" })
      .click();
    await expect(
      page.getByRole("button", { name: "Download", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".view-lines")).toContainText("hello-electron");
    expect(await page.locator(".workspace").boundingBox()).toEqual({
      x: 0,
      y: 0,
      width: 390,
      height: 844,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/mobile-en.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
});
