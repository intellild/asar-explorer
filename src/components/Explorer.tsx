import { useCallback, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowRight,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Code2,
  File,
  FileCode2,
  FileImage,
  Download,
  Folder,
  FolderOpen,
  HardDrive,
  Link2,
  LoaderCircle,
  Search,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { FilePreview, type PreviewStatus } from "./FilePreview";
import {
  parseAsar,
  entryBlob,
  resolveEntry,
  visibleEntries,
  type Archive,
  type ArchiveEntry,
} from "~/lib/asar";
import { imageType } from "~/lib/preview";
import { formatSize } from "~/lib/utils";

export function Explorer() {
  const [archive, setArchive] = useState<Archive | null>(null);
  const [selected, setSelected] = useState<ArchiveEntry | null>(null);
  const [expanded, setExpanded] = useState(new Set<string>());
  const [query, setQuery] = useState("");
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(31);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const dragDepth = useRef(0);
  const loadId = useRef(0);
  const rows = useMemo(
    () => (archive ? visibleEntries(archive, expanded, query) : []),
    [archive, expanded, query],
  );
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => list.current,
    estimateSize: () => 36,
    overscan: 12,
    getItemKey: (index) => rows[index].path,
  });
  const open = useCallback(async (blob: Blob, name: string) => {
    const id = ++loadId.current;
    setBusy(true);
    setError("");
    try {
      const next = await parseAsar(blob, name);
      if (id !== loadId.current) return;
      setArchive(next);
      setSelected(null);
      setPreviewStatus(null);
      setExpanded(new Set());
      setQuery("");
      if (list.current) list.current.scrollTop = 0;
    } catch (error) {
      if (id === loadId.current)
        setError(error instanceof Error ? error.message : "打开文件失败。");
    } finally {
      if (id === loadId.current) setBusy(false);
    }
  }, []);
  async function demo() {
    const id = ++loadId.current;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${import.meta.env.PUBLIC_BASE_PATH}demo.asar`,
      );
      if (!response.ok) throw new Error("示例文件加载失败，请重试。");
      const blob = await response.blob();
      if (id === loadId.current) await open(blob, "hello-electron.asar");
    } catch (error) {
      if (id === loadId.current) {
        setError(error instanceof Error ? error.message : "示例加载失败。");
        setBusy(false);
      }
    }
  }
  function toggle(entry: ArchiveEntry) {
    if (entry.kind !== "directory") {
      setSelected(entry);
      setPreviewStatus(null);
      return;
    }
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(entry.path)) next.delete(entry.path);
      else next.add(entry.path);
      return next;
    });
  }
  function expandAll() {
    if (archive)
      setExpanded(
        new Set(
          archive.entries
            .filter((entry) => entry.kind === "directory")
            .map((entry) => entry.path),
        ),
      );
  }
  function resize(clientX: number) {
    const rect = workspace.current?.getBoundingClientRect();
    if (rect)
      setSidebarWidth(
        Math.max(22, Math.min(55, ((clientX - rect.left) / rect.width) * 100)),
      );
  }
  const selectedTarget = useMemo(() => {
    if (!archive || !selected) return null;
    try {
      return resolveEntry(archive, selected);
    } catch {
      return null;
    }
  }, [archive, selected]);
  function download() {
    if (!archive || !selected) return;
    try {
      const url = URL.createObjectURL(entryBlob(archive, selected));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = selected.name;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setError(error instanceof Error ? error.message : "下载失败。");
    }
  }
  return (
    <main
      className="app-shell"
      onDragEnter={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          dragDepth.current++;
          setDragging(true);
        }
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDragLeave={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          dragDepth.current--;
          if (dragDepth.current <= 0) setDragging(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        const files = event.dataTransfer.files;
        if (files.length > 1) setError("请一次打开一个 ASAR 文件。");
        else if (files[0]) void open(files[0], files[0].name);
      }}
    >
      <input
        ref={input}
        type="file"
        tabIndex={-1}
        accept=".asar"
        aria-label="选择 ASAR 文件"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void open(file, file.name);
          event.target.value = "";
        }}
      />
      <div
        className="workspace"
        ref={workspace}
        style={{ "--sidebar-width": `${sidebarWidth}%` } as React.CSSProperties}
      >
        <div className="workspace-bar">
          <div className="workspace-label">
            <span className="tiny-status" />
            <span>工作区</span>
            {archive && (
              <span className="archive-crumb">
                <span className="slash">/</span>
                <span className="archive-name" title={archive.name}>
                  {archive.name}
                </span>
              </span>
            )}
          </div>
          {selected && (
            <div className="selected-file" title={selected.path}>
              {imageType(selectedTarget?.path ?? selected.path) ? (
                <FileImage size={16} />
              ) : (
                <FileCode2 size={16} />
              )}
              <span>{selected.path}</span>
            </div>
          )}
          <div className="workspace-actions">
            {selected && (
              <Button
                variant="ghost"
                size="sm"
                onClick={download}
                disabled={
                  !selectedTarget ||
                  selectedTarget.kind === "directory" ||
                  selectedTarget.unpacked
                }
              >
                <Download />
                下载
              </Button>
            )}
            <Button
              variant={archive ? "outline" : "ghost"}
              size="sm"
              onClick={() => input.current?.click()}
              disabled={busy}
            >
              {busy ? <LoaderCircle className="animate-spin" /> : <Upload />}
              <span className="open-label">
                {busy ? "正在打开…" : archive ? "打开其他文件" : "打开文件"}
              </span>
            </Button>
          </div>
        </div>
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="关闭错误提示"
              onClick={() => setError("")}
            >
              <X />
            </Button>
          </div>
        )}
        <div className="workspace-body">
          <aside className="file-sidebar" aria-label="归档文件列表">
            <div className="sidebar-heading">
              <span>文件目录</span>
              <span className="count-badge">
                {archive ? archive.fileCount.toLocaleString() : "—"}
              </span>
              <div className="tree-controls">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="展开所有目录"
                  title="展开所有目录"
                  onClick={expandAll}
                  disabled={!archive}
                >
                  <ChevronsUpDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="折叠所有目录"
                  title="折叠所有目录"
                  onClick={() => setExpanded(new Set())}
                  disabled={!archive}
                >
                  <ChevronsDownUp />
                </Button>
              </div>
            </div>
            <div className="search-wrap">
              <Search size={15} />
              <Input
                aria-label="搜索文件"
                placeholder="搜索文件或路径…"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  if (list.current) list.current.scrollTop = 0;
                }}
                disabled={!archive}
              />
              {query && (
                <button
                  className="clear-search"
                  aria-label="清空搜索"
                  onClick={() => setQuery("")}
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <div className="file-list" ref={list}>
              {!archive ? (
                <div className="sidebar-empty">
                  <div className="ghost-tree" aria-hidden="true">
                    <span>
                      <Folder size={16} />
                      your-app.asar
                    </span>
                    <span className="ghost-indent">
                      <Folder size={16} />
                      src
                    </span>
                    <span className="ghost-indent deep">
                      <FileCode2 size={15} />
                      main.js
                    </span>
                    <span className="ghost-indent">
                      <FileCode2 size={15} />
                      package.json
                    </span>
                  </div>
                  <p>打开归档后，文件会显示在这里</p>
                </div>
              ) : rows.length === 0 ? (
                <div className="list-empty">
                  {query ? "没有匹配的文件" : "此归档没有文件"}
                </div>
              ) : (
                <div
                  style={{
                    height: virtualizer.getTotalSize(),
                    position: "relative",
                    width: "100%",
                  }}
                >
                  {virtualizer.getVirtualItems().map((row) => {
                    const entry = rows[row.index];
                    const isOpen = expanded.has(entry.path);
                    const Icon =
                      entry.kind === "directory"
                        ? isOpen
                          ? FolderOpen
                          : Folder
                        : entry.kind === "link"
                          ? Link2
                          : imageType(entry.path)
                            ? FileImage
                            : /\.(json|[cm]?js|tsx?|css|html|md|yml|svg)$/i.test(
                                  entry.name,
                                )
                              ? FileCode2
                              : File;
                    return (
                      <button
                        key={entry.path}
                        data-testid="file-row"
                        aria-expanded={
                          entry.kind === "directory" ? isOpen : undefined
                        }
                        aria-pressed={
                          entry.kind !== "directory"
                            ? selected?.path === entry.path
                            : undefined
                        }
                        className={`file-row ${selected?.path === entry.path ? "selected" : ""} ${entry.kind === "directory" ? "directory" : ""}`}
                        style={{
                          height: row.size,
                          transform: `translateY(${row.start}px)`,
                          paddingLeft:
                            13 + (query ? 0 : Math.min(entry.depth, 12)) * 16,
                        }}
                        title={entry.path}
                        onClick={() => toggle(entry)}
                      >
                        <span className="tree-chevron">
                          {entry.kind === "directory" &&
                            (isOpen ? (
                              <ChevronDown size={13} />
                            ) : (
                              <ChevronRight size={13} />
                            ))}
                        </span>
                        <Icon size={16} />
                        <span className="row-name">
                          {query ? entry.path : entry.name}
                        </span>
                        {entry.unpacked ? (
                          <span className="unpacked-label">外部</span>
                        ) : (
                          entry.kind !== "directory" && (
                            <span className="row-size">
                              {entry.kind === "link"
                                ? "链接"
                                : formatSize(entry.size)}
                            </span>
                          )
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
          <div
            className="splitter"
            role="separator"
            aria-label="调整文件列表宽度"
            aria-orientation="vertical"
            aria-valuemin={22}
            aria-valuemax={55}
            aria-valuenow={Math.round(sidebarWidth)}
            tabIndex={0}
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              resize(event.clientX);
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                resize(event.clientX);
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                setSidebarWidth((value) =>
                  Math.max(
                    22,
                    Math.min(55, value + (event.key === "ArrowLeft" ? -2 : 2)),
                  ),
                );
              }
            }}
          />
          <section className="preview-area" aria-label="文件预览">
            {archive && selected ? (
              <FilePreview
                key={selected.path}
                archive={archive}
                entry={selected}
                onDownload={download}
                onStatusChange={setPreviewStatus}
              />
            ) : archive ? (
              <div className="selection-empty">
                <div className="selection-icon">
                  <Code2 size={32} strokeWidth={1.3} />
                </div>
                <p>从左侧选择文件，即可在这里预览。</p>
                <span className="subtle-tag">
                  <Check size={13} />
                  {archive.name} 已就绪
                </span>
              </div>
            ) : (
              <div className="welcome-preview">
                <div
                  className="dropzone"
                  onClick={() => {
                    if (!busy) input.current?.click();
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label="拖入或选择 ASAR 文件"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      if (!busy) input.current?.click();
                    }
                  }}
                  aria-disabled={busy}
                >
                  <div className="archive-art" aria-hidden="true">
                    <span className="art-orbit orbit-one" />
                    <span className="art-orbit orbit-two" />
                    <span className="art-file file-one">
                      <FileCode2 size={22} />
                    </span>
                    <span className="art-file file-two">
                      <FileImage size={20} />
                    </span>
                    <span className="art-box">
                      <Box size={48} strokeWidth={1.2} />
                    </span>
                    <span className="art-spark">+</span>
                  </div>
                  <span className="filetype-chip">.ASAR</span>
                  <h2>{busy ? "正在打开归档…" : "把 ASAR 文件拖到这里"}</h2>
                  <p>或者点击选择本地文件</p>
                  <span className="choose-button">
                    {busy ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                      <Upload size={16} />
                    )}
                    选择文件
                    <ArrowRight size={15} />
                  </span>
                  <span className="dropzone-note">
                    Electron 应用归档 · 无需安装
                  </span>
                </div>
                <div className="demo-line">
                  <span>还没有文件？</span>
                  <button onClick={() => void demo()} disabled={busy}>
                    试试示例归档
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
        <div className="workspace-status">
          <span className="archive-status">
            <HardDrive size={13} />
            {archive
              ? `${archive.fileCount.toLocaleString()} 个文件 · ${formatSize(archive.blob.size)}`
              : "等待打开归档"}
          </span>
          {selected && (
            <span className="file-status">
              <span>{previewStatus?.language ?? "FILE"}</span>
              <span>{formatSize(selectedTarget?.size ?? selected.size)}</span>
              {previewStatus?.lineCount !== undefined && (
                <span>{previewStatus.lineCount.toLocaleString()} 行</span>
              )}
              <span>
                <ShieldCheck size={12} />
                只读
              </span>
            </span>
          )}
          <span className="workspace-ready">
            <span className="tiny-status" />
            {busy ? "正在读取" : archive ? "归档已打开" : "准备就绪"}
          </span>
        </div>
      </div>
      {dragging && (
        <div className="drag-overlay">
          <div>
            <Upload size={38} />
            <h2>松开鼠标，打开归档</h2>
            <p>文件只会在本地读取</p>
          </div>
        </div>
      )}
    </main>
  );
}
