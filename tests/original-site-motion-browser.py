"""Faithfulness and real navigation of the original site with a motion-only layer."""
import hashlib
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('CRUZA_ORIGINAL_MOTION_URL','http://127.0.0.1:3190/apercu-site-anime/index.html?mode=local')
OUT=Path('/tmp/original-site-motion-checks');OUT.mkdir(exist_ok=True)
manifest=json.loads((ROOT/'docs/site-animation-preview-source.json').read_text())
adapted={'club-cloud-config.js','canva-config.js','ranking-config.js','whatsapp-config.js','pwa-register.js'}
identical=0
for name,sha in manifest['sha256'].items():
    if name in adapted or name.endswith('.html'):continue
    assert hashlib.sha256((ROOT/'apercu-site-anime'/name).read_bytes()).hexdigest()==sha,name
    identical+=1
original=(ROOT/'index.html').read_text().split('<body>',1)[1]
copy=(ROOT/'apercu-site-anime/index.html').read_text().split('<body>',1)[1]
assert original==copy.replace('src="preview-animation-engine.js','src="navigation-motion.js')

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    errors=[];bad=[];api=[]
    context=browser.new_context(viewport={'width':1440,'height':1000},service_workers='block',locale='fr-FR')
    page=context.new_page()
    page.add_init_script("window.rawPreviewTestStorage=window.localStorage;localStorage.setItem('vestiaire-saves','production-sentinel');localStorage.setItem('private-test-key','must-stay');")
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('response',lambda r:bad.append([r.status,r.url]) if r.status>=400 else None)
    page.on('request',lambda r:api.append(r.url) if r.resource_type in ['fetch','xhr'] and '/apercu-site-anime/' not in r.url else None)
    page.goto(BASE);page.wait_for_function('window.originalMotionPreviewReady===true');page.evaluate('document.fonts.ready');page.wait_for_timeout(1000)
    assert page.evaluate('CLUB_CLOUD_CONFIG.url==="" && CLUB_CANVA_GATEWAY==="" && CLUB_RANKING_GATEWAY===""')
    assert page.evaluate('saves.length')==0
    assert page.evaluate('coachClubDetailsRead().name')=='Stade Mayennais'
    assert page.evaluate('rawPreviewTestStorage.getItem("vestiaire-saves")')=='production-sentinel'
    assert page.evaluate('rawPreviewTestStorage.getItem("private-test-key")')=='must-stay'
    assert page.evaluate('localStorage.getItem("private-test-key")') is None
    assert page.evaluate('Object.keys(localStorage).every(k=>!k.startsWith("cruza-original-motion-v1:"))')
    page.screenshot(path=str(OUT/'01-accueil.png'),full_page=True)

    # Original page and original handlers, now with an actual native transition.
    page.locator('#view-pitch').click();page.wait_for_timeout(100)
    assert page.evaluate('document.getAnimations().length')>0
    page.wait_for_timeout(1300)
    assert page.evaluate('workspaceFraming.current().view')=='terrain'
    assert page.evaluate('originalMotionEngine.stats.transitions')>=1
    assert page.locator('#pitch').is_visible()
    assert page.locator('#terrain-page-0').evaluate('el=>getComputedStyle(el).opacity')=='1'
    page.screenshot(path=str(OUT/'02-match.png'),full_page=True)

    # Turning animations off changes no button position, labels, or inputs.
    selectors=['#view-home','#view-pitch','#view-training','#view-reports','#formation','#pitch']
    before={s:page.locator(s).bounding_box() for s in selectors}
    labels=page.locator('#workspace-navigation>button').all_text_contents()
    page.locator('#original-motion-enabled').uncheck();page.wait_for_timeout(150)
    after={s:page.locator(s).bounding_box() for s in selectors}
    assert all(before[s] is None and after[s] is None or before[s] and after[s] and all(abs(before[s][k]-after[s][k])<0.05 for k in before[s]) for s in selectors),(before,after)
    assert labels==page.locator('#workspace-navigation>button').all_text_contents()
    page.locator('#original-motion-enabled').check()

    # The existing sub-tabs keep their actual editor and transition.
    sub=page.locator('#task-section-navigation button').filter(has_text='Causerie')
    if sub.count():
        sub.first.click();page.wait_for_timeout(1200)
        if page.locator('#document-entry-resume').is_visible():
            page.locator('#document-entry-resume').click();page.wait_for_timeout(600)
        assert page.locator('#match-plan-form').count()==1

    # Fast main navigation must end at the last target and clear transition names.
    for tab in ['view-home','view-training','view-coach-agenda','view-home']:
        page.locator('#'+tab).evaluate('el=>el.click()')
        page.wait_for_timeout(65)
    page.wait_for_timeout(1600)
    assert page.evaluate('workspaceFraming.current().view')=='home'
    assert page.evaluate("[...document.querySelectorAll('[style]')].every(el=>el.style.viewTransitionName!=='cruza-original-content')")

    # Same original routes at desktop, laptop and two mobile sizes.
    routes=[('view-home','home'),('view-pitch','terrain'),('view-training','training'),('view-coach-agenda','agenda'),('view-reports','report'),('workspace-squad-entry','squad'),('view-resources','resources')]
    layouts=0
    for width in [1440,1024,390,320]:
        for tab,view in routes:
            print('layout',width,tab,flush=True)
            route_context=browser.new_context(viewport={'width':width,'height':900},reduced_motion='reduce',service_workers='block')
            route_page=route_context.new_page()
            route_page.on('pageerror',lambda e:errors.append(str(e)))
            route_page.goto(BASE);route_page.wait_for_function('window.originalMotionPreviewReady===true')

            if width<700 and tab in ['workspace-squad-entry','view-resources']:
                route_page.locator('#coach-profile-trigger').click()
                route_page.locator('#coach-profile-options').get_by_role('button',name={'workspace-squad-entry':'Votre effectif','view-resources':'Ressources'}[tab],exact=True).click()
            elif route_page.locator('#'+tab).is_visible():route_page.locator('#'+tab).click()
            else:route_page.evaluate('(id)=>workspaceNavigation.run(id)',tab)
            route_page.wait_for_timeout(450)
            if route_page.locator('#report-entry-open').is_visible():route_page.locator('#report-entry-open').click();route_page.wait_for_timeout(300)
            assert route_page.evaluate('workspaceFraming.current().view')==view,(width,tab,route_page.evaluate('workspaceFraming.current()'))
            assert not route_page.evaluate('document.documentElement.scrollWidth>innerWidth+1'),(width,tab)
            layouts+=1
            if width==390 and tab=='view-home':route_page.screenshot(path=str(OUT/'03-mobile.png'),full_page=True)
            route_context.close()

    # The private Club gate is preserved, not bypassed to a real account.
    page.goto(BASE);page.wait_for_function('window.originalMotionPreviewReady===true')
    page.locator('#view-club-network').evaluate('el=>el.click()');page.wait_for_timeout(500)
    assert page.locator('#club-auth-gate').is_visible()
    assert not api,api
    assert not bad,bad
    assert not errors,errors

    calm=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce',service_workers='block')
    calm_page=calm.new_page();calm_page.goto(BASE);calm_page.wait_for_function('window.originalMotionPreviewReady===true')
    assert calm_page.locator('#original-motion-enabled').is_disabled()
    calm_page.locator('#view-training').click();calm_page.wait_for_timeout(400)
    assert calm_page.evaluate('originalMotionEngine.stats.transitions')==0
    assert calm_page.evaluate('workspaceFraming.current().view')=='training'
    print({'result':'PASS','unaltered_scripts_and_styles':identical,'layouts':layouts,'console_errors':errors,'api_requests':api,'http_errors':bad,'checked':'original HTML body, original editors, actual transitions, rapid clicks, layout equality, isolated storage, reduced motion, private access guard'})
    browser.close()
