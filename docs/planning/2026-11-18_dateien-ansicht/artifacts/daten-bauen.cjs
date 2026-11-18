// Baut die Datendatei des Entwurfs „Repository-Ansicht“ aus dem Verwalter-Repository (nur lesend).
// Aufruf: node daten-bauen.cjs <Repository> <Schnappschuss-Ordner> <Zieldatei>
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const [REPO, SNAP, OUT] = process.argv.slice(2);
const BASE = '9c66133';
const HEAD = '39c72e6';
const MAX_TEXT = 60000;
const MAX_DIFF_LINES = 2500;

const git = (...args) =>
  execFileSync('git', ['-C', REPO, '-c', 'core.quotepath=false', ...args], {
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  });

const BINARY = new Set(['png', 'jpg', 'jpeg', 'gif', 'ico', 'icns', 'pdf', 'zip', 'woff', 'woff2', 'wav', 'mp3', 'webp', 'exe', 'bin']);
const IMAGE = new Set(['png', 'jpg', 'jpeg', 'gif', 'ico', 'webp', 'svg']);
const ext = (p) => (p.includes('.') ? p.slice(p.lastIndexOf('.') + 1).toLowerCase() : '');

function nameStatus(text) {
  const map = {};
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const [status, file] = line.split('\t');
    map[file] = [status[0], 0, 0];
  }
  return map;
}
function addNumstat(map, text) {
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const [add, del, file] = line.split('\t');
    if (map[file]) {
      map[file][1] = add === '-' ? 0 : Number(add);
      map[file][2] = del === '-' ? 0 : Number(del);
    }
  }
  return map;
}
function splitDiff(text) {
  const out = {};
  const parts = text.split(/^diff --git /m).slice(1);
  for (const part of parts) {
    const head = part.slice(0, part.indexOf('\n'));
    const match = /^a\/(.*) b\/(.*)$/.exec(head);
    if (!match) continue;
    const file = match[2];
    const at = part.indexOf('\n@@');
    if (at < 0) continue; // Binärdatei oder nur Modus
    let lines = part.slice(at + 1).replace(/\n$/, '').split('\n');
    let cut = false;
    if (lines.length > MAX_DIFF_LINES) {
      lines = lines.slice(0, MAX_DIFF_LINES);
      cut = true;
    }
    out[file] = (cut ? '!CUT\n' : '') + lines.join('\n');
  }
  return out;
}

// Baum
const files = [];
for (const line of git('ls-tree', '-r', '-l', HEAD).split('\n')) {
  if (!line.trim()) continue;
  const [meta, file] = line.split('\t');
  const size = Number(meta.trim().split(/\s+/)[3]);
  files.push([file, size]);
}

// Änderungen des Vorhabens
const changes = addNumstat(
  nameStatus(git('diff', '--no-renames', '--name-status', BASE, HEAD)),
  git('diff', '--no-renames', '--numstat', BASE, HEAD),
);
const diffs = splitDiff(git('diff', '--no-renames', '-U3', BASE, HEAD));

// Commits
const commits = [];
const commitDiffs = {};
for (const line of git('log', '--reverse', '--no-merges', '--format=%H%x09%h%x09%ct%x09%s', `${BASE}..${HEAD}`).split('\n')) {
  if (!line.trim()) continue;
  const [id, short, time, subject] = line.split('\t');
  const filesOf = addNumstat(
    nameStatus(git('show', '--no-renames', '--format=', '--name-status', id)),
    git('show', '--no-renames', '--format=', '--numstat', id),
  );
  commits.push({ id: short, zeit: Number(time), betreff: subject, dateien: filesOf });
  commitDiffs[short] = splitDiff(git('show', '--no-renames', '--format=', '-U3', id));
}

// Branch-Verlauf (für die Git-Werkzeuge)
const own = new Set(commits.map((c) => c.id));
const branchLog = git('log', '-30', '--format=%h%x09%ct%x09%s', HEAD)
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => {
    const [short, time, subject] = l.split('\t');
    return { id: short, zeit: Number(time), betreff: subject, eigen: own.has(short) };
  });

// Inhalte
const inhalt = {};
const bilder = {};
let textBytes = 0;
let imageBytes = 0;
const skipped = { gross: 0, archiv: 0, binaer: 0 };
for (const [file, size] of files) {
  const e = ext(file);
  const changed = Boolean(changes[file]);
  const abs = path.join(SNAP, file);
  if (IMAGE.has(e) && e !== 'svg') {
    if (size <= 40000 && imageBytes < 350000 && (file.startsWith('src-tauri/icons/') || changed)) {
      const mime = e === 'jpg' ? 'jpeg' : e === 'ico' ? 'x-icon' : e;
      bilder[file] = `data:image/${mime};base64,${fs.readFileSync(abs).toString('base64')}`;
      imageBytes += size;
    }
    continue;
  }
  if (BINARY.has(e)) {
    skipped.binaer++;
    continue;
  }
  if (!changed && (file.startsWith('docs/archive/') || file.startsWith('docs/design/'))) {
    skipped.archiv++;
    continue;
  }
  if (size > MAX_TEXT || file.endsWith('.lock') || file === 'pnpm-lock.yaml') {
    skipped.gross++;
    continue;
  }
  const buffer = fs.readFileSync(abs);
  if (buffer.subarray(0, 8000).includes(0)) {
    skipped.binaer++;
    continue;
  }
  inhalt[file] = buffer.toString('utf8').replace(/\r\n/g, '\n');
  textBytes += size;
}

// Von Git ignorierte Einträge des Arbeitsordners (nur Namen), ohne eigene Repositories und Arbeitsbäume
const ignoriert = git('status', '--ignored', '--porcelain=v1')
  .split(/\r?\n/)
  .filter((l) => l.startsWith('!! '))
  .map((l) => l.slice(3).trim())
  .filter((e) => !fs.existsSync(path.join(REPO, e.replace(/\/$/, ''), '.git')))
  .sort((x, y) => x.localeCompare(y));

const data = {
  ignoriert,
  basis: BASE,
  kopf: HEAD,
  dateien: files,
  aenderungen: changes,
  commits,
  branchLog,
  diffs,
  commitDiffs,
  inhalt,
  bilder,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `window.DATEN = ${JSON.stringify(data)};\n`);

const total = Object.values(changes).reduce((s, c) => [s[0] + c[1], s[1] + c[2]], [0, 0]);
console.log(
  JSON.stringify({
    dateien: files.length,
    geaendert: Object.keys(changes).length,
    plus: total[0],
    minus: total[1],
    commits: commits.map((c) => `${c.id} ${Object.keys(c.dateien).length}`),
    diffs: Object.keys(diffs).length,
    inhalte: Object.keys(inhalt).length,
    textBytes,
    bilder: Object.keys(bilder).length,
    imageBytes,
    skipped,
    outBytes: fs.statSync(OUT).size,
  }),
);
