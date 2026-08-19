#!/usr/bin/env node
/* SKELAR · приймання згенерованого дека.
   node audit.js <deck.html> [--out каталог]

   Робить чотири речі, які інакше залежать від того, чи здогадався я подивитись:
   1. проганяє check.js і збирає FAIL;
   2. визначає тип кожного слайда за класами;
   3. порівнює геометрію з еталонним слайдом того ж типу — таблиця відхилень у px;
   4. звіряє кожен вбудований data: URI з файлами content/ за хешем.
   Плюс рендерить кожен слайд у PNG, щоб дефекти, які видно лише оком, було де
   побачити: сьогодні знак у знаку й зниклий заголовок числами не ловились.        */

const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execFileSync } = require('child_process');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT = __dirname;
const args = process.argv.slice(2);
const target = args[0];
const outDir = (args.includes('--out') ? args[args.indexOf('--out') + 1] : null)
  || path.join(require('os').tmpdir(), 'skelar-audit');

if (!target) { console.error('використання: node audit.js <deck.html> [--out каталог]'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

/* ── зонд: усе, що можна виміряти зі сторінки, збирається одним проходом ──── */
const PROBE = `
<script data-skelar-check>
window.__probe = () => {
  // еталон лежить під .stage{zoom:0.62} для перегляду — без скидання зуму всі
  // координати приїжджають помножені на 0.62, і діф показує рівне зміщення 38px
  // на кожному слайді. Саме так виглядав перший запуск.
  const st = document.querySelector('.stage'); if (st) st.style.zoom = 1;
  const px = v => Math.round(v);
  const out = [];
  document.querySelectorAll('.slide').forEach((s, i) => {
    s.scrollIntoView({block:'start'});
    const S = s.getBoundingClientRect();
    const rel = e => { if (!e) return null; const b = e.getBoundingClientRect();
      return { x: px(b.left - S.left), y: px(b.top - S.top), w: px(b.width), h: px(b.height) }; };
    const cls = new Set();
    s.querySelectorAll('[class]').forEach(e => String(e.className).split(/\\s+/).forEach(c => c && cls.add(c)));
    const h1 = s.querySelector('.h1, .st');
    const logo = s.querySelector('.logo, .wordmark');
    const cards = [...s.querySelectorAll('.card, .kpi, .nb-i')].map(rel);
    const band = s.querySelector('.band, .cols, .rails, .subs, .tl, .right, .bul');
    out.push({
      i: i + 1,
      classes: [...cls].sort(),
      h1: h1 ? { ...rel(h1), size: px(parseFloat(getComputedStyle(h1).fontSize)) } : null,
      logo: rel(logo),
      band: band ? { ...rel(band), cls: String(band.className) } : null,
      cards: cards.slice(0, 6),
      bg: getComputedStyle(s).backgroundColor,
      texts: [...s.querySelectorAll('div,span,p,b,h1')].filter(e => !e.children.length && e.textContent.trim())
        .slice(0, 40).map(e => px(parseFloat(getComputedStyle(e).fontSize))).sort((a, b) => b - a),
    });
  });
  return out;
};
</script>`;

function run(html, extra, waitMs = 4000) {
  const tmp = path.join(outDir, '_run.html');
  fs.writeFileSync(tmp, fs.readFileSync(html, 'utf8') + PROBE + extra);
  const dom = execFileSync(CHROME, ['--headless', '--disable-gpu', '--no-sandbox',
    '--allow-file-access-from-files', '--window-size=1920,1080',
    '--virtual-time-budget=' + (waitMs + 4000), '--dump-dom', 'file://' + tmp],
    { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
  const m = dom.match(/@@([\s\S]*?)@@/);
  return m ? m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&') : '';
}

const collect = (html, waitMs) => JSON.parse(run(html,
  `<script data-skelar-check>setTimeout(()=>{document.title='@@'+JSON.stringify(window.__probe())+'@@'},${waitMs})</script>`, waitMs));

const checkOf = (html, waitMs) => run(html,
  `<script data-skelar-check>setTimeout(()=>{const L=[],C=console.log;console.log=(...a)=>L.push(a.join(' '));`
  + fs.readFileSync(path.join(ROOT, 'check.js'), 'utf8')
  + `console.log=C;document.title='@@'+L.join(String.fromCharCode(10))+'@@'},${waitMs})</script>`, waitMs);

/* ── тип слайда за класами ────────────────────────────────────────────────── */
const TYPES = [
  ['Half screen Bullits', c => c.has('bul')],
  ['Column Red Line',     c => c.has('rails')],
  ['Column Text',         c => c.has('subs')],
  ['Column Red Circle',   c => c.has('circ')],
  ['Bento Right',         c => c.has('right')],
  ['Bento Bottom Number', c => c.has('band') && c.has('num')],
  ['Bento Bottom',        c => c.has('band')],
  ['Agenda',              c => c.has('tl')],
  ['Title',               c => c.has('tt') || c.has('st')],
  ['Дані · таблиця',      c => c.has('panel')],
  ['Дані · KPI',          c => c.has('kpi')],
  ['Дані · рейтинг',      c => c.has('col-h')],
];
const typeOf = classes => {
  const c = new Set(classes);
  for (const [name, test] of TYPES) if (test(c)) return name;
  return '—';
};

/* ── 1 · числа ────────────────────────────────────────────────────────────── */
console.log('══ 1 · check.js ' + '─'.repeat(48));
const chk = checkOf(target, 3500);
const pass = (chk.match(/PASS/g) || []).length, fail = Math.max(0, (chk.match(/FAIL/g) || []).length - 1);
console.log(`PASS ${pass} · FAIL ${fail}`);
chk.split('\n').filter(l => /FAIL/.test(l) && /  /.test(l)).forEach(l => console.log('   ' + l.trim()));

/* ── 2 · типи й геометрія проти еталона ───────────────────────────────────── */
console.log('\n══ 2 · типи й відхилення від еталона ' + '─'.repeat(28));
const deck = collect(target, 3500);
const ref = [].concat(
  collect(path.join(ROOT, 'reference-basic.html'), 2500),
  collect(path.join(ROOT, 'reference.html'), 2500));
// Еталонів одного типу може бути кілька (перебивка темна, червона, з фото).
// Беремо той, у якого збігається фон — інакше червона перебивка щоразу дає
// хибну тривогу «ФОН не той», хоча вона законна.
const refBy = {};
ref.forEach(r => { const t = typeOf(r.classes); (refBy[t] = refBy[t] || []).push(r); });
const pickRef = s => { const list = refBy[typeOf(s.classes)]; if (!list) return null;
  return list.find(r => r.bg === s.bg) || list[0]; };

const d = (a, b) => (a == null || b == null) ? '—' : (a - b === 0 ? '0' : (a - b > 0 ? '+' : '') + (a - b));
deck.forEach(s => {
  const t = typeOf(s.classes), r = pickRef(s);
  const head = `слайд ${String(s.i).padStart(2)} · ${t}`;
  if (!r) { console.log(`${head}  — еталона такого типу немає`); return; }
  const parts = [];
  if (s.h1 && r.h1) {
    parts.push(`заголовок ${s.h1.size}px (${d(s.h1.size, r.h1.size)})`);
    parts.push(`x${s.h1.x}/y${s.h1.y} (${d(s.h1.x, r.h1.x)}/${d(s.h1.y, r.h1.y)})`);
  }
  if (s.logo && r.logo) parts.push(`знак ${s.logo.w}×${s.logo.h} на ${s.logo.x},${s.logo.y} (${d(s.logo.x, r.logo.x)}/${d(s.logo.y, r.logo.y)})`);
  if (s.band && r.band) parts.push(`смуга y${s.band.y}..${s.band.y + s.band.h} (${d(s.band.y, r.band.y)}/${d(s.band.y + s.band.h, r.band.y + r.band.h)})`);
  if (s.bg !== r.bg) parts.push(`ФОН ${s.bg} замість ${r.bg}`);
  console.log(`${head}  ${parts.join(' · ')}`);
});

/* ── 3 · асети за хешем ───────────────────────────────────────────────────── */
console.log('\n══ 3 · асети ' + '─'.repeat(52));
// Крім хешу тримаємо розміри в пікселях: інструмент перекодовує картинки при
// вбудовуванні, байти не збігаються, а зображення те саме. Порівняння лише за
// хешем давало «невідомий файл» там, де все гаразд.
const known = {}, byDim = {};
const dims = buf => {                       // PNG IHDR: ширина й висота
  if (buf.slice(1, 4).toString() === 'PNG') return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  for (let i = 2; i < buf.length - 9; i++)  // JPEG SOFn
    if (buf[i] === 0xFF && [0xC0,0xC1,0xC2].includes(buf[i+1])) return [buf.readUInt16BE(i+7), buf.readUInt16BE(i+5)];
  return null; };
const walk = dir => fs.readdirSync(dir).forEach(n => {
  const p = path.join(dir, n);
  if (fs.statSync(p).isDirectory()) return walk(p);
  if (!/\.(png|jpe?g)$/i.test(n)) return;
  const buf = fs.readFileSync(p), rel = path.relative(ROOT, p);
  known[crypto.createHash('sha256').update(buf).digest('hex')] = rel;
  const d = dims(buf); if (d) byDim[d.join('x')] = rel;
});
walk(path.join(ROOT, 'content'));
let src = fs.readFileSync(target, 'utf8');
if (src.includes('__bundler')) {
  // Дек-бандл: у сирому файлі слайдів немає — їх збирає скрипт при
  // завантаженні. Асети й витяг слайдів беруться з відрендереного DOM;
  // скрипти зрізаються, щоб витягнутий слайд не запускав збирання вдруге
  // (саме воно давало «Error unpacking» замість PNG).
  src = execFileSync(CHROME, ['--headless', '--disable-gpu', '--no-sandbox',
    '--allow-file-access-from-files', '--window-size=1920,1080',
    '--virtual-time-budget=8000', '--dump-dom', 'file://' + path.resolve(target)],
    { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
    .replace(/<script[\s\S]*?<\/script>/g, '');
}
const uris = [...new Set([...src.matchAll(/data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)/g)].map(m => m[1]))];
if (!uris.length) console.log('вбудованих картинок немає');
uris.forEach(b64 => {
  const buf = Buffer.from(b64, 'base64');
  const h = crypto.createHash('sha256').update(buf).digest('hex');
  const d = dims(buf), key = d && d.join('x');
  if (known[h]) console.log(`  ✓ ${known[h]} (${(buf.length / 1024).toFixed(1)} КБ)`);
  else if (key && byDim[key]) console.log(`  ~ ${byDim[key]} — той самий розмір ${key}, інше кодування (${(buf.length / 1024).toFixed(1)} КБ)`);
  else console.log(`  ✗ невідомий файл ${key || '?'}, ${(buf.length / 1024).toFixed(1)} КБ — перемальовано або взято не з репо`);
});

/* ── 4 · рендер кожного слайда ────────────────────────────────────────────── */
console.log('\n══ 4 · рендер ' + '─'.repeat(51));
const seenSec = new Set();
const secs = src.split(/(?=<section )/).filter(x => x.trim().startsWith('<section'))
  // Бандл тримає кожен слайд двічі: дисплейна копія і авторська DC-секція
  // з data-dc-tpl. Авторська не рендериться — 32 PNG замість 16 подвоюють
  // перегляд очима без користі; дисплейна і є деком.
  .filter(x => !/^<section[^>]*data-dc-tpl/.test(x.trim()))
  .filter(x => { const k = x.trim(); if (seenSec.has(k)) return false; seenSec.add(k); return true; });
// Голова — усе до першого слайда. Раніше межа шукалась по <body>, а у файлі
// без цього тега indexOf давав -1, голова виходила порожня, і кожен PNG був
// нестилізованим текстом. Дивитись на такий рендер було гірше, ніж не дивитись:
// він виглядав як зламана верстка й відводив пошук убік.
const head = src.slice(0, secs.length ? src.indexOf(secs[0]) : src.length);
secs.forEach((sec, n) => {
  const one = path.join(outDir, `slide-${String(n + 1).padStart(2, '0')}.html`);
  fs.writeFileSync(one, head + '\n<style>.stage{zoom:1}.slide{margin:0}</style>\n<div class="stage">'
    + sec.replace(/<\/div>\s*<\/body>[\s\S]*$/, '').replace(/<\/div>\s*$/, '') + '</div>');
  execFileSync(CHROME, ['--headless', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files',
    '--hide-scrollbars', '--window-size=1920,1080', '--virtual-time-budget=5000',
    '--screenshot=' + path.join(outDir, `slide-${String(n + 1).padStart(2, '0')}.png`), 'file://' + one],
    { stdio: 'ignore' });
});
console.log(`${secs.length} PNG у ${outDir}`);
console.log('\nдивитись очима обов\'язково: знак у знаку, зниклий заголовок і поплавлений');
console.log('логотип числами не ловляться — усі три сьогодні знайшла людина, не перевірка.');
