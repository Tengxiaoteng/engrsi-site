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

  /* 只在有动效、有 WebGL2、不省流量时启用（手机也启用）；否则保留线条图标动画 */
  var areas3d = null;
  (function () {
    var save = navigator.connection && navigator.connection.saveData;
    if (!motion || save) return;
    var gl = null;
    try { gl = document.createElement('canvas').getContext('webgl2'); } catch (e) { gl = null; }
    if (!gl) return;
    var lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    areas3d = $('.areas__grid');
  })();

  /* 背景三维分析层：条件同上（桌面、有动效、有 WebGL2、不省流量）。先挂好空层并切到毛玻璃样式，脚本到了再开始画 */
  var bdHost = null, bdLoad = null, bdWait = 0;
  if (areas3d) {
    bdHost = document.createElement('div');
    bdHost.className = 'bd';
    bdHost.setAttribute('aria-hidden', 'true');
    bdHost.innerHTML = '<canvas class="bd__gl"></canvas><canvas class="bd__hud"></canvas>';
    document.body.insertBefore(bdHost, document.body.firstChild);
    root.classList.add('glass');
    /* 三维脚本约 220KB，手机上要等一会儿：首屏先放加载提示；等太久就退回 2D */
    var en = (root.lang || '').toLowerCase().indexOf('en') === 0;
    bdLoad = document.createElement('div');
    bdLoad.className = 'bd-load';
    bdLoad.setAttribute('aria-hidden', 'true');
    bdLoad.innerHTML = '<i></i><span>' + (en ? 'LOADING 3D MODELS' : '正在加载三维模型') + '</span>';
    $('.hero').appendChild(bdLoad);
    bdWait = setTimeout(function () { if (bdHost && !bdHost.classList.contains('is-on')) dropBackdrop(); }, fine ? 15000 : 30000);
  }
  function loaded() {
    clearTimeout(bdWait);
    if (!bdLoad) return;
    var el = bdLoad;
    bdLoad = null;
    el.classList.add('is-done');
    setTimeout(function () { el.remove(); }, 700);
  }
  /* 首页叶片在背景层里画；脚本没到或失败就退回 2D 首屏 */
  function dropBackdrop() {
    loaded();
    if (!bdHost) return;
    root.classList.remove('glass');
    if (secMode) { canvas.classList.remove('bd__sec'); hero.insertBefore(canvas, hero.firstChild); secMode = false; }
    bdHost.remove();
    bdHost = null;
    /* 2D 首屏之前是隐藏的，尺寸要重新量 */
    if (ctx) resize();
  }

  var mounted = false;
  function mountViews() {
    if (mounted) return;
    mounted = true;
    var s = document.createElement('script');
    s.src = 'assets/js/stage.min.js';
    s.async = true;
    s.onload = function () {
      var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 60); };
      /* 背景（含首页叶片）先起，十二格空闲时再建 */
      if (bdHost) {
        try {
          window.EngStage.backdrop(bdHost);
          loaded();
        } catch (e) { dropBackdrop(); }
      }
      idle(function () {
        try { window.EngStage.fields(areas3d); } catch (e) { areas3d.classList.remove('is-3d'); }
      });
    };
    s.onerror = dropBackdrop;
    document.head.appendChild(s);
  }
  /* 毛玻璃版首页叶片也在这个脚本里，不等 load 就取 */
  if (bdHost) mountViews();

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
        var e = bdHost ? ease(seg(k, 0.05, 0.62)) : ease(seg(k, 0.2, 1));
        if (fine) pg.style.transform = 'scale(' + (1 - e * 0.07).toFixed(4) + ')';
        /* 毛玻璃版页面是透明的，上一屏要完全淡出，否则两页的字叠在一起 */
        pg.style.opacity = (1 - e * (bdHost ? 1 : 0.8)).toFixed(3);
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

  /* 示意：上百条候选叶型细线收敛成一片高负荷涡轮叶片截面，随后长出当今最先进的内部冷却结构——
     双层壁（外蒙皮 + 微通道 + 内壁，扰流柱支撑）、冲击冷却腔、前缘簇射孔与两侧成形气膜孔、
     尾缘扰流柱与压力面劈缝；最后走外部燃气、贴壁气膜和劈缝冷气。坐标以弦向约为 1，y 向上。 */
  var COUNT = 120, SAMPLES = 64, CYCLE = 18000, FLOW = 110, FILM = 110;
  var TARGET = [0.34, 0.2, 0.8, -0.12, -0.8, 0.19];
  var SK = 0.013, GP = 0.011, IW = 0.015, IN = SK + GP, CAV = IN + IW;
  var WALL = [0.03, 0.745];
  var CAVS = [[0.045, 0.15], [0.19, 0.36], [0.4, 0.56], [0.6, 0.725]];
  var TE = [0.77, 0.975], CUT = 0.9, SK2 = 0.011;
  /* 气膜孔：[所在面 +1 吸力面 / -1 压力面 / 0 前缘鼻点, 起点 s, 起点内缩, 出口 s] */
  var HOLES = [
    [0, 0.06, 0, 0], [1, 0.055, CAV + 0.006, 0.014], [-1, 0.055, CAV + 0.006, 0.014],
    [1, 0.11, IN - GP / 2, 0.15], [1, 0.3, IN - GP / 2, 0.34], [1, 0.5, IN - GP / 2, 0.54],
    [-1, 0.09, IN - GP / 2, 0.13], [-1, 0.25, IN - GP / 2, 0.29], [-1, 0.45, IN - GP / 2, 0.49], [-1, 0.64, IN - GP / 2, 0.68]
  ];
  /* 冲击孔：从冷却腔穿过内壁打到外蒙皮内侧 */
  var JETS = [];
  CAVS.forEach(function (c, i) {
    var n = i ? 3 : 2;
    for (var k = 0; k < n; k++) {
      var s = c[0] + (c[1] - c[0]) * (k + 0.5) / n;
      JETS.push([1, s], [-1, s + (c[1] - c[0]) * 0.12 / n]);
    }
  });
  var PEDS = [], PINS = [];
  for (var ps = 0.05; ps < 0.73; ps += 0.034) PEDS.push([1, ps], [-1, ps + 0.017]);
  for (var pr = 0; pr < 5; pr++) {
    var row = pr % 2 ? [-0.45, 0.45] : [-0.72, 0, 0.72];
    row.forEach(function (f) { PINS.push([0.79 + pr * 0.024, f]); });
  }
  var HEAT = [
    [0, '#fff0c2'], [0.1, '#fbb643'], [0.26, '#ea6a32'], [0.5, '#b8374f'],
    [0.72, '#e2622f'], [0.9, '#f9a93a'], [1, '#fff1c4']
  ];

  var W = 0, H = 0, dpr = 1, scale = 1, ox = 0, oy = 0, read = [0, 0];
  /* secMode：画布在背景层里，作商务合作页的背景，截面放大居中、线条加亮 */
  var secMode = false, secOn = false;
  var pop = [], flow = [], film = [], clock = 0, lastT = 0;
  var cache = null;
  var mx = 0, my = 0, px = 0, py = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function X(v) { return ox + v * scale; }
  function Y(v) { return oy - v * scale; }

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
    return { x: x, y: y, nx: -dy / len, ny: dx / len, tx: dx / len, ty: dy / len };
  }
  /* 半厚度：圆钝前缘、最大厚度靠前、尾缘留一点钝度 */
  function half(g, s) {
    s = clamp(s);
    var f = 0.2969 * Math.sqrt(s) - 0.126 * s - 0.3516 * s * s + 0.2843 * s * s * s - 0.1036 * s * s * s * s;
    return g[5] * Math.max(0, f) / 0.1001 + 0.009 * s;
  }
  /* 截面上的点：side +1 吸力面、-1 压力面、0 中弧线；k 为从表面向内缩的距离 */
  function P(s, side, k) {
    var c = centre(TARGET, s);
    if (!side) return [c.x, c.y];
    var d = side * (half(TARGET, s) - k);
    return [c.x + c.nx * d, c.y + c.ny * d];
  }
  function sAt(i, n) { var u = i / n; return 1 - Math.cos(u * Math.PI / 2); }

  function trace(c, g) {
    var i, s, p, t, up = [], lo = [];
    for (i = 0; i <= SAMPLES; i++) {
      s = sAt(i, SAMPLES);
      p = centre(g, s);
      t = half(g, s);
      up.push(X(p.x + p.nx * t), Y(p.y + p.ny * t));
      lo.push(X(p.x - p.nx * t), Y(p.y - p.ny * t));
    }
    c.beginPath();
    c.moveTo(up[0], up[1]);
    for (i = 2; i < up.length; i += 2) c.lineTo(up[i], up[i + 1]);
    for (i = lo.length - 2; i >= 0; i -= 2) c.lineTo(lo[i], lo[i + 1]);
    c.closePath();
  }
  /* a..b 之间、向内缩 kU（吸力面）/ kL（压力面，可随 s 变）的区域 */
  function region(c, a, b, kU, kL, upTo) {
    var n = Math.max(6, Math.round((b - a) * 70)), i, s, q;
    upTo = upTo === undefined ? 1 : upTo;
    var bb = a + (b - a) * upTo;
    c.beginPath();
    for (i = 0; i <= n; i++) { s = a + (bb - a) * i / n; q = P(s, 1, kU); c[i ? 'lineTo' : 'moveTo'](X(q[0]), Y(q[1])); }
    for (i = n; i >= 0; i--) { s = a + (bb - a) * i / n; q = P(s, -1, typeof kL === 'function' ? kL(s) : kL); c.lineTo(X(q[0]), Y(q[1])); }
    c.closePath();
  }
  function dot(c, q, r) { c.moveTo(X(q[0]) + r, Y(q[1])); c.arc(X(q[0]), Y(q[1]), r, 0, Math.PI * 2); }
  function pinAt(p) {
    var a = P(p[0], 1, SK2 + 0.006), b = P(p[0], -1, SK2 + 0.006), f = (p[1] + 1) / 2;
    return [b[0] + (a[0] - b[0]) * f, b[1] + (a[1] - b[1]) * f];
  }
  function holeEnds(h) {
    return h[0] ? [P(h[1], h[0], h[2]), P(h[3], h[0], 0)] : [P(h[1], 0, 0), P(0, 0, 0)];
  }
  function teLower(s) { return s > CUT ? -0.002 : SK2; }

  function seed() {
    pop = [];
    for (var i = 0; i < COUNT; i++) {
      pop.push({
        g: [
          TARGET[0] + rand(-0.2, 0.24), TARGET[1] + rand(-0.24, 0.28),
          TARGET[2] + rand(-0.26, 0.2), TARGET[3] + rand(-0.32, 0.34),
          TARGET[4] + rand(-0.24, 0.4), TARGET[5] * rand(0.5, 1.35)
        ],
        rate: rand(0.7, 1.15),
        die: i < 10 ? 2 : rand(0.08, 0.46)
      });
    }
  }

  function spawn(p, anywhere) {
    var side = Math.random() < 0.5 ? -1 : 1;
    p.s = anywhere ? rand(-0.32, 1.28) : rand(-0.42, -0.28);
    p.d = side * (0.2 + Math.pow(Math.random(), 1.5) * (side > 0 ? 0.48 : 0.3));
    p.v = rand(0.00011, 0.00022);
    p.a = rand(0.16, 0.5);
    p.len = rand(0.018, 0.05);
    p.life = 0;
  }
  function seedFlow() {
    flow = [];
    for (var i = 0; i < FLOW; i++) { var p = {}; spawn(p, true); flow.push(p); }
  }
  /* 冷气粒子：从气膜孔出口贴着表面往下游走；h < 0 表示尾缘劈缝 */
  function spawnFilm(p, anywhere) {
    p.h = Math.random() < 0.22 ? -1 : Math.floor(Math.random() * HOLES.length);
    p.u = anywhere ? Math.random() : 0;
    p.v = rand(0.00028, 0.0005);
    p.o = rand(0.002, 0.014);
    p.a = rand(0.35, 0.85);
    p.len = rand(0.08, 0.18);
    p.side = Math.random() < 0.5 ? -1 : 1;
  }
  function seedFilm() {
    film = [];
    for (var i = 0; i < FILM; i++) { var p = {}; spawnFilm(p, true); film.push(p); }
  }
  function filmPos(p, u) {
    var s, side, c, h, d;
    if (p.h < 0) {
      s = CUT + u * 0.42;
      c = centre(TARGET, s);
      h = s < 1 ? half(TARGET, s) : half(TARGET, 1) * Math.max(0, 1 - (s - 1) / 0.12);
      d = -(h * (1 - u * 0.6) + p.o * 0.4);
      return [c.x + c.nx * d, c.y + c.ny * d];
    }
    var hl = HOLES[p.h];
    side = hl[0] || p.side;
    s = (hl[0] ? hl[3] : 0.004) + u * 0.32;
    if (s > 0.985) return null;
    c = centre(TARGET, s);
    d = side * (half(TARGET, s) + p.o * (0.4 + u));
    return [c.x + c.nx * d, c.y + c.ny * d];
  }

  /* 成品截面只画一次，之后贴图 */
  function buildCache() {
    var off = document.createElement('canvas');
    off.width = Math.max(1, Math.round(W * dpr));
    off.height = Math.max(1, Math.round(H * dpr));
    var c = off.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var a = centre(TARGET, 0), b = centre(TARGET, 1);
    var heat = c.createLinearGradient(X(a.x), Y(a.y), X(b.x), Y(b.y));
    HEAT.forEach(function (st) { heat.addColorStop(st[0], st[1]); });
    var cool = c.createLinearGradient(X(a.x), Y(a.y), X(b.x), Y(b.y));
    cool.addColorStop(0, '#7a2a3f'); cool.addColorStop(0.45, '#4a1830'); cool.addColorStop(1, '#8c3a2c');
    var r;

    c.save();
    c.shadowColor = 'rgba(232,105,43,.5)';
    c.shadowBlur = scale * 0.12 * dpr;
    trace(c, TARGET);
    c.fillStyle = heat;
    c.fill();
    c.restore();
    c.save();
    trace(c, TARGET);
    c.clip();

    /* 双层壁：外蒙皮下的微通道 → 内壁（偏冷） */
    region(c, WALL[0], WALL[1], SK, SK);
    c.fillStyle = '#0d0918';
    c.fill();
    region(c, WALL[0], WALL[1], IN, IN);
    c.fillStyle = cool;
    c.fill();
    /* 扰流柱：把外蒙皮和内壁连起来 */
    c.fillStyle = '#a8423a';
    c.beginPath();
    r = Math.max(1.2, GP * 0.42 * scale);
    PEDS.forEach(function (q) { dot(c, P(q[1], q[0], SK + GP / 2), r); });
    c.fill();
    /* 冷却腔 */
    CAVS.forEach(function (cv) {
      region(c, cv[0], cv[1], CAV, CAV);
      c.fillStyle = '#07050c';
      c.fill();
      var m = P((cv[0] + cv[1]) / 2, 0, 0);
      var g = c.createRadialGradient(X(m[0]), Y(m[1]), 0, X(m[0]), Y(m[1]), scale * 0.09);
      g.addColorStop(0, 'rgba(120,170,255,.16)'); g.addColorStop(1, 'rgba(120,170,255,0)');
      c.fillStyle = g;
      c.fill();
    });
    /* 冲击孔 */
    c.strokeStyle = '#07050c';
    c.lineWidth = Math.max(1, scale * 0.0045);
    c.beginPath();
    JETS.forEach(function (j) { var p0 = P(j[1], j[0], CAV), p1 = P(j[1], j[0], SK); c.moveTo(X(p0[0]), Y(p0[1])); c.lineTo(X(p1[0]), Y(p1[1])); });
    c.stroke();
    /* 尾缘通道 + 压力面劈缝 + 扰流柱 */
    region(c, TE[0], TE[1], SK2, teLower);
    c.fillStyle = '#0a0712';
    c.fill();
    c.fillStyle = '#d4583f';
    c.beginPath();
    r = Math.max(1.2, scale * 0.0062);
    PINS.forEach(function (p) { dot(c, pinAt(p), r); });
    c.fill();
    /* 气膜孔：斜穿外蒙皮，出口扩张成扇形 */
    c.fillStyle = '#0a0612';
    HOLES.forEach(function (h) {
      var e = holeEnds(h), p0 = e[0], p1 = e[1];
      var dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1;
      var nx = -dy / l, ny = dx / l, w0 = 0.0028, w1 = h[0] ? 0.0085 : 0.004;
      var m = [p0[0] + dx * 0.55, p0[1] + dy * 0.55];
      c.beginPath();
      c.moveTo(X(p0[0] + nx * w0), Y(p0[1] + ny * w0));
      c.lineTo(X(m[0] + nx * w0), Y(m[1] + ny * w0));
      c.lineTo(X(p1[0] + nx * w1 + dx * 0.1), Y(p1[1] + ny * w1 + dy * 0.1));
      c.lineTo(X(p1[0] - nx * w1 + dx * 0.1), Y(p1[1] - ny * w1 + dy * 0.1));
      c.lineTo(X(m[0] - nx * w0), Y(m[1] - ny * w0));
      c.lineTo(X(p0[0] - nx * w0), Y(p0[1] - ny * w0));
      c.closePath();
      c.fill();
    });
    /* 热障涂层：外表面一层浅色陶瓷 */
    trace(c, TARGET);
    c.strokeStyle = 'rgba(246,236,220,.55)';
    c.lineWidth = Math.max(1.5, scale * 0.009);
    c.stroke();
    c.restore();
    /* 外轮廓细高光 */
    trace(c, TARGET);
    c.strokeStyle = 'rgba(255,236,210,.35)';
    c.lineWidth = 1;
    c.stroke();
    cache = off;
  }

  function resize() {
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, W > 1700 ? 1.5 : 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    if (secMode && W < 820) {
      /* 手机：放在页头上方空着的那块，居中 */
      scale = Math.min(W * 0.62, H * 0.27);
      ox = W * 0.5 - scale * 0.5;
      oy = H * 0.23 - 0.25 * scale;
      read = [W - 16, 0];
      buildCache();
      return;
    }
    if (secMode) {
      /* 截面居中放大：弦向 0..1，高度方向约 -0.8..0.3 */
      /* 右上那块空着的位置（左边是标题和联系方式，下面是横向流程） */
      scale = Math.min(W * 0.27, H * (H > 800 ? 0.42 : 0.37));
      ox = W * 0.76 - scale * 0.5;
      oy = H * (H > 800 ? 0.34 : 0.335) - 0.25 * scale;
      read = [ox + scale, oy - 0.36 * scale];
      buildCache();
      return;
    }
    if (W >= 820) {
      /* 放在右上，避开左下的大标题 */
      scale = Math.min(W * 0.34, H * 0.56);
      ox = W - scale * 1.04 - Math.max(40, W * 0.05);
      oy = Math.max(H * 0.14, 96) + scale * 0.36;
    } else {
      scale = Math.min(W * 0.76, H * 0.42);
      ox = (W - scale) / 2;
      oy = Math.max(H * 0.1, 96) + scale * 0.4;
    }
    /* 读数贴着右侧那行说明文字：桌面在它下面，手机在它上面 */
    /* 用 offset 量，不受说明文字入场位移的影响；画布铺满首屏，原点相同 */
    var note = $('.hero__note');
    read = note && note.offsetParent === canvas.parentNode
      ? [note.offsetLeft + note.offsetWidth, W >= 820 ? note.offsetTop + note.offsetHeight + 16 : note.offsetTop - 10]
      : [W - 40, 120];
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
      var near = clamp(1 - (Math.abs(p.d) - 0.2) / 0.2);
      ctx.strokeStyle = near > 0.1
        ? 'rgba(244,' + Math.round(190 - near * 70) + ',' + Math.round(150 - near * 90) + ',' + o.toFixed(3) + ')'
        : 'rgba(237,233,225,' + (o * 0.62).toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(X(b.x + b.nx * p.d), Y(b.y + b.ny * p.d));
      ctx.lineTo(X(a.x + a.nx * p.d), Y(a.y + a.ny * p.d));
      ctx.stroke();
    }
  }

  function drawFilm(dt, strength) {
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    for (var i = 0; i < film.length; i++) {
      var p = film[i];
      p.u += p.v * dt;
      if (p.u > 1) { spawnFilm(p, false); continue; }
      var q1 = filmPos(p, p.u), q0 = filmPos(p, Math.max(0, p.u - p.len));
      if (!q1 || !q0) { spawnFilm(p, false); continue; }
      var o = p.a * strength * Math.sin(Math.PI * Math.min(1, p.u * 1.15));
      if (o < 0.01) continue;
      ctx.strokeStyle = 'rgba(' + Math.round(170 + 70 * (1 - p.u)) + ',225,255,' + o.toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(X(q0[0]), Y(q0[1]));
      ctx.lineTo(X(q1[0]), Y(q1[1]));
      ctx.stroke();
    }
    /* 冲击射流：腔内冷气打向外蒙皮 */
    ctx.strokeStyle = 'rgba(150,205,255,' + (0.75 * strength).toFixed(3) + ')';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([2, 5]);
    ctx.lineDashOffset = -clock / 45;
    ctx.beginPath();
    JETS.forEach(function (j) { var p0 = P(j[1], j[0], CAV + 0.012), p1 = P(j[1], j[0], SK); ctx.moveTo(X(p0[0]), Y(p0[1])); ctx.lineTo(X(p1[0]), Y(p1[1])); });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /* 内部结构以线稿逐项长出来 */
  function drawBuild(p) {
    var fade = 1 - seg(p, 0.72, 0.8);
    if (fade <= 0) return;
    function ink(t) { return seg(p, t, t + 0.04) * fade; }
    function stroke(a, warm) {
      ctx.strokeStyle = warm ? 'rgba(232,105,43,' + (0.9 * a).toFixed(3) + ')' : 'rgba(237,233,225,' + (0.55 * a).toFixed(3) + ')';
      ctx.stroke();
    }
    var a, i;
    ctx.lineWidth = 1;
    a = ink(0.44);
    if (a > 0) { trace(ctx, TARGET); stroke(a, true); }
    a = ink(0.48);
    if (a > 0) {
      var grow = ease(seg(p, 0.48, 0.56));
      region(ctx, WALL[0], WALL[1], SK, SK, grow); stroke(a);
      region(ctx, WALL[0], WALL[1], IN, IN, grow); stroke(a);
    }
    a = ink(0.53);
    if (a > 0) { ctx.beginPath(); PEDS.forEach(function (q) { dot(ctx, P(q[1], q[0], SK + GP / 2), Math.max(1, GP * 0.42 * scale)); }); stroke(a * 0.8); }
    CAVS.forEach(function (cv, k) {
      a = ink(0.55 + k * 0.025);
      if (a > 0) { region(ctx, cv[0], cv[1], CAV, CAV); stroke(a); }
    });
    a = ink(0.64);
    if (a > 0) { region(ctx, TE[0], TE[1], SK2, teLower); stroke(a); ctx.beginPath(); PINS.forEach(function (q) { dot(ctx, pinAt(q), Math.max(1, scale * 0.0062)); }); stroke(a * 0.8); }
    for (i = 0; i < HOLES.length; i++) {
      var t = 0.66 + i * 0.006;
      a = ink(t);
      if (a <= 0) continue;
      var e = holeEnds(HOLES[i]), flash = 1 - seg(p, t + 0.01, t + 0.05);
      ctx.beginPath();
      ctx.moveTo(X(e[0][0]), Y(e[0][1]));
      ctx.lineTo(X(e[1][0]), Y(e[1][1]));
      ctx.lineWidth = 1 + flash;
      stroke(a, flash > 0.2);
      ctx.lineWidth = 1;
    }
  }

  function frame(p, dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    gridLines();
    ctx.translate(px, py);

    var fadeOut = 1 - seg(p, 0.95, 1);
    var pull = ease(seg(p, 0, 0.5));
    var fade = fadeOut * ease(seg(p, 0, 0.05));
    var i, n, k, life, flash, j, g = [0, 0, 0, 0, 0, 0], alive = 0;
    ctx.globalAlpha = 1;

    if (dt) drawFlow(dt, 0.4 + 0.6 * ease(seg(p, 0.7, 0.82)) * fadeOut);

    ctx.lineWidth = 1;
    /* 背景版：候选线叠加发亮 */
    var boost = secMode ? 1.7 : 1;
    if (secMode) ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < pop.length; i++) {
      n = pop[i];
      life = 1 - seg(p, n.die, n.die + 0.03);
      if (life <= 0) continue;
      alive++;
      flash = seg(p, n.die - 0.03, n.die) * life;
      k = Math.min(1, pull * n.rate);
      for (j = 0; j < 6; j++) g[j] = n.g[j] + (TARGET[j] - n.g[j]) * k;
      var alpha = (1 - seg(p, 0.5, 0.58)) * fade;
      if (alpha <= 0.002) continue;
      trace(ctx, g);
      ctx.strokeStyle = flash > 0.02
        ? 'rgba(232,105,43,' + (0.8 * flash * alpha).toFixed(3) + ')'
        : 'rgba(237,233,225,' + (0.17 * life * alpha * boost).toFixed(3) + ')';
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    ctx.globalAlpha = fade;
    drawBuild(p);
    ctx.globalAlpha = 1;

    var show = ease(seg(p, 0.7, 0.78)) * fadeOut;
    if (show > 0 && cache) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, px * dpr, py * dpr);
      ctx.globalAlpha = show;
      ctx.drawImage(cache, 0, 0);
      /* 热呼吸 */
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = show * (0.08 + 0.07 * Math.sin(clock / 1100));
      ctx.drawImage(cache, 0, 0);
      ctx.restore();
    }
    if (dt) drawFilm(dt, ease(seg(p, 0.76, 0.86)) * fadeOut);

    /* 读数：与语言无关，只用数字和代号 */
    ctx.font = '11px ' + getComputedStyle(document.documentElement).getPropertyValue('--mono');
    ctx.fillStyle = 'rgba(237,233,225,' + (0.5 * fade).toFixed(3) + ')';
    var txt = p < 0.5
      ? 'GEN ' + ('00' + Math.round(pull * 240)).slice(-3) + '   CANDIDATES ' + alive
      : 'TBC   DOUBLE-WALL   IMPINGEMENT ' + JETS.length + '   FILM ' + HOLES.length + '   PIN ' + PINS.length;
    ctx.textAlign = 'right';
    if (W >= 820) ctx.fillText(txt, read[0] - px, read[1] - py);
    ctx.textAlign = 'left';
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
    seedFilm();
    resize();
    /* 回归测试用：直接画某一时刻 */
    canvas.__hero = function (p, n) { for (var i = 0; i < (n || 1); i++) { clock = p * CYCLE; frame(p, 16); } };
    /* 背景版测试：跳到某一时刻并保持播放 */
    canvas.__sec = function (sec) { secOn = true; clock = sec * 1000; };
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

  /* ---------- 服务单位：中文名一行写完，放不下就按比例缩字号 ---------- */

  function fitNames() {
    var one = (document.documentElement.lang || '').indexOf('en') !== 0 && window.innerWidth > 1080;
    $$('.clients__grid > li > span:last-child').forEach(function (el) {
      el.style.fontSize = '';
      if (!one || el.scrollWidth <= el.clientWidth + 1) return;
      var f = parseFloat(getComputedStyle(el).fontSize);
      el.style.fontSize = Math.max(10.5, Math.floor(f * el.clientWidth / el.scrollWidth * 2) / 2) + 'px';
    });
  }

  /* 合作流程：量出每个节点在导轨上的位置，换算成流光经过它的时刻（亮头走 0→100% 高度） */
  function flowSync() {
    var ol = $('.flow__list');
    if (!ol || !ol.offsetHeight) return;
    var h = ol.offsetHeight;
    $$('.flow__list > li').forEach(function (li) {
      var y = li.offsetTop + parseFloat(getComputedStyle(li).paddingTop) + (parseFloat(getComputedStyle(li, '::before').height) || 0) / 2;
      li.style.setProperty('--at', Math.min(1, y / h).toFixed(3));
    });
  }
  function fitText() { fitNames(); flowSync(); }
  fitText();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitText);

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
      fitText();
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
      fitText();
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
    if (ctx && !bdHost && y < m.vh && !document.hidden) drawHero(now);
    else if (secMode && !document.hidden && bdHost.classList.contains('is-sec')) {
      /* 每次翻到商务合作页都从头收敛 */
      if (!secOn) { secOn = true; clock = 0; seed(); lastT = 0; }
      drawHero(now);
    } else { lastT = 0; if (secOn && secMode && !bdHost.classList.contains('is-sec')) secOn = false; }
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
