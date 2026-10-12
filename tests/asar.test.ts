import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createPackageWithOptions, extractFile } from "@electron/asar";
import {
  entryBlob,
  parseAsar,
  resolveEntry,
  visibleEntries,
  type Archive,
} from "../src/lib/asar";
import { decodeText, languageFor } from "../src/lib/preview";

/** A Chromium Pickle fixture for intentionally malformed archive headers. */
function archiveWith(files: unknown, content = new Uint8Array()): Blob {
  const json = new TextEncoder().encode(JSON.stringify({ files }));
  const headerSize = 8 + Math.ceil(json.length / 4) * 4;
  const data = new Uint8Array(8 + headerSize + content.length);
  const view = new DataView(data.buffer);
  view.setUint32(0, 4, true);
  view.setUint32(4, headerSize, true);
  view.setUint32(8, headerSize - 4, true);
  view.setUint32(12, json.length, true);
  data.set(json, 16);
  data.set(content, 8 + headerSize);
  return new Blob([data]);
}
let temp: string;
let archive: Archive;
let path: string;
beforeAll(async () => {
  temp = await mkdtemp(join(tmpdir(), "asar-parser-test-"));
  const source = join(temp, "source");
  await mkdir(join(source, "src"), { recursive: true });
  await mkdir(join(source, "empty"));
  await writeFile(join(source, "src/main.js"), 'console.log("你好 🌍")\n');
  await writeFile(join(source, "package.json"), '{"name":"fixture"}');
  await writeFile(join(source, "external.node"), new Uint8Array([0, 255, 1]));
  await writeFile(join(source, "zero.txt"), "");
  await symlink("src/main.js", join(source, "alias.js"));
  path = join(temp, "test.asar");
  await createPackageWithOptions(source, path, { unpack: "*.node" });
  archive = await parseAsar(new Blob([await readFile(path)]), "test.asar");
});
afterAll(async () => {
  if (temp) await rm(temp, { recursive: true, force: true });
});
describe("Electron-compatible ASAR reading", () => {
  it("reads a real archive and matches Electron extraction", async () => {
    expect(archive.name).toBe("test.asar");
    expect(archive.fileCount).toBe(5);
    for (const name of [
      "src/main.js",
      "package.json",
      "zero.txt",
      "alias.js",
    ]) {
      const bytes = new Uint8Array(
        await entryBlob(archive, archive.byPath.get(name)!).arrayBuffer(),
      );
      expect(bytes).toEqual(new Uint8Array(extractFile(path, name)));
    }
  });
  it("retains empty directories and resolves root-relative symlinks", () => {
    expect(archive.byPath.get("empty")?.kind).toBe("directory");
    expect(resolveEntry(archive, archive.byPath.get("alias.js")!).path).toBe(
      "src/main.js",
    );
  });
  it("explains files in the external unpacked directory", () => {
    expect(archive.byPath.get("external.node")?.unpacked).toBe(true);
    expect(() =>
      entryBlob(archive, archive.byPath.get("external.node")!),
    ).toThrow("unpackedFile");
  });
  it("filters nested files and exposes them only when parents are expanded", () => {
    expect(
      visibleEntries(archive, new Set(), "").some(
        (entry) => entry.path === "src/main.js",
      ),
    ).toBe(false);
    expect(
      visibleEntries(archive, new Set(["src"]), "").some(
        (entry) => entry.path === "src/main.js",
      ),
    ).toBe(true);
    expect(
      visibleEntries(archive, new Set(), "MAIN.JS").map((entry) => entry.path),
    ).toEqual(["src/main.js"]);
  });
  it("reads only the header during parsing, not the whole archive", async () => {
    const blob = new Blob([await readFile(path)]);
    blob.arrayBuffer = () => {
      throw new Error("Whole archive should never be loaded");
    };
    expect((await parseAsar(blob)).fileCount).toBe(5);
  });
});
describe("malformed archives", () => {
  it("rejects truncated and non-ASAR inputs", async () => {
    await expect(parseAsar(new Blob(["not an archive"]))).rejects.toThrow(
      "header",
    );
    await expect(parseAsar(new Blob([new Uint8Array(16)]))).rejects.toThrow(
      "header",
    );
    const blob = archiveWith({ file: { size: 8, offset: "0" } });
    await expect(parseAsar(blob)).rejects.toThrow("outOfRange");
  });
  it("rejects oversized headers, unsafe offsets, and malformed names", async () => {
    const data = new Uint8Array(await archiveWith({}).arrayBuffer());
    new DataView(data.buffer).setUint32(4, 128 * 1024 * 1024, true);
    new DataView(data.buffer).setUint32(8, 128 * 1024 * 1024 - 4, true);
    await expect(parseAsar(new Blob([data]))).rejects.toThrow("headerSize");
    await expect(
      parseAsar(archiveWith({ bad: { size: 1, offset: "9007199254740992" } })),
    ).rejects.toThrow("outOfRange");
    await expect(
      parseAsar(archiveWith({ "../bad": { size: 0, offset: "0" } })),
    ).rejects.toThrow("entryInvalid");
    await expect(
      parseAsar(archiveWith({ bad: { size: -1, offset: "0" } })),
    ).rejects.toThrow("fileSize");
  });
  it("reports circular and broken symlinks", async () => {
    const cyclic = await parseAsar(
      archiveWith({
        a: { link: "b" },
        b: { link: "a" },
        broken: { link: "missing" },
      }),
    );
    expect(() => entryBlob(cyclic, cyclic.byPath.get("a")!)).toThrow(
      "linkCycle",
    );
    expect(() => entryBlob(cyclic, cyclic.byPath.get("broken")!)).toThrow(
      "linkMissing",
    );
  });
  it("rejects invalid JSON and invalid directory indexes", async () => {
    const bytes = new Uint8Array(await archiveWith({}).arrayBuffer());
    bytes[16] = 0xff;
    await expect(parseAsar(new Blob([bytes]))).rejects.toThrow("indexJson");
    await expect(parseAsar(archiveWith(null))).rejects.toThrow("missingFiles");
  });
});
describe("text preview", () => {
  it("decodes UTF-8, UTF-16LE, and empty files", () => {
    expect(decodeText(new TextEncoder().encode("你好 🌍").buffer)).toBe(
      "你好 🌍",
    );
    expect(decodeText(new Uint8Array([255, 254, 65, 0]).buffer)).toBe("A");
    expect(decodeText(new ArrayBuffer(0))).toBe("");
  });
  it("detects binary content and maps languages", () => {
    expect(decodeText(new Uint8Array([0, 1, 2, 255]).buffer)).toBeNull();
    expect(decodeText(new Uint8Array([255, 255]).buffer)).toBeNull();
    expect(languageFor("src/main.CJS")).toBe("javascript");
    expect(languageFor("package.json")).toBe("json");
  });
});
