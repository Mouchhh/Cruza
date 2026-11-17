import fs from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE||'/tmp/cruza-private-sql/node_modules/@electric-sql/pglite/dist/index.js');
const db=new PGlite(),A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${A}'),('${B}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create table public.club_members(user_id uuid,active boolean);insert into public.club_members values('${A}',true),('${B}',true);create function public.club_is_member() returns boolean language sql stable security definer as $$select exists(select 1 from public.club_members where user_id=auth.uid() and active)$$;`);
const sql=fs.readFileSync(new URL('../supabase/coach-private-sync.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
async function asUser(id){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`);}
async function write(owner,kind,key,payload,revision=0,deleted=false){return (await db.query('select public.coach_private_write($1,$2,$3,$4,$5,$6) as value',[owner,kind,key,payload,revision,deleted])).rows[0].value;}
await asUser(A);const saved=await write(A,'settings','profile',{firstName:'A'});assert.equal(saved.revision,1);
await asUser(B);assert.equal((await db.query('select * from public.coach_private_records')).rows.length,0);
await assert.rejects(write(A,'settings','profile',{firstName:'Stolen'},1),/Compte non autorisé/);
await assert.rejects(db.query('update public.coach_private_records set revision=99'),/permission denied/);
await write(B,'settings','profile',{firstName:'B'});
await asUser(A);assert.equal((await db.query('select payload from public.coach_private_records')).rows[0].payload.firstName,'A');
await assert.rejects(write(A,'settings','profile',{firstName:'old'},0),/Version personnelle modifiée/);
await write(A,'settings','profile',{firstName:'A2'},1);
for(let i=1;i<=30;i++)await write(A,'photo',`10000000-0000-4000-8000-${String(i).padStart(12,'0')}`,{name:'Photo',data:'data:image/jpeg;base64,YQ==',createdAt:'2026-11-17T00:00:00Z'});
await assert.rejects(write(A,'photo','10000000-0000-4000-8000-000000000031',{name:'overflow',data:'data:image/jpeg;base64,YQ==',createdAt:'2026-11-17T00:00:00Z'}),/30 photos/);
await write(A,'photo','10000000-0000-4000-8000-000000000001',{},1,true);
await write(A,'photo','10000000-0000-4000-8000-000000000031',{name:'replacement',data:'data:image/jpeg;base64,YQ==',createdAt:'2026-11-17T00:00:00Z'});
await db.exec(`reset role;update club_members set active=false where user_id='${A}';`);await asUser(A);
assert.equal((await db.query('select * from public.coach_private_records')).rows.length,0);await assert.rejects(write(A,'settings','profile',{},2),/Compte non autorisé/);
await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from public.coach_private_records'),/permission denied/);
await db.close();console.log('PASS private SQL: idempotence, two-account isolation, no direct writes, CAS, 30-photo quota, deletion, inactive and anonymous access denied');
