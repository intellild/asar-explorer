export const PREVIEW_LIMIT = 2 * 1024 * 1024;
export const IMAGE_PREVIEW_LIMIT = 20 * 1024 * 1024;
const languages: Record<string, string> = {
  js: "javascript",
  cjs: "javascript",
  mjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  json: "json",
  css: "css",
  scss: "scss",
  html: "html",
  htm: "html",
  xml: "xml",
  svg: "xml",
  md: "markdown",
  mdx: "markdown",
  yml: "yaml",
  yaml: "yaml",
  toml: "ini",
  ini: "ini",
  sh: "shell",
  bash: "shell",
  py: "python",
  rs: "rust",
  c: "c",
  h: "c",
  cpp: "cpp",
  go: "go",
  sql: "sql",
  txt: "plaintext",
};
const images: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  bmp: "image/bmp",
};
export function extension(path: string) {
  return path.split(".").pop()?.toLowerCase() ?? "";
}
export function languageFor(path: string) {
  return languages[extension(path)] ?? "plaintext";
}
export function imageType(path: string) {
  return images[extension(path)];
}
export function decodeText(bytes: ArrayBuffer): string | null {
  const data = new Uint8Array(bytes);
  let encoding = "utf-8";
  if (data[0] === 0xff && data[1] === 0xfe) encoding = "utf-16le";
  if (data[0] === 0xfe && data[1] === 0xff) encoding = "utf-16be";
  try {
    const text = new TextDecoder(encoding, { fatal: true }).decode(data);
    if (/[\x00-\x08\x0e-\x1f]/.test(text)) return null;
    return text;
  } catch {
    return null;
  }
}
