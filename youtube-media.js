(function bootstrap(root) {
  'use strict';
  const validId = /^[A-Za-z0-9_-]{11}$/;
  const active = new Set();
  function parse(value) {
    if (typeof value !== 'string') throw Error('請貼上 YouTube 影片網址。');
    let url;
    try { url = new URL(value.trim()); } catch { throw Error('請貼上完整的 YouTube 影片網址。'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) throw Error('請使用 YouTube 影片網址。');
    let id;
    if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname)) {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else id = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)\/?$/)?.[1];
    }
    if (!validId.test(id || '')) throw Error('無法辨識影片，請使用 YouTube 的影片分享連結。');
    const t = url.searchParams.get('start') || url.searchParams.get('t') || new URLSearchParams(url.hash.slice(1)).get('t') || '0';
    const parts = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    const start = /^\d+$/.test(t) ? Number(t) : parts && t ? Number(parts[1] || 0) * 3600 + Number(parts[2] || 0) * 60 + Number(parts[3] || 0) : NaN;
    if (!Number.isSafeInteger(start) || start < 0 || start > 86400) throw Error('影片開始時間不正確。');
    return { id, start };
  }
  function valid(video) {
    return video && typeof video.id === 'string' && validId.test(video.id) && Number.isInteger(video.start ?? 0) && (video.start ?? 0) >= 0 && (video.start ?? 0) <= 86400;
  }
  function stop(container = document) {
    for (const frame of [...active]) if (container.contains(frame) || !frame.isConnected) {
      const tile = frame.parentElement;
      frame.remove(); active.delete(frame);
      if (tile) tile.querySelector('[data-youtube-play]').hidden = false;
    }
  }
  function create(video, doc = document, editable = false) {
    if (!valid(video)) throw Error('YouTube 影片資料不正確。');
    const tile = doc.createElement('div');
    tile.className = 'youtube-block'; tile.dataset.youtubeId = video.id; tile.dataset.youtubeStart = String(video.start || 0); tile.contentEditable = 'false';
    const play = doc.createElement('button');
    play.type = 'button'; play.dataset.youtubePlay = ''; play.className = 'youtube-play'; play.title = '播放 YouTube 影片';
    play.textContent = '▶ YouTube'; play.setAttribute('aria-label', '播放 YouTube 影片');
    play.onclick = () => {
      stop(doc);
      const frame = doc.createElement('iframe');
      frame.src = `https://www.youtube-nocookie.com/embed/${video.id}?playsinline=1&start=${video.start || 0}`;
      frame.title = 'YouTube 影片'; frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; frame.allowFullscreen = true;
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      play.hidden = true; tile.append(frame); active.add(frame);
    };
    tile.append(play);
    if (editable) {
      const tools = doc.createElement('div'); tools.className = 'youtube-actions';
      for (const [action, label, icon] of [['edit', '修改 YouTube 連結', '↗'], ['delete', '刪除影片', '×']]) {
        const button = doc.createElement('button'); button.type = 'button'; button.dataset.youtubeAction = action;
        button.title = label; button.setAttribute('aria-label', label); button.textContent = icon; tools.append(button);
      }
      tile.append(tools);
    }
    return tile;
  }
  function mount(container, editable = false) {
    for (const tile of container.querySelectorAll('[data-youtube-id]')) {
      const video = { id: tile.dataset.youtubeId, start: Number(tile.dataset.youtubeStart || 0) };
      tile.replaceWith(create(video, container.ownerDocument, editable));
    }
  }
  root.YouTubeMedia = { parse, valid, create, mount, stop, source: '(' + bootstrap.toString() + ')(window);' };
})(window);
