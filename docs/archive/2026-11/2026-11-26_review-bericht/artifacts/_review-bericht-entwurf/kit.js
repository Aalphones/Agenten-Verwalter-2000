// UI-Baukasten kit.js · Version 1.2.0
// Helfer des allgemeinen UI-Baukastens, ohne Abhängigkeit; Einbinden mit <script src="kit.js" defer>.
// Ohne Skript bleiben alle Bauteile sichtbar und lesbar (alle Reiter-Inhalte stehen untereinander).
// Teile: Galerie-Schalter · Checkbox-Zwischenzustand · Zahl mit +/− · Wert des Schiebereglers · Reiter ·
// Aufklapp-Knöpfe · Tabellen-Auswahl mit Massenleiste · ui.toast · ui.tip · Dialog-Öffner.
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const on = (type, sel, fn) => document.addEventListener(type, (e) => {
    const el = e.target.closest?.(sel);
    if (el) fn(el, e);
  });

  // Galerie-Schalter: Thema, Dichte, Rahmenbreite; Startwerte auch per Adresse (?theme=dark&density=touch&frame=390)
  function gallery() {
    const bar = $('.g-bar');
    if (!bar) return;
    const root = document.documentElement;
    const apply = {
      theme: (v) => (v === 'system' ? root.removeAttribute('data-theme') : root.setAttribute('data-theme', v)),
      density: (v) => (v === 'standard' ? root.removeAttribute('data-density') : root.setAttribute('data-density', v)),
      frame: (v) => { const f = $('#frame'); if (f) f.style.maxWidth = v === 'voll' ? '' : v + 'px'; },
    };
    const params = new URLSearchParams(location.search);
    for (const name of Object.keys(apply)) {
      const wanted = $(`input[name="${name}"][value="${params.get(name)}"]`, bar);
      if (wanted) wanted.checked = true;
      const current = $(`input[name="${name}"]:checked`, bar);
      if (current) apply[name](current.value);
    }
    bar.addEventListener('change', (e) => apply[e.target.name]?.(e.target.value));
  }

  // Zahl mit +/−: .stepper > button[data-step] ändert das Zahlenfeld daneben
  on('click', '.stepper > button[data-step]', (btn) => {
    const input = $('input[type="number"]', btn.parentElement);
    Number(btn.dataset.step) > 0 ? input.stepUp() : input.stepDown();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // Schieberegler: output[for] zeigt den Wert, Einheit aus data-unit
  on('input', 'input[type="range"]', (range) => {
    const out = $(`output[for="${range.id}"]`);
    if (out) out.value = range.value + (range.dataset.unit || '');
  });

  // Reiter nach WAI-ARIA-Muster: Pfeil links/rechts, Pos1/Ende, nur der gewählte Reiter ist Tab-Stopp
  function tabs(list) {
    const all = $$('[role="tab"]', list);
    const select = (tab, focus) => {
      for (const t of all) {
        const chosen = t === tab;
        t.setAttribute('aria-selected', chosen);
        t.tabIndex = chosen ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !chosen;
      }
      if (focus) tab.focus();
    };
    select(all.find((t) => t.getAttribute('aria-selected') === 'true') || all[0]);
    list.addEventListener('click', (e) => { const t = e.target.closest('[role="tab"]'); if (t) select(t); });
    list.addEventListener('keydown', (e) => {
      const i = all.indexOf(document.activeElement), n = all.length;
      const next = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
      if (i < 0 || next === undefined) return;
      e.preventDefault();
      select(all[next], true);
    });
  }

  // Aufklapp-Knopf: button[aria-expanded][aria-controls] schaltet hidden am Ziel (z. B. tr.more)
  on('click', 'button[aria-expanded][aria-controls]:not([popovertarget])', (btn) => {
    const target = document.getElementById(btn.getAttribute('aria-controls'));
    if (!target) return;
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', open);
    target.hidden = !open;
  });

  // Tabellen-Auswahl: Kopf-Checkbox mit Zwischenzustand; .bulk vor dem Tabellen-Container zeigt die Anzahl
  const rowBoxes = (table) => $$('tbody > tr > td:first-child > input[type="checkbox"]', table);
  const bulkOf = (table) => {
    const prev = (table.closest('.scroll') || table).previousElementSibling;
    return prev?.matches('.bulk') ? prev : null;
  };
  function updateSelection(table) {
    const boxes = rowBoxes(table), n = boxes.filter((b) => b.checked).length;
    const head = $('thead input[type="checkbox"]', table);
    if (head) { head.checked = n > 0 && n === boxes.length; head.indeterminate = n > 0 && n < boxes.length; }
    const bulk = bulkOf(table), out = bulk && $('output', bulk);
    if (out) out.value = n === 1 ? '1 ausgewählt' : `${n} ausgewählt`;
  }
  on('change', 'table input[type="checkbox"]', (box) => {
    const table = box.closest('table');
    if (box.closest('thead')) for (const b of rowBoxes(table)) b.checked = box.checked;
    updateSelection(table);
  });
  on('click', '.bulk [data-clear]', (btn) => {
    const bulk = btn.closest('.bulk');
    const table = $('table', bulk.nextElementSibling) || bulk.nextElementSibling;
    for (const b of rowBoxes(table)) b.checked = false;
    updateSelection(table);
    $('thead input[type="checkbox"]', table)?.focus();
  });

  // Meldung mit Rückgängig: ui.toast(text, { undo }) — verschwindet nach 6 s, nicht solange Zeiger oder Fokus darauf liegt
  let toastEl, timer;
  function toast(text, { undo, undoLabel = 'Rückgängig' } = {}) {
    if (!toastEl) {
      toastEl = Object.assign(document.createElement('div'), { className: 'toast', popover: 'manual' });
      toastEl.innerHTML = '<output role="status"></output><button type="button" class="quiet"></button>';
      document.body.append(toastEl);
      const stop = () => clearTimeout(timer);
      for (const t of ['pointerenter', 'focusin']) toastEl.addEventListener(t, stop);
      for (const t of ['pointerleave', 'focusout']) toastEl.addEventListener(t, (e) => { if (!toastEl.contains(e.relatedTarget)) arm(); });
    }
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => toastEl.hidePopover(), 6000); };
    const [out, btn] = toastEl.children;
    btn.hidden = !undo;
    btn.textContent = undoLabel;
    btn.onclick = () => { clearTimeout(timer); toastEl.hidePopover(); undo?.(); };
    if (!toastEl.matches(':popover-open')) toastEl.showPopover();
    out.value = '';
    requestAnimationFrame(() => { out.value = text; });
    arm();
  }
  // Deklarativ: button[data-toast="Text"] (optional data-undo="Text nach Rückgängig")
  on('click', '[data-toast]', (btn) => toast(btn.dataset.toast, btn.dataset.undo ? { undo: () => toast(btn.dataset.undo) } : {}));

  // Info-Tipp: ui.tip(button, text) zeigt ein gemeinsames [popover].tip über dem Auslöser (darunter, wenn oben kein Platz ist),
  // per Skript platziert statt per Anchor-Positioning. Deklarativ: button.tip[data-tip="Text"]
  let tipEl;
  function tip(btn, text = btn.dataset.tip) {
    if (!tipEl) {
      tipEl = Object.assign(document.createElement('div'), { className: 'tip', popover: 'auto' });
      document.body.append(tipEl);
    }
    if (tipEl.matches(':popover-open')) tipEl.hidePopover();
    tipEl.textContent = text;
    Object.assign(tipEl.style, { inset: 'auto', margin: '0', positionArea: 'none' });
    tipEl.showPopover();
    const r = btn.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    tipEl.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left - 8)) + 'px';
    tipEl.style.top = (r.top - h - 6 > 8 ? r.top - h - 6 : r.bottom + 6) + 'px';
  }
  on('click', 'button.tip[data-tip]', (btn) => tip(btn));

  // Dialog-Öffner: [data-open="<id>"] öffnet den Dialog modal; beim Schließen geht der Fokus zum Auslöser zurück
  on('click', '[data-open]', (btn) => {
    const dialog = document.getElementById(btn.dataset.open);
    if (!dialog?.showModal || dialog.open) return;
    dialog.showModal();
    dialog.addEventListener('close', () => btn.isConnected && btn.focus(), { once: true });
  });
  // Klick auf den abgedunkelten Hintergrund schließt (der Dialog selbst hat keinen Innenabstand)
  on('click', 'dialog[open]', (dialog, e) => { if (e.target === dialog) dialog.close(); });

  function init() {
    gallery();
    for (const box of $$('input[type="checkbox"][data-indeterminate]')) box.indeterminate = true;
    for (const list of $$('[role="tablist"]')) tabs(list);
    for (const table of $$('table:has(thead input[type="checkbox"])')) updateSelection(table);
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
  window.ui = Object.assign(window.ui || {}, { toast, tip });
})();
