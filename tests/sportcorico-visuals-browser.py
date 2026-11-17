from playwright.sync_api import sync_playwright
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1];data=json.loads((ROOT/'data/sportcorico-u17.json').read_text())
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in [1440,390,320]:
  page=b.new_page(service_workers='block',viewport={'width':width,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("localStorage.setItem('vestiaire-coach-profiles',JSON.stringify([{id:'legacy',name:'Enzo Mouchet'}]))")
  page.route('https://s3.pub2.infomaniak.cloud/**',lambda r:r.fulfill(path=str(ROOT/'assets/icons/icon-192.png'),content_type='image/png'))
  page.goto('http://127.0.0.1:3113/index.html?mode=local');page.wait_for_selector('.home-sportcorico-own',state='attached')
  table=page.locator('#home-live-widgets .home-sportcorico-table')
  assert table.locator('tbody tr').count()==10
  for i,row in enumerate(data['rows']):
   rendered=table.locator('tbody tr').nth(i)
   assert rendered.locator('.home-sportcorico-result').all_text_contents()==row['form']
   if row['logo']:assert rendered.locator('img').get_attribute('src')==row['logo']
  assert page.evaluate("homeSportcoricoLogo('https://evil.example/track.png')")==''
  assert page.evaluate("homeSportcoricoLogo('javascript:alert(1)')")==''
  page.evaluate("document.querySelector('.home-sportcorico-logo').dispatchEvent(new Event('error'))")
  assert table.locator('.home-sportcorico-badge').first.inner_text().strip()
  if width<700:
   page.get_by_role('button',name='Voir le tableau',exact=True).click()
   assert page.locator('.home-sportcorico-dialog tbody tr').count()==10
   assert page.locator('.home-sportcorico-dialog .home-sportcorico-result').count()==sum(len(r['form']) for r in data['rows'])
   assert page.locator('.home-sportcorico-dialog').bounding_box()['width']<=width
   page.get_by_role('button',name='Fermer',exact=True).click()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  if width==1440:page.screenshot(path='/tmp/sportcorico-color-desktop.png')
  assert not errors,errors
  page.close()
 b.close()
print('PASS: source logos/form, initials fallback, safe logo origins, ten rows and mobile dialog at 390/320, no overflow')
