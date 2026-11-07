"""One-way, frozen-snapshot ownership migration. Roles/technical scope never toggle."""
from pathlib import Path
import json,re,sys,csv,io,hashlib,subprocess,collections
from datetime import datetime,timezone
from urllib.parse import urlencode,quote
from publish_github import ROOT,REPO,api,pages,gh,save

SNAP=ROOT/'docs/project/ownership-swap-snapshot.json'
MAP=ROOT/'docs/project/ownership-swap-map.json'
STATE=ROOT/'docs/project/ownership-swap-progress.json'
ALLOC=ROOT/'docs/project/developer-issue-allocation.json'
NEW={'A':'varunkarthic','B':'satvikp-coder'}
OLD={'A':'satvikp-coder','B':'varunkarthic'}
def now(): return datetime.now(timezone.utc).isoformat()
def sha(s): return hashlib.sha256(s.encode()).hexdigest()
def put(path,s):
    p=ROOT/path; p.parent.mkdir(parents=True,exist_ok=True); p.write_text(s.replace('\r\n','\n').replace('\r','\n').rstrip()+'\n',encoding='utf-8',newline='\n')
def git(*args): return subprocess.check_output(['git',*args],cwd=ROOT,text=True,encoding='utf-8').strip()
def link(n): return f'[#{n}](https://github.com/{REPO}/issues/{n})'
def links(ns): return ', '.join(link(n) for n in ns) or 'None'
def elig(user):
    try: api(f'repos/{REPO}/assignees/{user}'); return dict(eligible=True,error=None)
    except RuntimeError as e:
        if '404' not in str(e): raise
        return dict(eligible=False,error=str(e))
def snapshot():
    if SNAP.exists(): print('Frozen snapshot exists; will not swap an already-swapped record again.'); return
    repo=api('repos/'+REPO); viewer=api('user')['login']
    if viewer!='satvikp-coder' or repo['owner']['login']!='satvikp-coder' or not repo['permissions']['push']: raise RuntimeError('Wrong repository/user/permission')
    issues=[x for x in pages(f'repos/{REPO}/issues?state=all&sort=created&direction=asc') if 'pull_request' not in x]
    prs=pages(f'repos/{REPO}/pulls?state=all'); milestones=pages(f'repos/{REPO}/milestones?state=all'); labels=pages(f'repos/{REPO}/labels')
    try: projects=gh('api','graphql','-f','query=query { repository(owner:"satvikp-coder",name:"makarba-360") { projectsV2(first:100) { nodes { id title url } } } }')
    except RuntimeError as e: projects=dict(unavailable=str(e))
    invitations=[dict(id=x['id'],login=(x.get('invitee') or {}).get('login'),permissions=x['permissions']) for x in pages(f'repos/{REPO}/invitations')]
    collabs=[dict(login=x['login'],permissions=x.get('permissions'),role_name=x.get('role_name')) for x in pages(f'repos/{REPO}/collaborators?affiliation=all')]
    allocation=json.loads(ALLOC.read_text(encoding='utf-8')); by={r['number']:r for r in allocation['issues']}; records=[]
    for x in issues:
        n=x['number']; owners=[l['name'][-1].upper() for l in x['labels'] if l['name'] in ['owner:developer-a','owner:developer-b']]
        if len(owners)!=1 or n not in by or owners[0]!=by[n]['owner']: raise RuntimeError('Conflicting/unmapped primary role #'+str(n))
        role=owners[0]; expected_workstream='core-platform' if role=='A' else 'public-experience'
        if 'workstream:'+expected_workstream not in [l['name'] for l in x['labels']]: raise RuntimeError('Workstream conflict '+str(n))
        assigned=[u['login'] for u in x['assignees']]
        third=[u for u in assigned if u not in OLD.values()]
        if third: raise RuntimeError('Review unrelated co-assignees before mutation '+str(n))
        related=[dict(number=p['number'],url=p['html_url'],author=p['user']['login'],state=p['state'],merged_at=p['merged_at'],merge_commit_sha=p['merge_commit_sha']) for p in prs if n in set(map(int,re.findall(r'#(\d+)',p['title']+'\n'+(p.get('body') or ''))))]
        records.append(dict(number=n,title=x['title'],state=x['state'],complete=x['state']=='closed',role=role,old_owner=OLD[role],old_assignees=assigned,ownership_label='owner:developer-'+role.lower(),workstream=expected_workstream,milestone=x['milestone']['number'] if x['milestone'] else None,reserved_unassigned=x['state']=='open' and role=='B' and not assigned,new_intended_assignee=NEW[role] if x['state']=='open' else None,current_maintainer=NEW[role],required_mutation='preserve completed history' if x['state']=='closed' else 'replace old primary assignee with '+NEW[role],pr_references=related,original_body_sha256=sha(x['body'] or ''),verification_status='not applied' if x['state']=='open' else 'historical record preserved'))
    protected={}
    for path in git('ls-files').splitlines():
        if path.startswith(('apps/','packages/','database/','infrastructure/')) or path.endswith('pnpm-lock.yaml'):
            protected[path]=git('rev-parse','HEAD:'+path)
    data=dict(schema_version=1,frozen_at=now(),repo=REPO,branch='main',base_commit=git('rev-parse','HEAD'),viewer=viewer,repository=dict(owner=repo['owner']['login'],visibility=repo['visibility'],permissions=repo['permissions']),old_mapping=OLD,new_mapping=NEW,issues=issues,records=records,pull_requests=prs,milestones=milestones,labels=labels,projects=projects,invitations=invitations,collaborators=collabs,varun_eligibility=elig('varunkarthic'),original_allocation=allocation,protected_source_blobs=protected)
    save(SNAP,data); save(STATE,dict(frozen_snapshot=SNAP.relative_to(ROOT).as_posix(),stage='audit complete; no GitHub mutation',applied=[],errors=[],pending=[]))
    print(json.dumps(dict(issues=len(issues),open=sum(x['state']=='open' for x in issues),closed=[x['number'] for x in issues if x['state']=='closed'],open_by_role=dict(collections.Counter(r['role'] for r in records if r['state']=='open')),open_prs=[p['number'] for p in prs if p['state']=='open'],varun_eligibility=data['varun_eligibility'],invitations=invitations,projects=projects),ensure_ascii=False,indent=2))

def ownership_body(original,role,user,pending):
    start=original.find('<!-- two-developer-allocation:start -->'); end=original.find('<!-- two-developer-allocation:end -->')
    if start<0 or end<start: raise RuntimeError('Missing stable ownership section')
    prefix=original[:start]; suffix=original[end+len('<!-- two-developer-allocation:end -->'):]
    chunk=original[start:end+len('<!-- two-developer-allocation:end -->')]
    if f'Developer {role} — `{OLD[role]}`' not in chunk:
        if f'Developer {role} — `{NEW[role]}`' in chunk: return original
        raise RuntimeError('Ownership section does not match frozen old or desired new role')
    chunk=chunk.replace('\r\n','\n')
    # Replace people only inside the owned planning section; never repository URLs or technical sections.
    chunk=chunk.replace('satvikp-coder','__OLD_SATVIK__').replace('varunkarthic','satvikp-coder').replace('__OLD_SATVIK__','varunkarthic')
    chunk=re.sub(r'Actual GitHub assignment:.*?(?=\n\nWorkstream:)',lambda m:'Actual GitHub assignment: '+('pending Varun invitation acceptance/eligibility; obsolete Satvik primary assignee must be removed; intended owner `varunkarthic`.' if pending else 'desired primary assignee `'+user+'`; actual result is verified in ownership-swap-map.json.')+' Historical implementation authorship and genuine human approvals remain unchanged.',chunk,flags=re.S)
    chunk=chunk.replace('B (satvikp-coder), pending collaboration acceptance','B (satvikp-coder)')
    if '### Ownership swap' in suffix: suffix=suffix[:suffix.index('### Ownership swap')]
    return prefix+chunk+suffix

def prepare():
    snap=json.loads(SNAP.read_text(encoding='utf-8')); allocation=json.loads(json.dumps(snap['original_allocation'])); original_by={x['number']:x for x in snap['issues']}; by={r['number']:r for r in allocation['issues']}; records=json.loads(json.dumps(snap['records']))
    allocation.update(developers=NEW,ownership_schema_version=2,ownership_swap_snapshot=SNAP.relative_to(ROOT).as_posix(),current_maintenance_mapping=NEW,friend_assignment_policy='A varunkarthic pending invitation; B satvikp-coder must be assigned, including previously unassigned reservations.')
    pending=not snap['varun_eligibility']['eligible']
    for t in records:
        n=t['number']; r=by[n]; x=original_by[n]; r['status']=x['state']; r['labels']=[l['name'] for l in x['labels']]
        r['pre_swap_intended_owner']=OLD[r['owner']]
        r['historical_contribution_owner']=OLD[r['owner']] if x['state']=='closed' else None
        r['current_maintainer']=NEW[r['owner']]
        r['linked_prs']=t['pr_references']; r['actual_assignees']=[u['login'] for u in x['assignees']]
        if x['state']=='closed':
            r['github_user']=OLD[r['owner']]; r['github_assignment_status']='historical closed assignment preserved'; body=x['body']
        else:
            r['github_user']=NEW[r['owner']]; r['original_pre_swap_assignees']=t['old_assignees']
            r['github_assignment_status']='pending invitation acceptance; intended varunkarthic, obsolete Satvik assignment removed at apply' if r['owner']=='A' and pending else 'target '+NEW[r['owner']]+'; verify through ownership-swap-map.json'
            r['integration_partner']=NEW['B' if r['owner']=='A' else 'A']
            body=ownership_body(x['body'],r['owner'],r['github_user'],pending and r['owner']=='A')
        if x['state']=='open': put('docs/project/issues/'+r['catalog_id']+'.md',body)
        r['body_sha256']=sha((ROOT/'docs/project/issues'/f"{r['catalog_id']}.md").read_text(encoding='utf-8'))
        t['desired_body_sha256']=r['body_sha256']; t['pending_access']=x['state']=='open' and t['role']=='A' and pending
        t['expected_actual_assignees']=t['old_assignees'] if t['complete'] else ([] if t['pending_access'] else [t['new_intended_assignee']])
        t['actual_verified_assignees']=None
    for r in allocation['issues']:
        r['ready_to_start']=r['status']=='open' and all(by[d]['status']=='closed' for d in r['hard_dependencies'])
    save(ALLOC,allocation); save(MAP,dict(snapshot=SNAP.relative_to(ROOT).as_posix(),new_mapping=NEW,prepared_at=now(),records=records)); render()

def render():
    allocation=json.loads(ALLOC.read_text(encoding='utf-8')); rows=allocation['issues']; active=[r for r in rows if r['status']=='open']; snap=json.loads(SNAP.read_text(encoding='utf-8')); mapping=json.loads(MAP.read_text(encoding='utf-8')); rec={r['number']:r for r in mapping['records']}
    header='Current mapping: **Developer A = Varun (`varunkarthic`), core-platform; Developer B = Satvik (`satvikp-coder`), public-experience.** Roles and technical workstream labels did not swap. Closed contributions keep their actual authors.\n\n'
    catalog=json.loads((ROOT/'docs/project/issue-catalog.yaml').read_text(encoding='utf-8')); cat={x['id']:x for x in catalog}
    for r in rows:
        if r['status']=='open': cat[r['catalog_id']].update(assigned_username=r['github_user'],allocation_owner=r['owner'])
    save(ROOT/'docs/project/issue-catalog.yaml',catalog)
    fields=['number','title','owner','github_user','milestone','priority','size','points','phase','owner_order','global_order','sprint','hard_dependencies','integration_dependencies','soft_dependencies','operational_dependencies','status','ready_to_start','required_handoff','integration_partner','expected_output','github_assignment_status','actual_assignees','current_maintainer','url']
    out=io.StringIO(); w=csv.DictWriter(out,fieldnames=fields,lineterminator='\n'); w.writeheader()
    for r in sorted(rows,key=lambda r:r['number']): w.writerow({k:json.dumps(r.get(k),ensure_ascii=False) if isinstance(r.get(k),list) else r.get(k,'') for k in fields})
    put('docs/project/developer-issue-allocation.csv',out.getvalue())
    table='| Issue | Title | Owner / person | Milestone | State | Priority | Size / points | Hard dependencies | GitHub assignment |\n|---|---|---|---|---|---|---|---|---|\n'
    table+='\n'.join(f"| {link(r['number'])} | {r['title']} | {r['owner']} / {r['github_user']} | M{r['milestone_number']-1:02d} | {r['status']} | {r['priority']} | {r['size']} / {r['points']} | {links(r['hard_dependencies'])} | {r['github_assignment_status']} |" for r in sorted(rows,key=lambda r:r['global_order']))
    for f in ['allocation-matrix.md','issue-index.md']: put('docs/project/'+f,'# Current issue allocation\n\n'+header+'Generated from developer-issue-allocation.json. Closed rows are historical; all active rows use the new mapping.\n\n'+table)
    for role,user in NEW.items():
        own=sorted([r for r in active if r['owner']==role],key=lambda r:r['owner_order'])
        text='# Developer '+role+' guide — '+user+'\n\n'+header
        text+=('Varun maintains the core backend, PostGIS, identity/auth, researcher application, surveys/GPS, offline sync, private aggregation, publication and audit services. Satvik previously implemented the merged foundation; inherit and test it, do not rebuild it or claim authorship.\n\n' if role=='A' else 'Satvik owns the public website, design system, React/MapLibre map, profiles, galleries, Then & Now, panoramas, safe reporting/charts, localization and agreed content/quality tools. Previously unassigned B reservations now require Satvik assignees.\n\n')
        ready=[r['number'] for r in own if r['ready_to_start']]
        text+='Technically ready by hard prerequisites: '+links(ready)+'. Read the human-action register: readiness does not grant approval, waive private-data controls or prove already-merged work is production-ready.\n\n'
        if role=='A': text+='GitHub access: the frozen eligibility check returned 404 for Varun. If still pending, accept the existing write invitation first; public source review is possible without acceptance, but do not bypass ownership/assignment policy for implementation. See HUMAN_ACTION_REQUIRED.md.\n\n'
        text+='## Recommended open queue\n\n'
        for r in own: text+=f"- **{role}-{r['owner_order']:02d} {link(r['number'])}: {r['title']}** — M{r['milestone_number']-1:02d}, {r['phase']}, {r['priority']}, {r['size']}/{r['points']} points. Hard: {links(r['hard_dependencies'])}; live integration: {links(r['integration_dependencies'])}. Output: {r['expected_output']} Assignment: {r['github_assignment_status']}.\n"
        text+='\n## Handoffs and tests\n\nVarun provides core/provider contracts and privacy-safe APIs to Satvik; Satvik supplies public consumers and content/reporting components. Shared #9/#10 contracts and synthetic mocks are already merged by Satvik; reuse them with `pnpm install --frozen-lockfile`, `pnpm dev:mock`, and the existing conformance checks. No public survey submission; exact interview GPS and raw responses remain restricted. Separate interview and subject-place IDs remain mandatory.\n\nUse code-ownership.md for paths. Keep provider/consumer compatibility, upload/consent and disclosure tests. Use the original issue tests plus `pnpm typecheck`, `pnpm test`, `pnpm build` as applicable; Python planning/ownership checks do not replace actual API/database/browser/device evidence. Database tests need the documented local PostgreSQL/PostGIS service. Do not buy hosting or run real collection without approval.\n\nBranch `dev-'+role.lower()+'/issue-N-slug` from updated main, implement only the owned issue, test, document, open a scoped PR and inspect CI. Cross-review interface/migration/security changes; never alter the other role’s contract silently. Keep existing PR authors and branches. Close issues only after real acceptance, including human decisions.\n'
        put('docs/project/DEVELOPER_'+role+'_GUIDE.md',text)
    a=[r for r in active if r['owner']=='A']; b=[r for r in active if r['owner']=='B']
    put('docs/project/two-developer-workstreams.md','# Current two-developer workstreams\n\n'+header+f"Varun inherits {len(a)} open core issues; Satvik takes {len(b)} open public-experience issues. Satvik's completed foundation and historical PR authorship remain unchanged.\n\n"+'The swap is a person-to-role mapping change, not an architecture reallocation. All dependency arrays, priorities, estimates, phases, milestones, tests and acceptance criteria remain as frozen before the swap. Open issues with merged code still transfer their approval/integration/acceptance follow-up.\n\n'+ 'Shared foundation #9/#10 is already available. Varun supplies future provider changes; Satvik builds consumers against existing synthetic mocks. Incremental map #120, evidence #123, analytics #93, exposure #110 and E2E #113 handoffs remain in place. See developer-handoffs.md and the two guides.\n')
    put('docs/project/implementation-order.md','# Current implementation order\n\n'+header+'Technical edges and existing order identifiers were preserved exactly. Queues exclude closed work; an open issue with merged code still requires remaining acceptance.\n\n'+ '\n\n'.join('## '+NEW[o]+' — Developer '+o+'\n\n'+' → '.join(link(r['number']) for r in sorted(active,key=lambda r:r['owner_order']) if r['owner']==o)+'\n\nReady by hard prerequisites: '+links([r['number'] for r in active if r['owner']==o and r['ready_to_start']]) for o in ['A','B'])+'\n\nHuman approvals are separate from technical readiness. In particular #6/#11 are not approved by this reassignment; #32/#33/#34/#35/#40 inherit merged code plus pending real-provider/UI/approval verification. Never recreate completed foundation issues.\n')
    put('docs/project/workload-balance.md','# Remaining workload after ownership swap\n\n'+header+'This is an exact person swap; no issue is reshuffled to rebalance effort. Closed work naturally reduces the remaining core effort. Existing S=1/M=3/L=5/XL=8 estimates are unchanged.\n\n| Role / person | Open issues | Existing points |\n|---|---:|---:|\n'+ '\n'.join(f"| {o} / {NEW[o]} | {sum(r['owner']==o for r in active)} | {sum(r['points'] for r in active if r['owner']==o)} |" for o in ['A','B'])+'\n\nOriginal allocation fairness reports and pre-swap progress remain historical snapshots. This swap does not authorise changing dependencies or scope for arithmetic.\n')
    put('docs/project/github-issue-views.md','# Current GitHub issue views\n\n'+header+'Projects access is recorded in the frozen snapshot; no inaccessible board or board URL is invented. Existing role labels remain the stable filters.\n\n'+ '\n'.join('- ['+name+'](https://github.com/'+REPO+'/issues?'+urlencode({'q':q})+') — `'+q+'`' for name,q in [('My tasks — Satvik, B','is:issue is:open label:owner:developer-b'),('Varun tasks — A','is:issue is:open label:owner:developer-a'),('Ready','is:issue is:open label:status:ready'),('Blocked','is:issue is:open label:dependency:blocked'),('In progress','is:issue is:open label:status:in-progress'),('Review','is:issue is:open label:status:needs-review'),('Integration','is:issue is:open label:phase:integration'),('Completed history','is:issue is:closed')]))
    report='# Ownership swap report\n\n'+header+f"Frozen at {snap['frozen_at']}; base commit `{snap['base_commit']}`. Snapshot includes {len(rows)} issues, {len(active)} open, {len(rows)-len(active)} closed; {len(a)} Satvik→Varun and {len(b)} Varun/reserved→Satvik. Previously unassigned B reservations: {sum(r['reserved_unassigned'] for r in mapping['records'])}.\n\n"
    report+='Closed issues retained unchanged: '+links([r['number'] for r in rows if r['status']=='closed'])+'. Their existing author/assignee/PR history stays historical; Varun is the current maintainer of core code.\n\n'
    for role in ['B','A']:
        report+='## Complete open queue — '+NEW[role]+' / Developer '+role+'\n\n'
        report+='| Issue | Title | Milestone | Status | Priority | Hard dependencies | Transfer status |\n|---|---|---|---|---|---|---|\n'
        report+='\n'.join(f"| {link(r['number'])} | {r['title']} | M{r['milestone_number']-1:02d} | {r['status']} | {r['priority']} | {links(r['hard_dependencies'])} | {rec[r['number']]['verification_status']} |" for r in sorted(active,key=lambda r:r['owner_order']) if r['owner']==role)+'\n\n'
    report+='## Merged artifacts on still-open core issues\n\nRemaining approval, real-provider setup, UI/integration tests and final acceptance on #6, #32, #33, #34, #35 and #40 now belong to Varun. Their previous code is not reattributed.\n\n'
    ledger=ROOT/'docs/project/claude-developer-a-progress.json'
    if ledger.exists():
        prs={p['number']:p for p in snap['pull_requests']}
        for item in json.loads(ledger.read_text(encoding='utf-8'))['issues']:
            if item['issue'] not in [6,32,33,34,35,40]: continue
            match=re.search(r'PR #(\d+)',item['pr'])
            if match and int(match[1]) in prs:
                pr=prs[int(match[1])]; report+=f"- {link(item['issue'])}: [PR #{pr['number']}]({pr['html_url']}) by `{pr['user']['login']}`, merge `{pr['merge_commit_sha']}`; original remaining note: {item['note']}.\n"
    report+='\n## Open PR handoffs\n\n'
    openprs=[p for p in snap['pull_requests'] if p['state']=='open']
    report+=('No open PR existed at the frozen audit. The ownership planning PR is separate from implementation work.\n' if not openprs else '\n'.join(f"- [PR #{p['number']}]({p['html_url']}) — {p['title']}; original author `{p['user']['login']}` preserved. Related issue current maintainer follows the allocation; no automatic merge/branch deletion.\n" for p in openprs))
    report+='\n## Verification and remaining actions\n\nSee ownership-swap-verification.json and ownership-swap-map.json for actual assignees and transfer status. Varun must accept his existing write invitation if eligibility remains 404; Satvik cannot accept it on his behalf. No administrator access or visibility change is requested. Projects query limitations are in the snapshot and role-based issue views replace inaccessible board views. All human approvals remain pending unless independently evidenced.\n'
    put('docs/project/OWNERSHIP_SWAP_REPORT.md',report)
    save(ROOT/'docs/project/ownership-maintenance-map.json',dict(current_mapping=NEW,records=[dict(number=r['number'],state=r['status'],technical_role=r['owner'],current_maintainer=NEW[r['owner']],historical_contribution_owner=OLD[r['owner']] if r['status']=='closed' else None) for r in rows]))
    static_documents()
    print('Rendered authoritative allocation, CSV, guides, queues, views and swap report')

def static_documents():
    banner='Current ownership: Developer A = Varun (`varunkarthic`, core-platform); Developer B = Satvik (`satvikp-coder`, public-experience). The workstreams did not swap. Satvik retains authorship of his merged foundation; Varun now maintains it.\n\n'
    p=ROOT/'AGENTS.md'; s=p.read_text(encoding='utf-8')
    old='Developer B is varunkarthic; leave B assignees unchanged until invitation acceptance and explicit assignment authorization.'
    s=s.replace(old,'Developer A is varunkarthic (core-platform); Developer B is satvikp-coder (public-experience). Use the frozen ownership-swap-snapshot.json and ownership-swap-map.json; never reverse the already-swapped assignments. Varun may remain formally unassigned until his existing invitation is accepted; obsolete Satvik core assignees must be removed. Closed history remains unchanged.')
    s=s.replace('Use scripts/allocate_workstreams.py and the independent scripts/verify_allocation.py;','Use scripts/swap_ownership.py for current mapping/render/apply and scripts/verify_ownership_swap.py for verification; scripts/verify_allocation.py delegates to the current schema. Preserve all original dependency arrays;')
    put('AGENTS.md',s)
    p=ROOT/'README.md'; s=p.read_text(encoding='utf-8')
    s=s.replace('**Planning-first repository. No product features implemented.**','**Planning plus initial core implementation.**')
    s=re.sub(r'Two-developer plan:.*?(?=\n\n)',lambda m:'Two-developer plan: **Varun = Developer A, core platform; Satvik = Developer B, public experience.** See [workstreams](docs/project/two-developer-workstreams.md), [Varun’s A guide](docs/project/DEVELOPER_A_GUIDE.md), [Satvik’s B guide](docs/project/DEVELOPER_B_GUIDE.md), [handoff contracts](docs/project/developer-handoffs.md), and [ownership swap report](docs/project/OWNERSHIP_SWAP_REPORT.md). Varun’s GitHub assignments may await invitation acceptance; previously reserved public issues now belong to Satvik. Historical contributions are preserved.',s)
    put('README.md',s)
    for name in ['code-ownership.md','developer-handoffs.md','roadmap.md','issue-dependencies.md','sprint-plan.md','capacity-batches.md','coordination.md']:
        p=ROOT/'docs/project'/name
        if not p.exists(): continue
        s=p.read_text(encoding='utf-8')
        s=re.sub(r'Generated from developer-issue-allocation.json\..*?(?=\n\n)',lambda m:banner.strip(),s,count=1,flags=re.S)
        if 'Current ownership: Developer A = Varun' not in s: s=s.replace('\n\n','\n\n'+banner,1)
        s=s.replace('Version **1.0.0 planning contract**, pending review under #9 and executable TypeScript/mock implementation under #10.','Version **1.0.0 contract baseline**: #9 review and #10 TypeScript/mock scaffold were merged by Satvik. Varun now maintains provider/core contracts and Satvik consumes them in the public experience. Reuse the existing foundation; no reimplementation is required.')
        s=s.replace('H0 (#9, A→B): freeze','H0 (#9, originally completed by Satvik; current maintenance A→B): maintain the frozen').replace('H1 (#10, A→B): clean','H1 (#10, originally completed by Satvik; current maintenance A→B): the existing clean')
        if name=='coordination.md':
            s=re.sub(r'Varun assignment policy:.*?(?=\n\n|\Z)',lambda m:'Current assignment policy: Varun now owns A/core, and Satvik owns B/public. The previous instruction to leave B assignments unchanged is superseded by this explicit ownership swap. Assign Satvik to every open B issue, including former reservations. If Varun remains ineligible, keep A labels/intended ownership, remove obsolete Satvik assignees, record pending access, and ask Varun to accept his existing write invitation. Do not create duplicates or grant administrator access. Closed issues and PR authors remain historical.',s,flags=re.S)
            s=s.replace('B may read the public repository and prepare independent design/research while collaboration is pending;','Varun (A) may read the public repository while collaboration is pending;')
        if name=='code-ownership.md' and 'Existing implemented module paths' not in s:
            s+='\n\n## Existing implemented module paths\n\nA/Varun maintains `apps/api/`, `packages/auth/`, `packages/authz/`, `packages/audit/`, `packages/db/`, `packages/config/`, `packages/contracts/` and `db/`. These were merged by Satvik before the swap. B/Satvik owns future `apps/web/` and public presentation, plus the agreed reporting/content/testing modules above. Shared contracts are cross-reviewed. Earlier path proposals remain architectural guidance, not instructions to recreate existing modules.\n'
        put('docs/project/'+name,s)
    p=ROOT/'docs/project/governance.md'; s=p.read_text(encoding='utf-8').replace('Developer A (`satvikp-coder`)','Developer A (`varunkarthic`)').replace('Developer B uses','Developer B (`satvikp-coder`) uses').replace('| Developer B GitHub assignment | Pending invitation acceptance; work reserved by `owner:developer-b` labels |','| Developer A GitHub assignment | Varun may await invitation acceptance; core work reserved by `owner:developer-a`; public B tasks are assigned to Satvik |')
    put('docs/project/governance.md',s)
    p=ROOT/'docs/project/CLAUDE_DEVELOPER_A_PROGRESS.md'
    if p.exists():
        s=p.read_text(encoding='utf-8')
        if 'PRE-SWAP HISTORICAL IMPLEMENTATION RECORD' not in s: s=s.replace('\n\n','\n\n**PRE-SWAP HISTORICAL IMPLEMENTATION RECORD — Satvik.** Existing PRs, merge SHAs and results below retain their actual attribution. Varun is now Developer A/current core maintainer and owns all remaining follow-up; Satvik is Developer B. Use DEVELOPER_A_GUIDE.md and ownership-swap-map.json for the current queue.\n\n',1)
        put('docs/project/CLAUDE_DEVELOPER_A_PROGRESS.md',s)
    p=ROOT/'docs/project/claude-developer-a-progress.json'
    if p.exists():
        s=json.loads(p.read_text(encoding='utf-8')); s.update(record_type='pre-swap historical implementation ledger',historical_implementer='satvikp-coder',current_core_maintainer='varunkarthic',active_ownership_source='docs/project/developer-issue-allocation.json'); save(p,s)
    for name in ['allocation-progress.json','setup-progress.json']:
        p=ROOT/'docs/project'/name
        if p.exists():
            s=json.loads(p.read_text(encoding='utf-8')); s['current_ownership_mapping']=NEW; s['current_ownership_record']='docs/project/ownership-swap-map.json'; s['previous_assignment_notes']='Historical checkpoint; superseded by the frozen ownership swap for open work.'
            if name=='setup-progress.json' and 'two_developer_allocation' in s:
                s['two_developer_allocation'].update(developer_a='varunkarthic',developer_b='satvikp-coder',b_assignees='satvikp-coder; no longer reserved for Varun')
            if name=='allocation-progress.json':
                s['record_type']='historical initial allocation checkpoint; current swap status is ownership-swap-progress.json'
                pending=sum(t.get('pending_access',False) for t in json.loads(MAP.read_text(encoding='utf-8'))['records'])
                s['pending_assignments']={'developer_a':pending,'reason':'Varun assignments await eligibility where pending; B public tasks now belong to Satvik'}
            save(p,s)
    human=ROOT/'docs/project/human-action-required.json'
    if human.exists():
        s=json.loads(human.read_text(encoding='utf-8')); by={r['number']:r for r in json.loads(ALLOC.read_text(encoding='utf-8'))['issues']}
        for t in s['tasks']:
            t['required_human_approver']=t.get('required_human_approver',t['owner'])
            t['current_implementation_owners']={str(n):NEW[by[n]['owner']] for n in t['issues'] if n in by}
            t['actual_approval_status']='No new approval established by ownership swap; existing human-action record remains pending.'
        s['current_ownership_mapping']=NEW; save(human,s)
        p=ROOT/'docs/project/HUMAN_ACTION_REQUIRED.md'; text=p.read_text(encoding='utf-8').replace('### H5. Work only Developer B can do (my friend)','### H5. Developer B public/UX deliverables — Satvik').replace('Developer B now has these unblocked','Satvik (Developer B) now has these unblocked')
        text=re.sub(r'State of the software \(checked against GitHub\):.*?(?=\n\n)', 'State at the ownership snapshot: #1, #9, #10, #22, #36 and #39 are closed. #6, #32, #33, #34, #35 and #40 have merged artifacts but remain open for approval, provider, UI/integration or final acceptance. Varun inherits their remaining core follow-up; Satvik keeps credit for the merged work.',text,flags=re.S)
        addition='## Current implementation owners versus human approvers\n\n'+banner+'Changing implementation ownership does not grant ethics, stakeholder, consent, publication, spending or account authority. Approval facts/evidence below are preserved and no pending approval is marked complete.\n\n| Item | Current implementation owner(s) | Required human approver | Actual approval status / evidence | Next action |\n|---|---|---|---|---|\n'
        addition+='\n'.join('| '+t['id']+' | '+', '.join('#'+n+': '+u for n,u in t['current_implementation_owners'].items())+' | '+t['required_human_approver']+' | Pending in existing register; '+t['evidence']+' | '+t['next_claude_action']+' |' for t in s['tasks'])
        addition+='\n\n### GitHub collaborator acceptance — Varun (A)\nVarun must sign into **varunkarthic**, open the existing repository invitation from GitHub notifications/email or the repository invitation page, and accept **write** access. Satvik cannot accept on his behalf. The owner can inspect Settings → Collaborators to confirm acceptance; do not grant admin or send a duplicate invitation. Then check `gh api repos/satvikp-coder/makarba-360/assignees/varunkarthic --include` (expected HTTP 204) and rerun `python scripts/swap_ownership.py resume`. It uses the frozen role mapping and will not reverse the swap. No human research approval is implied by GitHub access.\n\n'
        marker='<!-- ownership-swap-human-map -->'
        if marker in text: text=text[:text.index(marker)]
        put('docs/project/HUMAN_ACTION_REQUIRED.md',text+'\n'+marker+'\n'+addition)

def apply():
    if not SNAP.exists() or not MAP.exists(): raise RuntimeError('Freeze snapshot and prepare mapping first')
    snap=json.loads(SNAP.read_text(encoding='utf-8')); mapping=json.loads(MAP.read_text(encoding='utf-8')); state=json.loads(STATE.read_text(encoding='utf-8')); allocation=json.loads(ALLOC.read_text(encoding='utf-8')); by={r['number']:r for r in allocation['issues']}; original={x['number']:x for x in snap['issues']}
    repo=api('repos/'+REPO)
    if api('user')['login']!='satvikp-coder' or repo['owner']['login']!='satvikp-coder': raise RuntimeError('Unexpected identity')
    access=elig('varunkarthic'); state.update(stage='Applying issue ownership before planning PR merge with frozen resumable state',varun_eligibility=access); save(STATE,state)
    for role,user in NEW.items():
        api(f'repos/{REPO}/labels/owner%3Adeveloper-{role.lower()}',dict(description=f'Role {role}: {user}; '+('core-platform maintenance' if role=='A' else 'public-experience implementation')),method='PATCH')
    for i,t in enumerate(mapping['records']):
        if t['complete']: continue
        n=t['number']; x=api(f'repos/{REPO}/issues/{n}'); old=original[n]; r=by[n]
        if x['state']!='open': raise RuntimeError('Issue completed concurrently; preserve it and reconcile snapshot before further updates #'+str(n))
        if {l['name'] for l in x['labels']}!={l['name'] for l in old['labels']} or x['milestone']['number']!=t['milestone']: raise RuntimeError('Concurrent technical label/milestone change #'+str(n))
        start='<!-- two-developer-allocation:start -->'; end='<!-- two-developer-allocation:end -->'
        def outside(body): return body.split(start)[0]+body.split(end,1)[1]
        if outside(x['body'])!=outside(old['body']): raise RuntimeError('Concurrent technical body change #'+str(n))
        assigned=[a['login'] for a in x['assignees']]
        if any(u not in NEW.values() for u in assigned): raise RuntimeError('Unrelated co-assignee requires review #'+str(n))
        pending=t['role']=='A' and not access['eligible']; desired=[] if pending else [NEW[t['role']]]
        body=ownership_body(old['body'],t['role'],NEW[t['role']],pending)
        payload={}
        if assigned!=desired: payload['assignees']=desired
        if x['body']!=body: payload['body']=body
        try: result=api(f'repos/{REPO}/issues/{n}',payload,method='PATCH') if payload else x
        except RuntimeError as e:
            state['errors'].append(dict(number=n,error=str(e))); save(STATE,state); raise
        actual=[a['login'] for a in result['assignees']]
        if actual!=desired: raise RuntimeError('GitHub did not apply requested assignees #'+str(n))
        t.update(actual_verified_assignees=actual,pending_access=pending,expected_actual_assignees=desired,verification_status='pending collaborator acceptance; obsolete assignee removed and verified' if pending else 'assigned and verified',verified_at=now(),desired_body_sha256=sha(body))
        r.update(actual_assignees=actual,github_assignment_status='pending invitation acceptance; intended varunkarthic; obsolete Satvik assignee removed and verified' if pending else 'assigned to '+NEW[t['role']]+'; verified by issue API',body_sha256=sha(body))
        put('docs/project/issues/'+r['catalog_id']+'.md',body)
        state['applied']=sorted(set(state['applied']+[n])); save(MAP,mapping); save(ALLOC,allocation); save(STATE,state)
        print(f"#{n}: {t['role']} → {NEW[t['role']]} / actual {actual}" ,flush=True)
        if len(state['applied'])%20==0:
            fresh={x['number']:x for x in pages(f'repos/{REPO}/issues?state=all&sort=created&direction=asc') if 'pull_request' not in x}
            for check in mapping['records']:
                if check['number'] in state['applied'] and [a['login'] for a in fresh[check['number']]['assignees']]!=check['actual_verified_assignees']: raise RuntimeError('Batch verification mismatch')
    state.update(stage='All frozen open issues processed; independent verification and planning PR pending',pending=[t['number'] for t in mapping['records'] if t.get('pending_access')],updated_at=now()); save(STATE,state); render()

def resume_batches():
    """Resume only unverified/changed targets; bounded independent issue writes."""
    import threading,time
    from concurrent.futures import ThreadPoolExecutor
    snap=json.loads(SNAP.read_text(encoding='utf-8')); mapping=json.loads(MAP.read_text(encoding='utf-8')); allocation=json.loads(ALLOC.read_text(encoding='utf-8')); state=json.loads(STATE.read_text(encoding='utf-8'))
    if api('user')['login']!='satvikp-coder' or api('repos/'+REPO)['owner']['login']!='satvikp-coder': raise RuntimeError('Wrong account/repository')
    access=elig('varunkarthic'); by={r['number']:r for r in allocation['issues']}; original={x['number']:x for x in snap['issues']}; lock=threading.Lock(); rate=threading.Lock(); last=[0.0]
    def expected(t): return [] if t['role']=='A' and not access['eligible'] else [NEW[t['role']]]
    todo=[t for t in mapping['records'] if not t['complete'] and (t['number'] not in state['applied'] or t.get('actual_verified_assignees')!=expected(t) or t.get('desired_body_sha256')!=sha(ownership_body(original[t['number']]['body'],t['role'],NEW[t['role']],t['role']=='A' and not access['eligible'])))]
    state.update(stage='Resuming frozen targets in bounded batches; no second swap',varun_eligibility=access); save(STATE,state)
    def worker(t):
        n=t['number']; r=by[n]; x=api(f'repos/{REPO}/issues/{n}'); old=original[n]
        if x['state']!='open': raise RuntimeError('Concurrent completion; preserve and reconcile #'+str(n))
        if {l['name'] for l in x['labels']}!={l['name'] for l in old['labels']} or x['milestone']['number']!=t['milestone']: raise RuntimeError('Concurrent technical metadata change #'+str(n))
        a='<!-- two-developer-allocation:start -->'; b='<!-- two-developer-allocation:end -->'
        if x['body'].split(a)[0]+x['body'].split(b,1)[1]!=old['body'].split(a)[0]+old['body'].split(b,1)[1]: raise RuntimeError('Concurrent technical body change')
        assigned=[u['login'] for u in x['assignees']]
        if any(u not in NEW.values() for u in assigned): raise RuntimeError('Unrelated co-assignee #'+str(n))
        desired=expected(t); pending=t['role']=='A' and not access['eligible']; body=ownership_body(old['body'],t['role'],NEW[t['role']],pending); payload={}
        if assigned!=desired: payload['assignees']=desired
        if body!=x['body']: payload['body']=body
        if payload:
            with rate:
                delay=max(0,1.05-(time.monotonic()-last[0]))
                if delay: time.sleep(delay)
                last[0]=time.monotonic()
            result=api(f'repos/{REPO}/issues/{n}',payload,method='PATCH')
        else: result=x
        actual=[u['login'] for u in result['assignees']]
        if actual!=desired: raise RuntimeError('Assignee not applied #'+str(n))
        with lock:
            t.update(actual_verified_assignees=actual,pending_access=pending,expected_actual_assignees=desired,verification_status='pending collaborator acceptance; obsolete assignee removed and verified' if pending else 'assigned and verified',verified_at=now(),desired_body_sha256=sha(body))
            r.update(actual_assignees=actual,github_assignment_status='pending invitation acceptance; intended varunkarthic; obsolete Satvik assignee removed and verified' if pending else 'assigned to '+NEW[t['role']]+'; verified by issue API',body_sha256=sha(body))
            put('docs/project/issues/'+r['catalog_id']+'.md',body); r['body_sha256']=sha((ROOT/'docs/project/issues'/f"{r['catalog_id']}.md").read_text(encoding='utf-8')); state['applied']=sorted(set(state['applied']+[n])); save(MAP,mapping); save(ALLOC,allocation); save(STATE,state)
        print(f'Verified #{n}: {NEW[t["role"]]} / actual {actual}',flush=True)
    for offset in range(0,len(todo),20):
        batch=todo[offset:offset+20]
        with ThreadPoolExecutor(max_workers=3) as executor: list(executor.map(worker,batch))
        fresh={x['number']:x for x in pages(f'repos/{REPO}/issues?state=all&sort=created&direction=asc') if 'pull_request' not in x}
        for t in batch:
            if [u['login'] for u in fresh[t['number']]['assignees']]!=expected(t): raise RuntimeError('Batch assignee mismatch')
        print('Batch read-back passed: '+str(len(batch)),flush=True)
    fresh={x['number']:x for x in pages(f'repos/{REPO}/issues?state=all&sort=created&direction=asc') if 'pull_request' not in x}
    for t in mapping['records']:
        x=fresh[t['number']]
        if t['complete']:
            old=original[t['number']]
            if x['state']!=old['state'] or x['body']!=old['body'] or [u['login'] for u in x['assignees']]!=t['old_assignees']: raise RuntimeError('Historical record changed')
            t['actual_verified_assignees']=t['old_assignees']; t['verification_status']='closed history unchanged and verified'
        t.update(new_owner=t['new_intended_assignee'] if not t['complete'] else t['old_owner'],actual_verified_assignee=next(iter(t['actual_verified_assignees'] or []),None),transfer_status=t['verification_status'])
    save(MAP,mapping); save(ALLOC,allocation)
    state.update(stage='All frozen open issues processed and batch verified; final independent audit/PR pending',pending=[t['number'] for t in mapping['records'] if t.get('pending_access')],updated_at=now()); save(STATE,state); render()

if __name__=='__main__':
    if hasattr(sys.stdout,'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
    action=sys.argv[1] if len(sys.argv)>1 else ''
    if action=='snapshot': snapshot()
    elif action=='prepare': prepare()
    elif action=='render': render()
    elif action=='apply': apply()
    elif action=='resume': resume_batches()
    else: raise SystemExit('Usage: swap_ownership.py snapshot|prepare|render|apply')
