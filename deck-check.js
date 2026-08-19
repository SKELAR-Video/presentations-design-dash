/* SKELAR · сторож усередині дека. Блок копіюється в кінець кожного
   згенерованого дека дослівно, обгорнутим у <script data-skelar-check>.
   Користувач бачить лише файл — тож дек, у якому є дефект, сам показує
   червоний банер НЕ ЗАВЕРШЕНО. Здати такий файл як готовий неможливо.
   В'юер показує слайди по одному, тому сторож доміряє кожен слайд у
   момент, коли той стає видимим (перегортання). Банер позначений
   data-skelar-banner: зовнішні виміри (check.js/audit.js) зрізають його. */
(() => {
  const checked = new WeakSet();
  const fails = [];
  const findSlides = () => {
    const size = e => { const b = e.getBoundingClientRect();
      if (!b.width) return true;                        // схований: розмір дасть клон
      return b.width > 300 && Math.abs(b.width / Math.max(b.height, 1) - 16 / 9) < 0.06; };
    // Спершу за іменем (slide, skl-slide, будь-який *slide*), потім за геометрією.
    let c = [...document.querySelectorAll('[class*="slide"]')].filter(size);
    if (!c.length) c = [...document.querySelectorAll('section,div')].filter(size);
    c = c.filter(e => !e.hasAttribute('data-dc-tpl') && !e.closest('[data-dc-tpl]'));
    // Внутрішні, не обгортки: лишаємо ті, всередині яких немає інших кандидатів.
    return c.filter(e => !c.some(o => o !== e && e.contains(o)));
  };
  const measure = (s, idx) => {
    const S = s.getBoundingClientRect();
    const k = 1920 / S.width;
    const leaf = [...s.querySelectorAll('div,span,b,em,i,p,h1,h2')]
      .filter(e => !e.children.length && e.textContent.trim())
      .filter(e => e.getBoundingClientRect().width > 0);
    const boxes = leaf.map(e => { const b = e.getBoundingClientRect();
      return { e, t: e.textContent.trim().slice(0, 24), l: b.left, r: b.right, tp: b.top, bt: b.bottom }; });
    for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
      const A = boxes[a], B = boxes[b];
      const ox = Math.min(A.r, B.r) - Math.max(A.l, B.l);
      const oy = Math.min(A.bt, B.bt) - Math.max(A.tp, B.tp);
      if (ox * k > 6 && oy * k > 6) { fails.push(`слайд ${idx}: «${A.t}» × «${B.t}»`); b = boxes.length; }
    }
    boxes.forEach(B => { if (B.e.closest('.note')) return;
      const bt = (B.bt - S.top) * k;
      if (bt > 1005) fails.push(`слайд ${idx}: «${B.t}» нижче 980 (${Math.round(bt)})`); });
  };
  const banner = () => {
    document.querySelectorAll('[data-skelar-banner]').forEach(e => e.remove());
    if (!fails.length) return;
    const el = document.createElement('div');
    el.setAttribute('data-skelar-banner', '');
    el.style.cssText = 'position:fixed;top:12px;right:12px;z-index:99999;background:#FD3433;color:#fff;'
      + 'font:500 14px/1.45 Inter,system-ui,sans-serif;padding:14px 18px;max-width:520px;white-space:pre-wrap';
    el.textContent = 'НЕ ЗАВЕРШЕНО — дек не пройшов власну перевірку (' + fails.length + '):\n'
      + fails.slice(0, 6).join('\n') + (fails.length > 6 ? `\n…і ще ${fails.length - 6}` : '');
    document.body.appendChild(el);
    console.warn('[skelar deck-check]', fails);
  };
  const run = () => {
    const all = findSlides();
    all.forEach((s, i) => {
      if (checked.has(s)) return;
      checked.add(s);
      const vis = s.getBoundingClientRect().width > 0 && getComputedStyle(s).visibility !== 'hidden';
      if (vis) { measure(s, i + 1); return; }
      // В'юер тримає слайд схованим — міряємо офскрін-клон: сторож не має
      // права чекати, поки користувач догорнe до дефекту.
      const host = document.createElement('div');
      host.setAttribute('data-skelar-banner', '');
      host.style.cssText = 'position:absolute;left:-99999px;top:0;width:1920px;height:1080px;overflow:visible';
      const c = s.cloneNode(true);
      c.style.cssText = 'display:block;visibility:visible;position:relative;width:1920px;height:1080px;transform:none;margin:0';
      host.appendChild(c); document.body.appendChild(host);
      measure(c, i + 1);
      host.remove();
    });
    banner();
  };
  const kick = () => setTimeout(run, 700);
  if (document.readyState === 'complete') setTimeout(run, 900);
  else window.addEventListener('load', () => setTimeout(run, 900));
  window.addEventListener('click', kick, true);
  window.addEventListener('keyup', kick, true);
})();
