// In-browser chat on WebGPU. Mounts on every [data-llm] element.
// The WebLLM library itself is only fetched when the reader presses Load.
// Weights download once from Hugging Face and stay in the browser's cache.

const MODELS = [
  { id: 'SmolLM2-360M-Instruct-q4f16_1-MLC', name: 'SmolLM2 360M', size: '≈ 270 MB' },
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', name: 'Qwen2.5 0.5B', size: '≈ 280 MB' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 1B', size: '≈ 880 MB' },
];

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

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
  const sTok = stat('tokens'), sRate = stat('tokens / s'), sFirst = stat('first token');
  const chat = el('div', 'chat'); chat.append(bar, progress, log, form, stats);
  host.appendChild(chat);

  const sys = (text) => { const m = el('div', 'chat__msg chat__msg--sys', text); log.appendChild(m); log.scrollTop = log.scrollHeight; return m; };
  const setStatus = (text, state) => { status.textContent = text; status.dataset.state = state; };

  if (!('gpu' in navigator)) {
    sys('This browser does not expose WebGPU, so the model cannot run here. Recent Chrome, Edge and Safari 26 have it; Firefox has it on Windows. The rest of the post works without it.');
    load.disabled = true; sel.disabled = true; setStatus('WebGPU unavailable', 'error');
    return;
  }
  sys('Nothing downloads until you press Load model. The weights are fetched once from Hugging Face and cached by your browser; after that the model runs entirely on your GPU, offline.');

  let engine = null, busy = false;
  const history = [{ role: 'system', content: 'You are a concise assistant embedded in a blog post about running language models in the browser. Answer in at most four sentences.' }];

  load.addEventListener('click', async () => {
    load.disabled = true; sel.disabled = true; setStatus('Loading', 'busy');
    const note = sys('Starting…');
    try {
      const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm');
      // GPUs without 16-bit float shaders get the 32-bit build of the same model.
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error('no WebGPU adapter was found');
      let id = sel.value;
      if (!adapter.features.has('shader-f16')) { id = id.replace('q4f16_1', 'q4f32_1'); note.textContent = 'Your GPU lacks 16-bit shaders, using the 32-bit build…'; }
      const worker = new Worker(new URL('/assets/js/llm-worker.js', location.origin), { type: 'module' });
      engine = await CreateWebWorkerMLCEngine(worker, id, {
        initProgressCallback: (r) => { fill.style.width = Math.round(r.progress * 100) + '%'; note.textContent = r.text; },
      });
      fill.style.width = '100%';
      setStatus('Ready · ' + sel.selectedOptions[0].textContent.split(' · ')[0], 'ready');
      note.textContent = 'Loaded. Everything from here runs on your machine.';
      input.disabled = false; send.disabled = false; input.placeholder = 'Ask it something'; input.focus();
    } catch (e) {
      setStatus('Failed', 'error'); note.textContent = 'Could not load the model: ' + (e?.message || e);
      load.disabled = false; sel.disabled = false;
    }
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const text = input.value.trim();
    if (!text || !engine || busy) return;
    busy = true; input.value = ''; send.disabled = true; setStatus('Generating', 'busy');
    log.appendChild(el('div', 'chat__msg chat__msg--user', text));
    const out = el('div', 'chat__msg chat__msg--bot is-streaming'); log.appendChild(out);
    history.push({ role: 'user', content: text });
    const t0 = performance.now(); let first = 0, n = 0, reply = '';
    try {
      const stream = await engine.chat.completions.create({ messages: history, stream: true, temperature: 0.6, max_tokens: 256 });
      for await (const chunk of stream) {
        const d = chunk.choices[0]?.delta?.content || '';
        if (!d) continue;
        if (!first) { first = performance.now(); sFirst.textContent = Math.round(first - t0) + ' ms'; }
        n++; reply += d; out.textContent = reply;
        sTok.textContent = n; sRate.textContent = (n / ((performance.now() - first) / 1000 || 1)).toFixed(1);
        log.scrollTop = log.scrollHeight;
      }
      history.push({ role: 'assistant', content: reply });
    } catch (e) {
      out.textContent = 'Generation stopped: ' + (e?.message || e);
    }
    out.classList.remove('is-streaming');
    busy = false; send.disabled = false; setStatus('Ready', 'ready'); input.focus();
  });
}

document.querySelectorAll('[data-llm]').forEach(mount);
