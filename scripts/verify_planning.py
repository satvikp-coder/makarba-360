"""Validate catalogue and documentation; optionally inspect actual GitHub state."""
from pathlib import Path
import json,re,subprocess,sys,collections
if hasattr(sys.stdout,'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parents[1]
def main():
    catalog=json.loads((ROOT/'docs/project/issue-catalog.yaml').read_text(encoding='utf-8'))
    ids={i['id'] for i in catalog}; errors=[]
    if len(ids)!=136 or len(catalog)!=136: errors.append('Expected 136 unique focused issues')
    headings=['Summary','Why this is needed','User story','Scope','Out of scope','Technical approach','Data and privacy considerations','Dependencies','Implementation steps','Acceptance criteria','Required tests','Edge cases','Documentation','Definition of Done','Priority','Size','Labels','Milestone']
    for i in catalog:
        text=(ROOT/i['body_path']).read_text(encoding='utf-8')
        for h in headings:
            if '### '+h+'\n' not in text: errors.append(i['id']+' missing '+h)
            match=re.search(r'### '+re.escape(h)+r'\n(.*?)(?=\n### |\Z)',text,re.S)
            if match and len(match[1].strip())<12: errors.append(i['id']+' empty/insufficient '+h)
        if text.count('- [ ]')<4: errors.append(i['id']+' missing acceptance checkboxes')
        if not (ROOT/i['doc']).exists(): errors.append(i['id']+' missing linked document')
        for d in i['dependencies']:
            if d not in ids or d==i['id']: errors.append(i['id']+' invalid dependency '+d)
    if len({i['title'] for i in catalog})!=len(catalog): errors.append('Duplicate titles')
    trace=(ROOT/'docs/project/traceability-matrix.md').read_text(encoding='utf-8')
    source_pages={int(n) for n in re.findall(r'^\| (\d+) \|',trace,re.M)}
    if source_pages!=set(range(1,24)): errors.append('Blueprint page traceability incomplete')
    screen_text=(ROOT/'docs/product/screen-inventory.md').read_text(encoding='utf-8')
    screen_ids=re.findall(r'^\| ([PFA]\d{2}) \|',screen_text,re.M)
    if len(set(screen_ids))!=39: errors.append('Expected 39 distinct planned screens')
    test_text=(ROOT/'docs/project/test-strategy.md').read_text(encoding='utf-8')
    if len(set(re.findall(r'\| T(\d{2}):',test_text)))!=20: errors.append('Critical test matrix incomplete')
    done=set(); layers=[]
    while len(done)<len(ids):
        layer=[i['id'] for i in catalog if i['id'] not in done and set(i['dependencies'])<=done]
        if not layer: errors.append('Dependency cycle'); break
        layers.append(layer); done.update(layer)
    # All repository-local markdown destinations resolve, except public URLs and anchors.
    for p in ROOT.rglob('*.md'):
        for target in re.findall(r'\]\(([^)]+)\)',p.read_text(encoding='utf-8')):
            if '://' in target or target.startswith('#'): continue
            dest=(p.parent/target.split('#')[0]).resolve()
            if not dest.exists(): errors.append(str(p.relative_to(ROOT))+' broken link '+target)
    report=dict(issue_count=len(catalog),milestone_counts=dict(sorted(collections.Counter(i['milestone_key'] for i in catalog).items())),priorities=dict(collections.Counter(i['priority'] for i in catalog)),dependency_edges=sum(len(i['dependencies']) for i in catalog),acyclic=len(done)==len(ids),topological_layers=layers,documents=len(list((ROOT/'docs').rglob('*.md'))),source_pages_traced=len(source_pages),screens=len(set(screen_ids)),critical_tests_specified=20,blocked_issue_count=sum('status:blocked' in i['labels'] for i in catalog),ready_issue_count=sum('status:ready' in i['labels'] for i in catalog),errors=errors)
    if '--local' not in sys.argv:
        from publish_github import api,pages,REPO,save
        repo=api('repos/'+REPO); remote=[i for i in pages(f'repos/{REPO}/issues?state=all') if 'pull_request' not in i]; ms=pages(f'repos/{REPO}/milestones?state=all'); labels={x['name'] for x in pages(f'repos/{REPO}/labels')}
        mapping=json.loads((ROOT/'docs/project/github-issue-map.json').read_text(encoding='utf-8')); by={x['number']:x for x in remote}
        for i in catalog:
            num=mapping[i['id']]['number']; x=by.get(num)
            if not x: errors.append('Missing remote '+i['id']); continue
            if x['title']!=i['title']: errors.append('Title mismatch '+i['id'])
            if x.get('milestone',{}).get('title')!=i['milestone']: errors.append('Milestone mismatch '+i['id'])
            if not set(i['labels'])<={l['name'] for l in x['labels']}: errors.append('Missing remote issue labels '+i['id'])
            if x['body'].strip()!=(ROOT/i['body_path']).read_text(encoding='utf-8').strip(): errors.append('Body mismatch '+i['id'])
            for d in i['dependencies']:
                if '#'+str(mapping[d]['number'])+' ('+d+')' not in x['body']: errors.append('Missing remote blocker '+i['id']+':'+d)
        if len(remote)!=136 or len(ms)!=13: errors.append('Remote issue/milestone count mismatch')
        markers=[re.search(r'makarba-catalog-id:([\d.]+)',x['body'] or '') for x in remote]
        keys=[m[1] for m in markers if m]
        if len(set(keys))!=len(keys): errors.append('Duplicate remote catalogue markers')
        commit=api(f'repos/{REPO}/commits/main')
        report['remote']=dict(url=repo['html_url'],owner=repo['owner']['login'],private=repo['private'],default_branch=repo['default_branch'],commit=commit['sha'],issue_count=len(remote),milestones=[dict(number=m['number'],title=m['title'],url=m['html_url']) for m in ms],label_count=len(labels),missing_label_definitions=sorted({l for i in catalog for l in i['labels']}-labels),permissions=repo['permissions'])
        if report['remote']['missing_label_definitions']: errors.append('Missing label definitions')
        save(ROOT/'docs/project/qa-results.json',report)
        save(ROOT/'docs/project/remote-snapshot.json',dict(repository=report['remote'],issues=[dict(number=x['number'],title=x['title'],milestone=x['milestone']['number'] if x['milestone'] else None,labels=[l['name'] for l in x['labels']]) for x in remote]))
    print(json.dumps(report,ensure_ascii=False,indent=2))
    if errors: sys.exit(1)
if __name__=='__main__': main()
