(function () {
  'use strict';
  const content = document.getElementById('readerFrame');
  if (!content) return;
  function selectedContent() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return false;
    for (let i = 0; i < selection.rangeCount; i++) {
      if (selection.getRangeAt(i).intersectsNode(content)) return true;
    }
    return false;
  }
  function editable(target) { return target instanceof Element && !!target.closest('input,textarea,[contenteditable="true"]'); }
  for (const type of ['selectstart', 'contextmenu', 'dragstart']) content.addEventListener(type, event => {
    if (!editable(event.target)) event.preventDefault();
  });
  for (const type of ['copy', 'cut']) document.addEventListener(type, event => {
    if (editable(event.target)) return;
    if (content.contains(event.target) || selectedContent()) { event.preventDefault(); event.clipboardData?.clearData(); }
  }, true);
  document.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey) || !['a', 'c', 'x'].includes(event.key.toLowerCase()) || editable(event.target)) return;
    if (content.contains(event.target) || selectedContent()) {
      event.preventDefault(); if (event.key.toLowerCase() === 'a') window.getSelection()?.removeAllRanges();
    }
  }, true);
})();
