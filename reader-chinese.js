(function (root) {
  'use strict';
  const base = new URL('.', document.currentScript.src);
  const body = document.getElementById('readerFrame');
  const controls = document.getElementById('readerChineseControl');
  let originals = new Map(), revision = 0, ready = false, library, converter;
  function buttons(mode, disabled = false) {
    for (const button of controls.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.chinese === mode));
      button.disabled = disabled;
    }
  }
  function reset() {
    ++revision; originals.clear(); ready = false;
    body.lang = 'zh-Hant'; buttons('traditional', true);
  }
  function capture() {
    originals.clear();
    for (const element of [body, document.getElementById('readerTitle'), document.getElementById('readerSub')]) {
      if (!element) continue;
      const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) {
        const node = walk.currentNode;
        if (!node.parentElement.closest('button,iframe,script,style,.youtube-block')) originals.set(node, node.data);
      }
    }
    ready = true; body.lang = 'zh-Hant'; buttons('traditional');
  }
  function load() {
    if (root.OpenCC) return Promise.resolve();
    if (!library) library = new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = new URL('vendor/t2cn.js', base).href;
      script.onload = () => root.OpenCC ? resolve() : reject(Error('繁簡轉換元件無法載入。'));
      script.onerror = () => { library = null; script.remove(); reject(Error('繁簡轉換元件無法載入，請重新整理後再試。')); };
      document.head.append(script);
    });
    return library;
  }
  async function set(mode) {
    if (!ready || !['traditional', 'simplified'].includes(mode)) return;
    const request = ++revision;
    try {
      if (mode === 'simplified') {
        buttons('traditional', true); await load();
        if (request !== revision || !ready) return;
        converter ||= root.OpenCC.Converter({ from: 'tw', to: 'cn' });
      }
      const top = body.scrollTop;
      for (const [node, text] of originals) if (node.isConnected) node.data = mode === 'simplified' ? converter(text) : text;
      body.lang = mode === 'simplified' ? 'zh-Hans' : 'zh-Hant';
      buttons(mode); body.scrollTop = top;
      root.updateReadingProgress?.();
    } catch (error) {
      if (request === revision) { buttons('traditional'); root.alert(error.message); }
    }
  }
  controls.addEventListener('click', event => {
    const button = event.target.closest('[data-chinese]'); if (button) set(button.dataset.chinese);
  });
  root.ReaderChinese = { reset, capture, set };
  reset();
})(window);
