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

  /* ---------- Формы заявок -> Telegram (через прокси) ----------
     Токен бота НЕ хранится в коде сайта: форма отправляет JSON на LEAD_ENDPOINT,
     а прокси (см. electrify-lead-proxy) добавляет токен и пересылает сообщение в группу Telegram.
     Впишите адрес прокси ниже. Пока адрес пустой, форма покажет сообщение «Не удалось отправить». */
  var LEAD_ENDPOINT = '';
  var pageLoaded = Date.now();

  function fieldLabel(form, el) {
    var l = el.id ? form.querySelector('label[for="' + el.id + '"]') : null;
    return l ? l.childNodes[0].textContent.trim() : el.name;
  }

  function collect(form) {
    var fields = [];
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.name === 'website' || el.type === 'checkbox' || el.type === 'submit' || el.tagName === 'BUTTON') return;
      var v = (el.value || '').trim();
      if (v) fields.push({ label: fieldLabel(form, el), value: v.slice(0, 1500) });
    });
    return { fields: fields, consent: true, page: document.title, url: location.href };
  }

  function sendLead(payload) {
    if (!LEAD_ENDPOINT) return Promise.reject(new Error('no endpoint'));
    return fetch(LEAD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); });
  }

  document.querySelectorAll('form[data-lead]').forEach(function (form) {
    var box = form.parentElement;
    var ok = box.querySelector('.form-ok');
    var err = box.querySelector('.form-err');
    var btn = form.querySelector('button[type=submit]');
    var phone = form.querySelector('input[name=phone]');
    if (phone) phone.addEventListener('input', function () { phone.setCustomValidity(''); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (ok) ok.style.display = 'none';
      if (err) err.style.display = 'none';
      if (phone) {
        var digits = phone.value.replace(/\D/g, '');
        phone.setCustomValidity(digits.length >= 9 ? '' : 'Укажите номер телефона полностью');
      }
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var trap = form.querySelector('input[name=website]');
      var isBot = (trap && trap.value) || (Date.now() - pageLoaded < 1500);
      var label = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Отправляем…'; }
      var job = isBot ? Promise.resolve() : sendLead(collect(form));
      job.then(function () {
        if (ok) ok.style.display = 'block';
        form.reset();
        if (btn) btn.textContent = 'Заявка отправлена';
      }).catch(function () {
        if (err) err.style.display = 'block';
        if (btn) { btn.disabled = false; btn.textContent = label; }
      });
    });
  });
})();
