"""Trace verified GTNH inventory renders to SVG, with registry and original-jar provenance.

Prepare with prepare-icon-tasks.mjs, render with export-runtime-icons.py --run.
Merge successful batches in .local/icon-runtime-results.json. Empty/error/missing-texture
images are rejected, never silently counted as artwork. The player instance is read only.
"""
import hashlib, importlib.util, json, zipfile
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
INSTANCE=Path('D:/PrismLauncher/instances/GT_New_Horizons_2.9.0_Java_17-26')
CLIENT=ROOT/'.local/icon-client'
spec=importlib.util.spec_from_file_location('original_icons',ROOT/'scripts/import-icons.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

def run():
    result_file=ROOT/'.local/icon-runtime-results.json'
    rows={r['key']:r for r in json.loads(result_file.read_text(encoding='utf-8'))} if result_file.exists() else {}
    for row in json.loads((CLIENT/'icon-results.json').read_text(encoding='utf-8')):rows[row['key']]=row
    importer=object.__new__(module.Importer)
    importer.output=ROOT/'src/assets/gtnh';importer.archives=[];importer.files={};importer.manifest={};importer.used=[]
    jars=[Path('D:/PrismLauncher/libraries/com/mojang/minecraft/1.7.10/minecraft-1.7.10-client.jar'),*sorted((INSTANCE/'.minecraft/mods').glob('*.jar'))]
    classes={};hashes={}
    for jar in jars:
        importer.add_archive(jar)
        archive=importer.archives[-1];hashes[jar.name]=hashlib.sha256(jar.read_bytes()).hexdigest()
        for name in archive.namelist():
            if name.endswith('.class') and not name.startswith('META-INF/'):classes[name[:-6].replace('/','.')]=jar.name
    # WR-CBE creates this sprite dynamically. Reproduce processTexture(-1, 0) exactly:
    # use the gradient pixel when nontransparent, otherwise the ring; white tint, no pointer.
    key='modItem_WirelessRedstoneCBEAddons_triangulator_0'
    ring='assets/wrcbe_addons/textures/items/triangRing.png';grad='assets/wrcbe_addons/textures/items/triangGrad.png'
    a=importer.load(ring);b=importer.load(grad)
    image=Image.new('RGBA',a.size);image.putdata([gb if gb[3] else ra for ra,gb in zip(a.get_flattened_data(),b.get_flattened_data())])
    importer.save(key,image,'Original WR-CBE TriangTexManager.processTexture(-1, 0), default unlinked triangulator. No resource pack.')
    importer.manifest[key]['registration']={'registry':'WR-CBE|Addons:triangulator','meta':0,'renderer':'codechicken.wirelessredstone.addons.TriangTexManager','method':'mergeTexturesWithColour(white)'}
    rows[key].update(ok=True,staticComposition=True);rows[key].pop('error',None)
    rejected=[];rendered=0
    registry=json.loads((CLIENT/'machine-registry.json').read_text(encoding='utf-8'))
    machine_by_meta={r['meta']:r for r in registry}
    for key,row in rows.items():
        if row.get('staticComposition'):continue
        if not row.get('ok'):rejected.append({'key':key,'error':row.get('error')});continue
        image=Image.open(CLIENT/'icon-renders'/(key+'.png')).convert('RGBA')
        bbox=image.getbbox()
        if not bbox:rejected.append({'key':key,'error':'empty image'});continue
        colors=image.get_flattened_data()
        purple=sum(1 for r,g,b,a in colors if r>200 and g<40 and b>200 and a>0)
        black=sum(1 for r,g,b,a in colors if r<10 and g<10 and b<10 and a>0)
        if purple>30 and black>30:rejected.append({'key':key,'error':'suspected missing-texture checkerboard'});continue
        # Match other item sprites: tight square around the actual inventory model.
        image=image.crop(bbox);size=max(image.size)+2
        canvas=Image.new('RGBA',(size,size));canvas.paste(image,((size-image.width)//2,(size-image.height)//2))
        item_archive=jars[0].name if row['itemClass'].startswith('net.minecraft.') else classes.get(row['itemClass'].split('$$')[0])
        if not item_archive:raise ValueError('No original jar for '+row['itemClass'])
        native_registry=row.get('resolvedRegistry',row['registry']);meta=row.get('resolvedMeta',row['meta'])
        importer.used=[{'archive':item_archive,'sha256':hashes[item_archive],'role':'item implementation','runtimeRegistry':native_registry,'meta':meta}]
        if native_registry=='gregtech:gt.blockmachines':
            machine_archive=classes[machine_by_meta[meta]['class']]
            if machine_archive!=item_archive:importer.used.append({'archive':machine_archive,'sha256':hashes[machine_archive],'role':'metatile implementation'})
        importer.save(key,canvas,'Original GTNH 2.9.0 inventory renderer, traced to vector paths. No resource pack.')
        proof={'registry':native_registry,'meta':meta,'itemClass':row['itemClass'],'displayName':row['displayName'],'renderer':'RenderItem.renderItemAndEffectIntoGUI + ForgeHooksClient','inputRegistry':row['registry'],'inputMeta':row['meta']}
        if native_registry=='gregtech:gt.blockmachines':proof['machine']=machine_by_meta[meta]
        if row.get('previewMeta') is not None:proof['preview']='Wildcard ingredient: show subtype 0 only; recipe identity unchanged.'
        if row.get('trackEnum'):proof['trackEnum']=row['trackEnum']
        importer.manifest[key]['registration']=proof;rendered+=1
    manifest_path=ROOT/'src/assets/gtnh/sources.json'
    manifest=json.loads(manifest_path.read_text(encoding='utf-8'));manifest['icons'].update(importer.manifest)
    manifest['runtimeAssets']={'client':'Minecraft 1.7.10 / GTNH 2.9.0','resourcePacks':[],'archives':[{'archive':name,'sha256':digest} for name,digest in hashes.items()],'note':'Original default-client resource set used by the registered inventory renderers. Runtime atlas draws retain registry/meta provenance; they do not claim a per-sprite PNG path.'}
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    result_file.write_text(json.dumps(list(rows.values()),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (ROOT/'.local/icon-runtime-rejected.json').write_text(json.dumps(rejected,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'runtimeSVG':rendered,'dynamicComposition':1,'rejected':rejected}))
    if rejected:raise SystemExit(1)

if __name__=='__main__':run()
