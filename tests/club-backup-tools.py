"""Exercise backup/restore CLI orchestration with fake PostgreSQL clients, never a real DB."""
from pathlib import Path
import os,subprocess,tempfile,json
ROOT=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
 d=Path(tmp);bin=d/'bin';bin.mkdir()
 tool='''#!/usr/bin/env python3
import os,sys,json
from pathlib import Path
name=Path(sys.argv[0]).name;args=sys.argv[1:]
with open(os.environ['TEST_CALLS'],'a') as f:f.write(json.dumps([name,args])+'\\n')
if name=='psql':
 if any(a.startswith('--command=') for a in args):print(os.environ['TEST_HAS_ROLE'])
 else:
  f=next(a.split('=',1)[1] for a in args if a.startswith('--file='));Path(os.environ['TEST_SQL']).write_text(Path(f).read_text())
elif name=='pg_dump':
 f=next(a.split('=',1)[1] for a in args if a.startswith('--file='));Path(f).write_text('fixture archive')
elif '--list' in args:
 print('10; 0 1 TABLE DATA public club_members postgres')
 if os.environ['TEST_HAS_ROLE']=='t':print('11; 0 2 TABLE DATA public club_management_access postgres')
else:print("-- synthetic restore fixture, no personal data\\nselect 1;")
'''
 for name in ['psql','pg_dump','pg_restore']:
  f=bin/name;f.write_text(tool);f.chmod(0o700)
 for role in ['t','f']:
  calls=d/('calls-'+role);sql=d/('restore-'+role+'.sql');dump=d/('club-'+role+'.dump')
  env={**os.environ,'PATH':str(bin)+os.pathsep+os.environ['PATH'],'PGSERVICE':'test-fixture','TEST_CALLS':str(calls),'TEST_SQL':str(sql),'TEST_HAS_ROLE':role}
  subprocess.run(['bash',str(ROOT/'scripts/club-backup.sh'),str(dump)],env=env,check=True,capture_output=True)
  data=[json.loads(l) for l in calls.read_text().splitlines()];args=next(a for n,a in data if n=='pg_dump')
  assert ('--table=public.club_management_access' in args)==(role=='t')
  assert sum(a.startswith('--table=') for a in args)==(6 if role=='t' else 5)
  fail=subprocess.run(['bash',str(ROOT/'scripts/club-backup.sh'),str(dump)],env=env,capture_output=True)
  assert fail.returncode!=0 and dump.read_text()=='fixture archive'
  subprocess.run(['bash',str(ROOT/'scripts/club-restore.sh'),'--empty-target',str(dump)],env=env,check=True,capture_output=True)
  restored=sql.read_text()
  assert 'lock table public.club_management_access' in restored
  assert ('installer la migration Responsable' in restored)==(role=='t')
  data=[json.loads(l) for l in calls.read_text().splitlines()]
  restore_args=next(a for n,a in data if n=='psql' and '--single-transaction' in a)
  assert '--set=ON_ERROR_STOP=1' in restore_args
print('PASS: 5/6-table backup, no archive overwrite, optional manager-role guard and transactional restore invocation (fake clients).')
