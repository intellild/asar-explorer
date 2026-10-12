import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocalePreference } from "~/i18n/useLocalePreference";
import { LanguageSelect } from "./LanguageSelect";
import { ArchiveError, asArchiveError, errorMessage } from "~/lib/errors";
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
  const { t } = useTranslation();
  useLocalePreference();
  const [archive, setArchive] = useState<Archive | null>(null);
  const [selected, setSelected] = useState<ArchiveEntry | null>(null);
  const [expanded, setExpanded] = useState(new Set<string>());
  const [query, setQuery] = useState("");
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ArchiveError | null>(null);
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
    setError(null);
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
        setError(asArchiveError(error, "errors.openFailed"));
    } finally {
      if (id === loadId.current) setBusy(false);
    }
  }, []);
  async function demo() {
    const id = ++loadId.current;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `${import.meta.env.PUBLIC_BASE_PATH}demo.asar`,
      );
      if (!response.ok) throw new ArchiveError("errors.demoFailed");
      const blob = await response.blob();
      if (id === loadId.current) await open(blob, "hello-electron.asar");
    } catch (error) {
      if (id === loadId.current) {
        setError(asArchiveError(error, "errors.demoFailed"));
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
      setError(asArchiveError(error, "errors.downloadFailed"));
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
        if (files.length > 1) setError(new ArchiveError("errors.oneFile"));
        else if (files[0]) void open(files[0], files[0].name);
      }}
    >
      <input
        ref={input}
        type="file"
        tabIndex={-1}
        accept=".asar"
        aria-label={t("workspace.selectFile")}
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
            <span>{t("workspace.title")}</span>
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
            <LanguageSelect />
            {selected && (
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("common.download")}
                onClick={download}
                disabled={
                  !selectedTarget ||
                  selectedTarget.kind === "directory" ||
                  selectedTarget.unpacked
                }
              >
                <Download />
                <span className="action-label">{t("common.download")}</span>
              </Button>
            )}
            <Button
              variant={archive ? "outline" : "ghost"}
              size="sm"
              onClick={() => input.current?.click()}
              aria-label={t(
                busy
                  ? "workspace.opening"
                  : archive
                    ? "workspace.openAnother"
                    : "workspace.open",
              )}
              disabled={busy}
            >
              {busy ? <LoaderCircle className="animate-spin" /> : <Upload />}
              <span className="open-label">
                {t(
                  busy
                    ? "workspace.opening"
                    : archive
                      ? "workspace.openAnother"
                      : "workspace.open",
                )}
              </span>
            </Button>
          </div>
        </div>
        {error && (
          <div className="error-banner" role="alert">
            <span>{errorMessage(error, t)}</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("common.closeError")}
              onClick={() => setError(null)}
            >
              <X />
            </Button>
          </div>
        )}
        <div className="workspace-body">
          <aside className="file-sidebar" aria-label={t("files.list")}>
            <div className="sidebar-heading">
              <span>{t("files.title")}</span>
              <span className="count-badge">
                {archive ? archive.fileCount.toLocaleString() : "—"}
              </span>
              <div className="tree-controls">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("files.expandAll")}
                  title={t("files.expandAll")}
                  onClick={expandAll}
                  disabled={!archive}
                >
                  <ChevronsUpDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("files.collapseAll")}
                  title={t("files.collapseAll")}
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
                aria-label={t("files.search")}
                placeholder={t("files.searchPlaceholder")}
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
                  aria-label={t("files.clearSearch")}
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
                  <p>{t("files.waiting")}</p>
                </div>
              ) : rows.length === 0 ? (
                <div className="list-empty">
                  {t(query ? "files.noMatches" : "files.empty")}
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
                          <span className="unpacked-label">
                            {t("files.external")}
                          </span>
                        ) : (
                          entry.kind !== "directory" && (
                            <span className="row-size">
                              {entry.kind === "link"
                                ? t("files.link")
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
            aria-label={t("workspace.resize")}
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
          <section className="preview-area" aria-label={t("workspace.preview")}>
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
                <p>{t("workspace.chooseToPreview")}</p>
                <span className="subtle-tag">
                  <Check size={13} />
                  {t("workspace.fileReady", { name: archive.name })}
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
                  aria-label={t("drop.label")}
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
                  <h2>{t(busy ? "drop.opening" : "drop.title")}</h2>
                  <p>{t("drop.hint")}</p>
                  <span className="choose-button">
                    {busy ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                      <Upload size={16} />
                    )}
                    {t("drop.choose")}
                    <ArrowRight size={15} />
                  </span>
                  <span className="dropzone-note">{t("drop.note")}</span>
                </div>
                <div className="demo-line">
                  <span>{t("drop.noFile")}</span>
                  <button onClick={() => void demo()} disabled={busy}>
                    {t("drop.demo")}
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
              ? `${t("files.count", { count: archive.fileCount })} · ${formatSize(archive.blob.size)}`
              : t("workspace.waiting")}
          </span>
          {selected && (
            <span className="file-status">
              <span>
                {!previewStatus || previewStatus.language === "FILE"
                  ? t("files.fileType")
                  : previewStatus.language === "IMAGE"
                    ? t("files.imageType")
                    : previewStatus.language}
              </span>
              <span>{formatSize(selectedTarget?.size ?? selected.size)}</span>
              {previewStatus?.lineCount !== undefined && (
                <span>
                  {t("files.lines", { count: previewStatus.lineCount })}
                </span>
              )}
              <span>
                <ShieldCheck size={12} />
                {t("common.readOnly")}
              </span>
            </span>
          )}
          <span className="workspace-ready">
            <span className="tiny-status" />
            {t(
              busy
                ? "workspace.reading"
                : archive
                  ? "workspace.opened"
                  : "workspace.ready",
            )}
          </span>
        </div>
      </div>
      {dragging && (
        <div className="drag-overlay">
          <div>
            <Upload size={38} />
            <h2>{t("drop.release")}</h2>
            <p>{t("drop.localOnly")}</p>
          </div>
        </div>
      )}
    </main>
  );
}
