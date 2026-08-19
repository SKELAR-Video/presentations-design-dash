/* SKELAR · перевірка слайда з даними.
   Відкрий згенерований HTML у браузері, встав це в консоль, натисни Enter.
   Кожен рядок — вимір, а не думка. FAIL означає, що слайд показувати ще рано. */
(() => {
  const st = document.querySelector('.stage'); if (st) st.style.zoom = 1;
  // Розпірка в кінець документа. Без неї останні слайди неможливо прокрутити
  // під верх кадру — сторінка вже закінчилась, слайд лишається вище, і
  // elementFromPoint міряє контент СУСІДНЬОГО слайда. Саме так перевірка на
  // перекриття звинуватила таблицю в тому, що її шапку накриває заголовок,
  // який належав іншому слайду.
  const spacer = document.createElement('div');
  spacer.style.height = '1200px'; spacer.setAttribute('data-check-spacer', '');
  (st || document.body).appendChild(spacer);
  const ink = el => { const r = document.createRange(); r.selectNodeContents(el);
    const rs = [...r.getClientRects()]; if (!rs.length) return el.getBoundingClientRect();
    return { left: Math.min(...rs.map(x=>x.left)), right: Math.max(...rs.map(x=>x.right)),
             top: Math.min(...rs.map(x=>x.top)), bottom: Math.max(...rs.map(x=>x.bottom)) }; };
  const BOX = '[class*=card],[class*=kpi],[class*=box],[class*=panel],.tw,.col';
  const TXT = 'div,span,b,em,i,p,h1,h2';
  let fails = 0;
  document.querySelectorAll('.slide').forEach((s, i) => {
    // elementFromPoint бачить лише вікно, тому слайд спершу треба прокрутити
    // в кадр — інакше перевірка на перекритий текст мовчки пропускає все,
    // крім першого слайда. Саме так вона й пропустила мій негативний тест.
    s.scrollIntoView({block:"start"});
    const S = s.getBoundingClientRect(); const say = [];
    const t = (name, ok, val) => { if (!ok) fails++; say.push(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${val}`); };

    t('висота рівно 1080', s.scrollHeight === 1080, s.scrollHeight);

    // Без умови на overflow: елемент із visible теж переповнюється — просто
    // його вміст вилазить назовні й обрізається вже батьківською карткою.
    // Саме такий випадок я один раз пропустив.
    // Переповнення рахується лише тоді, коли вміст РЕАЛЬНО обрізається: сам
    // елемент або хтось із предків має overflow != visible. Текст, що виходить
    // за свій бокс на кілька пікселів через інтерліньяж, нічого не втрачає —
    // він просто малюється далі. Я один раз переплутав це з дефектом і мало
    // не змінив через це правило бренду.
    const clips = e => { for (let a = e; a && a !== s; a = a.parentElement) {
      const o = getComputedStyle(a); if (o.overflow !== 'visible' || o.overflowY !== 'visible') return true; }
      return false; };
    const over = [...s.querySelectorAll('*')]
      .filter(e => e.children.length && e.scrollHeight - e.clientHeight > 2 && clips(e)).length;
    t('нічого не переповнене', over === 0, over);

    const cut = [...s.querySelectorAll(TXT)].filter(e => !e.children.length && e.textContent.trim()
      && e.scrollWidth > e.clientWidth + 1).length;
    t('текст не обрізаний', cut === 0, cut);

    let tight = 0;
    s.querySelectorAll(BOX).forEach(c => { const b = c.getBoundingClientRect();
      c.querySelectorAll(TXT).forEach(e => { if (e.children.length || !e.textContent.trim()) return;
        const r = ink(e);
        if (Math.min(r.left-b.left, b.right-r.right, r.top-b.top, b.bottom-r.bottom) < 14) tight++; }); });
    t('текст не ближче 14px до краю картки', tight === 0, tight);

    // Порівнюємо рядки лише в межах ОДНОГО контейнера: дві картки поруч
    // стоять у різних x, і це не «рваний» стовпчик, а сусідні таблиці.
    let ragged = 0;
    const rows = new Map();
    // Ключ — не тільки батько, а й лівий край із шириною. Рядки таблиці ділять
    // і те, і те; сусідні колонки (текстові блоки, картки поруч) — ні, і раніше
    // вони давали FAIL на власному еталоні: сітки-сусіди в одному батькові
    // порівнювались між собою, хоча стоять пліч-о-пліч, а не одна під одною.
    [...s.querySelectorAll('[class]')].filter(e => getComputedStyle(e).display === 'grid')
      .forEach(g => { const b = g.getBoundingClientRect();
        const key = `${[...s.querySelectorAll('*')].indexOf(g.parentElement)}|${Math.round(b.left)}|${Math.round(b.width)}`;
        if (!rows.has(key)) rows.set(key, []); rows.get(key).push(g); });
    // Абсолютні діти (лінія адженди .tl-line) — не колонки сітки: вони поза
    // потоком і не мають порівнюваного x.
    const gridKids = g => [...g.children].filter(e => getComputedStyle(e).position !== 'absolute');
    [...rows.values()].forEach(group => { if (group.length < 2) return;
      const n = gridKids(group[0]).length;
      for (let c = 0; c < n; c++) {
        // Порівнюємо тільки заповнені клітинки. Недозаповнений останній рядок —
        // це норма (адженда на 6 у сітці на 4), а не рваний край: раніше
        // відсутня клітинка потрапляла в набір як undefined і давала FAIL.
        const xs = new Set(group.map(g => gridKids(g)[c]).filter(Boolean)
          .map(e => Math.round(e.getBoundingClientRect().left)));
        if (xs.size > 1) ragged++; } });
    t('лівий край колонки однаковий у всіх рядках', ragged === 0, ragged);

    const split = [...s.querySelectorAll(TXT)].filter(e => !e.children.length
      && /\d ?\s ?\d/.test(e.textContent) && e.getClientRects().length > 1).length;
    t('жодне число не розірване переносом', split === 0, split);

    const L = s.querySelector('.logo, [class*=logo]');
    if (L && getComputedStyle(L).display !== 'none') {
      // Міряти до КРАЮ картки, не до її тексту. Раніше тут стояв ink() на всьому,
      // і таблиця, що підійшла до логотипа на 15px своїм краєм, давала PASS: текст
      // у ній був далеко лівіше. Правило каже «ближче нічого не підходить» — фон
      // і межа картки це теж «щось». Для заголовка й виноски лишається ink:
      // їхній бокс — на всю ширину слайда, і по ньому вимір безглуздий.
      const lb = L.getBoundingClientRect(); let g = Infinity;
      // Картки міряються по краю, текст — по намальованому. Раніше в тексті
      // рахувались тільки h1 і виноска: логотип міг стати впритул до будь-якого
      // іншого підпису, і перевірка мовчала. Тепер беруться всі листові вузли
      // з текстом, незалежно від того, якими класами їх назвали.
      const near = [...s.querySelectorAll(BOX)].map(e => e.getBoundingClientRect())
        .concat([...s.querySelectorAll(TXT)]
          .filter(e => !e.children.length && e.textContent.trim() && !L.contains(e))
          .map(e => ink(e)));
      near.forEach(b => {
        const dx = Math.max(lb.left-b.right, b.left-lb.right, 0), dy = Math.max(lb.top-b.bottom, b.top-lb.bottom, 0);
        g = Math.min(g, Math.max(dx, dy)); });
      t('охоронне поле логотипа ≥50px', g >= 50, Math.round(g));

      // Скруглення логотипа — дефект, який видно оком, але оком його й пропускають:
      // на темному фоні різниця між квадратом і r=18px читається як «просто іконка».
      // Знак у файлі має гострі кути, і жодна підкладка не має права їх округляти.
      const round = [L, ...L.querySelectorAll('*')]
        .map(e => getComputedStyle(e).borderRadius)
        .filter(v => v && v !== '0px' && v !== '0%');
      t('логотип без скруглення', round.length === 0, round[0] || '0px');

      // Версія знака мусить відповідати фону, і це не питання смаку: у файлі з
      // червоною плашкою на червоному тлі плашка зникає, а білий знак на темному
      // виглядає як сіра наліпка — саме це й було в живому деку на «Дякуємо».
      // Міряється сам файл: кутовий піксель картинки. Червоний кут — версія з
      // плашкою (темний фон), білий або прозорий — версія для червоного.
      const im = L.querySelector('img') || (L.tagName === 'IMG' ? L : null);
      if (im && im.naturalWidth) {
        let corner = null;
        try {
          const cv = document.createElement('canvas');
          cv.width = im.naturalWidth; cv.height = im.naturalHeight;
          const cx = cv.getContext('2d'); cx.drawImage(im, 0, 0);
          corner = cx.getImageData(1, 1, 1, 1).data;
        } catch (e) { /* картинка не з того ж джерела — вимір неможливий */ }
        if (corner) {
          const plated = corner[3] > 10 && corner[0] > 150 && corner[0] > corner[1] * 1.8;
          const sb = getComputedStyle(s).backgroundColor.match(/\d+/g).map(Number);
          const redBg = sb[0] > 150 && sb[0] > sb[1] * 1.8 && sb[0] > sb[2] * 1.8;
          t('версія знака під фон', plated !== redBg,
            `${plated ? 'з плашкою' : 'білий'} на ${redBg ? 'червоному' : 'темному'}`);
        }
      }

      // Плашку несе файл. Намальована в коді підкладка — це друга плашка поверх
      // тієї, що вже є у знаку, і на темному фоні вона читається як сіра наліпка.
      const plate = [L, ...L.querySelectorAll('*')].filter(e => e.tagName !== 'IMG')
        .map(e => getComputedStyle(e).backgroundColor)
        .filter(v => v && v !== 'rgba(0, 0, 0, 0)' && v !== 'transparent');
      t('під знаком нічого не підмальовано', plate.length === 0, plate[0] || 'чисто');
    }

    // Сітка одного блока мусить бути однакова в усіх його рядках. У живому деку
    // адженда на 6 пунктів вийшла як 4+2: у другому рядку колонки вдвічі ширші,
    // ліві краї розʼїхались, а довгі підписи у вужчих колонках вигнали слайд
    // на 1119px. Правильно — ceil(N/2) і порожня клітинка в кінці.
    const gridRows = new Map();
    s.querySelectorAll('.tl-row, .cols, .subs, .rails, .band').forEach(g => {
      const k = g.parentElement;
      if (!gridRows.has(k)) gridRows.set(k, []);
      gridRows.get(k).push(getComputedStyle(g).gridTemplateColumns.split(' ').length);
    });
    const uneven = [...gridRows.values()].filter(v => new Set(v).size > 1);
    t('сітка однакова в усіх рядках блока', uneven.length === 0,
      uneven.length ? `колонок по рядках: ${uneven[0].join(' / ')}` : 0);

    // Асети. Дві помилки, які я зробив сам і які доїхали в живий дек:
    // 1) знак був намальований clip-path-полігоном — тобто перемальований, хоч
    //    правило каже брати рівно той файл, що дано;
    // 2) шляхи були відносні (content/...) — поза репозиторієм картинок немає,
    //    і в деку логотипи просто зникли.
    // Тому: логотип — це <img>, і жоден src не буває відносним.
    if (L) {
      const im = L.querySelector('img');
      t('логотип — файл, а не намальований', !!im,
        im ? 'img' : `<${L.tagName.toLowerCase()}> без img`);
      if (im) t('знак не перефарбований і не обрізаний фігурою',
        getComputedStyle(im).clipPath === 'none' && getComputedStyle(L).clipPath === 'none',
        getComputedStyle(im).clipPath);
    }
    // Міряється факт, а не спосіб посилання: blob:, який бандл створює при
    // завантаженні з байтів усередині файла, — законний і самодостатній
    // (перевірка на «лише data:» тут давала 8 хибних FAIL на живому деку,
    // що рендерився бездоганно). Дефект — картинка, яка НЕ завантажилась
    // (naturalWidth 0: битий значок), або відносний шлях у сусідній файл.
    const badImg = [...s.querySelectorAll('img')].filter(e => {
      const v = e.getAttribute('src') || '';
      if (/^https?:/.test(v)) return false;              // мережу міряє окрема перевірка
      return !(e.complete && e.naturalWidth > 0);
    });
    t('кожна картинка завантажилась із самого файла', badImg.length === 0,
      badImg.length ? `${badImg.length}: «${(badImg[0].getAttribute('src') || '').slice(0, 34)}»` : 0);

    // Пропорція картинки. Логотип я задав як 304×41.86 при файлі 2352×592 —
    // тобто розтягнув удвічі по горизонталі, і знак «поплавило». На око це
    // помітно, а жодна перевірка геометрії такого не бачить: бокс на місці.
    const squashed = [...s.querySelectorAll('img')].filter(e => {
      if (!e.naturalWidth || !e.naturalHeight) return false;
      if (getComputedStyle(e).objectFit === 'cover') return false;   // фон ріжеться навмисно
      const b = e.getBoundingClientRect(); if (!b.width || !b.height) return false;
      return Math.abs((b.width / b.height) / (e.naturalWidth / e.naturalHeight) - 1) > 0.02;
    });
    t('картинки не розтягнуті', squashed.length === 0, squashed.length
      ? `${squashed.length}: ${Math.round(squashed[0].getBoundingClientRect().width)}×${Math.round(squashed[0].getBoundingClientRect().height)} при файлі ${squashed[0].naturalWidth}×${squashed[0].naturalHeight}` : 0);

    // Текст, накритий фоном. `.pic` і `.shade` абсолютні, а блок із заголовком
    // був звичайним — позиціоновані сусіди малюються поверх, і на слайді
    // просто немає тексту, хоча в коді він є. Питаємо браузер, хто зверху.
    // Перекриття рахується геометрично, без elementFromPoint: той бачить лише
    // вікно, а на останніх слайдах кадр не доходить і він міряє чужий слайд.
    // Правила накладання: вищий z-index; при однаковому — позиціонований поверх
    // звичайного (саме так фото накрило заголовок), а далі — порядок у DOM.
    // Шар елемента задає не він сам, а найближчий предок із власним z-index:
    // текст усередині .tt{z-index:2} має z-index auto, і порівнювати треба
    // саме двійку. Інакше затемнення з z-index:1 «накриває» заголовок, який
    // насправді лежить над ним.
    const zOf = e => { for (let a = e; a && a !== s.parentElement; a = a.parentElement) {
        const z = getComputedStyle(a).zIndex; if (z !== 'auto') return +z; } return 0; };
    const posed = e => getComputedStyle(e).position !== 'static';
    const solid = a => { const o = getComputedStyle(a);
      return (o.backgroundColor && o.backgroundColor !== 'rgba(0, 0, 0, 0)')
        || a.tagName === 'IMG' || !!a.querySelector('img'); };
    const above = (a, e) => {
      const za = zOf(a), ze = zOf(e);
      if (za !== ze) return za > ze;
      if (posed(a) !== posed(e)) return posed(a);
      return !!(a.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_PRECEDING);
    };
    // Список «щільних» елементів і їхні прямокутники рахуються ОДИН раз:
    // раніше кожен текстовий вузол перебирав усі елементи слайда, і на таблиці
    // з трьохсот вузлів це давало десятки тисяч замірів — перевірка не встигала
    // за дві хвилини.
    const solids = [...s.querySelectorAll('*')].filter(solid)
      .map(a => ({ a, b: a.getBoundingClientRect(), z: zOf(a), p: posed(a) }))
      .filter(o => o.b.width > 8 && o.b.height > 8);
    const covered = [...s.querySelectorAll(TXT)].filter(e => {
      if (e.children.length || !e.textContent.trim()) return false;
      const r = ink(e);
      if (r.right - r.left < 4 || r.bottom - r.top < 4) return false;
      const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
      const ez = zOf(e), ep = posed(e);
      return solids.some(({ a, b, z, p }) => {
        if (a === e || a.contains(e) || e.contains(a)) return false;
        if (!(b.left <= cx && cx <= b.right && b.top <= cy && cy <= b.bottom)) return false;
        if (z !== ez) return z > ez;
        if (p !== ep) return p;
        return !!(a.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_PRECEDING);
      });
    });
    t('текст не накритий іншим елементом', covered.length === 0, covered.length
      ? `${covered.length}: «${covered[0].textContent.trim().slice(0, 24)}»` : 0);

    // Ніщо не вилазить за поле. Логотип у живому деку виїхав за правий край
    // і обрізався краєм слайда — у коді це виглядає нормально, бо бокс на місці,
    // просто стоїть на 300px правіше. Фон і затемнення на весь слайд — виняток.
    const bleed = e => e.classList.contains('pic') || e.classList.contains('shade')
      || e.classList.contains('slide') || e.classList.contains('stage');
    const outside = [...s.querySelectorAll('.logo, .wordmark, .chip, .card, .kpi, .panel, .tw, .col, .tl-row, .cols, .subs, .rails, .bul, .h1, .st')]
      .filter(e => !bleed(e))
      .filter(e => { const b = e.getBoundingClientRect();       // сховане не міряємо:
        return b.width > 0 && b.height > 0; })                  // у display:none нулі
      .filter(e => { const b = e.getBoundingClientRect();
        return b.left < S.left + 99 || b.right > S.right - 99 || b.top < S.top + 99 || b.bottom > S.top + 981; });
    // Бокс контейнера може стояти в межах, а намальований текст — уже ні: рядок
    // вилазить за низ картки, картка за низ смуги, і слайд з overflow:hidden
    // ріже його краєм. У живому деку так зникли хвости на двох слайдах — і
    // бокси при цьому були на місці, тому попередня версія цієї перевірки
    // (тільки по боксах) їх пропускала. Міряється намальоване, і 980 — не
    // побажання, а інваріант: нижче нього змісту не буває.
    const inkOut = [...s.querySelectorAll(TXT)]
      .filter(e => !e.children.length && e.textContent.trim() && !e.closest('.note'))
      .map(e => ({ e, r: ink(e) }))
      .filter(o => o.r.right - o.r.left > 2 && o.r.bottom - o.r.top > 2)
      // Верх і ліво міряються по БОКСУ (перевірка нижче), не по накресленню:
      // при line-height:1 гліфи виступають над боксом на висоту акцентів —
      // у заголовка 118px це 12px, і воно дало 3 хибні FAIL на власному
      // еталоні. Втрата змісту буває тільки знизу й справа, там і межа.
      .filter(o => o.r.bottom > S.top + 992 || o.r.right > S.right - 92);
    t('текст не виходить за низ і правий край', inkOut.length === 0, inkOut.length
      ? `${inkOut.length}, найгірший «${inkOut[0].e.textContent.trim().slice(0,20)}» низ ${Math.round(inkOut[0].r.bottom - S.top)}`
      : 'усі');

    t('нічого не виходить за поле 100', outside.length === 0, outside.length
      ? `${outside.length}: .${String(outside[0].className).split(' ')[0]} до ${Math.round(outside[0].getBoundingClientRect().right - S.left)}` : 0);

    // Заголовок і контент не налазять один на одного. Блоки стоять на фіксованих
    // координатах, а заголовок росте вниз: три рядки замість одного — і кружечок
    // сідає просто на літери. Правильна реакція — опустити кегль заголовка зі
    // шкали, а не зсунути блок: тоді ламається сітка всіх інших слайдів.
    const H = s.querySelector('.h1, .st');
    if (H && H.getBoundingClientRect().height) {
      const hb = ink(H);
      const hit = [...s.querySelectorAll('.tl, .cols, .subs, .rails, .bul, .band, .right, .circ, .card, .kpi, .panel')]
        .map(e => e.getBoundingClientRect())
        .filter(b => b.width && b.height
          && b.left < hb.right + 20 && b.right > hb.left - 20
          && b.top < hb.bottom + 20 && b.bottom > hb.top - 20);
      t('заголовок не налазить на контент', hit.length === 0, hit.length
        ? `перекриття ${Math.round(hb.bottom - hit[0].top)}px` : 0);
    }

    // Числа в одній сітці KPI мають однаковий кегль — його задає найдовше число,
    // а не кожна картка окремо. І цей кегль мусить бути найбільшим, який влазить:
    // «$31 770» на 72px займав 277 із 347 доступних, тобто 70 пікселів простою.
    const grids = new Map();
    s.querySelectorAll('.kv2').forEach(e => { const k = e.closest('.kpis') || e.parentElement.parentElement;
      if (!grids.has(k)) grids.set(k, []); grids.get(k).push(e); });
    grids.forEach(list => {
      const sizes = new Set(list.map(e => Math.round(parseFloat(getComputedStyle(e).fontSize))));
      t('кегль числа однаковий у всій сітці', sizes.size <= 1, [...sizes].join(' / '));
      // Порівнюємо кожне число з ЙОГО карткою і беремо найзаповненіше: якщо
      // найдовше число використало менш як 60% своєї картки, кегль занизький.
      // Спершу я міряв проти найширшої картки в сітці — на змішаних розкладках
      // це давало 25% там, де все гаразд.
      // Картка-рядок (число і підпис в один рядок) має іншу геометрію: там
      // число законно займає меншу частку ширини. Її з цієї перевірки виводимо.
      let best = 0, info = '';
      list.forEach(e => { const c = e.closest('[class*=kpi]'); if (!c) return;
        if (c.classList.contains('row')) return;
        const r = ink(e), cb = c.getBoundingClientRect(), cs = getComputedStyle(c);
        const room = cb.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const k = (r.right - r.left) / room;
        if (k > best) { best = k; info = `${Math.round(r.right - r.left)} з ${Math.round(room)}`; } });
      if (best) t('найдовше число використовує ≥60% ширини картки', best >= 0.6,
        `${info} = ${Math.round(100 * best)}%`);
    });

    // Заголовок міг бути крупнішим. Перевірки ловлять переповнення, а простій —
    // ні, тому «72px там, де влазить 118» проходило непоміченим. Рахуємо так:
    // беремо намальовану ширину, перераховуємо на наступний крок шкали й
    // дивимось, чи лишився б той самий набір рядків і чи є місце по вертикалі.
    if (H && H.getBoundingClientRect().height) {
      // Дві різні шкали, і плутати їх не можна: 157 — це теза на перебивці,
      // а не заголовок слайда. Перша редакція перевірки саме через це вимагала
      // від кожного заголовка 157px і дала 10 FAIL на власному еталоні.
      const SCALE = H.classList.contains('st') ? [157, 118, 96, 72] : [118, 87, 72, 56, 44];
      const cur = Math.round(parseFloat(getComputedStyle(H).fontSize));
      const bigger = SCALE.filter(v => v > cur + 1).pop();   // найближчий більший
      if (bigger) {
        const r = document.createRange(); r.selectNodeContents(H);
        const rects = [...r.getClientRects()];
        const lines = Math.max(1, rects.length);
        const wInk = Math.max(...rects.map(x => x.right)) - Math.min(...rects.map(x => x.left));
        const box = H.getBoundingClientRect().width || (S.width - 200);
        const k = bigger / cur;
        // приблизна ширина того самого тексту на більшому кеглі
        const need = wInk * k;
        const fitsWidth = need <= box * lines * 0.9;   // із запасом: оцінка приблизна
        // вертикаль: наскільки виріс би блок і чи не впреться в контент
        const grow = (H.getBoundingClientRect().height) * (k - 1);
        const below = [...s.querySelectorAll('.tl, .cols, .subs, .rails, .bul, .band, .right, .circ')]
          .map(e => e.getBoundingClientRect().top - S.top)
          .filter(v => v > 0).sort((a, b) => a - b)[0];
        // Місця для росту стільки, скільки вільно ДО найближчого блока — і не
        // більше, ніж лишилось до лінії 980. На слайдах із даними блоки стоять
        // у потоці й ідуть униз разом із заголовком: там вільного місця немає
        // взагалі, і вимагати більший кегль означає зламати таблицю. Перша
        // редакція цього не рахувала й запропонувала 72px там, де панель
        // одразу переповнилась.
        let bottomFree = 980;
        s.querySelectorAll('[class]').forEach(e => { const b = e.getBoundingClientRect();
          if (b.height > 40 && b.width > 200) bottomFree = Math.min(bottomFree, 980 - (b.bottom - S.top)); });
        const gap = below == null ? 980 - (H.getBoundingClientRect().bottom - S.top)
                                  : below - (H.getBoundingClientRect().bottom - S.top);
        const room = Math.max(0, Math.min(gap, bottomFree));
        t('заголовок не дрібніший, ніж міг би бути', !(fitsWidth && grow + 40 < room),
          fitsWidth && grow + 40 < room ? `${cur}px, а влазить ${bigger}px` : `${cur}px`);
      }
    }

    // Bold заборонений, і саме тут я двічі проґавив своє. `h1` у браузера має
    // власне `font-weight:bold`, а успадкований 500 зі слайда його НЕ перебиває:
    // спадкування слабше за правило UA на самому елементі. Тому кожен заголовок
    // в обох еталонах рендерився вагою 700, правило «ніколи bold» лежало в
    // rules.md з першого дня, а перевірки на вагу не було — і 49 жирних
    // заголовків доїхали в живий дек. Вимір, а не сподівання.
    const heavy = [...s.querySelectorAll(TXT + ',h1,h2,b,strong,em')]
      .filter(e => !e.children.length && e.textContent.trim()
        && +getComputedStyle(e).fontWeight >= 600);
    t('немає жирного тексту', heavy.length === 0, heavy.length
      ? `${heavy.length}: <${heavy[0].tagName.toLowerCase()}> «${heavy[0].textContent.trim().slice(0, 22)}»` : 0);

    // Червоний — колір поверхонь (знак, шкала, точка, кружечок), не тексту.
    // Словесне правило тут не тримає: «я не оцінюю, я виділяю» — і його вже
    // обійшли. Тому вимір: жоден листовий вузол з текстом не має червоного
    // кольору. Фон червоним бути може — біла цифра на червоному колі законна.
    const red = c => { const m = c.match(/\d+/g); if (!m) return false;
      const [r, g, b] = m.map(Number); return r > 150 && r > g * 1.8 && r > b * 1.8; };
    const redText = [...s.querySelectorAll(TXT)]
      .filter(e => !e.children.length && e.textContent.trim() && red(getComputedStyle(e).color));
    t('текст не пофарбований у червоне', redText.length === 0,
      redText.length ? `${redText.length}: «${redText[0].textContent.trim().slice(0, 24)}»` : 0);

    // На червоному тлі дрібний текст — #FCCACA. Сірий #A2A6B1 там бруднить,
    // біла прозорість (rgba(255,255,255,.85)) дає той самий сірий по-іншому.
    // Заголовок і цифри лишаються білими: 1.6:1 у #FCCACA на червоному не
    // читається, тому правило стосується саме дрібного тексту.
    const sb0 = getComputedStyle(s).backgroundColor.match(/\d+/g).map(Number);
    if (sb0[0] > 150 && sb0[0] > sb0[1] * 1.8 && sb0[0] > sb0[2] * 1.8) {
      const small = [...s.querySelectorAll(TXT)].filter(e => !e.children.length
        && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) <= 56);
      const bad = small.filter(e => getComputedStyle(e).color !== 'rgb(252, 202, 202)');
      if (small.length) t('дрібний текст на червоному — #FCCACA', bad.length === 0,
        bad.length ? `${bad.length} з ${small.length}: ${getComputedStyle(bad[0]).color}` : `${small.length} шт`);
    }

    // Маркер-точка в рядку ТАБЛИЦІ читається як класифікація, і без легенди вона
    // бреше. Але в адженді й текстових блоках точка — вершина лінії, а не тип:
    // це офіційні патерни, і легенди їм не треба. Перша версія цієї перевірки
    // ловила будь-яку точку на слайді й забракувала б рівно ті типи, які бренд
    // і малює. Тому область — тільки рядки таблиць.
    const dot = e => { const o = getComputedStyle(e), b = e.getBoundingClientRect();
      return b.width <= 24 && b.width > 3 && Math.abs(b.width-b.height) <= 2
        && /^(50%|9999px)/.test(o.borderRadius); };
    const dots = [...s.querySelectorAll('.panel .r, .tw .r, .col .ln')]
      .flatMap(r => [...r.querySelectorAll('*')]).filter(e => !e.children.length && dot(e));
    const inLegend = [...s.querySelectorAll('.note *')].filter(e => !e.children.length && dot(e)).length;
    t('маркери в рядках таблиці лише з легендою', dots.length === 0 || inLegend > 0,
      `${dots.length} у рядках / ${inLegend} у легенді`);

    // Два ряди адженди — одна перенесена лінія: верхній ряд доходить до правого
    // краю слайда, нижній починається від лівого. Лінія — псевдоелемент, тому
    // querySelectorAll її не бачить; беремо used-значення left і width.
    const twoRow = s.querySelector('.tl.two');
    if (twoRow) {
      const rows = [...twoRow.querySelectorAll('.tl-row')];
      const edge = (row, side) => {
        const el = row.querySelector('.tl-line');   // лінія — елемент з v34; ::before — деки до неї
        if (el) { const b = el.getBoundingClientRect(); return side === 'right' ? b.right - S.right : b.left - S.left; }
        const rb = row.getBoundingClientRect();
        const cs = getComputedStyle(row, '::before');
        const l = rb.left + parseFloat(cs.left);
        return side === 'right' ? l + parseFloat(cs.width) - S.right : l - S.left;
      };
      const first = Math.round(edge(rows[0], 'right'));
      const last = Math.round(edge(rows[rows.length - 1], 'left'));
      t('лінія адженди загортається на краях', Math.abs(first) <= 1 && Math.abs(last) <= 1,
        `верхня до правого краю ${first}, нижня від лівого ${last}`);
      // Товщина — з канонічного макета: точка 54, лінія 6 (~1:9). 3px жило в
      // еталоні без жодного виміру і ніде не було записане свідомим відхиленням.
      const lineEl = twoRow.querySelector('.tl-line');
      if (lineEl) t('лінія адженди 6px', Math.abs(lineEl.getBoundingClientRect().height - 6) <= 1,
        Math.round(lineEl.getBoundingClientRect().height) + 'px');
    }

    // Заголовок і контент — два абсолюти, які нічого не знають одне про одного:
    // .h1 стоїть на top:100, смуга — на своїй координаті, і третій рядок
    // заголовка мовчки лягає на картки. Перекриття тут не ловилось нічим:
    // перевірка на закритий текст шукає текст ПІД плашкою, а тут навпаки —
    // заголовок малюється ЗВЕРХУ, він видимий, і formально все гаразд.
    // Міряється намальоване проти краю блоків, із просвітом 24px.
    const HEAD = s.querySelector('.h1, .st');
    if (HEAD) {
      const hb = ink(HEAD);
      const bodies = [...s.querySelectorAll('.band,.tl,.sheet,.cols,.subs,.rails,.bul,.right,.kpi,.panel,.tw')]
        .filter(e => !e.contains(HEAD) && !HEAD.contains(e));
      let hit = 0, worstGap = Infinity;
      bodies.forEach(e => {
        const b = e.getBoundingClientRect();
        const overlapX = Math.min(hb.right, b.right) - Math.max(hb.left, b.left) > 0;
        if (!overlapX) return;
        const gap = b.top - hb.bottom;
        worstGap = Math.min(worstGap, gap);
        if (gap < 24) hit++;
      });
      if (bodies.length) t('заголовок не налазить на контент', hit === 0,
        `просвіт ${worstGap === Infinity ? '—' : Math.round(worstGap)}px (треба ≥24)`);
    }

    // Жоден текст не перетинає жодного іншого. Це та перевірка, якої бракувало:
    // я двічі лагодив налізання заголовка на смугу — спершу для таблиці, потім
    // для бенто — і воно двічі поверталось у новому місці, бо кожна латка
    // закривала одну пару елементів. Тут пар немає: міряються всі намальовані
    // прямокутники тексту проти всіх. Дворядковий надзаголовок колонки, що ліг
    // на свій же абзац, ловиться тим самим виміром, що й заголовок слайда.
    const leaves = [...s.querySelectorAll(TXT)]
      .filter(e => !e.children.length && e.textContent.trim())
      .map(e => ({ e, r: ink(e) }))
      .filter(o => o.r.right - o.r.left > 2 && o.r.bottom - o.r.top > 2);
    let cross = 0, cex = '';
    for (let a = 0; a < leaves.length; a++) for (let b = a + 1; b < leaves.length; b++) {
      const A = leaves[a], B = leaves[b];
      if (A.e.contains(B.e) || B.e.contains(A.e)) continue;
      const ox = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left);
      const oy = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
      // 4px допуску: рядки одного абзацу торкаються виносними елементами
      // (р, д, у) сусіднього рядка, і це не перекриття, а нормальний інтерліньяж.
      if (ox > 4 && oy > 4) { cross++;
        if (!cex) cex = `«${A.e.textContent.trim().slice(0,18)}» × «${B.e.textContent.trim().slice(0,18)}» на ${Math.round(ox)}×${Math.round(oy)}px`; }
    }
    t('жоден текст не перетинає інший', cross === 0, cross ? cex : `${leaves.length} блоків`);

    // Вирівнювання в картці — тільки ліве. Чотири картки поруч читаються як
    // одна сітка саме за спільною лівою вертикаллю; right-align робить ліві
    // краї рваними, і замість сітки виходять чотири окремі блоки. Праве
    // вирівнювання законне лише в колонці чисел таблиці, де воно про розряди.
    // Табличний контекст поза перевіркою: там праве вирівнювання — це розряди
    // чисел, і шапка колонки повторює його за окремим правилом. Перша версія
    // цієї перевірки цього не знала й дала 4 FAIL на власному еталоні даних,
    // де числа стоять праворуч цілком законно.
    const TABULAR = '.tbl,.tw,.thead,.tbody,.r,.crow,.rows';
    const numeric = v => /^[−–—+]?[\d\s.,%$€₴()–—-]*[\d—–]{1}[\d\s.,%$€₴()–—-]*$/.test(v);
    const cardText = [...s.querySelectorAll(BOX + ',.nb-i,.tl-i,.bul-i')]
      .flatMap(c => [...c.querySelectorAll(TXT)])
      .filter(e => !e.children.length && e.textContent.trim()
        && !e.closest(TABULAR) && !numeric(e.textContent.trim()));
    const skew = cardText.filter(e => !['left', 'start'].includes(getComputedStyle(e).textAlign));
    if (cardText.length) t('текст у картці вирівняний ліворуч', skew.length === 0,
      skew.length ? `${skew.length} з ${cardText.length}: ${getComputedStyle(skew[0]).textAlign} «${skew[0].textContent.trim().slice(0,20)}»`
                  : `${cardText.length} шт`);

    // Панелі в одній смузі мусять мати однакову кількість рядків. Таблиця
    // ділиться по КОЛОНКАХ (перша колонка-ключ повторюється), ніколи по
    // категоріях: чотири панелі з 1, 2, 3 і 4 рядками дають чотири різні кроки,
    // рядки не стають в один рівень, і смуга читається як зламана сітка.
    // Саме так виглядав бюджет у живому деку — і це не глюк рендеру, а розкладка.
    s.querySelectorAll('.sheet').forEach(sh => {
      const counts = [...sh.querySelectorAll('.tbl')]
        .map(tb => tb.querySelectorAll('.rows > .tr').length);
      if (counts.length < 2) return;
      t('у панелях смуги однаково рядків', new Set(counts).size === 1, counts.join(' / '));
    });

    // Заглушка замість фото — окремий дефект, і найпідліший: слайд виглядає
    // «майже готовим», підпис «photo — cover, 1920×1080» читається як службова
    // помітка, і дек здається на 95% зробленим. Фон — це ФАЙЛ із content/
    // backgrounds, вбудований як data: URI. Намальований візерунок (діагональні
    // смуги, сітка, градієнт-заповнювач) не є фото й не стає ним.
    const decor = [s, ...s.querySelectorAll('*')].filter(e => {
      const bi = getComputedStyle(e).backgroundImage;
      if (!bi || bi === 'none') return false;
      if (/^url\(/.test(bi)) return false;                 // справжня картинка
      if (e.classList.contains('shade')) return false;      // затемнення під текстом
      return /gradient/.test(bi);
    });
    t('немає намальованого візерунка замість фото', decor.length === 0,
      decor.length ? `${decor.length}: ${getComputedStyle(decor[0]).backgroundImage.slice(0,42)}` : 'чисто');

    const stub = [...s.querySelectorAll(TXT)].filter(e => !e.children.length
      && /^(photo|image|фото|placeholder)\b|1920\s*[×x]\s*1080/i.test(e.textContent.trim()));
    t('немає підпису-заглушки замість зображення', stub.length === 0,
      stub.length ? `«${stub[0].textContent.trim().slice(0,32)}»` : 'чисто');

    // Транспонування мовчить, коли колонки різної довжини. Дані приходять по
    // колонках, а рендер рядковий; якщо в одній колонці на значення менше, усі
    // наступні з'їжджають на рядок вище — і таблиця виглядає бездоганно,
    // просто цифри стоять проти чужих назв. Це найдорожчий дефект з можливих:
    // око його не бачить, а рішення за такою таблицею ухвалюють.
    let jag = 0, jex = '';
    s.querySelectorAll('.tbl').forEach(tb => {
      const w = tb.querySelectorAll('.head > *').length;
      [...tb.querySelectorAll('.rows > .tr')].forEach((r, k) => {
        if (r.children.length !== w) { jag++;
          if (!jex) jex = `рядок ${k + 1}: ${r.children.length} проти ${w} у шапці`; }
      });
    });
    if (s.querySelector('.tbl')) t('у рядку стільки клітинок, скільки в шапці', jag === 0,
      jag ? jex : 'рівно');

    // Роздільник — одна лінія на всю панель, а не відрізок під кожною колонкою.
    // Колонковий порядок (.tcol > .rows > i) давав розриви рівно по проміжках
    // між колонками, і таблиця читалась як набір списків поруч. Міряється не
    // розмітка, а намальоване: ширина лінії проти внутрішньої ширини панелі.
    // Таблиця з `white-space:nowrap` не переповнюється й не обрізається — вона
    // РОЗСУВАЄТСЯ: table-layout:auto не вміє віддати менше, ніж треба вмісту, і
    // панель просто вилазить за свою смугу. Ні «текст не обрізаний», ні
    // «нічого не переповнене» цього не бачать, бо overflow лишається visible.
    // Через це шкала кегля була без верхньої межі: 38px «проходив» усюди.
    s.querySelectorAll('.sheet').forEach(sh => {
      const sb = sh.getBoundingClientRect();
      // Міряти треба КЛІТИНКИ, а не бокс таблиці: як flex-елемент таблиця
      // лишається шириною смуги, а вміст, який не влазить, просто виходить за
      // її межі. Перша версія цієї перевірки дивилась на бокс і бачила «у
      // межах» на слайді, де чотири з восьми колонок опинились за кадром.
      const tabs = [...sh.querySelectorAll('.tbl')];
      const far = tb => Math.max(...[...tb.querySelectorAll('.c, .h')]
        .map(c => c.getBoundingClientRect().right), tb.getBoundingClientRect().right);
      const wide = tabs.filter(tb => far(tb) > sb.right + 1);
      const spill = Math.max(0, ...tabs.map(tb => Math.round(far(tb) - sb.right)));
      t('таблиця не розсунула смугу', wide.length === 0,
        wide.length ? `${wide.length} з ${tabs.length} вилазять, найбільше на ${spill}px` : 'у межах');
    });

    let gaps = 0, worstCut = 0;
    s.querySelectorAll('.tbl').forEach(tb => {
      const o = getComputedStyle(tb);
      const b = tb.getBoundingClientRect();
      const l0 = b.left + parseFloat(o.paddingLeft), r0 = b.right - parseFloat(o.paddingRight);
      tb.querySelectorAll('.rows > .tr').forEach(row => {
        const cells = [...row.children].map(c => c.getBoundingClientRect())
          .sort((x, y) => x.left - y.left);
        if (!cells.length) return;
        // лінія малюється межею клітинки, тому вона рівно там, де клітинка:
        // міряємо, чи клітинки вкривають усю внутрішню ширину без пропусків
        let cut = Math.max(0, cells[0].left - l0) + Math.max(0, r0 - cells[cells.length - 1].right);
        for (let k = 1; k < cells.length; k++) cut += Math.max(0, cells[k].left - cells[k - 1].right);
        if (cut > 1) { gaps++; worstCut = Math.max(worstCut, Math.round(cut)); }
      });
    });
    if (s.querySelector('.tbl')) t('лінія таблиці суцільна', gaps === 0,
      gaps ? `${gaps} рядків із розривами, найбільший сумарно ${worstCut}px` : 'без розривів');

    // Назва стовпця вирівнюється так само, як його клітинки. Розбіжність видно
    // не одразу: сірий 18px ліворуч над числами праворуч виглядає як «шапка так
    // і задумана», поки не покласти поруч колонку тексту.
    let mis = 0, mex = '';
    s.querySelectorAll('.tbl').forEach(tb => {
      const hs = [...tb.querySelectorAll('.head > *')];
      const trs = [...tb.querySelectorAll('.rows > .tr')];
      hs.forEach((h, i) => {
        const cells = trs.map(r => r.children[i]).filter(Boolean);
        if (!cells.length) return;
        const a = cells.map(c => getComputedStyle(c).textAlign);
        if (!a.every(v => v === a[0])) return;      // мішана колонка — не судимо
        const ha = getComputedStyle(h).textAlign;
        if (ha !== a[0]) { mis++; if (!mex) mex = `«${h.textContent.trim()}» ${ha} проти ${a[0]}`; }
      });
    });
    if (s.querySelector('.tbl')) t('шапка вирівняна як колонка', mis === 0, mis ? mex : 'збігається');

    // Рідка таблиця має дихати вся, а не тільки між рядками. Коли рядків мало,
    // крок росте автоматично (space-between), а кегль і поле лишаються від
    // щільного випадку — виходить дрібний текст, прибитий до країв панелі,
    // у якої всередині повітря. Обидві межі міряються від КРОКУ рядка:
    //   поле по периметру ≈ крок / 3   (24 при кроці 75, 34 при кроці 99 —
    //                                   рівно ті числа, що в макетах Figma);
    //   крок / висота тексту ≤ 3.0     (та сама межа, що й для карток).
    s.querySelectorAll('.tbl').forEach(tb => {
      const trs = [...tb.querySelectorAll('.rows > .tr')];
      if (trs.length < 2) return;
      const tops = trs.map(r => r.getBoundingClientRect().top);
      const pitch = (tops[tops.length - 1] - tops[0]) / (trs.length - 1);
      let ih = 0;
      trs[0].querySelectorAll('*').forEach(e => { if (e.children.length || !e.textContent.trim()) return;
        const q = document.createRange(); q.selectNodeContents(e);
        ih = Math.max(ih, q.getBoundingClientRect().height); });
      const o = getComputedStyle(tb);
      const pad = Math.min(parseFloat(o.paddingLeft), parseFloat(o.paddingRight),
                           parseFloat(o.paddingTop), parseFloat(o.paddingBottom));
      // Стеля шкали — 32, і це не смак, а межа читання: вище рядок таблиці
      // перестає бути рядком і починає читатись як заголовок, а таблиця — як
      // список. 38 у першій версії було завелико, і це побачило око, не число.
      const fs = parseFloat(getComputedStyle(tb.querySelector('.c')).fontSize);
      t('кегль рядка не вище 32', fs <= 32, `${Math.round(fs)}px`);

      // Надлишок висоти йде в КРОК і ПОЛЕ, а не в літери. Коли рядків мало,
      // крок росте сам; якщо він виріс понад 3.0× тексту — коротшає ПАНЕЛЬ
      // (верх --sht піднімається, низ лишається 980), а кегль не надувається.
      t('крок не порожніший за 3.0× тексту', ih > 0 && pitch / ih <= 3.0,
        `крок ${Math.round(pitch)} / текст ${Math.round(ih)} = ${(pitch / ih).toFixed(2)}×`);
      // Межа двостороння. З односторонньою («не менше за третину кроку») поле
      // могло стояти константою 34 на всіх таблицях і однаково давати PASS —
      // саме так і було, а я звітував, що воно росте. Перевірка, яка не ловить
      // константу там, де має бути функція, нічого не перевіряє.
      // Допуск відносний, а не ±3px: крок залежить від кегля, а кегль зі шкали
      // стрибає на 6px, тому третина кроку рухається разом із ним. Жорсткий
      // ±3 давав FAIL на власному еталоні щоразу, коли кегль опускався на щабель.
      // 15% не рятує константу: поле 34 при кроці 61 — це +67%, і воно падає.
      t('поле панелі — третина кроку', Math.abs(pad - pitch / 3) <= Math.max(3, pitch / 3 * 0.15),
        `поле ${Math.round(pad)} при кроці ${Math.round(pitch)} (треба ${Math.round(pitch / 3)})`);
    });

    // Кегль — вимір із двома межами. «Не переповнено» я перевіряю завжди, а
    // «не недовикористано» забував: рядок висотою 114px із текстом 23px виглядає
    // акуратним, хоча половина картки — порожнеча, і текст міг бути крупнішим.
    // Поріг 3.0 узятий із виміру: найпорожніший рядок таблиці в еталоні — 2.50×.
    // Блоки тверджень (.says) навмисно повітряні, тому вони поза перевіркою.
    // Далі — тільки для слайдів з даними (.slide.data). На перебивці, адженді й
    // текстових блоках порожнеча внизу — задум, а не недоробка: там заповнювати
    // до 980 не треба, і рядків таблиці немає. Профіль вибирається класом слайда.
    const isData = s.classList.contains('data') || !s.classList.contains('basic');

    let airy = 0, worst = 0;
    if (isData) s.querySelectorAll('.r, .crow').forEach(r => {
      if (r.closest('.thead') || r.closest('.says')) return;
      const rh = r.getBoundingClientRect().height; if (rh < 10) return;
      let th = 0; r.querySelectorAll('*').forEach(e => {
        if (e.children.length || !e.textContent.trim()) return;
        const q = document.createRange(); q.selectNodeContents(e);
        th = Math.max(th, q.getBoundingClientRect().height); });
      if (th > 0) { const k = rh / th; worst = Math.max(worst, k); if (k > 3) airy++; } });
    if (worst) t('рядок не порожніший за 3.0× тексту', airy === 0, `${worst.toFixed(2)}×`);

    // Останній дитячий елемент слайда — це виноска, а вона за правилом займає
    // смугу 980–1080 і доходить до низу слайда завжди. Тому міряти його bottom
    // означало міряти 1080 на будь-якому слайді: перевірка не могла впасти
    // навіть тоді, коли контент закінчувався на 891. Міряємо низ найнижчої
    // картки поза виноскою — саме її й просить правило «заповнити до 980».
    let fill = 0;
    if (isData) {
      s.querySelectorAll(BOX).forEach(e => { if (e.closest('.note')) return;
        fill = Math.max(fill, e.getBoundingClientRect().bottom - S.top); });
      if (!fill) [...s.querySelectorAll(TXT)].forEach(e => {   // слайд без карток
        if (e.children.length || !e.textContent.trim() || e.closest('.note')) return;
        fill = Math.max(fill, ink(e).bottom - S.top); });
      t('контент доходить до 980', Math.round(fill) >= 960, Math.round(fill));
    }

    // Шкала адженди при переносі — одна лінія, що загорнулась, а не дві окремі.
    // Верхній ряд доводиться до ПРАВОГО краю слайда, нижній починається від
    // лівого. Без цього два ряди читаються як дві незалежні шкали — саме так
    // виглядав «Зміст» у живому деку: лінія від 01 до 04 і окремо від 05 до 06.
    const rowsTl = [...s.querySelectorAll('.tl-row')];
    if (rowsTl.length > 1) {
      const px = v => Math.round(v);
      const edge = (r, side) => {
        const el = r.querySelector('.tl-line');     // лінія — елемент з v34; ::before — деки до неї
        if (el) { const b = el.getBoundingClientRect(); return side === 'r' ? b.right : b.left; }
        const cs = getComputedStyle(r, '::before');
        const b = r.getBoundingClientRect();
        const left = b.left + parseFloat(cs.left || 0);
        return side === 'r' ? left + parseFloat(cs.width || 0) : left;
      };
      const first = rowsTl[0], last = rowsTl[rowsTl.length - 1];
      t('верхня шкала адженди доходить до правого краю',
        Math.abs(edge(first, 'r') - S.right) <= 2, px(edge(first, 'r') - S.right));
      t('нижня шкала адженди починається від лівого краю',
        Math.abs(edge(last, 'l') - S.left) <= 2, px(edge(last, 'l') - S.left));
    }

    console.log(`── слайд ${i + 1}\n   ` + say.join('\n   '));
  });
  spacer.remove();
  /* ── ритм дека: перевірка не про слайд, а про послідовність ────────────────
     Окремо кожен слайд може бути бездоганним, а дек однаково читається як
     стіна тексту: двадцять два темні слайди підряд, і жодної візуальної
     зупинки. Це видно тільки на всій послідовності, тому вимір тут, а не в
     циклі. Зупинка — фото (обкладинка, пів екрана) або суцільний червоний. */
  const slides = [...document.querySelectorAll('.slide')];
  const catalogue = !!document.querySelector('.stage.catalogue');
  const stop = s => {
    if (s.querySelector('.pic, .cover, .bul .ph, [class*=photo]')) return true;
    if (/url\(/.test(getComputedStyle(s).backgroundImage)) return true;
    const bg = getComputedStyle(s).backgroundColor.match(/\d+/g).map(Number);
    return bg[0] > 150 && bg[0] > bg[1] * 1.8 && bg[0] > bg[2] * 1.8;
  };
  const marks = slides.map(stop);
  let run = 0, longest = 0;
  marks.forEach(m => { if (m) run = 0; else { run++; longest = Math.max(longest, run); } });
  const ends = marks.length > 1 && marks[0] && marks[marks.length - 1];
  console.log(`\n── дек: ${marks.filter(Boolean).length} зупинок на ${marks.length} слайдів`
    + `, найдовший відрізок без зупинки ${longest}`);
  const say2 = (name, ok, val) => { if (!ok) fails++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}: ${val}`); };

  // Шрифт лежить у самому файлі, а не в системі глядача. Правило v29: зріз
  // Inter вбудований як data: URI. Перевірка структурна, бо виміряти «той
  // самий шрифт» зсередини не можна: на машині БЕЗ Inter фолбек змінює
  // переноси, і всі виміри вище зроблені іншим деком, ніж побачить глядач.
  // Пʼять дефектів еталона жили саме так — у рендері, якого «ні в кого немає».
  const faces = [...document.styleSheets].flatMap(ss => { try { return [...ss.cssRules]; } catch { return []; } })
    .filter(r => r instanceof CSSFontFaceRule)
    .filter(r => /inter/i.test(r.style.getPropertyValue('font-family')));
  const embedded = faces.some(r => /url\(\s*["']?data:/i.test(r.style.getPropertyValue('src')));
  say2('шрифт Inter вбудований у файл як data: URI', embedded,
    faces.length ? (embedded ? 'є' : '@font-face є, але src не data:') : '@font-face немає');

  // Дек не тягне нічого з мережі. DC-бандл (текст у скриптах, який
  // завантаження розгортає в розмітку) — властивість платформи і допустимий
  // формат: інструменти міряють відрендерений DOM. А от зовнішній ресурс —
  // дефект завжди: файл, що залежить від мережі, у когось відкриється без
  // шрифту, у когось без фону, і перевірений дек перестане бути перевіреним.
  const external = [...document.querySelectorAll('script[src], link[href], img[src], source[src], iframe[src]')]
    .map(e => e.src || e.href || '')
    .filter(u => /^https?:/i.test(u)).length;
  say2('жодного ресурсу з мережі', external === 0,
    external ? `${external} зовнішніх посилань` : 'чисто');
  if (catalogue) {
    // Еталон — каталог типів, а не дек: порядок у ньому за типами, і дванадцять
    // текстових типів поспіль тут законні. Виняток названий вголос і друкується,
    // щоб його не можна було тихо застосувати до справжнього дека.
    console.log('  каталог типів — ритм не міряється (у деку ці дві перевірки обовʼязкові)');
  } else {
    say2('не більше 4 слайдів без зупинки', longest <= 4, `найдовший відрізок ${longest}`);
    say2('перший і останній слайди — зупинки', ends,
      `${marks[0] ? 'так' : 'ні'} / ${marks[marks.length - 1] ? 'так' : 'ні'}`);

    // Обкладинка — фото, а не суцільний червоний. Червоне тло законне як
    // перебивка РОЗДІЛУ всередині дека; на першому слайді воно з'їдає єдину
    // нагоду поставити образ, і дек починається з плаката. Коли на слайді лише
    // заголовок — місця під фото більше нема куди дівати.
    const photo = e => !!e.querySelector('.pic, .cover, [class*=photo], img[class*=bg]')
      || /url\(/.test(getComputedStyle(e).backgroundImage);
    const first = slides[0];
    if (first) {
      const bare = !first.querySelector('.band,.sheet,.cols,.subs,.rails,.bul,.right,.tl,.card');
      if (bare) say2('обкладинка — фото, не червоний', photo(first),
        photo(first) ? 'фото' : 'фото немає');
    }

    // Варіативність. Один тип, застосований до всього, що має стовпчики, дає
    // дек, у якому кожен слайд схожий на попередній — окремо кожен правильний,
    // разом читати нецікаво. Тип визначається розкладковим класом, а не змістом.
    const LAY = ['band','sheet','cols','subs','rails','bul','right','tl','tt'];
    const kind = e => LAY.find(c => e.querySelector('.' + c)) || '—';
    const kinds = slides.map(kind);
    let same = 1, worst = 1, at = '';
    for (let k = 1; k < kinds.length; k++) {
      if (kinds[k] === kinds[k - 1] && kinds[k] !== '—') { same++;
        if (same > worst) { worst = same; at = `${kinds[k]} на слайдах ${k + 2 - same}–${k + 1}`; } }
      else same = 1;
    }
    say2('не більше 2 слайдів підряд одного типу', worst <= 2, worst > 2 ? at : `найдовше ${worst}`);
  }

  console.log(fails === 0 ? '\n✅ усі перевірки зелені' : `\n❌ ${fails} FAIL — показувати ще рано`);
})();
