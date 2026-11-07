"""Resumable, non-destructive GitHub planning publication via authenticated gh CLI."""
from pathlib import Path
import subprocess, json, time, sys, re
ROOT=Path(__file__).resolve().parents[1]
REPO='satvikp-coder/makarba-360'
STATE=ROOT/'docs/project/setup-progress.json'
def save(p,obj): p.parent.mkdir(parents=True,exist_ok=True); p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def gh(*args, payload=None, tries=4):
    for attempt in range(tries):
        r=subprocess.run(['gh',*args],input=json.dumps(payload) if payload is not None else None,capture_output=True,text=True,encoding='utf-8')
        if r.returncode==0: return json.loads(r.stdout) if r.stdout.strip() else None
        if any(s in r.stderr.lower() for s in ['rate limit','429','502','503','dial tcp','connectex','tls handshake timeout']): time.sleep(min(5*(attempt+1),20)); continue
        raise RuntimeError(r.stderr[:1200])
    raise RuntimeError('GitHub retry limit: '+r.stderr[:500])
def api(path, payload=None,method=None):
    args=['api',path]
    if method: args+=['--method',method]
    if payload is not None: args+=['--input','-']
    return gh(*args,payload=payload)
def pages(path):
    out=[]; n=1
    while True:
        x=api(path+('&' if '?' in path else '?')+f'per_page=100&page={n}'); out+=x
        if len(x)<100: return out
        n+=1
def main():
    if (ROOT/'docs/project/developer-issue-allocation.json').exists():
        raise RuntimeError('Two-developer allocation is authoritative. Use allocate_workstreams.py; legacy publication would overwrite ownership/dependency sections.')
    state=json.loads(STATE.read_text(encoding='utf-8')) if STATE.exists() else {'repository':REPO,'stages':{},'issues':{},'milestones':{},'limitations':[]}
    def persist(): save(STATE,state)
    state['stages'].update(audit='complete',requirements='complete',architecture='complete',ux='complete',roadmap='complete',catalogue='complete')
    state['limitations']=['GitHub Projects query rejected: token lacks read:project/project scopes; board not created. No board URL exists.']
    persist()
    repo=api('repos/'+REPO); state['remote']={k:repo[k] for k in ['full_name','html_url','private','default_branch','permissions']}; persist()
    expected_private=state.get('expected_visibility','private')=='private'
    if repo['private']!=expected_private: raise RuntimeError('Repository visibility differs from the recorded owner decision; inspect before proceeding')
    palette={'type':'1D76DB','area':'0E8A16','priority':'B60205','status':'D4C5F9'}
    groups={'type':['feature','bug','docs','research','security','test','infrastructure','design','refactor'],'area':['frontend','backend','database','gis','survey','gps','offline','media','analytics','admin','privacy','historical','devops'],'priority':['p0','p1','p2','p3'],'status':['ready','blocked','needs-design','needs-research','needs-review']}
    labels={f'{g}:{v}':dict(name=f'{g}:{v}',color=palette[g],description=({'type':'Work category: ','area':'Subsystem: ','priority':'Priority: ','status':'Workflow state: '}[g])+v) for g,vals in groups.items() for v in vals}
    for name,color,description in [
        ('priority:p0','B60205','Foundation, privacy or release blocker; resolve before dependent delivery'),
        ('priority:p1','D93F0B','Core delivery capability needed for the research/public MVP'),
        ('priority:p2','FBCA04','Important public experience or content delivery after core contracts'),
        ('priority:p3','C2E0C6','Optional advanced work after safe core release'),
        ('status:ready','0E8A16','No unresolved issue blockers; verify external gates before starting'),
        ('status:blocked','B60205','One or more explicit dependencies await completion evidence'),
        ('status:needs-design','D4C5F9','Needs an approved interaction or technical design before implementation'),
        ('status:needs-research','0075CA','Needs verified source, field or provider research'),
        ('status:needs-review','D93F0B','Deliverable awaits independent review and evidence checks')]:
        labels[name].update(color=color,description=description)
    for name in ['epic','milestone-blocker','field-validation-required','stretch-goal']:
        labels[name]=dict(name=name,color='FBCA04',description={'epic':'Cross-issue coordination only; not a replacement for focused tasks','milestone-blocker':'Gate that can block safe delivery or release','field-validation-required':'Needs evidence from approved real-device or field validation','stretch-goal':'Optional work after core public release'}[name])
    existing={x['name']:x for x in pages(f'repos/{REPO}/labels')}
    for name,payload in labels.items():
        if name not in existing: api(f'repos/{REPO}/labels',payload)
        elif any(existing[name].get(k)!=payload[k] for k in ['color','description']):
            from urllib.parse import quote
            api(f'repos/{REPO}/labels/{quote(name,safe="")}',payload,method='PATCH')
    state['labels']=list(labels); persist(); print('Labels ready',flush=True)
    existing_ms={x['title']:x for x in pages(f'repos/{REPO}/milestones?state=all')}
    for ms in json.loads((ROOT/'docs/project/milestones.json').read_text(encoding='utf-8')):
        x=existing_ms.get(ms['title']) or api(f'repos/{REPO}/milestones',dict(title=ms['title'],description=ms['description']))
        state['milestones'][ms['key']]={k:x[k] for k in ['number','title','html_url']}; persist()
    print('13 milestones ready',flush=True)
    catalog=json.loads((ROOT/'docs/project/issue-catalog.yaml').read_text(encoding='utf-8'))
    remote=pages(f'repos/{REPO}/issues?state=all')
    matches={}
    for x in remote:
        marker=re.search(r'makarba-catalog-id:([\d.]+)',x.get('body') or '')
        if marker:
            key=marker.group(1)
            if key in matches: raise RuntimeError('Duplicate remote marker '+key)
            matches[key]=x
    for i in catalog:
        key=i['id']; x=matches.get(key)
        if not x and key in state['issues']:
            # Paginated issue lists may lag a just-created record. Never recreate
            # an already acknowledged ID based only on absence from a list.
            x=api(f"repos/{REPO}/issues/{state['issues'][key]['number']}")
            if f'makarba-catalog-id:{key}' not in (x.get('body') or ''):
                raise RuntimeError('Stored mapping no longer matches issue marker '+key)
        if not x:
            body=(ROOT/i['body_path']).read_text(encoding='utf-8')
            x=api(f'repos/{REPO}/issues',dict(title=i['title'],body=body,labels=i['labels'],milestone=state['milestones'][i['milestone_key']]['number']))
        elif x['title']!=i['title'] or {l['name'] for l in x['labels']}!=set(i['labels']) or (x.get('milestone') or {}).get('number')!=state['milestones'][i['milestone_key']]['number']:
            x=api(f"repos/{REPO}/issues/{x['number']}",dict(title=i['title'],labels=i['labels'],milestone=state['milestones'][i['milestone_key']]['number']),method='PATCH')
        state['issues'][key]={k:x[k] for k in ['number','html_url','node_id']}; state['issues'][key]['url']=x['html_url']; persist()
        print(f"Issue {key} -> #{x['number']}",flush=True)
    state['stages']['issue_creation']='complete'; persist()
    # All IDs exist before dependency updates; writes are idempotent and resumable.
    bynum={x['number']:x for x in pages(f'repos/{REPO}/issues?state=all')}
    for i in catalog:
        key=i['id']; p=ROOT/i['body_path']; body=p.read_text(encoding='utf-8')
        deps='; '.join(f"#{state['issues'][d]['number']} ({d})" for d in i['dependencies']) or 'No issue blockers; verify repository access and planning baseline'
        body=re.sub(r'(### Dependencies\n).*?(\n### Implementation steps)',lambda m:m[1]+deps+'. Blockers require verified completion evidence before implementation. External institutional/provider gates in the linked documents remain effective even when issue blockers close.\n'+m[2],body,flags=re.S)
        p.write_text(body,encoding='utf-8'); num=state['issues'][key]['number']
        remote_issue=bynum.get(num) or api(f'repos/{REPO}/issues/{num}')
        if (remote_issue.get('body') or '').strip()!=body.strip(): api(f'repos/{REPO}/issues/{num}',dict(body=body),method='PATCH')
        i['github']=state['issues'][key]; i['dependency_numbers']=[state['issues'][d]['number'] for d in i['dependencies']]
        print(f'Dependencies verified #{num}',flush=True)
    save(ROOT/'docs/project/issue-catalog.yaml',catalog)
    save(ROOT/'docs/project/github-issue-map.json',state['issues'])
    state['stages'].update(labels='complete',milestones='complete',dependencies='complete',project_board='unavailable: insufficient token scopes')
    state['next_steps']=['Run final QA against remote API','Commit/push issue mapping and QA results','Verify main remote SHA and Actions result','Report optional board limitation']
    persist()
if __name__=='__main__': main()
