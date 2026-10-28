"""Interface com fonte simulada: não valida dados reais da Shopee."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(root / 'extension')))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.clock.set_fixed_time('2026-10-28T12:00:00Z')
        page.add_init_script("window.chrome={tabs:{query:async()=>[{id:1}]},scripting:{executeScript:async()=>[{result:{title:'Produto de teste',soldLabel:'300',creationDate:null}}]}}")
        page.goto(f'http://127.0.0.1:{server.server_port}/popup.html')
        page.wait_for_function("document.getElementById('sales').value === '300'")
        assert page.locator('#stock-value').inner_text() == 'Indisponível'
        page.locator('#created').fill('2026-09-28')
        page.locator('#stock').fill('50')
        page.locator('#visits').fill('3000')
        page.locator('#updated').fill('2026-10-20')
        page.get_by_role('button', name='Atualizar análise').click()
        assert page.locator('#daily').inner_text() == '10 / dia'
        assert '300 a cada 30 dias' in page.locator('#monthly').inner_text()
        assert page.locator('#conversion').inner_text() == '10%'
        assert page.locator('#per-sale').inner_text() == '10'
        assert page.locator('#stock-value').inner_text() == '50'
        assert page.locator('#updated-value').inner_text() == '20/10/2026'
        page.locator('#sales').fill('1mil')
        assert page.locator('#daily').inner_text() == 'Indisponível'
        page.get_by_role('button', name='Atualizar análise').click()
        assert page.locator('#error').is_visible()
        page.get_by_role('button', name='Ler anúncio novamente').click()
        page.wait_for_function("document.getElementById('sales').value === '300'")
        assert page.locator('#created').input_value() == ''
        assert page.locator('#daily').inner_text() == 'Indisponível'
        # A extração é exercitada numa página simulada, com o hostname do anúncio.
        extractor = (root / 'extension/extract.js').read_text().replace('export function', 'function', 1)
        page.route('https://shopee.com.br/**', lambda route: route.fulfill(body='<h1>Produto exemplo</h1><div>500 vendidos</div><span>89 vendidos/mês</span>', content_type='text/html'))
        page.goto('https://shopee.com.br/product/568119744/23393493780')
        extracted = page.evaluate(f'() => {{ {extractor}; return extractListing(); }}')
        assert extracted['soldLabel'] == '500'
        assert extracted['creationDate'] is None
        page.set_content('<h1>Produto</h1><div>500 vendidos</div><div>10 vendidos</div>')
        extracted = page.evaluate(f'() => {{ {extractor}; return extractListing(); }}')
        assert extracted['soldLabel'] is None
        assert extracted['warning']
        assert not errors, errors
        browser.close()
        print('PASS: indicadores, médias, campos ausentes, erros, releitura e extração em páginas simuladas.')
finally:
    server.shutdown()
