import type { FileSystemTree } from '@webcontainer/api';

export interface Template {
  id: string;
  name: string;
  icon: string;
  description: string;
  runtime: 'node' | 'python' | 'wasm';
  files?: FileSystemTree;
  code?: string;
}

export const templates: Template[] = [
  {
    id: 'express',
    name: 'Express API',
    icon: '{ }',
    description: 'REST server with live endpoints',
    runtime: 'node',
    files: {
      'package.json': {
        file: {
          contents: JSON.stringify({
            name: 'express-demo',
            type: 'module',
            dependencies: { express: 'latest', cors: 'latest' },
          }),
        },
      },
      'index.js': {
        file: {
          contents: `import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const items = [
  { id: 1, name: 'WebContainers', status: 'running' },
  { id: 2, name: 'File System API', status: 'active' },
  { id: 3, name: 'Service Workers', status: 'cached' },
];

app.get('/', (req, res) => {
  res.send(\`<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * { margin: 0; box-sizing: border-box; }
  body { font-family: system-ui; background: #0f172a; color: #e2e8f0; padding: 40px; }
  h1 { font-size: 24px; margin-bottom: 6px; }
  .sub { color: #94a3b8; margin-bottom: 28px; font-size: 14px; }
  .card { background: #1e293b; border-radius: 10px; padding: 16px 20px; margin-bottom: 10px;
          display: flex; justify-content: space-between; align-items: center; }
  .badge { background: #22c55e22; color: #4ade80; padding: 3px 10px;
           border-radius: 6px; font-size: 12px; font-weight: 500; }
  .row { margin-top: 28px; display: flex; gap: 8px; }
  button { font-family: system-ui; background: #3b82f6; color: white; border: none;
           padding: 8px 16px; border-radius: 8px; font-size: 13px; cursor: pointer; }
  button:hover { background: #2563eb; }
  button.dim { background: #334155; }
  pre { margin-top: 12px; font-size: 12px; color: #94a3b8; min-height: 20px; }
</style></head><body>
  <h1>Express API</h1>
  <p class="sub">Running in-browser via WebContainers</p>
  <div id="items"></div>
  <div class="row">
    <button onclick="fetchItems()">GET /api/items</button>
    <button class="dim" onclick="postItem()">POST /api/items</button>
    <button class="dim" onclick="getTime()">GET /api/time</button>
  </div>
  <pre id="out"></pre>
  <script>
    const out = document.getElementById('out');
    const list = document.getElementById('items');
    const show = d => out.textContent = JSON.stringify(d, null, 2);
    async function fetchItems() {
      const r = await (await fetch('/api/items')).json();
      show(r); render(r);
    }
    async function postItem() {
      await fetch('/api/items', { method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ name: 'Item ' + Date.now(), status: 'created' }) });
      fetchItems();
    }
    async function getTime() { show(await (await fetch('/api/time')).json()); }
    function render(items) {
      list.innerHTML = items.map(i =>
        '<div class="card"><span>' + i.name + '</span><span class="badge">' + i.status + '</span></div>'
      ).join('');
    }
    fetchItems();
  </script>
</body></html>\`);
});

app.get('/api/items', (req, res) => res.json(items));
app.get('/api/time', (req, res) => res.json({
  time: new Date().toISOString(),
  uptime: process.uptime().toFixed(1) + 's',
  memory: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1) + ' MB',
}));
app.post('/api/items', (req, res) => {
  const item = { id: items.length + 1, ...req.body };
  items.push(item);
  res.status(201).json(item);
});

app.listen(3000, () => console.log('Server ready on port 3000'));
`,
        },
      },
    },
  },

  {
    id: 'vite',
    name: 'Vite App',
    icon: '\u26A1',
    description: 'HMR dev server with hot reload',
    runtime: 'node',
    files: {
      'package.json': {
        file: {
          contents: JSON.stringify({
            name: 'vite-demo',
            type: 'module',
            scripts: { dev: 'vite --host' },
            devDependencies: { vite: 'latest' },
          }),
        },
      },
      'index.html': {
        file: {
          contents: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Vite App</title></head>
<body><div id="app"></div><script type="module" src="/main.js"></script></body>
</html>`,
        },
      },
      'main.js': {
        file: {
          contents: `document.getElementById('app').innerHTML = \`
<style>
  * { margin: 0; box-sizing: border-box; }
  body { font-family: system-ui; background: #0c0c0c; color: white; }
  .c { max-width: 480px; margin: 60px auto; padding: 0 20px; }
  h1 { font-size: 28px; margin-bottom: 6px; }
  .sub { color: #888; margin-bottom: 36px; font-size: 14px; }
  .counter { display: flex; align-items: center; gap: 20px; }
  .n { font-size: 48px; font-weight: 700; font-variant-numeric: tabular-nums; min-width: 80px; text-align: center; }
  button { font-family: system-ui; background: #222; color: white; border: 1px solid #333;
           width: 48px; height: 48px; border-radius: 10px; font-size: 20px; cursor: pointer; }
  button:hover { background: #333; }
  .tag { margin-top: 24px; color: #666; font-size: 12px; padding: 8px 12px; background: #111; border-radius: 6px; }
  .dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #4ade80; margin-right: 6px; }
</style>
<div class="c">
  <h1>Vite + WebContainers</h1>
  <p class="sub">HMR dev server running in your browser</p>
  <div class="counter">
    <button id="dec">&minus;</button>
    <span class="n" id="count">0</span>
    <button id="inc">+</button>
  </div>
  <p class="tag"><span class="dot"></span>Hot Module Replacement active</p>
</div>\`;

let c = 0;
const d = document.getElementById('count');
document.getElementById('inc').onclick = () => d.textContent = ++c;
document.getElementById('dec').onclick = () => d.textContent = --c;
if (import.meta.hot) import.meta.hot.accept();
`,
        },
      },
    },
  },

  {
    id: 'websocket',
    name: 'WebSocket',
    icon: '\u21C4',
    description: 'Real-time chat server',
    runtime: 'node',
    files: {
      'package.json': {
        file: {
          contents: JSON.stringify({
            name: 'ws-demo',
            type: 'module',
            dependencies: { express: 'latest', ws: 'latest' },
          }),
        },
      },
      'index.js': {
        file: {
          contents: `import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Set();
const log = [];

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'system', text: 'Connected. ' + clients.size + ' online.' }));
  log.slice(-20).forEach(m => ws.send(JSON.stringify(m)));
  ws.on('message', (data) => {
    const msg = { type: 'chat', text: data.toString(), time: Date.now() };
    log.push(msg);
    for (const c of clients) if (c.readyState === 1) c.send(JSON.stringify(msg));
  });
  ws.on('close', () => clients.delete(ws));
});

app.get('/', (req, res) => {
  res.send(\`<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * { margin: 0; box-sizing: border-box; }
  body { font-family: system-ui; background: #0f172a; color: #e2e8f0;
         display: flex; flex-direction: column; height: 100vh; }
  .hd { padding: 14px 20px; border-bottom: 1px solid #1e293b; }
  h1 { font-size: 16px; }
  .sub { color: #64748b; font-size: 12px; }
  #msgs { flex: 1; overflow-y: auto; padding: 14px 20px; display: flex;
          flex-direction: column; gap: 6px; }
  .m { padding: 8px 12px; border-radius: 8px; max-width: 75%; font-size: 13px; }
  .m.chat { background: #1e293b; }
  .m.self { background: #1d4ed8; align-self: flex-end; }
  .m.system { align-self: center; color: #64748b; font-size: 11px; }
  .bar { padding: 10px 20px; border-top: 1px solid #1e293b; display: flex; gap: 8px; }
  input { flex: 1; background: #1e293b; border: 1px solid #334155; color: white;
          padding: 8px 12px; border-radius: 8px; font-size: 13px; outline: none; }
  button { background: #3b82f6; color: white; border: none; padding: 8px 16px;
           border-radius: 8px; font-size: 13px; cursor: pointer; }
</style></head><body>
  <div class="hd"><h1>WebSocket Chat</h1><p class="sub">Real-time. Server in your browser.</p></div>
  <div id="msgs"></div>
  <div class="bar">
    <input id="inp" placeholder="Type a message..." autocomplete="off">
    <button onclick="send()">Send</button>
  </div>
  <script>
    const ws = new WebSocket('ws://' + location.host);
    const msgs = document.getElementById('msgs');
    const inp = document.getElementById('inp');
    ws.onmessage = e => {
      const msg = JSON.parse(e.data);
      const d = document.createElement('div');
      d.className = 'm ' + msg.type;
      d.textContent = msg.text;
      msgs.appendChild(d);
      msgs.scrollTop = msgs.scrollHeight;
    };
    function send() {
      if (!inp.value.trim()) return;
      const d = document.createElement('div');
      d.className = 'm self';
      d.textContent = inp.value;
      msgs.appendChild(d);
      msgs.scrollTop = msgs.scrollHeight;
      ws.send(inp.value);
      inp.value = '';
    }
    inp.onkeydown = e => { if (e.key === 'Enter') send(); };
    inp.focus();
  </script>
</body></html>\`);
});

server.listen(3000, () => console.log('WebSocket server ready on port 3000'));
`,
        },
      },
    },
  },

  {
    id: 'static',
    name: 'Static Site',
    icon: '\u25C7',
    description: 'HTML + CSS + JS served locally',
    runtime: 'node',
    files: {
      'package.json': {
        file: {
          contents: JSON.stringify({
            name: 'static-demo',
            dependencies: { serve: 'latest' },
            scripts: { start: 'npx serve public -l 3000 --no-clipboard' },
          }),
        },
      },
      public: {
        directory: {
          'index.html': {
            file: {
              contents: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Static Site</title><link rel="stylesheet" href="style.css"></head>
<body>
  <div class="canvas" id="canvas"></div>
  <div class="overlay">
    <h1>Static Site</h1>
    <p>Served from WebContainers. Click anywhere.</p>
    <div class="stats"><span id="count">0</span> particles</div>
  </div>
  <script src="script.js"></script>
</body></html>`,
            },
          },
          'style.css': {
            file: {
              contents: `* { margin: 0; box-sizing: border-box; }
body { background: #0a0a0a; color: white; font-family: system-ui; overflow: hidden; height: 100vh; }
.canvas { position: fixed; inset: 0; }
.overlay { position: fixed; bottom: 40px; left: 40px; z-index: 1; }
h1 { font-size: 24px; margin-bottom: 4px; }
p { color: #666; font-size: 14px; margin-bottom: 12px; }
.stats { font-variant-numeric: tabular-nums; color: #4ade80; font-size: 13px; }`,
            },
          },
          'script.js': {
            file: {
              contents: `const canvas = document.getElementById('canvas');
const counter = document.getElementById('count');
let total = 0;
function spawn(x, y) {
  const el = document.createElement('div');
  const s = Math.random() * 20 + 5;
  const h = Math.random() * 60 + 200;
  Object.assign(el.style, {
    position:'absolute', left:x+'px', top:y+'px', width:s+'px', height:s+'px',
    borderRadius:'50%', background:'hsl('+h+',80%,60%)', opacity:'0.8',
    pointerEvents:'none', transition:'all 1.5s cubic-bezier(.25,.46,.45,.94)',
  });
  canvas.appendChild(el);
  counter.textContent = ++total;
  requestAnimationFrame(() => {
    el.style.transform = 'translate('+(Math.random()*200-100)+'px,'+(Math.random()*200-100)+'px) scale(0)';
    el.style.opacity = '0';
  });
  setTimeout(() => el.remove(), 1600);
}
document.addEventListener('click', e => { for (let i = 0; i < 12; i++) setTimeout(() => spawn(e.clientX, e.clientY), i*30); });
document.addEventListener('mousemove', e => { if (Math.random() > 0.7) spawn(e.clientX, e.clientY); });`,
            },
          },
        },
      },
    },
  },

  {
    id: 'python',
    name: 'Python',
    icon: '\u{1F40D}',
    description: 'Run Python via Pyodide (Wasm)',
    runtime: 'python',
    code: `import json, math, random

# Generate sample dataset
random.seed(42)
languages = ["Python", "TypeScript", "Rust", "Go", "C++", "Swift", "Kotlin", "Zig"]
scores = [random.randint(30, 95) for _ in languages]
data = sorted(zip(languages, scores), key=lambda x: -x[1])

max_score = max(s for _, s in data)

# Build SVG bar chart
bars = []
for i, (name, score) in enumerate(data):
    w = score / max_score * 320
    y = i * 36
    hue = 210 + i * 18
    bars.append(f'''
      <rect x="90" y="{y}" width="{w}" height="26" rx="4" fill="hsl({hue}, 65%, 55%)" opacity="0.9"/>
      <text x="82" y="{y + 18}" text-anchor="end" fill="#cbd5e1" font-size="13" font-family="system-ui">{name}</text>
      <text x="{96 + w}" y="{y + 18}" fill="#64748b" font-size="12" font-family="system-ui">{score}</text>
    ''')

svg_h = len(data) * 36 + 10
chart = f'<svg width="500" height="{svg_h}" xmlns="http://www.w3.org/2000/svg">{"".join(bars)}</svg>'

# Stats
mean = sum(s for _, s in data) / len(data)
std = math.sqrt(sum((s - mean)**2 for _, s in data) / len(data))
top = data[0]

# Print HTML output
print(f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * {{ margin: 0; box-sizing: border-box; }}
  body {{ font-family: system-ui; background: #0f172a; color: #e2e8f0; padding: 40px; }}
  h1 {{ font-size: 22px; margin-bottom: 4px; }}
  .sub {{ color: #64748b; font-size: 13px; margin-bottom: 28px; }}
  .stats {{ display: flex; gap: 16px; margin-bottom: 28px; }}
  .stat {{ background: #1e293b; padding: 14px 18px; border-radius: 10px; flex: 1; }}
  .stat .label {{ font-size: 11px; color: #64748b; margin-bottom: 4px; }}
  .stat .value {{ font-size: 20px; font-weight: 600; }}
  .chart {{ background: #1e293b; border-radius: 10px; padding: 20px; }}
  .tag {{ margin-top: 20px; font-size: 11px; color: #475569; }}
</style></head><body>
  <h1>Python Data Analysis</h1>
  <p class="sub">Computed with CPython via Pyodide (WebAssembly)</p>
  <div class="stats">
    <div class="stat"><div class="label">Top Language</div><div class="value">{top[0]}</div></div>
    <div class="stat"><div class="label">Mean Score</div><div class="value">{mean:.1f}</div></div>
    <div class="stat"><div class="label">Std Dev</div><div class="value">{std:.1f}</div></div>
    <div class="stat"><div class="label">Languages</div><div class="value">{len(data)}</div></div>
  </div>
  <div class="chart">{chart}</div>
  <p class="tag">Python {'.'.join(str(x) for x in __import__('sys').version_info[:3])} running in your browser</p>
</body></html>""")
`,
  },

  {
    id: 'wasm',
    name: 'WebAssembly',
    icon: '\u2699',
    description: 'Wasm vs JS performance benchmark',
    runtime: 'wasm',
  },
];
