import test from 'node:test';
import assert from 'node:assert/strict';
import {sportcoricoSource,parseSportcorico,sportcoricoReader} from '../sportcorico.mjs';
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
