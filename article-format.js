(function bootstrap(root) {
  'use strict';
  function render(block, options = {}) {
    const d = options.document || root.document;
    if (block.soundcloud) return root.YouTubeMedia.createSoundCloud(block.soundcloud, d, !!options.editable);
    if (block.youtube) return root.YouTubeMedia.create(block.youtube, d, !!options.editable);
    if (block.table) {
      const table = d.createElement('table');
      for (const row of block.table) {
        const tr = d.createElement('tr');
        for (const cell of row) { const td = d.createElement('td'); td.append(renderAll(cell, options)); tr.append(td); }
        table.append(tr);
      }
      const wrap = d.createElement('div'); wrap.className = 'reading-table'; wrap.append(table); return wrap;
    }
    const el = d.createElement(block.quote ? 'blockquote' : block.heading ? 'h' + Math.min(block.heading + 1, 6) : block.bullet ? 'li' : 'p');
    if (block.quote) el.dataset.quote = block.quote;
    if (block.align) el.dataset.align = block.align;
    for (const run of block.runs || []) {
      let node;
      if (run.image) {
        node = d.createElement('img'); node.alt = '文章圖片';
        if (run.imageWidth && run.imageHeight) { node.width = run.imageWidth; node.height = run.imageHeight; }
        if (options.image) options.image(node, run.image); else node.src = run.image;
      } else {
        node = d.createTextNode(run.text || '');
        for (const [flag, tag] of [['bold', 'strong'], ['italic', 'em'], ['underline', 'u'], ['strike', 's']]) {
          if (run[flag]) { const wrap = d.createElement(tag); wrap.append(node); node = wrap; }
        }
      }
      if (run.link && /^https?:\/\//i.test(run.link)) {
        const a = d.createElement('a'); a.href = run.link; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.append(node); node = a;
      }
      el.append(node);
    }
    if (!el.childNodes.length || (!el.textContent && !el.querySelector('img'))) { el.replaceChildren(d.createElement('br')); el.classList.add('reading-empty'); }
    return el;
  }
  function renderAll(blocks, options = {}) {
    const d = options.document || root.document, fragment = d.createDocumentFragment();
    let list = null, lastType = null;
    for (const block of blocks) {
      if (block.bullet && !block.quote && !block.heading) {
        const type = block.listType === 'ordered' ? 'ol' : 'ul';
        if (!list || type !== lastType || (block.listStart && block.listStart !== 1)) {
          list = d.createElement(type); if (type === 'ol' && block.listStart) list.start = block.listStart;
          fragment.append(list); lastType = type;
        }
        list.append(render(block, options));
      } else { list = null; lastType = null; fragment.append(render(block, options)); }
    }
    return fragment;
  }
  function fromDOM(parent) {
    const blocks = []; let inline = [];
    const isBlock = n => n?.nodeType === 1 && ['P', 'DIV', 'LI', 'BLOCKQUOTE'].includes(n.tagName);
    function flush() { if (inline.length) { blocks.push({ runs: inline, heading: 0, bullet: false }); inline = []; } }
    function runs(node, flags = {}) {
      if (node.nodeType === 3) return [{ text: node.textContent, ...flags }];
      if (node.nodeType !== 1) return [];
      const tag = node.tagName;
      if (tag === 'IMG') {
        const width = Number(node.getAttribute('width')), height = Number(node.getAttribute('height'));
        return [{ image: node.getAttribute('src'), ...(width > 0 && height > 0 ? { imageWidth: width, imageHeight: height } : {}) }];
      }
      if (tag === 'BR') return [{ text: '\n', ...flags }];
      if (['P', 'DIV'].includes(tag) && node.childNodes.length === 1 && node.firstChild.nodeName === 'BR') return [];
      const next = { ...flags };
      if (['B', 'STRONG'].includes(tag)) next.bold = true;
      if (['I', 'EM'].includes(tag)) next.italic = true;
      if (tag === 'U') next.underline = true;
      if (['S', 'STRIKE', 'DEL'].includes(tag)) next.strike = true;
      if (tag === 'A' && /^https?:\/\//i.test(node.getAttribute('href') || '')) next.link = node.getAttribute('href');
      const result = []; let previous = null;
      for (const child of node.childNodes) {
        if (previous && (isBlock(previous) || isBlock(child))) result.push({ text: '\n' });
        result.push(...runs(child, next)); previous = child;
      }
      return result;
    }
    for (const node of parent.childNodes) {
      if (node.nodeType !== 1) { inline.push(...runs(node)); continue; }
      if (node.dataset.soundcloudUrl || node.dataset.youtubeId) {
        flush(); blocks.push(node.dataset.soundcloudUrl ? { soundcloud: { url: node.dataset.soundcloudUrl, start: Number(node.dataset.soundcloudStart || 0) } } : { youtube: { id: node.dataset.youtubeId, start: Number(node.dataset.youtubeStart || 0) } });
      } else if (node.tagName === 'TABLE') { flush(); blocks.push({ table: [...node.rows].map(row => [...row.cells].map(fromDOM)) }); }
      else if (['UL', 'OL'].includes(node.tagName)) {
        flush(); const items = fromDOM(node);
        items.forEach((item, i) => { if (item.bullet) { item.listType = node.tagName === 'OL' ? 'ordered' : 'unordered'; if (i === 0 && node.tagName === 'OL') item.listStart = node.start || 1; } });
        blocks.push(...items);
      } else if (['P', 'DIV', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'LI'].includes(node.tagName)) {
        flush();
        if (node.tagName === 'DIV' && node.querySelector('p,div,blockquote,table,ul,ol')) blocks.push(...fromDOM(node));
        else blocks.push({ runs: runs(node), heading: /^H[2-6]$/.test(node.tagName) ? Number(node.tagName[1]) - 1 : 0, bullet: node.tagName === 'LI', ...(node.tagName === 'BLOCKQUOTE' ? { quote: node.dataset.quote || 'plain' } : {}), ...(node.dataset.align ? { align: node.dataset.align } : {}) });
      } else inline.push(...runs(node));
    }
    flush(); return blocks;
  }
  root.ArticleFormat = { render, renderAll, fromDOM, source: '(' + bootstrap.toString() + ')(window);' };
})(window);
