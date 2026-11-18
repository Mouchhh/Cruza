"""User journeys and motion behavior of the isolated CRUZA motion study."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE=os.environ.get('CRUZA_MOTION_URL','http://127.0.0.1:3187/apercu-motion/')
ROUTES=['overview','match','seances','agenda','effectif','bilans','ressources','messages','club']
OUT=Path('/tmp/cruza-motion-checks'); OUT.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1100})
    page=context.new_page()
    errors=[];requests=[];bad=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.resource_type in ['fetch','xhr','websocket'] else None)
    page.on('response',lambda r:bad.append([r.status,r.url]) if r.status>=400 else None)
    page.goto(BASE)
    page.wait_for_function("document.querySelector('#app-shell').getAnimations().length>0")
    page.wait_for_timeout(3300)
    assert page.locator('[data-count="88"]').first.inner_text()=='88'
    assert page.locator('#app-shell').evaluate('el=>el.getAnimations().length')==0

    # The curve changes continuously, not through a swap of disconnected images.
    before=page.locator('#chart-line').get_attribute('d')
    page.locator('[data-action=period][data-period="7"]').click()
    page.wait_for_timeout(120)
    during=page.locator('#chart-line').get_attribute('d')
    page.wait_for_timeout(850)
    after=page.locator('#chart-line').get_attribute('d')
    assert before!=during and during!=after
    chart=page.locator('#chart-svg').bounding_box()
    page.mouse.move(chart['x']+chart['width']*.6,chart['y']+60)
    assert page.locator('.chart-tooltip').evaluate('el=>getComputedStyle(el).opacity')=='1'

    # Theme changes reach CSS colors and selected controls.
    page.locator('[data-theme=coral]').click()
    page.wait_for_timeout(900)
    assert page.locator('html').get_attribute('data-theme')=='coral'
    assert page.locator('.swatch.coral').get_attribute('aria-pressed')=='true'
    assert page.locator('.metric-card.accent').evaluate('el=>getComputedStyle(el).backgroundColor')=='rgb(219, 98, 86)'

    # Interrupted transitions always end on the last requested tab.
    for route in ['match','agenda','seances','messages']:
        page.locator(f'[data-nav={route}]').click()
    page.wait_for_timeout(1000)
    assert page.locator('#chat-form').count()==1
    page.locator('#chat-form input').fill('Un message de test depuis la démonstration')
    page.locator('#chat-form button').click()
    page.locator('.bubble.mine').filter(has_text='Un message de test depuis la démonstration').wait_for()
    page.locator('.typing').wait_for()
    page.locator('.bubble').filter(has_text='Bien reçu ! Ceci est une réponse de démonstration.').wait_for()
    assert page.locator('.typing').count()==0

    # Formation morphs and remains stable after its animation.
    page.locator('[data-nav=match]').click()
    page.locator('[data-action=match-tab][data-tab=composition]').wait_for()
    page.locator('[data-action=match-tab][data-tab=composition]').click()
    page.locator('[data-action=formation][data-formation="442"]').wait_for()
    page.locator('[data-action=formation][data-formation="442"]').click()
    page.wait_for_timeout(1050)
    assert page.locator('[data-pin="9"]').evaluate('el=>el.style.left')=='36%'

    page.locator('[data-nav=seances]').click()
    page.locator('[data-action=exercise-filter][data-filter=Transition]').wait_for()
    page.locator('[data-action=exercise-filter][data-filter=Transition]').click()
    page.wait_for_timeout(750)
    assert page.locator('.exercise-tile').count()==2
    page.locator('[data-action=add-exercise]').first.click()
    page.locator('[data-action=my-session]').click()
    assert page.locator('#dialog').evaluate('el=>el.open')
    assert page.locator('#dialog .motion-detail').count()==1
    page.keyboard.press('Escape')

    page.locator('[data-nav=effectif]').click()
    page.locator('[data-action=all-present]').wait_for()
    page.locator('[data-action=all-present]').click()
    assert page.locator('.presence-button[aria-pressed=true]').count()==10
    page.locator('[data-action=presence]').first.click()
    assert page.locator('.presence-button[aria-pressed=true]').count()==9

    # Disabling motion cancels it but leaves every feature available.
    page.locator('#motion-toggle').uncheck()
    page.wait_for_timeout(100)
    assert page.locator('html').evaluate("el=>el.classList.contains('no-motion')")
    assert page.evaluate('document.getAnimations().length')==0
    page.locator('#replay').click()
    assert page.evaluate('document.getAnimations().length')==0

    layouts=0
    for width in [1440,1024,390,320]:
        page.set_viewport_size({'width':width,'height':1000})
        for route in ROUTES:
            page.goto(BASE+'#'+route)
            # Full navigation: initial motion enabled again, so inspect settled state.
            page.wait_for_timeout(1650)
            assert page.locator('#screen h2').count()==1,(width,route)
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),(width,route)
            layouts+=1
        if width in [1440,390]:
            page.goto(BASE)
            page.wait_for_timeout(3400)
            page.mouse.move(0,0)
            page.screenshot(path=str(OUT/f'overview-{width}.png'),full_page=True)

    # Reduced-motion preference suppresses JS and CSS animation from first paint.
    calm=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce')
    calm_page=calm.new_page();calm_page.goto(BASE)
    assert not calm_page.locator('#motion-toggle').is_checked()
    assert calm_page.evaluate('document.getAnimations().length')==0
    calm_page.locator('[data-nav=messages]').click()
    calm_page.locator('#chat-form input').fill('Test sans animation')
    calm_page.locator('#chat-form button').click()
    calm_page.locator('.bubble.mine').filter(has_text='Test sans animation').wait_for()
    assert calm_page.evaluate('document.getAnimations().length')==0
    calm_page.locator('#details-button').click()
    assert calm_page.locator('#dialog').evaluate('el=>el.open')
    calm_page.keyboard.press('Escape')
    assert not calm_page.locator('#dialog').evaluate('el=>el.open')
    assert not errors,errors
    assert not requests,requests
    assert not bad,bad
    print({'result':'PASS','layouts':layouts,'console_errors':errors,'api_requests':requests,'http_errors':bad,'motion':'curve interpolation, tab interruption, formations, counters, theme, chat, reduced motion'})
    browser.close()
