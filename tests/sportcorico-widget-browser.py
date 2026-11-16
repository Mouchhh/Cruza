from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for path in ['', 'apercu-educateur/','cruza-demo/']:
  pg=b.new_page(viewport={'width':390,'height':844});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
  if path=='':pg.add_init_script("localStorage.setItem('vestiaire-coach-profiles',JSON.stringify([{id:'legacy',name:'Enzo Mouchet'}]))")
  pg.goto('http://127.0.0.1:3113/'+path+'index.html?mode=local');pg.wait_for_selector('.home-live-ranking')
  assert pg.locator('.home-live-group').count()==0
  assert pg.locator('.home-live-form').count()==1 and pg.locator('.home-live-training').count()==1
  if path!='cruza-demo/':
   assert pg.locator('.home-live-ranking a').get_attribute('href')=='https://www.sportcorico.com/clubs/st-mayennais-fc/mayenne-stade-fc-17'
  else:assert pg.locator('.home-live-ranking a').count()==0
  assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  assert not errs,errs
  pg.close()
 b.close()
print('PASS: ranking card replaces group; U17 link, neutral scope, other widgets and mobile retained')
