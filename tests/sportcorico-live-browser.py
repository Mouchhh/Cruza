from playwright.sync_api import sync_playwright
import json
from pathlib import Path
DATA=json.loads((Path(__file__).resolve().parents[1]/'data/sportcorico-u17.json').read_text())
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for w in [1440,390,320]:
  pg=b.new_page(service_workers='block',viewport={'width':w,'height':900});errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
  pg.add_init_script("localStorage.setItem('vestiaire-coach-profiles',JSON.stringify([{id:'legacy',name:'Enzo Mouchet'}]))")
  pg.goto('http://127.0.0.1:3113/index.html?mode=local');pg.wait_for_selector('.home-sportcorico-own',state='attached')
  assert pg.locator('.home-sportcorico-table tbody tr').count()==len(DATA['rows'])
  own=next(r for r in DATA['rows'] if r['team_id']==DATA['teamId'])
  assert str(own['points']) in pg.locator('.home-sportcorico-own').inner_text()
  assert pg.locator('.home-live-group').count()==0
  assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  if w<700:
   pg.get_by_role('button',name='Voir le tableau',exact=True).click()
   assert pg.locator('.home-sportcorico-dialog tbody tr').count()==len(DATA['rows'])
   assert pg.locator('.home-sportcorico-dialog').is_visible()
   pg.get_by_role('button',name='Fermer',exact=True).click()
  for mutate in [lambda d:d.update(sourceURL='https://evil.example'),lambda d:d.update(rows=[d['rows'][0]]),lambda d:d['rows'][0].update(team_id=d['rows'][1]['team_id'])]:
   bad=json.loads(json.dumps(DATA));mutate(bad)
   assert not pg.evaluate('data=>homeSportcoricoValid(data)',bad)
  pg.route('**/data/sportcorico-u17.json',lambda r:r.fulfill(status=503,body='Unavailable'))
  pg.evaluate('homeSportcoricoChecked=0;refreshHomeSportcorico()');pg.wait_for_function('homeSportcoricoError')
  assert pg.locator('.home-sportcorico-own').count()==1
  assert 'dernier classement conservé' in pg.locator('.home-live-ranking').inner_text(), (w,pg.locator('.home-live-ranking').inner_text(),pg.evaluate('document.body.className'))
  assert not errors,errors
  pg.close()
 b.close()
print('PASS: real snapshot, ten rows, highlighted club, invalid data rejected, last table kept on failure, three viewport sizes')
