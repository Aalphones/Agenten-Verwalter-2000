// Bedienlogik des Entwurfs „Review-Bericht“ — gehört nur zum Entwurf, nicht zur Umsetzung.
(() => {
  const R = window.REPORT;
  const KINDS = window.KINDS;
  const STATES = window.STATES;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const q = new URLSearchParams(location.search);

  const ICON = {
    map: '<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/>',
    eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m10 13-2 2 2 2"/><path d="m14 17 2-2-2-2"/>',
    ext: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    msg: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    max: '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>',
    hist: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    diagram: '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  };
  const svg = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] ?? KINDS[name]?.[1] ?? ''}</svg>`;
  const tag = (t) => `<span class="tooltag">${esc(t)}</span>`;

  const S = {
    variant: q.get('variante') === 'b' ? 'b' : 'a',
    state: STATES[q.get('zustand')] ? q.get('zustand') : 'bereit',
    view: ['chat', 'files', 'artifacts'].includes(q.get('ansicht')) ? q.get('ansicht') : 'review',
    comments: [],
    seq: 0,
    current: null,
    dview: {},
    sview: {},
    scmp: {},
    mmdRaw: {},
    wide: null,
    draw: null,
  };
  const st = () => STATES[S.state];

  const chapterOf = (id) => R.chapters.find((c) => c.stops.includes(id));
  const visibleChapters = () => R.chapters.slice(0, st().chapters);
  const visibleStops = () => visibleChapters().flatMap((c) => c.stops);
  // Seitenfolge: Überblick, dann je Phase eine Seite („p1“ …). Stopps sind Abschnitte ihrer Phasen-Seite; „#/s/…“ springt dorthin.
  const pageOrder = () => [null, ...visibleChapters().map((c) => `p${c.key}`)];
  const isPhase = (id) => typeof id === 'string' && /^p\d+$/.test(id);
  const phaseOf = (id) => R.chapters.find((c) => `p${c.key}` === id);
  const hrefOf = (id) => (!id ? '#/ueberblick' : isPhase(id) ? `#/p/${id.slice(1)}` : `#/s/${id}`);
  const titleOf = (id) => (!id ? 'Überblick' : isPhase(id) ? `Phase ${id.slice(1)} · ${phaseOf(id).title}` : R.stops[id].title);

  // Syntaxfarben: ganzen Ausschnitt färben, dann je Zeile Spans schließen und wieder öffnen.
  function hl(text, lang) {
    let html = esc(text);
    if (window.hljs && lang) {
      try { html = window.hljs.highlight(text, { language: lang, ignoreIllegals: true }).value; } catch { /* ungefärbt */ }
    }
    const out = [];
    const open = [];
    let cur = '';
    const re = /(<span[^>]*>)|(<\/span>)|(\n)|([^<\n]+)/g;
    let m;
    while ((m = re.exec(html))) {
      if (m[1]) { open.push(m[1]); cur += m[1]; }
      else if (m[2]) { open.pop(); cur += m[2]; }
      else if (m[3]) { cur += '</span>'.repeat(open.length); out.push(cur); cur = open.join(''); }
      else cur += m[4];
    }
    out.push(cur);
    return out;
  }

  // ---------- Kommentare ----------
  function whereOf(c) {
    if (c.t === 'line') return `${c.file.split('/').pop()}:${c.line}`;
    if (c.t === 'area') return `${c.caption} · Bereich`;
    if (c.t === 'diagram') return `Schaubild „${c.caption}“`;
    if (c.t === 'screen') return `Bildschirm „${c.name}“`;
    return `Stopp „${R.stops[c.stop].title}“`;
  }
  const cmHtml = (c) => `<div class="cm" data-cid="${c.id}"><span>${esc(c.text)}</span><span class="who">gesammelt</span><button type="button" class="quiet x" data-act="cdel" data-cid="${c.id}" aria-label="Kommentar entfernen">Entfernen</button></div>`;

  function updateCounts() {
    const n = S.comments.length;
    const chatCnt = $('#tab-chat .cnt');
    chatCnt.textContent = String(n);
    chatCnt.hidden = n === 0;
    const chip = $('#ccount');
    chip.hidden = n === 0;
    $('b', chip).textContent = String(n);
    const send = $('#btnSend');
    send.disabled = n === 0;
    send.title = n === 0 ? 'Noch keine Kommentare gesammelt' : `Gehen an ${st().session} ${st().name}`;
    $('#clistBody').innerHTML = n === 0
      ? '<p>Keine Kommentare gesammelt.</p>'
      : `<ol>${S.comments.map((c) => `<li><span>${esc(c.text)}</span><small>${esc(whereOf(c))}</small><button type="button" class="quiet" data-act="cdel" data-cid="${c.id}" aria-label="Kommentar entfernen">✕</button></li>`).join('')}</ol><p>Gehen mit der nächsten Nachricht an ${esc(st().session)} ${esc(st().name)} — oder sofort über „Kommentare senden“.</p>`;
    const other = $('#otherChips');
    if (other) other.innerHTML = S.comments.map((c) => `<span class="chip-c">${esc(whereOf(c))}</span>`).join('');
  }

  const composer = $('#cpop');
  let pending = null;
  function openComposer(anchor, target) {
    pending = target;
    $('h4', composer).innerHTML = `Kommentar zu <code>${esc(whereOf(target))}</code>`;
    const ta = $('textarea', composer);
    ta.value = '';
    composer.showPopover();
    const r = anchor.getBoundingClientRect();
    const w = composer.offsetWidth;
    const h = composer.offsetHeight;
    let top = r.bottom + 6;
    if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 6);
    composer.style.top = `${top}px`;
    composer.style.left = `${Math.min(Math.max(8, r.left), innerWidth - w - 8)}px`;
    ta.focus();
  }
  function closeComposer() {
    composer.hidePopover();
    pending = null;
    $$('.rubber').forEach((el) => el.remove());
  }
  function saveComment() {
    const text = $('textarea', composer).value.trim();
    if (!text || !pending) return;
    S.comments.push({ ...pending, id: `c${++S.seq}`, text });
    closeComposer();
    renderPage(true);
    if ($('#lightbox').open) renderLightbox();
    updateCounts();
  }

  // ---------- Bausteine ----------
  // Anmerkung am Code; „rev“ = Befund der Review-Station an derselben Zeile, als zweite Stimme.
  const noteCls = (nt) => (nt.mut ? ' mut' : nt.rev ? ' rev' : nt.risk ? ' risk' : '');
  const noteHtml = (nt) => `<div class="anno${noteCls(nt)}" data-n="${nt.n}"><span class="nmark${noteCls(nt)}">${nt.n}</span><span class="txt">${nt.rev ? `<b class="who">Review ${esc(nt.rev)}</b>` : ''}${nt.mut ? '<b class="who">Mutant überlebt</b>' : ''}${esc(nt.text)}</span></div>`;

  // Diff-Zeilen: aus Git ([art, alt, neu, text]) oder, ohne „rows“, der ganze Ausschnitt als neu.
  // Entfernte Zeilen („d“) stehen als Vorher dazwischen; Läufe über sechs Zeilen sind eingeklappt.
  const DIFF_FOLD = 6;
  function diffRows(blk) {
    if (blk.rows) return blk.rows;
    return blk.text.split('\n').map((s, i) => ['a', null, blk.start + i, s]);
  }

  function rowsHtml(blk, gid, notes, inline) {
    const rows = diffRows(blk);
    const lines = hl(rows.map((r) => r[3]).join('\n'), blk.lang);
    const runLen = rows.map((r, i) => {
      if (r[0] !== 'd' || rows[i - 1]?.[0] === 'd') return 0;
      let k = i;
      while (rows[k]?.[0] === 'd') k++;
      return k - i;
    });
    let run = null;
    const startAt = {};
    const lineNs = {};
    for (const a of blk.anchors ?? []) {
      (startAt[a.from] ??= []).push(a.n);
      for (let l = a.from; l <= a.to; l++) (lineNs[l] ??= []).push(a.n);
    }
    const isRisk = (n) => notes.find((x) => x.n === n)?.risk;
    const clsOf = (n) => { const nt = notes.find((x) => x.n === n); return nt ? noteCls(nt) : ''; };
    const closed = st().closed;
    let h = '';
    lines.forEach((src, i) => {
      const [kind, old, ln] = rows[i];
      if (kind === 'd') {
        if (runLen[i] > DIFF_FOLD) {
          run = `${gid}-r${i}`;
          h += `<tr class="drun"><td colspan="5"><button type="button" class="quiet" data-act="drun" data-run="${run}">${runLen[i]} Zeilen vorher · zeigen</button></td></tr>`;
        } else if (runLen[i]) run = null;
        h += `<tr class="ln del"${run ? ` data-run="${run}" hidden` : ''} title="Vorher, Zeile ${old}"><td class="num">${old}</td><td class="mk"></td><td class="sign">−</td><td class="src">${src || ' '}</td><td class="plus"></td></tr>`;
        return;
      }
      const ns = lineNs[ln] ?? [];
      const risk = ns.some(isRisk);
      const mk = (startAt[ln] ?? []).map((n) => `<span class="nmark${clsOf(n)}">${n}</span>`).join('');
      const plus = closed ? '' : `<button type="button" class="lnplus" data-act="cline" data-line="${ln}" aria-label="Kommentar zu Zeile ${ln}">+</button>`;
      const miss = blk.cov?.miss?.includes(ln);
      h += `<tr class="ln ${kind === 'c' ? 'ctx' : 'add'}${ns.length ? ' in-note' : ''}${risk ? ' risk' : ''}${miss ? ' nocov' : ''}" data-ns=" ${ns.join(' ')} " data-line="${ln}"${miss ? ' title="Von keinem Test ausgeführt"' : ''}><td class="num">${ln}</td><td class="mk">${mk}</td><td class="sign">${kind === 'c' ? ' ' : '+'}</td><td class="src">${src || ' '}</td><td class="plus">${plus}</td></tr>`;
      for (const c of S.comments.filter((c) => c.t === 'line' && c.blk === gid && c.line === ln)) h += `<tr class="cmt"><td colspan="5">${cmHtml(c)}</td></tr>`;
      if (inline) {
        for (const a of (blk.anchors ?? []).filter((a) => a.to === ln)) {
          const nt = notes.find((x) => x.n === a.n);
          if (nt) h += `<tr class="nrow"><td colspan="5">${noteHtml(nt)}</td></tr>`;
        }
      }
    });
    return h;
  }

  function fileHead(blk) {
    const name = blk.file.split('/').pop();
    const dir = blk.file.slice(0, blk.file.length - name.length);
    return `${svg('file')}<span class="path">${esc(dir)}<b>${esc(name)}</b></span>${blk.isNew ? '<span class="tag">neu</span>' : ''}<span class="add">+${blk.add}</span>${blk.del ? `<span class="del">−${blk.del}</span>` : ''}<code class="vw-num">${blk.commit}</code>${tag('Anker: Datei · Commit · Zeilen — Code kommt aus Git')}<span class="sp"></span><button type="button" class="quiet" data-act="whole">Ganze Datei</button><button type="button" class="quiet" data-act="files" data-file="${esc(blk.file)}" data-line="${blk.start}">${svg('ext')}Im Reiter Dateien</button>`;
  }

  function staleHtml(blk) {
    if (!blk.stale || S.state === 'waechst') return '';
    return `<div class="banner warn" style="max-width:none;margin:0;border-bottom:1px solid var(--ui-line)">${svg('hist')}<span><b>Veraltet</b> — die Datei wurde danach in ${blk.stale.phase} geändert (<code>${blk.stale.commit}</code>, ${blk.stale.add}). Gezeigt wird der Stand von <code>${blk.commit}</code>.</span><button type="button" data-act="current">Aktuellen Stand zeigen</button></div>`;
  }

  // Prüfwerte am Code: überlebte Mutanten werden zu Anmerkungen „M…“, Zeilen ohne Test bekommen eine Marke. Beides mechanisch aus den Berichten der Testläufe.
  function withChecks(blk) {
    if (!blk.mutants?.length) return blk;
    const ms = blk.mutants.map((m, i) => ({ n: `M${i + 1}`, mut: true, line: m.line, text: m.text }));
    return { ...blk, anchors: [...(blk.anchors ?? []), ...ms.map((m) => ({ n: m.n, from: m.line, to: m.line }))], notes: [...(blk.notes ?? []), ...ms] };
  }

  function codeBlock(blk0, gid) {
    const blk = withChecks(blk0);
    const notes = [...(blk.notes ?? [])].sort((a, b) => (blk.anchors.find((x) => x.n === a.n)?.from ?? 0) - (blk.anchors.find((x) => x.n === b.n)?.from ?? 0));
    const margin = S.variant === 'a' && S.wide;
    const table = `<div class="codescroll"><table class="lines" data-blk="${gid}" data-file="${esc(blk.file)}"><tbody>${rowsHtml(blk, gid, notes, !margin)}</tbody></table></div>`;
    const aside = margin && notes.length ? `<aside class="annos">${notes.map(noteHtml).join('')}</aside>` : '';
    return `<section class="blk"><div class="blk-head">${fileHead(blk)}</div><div class="blk-body">${staleHtml(blk)}<div class="codegrid${aside ? ' margin' : ''}">${table}${aside}</div></div></section>`;
  }

  function shotHtml(img, gid) {
    const pct = (v, of) => `${(v / of) * 100}%`;
    const marks = img.marks.map((m) => `<button type="button" class="mark" data-n="${m.n}" style="left:${pct(m.x, img.w)};top:${pct(m.y, img.h)};width:${pct(m.w, img.w)};height:${pct(m.h, img.h)}" aria-label="Markierung ${m.n}"><span class="nmark">${m.n}</span></button>`).join('');
    const cms = S.comments.filter((c) => c.t === 'area' && c.img === gid).map((c) => `<span class="mark c" style="left:${c.rect.x}%;top:${c.rect.y}%;width:${c.rect.w}%;height:${c.rect.h}%" title="${esc(c.text)}"><span class="nmark">✎</span></span>`).join('');
    return `<div class="shot-frame${img.narrow ? ' narrow' : ''}" data-img="${gid}"><div class="shot-inner"><img src="${img.src}" alt="${esc(img.caption)}" width="${img.w}" height="${img.h}">${marks}${cms}</div></div>`;
  }
  const areaComments = (gid) => {
    const list = S.comments.filter((c) => c.t === 'area' && c.img === gid);
    return list.length ? `<div class="legend">${list.map(cmHtml).join('')}</div>` : '';
  };
  const shotButtons = (gid, caption) => `<button type="button" class="quiet" data-act="zoom" data-img="${gid}">${svg('max')}Vergrößern</button>${st().closed ? '' : `<button type="button" class="quiet" data-act="carea" data-img="${gid}" data-caption="${esc(caption)}">${svg('msg')}Bereich kommentieren</button>`}`;

  function imageBlock(img, gid) {
    S.images[gid] = img;
    return `<section class="blk"><div class="blk-head">${svg('image')}<span>${esc(img.caption)}</span>${tag('image { path, marks }')}<span class="sp"></span>${shotButtons(gid, img.caption)}</div><div class="blk-body">${shotHtml(img, gid)}<div class="legend">${img.notes.map(noteHtml).join('')}</div>${areaComments(gid)}</div></section>`;
  }

  function pairBlock(b, gid) {
    const img = { ...b.image };
    S.images[`${gid}-i`] = img;
    const code = b.code;
    const rows = rowsHtml(code, `${gid}-c`, b.notes, false);
    return `<section class="blk"><div class="blk-head">${fileHead(code)}</div><div class="pair${img.narrow ? '' : ' stack'}">
      <div class="left"><div class="codescroll"><table class="lines" data-blk="${gid}-c" data-file="${esc(code.file)}"><tbody>${rows}</tbody></table></div></div>
      <div class="right"><div class="sub-head">${svg('image').replace('<svg', '<svg width="14" height="14"')}<span>${esc(img.caption)}</span><span class="sp" style="flex:1"></span>${shotButtons(`${gid}-i`, img.caption)}</div>${shotHtml(img, `${gid}-i`)}${areaComments(`${gid}-i`)}</div>
      <div class="pair-legend legend">${b.notes.map(noteHtml).join('')}</div>
    </div></section>`;
  }

  // ---------- Sichtabnahme ----------
  // Je Bildschirm ein Aufruf report_screen: Fotos je Ansicht (Breite, Thema), optional das Entwurfsbild daneben,
  // Abweichung in einer Zeile, Klickpfad „öffnen → tun → erwartet“ mit Vorher/Nachher. Die Fotos liefert die Station.
  const fileOf = (src) => src.split('/').pop();
  function screenHtml(sc, gid) {
    const i = Math.min(S.sview[sc.id] ?? 0, sc.shots.length - 1);
    const shot = sc.shots[i];
    const img = { ...shot, caption: `${sc.name} · ${shot.label}`, notes: shot.marks };
    const sg = `${gid}-s`;
    S.images[sg] = img;
    const hasDesign = !!shot.design;
    const compare = hasDesign && (S.scmp[sc.id] ?? true);
    const closed = st().closed;
    let h = `<section class="stop screen" id="screen-${sc.id}" data-screen="${sc.id}" data-name="${esc(sc.name)}"><h3 class="stop-h">${esc(sc.name)}</h3>`;
    h += `<p class="meta"><span>${sc.by.join(' ')}</span><span>${sc.shots.length} ${sc.shots.length === 1 ? 'Ansicht' : 'Ansichten'}</span>${sc.steps?.length ? `<span>${sc.steps.length} Klickpfade</span>` : ''}${tag('report_screen — ein Aufruf je Bildschirm, Fotos von der Station')}<span class="sp"></span>${closed ? '' : `<button type="button" class="quiet" data-act="cscreen">${svg('msg')}Kommentar</button>`}</p>`;
    if (sc.text) h += `<div class="prose"><p>${esc(sc.text)}</p></div>`;
    const seg = sc.shots.length > 1
      ? `<span class="dseg" role="group" aria-label="Ansicht">${sc.shots.map((s, k) => `<button type="button" data-act="sview" data-scr="${sc.id}" data-i="${k}" aria-pressed="${k === i}">${esc(s.label)}</button>`).join('')}</span>`
      : `<span class="one">${esc(shot.label)}</span>`;
    const sw = hasDesign
      ? `<label class="cmp"><input type="checkbox" role="switch" data-act="scmp" data-scr="${sc.id}"${compare ? ' checked' : ''}>Entwurf daneben</label>`
      : '<span class="nodesign">kein Entwurfsbild</span>';
    h += `<section class="blk"><div class="blk-head">${svg('image')}${seg}<span class="sp"></span>${sw}${shotButtons(sg, img.caption)}</div><div class="blk-body">`;
    h += `<div class="scr-view${compare ? ' compare' : ''}${shot.narrow ? ' narrow' : ''}"><figure><figcaption>Umsetzung</figcaption>${shotHtml(img, sg)}</figure>`;
    if (compare) h += `<figure class="design"><figcaption>Entwurf</figcaption><div class="shot-frame${shot.narrow ? ' narrow' : ''}"><div class="shot-inner"><img src="${shot.design.src}" alt="Entwurf: ${esc(sc.name)}" width="${shot.design.w}" height="${shot.design.h}"></div></div></figure>`;
    h += '</div>';
    if (shot.marks.length) h += `<div class="legend">${shot.marks.map(noteHtml).join('')}</div>`;
    h += areaComments(sg);
    if (sc.deviation) h += `<p class="dev">${svg('flag')}<b>Abweichung vom Entwurf</b><span>${esc(sc.deviation)}</span></p>`;
    else if (sc.shots.some((s) => s.design)) h += `<p class="dev ok">${svg('check')}<span>wie im Entwurf</span></p>`;
    h += '</div></section>';
    if (sc.steps?.length) {
      const pic = (p, k, key, lbl) => {
        if (!p[key]) return '';
        const g = `${gid}-p${k}${key[0]}`;
        S.images[g] = { ...p[key], caption: `${sc.name} · Schritt ${k + 1} · ${lbl}`, marks: [] };
        return `<button type="button" class="thumb" data-act="zoom" data-img="${g}" title="${lbl} vergrößern"><img src="${p[key].src}" alt="" width="96" height="56"><small>${lbl}</small></button>`;
      };
      h += `<table class="steps"><caption>Klickpfad</caption><thead><tr><th>#</th><th>Öffnen</th><th>Tun</th><th>Erwartet</th><th>Bild</th></tr></thead><tbody>${sc.steps.map((p, k) => `<tr><td class="k">${k + 1}</td><td data-l="Öffnen">${esc(p.open)}</td><td data-l="Tun">${esc(p.act)}</td><td data-l="Erwartet">${esc(p.expect)}</td><td class="pics">${pic(p, k, 'before', 'vorher')}${pic(p, k, 'after', 'nachher')}</td></tr>`).join('')}</tbody></table>`;
    }
    const cms = S.comments.filter((x) => x.t === 'screen' && x.screen === sc.id);
    if (cms.length) h += `<div class="stop-cms">${cms.map(cmHtml).join('')}</div>`;
    return `${h}</section>`;
  }
  function screensHtml(c, pid) {
    const n = c.screens.reduce((a, sc) => a + sc.shots.length, 0);
    const dev = c.screens.filter((sc) => sc.deviation).length;
    return `<section class="sa-sec"><h3>Sichtabnahme <span class="h3-sub">${c.screens.length} Bildschirme · ${n} Ansichten${dev ? ` · ${dev} ${dev === 1 ? 'Abweichung' : 'Abweichungen'}` : ''}</span></h3>${c.screens.map((sc) => screenHtml(sc, `${pid}-${sc.id}`)).join('')}</section>`;
  }

  // ---------- Schaubild als Diff ----------
  // Der Agent schreibt ein Mermaid-Schaubild und setzt vor Zeilen „+ “ (neu), „- “ (entfällt) oder „~ “ (geändert).
  // Daraus entstehen drei Ansichten: Unterschied (gefärbt), Vorher (ohne „+“), Nachher (ohne „-“).
  const MARK = /^(\s*)([+~-]) (.*)$/;
  const KIND_OF = { '+': 'neu', '-': 'weg', '~': 'anders' };
  const mmdHasDiff = (code) => code.split('\n').some((l) => MARK.test(l));
  // Farbe aus dem Thema; mit Deckkraft als rgba (für „rect“) oder als #rrggbbaa (für classDef, dort trennen Kommas Eigenschaften).
  function cssColor(name, alpha, hex8 = false) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const m = v.match(/^#([0-9a-f]{6})$/i);
    if (!m || alpha == null) return v;
    if (hex8) return `#${m[1]}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    return `rgba(${r},${g},${b},${alpha})`;
  }
  function mmdView(code, mode) {
    const lines = code.split('\n');
    const seq = /^\s*sequenceDiagram/.test(lines[0]);
    const col = { neu: '--ui-ok', weg: '--ui-danger', anders: '--ui-warn' };
    const out = [];
    const nodes = { neu: new Set(), weg: new Set(), anders: new Set() };
    const edges = [];
    let edge = 0;
    let rect = null;
    for (const l of lines) {
      const m = l.match(MARK);
      const mk = m ? m[2] : null;
      const body = m ? `${m[1]}${m[3]}` : l;
      if ((mode === 'vorher' && mk === '+') || (mode === 'nachher' && mk === '-')) continue;
      const k = mode === 'diff' && mk ? KIND_OF[mk] : null;
      if (seq) {
        if (k !== rect) {
          if (rect) out.push('  end');
          if (k) out.push(`  rect ${cssColor(col[k], 0.16)}`);
          rect = k;
        }
        out.push(body);
        continue;
      }
      const bare = body.replace(/"[^"]*"|\[[^\]]*\]|\{[^}]*\}|\([^)]*\)/g, '[]');
      const isEdge = /--|==|-\./.test(bare) && !/^\s*(classDef|class|click|style|linkStyle|%%)/.test(bare);
      if (k && !/^\s*click/.test(bare)) {
        if (isEdge) [...bare.matchAll(/([A-Za-z_]\w*)\s*\[\]/g)].forEach((x) => nodes[k].add(x[1]));
        else { const id = bare.trim().match(/^([A-Za-z_]\w*)/); if (id) nodes[k].add(id[1]); }
      }
      if (isEdge) { if (k) edges.push([edge, k]); edge++; }
      out.push(body);
    }
    if (rect) out.push('  end');
    if (!seq && mode === 'diff') {
      out.push(`  classDef neu fill:${cssColor('--ui-ok', 0.18, true)},stroke:${cssColor('--ui-ok')},stroke-width:2px`);
      out.push(`  classDef weg fill:${cssColor('--ui-danger', 0.12, true)},stroke:${cssColor('--ui-danger')},stroke-width:2px,stroke-dasharray:5 3`);
      out.push(`  classDef anders fill:${cssColor('--ui-warn', 0.16, true)},stroke:${cssColor('--ui-warn')},stroke-width:2px`);
      Object.entries(nodes).forEach(([k, set]) => { if (set.size) out.push(`  class ${[...set].join(',')} ${k}`); });
      edges.forEach(([i, k]) => out.push(`  linkStyle ${i} stroke:${cssColor(col[k])},stroke-width:2px${k === 'weg' ? ',stroke-dasharray:5 3' : ''}`));
    }
    return out.join('\n');
  }

  function diagramBlock(b, gid, opts = {}) {
    const code = st().broken && b.broken ? b.broken : b.code;
    const diff = mmdHasDiff(code);
    const mode = S.dview[gid] ?? (['vorher', 'nachher'].includes(q.get('schaubild')) ? q.get('schaubild') : 'diff');
    S.mmdRaw[gid] = code;
    S.mmd[gid] = diff ? mmdView(code, mode) : code;
    const cms = S.comments.filter((c) => c.t === 'diagram' && c.blk === gid);
    const cbtn = st().closed ? '' : `<button type="button" class="quiet" data-act="cdiag" data-blk="${gid}" data-caption="${esc(b.caption)}">${svg('msg')}Kommentieren</button>`;
    const seg = diff ? `<span class="dseg" role="group" aria-label="Ansicht">${[['diff', 'Unterschied'], ['vorher', 'Vorher'], ['nachher', 'Nachher']].map(([m, t]) => `<button type="button" data-act="dview" data-blk="${gid}" data-mode="${m}" aria-pressed="${m === mode}">${t}</button>`).join('')}</span>` : '';
    const legend = diff && mode === 'diff' ? `<div class="dlegend"><span class="neu">neu</span><span class="anders">geändert</span><span class="weg">entfällt</span>${tag('Zeilen mit + / - / ~ im Mermaid-Text')}</div>` : '';
    return `<section class="blk"><div class="blk-head">${svg('diagram')}<span>${esc(b.caption)}</span><span class="tag">Mermaid</span>${tag(opts.tool ?? 'figure { mermaid }')}<span class="sp"></span>${seg}<button type="button" class="quiet" data-act="src" data-blk="${gid}">Quelltext</button>${cbtn}</div><div class="blk-body"><div class="diagram"><div class="mmd" data-blk="${gid}">Schaubild wird gezeichnet …</div></div>${legend}${opts.hint ? `<div class="blk-cap">${opts.hint}</div>` : ''}${cms.length ? `<div class="legend">${cms.map(cmHtml).join('')}</div>` : ''}</div></section>`;
  }

  function blockHtml(b, gid) {
    if (b.type === 'code') return codeBlock(b, gid);
    if (b.type === 'image') return imageBlock(b, gid);
    if (b.type === 'pair') return pairBlock(b, gid);
    return diagramBlock(b, gid);
  }

  // ---------- Seiten ----------
  function overviewHtml() {
    const s = st();
    const growing = S.state === 'waechst';
    const kpi = growing
      ? [['Phasen', '4', 'von 5, eine läuft'], ['Stopps', '5', 'beim Schreiben angelegt'], ['Commits', '5', 'aus Git'], ['Dateien', '58', 'aus Git'], ['Zeilen', '+3.622 −417', 'aus Git']]
      : R.kpi;
    let h = `<p class="kicker">Review-Bericht · Umsetzung ${esc(R.umsetzung)}</p><h2>Überblick</h2>`;
    if (growing) h += `<div class="banner"><b>Phase 4 läuft.</b><span>Ihre Stopps entstehen, während die Station Code schreibt; das Ergebnis folgt mit „Station fertig“.</span></div>`;
    if (s.closed) h += `<div class="banner"><b>Abgenommen</b><span>am 26.11. um 11:02. Der Bericht bleibt zum Nachlesen.</span></div>`;
    h += `<p class="kicker">Ziel ${tag('gratis · aus dem Plan')}</p><div class="prose">${R.summary.map((p) => `<p>${p}</p>`).join('')}</div>`;
    h += `<dl class="kpi ov-kpi">${kpi.map(([t, v, d]) => `<div><dt>${t}</dt><dd>${v}</dd><dd>${d}</dd></div>`).join('')}</dl>${tag('Kennzahlen aus Git — kein Werkzeug')}`;
    const ck = visibleChapters().filter((c) => c.checks && s.running !== c.key);
    const tsum = ck.reduce((a, c) => (c.checks.tests ? [a[0] + c.checks.tests[0], a[1] + c.checks.tests[1]] : a), [0, 0]);
    const noTests = ck.filter((c) => !c.checks.tests).map((c) => c.key);
    if (ck.length) h += `<p class="ov-checks">${svg('check')}<span>Prüfkette grün in ${ck.filter((c) => c.checks.chain).length} von ${ck.length} Phasen · Tests <b>${tsum[0]}</b> bestanden, <b>${tsum[1]}</b> fehlgeschlagen${noTests.length ? ` · Phase ${noTests.join(', ')} ohne Tests` : ''}</span>${tag('aus den Berichtsdateien der Testläufe')}</p>`;
    h += `<h3>Landkarte ${tag('optional · ein figure der Review')}</h3>${diagramBlock({ caption: 'Was mit einer Datei passiert', code: R.map }, 'map', { tool: 'figure · Schaubild', hint: 'Klick auf einen Kasten springt zur Stelle im Bericht.' })}`;
    // „Genau hinsehen“ und Risiken entstehen ohne Extra-Aufruf aus den Stopps: Art Sicherheit, Anmerkung als Risiko.
    const vis = visibleStops();
    const look = vis.filter((id) => R.stops[id].look);
    const risky = vis.flatMap((id) => R.stops[id].blocks.flatMap((b) => (b.notes ?? []).filter((n) => n.risk).map((n) => ({ id, n }))));
    h += `<div class="ov-grid"><section><h3>Genau hinsehen ${tag('gratis · aus den Stopps')}</h3><ul class="look">${look.map((id) => `<li><a href="#/s/${id}">${svg('eye')}<b>${esc(R.stops[id].title)}</b><small>${esc(R.stops[id].look)}</small><span class="go">Phase ${chapterOf(id).key} ›</span></a></li>`).join('')}</ul></section>`;
    const openFinds = visibleChapters().flatMap((c) => (c.review?.items ?? []).filter((x) => x.status === 'offen').map((x) => ({ c, x })));
    h += `<section><h3>Risiken ${tag('gratis · Risiko-Anmerkungen, offene Befunde der Review-Station, offene Punkte')}</h3><ul class="risks">${risky.map(({ id, n }) => `<li><span><a href="#/s/${id}">${esc(R.stops[id].title)}</a> — ${esc(n.text)}</span></li>`).join('')}${openFinds.map(({ c, x }) => `<li><span><a href="${hrefOf(`p${c.key}`)}">Review ${esc(c.review.by)} · offen</a> — ${esc(x.text)}</span></li>`).join('')}${R.risks.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></section></div>`;
    h += `<h3>Phasen</h3><ol class="chapters">${R.chapters.map((c, i) => {
      const later = i >= s.chapters;
      const running = s.running === c.key;
      const by = later ? 'folgt' : running ? `${c.station} · läuft` : `${c.station} · ${c.time}<code>${c.commits.join(' · ')}</code>`;
      const sa = c.screens?.length ? ` <a class="sa-link" href="${hrefOf(`p${c.key}`)}">${svg('image')}Sichtabnahme: ${c.screens.length} Bildschirme${c.screens.some((x) => x.deviation) ? `, ${c.screens.filter((x) => x.deviation).length} mit Abweichung` : ''}</a>` : '';
      const text = later ? esc(c.phase) : running ? `${c.stops.length} Stopp bisher · Ergebnis folgt` : `${esc(c.text)}${sa} ${tag('Haiku · gestrafft aus „Station fertig“')}`;
      return `<li class="${later ? 'later' : ''}"><span class="k">${c.key}</span>${later ? `<b>${esc(c.title)}</b>` : `<a href="${hrefOf(`p${c.key}`)}">${esc(c.title)}</a>`}<span class="by">${by}</span><p>${text}</p></li>`;
    }).join('')}</ol>`;
    return h;
  }

  // Fuß der Seite: zurück und weiter zwischen Überblick und Phasen.
  function footHtml(id) {
    const order = pageOrder();
    const i = order.indexOf(id);
    const prev = order[i - 1];
    const next = order[i + 1];
    return `<footer class="stop-foot"><a class="prev" href="${hrefOf(prev)}"><small>← zurück</small><span>${esc(titleOf(prev))}</span></a><span class="mid"></span>${next !== undefined ? `<a class="next" href="${hrefOf(next)}"><small>weiter →</small><span>${esc(titleOf(next))}</span></a>` : '<span></span>'}</footer>`;
  }

  const findHtml = (x) => `<li class="find ${x.status}">${svg(x.status === 'offen' ? 'flag' : 'check')}<span class="txt">${esc(x.text)}</span>${x.stop ? `<a href="#/s/${x.stop}"><code>${esc(x.where)}</code></a>` : `<button type="button" class="quiet" data-act="files" data-file="${esc(x.where.split(':')[0])}" data-line="${x.where.split(':')[1]}"><code>${esc(x.where)}</code></button>`}</li>`;

  // Ein Stopp als Abschnitt der Phasen-Seite, keine eigene Seite.
  function stopSection(id) {
    const s = R.stops[id];
    const c = chapterOf(id);
    const [kn] = KINDS[s.kind];
    const [byNo, byRole] = s.by ?? [c.station, 'Umsetzung'];
    const cbtn = st().closed ? '' : `<button type="button" class="quiet" data-act="cstop">${svg('msg')}Kommentar</button>`;
    let h = `<section class="stop" id="stop-${id}" data-stop="${id}"><h3 class="stop-h">${esc(s.title)}</h3>`;
    h += `<p class="meta"><span class="kind${s.kind === 'sec' ? ' sec' : ''}">${svg(s.kind)}${kn}</span><span>${byNo} ${byRole}</span>${tag('note · figure — je ein Aufruf, Code aus Git')}<span class="sp"></span>${cbtn}</p>`;
    h += `<div class="prose">${s.why.map((p) => `<p>${esc(p)}</p>`).join('')}</div>`;
    s.blocks.forEach((b, bi) => { h += blockHtml(b, `${id}-b${bi}`); });
    const sc = S.comments.filter((x) => x.t === 'stop' && x.stop === id);
    if (sc.length) h += `<div class="stop-cms">${sc.map(cmHtml).join('')}</div>`;
    return `${h}</section>`;
  }

  // ---------- Markdown für Haiku (nur im Entwurf sichtbar mit „Werkzeuge zeigen“) ----------
  // Rohfassung: jeder Werkzeug-Aufruf hängt einen Eintrag an. Geordnet: Haiku gibt Titel, Weg und Reihenfolge zurück, die Einträge selbst nur als IDs.
  function phaseMd(c) {
    let n = 0;
    const nid = () => `n${++n}`;
    const at = (file, a) => `${file.split('/').slice(-2).join('/')}:${a.from}${a.to !== a.from ? `-${a.to}` : ''}`;
    const raw = [`<!-- Phase ${c.key} · Rohfassung. Code steht nicht hier, „at“ zeigt auf Git. -->`];
    raw.push(`## Spur aus dem Verlauf · ${c.station} · ohne Tests\n${c.journey ? c.journey.map((j) => `- Edit ${j.files.join(', ')}`).join('\n') : '- (läuft)'}`);
    const groups = [];
    const revIds = {};
    c.stops.forEach((sid) => {
      const s = R.stops[sid];
      const who = (s.by ?? [c.station, 'Umsetzung']).join(' ');
      const ids = [];
      const first = s.blocks.find((b) => b.file || b.code?.file);
      const firstCode = first?.file ? first : first?.code;
      let id = nid();
      ids.push(id);
      raw.push(`## ${id} · note · ${who}\n${firstCode ? `at: ${at(firstCode.file, { from: firstCode.start, to: firstCode.start })}\n` : ''}kind: ${s.kind}\n\n${s.why.join('\n\n')}`);
      s.blocks.forEach((b) => {
        const code = b.type === 'code' ? b : b.type === 'pair' ? b.code : null;
        const loose = [];
        (b.type === 'code' || b.type === 'pair' ? b.notes ?? [] : []).forEach((nt) => {
          const a = code.anchors?.find((x) => x.n === nt.n);
          if (!a) { loose.push(nt); return; }
          id = nid();
          ids.push(id);
          if (nt.rev) revIds[sid] = id;
          raw.push(`## ${id} · note · ${nt.rev ? `${c.review.by} Review` : who}\nat: ${at(code.file, a)}${nt.rev ? '\nkind: befund' : nt.risk ? '\nkind: risiko' : ''}\n\n${nt.text}`);
        });
        if (b.type === 'image' || b.type === 'pair') {
          const img = b.type === 'image' ? b : b.image;
          const legend = b.type === 'image' ? img.notes ?? [] : loose;
          id = nid();
          ids.push(id);
          raw.push(`## ${id} · figure · ${who}\ncaption: ${img.caption}\nimage: ${img.src.split('/').pop()}\nmarks: ${img.marks.map((m) => `${m.n}@${Math.round((m.x / img.w) * 100)},${Math.round((m.y / img.h) * 100)}`).join(' ')}${legend.length ? `\n\n${legend.map((x) => `- ${x.n}: ${x.text}`).join('\n')}` : ''}`);
        }
        if (b.type === 'diagram') {
          id = nid();
          ids.push(id);
          raw.push(`## ${id} · figure · ${who}\ncaption: ${b.caption}\n\n\`\`\`mermaid\n${b.code.trim()}\n\`\`\``);
        }
      });
      groups.push({ s, ids });
    });
    const screenIds = [];
    (c.screens ?? []).forEach((sc) => {
      const id = nid();
      screenIds.push(id);
      const shots = sc.shots.map((s) => `${s.label} (${fileOf(s.src)}${s.design ? `, Entwurf ${fileOf(s.design.src)}` : ''}${s.marks.length ? `, marks ${s.marks.map((m) => `${m.n}@${m.x},${m.y},${m.w},${m.h}`).join(' ')}` : ''})`).join(' · ');
      const legend = [...new Map(sc.shots.flatMap((s) => s.marks).map((m) => [m.n, m.text])).entries()].map(([n, x]) => `- ${n}: ${x}`).join('\n');
      const steps = (sc.steps ?? []).map((p, k) => `${k + 1}. ${p.open} → ${p.act} → ${p.expect}${p.before ? ` · vorher ${fileOf(p.before.src)}` : ''}${p.after ? ` · nachher ${fileOf(p.after.src)}` : ''}`).join('\n');
      raw.push(`## ${id} · screen · ${sc.by.join(' ')}
screen: ${sc.name}
shots: ${shots}${sc.deviation ? `
abweichung: ${sc.deviation}` : ''}${steps ? `
schritte:
${steps}` : ''}

${sc.text}${legend ? `

${legend}` : ''}`);
    });
    const open = [];
    const done = [];
    (c.review?.items ?? []).forEach((x) => {
      let id = x.stop && x.status === 'offen' ? revIds[x.stop] : null;
      if (!id) {
        id = nid();
        raw.push(`## ${id} · note · ${c.review.by} Review\nat: ${x.where}\nkind: befund\n\n${x.text}`);
      }
      if (x.status === 'offen') open.push(id);
      else {
        const fix = nid();
        raw.push(`## ${fix} · note · ${c.review.fix ?? '#15'} Fix\nresolves: ${id}\n\nNachgezogen.`);
        done.push(`${id}←${fix}`);
      }
    });
    let diag = '';
    if (c.review?.diagram) {
      diag = nid();
      raw.push(`## ${diag} · figure · ${c.review.by} Review\ncaption: ${c.review.diagram.caption}\n\n\`\`\`mermaid\n${c.review.diagram.code.trim()}\n\`\`\``);
    }
    if (!c.journey) return { raw: raw.join('\n\n'), tidy: '<!-- folgt: Haiku ordnet bei „Station fertig“ -->' };
    const tidy = [`# Phase ${c.key} · ${c.title}`, `Ergebnis: ${c.text}`, `## Weg\n${c.journey.map((j, i) => `${i + 1}. ${j.detour ? '**Umweg:** ' : ''}${j.t}`).join('\n')}`];
    if (screenIds.length) tidy.push(`## Sichtabnahme
${screenIds.join(' ')}`);
    if (c.review) tidy.push(`## Review ${c.review.by}\noffen: ${open.join(' ') || '–'}\nbehoben: ${done.join(' ') || '–'}${diag ? `\nschaubild: ${diag}` : ''}`);
    groups.forEach(({ s, ids }) => tidy.push(`## ${s.title} {${s.kind}}${s.look ? `\nlook: ${s.look}` : ''}\n${ids.join(' ')}`));
    return { raw: raw.join('\n\n'), tidy: tidy.join('\n\n') };
  }

  // ---------- Prüfung: Testergebnisse und Metriken, mechanisch aus den Berichtsdateien der Test- und Review-Läufe ----------
  // Keine Schwellen, keine Ampel: rot nur bei fehlgeschlagenen Tests, sonst Zahlen.
  function phaseGaps(c) {
    const gaps = [];
    c.stops.forEach((sid) => R.stops[sid].blocks.forEach((b) => {
      const code = b.type === 'code' ? b : b.type === 'pair' ? b.code : null;
      if (!code) return;
      const f = code.file.split('/').pop();
      (code.mutants ?? []).forEach((m) => gaps.push({ sid, where: `${f}:${m.line}`, text: `Mutant überlebt: ${m.text}` }));
      const miss = code.cov?.miss ?? [];
      if (miss.length) gaps.push({ sid, where: `${f}:${miss[0]}${miss.length > 1 ? `–${miss[miss.length - 1]}` : ''}`, text: `${miss.length} neue Zeilen ohne Test` });
    }));
    return gaps;
  }
  function checksHtml(c) {
    const k = c.checks;
    if (!k) return '';
    const chips = [`<span class="ck ${k.chain ? 'ok' : 'bad'}">${svg(k.chain ? 'check' : 'flag')}Prüfkette ${k.chain ? 'grün' : 'rot'}</span>`];
    if (k.tests) chips.push(`<span class="ck${k.tests[1] ? ' bad' : ''}">Tests <b>${k.tests[0]}</b> bestanden${k.tests[1] ? ` · <b>${k.tests[1]}</b> fehlgeschlagen` : ''}${k.tests[2] ? ` · ${k.tests[2]} übersprungen` : ''}</span>`);
    else chips.push('<span class="ck none">keine Tests für diese Phase</span>');
    if (k.cov) chips.push(`<span class="ck">neue Zeilen <b>${k.cov[0]} %</b> abgedeckt <small>${k.cov[1]}</small></span>`);
    if (k.mut) chips.push(`<span class="ck">Mutation <b>${k.mut[0]} %</b> <small>${k.mut[1]} erkannt · ${k.mut[2]} überlebt</small></span>`);
    const gaps = phaseGaps(c);
    let h = `<div class="checks">${chips.join('')}<span class="ck-src">${esc(k.by)} · ${esc(k.src)}${tag('kein Werkzeug-Aufruf: Verwalter liest die Berichtsdateien')}</span></div>`;
    if (gaps.length) h += `<details class="way"><summary>${svg('flag')}<b>Lücken</b><span>${gaps.length} Stellen im Code markiert</span></summary><ul class="finds">${gaps.map((g) => `<li class="find"><span></span><span class="txt">${esc(g.text)}</span><a href="#/s/${g.sid}"><code>${esc(g.where)}</code></a></li>`).join('')}</ul></details>`;
    return h;
  }

  // Phasen-Seite: alles auf einer Seite — Ergebnis, Weg (eingeklappt), Review, dann die Stopps als Abschnitte.
  function phaseHtml(pid) {
    const c = phaseOf(pid);
    const s = st();
    const running = s.running === c.key;
    let h = `<p class="kicker">Phase ${c.key} · ${c.station} Umsetzung · ${running ? 'läuft' : c.time}</p><h2>${esc(c.title)}</h2>`;
    h += `<p class="meta"><span>${c.files} Dateien</span><span>${c.lines}</span><code>${c.commits.join(' · ')}</code>${tag('aus Git')}</p>`;
    if (running) {
      h += `<div class="banner"><b>Läuft.</b><span>Stopps entstehen beim Schreiben. Ergebnis und Weg ordnet Haiku bei „Station fertig“.</span></div>`;
    } else {
      h += `<div class="prose lead"><p>${esc(c.text)}</p></div>${tag('Haiku · aus der Rohfassung gestrafft')}`;
      h += checksHtml(c);
      const det = c.journey.filter((j) => j.detour).length;
      h += `<details class="way"><summary>${svg('route')}<b>Weg</b><span>${c.journey.length} Etappen${det ? ` · ${det} Umweg` : ''}</span>${tag('Haiku · aus der Spur im Verlauf, ohne Tests')}</summary><ol>${c.journey.map((j) => `<li${j.detour ? ' class="detour"' : ''}><span class="txt">${j.detour ? '<b class="dt">Umweg</b>' : ''}${esc(j.t)}</span><span class="fl">${j.files.map((f) => `<code>${esc(f)}</code>`).join('')}${j.stop ? `<a href="#/s/${j.stop}">zum Stopp ↓</a>` : ''}</span></li>`).join('')}</ol></details>`;
    }
    if (c.screens?.length) h += screensHtml(c, pid);
    if (c.review) {
      const open = c.review.items.filter((x) => x.status === 'offen');
      const done = c.review.items.filter((x) => x.status !== 'offen');
      const sum = c.review.items.length ? `${open.length} offen · ${done.length} behoben` : 'keine Befunde';
      h += `<section class="rv-sec"><h3>Review ${esc(c.review.by)} <span class="h3-sub">${sum}</span>${tag('note mit kind „befund“ · Fix meldet resolves')}</h3>`;
      if (open.length) h += `<ul class="finds">${open.map(findHtml).join('')}</ul>`;
      if (c.review.diagram) h += diagramBlock(c.review.diagram, `${pid}-rv`, { tool: 'figure · Review' });
      if (done.length) h += `<details class="done"><summary>${done.length} behoben</summary><ul class="finds">${done.map(findHtml).join('')}</ul></details>`;
      h += '</section>';
    }
    h += c.stops.map(stopSection).join('');
    const md = phaseMd(c);
    h += `<div class="tools-only md-pair"><details class="way"><summary>${svg('file')}<b>Rohfassung</b><span>was die Werkzeuge anhängen</span></summary><pre class="md">${esc(md.raw)}</pre></details><details class="way"><summary>${svg('file')}<b>Geordnet</b><span>was Haiku zurückgibt: Titel, Weg, Reihenfolge als IDs</span></summary><pre class="md">${esc(md.tidy)}</pre></details></div>`;
    return h + footHtml(pid);
  }

  function tocHtml() {
    const s = st();
    let h = `<ol class="toc-list"><li><a class="toc-link" href="#/ueberblick"${S.current ? '' : ' aria-current="page"'}>${svg('map')}<span class="nm">Überblick</span></a></li>`;
    R.chapters.forEach((c, i) => {
      const inner = `<span class="k">${c.key}</span><span class="nm">${esc(c.title)}</span>`;
      if (i >= s.chapters) { h += `<li><span class="toc-link off" title="Noch nicht begonnen">${inner}</span></li>`; return; }
      const mark = s.running === c.key ? '<span class="toc-run" title="Läuft gerade"></span>' : s.fresh === c.key ? '<span class="toc-new" title="Neu seit deinem letzten Blick"></span>' : '';
      const here = S.current === `p${c.key}`;
      h += `<li><a class="toc-link" href="${hrefOf(`p${c.key}`)}"${here ? ' aria-current="page"' : ''}>${inner}${mark}</a></li>`;
    });
    return `${h}</ol>`;
  }

  // ---------- Zeichnen ----------
  function renderHead() {
    const s = st();
    $('#hdNum').textContent = s.session;
    $('#hdName').textContent = s.name;
    const status = $('#hdStatus');
    status.className = `vw-status ${s.status[0]}`;
    $('.lbl', status).textContent = s.status[1];
    $('#backPhase').textContent = s.back;
    $('#tab-files .cnt').textContent = String(s.files);
    $('#tab-review .new').hidden = !s.fresh;
    $('#sideStation').innerHTML = `<span></span><i class="vw-st ${s.status[0] === 'run' ? 'run' : s.status[0] === 'done' ? 'done' : 'wait'}"></i><span class="t">${s.session} ${esc(s.name)}</span><small>${esc(s.status[1])}</small>`;
    $('#sideCount').textContent = S.state === 'waechst' ? '3/6' : s.closed ? '6/6' : '5/6';
    $$('.vw-tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.view === S.view)));
    $('#rv').hidden = S.view !== 'review';
    $('#other').hidden = S.view === 'review';
    $('#otherText').textContent = {
      chat: 'Chat wie heute. Kommentare aus dem Review stehen als Karten über der Eingabeleiste und gehen mit der nächsten Nachricht.',
      files: 'Dateien wie heute. „Im Reiter Dateien“ springt aus dem Review hierher, Datei offen, Zeile sichtbar.',
      artifacts: 'Artefakte wie heute. Das HTML-Abnahme-Artefakt entfällt, der Bericht steht im Reiter „Review“.',
    }[S.view] ?? '';
  }

  function renderBar() {
    const s = st();
    const badge = $('#rvState');
    badge.className = `state ${s.badge[0]}`;
    $('span', badge).textContent = s.badge[1];
    const chs = visibleChapters();
    const last = chs[chs.length - 1];
    $('#rvMeta').textContent = s.running
      ? `Umsetzung ${R.umsetzung} · ${chs.length} von ${R.chapters.length} Phasen · Phase ${s.running} schreibt gerade mit`
      : `Umsetzung ${R.umsetzung} · ${chs.length} von ${R.chapters.length} Phasen · zuletzt ${last.time} von ${last.station}`;
    $('#btnAccept').hidden = !s.canAccept;
    $('#btnSend').hidden = !!s.closed;
    $('#ccount').style.display = s.closed ? 'none' : '';
    document.body.classList.toggle('closed', !!s.closed);
  }

  function renderPage(keepScroll = false) {
    const page = $('#rvPage');
    const top = page.scrollTop;
    S.images = {};
    S.mmd = {};
    S.wide = page.clientWidth >= 940;
    const html = S.current ? phaseHtml(S.current) : overviewHtml();
    const doc = $('#rvDoc');
    doc.innerHTML = html;
    if (!keepScroll) {
      doc.classList.remove('page-in');
      void doc.offsetWidth;
      doc.classList.add('page-in');
      page.scrollTop = 0;
    } else page.scrollTop = top;
    $('#rvToc').innerHTML = tocHtml();
    $('#tocSheetBody').innerHTML = tocHtml();
    layoutNotes();
    // Sprung auf einen Stopp: Abschnitt der Phasen-Seite oben zeigen und kurz hervorheben.
    // Erst nach den Schaubildern springen, sonst verschiebt deren Höhe das Ziel.
    const jump = S.focus && !keepScroll ? document.getElementById(`stop-${S.focus}`) : null;
    if (jump) { jump.scrollIntoView({ block: 'start' }); jump.classList.add('flash'); }
    Promise.resolve(drawDiagrams(doc)).then(() => { if (jump) { layoutNotes(); jump.scrollIntoView({ block: 'start' }); } });
  }

  function layoutNotes() {
    $$('.codegrid.margin').forEach((g) => {
      const table = $('table', g);
      const aside = $('aside', g);
      let bottom = -Infinity;
      $$('.anno', aside).forEach((note) => {
        const row = $(`tr[data-ns~="${note.dataset.n}"]`, table);
        let top = row ? row.offsetTop : 0;
        if (top < bottom + 6) top = bottom + 6;
        note.style.top = `${top}px`;
        bottom = top + note.offsetHeight;
      });
      aside.style.minHeight = `${Math.max(bottom, 0)}px`;
    });
  }

  function mermaidReady() {
    if (!window.mermaid) return false;
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'base',
      fontFamily: v('--ui-font'),
      flowchart: { curve: 'basis', htmlLabels: true },
      themeVariables: {
        fontFamily: v('--ui-font'), fontSize: '13px', background: v('--ui-surface'),
        primaryColor: v('--ui-surface-2'), primaryTextColor: v('--ui-text'), primaryBorderColor: v('--ui-line-strong'),
        secondaryColor: v('--ui-surface-3'), tertiaryColor: v('--ui-surface'), lineColor: v('--ui-text-muted'), textColor: v('--ui-text'),
        mainBkg: v('--ui-surface-2'), nodeBorder: v('--ui-line-strong'), edgeLabelBackground: v('--ui-surface'), clusterBkg: v('--ui-surface'),
        actorBkg: v('--ui-surface-2'), actorBorder: v('--ui-line-strong'), actorTextColor: v('--ui-text'), actorLineColor: v('--ui-line-strong'),
        signalColor: v('--ui-text-muted'), signalTextColor: v('--ui-text'), labelBoxBkgColor: v('--ui-surface-2'), labelTextColor: v('--ui-text'),
        noteBkgColor: v('--ui-surface-3'), noteTextColor: v('--ui-text'), loopTextColor: v('--ui-text'),
        attributeBackgroundColorOdd: v('--ui-surface'), attributeBackgroundColorEven: v('--ui-surface-2'),
      },
    });
    return true;
  }

  async function drawDiagrams(root) {
    const els = $$('.mmd', root);
    if (!els.length) return;
    if (!mermaidReady()) {
      els.forEach((el) => { el.outerHTML = `<pre class="src-mmd">${esc(S.mmd[el.dataset.blk])}</pre>`; });
      return;
    }
    for (const el of els) {
      const code = S.mmd[el.dataset.blk];
      const id = `mmd${++S.seq}`;
      try {
        const { svg: out, bindFunctions } = await window.mermaid.render(id, code);
        if (!el.isConnected) return;
        el.innerHTML = out;
        bindFunctions?.(el);
      } catch (e) {
        document.getElementById(`d${id}`)?.remove();
        document.getElementById(id)?.remove();
        const msg = String(e?.message ?? e).split('\n').slice(0, 2).join(' ');
        if (el.isConnected) el.outerHTML = `<div class="diagram-err"><b>Schaubild lässt sich nicht zeichnen</b><span>${esc(msg)}</span><pre>${esc(code)}</pre><small>Die Station bekommt dieselbe Meldung als Hinweis und kann das Schaubild neu schreiben.</small></div>`;
      }
    }
  }

  function renderAll() {
    renderHead();
    renderBar();
    renderPage();
    updateCounts();
  }

  // ---------- Hervorheben: Zeile ↔ Notiz ↔ Markierung ----------
  function setHot(ns) {
    $$('.hot', $('#rvDoc')).forEach((el) => el.classList.remove('hot'));
    $$('.hot', $('#lightbox')).forEach((el) => el.classList.remove('hot'));
    for (const n of ns) {
      if (!n) continue;
      $$(`tr[data-ns~="${n}"], .anno[data-n="${n}"], .mark[data-n="${n}"]`).forEach((el) => el.classList.add('hot'));
    }
  }
  function hotFrom(target) {
    const row = target.closest('tr.in-note');
    if (row) return row.dataset.ns.trim().split(' ');
    const el = target.closest('.anno[data-n], .mark[data-n]');
    return el ? [el.dataset.n] : [];
  }
  document.addEventListener('mouseover', (e) => { if (!S.draw) setHot(hotFrom(e.target)); });
  document.addEventListener('focusin', (e) => setHot(hotFrom(e.target)));

  // ---------- Bereich auf einem Bild aufziehen ----------
  function startDraw(frame, caption) {
    const inner = $('.shot-inner', frame);
    frame.classList.add('draw');
    S.draw = frame;
    inner.onpointerdown = (e) => {
      e.preventDefault();
      const r = inner.getBoundingClientRect();
      const x0 = e.clientX - r.left;
      const y0 = e.clientY - r.top;
      const rb = document.createElement('div');
      rb.className = 'rubber';
      inner.append(rb);
      inner.setPointerCapture(e.pointerId);
      const box = (ev) => {
        const x1 = Math.min(Math.max(ev.clientX - r.left, 0), r.width);
        const y1 = Math.min(Math.max(ev.clientY - r.top, 0), r.height);
        return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
      };
      inner.onpointermove = (ev) => { const b = box(ev); Object.assign(rb.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` }); };
      inner.onpointerup = (ev) => {
        inner.onpointermove = null;
        inner.onpointerup = null;
        inner.onpointerdown = null;
        frame.classList.remove('draw');
        S.draw = null;
        let b = box(ev);
        if (b.w < 12 || b.h < 12) b = { x: Math.max(0, b.x - 40), y: Math.max(0, b.y - 20), w: 80, h: 40 };
        Object.assign(rb.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` });
        const rect = { x: (b.x / r.width) * 100, y: (b.y / r.height) * 100, w: (b.w / r.width) * 100, h: (b.h / r.height) * 100 };
        openComposer(rb, { t: 'area', img: frame.dataset.img, rect, caption, stop: frame.closest('.stop')?.dataset.stop });
      };
    };
  }

  // ---------- Lichtkasten ----------
  let lbImg = null;
  function renderLightbox() {
    const img = S.images[lbImg];
    $('#lbTitle').textContent = img.caption;
    $('#lbBody').innerHTML = shotHtml(img, lbImg) + (img.notes ? `<div class="legend">${img.notes.map(noteHtml).join('')}</div>` : '');
    $('#lbArea').dataset.img = lbImg;
    $('#lbArea').dataset.caption = img.caption;
    $('#lbArea').hidden = !!st().closed;
  }

  // ---------- Meldung mit Rückgängig ----------
  let toastTimer = null;
  function toast(text, opts = {}) {
    const box = $('#toast');
    clearTimeout(toastTimer);
    $('#toastText').textContent = text;
    const undo = $('#toastUndo');
    undo.hidden = !opts.undo;
    undo.onclick = () => { clearTimeout(toastTimer); box.hidden = true; opts.undo?.(); };
    box.hidden = false;
    toastTimer = setTimeout(() => { box.hidden = true; opts.done?.(); }, opts.ms ?? 3200);
  }

  // ---------- Klicks ----------
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'cline') {
      const table = b.closest('table');
      openComposer(b, { t: 'line', blk: table.dataset.blk, file: table.dataset.file, line: Number(b.dataset.line), stop: b.closest('.stop')?.dataset.stop });
    } else if (act === 'cstop') {
      openComposer(b, { t: 'stop', stop: b.closest('.stop').dataset.stop });
    } else if (act === 'cscreen') {
      const sec = b.closest('.screen');
      openComposer(b, { t: 'screen', screen: sec.dataset.screen, name: sec.dataset.name });
    } else if (act === 'sview') {
      S.sview[b.dataset.scr] = Number(b.dataset.i);
      renderPage(true);
    } else if (act === 'scmp') {
      S.scmp[b.dataset.scr] = b.checked;
      renderPage(true);
    } else if (act === 'cdiag') {
      openComposer(b, { t: 'diagram', blk: b.dataset.blk, caption: b.dataset.caption, stop: b.closest('.stop')?.dataset.stop });
    } else if (act === 'carea') {
      const frame = $(`.shot-frame[data-img="${b.dataset.img}"]`, b.closest('dialog') ?? $('#rvDoc'));
      startDraw(frame, b.dataset.caption);
    } else if (act === 'cdel') {
      S.comments = S.comments.filter((c) => c.id !== b.dataset.cid);
      renderPage(true);
      if ($('#lightbox').open) renderLightbox();
      updateCounts();
    } else if (act === 'zoom') {
      lbImg = b.dataset.img;
      renderLightbox();
      $('#lightbox').showModal();
    } else if (act === 'drun') {
      const rows = $$(`tr[data-run="${b.dataset.run}"]`);
      const show = rows[0]?.hidden;
      rows.forEach((r) => { r.hidden = !show; });
      b.textContent = `${rows.length} Zeilen vorher · ${show ? 'verbergen' : 'zeigen'}`;
      layoutNotes();
    } else if (act === 'src') {
      const blk = b.closest('.blk');
      const pre = $('.src-mmd', blk);
      if (pre) pre.remove();
      else $('.blk-body', blk).insertAdjacentHTML('beforeend', `<pre class="src-mmd">${esc(S.mmdRaw[b.dataset.blk])}</pre>`);
    } else if (act === 'dview') {
      S.dview[b.dataset.blk] = b.dataset.mode;
      renderPage(true);
    } else if (act === 'files') {
      toast(`Springt in den Reiter „Dateien“: ${b.dataset.file.split('/').pop()} offen, Zeile ${b.dataset.line} sichtbar.`);
    } else if (act === 'whole') {
      toast('Blendet die übrigen Zeilen der Datei ein, wie „Ganze Datei“ im Diff.');
    } else if (act === 'current') {
      toast('Zeigt denselben Ausschnitt im aktuellen Stand; Anmerkungen bleiben am alten Stand.');
    }
  });

  $('#cpopSave').addEventListener('click', saveComment);
  $('#cpopCancel').addEventListener('click', closeComposer);
  $('textarea', composer).addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveComment();
    if (e.key === 'Escape') closeComposer();
  });

  $('#btnAccept').addEventListener('click', () => {
    const n = S.comments.length;
    const before = S.state;
    S.state = 'abgenommen';
    S.comments = [];
    renderAll();
    toast(`Abgenommen: ${STATES[before].session} ${STATES[before].name} ist erledigt${n ? `, ${n} ${n === 1 ? 'Kommentar geht' : 'Kommentare gehen'} als Hinweis mit` : ''}.`, {
      ms: 8000,
      undo: () => { S.state = before; renderAll(); toast('Abnahme zurückgenommen.'); },
    });
  });
  $('#btnSend').addEventListener('click', () => {
    const n = S.comments.length;
    S.comments = [];
    renderPage(true);
    updateCounts();
    toast(`${n} ${n === 1 ? 'Kommentar' : 'Kommentare'} an ${st().session} ${st().name} gesendet. Die Station arbeitet sie ein.`);
  });
  $('#btnToc').addEventListener('click', () => $('#tocSheet').showModal());
  $('#tocSheet').addEventListener('click', (e) => { if (e.target.closest('a')) $('#tocSheet').close(); });

  $$('.vw-tab').forEach((t) => t.addEventListener('click', () => { S.view = t.dataset.view; renderHead(); if (S.view === 'review') renderPage(true); }));

  // ---------- Blättern ----------
  function step(d) {
    const order = pageOrder();
    const next = order[order.indexOf(S.current) + d];
    if (next === undefined) return;
    location.hash = hrefOf(next);
  }
  document.addEventListener('keydown', (e) => {
    if (S.view !== 'review' || e.target.closest('input, textarea, select') || document.querySelector('dialog[open]') || composer.matches(':popover-open')) return;
    if (e.key === 'ArrowRight' || e.key === 'j') step(1);
    if (e.key === 'ArrowLeft' || e.key === 'k') step(-1);
  });

  window.goStop = (id) => {
    if (!visibleStops().includes(id)) { toast('Diese Phase hat noch nicht begonnen; ihre Stopps entstehen, sobald ihre Station Code schreibt.'); return; }
    location.hash = `#/s/${id}`;
  };

  function route() {
    const m = location.hash.match(/^#\/(s|p)\/([\w-]+)/);
    const stop = m && m[1] === 's' && visibleStops().includes(m[2]) ? m[2] : null;
    const id = stop ? `p${chapterOf(stop).key}` : m ? `p${m[2]}` : null;
    S.current = pageOrder().includes(id) ? id : null;
    S.focus = stop;
    if (S.view !== 'review') { S.view = 'review'; renderHead(); }
    renderPage();
  }
  addEventListener('hashchange', route);

  // ---------- Entwurfsleiste ----------
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    if (S.view === 'review') renderPage(true);
  }
  $('#theme').addEventListener('change', (e) => setTheme(e.target.value));
  $('#variant').addEventListener('change', (e) => { S.variant = e.target.value; renderPage(true); });
  $('#zustand').addEventListener('change', (e) => {
    S.state = e.target.value;
    if (S.current && !pageOrder().includes(S.current)) location.hash = '#/ueberblick';
    renderAll();
  });
  $('#tools').addEventListener('change', (e) => document.body.classList.toggle('tools', e.target.checked));

  new ResizeObserver(() => {
    const wide = $('#rvPage').clientWidth >= 940;
    if (wide !== S.wide && S.view === 'review') renderPage(true);
    else layoutNotes();
  }).observe($('#rvPage'));

  // ---------- Start (Zustand per Adresse) ----------
  const theme = q.get('thema') === 'hell' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  $(`#theme input[value="${theme}"]`).checked = true;
  $(`#variant input[value="${S.variant}"]`).checked = true;
  $('#zustand').value = S.state;
  if (q.get('werkzeuge') === '1') { $('#tools').checked = true; document.body.classList.add('tools'); }
  if (q.get('demo') === 'kommentare') {
    S.comments.push({ id: 'c900', t: 'line', blk: 's2-grenze-b1', file: 'src-tauri/src/session_files/access.rs', line: 34, stop: 's2-grenze', text: 'Reicht „genannt“ auch für Pfade auf Netzlaufwerken? Bitte begründen.' });
    S.comments.push({ id: 'c901', t: 'area', img: 's5-sperre-b0-i', rect: { x: 74, y: 12, w: 25, h: 6 }, caption: 'Prüfseite Phase 5, dunkel', stop: 's5-sperre', text: 'Hinweis rechtsbündig unter den Knopf statt in die Metazeile?' });
  }
  route();
  renderHead();
  renderBar();
  updateCounts();
  addEventListener('load', () => {
    if (q.get('blatt') === 'inhalt') $('#tocSheet').showModal();
    if (q.get('blatt') === 'liste') $('#ccount').click();
    if (q.get('blatt') === 'bild') { const z = $('[data-act="zoom"]'); if (z) z.click(); }
    if (q.get('blatt') === 'kommentar') { const p = $('.lnplus'); if (p) p.click(); }
    renderPage(true);
    if (q.get('blatt') === 'md') { $$('.md-pair details').forEach((d) => { d.open = true; }); const m = $('.md-pair'); if (m) $('#rvPage').scrollTop = m.offsetTop; }
    if (q.get('scroll')) setTimeout(() => { $('#rvPage').style.scrollBehavior = 'auto'; $('#rvPage').scrollTop = Number(q.get('scroll')); }, 300);
  });
})();
