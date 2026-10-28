# Ritmo Shopee — versão inicial

Extensão Chrome Manifest V3 para comparar vendas acumuladas com a idade de um anúncio da Shopee Brasil. Sem dependências npm, servidor ou credenciais.

O painel inclui itens vendidos, estoque, visitas acumuladas, visitas por item vendido, razão itens/visitas, criação, idade, última atualização e médias históricas por dia e por 30 dias. Estoque, visitas e atualização são opcionais e manuais. A razão itens/visitas não é conversão por pedidos: uma compra pode conter mais de um item. Tipo de anúncio e frete não são coletados nesta versão.

## Estado atual

A extensão tenta ler o marcador visível de itens vendidos da página selecionada. O usuário deve confirmar que o marcador corresponde ao total do anúncio. Valores arredondados (como `1mil+`) não são convertidos em contagens exatas. A data de criação **ainda é manual**: a coleta automática de vendas e data de criação depende de validação em um anúncio real. Não deduzimos a criação pela primeira avaliação ou pelo identificador do produto.

O cálculo é `vendas acumuladas / dias desde a criação`, usando dias de calendário. Uma média histórica não representa o volume recente, nem determina sozinha se vale anunciar. A extensão não estima vendas mensais atuais.

## Instalar no computador

1. Baixe os arquivos deste repositório e extraia o ZIP.
2. No Chrome, abra `chrome://extensions` e ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta `extension`.
4. Abra um produto em `shopee.com.br`, clique na extensão e informe/confirme as vendas totais e a data real de criação.
5. Se souber, informe também estoque, visitas acumuladas e data da última alteração do anúncio.
6. Clique em **Atualizar análise**. Campos desconhecidos permanecem como **Indisponível**. Ao editar ou reler a página, o resultado anterior é limpo para evitar números desatualizados.

Os dados são processados localmente e não são armazenados. A permissão `activeTab` permite leitura da aba somente ao acionar a extensão. Não há login, coleta de cookies, acesso à conta ou uso de API privada.

## Desenvolvimento

Node.js 22 ou superior. Execute `npm test` na raiz. Não há etapa de instalação ou build. Após editar os arquivos, recarregue a extensão na página de extensões do Chrome.

O teste de interface com dados simulados é `python3 tests/browser_smoke.py` e requer Playwright para Python e Chromium (já disponíveis no ambiente de desenvolvimento atual). Ele não valida acesso ao anúncio real nem a API de extensões do Chrome.

Validação nesta máquina: oito testes de cálculo passaram e o teste de interface/extrator com páginas simuladas passou. O Chromium headless desta máquina não carregou a extensão via linha de comando; a instalação como extensão ainda precisa ser confirmada no Chrome do usuário. A leitura do anúncio real permanece bloqueada enquanto o acesso a `shopee.com.br` não for aplicado nas configurações do ambiente.

## Próxima validação necessária

Testar um anúncio público real da Shopee e identificar uma fonte verificável para a criação e o significado do contador de vendas. Enquanto isso, a coleta automática completa não está validada.
