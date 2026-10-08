(function bootstrap(root) {
  'use strict';
  const validId = /^[A-Za-z0-9_-]{11}$/;
  const active = new Set();
  let soundCloudAPI;
  function parseSoundCloud(value) {
    let url;
    try { url = new URL(value.trim()); } catch { throw Error('請貼上完整的 SoundCloud 歌曲網址。'); }
    if (!['http:', 'https:'].includes(url.protocol) || !['soundcloud.com', 'www.soundcloud.com'].includes(url.hostname) || url.username || url.password || url.port || !/^\/[\w-]+\/[\w-]+\/?$/.test(url.pathname) || url.pathname.split('/')[2] === 'sets') throw Error('請使用 SoundCloud 單首歌曲的完整分享連結。');
    const t = new URLSearchParams(url.hash.slice(1)).get('t') || url.searchParams.get('t') || '0';
    if (!/^\d+(?::[0-5]\d){0,2}$/.test(t)) throw Error('音樂開始時間不正確。');
    const start = t.split(':').reduce((n, part) => n * 60 + Number(part), 0);
    if (!Number.isSafeInteger(start) || start > 86400) throw Error('音樂開始時間不正確。');
    const canonical = new URL('https://soundcloud.com' + url.pathname.replace(/\/$/, ''));
    const secret = url.searchParams.get('secret_token');
    if (secret) { if (!/^s-[\w-]+$/.test(secret)) throw Error('私人歌曲連結不正確。'); canonical.searchParams.set('secret_token', secret); }
    return { url: canonical.href, start };
  }
  function validSoundCloud(value) {
    try { return value && typeof value.url === 'string' && parseSoundCloud(value.url).url === value.url && Number.isInteger(value.start ?? 0) && (value.start ?? 0) >= 0 && (value.start ?? 0) <= 86400; } catch { return false; }
  }
  function loadSoundCloudAPI(doc) {
    if (root.SC?.Widget) return Promise.resolve(root.SC);
    if (!soundCloudAPI) soundCloudAPI = new Promise((resolve, reject) => {
      const script = doc.createElement('script'); script.src = 'https://w.soundcloud.com/player/api.js';
      script.onload = () => root.SC?.Widget ? resolve(root.SC) : reject(Error('播放器無法載入'));
      script.onerror = () => { soundCloudAPI = null; script.remove(); reject(Error('播放器無法載入')); };
      doc.head.append(script);
    });
    return soundCloudAPI;
  }
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
      if (tile) tile.querySelector('[data-youtube-play], [data-soundcloud-play]').hidden = false;
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
    for (const tile of container.querySelectorAll('[data-soundcloud-url]')) {
      tile.replaceWith(createSoundCloud({ url: tile.dataset.soundcloudUrl, start: Number(tile.dataset.soundcloudStart || 0) }, container.ownerDocument, editable));
    }
    for (const tile of container.querySelectorAll('[data-youtube-id]')) {
      const video = { id: tile.dataset.youtubeId, start: Number(tile.dataset.youtubeStart || 0) };
      tile.replaceWith(create(video, container.ownerDocument, editable));
    }
  }
  function createSoundCloud(audio, doc = document, editable = false) {
    if (!validSoundCloud(audio)) throw Error('SoundCloud 音樂資料不正確。');
    const tile = doc.createElement('div'); tile.className = 'youtube-block soundcloud-block';
    tile.dataset.soundcloudUrl = audio.url; tile.dataset.soundcloudStart = String(audio.start || 0); tile.contentEditable = 'false';
    const play = doc.createElement('button'); play.type = 'button'; play.className = 'youtube-play'; play.dataset.soundcloudPlay = '';
    play.textContent = '▶ SoundCloud'; play.title = '載入 SoundCloud 音樂'; play.setAttribute('aria-label', play.title);
    play.onclick = () => {
      stop(doc);
      const src = new URL('https://w.soundcloud.com/player/');
      src.search = new URLSearchParams({ url: audio.url, auto_play: 'false', visual: 'false', show_comments: 'false' }).toString();
      const frame = doc.createElement('iframe'); frame.src = src.href; frame.title = 'SoundCloud 音樂'; frame.allow = 'autoplay'; frame.referrerPolicy = 'strict-origin-when-cross-origin';
      play.hidden = true; tile.append(frame); active.add(frame);
      if (audio.start) loadSoundCloudAPI(doc).then(SC => {
        if (!frame.isConnected) return;
        const widget = SC.Widget(frame);
        widget.bind(SC.Widget.Events.READY, () => { if (frame.isConnected) widget.seekTo(audio.start * 1000); });
      }).catch(() => { if (frame.isConnected) { const note = doc.createElement('span'); note.className = 'soundcloud-error'; note.textContent = '起播時間無法設定，可直接使用播放器。'; tile.append(note); } });
    };
    tile.append(play);
    if (editable) {
      const tools = doc.createElement('div'); tools.className = 'youtube-actions';
      for (const [action, label, icon] of [['edit', '修改 SoundCloud 連結', '↗'], ['delete', '刪除音樂', '×']]) {
        const button = doc.createElement('button'); button.type = 'button'; button.dataset.soundcloudAction = action; button.title = label; button.setAttribute('aria-label', label); button.textContent = icon; tools.append(button);
      }
      tile.append(tools);
    }
    return tile;
  }
  root.YouTubeMedia = { parse, valid, create, parseSoundCloud, validSoundCloud, createSoundCloud, mount, stop, source: '(' + bootstrap.toString() + ')(window);' };
})(window);
