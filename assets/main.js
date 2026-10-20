/* electrify.minsk — скрипты сайта */
(function () {
  'use strict';

  /* Мобильное меню */
  var burger = document.querySelector('.burger');
  var nav = document.getElementById('nav');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* Плавное появление блоков */
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }

  /* Год в подвале */
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  /* ---------- Калькулятор ориентировочной стоимости ----------
     ВСЕ ЦИФРЫ НИЖЕ — ориентиры для чернового макета. Замените на свои. */
  var CONFIG = {
    packages: {
      eco:   { name: 'Эконом (розетка + защищённая линия)', base: 650,  includedMeters: 10, perMeter: 20 },
      s7:    { name: 'Стандарт 7 кВт (wallbox)',            base: 1250, includedMeters: 10, perMeter: 20 },
      s11:   { name: 'Стандарт 11 кВт (wallbox)',           base: 1650, includedMeters: 10, perMeter: 30 },
      p22:   { name: 'Премиум 22 кВт (smart wallbox)',      base: 2500, includedMeters: 10, perMeter: 40 }
    },
    hiddenWiring: { fixed: 80, meterFactor: 1.8 },     // скрытая прокладка (штроба)
    approval: 120,                                      // согласование для многоквартирного дома / паркинга
    region: { minsk: 0, near: 60, far: 120 },           // выезд: Минск / область до 30 км / область до 80 км
    spread: 0.12                                        // ширина вилки ± от расчётной суммы
  };

  var calc = document.getElementById('calc');
  if (calc) {
    var f = calc.querySelector('form');
    var out = document.getElementById('calc-sum');
    var list = document.getElementById('calc-list');
    var meters = document.getElementById('c-meters');
    var mval = document.getElementById('c-meters-val');

    var fmt = function (n) { return Math.round(n / 10) * 10; };
    var nf = new Intl.NumberFormat('ru-RU');

    var recalc = function () {
      var p = CONFIG.packages[f.elements['pkg'].value];
      var m = +meters.value;
      mval.textContent = m + ' м';
      var hidden = f.elements['wiring'].value === 'hidden';
      var extra = Math.max(0, m - p.includedMeters);
      var perMeter = p.perMeter * (hidden ? CONFIG.hiddenWiring.meterFactor : 1);
      var total = p.base + extra * perMeter;
      var rows = ['Пакет: ' + p.name, 'Трасса до щитка: ' + m + ' м (в пакет входит ' + p.includedMeters + ' м)'];
      if (hidden) { total += CONFIG.hiddenWiring.fixed; rows.push('Скрытая прокладка в штробе'); }
      else { rows.push('Открытая прокладка (кабель-канал / гофра)'); }
      if (f.elements['mkd'].checked) { total += CONFIG.approval; rows.push('Помощь с согласованием в доме / паркинге'); }
      var reg = f.elements['region'].value;
      total += CONFIG.region[reg];
      if (reg !== 'minsk') rows.push('Выезд в Минскую область');
      var lo = fmt(total * (1 - CONFIG.spread)), hi = fmt(total * (1 + CONFIG.spread));
      out.textContent = nf.format(lo) + ' – ' + nf.format(hi) + ' BYN';
      list.innerHTML = rows.map(function (r) { return '<li>' + r + '</li>'; }).join('');
    };
    f.addEventListener('input', recalc);
    f.addEventListener('change', recalc);
    recalc();
  }

  /* ---------- Формы заявок ----------
     ЗАГЛУШКА: сейчас форма только показывает сообщение об успехе.
     Для боевой версии замените на отправку (fetch на ваш API / Telegram-бот / CRM). */
  document.querySelectorAll('form[data-lead]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var ok = form.parentElement.querySelector('.form-ok') || form.querySelector('.form-ok');
      if (ok) ok.style.display = 'block';
      form.querySelectorAll('input:not([type=checkbox]), textarea, select').forEach(function (el) { el.value = ''; });
      var btn = form.querySelector('button[type=submit]');
      if (btn) { btn.disabled = true; btn.textContent = 'Заявка отправлена'; }
    });
  });
})();
