from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for path in ['', 'cruza-demo/','apercu-educateur/']:
  for w in [1440,390]:
   pg=b.new_page(viewport={'width':w,'height':900},reduced_motion='reduce');errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
   pg.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1:3112') else r.abort())
   pg.goto('http://127.0.0.1:3112/'+path+'index.html?mode=local');pg.wait_for_function("document.querySelector('.home-hero #home-backdrop')")
   pg.wait_for_timeout(1500)
   assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   assert pg.evaluate("getComputedStyle(document.getElementById('home-backdrop')).maskImage==='none'")
   assert not errors,errors
   if path=='' and w==1440:pg.screenshot(path='/tmp/home-card-fixed.png')
   pg.locator('#view-training').click();pg.locator('#view-home').click()
   assert pg.locator('.home-hero #home-backdrop').count()==1
   pg.close()
 b.close()
print('PASS: home photo contained, no fading layer or overflow, navigation, 3 versions × desktop/mobile')
