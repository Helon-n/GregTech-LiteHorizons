"""Extract literal IC2 item aliases from an offline decompilation of the pinned jar.

This does not execute or install Minecraft. The checked-in mapping is validated
against the jar hash on every technology import; missing/dynamic entries fail
closed. Reproduce the source using CFR 0.152 and --jarfilter ic2.core.init.BlocksItems.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT=Path(__file__).resolve().parents[1]


def generate(source,jar):
    raw=source.read_text(encoding='utf-8');entries={};unresolved=[]
    with zipfile.ZipFile(jar) as z:
        files=set(z.namelist());lang={}
        for locale in ('en_US','zh_CN'):
            name='ic2/lang/'+locale+'.properties'
            if name in files:lang.update(line.split('=',1) for line in z.read(name).decode('utf-8-sig').splitlines() if '=' in line and not line.startswith('#'))
        lang={k:re.sub(r'\\u([0-9a-fA-F]{4})',lambda m:chr(int(m[1],16)),v) for k,v in lang.items()}
        for match in re.finditer(r'Ic2Items\.(\w+)\s*=\s*new ItemStack\(([^;]+)\);',raw):
            expression=match[2];internal=re.findall(r'InternalName\.(\w+)',expression)
            if len(internal)!=1 or not re.match(r'(?:\(Item\))?new \w+\(',expression):
                unresolved.append({'alias':match[1],'expression':expression});continue
            internal=internal[0]
            # ItemIC2 renders its unlocalized registry name from items/<name>.
            texture='assets/ic2/textures/items/'+internal+'.png'
            if texture not in files:
                unresolved.append({'alias':match[1],'expression':expression,'reason':'not an item with a direct registered texture'});continue
            entries[match[1]]={'name':lang.get(internal,internal),'registry':'IC2:'+internal,'meta':0,'texture':texture}
        resource_sources={}
        for classname in ('ItemIngot','ItemDust','ItemDust2','ItemRecipePart'):
            path=source.parents[1]/'item/resources'/f'{classname}.java'
            text=path.read_text(encoding='utf-8');resource_sources[classname]=hashlib.sha256(path.read_bytes()).hexdigest()
            registration=re.search(r'new '+classname+r'\(InternalName\.(\w+)\)',raw)
            if not registration:raise ValueError('Missing IC2 multi-item registration '+classname)
            names=dict(re.findall(r'case (\d+):\s*\{\s*ret = InternalName\.(\w+);',text))
            for alias,meta in re.findall(r'Ic2Items\.(\w+) = new ItemStack\(\(Item\)this, 1, (\d+)\)',text):
                name=names.get(meta);texture='assets/ic2/textures/items/resources/'+str(name)+'.png'
                if not name or texture not in files:raise ValueError('Missing IC2 multi-item texture '+alias)
                entries[alias]={'name':lang.get(name,name),'registry':'IC2:'+registration[1],'meta':int(meta),'texture':texture}
        entries['miningPipe']={'name':lang.get('blockMiningPipe','采矿管道'),'registry':'IC2:blockMiningPipe','meta':0,'texture':'assets/ic2/textures/blocks/machine/blockMiningPipe.png'}
        # ItemCell is a subtype item with a custom texture folder. Only the
        # empty subtype is inventory here; filled cells use physical ports.
        path=source.parents[1]/'item/resources/ItemCell.java'
        text=path.read_text(encoding='utf-8');resource_sources['ItemCell']=hashlib.sha256(path.read_bytes()).hexdigest()
        if not re.search(r'Ic2Items.cell = this.addCell\(0, InternalName.itemCellEmpty,',text):raise ValueError('changed empty IC2 cell registration')
        texture='assets/ic2/textures/items/cell/itemCellEmpty.png'
        if texture not in files:raise ValueError('missing empty IC2 cell texture')
        entries['cell']={'name':lang.get('itemCellEmpty','空单元'),'registry':'IC2:itemCellEmpty','meta':0,'texture':texture}
        unresolved=[row for row in unresolved if row['alias']!='cell']
    data={'jar':jar.name,'sha256':hashlib.sha256(jar.read_bytes()).hexdigest(),'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),
      'description':'Literal BlocksItems and resource subtype aliases from IC2 2.2.828 bytecode decompiled by CFR 0.152; no game startup.', 'resourceSHA256':resource_sources,'entries':entries,'unresolved':unresolved}
    (ROOT/'src/data/ic2-items-reference.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('IC2 aliases:',len(entries),'unresolved:',len(unresolved))


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',type=Path,default=ROOT/'.local/gtnh-technology/ic2-2.2.828/ic2/core/init/BlocksItems.java')
    p.add_argument('--jar',type=Path,default=Path('D:/PrismLauncher/instances/GT_New_Horizons_2.9.0_Java_17-26/.minecraft/mods/industrialcraft-2-2.2.828-experimental.jar'))
    args=p.parse_args();generate(args.source,args.jar)
