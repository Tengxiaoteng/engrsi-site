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

  /* ---------- 三维展示：十二个领域的可拆装模型 ---------- */

  /* 只在有动效、有 WebGL、屏幕够宽时启用；否则保留线条图标动画 */
  var areas3d = null;
  (function () {
    var save = navigator.connection && navigator.connection.saveData;
    if (!motion || save || !window.matchMedia('(min-width: 900px)').matches) return;
    var gl = null;
    try { gl = document.createElement('canvas').getContext('webgl2'); } catch (e) { gl = null; }
    if (!gl) return;
    var lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    areas3d = $('.areas__grid');
  })();

  function mountViews() {
    var s = document.createElement('script');
    s.src = 'assets/js/stage.min.js';
    s.async = true;
    s.onload = function () {
      var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 60); };
      idle(function () {
        try { window.EngStage.fields(areas3d); } catch (e) { areas3d.classList.remove('is-3d'); }
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

  /* 生成式设计示意：一整块设计域划成单元，按“受力贡献”打分，低分单元一批批被淘汰，
     最后剩下沿受力路径的轻量化悬臂支架，再沿路径走光流。坐标以设计域宽为 1，y 向下。 */
  var CYCLE = 16000;
  var FLOW = 150;
  var DH = 0.62;
  var SUP = [[0.05, 0.1], [0.05, 0.52]], LOAD = [0.95, 0.31];

  function cub(p, t) {
    var u = 1 - t;
    return [
      u * u * u * p[0] + 3 * u * u * t * p[2] + 3 * u * t * t * p[4] + t * t * t * p[6],
      u * u * u * p[1] + 3 * u * u * t * p[3] + 3 * u * t * t * p[5] + t * t * t * p[7]
    ];
  }
  var TOP = [0.05, 0.1, 0.36, 0.13, 0.7, 0.2, 0.95, 0.31];
  var BOT = [0.05, 0.52, 0.36, 0.5, 0.7, 0.42, 0.95, 0.31];
  function line(a, b) { return [a[0], a[1], a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3, a[0] + (b[0] - a[0]) * 2 / 3, a[1] + (b[1] - a[1]) * 2 / 3, b[0], b[1]]; }
  /* 杆件：三次曲线控制点 + 两端半径；光流从受载端流向固定端 */
  var MEMBERS = [
    { c: TOP, r: [0.036, 0.02] },
    { c: BOT, r: [0.04, 0.02] },
    { c: line(SUP[0], SUP[1]), r: [0.02, 0.02] },
    { c: line(SUP[0], cub(BOT, 0.24)), r: [0.017, 0.012] },
    { c: line(SUP[1], cub(TOP, 0.26)), r: [0.017, 0.012] },
    { c: line(cub(TOP, 0.26), cub(BOT, 0.46)), r: [0.012, 0.012] },
    { c: line(cub(BOT, 0.24), cub(TOP, 0.5)), r: [0.012, 0.011] },
    { c: line(cub(TOP, 0.5), cub(BOT, 0.68)), r: [0.011, 0.01] },
    { c: line(cub(BOT, 0.46), cub(TOP, 0.72)), r: [0.011, 0.01] },
    { c: line(cub(TOP, 0.72), cub(BOT, 0.86)), r: [0.01, 0.009] },
    { c: line(cub(BOT, 0.68), cub(TOP, 0.88)), r: [0.01, 0.009] }
  ];
  var BOSS = [{ p: SUP[0], r: 0.052, h: 0.024 }, { p: SUP[1], r: 0.052, h: 0.024 }, { p: LOAD, r: 0.046, h: 0.021 }];
  MEMBERS.forEach(function (m) {
    m.pts = [];
    for (var i = 0; i <= 24; i++) m.pts.push(cub(m.c, i / 24));
  });

  var W = 0, H = 0, dpr = 1, scale = 1, ox = 0, oy = 0, cell = 7;
  var cells = [], flow = [], clock = 0, lastT = 0, total = 1, kept = 1;
  var cache = null;
  var mx = 0, my = 0, px = 0, py = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function X(v) { return ox + v * scale; }
  function Y(v) { return oy + v * scale; }

  function distSeg(x, y, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
    var t = l ? clamp(((x - a[0]) * dx + (y - a[1]) * dy) / l) : 0;
    return [Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t), t];
  }
  /* 某点在最终结构里的“密度”：0 空，1 实 */
  function density(x, y) {
    var d = 0, i, j, m, s, r, hole = false;
    for (i = 0; i < BOSS.length; i++) {
      var q = Math.hypot(x - BOSS[i].p[0], y - BOSS[i].p[1]);
      if (q < BOSS[i].h) hole = true;
      if (q < BOSS[i].r) d = 1;
    }
    if (hole) return 0;
    for (i = 0; i < MEMBERS.length && d < 1; i++) {
      m = MEMBERS[i];
      for (j = 0; j < m.pts.length - 1; j++) {
        s = distSeg(x, y, m.pts[j], m.pts[j + 1]);
        r = m.r[0] + (m.r[1] - m.r[0]) * (j + s[1]) / (m.pts.length - 1);
        d = Math.max(d, clamp((r + 0.006 - s[0]) / 0.012));
      }
    }
    return d;
  }

  function seed() {
    cells = [];
    var cols = Math.round(scale / cell), rows = Math.round(DH * scale / cell), i, j, u = 1 / cols;
    kept = 0;
    for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
      var x = (i + 0.5) * u, y = (j + 0.5) * u, d = density(x, y);
      /* 打分：越靠近受力路径分越高；实体单元永不淘汰 */
      var key = d > 0.5 ? 2 : d * 0.55 + Math.random() * 0.45;
      cells.push({ x: i * u, y: j * u, d: d, key: key });
      if (d > 0.5) kept++;
    }
    total = cells.length;
    kept /= total;
  }

  function spawn(p, anywhere) {
    p.m = MEMBERS[Math.floor(Math.random() * MEMBERS.length)];
    p.s = anywhere ? Math.random() : 1;
    p.v = rand(0.00012, 0.00026);
    p.o = rand(-0.7, 0.7);
    p.a = rand(0.25, 0.75);
    p.len = rand(0.04, 0.1);
    p.life = 0;
  }
  function seedFlow() {
    flow = [];
    for (var i = 0; i < FLOW; i++) { var p = {}; spawn(p, true); flow.push(p); }
  }
  function along(m, s) {
    var k = clamp(s) * (m.pts.length - 1), j = Math.min(m.pts.length - 2, Math.floor(k)), f = k - j;
    var a = m.pts[j], b = m.pts[j + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    var r = m.r[0] + (m.r[1] - m.r[0]) * clamp(s);
    return { x: a[0] + dx * f, y: a[1] + dy * f, nx: -dy / l, ny: dx / l, r: r };
  }

  /* 收敛后的光滑结构只画一次 */
  function buildCache() {
    var off = document.createElement('canvas');
    off.width = Math.max(1, Math.round(W * dpr));
    off.height = Math.max(1, Math.round(H * dpr));
    var c = off.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    function shape(ctx2) {
      ctx2.lineCap = 'round';
      ctx2.lineJoin = 'round';
      MEMBERS.forEach(function (m) {
        for (var j = 0; j < m.pts.length - 1; j++) {
          var r = m.r[0] + (m.r[1] - m.r[0]) * (j + 0.5) / (m.pts.length - 1);
          ctx2.lineWidth = r * 2 * scale;
          ctx2.beginPath();
          ctx2.moveTo(X(m.pts[j][0]), Y(m.pts[j][1]));
          ctx2.lineTo(X(m.pts[j + 1][0]), Y(m.pts[j + 1][1]));
          ctx2.stroke();
        }
      });
      BOSS.forEach(function (b) { ctx2.beginPath(); ctx2.arc(X(b.p[0]), Y(b.p[1]), b.r * scale, 0, Math.PI * 2); ctx2.fill(); });
    }
    /* 底层橙色光晕 */
    c.save();
    c.shadowColor = 'rgba(232,105,43,.45)';
    c.shadowBlur = scale * 0.05 * dpr;
    c.strokeStyle = c.fillStyle = 'rgba(232,105,43,.35)';
    shape(c);
    c.restore();
    /* 金属质感：上亮下暗，受载端偏暖 */
    var m2 = document.createElement('canvas');
    m2.width = off.width; m2.height = off.height;
    var k = m2.getContext('2d');
    k.setTransform(dpr, 0, 0, dpr, 0, 0);
    k.strokeStyle = k.fillStyle = '#fff';
    shape(k);
    k.globalCompositeOperation = 'source-in';
    var g = k.createLinearGradient(X(0), Y(0), X(0.4), Y(DH));
    g.addColorStop(0, '#cfcac1'); g.addColorStop(0.5, '#9a968f'); g.addColorStop(1, '#5d5a56');
    k.fillStyle = g;
    k.fillRect(0, 0, W, H);
    var w = k.createRadialGradient(X(LOAD[0]), Y(LOAD[1]), 0, X(LOAD[0]), Y(LOAD[1]), scale * 0.45);
    w.addColorStop(0, 'rgba(240,130,70,.75)'); w.addColorStop(1, 'rgba(240,130,70,0)');
    k.globalCompositeOperation = 'source-atop';
    k.fillStyle = w;
    k.fillRect(0, 0, W, H);
    k.globalCompositeOperation = 'destination-out';
    BOSS.forEach(function (b) { k.beginPath(); k.arc(X(b.p[0]), Y(b.p[1]), b.h * scale, 0, Math.PI * 2); k.fill(); });
    c.drawImage(m2, 0, 0, W, H);
    /* 孔边一圈细高光 */
    c.strokeStyle = 'rgba(255,255,255,.35)';
    c.lineWidth = 1;
    BOSS.forEach(function (b) { c.beginPath(); c.arc(X(b.p[0]), Y(b.p[1]), b.h * scale, 0, Math.PI * 2); c.stroke(); });
    cache = off;
  }

  function resize() {
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, W > 1700 ? 1.5 : 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    if (W >= 820) {
      /* 放在右上，避开左下的大标题 */
      scale = Math.min(W * 0.4, H * 0.66);
      ox = W - scale - Math.max(40, W * 0.05);
      oy = Math.max(H * 0.13, 86);
    } else {
      scale = Math.min(W * 0.84, H * 0.62);
      ox = (W - scale) / 2;
      oy = Math.max(H * 0.1, 100);
    }
    cell = Math.max(5, scale / 110);
    seed();
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

  /* 边界条件：左侧固定（斜线），右端载荷（箭头） */
  function bounds(a) {
    if (a <= 0.01) return;
    ctx.strokeStyle = 'rgba(237,233,225,' + (0.35 * a).toFixed(3) + ')';
    ctx.lineWidth = 1;
    var x0 = X(0) - 6, i;
    ctx.beginPath();
    ctx.moveTo(x0, Y(0.02)); ctx.lineTo(x0, Y(DH - 0.02));
    for (i = 0; i <= 12; i++) { var y = Y(0.03 + i * (DH - 0.06) / 12); ctx.moveTo(x0, y); ctx.lineTo(x0 - 8, y + 8); }
    ctx.stroke();
    var lx = X(LOAD[0]), ly = Y(LOAD[1]) + 0.06 * scale;
    ctx.strokeStyle = 'rgba(232,105,43,' + (0.9 * a).toFixed(3) + ')';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lx, ly); ctx.lineTo(lx, ly + 0.12 * scale);
    ctx.moveTo(lx - 5, ly + 7); ctx.lineTo(lx, ly); ctx.lineTo(lx + 5, ly + 7);
    ctx.stroke();
  }

  var BUCKETS = 8;
  function drawCells(p) {
    var L = ease(seg(p, 0.08, 0.6));
    var tint = seg(p, 0.1, 0.62);
    var fade = 1 - seg(p, 0.62, 0.74);
    var paths = [], flash = [], i, c, alive = 0, s = cell * 0.82;
    for (i = 0; i <= BUCKETS; i++) paths.push([]);
    for (i = 0; i < cells.length; i++) {
      c = cells[i];
      if (L > c.key) {
        /* 刚被淘汰的单元闪一下：只闪靠近结构的，远处的直接消失，画面不乱 */
        if (L - c.key < 0.014 && c.key > 0.3) flash.push(c);
        continue;
      }
      alive++;
      paths[Math.round(clamp(c.d * tint) * BUCKETS)].push(c);
    }
    for (i = 0; i <= BUCKETS; i++) {
      if (!paths[i].length) continue;
      var k = i / BUCKETS;
      ctx.fillStyle = 'rgba(' + Math.round(150 + 90 * k) + ',' + Math.round(150 - 45 * k) + ',' + Math.round(150 - 105 * k) + ',' + ((0.13 + 0.62 * k) * fade).toFixed(3) + ')';
      ctx.beginPath();
      paths[i].forEach(function (q) { ctx.rect(X(q.x), Y(q.y), s, s); });
      ctx.fill();
    }
    if (flash.length) {
      ctx.fillStyle = 'rgba(255,150,80,' + (0.6 * fade).toFixed(3) + ')';
      ctx.beginPath();
      flash.forEach(function (q) { ctx.rect(X(q.x), Y(q.y), s, s); });
      ctx.fill();
    }
    return alive / total;
  }

  function drawFlow(dt, strength) {
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    for (var i = 0; i < flow.length; i++) {
      var p = flow[i];
      p.s -= p.v * dt;
      p.life += dt;
      if (p.s < -p.len) { spawn(p, false); continue; }
      var a = along(p.m, p.s), b = along(p.m, p.s + p.len);
      var o = clamp(p.life / 700) * clamp((p.s + p.len) / 0.08) * p.a * strength;
      if (o < 0.01) continue;
      ctx.strokeStyle = 'rgba(255,' + Math.round(170 + 60 * Math.abs(p.o)) + ',' + Math.round(110 + 90 * Math.abs(p.o)) + ',' + o.toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(X(b.x + b.nx * b.r * p.o), Y(b.y + b.ny * b.r * p.o));
      ctx.lineTo(X(a.x + a.nx * a.r * p.o), Y(a.y + a.ny * a.r * p.o));
      ctx.stroke();
    }
  }

  function frame(p, dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    gridLines();
    ctx.translate(px, py);

    var fadeOut = 1 - seg(p, 0.95, 1);
    var fadeIn = ease(seg(p, 0, 0.05));
    ctx.globalAlpha = fadeOut * fadeIn;

    /* 设计域外框：开始时最清楚，结构成形后淡去 */
    var box = 1 - seg(p, 0.5, 0.7);
    if (box > 0.01) {
      ctx.strokeStyle = 'rgba(237,233,225,' + (0.22 * box).toFixed(3) + ')';
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 1;
      ctx.strokeRect(X(0) - 0.5, Y(0) - 0.5, scale, DH * scale);
      ctx.setLineDash([]);
    }
    bounds(1);

    var mass = 1;
    if (p < 0.74) mass = drawCells(p);
    else mass = kept;

    var show = ease(seg(p, 0.6, 0.74));
    if (show > 0 && cache) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, px * dpr, py * dpr);
      ctx.globalAlpha = show * fadeOut;
      ctx.drawImage(cache, 0, 0);
      ctx.restore();
    }
    if (dt) drawFlow(dt, ease(seg(p, 0.7, 0.8)) * fadeOut);

    /* 迭代读数：与语言无关，只用数字 */
    var it = Math.round(ease(seg(p, 0.08, 0.6)) * 64);
    ctx.font = '11px ' + getComputedStyle(document.documentElement).getPropertyValue('--mono');
    ctx.fillStyle = 'rgba(237,233,225,.5)';
    ctx.fillText('ITER ' + ('00' + it).slice(-3) + '   MASS ' + Math.round(mass * 100) + '%', X(0), Y(0) - 12);
    ctx.globalAlpha = 1;
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
      if (areas3d) mountViews();
    });
  });

  /* 字体就绪再开场，避免标题先跳一下 */
  var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 900); })]).then(function () {
    root.classList.add('ready');
    if (motion) measure();
  });
})();
