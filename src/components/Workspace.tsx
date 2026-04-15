import { useRef, useEffect } from 'react';

interface Props {
  name: string;
  logs: string[];
  previewUrl: string | null;
  previewHtml: string | null;
  canReload: boolean;
  onBack: () => void;
  onReload: () => void;
}

export function Workspace({
  name,
  logs,
  previewUrl,
  previewHtml,
  canReload,
  onBack,
  onReload,
}: Props) {
  const termRef = useRef<HTMLDivElement>(null);
  const hasPreview = !!previewUrl || !!previewHtml;
  const termOpen = !hasPreview;

  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="workspace">
      <div className="toolbar">
        <button className="back-btn" onClick={onBack}>
          &larr;
        </button>
        <span className="toolbar-title">{name}</span>
        {canReload ? (
          <button className="reload-btn" onClick={onReload}>
            Reload
          </button>
        ) : (
          <button className="tool-btn" onClick={onReload}>
            Reload
          </button>
        )}
      </div>

      <div className="workspace-body">
        <div className="preview-area">
          {previewUrl ? (
            <iframe src={previewUrl} title="Preview" />
          ) : previewHtml ? (
            <iframe srcDoc={previewHtml} title="Preview" />
          ) : (
            <div className="preview-empty">
              {canReload
                ? 'Run "make wasm" in your terminal, then click Reload'
                : logs.length > 0
                  ? 'Starting...'
                  : 'Loading...'}
            </div>
          )}
        </div>

        <details className="terminal-drawer" open={termOpen || undefined}>
          <summary>
            Terminal
            <span className="line-count">{logs.length} lines</span>
          </summary>
          <div className="terminal" ref={termRef}>
            {logs.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
