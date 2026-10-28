// Lê somente respostas de detalhes de produto já recebidas pela própria página.
// Não lê cookies, cabeçalhos, credenciais nem respostas de conta/pagamento.
(() => {
  const key = '__RITMO_SHOPEE_PRODUCT_V1__';
  if (window[key]?.version === 1) return;
  const cache = { version: 1, items: {} };
  window[key] = cache;
  const fields = ['itemid','item_id','shopid','shop_id','name','historical_sold','stock','ctime','mtime','view_count'];
  function endpoint(input) {
    try {
      const url = new URL(input, location.href);
      return url.origin === location.origin && /^\/api\/v4\/(?:item\/get|pdp\/get_pc)$/.test(url.pathname) ? url.pathname : null;
    } catch { return null; }
  }
  function remember(payload, path) {
    if (payload?.error) return;
    const candidates = [payload?.data?.item, payload?.data, payload?.item, payload?.data?.product_info?.item, payload?.data?.product_info];
    for (const item of candidates) {
      if (!item || typeof item !== 'object') continue;
      const itemId = item.itemid ?? item.item_id;
      const shopId = item.shopid ?? item.shop_id;
      if (!/^\d+$/.test(String(itemId)) || !/^\d+$/.test(String(shopId))) continue;
      const clean = {};
      for (const field of fields) {
        if (['string','number'].includes(typeof item[field])) clean[field] = typeof item[field] === 'string' ? item[field].slice(0, 500) : item[field];
      }
      cache.items[`${shopId}:${itemId}`] = { item: clean, at: Date.now(), endpoint: path };
      const keys = Object.keys(cache.items);
      if (keys.length > 10) delete cache.items[keys[0]];
    }
  }
  if (typeof window.fetch === 'function') {
    const originalFetch = window.fetch;
    window.fetch = function (...args) {
      const path = endpoint(typeof args[0] === 'string' || args[0] instanceof URL ? args[0] : args[0]?.url);
      return Reflect.apply(originalFetch, this, args).then(response => {
        if (path && response.ok) {
          try { response.clone().json().then(payload => remember(payload, path)).catch(() => {}); } catch { /* resposta não legível */ }
        }
        return response;
      });
    };
  }
  const proto = window.XMLHttpRequest?.prototype;
  if (proto) {
    const originalOpen = proto.open;
    const originalSend = proto.send;
    const paths = new WeakMap();
    proto.open = function (...args) {
      paths.set(this, endpoint(args[1]));
      return Reflect.apply(originalOpen, this, args);
    };
    proto.send = function (...args) {
      const path = paths.get(this);
      if (path) this.addEventListener('load', () => {
        if (this.status < 200 || this.status >= 300) return;
        try {
          const payload = this.responseType === 'json' ? this.response : JSON.parse(this.responseText);
          remember(payload, path);
        } catch { /* não modifica o funcionamento da página */ }
      }, { once: true });
      return Reflect.apply(originalSend, this, args);
    };
  }
})();
