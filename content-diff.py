#!/usr/bin/env python3
# SKELAR · облік змісту: що було в ТЗ і що доїхало в дек.
#   python3 content-diff.py <ТЗ: .pptx|.txt|.md> <дек: .html|.pdf>
#
# Це та перевірка, якої не існувало. check.js міряє ОДИН відрендерений слайд:
# переповнення, кеглі, геометрію. Але коли генератор не влазить у картку й
# просто не кладе решту в HTML, зламаного слайда немає — є акуратний слайд,
# у якому бракує третини думки. Око цього не бачить: обрізаний текст
# закінчується на цілому слові й читається як закінчений.
#
# Тому міряється не слайд, а ДВА файли одне проти одного: кожен змістовий
# елемент ТЗ шукається в тексті дека. Порівняння за нормалізованим рядком без
# пробілів і пунктуації — щоб перенос, NBSP, зміна тире чи лапок не давали
# хибної тривоги, а зникла половина речення давала.
#
# ВІДОМА МЕЖА: пошук ведеться по тексту ВСЬОГО дека, не по слайду. Якщо хвіст
# речення випав із своєї картки, але ті самі слова стоять на іншому слайді,
# облік порахує це переформулюванням. Саме так «переможців всеукраїнських
# олімпіад, МАН» пройшло як цілісне: «олімпіад, МАН» знайшлось на слайді
# «Цільові групи». Прив'язка до слайда — у беклозі.

import re, sys, zipfile, zlib, unicodedata

def norm(s):
    s = unicodedata.normalize('NFKD', s.lower().replace('ʼ', "'"))
    return re.sub(r"[^0-9a-zа-яіїєґ]", '', s)

# ── ТЗ ───────────────────────────────────────────────────────────────────────
def brief_items(path):
    """Повертає [(джерело, елемент)]. Елемент — речення або пункт списку."""
    if path.endswith('.pptx'):
        z = zipfile.ZipFile(path)
        names = sorted((n for n in z.namelist() if re.match(r'ppt/slides/slide\d+\.xml$', n)),
                       key=lambda n: int(re.search(r'(\d+)', n.split('/')[-1]).group(1)))
        out = []
        for n in names:
            i = int(re.search(r'(\d+)', n.split('/')[-1]).group(1))
            x = z.read(n).decode('utf-8', 'replace')
            # <a:p> — абзац; саме він, а не <a:t>, є змістовою одиницею:
            # усередині абзацу текст порізаний на десятки run-ів по форматуванню,
            # і рахувати run-и означало б рахувати випадковості верстки в PowerPoint.
            for para in re.findall(r'<a:p>(.*?)</a:p>', x, re.S):
                t = ''.join(re.findall(r'<a:t>(.*?)</a:t>', para, re.S))
                t = t.replace('&quot;', '"').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
                t = re.sub(r'\s+', ' ', t).strip()
                if len(norm(t)) >= 12: out.append((f'слайд {i}', t))
        return out
    txt = open(path, encoding='utf-8').read()
    out = []
    for line in txt.split('\n'):
        for part in re.split(r'(?<=[.;])\s+', line):
            part = re.sub(r'\s+', ' ', part).strip(' -•·')
            if len(norm(part)) >= 12: out.append(('ТЗ', part))
    return out

# ── дек ──────────────────────────────────────────────────────────────────────
def deck_text(path):
    if path.endswith('.html'):
        h = open(path, encoding='utf-8').read()
        h = re.sub(r'<(script|style)\b.*?</\1>', ' ', h, flags=re.S)
        return re.sub(r'<[^>]+>', ' ', h)
    raw = open(path, 'rb').read()
    streams = []
    for m in re.finditer(rb'stream\r?\n(.*?)\r?\nendstream', raw, re.S):
        s = m.group(1)
        try: streams.append(zlib.decompress(s))
        except Exception: streams.append(s)
    # Текст у PDF лежить кодами шрифту, а не символами: без ToUnicode-мапи
    # «SKELAR» читається як «гKELAR». Мапи беруться в порядку появи й
    # прикладаються до шрифтів /F4, /F5… — порядок перевіряється на першому
    # рядку: якщо він не читається, мапи міняються місцями.
    maps = []
    for s in streams:
        if b'beginbfchar' in s or b'beginbfrange' in s:
            t = s.decode('latin-1'); m = {}
            for blk in re.findall(r'beginbfchar(.*?)endbfchar', t, re.S):
                for a, b in re.findall(r'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>', blk):
                    m[int(a, 16)] = ''.join(chr(int(b[i:i+4], 16)) for i in range(0, len(b), 4))
            for blk in re.findall(r'beginbfrange(.*?)endbfrange', t, re.S):
                for a, b, c in re.findall(r'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>', blk):
                    lo, hi, st = int(a, 16), int(b, 16), int(c, 16)
                    for k in range(lo, hi + 1): m[k] = chr(st + k - lo)
            maps.append(m)
    def render(order):
        parts = []
        for s in streams:
            if b'Tj' not in s: continue
            t = s.decode('latin-1'); cur = None
            for m in re.finditer(r'/F(\d+) [\d.]+ Tf|<([0-9A-Fa-f]+)> Tj', t):
                if m.group(1): cur = int(m.group(1))
                else:
                    mp = order.get(cur, {}); h = m.group(2)
                    parts.append(''.join(mp.get(int(h[i:i+4], 16), '?') for i in range(0, len(h), 4)))
        return ' '.join(parts)
    # Початкове -1 було вище за будь-який реальний рахунок (він завжди ≤ 0),
    # тому переможцем лишався порожній рядок — і облік показав «зникло все».
    best, score = '', -10 ** 9
    for perm in ([0, 1], [1, 0]) if len(maps) > 1 else ([0],):
        order = {4 + k: maps[perm[k]] for k in range(len(perm))}
        r = render(order); sc = r.count('?') * -1
        if sc > score: best, score = r, sc
    return best

# ── звіт ─────────────────────────────────────────────────────────────────────
if len(sys.argv) < 3:
    sys.exit('використання: python3 content-diff.py <ТЗ> <дек>')
items = brief_items(sys.argv[1])
D = norm(deck_text(sys.argv[2]))
lost, part, ok = [], [], 0
for src, it in items:
    n = norm(it)
    if n in D: ok += 1; continue
    # Обрізання — окремий і найгірший клас: початок є, кінця немає. Слайд
    # виглядає закінченим, і саме тому дефект доживає до показу.
    keep = 0
    for k in range(len(n), 11, -1):
        if n[:k] in D: keep = k; break
    (part if keep else lost).append((src, it, keep, len(n)))

# Дослівний збіг завищує втрати: «нетворкінга» → «нетворкінгу», «в рішення» →
# «в рішенні», «для викладачів» → «(викладачі)» — це редакторська правка, а не
# зникнення думки, і плутати їх означає зробити звіт непридатним. Тому в кожному
# розходженні окремо перевіряються СЛОВА: якщо кожне слово хвоста знайдено в деку
# (за коренем без двох останніх літер), це переформулювання. Якщо якесь слово
# відсутнє повністю — думка втрачена.
def words(s): return [w for w in re.findall(r'[0-9A-Za-zА-Яа-яІіЇїЄєҐґ]{4,}', s)]
def absent(tail_words):
    return [w for w in tail_words if norm(w)[:max(4, len(norm(w)) - 2)] not in D]

real, reworded = [], []
for src, it, keep, tot in part + [(s, i, 0, len(norm(i))) for s, i, _, _ in lost]:
    n = norm(it)
    # хвіст у літерах: беремо слова, що не вмістились у знайдений префікс
    acc, tail = 0, []
    for w in words(it):
        if acc + len(norm(w)) <= keep: acc += len(norm(w))
        else: tail.append(w)
    miss = absent(tail) if tail else absent(words(it))
    (real if miss else reworded).append((src, it, keep, tot, miss))

print(f'елементів у ТЗ: {len(items)} · збіглося дослівно: {ok} · '
      f'переформульовано: {len(reworded)} · ЗМІСТ ВТРАЧЕНО: {len(real)}')
print(f'знаків: ТЗ {sum(len(norm(i)) for _, i in items)} · дек {len(D)}')
if real:
    print('\n── ЗМІСТ ВТРАЧЕНО ' + '─' * 46)
    for src, it, keep, tot, miss in real:
        where = 'обрізано' if keep else 'зникло цілком'
        print(f'  {src} · {where}' + (f' на {round(keep / tot * 100)}% ({keep}/{tot})' if keep else ''))
        print(f'     «{it}»')
        print(f'     немає в деку: {", ".join(miss)}')
if reworded:
    print('\n── переформульовано, зміст на місці ' + '─' * 29)
    for src, it, keep, tot, _ in reworded:
        print(f'  {src}: «{it[:90]}»')
print('\n' + ('✅ увесь зміст ТЗ у деку' if not real
              else f'❌ {len(real)} з {len(items)} елементів ТЗ втратили зміст'))
