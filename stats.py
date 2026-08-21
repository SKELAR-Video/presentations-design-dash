# SKELAR · підрахунок згенерованих деків за рядком-слідом.
#
# Кожен дек, зібраний за правилами v51+, несе в нотатках доповідача першого
# слайда рядок: SKELAR deck · правила vNN · DD.MM.YYYY · <тіма>
# Цей скрипт шукає такі рядки в усіх .html і .pptx у папці decks/ (або в
# шляхах, переданих аргументами), рахує їх по тімах і версіях і переписує
# STATS.md. Він нічого не завантажує і нікуди не пише, крім STATS.md.
#
#   python3 stats.py            # рахує decks/**
#   python3 stats.py <папка>    # рахує будь-яку папку з деками
import io, os, re, sys, zipfile
from collections import Counter
from datetime import date

MARK = re.compile(r'SKELAR deck\s*·\s*правила\s*(v\d+)\s*·\s*([\d.]+)\s*·\s*([^\r\n<"&]+)')

def read_texts(path):
    """Повертає текст(и) файлу, де може жити рядок-слід."""
    if path.endswith('.html'):
        yield open(path, encoding='utf-8', errors='ignore').read()
    elif path.endswith('.pptx'):
        # нотатки доповідача лежать у ppt/notesSlides/*.xml
        with zipfile.ZipFile(path) as z:
            for n in z.namelist():
                if 'notesSlide' in n and n.endswith('.xml'):
                    yield z.read(n).decode('utf-8', errors='ignore')

def scan(roots):
    decks = []  # (файл, версія, дата, тіма)
    for root in roots:
        for dirpath, _, files in os.walk(root):
            for f in sorted(files):
                p = os.path.join(dirpath, f)
                if not (f.endswith('.html') or f.endswith('.pptx')):
                    continue
                found = None
                try:
                    for text in read_texts(p):
                        m = MARK.search(text)
                        if m:
                            found = m
                            break
                except (zipfile.BadZipFile, OSError):
                    pass
                if found:
                    v, d, team = found.group(1), found.group(2), found.group(3).strip(' \t.·-–—>')
                    decks.append((os.path.relpath(p, root), v, d, team))
                else:
                    decks.append((os.path.relpath(p, root), '—', '—', '(без рядка-сліду)'))
    return decks

def main():
    roots = sys.argv[1:] or ['decks']
    decks = scan([r for r in roots if os.path.isdir(r)])
    by_team = Counter(t for _, _, _, t in decks)
    by_ver = Counter(v for _, v, _, _ in decks)

    out = io.StringIO()
    out.write('# Статистика генерації деків\n\n')
    out.write(f'Оновлено: {date.today().strftime("%d.%m.%Y")} · всього деків: {len(decks)}\n\n')
    out.write('Рахується рядок-слід `SKELAR deck · правила vNN · дата · тіма` у файлах\n')
    out.write('з папки `decks/`. Файл без рядка — дек, зібраний до v51 або не за правилами.\n\n')
    out.write('## По тімах\n\n| Тіма | Деків |\n|---|---|\n')
    for team, n in by_team.most_common():
        out.write(f'| {team} | {n} |\n')
    out.write('\n## По версіях правил\n\n| Версія | Деків |\n|---|---|\n')
    for v, n in sorted(by_ver.items(), reverse=True):
        out.write(f'| {v} | {n} |\n')
    out.write('\n## Файли\n\n| Файл | Версія | Дата | Тіма |\n|---|---|---|---|\n')
    for f, v, d, t in decks:
        out.write(f'| {f} | {v} | {d} | {t} |\n')
    open('STATS.md', 'w', encoding='utf-8').write(out.getvalue())
    print(f'деків: {len(decks)} · тімів: {len(by_team)} → STATS.md')

if __name__ == '__main__':
    main()
