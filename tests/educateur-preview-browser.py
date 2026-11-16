from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for w in [1440,390,320]:
  page=b.new_page(viewport={'width':w,'height':900},has_touch=w<500,is_mobile=w<500);errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1:3111') else r.abort())
  page.goto('http://127.0.0.1:3111/apercu-educateur/index.html?mode=local')
  page.wait_for_function('window.visualPreviewReady===true',timeout=25000)
  print(w,page.evaluate('({sessions:trainingLibrary.length,cloud:CLUB_CLOUD_CONFIG.url})'))
  page.evaluate("localStorage.setItem('preview-test-real','preserve');cruzaDemoLocalStorage.setItem('test-edit','saved')")
  for id in ['view-home','view-training','view-coach-agenda','view-reports','workspace-squad-entry','view-pitch','view-resources']:
   page.locator('#'+id).click()
   if page.locator('#document-entry-resume').is_visible():page.locator('#document-entry-resume').click()
   page.wait_for_function("workspaceFraming.getState().phase==='idle'")
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(w,id)
  page.reload();page.wait_for_function('window.workspaceFraming && window.matchContinuity')
  assert page.evaluate("cruzaDemoLocalStorage.getItem('test-edit')")=='saved'
  page.on('dialog',lambda d:d.accept())
  page.get_by_role('button',name='Repartir du début').click()
  page.wait_for_function('window.visualPreviewReady===true')
  assert page.evaluate("localStorage.getItem('preview-test-real')")=='preserve'
  assert page.evaluate("cruzaDemoLocalStorage.getItem('test-edit')") is None
  assert not errors,errors
  page.close()
 b.close()
print('PASS navigation, mobile overflow, persistence, reset isolation')
