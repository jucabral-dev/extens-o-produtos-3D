// Autossuficiente: o Chrome serializa esta função para execução na página.
export async function extractListing() {
  if (location.hostname !== 'shopee.com.br' && location.hostname !== 'www.shopee.com.br') return { error: 'Abra um anúncio na Shopee Brasil e clique na extensão novamente.' };
  const ids = location.pathname.match(/(?:-i\.|\/product\/)(\d+)[./](\d+)(?:\/|$)/);
  if (!ids) return { error: 'Abra a página de um produto, em vez da busca ou da loja.' };
  const [, shopId, itemId] = ids;
  const data = {
    title: document.querySelector('h1')?.textContent.trim() || document.title,
    url: `${location.origin}/product/${shopId}/${itemId}`,
    sales: null, salesPeriod: null, soldLabel: null, stock: null, views: null,
    creationDate: null, updatedDate: null, sources: {},
    diagnostics: { version: '0.3.0', shopId, itemId, api: [], observedResponse: false },
    warning: null
  };
  const integer = value => (typeof value === 'number' || typeof value === 'string' && /^\d+$/.test(value)) && Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  const localDate = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  function epochDate(value) {
    if (typeof value !== 'number' && !(typeof value === 'string' && /^\d+$/.test(value))) return null;
    let number = Number(value);
    if (number < 1e12) number *= 1000;
    if (!Number.isFinite(number) || number < Date.UTC(2000,0,1) || number > Date.now()) return null;
    return localDate(new Date(number));
  }
  function mergeItem(item, source) {
    if (!item || String(item.itemid ?? item.item_id) !== itemId || String(item.shopid ?? item.shop_id) !== shopId) return false;
    if (typeof item.name === 'string' && item.name.trim()) data.title = item.name.slice(0,500);
    // `sold` é deliberadamente ignorado: não é necessariamente acumulado.
    const fields = { sales: integer(item.historical_sold), stock: integer(item.stock), views: integer(item.view_count), creationDate: epochDate(item.ctime), updatedDate: epochDate(item.mtime) };
    for (const [field, value] of Object.entries(fields)) {
      if (value !== null) { data[field] = value; data.sources[field] = source; }
    }
    if (data.creationDate && data.updatedDate && data.updatedDate < data.creationDate) { data.updatedDate = null; delete data.sources.updatedDate; }
    if (data.sales !== null) { data.soldLabel = String(data.sales); data.salesPeriod = 'lifetime'; }
    return true;
  }
  function mergePayload(payload, source) {
    if (payload?.error) return false;
    const candidates = [payload?.data?.item, payload?.data, payload?.item, payload?.data?.product_info?.item, payload?.data?.product_info];
    return candidates.some(item => mergeItem(item, source));
  }
  const cached = window.__RITMO_SHOPEE_PRODUCT_V1__?.items?.[`${shopId}:${itemId}`];
  if (cached && Date.now() - cached.at >= 0 && Date.now() - cached.at < 10 * 60 * 1000) {
    data.diagnostics.observedResponse = mergeItem(cached.item, 'Resposta do produto recebida pela página');
  }
  // Alguns layouts incluem o produto em JSON, outros recebem tudo por rede.
  for (const script of document.querySelectorAll('script[type="application/json"]')) {
    if (script.textContent.length > 2_000_000) continue;
    try {
      const payload = JSON.parse(script.textContent);
      for (const candidate of [payload, payload?.props?.pageProps, payload?.props?.pageProps?.initialState]) mergePayload(candidate, 'Dados incorporados pela página');
    } catch { /* não é JSON de produto */ }
  }
  // Só consulta detalhes do produto atual. Sem assinatura forjada ou contorno de bloqueios.
  if (data.sales === null || data.creationDate === null || data.stock === null) {
    const endpoints = [
      `/api/v4/pdp/get_pc?item_id=${itemId}&shop_id=${shopId}&tz_offset_minutes=${-new Date().getTimezoneOffset()}&detail_level=0`,
      `/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`
    ];
    for (const path of endpoints) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      try {
        const response = await fetch(path, { credentials: 'same-origin', signal: controller.signal, headers: { Accept: 'application/json' } });
        const diagnostic = { endpoint: path.split('?')[0], status: response.status };
        data.diagnostics.api.push(diagnostic);
        if ([401,403,429].includes(response.status)) {
          data.warning = `A Shopee não liberou a consulta dos detalhes (HTTP ${response.status}). Recarregue o anúncio; o leitor também pode usar a resposta que a página recebe normalmente.`;
          break;
        }
        if (!response.ok) continue;
        const payload = await response.json();
        if (payload?.error) {
          diagnostic.error = String(payload.error).slice(0,50);
          data.warning = 'A Shopee recusou a consulta dos detalhes do produto. Nenhum bloqueio foi contornado.';
          break;
        }
        mergePayload(payload, 'Detalhes do produto fornecidos pela Shopee');
        if (data.sales !== null && data.creationDate !== null && data.stock !== null) break;
      } catch (error) {
        data.diagnostics.api.push({ endpoint: path.split('?')[0], error: error.name === 'AbortError' ? 'tempo esgotado' : 'resposta não legível' });
      } finally { clearTimeout(timer); }
    }
  }
  function domCount(label) {
    const compact = label.replace(/\s+/g,'').toLowerCase();
    if (/^\d+$/.test(compact)) return integer(compact);
    if (/^\d{1,3}(?:\.\d{3})+$/.test(compact)) return integer(compact.replaceAll('.',''));
    return null; // `mil`, decimais e `+` não são contagens exatas.
  }
  const soldPattern = /^(\d[\d.,]*(?:\s*(?:mil|k|mi))?\+?)\s*vendidos?$/i;
  const stockPattern = /^(\d[\d.]*)\s*(?:peças|produtos|itens|unidades)\s*dispon[ií]veis$/i;
  // Escolhe o menor bloco que contém o título e os indicadores, antes das recomendações.
  const heading = document.querySelector('h1');
  let scope = null;
  for (let el = heading?.parentElement, i = 0; el && i < 8; el = el.parentElement, i++) {
    if (/(?:\d[\d.,]*\s*(?:mil|k|mi)?\+?\s*vendidos?)/i.test(el.innerText || '')) { scope = el; break; }
  }
  const root = scope || document.querySelector('main') || document.body;
  const sold = new Set(), stock = new Set();
  for (const el of root.querySelectorAll('span, div, p, button')) {
    if (!el.getClientRects().length || el.closest('a[href*="-i."],a[href*="/product/"]')) continue;
    const value = (el.innerText || '').replace(/\s+/g,' ').trim();
    if (value.length > 75) continue;
    const saleMatch = value.match(soldPattern);
    if (saleMatch) sold.add(saleMatch[1]);
    const stockMatch = value.match(stockPattern);
    if (stockMatch) stock.add(stockMatch[1]);
  }
  if (data.sales === null && sold.size === 1) {
    data.soldLabel = [...sold][0];
    data.sales = domCount(data.soldLabel);
    data.salesPeriod = 'unspecified';
    data.sources.sales = data.sales === null ? 'Valor arredondado exibido pela página' : 'Contador exibido pela página';
  }
  if (data.stock === null && stock.size === 1) {
    data.stock = domCount([...stock][0]);
    if (data.stock !== null) data.sources.stock = 'Estoque exibido pela página (pode depender da variação)';
  }
  if (!data.warning && data.creationDate === null) data.warning = 'A Shopee não retornou a criação do anúncio nesta leitura. Se você acabou de atualizar a extensão, recarregue a página do produto e tente novamente.';
  data.diagnostics.available = Object.keys(data.sources);
  const currentIds = location.pathname.match(/(?:-i\.|\/product\/)(\d+)[./](\d+)(?:\/|$)/);
  if (!currentIds || currentIds[1] !== shopId || currentIds[2] !== itemId) return { error: 'O anúncio mudou durante a leitura. Clique em Ler anúncio novamente.' };
  return data;
}
