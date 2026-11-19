import test from 'node:test';
import assert from 'node:assert/strict';
import {sportcoricoSource,parseSportcorico,sportcoricoReader,parseClubSearch,parseGames,parseClubTeams,splitTeams,competitionAge,sameCompetition,sportcoricoLogoLoader,competitionKind} from '../sportcorico.mjs';
const source='https://www.sportcorico.com/clubs/test-club/test-u15';
function page(){
 const nodes=[['ShallowReactive',1],null];
 const pack=v=>{const i=nodes.length;nodes.push(null);nodes[i]=Array.isArray(v)?v.map(pack):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,pack(x)])):v;return i;};
 nodes[1]={data:pack({'team-test-u15':{team:{id:123,slug:'test-u15',club_name:'Test',name_generated:'U15',category:{name:'U15'}},current_season:{label:'2026 - 2027'},rankings:[{championship_name:'U15',pool_name:'A',lines:[{rank:1,points:9,games_played:3,difference:5,team:'Test U15',team_id:123,logo:'https://s3.pub2.infomaniak.cloud/logos/test.png',shape_of_the_moment:['V','N','D']},{rank:2,points:6,games_played:3,difference:1,team:'Other',team_id:456,logo:'https://evil.example/image.png',shape_of_the_moment:['V','bad']}]}]}})};
 return '<script type="application/json" id="__NUXT_DATA__">'+JSON.stringify(nodes)+'</script>';
}
test('Sportcorico URL is restricted to HTTPS team pages, tracking removed',()=>{
 assert.equal(sportcoricoSource(source+'?utm_source=test#classement'),source);
 for(const s of ['http://sportcorico.com/clubs/a/b','https://sportcorico.com.evil/clubs/a/b','https://user@sportcorico.com/clubs/a/b','https://sportcorico.com:444/clubs/a/b','https://sportcorico.com/api/private','http://127.0.0.1/clubs/a/b'])assert.throws(()=>sportcoricoSource(s));
});
test('parser binds exact team and rejects missing or malformed tables',()=>{
 const data=parseSportcorico(page(),source);assert.equal(data.category,'U15');assert.equal(data.teamId,123);assert.equal(data.rows.length,2);assert.deepEqual(data.rows[0].form,['V','N','D']);assert.equal(data.rows[0].logo,'https://s3.pub2.infomaniak.cloud/logos/test.png');assert.equal(data.rows[1].logo,'');assert.deepEqual(data.rows[1].form,['V','?']);
 assert.throws(()=>parseSportcorico(page(),source.replace('test-u15','wrong-team')));assert.throws(()=>parseSportcorico('<html>maintenance</html>',source));
});
test('reader shares pending fetches, caches results and forbids redirects',async()=>{
 let calls=0,time=0;const reader=sportcoricoReader(async(url,options)=>{calls++;assert.equal(url,source);assert.equal(options.redirect,'error');return new Response(page());},()=>time);
 const [a,b]=await Promise.all([reader(source),reader(source)]);assert.deepEqual(a,b);assert.equal(calls,1);await reader(source);assert.equal(calls,1);time=16*60000;await reader(source);assert.equal(calls,2);
 const failed=sportcoricoReader(async()=>new Response('Unavailable',{status:503}));await assert.rejects(failed(source));
});
test('gateway route checks site origin and serves public rankings without club credentials',async()=>{
 const {createCanvaGateway}=await import('../server.mjs');const fs=await import('node:fs');const os=await import('node:os');const path=await import('node:path');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ranking-gateway-'));let authCalls=0;
 const config={publicURL:'https://gateway.example',clientId:'test',clientSecret:'test',encryptionKey:'a'.repeat(64),supabaseUrl:'https://club.example',publishableKey:'public',origins:['https://club.example'],directory};
 const app=createCanvaGateway(config,{auth:async()=>{authCalls++;throw Error('Should not authenticate public tables');},fetcher:async()=>new Response(page())});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+app.server.address().port;
 try{
  const denied=await fetch(base+'/api/sportcorico?url='+encodeURIComponent(source),{headers:{Origin:'https://evil.example'}});assert.equal(denied.status,403);
  const ok=await fetch(base+'/api/sportcorico?url='+encodeURIComponent(source),{headers:{Origin:'https://club.example'}});assert.equal(ok.status,200);assert.equal(ok.headers.get('Access-Control-Allow-Origin'),'https://club.example');assert.equal((await ok.json()).teamSlug,'test-u15');assert.equal(authCalls,0);
  const invalid=await fetch(base+'/api/sportcorico?url='+encodeURIComponent('http://localhost/'),{headers:{Origin:'https://club.example'}});assert.equal(invalid.status,400);
 }finally{app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));fs.rmSync(directory,{recursive:true,force:true});}
});

test('club search keeps football clubs with an allowed logo only',()=>{
 const row=(slug,name,sport,logo)=>'<a href="/clubs/'+slug+'" class="rs-row rs-item" data-v-1><span class="rs-row__logo"><img src="'+logo+'" alt></span><span class="rs-row__text"><span class="rs-row__name">'+name+'</span><span class="rs-row__meta">Laval &amp; Mayenne</span></span><span class="rs-row__sport"><span class="rs-row__sport-name">'+sport+'</span></span></a>';
 const html=row('fc-test','FC Test','Football','https://s3.pub2.infomaniak.cloud/x/logo.jpg')+row('rugby-test','Rugby Test','Rugby','https://s3.pub2.infomaniak.cloud/x/r.jpg')+row('fc-evil','FC Evil','Football','https://evil.example/logo.jpg');
 assert.deepEqual(parseClubSearch(html),[{slug:'fc-test',name:'FC Test',city:'Laval & Mayenne',logo:'https://s3.pub2.infomaniak.cloud/x/logo.jpg'},{slug:'fc-evil',name:'FC Evil',city:'Laval & Mayenne',logo:''}]);
});

test('team games keep only this team, valid dates and scores',()=>{
 const game=(id,extra)=>({id,home_team_id:1,outside_team_id:2,home_team_name:'A',outside_team_name:'B',home_logo:'https://s3.pub2.infomaniak.cloud/x/a.jpg',outside_logo:'https://evil.example/b.jpg',event_date:'2026-10-10 17:00',planned_time:'17:00',championship_name:'U17 D1',status:'Terminé',home_score:2,outside_score:1,...extra});
 const games=parseGames([game(1,{}),game(6,{status:'À venir'}),game(2,{status:'À venir',home_score:null,outside_score:null}),game(3,{home_team_id:8,outside_team_id:9}),game(4,{event_date:'bad'}),game(5,{exempt:true})],1);
 assert.equal(games[0].homeLogo,'https://s3.pub2.infomaniak.cloud/x/a.jpg');assert.equal(games[0].awayLogo,'');
 assert.deepEqual(games.map(g=>[g.id,g.status,g.homeScore]),[[1,'played',2],[6,'played',2],[2,'planned',undefined]]);
});
test('club teams are read from the public club page',()=>{
 const html='<a href="/clubs/fc-test/fc-test-3" class="x"><span>U17 1</span><span>Régional 2 POULE B</span></a><a href="/clubs/fc-test/fc-test-3"><span>U17 1</span></a><a href="/clubs/other/x"><span>Autre</span></a>';
 assert.deepEqual(parseClubTeams(html,'fc-test'),[{slug:'fc-test-3',name:'U17 1',competition:'Régional 2 POULE B',url:'https://www.sportcorico.com/clubs/fc-test/fc-test-3'}]);
});

test('a team playing two age categories is split, cups and friendlies stay with the main team',()=>{
 const teams=[{slug:'t-2',name:'U15 1',competitions:['Régional 2 U15 POULE B','U14 Division 1','Coupe District U15','MATCHES AMICAUX U 16']},{slug:'t-4',name:'U19 1',competitions:['Régional 2 U 18 POULE B','MATCHES AMICAUX U 19','COUPE GAMBARDELLA']}];
 const out=splitTeams(teams,'club');
 assert.deepEqual(out.map(t=>t.name),['U15 1','U14','U18 1']);
 assert.equal(out[1].split,'U14 Division 1');
 assert.equal(competitionAge('Régional 2 U 18'),18);
 assert.ok(sameCompetition('U14 Division 1','U14 Division 1 Groupe unique'));
 assert.ok(!sameCompetition('U14 Division 1','Régional 2 U15'));
});

test('club logo is only loaded from the allowed Sportcorico image host, as a safe raster image',async()=>{
 const png=Buffer.from('89504e470d0a1a0a','hex');
 const ok=async()=>new Response(png,{headers:{'content-type':'image/png'}});
 const load=sportcoricoLogoLoader(ok);
 const data=await load('https://s3.pub2.infomaniak.cloud/object/v1/x/logos/a.png');
 assert.equal(data.type,'image/png');assert.equal(Buffer.from(data.base64,'base64').length,8);
 await assert.rejects(()=>load('https://evil.example/a.png'),/Logo invalide/);
 await assert.rejects(()=>sportcoricoLogoLoader(async()=>new Response('<svg/>',{headers:{'content-type':'image/svg+xml'}}))('https://s3.pub2.infomaniak.cloud/x.svg'),/Format/);
});

test('veterans competitions never count as the matches of a seniors team',()=>{
 assert.equal(competitionKind('Vétérans - Vendredi'),'vet');
 assert.equal(competitionKind('Coupe Vétérans ALTONÉO - V'),'vet');
 assert.equal(competitionKind('Régional 2'),'senior');
 assert.equal(competitionKind('U17 Division 1'),'U17');
});
