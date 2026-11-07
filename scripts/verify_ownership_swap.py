"""Independent read-only audit of the frozen one-way people swap."""
from pathlib import Path
import json,csv,re,sys,collections,subprocess
ROOT=Path(__file__).resolve().parents[1]
NEW={'A':'varunkarthic','B':'satvikp-coder'}
FIELDS=['hard_dependencies','integration_dependencies','soft_dependencies','operational_dependencies','original_dependencies','milestone','milestone_number','owner','workstream','priority','size','points','phase','owner_order','global_order','sprint','expected_output']
def outside(s):
    a='<!-- two-developer-allocation:start -->'; b='<!-- two-developer-allocation:end -->'
    return s.split(a)[0]+s.split(b,1)[1]
def norm(s): return s.replace('\r\n','\n').strip()
def acyclic(rows):
    by={r['number']:r for r in rows}; visiting=set(); done=set()
    def dfs(n):
        if n in visiting: raise ValueError('cycle '+str(n))
        if n in done: return
        visiting.add(n)
        for field in ['hard_dependencies','integration_dependencies','soft_dependencies','operational_dependencies']:
            for d in by[n][field]: dfs(d)
        visiting.remove(n); done.add(n)
    for n in by: dfs(n)
def main():
    if hasattr(sys.stdout,'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
    snap=json.loads((ROOT/'docs/project/ownership-swap-snapshot.json').read_text(encoding='utf-8')); plan=json.loads((ROOT/'docs/project/developer-issue-allocation.json').read_text(encoding='utf-8')); mapping=json.loads((ROOT/'docs/project/ownership-swap-map.json').read_text(encoding='utf-8'))
    originals={x['number']:x for x in snap['issues']}; old={r['number']:r for r in snap['original_allocation']['issues']}; rows=plan['issues']; by={r['number']:r for r in rows}; rec={r['number']:r for r in mapping['records']}; errors=[]
    def check(ok,msg):
        if not ok: errors.append(msg)
    check(plan['developers']==NEW and plan.get('ownership_schema_version')==2,'Wrong current people mapping/schema')
    check(set(by)==set(originals) and len(by)==len(rows),'Incomplete/duplicated allocation')
    for r in rows:
        n=r['number']; x=originals[n]; t=rec[n]; local=(ROOT/'docs/project/issues'/f"{r['catalog_id']}.md").read_text(encoding='utf-8')
        for field in FIELDS: check(r.get(field)==old[n].get(field),f'#{n} technical field changed: {field}')
        check(r['status']==x['state'],f'#{n} completion state changed')
        check(set(r['labels'])=={l['name'] for l in x['labels']},f'#{n} labels changed')
        check(r['current_maintainer']==NEW[r['owner']],f'#{n} wrong current maintainer')
        check(r['ready_to_start']==(r['status']=='open' and all(by[d]['status']=='closed' for d in r['hard_dependencies'])),f'#{n} incorrect technical readiness')
        if x['state']=='open':
            check(r['github_user']==NEW[r['owner']],f'#{n} stale active person')
            check(norm(outside(local))==norm(outside(x['body'])),f'#{n} technical body/acceptance/tests/PR link changed')
            check(f"Developer {r['owner']} — `{NEW[r['owner']]}`" in local,f'#{n} wrong ownership section')
            check(local.count('### Two-developer ownership and execution plan')==1,f'#{n} duplicated planning heading')
        else:
            historical=subprocess.check_output(['git','show',snap['base_commit']+':docs/project/issues/'+r['catalog_id']+'.md'],cwd=ROOT,text=True,encoding='utf-8')
            check(norm(local)==norm(historical),f'#{n} closed historical local body changed')
    try: acyclic(rows)
    except (ValueError,KeyError) as e: errors.append('Dependency graph '+str(e))
    csvrows={int(r['number']):r for r in csv.DictReader((ROOT/'docs/project/developer-issue-allocation.csv').open(encoding='utf-8',newline=''))}
    check(set(csvrows)==set(by),'CSV coverage mismatch')
    for n,r in by.items():
        for k in ['owner','github_user','status','points','priority','milestone','phase','github_assignment_status']:
            check(str(r[k])==csvrows[n][k],f'#{n} CSV drift {k}')
    for role,user in NEW.items():
        s=(ROOT/'docs/project'/f'DEVELOPER_{role}_GUIDE.md').read_text(encoding='utf-8')
        check(s.startswith('# Developer '+role+' guide — '+user),'Stale guide '+role)
        for r in rows:
            if r['owner']==role and r['status']=='open': check(r['url'] in s,'Guide missing '+str(r['number']))
    changed=subprocess.check_output(['git','diff','--name-only',snap['base_commit'],'--','apps','packages','db','database','infrastructure','pnpm-lock.yaml'],cwd=ROOT,text=True).strip()
    check(not changed,'Product code/contracts/database/lockfile changed by ownership run: '+changed)
    report=dict(records=len(rows),open=sum(r['status']=='open' for r in rows),closed_preserved=[r['number'] for r in rows if r['status']=='closed'],new_mapping=NEW,open_by_role=dict(collections.Counter(r['owner'] for r in rows if r['status']=='open')),previously_unassigned_B=sum(t['reserved_unassigned'] for t in mapping['records']),technical_fields_preserved=True,dependencies_acyclic=True,errors=errors)
    if '--local' not in sys.argv:
        from publish_github import api,pages,save,REPO
        remote={x['number']:x for x in pages(f'repos/{REPO}/issues?state=all&sort=created&direction=asc') if 'pull_request' not in x}
        check(set(remote)==set(originals),'Issue added/deleted outside frozen inventory')
        for n,x in originals.items():
            actual=remote[n]; t=rec[n]; r=by[n]
            check(actual['state']==x['state'],f'#{n} unexpected closure/reopen')
            check(actual['title']==x['title'] and actual['milestone']['number']==x['milestone']['number'],f'#{n} title/milestone changed')
            check({l['name'] for l in actual['labels']}=={l['name'] for l in x['labels']},f'#{n} remote technical labels changed')
            assignees=[a['login'] for a in actual['assignees']]
            if x['state']=='closed':
                check(assignees==[a['login'] for a in x['assignees']] and actual['body']==x['body'],f'#{n} completed contribution altered')
            else:
                check(assignees==t['expected_actual_assignees'],f'#{n} incorrect assignees: {assignees}')
                check(t['actual_verified_assignees']==assignees,f'#{n} unverified result')
                check(norm(actual['body'])==norm((ROOT/'docs/project/issues'/f"{r['catalog_id']}.md").read_text(encoding='utf-8')),f'#{n} local/remote body drift')
                check(len(assignees)<=1,f'#{n} duplicate primary assignees')
        ms=pages(f'repos/{REPO}/milestones?state=all'); oldms={m['number']:m for m in snap['milestones']}
        check({m['number'] for m in ms}==set(oldms),'Milestone added/deleted')
        for m in ms: check(m['title']==oldms[m['number']]['title'] and m['description']==oldms[m['number']]['description'],'Milestone modified '+str(m['number']))
        prs=pages(f'repos/{REPO}/pulls?state=all'); prby={p['number']:p for p in prs}
        for p in snap['pull_requests']:
            q=prby.get(p['number']); check(q is not None and q['user']['login']==p['user']['login'] and q['merge_commit_sha']==p['merge_commit_sha'] and q['merged_at']==p['merged_at'],f"PR #{p['number']} attribution/history changed")
        repo=api('repos/'+REPO); check(repo['visibility']==snap['repository']['visibility'],'Repository visibility changed')
        active=[x for x in remote.values() if x['state']=='open']; pending=[t['number'] for t in mapping['records'] if t.get('pending_access')]
        report.update(actual_assigned_to_satvik=sum('satvikp-coder' in [u['login'] for u in x['assignees']] for x in active),actual_assigned_to_varun=sum('varunkarthic' in [u['login'] for u in x['assignees']] for x in active),pending_varun=pending,unresolved_ownership_conflicts=0 if not errors else len(errors),milestones=len(ms),preserved_prs=len(snap['pull_requests']),pre_swap_open_prs=[p['number'] for p in snap['pull_requests'] if p['state']=='open'],visibility=repo['visibility'])
        report['verdict']='FIX REQUIRED' if errors else 'PARTIAL — DOCUMENTS UPDATED BUT SOME GITHUB ASSIGNMENTS PENDING' if pending else 'PASS — ALL ISSUE OWNERSHIP SUCCESSFULLY SWAPPED'
        save(ROOT/'docs/project/ownership-swap-verification.json',report)
    print(json.dumps(report,ensure_ascii=False,indent=2))
    if errors: raise SystemExit(1)
if __name__=='__main__': main()
