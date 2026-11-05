"""Read-only GTNH reference import. No world progress or player data is copied."""
import argparse, hashlib, json, re, zipfile
from pathlib import Path

def plain(value):
    return re.sub(r'§[0-9a-fk-or]', '', str(value), flags=re.I)

def values(value):
    return value.values() if isinstance(value, dict) else value or []

def stack(s):
    return {'id':s.get('id:8',''), 'meta':s.get('Damage:2',0), 'count':s.get('Count:3',1), 'ore':s.get('OreDict:8','')}

def build(instance, output):
    root=Path(instance).resolve()
    mc=root/'.minecraft'
    if not (mc/'mods').is_dir():
        raise SystemExit('This directory has no .minecraft/mods folder')
    mods=[]
    for p in sorted((mc/'mods').glob('*.jar')):
        if p.name.lower().startswith(('gregtech-', 'gtnewhorizonscoremod-', 'betterquesting-', 'notEnoughItems-'.lower())):
            mods.append({'file':p.name,'size':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
    quests=[]; chapters=[]
    files=sorted((mc/'saves').glob('*/betterquesting/QuestDatabase.json'))
    source=None
    if files:
        source=files[0]
        data=json.loads(source.read_text(encoding='utf-8-sig'))
        for q in values(data.get('questDatabase:9',{})):
            props=q.get('properties:10',{}).get('betterquesting:10',{})
            required=[]
            for t in values(q.get('tasks:9',{})):
                required.extend(stack(s) for s in values(t.get('requiredItems:9',{})))
            prereqs=[str(p.get('questIDHigh:4',0))+':'+str(p.get('questIDLow:4',0)) for p in values(q.get('preRequisites:9',{})) if isinstance(p,dict)]
            quests.append({'id':str(q.get('questIDHigh:4',0))+':'+str(q.get('questIDLow:4',0)), 'name':plain(props.get('name:8','')), 'description':plain(props.get('desc:8','')), 'required':required, 'prerequisites':prereqs})
        for line in values(data.get('questLines:9',{})):
            props=line.get('properties:10',{}).get('betterquesting:10',{})
            chapters.append({'name':plain(props.get('name:8','')), 'description':plain(props.get('desc:8','')), 'order':line.get('order:3',0), 'quests':[str(x.get('questIDHigh:4',0))+':'+str(x.get('questIDLow:4',0)) for x in values(line.get('quests:9',{}))]})
    translations={}
    lang=mc/'GregTech_zh_CN.lang'
    if lang.exists():
        for line in lang.read_text(encoding='utf-8-sig',errors='replace').splitlines():
            if '=' in line and not line.startswith('#'):
                k,v=line.split('=',1);translations[k]=v
    result={'schema':1,'pack':'GTNH 2.9.0','instanceName':root.name,'mods':mods,'questSource':str(source.relative_to(mc)) if source else None,'quests':quests,'chapters':sorted(chapters,key=lambda x:x['order']),'translations':translations,'notes':'Read-only local reference. Quest dependencies are guidance; they are not machine recipes.'}
    Path(output).parent.mkdir(parents=True,exist_ok=True)
    Path(output).write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(json.dumps({'quests':len(quests),'chapters':len(chapters),'translations':len(translations),'output':str(Path(output).resolve())},ensure_ascii=False))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--instance',required=True);p.add_argument('--output',default='src/data/reference.json');a=p.parse_args();build(a.instance,a.output)
