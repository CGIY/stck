"""Read-only catalogue/token model, with 20% special editions and independent rarity.
Run from stck: python3 scripts/analyze-economy.py > art-direction/economy-results.json
"""
from decimal import Decimal, localcontext
from itertools import product
from math import comb
from pathlib import Path
import argparse,json,subprocess
ROOT=Path(__file__).resolve().parents[1]
ITEMS=[x for x in json.loads((ROOT/'src/catalog.json').read_text()) if x.get('active',True)]
COLLECTIONS=json.loads((ROOT/'src/collections.json').read_text())
parser=argparse.ArgumentParser();parser.add_argument('--rare-rate',type=Decimal,default=Decimal('.1'));args=parser.parse_args();RATE=args.rare_rate
if not 0<RATE<1:parser.error('rare-rate must be between 0 and 1')
SPECIAL={c['id'] for c in COLLECTIONS if c.get('special',False)}
POOLS={}
for special,rare in product([False,True],repeat=2):
 items=[x for x in ITEMS if (x['collection'] in SPECIAL)==special and x['rare']==rare]
 probability=(Decimal('.2') if special else Decimal('.8'))*(RATE if rare else 1-RATE)
 POOLS[(special,rare)]={'items':items,'p':probability/len(items),'probability':probability}
assert len(ITEMS)==55 and sum(x['rare'] for x in ITEMS)==13

def coefficients(classes):
 terms=[]
 for indices in product(*(range(count+1) for count,p in classes)):
  degree=sum(indices);factor=1;probability=Decimal(0)
  for i,(count,p) in zip(indices,classes):factor*=comb(count,i);probability+=i*p
  terms.append((degree,Decimal(factor),probability))
 return terms

def cdf(terms,n):
 if n<max(k for k,_,_ in terms):return 0.0
 with localcontext() as ctx:
  ctx.prec=75
  result=sum(((-1 if k%2 else 1)*a*(1-p)**n for k,a,p in terms),Decimal(0))
  return float(max(Decimal(0),min(Decimal(1),result)))

def quantile(terms,q):
 low,high=0,1
 while cdf(terms,high)<q:high*=2
 while low+1<high:
  mid=(low+high)//2
  if cdf(terms,mid)>=q:high=mid
  else:low=mid
 return high

def statistics(classes):
 terms=coefficients(classes)
 with localcontext() as ctx:
  ctx.prec=75
  expected=sum(((-1 if k%2==0 else 1)*a/p for k,a,p in terms if k),Decimal(0))
 return dict(mean_draws=float(expected),median_draws=quantile(terms,.5),p90_draws=quantile(terms,.9),probabilities={str(n):cdf(terms,n) for n in [30,60,90,180]})

result={'assumptions':{'active':len(ITEMS),'common':sum(not x['rare'] for x in ITEMS),'rare':sum(x['rare'] for x in ITEMS),'rare_rate':float(RATE),'special_rate':.2,'copy_cap':2,'duplicate_tokens':1,'pools':[dict(special=special,rare=rare,count=len(v['items']),per_item_probability=float(v['p'])) for (special,rare),v in POOLS.items()],'model':'lifetime discoveries; independent rarity and special edition; individual draws'},'sheets':[]}
for collection in COLLECTIONS:
 group=[x for x in ITEMS if x['collection']==collection['id']];special=collection['id'] in SPECIAL
 counts=[sum(not x['rare'] for x in group),sum(x['rare'] for x in group)]
 classes=[(counts[rare],POOLS[(special,bool(rare))]['p']) for rare in range(2)]
 result['sheets'].append(dict(name=collection['title'],special=special,common=counts[0],rare=counts[1],**statistics(classes)))
result['whole_catalog']=statistics([(len(v['items']),v['p']) for v in POOLS.values()])
result['duplicates_without_consumption']=[]
for n in [30,60,90,180]:
 distinct=kept=0
 for v in POOLS.values():
  size=len(v['items']);p=float(v['p']);p0=(1-p)**n;p1=n*p*(1-p)**(n-1)
  distinct+=size*(1-p0);kept+=size*(2-2*p0-p1)
 result['duplicates_without_consumption'].append(dict(draws=n,expected_distinct=distinct,expected_kept=kept,expected_converted_to_tokens=n-kept))
js=r'''
const fs=require('node:fs'),input=JSON.parse(fs.readFileSync(0,'utf8'));let seed=20261031;
function random(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}
const groups=input.collections.map(c=>c.id),targets=groups.map(id=>(1<<input.items.filter(x=>x.collection===id).length)-1),position=groups.map(()=>0),pools=[[],[],[],[]],special=new Set(input.collections.filter(c=>c.special).map(c=>c.id));
for(const item of input.items){const group=groups.indexOf(item.collection),bit=1<<position[group]++;pools[(special.has(item.collection)?2:0)+(item.rare?1:0)].push({group,bit});}
const N=500000,checkpoints=[30,60,90,180],anyByCheckpoint=Object.fromEntries(checkpoints.map(n=>[n,0]));
for(let run=0;run<N;run++){
 const masks=groups.map(()=>0);let firstCompletion=0;
 for(let draw=0;draw<180;draw++){const pool=pools[(random()<.2?2:0)+(random()<input.rate?1:0)],item=pool[Math.floor(random()*pool.length)];masks[item.group]|=item.bit;if(!firstCompletion&&masks[item.group]===targets[item.group])firstCompletion=draw+1;}
 for(const n of checkpoints)if(firstCompletion&&firstCompletion<=n)anyByCheckpoint[n]++;
}
console.log(JSON.stringify({seed:20261031,runs:N,draws:180,at_least_one_sheet_by_draw:Object.fromEntries(checkpoints.map(n=>[n,anyByCheckpoint[n]/N]))}));
'''
completed=subprocess.run(['node','-e',js],input=json.dumps({'items':ITEMS,'collections':COLLECTIONS,'rate':float(RATE)}),capture_output=True,text=True,check=True)
result['simulation']=json.loads(completed.stdout)
print(json.dumps(result,indent=2,ensure_ascii=False))
