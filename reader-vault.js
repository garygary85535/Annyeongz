(function () {
  "use strict";
  const config = window.READER_VAULT_CONFIG;
  let key = null;
  let imageGeneration = 0;
  const imageUrls = new Map();
  const pendingImages = new Map();
  const pendingScripts = new Map();
  const articles = new Map();
  function bytes(value) {
    return Uint8Array.from(atob(value), char => char.charCodeAt(0));
  }
  async function decrypt(envelope, id, selectedKey = key) {
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(envelope.iv),
      additionalData: new TextEncoder().encode(id), tagLength: 128 }, selectedKey, bytes(envelope.ciphertext));
  }
  async function unlock(password) {
    if (!crypto.subtle) throw new Error("請使用 HTTPS 網址開啟閱讀器。");
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    const candidate = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: bytes(config.salt),
      iterations: config.iterations, hash: "SHA-256" }, material,
      { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    try {
      const check = new TextDecoder().decode(await decrypt(config.verifier, "verifier", candidate));
      if (check !== "reader-vault-unlocked-v1") return false;
      key = candidate;
      return true;
    } catch { return false; }
  }
  function loadPayload(id, filename) {
    if (window.READER_PAYLOADS?.[id]) return Promise.resolve(window.READER_PAYLOADS[id]);
    if (pendingScripts.has(id)) return pendingScripts.get(id);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = filename;
      script.onload = () => {
        script.remove();
        const payload = window.READER_PAYLOADS?.[id];
        if (payload) resolve(payload); else reject(new Error("加密內容檔案不完整。"));
      };
      script.onerror = () => { script.remove(); reject(new Error("這篇尚未匯入站內閱讀器。")); };
      document.head.appendChild(script);
    }).finally(() => pendingScripts.delete(id));
    pendingScripts.set(id, promise);
    return promise;
  }
  async function read(id) {
    if (!key) throw new Error("請先輸入閱讀密碼。");
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("文章編號不正確。");
    if (articles.has(id)) return articles.get(id);
    const payload = await loadPayload(id, `articles/${id}.js`);
    let article;
    try { article = JSON.parse(new TextDecoder().decode(await decrypt(payload, "article:" + id))); }
    catch { throw new Error("文章解密失敗，請重新整理後重試。"); }
    articles.set(id, article);
    while (articles.size > 3) articles.delete(articles.keys().next().value);
    return article;
  }
  async function image(source) {
    if (!key) throw new Error("請先輸入閱讀密碼。");
    if (!/^assets\/[A-Za-z0-9_-]+\/\d+\.(png|jpe?g|gif|webp|bmp)$/.test(source)) throw new Error("圖片路徑不正確。");
    if (imageUrls.has(source)) return imageUrls.get(source);
    if (pendingImages.has(source)) return pendingImages.get(source);
    const generation = imageGeneration;
    const promise = (async () => {
      const payload = await loadPayload(source, source + ".js");
      const data = await decrypt(payload, "image:" + source);
      if (generation !== imageGeneration) throw new Error("閱讀視窗已關閉。");
      const ext = source.split(".").pop();
      const type = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", bmp: "image/bmp" }[ext];
      const url = URL.createObjectURL(new Blob([data], { type }));
      imageUrls.set(source, url);
      return url;
    })().finally(() => { if (generation === imageGeneration) pendingImages.delete(source); });
    pendingImages.set(source, promise);
    return promise;
  }
  function releaseImages() {
    ++imageGeneration;
    for (const url of imageUrls.values()) URL.revokeObjectURL(url);
    imageUrls.clear();
    pendingImages.clear();
  }
  window.READER_VAULT = { unlock, read, image, releaseImages };
})();
