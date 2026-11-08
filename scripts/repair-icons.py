"""Fill missing catalog icons from the pinned GTNH jars (never resource packs).

Explicit subtype maps follow original registration code. Existing files are left
alone. Every new vector keeps its source textures and registration evidence in
sources.json; unresolved identities remain in the audit rather than being guessed.
"""
import argparse
import hashlib
import importlib.util
import json
import re
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
INSTANCE = Path('D:/PrismLauncher/instances/GT_New_Horizons_2.9.0_Java_17-26')
VANILLA = Path('D:/PrismLauncher/libraries/com/mojang/minecraft/1.7.10/minecraft-1.7.10-client.jar')
spec = importlib.util.spec_from_file_location('native_icons', ROOT/'scripts/import-icons.py')
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)


def catalog():
    result = subprocess.run(['node', '--input-type=module', '-e',
        "import {CATALOG} from './src/data/catalog.js';console.log(JSON.stringify(CATALOG.items))"],
        cwd=ROOT, capture_output=True, encoding='utf-8', check=True)
    return json.loads(result.stdout)


class Repair:
    def __init__(self, instance, vanilla):
        self.output = ROOT/'src/assets/gtnh'
        self.importer = object.__new__(native.Importer)
        self.importer.output = self.output
        self.importer.archives, self.importer.files, self.importer.manifest, self.importer.used = [], {}, {}, []
        self.importer.add_archive(vanilla)
        for jar in sorted((instance/'.minecraft/mods').glob('*.jar')):
            self.importer.add_archive(jar)
        self.items = catalog()
        self.rules = {}

    def add(self, registry, meta, texture, evidence, **options):
        if isinstance(texture, str): texture = [texture]
        if not all(t in self.importer.files for t in texture):
            return
        self.rules[f'{registry}@{meta}'] = dict(textures=texture,evidence=evidence,**options)

    def read(self, relative):
        file=ROOT/'.local'/relative
        raw=file.read_text(encoding='utf-8')
        return raw,dict(file=relative,sha256=hashlib.sha256(file.read_bytes()).hexdigest())

    def stevescarts(self):
        base='icon-sources/StevesCarts-2.3.15/vswe/stevescarts/'
        for registry,source,pattern,kind in [
            ('CartModule','ModuleData/ModuleData.java',r'new ModuleData(?:\w*)\((\d+), "([^"]+)"','module'),
            ('ModuleComponents','Helpers/ComponentTypes.java',r'\b[A-Z_0-9]+\((\d+), "([^"]+)"','component'),
            ('upgrade','Upgrades/AssemblerUpgrade.java',r'new AssemblerUpgrade\((\d+), "([^"]+)"','upgrade')]:
            raw,proof=self.read(base+source)
            for meta,name in re.findall(pattern,raw):
                name=name.replace(':','').replace(' ','_').lower()
                if kind=='module':name=name.replace("'",'').replace('-','_')
                if kind=='upgrade':name=name.replace('_upgrade','')
                self.add('StevesCarts:'+registry,int(meta),'assets/stevescarts/textures/items/'+name+'_icon.png',proof)

    def enderio(self):
        base='icon-sources/EnderIO-2.10.51/crazypants/enderio/'
        for registry,source,suffix in [('itemMaterial','material/Material.java',''),
            ('itemMachinePart','material/MachinePart.java',''),('itemPowderIngot','material/PowderIngot.java',''),
            ('itemAlloy','material/Alloy.java',''),('itemGrindingBall','material/Alloy.java','GrindingBall'),
            ('itemAlloyEndergy','material/endergy/AlloyEndergy.java',''),('itemGrindingBallEndergy','material/endergy/AlloyEndergy.java','GrindingBall')]:
            raw,proof=self.read(base+source)
            names=re.findall(r'^    [A-Z_]+\("([^"]+)"',raw,re.M)
            for meta,name in enumerate(names):
                self.add('EnderIO:'+registry,meta,'assets/enderio/textures/items/'+name+suffix+'.png',proof)
        raw,proof=self.read(base+'material/FrankenSkull.java')
        for meta,(name,args) in enumerate(re.findall(r'^    [A-Z_]+\("([^"]+)"([^\n]+)',raw,re.M)):
            override=re.search(r'"enderio:([^"]+)"',args)
            self.add('EnderIO:itemFrankenSkull',meta,'assets/enderio/textures/items/'+(override[1] if override else name)+'.png',proof)
        raw,proof=self.read(base+'power/Capacitors.java')
        for meta,name in enumerate(re.findall(r'^    [A-Z_]+\(new BasicCapacitor\([^\n]+?\), "([^"]+)"',raw,re.M)):
            self.add('EnderIO:itemBasicCapacitor',meta,'assets/enderio/textures/items/'+name+'.png',proof)

    def forestry(self):
        raw,proof=self.read('icon-sources/Forestry-4.11.40/forestry/api/arboriculture/EnumWoodType.java')
        names=re.findall(r'^    ([A-Z]+)(?:\([^\n]*\))?[,;]',raw,re.M)
        for meta,name in enumerate(names):
            texture='assets/forestry/textures/blocks/wood/planks.'+name.lower()+'.png'
            for registry in ('planks','planksFireproof','fences','fencesFireproof','slabs','slabsFireproof'):
                # ItemBlockWood.getWoodType uses the full item damage as ordinal.
                self.add('Forestry:'+registry,meta,texture,proof,shape='fence' if registry.startswith('fence') else 'slab' if registry.startswith('slab') else 'cube')

    def natura(self):
        base='icon-sources/Natura-2.8.24/mods/natura/'
        raw,proof=self.read(base+'blocks/trees/Planks.java')
        names=re.findall(r'"([^"]+)"',re.search(r'textureNames = new String\[\]\{([^}]+)',raw)[1])
        tex='assets/natura/textures/'
        for meta,name in enumerate(names):
            plank=tex+'blocks/'+name+'_planks.png'
            self.add('Natura:planks',meta,plank,proof,shape='cube')
            self.add('Natura:Natura.fence',meta,plank,proof,shape='fence')
            self.add('Natura:natura.stick',meta,tex+'items/'+name+'_stick.png',proof)
            self.add('Natura:plankSlab'+('1' if meta<8 else '2'),meta%8,plank,proof,shape='slab')
            self.add('Natura:Natura.bookshelf',meta,[tex+'blocks/'+name+'_bookshelf.png',plank],proof,shape='cube')
            self.add('Natura:Natura.workbench',meta,[tex+'blocks/'+name+'_workbench_face.png',tex+'blocks/'+name+'_workbench_top.png',tex+'blocks/'+name+'_workbench_side.png'],proof,shape='cube')
        for reg,file,suffix,shape in [
            ('florasapling','blocks/trees/NSaplingBlock.java','_sapling','sprite'),
            ('Rare Sapling','blocks/trees/OverworldSapling.java','_sapling','sprite'),
            ('redwoodDoorItem','items/blocks/NDoorItem.java','_door_item','sprite'),
            ('Cloud','blocks/CloudBlock.java','','cube'),
            ('Glowshroom','blocks/crops/Glowshroom.java','','sprite')]:
            raw,proof=self.read(base+file)
            match=re.search(r'textureNames = new String\[\]\{([^}]+)',raw)
            if reg=='Cloud':match=re.search(r'new String\[\]\{([^}]+)',raw)
            if not match:continue
            for meta,name in enumerate(re.findall(r'"([^"]+)"',match[1])):
                if reg=='Glowshroom':name='mushroom_'+name
                self.add('Natura:'+reg,meta,tex+('items/' if reg=='redwoodDoorItem' else 'blocks/')+name+suffix+'.png',proof,shape=shape)
        for reg,file,offset,stride in [('Dark Tree','DarkTreeBlock',1,2),('Rare Tree','OverworldTreeBlock',1,2),('tree','TreeBlock',4,1)]:
            raw,proof=self.read(base+'blocks/trees/'+file+'.java')
            names=re.findall(r'"([^"]+)"',re.search(r'textureNames = new String\[\]\{([^}]+)',raw)[1])
            for meta in range(2 if reg=='Dark Tree' else 4):
                self.add('Natura:'+reg,meta,[tex+'blocks/'+names[meta*stride]+'.png',tex+'blocks/'+names[meta*stride+offset]+'.png'],proof,shape='cube')

    def projectred(self):
        raw,proof=self.read('icon-sources/ProjRed-4.12.50-GTNH/mrtjp/projectred/core/PartDefs$.java')
        for meta,name in enumerate(re.findall(r'new PartDefs.PartVal\("([^"]+)"\)',raw)):
            self.add('ProjRed|Core:projectred.core.part',meta,'assets/projectred/textures/items/base/'+name+'.png',proof)

    def chisel(self):
        raw,proof=self.read('icon-sources/chisel-2.17.34-GTNH/team/chisel/Features.java')
        for registry,meta,texture in re.findall(r'addVariation\("tile\.([^".]+)\.[^"]*", (\d+), "([^"]+)"\)',raw):
            self.add('chisel:'+registry,int(meta),'assets/chisel/textures/blocks/'+texture+'.png',proof,shape='cube')
        for registry,meta,color in re.findall(r'addVariation\("tile\.([^".]+)\.[^"]*", (\d+), new SubmapManagerCarpetFloor\("([^"]+)"\)',raw):
            self.add('chisel:'+registry,int(meta),'assets/chisel/textures/blocks/carpet/'+color+'.png',proof,shape='slab')
        colors=['white','orange','magenta','lightblue','yellow','lime','pink','gray','lightgray','cyan','purple','blue','brown','green','red','black']
        for registry,folder in [('hempcrete','concrete'),('hempcretesand','sand')]:
            for meta,color in enumerate(colors):
                self.add('chisel:'+registry,meta,'assets/chisel/textures/blocks/hempCrete/'+folder+'/'+color+'.png',proof,shape='cube')

    def tconstruct(self):
        base='gtnh-technology/TConstruct-1.14.123-source/src/main/java/tconstruct/'
        for registry,source,var,shape in [('CraftedSoil','world/blocks/SoilBlock.java','soilTypes','cube'),
            ('MetalBlock','world/blocks/TMetalBlock.java','metalTypes','cube'),
            ('SpeedBlock','smeltery/blocks/SpeedBlock.java','textureNames','cube'),
            ('SpeedSlab','smeltery/blocks/SpeedBlock.java','textureNames','slab')]:
            raw,proof=self.read(base+source)
            match=re.search(var+r'\s*=\s*new String\[\]\s*\{([^}]+)',raw)
            for meta,tex in enumerate(re.findall(r'"([^"]+)"',match[1])):
                self.add('TConstruct:'+registry,meta,'assets/tinker/textures/blocks/'+tex+'.png',proof,shape=shape)
        raw,proof=self.read(base+'smeltery/TinkerSmeltery.java')
        match=re.search(r'stainedGlassClear = new GlassBlockConnectedMeta\((.*?)\)\.setBlockName',raw,re.S)
        colors=re.findall(r'"([^"]+)"',match[1])[1:]
        for meta,color in enumerate(colors):
            self.add('TConstruct:GlassBlock.StainedClear',meta,'assets/tinker/textures/blocks/glass/stained/'+color+'/glass_0.png',proof,shape='cube')
        raw,proof=self.read(base+'smeltery/blocks/SmelteryBlock.java')
        match=re.search(r'textureNames\s*=\s*new String\[\]\s*\{([^}]+)',raw)
        if match:
            names=re.findall(r'"([^"]+)"',match[1])
            for meta,index in enumerate([6,7,8,9,11,12,13,14]):
                self.add('TConstruct:SearedSlab',meta,'assets/tinker/textures/blocks/'+names[index]+'.png',proof,shape='slab')

    def etfuturum(self):
        base='icon-sources/etfuturum-2.6.65-GTNH/ganymedes01/etfuturum/'
        for registry,cls,log in [('wood_stripped','BlockStrippedOldWood',False),('wood2_stripped','BlockStrippedNewWood',False),
            ('log2_stripped','BlockStrippedOldLog',True),('log_stripped','BlockStrippedNewLog',True)]:
            raw,proof=self.read(base+'blocks/'+cls+'.java')
            match=re.search(r'icon_names = new String\[\]\{([^}]+)',raw)
            for meta,name in enumerate(re.findall(r'"([^"]+)"',match[1])):
                texture=['assets/minecraft/textures/blocks/'+name+'.png']
                if log:texture.append('assets/minecraft/textures/blocks/'+name+'_top.png')
                self.add('etfuturum:'+registry,meta,texture,proof,shape='cube')
        # Only resolve single-texture constructors which explicitly bind both
        # the registry name and texture. Multi-face/model classes stay audited.
        folder=ROOT/'.local'/base/'blocks'
        for file in sorted(folder.glob('*.java')):
            raw,proof=self.read(base+'blocks/'+file.name)
            texture=re.findall(r'(?:func_149658_d|setBlockTextureName)\("([^"]+)"\)',raw)
            name=re.findall(r'(?:setNames|setUnlocalizedNameWithPrefix)\("([^"]+)"\)',raw)
            if len(set(texture))==1 and len(set(name))==1 and 'func_149651_a' not in raw:
                domain,tex=texture[0].split(':',1) if ':' in texture[0] else ('minecraft',texture[0])
                self.add('etfuturum:'+name[0],0,'assets/'+domain+'/textures/blocks/'+tex+'.png',proof,shape='cube')

    def singularities(self):
        raw,proof=self.read('gtnh-technology/Universal-Singularities-8.15.4/src/main/java/wealthyturtle/uiesingularities/proxy/CommonProxy.java')
        chunks=re.split(r'new UniversalSingularity\(\s*"([^"]+)"',raw)
        for index in range(1,len(chunks),2):
            group,body=chunks[index:index+2]
            pattern=r'new UniversalSingularityWrapper\(\s*"[^"]+",\s*"[^"]+",\s*\d+,\s*(0x[\da-fA-F]+),\s*(0x[\da-fA-F]+)'
            for meta,(light,dark) in enumerate(re.findall(pattern,body)):
                self.add('universalsingularities:universal.'+group+'.singularity',meta,
                    ['assets/avaritia/textures/items/singularity2.png','assets/avaritia/textures/items/singularity.png'],proof,
                    shape='layers',tints=[int(dark,16),int(light,16)])

    def gregtech(self):
        proof={'registration':'OrePrefixes.rawOre textureIndex 64 / MaterialIconRegistry.IconType.ORE_RAW = /oreRaw; material registered color.'}
        for item in self.items.values():
            data=item.get('native',{})
            if data.get('prefix')=='rawOre':
                for folder in ['CUSTOM/'+data['material'].lower(),data['texture'],'NONE']:
                    path='assets/gregtech/textures/items/materialicons/'+folder+'/oreRaw.png'
                    if path in self.importer.files:
                        self.add('@item:'+item['id'],0,path,proof,tint=int(data['color'],16));break
            if data.get('prefix')=='sheetmetal':
                for folder in ['CUSTOM/'+data['material'].lower(),data['texture'],'NONE']:
                    path='assets/gregtech/textures/blocks/materialicons/'+folder+'/sheetmetal.png'
                    if path in self.importer.files:
                        self.add('@item:'+item['id'],0,path,{'registration':'MaterialIconRegistry SHEETMETAL is a block texture; registered material color.'},tint=int(data['color'],16),shape='cube');break
            if data.get('prefix')=='fluid' and data.get('registry','').startswith('dye.'):
                self.add('@item:'+item['id'],0,'assets/gregtech/textures/blocks/fluids/fluid.dyes.png',
                    {'registration':'GT dye fluid registration uses fluid.dyes, with the registered dye color.'},tint=int(data['color'],16))
            n=item.get('nativeItem',{})
            if n.get('registry')=='gregtech:gt.metaitem.01':
                # MetaGeneratedItem.mOffset=32000. Charged batteries register
                # numbered charge sprites rather than the nonexistent base PNG.
                meta=n.get('meta',0);idx=meta-32000
                raw,source=self.read('icon-sources/gregtech/gregtech/api/items/MetaGeneratedItem.java')
                path=f'assets/gregtech/textures/items/gt.metaitem.01/{idx}/1.png'
                self.add(n['registry'],meta,path,source)

    def binnie(self):
        base='gtnh-technology/binnie-2.6.51/src/main/java/binnie/'
        raw,proof=self.read(base+'extratrees/item/Food.java')
        names=re.findall(r'^    (\w+)\(\d+\)[,;]',raw,re.M)
        for meta,name in enumerate(names):
            self.add('ExtraTrees:food',meta,'assets/extratrees/textures/items/food/'+name+'.png',proof)
        raw,proof=self.read(base+'botany/flower/ItemInsulatedTube.java')
        colors=re.findall(r'^        \w+\((0x[\da-f]+), "[^"]+"\)',raw,re.M)
        materials=[int(c,16) for c in colors[:4]];insulates=[int(c,16) for c in colors[4:]]
        for insulate,c in enumerate(insulates):
            for material,m in enumerate(materials):
                self.add('Botany:insulatedTube',material+128*insulate,
                    ['assets/botany/textures/items/insulatedTube.'+str(i)+'.png' for i in range(3)],proof,
                    shape='layers',tints=[None,m,c])

    def botania(self):
        raw,proof=self.read('gtnh-technology/Botania-1.13.42-GTNH/src/main/java/vazkii/botania/common/lib/LibItemNames.java')
        match=re.search(r'MANA_RESOURCE_NAMES\s*=\s*new String\[\]\s*\{([^}]+)',raw)
        for meta,name in enumerate(re.findall(r'"([^"]+)"',match[1])):
            self.add('Botania:manaResource',meta,'assets/botania/textures/items/'+name+'.png',proof)

    def galacticraft(self):
        base='gtnh-technology/Galacticraft-3.4.37/micdoodle8/mods/galacticraft/'
        for registry,source,domain,prefix in [('GalacticraftCore:item.basicItem','core/items/ItemBasic.java','galacticraftcore','basicItem.'),
            ('GalacticraftMars:item.basicItem','planets/mars/items/ItemBasicMars.java','galacticraftmars',''),
            ('GalacticraftMars:item.basicItemAsteroids','planets/asteroids/items/ItemBasicAsteroids.java','galacticraftasteroids','')]:
            raw,proof=self.read(base+source)
            match=re.search(r'names = new String\[\]\{([^}]+)',raw)
            for meta,name in enumerate(re.findall(r'"([^"]+)"',match[1])):
                self.add(registry,meta,'assets/'+domain+'/textures/items/'+prefix+name+'.png',proof)

    def vanilla(self):
        proof={'registration':'Minecraft 1.7.10 item/block icon names and metadata (vanilla client jar).'}
        mc='assets/minecraft/textures/'
        # Vanilla dye damage runs black -> white; block damage runs white -> black.
        colors=['white','orange','magenta','light_blue','yellow','lime','pink','gray','silver','cyan','purple','blue','brown','green','red','black']
        names={'bow':'bow_standby','bucket':'bucket_empty','water_bucket':'bucket_water','lava_bucket':'bucket_lava','milk_bucket':'bucket_milk','minecart':'minecart_normal','chest_minecart':'minecart_chest','furnace_minecart':'minecart_furnace','tnt_minecart':'minecart_tnt','hopper_minecart':'minecart_hopper','book':'book_normal','written_book':'book_written','writable_book':'book_writable','map':'map_empty','filled_map':'map_filled','glass_bottle':'potion_bottle_empty','wooden_door':'door_wood','iron_door':'door_iron','reeds':'reeds','lead':'lead','fish':'fish_cod_raw','cooked_fished':'fish_cod_cooked','fire_charge':'fireball','speckled_melon':'melon_speckled','slime_ball':'slimeball','golden_apple':'apple_golden','golden_carrot':'carrot_golden','fermented_spider_eye':'spider_eye_fermented','netherbrick':'netherbrick','brewing_stand':'brewing_stand','cauldron':'cauldron'}
        blocks={'lit_pumpkin':['pumpkin_face_on','pumpkin_top','pumpkin_side'],'pumpkin':['pumpkin_face_off','pumpkin_top','pumpkin_side'],'furnace':['furnace_front_off','furnace_top','furnace_side'],'lit_furnace':['furnace_front_on','furnace_top','furnace_side'],'brick_block':['brick'],'quartz_block':['quartz_block_side','quartz_block_top'],'stonebrick':['stonebrick'],'nether_brick':['nether_brick'],'snow':['snow'],'snow_layer':['snow'],'redstone_lamp':['redstone_lamp_off'],'lit_redstone_lamp':['redstone_lamp_on'],'packed_ice':['ice_packed'],'end_stone':['end_stone'],'noteblock':['noteblock'],'jukebox':['jukebox_side','jukebox_top'],'melon_block':['melon_side','melon_top'],'crafting_table':['crafting_table_front','crafting_table_top','crafting_table_side'],'cactus':['cactus_side','cactus_top'],'hay_block':['hay_block_side','hay_block_top'],'iron_bars':['iron_bars'],'glass_pane':['glass'],'ladder':['ladder']}
        for item in self.items.values():
            reg=item.get('nativeItem',{}).get('registry','')
            name=item.get('nativeVanilla') or (reg.split(':',1)[1] if reg.startswith('minecraft:') else None)
            if not name:continue
            meta=item.get('nativeItem',{}).get('meta',0)
            registry=reg or 'minecraft:'+name
            if name in ('wool','stained_hardened_clay','stained_glass','stained_glass_pane','carpet') and 0<=meta<16:
                prefix={'wool':'wool_colored_','carpet':'wool_colored_','stained_hardened_clay':'hardened_clay_stained_','stained_glass':'glass_','stained_glass_pane':'glass_'}[name]
                self.add(registry,meta,mc+'blocks/'+prefix+colors[meta]+'.png',proof,shape='slab' if name=='carpet' else 'cube')
            elif name in ('planks','log','log2','leaves','leaves2','sapling','wooden_slab'):
                woods=['oak','spruce','birch','jungle','acacia','big_oak']
                ix=(meta&3)+(4 if name.endswith('2') else 0)
                if name in ('planks','sapling','wooden_slab'):ix=meta&7
                if ix>=len(woods):continue
                wood=woods[ix]
                tex=('planks_' if name in ('planks','wooden_slab') else 'log_' if name.startswith('log') else 'leaves_' if name.startswith('leaves') else 'sapling_')+wood
                paths=[mc+'blocks/'+tex+'.png']
                if name.startswith('log'):paths.append(mc+'blocks/'+tex+'_top.png')
                self.add(registry,meta,paths,proof,shape='slab' if name=='wooden_slab' else 'sprite' if name=='sapling' else 'cube')
            elif name in blocks:
                self.add(registry,meta,[mc+'blocks/'+t+'.png' for t in blocks[name]],proof,shape='cube')
            else:
                tex=names.get(name,name.replace('golden_','gold_').replace('wooden_','wood_'))
                self.add(registry,meta,mc+'items/'+tex+'.png',proof)
            # Native vanilla IDs need the same registry lookup as imported IDs.
            if item.get('nativeVanilla'):item['_registry']=registry

    def image(self,rule):
        images=[self.importer.sprite(t,rule.get('tints',[rule.get('tint')]*len(rule['textures']))[i]) for i,t in enumerate(rule['textures'])]
        shape=rule.get('shape','sprite')
        if shape=='layers':
            image=images[0]
            for layer in images[1:]:image.alpha_composite(layer.resize(image.size,Image.Resampling.NEAREST))
            return image
        if shape=='cube':return self.importer.cube(images[0],images[1] if len(images)>1 else None,images[2] if len(images)>2 else None)
        if shape=='fence':
            # Two posts and connecting rails, cut from the registered plank texture.
            tile=images[0].resize((16,16),Image.Resampling.NEAREST)
            out=Image.new('RGBA',(16,16))
            for box in [(2,0,5,16),(11,0,14,16),(5,4,11,7),(5,10,11,13)]:out.paste(tile.crop(box),box[:2])
            return out
        if shape=='slab':
            out=self.importer.cube(images[0]);out=out.resize((64,32),Image.Resampling.NEAREST)
            canvas=Image.new('RGBA',(64,64));canvas.alpha_composite(out,(0,24));return canvas
        return images[0]

    def run(self, refresh_rules=False):
        rules_path=ROOT/'scripts/data/icon-repair-rules.json'
        if refresh_rules:
            self.stevescarts();self.enderio();self.forestry();self.vanilla()
            self.natura();self.projectred();self.singularities();self.gregtech()
            self.chisel();self.tconstruct();self.etfuturum()
            self.binnie();self.botania();self.galacticraft()
            rules_path.parent.mkdir(parents=True,exist_ok=True)
            rules_path.write_text(json.dumps(self.rules,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        else:
            self.rules=json.loads(rules_path.read_text(encoding='utf-8'))
        manifest_path=self.output/'sources.json'
        manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
        repaired=[]
        for item in self.items.values():
            key=item.get('icon',item['id'])
            if (self.output/(key+'.svg')).exists():continue
            n=item.get('nativeItem',{})
            registry=n.get('registry') or ('minecraft:'+item['nativeVanilla'] if item.get('nativeVanilla') else None)
            rule=self.rules.get('@item:'+item['id']+'@0') or self.rules.get(f'{registry}@{n.get("meta",0)}')
            if not rule:continue
            self.importer.used=[]
            image=self.image(rule)
            if image.getbbox() is None:raise ValueError('Empty texture for '+item['id'])
            self.importer.save(key,image,'Pinned original GTNH icon; subtype registration verified. No resource pack.')
            self.importer.manifest[key]['registration']=rule['evidence']
            repaired.append(item['id'])
        manifest['icons'].update(self.importer.manifest)
        manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        (ROOT/'.local/icon-repairs.json').write_text(json.dumps(repaired,indent=2)+'\n',encoding='utf-8')
        print(f'Repaired {len(repaired)} missing icons; {len(self.rules)} verified subtype rules.')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--instance',type=Path,default=INSTANCE)
    parser.add_argument('--vanilla',type=Path,default=VANILLA)
    parser.add_argument('--refresh-rules',action='store_true',help='Rebuild the reviewed rules from the local source/decompilation cache.')
    args=parser.parse_args()
    Repair(args.instance,args.vanilla).run(args.refresh_rules)
