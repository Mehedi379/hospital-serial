/* ============================================================
   Custom dropdown — replaces every native <select> on the page
   with a styled, animated dropdown while keeping the original
   <select> in the DOM (hidden) so all existing form logic,
   FormData, .value reads and 'change' listeners keep working.

   Usage: just include this script. It auto-enhances all <select>
   elements, re-syncs when their options change (dynamic doctor
   lists etc.), and enhances selects added later.

   Opt out on a single select with  data-no-custom.
   ============================================================ */
(function () {
  'use strict';

  // --- one-time styles -------------------------------------------------
  var css = `
  .csel { position: relative; width: auto; font-family: inherit; }
  .csel select.csel-native {
    position: absolute; opacity: 0; width: 1px; height: 1px;
    pointer-events: none; margin: 0;
  }
  .csel-btn {
    width: 100%; display: flex; align-items: center; justify-content: space-between;
    gap: 8px; cursor: pointer; text-align: left; border: 1.5px solid transparent;
    background: rgba(0,0,0,.05); color: inherit; border-radius: 10px;
    padding: 10px 12px; font: inherit; font-weight: 600; line-height: 1.2;
    transition: border-color .15s, background .15s, box-shadow .15s;
  }
  .csel-btn:hover { background: rgba(0,0,0,.08); }
  .csel.open .csel-btn { border-color: #c22832; background: #fff; box-shadow: 0 0 0 3px rgba(194,40,50,.15); }
  .csel-btn.placeholder { color: #8a8a8a; font-weight: 500; }
  .csel-btn:disabled { opacity: .6; cursor: not-allowed; }
  .csel-arrow { flex: none; transition: transform .2s; font-size: 20px; opacity: .7; }
  .csel.open .csel-arrow { transform: rotate(180deg); }

  .csel-menu {
    position: absolute; z-index: 60; left: 0; right: 0; top: calc(100% + 6px);
    background: #fff; border: 1px solid rgba(0,0,0,.12); border-radius: 12px;
    box-shadow: 0 12px 32px -8px rgba(0,0,0,.35); padding: 6px;
    max-height: 260px; overflow-y: auto;
    opacity: 0; transform: translateY(-6px) scale(.98); pointer-events: none;
    transition: opacity .15s, transform .15s;
  }
  .csel.open .csel-menu { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
  .csel.up .csel-menu { top: auto; bottom: calc(100% + 6px); transform-origin: bottom; }
  .csel-opt {
    padding: 10px 12px; border-radius: 8px; cursor: pointer; color: #1f1f1f;
    font-weight: 600; display: flex; align-items: center; gap: 8px; white-space: normal;
  }
  .csel-opt:hover, .csel-opt.active { background: rgba(194,40,50,.10); }
  .csel-opt.selected { background: #c22832; color: #fff; }
  .csel-opt[data-disabled="1"] { opacity: .45; cursor: not-allowed; }
  .csel-opt .csel-check { margin-left: auto; font-size: 18px; opacity: 0; }
  .csel-opt.selected .csel-check { opacity: 1; }
  `;
  var style = document.createElement('style');
  style.id = 'csel-styles';
  style.textContent = css;
  if (!document.getElementById('csel-styles')) document.head.appendChild(style);

  var openInstance = null;

  function closeAll() {
    if (openInstance) { openInstance.wrap.classList.remove('open', 'up'); openInstance = null; }
  }
  document.addEventListener('click', function (e) {
    if (openInstance && !openInstance.wrap.contains(e.target)) closeAll();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });

  function enhance(select) {
    if (!select || select.dataset.noCustom !== undefined || select._csel) return;
    select._csel = true;

    var wrap = document.createElement('div');
    wrap.className = 'csel';
    // carry over only LAYOUT classes from the select (width, margin, grid/flex
    // placement); drop visual classes (bg/padding/border/rounded/text/font) that
    // belong to the button instead.
    if (select.className) {
      var keep = select.className.split(/\s+/).filter(function (c) {
        return /^((sm|md|lg|xl):)?(w-|mt-|mb-|ml-|mr-|mx-|my-|col-span|row-span|flex|grow|shrink|order-|self-|justify-|hidden|block|inline|h-|min-|max-)/.test(c);
      });
      if (keep.length) wrap.className += ' ' + keep.join(' ');
    }

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'csel-btn';

    var label = document.createElement('span');
    label.className = 'csel-label';
    var arrow = document.createElement('span');
    arrow.className = 'csel-arrow mso';
    arrow.textContent = 'expand_more';
    btn.appendChild(label);
    btn.appendChild(arrow);

    var menu = document.createElement('div');
    menu.className = 'csel-menu';

    // put the native select (hidden) inside the wrapper so FormData still works
    select.parentNode.insertBefore(wrap, select);
    select.classList.add('csel-native');
    wrap.appendChild(select);
    wrap.appendChild(btn);
    wrap.appendChild(menu);

    function renderLabel() {
      var opt = select.options[select.selectedIndex];
      var txt = opt ? opt.textContent.trim() : '';
      var isPlaceholder = !opt || opt.value === '';
      label.textContent = txt || 'Select…';
      btn.classList.toggle('placeholder', isPlaceholder);
      btn.disabled = select.disabled;
    }

    function renderMenu() {
      menu.innerHTML = '';
      Array.prototype.forEach.call(select.options, function (opt, i) {
        var row = document.createElement('div');
        row.className = 'csel-opt' + (i === select.selectedIndex ? ' selected' : '');
        if (opt.disabled) row.dataset.disabled = '1';
        var t = document.createElement('span');
        t.textContent = opt.textContent.trim() || ' ';
        var chk = document.createElement('span');
        chk.className = 'csel-check mso';
        chk.textContent = 'check';
        row.appendChild(t);
        row.appendChild(chk);
        row.addEventListener('click', function () {
          if (opt.disabled) return;
          if (select.selectedIndex !== i) {
            select.selectedIndex = i;
            select.dispatchEvent(new Event('input', { bubbles: true }));
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
          renderLabel();
          renderMenu();
          closeAll();
        });
        menu.appendChild(row);
      });
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (select.disabled) return;
      if (openInstance && openInstance.wrap === wrap) { closeAll(); return; }
      closeAll();
      renderMenu();
      wrap.classList.add('open');
      openInstance = { wrap: wrap };
      // flip upward if not enough room below
      var r = wrap.getBoundingClientRect();
      if (window.innerHeight - r.bottom < 280 && r.top > 280) wrap.classList.add('up');
    });

    // keep custom UI in sync if code changes select.value or its options
    select.addEventListener('change', function () { renderLabel(); });
    var mo = new MutationObserver(function () { renderLabel(); if (wrap.classList.contains('open')) renderMenu(); });
    mo.observe(select, { childList: true, attributes: true, attributeFilter: ['value', 'disabled'] });

    // reflect .value setter changes (dynamic population) via periodic-ish sync:
    // MutationObserver covers option list changes; a light input listener covers the rest.
    renderLabel();
  }

  function enhanceAll(root) {
    (root || document).querySelectorAll('select').forEach(enhance);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { enhanceAll(); });
  } else {
    enhanceAll();
  }

  // enhance selects added to the DOM later
  var domMo = new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      m.addedNodes.forEach(function (n) {
        if (n.nodeType !== 1) return;
        if (n.tagName === 'SELECT') enhance(n);
        else if (n.querySelectorAll) n.querySelectorAll('select').forEach(enhance);
      });
    });
  });
  domMo.observe(document.documentElement, { childList: true, subtree: true });

  // expose for manual re-sync if a page needs it
  window.CustomSelect = { enhanceAll: enhanceAll, closeAll: closeAll };
})();
