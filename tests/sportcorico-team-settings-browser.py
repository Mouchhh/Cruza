from playwright.sync_api import sync_playwright
import json
SOURCE='https://www.sportcorico.com/clubs/test-club/test-u15'
data={'version':1,'sourceURL':SOURCE,'teamSlug':'test-u15','teamId':123,'teamName':'Test U15','category':'U15','season':'2026 - 2027','competition':'Test U15','pool':'A','fetchedAt':'2026-11-17T18:00:00Z','rows':[{'rank':1,'points':9,'games_played':3,'difference':5,'team':'Test U15','team_id':123},{'rank':2,'points':6,'games_played':3,'difference':1,'team':'Other','team_id':456}]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(service_workers='block',viewport={'width':390,'height':844})
 page.add_init_script("if(!localStorage.getItem('vestiaire-coach-profiles'))localStorage.setItem('vestiaire-coach-profiles',JSON.stringify([{id:'legacy',name:'Enzo Mouchet'}]))")
 page.route('**/api/sportcorico?*',lambda r:r.fulfill(json=data,headers={'Access-Control-Allow-Origin':'*'}))
 page.goto('http://127.0.0.1:3113/index.html?mode=local');page.wait_for_selector('.home-sportcorico-own',state='attached')
 original=page.evaluate('activeCoachTeam.id')
 assert page.evaluate("coachTeamSportcoricoURL('https://sportcorico.com/clubs/test-club/test-u15?utm_source=a')")==SOURCE
 assert page.evaluate("coachTeamSportcoricoURL('https://evil.example/clubs/test-club/test-u15')") is None
 page.get_by_role('button',name='Configurer le classement',exact=True).click()
 assert page.get_by_label('Lien Sportcorico de cette équipe (facultatif)').input_value().startswith('https://www.sportcorico.com/clubs/st-mayennais-fc/')
 page.locator('.coach-team-dialog').get_by_role('button',name='Fermer',exact=True).click()
 page.evaluate('coachTeamAddDialog(false)')
 page.get_by_label('Nom affiché (ex. Seniors A)').fill('U15 Test')
 page.get_by_label('Catégorie (ex. Seniors, U15)').fill('U15')
 page.get_by_label('Nom de l’équipe',exact=True).fill('Test U15')
 page.get_by_label('Lien Sportcorico de cette équipe (facultatif)').fill(SOURCE+'?utm_source=test')
 page.get_by_role('button',name='Créer et ouvrir cette équipe',exact=True).click()
 page.wait_for_function("typeof activeCoachTeam!=='undefined'&&activeCoachTeam.category==='U15'")
 page.wait_for_selector('.home-sportcorico-own',state='attached')
 assert page.locator('.home-live-ranking .home-live-value').inner_text()=='1er · 9 pts'
 page.wait_for_function("typeof homeSportcoricoSourceURL==='function'");assert page.evaluate('homeSportcoricoSourceURL()')==SOURCE
 page.reload();page.wait_for_function("typeof activeCoachTeam!=='undefined'&&activeCoachTeam.category==='U15'");page.wait_for_function("typeof homeSportcoricoSourceURL==='function'");assert page.evaluate('homeSportcoricoSourceURL()')==SOURCE
 page.evaluate('(id)=>coachTeamSwitch(id)',original);page.wait_for_function("typeof activeCoachTeam!=='undefined'&&activeCoachTeam.category==='U17'")
 page.wait_for_function("typeof homeSportcoricoSourceURL==='function'");assert page.evaluate('homeSportcoricoSourceURL()')!=SOURCE
 page.wait_for_selector('.home-sportcorico-own',state='attached');assert '10 pts' in page.locator('.home-live-ranking .home-live-value').inner_text()
 b.close()
print('PASS: team form, URL safety, tracking removal, two isolated teams, reload persistence and correct ranking after switch')
