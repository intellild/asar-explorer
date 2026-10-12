import { useTranslation } from "react-i18next";
import { ArchiveError, asArchiveError, errorMessage } from "~/lib/errors";
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
  | { kind: "large"; limit: number }
  | { kind: "binary" }
  | { kind: "error"; error: ArchiveError };
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
  const { t } = useTranslation();
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
              kind: "large",
              limit,
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
                    kind: "binary",
                  }
                : { kind: "text", text },
            );
        }
      } catch (error) {
        if (!cancelled)
          setPreview({
            kind: "error",
            error: asArchiveError(error, "errors.readFailed"),
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
            {t("preview.reading")}
          </div>
        )}
        {preview.kind === "text" && (
          <Suspense
            fallback={
              <div className="preview-message">
                {t("preview.loadingEditor")}
              </div>
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
                  error: new ArchiveError("errors.imageInvalid"),
                })
              }
            />
          </div>
        )}
        {(preview.kind === "large" || preview.kind === "binary") && (
          <div className="preview-message">
            <FileQuestion size={36} />
            <h3>
              {t(
                preview.kind === "large"
                  ? "preview.tooLarge"
                  : "preview.binary",
              )}
            </h3>
            <p>
              {preview.kind === "large"
                ? t(mime ? "preview.imageLimit" : "preview.textLimit", {
                    limit: formatSize(preview.limit),
                  })
                : t("preview.binaryHint")}
            </p>
            <Button variant="outline" onClick={onDownload}>
              <Download />
              {t("common.downloadFile")}
            </Button>
          </div>
        )}
        {preview.kind === "error" && (
          <div className="preview-message" role="alert">
            <FileQuestion size={36} />
            <h3>{t("preview.failed")}</h3>
            <p>{errorMessage(preview.error, t)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
