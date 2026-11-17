from playwright.sync_api import sync_playwright
import os
BASE=os.environ.get('TEST_BASE_URL','http://127.0.0.1:3114')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for path in ['', 'cruza-demo/']:
  for width in [1440,1280,1100,1024,768,701,390,320]:
   page=b.new_page(service_workers='block',viewport={'width':width,'height':900},has_touch=width<=1024,is_mobile=width<701);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(BASE) or r.request.url.startswith('data:') else r.abort())
   page.goto(BASE+'/'+path+'index.html?mode=local');page.wait_for_selector('#coach-profile-trigger')
   # Exercise the crowded signed-in layout without using a real account or service.
   page.evaluate("()=>{clubSaveStatus('saved','Documents enregistrés');document.getElementById('club-save-indicator').hidden=false;document.querySelector('.coach-profile-name').textContent='Alexandre de la Longue Famille';document.querySelector('.team-space-trigger strong').textContent='U17 Régional · Football à 11';}")
   data=page.evaluate("()=>{const h=document.querySelector('body>header').getBoundingClientRect(),selectors=['.cruza-lockup','.brand','.team-space-picker','#club-network-shortcut','.coach-profile-menu','#club-save-indicator'];return {header:{x:h.x,right:h.right,y:h.y,height:h.height},items:selectors.map(s=>{const e=document.querySelector('body>header '+s);if(!e||!e.getClientRects().length)return null;const r=e.getBoundingClientRect();return {name:s,x:r.x,right:r.right,center:r.y+r.height/2,top:r.y,bottom:r.bottom}}).filter(Boolean),overflow:document.documentElement.scrollWidth>innerWidth+1}}")
   assert data['header']['height']<=54,(path,width,data)
   assert not data['overflow'],(path,width,data)
   centers=[r['center'] for r in data['items']];assert max(centers)-min(centers)<=2,(path,width,data)
   ordered=sorted(data['items'],key=lambda r:r['x']);assert all(a['right']<=b['x']+1 for a,b in zip(ordered,ordered[1:])),(path,width,ordered)
   for r in data['items']:assert r['top']>=data['header']['y'] and r['bottom']<=data['header']['y']+data['header']['height']+1 and r['x']>=data['header']['x']-1 and r['right']<=data['header']['right']+1,(path,width,r)
   page.evaluate('document.fonts.ready')
   aligned=page.evaluate("""()=>[...document.querySelectorAll('body>header .team-space-trigger strong,body>header .coach-profile-name,body>header .coach-profile-avatar,body>header #club-save-label,body>header #club-network-shortcut')].filter(e=>e.getClientRects().length&&getComputedStyle(e).position!=='absolute').map(e=>{const control=e.closest('button,summary')||e,box=control.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(e);const text=range.getBoundingClientRect();return {name:e.className||e.id,dy:Math.abs(text.y+text.height/2-box.y-box.height/2)};})""")
   assert all(r['dy']<=2 for r in aligned),(path,width,aligned)
   page.locator('#coach-profile-trigger').click();assert page.locator('#coach-profile-options').is_visible()
   page.locator('#coach-profile-trigger').click();page.locator('.team-space-trigger').click();assert page.locator('#team-space-list').is_visible()
   if width==1280 and path=='':page.screenshot(path='/tmp/cruza-header-compact.png')
   # Compact display rules must never reveal the workspace behind the login gate.
   page.evaluate("document.documentElement.classList.add('club-private-request');document.documentElement.classList.remove('club-authenticated')")
   assert page.locator('body>header').is_hidden()
   assert not errors,errors
   page.close()
 b.close()
print('PASS: compact single-row header incl. long account name and saved indicator; eight widths on two sites; profile/team menus usable')
