"""Resolve stable catalogue references to verified GitHub IDs without regenerating docs."""
from pathlib import Path
import json,re
from publish_github import ROOT,api,REPO,save
def main():
    mapping=json.loads((ROOT/'docs/project/github-issue-map.json').read_text(encoding='utf-8'))
    cat=json.loads((ROOT/'docs/project/issue-catalog.yaml').read_text(encoding='utf-8'))
    deps={i['id']:dict(issue=mapping[i['id']],blockers=[dict(id=d,number=mapping[d]['number'],url=mapping[d]['url']) for d in i['dependencies']]) for i in cat}
    save(ROOT/'docs/project/issue-dependencies.json',deps)
    p=ROOT/'docs/project/issue-index.md'; t=p.read_text(encoding='utf-8')
    for k,v in mapping.items(): t=t.replace('](issues/'+k+'.md)',']('+v['url']+')')
    t=re.sub(r'(blockers: )(.*)',lambda m:m[1]+re.sub(r'\b\d{2}\.\d{2}\b',lambda n:'#'+str(mapping[n[0]]['number']),m[2]),t)
    p.write_text(t,encoding='utf-8')
    for name in ['traceability-matrix.md','issue-dependencies.md','milestones.md']:
        p=ROOT/'docs/project'/name; t=p.read_text(encoding='utf-8')
        t=re.sub(r'(?<![\w/])\b\d{2}\.\d{2}\b(?![\w/])',lambda m:f"[#{mapping[m[0]]['number']}]({mapping[m[0]]['url']})" if m[0] in mapping else m[0],t)
        p.write_text(t,encoding='utf-8')
    # Ensure milestones carry actual remote blocker references and the refined scope.
    ms=json.loads((ROOT/'docs/project/milestones.json').read_text(encoding='utf-8'))
    state=json.loads((ROOT/'docs/project/setup-progress.json').read_text(encoding='utf-8'))
    for m in ms:
        desc=re.sub(r'\b\d{2}\.\d{2}\b',lambda n:'#'+str(mapping[n[0]]['number']) if n[0] in mapping else n[0],m['description'])
        desc=desc.split('\nAssigned issue index:')[0]
        local=[i for i in cat if i['milestone_key']==m['key']]
        gates=', '.join('#'+str(mapping[i['id']]['number']) for i in local if 'milestone-blocker' in i['labels']) or 'all scoped issue acceptance checks'
        desc+='\nAssigned issue index: https://github.com/'+REPO+'/blob/main/docs/project/issue-index.md\nGate issue references: '+gates
        api(f"repos/{REPO}/milestones/{state['milestones'][m['key']]['number']}",dict(description=desc),method='PATCH')
        m['description']=desc; m['github']=state['milestones'][m['key']]
    save(ROOT/'docs/project/milestones.json',ms)
    print('Resolved issue links, dependency numbers and milestone descriptions')
if __name__=='__main__': main()
