"""Independent read-only allocation audit; --local works in CI without GitHub auth."""
from pathlib import Path
import csv,json,re,sys,collections,hashlib
ROOT=Path(__file__).resolve().parents[1]
if hasattr(sys.stdout,'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
def section(s,h):
    s=s.split('<!-- two-developer-allocation:start -->')[0]
    m=re.search(r'^### '+re.escape(h)+r'\n(.*?)(?=\n### |\Z)',s,re.S|re.M)
    return m[1].strip() if m else None
def cycles(rows,fields):
    by={r['number']:r for r in rows}; color={}
    def visit(n):
        if n not in by: raise ValueError('Unknown dependency '+str(n))
        if color.get(n)==1: raise ValueError('Dependency cycle '+str(n))
        if color.get(n)==2: return
        color[n]=1
        for k in fields:
            for d in by[n][k]: visit(d)
        color[n]=2
    for n in by: visit(n)
def main():
    current=json.loads((ROOT/'docs/project/developer-issue-allocation.json').read_text(encoding='utf-8'))
    if current.get('ownership_schema_version')==2:
        from verify_ownership_swap import main as verify_current_mapping
        return verify_current_mapping()
    p=json.loads((ROOT/'docs/project/developer-issue-allocation.json').read_text(encoding='utf-8')); rows=p['issues']; baseline=json.loads((ROOT/'docs/project/allocation-baseline.json').read_text(encoding='utf-8')); orig={x['number']:x for x in baseline['issues']}; errors=[]
    def check(ok,message):
        if not ok: errors.append(message)
    check(p['developers']=={'A':'satvikp-coder','B':'varunkarthic'},'Wrong developer identities')
    check(len(rows)==len({r['number'] for r in rows}),'Duplicate allocation entries')
    check({r['number'] for r in rows}=={x['number'] for x in baseline['issues']},'Incomplete baseline classification/history')
    protected=['Summary','Why this is needed','User story','Scope','Out of scope','Technical approach','Data and privacy considerations','Implementation steps','Acceptance criteria','Required tests','Edge cases','Documentation','Definition of Done','Priority','Milestone']
    by={r['number']:r for r in rows}
    for r in rows:
        n=r['number']; body=(ROOT/'docs/project/issues'/f"{r['catalog_id']}.md").read_text(encoding='utf-8')
        for h in protected: check(section(body,h)==section(orig[n]['body'],h),f'#{n} original section changed: {h}')
        check(body.count('<!-- two-developer-allocation:start -->')==1 and body.count('### Two-developer ownership and execution plan')==1,f'#{n} duplicated allocation section')
        check(hashlib.sha256(body.encode()).hexdigest()==r['body_sha256'],f'#{n} local body drift')
        check(r['owner'] in ['A','B'],f'#{n} invalid primary owner')
        for prefix,expected in [('owner:','owner:developer-'+r['owner'].lower()),('workstream:','workstream:'+r['workstream']),('phase:','phase:'+r['phase']),('size:','size:'+r['size'].lower())]:
            check([l for l in r['labels'] if l.startswith(prefix)]==[expected],f'#{n} conflicting {prefix} labels')
        check(r['points']=={'S':1,'M':3,'L':5,'XL':8}[r['size']],f'#{n} inconsistent effort')
        score=sum(r['estimation_factors']); expected='S' if score<=1 else 'M' if score<=3 else 'L' if score<=5 else 'XL'
        check(expected==r['size'],f'#{n} scoring inconsistent')
        fields=['hard_dependencies','integration_dependencies','soft_dependencies','operational_dependencies']
        check(set(r['original_dependencies'])<=set(sum([r[k] for k in fields],[])),f'#{n} original dependency disappeared')
        check(r['ready_to_start']==(r['status']=='open' and all(by[d]['status']=='closed' for d in r['hard_dependencies'])),f'#{n} stale readiness')
        for d in r['hard_dependencies']:
            check(by[d]['global_order']<r['global_order'],f'#{n} invalid topological order')
            check(by[d]['sprint']<=r['sprint'],f'#{n} sprint violates hard prerequisite')
        check(r['expected_output'] and r['required_handoff'] and r['review_requirement'],f'#{n} missing deliverable/handoff')
    for fs in [['hard_dependencies'],['hard_dependencies','integration_dependencies'],['hard_dependencies','integration_dependencies','soft_dependencies','operational_dependencies']]:
        try: cycles(rows,fs)
        except ValueError as e: errors.append(str(e))
    check({r['number'] for r in rows if r['phase']=='foundation'}=={1,6,9,10},'Bootstrap expanded beyond agreed essential issues')
    active=[r for r in rows if r['status']=='open']
    points={o:sum(r['points'] for r in active if r['owner']==o) for o in ['A','B']}
    core={o:sum(r['points'] for r in active if r['owner']==o and r['milestone_number']!=13) for o in ['A','B']}
    check(max(points.values())/min(points.values())<=1.1,'Overall effort outside 10% ratio')
    check(max(core.values())/min(core.values())<=1.1,'Core effort outside 10% ratio')
    csvrows=list(csv.DictReader((ROOT/'docs/project/developer-issue-allocation.csv').open(encoding='utf-8',newline='')))
    check({int(r['number']) for r in csvrows}==set(by),'CSV coverage differs')
    for r in csvrows:
        a=by[int(r['number'])]
        for k in ['owner','title','points','size','phase','owner_order','global_order','sprint','github_assignment_status','expected_output']:
            check(str(a[k])==r[k],f"CSV drift #{r['number']} {k}")
    required=['two-developer-workstreams.md','code-ownership.md','implementation-order.md','developer-handoffs.md','workload-balance.md','DEVELOPER_A_GUIDE.md','DEVELOPER_B_GUIDE.md','coordination.md','sprint-plan.md']
    for f in required: check((ROOT/'docs/project'/f).exists(),'Missing document '+f)
    check(not (ROOT/'.github/CODEOWNERS').exists(),'Unexpected unfulfillable CODEOWNERS gate')
    result=dict(issue_count=len(active),allocation_records=len(rows),counts=dict(collections.Counter(r['owner'] for r in active)),points=points,core_points=core,effort_shares={o:round(v/sum(points.values())*100,2) for o,v in points.items()},foundation=[1,6,9,10],ready={o:[r['number'] for r in active if r['owner']==o and r['ready_to_start']] for o in ['A','B']},hard_edges=sum(len(r['hard_dependencies']) for r in rows),integration_edges=sum(len(r['integration_dependencies']) for r in rows),all_dependency_categories_acyclic=not any('cycle' in e for e in errors),original_sections_preserved=not any('original section' in e for e in errors),errors=errors)
    if '--local' not in sys.argv:
        from publish_github import api,pages,save,REPO
        remote={x['number']:x for x in pages(f'repos/{REPO}/issues?state=all&sort=created&direction=asc') if 'pull_request' not in x}
        check({n for n,x in remote.items() if x['state']=='open'}=={r['number'] for r in active},'Actual open issue set differs from allocation')
        check(set(remote)==set(orig),'Issue duplication/deletion since baseline')
        labeldefs={x['name'] for x in pages(f'repos/{REPO}/labels')}
        for r in rows:
            n=r['number']; x=remote[n]; actual={l['name'] for l in x['labels']}
            check(set(r['labels'])<=actual,f'#{n} missing remote labels')
            check(set(r['labels'])<=labeldefs,f'#{n} missing label definitions')
            check(len([l for l in actual if l.startswith('owner:')])==1,f'#{n} multiple remote owners')
            check(x['milestone']['number']==orig[n]['milestone']['number']==r['milestone_number'],f'#{n} milestone changed')
            check(x['title']==orig[n]['title']==r['title'],f'#{n} title changed')
            check(x['body'].strip()==(ROOT/'docs/project/issues'/f"{r['catalog_id']}.md").read_text(encoding='utf-8').strip(),f'#{n} remote body mismatch')
            assigned=[a['login'] for a in x['assignees']]
            if r['owner']=='A': check('satvikp-coder' in assigned,f'#{n} A assignee update not verified')
            else: check(assigned==r['original_assignees'],f'#{n} B assignee changed against owner instruction')
            check(set(a['login'] for a in orig[n]['assignees'])<=set(assigned),f'#{n} prior assignee removed')
        for n,x in orig.items():
            if remote[n]['state']!=x['state']:
                proof=by[n].get('completion_proof')
                check(remote[n]['state']=='closed' and bool(proof),f'#{n} unrecorded state change/reopen')
                if proof: check(bool(api(proof['api_path'])['merged']),f'#{n} completion PR not merged')
        ms=pages(f'repos/{REPO}/milestones?state=all')
        check({x['number'] for x in ms}=={x['number'] for x in baseline['milestones']},'Milestone deleted/added')
        for x in ms:
            old=next(m for m in baseline['milestones'] if m['number']==x['number'])
            check(x['title']==old['title'] and x['description']==old['description'],'Milestone content changed '+str(x['number']))
        invitations=pages(f'repos/{REPO}/invitations')
        friend_invites=[dict(invitee=x['invitee']['login'] if x.get('invitee') else None,permissions=x['permissions']) for x in invitations if (x.get('invitee') or {}).get('login','').lower()=='varunkarthic']
        result['remote']=dict(repository=REPO,visibility=api('repos/'+REPO)['visibility'],a_assigned=sum(r['owner']=='A' and 'satvikp-coder' in [a['login'] for a in remote[r['number']]['assignees']] for r in active),b_assigned=sum(r['owner']=='B' and 'varunkarthic' in [a['login'] for a in remote[r['number']]['assignees']] for r in active),b_reserved_pending=sum(r['owner']=='B' for r in active),milestones=len(ms),label_count=len(labeldefs),friend_pending_invitations=friend_invites,baseline_prs=len(baseline['pull_requests']),preserved_completed=[r['number'] for r in rows if r['status']=='closed'])
        result['verdict']='PARTIAL — PLANNING COMPLETE BUT REMOTE ASSIGNMENTS INCOMPLETE' if not errors else 'FIX REQUIRED'
        save(ROOT/'docs/project/allocation-verification.json',result)
    print(json.dumps(result,ensure_ascii=False,indent=2))
    if errors: raise SystemExit(1)
if __name__=='__main__': main()
