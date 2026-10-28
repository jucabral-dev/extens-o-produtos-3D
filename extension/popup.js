import { analyze, analyzeExtras } from './analysis.js';
import { extractListing } from './extract.js';
const $ = id => document.getElementById(id);
const format = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const dateFormat = value => value.split('-').reverse().join('/');
const today = new Date();
const maxDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
for (const id of ['created', 'updated']) $(id).max = maxDate;
function clearAnalysis() {
  for (const id of ['total','stock-value','visits-value','per-sale','conversion','created-value','updated-value','daily']) $(id).textContent = 'Indisponível';
  $('total-source').textContent = 'Aguardando confirmação';
  $('stock-source').textContent = 'Não coletado automaticamente';
  $('updated-source').textContent = 'Não coletado automaticamente';
  $('age').textContent = 'Data real ainda desconhecida';
  $('monthly').textContent = 'Precisa das vendas totais e criação';
  $('error').hidden = true;
  $('basis').textContent = 'Confirme os dados e clique em Atualizar análise. Campos sem fonte ficam indisponíveis.';
}
async function readPage() {
  $('refresh').disabled = true;
  $('analysis').reset();
  clearAnalysis();
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [response] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractListing });
    const data = response?.result;
    if (!data || data.error) throw new Error(data?.error || 'Não foi possível ler a página.');
    // Uma nova leitura não deve manter dados manuais de outro anúncio.
    $('title').textContent = data.title;
    $('status').textContent = data.warning || (data.soldLabel ? `A página exibe “${data.soldLabel} vendidos”. Confirme se é o total do anúncio. A criação precisa de uma fonte verificável.` : 'Total não identificado com segurança. Você pode preencher dados conhecidos abaixo.');
    if (data.soldLabel) {
      $('total').textContent = data.soldLabel;
      $('total-source').textContent = 'Texto da página · confirme o período';
      if (/^\d+$/.test(data.soldLabel)) $('sales').value = data.soldLabel;
    }
  } catch (error) {
    $('title').textContent = 'Análise manual disponível';
    $('status').textContent = error.message;
  } finally {
    $('refresh').disabled = false;
  }
}
$('refresh').addEventListener('click', readPage);
$('analysis').addEventListener('submit', event => {
  event.preventDefault();
  clearAnalysis();
  try {
    const result = analyze($('sales').value, $('created').value);
    const extra = analyzeExtras({ stock: $('stock').value, visits: $('visits').value, updated: $('updated').value }, result);
    $('total').textContent = format.format(result.sales);
    $('total-source').textContent = 'Informado / confirmado por você';
    $('created-value').textContent = dateFormat($('created').value);
    $('age').textContent = `Há ${format.format(result.ageDays)} dias · informado por você`;
    $('daily').textContent = result.daily === null ? 'Sem dia completo' : `${format.format(result.daily)} / dia`;
    $('monthly').textContent = result.daily === null ? 'Média ainda indisponível' : `${format.format(result.daily * 30)} a cada 30 dias · média histórica`;
    if (extra.stock !== null) {
      $('stock-value').textContent = format.format(extra.stock);
      $('stock-source').textContent = 'Informado por você';
    }
    if (extra.visits !== null) $('visits-value').textContent = format.format(extra.visits);
    if (extra.visitsPerSale !== null) $('per-sale').textContent = format.format(extra.visitsPerSale);
    if (extra.itemsPerVisit !== null) $('conversion').textContent = `${format.format(extra.itemsPerVisit * 100)}%`;
    if (extra.updated) {
      $('updated-value').textContent = dateFormat(extra.updated);
      $('updated-source').textContent = 'Informado por você';
    }
    $('basis').textContent = 'Base: dados informados ou confirmados por você. Médias = vendas acumuladas ÷ dias desde a criação. A razão itens/visitas pode superar 100% porque um pedido pode conter vários itens; ela não é a taxa de conversão por pedidos.';
  } catch (error) {
    $('error').textContent = error.message;
    $('error').hidden = false;
  }
});
for (const id of ['sales','created','stock','visits','updated']) $(id).addEventListener('input', clearAnalysis);
await readPage();
