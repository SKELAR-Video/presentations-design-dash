# SKELAR · підрахунок згенерованих деків за рядком-слідом.
#
# Кожен дек, зібраний за правилами v51+, несе рядок
#   SKELAR deck · правила vNN · DD.MM.YYYY · <тіма>
# у нотатках доповідача першого слайда, і той самий рядок Клод Дизайн друкує
# разом із ГОТОВО. Скрипт рахує обидва сліди: рядки в JOURNAL.md (легкий
# шлях, без файлів) і файли .html/.pptx у decks/ — і переписує STATS.md.
#
#   python3 stats.py            # рахує JOURNAL.md + decks/**
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
                    v, d = found.group(1), found.group(2)
                    # у хвості після тіми може стояти ще « · назва деку»
                    team = found.group(3).split('·')[0].strip(' \t.-–—>')
                    decks.append((os.path.relpath(p, root), v, d, team))
                else:
                    decks.append((os.path.relpath(p, root), '—', '—', '(без рядка-сліду)'))
    return decks

def journal():
    # Рядки з JOURNAL.md: (назва або номер, версія, дата, тіма).
    decks = []
    if not os.path.exists('JOURNAL.md'):
        return decks
    for line in open('JOURNAL.md', encoding='utf-8'):
        if 'Формат' in line or 'тестовий запис' in line:
            continue   # приклад формату — не запис
        m = MARK.search(line)
        if m:
            tail = [x.strip(' \t.-–—>') for x in m.group(3).split('·')]
            team = tail[0]
            name = tail[1] if len(tail) > 1 and tail[1] else f'журнал №{len(decks)+1}'
            decks.append((name, m.group(1), m.group(2), team))
    return decks

def main():
    roots = sys.argv[1:] or ['decks']
    decks = journal() + scan([r for r in roots if os.path.isdir(r)])
    by_team = Counter(t for _, _, _, t in decks)
    by_ver = Counter(v for _, v, _, _ in decks)

    out = io.StringIO()
    out.write('# Статистика генерації деків\n\n')
    out.write(f'Оновлено: {date.today().strftime("%d.%m.%Y")} · всього деків: {len(decks)}\n\n')
    out.write('Рахується рядок-слід `SKELAR deck · правила vNN · дата · тіма`:\n')
    out.write('записи в `JOURNAL.md` плюс файли в `decks/`. Файл без рядка — дек,\n')
    out.write('зібраний до v51 або не за правилами.\n\n')
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
