// Shared behaviour for all worksheets (worksheets/<name>/index.html). Vanilla JS, no dependencies, no server.
// Stores answers in localStorage (text, status) and IndexedDB (screenshots); everything stays in the browser.
(() => {
  'use strict';

  const body = document.body;
  const WS = body.dataset.wsId;
  const APP_ROOT = body.dataset.appRoot || '../../';
  const STORAGE_KEY = `nnpws:${WS}:v1`;
  const DB_NAME = 'nnpws';
  const MAX_IMAGE_WIDTH = 1600;
  const UNDO_MS = 8000;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const randomId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  // ------------------------------------------------------------------ state
  const emptyState = () => ({ v: 1, profile: { name: '', partner: '' }, f: {}, q: {}, done: {}, changedAt: 0, exportedAt: 0 });
  let storageWorks = true;
  let flushTimer = 0;

  const loadState = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.v === 1) return Object.assign(emptyState(), parsed);
      }
    } catch (error) {
      storageWorks = false;
    }
    return emptyState();
  };
  let state = loadState();

  const flush = () => {
    clearTimeout(flushTimer);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      if (storageWorks) {
        storageWorks = false;
        showBanner('Dein Browser erlaubt kein Speichern. Deine Eingaben gehen beim Schliessen verloren – sichere sie unter «Meine Daten».');
      }
    }
  };
  const touch = () => {
    state.changedAt = Date.now();
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 200);
    updateDirty();
  };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  const hasContent = () => Object.keys(state.f).length > 0 || Object.keys(state.q).length > 0 || Object.keys(state.done).length > 0;

  // ------------------------------------------------------------------ banner, toast, dialogs
  const banner = $('#ws-banner');
  function showBanner(message, actionLabel, action) {
    banner.textContent = '';
    banner.append(el('span', null, message));
    if (actionLabel) {
      const button = el('button', 'ws-btn ws-btn-small', actionLabel);
      button.type = 'button';
      button.addEventListener('click', action);
      banner.append(button);
    }
    banner.hidden = false;
  }

  const toastHost = $('#ws-toasts');
  function toast(message, options = {}) {
    const node = el('div', 'ws-toast');
    node.append(el('span', null, message));
    let timer = 0;
    const close = () => { clearTimeout(timer); node.remove(); if (options.onClose) options.onClose(); };
    if (options.action) {
      const button = el('button', 'ws-toast-action', options.action.label);
      button.type = 'button';
      button.addEventListener('click', () => { options.action.run(); options.onClose = null; clearTimeout(timer); node.remove(); });
      node.append(button);
    }
    toastHost.append(node);
    timer = setTimeout(close, options.timeout || (options.action ? UNDO_MS : 4000));
    return node;
  }

  const confirmDialog = (title, text, okLabel = 'Ja, löschen') => new Promise((resolve) => {
    const dialog = $('#ws-confirm-dialog');
    $('#ws-confirm-title').textContent = title;
    $('#ws-confirm-text').textContent = text;
    $('#ws-confirm-ok').textContent = okLabel;
    dialog.returnValue = '';
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), { once: true });
    dialog.showModal();
  });

  // ------------------------------------------------------------------ image store (IndexedDB with in-memory fallback)
  const memory = new Map();
  const urlCache = new Map();
  let dbPromise = null;
  const imageKey = (id) => `${WS}:${id}`;

  const openDb = () => {
    if (!dbPromise) {
      dbPromise = new Promise((resolve) => {
        if (!('indexedDB' in window)) { resolve(null); return; }
        try {
          const request = indexedDB.open(DB_NAME, 1);
          request.onupgradeneeded = () => request.result.createObjectStore('images', { keyPath: 'key' });
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
          request.onblocked = () => resolve(null);
        } catch (error) {
          resolve(null);
        }
      });
    }
    return dbPromise;
  };

  const imagePut = async (record) => {
    memory.set(record.key, record);
    const db = await openDb();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('images', 'readwrite');
        tx.objectStore('images').put(record);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch (error) {
        resolve(false);
      }
    });
  };

  const imageGet = async (id) => {
    const key = imageKey(id);
    if (memory.has(key)) return memory.get(key);
    const db = await openDb();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const request = db.transaction('images').objectStore('images').get(key);
        request.onsuccess = () => { if (request.result) memory.set(key, request.result); resolve(request.result || null); };
        request.onerror = () => resolve(null);
      } catch (error) {
        resolve(null);
      }
    });
  };

  const imageDelete = async (id) => {
    const key = imageKey(id);
    memory.delete(key);
    if (urlCache.has(key)) { URL.revokeObjectURL(urlCache.get(key)); urlCache.delete(key); }
    const db = await openDb();
    if (!db) return;
    try { db.transaction('images', 'readwrite').objectStore('images').delete(key); } catch (error) { /* ignore */ }
  };

  const imageKeys = async () => {
    const db = await openDb();
    const keys = new Set([...memory.keys()]);
    if (!db) return keys;
    return new Promise((resolve) => {
      try {
        const request = db.transaction('images').objectStore('images').getAllKeys();
        request.onsuccess = () => { request.result.forEach((key) => keys.add(key)); resolve(keys); };
        request.onerror = () => resolve(keys);
      } catch (error) {
        resolve(keys);
      }
    });
  };

  const imageUrl = async (id) => {
    const key = imageKey(id);
    if (urlCache.has(key)) return urlCache.get(key);
    const record = await imageGet(id);
    if (!record) return '';
    const url = URL.createObjectURL(record.blob);
    urlCache.set(key, url);
    return url;
  };

  const protectedIds = new Set();
  const referencedImageIds = () => {
    const ids = new Set();
    Object.values(state.f).forEach((value) => { if (Array.isArray(value)) value.forEach((item) => ids.add(item.id)); });
    return ids;
  };
  const collectGarbage = async () => {
    const referenced = referencedImageIds();
    const prefix = `${WS}:`;
    (await imageKeys()).forEach((key) => {
      if (!key.startsWith(prefix)) return;
      const id = key.slice(prefix.length);
      if (!referenced.has(id) && !protectedIds.has(id)) imageDelete(id);
    });
  };

  const loadImageElement = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild nicht lesbar')); };
    image.src = url;
  });
  const canvasBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

  // Downscale large screenshots and keep the smaller of PNG / WebP.
  const prepareImage = async (file) => {
    const image = await loadImageElement(file);
    const scale = Math.min(1, MAX_IMAGE_WIDTH / image.naturalWidth);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(image, 0, 0, width, height);
    const png = await canvasBlob(canvas, 'image/png');
    const webp = await canvasBlob(canvas, 'image/webp', 0.95);
    let blob = png;
    if (webp && webp.type === 'image/webp' && (!png || webp.size < png.size)) blob = webp;
    if (!blob) throw new Error('Bild nicht verarbeitbar');
    if (scale === 1 && file.size <= blob.size && /^image\/(png|jpeg|webp)$/.test(file.type)) blob = file;
    return { blob, width, height };
  };

  const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  // ------------------------------------------------------------------ question model
  const taskEls = $$('.ws-task');
  const questionEls = $$('.ws-q');
  const fieldsOf = (qEl) => $$('.ws-field', qEl).map((fieldEl) => {
    const kind = fieldEl.dataset.kind;
    const key = kind === 'shot' || kind === 'table' ? fieldEl.dataset.f : $('[data-f]', fieldEl).dataset.f;
    return { kind, key, el: fieldEl };
  });
  const fieldIndex = new Map(questionEls.map((qEl) => [qEl.dataset.q, fieldsOf(qEl)]));

  const tableCounts = (field) => {
    const value = state.f[field.key] || {};
    let filled = 0;
    Object.values(value).forEach((row) => Object.values(row).forEach((cell) => { if (String(cell).trim()) filled += 1; }));
    return { filled, total: $$('.ws-cell', field.el).length };
  };
  const fieldAny = (field) => {
    const value = state.f[field.key];
    if (field.kind === 'shot') return Array.isArray(value) && value.length > 0;
    if (field.kind === 'table') return tableCounts(field).filled > 0;
    return Boolean(value && value.trim());
  };
  const fieldFilled = (field) => (field.kind === 'table' ? tableCounts(field).filled === tableCounts(field).total : fieldAny(field));

  const questionState = (qEl) => {
    const fields = fieldIndex.get(qEl.dataset.q);
    const meta = state.q[qEl.dataset.q] || {};
    const any = fields.some(fieldAny);
    if (!any) return 'empty';
    if (meta.chk === 'ok' || meta.sc === 'yes') return 'done';
    if (meta.sc === 'part' || meta.sc === 'no') return 'weak';
    return fields.every(fieldFilled) ? 'filled' : 'partial';
  };

  const taskState = (taskEl) => {
    const qEls = $$('.ws-q', taskEl);
    if (!qEls.length) return state.done[taskEl.dataset.task] ? 'done' : 'empty';
    const states = qEls.map(questionState);
    if (states.every((s) => s === 'done')) return 'done';
    if (states.includes('weak')) return 'weak';
    if (states.every((s) => s === 'filled' || s === 'done')) return 'filled';
    if (states.some((s) => s !== 'empty')) return 'partial';
    return 'empty';
  };

  // ------------------------------------------------------------------ rendering of one question
  const updateQuestion = (qEl) => {
    const qid = qEl.dataset.q;
    const fields = fieldIndex.get(qid);
    const any = fields.some(fieldAny);
    if (!any && state.q[qid]) { delete state.q[qid]; touch(); }
    const meta = state.q[qid] || {};

    $$('.ws-clear', qEl).forEach((button) => {
      const field = fields.find((f) => f.key === button.dataset.clear);
      button.hidden = !(field && fieldAny(field));
    });

    const solutionButton = $('[data-act="solution"]', qEl);
    const solutionEl = $('[data-solution]', qEl);
    if (solutionButton && solutionEl) {
      solutionButton.disabled = !any;
      solutionButton.title = any ? '' : 'Schreibe zuerst deine eigene Antwort.';
      solutionButton.textContent = meta.open ? 'Musterlösung verbergen' : 'Musterlösung anzeigen';
      solutionEl.hidden = !(any && meta.open);
      $$('.ws-sc', solutionEl).forEach((button) => button.setAttribute('aria-pressed', String(meta.sc === button.dataset.sc)));
      $$('[data-crit]', solutionEl).forEach((box) => { box.checked = Boolean(meta.crit && meta.crit[Number(box.dataset.crit)]); });
    }

    const feedback = $('.ws-feedback', qEl);
    if (feedback && qEl.dataset.check && meta.chk === 'ok' && !feedback.textContent) {
      feedback.textContent = '✓ Stimmt.';
      feedback.dataset.result = 'ok';
    }
    qEl.dataset.state = questionState(qEl);
  };

  const updateAll = () => {
    questionEls.forEach(updateQuestion);
    let answered = 0;
    let required = 0;
    const counts = { done: 0, weak: 0 };
    taskEls.forEach((taskEl) => {
      const value = taskState(taskEl);
      taskEl.dataset.state = value;
      $$(`[data-nav-task="${taskEl.dataset.task}"]`).forEach((node) => { node.dataset.state = value; });
      if (taskEl.hasAttribute('data-optional')) return;
      required += 1;
      if (value === 'filled' || value === 'done' || value === 'weak') answered += 1;
      if (value === 'done') counts.done += 1;
      if (value === 'weak') counts.weak += 1;
    });
    const count = $('#ws-count');
    count.textContent = `${answered}/${required}`;
    count.title = `${answered} von ${required} Aufgaben beantwortet, davon ${counts.done} als richtig/geprüft markiert, ${counts.weak} zum nochmal Ansehen`;
    updateDirty();
  };

  const updateDirty = () => {
    const dirty = hasContent() && state.changedAt > state.exportedAt;
    $('.ws-dirty', $('#ws-data-btn')).hidden = !dirty;
  };

  // shots
  const activeShots = { current: null };
  const renderShot = (fieldEl) => {
    const key = fieldEl.dataset.f;
    const items = state.f[key] || [];
    const max = Number(fieldEl.dataset.max) || 4;
    const list = $('.ws-shot-items', fieldEl);
    list.textContent = '';
    items.forEach((item, index) => {
      const card = el('figure', 'ws-shot-card');
      const image = el('img');
      image.alt = `Screenshot ${index + 1}`;
      image.dataset.zoom = '';
      imageUrl(item.id).then((url) => { image.src = url; });
      const caption = el('input', 'ws-shot-cap');
      caption.type = 'text';
      caption.placeholder = 'Beschriftung (optional)';
      caption.value = item.cap || '';
      caption.addEventListener('input', () => { item.cap = caption.value; touch(); renderRefs(); });
      const remove = el('button', 'ws-shot-remove', '✕');
      remove.type = 'button';
      remove.title = 'Bild entfernen';
      remove.setAttribute('aria-label', 'Bild entfernen');
      remove.addEventListener('click', () => removeImage(key, item.id));
      card.append(image, caption, remove);
      list.append(card);
    });
    $('.ws-drop', fieldEl).hidden = items.length >= max;
  };

  const renderRefs = () => {
    $$('.ws-refs').forEach((box) => {
      const refs = JSON.parse(box.dataset.refs);
      box.textContent = '';
      box.append(el('p', 'ws-refs-title', 'Zum Vergleich: deine Screenshots'));
      const grid = el('div', 'ws-refs-grid');
      refs.forEach((ref) => {
        const items = [];
        (fieldIndex.get(ref.q) || []).filter((f) => f.kind === 'shot').forEach((f) => (state.f[f.key] || []).forEach((item) => items.push(item)));
        const cell = el('figure', 'ws-ref-cell');
        if (items.length) {
          items.forEach((item) => {
            const image = el('img');
            image.dataset.zoom = '';
            image.alt = ref.label;
            imageUrl(item.id).then((url) => { image.src = url; });
            cell.append(image);
          });
        } else {
          cell.append(el('span', 'ws-ref-empty', 'noch kein Screenshot'));
        }
        const caption = el('figcaption');
        const link = el('a', null, ref.label);
        link.href = `#${ref.q}`;
        caption.append(link);
        cell.append(caption);
        grid.append(cell);
      });
      box.append(grid);
    });
  };

  const addImages = async (fieldEl, files) => {
    const key = fieldEl.dataset.f;
    const max = Number(fieldEl.dataset.max) || 4;
    const images = files.filter((file) => file.type.startsWith('image/'));
    if (!images.length) { toast('Das ist keine Bilddatei.'); return; }
    for (const file of images) {
      const items = state.f[key] || [];
      if (items.length >= max) { toast(`Hier haben höchstens ${max} Bild(er) Platz. Entferne zuerst ein Bild.`); break; }
      try {
        const { blob, width, height } = await prepareImage(file);
        const id = randomId();
        const stored = await imagePut({ key: imageKey(id), ws: WS, id, blob, type: blob.type, width, height, created: Date.now() });
        if (!stored) toast('Das Bild konnte nicht dauerhaft gespeichert werden und bleibt nur bis zum Schliessen der Seite erhalten. Sichere deine Daten.', { timeout: 8000 });
        state.f[key] = [...(state.f[key] || []), { id, cap: '' }];
        touch();
        renderShot(fieldEl);
        renderRefs();
        updateAll();
      } catch (error) {
        toast('Dieses Bild konnte nicht verarbeitet werden.');
      }
    }
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  };

  const withUndo = (message, snapshot, restore) => {
    const ids = snapshot.imageIds || [];
    ids.forEach((id) => protectedIds.add(id));
    toast(message, {
      action: { label: 'Rückgängig', run: () => { restore(); touch(); applyStateToDom(); } },
      onClose: () => { ids.forEach((id) => protectedIds.delete(id)); collectGarbage(); },
    });
  };

  const removeImage = (key, id) => {
    const before = state.f[key] || [];
    const remaining = before.filter((item) => item.id !== id);
    if (remaining.length) state.f[key] = remaining; else delete state.f[key];
    touch();
    const fieldEl = $(`.ws-shot[data-f="${CSS.escape(key)}"]`);
    renderShot(fieldEl);
    renderRefs();
    updateAll();
    withUndo('Bild entfernt.', { imageIds: [id] }, () => { state.f[key] = before; });
  };

  const clearField = (key) => {
    const previous = state.f[key];
    if (previous === undefined) return;
    delete state.f[key];
    touch();
    applyStateToDom();
    const imageIds = Array.isArray(previous) ? previous.map((item) => item.id) : [];
    withUndo('Feld geleert.', { imageIds }, () => { state.f[key] = previous; });
  };

  // ------------------------------------------------------------------ applying stored state to the DOM
  const autosize = (area) => {
    area.style.height = 'auto';
    area.style.height = `${area.scrollHeight + 2}px`;
  };

  const applyStateToDom = () => {
    $$('textarea[data-f], input[data-f]').forEach((input) => {
      input.value = state.f[input.dataset.f] || '';
      if (input.tagName === 'TEXTAREA') autosize(input);
    });
    $$('.ws-field[data-kind="table"]').forEach((fieldEl) => {
      const value = state.f[fieldEl.dataset.f] || {};
      $$('tr[data-row]', fieldEl).forEach((row) => {
        $$('.ws-cell', row).forEach((cell) => {
          cell.value = (value[row.dataset.row] || {})[cell.dataset.col] || '';
          cell.classList.remove('is-ok', 'is-bad');
        });
      });
    });
    $$('.ws-shot').forEach(renderShot);
    $$('[data-done]').forEach((box) => { box.checked = Boolean(state.done[box.dataset.done]); });
    $$('[data-profile]').forEach((input) => { input.value = state.profile[input.dataset.profile] || ''; });
    $$('.ws-feedback').forEach((node) => { node.textContent = ''; delete node.dataset.result; });
    renderRefs();
    updateAll();
  };

  // ------------------------------------------------------------------ checks
  const extractNumbers = (text) => {
    const joined = text.replace(/(\d)[\s'’\u00a0\u202f](?=\d{3}(?!\d))/g, '$1');
    const numbers = [];
    (joined.match(/\d+(?:[.,]\d+)?/g) || []).forEach((token) => {
      numbers.push(parseFloat(token.replace(',', '.')));
      if (/^\d{1,3}\.\d{3}$/.test(token)) numbers.push(parseInt(token.replace('.', ''), 10));
    });
    return numbers;
  };

  const parseNumber = (text) => {
    const cleaned = String(text).trim().replace('−', '-').replace(',', '.');
    if (!/^-?\d*\.?\d+$/.test(cleaned)) return null;
    return parseFloat(cleaned);
  };

  const checkNumbers = (qEl, spec) => {
    const fields = fieldIndex.get(qEl.dataset.q).filter((f) => f.kind === 'text' || f.kind === 'line');
    const text = fields.map((f) => state.f[f.key] || '').join(' ');
    if (!text.trim()) return { ok: false, msg: 'Gib zuerst eine Antwort ein.' };
    const numbers = extractNumbers(text);
    const tolerance = spec.tol == null ? 1e-9 : spec.tol;
    const same = (a, b) => Math.abs(a - b) <= tolerance;
    let ok;
    if (spec.ordered) {
      let next = 0;
      numbers.forEach((n) => { if (next < spec.values.length && same(n, spec.values[next])) next += 1; });
      ok = next === spec.values.length;
    } else {
      ok = spec.values.every((v) => numbers.some((n) => same(n, v)));
    }
    return ok ? { ok, msg: '✓ Stimmt.' } : { ok, msg: `✗ Noch nicht ganz.${spec.hint ? ` ${spec.hint}` : ''}` };
  };

  const checkTable = (qEl, spec) => {
    const tableField = fieldIndex.get(qEl.dataset.q).find((f) => f.kind === 'table');
    const tolerance = spec.tol == null ? 0.02 : spec.tol;
    let incomplete = false;
    let bad = false;
    let signMix = false;
    let hasExpectedOutput = false;
    $$('tr[data-row]', tableField.el).forEach((row) => {
      const cells = {};
      const values = {};
      $$('.ws-cell', row).forEach((cell) => {
        cells[cell.dataset.col] = cell;
        values[cell.dataset.col] = parseNumber(cell.value);
        cell.classList.remove('is-ok', 'is-bad');
        if (!cell.value.trim() || values[cell.dataset.col] === null) incomplete = true;
      });
      const expected = (spec.expected || {})[row.dataset.row] || {};
      Object.keys(expected).forEach((col) => {
        if (col === 'output') hasExpectedOutput = true;
        if (values[col] === null || values[col] === undefined) return;
        const limit = col === 'target' ? 0.001 : tolerance;
        const good = Math.abs(values[col] - expected[col]) <= limit;
        cells[col].classList.add(good ? 'is-ok' : 'is-bad');
        if (!good) bad = true;
      });
      if (spec.consistency && values.output !== null && values.target !== null && values.error !== null) {
        const wrong = Math.abs(values.error - (values.output - values.target)) > 0.015;
        if (wrong) {
          bad = true;
          cells.error.classList.remove('is-ok');
          cells.error.classList.add('is-bad');
          if (Math.abs(values.error - (values.target - values.output)) <= 0.015) signMix = true;
        } else if (!cells.error.classList.contains('is-bad')) {
          cells.error.classList.add('is-ok');
        }
      }
    });
    if (incomplete) return { ok: false, msg: 'Fülle zuerst alle Felder mit Zahlen aus.' };
    if (bad) {
      const extra = signMix ? ' Achte auf das Vorzeichen: error = output − target.' : '';
      return { ok: false, msg: `✗ Rot markierte Werte stimmen noch nicht.${extra}${spec.hint ? ` ${spec.hint}` : ''}` };
    }
    return { ok: true, msg: hasExpectedOutput ? '✓ Stimmt – und error = output − target.' : '✓ In sich stimmig: error = output − target.' };
  };

  const runCheck = (qEl) => {
    const spec = JSON.parse(qEl.dataset.check);
    const result = spec.type === 'table' ? checkTable(qEl, spec) : checkNumbers(qEl, spec);
    const feedback = $('.ws-feedback', qEl);
    feedback.textContent = result.msg;
    feedback.dataset.result = result.ok ? 'ok' : 'bad';
    const qid = qEl.dataset.q;
    const meta = state.q[qid] || (state.q[qid] = {});
    if (/Gib zuerst|Fülle zuerst/.test(result.msg)) { delete meta.chk; } else { meta.chk = result.ok ? 'ok' : 'bad'; }
    if (!Object.keys(meta).length) delete state.q[qid];
    touch();
    updateAll();
  };

  const invalidateCheck = (qEl) => {
    const qid = qEl.dataset.q;
    const meta = state.q[qid];
    if (meta && meta.chk) { delete meta.chk; }
    const feedback = $('.ws-feedback', qEl);
    if (feedback) { feedback.textContent = ''; delete feedback.dataset.result; }
    $$('.ws-cell', qEl).forEach((cell) => cell.classList.remove('is-ok', 'is-bad'));
  };

  // ------------------------------------------------------------------ input handling
  document.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.matches('textarea[data-f], input[data-f]')) {
      const key = target.dataset.f;
      if (target.value.trim()) state.f[key] = target.value; else delete state.f[key];
      if (target.tagName === 'TEXTAREA') autosize(target);
      const qEl = target.closest('.ws-q');
      invalidateCheck(qEl);
      touch();
      updateAll();
      return;
    }
    if (target.matches('.ws-cell')) {
      const fieldEl = target.closest('.ws-field');
      const key = fieldEl.dataset.f;
      const rowId = target.closest('tr').dataset.row;
      const value = state.f[key] || {};
      value[rowId] = value[rowId] || {};
      if (target.value.trim()) value[rowId][target.dataset.col] = target.value; else delete value[rowId][target.dataset.col];
      if (!Object.keys(value[rowId]).length) delete value[rowId];
      if (Object.keys(value).length) state.f[key] = value; else delete state.f[key];
      invalidateCheck(target.closest('.ws-q'));
      touch();
      updateAll();
      return;
    }
    if (target.matches('[data-profile]')) {
      state.profile[target.dataset.profile] = target.value;
      touch();
    }
  });

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.matches('[data-done]')) {
      if (target.checked) state.done[target.dataset.done] = 1; else delete state.done[target.dataset.done];
      touch();
      updateAll();
    } else if (target.matches('[data-crit]')) {
      const qEl = target.closest('.ws-q');
      const meta = state.q[qEl.dataset.q] || (state.q[qEl.dataset.q] = {});
      meta.crit = meta.crit || [];
      meta.crit[Number(target.dataset.crit)] = target.checked;
      touch();
    } else if (target.matches('.ws-shot input[type="file"]')) {
      addImages(target.closest('.ws-shot'), Array.from(target.files));
      target.value = '';
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const term = target.closest('.ws-term');
    if (term) { event.preventDefault(); togglePopover(term); return; }
    if (popover && !target.closest('.ws-pop')) closePopover();

    const zoom = target.closest('img[data-zoom]');
    if (zoom && zoom.src) { openLightbox(zoom); return; }

    const clear = target.closest('.ws-clear');
    if (clear) { clearField(clear.dataset.clear); return; }

    const drop = target.closest('.ws-drop');
    if (drop) { $('input[type="file"]', drop.closest('.ws-shot')).click(); return; }

    const action = target.closest('[data-act]');
    if (action) {
      const qEl = action.closest('.ws-q');
      switch (action.dataset.act) {
        case 'check': runCheck(qEl); break;
        case 'solution': {
          const meta = state.q[qEl.dataset.q] || (state.q[qEl.dataset.q] = {});
          meta.open = !meta.open;
          if (meta.open) meta.rev = 1;
          touch();
          updateAll();
          break;
        }
        case 'nav': toggleNav(); break;
        case 'next': goNext(); break;
        case 'data': openDataDialog(); break;
        default: break;
      }
      return;
    }

    const selfCheck = target.closest('.ws-sc');
    if (selfCheck) {
      const qEl = selfCheck.closest('.ws-q');
      const meta = state.q[qEl.dataset.q] || (state.q[qEl.dataset.q] = {});
      meta.sc = meta.sc === selfCheck.dataset.sc ? null : selfCheck.dataset.sc;
      if (!meta.sc) delete meta.sc;
      touch();
      updateAll();
      return;
    }

    const resetChapter = target.closest('[data-reset-chapter]');
    if (resetChapter) { resetChapterAnswers(resetChapter.dataset.resetChapter); return; }

    if (target.closest('.ws-nav a') && window.matchMedia('(max-width: 1099px)').matches) closeNav();
    if (target.classList.contains('ws-nav-backdrop')) closeNav();
  });

  const resetChapterAnswers = async (chapterId) => {
    const chapterEl = document.getElementById(chapterId);
    const confirmed = await confirmDialog('Kapitel zurücksetzen?', 'Alle Antworten, Screenshots und Einschätzungen dieses Kapitels werden gelöscht.');
    if (!confirmed) return;
    $$('.ws-q', chapterEl).forEach((qEl) => {
      Object.keys(state.f).forEach((key) => { if (key.startsWith(`${qEl.dataset.q}:`)) delete state.f[key]; });
      delete state.q[qEl.dataset.q];
    });
    $$('[data-done]', chapterEl).forEach((box) => delete state.done[box.dataset.done]);
    touch();
    applyStateToDom();
    collectGarbage();
  };

  // ------------------------------------------------------------------ screenshots: paste, drop
  const imageFilesFrom = (transfer) => {
    if (!transfer) return [];
    const files = Array.from(transfer.files || []).filter((file) => file.type.startsWith('image/'));
    if (files.length) return files;
    return Array.from(transfer.items || []).filter((item) => item.kind === 'file' && item.type.startsWith('image/')).map((item) => item.getAsFile()).filter(Boolean);
  };

  const isFull = (shotEl) => (state.f[shotEl.dataset.f] || []).length >= (Number(shotEl.dataset.max) || 4);

  const pickShotForPaste = (target) => {
    const qEl = target && target.closest ? target.closest('.ws-q') : null;
    if (qEl) {
      const own = $$('.ws-shot', qEl).find((s) => !isFull(s));
      if (own) return own;
    }
    if (activeShots.current && !isFull(activeShots.current)) return activeShots.current;
    const middle = window.innerHeight / 2;
    let best = null;
    let bestDistance = Infinity;
    $$('.ws-shot').filter((s) => !isFull(s)).forEach((shotEl) => {
      const rect = shotEl.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const distance = Math.abs((rect.top + rect.bottom) / 2 - middle);
      if (distance < bestDistance) { best = shotEl; bestDistance = distance; }
    });
    return best;
  };

  document.addEventListener('paste', (event) => {
    const files = imageFilesFrom(event.clipboardData);
    if (!files.length) return;
    const shotEl = pickShotForPaste(event.target);
    if (!shotEl) { toast('Klicke zuerst in das Bild-Feld, in das der Screenshot soll.'); return; }
    event.preventDefault();
    addImages(shotEl, files);
  });

  document.addEventListener('focusin', (event) => {
    const shotEl = event.target.closest && event.target.closest('.ws-shot');
    if (shotEl) setActiveShot(shotEl);
  });
  document.addEventListener('click', (event) => {
    const shotEl = event.target.closest && event.target.closest('.ws-shot');
    if (shotEl) setActiveShot(shotEl);
  }, true);
  const setActiveShot = (shotEl) => {
    if (activeShots.current === shotEl) return;
    if (activeShots.current) activeShots.current.classList.remove('is-active');
    activeShots.current = shotEl;
    shotEl.classList.add('is-active');
  };
  document.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.classList && event.target.classList.contains('ws-drop')) {
      event.preventDefault();
      $('input[type="file"]', event.target.closest('.ws-shot')).click();
    }
  });

  document.addEventListener('dragover', (event) => {
    if (!event.dataTransfer || !Array.from(event.dataTransfer.types || []).includes('Files')) return;
    event.preventDefault();
    const shotEl = event.target.closest && event.target.closest('.ws-shot');
    $$('.ws-shot.is-over').forEach((node) => { if (node !== shotEl) node.classList.remove('is-over'); });
    if (shotEl) shotEl.classList.add('is-over');
  });
  document.addEventListener('dragleave', (event) => {
    if (!event.relatedTarget) $$('.ws-shot.is-over').forEach((node) => node.classList.remove('is-over'));
  });
  document.addEventListener('drop', (event) => {
    if (!event.dataTransfer || !Array.from(event.dataTransfer.types || []).includes('Files')) return;
    event.preventDefault();
    $$('.ws-shot.is-over').forEach((node) => node.classList.remove('is-over'));
    const shotEl = event.target.closest && event.target.closest('.ws-shot');
    if (shotEl) addImages(shotEl, imageFilesFrom(event.dataTransfer));
  });

  // ------------------------------------------------------------------ lightbox
  const lightbox = $('#ws-lightbox');
  const openLightbox = (image) => {
    const figure = image.closest('figure');
    const caption = figure && $('figcaption', figure);
    const own = figure && $('.ws-shot-cap', figure);
    $('img', lightbox).src = image.src;
    $('img', lightbox).alt = image.alt;
    $('.ws-lightbox-cap', lightbox).textContent = (own && own.value) || (caption && caption.textContent) || image.alt || '';
    lightbox.showModal();
  };
  lightbox.addEventListener('click', (event) => { if (event.target === lightbox || event.target.tagName === 'IMG') lightbox.close(); });

  // ------------------------------------------------------------------ glossary popover
  const glossary = JSON.parse($('#ws-glossary').textContent || '{}');
  let popover = null;
  const closePopover = () => { if (popover) { popover.remove(); popover = null; } };
  const togglePopover = (button) => {
    const same = popover && popover.anchor === button;
    closePopover();
    if (same) return;
    const entry = glossary[button.dataset.term];
    if (!entry) return;
    const node = el('div', 'ws-pop');
    node.setAttribute('role', 'dialog');
    node.anchor = button;
    const close = el('button', 'ws-pop-close', '✕');
    close.type = 'button';
    close.setAttribute('aria-label', 'Schliessen');
    close.addEventListener('click', closePopover);
    node.append(close, el('p', 'ws-pop-title', entry.label), el('p', 'ws-pop-short', entry.short));
    const details = el('details', 'ws-pop-more');
    const summary = el('summary');
    summary.append('Aus dem Infotext: ', el('em', null, entry.infoTitle));
    const excerpt = el('p');
    excerpt.innerHTML = entry.excerpt;
    details.append(summary, excerpt);
    const link = el('a', 'ws-pop-link', 'Im Infotext der App lesen ↗');
    link.href = `${APP_ROOT}#${entry.info}`;
    link.target = 'nnplayground-app';
    link.rel = 'noopener';
    node.append(details, link);
    document.body.append(node);
    const rect = button.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 16);
    node.style.width = `${width}px`;
    node.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)) + window.scrollX}px`;
    node.style.top = `${rect.bottom + window.scrollY + 6}px`;
    popover = node;
  };
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closePopover(); });
  document.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.classList && event.target.classList.contains('ws-term')) {
      event.preventDefault();
      togglePopover(event.target);
    }
  });

  // ------------------------------------------------------------------ navigation
  const root = document.documentElement;
  const topbar = $('#ws-topbar');
  const syncTopbarHeight = () => root.style.setProperty('--ws-top-h', `${topbar.offsetHeight}px`);
  if ('ResizeObserver' in window) new ResizeObserver(syncTopbarHeight).observe(topbar);
  syncTopbarHeight();

  const nav = $('#ws-nav');
  const backdrop = el('div', 'ws-nav-backdrop');
  document.body.append(backdrop);
  const toggleNav = () => (body.classList.contains('ws-nav-open') ? closeNav() : openNav());
  const openNav = () => { body.classList.add('ws-nav-open'); $('[data-act="nav"]').setAttribute('aria-expanded', 'true'); };
  const closeNav = () => { body.classList.remove('ws-nav-open'); $('[data-act="nav"]').setAttribute('aria-expanded', 'false'); };
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeNav(); });

  const chapterEls = $$('.ws-chapter');
  let currentTask = null;
  let spyScheduled = false;
  const spy = () => {
    spyScheduled = false;
    const offset = topbar.offsetHeight + 24;
    let chapter = null;
    chapterEls.forEach((node) => { if (node.getBoundingClientRect().top <= offset + 40) chapter = node; });
    let task = null;
    taskEls.forEach((node) => { if (node.getBoundingClientRect().top <= offset + 40) task = node; });
    currentTask = task;
    const label = chapter ? `${$('.ws-h1-num', chapter) ? `Kap. ${$('.ws-h1-num', chapter).textContent} · ` : ''}${$('.ws-h1', chapter).textContent.replace(/^\d+/, '')}` : '';
    $('#ws-current').textContent = label;
    $$('.ws-nav-chap').forEach((item) => item.classList.toggle('is-current', Boolean(chapter) && item.dataset.navChap === chapter.id));
    $$('.ws-chip').forEach((chip) => chip.classList.toggle('is-current', Boolean(task) && chip.dataset.navTask === task.dataset.task));
    $$('.ws-seg').forEach((seg) => seg.classList.toggle('is-current', Boolean(task) && seg.dataset.navTask === task.dataset.task));
  };
  window.addEventListener('scroll', () => { if (!spyScheduled) { spyScheduled = true; requestAnimationFrame(spy); } }, { passive: true });
  window.addEventListener('resize', spy);

  const goNext = () => {
    const open = taskEls.filter((node) => !node.hasAttribute('data-optional') && ['empty', 'partial'].includes(node.dataset.state));
    if (!open.length) { toast('Alle Aufgaben sind beantwortet.'); return; }
    const currentIndex = currentTask ? taskEls.indexOf(currentTask) : -1;
    const target = open.find((node) => taskEls.indexOf(node) > currentIndex) || open[0];
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ------------------------------------------------------------------ data dialog: export, import, print, reset
  const dataDialog = $('#ws-data-dialog');
  const formatAgo = (timestamp) => {
    if (!timestamp) return 'noch nie';
    const minutes = Math.round((Date.now() - timestamp) / 60000);
    if (minutes < 1) return 'gerade eben';
    if (minutes < 60) return `vor ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `vor ${hours} h`;
    return `vor ${Math.round(hours / 24)} Tagen`;
  };

  const openDataDialog = async () => {
    const imageCount = referencedImageIds().size;
    let usage = '';
    if (navigator.storage && navigator.storage.estimate) {
      try { const { usage: used } = await navigator.storage.estimate(); usage = ` Belegter Speicher dieser Website: ca. ${(used / 1048576).toFixed(1)} MB.`; } catch (error) { /* ignore */ }
    }
    $('#ws-data-info').textContent = `Deine Eingaben liegen nur in diesem Browser auf diesem Gerät (${imageCount} Screenshot${imageCount === 1 ? '' : 's'}). Letzte Sicherung: ${formatAgo(state.exportedAt)}.${usage}${storageWorks ? '' : ' ACHTUNG: Der Browser verhindert das Speichern.'}`;
    dataDialog.showModal();
  };

  const safeName = (text) => (text || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const exportData = async () => {
    flush();
    const images = {};
    for (const id of referencedImageIds()) {
      const record = await imageGet(id);
      if (record) images[id] = { type: record.type, width: record.width, height: record.height, data: await blobToDataUrl(record.blob) };
    }
    const payload = {
      format: 'nnplayground-worksheet',
      version: 1,
      worksheet: WS,
      title: body.dataset.wsTitle,
      exportedAt: new Date().toISOString(),
      state,
      images,
    };
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const link = el('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${WS}_${safeName(state.profile.name) || 'antworten'}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    state.exportedAt = Date.now();
    flush();
    updateDirty();
    toast('Sicherungsdatei gespeichert. Lege sie an einem sicheren Ort ab.');
  };

  const importData = async (file) => {
    let payload;
    try {
      payload = JSON.parse(await file.text());
    } catch (error) {
      toast('Diese Datei konnte nicht gelesen werden.');
      return;
    }
    if (!payload || payload.format !== 'nnplayground-worksheet' || payload.worksheet !== WS || !payload.state) {
      toast('Diese Datei gehört nicht zu diesem Arbeitsblatt.');
      return;
    }
    if (hasContent()) {
      const confirmed = await confirmDialog('Stand ersetzen?', 'Dein aktueller Stand in diesem Browser wird durch die Sicherung ersetzt.', 'Ja, ersetzen');
      if (!confirmed) return;
    }
    for (const [id, image] of Object.entries(payload.images || {})) {
      const blob = await (await fetch(image.data)).blob();
      await imagePut({ key: imageKey(id), ws: WS, id, blob, type: image.type, width: image.width, height: image.height, created: Date.now() });
    }
    state = Object.assign(emptyState(), payload.state);
    state.exportedAt = Date.now();
    state.changedAt = state.exportedAt;
    flush();
    applyStateToDom();
    collectGarbage();
    dataDialog.close();
    toast('Sicherung geladen.');
  };

  const resetEverything = async () => {
    const confirmed = await confirmDialog('Alles löschen?', 'Alle Antworten, Screenshots, Einschätzungen und Namen auf diesem Gerät werden gelöscht. Sichere sie vorher, falls du sie noch brauchst.', 'Ja, alles löschen');
    if (!confirmed) return;
    state = emptyState();
    flush();
    applyStateToDom();
    collectGarbage();
    dataDialog.close();
    toast('Alles gelöscht.');
  };

  dataDialog.addEventListener('click', (event) => {
    const button = event.target.closest('[data-data]');
    if (!button) return;
    switch (button.dataset.data) {
      case 'export': exportData(); break;
      case 'import': $('#ws-import-file').click(); break;
      case 'print': dataDialog.close(); setTimeout(() => window.print(), 150); break;
      case 'reset': resetEverything(); break;
      default: break;
    }
  });
  $('#ws-import-file').addEventListener('change', (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (file) importData(file);
  });

  window.addEventListener('beforeprint', () => $$('textarea[data-f]').forEach(autosize));
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) showBanner('Dieses Arbeitsblatt wurde in einem anderen Tab geändert. Lade die Seite neu, damit nichts überschrieben wird.', 'Neu laden', () => window.location.reload());
  });

  // ------------------------------------------------------------------ init
  if (!storageWorks) showBanner('Dein Browser erlaubt kein Speichern (privates Fenster?). Deine Eingaben gehen beim Schliessen verloren – sichere sie unter «Meine Daten».');
  applyStateToDom();
  collectGarbage();
  spy();
  window.addEventListener('load', spy);
})();
