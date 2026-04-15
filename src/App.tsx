import { useState, useEffect, useCallback, useRef } from 'react';
import { Launcher } from './components/Launcher';
import { Workspace } from './components/Workspace';
import { templates } from './templates';
import {
  boot,
  onServerReady,
  runNodeProject,
  runPython,
  runWasmDemo,
  mountLocalFolder,
  reloadFolder,
  stop,
} from './container';
import './App.css';

type View = 'launcher' | 'workspace';

export function App() {
  const [view, setView] = useState<View>('launcher');
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [canReload, setCanReload] = useState(false);
  const logsRef = useRef(logs);
  logsRef.current = logs;

  const addLog = useCallback((text: string) => {
    const lines = text.split('\n').filter((l) => l.length > 0);
    if (lines.length > 0) {
      setLogs((prev) => [...prev, ...lines]);
    }
  }, []);

  useEffect(() => {
    boot()
      .then(() => {
        setReady(true);
        onServerReady((_port, url) => setPreviewUrl(url));
      })
      .catch((err) => {
        addLog(`Boot failed: ${err.message}`);
      });
  }, [addLog]);

  const handleSelect = useCallback(
    async (id: string) => {
      const tpl = templates.find((t) => t.id === id);
      if (!tpl) return;

      setView('workspace');
      setName(tpl.name);
      setLogs([]);
      setPreviewUrl(null);
      setPreviewHtml(null);
      setCanReload(false);

      if (tpl.runtime === 'python' && tpl.code) {
        const output = await runPython(tpl.code, addLog);
        if (output.trim().startsWith('<!')) {
          setPreviewHtml(output);
        }
      } else if (tpl.runtime === 'wasm') {
        const html = await runWasmDemo(addLog);
        setPreviewHtml(html);
      } else if (tpl.files) {
        await runNodeProject(tpl.files, addLog);
      }
    },
    [addLog],
  );

  const handleOpenFolder = useCallback(async () => {
    try {
      setView('workspace');
      setLogs([]);
      setPreviewUrl(null);
      setPreviewHtml(null);
      setCanReload(false);

      const result = await mountLocalFolder(addLog);
      setName(result.name ?? 'Local Project');
      if (result.html) setPreviewHtml(result.html);
      if (result.needsReload) setCanReload(true);
    } catch (err) {
      if ((err as DOMException).name !== 'AbortError') {
        addLog(`Error: ${(err as Error).message}`);
      } else {
        setView('launcher');
      }
    }
  }, [addLog]);

  const handleReload = useCallback(async () => {
    if (canReload) {
      // Re-scan the folder for .wasm files
      setLogs([]);
      setPreviewUrl(null);
      setPreviewHtml(null);
      const result = await reloadFolder(addLog);
      if (result) {
        setName(result.name);
        if (result.html) setPreviewHtml(result.html);
        setCanReload(!!result.needsReload);
      }
    } else if (previewUrl) {
      setPreviewUrl(previewUrl + '#' + Date.now());
    }
  }, [canReload, previewUrl, addLog]);

  const handleBack = useCallback(async () => {
    await stop();
    setView('launcher');
    setPreviewUrl(null);
    setPreviewHtml(null);
    setCanReload(false);
    setLogs([]);
  }, []);

  if (view === 'launcher') {
    return (
      <Launcher
        ready={ready}
        onSelect={handleSelect}
        onOpenFolder={handleOpenFolder}
      />
    );
  }

  return (
    <Workspace
      name={name}
      logs={logs}
      previewUrl={previewUrl}
      previewHtml={previewHtml}
      canReload={canReload}
      onBack={handleBack}
      onReload={handleReload}
    />
  );
}
