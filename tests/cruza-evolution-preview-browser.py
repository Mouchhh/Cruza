"""Standalone prototype acceptance: layouts, data isolation and educator journeys.

Run with a static server on 3187, or set CRUZA_PREVIEW_URL.
No production account, Supabase credential or third-party API is needed.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get('CRUZA_PREVIEW_URL', 'http://127.0.0.1:3187/apercu-cruza-evolution/')
OUT = Path('/tmp/cruza-evolution-checks')
OUT.mkdir(exist_ok=True)
ROUTES = ['accueil', 'match', 'seances', 'agenda', 'bilans', 'effectif', 'responsable', 'club', 'reglages', 'ameliorations']

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce', accept_downloads=True)
    page = context.new_page()
    errors, external, bad_responses = [], [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('request', lambda r: external.append(r.url) if not r.url.startswith(BASE.split('/apercu-')[0]) and not r.url.startswith(('blob:', 'data:')) else None)
    page.on('response', lambda r: bad_responses.append([r.status, r.url]) if r.status >= 400 else None)
    page.goto(BASE)
    page.evaluate("localStorage.setItem('smfc-production-sentinel','must remain untouched')")

    # A draft follows its match into the report and survives both switching and reload.
    page.goto(BASE + '#match')
    page.locator('[name=context]').fill('Notre contexte sauvegardé pour Méral Cossé')
    page.locator('[name=intention]').fill('Fixer côté gauche puis renverser')
    page.get_by_role('button', name='Enregistrer ma préparation', exact=True).click()
    page.locator('[data-action=choose-match]').click()
    page.locator('[data-action=select-match][data-match=past]').click()
    assert page.locator('[name=context]').input_value() != 'Notre contexte sauvegardé pour Méral Cossé'
    page.locator('[data-action=choose-match]').click()
    page.locator('[data-action=select-match][data-match=next]').click()
    assert page.locator('[name=context]').input_value() == 'Notre contexte sauvegardé pour Méral Cossé'
    page.reload()
    assert page.locator('[name=intention]').input_value() == 'Fixer côté gauche puis renverser'
    page.locator('[data-action=after-match]').click()
    assert page.locator('.match-context').inner_text().find('Méral Cossé') >= 0
    assert page.get_by_text('Fixer côté gauche puis renverser', exact=True).count() == 1
    page.locator('[name=positive]').fill('Les joueurs se sont rendus disponibles')
    page.get_by_role('button', name='Enregistrer le bilan', exact=True).click()
    assert page.get_by_text('Enregistré ici', exact=True).count() == 1

    # Whole-group pointing works on both days and remains selected after reload.
    page.goto(BASE + '#effectif')
    for i in [0, 1, 2]:
        page.locator(f'[data-player="{i}"][data-day="18"][data-presence=present]').click()
    page.locator('[data-player="1"][data-day="20"][data-presence=excused]').click()
    page.reload()
    assert page.locator('[data-day="18"][data-presence=present][aria-pressed=true]').count() == 3
    assert page.locator('[data-day="20"][data-presence=excused][aria-pressed=true]').count() == 1

    # Teams do not share drafts or attendance.
    page.locator('#team-select').select_option('U15 · Football à 11')
    assert page.locator('[aria-pressed=true]').count() == 0
    page.goto(BASE + '#match')
    assert page.locator('[name=context]').input_value() != 'Notre contexte sauvegardé pour Méral Cossé'
    page.locator('#team-select').select_option('U17 · Football à 11')
    assert page.locator('[name=context]').input_value() == 'Notre contexte sauvegardé pour Méral Cossé'

    # Select/filter exercises, then export a portable copy.
    page.goto(BASE + '#seances')
    page.locator('[data-action=filter][data-filter=Transition]').click()
    assert page.locator('.exercise-card').count() == 2
    page.locator('[data-action=add-exercise]').first.click()
    page.locator('[data-action=session]').click()
    with page.expect_download() as download:
        page.locator('[data-action=export-session]').click()
    data = json.loads(Path(download.value.path()).read_text())
    assert data['preview'] is True and len(data['exercises']) == 1
    page.locator('[data-action=close]').first.click()

    # Role selector is explicitly a demonstration, not an authorization system.
    page.goto(BASE + '#responsable')
    page.locator('#role-select').select_option('educateur')
    assert page.get_by_text('Un espace réservé au responsable.', exact=True).count() == 1
    page.locator('#role-select').select_option('responsable')
    assert page.locator('.category-card').count() == 3

    # Club onboarding stores an inert config and never calls a server.
    page.goto(BASE + '#club')
    page.locator('[data-action=new-club]').first.click()
    page.locator('#club-wizard [name=name]').fill('Club pilote test')
    page.locator('#club-wizard [name=city]').fill('Mayenne')
    page.locator('#club-wizard button[type=submit]').click()
    page.locator('#club-wizard [name=email]').fill('responsable@example.org')
    page.locator('#club-wizard button[type=submit]').click()
    page.locator('#club-wizard button[type=submit]').click()
    assert page.locator('main').get_by_text('Club pilote test', exact=True).count() == 1

    # Local status is honest; offline toggle does not claim a cloud confirmation.
    page.locator('#save-indicator').click()
    assert page.get_by_text('Disponible sur mes autres appareils', exact=True).count() == 1
    page.locator('#offline-switch').check()
    page.keyboard.press('Escape')
    assert page.locator('#save-indicator').inner_text() == 'Mode hors ligne'
    assert page.evaluate("localStorage.getItem('smfc-production-sentinel')") == 'must remain untouched'

    # Upload is resized before storage, and is available after reloading this device.
    page.goto(BASE + '#reglages')
    photo = Path(__file__).resolve().parents[1] / 'assets' / 'photos' / 'celebration-equipe.jpg'
    page.locator('#profile-photo').set_input_files(str(photo))
    page.wait_for_function("JSON.parse(localStorage.getItem('cruza-evolution-preview-v1')).profile.photo.startsWith('data:image/jpeg')")
    page.reload()
    assert page.locator('.profile-header img').count() == 1

    # All routes remain navigable and fit four screen sizes.
    layouts = []
    for width in [1440, 1024, 390, 320]:
        page.set_viewport_size({'width': width, 'height': 900})
        for route in ROUTES:
            page.goto(BASE + '#' + route)
            page.locator('main h1').wait_for()
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), (width, route)
            layouts.append([width, route])
        if width in [1440, 390]:
            for route in ['accueil', 'match', 'responsable']:
                page.goto(BASE + '#' + route)
                page.screenshot(path=str(OUT / f'{route}-{width}.png'), full_page=True)
        if width == 390:
            page.locator('.mobile-menu').click()
            page.get_by_role('link', name='Agenda', exact=True).click()
            assert page.locator('.sidebar').evaluate("el=>!el.classList.contains('open')")

    assert not errors, errors
    assert not external, external
    assert not bad_responses, bad_responses

    # Storage failure never produces a false success and the in-memory copy is exportable.
    blocked = browser.new_context()
    blocked.add_init_script("Storage.prototype.setItem = function(){throw new DOMException('Quota exceeded','QuotaExceededError')}")
    blocked_page = blocked.new_page()
    blocked_page.goto(BASE + '#match')
    blocked_page.locator('[name=context]').fill('Copie à ne pas perdre')
    assert blocked_page.locator('#save-indicator').inner_text() == 'Copie à exporter'
    blocked_page.locator('#save-indicator').click()
    with blocked_page.expect_download() as download:
        blocked_page.locator('[data-action=export]').click()
    exported = json.loads(Path(download.value.path()).read_text())
    assert exported['drafts']['next']['context'] == 'Copie à ne pas perdre'
    blocked.close()
    print(json.dumps({'result': 'PASS', 'layouts': len(layouts), 'journeys': ['match-report', 'reload', 'attendance', 'team-isolation', 'exercise-export', 'roles', 'club-onboarding', 'offline-status', 'mobile-navigation', 'photo-resize', 'quota-recovery-export'], 'console_errors': errors, 'external_requests': external, 'http_errors': bad_responses}, ensure_ascii=False))
    browser.close()
