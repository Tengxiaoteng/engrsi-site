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

  /* ---------- 语言：要在逐字拆分之前换好 ---------- */

  var I18N = window.I18N || null;
  if (I18N) I18N.apply();
  function tr(zh, en) { return I18N ? I18N.t(zh, en) : zh; }

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
    $$('.trio, .fields, .howto, .logos, .stats, .honors, .values, .goals, .facts, .awards, .biz__list, .areas__grid, .clients__grid, .flow__list').forEach(function (group) {
      group.classList.add('stagger');
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

  /* ---------- 三维展示 ---------- */

  var views = $$('[data-stage]');
  (function () {
    var save = navigator.connection && navigator.connection.saveData;
    var gl = null;
    try { gl = !save && document.createElement('canvas').getContext('webgl2'); } catch (e) { gl = null; }
    if (!gl) { views = []; return; }
    var lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    /* 在量页面高度之前放出来，否则翻页位置要多算一次 */
    views.forEach(function (v) { v.hidden = false; });
  })();

  function mountViews() {
    function fail() {
      views.forEach(function (v) { v.hidden = true; });
      if (motion) measure();
    }
    var s = document.createElement('script');
    s.src = 'assets/js/stage.min.js';
    s.async = true;
    s.onerror = fail;
    s.onload = function () {
      var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 60); };
      views.forEach(function (v, i) {
        idle(function () {
          try {
            if (v.dataset.stage === 'blade') window.EngStage.blade(v);
            else if (v.dataset.stage === 'world') window.EngStage.world(v, $$('.stairs li'));
            else window.EngStage.show(v, $$('.fields li'));
          } catch (e) {
            v.hidden = true;
            if (motion) measure();
          }
        });
      });
    };
    document.head.appendChild(s);
  }

  /* ---------- 翻页结构 ---------- */

  var pages = [];
  if (motion) {
    pages = Array.prototype.slice.call($('main').children);
    pages.forEach(function (pg) { pg.classList.add('page'); });
    pages[pages.length - 1].classList.add('page--last');
    if (fine) root.classList.add('turn');
  }

  /* 每页内容包一层，放不下时整体等比缩小，保证一屏显示完 */
  var fits = [];
  pages.forEach(function (pg) {
    if (pg.classList.contains('hero')) return;
    var host = $('.pin__sticky', pg) || pg;
    var box = document.createElement('div');
    box.className = 'fit';
    while (host.firstChild) box.appendChild(host.firstChild);
    host.appendChild(box);
    fits.push({ box: box, pg: pg, host: host });
  });

  /* ---------- 进入动效 ---------- */

  var items = $$('.reveal');
  var seen = null;

  /* 内容必须赶在下一页盖上来之前出现：滚得快时不演完整动画 */
  function show(el) {
    if (el.classList.contains('is-in')) return;
    /* 桌面整页翻，内容有足够的时间演完；手机自由滚动，滚得快时直接显示 */
    var quick = lenis && !fine && Math.abs(lenis.velocity) > 16;
    if (quick) el.classList.add('quick');
    el.classList.add('is-in');
    if (seen) seen.unobserve(el);
    if (!quick && el.classList.contains('stats')) countUp(el);
  }

  if (!motion || !('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    /* 下边界外扩：元素进入视口之前就开始，进屏时已经在显示 */
    seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) show(entry.target);
      });
    }, { rootMargin: fine ? '0px 0px -24% 0px' : '0px 0px 14% 0px', threshold: 0 });
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
      var span = 1100;
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
    btn.firstElementChild.textContent = open ? tr('关闭', 'Close') : tr('菜单', 'Menu');
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

  /* ---------- 平滑滚动 ---------- */

  var lenis = null;
  if (motion && window.Lenis) {
    lenis = new window.Lenis({ autoRaf: false, lerp: 0.095, wheelMultiplier: 0.95 });
  }

  function easeInOut(t) { return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2; }

  /* 一次只翻一页：动画走完之前不接受新的输入 */
  var TURN = 1.25, turning = false, turnEnd = 0;

  function easeTurn(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function glide(y, duration, curve) {
    y = clamp(y, 0, m.max);
    if (Math.abs(y - lenis.animatedScroll) < 1) return;
    turning = true;
    turnEnd = performance.now() + duration * 1000 + 60;
    lenis.scrollTo(y, { duration: duration, easing: curve, lock: false, force: true });
  }

  function turn(to) { glide(to, TURN, easeTurn); }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || !lenis) return;
    var id = a.getAttribute('href').slice(1);
    var target = id === 'top' ? null : document.getElementById(id);
    if (id !== 'top' && !target) return;
    e.preventDefault();
    glide(target ? layoutTop(target) : 0, 1.6, easeInOut);
    if (target) {
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
    history.replaceState(null, '', '#' + id);
  });

  /* 翻一整页。比一屏长的区段（飞轮）分步走完再离开 */
  function hopTo(from, dir) {
    var st = m.stops, last = st.length - 1, i = 0;
    while (i < last && st[i + 1].a <= from + 2) i++;
    var s = st[i], len = s.b - s.a;
    var step = len > 2 ? len / Math.max(1, Math.round(len / (m.vh * 0.5))) : 0;
    if (dir > 0) {
      if (step && from < s.b - 2) return Math.min(s.b, s.a + step * (Math.floor((from - s.a + 2) / step) + 1));
      return i < last ? st[i + 1].a : m.max;
    }
    if (from > s.b + 2) return s.b;
    if (step && from > s.a + 2) return Math.max(s.a, s.a + step * (Math.ceil((from - s.a - 2) / step) - 1));
    return i > 0 ? st[i - 1].b : 0;
  }

  /* 一次手势只翻一页。手指滑动和松手后的惯性都算同一次手势，翻页途中收到的事件全部丢弃；
     之后必须等事件真正停顿才算新手势。不看速度变化：惯性里的波动会被误判成又推了一下，连跳几页 */
  var gest = { last: -1e9, dir: 0, sum: 0, fired: false, prev: 0, tail: false };

  function onWheel(e) {
    if (e.ctrlKey || nav.classList.contains('is-open')) return;
    var unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? m.vh : 1;
    var d = e.deltaY * unit, abs = Math.abs(d);
    e.stopPropagation();
    if (abs <= Math.abs(e.deltaX * unit)) return;
    e.preventDefault();

    var g = gest, now = e.timeStamp, gap = now - g.last, prev = g.prev, dir = d > 0 ? 1 : -1;
    g.last = now;
    g.prev = abs;
    if (turning) {
      g.tail = true;
      return;
    }
    /* 鼠标滚轮一格一格转没有停顿，靠每格数值完全相同来认 */
    var notch = abs >= 100 && abs === prev;
    if (gap > 130 || notch) {
      g.tail = false;
      g.sum = 0;
      g.fired = false;
    } else if (g.tail || dir !== g.dir) {
      return;
    }
    g.dir = dir;
    g.sum += abs;
    if (!g.fired && g.sum >= 10) {
      g.fired = true;
      turn(hopTo(lenis.animatedScroll, dir));
    }
  }

  if (lenis && fine) window.addEventListener('wheel', onWheel, { passive: false, capture: true });

  /* 键盘翻页也走同一条曲线 */
  document.addEventListener('keydown', function (e) {
    if (!lenis || e.altKey || e.ctrlKey || e.metaKey) return;
    var tag = e.target.tagName;
    if (e.key === ' ' && (tag === 'BUTTON' || tag === 'A')) return;
    var from = lenis.animatedScroll;
    var to = null;
    if (e.key === 'PageDown' || e.key === 'ArrowDown' || (e.key === ' ' && !e.shiftKey)) to = hopTo(from, 1);
    else if (e.key === 'PageUp' || e.key === 'ArrowUp' || (e.key === ' ' && e.shiftKey)) to = hopTo(from, -1);
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = m.max;
    if (to === null) return;
    e.preventDefault();
    if (!turning) turn(to);
  });

  /* ---------- 滚动联动 ---------- */

  /* 省流量时只留封面 */
  var films = [];
  if (motion && !(navigator.connection && navigator.connection.saveData)) {
    films = $$('.film video').map(function (v) {
      return { v: v, pg: pages.filter(function (p) { return p.contains(v); })[0], on: false, loaded: false };
    });
  }

  var hero = $('.hero');
  var foot = $('.foot');
  var heroIn = $('.hero__in');
  var canvas = $('#evolve');
  var bar = $('.progress');
  var loop4 = $('.loop4');
  var loopItems = loop4 ? Array.prototype.slice.call(loop4.children) : [];
  var pin = $('#rsi');
  var flyOn = false, flyAt = 0, flyP = 0, FLY = 3600;
  var steps = $$('.steps li');
  var nodes = $$('.nodes g');
  var r2 = $('.r2');
  var head = $('.head');
  var ringWide = $('.fly__ring');
  var label = $('.c2');
  var parallax = $$('.duo .mask img');
  var LABELS = ['AI 设计方案', '打分、留痕', '校准世界', '给自己造工具', '下一圈'];

  var m = { vh: 1, vw: 1, max: 1, loop: 0, pin: 0, par: [], tops: [], ids: [], stops: [{ a: 0, b: 0 }] };
  var lastY = -1;
  var lastStep = -1;
  var lastDir = 0;
  var dirY = 0;
  var dirty = true;
  var lastHere = null;

  /* 布局位置：页面停住时 getBoundingClientRect 不可信，这里沿 offsetParent 累加。
     offsetTop 不受 transform 影响，也不受页面当前是否停住影响。 */
  function layoutTop(el) {
    var t = 0, n = el;
    while (n && !n.classList.contains('page')) {
      t += n.offsetTop;
      n = n.offsetParent;
    }
    return t + (n ? n.__top : 0);
  }

  function fit() {
    var low = m.vw > 820 ? 0.6 : 0.88;
    fits.forEach(function (f) {
      var cs = getComputedStyle(f.pg);
      var pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      if (f.host !== f.pg && pad < 1) pad = m.vh * 0.1;
      if (f.pg.classList.contains('page--last')) pad += foot.offsetHeight;
      var h = f.box.offsetHeight;
      var z = clamp((m.vh - pad) / h, low, 1);
      f.box.style.transform = z < 1 ? 'scale(' + z.toFixed(4) + ')' : '';
      f.box.style.marginBottom = z < 1 ? (-h * (1 - z)).toFixed(1) + 'px' : '';
    });
  }

  function measure() {
    m.vh = window.innerHeight;
    m.vw = window.innerWidth;
    fit();

    /* 最后一页连同页脚要填满一屏，否则倒数第二页永远盖不完 */
    if (pages.length) pages[pages.length - 1].style.minHeight = Math.max(0, m.vh - foot.offsetHeight) + 'px';
    m.max = Math.max(1, document.documentElement.scrollHeight - m.vh);

    var sum = 0;
    pages.forEach(function (pg) {
      var h = pg.offsetHeight;
      var hold = parseFloat(getComputedStyle(pg).marginBottom) || 0;
      pg.__top = sum;
      pg.__h = h;
      pg.__hold = hold;
      pg.style.top = Math.min(0, m.vh - h) + 'px';
      sum += h + hold;
    });
    pages.forEach(function (pg, i) {
      var next = pages[i + 1];
      if (!next) return;
      pg.__start = next.__top - m.vh;
      pg.__len = Math.max(1, Math.min(m.vh, m.max - pg.__start));
      pg.__cover = next.__top;
    });
    m.stops = pages.map(function (pg, i) {
      return { a: pg.__top, b: i < pages.length - 1 ? pg.__start : m.max };
    });

    if (loop4) m.loop = layoutTop(loop4);
    if (pin) {
      m.pin = layoutTop(pin);
    }
    m.ids = links.map(function (a) {
      var sec = $(a.getAttribute('href'));
      return sec ? { a: a, top: layoutTop(sec) } : null;
    }).filter(Boolean).sort(function (x, y) { return x.top - y.top; });
    m.par = parallax.map(function (img) {
      var box = img.parentNode;
      return { img: img, top: layoutTop(box), h: box.offsetHeight };
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

    /* 首屏：内容比幕布走得慢一点 */
    var h = clamp(y / m.vh);
    if (h < 1) {
      heroIn.style.transform = 'translate3d(0,' + (h * m.vh * 0.22).toFixed(1) + 'px,0)';
      heroIn.style.opacity = clamp(1 - h * 1.35).toFixed(3);
    }

    /* 翻页：上一屏缩小变暗，被完全盖住后不再绘制 */
    pages.forEach(function (pg, i) {
      if (i === pages.length - 1) return;
      var k = clamp((y - pg.__start) / pg.__len);
      var covered = y >= pg.__cover;
      var key = covered ? 2 : (k <= 0 ? 0 : 1);

      /* 快到页尾：还没进场的内容一次放完，不留给下一页去盖 */
      if (!pg.__shown && y >= pg.__start - pg.__hold - m.vh * 0.2) {
        pg.__shown = true;
        $$('.reveal', pg).forEach(show);
      }

      /* 只有正在翻和即将翻的页留合成层，其余页不占显存 */
      var near = y > pg.__start - m.vh * 1.1 && !covered;
      if (near !== pg.__near) {
        pg.__near = near;
        pg.classList.toggle('is-near', near);
      }

      if (key === 1) {
        /* 下一屏露头时上一屏先不动，留给还在读的人 */
        var e = ease(seg(k, 0.2, 1));
        if (fine) pg.style.transform = 'scale(' + (1 - e * 0.07).toFixed(4) + ')';
        pg.style.opacity = (1 - e * 0.8).toFixed(3);
      }
      if (key === pg.__state) return;
      pg.__state = key;
      pg.style.visibility = key === 2 ? 'hidden' : '';
      if (key === 0) {
        pg.style.transform = '';
        pg.style.opacity = '';
      }
    });

    /* 短片：翻到这一页从头播，离开就停 */
    films.forEach(function (f) {
      var pg = f.pg, end = pg.__start !== undefined ? pg.__start : m.max;
      if (!f.loaded && y > pg.__top - m.vh * 1.3) {
        f.loaded = true;
        f.v.preload = 'auto';
        f.v.load();
      }
      var on = y > pg.__top - m.vh * 0.5 && y < end + m.vh * 0.5;
      if (on === f.on) return;
      f.on = on;
      if (on) {
        f.v.currentTime = 0;
        var played = f.v.play();
        if (played && played.catch) played.catch(function () {});
      } else {
        f.v.pause();
      }
    });

    /* 导航高亮：取当前视口中线所在的章节 */
    var here = null;
    m.ids.forEach(function (it) { if (it.top <= y + m.vh * 0.5) here = it.a; });
    if (here !== lastHere) {
      lastHere = here;
      links.forEach(function (a) { a.classList.toggle('is-here', a === here); });
      moveInd(here);
    }

    /* 想 做 验 改 */
    if (loop4) {
      var lp = clamp((m.vh * 0.86 - (m.loop - y)) / (m.vh * 0.46));
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
      var fp = flyP;
      r2.style.setProperty('--o', (100 - fp * 100).toFixed(2));
      if (head) {
        var ang = fp * Math.PI * 2;
        head.setAttribute('transform', 'rotate(' + (ang * 180 / Math.PI).toFixed(2) + ' 200 200)');
        ringWide.style.setProperty('--g', fp.toFixed(3));
      }
      var step = Math.min(4, Math.floor(fp * 5));
      if (step !== lastStep) {
        lastStep = step;
        steps.forEach(function (li, i) { li.classList.toggle('is-on', i <= step); });
        nodes.forEach(function (g, i) { g.classList.toggle('is-on', i <= step); });
        label.textContent = LABELS[step];
      }
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

  /* ---------- 循环动画：只在看得见时跑 ---------- */

  if (motion && 'IntersectionObserver' in window) {
    var live = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { entry.target.classList.toggle('is-live', entry.isIntersecting); });
    }, { rootMargin: '10% 0px 10% 0px' });
    $$('[data-live]').forEach(function (el) { live.observe(el); });
  }

  /* ---------- 典型产品轮播：看得见时自动换，点选后停在所选 ---------- */

  (function () {
    var stage = $('.show__stage');
    if (!stage) return;
    var imgs = $$('.show__img', stage), tabs = $$('.show__tab');
    var at = 0, timer = null, held = false, DWELL = 6000;
    function go(i, timed) {
      at = (i + imgs.length) % imgs.length;
      imgs.forEach(function (im, k) { im.classList.toggle('is-on', k === at); });
      tabs.forEach(function (t, k) {
        t.classList.toggle('is-on', k === at);
        t.classList.remove('is-timed');
        t.setAttribute('aria-pressed', String(k === at));
      });
      if (timed && motion) { void tabs[at].offsetWidth; tabs[at].classList.add('is-timed'); }
      /* 下一张提前解码 */
      var nx = imgs[(at + 1) % imgs.length];
      if (nx.loading === 'lazy') nx.loading = 'eager';
    }
    function run() {
      clearTimeout(timer);
      if (held || !motion || !stage.classList.contains('is-live')) return;
      go(at, true);
      timer = setTimeout(function () { go(at + 1, true); run(); }, DWELL);
    }
    tabs.forEach(function (t, k) {
      t.style.setProperty('--dwell', DWELL + 'ms');
      t.addEventListener('click', function () { held = true; clearTimeout(timer); go(k, false); });
    });
    if (motion && 'MutationObserver' in window) new MutationObserver(run).observe(stage, { attributes: true, attributeFilter: ['class'] });
  })();

  /* ---------- 中英文切换：原地换文字，停在同一页 ---------- */

  $$('[data-lang-switch]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!I18N) return;
      var y = lenis ? lenis.animatedScroll : window.scrollY, at = 0;
      if (motion) m.stops.forEach(function (s, i) { if (s.a <= y + 2) at = i; });
      I18N.set(I18N.lang === 'en' ? 'zh' : 'en');
      if (motion) $$('.split').forEach(function (el) {
        if (!el.hasAttribute('data-en')) return;
        el.classList.remove('split');
        split(el);
      });
      setMenu(nav.classList.contains('is-open'));
      if (motion) {
        measure();
        var to = m.stops[at] ? m.stops[at].a : 0;
        if (lenis) lenis.scrollTo(to, { immediate: true, force: true });
        else window.scrollTo(0, to);
      }
      moveInd($('.nav a.is-here'));
      if (ctx) resize();
    });
  });

  /* ---------- 主循环：滚动和画布共用一个 rAF ---------- */

  var timer;
  var lastW = window.innerWidth;
  window.addEventListener('resize', function () {
    if (!fine && window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (ctx) {
        resize();
        if (!motion) frame(0.8, 0);
      }
      if (motion) measure();
      if (lenis && fine) {
        snapDir = -1;
        settled = false;
      }
      moveInd($('.nav a.is-here'));
    }, 120);
  });

  /* 滚轮和键盘已经整页走了；这里兜底拖滚动条、改窗口大小后停在两页之间的情况 */
  var snapT = 0, snapDir = 1, snapAt = 0, settled = true;

  function snap(now) {
    if (turning) return;
    var t = lenis.targetScroll;
    if (Math.abs(t - snapT) > 0.5) {
      snapDir = t > snapT ? 1 : -1;
      snapT = t;
      snapAt = now;
      settled = false;
      return;
    }
    if (settled || now - snapAt < 110) return;
    settled = true;
    var st = m.stops, i;
    for (i = 0; i < st.length - 1; i++) {
      if (t <= st[i].b + 1) return;
      if (t < st[i + 1].a - 1) {
        var k = (t - st[i].b) / (st[i + 1].a - st[i].b);
        var go = snapDir > 0 ? k > 0.015 : k > 0.985;
        turn(go ? st[i + 1].a : st[i].b);
        return;
      }
    }
  }

  function tick(now) {
    if (lenis) {
      lenis.raf(now);
      if (turning && now >= turnEnd) turning = false;
    }
    var y = lenis ? lenis.animatedScroll : window.scrollY;
    if (pin && motion) {
      var inFly = y > m.pin - m.vh * 0.3 && y < m.pin + m.vh * 0.5;
      if (inFly && !flyOn) flyAt = now;
      flyOn = inFly;
      if (flyOn && flyP !== clamp((now - flyAt) / FLY)) {
        flyP = clamp((now - flyAt) / FLY);
        dirty = true;
      }
    }
    update(y);
    if (lenis && fine) snap(now);
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

  /* 空闲时提前取图，避免翻到时才解码造成顿挫 */
  window.addEventListener('load', function () {
    var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 300); };
    idle(function () {
      $$('img[loading="lazy"]').forEach(function (img) { img.loading = 'eager'; });
      if (views.length) mountViews();
    });
  });

  /* 字体就绪再开场，避免标题先跳一下 */
  var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 900); })]).then(function () {
    root.classList.add('ready');
    if (motion) measure();
  });
})();
