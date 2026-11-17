from playwright.sync_api import sync_playwright
from pathlib import Path
import os
BASE=os.environ.get('TEST_BASE_URL','http://127.0.0.1:3115');OUT=Path(os.environ.get('ARTIFACT_DIR','/workspace/cruza-documents/apercu-as-andouille'));OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in [1440,390,320]:
  page=b.new_page(viewport={'width':width,'height':960 if width==1440 else 844},has_touch=width<700,is_mobile=width<700,locale='fr-FR',reduced_motion='reduce',service_workers='block');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("localStorage.setItem('SMFC-data-sentinel','untouched')")
  page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(BASE) or r.request.url.startswith('data:') else r.abort())
  page.goto(BASE+'/apercu-as-andouille/index.html?mode=local');page.wait_for_function('window.visualPreviewReady===true');page.evaluate('document.fonts.ready')
  assert page.evaluate('coachClubDetailsRead().name')=='AS Andouillé'
  assert page.evaluate('squadPlayers().length')==16 and page.evaluate('trainingLibrary.length')==3
  assert page.evaluate("CLUB_CLOUD_CONFIG.url==='' && CLUB_CANVA_GATEWAY==='' && CLUB_RANKING_GATEWAY===''")
  assert page.locator('.home-photo-banner').is_hidden()
  if width==1440:page.screenshot(path=str(OUT/'01-accueil.png'))
  else:page.screenshot(path=str(OUT/('04-mobile-'+str(width)+'.png')))
  for view in ['view-pitch','view-training','view-coach-agenda','view-reports','workspace-squad-entry','view-resources','view-home']:
   if width<700 and view in ['workspace-squad-entry','view-resources']:
    page.locator('#coach-profile-trigger').click();page.locator('#coach-profile-options').get_by_role('button',name={'workspace-squad-entry':'Votre effectif','view-resources':'Ressources'}[view],exact=True).click()
   else:page.locator('#'+view).click()
   page.evaluate("document.querySelector('#document-entry-resume')?.click()")
   page.wait_for_function("workspaceFraming.getState().phase==='idle'")
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(width,view)
   if width==1440 and view=='view-pitch':page.screenshot(path=str(OUT/'02-match.png'))
   if width==1440 and view=='view-training':page.evaluate('trainingWizard.openLibrary()');page.screenshot(path=str(OUT/'03-seances.png'))
  page.evaluate("cruzaDemoLocalStorage.setItem('preview-edit-check','saved')");page.reload();page.wait_for_function('window.workspaceFraming')
  assert page.evaluate("cruzaDemoLocalStorage.getItem('preview-edit-check')")=='saved'
  assert page.evaluate("localStorage.getItem('SMFC-data-sentinel')")=='untouched'
  assert not errors,errors
  page.close()
 b.close()
print('PASS: AS identity, disabled services, sample data, seven screens at desktop/390/320, no overflow/JS errors, isolated persistence')
