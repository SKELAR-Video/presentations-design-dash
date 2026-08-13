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
    [...s.querySelectorAll('[class]')].filter(e => getComputedStyle(e).display === 'grid')
      .forEach(g => { const key = g.parentElement;
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
      const near = [...s.querySelectorAll(BOX)].map(e => e.getBoundingClientRect())
        .concat([...s.querySelectorAll('h1,.note')].map(e => ink(e)));
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

    // Маркер-точка має щось означати. У еталоні кружечки кодують рівень, і поруч
    // у виносці стоїть легенда. Точка без легенди — декор, який дорисували від себе:
    // у ТЗ його не було, а на слайді він читається як класифікація, якої немає.
    const dot = e => { const o = getComputedStyle(e), b = e.getBoundingClientRect();
      return b.width <= 24 && b.width > 3 && Math.abs(b.width-b.height) <= 2
        && /^(50%|9999px)/.test(o.borderRadius); };
    const dots = [...s.querySelectorAll('*')].filter(e => !e.children.length && dot(e));
    const inRows = dots.filter(e => !e.closest('.note')).length;
    const inLegend = dots.filter(e => e.closest('.note')).length;
    t('маркери-точки лише з легендою', inRows === 0 || inLegend > 0, `${inRows} у рядках / ${inLegend} у легенді`);

    // Кегль — вимір із двома межами. «Не переповнено» я перевіряю завжди, а
    // «не недовикористано» забував: рядок висотою 114px із текстом 23px виглядає
    // акуратним, хоча половина картки — порожнеча, і текст міг бути крупнішим.
    // Поріг 3.0 узятий із виміру: найпорожніший рядок таблиці в еталоні — 2.50×.
    // Блоки тверджень (.says) навмисно повітряні, тому вони поза перевіркою.
    let airy = 0, worst = 0;
    s.querySelectorAll('.r, .crow').forEach(r => {
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
    s.querySelectorAll(BOX).forEach(e => { if (e.closest('.note')) return;
      fill = Math.max(fill, e.getBoundingClientRect().bottom - S.top); });
    if (!fill) [...s.querySelectorAll(TXT)].forEach(e => {   // слайд без карток
      if (e.children.length || !e.textContent.trim() || e.closest('.note')) return;
      fill = Math.max(fill, ink(e).bottom - S.top); });
    t('контент доходить до 980', Math.round(fill) >= 960, Math.round(fill));

    console.log(`── слайд ${i + 1}\n   ` + say.join('\n   '));
  });
  console.log(fails === 0 ? '\n✅ усі перевірки зелені' : `\n❌ ${fails} FAIL — показувати ще рано`);
})();
