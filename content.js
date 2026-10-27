// CrewBrain Plus – Ergänzungen für die Zeiterfassung (nur Oberfläche, speichert nichts selbst).
// 1. Raster: Anwesenheit/Pausen/Lücken als Hintergrund in allen Aufgaben-Zeilen + Zusammenfassung
// 2. Bearbeiten-Dialog: Start/Ende per Klick bündig setzen, „Lücke füllen“
// 3. Aufgaben-Dialog: Suche über Event + Aufgabe, Wortteile in beliebiger Reihenfolge, Tastatur, zuletzt genutzt
// 4. Wochenansicht: Button „Heute erfassen“
(() => {
  'use strict';

  const COLORS = {
    work: 'rgba(46, 180, 100, 0.16)',
    pause: 'rgba(232, 80, 91, 0.16)',
    gap: 'rgba(255, 170, 0, 0.30)',
    line: 'rgba(20, 110, 60, 0.85)',
  };
  const store = {
    get(k, d) { try { const v = localStorage.getItem('cbp-' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('cbp-' + k, JSON.stringify(v)); } catch (e) {} },
  };

  // ---------- Zeit-Helfer ----------
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (m) => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  const fmtDur = (m) => Math.floor(m / 60) + ':' + pad(m % 60) + ' h';

  function parseDate(s) {
    s = (s || '').trim();
    let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    return null;
  }
  function parseTime(s) {
    const m = (s || '').trim().match(/^(\d{1,2}):(\d{2})/);
    return m ? +m[1] * 60 + +m[2] : null;
  }
  // Minuten relativ zum Tagesbeginn des Rasters
  function toMinutes(dateInp, timeInp, dayStart) {
    const t = parseTime(timeInp && timeInp.value);
    if (t === null) return null;
    const d = parseDate(dateInp && dateInp.value);
    const dayOff = d ? Math.round((d - dayStart) / 86400000) : 0;
    return Math.max(0, Math.min(1440, dayOff * 1440 + t));
  }

  // Intervalle [{from,to}] vereinigen
  function union(list) {
    const s = list.filter((i) => i.to > i.from).sort((a, b) => a.from - b.from);
    const out = [];
    for (const i of s) {
      const last = out[out.length - 1];
      if (last && i.from <= last.to) last.to = Math.max(last.to, i.to);
      else out.push({ from: i.from, to: i.to });
    }
    return out;
  }
  function subtract(base, cut) {
    let res = base.map((b) => ({ ...b }));
    for (const c of cut) {
      res = res.flatMap((b) => {
        if (c.to <= b.from || c.from >= b.to) return [b];
        const parts = [];
        if (c.from > b.from) parts.push({ from: b.from, to: c.from });
        if (c.to < b.to) parts.push({ from: c.to, to: b.to });
        return parts;
      });
    }
    return res.filter((i) => i.to - i.from > 0);
  }

  // ---------- Raster auslesen ----------
  function readGrid(table) {
    const dayStart = new Date(parseInt(table.dataset.zeitraumvon, 10) * 1000);
    dayStart.setHours(0, 0, 0, 0);
    const bars = [];
    table.querySelectorAll('td.stunden[data-zugehoerigkeit] a.termin').forEach((a) => {
      if (a.offsetParent === null && a.style.display === 'none') return;
      const bubble = a.dataset.bubble ? document.getElementById(a.dataset.bubble) : null;
      if (!bubble) return; // Hover-Vorschau o. Ä.
      const del = bubble.querySelector('input.delete');
      if (del && del.value === '1') return;
      let from = toMinutes(bubble.querySelector('input.datum.von'), bubble.querySelector('input.zeit.von'), dayStart);
      let to = toMinutes(bubble.querySelector('input.datum.bis'), bubble.querySelector('input.zeit.bis'), dayStart);
      if (from === null) from = parseInt(a.dataset.left, 10);
      if (to === null) to = parseInt(a.dataset.right, 10);
      if (isNaN(from) || isNaN(to)) return;
      const td = a.closest('td.stunden');
      const sel = bubble.querySelector('select.kategorie');
      const cat = sel && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent.trim() : '';
      const row = a.closest('tr');
      const label = row && row.children[0] ? row.children[0].textContent.trim().replace(/\s+/g, ' ') : '';
      bars.push({
        a, bubble, from, to, cat, label,
        fz: td.dataset.zugehoerigkeit === 'FZ',
        pause: /pause/i.test(cat) || /^pause$/i.test(a.textContent.trim()),
      });
    });
    // heute noch offene Anwesenheit (ohne „Geht“) nur bis jetzt rechnen
    const now = new Date();
    if (now - dayStart >= 0 && now - dayStart < 86400000) {
      const nowM = now.getHours() * 60 + now.getMinutes();
      bars.forEach((b) => { if (b.fz && b.to >= 1439 && b.from < nowM) { b.to = nowM; b.open = true; } });
    }
    const fz = bars.filter((b) => b.fz);
    const work = union(fz.filter((b) => !b.pause));
    const pauses = union(fz.filter((b) => b.pause));
    const jobs = bars.filter((b) => !b.fz);
    const gaps = subtract(subtract(work, pauses), union(jobs));
    return { dayStart, bars, fz, work, pauses, jobs, gaps };
  }

  // ---------- 1. Hintergrund + Zusammenfassung ----------
  const pct = (m) => (m / 1440 * 100).toFixed(3) + '%';
  function gradient(segs) {
    // segs: [{from,to,color}] ohne Überlappung, sortiert
    const stops = [];
    let cur = 0;
    for (const s of segs) {
      if (s.from > cur) stops.push(`transparent ${pct(cur)}`, `transparent ${pct(s.from)}`);
      stops.push(`${s.color} ${pct(s.from)}`, `${s.color} ${pct(s.to)}`);
      cur = s.to;
    }
    if (cur < 1440) stops.push(`transparent ${pct(cur)}`, 'transparent 100%');
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }
  function linesGradient(points) {
    const stops = [];
    for (const m of [...new Set(points)].sort((a, b) => a - b)) {
      const a = Math.max(0, m - 0.6), b = Math.min(1440, m + 0.6);
      stops.push(`transparent ${pct(a)}`, `${COLORS.line} ${pct(a)}`, `${COLORS.line} ${pct(b)}`, `transparent ${pct(b)}`);
    }
    return stops.length ? `linear-gradient(to right, ${stops.join(', ')})` : '';
  }

  function paintGrid(table, g) {
    const on = store.get('overlay', true);
    const pauseOnly = subtract(g.pauses, []);
    const segs = [];
    // Arbeit ohne Pausen, darin Lücken hervorgehoben
    for (const w of subtract(g.work, g.pauses)) {
      const inner = g.gaps.filter((x) => x.from >= w.from && x.to <= w.to);
      let cur = w.from;
      for (const x of inner) {
        if (x.from > cur) segs.push({ from: cur, to: x.from, color: COLORS.work });
        segs.push({ from: x.from, to: x.to, color: COLORS.gap });
        cur = x.to;
      }
      if (cur < w.to) segs.push({ from: cur, to: w.to, color: COLORS.work });
    }
    pauseOnly.forEach((p) => segs.push({ from: p.from, to: p.to, color: COLORS.pause }));
    segs.sort((a, b) => a.from - b.from);
    const points = [];
    g.work.forEach((w) => points.push(w.from, w.to));
    g.pauses.forEach((p) => points.push(p.from, p.to));
    const bg = [linesGradient(points), gradient(segs)].filter(Boolean).join(', ');

    table.querySelectorAll('td.stunden[data-zugehoerigkeit]').forEach((td) => {
      if (td.dataset.zugehoerigkeit === 'FZ') return;
      const want = on ? bg : '';
      if (td.dataset.cbpBg !== want) {
        td.style.backgroundImage = want;
        td.dataset.cbpBg = want;
      }
    });
  }

  function renderSummary(table, g) {
    const host = table.closest('.workinghours__content');
    if (!host) return;
    let box = host.querySelector(':scope > .cbp-summary');
    if (!box) {
      box = document.createElement('div');
      box.className = 'cbp-summary';
      host.insertBefore(box, host.firstChild);
      box.addEventListener('click', (e) => {
        if (e.target.classList.contains('cbp-toggle')) {
          store.set('overlay', !store.get('overlay', true));
          schedule();
        }
      });
    }
    const len = (l) => l.reduce((s, i) => s + i.to - i.from, 0);
    const net = subtract(g.work, g.pauses);
    const booked = len(subtract(net, g.gaps));
    let html;
    if (!g.work.length) {
      html = '<span>Keine Anwesenheit erfasst.</span>';
    } else {
      const range = fmt(g.work[0].from) + '–' + fmt(g.work[g.work.length - 1].to);
      const gapHtml = g.gaps.length
        ? 'offen: ' + g.gaps.map((x) => `<span class="cbp-gap">${fmt(x.from)}–${fmt(x.to)}</span>`).join(' ')
        : '<span class="cbp-ok">alles verbucht ✓</span>';
      html = `<span>Anwesenheit <b>${range}</b></span>` +
        `<span>Pause <b>${fmtDur(len(g.pauses))}</b></span>` +
        `<span>verbucht <b>${fmtDur(booked)}</b> / ${fmtDur(len(net))}</span>` +
        `<span>${gapHtml}</span>`;
    }
    const z = store.get('zoom', { mode: 'range', from: 6, to: 18 });
    const zb = (mode, label, extra = '') => `<button type="button" class="cbp-zbtn${z.mode === mode && (!extra || extra === `${z.from}-${z.to}`) ? ' cbp-on' : ''}" data-zoom="${mode}" data-range="${extra}">${label}</button>`;
    html += `<span class="cbp-zoom">` +
      zb('full', '0–24') + zb('range', '6–18', '6-18') + zb('auto', 'Anwesenheit') +
      `<button type="button" class="cbp-zbtn" data-zoom="out" title="mehr Stunden zeigen">−</button>` +
      `<button type="button" class="cbp-zbtn" data-zoom="in" title="weniger Stunden, größer">+</button>` +
      `</span>`;
    html += `<span class="cbp-toggle">${store.get('overlay', true) ? 'Overlay aus' : 'Overlay an'}</span>`;
    if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
    if (!box.dataset.zoomBound) {
      box.dataset.zoomBound = '1';
      box.addEventListener('click', (e) => {
        const b = e.target.closest('.cbp-zbtn');
        if (!b) return;
        e.preventDefault();
        const cur = currentRange(table);
        const k = b.dataset.zoom;
        let next;
        if (k === 'full') next = { mode: 'full' };
        else if (k === 'auto') next = { mode: 'auto' };
        else if (k === 'range') { const [f, t] = b.dataset.range.split('-').map(Number); next = { mode: 'range', from: f, to: t }; }
        else {
          // + = reinzoomen (weniger Stunden, breiter), − = rauszoomen
          const span = cur.to - cur.from + (k === 'in' ? -2 : 2);
          const s = Math.max(4, Math.min(24, span));
          const mid = (cur.from + cur.to) / 2;
          let f = Math.round(mid - s / 2);
          f = Math.max(0, Math.min(24 - s, f));
          next = { mode: 'range', from: f, to: f + s };
        }
        store.set('zoom', next);
        table.dataset.cbpZoomKey = '';
        schedule();
      });
    }
  }

  // ---------- 1b. Zoom / Fokus-Zeitraum ----------
  function currentRange(table) {
    const z = store.get('zoom', { mode: 'range', from: 6, to: 18 });
    if (z.mode === 'full') return { from: 0, to: 24 };
    if (z.mode === 'auto') {
      const g = table.__cbpGrid;
      if (!g || !g.work.length) return { from: 6, to: 18 };
      const start = g.work[0].from;
      let end = g.work[g.work.length - 1].to;
      if (end >= 1439) { const n = new Date(); end = n.getHours() * 60 + n.getMinutes(); }
      let f = Math.max(0, Math.floor(start / 60) - 1);
      let t = Math.min(24, Math.ceil(end / 60) + 1);
      if (t - f < 6) { t = Math.min(24, f + 6); f = Math.max(0, t - 6); }
      return { from: f, to: t };
    }
    return { from: z.from, to: z.to };
  }

  function applyZoom(table) {
    const scroller = table.parentElement; // div.hours (overflow: auto)
    if (!scroller) return;
    const rows = [...table.rows];
    const first = rows.find((r) => r.cells.length >= 2);
    if (!first) return;
    if (!table.dataset.cbpLabelW) table.dataset.cbpLabelW = String(first.cells[0].offsetWidth || 220);
    const labelW = +table.dataset.cbpLabelW;
    const range = currentRange(table);
    const span = range.to - range.from;
    const avail = scroller.clientWidth - labelW - 2;
    const hoursW = Math.round(avail * 24 / span);
    const key = `${range.from}-${range.to}-${scroller.clientWidth}`;

    // linke Spalte fixieren (auch für neu hinzugekommene Zeilen)
    rows.forEach((tr) => {
      const c = tr.cells[0];
      if (!c || c.dataset.cbpSticky || tr.cells.length < 2) return;
      c.dataset.cbpSticky = '1';
      c.classList.add('cbp-sticky');
      const bgOf = (el) => { const v = el && getComputedStyle(el).backgroundColor; return v && v !== 'rgba(0, 0, 0, 0)' && v !== 'transparent' ? v : null; };
      c.style.backgroundColor = bgOf(c) || bgOf(tr) || '#fff';
      c.style.width = c.style.minWidth = c.style.maxWidth = labelW + 'px';
    });

    if (table.dataset.cbpZoomKey === key) return;
    const firstTime = !table.dataset.cbpZoomKey && !table.dataset.cbpZoomed;
    table.dataset.cbpZoomKey = key;
    table.dataset.cbpZoomed = '1';
    const w = span >= 24 ? '' : (labelW + hoursW) + 'px';
    table.style.width = w;
    table.style.minWidth = w;
    // auf den Fokus-Beginn scrollen; mehrfach, weil CrewBrain beim Öffnen noch nachlädt.
    // Sobald du selbst scrollst, bleibt deine Position.
    const target = span >= 24 ? 0 : Math.round(range.from * hoursW / 24);
    const token = String(Date.now());
    scroller.dataset.cbpScrollToken = token;
    const apply = () => { if (scroller.dataset.cbpScrollToken === token) scroller.scrollLeft = target; };
    requestAnimationFrame(apply);
    [150, 500, 1200].forEach((ms) => setTimeout(apply, ms));
    if (firstTime) {
      scroller.classList.add('cbp-scroller');
      const mine = () => { scroller.dataset.cbpScrollToken = 'user'; };
      scroller.addEventListener('wheel', mine, { passive: true });
      scroller.addEventListener('pointerdown', mine);
    }
  }

  // ---------- 2. Bündig setzen im Bearbeiten-Dialog ----------
  function setTime(inp, m) {
    inp.value = fmt(m);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function boundaries(g, self) {
    const pts = [];
    const add = (m, txt) => { if (m > 0 && m < 1440) pts.push({ m, txt }); };
    // Reihenfolge = Priorität der Beschriftung bei gleichem Zeitpunkt
    g.pauses.forEach((p) => { add(p.from, 'Pause'); add(p.to, 'Pause-Ende'); });
    g.work.forEach((w, i) => {
      add(w.from, i === 0 ? 'Anw.-Beginn' : 'Anw.');
      add(w.to, i === g.work.length - 1 ? 'Anw.-Ende' : 'Anw.');
    });
    g.jobs.filter((j) => j !== self).forEach((j) => {
      const short = j.label.split('/').slice(-1)[0].trim() || j.label;
      add(j.from, 'Start ' + short);
      add(j.to, 'Ende ' + short);
    });
    // gleiche Zeitpunkte zusammenfassen
    const byM = new Map();
    pts.forEach((p) => { if (!byM.has(p.m)) byM.set(p.m, p); });
    return [...byM.values()].sort((a, b) => a.m - b.m);
  }

  function fillRange(g, self) {
    const center = (self.from + self.to) / 2;
    const free = subtract(subtract(g.work, g.pauses), union(g.jobs.filter((j) => j !== self)));
    if (!free.length) return null;
    let best = free.find((f) => center >= f.from && center <= f.to);
    if (!best) best = free.slice().sort((a, b) =>
      Math.min(Math.abs(a.from - center), Math.abs(a.to - center)) - Math.min(Math.abs(b.from - center), Math.abs(b.to - center)))[0];
    return best;
  }

  function renderSnap(bubble, table, g) {
    const self = g.bars.find((b) => b.bubble === bubble);
    const vonInp = bubble.querySelector('input.zeit.von');
    const bisInp = bubble.querySelector('input.zeit.bis');
    if (!vonInp || !bisInp || !g.work.length) return;
    let box = bubble.querySelector('.cbp-snap');
    if (!box) {
      box = document.createElement('div');
      box.className = 'cbp-snap';
      const anchor = bisInp.parentElement;
      anchor.parentElement.insertBefore(box, anchor.nextSibling);
      box.addEventListener('click', (e) => {
        const chip = e.target.closest('.cbp-chip');
        if (!chip) return;
        e.preventDefault();
        e.stopPropagation();
        const oldVon = parseTime(vonInp.value), oldBis = parseTime(bisInp.value);
        if (chip.dataset.von) {
          setTime(vonInp, +chip.dataset.von);
          // falls CrewBrain die Dauer mitzieht: Ende zurücksetzen
          if (!chip.dataset.bis && oldBis !== null && parseTime(bisInp.value) !== oldBis) setTime(bisInp, oldBis);
        }
        if (chip.dataset.bis) {
          setTime(bisInp, +chip.dataset.bis);
          if (!chip.dataset.von && oldVon !== null && parseTime(vonInp.value) !== oldVon) setTime(vonInp, oldVon);
        }
        schedule();
      });
    }
    const curFrom = self ? self.from : parseTime(vonInp.value);
    const curTo = self ? self.to : parseTime(bisInp.value);
    const pts = boundaries(g, self);
    const near = (cur, list) => list.slice().sort((a, b) => Math.abs(a.m - cur) - Math.abs(b.m - cur)).slice(0, 5).sort((a, b) => a.m - b.m);
    const startPts = near(curFrom, pts.filter((p) => curTo === null || p.m < curTo));
    const endPts = near(curTo, pts.filter((p) => curFrom === null || p.m > curFrom));
    const chip = (attr, p) => `<button type="button" class="cbp-chip" data-${attr}="${p.m}">${fmt(p.m)}<small>${p.txt}</small></button>`;
    let html = '';
    const fill = self && !self.fz ? fillRange(g, self) : null;
    if (fill && (fill.from !== curFrom || fill.to !== curTo)) {
      html += `<div class="cbp-snap-row"><span class="cbp-snap-label"></span><button type="button" class="cbp-chip cbp-fill" data-von="${fill.from}" data-bis="${fill.to}">Lücke füllen<small>${fmt(fill.from)}–${fmt(fill.to)}</small></button></div>`;
    }
    html += `<div class="cbp-snap-row"><span class="cbp-snap-label">Start</span>${startPts.map((p) => chip('von', p)).join('')}</div>`;
    html += `<div class="cbp-snap-row"><span class="cbp-snap-label">Ende</span>${endPts.map((p) => chip('bis', p)).join('')}</div>`;
    if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
  }

  // ---------- 3. Aufgaben-Suche ----------
  const norm = (s) => (s || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();

  function enhancePicker(content) {
    const form = content.querySelector('form[data-package="FremdIDAuswahl"]');
    const mode = (form && form.dataset.mode) || 'x';
    let box = content.querySelector(':scope > .cbp-search');
    if (!box) {
      box = document.createElement('div');
      box.className = 'cbp-search';
      box.innerHTML = '<input type="text" placeholder="Suchen: Event, Bereich, Aufgabe … (z. B. „arena meet“)" autocomplete="off">' +
        '<div class="cbp-recent"></div><div class="cbp-hint">↑↓ auswählen · Enter übernehmen · Esc leeren</div>';
      content.insertBefore(box, content.firstChild);
      const native = content.querySelector('#fremdidauswahl-suchbegriff');
      if (native) {
        const wrap = native.closest('.text-field--inputclear') || native;
        wrap.classList.add('cbp-hidden');
      }
      const inp = box.querySelector('input');
      inp.addEventListener('input', () => { box.dataset.active = '0'; filterPicker(content, mode); });
      inp.addEventListener('keydown', (e) => {
        const vis = visibleItems(content);
        let i = +(box.dataset.active || 0);
        if (e.key === 'ArrowDown') { i = Math.min(vis.length - 1, i + 1); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { i = Math.max(0, i - 1); e.preventDefault(); }
        else if (e.key === 'Enter') {
          e.preventDefault(); e.stopPropagation();
          if (vis[i]) pick(vis[i].querySelector('a.close'), mode);
          return;
        } else if (e.key === 'Escape' && inp.value) { inp.value = ''; e.stopPropagation(); e.preventDefault(); }
        else return;
        box.dataset.active = String(i);
        markActive(content);
      });
      box.querySelector('.cbp-recent').addEventListener('click', (e) => {
        const c = e.target.closest('.cbp-chip');
        if (!c) return;
        e.preventDefault();
        const a = [...content.querySelectorAll('ul.listview a.close')].find((x) => x.dataset.text === c.dataset.text);
        if (a) pick(a, mode);
      });
      // Klicks direkt in der Liste auch merken
      content.addEventListener('click', (e) => {
        const a = e.target.closest('ul.listview a.close');
        if (a) remember(a.dataset.text, mode);
      }, true);
      setTimeout(() => inp.focus(), 60);
    }
    filterPicker(content, mode);
  }

  function remember(text, mode) {
    if (!text) return;
    const key = 'recent-' + mode;
    const list = store.get(key, []).filter((t) => t !== text);
    list.unshift(text);
    store.set(key, list.slice(0, 8));
  }
  function pick(a, mode) {
    if (!a) return;
    remember(a.dataset.text, mode);
    a.click();
  }
  function visibleItems(content) {
    return [...content.querySelectorAll('ul.listview > li:not(.headline)')].filter((li) => !li.classList.contains('cbp-hidden'));
  }
  function markActive(content) {
    const box = content.querySelector('.cbp-search');
    const i = +(box.dataset.active || 0);
    const vis = visibleItems(content);
    const target = vis[i] || null;
    content.querySelectorAll('li.cbp-active').forEach((li) => { if (li !== target) li.classList.remove('cbp-active'); });
    if (target && !target.classList.contains('cbp-active')) {
      target.classList.add('cbp-active');
      target.scrollIntoView({ block: 'nearest' });
    }
  }
  function filterPicker(content, mode) {
    const box = content.querySelector('.cbp-search');
    const q = norm(box.querySelector('input').value);
    const tokens = q ? q.split(' ') : [];
    const ul = content.querySelector('ul.listview');
    if (!ul) return;
    const recent = store.get('recent-' + mode, []);
    let lastHead = null, headHasVisible = false;
    const flush = () => { if (lastHead) lastHead.classList.toggle('cbp-hidden', !headHasVisible); };
    const matches = [];
    [...ul.children].forEach((li) => {
      if (li.classList.contains('headline')) { flush(); lastHead = li; headHasVisible = false; return; }
      const a = li.querySelector('a.close');
      const text = a ? (a.dataset.text || a.textContent) : li.textContent;
      const n = norm(text), compact = n.replace(/ /g, '');
      const ok = tokens.every((t) => n.includes(t) || compact.includes(t));
      li.classList.toggle('cbp-hidden', !ok);
      if (ok) { headHasVisible = true; matches.push(text); }
    });
    flush();
    // „Zuletzt“-Chips (gefiltert)
    const rec = recent.filter((t) => matches.includes(t)).slice(0, 6);
    const recHtml = rec.map((t) => `<button type="button" class="cbp-chip" data-text="${t.replace(/"/g, '&quot;')}">${t.replace(/</g, '&lt;')}</button>`).join('');
    const rb = box.querySelector('.cbp-recent');
    if (rb.dataset.html !== recHtml) { rb.innerHTML = recHtml; rb.dataset.html = recHtml; }
    // bevorzugt zuletzt genutzte Aufgabe vorauswählen
    if (box.dataset.active === '0' && rec.length && tokens.length) {
      const vis = visibleItems(content);
      const idx = vis.findIndex((li) => { const a = li.querySelector('a.close'); return a && a.dataset.text === rec[0]; });
      if (idx > 0) box.dataset.active = String(idx);
    }
    markActive(content);
  }

  // ---------- 4. „Heute erfassen“ ----------
  function todayLink() {
    const d = new Date();
    const dd = pad(d.getDate());
    const wd = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()];
    return [...document.querySelectorAll('tr')].map((tr) => {
      const c = tr.children;
      if (c.length < 2 || c[0].textContent.trim() !== dd) return null;
      return [...c[1].querySelectorAll('a')].find((a) => a.textContent.trim() === wd) || null;
    }).find(Boolean);
  }
  function simulateCheckbox() {
    const lab = [...document.querySelectorAll('label')].find((l) => /Zukünftige Tage simulieren/.test(l.textContent));
    if (!lab) return null;
    return lab.querySelector('input[type=checkbox]') || document.getElementById(lab.htmlFor);
  }
  function openToday() {
    const link = todayLink();
    const cb = simulateCheckbox();
    if (cb && !cb.checked) {
      try { sessionStorage.setItem('cbp-open-today', String(Date.now())); } catch (e) {}
      cb.click();
      return;
    }
    if (link) link.click();
    else alert('CrewBrain Plus: Der heutige Tag ist in dieser Ansicht nicht zu finden. Bitte Wochenansicht mit deinem Namen öffnen.');
  }
  function ensureTodayButton() {
    if (!/\/zeiterfassung/.test(location.pathname)) return;
    if (document.querySelector('.cbp-today')) return;
    const heute = [...document.querySelectorAll('a, button')].find((b) => b.textContent.trim() === 'Heute' && b.getBoundingClientRect().top < 60);
    if (!heute) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cbp-today';
    btn.textContent = 'Heute erfassen';
    btn.addEventListener('click', openToday);
    const host = heute.closest('div') || heute.parentElement;
    host.parentElement.insertBefore(btn, host);
  }
  function pendingToday() {
    let t = 0;
    try { t = +sessionStorage.getItem('cbp-open-today') || 0; } catch (e) {}
    if (!t) return;
    if (Date.now() - t > 15000) { try { sessionStorage.removeItem('cbp-open-today'); } catch (e) {} return; }
    const cb = simulateCheckbox();
    const link = todayLink();
    if (cb && cb.checked && link) {
      try { sessionStorage.removeItem('cbp-open-today'); } catch (e) {}
      link.click();
    }
  }

  // ---------- Hauptschleife ----------
  let timer = null;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(run, 120);
  }
  function run() {
    try {
      document.querySelectorAll('table[data-zeitraumvon]').forEach((table) => {
        if (!table.closest('.workinghours__content')) return;
        const g = readGrid(table);
        table.__cbpGrid = g;
        applyZoom(table);
        paintGrid(table, g);
        renderSummary(table, g);
        document.querySelectorAll('.bubble.workinghours__dialog.opened').forEach((b) => {
          if (table.closest('form') && table.closest('form').contains(b)) renderSnap(b, table, g);
        });
      });
      document.querySelectorAll('#fremdidauswahl-content').forEach(enhancePicker);
      ensureTodayButton();
      pendingToday();
    } catch (e) {
      console.warn('[CrewBrain Plus]', e);
    }
  }

  const obs = new MutationObserver((muts) => {
    // eigene Änderungen ignorieren
    if (muts.every((m) => m.target.closest && m.target.closest('.cbp-summary, .cbp-snap, .cbp-search, .cbp-today'))) return;
    schedule();
  });
  obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
  document.addEventListener('change', schedule, true);
  window.addEventListener('resize', schedule);
  run();
})();
