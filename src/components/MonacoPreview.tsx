import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/editor/editor.api.js";
import "monaco-editor/basic-languages/monaco.contribution.js";
import "monaco-editor/language/json/monaco.contribution.js";

self.MonacoEnvironment = {
  getWorker(_moduleId, label) {
    if (label === "json")
      return new Worker(
        new URL("monaco-editor/language/json/json.worker.js", import.meta.url),
        { type: "module" },
      );
    return new Worker(
      new URL("monaco-editor/editor/editor.worker.js", import.meta.url),
      { type: "module" },
    );
  },
};
loader.config({ monaco });

export default function MonacoPreview({
  text,
  language,
  path,
}: {
  text: string;
  language: string;
  path: string;
}) {
  return (
    <Editor
      height="100%"
      path={path}
      value={text}
      language={language}
      theme="asar-light"
      loading={<div className="preview-message">正在加载代码编辑器…</div>}
      beforeMount={(editor) =>
        editor.editor.defineTheme("asar-light", {
          base: "vs",
          inherit: true,
          rules: [],
          colors: {
            "editor.background": "#ffffff",
            "editorLineNumber.foreground": "#b1b9c3",
            "editor.lineHighlightBackground": "#f7f9fa",
            "editor.selectionBackground": "#d6ece5",
          },
        })
      }
      options={{
        readOnly: true,
        domReadOnly: true,
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
        lineHeight: 23,
        padding: { top: 20, bottom: 20 },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: "on",
        renderLineHighlight: "none",
        overviewRulerLanes: 0,
        folding: true,
        contextmenu: false,
        stickyScroll: { enabled: false },
        links: false,
      }}
    />
  );
}
