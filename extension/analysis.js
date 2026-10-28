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

// Valores monetários em centavos; ponto ou vírgula como separador decimal.
function decimalHundredths(value, label) {
  const text = String(value).trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) throw new Error(`${label}: informe um valor positivo ou zero, com até duas casas decimais e sem separador de milhar.`);
  const [whole, fraction = ''] = text.replace(',', '.').split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount > 100_000_000_000) throw new Error(`${label}: valor muito alto.`);
  return amount;
}

export function estimateDemand(daily, targetText = '1') {
  const target = decimalHundredths(targetText, 'Meta diária') / 100;
  if (target <= 0) throw new Error('A meta diária precisa ser maior que zero.');
  if (daily === null || !Number.isFinite(daily) || daily < 0) return { label: 'Dados insuficientes', target, daily: null };
  return { label: daily === 0 ? 'Sem vendas registradas' : daily >= target ? 'Meta atingida' : 'Abaixo da meta', target, daily };
}

export function calculateProfit({ price, cost, percentFee, fixedFee, otherCosts = '' }) {
  const priceCents = decimalHundredths(price, 'Preço de venda');
  if (priceCents === 0) throw new Error('O preço de venda precisa ser maior que zero.');
  const costCents = decimalHundredths(cost, 'Custo do produto');
  const feeBasisPoints = decimalHundredths(percentFee, 'Taxa percentual');
  if (feeBasisPoints > 10_000) throw new Error('A taxa percentual não pode superar 100%.');
  const fixedCents = decimalHundredths(fixedFee, 'Tarifa fixa');
  const otherCents = String(otherCosts).trim() === '' ? 0 : decimalHundredths(otherCosts, 'Outros custos');
  const percentageFeeCents = Math.round(priceCents * feeBasisPoints / 10_000);
  const totalCostCents = costCents + percentageFeeCents + fixedCents + otherCents;
  const profitCents = priceCents - totalCostCents;
  return { priceCents, costCents, percentageFeeCents, fixedCents, otherCents, totalCostCents, profitCents, margin: profitCents / priceCents };
}
