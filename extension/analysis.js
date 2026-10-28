export function analyze(salesText, creationDate, now = new Date()) {
  if (!/^\d+$/.test(String(salesText).trim())) throw new Error('Informe as vendas como um número inteiro, sem pontos ou vírgulas.');
  const sales = Number(salesText);
  if (!Number.isSafeInteger(sales) || sales < 0) throw new Error('Quantidade de vendas inválida.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(creationDate)) throw new Error('Informe a data de criação do anúncio.');
  const created = new Date(`${creationDate}T00:00:00Z`);
  if (!Number.isFinite(created.getTime()) || created.toISOString().slice(0, 10) !== creationDate) throw new Error('Data de criação inválida.');
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const ageDays = Math.round((today - created.getTime()) / 86400000);
  if (ageDays < 0) throw new Error('A data de criação não pode estar no futuro.');
  return { sales, ageDays, daily: ageDays === 0 ? null : sales / ageDays };
}

export function analyzeExtras({ stock = '', visits = '', updated = '' }, result, now = new Date()) {
  function optionalCount(value, label) {
    if (value.trim() === '') return null;
    if (!/^\d+$/.test(value.trim()) || !Number.isSafeInteger(Number(value))) throw new Error(`${label}: informe um número inteiro sem separadores.`);
    return Number(value);
  }
  const stockCount = optionalCount(stock, 'Estoque');
  const visitCount = optionalCount(visits, 'Visitas');
  if (updated) {
    const update = analyze('0', updated, now);
    if (update.ageDays > result.ageDays) throw new Error('A atualização não pode ser anterior à criação do anúncio.');
  }
  return {
    stock: stockCount,
    visits: visitCount,
    updated: updated || null,
    visitsPerSale: visitCount !== null && result.sales > 0 ? visitCount / result.sales : null,
    itemsPerVisit: visitCount !== null && visitCount > 0 ? result.sales / visitCount : null
  };
}
