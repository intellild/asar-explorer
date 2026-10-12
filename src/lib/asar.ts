import { ArchiveError } from "./errors";
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
function invalid(key: string, values: Record<string, string> = {}): never {
  throw new ArchiveError(`errors.${key}`, values);
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export async function parseAsar(
  blob: Blob,
  name = "archive.asar",
): Promise<Archive> {
  if (blob.size < 16) invalid("headerIncomplete");
  const prefix = new DataView(await blob.slice(0, 16).arrayBuffer());
  const headerSize = prefix.getUint32(4, true);
  const jsonSize = prefix.getUint32(12, true);
  if (
    prefix.getUint32(0, true) !== 4 ||
    headerSize < 8 ||
    headerSize % 4 !== 0 ||
    prefix.getUint32(8, true) !== headerSize - 4
  )
    invalid("headerInvalid");
  if (
    headerSize > MAX_HEADER ||
    headerSize + 8 > blob.size ||
    jsonSize > headerSize - 8
  )
    invalid("headerSize");
  let header: unknown;
  try {
    header = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        await blob.slice(16, 16 + jsonSize).arrayBuffer(),
      ),
    );
  } catch {
    invalid("indexJson");
  }
  if (!record(header) || !record(header.files)) invalid("missingFiles");
  const entries: ArchiveEntry[] = [];
  const byPath = new Map<string, ArchiveEntry>();
  const dataOffset = headerSize + 8;
  const pending = [{ files: header.files, parent: "", depth: 0 }];
  while (pending.length) {
    const { files, parent, depth } = pending.pop()!;
    if (depth > 512) invalid("depth");
    for (const [entryName, node] of Object.entries(files)) {
      if (
        !entryName ||
        entryName === "." ||
        entryName === ".." ||
        /[/\\\0]/.test(entryName) ||
        !record(node)
      )
        invalid("entryInvalid");
      const path = parent ? `${parent}/${entryName}` : entryName;
      const base = { path, name: entryName, parent, depth, size: 0 };
      let entry: ArchiveEntry;
      if ("files" in node) {
        if (!record(node.files) || "link" in node || "offset" in node)
          invalid("directoryInvalid", { path });
        entry = { ...base, kind: "directory" };
        pending.push({ files: node.files, parent: path, depth: depth + 1 });
      } else if ("link" in node) {
        if (
          typeof node.link !== "string" ||
          node.link.startsWith("/") ||
          node.link.split("/").some((part) => part === "..") ||
          /[\\\0]/.test(node.link)
        )
          invalid("linkInvalid", { path });
        entry = { ...base, kind: "link", link: node.link };
      } else {
        if (!Number.isSafeInteger(node.size) || (node.size as number) < 0)
          invalid("fileSize", { path });
        if ("unpacked" in node && typeof node.unpacked !== "boolean")
          invalid("unpackedFlag", { path });
        const size = node.size as number;
        let offset: number | undefined;
        if (!node.unpacked) {
          if (typeof node.offset !== "string" || !/^\d+$/.test(node.offset))
            invalid("offset", { path });
          offset = Number(node.offset);
          if (
            !Number.isSafeInteger(offset) ||
            !Number.isSafeInteger(offset + size) ||
            offset + size > blob.size - dataOffset
          )
            invalid("outOfRange", { path });
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
      if (entries.length > MAX_ENTRIES) invalid("entryCount");
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
    if (seen.has(entry.path)) throw new ArchiveError("errors.linkCycle");
    seen.add(entry.path);
    const next = archive.byPath.get(entry.link!);
    if (!next)
      throw new ArchiveError("errors.linkMissing", { path: entry.link! });
    entry = next;
  }
  return entry;
}
export function entryBlob(archive: Archive, original: ArchiveEntry): Blob {
  const entry = resolveEntry(archive, original);
  if (entry.kind === "directory")
    throw new ArchiveError("errors.linkDirectory");
  if (entry.unpacked) throw new ArchiveError("errors.unpackedFile");
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
