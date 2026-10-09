import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { useProfile } from "../data/hooks";

export function PythonEditor({ value, onChange, height = "20rem", readOnly = false }: { value: string; onChange: (v: string) => void; height?: string; readOnly?: boolean }) {
  const profile = useProfile();
  const dark = (profile?.settings.theme ?? "dark") === "dark";
  return (
    <div className="rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }} data-testid="python-editor">
      <CodeMirror
        value={value}
        height={height}
        extensions={[python()]}
        theme={dark ? oneDark : "light"}
        onChange={onChange}
        readOnly={readOnly}
        basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true, tabSize: 4 }}
        aria-label="Python code editor"
      />
    </div>
  );
}
