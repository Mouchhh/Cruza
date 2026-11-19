"""Approved home/week presentation composed with the original animated app."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE=os.environ.get('CRUZA_SELECTED_PAGES_URL','http://127.0.0.1:3190/apercu-site-anime/index.html?mode=local')
OUT=Path('/tmp/cruza-selected-pages-checks');OUT.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1050},service_workers='block',locale='fr-FR')
    page=context.new_page();errors=[];bad=[];api=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('response',lambda r:bad.append([r.status,r.url]) if r.status>=400 else None)
    page.on('request',lambda r:api.append(r.url) if r.resource_type in ['fetch','xhr'] and '/apercu-site-anime/' not in r.url else None)
    page.goto(BASE);page.wait_for_function('window.selectedPagesPreviewReady===true');page.evaluate('document.fonts.ready');page.wait_for_timeout(1200)
    assert page.locator('#evo-home').is_visible()
    assert not page.locator('#home-live-widgets').is_visible()
    assert page.locator('#evo-home .evo-hero').count()==1
    assert page.locator('#evo-home .evo-stat').count()==3
    assert page.locator('#evo-home .evo-flow-step').count()==4
    assert page.locator('#evo-home').get_by_role('heading',name='Chaque semaine, un cap commun.').count()==1
    # The visual design does not fabricate the old demo's 88% or ten points of form.
    assert page.locator('#evo-home .evo-stat').first.inner_text().find('À pointer')>=0
    page.screenshot(path=str(OUT/'01-home-desktop.png'),full_page=True)

    # The ranking remains accessible through its original renderer.
    page.locator('#evo-home [data-evo-action=ranking]').click()
    assert page.locator('#evo-ranking-dialog').evaluate('el=>el.open')
    assert page.locator('#evo-ranking-dialog table tbody tr').count()>1
    page.keyboard.press('Escape')

    # Home/week shortcut opens the seven-day overview, using canonical events.
    page.locator('#evo-home [data-evo-action=open-week]').first.click();page.wait_for_timeout(1200)
    assert page.locator('#evo-agenda').is_visible()
    assert page.evaluate('workspaceFraming.current().panelId')=='agenda-page-0'
    assert page.locator('#evo-agenda .evo-day').count()==7
    week=page.locator('#evo-week-picker').input_value()
    event_count=page.locator('#evo-agenda .evo-calendar-event').count()
    assert event_count>=1
    page.locator('#evo-agenda [data-evo-action=next-week]').click()
    assert page.locator('#evo-week-picker').input_value()!=week
    page.locator('#evo-agenda [data-evo-action=previous-week]').click()
    assert page.locator('#evo-week-picker').input_value()==week
    page.locator('#evo-agenda [data-evo-filter=training]').click()
    assert page.locator('#evo-agenda .evo-calendar-event.is-match').count()==0
    page.locator('#evo-agenda [data-evo-filter=all]').click()
    assert page.locator('#evo-agenda .evo-calendar-event').count()==event_count
    page.screenshot(path=str(OUT/'02-agenda-desktop.png'),full_page=True)

    # Open an actual fixture through the original controller, retaining its identity.
    event=page.evaluate("selectedPagesPreview.events().find(e=>e.date>=document.querySelector('#evo-week-picker').value&&e.kind==='match') && selectedPagesPreview.events().filter(e=>e.date>=document.querySelector('#evo-week-picker').value&&e.kind==='match').map(e=>({id:e.id,date:e.date,opponent:e.fff?.opponent||e.title}))[0]")
    page.locator('#evo-agenda .evo-calendar-event.is-match').first.click();page.wait_for_timeout(1400)
    if page.locator('#document-entry-resume').is_visible():page.locator('#document-entry-resume').click();page.wait_for_timeout(800)
    assert page.evaluate('workspaceFraming.current().view')=='terrain'
    assert page.evaluate('getCompositionBoard().matchPreparation.date')==event['date']
    assert page.evaluate('getCompositionBoard().matchPreparation.opponent')==event['opponent']
    assert not page.locator('#evo-home').is_visible()
    assert not page.locator('#evo-agenda').is_visible()
    assert page.locator('#match-plan-form').count()==1

    # The unmodified original calendar remains one click away.
    page.locator('#view-coach-agenda').click();page.wait_for_timeout(1000)
    page.locator('#evo-agenda [data-evo-action=full-calendar]').click();page.wait_for_timeout(900)
    assert page.evaluate('workspaceFraming.current().panelId')=='agenda-page-1'
    assert not page.locator('#evo-agenda').is_visible()
    page.evaluate("workspaceFlows.agenda.go(0)")
    page.evaluate('selectedPagesPreview.render()')
    assert page.locator('#evo-agenda').is_visible()

    # Creating a training starts the existing form and does not create a second store.
    chosen='2026-12-02'
    page.locator('#evo-agenda [data-evo-action=create-event]').first.click()
    page.locator('#evo-create-date').fill(chosen)
    page.locator('#evo-create-dialog [data-evo-action=create-training]').click();page.wait_for_timeout(1000)
    assert page.evaluate('workspaceFraming.current().view')=='training'
    assert page.evaluate('currentTraining.date')==chosen
    assert page.evaluate('trainingLibrary.length')==0
    assert page.locator('#training-space').is_visible()

    # Check the two approved pages at laptop and mobile widths with reduced motion.
    layouts=0
    for width in [1440,1024,390,320]:
        c=browser.new_context(viewport={'width':width,'height':900},reduced_motion='reduce',service_workers='block',locale='fr-FR')
        q=c.new_page();q.on('pageerror',lambda e:errors.append(str(e)))
        q.goto(BASE);q.wait_for_function('window.selectedPagesPreviewReady===true');q.evaluate('document.fonts.ready')
        assert q.locator('#evo-home').is_visible()
        assert not q.evaluate('document.documentElement.scrollWidth>innerWidth+1'),('home',width)
        if width==390:q.screenshot(path=str(OUT/'03-home-mobile.png'),full_page=True)
        q.locator('#view-coach-agenda').click();q.wait_for_timeout(400)
        assert q.locator('#evo-agenda').is_visible()
        assert not q.evaluate('document.documentElement.scrollWidth>innerWidth+1'),('agenda',width)
        assert q.locator('#evo-agenda .evo-calendar-scroll').evaluate('el=>el.scrollWidth>=el.clientWidth')
        if width==390:q.screenshot(path=str(OUT/'04-agenda-mobile.png'),full_page=True)
        layouts+=2;c.close()
    assert not errors,errors
    assert not bad,bad
    assert not api,api
    print({'result':'PASS','layouts':layouts,'checked':['approved home','weekly agenda','ranking retained','week navigation','type filters','canonical fixture identity','original calendar retained','original training form','empty data not fabricated','responsive layout'],'console_errors':errors,'http_errors':bad,'external_api_requests':api})
    browser.close()
