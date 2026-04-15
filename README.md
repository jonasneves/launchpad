# Launchpad

Run servers and prototypes entirely in the browser. No backend, no CLI, no installs.

Launchpad boots a full Node.js runtime (via WebContainers), Python interpreter (via Pyodide), and WebAssembly executor inside a browser tab. Open a local folder or pick a template, and it detects the project type, installs dependencies, and starts a dev server with live preview.

## Supported runtimes

| Runtime | How | What runs |
|---|---|---|
| **Node.js** | WebContainers | Express, Vite, any npm project |
| **Python** | Pyodide (CPython compiled to Wasm) | Scripts, data analysis |
| **WebAssembly** | Native browser API + WASI shim | Compiled Rust/Go/C++ binaries |

## Templates

- **Express API** — REST server with GET/POST endpoints
- **Vite App** — HMR dev server with hot reload
- **WebSocket** — Real-time chat server
- **Static Site** — HTML/CSS/JS with particle effects
- **Python** — Data analysis with SVG chart output
- **WebAssembly** — Wasm vs JS performance benchmark

## Open Folder

Click "Open Folder" to mount any local project via the File System Access API. Launchpad detects the project type and runs it:

- `package.json` with scripts → `npm run dev` or `npm start`
- `index.html` without package.json → static file server
- `.py` files → Pyodide
- `Cargo.toml` / `go.mod` / C files → writes a Makefile, waits for `make wasm`, runs the `.wasm` output

## Setup

```
make install
make dev
```

Requires Node.js 18+. The dev server sets the COOP/COEP headers needed for WebContainers (SharedArrayBuffer).

## Stack

- TypeScript, React, Vite
- WebContainers (in-browser Node.js)
- Pyodide (in-browser Python)
- WebAssembly + WASI shim
- File System Access API
- PWA (installable, offline shell)

## How it works

WebContainers run a virtualized Node.js inside a Service Worker with an in-browser file system and TCP network stack. Pyodide is CPython compiled to WebAssembly. For Rust/Go/C++, the user compiles locally to a `.wasm` binary, and Launchpad executes it through a minimal WASI shim that provides stdout, memory, and clock imports.

The app requires `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers because WebContainers depend on `SharedArrayBuffer`. The Vite config handles this in development. For production, your host must serve these headers.
