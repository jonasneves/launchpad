import { WebContainer, type FileSystemTree } from '@webcontainer/api';

declare global {
  interface Window {
    showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
  }
}

let instance: WebContainer | null = null;
let currentProcess: { kill: () => void } | null = null;

// Clean terminal output: strip ANSI escapes, handle \r overwrites, drop spinner noise
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?\x07/g;
const SPINNER_RE = /^[\s\\|/\-–—_]*$/;

function cleanOutput(raw: string): string {
  // Strip ANSI codes
  let text = raw.replace(ANSI_RE, '');
  // \r without \n means "overwrite this line" — keep only the last segment
  if (text.includes('\r') && !text.includes('\n')) {
    const parts = text.split('\r');
    text = parts[parts.length - 1];
  }
  // Drop lines that are just spinner frames or whitespace
  if (SPINNER_RE.test(text.trim())) return '';
  return text;
}

function logStream(onLog: (text: string) => void) {
  return new WritableStream({
    write: (data) => {
      const cleaned = cleanOutput(data);
      if (cleaned) onLog(cleaned);
    },
  });
}

export async function boot(): Promise<WebContainer> {
  if (instance) return instance;
  instance = await WebContainer.boot();
  return instance;
}

export function onServerReady(cb: (port: number, url: string) => void) {
  instance?.on('server-ready', cb);
}

export async function stop() {
  if (currentProcess) {
    currentProcess.kill();
    currentProcess = null;
  }
}

export async function runNodeProject(
  files: FileSystemTree,
  onLog: (text: string) => void,
) {
  if (!instance) throw new Error('WebContainer not booted');
  await stop();
  await instance.mount(files);

  const pkg = files['package.json'];
  if (!pkg || !('file' in pkg)) return;

  const manifest = JSON.parse((pkg.file as { contents: string }).contents);
  const hasDeps =
    Object.keys(manifest.dependencies ?? {}).length > 0 ||
    Object.keys(manifest.devDependencies ?? {}).length > 0;

  if (hasDeps) {
    onLog('Installing dependencies...\n');
    const install = await instance.spawn('npm', ['install']);
    install.output.pipeTo(logStream(onLog));
    const code = await install.exit;
    if (code !== 0) {
      onLog(`\nnpm install failed (exit ${code})\n`);
      return;
    }
    onLog('\nDependencies installed.\n\n');
  }

  let cmd: string;
  let args: string[];

  if (manifest.scripts?.dev) {
    cmd = 'npm';
    args = ['run', 'dev'];
  } else if (manifest.scripts?.start) {
    cmd = 'npm';
    args = ['run', 'start'];
  } else if ('index.js' in files) {
    cmd = 'node';
    args = ['index.js'];
  } else {
    onLog('No start command found.\n');
    return;
  }

  onLog(`> ${cmd} ${args.join(' ')}\n`);
  const proc = await instance.spawn(cmd, args);
  currentProcess = proc;
  proc.output.pipeTo(logStream(onLog));
}

export async function runPython(
  code: string,
  onLog: (text: string) => void,
): Promise<string> {
  onLog('Loading Python runtime (Pyodide)...\n');

  const { loadPyodide } = await import(
    // @ts-expect-error CDN import
    'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.mjs'
  );

  const pyodide = await loadPyodide();
  onLog('Python ready.\n\n');

  let output = '';
  pyodide.setStdout({
    batched: (text: string) => {
      output += text + '\n';
      onLog(text + '\n');
    },
  });
  pyodide.setStderr({
    batched: (text: string) => onLog(`[stderr] ${text}\n`),
  });

  try {
    await pyodide.runPythonAsync(code);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    onLog(`\nError: ${msg}\n`);
  }

  return output;
}

// --- WebAssembly ---

// Hand-compiled Wasm binary: exports add(i32,i32)->i32, mul(i32,i32)->i32, fib(i32)->i32
const WASM_DEMO = new Uint8Array([
  0x00,0x61,0x73,0x6d, 0x01,0x00,0x00,0x00, // header
  0x01,0x0c,0x02,                             // type section (2 types)
  0x60,0x02,0x7f,0x7f,0x01,0x7f,             // type 0: (i32,i32)->i32
  0x60,0x01,0x7f,0x01,0x7f,                   // type 1: (i32)->i32
  0x03,0x04,0x03,0x00,0x00,0x01,             // func section: 3 funcs (type 0,0,1)
  0x07,0x11,0x03,                             // export section (3 exports)
  0x03,0x61,0x64,0x64,0x00,0x00,             // "add" -> func 0
  0x03,0x6d,0x75,0x6c,0x00,0x01,             // "mul" -> func 1
  0x03,0x66,0x69,0x62,0x00,0x02,             // "fib" -> func 2
  0x0a,0x41,0x03,                             // code section (3 bodies)
  // add: local.get 0, local.get 1, i32.add
  0x07,0x00,0x20,0x00,0x20,0x01,0x6a,0x0b,
  // mul: local.get 0, local.get 1, i32.mul
  0x07,0x00,0x20,0x00,0x20,0x01,0x6c,0x0b,
  // fib(n): iterative fibonacci
  0x2f,                                       // body size: 47 bytes
  0x01,0x04,0x7f,                             // 4 i32 locals (a,b,tmp,i)
  0x41,0x01,0x21,0x02,                       // b = 1
  0x02,0x40,                                   // block $break
  0x03,0x40,                                   // loop $loop
  0x20,0x04,0x20,0x00,0x4f,                   // i >= n (unsigned)
  0x0d,0x01,                                   // br_if $break
  0x20,0x01,0x20,0x02,0x6a,0x21,0x03,       // tmp = a + b
  0x20,0x02,0x21,0x01,                       // a = b
  0x20,0x03,0x21,0x02,                       // b = tmp
  0x20,0x04,0x41,0x01,0x6a,0x21,0x04,       // i++
  0x0c,0x00,                                   // br $loop
  0x0b,                                       // end loop
  0x0b,                                       // end block
  0x20,0x01,                                   // return a
  0x0b,                                       // end func
]);

export async function runWasmDemo(
  onLog: (text: string) => void,
): Promise<string> {
  onLog('Compiling WebAssembly module (hand-crafted binary)...\n');

  const module = await WebAssembly.compile(WASM_DEMO);
  const { exports } = await WebAssembly.instantiate(module);
  const wasm = exports as { add: (a: number, b: number) => number; mul: (a: number, b: number) => number; fib: (n: number) => number };

  onLog('Module instantiated. Running benchmarks...\n\n');

  // JS equivalents
  function jsFib(n: number): number {
    let a = 0, b = 1;
    for (let i = 0; i < n; i++) { const t = a + b; a = b; b = t; }
    return a;
  }

  // Verify correctness
  const testN = 10;
  onLog(`fib(${testN}): wasm=${wasm.fib(testN)}, js=${jsFib(testN)}\n`);
  onLog(`add(17, 25): ${wasm.add(17, 25)}\n`);
  onLog(`mul(6, 7): ${wasm.mul(6, 7)}\n\n`);

  // Benchmark
  const iterations = 1_000_000;
  const fibN = 30;

  function bench(label: string, fn: () => void): number {
    const start = performance.now();
    fn();
    const ms = performance.now() - start;
    onLog(`${label}: ${ms.toFixed(2)}ms (${iterations.toLocaleString()} iterations)\n`);
    return ms;
  }

  onLog('--- Fibonacci benchmark ---\n');
  const wasmFibMs = bench('Wasm fib(' + fibN + ')', () => {
    for (let i = 0; i < iterations; i++) wasm.fib(fibN);
  });
  const jsFibMs = bench('JS   fib(' + fibN + ')', () => {
    for (let i = 0; i < iterations; i++) jsFib(fibN);
  });

  onLog('\n--- Arithmetic benchmark ---\n');
  const wasmAddMs = bench('Wasm add', () => {
    for (let i = 0; i < iterations; i++) wasm.add(i, i);
  });
  const jsAddMs = bench('JS   add', () => {
    for (let i = 0; i < iterations; i++) i + i; // eslint-disable-line @typescript-eslint/no-unused-expressions
  });

  const ratio = (jsFibMs / wasmFibMs).toFixed(1);
  onLog(`\nWasm/JS ratio: ${ratio}x\n`);

  // Generate results HTML
  interface BenchResult { name: string; wasm: number; js: number }
  const results: BenchResult[] = [
    { name: `fib(${fibN})`, wasm: wasmFibMs, js: jsFibMs },
    { name: 'add', wasm: wasmAddMs, js: jsAddMs },
  ];

  const maxMs = Math.max(...results.flatMap((r) => [r.wasm, r.js]));

  const bars = results
    .map((r) => {
      const wW = (r.wasm / maxMs) * 280;
      const jW = (r.js / maxMs) * 280;
      return `
      <div class="bench-row">
        <div class="bench-label">${r.name}</div>
        <div class="bench-bars">
          <div class="bar-group">
            <span class="bar-tag">Wasm</span>
            <div class="bar wasm" style="width:${wW}px"></div>
            <span class="bar-val">${r.wasm.toFixed(1)}ms</span>
          </div>
          <div class="bar-group">
            <span class="bar-tag">JS</span>
            <div class="bar js" style="width:${jW}px"></div>
            <span class="bar-val">${r.js.toFixed(1)}ms</span>
          </div>
        </div>
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * { margin: 0; box-sizing: border-box; }
  body { font-family: system-ui; background: #0f172a; color: #e2e8f0; padding: 40px; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .sub { color: #64748b; font-size: 13px; margin-bottom: 28px; }
  .stats { display: flex; gap: 16px; margin-bottom: 28px; }
  .stat { background: #1e293b; padding: 14px 18px; border-radius: 10px; flex: 1; }
  .stat .label { font-size: 11px; color: #64748b; margin-bottom: 4px; }
  .stat .value { font-size: 20px; font-weight: 600; }
  .benches { background: #1e293b; border-radius: 10px; padding: 24px; }
  .bench-row { margin-bottom: 20px; }
  .bench-row:last-child { margin-bottom: 0; }
  .bench-label { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
  .bar-group { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .bar-tag { font-size: 11px; color: #94a3b8; width: 36px; }
  .bar { height: 20px; border-radius: 4px; transition: width 0.3s; }
  .bar.wasm { background: #3b82f6; }
  .bar.js { background: #f59e0b; }
  .bar-val { font-size: 12px; color: #94a3b8; font-variant-numeric: tabular-nums; }
  .src { margin-top: 24px; }
  .src summary { font-size: 12px; color: #64748b; cursor: pointer; margin-bottom: 8px; }
  .src pre { background: #0f172a; border-radius: 8px; padding: 16px; font-size: 12px;
             overflow-x: auto; color: #94a3b8; line-height: 1.6; }
  .tag { margin-top: 20px; font-size: 11px; color: #475569; }
</style></head><body>
  <h1>WebAssembly Benchmark</h1>
  <p class="sub">${iterations.toLocaleString()} iterations per test. Hand-compiled Wasm binary vs V8 JIT.</p>
  <div class="stats">
    <div class="stat"><div class="label">Wasm fib(${fibN})</div><div class="value">${wasmFibMs.toFixed(1)}ms</div></div>
    <div class="stat"><div class="label">JS fib(${fibN})</div><div class="value">${jsFibMs.toFixed(1)}ms</div></div>
    <div class="stat"><div class="label">Ratio</div><div class="value">${ratio}x</div></div>
    <div class="stat"><div class="label">Module size</div><div class="value">${WASM_DEMO.length}B</div></div>
  </div>
  <div class="benches">${bars}</div>
  <details class="src">
    <summary>Equivalent Rust source (what you'd compile to get this)</summary>
    <pre>#[no_mangle]
pub extern "C" fn add(a: i32, b: i32) -> i32 { a + b }

#[no_mangle]
pub extern "C" fn mul(a: i32, b: i32) -> i32 { a * b }

#[no_mangle]
pub extern "C" fn fib(n: i32) -> i32 {
    let (mut a, mut b) = (0, 1);
    for _ in 0..n {
        let t = a + b;
        a = b;
        b = t;
    }
    a
}</pre>
  </details>
  <p class="tag">WebAssembly module: ${WASM_DEMO.length} bytes, compiled and instantiated in-browser</p>
</body></html>`;
}

// --- WASI shim for running compiled .wasm files from local folders ---

function createWasiImports(onLog: (text: string) => void) {
  const memory = new WebAssembly.Memory({ initial: 256 });
  const decoder = new TextDecoder();

  return {
    memory,
    imports: {
      wasi_snapshot_preview1: {
        fd_write(fd: number, iovs: number, iovsLen: number, nwritten: number) {
          const view = new DataView(memory.buffer);
          let written = 0;
          for (let i = 0; i < iovsLen; i++) {
            const ptr = view.getUint32(iovs + i * 8, true);
            const len = view.getUint32(iovs + i * 8 + 4, true);
            const bytes = new Uint8Array(memory.buffer, ptr, len);
            const text = decoder.decode(bytes);
            if (fd === 1 || fd === 2) onLog(text);
            written += len;
          }
          view.setUint32(nwritten, written, true);
          return 0;
        },
        fd_seek() { return 0; },
        fd_close() { return 0; },
        fd_read() { return 0; },
        fd_prestat_get() { return 8; }, // EBADF
        fd_prestat_dir_name() { return 8; },
        fd_fdstat_get() { return 0; },
        proc_exit(code: number) { onLog(`\nProcess exited with code ${code}\n`); },
        args_get() { return 0; },
        args_sizes_get(argc: number, argvBufSize: number) {
          const view = new DataView(memory.buffer);
          view.setUint32(argc, 0, true);
          view.setUint32(argvBufSize, 0, true);
          return 0;
        },
        environ_get() { return 0; },
        environ_sizes_get(count: number, size: number) {
          const view = new DataView(memory.buffer);
          view.setUint32(count, 0, true);
          view.setUint32(size, 0, true);
          return 0;
        },
        clock_time_get(_id: number, _precision: bigint, time: number) {
          const view = new DataView(memory.buffer);
          view.setBigUint64(time, BigInt(Date.now()) * 1_000_000n, true);
          return 0;
        },
        random_get(buf: number, len: number) {
          const bytes = new Uint8Array(memory.buffer, buf, len);
          crypto.getRandomValues(bytes);
          return 0;
        },
      },
    },
  };
}

export async function runWasiModule(
  bytes: ArrayBuffer,
  onLog: (text: string) => void,
): Promise<string> {
  onLog('Compiling WASI module...\n');
  const { memory, imports } = createWasiImports(onLog);
  const module = await WebAssembly.compile(bytes);
  const { exports } = await WebAssembly.instantiate(module, imports);

  // Provide memory if the module doesn't export its own
  if (exports.memory instanceof WebAssembly.Memory) {
    // Module has its own memory
  } else {
    Object.defineProperty(exports, 'memory', { value: memory });
  }

  onLog('Running _start...\n\n');
  if (typeof exports._start === 'function') {
    (exports._start as () => void)();
  } else if (typeof exports._initialize === 'function') {
    (exports._initialize as () => void)();
    onLog('(reactor module initialized, no _start)\n');
  } else {
    onLog('No _start or _initialize export found.\n');
  }

  return '';
}

// --- Native project detection + Makefile writing ---

type NativeProjectType = 'rust' | 'go' | 'cpp';

const MAKEFILES: Record<NativeProjectType, string> = {
  rust: `.DEFAULT_GOAL := help
.PHONY: help wasm

help: ## Show available commands
\t@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \\033[36m%-12s\\033[0m %s\\n", $$1, $$2}'

wasm: ## Compile to WebAssembly (WASI)
\tcargo build --target wasm32-wasi --release
`,
  go: `.DEFAULT_GOAL := help
.PHONY: help wasm

help: ## Show available commands
\t@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \\033[36m%-12s\\033[0m %s\\n", $$1, $$2}'

wasm: ## Compile to WebAssembly (WASI)
\tGOOS=wasip1 GOARCH=wasm go build -o main.wasm .
`,
  cpp: `WASI_SDK_PATH ?= /opt/wasi-sdk
.DEFAULT_GOAL := help
.PHONY: help wasm

help: ## Show available commands
\t@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \\033[36m%-12s\\033[0m %s\\n", $$1, $$2}'

wasm: ## Compile to WebAssembly (WASI)
\t$(WASI_SDK_PATH)/bin/clang++ -O2 -o main.wasm $(wildcard *.c *.cpp)
`,
};

const PREREQS: Record<NativeProjectType, string> = {
  rust: 'rustup target add wasm32-wasi',
  go: 'Go 1.21+',
  cpp: 'WASI SDK (github.com/WebAssembly/wasi-sdk)',
};

function detectNativeProject(tree: FileSystemTree): NativeProjectType | null {
  if ('Cargo.toml' in tree) return 'rust';
  if ('go.mod' in tree) return 'go';
  if (Object.keys(tree).some((f) => f.endsWith('.c') || f.endsWith('.cpp') || f.endsWith('.h'))) return 'cpp';
  return null;
}

async function writeMakefile(
  dirHandle: FileSystemDirectoryHandle,
  type: NativeProjectType,
  onLog: (text: string) => void,
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle('Makefile', { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(MAKEFILES[type]);
  await writable.close();
  onLog(`Wrote Makefile to ${dirHandle.name}/Makefile\n`);
}

function findWasmFile(tree: FileSystemTree, path = ''): string | null {
  for (const [name, entry] of Object.entries(tree)) {
    const full = path ? `${path}/${name}` : name;
    if ('file' in entry && name.endsWith('.wasm')) return full;
    if ('directory' in entry) {
      const found = findWasmFile(entry.directory as FileSystemTree, full);
      if (found) return found;
    }
  }
  return null;
}

// --- Local folder ---

// Store the last opened directory handle so we can reload it
let lastDirHandle: FileSystemDirectoryHandle | null = null;

export async function mountLocalFolder(
  onLog: (text: string) => void,
): Promise<{ name: string; html?: string; needsReload?: boolean }> {
  const dirHandle = await window.showDirectoryPicker();
  lastDirHandle = dirHandle;
  return openFolder(dirHandle, onLog);
}

export async function reloadFolder(
  onLog: (text: string) => void,
): Promise<{ name: string; html?: string; needsReload?: boolean } | null> {
  if (!lastDirHandle) return null;
  return openFolder(lastDirHandle, onLog);
}

async function openFolder(
  dirHandle: FileSystemDirectoryHandle,
  onLog: (text: string) => void,
): Promise<{ name: string; html?: string; needsReload?: boolean }> {
  if (!instance) throw new Error('WebContainer not booted');
  await stop();

  onLog(`Opening ${dirHandle.name}/\n`);
  const tree = await buildTree(dirHandle);

  // Check for native project (Rust/Go/C++)
  const nativeType = detectNativeProject(tree);
  if (nativeType) {
    const wasmPath = findWasmFile(tree);

    if (wasmPath) {
      onLog(`Found compiled Wasm: ${wasmPath}\n`);
      const file = await resolveFileHandle(dirHandle, wasmPath);
      if (file) {
        const bytes = await file.arrayBuffer();
        await runWasiModule(bytes, onLog);
        return { name: dirHandle.name };
      }
    }

    // No .wasm found. Write Makefile if one doesn't exist, tell user what to do.
    const hasMakefile = 'Makefile' in tree;
    if (!hasMakefile) {
      await writeMakefile(dirHandle, nativeType, onLog);
    }

    onLog(`\n${nativeType.charAt(0).toUpperCase() + nativeType.slice(1)} project detected. No .wasm binary found.\n`);
    onLog(`Prerequisite: ${PREREQS[nativeType]}\n`);
    onLog(`\nRun "make wasm" in your terminal, then click Reload.\n`);

    return { name: dirHandle.name, needsReload: true };
  }

  // Node.js project
  await instance.mount(tree);

  const pkgFile = tree['package.json'];
  if (pkgFile && 'file' in pkgFile) {
    const manifest = JSON.parse((pkgFile.file as { contents: string }).contents);
    const hasDeps =
      Object.keys(manifest.dependencies ?? {}).length > 0 ||
      Object.keys(manifest.devDependencies ?? {}).length > 0;

    if (hasDeps) {
      onLog('Installing dependencies...\n');
      const install = await instance.spawn('npm', ['install']);
      install.output.pipeTo(logStream(onLog));
      await install.exit;
      onLog('\nDependencies installed.\n\n');
    }

    let cmd: string | undefined;
    let args: string[] = [];

    if (manifest.scripts?.dev) {
      cmd = 'npm';
      args = ['run', 'dev'];
    } else if (manifest.scripts?.start) {
      cmd = 'npm';
      args = ['run', 'start'];
    } else if ('index.js' in tree) {
      cmd = 'node';
      args = ['index.js'];
    } else if ('server.js' in tree) {
      cmd = 'node';
      args = ['server.js'];
    }

    if (cmd) {
      onLog(`> ${cmd} ${args.join(' ')}\n`);
      const proc = await instance.spawn(cmd, args);
      currentProcess = proc;
      proc.output.pipeTo(logStream(onLog));
    }

    return { name: dirHandle.name };
  }

  // Python project
  if (Object.keys(tree).some((f) => f.endsWith('.py'))) {
    const pyFile = Object.keys(tree).find((f) => f === 'main.py') ??
      Object.keys(tree).find((f) => f.endsWith('.py'))!;
    const entry = tree[pyFile];
    if ('file' in entry) {
      const code = (entry.file as { contents: string }).contents;
      onLog(`Python file detected: ${pyFile}\n`);
      const output = await runPython(code, onLog);
      return { name: dirHandle.name, html: output.trim().startsWith('<!') ? output : undefined };
    }
  }

  // Static site fallback
  if ('index.html' in tree) {
    onLog('Static site detected. Installing server...\n');
    await instance.mount({
      ...tree,
      'package.json': {
        file: { contents: '{"dependencies":{"serve":"latest"},"scripts":{"start":"npx serve . -l 3000 --no-clipboard"}}' },
      },
    });
    const install = await instance.spawn('npm', ['install']);
    install.output.pipeTo(logStream(onLog));
    await install.exit;
    onLog('\n> npx serve\n');
    const proc = await instance.spawn('npm', ['run', 'start']);
    currentProcess = proc;
    proc.output.pipeTo(logStream(onLog));
    return { name: dirHandle.name };
  }

  onLog('Could not detect project type.\n');
  return { name: dirHandle.name };
}

// --- Helpers ---

const SKIP = new Set(['node_modules', '.git', '.next', 'dist', '__pycache__', 'target', 'build']);

async function buildTree(dir: FileSystemDirectoryHandle): Promise<FileSystemTree> {
  const tree: FileSystemTree = {};
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === 'file') {
      const file = await (handle as FileSystemFileHandle).getFile();
      tree[name] = { file: { contents: await file.text() } };
    } else if (!SKIP.has(name)) {
      tree[name] = {
        directory: await buildTree(handle as FileSystemDirectoryHandle),
      };
    }
  }
  return tree;
}

function resolveFile(tree: FileSystemTree, path: string) {
  const parts = path.split('/');
  let current: FileSystemTree = tree;
  for (let i = 0; i < parts.length - 1; i++) {
    const entry = current[parts[i]];
    if (!entry || !('directory' in entry)) return null;
    current = entry.directory as FileSystemTree;
  }
  const entry = current[parts[parts.length - 1]];
  return entry && 'file' in entry ? entry : null;
}

async function resolveFileHandle(
  dir: FileSystemDirectoryHandle,
  path: string,
): Promise<File | null> {
  const parts = path.split('/');
  let current = dir;
  for (let i = 0; i < parts.length - 1; i++) {
    current = await current.getDirectoryHandle(parts[i]);
  }
  const fileHandle = await current.getFileHandle(parts[parts.length - 1]);
  return fileHandle.getFile();
}

