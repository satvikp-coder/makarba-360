"""Read-only public DTO smoke checks and meaningful forbidden-data rejection fixtures.

Not a complete JSON Schema/PostGIS/security validator. Future #10/#107 implement
the shared runtime/provider suite; this gives both developers an executable seed.
"""
from pathlib import Path
import argparse, json, copy, math, re
from urllib.request import urlopen, Request
from urllib.error import HTTPError
from urllib.parse import quote
ROOT=Path(__file__).resolve().parents[1]
FORBIDDEN={'interviewid','interviewpositions','interviewlatitude','interviewlongitude','gpsaccuracym','researcherid','consentrecords','rawanswers','answers','originalkey','privateurl','phone','participantname','exactinterviewtimestamp'}
def require(ok,message):
    if not ok: raise ValueError(message)
def privacy(value):
    if isinstance(value,dict):
        for k,v in value.items():
            require(re.sub(r'[^a-z]','',k.lower()) not in FORBIDDEN,'Restricted public field: '+k); privacy(v)
    elif isinstance(value,list):
        for v in value: privacy(v)
def keys(value,allowed,required=None):
    require(isinstance(value,dict),'Expected object')
    require(set(value)<=set(allowed),'Unexpected contract fields: '+str(set(value)-set(allowed)))
    require(set(required if required is not None else allowed)<=set(value),'Required field missing')
def meta(value):
    keys(value,['contractVersion','datasetKind','snapshotId','methodologyUrl'])
    require(value['contractVersion']=='1.0.0','Unsupported contract version')
    require(value['datasetKind'] in ['synthetic','approved'],'Unlabeled dataset')
def pair(c):
    require(isinstance(c,list) and len(c)==2 and all(isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v) for v in c),'Invalid coordinate tuple')
    require(-180<=c[0]<=180 and -90<=c[1]<=90,'Out-of-range coordinate')
def check(kind,value):
    privacy(value)
    if kind in ['missingMedia','invalidFilter','error']:
        keys(value,['code','message','fieldErrors','requestId','retryable']); require(isinstance(value['retryable'],bool),'retryable must be boolean'); return
    meta(value['meta'])
    if kind=='locations':
        keys(value,['type','features','page','meta']); require(value['type']=='FeatureCollection','Not GeoJSON collection')
        keys(value['page'],['limit','nextCursor']); require(1<=value['page']['limit']<=200,'Unbounded pagination')
        seen=set()
        for f in value['features']:
            keys(f,['type','id','geometry','properties']); require(f['type']=='Feature' and f['id'] not in seen,'Invalid/duplicate feature ID'); seen.add(f['id'])
            p=f['properties']; keys(p,['locationId','slug','name','category','publicationState','lastReviewedDate','sourceIds','mediaIds'])
            require(p['locationId']==f['id'] and p['publicationState']=='published','Feature ID/state mismatch')
            g=f['geometry']; keys(g,['type','coordinates']); t=g['type']; c=g['coordinates']
            require(t in ['Point','MultiLineString','MultiPolygon'],'Unsupported geometry')
            if t=='Point': pair(c)
            elif t=='MultiLineString':
                require(bool(c),'Empty route')
                for line in c:
                    require(len(line)>=2,'Short route'); [pair(pt) for pt in line]
            else:
                require(bool(c),'Empty polygon')
                for polygon in c:
                    require(bool(polygon),'Missing rings')
                    for ring in polygon:
                        require(len(ring)>=4 and ring[0]==ring[-1],'Unclosed/short polygon ring'); [pair(pt) for pt in ring]
    elif kind=='insights':
        keys(value,['cohorts','collectionPeriod','questionVersion','policyVersion','sampleNote','meta'])
        require(bool(value['sampleNote']),'Missing sample limitations')
        for c in value['cohorts']:
            keys(c,['cohortId','suppressed','n','validAnswerN','missingN','unsureN','respondentCategories','ratings','issues','denominatorLabel','countingRule','reasonCode'],['cohortId','suppressed','n','validAnswerN','missingN','unsureN','respondentCategories','ratings','issues'])
            if c['suppressed']:
                require(all(c[k] is None for k in ['n','validAnswerN','missingN','unsureN']) and all(c[k]==[] for k in ['respondentCategories','ratings','issues']),'Suppressed count/detail leaked')
                require(bool(c.get('reasonCode')),'Suppression reason missing')
            else:
                require(isinstance(c['n'],int) and not isinstance(c['n'],bool) and c['n']>=5,'Unsafe cohort in provisional k5 fixture contract')
                require(all(isinstance(c[k],int) and c[k]>=0 for k in ['validAnswerN','missingN','unsureN']),'Missing/unsure malformed')
                require(c['validAnswerN']+c['missingN']+c['unsureN']<=c['n'],'Valid/missing/unsure exceed distinct cohort base')
                require(bool(c.get('denominatorLabel')) and bool(c.get('countingRule')),'Counting metadata missing')
                require(sum(x['count'] for x in c['ratings'])==c['validAnswerN'],'Rating denominator mismatch')
    elif kind=='history':
        keys(value,['locationId','sources','events','comparisonPairs','meta']); ids={s['id'] for s in value['sources']}
        for p in value['comparisonPairs']:
            require(p['locationId']==value['locationId'] and bool(p['sourceIds']) and set(p['sourceIds'])<=ids,'Comparison source/location mismatch')
            require(p.get('beforeDate',{}).get('value') and p.get('afterDate',{}).get('value'),'Undated comparison')
            if value['meta']['datasetKind']=='approved': require(p['evidenceQuality']!='synthetic','Synthetic evidence in real publication')
    elif kind=='media':
        keys(value,['id','locationId','url','contentType','width','height','format','alt','credit','licence','capturedDate','publicationState','staticFallbackUrl','meta'])
        require(value['url'].startswith('https://') and '/original/' not in value['url'],'Unsafe media URL')
        require(value['contentType'] in ['image/jpeg','image/png','image/webp'],'Unsafe image type')
        require(value['publicationState']=='published' and value['width']>0 and value['height']>0,'Invalid public media')
        require(value['format'] in ['image','equirectangular','multiresolution'],'Unknown panorama format')
    else: raise ValueError('Unknown contract kind '+kind)
def fixtures():
    bundle=json.loads((ROOT/'docs/project/contracts/fixture-bundle.json').read_text(encoding='utf-8'))
    for k in ['locations','insights','history','media','missingMedia','invalidFilter']: check(k,bundle[k])
    negatives=[]
    a=copy.deepcopy(bundle['locations']); a['features'][0]['properties']['interviewLatitude']=10; negatives.append(('locations',a,'GPS leak'))
    a=copy.deepcopy(bundle['locations']); a['features'][0]['geometry']['coordinates']=[200,10]; negatives.append(('locations',a,'Invalid longitude'))
    a=copy.deepcopy(bundle['insights']); a['cohorts'][1]['n']=2; negatives.append(('insights',a,'Suppressed n leak'))
    a=copy.deepcopy(bundle['insights']); a['cohorts'][0].update(n=2,validAnswerN=2,missingN=0,unsureN=0,ratings=[{'value':3,'count':2}],respondentCategories=[{'code':'resident','count':1},{'code':'worker','count':1}],issues=[]); negatives.append(('insights',a,'Unsafe cohort'))
    a=copy.deepcopy(bundle['insights']); a['cohorts'][0]['validAnswerN']=29; negatives.append(('insights',a,'Invalid denominator'))
    a=copy.deepcopy(bundle['history']); a['comparisonPairs'][0]['beforeDate']['value']=None; negatives.append(('history',a,'Undated comparison'))
    a=copy.deepcopy(bundle['media']); a['url']='https://example.invalid/original/private.webp'; negatives.append(('media',a,'Original media'))
    a=copy.deepcopy(bundle['media']); a['original_key']='private/object'; negatives.append(('media',a,'Private storage key'))
    for kind,value,name in negatives:
        try: check(kind,value)
        except ValueError: continue
        raise AssertionError('Negative case accepted: '+name)
    print('PASS: 6 positive public DTO fixtures; 8 privacy/geometry/count/evidence rejection cases. No live API/product tests run.')
def live(base,slug=None,media_id=None):
    require(base.startswith('https://') or base.startswith('http://localhost:') or base.startswith('http://127.0.0.1:'),'Use approved HTTPS staging or local mock origin')
    def get(path,kind,allow_missing=False):
        try:
            with urlopen(Request(base.rstrip('/')+path,headers={'Accept':'application/json'}),timeout=20) as r:
                require(r.status==200,'Public GET failed'); data=json.load(r); check(kind,data); return data
        except HTTPError as e:
            if e.code==404 and allow_missing: check('error',json.load(e)); print('Verified unavailable fallback: '+kind); return None
            raise
    places=get('/api/v1/public/locations?limit=3','locations')
    get('/api/v1/public/insights','insights')
    first=places['features'][0]['properties'] if places['features'] else {}
    slug=slug or first.get('slug'); media_id=media_id or next(iter(first.get('mediaIds',[])),None)
    if slug: get('/api/v1/public/locations/'+quote(slug,safe='')+'/history','history',True)
    else: print('SKIPPED history: no published location; provide --location-slug for a known fixture')
    if media_id: get('/api/v1/public/media/'+quote(media_id,safe=''),'media',True)
    else: print('SKIPPED media: no public media reference; provide --media-id for a known fixture')
    print('PASS: requested read-only public DTO smoke checks; explicit skips above remain unverified. Does not prove full privacy, counting truth or publication correctness.')
if __name__=='__main__':
    ap=argparse.ArgumentParser(); ap.add_argument('--fixtures',action='store_true'); ap.add_argument('--base-url'); ap.add_argument('--location-slug'); ap.add_argument('--media-id'); args=ap.parse_args()
    if args.fixtures: fixtures()
    if args.base_url: live(args.base_url,args.location_slug,args.media_id)
    if not args.fixtures and not args.base_url: ap.error('Choose --fixtures or --base-url')
