"""Auditable two-developer planning. No product implementation or silent reassignment."""
from pathlib import Path
import json, re, sys, hashlib, csv, io, collections, subprocess
from datetime import datetime, timezone
from publish_github import ROOT, REPO, api, pages, gh, save

BASE=ROOT/'docs/project/allocation-baseline.json'
PLAN=ROOT/'docs/project/developer-issue-allocation.json'
PROGRESS=ROOT/'docs/project/allocation-progress.json'
def now(): return datetime.now(timezone.utc).isoformat()
def put(path,text):
    p=ROOT/path; p.parent.mkdir(parents=True,exist_ok=True); p.write_text(text.rstrip()+'\n',encoding='utf-8')
def git(*args): return subprocess.check_output(['git',*args],cwd=ROOT,text=True,encoding='utf-8').strip()
def digest(s): return hashlib.sha256(s.encode()).hexdigest()

def audit():
    if BASE.exists():
        print('Baseline exists; preserving original audit.'); return
    repo=api('repos/'+REPO); viewer=api('user')['login']
    if viewer!='satvikp-coder' or repo['owner']['login']!='satvikp-coder': raise RuntimeError('Unexpected owner or authenticated identity')
    raw=pages(f'repos/{REPO}/issues?state=all&sort=created&direction=asc')
    issues=[x for x in raw if 'pull_request' not in x]
    milestones=pages(f'repos/{REPO}/milestones?state=all')
    prs=pages(f'repos/{REPO}/pulls?state=all')
    labels=pages(f'repos/{REPO}/labels')
    collaborators=pages(f'repos/{REPO}/collaborators?affiliation=all')
    branches=pages(f'repos/{REPO}/branches')
    try: protection=api(f"repos/{REPO}/branches/{repo['default_branch']}/protection")
    except RuntimeError as e: protection={'unavailable':str(e)}
    try: projects=gh('api','graphql','-f','query=query { viewer { projectsV2(first: 100) { nodes { id title url } pageInfo { hasNextPage endCursor } } } }')
    except RuntimeError as e: projects={'unavailable':str(e)}
    # Read connected/cross-referenced PR events, including closed issues, not just current PR bodies.
    timelines={}; cursor=None
    while True:
        after=', after: '+json.dumps(cursor) if cursor else ''
        query='''query { repository(owner:"satvikp-coder",name:"makarba-360") { issues(first:100%s,orderBy:{field:CREATED_AT,direction:ASC}) { nodes { number timelineItems(first:100,itemTypes:[CONNECTED_EVENT,CROSS_REFERENCED_EVENT,CLOSED_EVENT]) { nodes { __typename ... on ConnectedEvent { subject { __typename ... on PullRequest { number url state merged repository { nameWithOwner } } } } ... on CrossReferencedEvent { source { __typename ... on PullRequest { number url state merged repository { nameWithOwner } } } } ... on ClosedEvent { closer { __typename ... on PullRequest { number url state merged repository { nameWithOwner } } } } } pageInfo { hasNextPage endCursor } } } pageInfo { hasNextPage endCursor } } } }'''%after
        data=gh('api','graphql','-f','query='+query)['data']['repository']['issues']
        for x in data['nodes']:
            if x['timelineItems']['pageInfo']['hasNextPage']: raise RuntimeError('Timeline pagination required for '+str(x['number']))
            timelines[str(x['number'])]=x['timelineItems']['nodes']
        if not data['pageInfo']['hasNextPage']: break
        cursor=data['pageInfo']['endCursor']
    docs=[]
    for p in sorted((ROOT/'docs').rglob('*.md')):
        docs.append(dict(path=p.relative_to(ROOT).as_posix(),sha256=digest(p.read_text(encoding='utf-8'))))
    state=dict(audited_at=now(),repository=repo,authenticated_user=viewer,local_commit=git('rev-parse','HEAD'),remote_commit=api(f'repos/{REPO}/commits/main')['sha'],local_status=git('status','--porcelain'),branches=branches,protection=protection,projects=projects,collaborators=collaborators,milestones=milestones,labels=labels,issues=issues,pull_requests=prs,linked_pr_events=timelines,document_inventory=docs)
    save(BASE,state)
    save(PROGRESS,dict(repository=REPO,baseline_commit=state['local_commit'],stage='audit complete; no GitHub allocation mutations yet',friend_username=None,friend_assignment='pending verified username',updated_issues=[],limitations=['Developer B is a placeholder; use reserved-owner labels, not invented GitHub assignees']))
    print(json.dumps(dict(issues=len(issues),states=dict(collections.Counter(x['state'] for x in issues)),milestones=len(milestones),pull_requests=len(prs),existing_assignees={str(x['number']):[a['login'] for a in x['assignees']] for x in issues if x['assignees']},collaborators=[x['login'] for x in collaborators],linked_pr_events=sum(len(x) for x in timelines.values()),documents=len(docs),protected=branches,projects=projects),ensure_ascii=False,indent=2))

POINTS=list(map(int,'''1 1 1 3 3 3 1 3 3 8 3 3 3 1 3 3 3 3 3 3 5 5 3 3 5 3 5 5 5 5 5 5 3 5 5 5 5 5 3 3 8 5 5 3 3 3 3 5 5 5 5 5 3 8 8 5 8 8 5 8 5 8 3 5 5 3 3 5 5 3 5 3 3 5 3 3 5 3 3 5 8 5 3 8 3 5 3 5 5 8 5 8 5 5 3 5 8 3 5 5 5 5 8 5 8 3 5 5 5 5 5 8 8 5 8 5 8 3 5 5 5 3 3 8 5 5 3 5 5 8 5 8 8 8 5 8'''.split()))
A=set([1,3,6,7,8,9,10,11,22,23,26,27,30,32,33,34,35,36,37,38,39,40,*range(42,61),81,84,90,92,95,96,97,98,99,100,103,105,107,109,110,111,112,116,121,122,125,136])
POINTS[19]=5  # Full bilingual, consent/GPS/offline form design has additional review burden.
A.add(4)      # Research methodology and private eligibility remain in the core boundary.
A.remove(54)  # Independent offline feasibility validation is B-owned, A privacy-signoff required.
FOUNDATION={1,6,9,10}
INTEGRATION={62,81,90,93,99,100,101,102,103,104,105,107,109,110,112,113,115,116,117,118,119,120,121,122,123,124,125,126,127}
# Explicit reviewed edge changes. Original prerequisites remain in one of the four
# categories; no privacy or publication gate is deleted to make UI seem ready.
CHANGES={
 5:dict(hard=[],soft=[4],why='Verified boundary-source desk research can start independently of questionnaire methodology; actual boundary publication still requires spatial verification.'),
 6:dict(hard=[1],soft=[3],why='Review existing scoped-role baseline after governance; final vision review remains advisory to synthetic contract drafting.'),
 9:dict(hard=[1,6],soft=[8],why='The existing architecture/NFR documents support a bounded contract review; full NFR signoff is not needed to draft mock DTOs.'),
 12:dict(hard=[],soft=[3],why='Visual tokens and contrast work can start immediately from the existing approved planning baseline without backend access.'),
 13:dict(hard=[12],soft=[7],why='Information architecture can use existing requirement IDs; final requirement review is a design review input, not a backend build blocker.'),
 19:dict(hard=[13],soft=[4],why='Design chart empty/suppressed states from the documented metric contract; methodology signoff still gates real findings.'),
 20:dict(hard=[12],integration=[6],why='Draft accessible field screens with synthetic roles; role behavior must conform at field integration.'),
 21:dict(hard=[12],integration=[6],why='Draft admin interactions against scoped-role fixtures; live actions remain authenticated and subject to capability enforcement.'),
 24:dict(hard=[],soft=[9],why='Licence/provider comparison is independent desk research; do not activate a paid service.'),
 25:dict(hard=[10,15,24],integration=[23],why='Render synthetic GeoJSON using the shared fixture contract; verified real boundary is a live-data integration requirement.'),
 28:dict(hard=[5,24],integration=[23,27],why='Stage and validate licensed road files without DB access; persisted/published roads require verified PostGIS integration.'),
 29:dict(hard=[10,25],integration=[27],why='Build public search/clustering adapter with fixtures; A owns spatial schema and provides indexed query/grant review before live search.'),
 31:dict(hard=[10],integration=[27,35],why='B owns non-sensitive GeoJSON validators and safe exchange tooling; DB writes and privileged routes require A geospatial/auth integration.'),
 37:dict(hard=[35],operational=[11],why='Consent schema can be implemented and tested synthetically; real participant recording remains prohibited until institutional approval.'),
 41:dict(hard=[10,6],integration=[38,39,40],why='B can author synthetic abuse cases and negative contract tests independently; actual security acceptance must execute against A private endpoints and redacted audit/config services.'),
 49:dict(hard=[48],integration=[25],why='GPS quality rules and provenance can use a mock map; shared map rendering is checked during field integration.'),
 50:dict(hard=[42,27],integration=[49],why='The independent-position/subject schema should not wait for GPS display code; integration must verify actual corrected fix provenance.'),
 54:dict(hard=[9,10],integration=[20],operational=[11],why='Synthetic device/storage feasibility starts before ethics approval; real-data collection and final field usability remain gated.'),
 60:dict(hard=[40,38],integration=[57],why='Quarantined upload service is independently testable; attachment sync and retries must integrate with the idempotent operation service.'),
 61:dict(hard=[10],integration=[60,37],why='Implement metadata/rights models and derivative checks with synthetic media; publication requires actual upload quarantine and consent integration.'),
 62:dict(hard=[10,54],integration=[58,59,61],why='Prepare network/device-loss fault harness independently; execute recovery acceptance against the real field components before field readiness.'),
 63:dict(hard=[10],integration=[27],why='B owns isolated content models and migration files against shared location IDs; A reviews schema/foreign-key integration.'),
 64:dict(hard=[63],integration=[35],why='Editorial workflow can use role mocks; server authorization must be enforced in live review.'),
 65:dict(hard=[63],soft=[4],why='Citation/date/rights source models can use the existing evidence rubric; final methodology review remains an evidence/publication review input.'),
 67:dict(hard=[65],integration=[61],why='Comparison schema can use dated synthetic media; actual published pairs require approved media permissions.'),
 68:dict(hard=[10,18],integration=[67],why='Accessible comparison component consumes frozen pair fixtures; connect validated pair models during evidence integration.'),
 69:dict(hard=[10,17],integration=[61],why='Owned panorama viewer can use permitted synthetic test assets; public derivatives still require rights and metadata approval.'),
 70:dict(hard=[24],soft=[9],why='Official provider feasibility research can proceed from the baseline ADR without waiting for code or activating billing.'),
 71:dict(hard=[64,66],integration=[37],why='Stories and evidence labeling can use synthetic accounts; real quote/attribution publication requires current scoped consent.'),
 73:dict(hard=[72,14],integration=[81],why='Home UI is contract-driven and testable against mocks; live approved content is wired through the public projection only.'),
 74:dict(hard=[25,72],integration=[81],why='Map explorer renders synthetic public fixtures before production read API completion.'),
 75:dict(hard=[74],integration=[26],why='Category enum fixtures support UI controls; final taxonomy compatibility is checked against the shared contract.'),
 76:dict(hard=[29,74],integration=[81],why='Search cancellation and empty states can be tested with a mock route; live endpoint contract remains a release integration gate.'),
 77:dict(hard=[72,17],integration=[81,64],why='Profile components consume public DTO fixtures; real editorial state and read API must pass live integration.'),
 78:dict(hard=[77],integration=[61],why='Gallery tests use safe derivative fixtures; do not expose or depend on originals.'),
 79:dict(hard=[69,77],integration=[70],why='Owned panorama/static fallbacks are independent of optional third-party provider feasibility; external integration stays disabled pending decision.'),
 80:dict(hard=[68,77],integration=[71],why='Public history/voices composition uses reviewed-shape fixtures; real attributed content requires story approval.'),
 81:dict(hard=[10,36,38],integration=[103,92],why='A can implement a fail-closed read-only API over synthetic approved projection rows early; live publication must wait for approval and disclosure services.'),
 83:dict(hard=[72,13],integration=[4],why='Build methodology/source templates from current docs; publication needs final reviewed methodology.'),
 84:dict(hard=[43,37],integration=[99],why='Private eligible-record aggregation can be tested with synthetic review-state fixtures; real inputs require actual moderation eligibility.'),
 85:dict(hard=[10],integration=[84],why='B implements reporting over A-produced approved aggregate cubes, never raw interview rows or unrestricted private DB credentials.'),
 86:dict(hard=[10],integration=[84,51],why='B owns codebook/reporting transformations over approved counts; private answer coding/execution and eligibility remain in A aggregation boundary.'),
 87:dict(hard=[10],integration=[84],why='B develops rating/change views against safe count cubes; A computes private valid-answer bases and exclusions.'),
 88:dict(hard=[10,19,85,87],integration=[92],why='Chart/table interactions use disclosure-shaped mocks; live cohorts must carry A policy decisions.'),
 89:dict(hard=[10],integration=[84,50,92],why='B formats safe subject-place summaries from distinct-count cubes; A owns private subject linking and disclosure decisions.'),
 91:dict(hard=[85,86,87],integration=[92],why='Build allowlisted filter UI/reporting handlers with fixed cohorts; no arbitrary raw-data query service.'),
 93:dict(hard=[10,106],integration=[85,86,87,90,91,88,84,92],why='B authors independent expected-count fixtures early; acceptance reruns against actual A aggregation/disclosure and B chart/reporting integrations.'),
 94:dict(hard=[10,21],integration=[35],why='B builds the admin shell and role-sensitive UI with test identities; A retains auth grants and raw API access policy.'),
 95:dict(hard=[10,33],integration=[94],why='A can implement invitation/grant administration behind scoped service contracts before final admin shell wiring.'),
 98:dict(hard=[44],integration=[94],why='Visit progress query/status semantics are independent of admin-shell rendering.'),
 99:dict(hard=[51,39],integration=[94],why='Review state-machine/API tests precede dashboard wiring; no public eligibility until moderation is actually integrated.'),
 101:dict(hard=[10],integration=[94,30],why='B implements candidate approval tools using public-geometry/synthetic role fixtures; live decisions must use A privileged API enforcement.'),
 102:dict(hard=[10,65],integration=[94,61],why='B develops evidence/rights review tools; publication still requires actual media/consent eligibility.'),
 103:dict(hard=[99,39],integration=[101,102],why='A implements atomic publication/revocation and current-revision checks independently; real publication waits for both review integrations.'),
 104:dict(hard=[10,9],integration=[99,92,31,81],why='B owns safe report/export jobs over approved public projection only; A reviews grants, purpose checks and suppression, with no raw GPS export.'),
 107:dict(hard=[10,106],integration=[57,81],why='Write provider contract/integration tests before APIs finish; full evidence requires actual sync and public endpoints.'),
 108:dict(hard=[10,106],integration=[31],why='B owns independent non-sensitive spatial/migration fixtures; A owns base migrations and fixes, B verifies them without raw records.'),
 109:dict(hard=[106,32],integration=[107,41],why='Start authorization negatives once identity contracts exist; full adversarial evidence incorporates API integration and threat cases.'),
 110:dict(hard=[10,106],integration=[107,103,104,81,92],why='Write forbidden-field/grant tests early; public-release acceptance needs real publication, exports and disclosure services.'),
 111:dict(hard=[10,106],integration=[50],why='GPS adapter edge fixtures can precede implementation; execute the suite against independent position/subject storage before pilot.'),
 112:dict(hard=[54,106],integration=[62,107],why='Fault injection scenarios can be prepared independently; runtime evidence requires working recovery and API transactions.'),
 113:dict(hard=[72,106],integration=[82,105,93,112,78,79,80,88],why='Author browser journeys against mocks; actual end-to-end acceptance connects the approved public/field/review services incrementally.'),
 114:dict(hard=[12,72],integration=[82,94,20],why='B starts accessible component/keyboard checks early; final manual audit includes actual public, field and admin journeys.'),
 115:dict(hard=[10,106],integration=[109,110,113,114],why='B prepares CI/performance/security gates early; enforce only named available checks and retain full evidence for release.'),
 117:dict(hard=[10,54],integration=[111,112,114],why='Device matrix and suspension/quota harness can be prepared early; full cross-device evidence needs working field/public screens.'),
 118:dict(hard=[4,20],integration=[11,53,62],why='B prepares synthetic training/checklists without raw access; field clearance requires approved scripts and verified field save/recovery.'),
 119:dict(hard=[11,118,109,62,111,112],soft=[117],why='A limited consent-approved field pilot needs field-specific GPS/recovery/security evidence, not the entire public-site device audit; full device matrix gates final launch.'),
 120:dict(hard=[28,101],integration=[23,81,74,76,77],why='Incremental live map integration verifies approved source geometry through read API and public views rather than deferring all integration to launch.'),
 123:dict(hard=[102,68,69],integration=[67,79,80],why='Incremental evidence/media integration audits real dates, rights, viewer fallbacks and public credit presentation.'),
 124:dict(hard=[9,40],integration=[108],why='B prepares deployment manifests/runbooks and synthetic staging; production migration deployment waits for spatial/grant verification and owner approvals.'),
 126:dict(hard=[125,115,116,120,117,110,123],why='Final release explicitly retains full cross-device, disclosure/exposure and historical evidence gates, including the public checks removed from the early field pilot.')
}

def section(body,name):
    body=body.split('<!-- two-developer-allocation:start -->')[0]
    m=re.search(r'^### '+re.escape(name)+r'\n(.*?)(?=\n### |\Z)',body,re.S|re.M)
    if not m: raise ValueError('Missing section '+name)
    return m[1].strip()
def topo(rows,production=False):
    by={r['number']:r for r in rows}; done=[]; layers=[]
    while len(done)<len(rows):
        layer=[r['number'] for r in rows if r['number'] not in done and set(r['hard_dependencies']+(r['integration_dependencies'] if production else []))<=set(done)]
        if not layer: raise ValueError('Dependency cycle or unknown issue: '+str([n for n in by if n not in done]))
        layer.sort(key=lambda n:({'foundation':0,'parallel':1,'integration':2}[by[n]['phase']],0 if n==12 else 1,int(by[n]['priority'][1]),n))
        done.append(layer[0]); layers.append(layer)
    return done,layers
def plan():
    base=json.loads(BASE.read_text(encoding='utf-8')); rows=[]
    friend=api('users/varunkarthic')
    if friend['login'].lower()!='varunkarthic' or friend['type']!='User': raise RuntimeError('Unverified friend identity')
    eligible=True
    try: api(f'repos/{REPO}/assignees/varunkarthic')
    except RuntimeError as e:
        if '404' not in str(e): raise
        eligible=False
    for i in base['issues']:
        if i['state']!='open': continue
        n=i['number']; original=sorted(set(map(int,re.findall(r'#(\d+)',section(i['body'],'Dependencies')))))
        ch=CHANGES.get(n,{})
        deps=dict(hard_dependencies=ch.get('hard',original),integration_dependencies=ch.get('integration',[]),soft_dependencies=ch.get('soft',[]),operational_dependencies=ch.get('operational',[]))
        if not set(original)<=set(sum(deps.values(),[])): raise ValueError('Lost original dependency '+str(n))
        owner='A' if n in A else 'B'; points=POINTS[n-1]; size={1:'S',3:'M',5:'L',8:'XL'}[points]
        priority=section(i['body'],'Priority').split(' ')[0]
        phase='foundation' if n in FOUNDATION else 'integration' if n in INTEGRATION else 'parallel'
        m=i['milestone']['number']-1
        base_wave={0:0,1:0,2:1,3:1,4:2,5:3,6:3,7:2,8:4,9:3,10:4,11:5,12:6}[m]
        early={24:0,25:1,54:1,63:1,65:2,70:1,72:1,73:1,77:2,81:2,84:3,85:2,86:2,87:2,88:3,89:2,91:3,94:1,95:2,98:2,106:1,108:2,111:2,114:2,115:1,117:3,118:3,124:3}
        if n in FOUNDATION: base_wave=0
        else: base_wave=early.get(n,base_wave)
        original_assignees=[a['login'] for a in i['assignees']]
        conflicts=[u for u in original_assignees if u not in ['satvikp-coder','varunkarthic']]
        required=['location','map','insights','history','media'] if n==10 else ['location','map'] if m==2 or n in [74,75,76,120] else ['insights'] if m==8 else ['history','media'] if m==6 or n in [78,79,80,102,123] else ['media'] if n in [60,61,62] else ['field-private'] if m in [3,4,5,9] else ['location','map','insights','history','media'] if m in [7,10,11] else ['baseline']
        steps=section(i['body'],'Technical approach').split('. Follow ')[0].rstrip('.')
        r=dict(number=n,url=i['html_url'],catalog_id=re.search(r'makarba-catalog-id:([\d.]+)',i['body'])[1],title=i['title'],owner=owner,github_user='satvikp-coder' if owner=='A' else 'varunkarthic',workstream='core-platform' if owner=='A' else 'public-experience',milestone=i['milestone']['title'],milestone_number=i['milestone']['number'],priority=priority,size=size,points=points,phase=phase,base_sprint=base_wave,status=i['state'],original_dependencies=original,original_assignees=original_assignees,assignment_conflicts=conflicts,github_assignment_status='pending apply' if owner=='A' else 'pending invitation acceptance; user requested leave assignee unchanged',friend_eligible=eligible,expected_output=section(i['body'],'Summary'),implementation_note=steps,estimate_reason=steps+f'; includes scoped implementation/review, negative tests and integration evidence ({size}, {points} points).',estimation_factors={1:[0,0,1,0],3:[1,0,1,1],5:[2,1,1,1],8:[2,2,2,2]}[points],required_contracts=required,dependency_change_reason=ch.get('why','Original prerequisites retained; no contract-first relaxation needed.'),operational_gate='Real participants require #11; real maps/evidence require verification and permission; no public survey or raw GPS publication.',**deps)
        rows.append(r)
    order,layers=topo(rows); topo(rows,True); by={r['number']:r for r in rows}; counters=collections.Counter()
    for rank,n in enumerate(order,1):
        r=by[n]; counters[r['owner']]+=1; r['global_order']=rank; r['owner_order']=counters[r['owner']]
        r['sprint']=max([r['base_sprint']]+[by[d]['sprint'] for d in r['hard_dependencies']])
        r['ready_to_start']=not any(by[d]['status']=='open' for d in r['hard_dependencies'])
        cross=[d for d in r['hard_dependencies']+r['integration_dependencies'] if by[d]['owner']!=r['owner']]
        consumers=[x['number'] for x in rows if n in x['hard_dependencies']+x['integration_dependencies'] and x['owner']!=r['owner']]
        r['integration_partner']='B (varunkarthic), pending collaboration acceptance' if r['owner']=='A' else 'A (satvikp-coder)'
        r['handoff_required']=bool(cross or consumers or n in FOUNDATION)
        r['required_handoff']=('Publish versioned DTO/schema/fixtures and conformance evidence; review cross-stream providers '+', '.join('#'+str(d) for d in sorted(set(cross)))+'; consumers '+', '.join('#'+str(d) for d in consumers)) if r['handoff_required'] else 'Same-stream implementation; include ordinary PR verification and documentation.'
        r['cross_stream_hard_dependencies']=[d for d in r['hard_dependencies'] if by[d]['owner']!=r['owner']]
        r['review_requirement']='Cross-review public/private interface, schema or grants before integration; never grant unrestricted raw access for UI/reporting work.' if r['handoff_required'] else 'Normal scoped review and relevant tests.'
        r['close_policy']='Hard prerequisites must be evidenced. Mock-backed local components may be accepted with conformance tests; listed live integrations must pass their named gates before production claims. Integration issues require their runtime integration dependencies before final acceptance.'
        if n==119: r['close_policy']='Real field pilot requires all hard field-specific, institutional and training gates. Full public/field device audit #117 remains a final launch blocker #126, not permission to bypass field-device testing.'
    save(PLAN,dict(schema_version=1,repository=REPO,baseline_commit=base['local_commit'],created_at=now(),developers={'A':'satvikp-coder','B':'varunkarthic'},friend_assignment_policy='Leave B assignees unchanged as explicitly requested while invitation is unaccepted; reserve B using labels.',issues=rows))
    print(json.dumps(stats(rows),indent=2))

def stats(rows):
    out={}
    for o in ['A','B']:
        rs=[r for r in rows if r['owner']==o]; core=[r for r in rs if r['milestone_number']!=13]
        out[o]=dict(count=len(rs),points=sum(r['points'] for r in rs),core_points=sum(r['points'] for r in core),priority=dict(collections.Counter(r['priority'] for r in rs)),size=dict(collections.Counter(r['size'] for r in rs)),phases=dict(collections.Counter(r['phase'] for r in rs)),ready=[r['number'] for r in rs if r['ready_to_start']],cross_stream_hard_blocked=sum(bool(r['cross_stream_hard_dependencies']) for r in rs),cross_stream_integration_only=sum(not r['cross_stream_hard_dependencies'] and r['handoff_required'] for r in rs))
    out['total']=dict(count=len(rows),points=sum(r['points'] for r in rows),hard_edges=sum(len(r['hard_dependencies']) for r in rows),integration_edges=sum(len(r['integration_dependencies']) for r in rows),soft_edges=sum(len(r['soft_dependencies']) for r in rows),operational_edges=sum(len(r['operational_dependencies']) for r in rows))
    return out

def ref(n): return f'[#{n}](https://github.com/{REPO}/issues/{n})'
def refs(ns): return ', '.join(ref(n) for n in ns) or 'None'
def loadplan(): return json.loads(PLAN.read_text(encoding='utf-8'))
def labels_for(r,original):
    remove=lambda s:s.startswith(('owner:','workstream:','phase:','size:')) or s in ['status:blocked','status:ready','dependency:blocked','handoff:required']
    labels=[x['name'] for x in original['labels'] if not remove(x['name'])]
    labels += ['owner:developer-'+r['owner'].lower(),'workstream:'+r['workstream'],'phase:'+r['phase'],'size:'+r['size'].lower(),'status:ready' if r['ready_to_start'] else 'status:blocked']
    if not r['ready_to_start']: labels+=['dependency:blocked']
    if r['handoff_required']: labels+=['handoff:required']
    return sorted(set(labels))

def render():
    p=loadplan(); rows=p['issues']; base=json.loads(BASE.read_text(encoding='utf-8')); originals={i['number']:i for i in base['issues']}; by={r['number']:r for r in rows}; catalog=json.loads((ROOT/'docs/project/issue-catalog.yaml').read_text(encoding='utf-8')); catby={i['id']:i for i in catalog}; keys={r['number']:r['catalog_id'] for r in rows}
    for r in rows:
        def links(ns): return '; '.join(f'#{n} ({keys[n]})' for n in ns) or 'None'
        old=originals[r['number']]['body']; labels=labels_for(r,originals[r['number']]); r['labels']=labels
        text='Hard prerequisites for starting implementation: '+links(r['hard_dependencies'])+'.\n\nLive integration prerequisites (prepare with synthetic mocks; do not claim production integration until verified): '+links(r['integration_dependencies'])+'.\n\nSoft review inputs: '+links(r['soft_dependencies'])+'.\n\nOperational/real-data gates: '+links(r['operational_dependencies'])+'. Institutional consent, verified geography, rights and privacy requirements remain mandatory.\n\nRationale: '+r['dependency_change_reason']+'\n\nSee `docs/project/implementation-order.md` for readiness and completion semantics.'
        body=re.sub(r'(### Dependencies\n).*?(?=\n### Implementation steps)',lambda m:m[1]+text+'\n',old,flags=re.S)
        body=re.sub(r'(### Size\n).*?(?=\n### Labels)',lambda m:m[1]+f"{r['size']} — {r['points']} effort points. {r['estimate_reason']}\n",body,flags=re.S)
        body=re.sub(r'(### Labels\n).*?(?=\n### Milestone)',lambda m:m[1]+', '.join(labels)+'.\n',body,flags=re.S)
        extra='''
<!-- two-developer-allocation:start -->
### Two-developer ownership and execution plan

'''+f'''Primary owner: **Developer {r['owner']} — `{r['github_user']}`**. Exactly one implementation owner; the other developer reviews/supports the boundary.

Actual GitHub assignment: {r['github_assignment_status']}. Developer B assignees are intentionally unchanged while the invitation remains unaccepted, per owner instruction; ownership labels reserve the work.

Workstream: `{r['workstream']}`. Phase: `{r['phase']}`. Owner order: **{r['owner']}-{r['owner_order']:02d}**; global topological reference {r['global_order']} (not a lockstep schedule). Suggested start wave: Sprint {r['sprint']}; no calendar deadline. Ready to start technically: **{'yes' if r['ready_to_start'] else 'no: unresolved hard prerequisites'}**.

Expected deliverable: {r['expected_output']}

Estimate: {r['size']} / {r['points']} points, considering implementation, uncertainty, test burden and integration. Re-estimate after the first vertical slices; waiting for an external institution is not counted as engineering effort.

Required contracts: {', '.join(r['required_contracts'])}; see `docs/project/developer-handoffs.md`. Integration partner: {r['integration_partner']}.

Handoff requirement: {r['required_handoff']}.

Review requirement: {r['review_requirement']} Original acceptance criteria, required tests, PR references and research requirements are preserved. {r['close_policy']}

Documentation: update the relevant original architecture/design documents plus the generated allocation record when dependencies, estimates or acceptance evidence change. Use `dev-{r['owner'].lower()}/issue-{r['number']}-short-description`, an up-to-date main, scoped PR, relevant tests and CI. No feature implementation is included in this allocation run.
'''
        if r['number']==9:
            extra+='\nFoundation handoff H0: review/freeze v1 location, GeoJSON, insight, history, media and private-field DTOs; public/private allowlists; module paths; compatibility/change rules; synthetic fixture manifest. This is a bounded review of the existing baseline, not a full backend implementation.\n'
        if r['number']==10:
            extra+='\nFoundation handoff H1: deliver shared TypeScript/runtime contracts, clearly synthetic non-Makarba fixtures, a mock API mode with success/empty/suppressed/error responses, clean Windows startup and contract-conformance CI. B must be able to run public development without a private database, identity provider or production credentials. Do not build the complete survey backend in this scaffold issue.\n'
        if r['number'] in [85,86,87,89,91,104]:
            extra+='\nReporting boundary: this issue reads A-produced, disclosure-approved aggregate/public DTOs only. A owns #84 eligibility/distinct-count generation, #90 private coverage computation and #92 disclosure policy. B receives no raw interview/GPS table grants. Codebook transformations use approved counts; any private answer coding runs inside A restricted service. Exports are allowlisted and privacy-safe.\n'
        if r['number']==54:
            extra+='\nIndependent risk review: B owns synthetic device/storage/key-loss feasibility evidence; A must review the privacy/key-management decision before implementing vault/session collection. No real participant data is permitted in feasibility tests.\n'
        body=body.rstrip()+'\n'+extra+'\n<!-- two-developer-allocation:end -->\n'
        put('docs/project/issues/'+r['catalog_id']+'.md',body)
        r['body_sha256']=digest(body); r['original_body_sha256']=digest(old)
        i=catby[r['catalog_id']]; i.update(size=r['size'],points=r['points'],labels=labels,dependencies=[keys[n] for n in r['hard_dependencies']],dependency_numbers=r['hard_dependencies'],integration_dependencies=[keys[n] for n in r['integration_dependencies']],soft_dependencies=[keys[n] for n in r['soft_dependencies']],operational_dependencies=[keys[n] for n in r['operational_dependencies']],allocation_owner=r['owner'],allocation_phase=r['phase'],original_dependency_numbers=r['original_dependencies'])
    save(PLAN,p); save(ROOT/'docs/project/issue-catalog.yaml',catalog)
    save(ROOT/'docs/project/issue-dependencies.json',{r['catalog_id']:dict(issue=dict(number=r['number'],url=r['url']),blockers=[dict(id=keys[n],number=n,url=by[n]['url']) for n in r['hard_dependencies']],integration=[dict(id=keys[n],number=n,url=by[n]['url']) for n in r['integration_dependencies']],soft=r['soft_dependencies'],operational=r['operational_dependencies']) for r in rows})
    fields=['number','title','owner','github_user','milestone','priority','size','points','phase','owner_order','global_order','sprint','hard_dependencies','integration_dependencies','soft_dependencies','operational_dependencies','status','ready_to_start','required_handoff','integration_partner','expected_output','github_assignment_status','url']
    stream=io.StringIO(newline=''); w=csv.DictWriter(stream,fieldnames=fields,lineterminator='\n'); w.writeheader()
    for r in sorted(rows,key=lambda r:r['number']): w.writerow({k:' '.join('#'+str(n) for n in r[k]) if isinstance(r[k],list) else r[k] for k in fields})
    put('docs/project/developer-issue-allocation.csv',stream.getvalue())
    head='# Complete two-developer allocation matrix\n\nGenerated from developer-issue-allocation.json; do not edit derived copies independently. B is reserved for varunkarthic, with GitHub assignees unchanged pending invitation acceptance. All original issues remain open.\n\n'
    table='| Issue | Title | Owner | Milestone | Priority | Size | Points | Phase | Hard dependencies | Status | Start ready | Handoff / partner | Expected output | Assignment |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n'
    table+='\n'.join(f"| {ref(r['number'])} | {r['title']} | {r['owner']} | M{r['milestone_number']-1:02d} | {r['priority']} | {r['size']} | {r['points']} | {r['phase']} | {refs(r['hard_dependencies'])} | {r['status']} | {'Yes' if r['ready_to_start'] else 'No'} | {'Required; '+r['integration_partner'] if r['handoff_required'] else 'Same stream'} | {r['expected_output']} | {r['github_assignment_status']} |" for r in sorted(rows,key=lambda r:r['number']))
    put('docs/project/allocation-matrix.md',head+table)
    put('docs/project/issue-index.md',head+table)
    render_documents(rows,base)
    print('Rendered 136 issue bodies, CSV, matrix, dependency map and developer documentation')

def render_documents(rows,base):
    s=stats(rows); by={r['number']:r for r in rows}; total=s['total']['points']
    old_cross={o:sum(any(by[d]['owner']!=o for d in r['original_dependencies']) for r in rows if r['owner']==o) for o in ['A','B']}
    available=set(FOUNDATION); progress=True
    while progress:
        new={r['number'] for r in rows if r['owner']=='B' and set(r['hard_dependencies'])<=available}; progress=not new<=available; available|=new
    independ=sorted(n for n in available if n not in FOUNDATION)
    production_order,_=topo(rows,True)
    paths={}
    for n in production_order:
        r=by[n]; paths[n]=max((paths[d] for d in r['hard_dependencies']+r['integration_dependencies']),key=len,default=[])+[n]
    critical=max((v for n,v in paths.items() if by[n]['milestone_number']!=13),key=len)
    common='Generated from developer-issue-allocation.json. No dates, product implementation or participant data. GitHub B assignment is pending invitation acceptance; labels reserve B work as requested.\n\n'
    put('docs/project/two-developer-workstreams.md','# Two-developer workstreams\n\n'+common+f'''A: **satvikp-coder**, {s['A']['count']} issues / {s['A']['points']} points. Own shared backend/contracts, PostGIS/private schemas, researcher app, GPS, sync, auth, private aggregation, publication and withdrawal.

B: **varunkarthic**, {s['B']['count']} issues / {s['B']['points']} points. Own public UX/map, content domain, historical evidence, panoramas, safe read-only reporting, admin presentation, independent testing and deployment preparation. B has no unrestricted raw interview/GPS access.

Stage 0: A completes {refs([1,6,9,10])} in that order. #9 freezes documented DTO boundaries; #10 delivers TypeScript/runtime contracts, mock API/fixture mode and contract CI. It does not require the complete backend. B can begin {refs([12,24,5])} now using existing documentation and safe desk research; no real field collection.

Stage 1: A implements core services; B uses shared synthetic contracts to build the public experience and safe domain/reporting modules. {len(independ)} B issues have a hard-prerequisite development path using only the foundation plus B-owned work; this means independent mock-backed development/preparation, not completed live integrations: {refs(independ)}.

Stage 2: incremental gates: field recovery {ref(62)}, provider APIs {ref(107)}, live map {ref(120)}, evidence/media {ref(123)}, analytics {ref(93)}, exposure controls {ref(110)}, browser journeys {ref(113)}, launch {ref(126)}. Each has one primary owner and the other supports/reviews. No feature is allowed to bypass its live-data gate.

Research roles are distinct from GitHub ownership: both developers use synthetic data in development. Institution-authorised research leads approve actual evidence and consent; neither assignment grants ethics approval or raw production access. All existing researcher-only survey/GPS/privacy requirements remain normative.
''')
    put('docs/project/workload-balance.md','# Workload balance and estimation\n\n'+common+'''Estimate method: S=1, M=3, L=5, XL=8. Score implementation, uncertainty, testing and integration from 0–2 each. Scores 0–1 → S, 2–3 → M, 4–5 → L, 6–8 → XL. Per-issue factors and concrete delivery rationale are in JSON. Estimates are relative engineering effort, not hours; external approval waiting time is a separate risk. Re-estimate after first vertical slices. XL labels flag uncertainty; split only if actual review reveals independent deliverables, not to balance numbers. No issues were invented or split for arithmetic.

| Metric | A | B |
|---|---:|---:|
'''+ '\n'.join(f'| {name} | {a} | {b} |' for name,a,b in [
('Open issues',s['A']['count'],s['B']['count']),('Effort points',s['A']['points'],s['B']['points']),('Effort share',f"{s['A']['points']/total:.2%}",f"{s['B']['points']/total:.2%}"),('Core M00–M11 points',s['A']['core_points'],s['B']['core_points']),('P0 issues',s['A']['priority'].get('P0',0),s['B']['priority'].get('P0',0)),('P1 issues',s['A']['priority'].get('P1',0),s['B']['priority'].get('P1',0)),('XL risk issues',s['A']['size'].get('XL',0),s['B']['size'].get('XL',0)),('Foundation',s['A']['phases'].get('foundation',0),0),('Parallel',s['A']['phases'].get('parallel',0),s['B']['phases'].get('parallel',0)),('Integration',s['A']['phases'].get('integration',0),s['B']['phases'].get('integration',0)),('Technically ready now',len(s['A']['ready']),len(s['B']['ready'])),('Hard-blocked by other stream before / after replan',str(old_cross['A'])+' / '+str(s['A']['cross_stream_hard_blocked']),str(old_cross['B'])+' / '+str(s['B']['cross_stream_hard_blocked']))])+f'''

Total: {total} points. Overall point ratio {max(s['A']['points'],s['B']['points'])/min(s['A']['points'],s['B']['points']):.3f}; core ratio {max(s['A']['core_points'],s['B']['core_points'])/min(s['A']['core_points'],s['B']['core_points']):.3f}. Both are within 10% relative effort. Counts are deliberately unequal because A owns more private/offline complexity. Stretch work is reported separately so it does not conceal an overloaded core workstream.

A retains more P0 security/field tasks by architectural necessity. B owns substantial risk in #41 adversarial tests, #54 offline feasibility, #62 recovery tests, #113 E2E, #115 quality gates, #117 devices and #124 deployment. A must review B offline decision and production grants. B owns content-domain models, non-sensitive GIS tooling and reporting over approved aggregates; this is not access to raw survey data. Testing and operations are shared, not assigned entirely to A. Institutional/legal and field evidence remain external uncertainties; research and rights validation cannot be estimated as guaranteed turnaround.

Assignment completion is separate from balance: A GitHub assignments are applied and verified during publication; all {s['B']['count']} B reservations remain pending GitHub assignment by explicit instruction while the invitation is unaccepted. This requires a PARTIAL final verdict, not PASS.
''')
    put('docs/project/implementation-order.md','# Implementation order and dependency semantics\n\n'+common+'''Hard prerequisites require completion evidence before starting dependent implementation. Soft inputs are reviewed planning material, not a waiting dependency. Integration prerequisites are required for actual live acceptance/production claims; UI or pure-module work can be accepted with frozen synthetic contracts, but must say it is mock-backed. Integration issues themselves cannot be marked fully complete until their runtime prerequisites pass. Operational gates apply before real collection/publication even when synthetic software tests pass. The original edge set is retained across these categories; no research/privacy gate disappeared.

Readiness labels mean technically ready to start, not permission for participant collection, public release or bypassing CI. Owner queues are recommended topological sequences, not a global lockstep schedule. A can execute the bootstrap while B begins design now. B assignment pending does not mean its labels or ownership are unknown.

Foundation A order: '''+refs([1,6,9,10])+'''. B starts '''+refs([12,24,5])+'''. First cross-stream handoff is #9 reviewed DTO/ownership boundary; #10 provides the runnable mocks/types and conformance checks.

Hard-prerequisite order:

'''+ ' → '.join(ref(n) for n in topo(rows)[0])+f'''

Production-integration critical path (structural issue count, not dates):

'''+ ' → '.join(ref(n) for n in critical)+'''

Joint field validation: #54/#62/#111/#112 for device/GPS/offline evidence, then #118 training and #119/#121 real pilot. #11 institutional approval and field-specific security/recovery checks are mandatory before participants. #117 complete public+field compatibility is a final launch gate, not an unnecessary prerequisite to drafting forms.

Final blockers: #11 for real collection; #23 verified boundary; #92 disclosure; #103 current approval/revocation; #110 exposure tests; #116 restore; #117 full devices; #123 rights; #125 reviewed dataset; #126 release and #127 handover. M12 remains optional after core release. See issue bodies for precise per-task edges.
''')
    put('docs/project/issue-dependencies.md','# Dependency map\n\n'+common+'Authoritative current edges: [allocation JSON](developer-issue-allocation.json), [machine-readable dependency map](issue-dependencies.json), and [implementation order](implementation-order.md). The old single blocker category is now explicitly separated into hard, integration, soft and operational dependencies.\n\n'+f"Hard edges: {s['total']['hard_edges']}; integration edges: {s['total']['integration_edges']}; soft: {s['total']['soft_edges']}; operational: {s['total']['operational_edges']}. Both hard and hard+integration graphs are acyclic.\n\n"+'''```mermaid
flowchart LR
 A0["A: #1 → #6 → #9 → #10"] --> A1["A: private services, GIS, surveys, GPS, sync"]
 B0["B: #12/#24/#5 can start now"] --> B1["B: public map, content and reporting mocks"]
 A0 --> B1
 A1 --> G["Incremental map/media/analytics/field integration gates"]
 B1 --> G
 G --> Q["Privacy, devices, restore and research evidence"]
 Q --> L["#126 release → #127 handover"]
```

No hard dependency was simply deleted: reclassified original blockers and their rationale are preserved per issue in allocation JSON and baseline snapshot. All actual issue numbers remain mapped to stable catalogue IDs.
''')
    for o in ['A','B']:
        own=sorted((r for r in rows if r['owner']==o),key=lambda r:r['owner_order'])
        text=f'# Developer {o} guide — '+('satvikp-coder' if o=='A' else 'varunkarthic')+'\n\n'+common
        text+=('Own the restricted core, shared contracts and private field application. Begin #1 → #6 → #9 → #10. Keep the first handoff small; do not build the whole backend before enabling B mocks.\n\n' if o=='A' else 'Your GitHub assignment is intentionally pending invitation acceptance. Work is reserved, not assigned to an invented or alternate account. Begin #12 independently; #24 tile research and #5 source-boundary research are also technically independent now. Use local fixtures/mock APIs; no raw research access is needed.\n\n')
        text+='Technically ready now: '+refs([r['number'] for r in own if r['ready_to_start']])+'.\n\nRecommended owner queue:\n\n'+' → '.join(ref(r['number']) for r in own)+'\n\n'
        for m in sorted({r['milestone_number'] for r in own}):
            text+=f'## M{m-1:02d}\n\n'
            for phase in ['foundation','parallel','integration']:
                subset=[r for r in own if r['milestone_number']==m and r['phase']==phase]
                if not subset: continue
                text+=f'### {phase.capitalize()}\n\n'
                text+='\n'.join(f"- **{o}-{r['owner_order']:02d} {ref(r['number'])} — {r['title']}** ({r['size']}/{r['points']} points; Sprint {r['sprint']}). Hard: {refs(r['hard_dependencies'])}; live integration: {refs(r['integration_dependencies'])}. Output: {r['expected_output']}" for r in subset)+'\n\n'
        text+='''## Working rules

Use your file boundaries in code-ownership.md; shared migrations/contracts/root config require coordinated review. Never edit the other developer's interface silently. Verify consumed DTOs with the fixture/live contract checker and provider tests; use synthetic data only. Run relevant unit, API/spatial, browser/a11y, privacy and fault tests from the issue, not just compilation. Attach expected/actual results and limitations.

Branch from updated main using dev-a/issue-N-slug or dev-b/issue-N-slug. One scoped PR; keep original acceptance criteria and issue links; inspect CI; cross-review shared interfaces. Rebase/merge without discarding the other person's changes, then rerun relevant tests. No direct pushes to protected main or bypassed checks. If review is unavailable, continue an independent issue; follow the recorded fallback review policy for low-risk isolated changes. Do not self-approve a privacy/schema/publication contract change. See coordination.md.

Handoffs: provider publishes version/hash, examples, test output and supported errors; consumer runs the same conformance fixtures. Do not close integration work on mock-only evidence. Research permissions, exact GPS protection, independent subject selection and consent are unchanged. No real participant data in Git, CI or UI fixtures.
'''
        put(f'docs/project/DEVELOPER_{o}_GUIDE.md',text)
    sprint_text='# Flexible sprint/start-wave plan\n\n'+common+'''These are dependency-ordered start waves, not dates or promises that external research approval arrives in a week. Work may carry to its live-integration wave; no issue is closed until its original acceptance and declared close policy pass. Integration prerequisites may lie in later waves for mock-backed work; the gate remains open and is explicitly tracked. Optional Sprint 6 is not part of core release.

'''
    for wave in sorted({r['sprint'] for r in rows}):
        sprint_text+=f'## Sprint {wave}\n\n'
        for o in ['A','B']: sprint_text+=f"Developer {o}: "+refs([r['number'] for r in sorted(rows,key=lambda r:r['owner_order']) if r['owner']==o and r['sprint']==wave])+'.\n\n'
        gates={0:'Reviewed H0 contracts and H1 scaffold; design/source research can proceed independently.',1:'Shared mock startup and conformance checks; schemas/auth and initial public map/shell use synthetic fixtures.',2:'Independent GPS/forms and public map/profile components; no live participant use without approval.',3:'Protected drafts/retry/upload and owned media/history pieces; actual provider/device failures remain visible.',4:'Incremental safe analytics/moderation/API/browser integrations; suppression and publication checks must pass.',5:'Consent-approved field pilot, real devices, restore, rights/dataset audit and release/handover; unresolved external gates stop launch.',6:'Optional advanced work; no core safety rule waived.'}
        sprint_text+='Deliverables and completion gate: '+gates.get(wave,'Complete listed hard-prerequisite deliverables, then the live integration and evidence gates.')+'\n\nDependencies: each listed hard prerequisite must be evidenced; inspect per-issue integration/operational gates before real use. Risks: fixture/real-contract drift, unavailable collaborator review, device limitations and institutional/provider/evidence delays. Integration check: rerun common fixtures, provider conformance, and the relevant map/media/analytics/field gate, recording actual results.\n\n'
    sprint_text=sprint_text.replace('These are dependency-ordered start waves, not dates', 'S0–S6 are dependency-ordered macro waves, not six timeboxed sprints. Use the [capacity batches](capacity-batches.md) to limit each planning selection to a provisional 20 points per developer, then calibrate against actual availability/velocity. These are start waves, not dates')
    put('docs/project/sprint-plan.md',sprint_text)
    batch_text='# Capacity-aware sprint planning batches\n\n'+common+'''The seven macro waves are too large to promise as seven calendar sprints. The batches below cap selected estimated work at 20 points per developer (a planning hypothesis, not measured velocity). Choose a real sprint length/capacity together later. A and B batches with the same label may run together only when their actual hard prerequisites are evidenced; runtime/operational gates still apply. Do not add dependencies merely to align batches. Every issue remains in exactly one macro wave and one owner queue; batch labels are a derived capacity view, not another source of ownership.

For each selected batch: deliver its linked issue outputs, run relevant contract/domain tests, document the A/B handoff, and inspect unresolved hard/integration gates. Carry over unaccepted work rather than closing it to hit a sprint target. Risks include device uncertainty, external approval/evidence delays and contract drift; reduce the next batch size when these occur.

| Wave / batch | Developer A tasks | A points | Developer B tasks | B points |
|---|---|---:|---|---:|
'''
    for wave in sorted({r['sprint'] for r in rows}):
        packs={}
        for o in ['A','B']:
            packs[o]=[]; pack=[]; points=0
            for r in sorted((x for x in rows if x['owner']==o and x['sprint']==wave),key=lambda r:r['owner_order']):
                if points+r['points']>20: packs[o].append((pack,points)); pack=[]; points=0
                pack.append(r['number']); points+=r['points']
            if pack: packs[o].append((pack,points))
        for j in range(max(len(packs['A']),len(packs['B']))):
            a,ap=packs['A'][j] if j<len(packs['A']) else ([],0); b,bp=packs['B'][j] if j<len(packs['B']) else ([],0)
            batch_text+=f'| S{wave}.{j+1} | {refs(a)} | {ap} | {refs(b)} | {bp} |\n'
    put('docs/project/capacity-batches.md',batch_text)
    from urllib.parse import urlencode
    views={
      'All issues':'is:issue',
      'My tasks — A':'is:issue is:open label:owner:developer-a',
      'Friend tasks — B (reserved)':'is:issue is:open label:owner:developer-b',
      'Ready now (technical prerequisites)':'is:issue is:open label:status:ready',
      'Blocked by hard dependency':'is:issue is:open label:dependency:blocked',
      'In progress':'is:issue is:open label:status:in-progress',
      'In review':'is:issue is:open label:status:needs-review',
      'Integration':'is:issue is:open label:phase:integration',
      'Completed':'is:issue is:closed'}
    put('docs/project/github-issue-views.md','# GitHub tracking views\n\nThe actual Projects audit returned INSUFFICIENT_SCOPES (read:project unavailable); no existing board could be inspected or updated and no duplicate board was created. No board URL is claimed. These issue filters work with actual ownership/phase labels and do not depend on Varun being assignable.\n\n'+ '\n'.join('- ['+name+'](https://github.com/'+REPO+'/issues?'+urlencode({'q':q})+') — `'+q+'`' for name,q in views.items())+'\n\nIn-progress and in-review filters are intentionally empty until implementation starts. Move status labels deliberately when prerequisites/evidence change; assignment alone is not In Progress. Milestones remain the original 13 and are not renamed/deleted. See [milestones](https://github.com/'+REPO+'/milestones).')

def apply_allocation():
    p=loadplan(); rows=p['issues']; base=json.loads(BASE.read_text(encoding='utf-8')); progress=json.loads(PROGRESS.read_text(encoding='utf-8'))
    if api('user')['login']!='satvikp-coder': raise RuntimeError('Wrong authenticated user')
    repo=api('repos/'+REPO)
    if repo['owner']['login']!='satvikp-coder' or not repo['permissions']['push']: raise RuntimeError('Repository identity/permission mismatch')
    current={i['number']:i for i in pages(f'repos/{REPO}/issues?state=all&sort=created&direction=asc') if 'pull_request' not in i}
    if {n for n,x in current.items() if x['state']=='open'}!={r['number'] for r in rows}: raise RuntimeError('Open inventory changed: re-audit before mutation; do not reopen or omit work')
    if any(i['assignment_conflicts'] for i in rows): raise RuntimeError('Third-party assignment conflict: preserve and resolve before publication')
    defs={
      'owner:developer-a':('0052CC','Primary implementation owner: satvikp-coder'),
      'owner:developer-b':('5319E7','Primary owner reserved for varunkarthic; assignee pending invitation acceptance'),
      'workstream:core-platform':('0052CC','Core services, private fieldwork, contracts and privacy boundary'),
      'workstream:public-experience':('5319E7','Public atlas, safe reporting, content and independent quality work'),
      'phase:foundation':('0E8A16','Minimum contracts/mock/scaffold bootstrap, not the entire backend'),
      'phase:parallel':('1D76DB','Independent contract-first work, using synthetic mocks where needed'),
      'phase:integration':('D93F0B','Explicit runtime handoff, verification or release integration gate'),
      'handoff:required':('FBCA04','Versioned interface or cross-stream verification is required'),
      'dependency:blocked':('B60205','Hard implementation prerequisites are not completed'),
      'status:in-progress':('0E8A16','Implementation actively started after prerequisite evidence; assignment alone is not progress'),
      **{f'size:{k}':('D4C5F9',f'Reviewed relative estimate: {k.upper()} = {v} effort points') for k,v in [('s',1),('m',3),('l',5),('xl',8)]}}
    labels={x['name'] for x in pages(f'repos/{REPO}/labels')}
    for name,(color,desc) in defs.items():
        if name not in labels: api(f'repos/{REPO}/labels',dict(name=name,color=color,description=desc))
    progress.update(stage='labels created; applying A assignees; leaving B unchanged',friend_username='varunkarthic',friend_assignment='pending invitation acceptance; explicit owner instruction to leave unchanged')
    save(PROGRESS,progress)
    for r in rows:
        if r['owner']=='B': continue
        x=current[r['number']]
        if 'satvikp-coder' not in [u['login'] for u in x['assignees']]:
            x=api(f"repos/{REPO}/issues/{r['number']}/assignees",dict(assignees=['satvikp-coder']))
        if 'satvikp-coder' not in [u['login'] for u in x['assignees']]: raise RuntimeError('Assignee ignored by API '+str(r['number']))
        r['github_assignment_status']='assigned to satvikp-coder; verified by GitHub issue API'
        progress['assigned_a']=sorted(set(progress.get('assigned_a',[])+[r['number']]))
        save(PLAN,p); save(PROGRESS,progress)
        print('Assigned A #'+str(r['number']),flush=True)
    render(); p=loadplan(); rows=p['issues']; original={x['number']:x for x in base['issues']}
    progress['stage']='A assignees verified; publishing ownership/body/dependency labels'; save(PROGRESS,progress)
    for r in rows:
        n=r['number']; x=api(f'repos/{REPO}/issues/{n}')
        if x['state']!='open': raise RuntimeError('Issue closed concurrently; preserve closed state and re-audit '+str(n))
        for h in ['Summary','Why this is needed','User story','Scope','Out of scope','Technical approach','Data and privacy considerations','Implementation steps','Acceptance criteria','Required tests','Edge cases','Documentation','Definition of Done','Priority','Milestone']:
            if section(x['body'],h)!=section(original[n]['body'],h): raise RuntimeError('Concurrent/original section changed: '+str(n)+' '+h)
        desired=(ROOT/'docs/project/issues'/f"{r['catalog_id']}.md").read_text(encoding='utf-8')
        labels=set(r['labels'])
        # Keep any unrelated labels added since the initial audit.
        labels|={l['name'] for l in x['labels'] if not l['name'].startswith(('owner:','workstream:','phase:','size:')) and l['name'] not in ['status:ready','status:blocked','dependency:blocked','handoff:required']}
        payload=dict(body=desired,labels=sorted(labels))
        if x['body'].strip()!=desired.strip() or {l['name'] for l in x['labels']}!=labels:
            result=api(f'repos/{REPO}/issues/{n}',payload,method='PATCH')
        else: result=x
        if result['milestone']['number']!=r['milestone_number']: raise RuntimeError('Milestone drift '+str(n))
        if r['owner']=='B' and [a['login'] for a in result['assignees']]!=r['original_assignees']: raise RuntimeError('B assignee changed unexpectedly '+str(n))
        progress['updated_issues']=sorted(set(progress.get('updated_issues',[])+[n])); save(PROGRESS,progress)
        print('Published '+r['owner']+' #'+str(n),flush=True)
    progress['stage']='all 136 allocation sections/labels published; A assigned; B reserved pending acceptance; independent verification pending'
    progress['updated_at']=now(); save(PROGRESS,progress)

if __name__=='__main__':
    if hasattr(sys.stdout,'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
    if sys.argv[1:] == ['audit']: audit()
    elif sys.argv[1:] == ['plan']: plan()
    elif sys.argv[1:] == ['render']: render()
    elif sys.argv[1:] == ['apply']: apply_allocation()
