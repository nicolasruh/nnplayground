// Builds every worksheet in worksheets/<name>/ (content.mjs) into worksheets/<name>/index.html.
// Shared layout and behaviour live in worksheets/shared/ (worksheet.css, worksheet.js, glossary.json).
import { readFile, writeFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wsRoot = path.join(root, 'worksheets');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => esc(s).replace(/"/g, '&quot;');
const jsonAttr = (o) => escAttr(JSON.stringify(o));
const fail = (msg) => { throw new Error(msg); };

// ---------------------------------------------------------------- infotext excerpts
const decodeEntities = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

const parseInfotext = (source) => {
  const tokens = [...source.matchAll(/<h([23])\s+id="([^"]+)">([\s\S]*?)<\/h\1>/g)];
  const sections = new Map();
  tokens.forEach((match, index) => {
    const start = match.index + match[0].length;
    const end = tokens[index + 1] ? tokens[index + 1].index : source.length;
    const paragraphs = [...source.slice(start, end).matchAll(/<p>([\s\S]*?)<\/p>/g)]
      .map((p) => p[1].replace(/<a\s[^>]*>([\s\S]*?)<\/a>/g, '$1').replace(/\s+/g, ' ').trim());
    sections.set(match[2], {
      title: decodeEntities(match[3].replace(/<[^>]+>/g, '')).trim(),
      paragraphs,
    });
  });
  return sections;
};

// ---------------------------------------------------------------- inline markup
// **bold**, *italic*, `code`, [[term]] / [[!term]] / [[term|text]], {{ref:task-id}}, {{fig:figure-id}},
// [text](url) and [text](app:#anchor) for links into the app.
const makeInline = (state) => (src, { terms = true } = {}) => {
  let out = esc(src);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g, '$1<em>$2</em>');
  out = out.replace(/\[\[(!)?([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (match, force, term, text) => {
    if (!state.glossary[term]) fail(`Unknown glossary term "${term}"`);
    const label = text || state.glossary[term].label;
    state.usedTerms.add(term);
    if (!terms && !force) return label;
    if (!force && state.chapterTerms.has(term)) return label;
    state.chapterTerms.add(term);
    return `<span class="ws-term" role="button" tabindex="0" data-term="${term}">${label}</span>`;
  });
  out = out.replace(/\{\{ref:([a-z0-9-]+)\}\}/g, (match, id) => {
    const task = state.tasks.get(id);
    if (!task) fail(`Unknown task reference "${id}"`);
    return `<a class="ws-ref" href="#${id}">Aufgabe ${task.num}</a>`;
  });
  out = out.replace(/\{\{fig:([a-z0-9-]+)\}\}/g, (match, id) => {
    const fig = state.figures.get(id);
    if (!fig) fail(`Unknown figure reference "${id}"`);
    return `<a class="ws-ref" href="#${id}">Abb.&nbsp;${fig.num}</a>`;
  });
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, text, url) => {
    if (url.startsWith('app:')) {
      return `<a href="${state.appRoot}${url.slice(4)}" target="nnplayground-app" rel="noopener">${text}</a>`;
    }
    return `<a href="${url}" target="_blank" rel="noopener">${text}</a>`;
  });
  return out.replace(/\n/g, '<br>');
};

// Blank-line separated paragraphs; consecutive "- " lines become a list.
const makeParagraphs = (inline) => (text, options) => text.trim().split(/\n\s*\n/).map((para) => {
  const lines = para.split('\n');
  if (lines.every((line) => /^\s*- /.test(line))) {
    return `<ul class="ws-list">${lines.map((line) => `<li>${inline(line.replace(/^\s*- /, ''), options)}</li>`).join('')}</ul>`;
  }
  return `<p class="ws-text">${inline(para, options)}</p>`;
}).join('\n');

// ---------------------------------------------------------------- numbering pre-pass
const collectNumbers = (ws, state) => {
  let taskNum = 0;
  let figNum = 0;
  const seen = new Set();
  const unique = (id, what) => {
    if (!id) fail(`${what} without id`);
    if (seen.has(id)) fail(`Duplicate id "${id}"`);
    seen.add(id);
  };
  const visitBlocks = (blocks, chapter, inSolution) => {
    (blocks || []).forEach((block) => {
      if (block.type === 'task') {
        unique(block.id, 'task');
        state.tasks.set(block.id, { num: ++taskNum, chapter: chapter.id, optional: Boolean(block.optional || chapter.optional) });
        visitBlocks(block.media, chapter, false);
        (block.questions || []).forEach((q) => {
          unique(q.id, 'question');
          visitBlocks(q.solution?.blocks, chapter, true);
        });
      } else if (block.type === 'figure' && !inSolution) {
        unique(block.id, 'figure');
        state.figures.set(block.id, { num: ++figNum });
      }
    });
  };
  ws.chapters.forEach((chapter) => { unique(chapter.id, 'chapter'); visitBlocks(chapter.blocks, chapter, false); });
  const questions = new Set();
  ws.chapters.forEach((chapter) => (chapter.blocks || []).forEach((b) => (b.questions || []).forEach((q) => questions.add(q.id))));
  state.questionIds = questions;
};

// ---------------------------------------------------------------- block rendering
const renderWorksheet = (ws, glossary, infotext, dirName) => {
  const state = {
    glossary,
    usedTerms: new Set(),
    chapterTerms: new Set(),
    tasks: new Map(),
    figures: new Map(),
    appRoot: ws.appRoot || '../../',
  };
  collectNumbers(ws, state);
  const inline = makeInline(state);
  const paragraphs = makeParagraphs(inline);
  const taskList = [];

  const renderFigure = (block, inSolution) => {
    const width = block.width ? ` style="--ws-fig-width:${block.width}%"` : '';
    const idAttr = !inSolution && block.id ? ` id="${block.id}"` : '';
    const number = !inSolution ? state.figures.get(block.id).num : null;
    const caption = block.caption
      ? `<figcaption>${number ? `<strong>Abb.&nbsp;${number}</strong> · ` : ''}${inline(block.caption, { terms: false })}</figcaption>`
      : '';
    return `<figure class="ws-figure${inSolution ? ' ws-figure-solution' : ''}"${idAttr}${width}><img src="${escAttr(block.src)}" alt="${escAttr(block.alt || '')}" loading="lazy" data-zoom>${caption}</figure>`;
  };

  const renderTable = (block, options) => {
    const head = block.head ? `<thead><tr>${block.head.map((cell) => `<th>${inline(cell, options)}</th>`).join('')}</tr></thead>` : '';
    const rows = block.rows.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell, options)}</td>`).join('')}</tr>`).join('');
    const caption = block.caption ? `<p class="ws-table-caption">${inline(block.caption, options)}</p>` : '';
    return `${caption}<div class="ws-table-wrap"><table class="ws-table">${head}<tbody>${rows}</tbody></table></div>`;
  };

  const renderBlock = (block, context) => {
    const options = { terms: !context.solution };
    switch (block.type) {
      case 'text': return paragraphs(block.text, options);
      case 'heading': return `<h2 class="ws-h2">${inline(block.text, options)}</h2>`;
      case 'merke': return `<aside class="ws-merke"><strong class="ws-merke-label">Merke</strong>${paragraphs(block.text, options)}</aside>`;
      case 'hinweis': return `<aside class="ws-hinweis">${paragraphs(block.text, options)}</aside>`;
      case 'info': return `<aside class="ws-info"><strong class="ws-info-title">${inline(block.title, options)}</strong>${paragraphs(block.text, options)}</aside>`;
      case 'figure': return renderFigure(block, context.solution);
      case 'table': return renderTable(block, options);
      case 'list': return `<${block.ordered ? 'ol' : 'ul'} class="ws-list">${block.items.map((item) => `<li>${inline(item, options)}</li>`).join('')}</${block.ordered ? 'ol' : 'ul'}>`;
      case 'goals': return `<ol class="ws-goals">${block.items.map((item) => `<li>${inline(item, options)}</li>`).join('')}</ol>`;
      case 'profile':
        return `<div class="ws-profile"><label>Name<input type="text" data-profile="name" autocomplete="name" placeholder="Vorname Nachname"></label><label>Partner/in (optional)<input type="text" data-profile="partner" placeholder="Vorname Nachname"></label><p class="ws-profile-note">Die Namen bleiben auf diesem Gerät und erscheinen nur in der Sicherungsdatei und im Ausdruck.</p></div>`;
      case 'task': return renderTask(block, context);
      default: return fail(`Unknown block type "${block.type}"`);
    }
  };

  const renderSolution = (q) => {
    const sol = q.solution;
    if (!sol) return '';
    const body = [];
    if (sol.text) body.push(paragraphs(sol.text, { terms: false }));
    (sol.blocks || []).forEach((block) => body.push(renderBlock(block, { solution: true })));
    const criteria = (sol.criteria || []).length
      ? `<div class="ws-criteria"><p class="ws-criteria-title">Darauf kommt es an – hake ab, was bei dir vorkommt:</p><ul>${sol.criteria.map((c, i) => `<li><label><input type="checkbox" data-crit="${i}"> <span>${inline(c, { terms: false })}</span></label></li>`).join('')}</ul></div>`
      : '';
    return `<div class="ws-solution" data-solution hidden>
      <p class="ws-solution-head">${sol.example ? 'Beispiel – dein Ergebnis darf abweichen' : 'Musterlösung'}</p>
      <div class="ws-solution-body">${body.join('\n')}</div>
      ${criteria}
      <div class="ws-selfcheck" role="group" aria-label="Selbsteinschätzung"><span>Meine Antwort enthält das Wesentliche:</span>
        <button type="button" class="ws-sc" data-sc="yes">ja</button><button type="button" class="ws-sc" data-sc="part">teilweise</button><button type="button" class="ws-sc" data-sc="no">noch nicht</button>
      </div>
    </div>`;
  };

  const renderField = (q, field, index) => {
    const key = `${q.id}:${field.id ?? index}`;
    const label = field.label ? `<label class="ws-label" for="f-${key.replace(':', '-')}">${inline(field.label, { terms: false })}</label>` : '';
    const domId = `f-${key.replace(':', '-')}`;
    switch (field.kind) {
      case 'text':
        return `<div class="ws-field" data-kind="text">${label}<textarea id="${domId}" class="ws-input" rows="${field.rows || 3}" data-f="${key}" placeholder="${escAttr(field.placeholder || 'Deine Antwort …')}"></textarea><button type="button" class="ws-clear" data-clear="${key}" hidden>Löschen</button></div>`;
      case 'line':
        return `<div class="ws-field ws-field-line" data-kind="line">${label}<input id="${domId}" class="ws-input" type="text" data-f="${key}" placeholder="${escAttr(field.placeholder || '')}"><button type="button" class="ws-clear" data-clear="${key}" hidden>Löschen</button></div>`;
      case 'shot':
        return `<div class="ws-field ws-shot" data-kind="shot" data-f="${key}" data-max="${field.max || 4}">${label || '<span class="ws-label">Screenshot</span>'}<div class="ws-shot-items"></div><div class="ws-drop" tabindex="0" role="group" aria-label="Bild einfügen"><span class="ws-drop-main">Screenshot einfügen</span><span class="ws-drop-sub">In der App «copy to clipboard» klicken, dann hier klicken und <kbd>Strg</kbd>/<kbd>Cmd</kbd> + <kbd>V</kbd> drücken. Oder eine Bilddatei hierher ziehen.</span><span class="ws-drop-buttons"><button type="button" class="ws-btn ws-btn-small" data-shot-act="clipboard">Aus Zwischenablage einfügen</button><button type="button" class="ws-btn ws-btn-small" data-shot-act="file">Datei wählen …</button></span></div><input type="file" accept="image/*" multiple hidden></div>`;
      case 'table': {
        const head = `<tr><th>${inline(field.rowHeader || '', { terms: false })}</th>${field.cols.map((col) => `<th>${inline(col.label, { terms: false })}</th>`).join('')}</tr>`;
        const rows = field.rows.map((row) => `<tr data-row="${row.id}"><th scope="row">${inline(row.label, { terms: false })}</th>${field.cols.map((col) => `<td><input class="ws-cell" type="text" inputmode="decimal" autocomplete="off" data-col="${col.key}" aria-label="${escAttr(`${row.label} – ${col.label}`)}"></td>`).join('')}</tr>`).join('');
        return `<div class="ws-field" data-kind="table" data-f="${key}">${label}<div class="ws-table-wrap"><table class="ws-grid"><thead>${head}</thead><tbody>${rows}</tbody></table></div><button type="button" class="ws-clear" data-clear="${key}" hidden>Tabelle leeren</button></div>`;
      }
      default: return fail(`Unknown field kind "${field.kind}" in ${q.id}`);
    }
  };

  const renderQuestion = (q, label) => {
    (q.refs || []).forEach((ref) => { if (!state.questionIds.has(ref.q)) fail(`Unknown question "${ref.q}" in refs of ${q.id}`); });
    const refs = (q.refs || []).length ? `<div class="ws-refs" data-refs="${jsonAttr(q.refs)}"></div>` : '';
    const prompt = q.prompt
      ? `<p class="ws-q-prompt">${label ? `<span class="ws-q-label">${label}</span>` : ''}${q.star ? '<span class="ws-star" title="anspruchsvoll">★</span>' : ''}${inline(q.prompt)}</p>`
      : (label ? `<p class="ws-q-prompt"><span class="ws-q-label">${label}</span></p>` : '');
    const check = q.check ? ` data-check="${jsonAttr(q.check)}"` : '';
    const actions = `<div class="ws-actions">${q.check ? '<button type="button" class="ws-btn" data-act="check">Prüfen</button>' : ''}${q.solution ? '<button type="button" class="ws-btn ws-btn-solution" data-act="solution" disabled title="Schreibe zuerst deine eigene Antwort.">Musterlösung anzeigen</button><span class="ws-rating"></span>' : ''}<span class="ws-feedback" role="status" aria-live="polite"></span></div>`;
    return `<div class="ws-q" id="${q.id}" data-q="${q.id}"${check}>
      ${prompt}${refs}
      ${(q.fields || []).map((field, i) => renderField(q, field, i)).join('\n')}
      ${q.fields?.length ? actions : ''}
      ${renderSolution(q)}
    </div>`;
  };

  const renderTask = (task, context) => {
    const info = state.tasks.get(task.id);
    const questions = task.questions || [];
    const multi = questions.length > 1;
    const plain = inline(task.text, { terms: false }).replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').trim();
    taskList.push({ id: task.id, num: info.num, chapter: context.chapter.id, optional: info.optional, title: plain.length > 90 ? `${plain.slice(0, 87)}…` : plain });
    const body = questions.length
      ? `<div class="ws-questions">${questions.map((q, i) => renderQuestion(q, q.label || (multi ? String.fromCharCode(97 + i) : ''))).join('\n')}</div>`
      : `<label class="ws-done"><input type="checkbox" data-done="${task.id}"> <span>erledigt</span></label>`;
    return `<section class="ws-task${info.optional ? ' is-optional' : ''}" id="${task.id}" data-task="${task.id}" data-num="${info.num}"${info.optional ? ' data-optional' : ''}>
      <div class="ws-task-box">
        <div class="ws-task-head"><span class="ws-task-num">Aufgabe ${info.num}${info.optional ? ' · optional' : ''}</span></div>
        <div class="ws-task-text">${paragraphs(task.text)}</div>
        ${(task.media || []).map((b) => renderBlock(b, context)).join('\n')}
      </div>
      ${body}
    </section>`;
  };

  // intro (hero + startklar), chapters
  state.chapterTerms = new Set();
  const intro = (ws.intro || []).map((block) => renderBlock(block, { chapter: { id: 'intro' } })).join('\n');

  const chapterNumbers = new Map();
  let chapterCounter = 0;
  ws.chapters.forEach((chapter) => { if (chapter.numbered !== false) chapterNumbers.set(chapter.id, ++chapterCounter); });

  const chaptersHtml = ws.chapters.map((chapter) => {
    state.chapterTerms = new Set();
    const number = chapterNumbers.get(chapter.id);
    const kicker = chapter.kicker || [number ? `Kapitel ${number}` : '', chapter.time ? `ca. ${chapter.time}` : ''].filter(Boolean).join(' · ');
    const blocks = (chapter.blocks || []).map((block) => renderBlock(block, { chapter })).join('\n');
    return `<section class="ws-chapter${chapter.optional ? ' is-optional' : ''}" id="${chapter.id}" data-chapter="${chapter.id}">
      <header class="ws-chapter-head"><p class="ws-kicker">${esc(kicker)}</p><h2 class="ws-h1">${number ? `<span class="ws-h1-num">${number}</span>` : ''}${inline(chapter.title, { terms: false })}</h2></header>
      ${blocks}
      <footer class="ws-chapter-foot"><button type="button" class="ws-link" data-reset-chapter="${chapter.id}">Antworten dieses Kapitels löschen</button></footer>
    </section>`;
  }).join('\n');

  // navigation
  const chapterTasks = (id) => taskList.filter((t) => t.chapter === id);
  const requiredTasks = taskList.filter((t) => !t.optional);
  const segments = ws.chapters.map((chapter) => {
    const list = chapterTasks(chapter.id);
    if (!list.length) return '';
    return `<span class="ws-seg-group${chapter.optional ? ' is-optional' : ''}" style="flex-grow:${list.length}">${list.map((t) => `<a class="ws-seg" href="#${t.id}" data-nav-task="${t.id}" data-state="empty" title="Aufgabe ${t.num}: ${escAttr(t.title)}" aria-label="Aufgabe ${t.num}"></a>`).join('')}</span>`;
  }).join('');
  const navChapters = ws.chapters.map((chapter) => {
    const number = chapterNumbers.get(chapter.id);
    const list = chapterTasks(chapter.id);
    return `<li class="ws-nav-chap" data-nav-chap="${chapter.id}">
      <a class="ws-nav-link" href="#${chapter.id}">${number ? `<span class="ws-nav-num">${number}</span>` : '<span class="ws-nav-num ws-nav-num-plain">•</span>'}<span>${inline(chapter.title, { terms: false })}</span></a>
      ${list.length ? `<div class="ws-chips">${list.map((t) => `<a class="ws-chip" href="#${t.id}" data-nav-task="${t.id}" data-state="empty" title="${escAttr(t.title)}">${t.num}</a>`).join('')}</div>` : ''}
    </li>`;
  }).join('');

  const glossaryData = {};
  state.usedTerms.forEach((term) => {
    const entry = glossary[term];
    const section = infotext.get(entry.info);
    if (!section) fail(`Glossary term "${term}" points to unknown infotext id "${entry.info}"`);
    const excerpt = section.paragraphs[entry.para ?? 0];
    if (!excerpt) fail(`Infotext section "${entry.info}" has no paragraph ${entry.para ?? 0} (term "${term}")`);
    if (excerpt.includes('\\(')) fail(`Infotext excerpt for "${term}" contains math; choose another "para" in glossary.json`);
    glossaryData[term] = { label: entry.label, short: entry.short, info: entry.info, infoTitle: section.title, excerpt };
  });

  const shortTitle = ws.shortTitle || ws.label;
  const title = `${ws.label} · ${ws.title}`;

  return `<!DOCTYPE html>
<!-- Generated by scripts/build-worksheets.mjs from worksheets/${dirName}/content.mjs – do not edit by hand. -->
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <link rel="icon" href="${state.appRoot}favicon.ico">
  <link rel="stylesheet" href="../shared/worksheet.css">
</head>
<body class="ws" data-ws-id="${escAttr(ws.id)}" data-ws-title="${escAttr(title)}" data-app-root="${escAttr(state.appRoot)}" data-required="${requiredTasks.length}">
<noscript><p class="ws-noscript">Dieses Arbeitsblatt braucht JavaScript, damit deine Eingaben gespeichert werden können.</p></noscript>
<header class="ws-topbar" id="ws-topbar">
  <button type="button" class="ws-iconbtn" data-act="nav" aria-label="Inhaltsübersicht öffnen" aria-controls="ws-nav" aria-expanded="false">☰</button>
  <div class="ws-top-title"><strong>${esc(shortTitle)}</strong><span class="ws-top-chapter" id="ws-current" aria-live="polite"></span></div>
  <nav class="ws-progress" aria-label="Fortschritt">${segments}</nav>
  <span class="ws-count" id="ws-count" title="Bearbeitete Aufgaben (ohne optionale)">0/${requiredTasks.length}</span>
  <button type="button" class="ws-btn ws-btn-small" data-act="next" title="Zur nächsten offenen Aufgabe">Weiter ▸</button>
  <button type="button" class="ws-btn ws-btn-small" data-act="data" id="ws-data-btn">Meine Daten<span class="ws-dirty" hidden title="Seit der letzten Sicherung geändert"></span></button>
  <a class="ws-btn ws-btn-small ws-btn-link" href="${state.appRoot}" target="nnplayground-app" rel="noopener">App ↗</a>
</header>
<div class="ws-banner" id="ws-banner" hidden></div>
<div class="ws-layout">
  <aside class="ws-nav" id="ws-nav" aria-label="Inhaltsübersicht">
    <p class="ws-nav-head">Inhalt</p>
    <ol class="ws-nav-list">
      <li class="ws-nav-chap" data-nav-chap="ws-start"><a class="ws-nav-link" href="#ws-start"><span class="ws-nav-num ws-nav-num-plain">•</span><span>Start</span></a></li>
      ${navChapters}
    </ol>
    <div class="ws-legend" aria-label="Legende">
      <span><i data-state="empty"></i>offen</span><span><i data-state="partial"></i>begonnen</span><span><i data-state="filled"></i>beantwortet</span><span><i data-state="done"></i>geprüft</span><span><i data-state="weak"></i>nochmal ansehen</span>
    </div>
  </aside>
  <main class="ws-main" id="ws-main">
    <article class="ws-page">
      <header class="ws-hero" id="ws-start">
        <p class="ws-brand">${esc(ws.brand || 'NN Playground')} · ${esc(ws.label)}</p>
        <h1 class="ws-title">${inline(ws.title, { terms: false })}</h1>
        ${ws.subtitle ? `<p class="ws-subtitle">${inline(ws.subtitle, { terms: false })}</p>` : ''}
        <div class="ws-meta">
          <dl class="ws-facts">${(ws.facts || []).map((f) => `<div><dt>${esc(f.label)}</dt><dd>${inline(f.value, { terms: false })}</dd></div>`).join('')}</dl>
          ${ws.leitfrage ? `<div class="ws-leitfrage"><strong>Leitfrage</strong><p>${inline(ws.leitfrage, { terms: false })}</p></div>` : ''}
        </div>
      </header>
      <section class="ws-intro">${intro}</section>
      ${chaptersHtml}
      <footer class="ws-footer"><span>${esc(ws.footer || '')}</span><span>Deine Eingaben werden nur in diesem Browser gespeichert. Sichere sie regelmässig unter «Meine Daten».</span></footer>
    </article>
  </main>
</div>

<dialog class="ws-dialog" id="ws-data-dialog" aria-labelledby="ws-data-title">
  <form method="dialog" class="ws-dialog-box">
    <h2 id="ws-data-title">Meine Daten</h2>
    <p class="ws-dialog-text" id="ws-data-info"></p>
    <div class="ws-dialog-actions">
      <button type="button" class="ws-btn ws-btn-primary" data-data="export">Sichern (Datei speichern)</button>
      <button type="button" class="ws-btn" data-data="import">Gesicherte Datei laden …</button>
      <button type="button" class="ws-btn" data-data="print">Drucken / als PDF speichern</button>
      <button type="button" class="ws-btn ws-btn-danger" data-data="reset">Alles löschen …</button>
    </div>
    <p class="ws-dialog-note">Tipp: Speichere die Sicherungsdatei zusätzlich in deiner Cloud oder schicke sie dir selbst. Ohne Sicherung gehen Eingaben verloren, wenn du die Browserdaten löschst.</p>
    <input type="file" accept="application/json,.json" hidden id="ws-import-file">
    <div class="ws-dialog-foot"><button class="ws-btn">Schliessen</button></div>
  </form>
</dialog>
<dialog class="ws-dialog ws-dialog-small" id="ws-confirm-dialog" aria-labelledby="ws-confirm-title">
  <form method="dialog" class="ws-dialog-box">
    <h2 id="ws-confirm-title">Sicher?</h2>
    <p class="ws-dialog-text" id="ws-confirm-text"></p>
    <div class="ws-dialog-foot"><button class="ws-btn" value="cancel">Abbrechen</button><button class="ws-btn ws-btn-danger" value="ok" id="ws-confirm-ok">Ja</button></div>
  </form>
</dialog>
<dialog class="ws-lightbox" id="ws-lightbox"><form method="dialog"><button class="ws-lightbox-close" aria-label="Schliessen">✕</button></form><img alt=""><p class="ws-lightbox-cap"></p></dialog>
<div class="ws-toasts" id="ws-toasts" aria-live="polite"></div>

<script type="application/json" id="ws-glossary">${JSON.stringify(glossaryData).replace(/</g, '\\u003c')}</script>
<script src="../shared/worksheet.js"></script>
</body>
</html>
`;
};

// ---------------------------------------------------------------- main
const glossary = JSON.parse(await readFile(path.join(wsRoot, 'shared', 'glossary.json'), 'utf8'));
const infotext = parseInfotext(await readFile(path.join(root, 'infotext_de.html'), 'utf8'));

const entries = await readdir(wsRoot, { withFileTypes: true });
let built = 0;
for (const entry of entries) {
  if (!entry.isDirectory() || entry.name === 'shared') continue;
  const contentPath = path.join(wsRoot, entry.name, 'content.mjs');
  try { await access(contentPath); } catch { continue; }
  const ws = (await import(pathToFileURL(contentPath).href)).default;
  const html = renderWorksheet(ws, glossary, infotext, entry.name);
  await writeFile(path.join(wsRoot, entry.name, 'index.html'), html);
  console.log(`worksheet ${entry.name}: ${html.length} bytes`);
  built += 1;
}
if (built === 0) console.log('No worksheets found.');
