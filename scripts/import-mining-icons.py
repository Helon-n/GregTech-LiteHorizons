"""Trace new mining tools from original GT material textures (no resource packs)."""
import importlib.util
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('original_icons',ROOT/'scripts/import-icons.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
importer=object.__new__(module.Importer)
importer.output=ROOT/'src/assets/gtnh'
importer.archives,importer.files,importer.manifest,importer.used=[],{},{},[]
instance=Path('D:/PrismLauncher/instances/GT_New_Horizons_2.9.0_Java_17-26/.minecraft')
for jar in sorted((instance/'mods').glob('*.jar')):importer.add_archive(jar)
native={}
for name in ['industry','technology']:
    catalog=json.loads((ROOT/f'src/data/{name}-import.js').read_text(encoding='utf-8').split('=',1)[1].rstrip(';\n'))
    for item in catalog['items'].values():
        material=item.get('native',{})
        if material:native[material['material']]=material
importer.materials={name.lower():{'color':int(item['color'],16),'texture':item['texture']} for name,item in native.items()}
for id,material in [('ironPick','Iron'),('bronzePick','Bronze'),('steelPick','Steel'),('diamondPick','Diamond'),
                    ('stainlessPick','StainlessSteel'),('tungstensteelPick','TungstenSteel'),('manyullynPick','Manyullyn'),
                    ('neutroniumPick','Neutronium'),('duraniumPick','Duranium'),('infinityPick','Infinity')]:
    image=importer.material(material,'toolHeadPickaxe')
    image.alpha_composite(importer.material('Wood','stick').resize(image.size,module.Image.Resampling.NEAREST))
    importer.save(id,image,'GT material pick head and wooden handle. Idle crafting recipe; no resource-pack overlays.')
path=importer.output/'sources.json'
manifest=json.loads(path.read_text(encoding='utf-8'));manifest['icons'].update(importer.manifest)
path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
