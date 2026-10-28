// Executada apenas na aba selecionada, após o clique do usuário.
// Sem APIs privadas, cookies, credenciais ou requisições de rede.
export function extractListing() {
  if (!/(^|\.)shopee\.com\.br$/i.test(location.hostname)) return { error: 'Abra um anúncio na Shopee Brasil e clique na extensão novamente.' };
  if (!/(?:-i\.|\/product\/)\d+[./]\d+/.test(location.pathname)) return { error: 'Abra a página de um produto, em vez da busca ou da loja.' };
  const candidates = new Set();
  // O marcador pode estar arredondado. Nunca confundir vendas mensais com totais.
  for (const el of document.querySelectorAll('span, div')) {
    if (el.children.length) continue;
    const value = el.textContent.trim();
    if (value.length > 50) continue;
    const match = value.match(/^(\d+(?:[.,]\d+)?\s*(?:mil|k|mi)?\+?)\s+vendidos?$/i);
    if (match) candidates.add(match[1]);
  }
  const labels = [...candidates];
  return {
    title: document.querySelector('h1')?.textContent.trim() || document.title,
    soldLabel: labels.length === 1 ? labels[0] : null,
    // Ausência de uma origem verificada não permite deduzir a data por avaliações ou pelo ID.
    creationDate: null,
    warning: labels.length > 1 ? 'A página mostra vários números de vendas; preencha o total do anúncio.' : null
  };
}
