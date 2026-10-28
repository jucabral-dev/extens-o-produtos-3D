"""Testes da coleta e interface com respostas simuladas, não dados reais da Shopee."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(root / 'extension')))
Thread(target=server.serve_forever, daemon=True).start()
extractor = (root / 'extension/extract.js').read_text().replace('export async function', 'async function', 1)
fixture = {
    'data': {'item': {'item_id': 23393493780, 'shop_id': 568119744,
                     'name': 'Produto de teste', 'historical_sold': 300,
                     'sold': 12, 'stock': 50, 'view_count': 3000,
                     'ctime': 1790596800, 'mtime': 1792497600}}
}
read = f'async () => {{ {extractor}; return await extractListing(); }}'
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.clock.set_fixed_time('2026-10-28T12:00:00Z')
        # Este teste de popup simula a API do Chrome. O leitor é exercitado abaixo.
        page.add_init_script("""window.chrome={tabs:{query:async()=>[{id:1,url:'https://shopee.com.br/product/568119744/23393493780'}]},scripting:{executeScript:async()=>[{result:{title:'Produto de teste',sales:300,soldLabel:'300',salesPeriod:'lifetime',stock:50,views:3000,creationDate:'2026-09-28',updatedDate:'2026-10-20',sources:{sales:'Shopee',creationDate:'Shopee',stock:'Shopee',views:'Shopee',updatedDate:'Shopee'},diagnostics:{version:'0.4.0'}}}]}}""")
        page.goto(f'http://127.0.0.1:{server.server_port}/popup.html')
        page.wait_for_function("document.getElementById('daily').textContent === '10 / dia'")
        assert '300 a cada 30 dias' in page.locator('#monthly').inner_text()
        assert page.locator('#conversion').inner_text() == '10%'
        assert page.locator('#stock-value').inner_text() == '50'
        assert page.locator('#created-value').inner_text() == '28/09/2026'
        assert page.locator('#updated-value').inner_text() == '20/10/2026'
        assert page.locator('#demand-value').inner_text() == 'Meta atingida'
        page.locator('#demand-target').fill('11')
        assert page.locator('#demand-value').inner_text() == 'Abaixo da meta'
        assert 'histórica' in page.locator('#demand-basis').inner_text()
        for key,value in {'price':'50,00','cost':'15','percent':'20','fixed':'4','other':'3'}.items():
            page.locator('#profit-'+key).fill(value)
        page.get_by_role('button', name='Calcular lucro').click()
        assert '18,00' in page.locator('#profit-value').inner_text()
        assert '36%' in page.locator('#profit-margin').inner_text()
        page.locator('#profit-price').fill('10')
        assert page.locator('#profit-result').is_hidden()
        page.get_by_role('button', name='Calcular lucro').click()
        assert 'Prejuízo' in page.locator('#profit-value').inner_text()
        page.locator('summary').click()
        page.locator('#sales').fill('1mil')
        assert page.locator('#daily').inner_text() == 'Indisponível'
        assert page.locator('#demand-value').inner_text() == 'Dados insuficientes'
        page.get_by_role('button', name='Atualizar análise').click()
        assert page.locator('#error').is_visible()
        page.get_by_role('button', name='Ler anúncio novamente').click()
        page.wait_for_function("document.getElementById('daily').textContent === '10 / dia'")
        # Resposta da Shopee com IDs corretos: leitura automática e separação de `sold`.
        product = browser.new_page()
        product.clock.set_fixed_time('2026-10-28T12:00:00Z')
        product.route('https://shopee.com.br/**', lambda route: route.fulfill(body='<main><h1>Produto</h1></main>', content_type='text/html'))
        product.route('https://shopee.com.br/api/**', lambda route: route.fulfill(json=fixture))
        product.goto('https://shopee.com.br/product/568119744/23393493780')
        extracted = product.evaluate(read)
        assert extracted['sales'] == 300  # nunca usa `sold: 12` como acumulado
        assert extracted['salesPeriod'] == 'lifetime'
        assert extracted['stock'] == 50
        assert extracted['creationDate'] == '2026-09-28'
        assert extracted['updatedDate'] == '2026-10-20'
        assert extracted['views'] == 3000
        # Observador: usa a resposta já recebida sem repetir a consulta.
        product.add_script_tag(path=str(root / 'extension/capture.js'))
        product.evaluate("async () => { await (await fetch('/api/v4/pdp/get_pc?item_id=23393493780&shop_id=568119744')).json(); }")
        product.wait_for_function("window.__RITMO_SHOPEE_PRODUCT_V1__.items['568119744:23393493780'] !== undefined")
        extracted = product.evaluate(read)
        assert extracted['diagnostics']['observedResponse'] is True
        assert extracted['diagnostics']['api'] == []
        # XHR também é observado; reinjetar o observador é seguro.
        product.add_script_tag(path=str(root / 'extension/capture.js'))
        product.evaluate("delete window.__RITMO_SHOPEE_PRODUCT_V1__.items['568119744:23393493780']")
        product.evaluate("() => new Promise((resolve, reject) => { const xhr = new XMLHttpRequest(); xhr.open('GET','/api/v4/item/get?itemid=23393493780&shopid=568119744'); xhr.onload = resolve; xhr.onerror = reject; xhr.send(); })")
        product.wait_for_function("window.__RITMO_SHOPEE_PRODUCT_V1__.items['568119744:23393493780'] !== undefined")
        assert product.evaluate(read)['diagnostics']['api'] == []
        # Não incorpora um produto recomendado com outro identificador.
        product.evaluate('delete window.__RITMO_SHOPEE_PRODUCT_V1__')
        product.unroute('https://shopee.com.br/api/**')
        product.route('https://shopee.com.br/api/**', lambda route: route.fulfill(json={'data': {'item': {'item_id': 999, 'shop_id': 568119744, 'historical_sold': 9999, 'ctime': 1790596800}}}))
        extracted = product.evaluate(read)
        assert extracted['sales'] is None and extracted['creationDate'] is None
        # DOM separado e separador de milhar; ao receber 403, não tenta contornar.
        product.unroute('https://shopee.com.br/api/**')
        requests = []
        def deny(route):
            requests.append(route.request.url)
            route.fulfill(status=403, json={'error': 'denied'})
        product.route('https://shopee.com.br/api/**', deny)
        product.set_content('<main><h1>Produto</h1><div><span>1.500</span><span>vendidos</span></div><div><b>50</b> peças disponíveis</div></main><a href="/product/2/3"><div>999 vendidos</div></a>')
        extracted = product.evaluate(read)
        assert extracted['sales'] == 1500
        assert extracted['salesPeriod'] == 'unspecified'
        assert extracted['stock'] == 50
        assert extracted['creationDate'] is None
        assert len(requests) == 1
        product.set_content('<main><h1>Produto</h1><div>1,5mil+ vendidos</div><div>89 vendidos/mês</div></main>')
        extracted = product.evaluate(read)
        assert extracted['soldLabel'] == '1,5mil+'
        assert extracted['sales'] is None
        assert not errors, errors
        browser.close()
        print('PASS: painel automático; leitura de detalhes; IDs; resposta observada; DOM separado; precisão; bloqueio 403; dados manuais opcionais.')
finally:
    server.shutdown()
