import { templates } from '../templates';

interface Props {
  ready: boolean;
  onSelect: (id: string) => void;
  onOpenFolder: () => void;
}

export function Launcher({ ready, onSelect, onOpenFolder }: Props) {
  return (
    <div className="launcher">
      <div className="launcher-inner">
        <h1 className="logo">Launchpad</h1>
        <p className="tagline">
          Run servers and prototypes entirely in your browser
        </p>

        <div className="grid">
          {templates.map((t) => (
            <button
              key={t.id}
              className="card"
              disabled={!ready}
              onClick={() => onSelect(t.id)}
            >
              <span className="card-icon">{t.icon}</span>
              <span className="card-name">{t.name}</span>
              <span className="card-desc">{t.description}</span>
              {t.runtime === 'python' && (
                <span className="card-tag">Wasm</span>
              )}
            </button>
          ))}
        </div>

        <div className="launcher-footer">
          <button
            className="open-btn"
            disabled={!ready}
            onClick={onOpenFolder}
          >
            Open Local Folder
          </button>
          <p className="hint">
            {ready
              ? 'Runtime ready. Pick a template or open your own project.'
              : 'Booting runtime...'}
          </p>
        </div>
      </div>
    </div>
  );
}
