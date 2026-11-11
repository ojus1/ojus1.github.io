// In-browser chat. Mounts on every [data-llm] element.
// Uses Transformers.js in a worker: WebGPU when the browser's limits allow it,
// otherwise WebAssembly on the CPU. Weights come from Hugging Face once and stay cached.

const MODELS = [
  { id: 'HuggingFaceTB/SmolLM2-135M-Instruct', name: 'SmolLM2 135M', size: '≈ 130 MB' },
  { id: 'HuggingFaceTB/SmolLM2-360M-Instruct', name: 'SmolLM2 360M', size: '≈ 300 MB' },
  { id: 'onnx-community/Qwen2.5-0.5B-Instruct', name: 'Qwen2.5 0.5B', size: '≈ 500 MB' },
];
const MB = (b) => (b / 1048576).toFixed(0) + ' MB';
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

async function gpuPlan() {
  if (!('gpu' in navigator)) return null;
  try {
    const a = await navigator.gpu.requestAdapter();
    if (!a) return null;
    return { dtype: a.features.has('shader-f16') ? 'q4f16' : 'q4' };
  } catch (e) { return null; }
}

function mount(host) {
  host.innerHTML = '';
  const bar = el('div', 'widget__bar');
  const status = el('span', 'dot-status', 'Not loaded');
  status.dataset.state = 'idle';
  const sel = el('select', 'select');
  sel.setAttribute('aria-label', 'Model');
  MODELS.forEach((m) => { const o = el('option', null, `${m.name} · ${m.size}`); o.value = m.id; sel.appendChild(o); });
  const load = el('button', 'btn btn--ghost btn--sm', 'Load model');
  load.type = 'button';
  bar.append(status, el('span', 'widget__spacer'), sel, load);
  const progress = el('div', 'progress'); const fill = el('i'); progress.appendChild(fill);
  const log = el('div', 'chat__log'); log.setAttribute('aria-live', 'polite');
  const form = el('form', 'chat__form');
  const input = el('input', 'chat__input'); input.type = 'text'; input.placeholder = 'Load a model, then ask it something'; input.setAttribute('aria-label', 'Message'); input.disabled = true;
  const send = el('button', 'btn', 'Send'); send.type = 'submit'; send.disabled = true;
  form.append(input, send);
  const stats = el('div', 'stats');
  const stat = (k) => { const s = el('div', 'stat'); const v = el('span', 'stat__v', '—'); s.append(el('span', 'stat__k', k), v); stats.appendChild(s); return v; };
  const sDev = stat('running on'), sRate = stat('tokens / s'), sFirst = stat('first token');
  const chat = el('div', 'chat'); chat.append(bar, progress, log, form, stats);
  host.appendChild(chat);

  const sys = (text) => { const m = el('div', 'chat__msg chat__msg--sys', text); log.appendChild(m); log.scrollTop = log.scrollHeight; return m; };
  const setStatus = (text, state) => { status.textContent = text; status.dataset.state = state; };
  sys('Nothing downloads until you press Load model. The weights come once from Hugging Face and are cached by your browser. After that the model runs on your machine, on the GPU through WebGPU where your browser allows it and on the CPU otherwise.');

  let worker = null, busy = false, onMsg = null;
  const history = [{ role: 'system', content: 'You are a concise, friendly assistant inside a blog post about running language models in the browser. Answer in at most three sentences.' }];

  const tryLoad = (model, device, dtype, note) => new Promise((resolve) => {
    if (worker) worker.terminate();
    worker = new Worker(new URL('/assets/js/llm/llm-worker.js', location.origin), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') {
        fill.style.width = Math.round((data.loaded / data.total) * 100) + '%';
        note.textContent = `Downloading ${data.file.split('/').pop()} · ${MB(data.loaded)} of ${MB(data.total)}`;
      } else if (data.type === 'ready') resolve({ ok: true });
      else if (data.type === 'error') resolve({ ok: false, message: data.message });
      else onMsg?.(data);
    };
    worker.onerror = (e) => resolve({ ok: false, message: e.message || 'worker failed to start' });
    worker.postMessage({ type: 'load', model, device, dtype });
  });

  load.addEventListener('click', async () => {
    load.disabled = true; sel.disabled = true; setStatus('Loading', 'busy'); fill.style.width = '0';
    const note = sys('Starting…');
    const model = sel.value, name = sel.selectedOptions[0].textContent.split(' · ')[0];
    const gpu = await gpuPlan();
    let res = { ok: false }, where = '';
    if (gpu) {
      res = await tryLoad(model, 'webgpu', gpu.dtype, note);
      where = 'GPU · WebGPU';
      if (!res.ok) note.textContent = `WebGPU could not run it here (${res.message.slice(0, 140)}). Switching to the CPU…`;
    }
    if (!res.ok) {
      const cpuNote = gpu ? sys('Loading the CPU build…') : note;
      res = await tryLoad(model, 'wasm', 'q8', cpuNote);
      where = 'CPU · WebAssembly';
    }
    if (!res.ok) {
      setStatus('Failed', 'error'); note.textContent = 'Could not load the model: ' + res.message;
      load.disabled = false; sel.disabled = false; return;
    }
    fill.style.width = '100%'; sDev.textContent = where;
    setStatus('Ready · ' + name, 'ready');
    sys(`${name} is loaded and running on your ${where.startsWith('GPU') ? 'GPU' : 'CPU'}. Nothing you type leaves this page.`);
    load.disabled = false; sel.disabled = false; load.textContent = 'Switch model';
    input.disabled = false; send.disabled = false; input.placeholder = 'Ask it something'; input.focus();
  });

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const text = input.value.trim();
    if (!text || !worker || busy) return;
    busy = true; input.value = ''; send.disabled = true; load.disabled = true; setStatus('Generating', 'busy');
    log.appendChild(el('div', 'chat__msg chat__msg--user', text));
    const out = el('div', 'chat__msg chat__msg--bot is-streaming'); log.appendChild(out);
    history.push({ role: 'user', content: text });
    const t0 = performance.now(); let first = 0, n = 0, reply = '';
    const finish = (err) => {
      out.classList.remove('is-streaming');
      if (err) out.textContent = (reply ? reply + '\n\n' : '') + 'Generation stopped: ' + err;
      else history.push({ role: 'assistant', content: reply });
      busy = false; send.disabled = false; load.disabled = false; setStatus('Ready', 'ready'); input.focus();
      onMsg = null;
    };
    onMsg = (data) => {
      if (data.type === 'token') {
        if (!first) { first = performance.now(); sFirst.textContent = Math.round(first - t0) + ' ms'; }
        n++; reply += data.text; out.textContent = reply;
        if (n > 1) sRate.textContent = ((n - 1) / ((performance.now() - first) / 1000)).toFixed(1);
        log.scrollTop = log.scrollHeight;
      } else if (data.type === 'done') finish();
    };
    // errors during generation arrive through the load handler's 'error' branch; route them here
    const prev = worker.onmessage;
    worker.onmessage = (e) => { if (e.data.type === 'error') { worker.onmessage = prev; finish(e.data.message); } else prev(e); };
    worker.postMessage({ type: 'generate', messages: history });
  });
}

document.querySelectorAll('[data-llm]').forEach(mount);
