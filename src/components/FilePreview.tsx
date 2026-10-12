import { lazy, Suspense, useEffect, useState } from "react";
import { Download, FileQuestion, LoaderCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  entryBlob,
  resolveEntry,
  type Archive,
  type ArchiveEntry,
} from "~/lib/asar";
import {
  decodeText,
  imageType,
  languageFor,
  PREVIEW_LIMIT,
  IMAGE_PREVIEW_LIMIT,
} from "~/lib/preview";
import { formatSize } from "~/lib/utils";

const MonacoPreview = lazy(() => import("./MonacoPreview"));
type Preview =
  | { kind: "loading" }
  | { kind: "text"; text: string }
  | { kind: "image"; url: string }
  | { kind: "message"; title: string; detail: string }
  | { kind: "error"; message: string };
export interface PreviewStatus {
  language: string;
  lineCount?: number;
}
export function FilePreview({
  archive,
  entry,
  onDownload,
  onStatusChange,
}: {
  archive: Archive;
  entry: ArchiveEntry;
  onDownload: () => void;
  onStatusChange: (status: PreviewStatus) => void;
}) {
  const [preview, setPreview] = useState<Preview>({ kind: "loading" });
  let target: ArchiveEntry | undefined;
  try {
    target = resolveEntry(archive, entry);
  } catch {
    /* Reported by preview effect. */
  }
  const mime = imageType(target?.path ?? entry.path);
  const language = languageFor(target?.path ?? entry.path);
  useEffect(() => {
    let cancelled = false;
    let imageUrl: string | undefined;
    setPreview({ kind: "loading" });
    async function read() {
      try {
        const blob = entryBlob(archive, entry);
        const limit = mime ? IMAGE_PREVIEW_LIMIT : PREVIEW_LIMIT;
        if (blob.size > limit) {
          if (!cancelled)
            setPreview({
              kind: "message",
              title: "文件较大，暂不预览",
              detail: `${mime ? "图片" : "文本"}预览上限为 ${formatSize(limit)}。你仍然可以下载完整文件。`,
            });
        } else if (mime) {
          imageUrl = URL.createObjectURL(new Blob([blob], { type: mime }));
          if (!cancelled) setPreview({ kind: "image", url: imageUrl });
        } else {
          const text = decodeText(await blob.arrayBuffer());
          if (!cancelled)
            setPreview(
              text === null
                ? {
                    kind: "message",
                    title: "这是一个二进制文件",
                    detail:
                      "此格式不支持直接预览，可以下载后使用相应应用打开。",
                  }
                : { kind: "text", text },
            );
        }
      } catch (error) {
        if (!cancelled)
          setPreview({
            kind: "error",
            message: error instanceof Error ? error.message : "读取文件失败。",
          });
      }
    }
    void read();
    return () => {
      cancelled = true;
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [archive, entry, mime]);
  useEffect(() => {
    onStatusChange(
      preview.kind === "text"
        ? {
            language: language.toUpperCase(),
            lineCount: preview.text.split("\n").length,
          }
        : { language: mime ? "IMAGE" : "FILE" },
    );
  }, [preview, language, mime, onStatusChange]);
  return (
    <div className="preview-panel">
      <div className="preview-content" data-testid="file-preview">
        {preview.kind === "loading" && (
          <div className="preview-message">
            <LoaderCircle className="animate-spin" />
            正在读取文件…
          </div>
        )}
        {preview.kind === "text" && (
          <Suspense
            fallback={
              <div className="preview-message">正在加载代码编辑器…</div>
            }
          >
            <MonacoPreview
              text={preview.text}
              language={language}
              path={entry.path}
            />
          </Suspense>
        )}
        {preview.kind === "image" && (
          <div className="image-preview">
            <img
              src={preview.url}
              alt={entry.name}
              onError={() =>
                setPreview({
                  kind: "error",
                  message: "图片内容无效或浏览器不支持此图片格式。",
                })
              }
            />
          </div>
        )}
        {preview.kind === "message" && (
          <div className="preview-message">
            <FileQuestion size={36} />
            <h3>{preview.title}</h3>
            <p>{preview.detail}</p>
            <Button variant="outline" onClick={onDownload}>
              <Download />
              下载文件
            </Button>
          </div>
        )}
        {preview.kind === "error" && (
          <div className="preview-message" role="alert">
            <FileQuestion size={36} />
            <h3>无法预览此文件</h3>
            <p>{preview.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
