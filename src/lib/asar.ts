/** ASAR uses two Chromium Pickles followed by uncompressed file contents. */
export interface ArchiveEntry {
  path: string;
  name: string;
  parent: string;
  depth: number;
  kind: "directory" | "file" | "link";
  size: number;
  offset?: number;
  unpacked?: boolean;
  link?: string;
}
export interface Archive {
  name: string;
  blob: Blob;
  entries: ArchiveEntry[];
  byPath: Map<string, ArchiveEntry>;
  dataOffset: number;
  fileCount: number;
}
const MAX_HEADER = 64 * 1024 * 1024;
const MAX_ENTRIES = 500_000;
function invalid(reason: string): never {
  throw new Error(`无法读取 ASAR：${reason}`);
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export async function parseAsar(
  blob: Blob,
  name = "archive.asar",
): Promise<Archive> {
  if (blob.size < 16) invalid("文件头不完整。");
  const prefix = new DataView(await blob.slice(0, 16).arrayBuffer());
  const headerSize = prefix.getUint32(4, true);
  const jsonSize = prefix.getUint32(12, true);
  if (
    prefix.getUint32(0, true) !== 4 ||
    headerSize < 8 ||
    headerSize % 4 !== 0 ||
    prefix.getUint32(8, true) !== headerSize - 4
  )
    invalid("不是有效的 ASAR 文件头。");
  if (
    headerSize > MAX_HEADER ||
    headerSize + 8 > blob.size ||
    jsonSize > headerSize - 8
  )
    invalid("文件头大小异常或文件已截断。");
  let header: unknown;
  try {
    header = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        await blob.slice(16, 16 + jsonSize).arrayBuffer(),
      ),
    );
  } catch {
    invalid("目录索引不是有效的 JSON。");
  }
  if (!record(header) || !record(header.files)) invalid("缺少文件目录。");
  const entries: ArchiveEntry[] = [];
  const byPath = new Map<string, ArchiveEntry>();
  const dataOffset = headerSize + 8;
  const pending = [{ files: header.files, parent: "", depth: 0 }];
  while (pending.length) {
    const { files, parent, depth } = pending.pop()!;
    if (depth > 512) invalid("目录层级过深。");
    for (const [entryName, node] of Object.entries(files)) {
      if (
        !entryName ||
        entryName === "." ||
        entryName === ".." ||
        /[/\\\0]/.test(entryName) ||
        !record(node)
      )
        invalid("目录条目无效。");
      const path = parent ? `${parent}/${entryName}` : entryName;
      const base = { path, name: entryName, parent, depth, size: 0 };
      let entry: ArchiveEntry;
      if ("files" in node) {
        if (!record(node.files) || "link" in node || "offset" in node)
          invalid(`目录 ${path} 无效。`);
        entry = { ...base, kind: "directory" };
        pending.push({ files: node.files, parent: path, depth: depth + 1 });
      } else if ("link" in node) {
        if (
          typeof node.link !== "string" ||
          node.link.startsWith("/") ||
          node.link.split("/").some((part) => part === "..") ||
          /[\\\0]/.test(node.link)
        )
          invalid(`链接 ${path} 无效。`);
        entry = { ...base, kind: "link", link: node.link };
      } else {
        if (!Number.isSafeInteger(node.size) || (node.size as number) < 0)
          invalid(`文件 ${path} 大小无效。`);
        if ("unpacked" in node && typeof node.unpacked !== "boolean")
          invalid(`文件 ${path} 的 unpacked 标记无效。`);
        const size = node.size as number;
        let offset: number | undefined;
        if (!node.unpacked) {
          if (typeof node.offset !== "string" || !/^\d+$/.test(node.offset))
            invalid(`文件 ${path} 偏移无效。`);
          offset = Number(node.offset);
          if (
            !Number.isSafeInteger(offset) ||
            !Number.isSafeInteger(offset + size) ||
            offset + size > blob.size - dataOffset
          )
            invalid(`文件 ${path} 的内容超出归档范围。`);
        }
        entry = {
          ...base,
          kind: "file",
          size,
          offset,
          unpacked: node.unpacked === true,
        };
      }
      entries.push(entry);
      byPath.set(path, entry);
      if (entries.length > MAX_ENTRIES) invalid("文件条目过多。");
    }
  }
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return {
    name,
    blob,
    entries,
    byPath,
    dataOffset,
    fileCount: entries.filter((entry) => entry.kind !== "directory").length,
  };
}
export function resolveEntry(
  archive: Archive,
  entry: ArchiveEntry,
): ArchiveEntry {
  const seen = new Set<string>();
  while (entry.kind === "link") {
    if (seen.has(entry.path)) throw new Error("此符号链接包含循环引用。");
    seen.add(entry.path);
    const next = archive.byPath.get(entry.link!);
    if (!next) throw new Error(`链接目标不存在：${entry.link}`);
    entry = next;
  }
  return entry;
}
export function entryBlob(archive: Archive, original: ArchiveEntry): Blob {
  const entry = resolveEntry(archive, original);
  if (entry.kind === "directory")
    throw new Error("此链接指向目录，请在文件列表中打开该目录。");
  if (entry.unpacked)
    throw new Error("该文件位于外部 .asar.unpacked 目录，不包含在此归档中。");
  return archive.blob.slice(
    archive.dataOffset + entry.offset!,
    archive.dataOffset + entry.offset! + entry.size,
  );
}
export function visibleEntries(
  archive: Archive,
  expanded: Set<string>,
  query: string,
) {
  const needle = query.trim().toLowerCase();
  return archive.entries.filter((entry) => {
    if (needle) return entry.path.toLowerCase().includes(needle);
    let parent = entry.parent;
    while (parent) {
      if (!expanded.has(parent)) return false;
      parent = archive.byPath.get(parent)?.parent ?? "";
    }
    return true;
  });
}
