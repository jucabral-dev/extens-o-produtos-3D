# Ritmo Shopee — v0.4.0

Extensão Chrome Manifest V3 para ler indicadores de anúncios da Shopee Brasil e comparar vendas acumuladas com a idade do produto. Sem servidor ou dependências npm.

## O que mudou

Incluídas demanda estimada e simulação de lucro por unidade. A demanda compara o ritmo histórico do anúncio com uma meta diária configurável (inicialmente 1 item/dia), indicando meta atingida, abaixo da meta ou ausência de dados. É um critério pessoal explícito, não uma classificação de mercado da Shopee. Depende de vendas acumuladas e criação disponíveis; não transforma dados ausentes em demanda zero.

O lucro é preço de venda menos custo do produto, taxa percentual arredondada para centavos, tarifa fixa e outros custos por unidade. Exibe lucro/prejuízo e margem sobre o preço. Preço, custo e taxas precisam ser informados; nenhuma taxa padrão da plataforma é presumida. Outros custos vazios equivalem a zero, como indicado no formulário. Inclua embalagem, energia, mão de obra, frete, anúncios e impostos conforme sua operação. A simulação não prevê vendas ou lucro mensal e não é salva entre aberturas do painel.

O painel tenta preencher os indicadores automaticamente, sem exigir formulário. A versão anterior era principalmente manual e falhava quando o número e a palavra “vendidos” estavam em elementos separados; esse leitor foi corrigido.

A extensão observa as respostas de detalhes do produto que a própria página recebe, lê dados JSON incorporados quando presentes e, ao abrir o painel, pode consultar os endpoints de detalhes do mesmo produto na Shopee. Estes endpoints não são uma integração oficial/parceria e podem mudar ou negar acesso. HTTP 401/403/429 e erros retornados pela plataforma interrompem a consulta; não há contorno de CAPTCHA, assinatura, acesso restrito ou bloqueio.

## Dados e fontes

| Indicador | Fonte utilizada |
| --- | --- |
| Vendas acumuladas | `historical_sold`, com os IDs da loja e produto conferidos |
| Contador visível de vendidos | Texto da página, inclusive elementos separados; período marcado como desconhecido |
| Estoque | `stock` ou quantidade disponível exibida na página (pode depender da variação) |
| Criação / idade | `ctime` do produto, convertido para a data local |
| Atualização | `mtime` do produto, quando retornado e válido |
| Visualizações | `view_count`, somente quando retornado pelo produto; não são visitantes únicos |
| Médias históricas | Vendas acumuladas / dias desde a criação; mensal equivalente a 30 dias |

`itemid`/`item_id` e `shopid`/`shop_id` devem corresponder ao anúncio aberto. Não usamos o campo `sold` como vendas acumuladas porque o período pode ser diferente. Valores arredondados como `1mil+` não são convertidos em quantidades exatas. Um contador visível cujo período é desconhecido não alimenta automaticamente a média histórica.

A idade não é deduzida pela primeira avaliação ou pelo ID. Campos que a Shopee não fornece permanecem indisponíveis. Visualizações e conversão não têm uma fonte pública confirmada para todos os anúncios. Itens por visualização não equivale à conversão por pedidos, já que um pedido pode conter vários itens. A estimativa de demanda e a simulação de lucro não determinam automaticamente a viabilidade de um novo anúncio.

## Instalar ou atualizar

1. Baixe em **Code → Download ZIP** no GitHub e extraia.
2. Abra `chrome://extensions` no Chrome (111 ou superior).
3. Na primeira instalação, ative **Modo do desenvolvedor**, clique em **Carregar sem compactação** e selecione a pasta `extension`.
4. Para atualizar, substitua os arquivos da pasta já instalada e clique em **Recarregar** no cartão da extensão. Alternativamente, remova a versão anterior e carregue a nova pasta `extension`.
5. **Recarregue também a página do anúncio da Shopee**, para que o observador seja iniciado antes da leitura dos dados do produto.
6. Clique na extensão. O rodapé deve mostrar **v0.4.0**. Os indicadores são preenchidos conforme os dados retornados. Ajuste a meta diária em **Demanda estimada** e preencha a seção **Lucro estimado por unidade** para simular sua operação.

Se não aparecerem os dados, clique em **Copiar diagnóstico da leitura** e envie o texto ao responsável pelo desenvolvimento. O diagnóstico contém versão, IDs públicos do produto, status das consultas e nomes das fontes; não inclui cookies, tokens ou respostas completas. Dados manuais são apenas uma alternativa opcional em uma seção recolhida.

## Privacidade e funcionamento

A observação é limitada aos detalhes de produto em `shopee.com.br` e `www.shopee.com.br`. Não lê respostas de conta/pagamento nem cookies/cabeçalhos de autenticação. Consultas adicionais usam a sessão normal da própria página, se existir; a extensão não solicita login nem credenciais. Não há servidor ou envio a terceiros. São mantidos em memória apenas campos de produto de até dez anúncios para leitura enquanto a página está aberta; respostas com mais de dez minutos não são usadas como cache.

## Desenvolvimento e validação

Node.js >=22: `npm test`. Sem instalação ou build. Para a interface/coleta, `python3 tests/browser_smoke.py` requer Playwright Python e Chromium disponíveis nesta máquina.

Quatorze testes de cálculo passaram, incluindo demanda, taxas, margem, prejuízo e arredondamento de centavos. A integração com respostas simuladas cobre preenchimento automático, demanda/meta, lucro/prejuízo, IDs, datas, vendas acumuladas versus `sold`, observação de fetch/XHR, leitura do DOM separado, valores arredondados e HTTP 403. O acesso ao anúncio real ainda está bloqueado pela política de rede do ambiente de desenvolvimento. O Chromium deste ambiente também informou que o administrador desabilitou o carregamento de extensões sem compactação por automação; os testes usam páginas e respostas controladas. A coleta no anúncio real precisa ser confirmada no navegador do usuário; testes simulados não demonstram que a Shopee disponibiliza todos os campos hoje.
