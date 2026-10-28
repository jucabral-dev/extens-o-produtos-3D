import { analyze, analyzeExtras } from './analysis.js';
import { extractListing } from './extract.js';
const $ = id => document.getElementById(id);
const format = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const dateFormat = value => value.split('-').reverse().join('/');
const today = new Date();
const maxDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
for (const id of ['created', 'updated']) $(id).max = maxDate;
let diagnostic = { version: '0.3.0', status: 'aguardando leitura' };
let reading = false;
function clearAnalysis() {
  for (const id of ['total','stock-value','visits-value','per-sale','conversion','created-value','updated-value','daily']) $(id).textContent = 'Indisponível';
  $('total-source').textContent = 'Não fornecido nesta leitura';
  $('stock-source').textContent = 'Não fornecido nesta leitura';
  $('updated-source').textContent = 'Não fornecida nesta leitura';
  $('views-source').textContent = 'Não fornecidas nesta leitura';
  $('age').textContent = 'Data não fornecida nesta leitura';
  $('monthly').textContent = 'Precisa das vendas acumuladas e criação';
  $('error').hidden = true;
  $('basis').textContent = 'Somente dados fornecidos pelo anúncio são exibidos. Sem criação e vendas acumuladas, não é possível calcular a média histórica.';
}
function render(data, manual = false) {
  clearAnalysis();
  const source = field => manual ? 'Informado por você' : data.sources?.[field] || 'Página do produto';
  if (data.sales !== null || data.soldLabel) {
    $('total').textContent = data.sales !== null ? format.format(data.sales) : data.soldLabel;
    $('total-source').textContent = source('sales');
  }
  if (data.stock !== null) {
    $('stock-value').textContent = format.format(data.stock);
    $('stock-source').textContent = source('stock');
  }
  if (data.views !== null) {
    $('visits-value').textContent = format.format(data.views);
    $('views-source').textContent = source('views');
  }
  if (data.creationDate) {
    const age = analyze('0', data.creationDate).ageDays;
    $('created-value').textContent = dateFormat(data.creationDate);
    $('age').textContent = `Há ${format.format(age)} dias · ${source('creationDate')}`;
  }
  if (data.updatedDate) {
    $('updated-value').textContent = dateFormat(data.updatedDate);
    $('updated-source').textContent = source('updatedDate');
  }
  // Não usa um contador de período desconhecido como total acumulado.
  const lifetime = manual || data.salesPeriod === 'lifetime';
  if (data.sales !== null && data.creationDate && lifetime) {
    const result = analyze(String(data.sales), data.creationDate);
    $('daily').textContent = result.daily === null ? 'Sem dia completo' : `${format.format(result.daily)} / dia`;
    $('monthly').textContent = result.daily === null ? 'Média ainda indisponível' : `${format.format(result.daily * 30)} a cada 30 dias · média histórica`;
  }
  if (data.sales !== null && data.views !== null && lifetime) {
    if (data.sales > 0) $('per-sale').textContent = format.format(data.views / data.sales);
    if (data.views > 0) $('conversion').textContent = `${format.format(data.sales / data.views * 100)}%`;
  }
  $('basis').textContent = `${manual ? 'Base: dados informados por você.' : 'Base: dados lidos automaticamente do produto; a fonte aparece em cada campo.'} Média histórica = vendas acumuladas ÷ dias desde a criação. Visualizações não são visitantes únicos; itens/visualizações não é conversão por pedidos.`;
}
async function readPage() {
  reading = true;
  $('refresh').disabled = true;
  $('analysis').reset();
  clearAnalysis();
  $('status').textContent = 'Consultando os dados do produto…';
  $('diagnostic-text').hidden = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!/^https:\/\/(?:www\.)?shopee\.com\.br\//i.test(tab?.url || '')) throw new Error('Abra um anúncio da Shopee Brasil antes de usar a extensão.');
    // Instala também na aba que já estava aberta antes da atualização da extensão.
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', files: ['capture.js'] });
    const [response] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: extractListing });
    const data = response?.result;
    if (!data || data.error) throw new Error(data?.error || 'Não foi possível ler a página.');
    diagnostic = { ...data.diagnostics, sources: data.sources, warning: data.warning };
    $('title').textContent = data.title;
    render(data);
    $('status').textContent = data.warning || 'Leitura automática concluída. Os campos abaixo mostram os dados retornados pela Shopee.';
    for (const [id, value] of Object.entries({ sales: data.sales, stock: data.stock, visits: data.views, created: data.creationDate, updated: data.updatedDate })) {
      if (value !== null && value !== undefined) $(id).value = String(value);
    }
  } catch (error) {
    diagnostic = { version: '0.3.0', error: error.message };
    $('title').textContent = 'Não foi possível analisar esta aba';
    $('status').textContent = error.message;
  } finally {
    reading = false;
    $('refresh').disabled = false;
  }
}
$('refresh').addEventListener('click', readPage);
$('analysis').addEventListener('submit', event => {
  event.preventDefault();
  if (reading) return;
  try {
    const result = analyze($('sales').value, $('created').value);
    const extra = analyzeExtras({ stock: $('stock').value, visits: $('visits').value, updated: $('updated').value }, result);
    render({ sales: result.sales, stock: extra.stock, views: extra.visits, creationDate: $('created').value, updatedDate: extra.updated }, true);
    $('status').textContent = 'Análise com dados informados manualmente.';
  } catch (error) {
    clearAnalysis();
    $('error').textContent = error.message;
    $('error').hidden = false;
  }
});
for (const id of ['sales','created','stock','visits','updated']) $(id).addEventListener('input', () => {
  clearAnalysis();
  $('basis').textContent = 'Dados alterados manualmente. Clique em Atualizar análise para recalcular.';
});
$('diagnostic').addEventListener('click', async () => {
  const text = JSON.stringify(diagnostic, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    $('diagnostic').textContent = 'Diagnóstico copiado';
  } catch {
    $('diagnostic-text').hidden = false;
    $('diagnostic-text').value = text;
    $('diagnostic-text').select();
    $('diagnostic').textContent = 'Selecione e copie o diagnóstico abaixo';
  }
});
await readPage();
