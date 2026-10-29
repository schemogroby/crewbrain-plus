// Zeiterfassung Plus – Ergänzungen für die Zeiterfassung (nur Oberfläche, speichert nichts selbst).
// 1. Raster: Anwesenheit/Pausen/Lücken als Hintergrund in allen Aufgaben-Zeilen + Zusammenfassung
// 2. Bearbeiten-Dialog: Start/Ende per Klick bündig setzen, „Lücke füllen“
// 3. Aufgaben-Dialog: Suche über Event + Aufgabe, Wortteile in beliebiger Reihenfolge, Tastatur, zuletzt genutzt
// 4. Wochenansicht: Button „Heute erfassen“
(() => {
  'use strict';

  const PALETTE = {
    light: {
      work: 'rgba(46, 180, 100, 0.16)',
      pause: 'rgba(232, 80, 91, 0.16)',
      gap: 'rgba(255, 170, 0, 0.30)',
      line: 'rgba(20, 110, 60, 0.85)',
    },
    dark: {
      work: 'rgba(70, 200, 120, 0.14)',
      pause: 'rgba(240, 90, 100, 0.16)',
      gap: 'rgba(255, 170, 0, 0.18)',
      line: 'rgba(110, 220, 150, 0.85)',
    },
  };
  // CrewBrain setzt data-theme am #main und tauscht die CSS-Datei (….light.css / ….dark.css)
  function isDark() {
    const m = document.getElementById('main');
    if (m && m.dataset.theme) return m.dataset.theme === 'dark';
    return !!document.querySelector('link[href*=".dark.css"]');
  }
  const colors = () => PALETTE[isDark() ? 'dark' : 'light'];
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
    const C = colors();
    const stops = [];
    for (const m of [...new Set(points)].sort((a, b) => a - b)) {
      const a = Math.max(0, m - 0.6), b = Math.min(1440, m + 0.6);
      stops.push(`transparent ${pct(a)}`, `${C.line} ${pct(a)}`, `${C.line} ${pct(b)}`, `transparent ${pct(b)}`);
    }
    return stops.length ? `linear-gradient(to right, ${stops.join(', ')})` : '';
  }

  function paintGrid(table, g) {
    const on = store.get('overlay', true);
    const COLORS = colors();
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
    const z = getZoom();
    const zb = (mode, label, extra = '') => `<button type="button" class="cbp-zbtn${z.mode === mode && (!extra || extra === `${z.from}-${z.to}`) ? ' cbp-on' : ''}" data-zoom="${mode}" data-range="${extra}">${label}</button>`;
    html += `<span class="cbp-zoom">` +
      zb('full', '0–24') + zb('range', '6–20', '6-20') + zb('auto', 'Anwesenheit') +
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
  // Standard 6–20; ein gespeichertes 6–18 (alter Standard-Knopf) wird mitgezogen
  function getZoom() {
    const z = store.get('zoom', { mode: 'range', from: 6, to: 20 });
    return z.mode === 'range' && z.from === 6 && z.to === 18 ? { mode: 'range', from: 6, to: 20 } : z;
  }
  function currentRange(table) {
    const z = getZoom();
    if (z.mode === 'full') return { from: 0, to: 24 };
    if (z.mode === 'auto') {
      const g = table.__cbpGrid;
      if (!g || !g.work.length) return { from: 6, to: 20 };
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

  // erste deckende Hintergrundfarbe von el aufwärts (die fixierte Spalte braucht eine, sonst scheint das Raster durch)
  function opaqueBg(el) {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const v = getComputedStyle(e).backgroundColor;
      if (v && v !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(v)) return v;
    }
    return isDark() ? '#1b2430' : '#fff';
  }

  // Übersicht (td.stunden.uebersicht) scrollt mit, statt oben kleben zu bleiben.
  // Innere Balken bleiben positioniert; die seitlich fixierte Namensspalte auch.
  function releaseOverview(root) {
    if (!root) return;
    root.querySelectorAll('td.stunden.uebersicht').forEach((td) => {
      const nodes = [td, ...td.querySelectorAll('*')];
      for (let el = td.parentElement; el && el !== root && el !== document.documentElement; el = el.parentElement) {
        nodes.push(el);
      }
      nodes.forEach((el) => {
        if (el.classList.contains('cbp-sticky')) return;
        const pos = getComputedStyle(el).position;
        if (pos !== 'sticky' && pos !== 'fixed') return;
        const inCell = el === td || td.contains(el);
        el.style.setProperty('position', inCell ? 'relative' : 'static', 'important');
        el.style.setProperty('top', 'auto', 'important');
        el.style.setProperty('bottom', 'auto', 'important');
      });
    });
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

    // linke Spalte fixieren (auch für neu hinzugekommene Zeilen, neu bei Theme-Wechsel)
    const theme = isDark() ? 'dark' : 'light';
    rows.forEach((tr) => {
      const c = tr.cells[0];
      if (!c || tr.cells.length < 2) return;
      if (c.dataset.cbpSticky === theme) return;
      c.dataset.cbpSticky = theme;
      c.classList.add('cbp-sticky');
      c.style.backgroundColor = '';
      c.style.backgroundColor = opaqueBg(c);
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
      let keep = null;
      const mine = () => { scroller.dataset.cbpScrollToken = 'user'; keep = scroller.scrollLeft; };
      scroller.addEventListener('wheel', mine, { passive: true });
      scroller.addEventListener('pointerdown', mine, true);
      // Fokus auf ein Feld in der fixierten Spalte lässt Chrome nach links scrollen – Position halten
      scroller.addEventListener('focusin', (e) => {
        if (keep === null || !e.target.closest('.cbp-sticky')) return;
        const s = keep;
        requestAnimationFrame(() => { scroller.scrollLeft = s; });
        setTimeout(() => { scroller.scrollLeft = s; }, 80);
      });
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
    const add = (m, txt, dir) => { if (m > 0 && m < 1440) pts.push({ m, txt, dir }); };
    // Reihenfolge = Priorität der Beschriftung bei gleichem Zeitpunkt
    g.pauses.forEach((p) => { add(p.from, 'Pause', 'close'); add(p.to, 'Pause-Ende', 'open'); });
    g.work.forEach((w, i) => {
      add(w.from, i === 0 ? 'Anw.-Beginn' : 'Anw.', 'open');
      add(w.to, i === g.work.length - 1 ? 'Anw.-Ende' : 'Anw.', 'close');
    });
    g.jobs.filter((j) => j !== self).forEach((j) => {
      const short = j.label.split('/').slice(-1)[0].trim() || j.label;
      add(j.from, 'Start ' + short, 'close');
      add(j.to, 'Ende ' + short, 'open');
    });
    // gleiche Zeitpunkte zusammenfassen; je Richtung die passende Beschriftung merken
    const byM = new Map();
    pts.forEach((p) => {
      const q = byM.get(p.m) || { m: p.m, txt: p.txt };
      if (!q[p.dir]) q[p.dir] = p.txt;
      byM.set(p.m, q);
    });
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
    // bei Unabhängigen Zeiten die eigene Anwesenheit/Pause nicht als Bezugspunkt nehmen
    const others = self && self.fz ? g.fz.filter((b) => b !== self) : null;
    const pts = boundaries(others ? { ...g,
      work: union(others.filter((b) => !b.pause)),
      pauses: union(others.filter((b) => b.pause)) } : g, self);
    const startList = pts.filter((p) => curTo === null || p.m < curTo);
    const endList = pts.filter((p) => curFrom === null || p.m > curFrom);
    // wahrscheinlichster Start: letzter Punkt vor dem Ende, ab dem wieder frei ist (Ende des vorigen Jobs, Pausen-Ende, Anwesenheitsbeginn)
    // wahrscheinlichstes Ende: erster Punkt nach dem Start, ab dem belegt ist (Start des nächsten Jobs, Pause, Anwesenheitsende)
    // eine Pause liegt zwischen den Blöcken: Start am vorigen, Ende am nächsten Punkt egal welcher Richtung (z. B. nächster Anwesenheits-Block)
    const isPause = self && self.pause;
    const bestStart = startList.filter((p) => isPause || p.open).pop() || null;
    const bestEnd = endList.find((p) => isPause || p.close) || null;
    const label = (attr, p) => isPause
      ? (attr === 'von' ? p.close || p.open : p.open || p.close)
      : (attr === 'von' ? p.open : p.close);
    const best = (attr, p) => p
      ? `<button type="button" class="cbp-chip cbp-best" data-${attr}="${p.m}">${fmt(p.m)}<small>${label(attr, p)}</small></button>`
      : '';
    // ±15 rastet auf die nächste Viertelstunde ein (13:07 → 13:15 bzw. 13:00)
    const step = (attr, cur, d) => {
      if (cur === null) return '';
      const m = d > 0 ? Math.floor(cur / 15) * 15 + 15 : Math.ceil(cur / 15) * 15 - 15;
      const ok = m >= 0 && m <= 1440 && (attr === 'von' ? (curTo === null || m < curTo) : (curFrom === null || m > curFrom));
      return `<button type="button" class="cbp-chip cbp-step" data-${attr}="${m}"${ok ? '' : ' disabled'}>${d > 0 ? '+15' : '−15'}</button>`;
    };
    let html = '<div class="cbp-cols cbp-steprow">' +
      `<div class="cbp-col">${step('von', curFrom, -1)}${step('von', curFrom, 1)}</div>` +
      `<div class="cbp-col">${step('bis', curTo, -1)}${step('bis', curTo, 1)}</div>` +
      '</div>';
    if (bestStart || bestEnd) {
      html += '<div class="cbp-cols cbp-bestrow">' +
        `<div class="cbp-col">${best('von', bestStart)}</div>` +
        `<div class="cbp-col">${best('bis', bestEnd)}</div>` +
        '</div>';
    }
    const fill = self && !self.fz ? fillRange(g, self) : null;
    if (fill && (fill.from !== curFrom || fill.to !== curTo)) {
      html += `<div class="cbp-fillrow"><button type="button" class="cbp-chip cbp-fill" data-von="${fill.from}" data-bis="${fill.to}">Lücke füllen<small>${fmt(fill.from)}–${fmt(fill.to)}</small></button></div>`;
    }
    if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
    // ±15 und Vorschläge mittig unter die Datum/Zeit-Felder
    alignCols(box.querySelector('.cbp-steprow'), vonInp.parentElement, bisInp.parentElement);
    alignCols(box.querySelector('.cbp-bestrow'), vonInp.parentElement, bisInp.parentElement);
    fitBubble(bubble);
  }

  // zwei Spalten genau unter zwei Felder legen (Start / Ende)
  function alignCols(cols, vonPick, bisPick) {
    if (!cols) return;
    const c = cols.getBoundingClientRect(), v = vonPick.getBoundingClientRect(), b = bisPick.getBoundingClientRect();
    if (!c.width) return;
    const k = cols.offsetWidth / c.width; // Bildschirm-Pixel → CSS-Pixel (Dialog ist gezoomt)
    const a = (v.left - c.left) * k, w1 = v.width * k, gap = (b.left - v.right) * k, w2 = b.width * k;
    if (a < 0 || gap < 0) return;
    const tpl = [a, w1, gap, w2].map((x) => Math.round(x) + 'px').join(' ');
    if (cols.style.gridTemplateColumns !== tpl) cols.style.gridTemplateColumns = tpl;
  }


  // Dialog etwas größer (siehe CSS); CrewBrain rechnet die Position für 400px Breite,
  // deshalb danach in den sichtbaren Bereich schieben
  function fitBubble(bubble) {
    bubble.classList.add('cbp-big');
    const r = bubble.getBoundingClientRect();
    const over = r.right - (window.innerWidth - 8);
    if (over > 0) {
      bubble.style.left = Math.max(8, r.left - over) + 'px';
      bubble.style.maxWidth = 'calc(100vw - 16px)';
    }
    const down = r.bottom - (window.innerHeight - 8);
    if (down > 0) {
      const top = Math.max(8, r.top - down);
      bubble.style.top = top + 'px';
      bubble.style.maxHeight = `calc(100vh - ${top + 8}px)`;
    }
  }

  // ---------- 2b. Neuer Balken bündig zur Anwesenheit ----------
  // CrewBrain zeigt beim Überfahren eine Vorschau „Neu…“ zur vollen Stunde (div.neu > a)
  // und übernimmt beim Klick deren data-uhrzeitvon/-bis. Ragt die Stunde über Anwesenheit
  // oder Pause hinaus, wird die Vorschau auf die Anwesenheit gekappt.
  function clipGhost(a) {
    const td = a.closest('td.stunden');
    const table = a.closest('table[data-zeitraumvon]');
    if (!td || !table || td.dataset.zugehoerigkeit === 'FZ') return null;
    const g = table.__cbpGrid;
    if (!g || !g.work.length) return null;
    const l = parseInt(a.dataset.left, 10), r = parseInt(a.dataset.right, 10);
    if (isNaN(l) || isNaN(r)) return null;
    const pick = (segs) => {
      let best = null, bestOv = 0;
      segs.forEach((s) => {
        const ov = Math.min(r, s.to) - Math.max(l, s.from);
        if (ov > bestOv) { bestOv = ov; best = s; }
      });
      return best;
    };
    // zuerst die freie Zeit (ohne andere Jobs), sonst nur die Anwesenheit
    const net = subtract(g.work, g.pauses);
    const best = pick(subtract(net, union(g.jobs))) || pick(net);
    if (!best) return null;
    return { from: Math.max(l, best.from), to: Math.min(r, best.to) };
  }
  function applyGhost(a, setData) {
    const c = clipGhost(a);
    if (!c) return;
    const l = parseInt(a.dataset.left, 10), r = parseInt(a.dataset.right, 10);
    if (c.from === l && c.to === r) return;
    a.style.left = `calc(100% / 1440 * ${c.from})`;
    a.style.width = `calc(100% / 1440 * ${c.to - c.from})`;
    a.setAttribute('data-uhrzeitvon', fmt(c.from));
    a.setAttribute('data-uhrzeitbis', fmt(c.to));
    // data-left/-right erst beim Klick setzen: CrewBrain baut die Vorschau sonst bei jeder Mausbewegung neu
    if (setData) { a.setAttribute('data-left', c.from); a.setAttribute('data-right', c.to); }
  }
  document.addEventListener('mousemove', (e) => {
    const td = e.target.closest && e.target.closest('.workinghours__content td.stunden');
    const a = td && td.querySelector('div.neu > a');
    if (a) applyGhost(a, false);
  });
  // Capture-Phase: läuft vor CrewBrains Klick-Handler, der die Zeiten übernimmt
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('.workinghours__content table div.neu > a');
    if (a) applyGhost(a, true);
  }, true);

  // ---------- 2c. „Tätigkeit“ vervollständigen ----------
  // Vorschläge: zuletzt selbst eingetragen (max. 20), dann die Tätigkeiten des offenen Tages,
  // dann die der vorigen Arbeitstage. Chrome filtert die Datalist beim Tippen selbst.
  const TAET_MAX = 20, TAET_DAYS = 5, TAET_TTL = 6 * 3600 * 1000;
  function rememberTaetigkeit(v) {
    v = (v || '').trim();
    if (!v) return;
    const list = store.get('taetigkeiten', []).filter((t) => t.toLowerCase() !== v.toLowerCase());
    list.unshift(v);
    store.set('taetigkeiten', list.slice(0, TAET_MAX));
  }
  // Tätigkeiten der Aufgaben (nicht der Anwesenheit) aus einem Dokument lesen
  function taetigkeitenIn(root) {
    return [...root.querySelectorAll('.bubble.workinghours__dialog input.taetigkeit')]
      .filter((i) => { const z = i.closest('.bubble').querySelector('input.zugehoerigkeit'); return !z || z.value !== 'FZ'; })
      .map((i) => (i.getAttribute('value') || '').trim())
      .filter(Boolean);
  }
  // vorige Arbeitstage still nachladen (nur lesen) und kurz zwischenspeichern
  const taetFetching = new Set();
  function previousDays(dayStart) {
    const days = [];
    const d = startOfDay(dayStart);
    while (days.length < TAET_DAYS) {
      d.setDate(d.getDate() - 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) days.push(new Date(d));
    }
    return days;
  }
  function loadDay(d) {
    const key = 'taet-' + isoDate(d);
    const c = store.get(key, null);
    if (c && Date.now() - c.t < TAET_TTL) return c.vals;
    const url = weekUrl(d);
    if (url && !taetFetching.has(key)) {
      taetFetching.add(key);
      fetch(url + '/arbeitszeiten/' + isoDate(d), { credentials: 'same-origin' })
        .then((r) => (r.ok ? r.text() : null))
        .then((html) => {
          if (html === null) return;
          store.set(key, { t: Date.now(), vals: taetigkeitenIn(new DOMParser().parseFromString(html, 'text/html')) });
          schedule();
        })
        .catch(() => {})
        .finally(() => taetFetching.delete(key));
    }
    return c ? c.vals : [];
  }
  function ensureTaetigkeit() {
    const inputs = [...document.querySelectorAll('.bubble.workinghours__dialog input.taetigkeit')];
    if (!inputs.length) return;
    let dl = document.getElementById('cbp-taetigkeiten');
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = 'cbp-taetigkeiten';
      document.body.appendChild(dl);
    }
    const seen = new Set();
    const vals = [];
    const add = (v) => { v = (v || '').trim(); const k = v.toLowerCase(); if (v && !seen.has(k)) { seen.add(k); vals.push(v); } };
    store.get('taetigkeiten', []).forEach(add);
    taetigkeitenIn(document).forEach(add);
    const table = document.querySelector('.workinghours__content table[data-zeitraumvon]');
    const g = table && table.__cbpGrid;
    if (g) previousDays(g.dayStart).forEach((d) => loadDay(d).forEach(add));
    const html = vals.map((v) => `<option value="${v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"></option>`).join('');
    if (dl.dataset.html !== html) { dl.innerHTML = html; dl.dataset.html = html; }
    inputs.forEach((i) => {
      if (i.getAttribute('list') !== dl.id) i.setAttribute('list', dl.id);
      if (!i.dataset.cbpTaet) {
        i.dataset.cbpTaet = '1';
        i.addEventListener('change', () => rememberTaetigkeit(i.value));
      }
    });
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
      inp.addEventListener('input', () => {
        box.dataset.active = '0';
        filterPicker(content, mode);
        clearTimeout(box.__cbpT);
        box.__cbpT = setTimeout(() => serverSearch(content, mode), 250);
      });
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

  // Die Startliste enthält nicht alle Aufgaben (z. B. „… / Kommunikation & Grafik / KV“).
  // CrewBrains Server-Suche findet sie, vergleicht aber nur ein Wort mit dem Namen
  // einer Ebene. Deshalb pro Wort still mitsuchen und fehlende Treffer anhängen.
  // Ablauf wie beim CrewBrain-Suchfeld: Begriff setzen (setSuchbegriff), dann
  // Treffer abrufen (printSuchergebnisse). Zum Schluss wird der Begriff wieder geleert.
  const searchCache = new Map();
  let searchQueue = Promise.resolve();
  function searchPost(content, mode, term, setTerm) {
    const form = content.querySelector('form[data-package="FremdIDAuswahl"]');
    const native = content.querySelector('input[name="fremdidauswahl-suchbegriff"]');
    if (!form || !native) return Promise.resolve('');
    const fd = new FormData(form);
    const action = fd.get('action');
    ['ajax', 'package', 'mode', 'action'].forEach((k) => fd.delete(k));
    fd.set('fremdidauswahl-suchbegriff', term);
    if (setTerm && action) fd.append('action', action);
    fd.append('ajax', 'printSuchergebnisse');
    fd.append('package', 'FremdIDAuswahl');
    fd.append('mode', form.dataset.mode || mode);
    const tag = native.outerHTML;
    fd.append('element', tag.slice(0, tag.indexOf('>') + 1));
    return fetch(location.href, { method: 'POST', body: fd, credentials: 'same-origin' })
      .then((r) => (r.ok ? r.text() : ''))
      .catch(() => '');
  }
  function fetchAll(content, mode, terms) {
    const todo = terms.filter((t) => !searchCache.has(mode + '|' + t.toLowerCase()));
    const run = async () => {
      if (!todo.length) return;
      for (const t of todo) {
        await searchPost(content, mode, t, true);
        const html = await searchPost(content, mode, '', false);
        if (html) searchCache.set(mode + '|' + t.toLowerCase(), html);
      }
      await searchPost(content, mode, '', true);
    };
    searchQueue = searchQueue.then(run, run);
    return searchQueue.then(() => terms.map((t) => searchCache.get(mode + '|' + t.toLowerCase()) || ''));
  }
  async function serverSearch(content, mode) {
    const box = content.querySelector('.cbp-search');
    const ul = content.querySelector('ul.listview');
    if (!box || !ul) return;
    const terms = [...new Set(box.querySelector('input').value.trim().split(/\s+/).filter((w) => w.length >= 2))].slice(0, 4);
    if (!terms.length) return;
    const seq = (box.__cbpSeq = (box.__cbpSeq || 0) + 1);
    const htmls = await fetchAll(content, mode, terms);
    if (seq !== box.__cbpSeq || !content.isConnected || !ul.isConnected) return;
    const have = new Set([...ul.querySelectorAll('a[data-fremdid]')].map((a) => a.dataset.fremdid));
    const tpl = document.createElement('template');
    const add = [];
    htmls.forEach((h) => {
      tpl.innerHTML = h;
      tpl.content.querySelectorAll('li').forEach((li) => {
        const a = li.querySelector('a[data-fremdid]');
        if (!a || have.has(a.dataset.fremdid)) return;
        have.add(a.dataset.fremdid);
        li.classList.add('cbp-extra');
        add.push(li);
      });
    });
    if (!add.length) return;
    let head = ul.querySelector(':scope > li.cbp-extra-head');
    if (!head) {
      head = document.createElement('li');
      head.className = 'headline cbp-extra-head';
      head.textContent = 'Weitere Treffer';
      ul.appendChild(head);
    }
    add.sort((x, y) => x.textContent.localeCompare(y.textContent, 'de')).forEach((li) => ul.appendChild(li));
    filterPicker(content, mode);
  }

  // ---------- 4. „Heute erfassen“ / „Gestern erfassen“ ----------
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const isoDate = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  // letzter Arbeitstag vor heute (montags also Freitag)
  function lastWorkday() {
    const d = startOfDay(new Date());
    do { d.setDate(d.getDate() - 1); } while (d.getDay() === 0 || d.getDay() === 6);
    return d;
  }
  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y = t.getUTCFullYear();
    return { year: y, week: Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7) };
  }
  // Wochenansicht des Mitarbeiters, z. B. /zeiterfassung/2026/44/2-max-muster
  function weekUrl(d) {
    const slug = location.pathname.split('/').find((p) => /^\d+-[a-z]/i.test(p));
    if (!slug) return null;
    const w = isoWeek(d);
    return `/zeiterfassung/${w.year}/${w.week}/${slug}`;
  }
  function dayLink(d) {
    const dd = pad(d.getDate());
    const wd = WD[d.getDay()];
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
  function setPending(d) {
    try { sessionStorage.setItem('cbp-open-day', JSON.stringify({ date: isoDate(d), t: Date.now() })); } catch (e) {}
  }
  function openDay(d) {
    const isToday = isoDate(d) === isoDate(new Date());
    const cb = simulateCheckbox();
    if (isToday && cb && !cb.checked) { setPending(d); cb.click(); return; }
    const link = dayLink(d);
    if (link) { link.click(); return; }
    const url = weekUrl(d);
    if (url) { setPending(d); location.href = url; return; }
    alert('Zeiterfassung Plus: Der Tag ist in dieser Ansicht nicht zu finden. Bitte die Wochenansicht mit deinem Namen öffnen.');
  }
  function ensureDayButtons() {
    if (!/\/zeiterfassung/.test(location.pathname)) return;
    const y = lastWorkday();
    const yLabel = (new Date().getDay() === 1 ? WD_LONG[y.getDay()] : 'Gestern') + ' erfassen';
    const existing = document.querySelector('.cbp-yesterday');
    if (existing) {
      if (existing.textContent !== yLabel) existing.textContent = yLabel;
      return;
    }
    const heute = [...document.querySelectorAll('a, button')].find((b) => b.textContent.trim() === 'Heute' && b.getBoundingClientRect().top < 60);
    if (!heute) return;
    const host = heute.closest('div') || heute.parentElement;
    const mk = (cls, text, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = cls;
      b.textContent = text;
      b.addEventListener('click', fn);
      host.parentElement.insertBefore(b, host);
      return b;
    };
    mk('cbp-today cbp-secondary cbp-yesterday', yLabel, () => openDay(lastWorkday()));
    mk('cbp-today', 'Heute erfassen', () => openDay(startOfDay(new Date())));
  }
  // „Zukünftige Tage simulieren“ standardmäßig an. Schaltest du es selbst aus, bleibt es in diesem Tab aus.
  function ensureSimulation() {
    if (!/\/zeiterfassung/.test(location.pathname)) return;
    const cb = simulateCheckbox();
    if (!cb) return;
    if (!cb.dataset.cbpWatch) {
      cb.dataset.cbpWatch = '1';
      cb.addEventListener('change', (e) => {
        if (!e.isTrusted) return;
        try { sessionStorage.setItem('cbp-sim-off', cb.checked ? '' : '1'); } catch (err) {}
      });
    }
    if (cb.checked) return;
    let off = '', last = 0;
    try { off = sessionStorage.getItem('cbp-sim-off') || ''; last = +sessionStorage.getItem('cbp-sim-click') || 0; } catch (e) {}
    if (off || Date.now() - last < 20000) return; // Schutz gegen Endlosschleife, falls es nicht hängen bleibt
    try { sessionStorage.setItem('cbp-sim-click', String(Date.now())); } catch (e) {}
    cb.click();
  }
  function pendingDay() {
    let p = null;
    try { p = JSON.parse(sessionStorage.getItem('cbp-open-day') || 'null'); } catch (e) {}
    if (!p) return;
    if (Date.now() - p.t > 20000) { try { sessionStorage.removeItem('cbp-open-day'); } catch (e) {} return; }
    const [y, m, dd] = p.date.split('-').map(Number);
    const d = new Date(y, m - 1, dd);
    const cb = simulateCheckbox();
    if (p.date === isoDate(new Date()) && cb && !cb.checked) return;
    const link = dayLink(d);
    if (link) {
      try { sessionStorage.removeItem('cbp-open-day'); } catch (e) {}
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
      document.documentElement.classList.toggle('cbp-dark', isDark());
      document.querySelectorAll('.workinghours__content').forEach(releaseOverview);
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
      ensureTaetigkeit();
      ensureDayButtons();
      ensureSimulation();
      pendingDay();
    } catch (e) {
      console.warn('[Zeiterfassung Plus]', e);
    }
  }

  const obs = new MutationObserver((muts) => {
    // eigene Änderungen ignorieren
    if (muts.every((m) => m.target.closest && m.target.closest('.cbp-summary, .cbp-snap, .cbp-search, .cbp-today'))) return;
    schedule();
  });
  obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
  obs.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
  document.addEventListener('change', schedule, true);
  window.addEventListener('resize', schedule);
  run();
})();
