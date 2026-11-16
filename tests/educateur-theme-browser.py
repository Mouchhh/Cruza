from playwright.sync_api import sync_playwright
from pathlib import Path
import json,os
out=Path(os.environ.get('ARTIFACT_DIR','/tmp/educateur-theme-check'));out.mkdir(parents=True,exist_ok=True);BASE=os.environ.get('TEST_BASE_URL','http://127.0.0.1:3100');checks=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for w,h,touch in [(1440,900,False),(1366,768,False),(1024,768,True),(390,844,True),(320,740,True)]:
  pg=b.new_page(viewport={'width':w,'height':h},has_touch=touch,is_mobile=touch,reduced_motion='reduce',locale='fr-FR');errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
  pg.route('**/*',lambda r:r.continue_() if r.request.url.startswith(BASE) or r.request.url.startswith('data:') else r.abort())
  pg.goto(BASE+'/?mode=local');pg.wait_for_function('window.workspaceFraming');pg.evaluate('document.fonts.ready')
  for id in ['view-home','view-training','view-coach-agenda','view-reports','workspace-squad-entry','view-pitch','view-resources']:
   pg.locator('#'+id).click()
   if pg.locator('#document-entry-resume').count():pg.locator('#document-entry-resume').click()
   pg.wait_for_function("workspaceFraming.getState().phase==='idle'")
   assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(w,id,'overflow')
   geom=pg.evaluate("()=>{const nav=document.getElementById('workspace-navigation').getBoundingClientRect(),m=document.querySelector('main').getBoundingClientRect(),h=document.querySelector('body>header').getBoundingClientRect();return {nav:[nav.left,nav.right,nav.top,nav.bottom],main:[m.left,m.right],header:[h.left,h.right,h.top],width:document.body.getBoundingClientRect().right-parseFloat(getComputedStyle(document.body).paddingRight),dock:document.getElementById('workspace-navigation').dataset.dock}}")
   assert abs(geom['main'][0]-geom['header'][0])<1 and abs(geom['main'][1]-geom['header'][1])<1,(w,id,geom)
   assert geom['header'][2]>=-1,(w,id,geom,pg.evaluate("()=>{const e=document.querySelector('body>header'),s=getComputedStyle(e),b=getComputedStyle(document.body);return {position:s.position,top:s.top,transform:s.transform,bodyClass:document.body.className,bodyHeight:b.height,bodyOverflow:b.overflow,bodyPosition:b.position,scrollY:scrollY,innerHeight:innerHeight}}"))
   if geom['dock']=='left':
    assert geom['nav'][0]==0 and geom['main'][0]>=geom['nav'][1],(w,id,geom)
    assert abs(sum(geom['main'])/2-(geom['width']+geom['nav'][1])/2)<1,(w,id,geom)
   else:assert abs(geom['nav'][3]-h)<1,(w,id,geom)
  # Style changes cannot mutate any live document, and never remove inputs/exports.
  before=pg.evaluate('JSON.stringify([getCompositionBoard(),currentReport,currentTraining])')
  pg.evaluate("document.querySelector('link[href^=\"educateur-theme.css\"]').disabled=true")
  pg.wait_for_timeout(100)
  assert pg.evaluate('JSON.stringify([getCompositionBoard(),currentReport,currentTraining])')==before
  pg.evaluate("document.querySelector('link[href^=\"educateur-theme.css\"]').disabled=false")
  assert pg.locator('#causerie-download').count()==1
  assert pg.locator('#match-plan-context').count()==1
  assert not errors,errors
  checks.append({'viewport':[w,h],'touch':touch,'screens':7,'overflow':False,'documents_preserved':True})
  pg.close()
 b.close()
(out/'verification-apercu.json').write_text(json.dumps({'scope':'CSS preview, local examples; no production publication','checks':checks},ensure_ascii=False,indent=2))
print('PASS: 7 screens × 5 viewports, aligned rail/header/content, pinned header, mobile dock, no overflow/JS errors, unchanged documents and retained causerie controls.')
