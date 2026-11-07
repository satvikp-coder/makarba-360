"""Read-only final local/remote commit and tracked-blob verification."""
import subprocess,json
from publish_github import ROOT,api,REPO
def git(*args): return subprocess.check_output(['git',*args],cwd=ROOT,text=True,encoding='utf-8').strip()
def main():
    local=git('rev-parse','HEAD'); remote=api(f'repos/{REPO}/commits/main')['sha']
    tree=api(f'repos/{REPO}/git/trees/main?recursive=1')
    assert not tree.get('truncated'), 'Remote tree truncated'
    blobs={x['path']:x['sha'] for x in tree['tree'] if x['type']=='blob'}
    tracked={}
    for row in git('ls-files','--stage').splitlines():
        meta,path=row.split('\t',1); tracked[path]=meta.split()[1]
    differences=[p for p,sha in tracked.items() if blobs.get(p)!=sha]
    extras=sorted(set(blobs)-set(tracked))
    status=git('status','--porcelain')
    result=dict(local_commit=local,remote_commit=remote,matching_commits=local==remote,tracked_files=len(tracked),remote_blob_count=len(blobs),blob_differences=differences,remote_extra_files=extras,clean_worktree=not status)
    print(json.dumps(result,indent=2))
    if local!=remote or differences or extras or status: raise SystemExit(1)
if __name__=='__main__': main()
