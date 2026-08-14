/* SKELAR · перевірка слайда з даними.
   Відкрий згенерований HTML у браузері, встав це в консоль, натисни Enter.
   Кожен рядок — вимір, а не думка. FAIL означає, що слайд показувати ще рано. */
(() => {
  const st = document.querySelector('.stage'); if (st) st.style.zoom = 1;
  const ink = el => { const r = document.createRange(); r.selectNodeContents(el);
    const rs = [...r.getClientRects()]; if (!rs.length) return el.getBoundingClientRect();
    return { left: Math.min(...rs.map(x=>x.left)), right: Math.max(...rs.map(x=>x.right)),
             top: Math.min(...rs.map(x=>x.top)), bottom: Math.max(...rs.map(x=>x.bottom)) }; };
  const BOX = '[class*=card],[class*=kpi],[class*=box],[class*=panel],.tw,.col';
  const TXT = 'div,span,b,em,i,p,h1,h2';
  let fails = 0;
  document.querySelectorAll('.slide').forEach((s, i) => {
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
    [...rows.values()].forEach(group => { if (group.length < 2) return;
      const n = group[0].children.length;
      for (let c = 0; c < n; c++) {
        const xs = new Set(group.map(g => g.children[c] && Math.round(g.children[c].getBoundingClientRect().left)));
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
    const badSrc = [...s.querySelectorAll('img')]
      .filter(e => { const v = e.getAttribute('src') || ''; return !/^(data:|https?:)/.test(v); });
    t('усі картинки вбудовані або за абсолютним посиланням', badSrc.length === 0,
      badSrc.length ? `${badSrc.length}: «${badSrc[0].getAttribute('src').slice(0, 34)}»` : 0);

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

    console.log(`── слайд ${i + 1}\n   ` + say.join('\n   '));
  });
  console.log(fails === 0 ? '\n✅ усі перевірки зелені' : `\n❌ ${fails} FAIL — показувати ще рано`);
})();
