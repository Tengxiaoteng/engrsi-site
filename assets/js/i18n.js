/* 中英文切换。中文写在页面里，英文写在同一元素的 data-en 上（可含标签），aria-label 的英文写在 data-en-label。
   语言优先级：?lang= 参数 > 上次的选择 > 浏览器语言。英文页在替换完成前先隐藏，避免闪一下中文。 */
(function (w, d) {
  'use strict';
  var KEY = 'engrsi-lang';
  var root = d.documentElement;

  function pick() {
    var m = /[?&]lang=(en|zh)\b/.exec(w.location.search);
    if (m) return m[1];
    try { var s = w.localStorage.getItem(KEY); if (s === 'en' || s === 'zh') return s; } catch (e) {}
    var nav = (w.navigator.languages && w.navigator.languages[0]) || w.navigator.language || 'zh';
    return /^zh/i.test(nav) ? 'zh' : 'en';
  }

  var lang = pick();
  var applied = null;

  function swap(el, en) {
    if (el.tagName === 'META') {
      if (el.__zh == null) el.__zh = el.getAttribute('content');
      el.setAttribute('content', en ? el.getAttribute('data-en') : el.__zh);
      return;
    }
    var zh = el.getAttribute('data-zh');
    if (zh != null) { el.textContent = en ? el.getAttribute('data-en') : zh; return; }
    if (el.__zh == null) el.__zh = el.innerHTML;
    el.innerHTML = en ? el.getAttribute('data-en') : el.__zh;
  }

  function apply(next, scope) {
    if (next) lang = next;
    var en = lang === 'en';
    root.lang = en ? 'en' : 'zh-CN';
    var box = scope || d;
    if (scope || applied !== lang) {
      Array.prototype.forEach.call(box.querySelectorAll('[data-en]'), function (el) { swap(el, en); });
      Array.prototype.forEach.call(box.querySelectorAll('[data-en-label]'), function (el) {
        if (el.__zhLabel == null) el.__zhLabel = el.getAttribute('aria-label');
        el.setAttribute('aria-label', en ? el.getAttribute('data-en-label') : el.__zhLabel);
      });
      if (!scope) applied = lang;
    }
    root.classList.remove('lang-wait');
    return lang;
  }

  function set(next) {
    try { w.localStorage.setItem(KEY, next); } catch (e) {}
    return apply(next);
  }

  root.lang = lang === 'en' ? 'en' : 'zh-CN';
  root.classList.add('i18n');
  if (lang === 'en') {
    root.classList.add('lang-wait');
    w.setTimeout(function () { root.classList.remove('lang-wait'); }, 2500);
  }

  w.I18N = {
    get lang() { return lang; },
    apply: apply,
    set: set,
    t: function (zh, en) { return lang === 'en' ? en : zh; }
  };

  /* site.js 没跑起来时（出错或被拦）也要翻译，按钮也要能用 */
  d.addEventListener('DOMContentLoaded', function () {
    if (applied !== lang) apply();
    if (w.__site) return;
    Array.prototype.forEach.call(d.querySelectorAll('[data-lang-switch]'), function (b) {
      b.addEventListener('click', function () { set(lang === 'en' ? 'zh' : 'en'); });
    });
  });
})(window, document);
