(function () {
  'use strict';

  window.__site = true;

  var root = document.documentElement;
  var motion = root.classList.contains('motion');
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var desktop = window.matchMedia('(min-width: 1081px)');

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function clamp(v, a, b) { return Math.max(a === undefined ? 0 : a, Math.min(b === undefined ? 1 : b, v)); }
  function ease(t) { return t * t * (3 - 2 * t); }
  function seg(p, a, b) { return clamp((p - a) / (b - a)); }

  /* ---------- 逐字拆分 ---------- */

  var TOKEN = /[A-Za-z0-9][A-Za-z0-9.,%\-]*|\s+|[\s\S]/g;
  var CLOSE = /^[，。、；：？！）”’》」]$/;
  var OPEN = /^[（“‘《「]$/;

  function split(el) {
    var full = el.textContent.replace(/\s+/g, ' ').trim();
    var index = 0;

    function wrap(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 1) {
          if (child.tagName !== 'BR') wrap(child);
          return;
        }
        if (child.nodeType !== 3) return;
        var tokens = child.nodeValue.match(TOKEN) || [];
        var frag = document.createDocumentFragment();
        var last = null;
        var hold = '';
        tokens.forEach(function (tok) {
          if (/^\s+$/.test(tok)) {
            frag.appendChild(document.createTextNode(' '));
            last = null;
            return;
          }
          /* 开括号跟后一个字走，避免留在行尾 */
          if (OPEN.test(tok)) {
            hold += tok;
            return;
          }
          /* 标点跟前一个字走，避免出现在行首 */
          if (last && CLOSE.test(tok)) {
            last.textContent += tok;
            return;
          }
          var span = document.createElement('span');
          span.className = 'ch';
          span.style.setProperty('--i', index++);
          span.textContent = hold + tok;
          hold = '';
          frag.appendChild(span);
          last = span;
        });
        node.replaceChild(frag, child);
      });
    }

    wrap(el);
    /* 屏幕阅读器读完整句，不读单字 */
    Array.prototype.slice.call(el.childNodes).forEach(function (n) {
      if (n.nodeType === 1) n.setAttribute('aria-hidden', 'true');
    });
    var sr = document.createElement('span');
    sr.className = 'vh';
    sr.textContent = full;
    el.appendChild(sr);
    el.classList.add('split');
  }

  if (motion) {
    $$('h1, h2, .pull, .claim, .case__text h3, .study h3').forEach(split);

    /* 成组依次进场 */
    $$('.trio, .fields, .howto, .logos, .stats, .honors, .values, .goals, .facts').forEach(function (group) {
      group.classList.add('group');
      if (!group.classList.contains('reveal')) group.classList.add('reveal');
      Array.prototype.slice.call(group.children).forEach(function (child, i) {
        child.classList.add('rise');
        child.style.setProperty('--d', Math.min(i, 8));
      });
    });

    /* 成果图：包一层遮罩 */
    $$('.case__fig img').forEach(function (img) {
      var mask = document.createElement('div');
      mask.className = 'mask';
      img.parentNode.insertBefore(mask, img);
      mask.appendChild(img);
    });
  }

  /* ---------- 进入动效 ---------- */

  var items = $$('.reveal');
  if (!motion || !('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        if (entry.target.classList.contains('stats')) countUp(entry.target);
        seen.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.04 });
    items.forEach(function (el) { seen.observe(el); });
  }

  /* 数字滚动：结束时一定落回原文 */
  function countUp(box) {
    $$('b', box).forEach(function (b, n) {
      var node = b.firstChild;
      if (!node || node.nodeType !== 3) return;
      var text = node.nodeValue;
      var value = parseFloat(text.replace(/,/g, ''));
      if (isNaN(value)) return;
      var decimals = (text.split('.')[1] || '').length;
      var begin = performance.now() + n * 70;
      var span = 1700;
      function fmt(v) {
        var s = v.toFixed(decimals).split('.');
        s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return s.join('.');
      }
      function step(now) {
        var t = clamp((now - begin) / span);
        if (t >= 1) { node.nodeValue = text; return; }
        node.nodeValue = fmt(value * (1 - Math.pow(1 - t, 4)));
        requestAnimationFrame(step);
      }
      node.nodeValue = fmt(0);
      requestAnimationFrame(step);
    });
  }

  /* ---------- 顶栏与导航 ---------- */

  var top = $('.top');
  var btn = $('.menu-btn');
  var nav = $('#nav');

  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    top.classList.toggle('is-open', open);
    if (open) top.classList.remove('is-hidden');
    btn.setAttribute('aria-expanded', String(open));
    btn.firstElementChild.textContent = open ? '关闭' : '菜单';
  }
  btn.addEventListener('click', function () { setMenu(!nav.classList.contains('is-open')); });
  nav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') setMenu(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setMenu(false);
  });

  var links = $$('a[href^="#"]', nav);
  var ind = document.createElement('span');
  ind.className = 'nav__ind';
  ind.setAttribute('aria-hidden', 'true');
  nav.appendChild(ind);

  function moveInd(a) {
    if (!a || a.classList.contains('nav__cta')) { ind.style.setProperty('--o', 0); return; }
    ind.style.setProperty('--o', 1);
    ind.style.setProperty('--x', a.offsetLeft + 'px');
    ind.style.setProperty('--w', a.offsetWidth + 'px');
  }

  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var here = null;
        links.forEach(function (a) {
          var on = a.getAttribute('href') === '#' + entry.target.id;
          a.classList.toggle('is-here', on);
          if (on) here = a;
        });
        moveInd(here);
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(function (a) {
      var sec = $(a.getAttribute('href'));
      if (sec) spy.observe(sec);
    });
  }

  /* ---------- 平滑滚动 ---------- */

  var lenis = null;
  if (motion && window.Lenis) {
    lenis = new window.Lenis({ autoRaf: false, lerp: 0.095, wheelMultiplier: 0.95 });
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || !lenis) return;
    var id = a.getAttribute('href').slice(1);
    var target = id === 'top' ? 0 : document.getElementById(id);
    if (target === null) return;
    e.preventDefault();
    lenis.scrollTo(target, {
      offset: 0,
      duration: 1.5,
      easing: function (t) { return 1 - Math.pow(1 - t, 4); }
    });
    if (target && target.focus) {
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
    history.replaceState(null, '', '#' + id);
  });

  /* ---------- 滚动联动 ---------- */

  var hero = $('.hero');
  var heroIn = $('.hero__in');
  var canvas = $('#evolve');
  var bar = $('.progress');
  var loop4 = $('.loop4');
  var loopItems = loop4 ? Array.prototype.slice.call(loop4.children) : [];
  var pin = $('.pin');
  var steps = $$('.steps li');
  var nodes = $$('.nodes g');
  var r2 = $('.r2');
  var label = $('.c2');
  var contact = $('#contact');
  var parallax = $$('.duo .mask img');
  var LABELS = ['AI 设计方案', '打分、留痕', '校准世界', '给自己造工具', '下一圈'];

  var m = { vh: 1, vw: 1, max: 1, loop: 0, pin: 0, pinLen: 1, contact: 0, contactLen: 1, par: [] };
  var lastY = -1;
  var lastStep = -1;
  var lastDir = 0;
  var dirY = 0;
  var dirty = true;

  function pageTop(el) {
    return el.getBoundingClientRect().top + window.scrollY;
  }

  function measure() {
    m.vh = window.innerHeight;
    m.vw = window.innerWidth;
    m.max = Math.max(1, document.documentElement.scrollHeight - m.vh);
    if (loop4) m.loop = pageTop(loop4);
    if (pin) {
      m.pin = pageTop(pin);
      m.pinLen = Math.max(1, pin.offsetHeight - m.vh);
    }
    if (contact) {
      m.contact = pageTop(contact);
      /* 高屏上页面到底时也要能完全展开 */
      m.contactLen = Math.max(1, Math.min(m.vh * 0.72, contact.offsetHeight * 0.8));
    }
    m.par = parallax.map(function (img) {
      var box = img.parentNode.getBoundingClientRect();
      return { img: img, top: box.top + window.scrollY, h: box.height };
    });
    dirty = true;
  }

  function update(y) {
    if (y === lastY && !dirty) return;
    dirty = false;

    bar.style.transform = 'scaleX(' + clamp(y / m.max).toFixed(4) + ')';

    /* 顶栏：向下收起，向上出现 */
    if (y < m.vh * 0.5) {
      top.classList.remove('is-hidden');
    } else if (Math.abs(y - dirY) > 14) {
      var dir = y > dirY ? 1 : -1;
      if (dir !== lastDir && !nav.classList.contains('is-open')) {
        top.classList.toggle('is-hidden', dir > 0);
        lastDir = dir;
      }
      dirY = y;
    }
    top.classList.toggle('is-stuck', y > 40);

    /* 首屏：内容上移淡出，叶片缓慢放大 */
    var h = clamp(y / m.vh);
    if (h < 1) {
      heroIn.style.transform = 'translate3d(0,' + (-h * 90).toFixed(1) + 'px,0)';
      heroIn.style.opacity = clamp(1 - h * 1.5).toFixed(3);
      canvas.style.transform = 'scale(' + (1 + h * 0.07).toFixed(4) + ')';
      canvas.style.opacity = (1 - h * 0.55).toFixed(3);
      hero.style.visibility = '';
    } else {
      hero.style.visibility = 'hidden';
    }

    /* 想 做 验 改 */
    if (loop4) {
      var lp = clamp((m.vh * 0.86 - (m.loop - y)) / (m.vh * 0.62));
      loop4.style.setProperty('--lp', lp.toFixed(3));
      var now = Math.min(3, Math.floor(lp * 4));
      loopItems.forEach(function (li, i) {
        li.style.setProperty('--a', ease(clamp(lp * 4.4 - i)).toFixed(3));
        li.classList.toggle('is-now', i === now && lp > 0.02 && lp < 1);
      });
    }

    /* 叶片视差 */
    m.par.forEach(function (p) {
      var c = (p.top + p.h / 2 - y - m.vh / 2) / m.vh;
      if (c < -1.2 || c > 1.2) return;
      p.img.style.transform = 'translate3d(0,' + (c * -5.5).toFixed(2) + '%,0) scale(1.14)';
    });

    /* 飞轮 */
    if (pin && desktop.matches) {
      var fp = clamp((y - m.pin) / m.pinLen);
      r2.style.setProperty('--o', (100 - fp * 100).toFixed(2));
      var step = Math.min(4, Math.floor(fp * 5));
      if (step !== lastStep) {
        lastStep = step;
        steps.forEach(function (li, i) { li.classList.toggle('is-on', i <= step); });
        nodes.forEach(function (g, i) { g.classList.toggle('is-on', i <= step); });
        label.textContent = LABELS[step];
      }
    }

    /* 联系区展开 */
    if (contact) {
      var cp = clamp((y + m.vh - m.contact) / m.contactLen);
      var k = 1 - ease(cp);
      /* 窄屏留白小，边距收得比留白更窄，避免裁到文字 */
      var side = k * (m.vw < 820 ? 3 : 7);
      contact.style.clipPath = k < 0.002
        ? 'none'
        : 'inset(0 ' + side.toFixed(2) + '% 0 ' + side.toFixed(2) + '% round ' + (k * 40).toFixed(1) + 'px ' + (k * 40).toFixed(1) + 'px 0 0)';
    }

    lastY = y;
  }

  /* ---------- 指针交互 ---------- */

  if (fine && motion) {
    $$('.btn, .nav__cta').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = e.clientX - r.left - r.width / 2;
        var dy = e.clientY - r.top - r.height / 2;
        el.style.transform = 'translate3d(' + (dx * 0.22).toFixed(1) + 'px,' + (dy * 0.3).toFixed(1) + 'px,0)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }
  if (fine) {
    $$('.loop4 li, .study').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
      });
    });
  }

  /* ---------- 首屏画布 ---------- */

  var ctx = canvas && canvas.getContext('2d');

  var COUNT = 130;
  var SAMPLES = 34;
  var CYCLE = 17000;
  var FLOW = 120;
  var TARGET = [0.38, 0.12, 0.84, -0.22, -0.84, 0.095];
  var HOLES = [0.035, 0.1, 0.19, 0.3, 0.42, 0.53, 0.63, 0.72, 0.8, 0.87, 0.93];
  var HEAT = [
    [0, '#fde7a9'], [0.14, '#f9a93a'], [0.3, '#ea6a32'], [0.52, '#c13b5b'],
    [0.74, '#ed7a2c'], [0.9, '#fbb643'], [1, '#fff1c4']
  ];

  var W = 0, H = 0, dpr = 1, scale = 1, ox = 0, oy = 0;
  var pop = [], flow = [], clock = 0, lastT = 0;
  var cache = null;
  var mx = 0, my = 0, px = 0, py = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function seed() {
    pop = [];
    for (var i = 0; i < COUNT; i++) {
      pop.push({
        g: [
          TARGET[0] + rand(-0.2, 0.26), TARGET[1] + rand(-0.26, 0.3),
          TARGET[2] + rand(-0.28, 0.2), TARGET[3] + rand(-0.34, 0.36),
          TARGET[4] + rand(-0.26, 0.42), TARGET[5] + rand(-0.05, 0.08)
        ],
        rate: rand(0.7, 1.15),
        die: i < 10 ? 2 : rand(0.1, 0.56)
      });
    }
  }

  function spawn(p, anywhere) {
    var side = Math.random() < 0.5 ? -1 : 1;
    p.s = anywhere ? rand(-0.32, 1.28) : rand(-0.42, -0.28);
    p.d = side * (0.075 + Math.pow(Math.random(), 1.5) * 0.52);
    p.v = rand(0.00011, 0.00022);
    p.a = rand(0.16, 0.5);
    p.len = rand(0.018, 0.05);
    p.life = 0;
  }

  function seedFlow() {
    flow = [];
    for (var i = 0; i < FLOW; i++) {
      var p = {};
      spawn(p, true);
      flow.push(p);
    }
  }

  function bez(p0, p1, p2, p3, t) {
    var u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  }
  function dbez(p0, p1, p2, p3, t) {
    var u = 1 - t;
    return 3 * u * u * (p1 - p0) + 6 * u * t * (p2 - p1) + 3 * t * t * (p3 - p2);
  }
  function centre(g, s) {
    var x = bez(0, g[0], g[2], 1, s), y = bez(0, g[1], g[3], g[4], s);
    var dx = dbez(0, g[0], g[2], 1, s), dy = dbez(0, g[1], g[3], g[4], s);
    var len = Math.hypot(dx, dy) || 1;
    return { x: x, y: y, nx: -dy / len, ny: dx / len };
  }
  function thick(g, s) {
    return g[5] * 1.72 * Math.pow(s, 0.46) * Math.pow(1 - s, 0.9) + 0.0035;
  }
  function X(v) { return ox + v * scale; }
  function Y(v) { return oy - v * scale; }

  function trace(c, g) {
    var i, s, p, t, up = [], lo = [];
    for (i = 0; i <= SAMPLES; i++) {
      s = i / SAMPLES;
      s = s * s * (1.6 - 0.6 * s);
      p = centre(g, s);
      t = thick(g, s);
      up.push(X(p.x + p.nx * t), Y(p.y + p.ny * t));
      lo.push(X(p.x - p.nx * t), Y(p.y - p.ny * t));
    }
    c.beginPath();
    c.moveTo(up[0], up[1]);
    for (i = 2; i < up.length; i += 2) c.lineTo(up[i], up[i + 1]);
    for (i = lo.length - 2; i >= 0; i -= 2) c.lineTo(lo[i], lo[i + 1]);
    c.closePath();
  }

  /* 成品叶片只画一次，之后贴图，避免每帧重算大范围光晕 */
  function buildCache() {
    var off = document.createElement('canvas');
    off.width = Math.max(1, Math.round(W * dpr));
    off.height = Math.max(1, Math.round(H * dpr));
    var c = off.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    var a = centre(TARGET, 0), b = centre(TARGET, 1), i;
    var heat = c.createLinearGradient(X(a.x), Y(a.y), X(b.x), Y(b.y));
    HEAT.forEach(function (stop) { heat.addColorStop(stop[0], stop[1]); });

    c.save();
    c.shadowColor = 'rgba(232,105,43,.5)';
    c.shadowBlur = scale * 0.13 * dpr;
    trace(c, TARGET);
    c.fillStyle = heat;
    c.fill();
    c.shadowBlur = 0;
    c.clip();
    for (i = 0; i < HOLES.length; i++) {
      var s = HOLES[i], p = centre(TARGET, s), t = thick(TARGET, s);
      var off2 = (i % 2 ? 0.34 : -0.34) * t;
      var hx = X(p.x + p.nx * off2), hy = Y(p.y + p.ny * off2);
      var r = Math.max(scale * 0.0085, scale * t * 0.2);
      var cool = c.createRadialGradient(hx, hy, 0, hx, hy, r * 8);
      cool.addColorStop(0, 'rgba(37,12,74,.96)');
      cool.addColorStop(0.32, 'rgba(92,20,108,.72)');
      cool.addColorStop(1, 'rgba(120,30,100,0)');
      c.fillStyle = cool;
      c.fillRect(hx - r * 8, hy - r * 8, r * 16, r * 16);
      c.fillStyle = '#0a0612';
      c.beginPath();
      c.arc(hx, hy, r, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    cache = off;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, W > 1700 ? 1.5 : 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, W > 1700 ? 1.5 : 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    if (W >= 820) {
      scale = Math.min(W * 0.46, H * 0.74);
      ox = W - scale * 1.2;
      oy = H * 0.1 + scale * 0.1;
    } else {
      scale = Math.min(W * 0.76, H * 0.46);
      ox = (W - scale) / 2;
      oy = H * 0.1 + scale * 0.16;
    }
    buildCache();
  }

  function gridLines() {
    var step = Math.max(56, scale / 8), x, y;
    ctx.strokeStyle = 'rgba(237,233,225,.035)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (x = (ox % step); x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (y = (oy % step); y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
  }

  function drawFlow(dt, strength) {
    var i, p, a, b, o;
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    for (i = 0; i < flow.length; i++) {
      p = flow[i];
      p.s += p.v * dt;
      p.life += dt;
      if (p.s > 1.34) { spawn(p, false); continue; }
      a = centre(TARGET, p.s);
      b = centre(TARGET, p.s - p.len);
      o = clamp(p.life / 900) * seg(1.34 - p.s, 0, 0.16) * p.a * strength;
      if (o < 0.01) continue;
      var near = clamp(1 - Math.abs(p.d) / 0.22);
      ctx.strokeStyle = near > 0.1
        ? 'rgba(244,' + Math.round(190 - near * 70) + ',' + Math.round(150 - near * 90) + ',' + o.toFixed(3) + ')'
        : 'rgba(237,233,225,' + (o * 0.62).toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(X(b.x + b.nx * p.d), Y(b.y + b.ny * p.d));
      ctx.lineTo(X(a.x + a.nx * p.d), Y(a.y + a.ny * p.d));
      ctx.stroke();
    }
  }

  function frame(p, dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    gridLines();
    ctx.translate(px, py);

    var fadeOut = 1 - seg(p, 0.95, 1);
    var pull = ease(seg(p, 0, 0.64));
    var fade = fadeOut * ease(seg(p, 0, 0.05));
    var i, n, k, life, flash, j, g = [0, 0, 0, 0, 0, 0];

    if (dt) drawFlow(dt, 0.45 + 0.55 * ease(seg(p, 0.5, 0.74)));

    ctx.lineWidth = 1;
    for (i = 0; i < pop.length; i++) {
      n = pop[i];
      life = 1 - seg(p, n.die, n.die + 0.03);
      if (life <= 0) continue;
      flash = seg(p, n.die - 0.03, n.die) * life;
      k = Math.min(1, pull * n.rate);
      for (j = 0; j < 6; j++) g[j] = n.g[j] + (TARGET[j] - n.g[j]) * k;
      var alpha = (1 - seg(p, 0.66, 0.76)) * fade;
      if (alpha <= 0.002) continue;
      trace(ctx, g);
      ctx.strokeStyle = flash > 0.02
        ? 'rgba(232,105,43,' + (0.8 * flash * alpha).toFixed(3) + ')'
        : 'rgba(237,233,225,' + (0.17 * life * alpha).toFixed(3) + ')';
      ctx.stroke();
    }

    var show = ease(seg(p, 0.6, 0.74)) * fadeOut;
    if (show > 0 && cache) {
      ctx.globalAlpha = show;
      ctx.drawImage(cache, 0, 0, W, H);
      /* 热呼吸 */
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = show * (0.1 + 0.09 * Math.sin(clock / 1100));
      ctx.drawImage(cache, 0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
  }

  function drawHero(now) {
    var dt = Math.min(48, lastT ? now - lastT : 16);
    lastT = now;
    clock += dt;
    if (clock >= CYCLE) { clock = 0; seed(); }
    var soft = 1 - Math.pow(0.0018, dt / 1000);
    px += (mx - px) * soft;
    py += (my - py) * soft;
    frame(clock / CYCLE, dt);
  }

  if (ctx) {
    seed();
    seedFlow();
    resize();
    if (!motion) {
      frame(0.8, 0);
    } else if (fine) {
      window.addEventListener('pointermove', function (e) {
        mx = (e.clientX / window.innerWidth - 0.5) * -26;
        my = (e.clientY / window.innerHeight - 0.5) * -18;
      }, { passive: true });
    }
  }

  /* ---------- 主循环：滚动和画布共用一个 rAF ---------- */

  var timer;
  window.addEventListener('resize', function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (ctx) {
        resize();
        if (!motion) frame(0.8, 0);
      }
      if (motion) measure();
      moveInd($('.nav a.is-here'));
    }, 120);
  });

  function tick(now) {
    if (lenis) lenis.raf(now);
    var y = lenis ? lenis.animatedScroll : window.scrollY;
    update(y);
    if (ctx && y < m.vh && !document.hidden) drawHero(now);
    else lastT = 0;
    requestAnimationFrame(tick);
  }

  if (motion) {
    measure();
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(document.body);
    requestAnimationFrame(tick);
  } else {
    /* 无动效：只保留顶栏状态 */
    var onScroll = function () { top.classList.toggle('is-stuck', window.scrollY > 40); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* 字体就绪再开场，避免标题先跳一下 */
  var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 900); })]).then(function () {
    root.classList.add('ready');
    if (motion) measure();
  });
})();
