(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 顶栏 */
  var top = document.querySelector('.top');
  var btn = document.querySelector('.menu-btn');
  var nav = document.getElementById('nav');

  function onScroll() {
    top.classList.toggle('is-stuck', window.scrollY > 40);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    top.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.firstElementChild.textContent = open ? '关闭' : '菜单';
  }
  btn.addEventListener('click', function () {
    setMenu(!nav.classList.contains('is-open'));
  });
  nav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') setMenu(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setMenu(false);
  });

  /* 进入动效 */
  var items = document.querySelectorAll('.reveal');
  if (reduced || !('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          seen.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    items.forEach(function (el) { seen.observe(el); });
  }

  /* 当前章节高亮 */
  var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.toggle('is-here', a.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(function (a) {
      var sec = document.querySelector(a.getAttribute('href'));
      if (sec) spy.observe(sec);
    });
  }

  /* 首屏：候选叶型被打分、淘汰，收敛成一片带冷却孔的叶片 */
  var canvas = document.getElementById('evolve');
  var ctx = canvas && canvas.getContext('2d');
  if (!ctx) return;

  var COUNT = 130;
  var SAMPLES = 34;
  var CYCLE = 15000;
  var TARGET = [0.38, 0.12, 0.84, -0.22, -0.84, 0.095];
  var HOLES = [0.035, 0.1, 0.19, 0.3, 0.42, 0.53, 0.63, 0.72, 0.8, 0.87, 0.93];
  var HEAT = [
    [0, '#fde7a9'], [0.14, '#f9a93a'], [0.3, '#ea6a32'], [0.52, '#c13b5b'],
    [0.74, '#ed7a2c'], [0.9, '#fbb643'], [1, '#fff1c4']
  ];

  var W = 0, H = 0, scale = 1, ox = 0, oy = 0, pop = [], start = 0, raf = 0, visible = true;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v) { return Math.max(0, Math.min(1, v)); }
  function ease(t) { return t * t * (3 - 2 * t); }
  function seg(p, a, b) { return clamp((p - a) / (b - a)); }

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
        die: i < 10 ? 2 : rand(0.1, 0.62)
      });
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
  function trace(g) {
    var i, s, c, t, up = [], lo = [];
    for (i = 0; i <= SAMPLES; i++) {
      s = i / SAMPLES;
      s = s * s * (1.6 - 0.6 * s);
      c = centre(g, s);
      t = thick(g, s);
      up.push([c.x + c.nx * t, c.y + c.ny * t]);
      lo.push([c.x - c.nx * t, c.y - c.ny * t]);
    }
    ctx.beginPath();
    ctx.moveTo(X(up[0][0]), Y(up[0][1]));
    for (i = 1; i < up.length; i++) ctx.lineTo(X(up[i][0]), Y(up[i][1]));
    for (i = lo.length - 1; i >= 0; i--) ctx.lineTo(X(lo[i][0]), Y(lo[i][1]));
    ctx.closePath();
  }
  function X(v) { return ox + v * scale; }
  function Y(v) { return oy - v * scale; }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (W >= 820) {
      scale = Math.min(W * 0.46, H * 0.74);
      ox = W - scale * 1.2;
      oy = H * 0.1 + scale * 0.1;
    } else {
      scale = Math.min(W * 0.76, H * 0.46);
      ox = (W - scale) / 2;
      oy = H * 0.1 + scale * 0.16;
    }
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

  function finalBlade(alpha) {
    var a = centre(TARGET, 0), b = centre(TARGET, 1), i;
    var heat = ctx.createLinearGradient(X(a.x), Y(a.y), X(b.x), Y(b.y));
    HEAT.forEach(function (stop) { heat.addColorStop(stop[0], stop[1]); });

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(232,105,43,.5)';
    ctx.shadowBlur = scale * 0.13;
    trace(TARGET);
    ctx.fillStyle = heat;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.clip();
    for (i = 0; i < HOLES.length; i++) {
      var s = HOLES[i], c = centre(TARGET, s), t = thick(TARGET, s);
      var off = (i % 2 ? 0.34 : -0.34) * t;
      var hx = X(c.x + c.nx * off), hy = Y(c.y + c.ny * off);
      var r = Math.max(scale * 0.0085, scale * t * 0.2);
      var cool = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 8);
      cool.addColorStop(0, 'rgba(37,12,74,.96)');
      cool.addColorStop(0.32, 'rgba(92,20,108,.72)');
      cool.addColorStop(1, 'rgba(120,30,100,0)');
      ctx.fillStyle = cool;
      ctx.fillRect(hx - r * 8, hy - r * 8, r * 16, r * 16);
      ctx.fillStyle = '#0a0612';
      ctx.beginPath();
      ctx.arc(hx, hy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function frame(p) {
    ctx.clearRect(0, 0, W, H);
    gridLines();

    var fadeOut = 1 - seg(p, 0.94, 1);
    var pull = ease(seg(p, 0, 0.72));
    var fade = fadeOut * ease(seg(p, 0, 0.05));
    var i, n, k, life, flash;

    ctx.lineWidth = 1;
    for (i = 0; i < pop.length; i++) {
      n = pop[i];
      life = 1 - seg(p, n.die, n.die + 0.03);
      if (life <= 0) continue;
      flash = seg(p, n.die - 0.03, n.die) * life;
      k = Math.min(1, pull * n.rate);
      var g = [];
      for (var j = 0; j < 6; j++) g.push(n.g[j] + (TARGET[j] - n.g[j]) * k);
      trace(g);
      ctx.strokeStyle = flash > 0.02
        ? 'rgba(232,105,43,' + (0.75 * flash * fade).toFixed(3) + ')'
        : 'rgba(237,233,225,' + (0.17 * life * fade).toFixed(3) + ')';
      ctx.stroke();
    }

    var show = ease(seg(p, 0.66, 0.8)) * fadeOut;
    if (show > 0) finalBlade(show);
  }

  function loop(now) {
    if (!visible) { raf = 0; return; }
    if (!start) start = now;
    var p = (now - start) / CYCLE;
    if (p >= 1) { start = now; p = 0; seed(); }
    frame(p);
    raf = requestAnimationFrame(loop);
  }

  function play() {
    if (!raf) { start = 0; raf = requestAnimationFrame(loop); }
  }

  seed();
  resize();

  var timer;
  window.addEventListener('resize', function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      resize();
      if (reduced) frame(0.9);
    }, 120);
  });

  if (reduced) {
    frame(0.9);
    return;
  }

  /* 不在视口或页面隐藏时停画 */
  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting && !document.hidden;
    if (visible) play();
  }).observe(canvas);
  document.addEventListener('visibilitychange', function () {
    visible = !document.hidden;
    if (visible) play();
  });
  play();
})();
