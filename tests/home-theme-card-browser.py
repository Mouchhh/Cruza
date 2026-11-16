from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for path in ['', 'apercu-educateur/']:
  for w in [1440,390]:
   pg=b.new_page(viewport={'width':w,'height':900},reduced_motion='reduce');errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
   pg.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1:3113') else r.abort())
   pg.goto('http://127.0.0.1:3113/'+path+'index.html?mode=local');pg.wait_for_function("document.body.classList.contains('home-has-slides')")
   pg.wait_for_timeout(1500)
   assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   assert pg.evaluate("getComputedStyle(document.getElementById('home-backdrop')).maskImage==='none'")
   assert not errors,errors
   rect=pg.locator('#home-backdrop').bounding_box()
   assert rect['y']==0 and rect['height']==900 and rect['width']==w,rect
   pg.evaluate('window.scrollTo(0,200)')
   assert pg.locator('#home-backdrop').bounding_box()['y']==0
   if path=='' and w==1440:pg.screenshot(path='/tmp/home-fullpage-fixed.png')
   pg.locator('#view-training').click()
   assert not pg.locator('#home-backdrop').is_visible()
   pg.locator('#view-home').click()
   assert pg.locator('body > #home-backdrop').count()==1
   pg.close()
 b.close()
print('PASS: full viewport home photo, fixed during scroll, hidden outside home, no fading layer or overflow, navigation, SMFC and preview × desktop/mobile')
