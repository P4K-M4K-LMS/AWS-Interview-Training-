import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { go } from "@codemirror/lang-go";
import { javascript } from "@codemirror/lang-javascript";
import type { CodeLanguage } from "../domain/types";
import { oneDark } from "@codemirror/theme-one-dark";
import { useProfile } from "../data/hooks";

export function PythonEditor({ value, onChange, height = "20rem", readOnly = false, language = "python" }: { value: string; onChange: (v: string) => void; height?: string; readOnly?: boolean; language?: CodeLanguage | "javascript" }) {
  const profile = useProfile();
  const dark = (profile?.settings.theme ?? "dark") === "dark";
  return (
    <div className="rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }} data-testid="code-editor">
      <CodeMirror
        value={value}
        height={height}
        extensions={[language === "go" ? go() : language === "javascript" ? javascript() : python()]}
        theme={dark ? oneDark : "light"}
        onChange={onChange}
        readOnly={readOnly}
        basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true, tabSize: 4 }}
        aria-label={`${language === "go" ? "Go" : language === "javascript" ? "JavaScript" : "Python"} code editor`}
      />
    </div>
  );
}
