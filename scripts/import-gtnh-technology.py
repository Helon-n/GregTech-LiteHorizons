"""Import the pinned production recipes and their machine requirements.

Only literal builders are evaluated. Unresolved expressions are retained in the
coverage manifest. This program never installs a mod or starts Minecraft.
"""
import argparse
import ast
import hashlib
import importlib.util
import itertools
import json
import math
import re
import struct
import zipfile
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('industry', ROOT/'scripts/import-gtnh-industry.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

FORMS = {
    'frameGt': ('Frame', '框架'), 'toolHeadHammer': ('HammerHead', '锤头'), 'toolHeadBuzzSaw': ('BuzzSawHead', '圆锯锯刃'), 'toolHeadDrill': ('DrillHead', '钻头'), 'turbineBlade': ('TurbineBlade', '涡轮叶片'), 'toolHeadChainsaw': ('ChainsawHead', '链锯头'), 'toolHeadWrench': ('WrenchHead', '扳手头'), 'toolHeadFile': ('FileHead', '锉刀头'), 'toolHeadSaw': ('SawHead', '锯刃'), 'toolHeadSword': ('SwordHead', '剑刃'), 'toolHeadPickaxe': ('PickaxeHead', '镐头'), 'toolHeadShovel': ('ShovelHead', '锹头'), 'toolHeadAxe': ('AxeHead', '斧头'), 'toolHeadHoe': ('HoeHead', '锄头'), 'toolHeadPlow': ('PlowHead', '犁头'), 'toolHeadSense': ('ScytheHead', '镰刀头'), 'itemCasing': ('ItemCasing', '外壳'), 'plateDouble': ('DoublePlate', '双层板'), 'plateDense': ('DensePlate', '致密板'),
    'plateTriple': ('TriplePlate', '三层板'), 'plateQuadruple': ('QuadruplePlate', '四层板'),
    'plateQuintuple': ('QuintuplePlate', '五层板'), 'wireFine': ('FineWire', '细导线'),
    'ring': ('Ring', '环'), 'round': ('Round', '滚珠'), 'rotor': ('Rotor', '转子'),
    'gearGt': ('Gear', '齿轮'), 'gearGtSmall': ('SmallGear', '小齿轮'),
    'spring': ('Spring', '弹簧'), 'springSmall': ('SmallSpring', '小弹簧'),
    'lens': ('Lens', '透镜'), 'ingotDouble': ('DoubleIngot', '双锭'),
    'plateSuperdense': ('SuperdensePlate', '超致密板'),
    'pipeQuadruple': ('QuadruplePipe', '四重流体管道'), 'pipeNonuple': ('NonuplePipe', '九重流体管道'),
    'ingotTriple': ('TripleIngot', '三重锭'), 'ingotQuadruple': ('QuadrupleIngot', '四重锭'),
    'ingotQuintuple': ('QuintupleIngot', '五重锭'),
    **{f'{kind}Gt{n:02}': (f'{kind.title()}{n}', f'{n}倍'+('导线' if kind=='wire' else '线缆')) for kind in ('wire','cable') for n in (1,2,4,8,12,16)},
    **{f'pipe{size}': (f'{size}Pipe', label+'流体管道') for size,label in [('Tiny','微型'),('Small','小型'),('Medium','普通'),('Large','大型'),('Huge','巨型')]},
}
FORMS['nanite']=('Nanite','纳米')
FORMS['milled']=('Milled','研磨矿')
for prefix,(suffix,title) in FORMS.items():
    if prefix not in base.SUFFIXES: base.SUFFIXES[prefix]=suffix
    base.TITLES[prefix]=title
base.SUFFIXES['wireGt01']='Wire'
MAPS = {
    **base.MAPS, 'UniversalArcFurnace':'arcFurnace', 'WaferEngravingRecipes':'laser', 'blastFurnaceRecipes':'electricBlast', 'primitiveBlastRecipes':'blast',
    'BlastFurnaceWithGas':'electricBlast', 'alloySmelterRecipes':'alloy',
    'arcFurnaceRecipes':'arcFurnace', 'plasmaArcFurnaceRecipes':'plasmaArc',
    'autoclaveRecipes':'autoclave', 'benderRecipes':'bend', 'latheRecipes':'lathe',
    'wiremillRecipes':'wire', 'wireMillRecipes':'wire', 'extruderRecipes':'extrude',
    'cutterRecipes':'cut', 'cuttingRecipes':'cut', 'laserEngraverRecipes':'laser',
    'formingPressRecipes':'press', 'fluidSolidifierRecipes':'solidify',
    'fluidExtractionRecipes':'melt', 'vacuumFreezerRecipes':'freeze',
    'implosionRecipes':'implode', 'assemblerRecipes':'assemble',
    'circuitAssemblerRecipes':'circuit', 'AssemblyLine':'assemblyLine',
    'fusionRecipes':'fusion', 'plasmaForgeRecipes':'plasmaForge',
    'brewingRecipes':'brew', 'polarizerRecipes':'polarize', 'laserEngraverRecipes':'laser', 'transcendentPlasmaMixerRecipes':'plasmaMix', 'fermentingRecipes':'ferment',
    'fermenterRecipes':'ferment', 'breweryRecipes':'brew', 'compressorRecipes':'electricCompress',
    'hammerRecipes':'forgeHammer', 'forgeHammerRecipes':'forgeHammer',
    'chemicalDehydratorRecipes':'dehydrate', 'alloyBlastSmelterRecipes':'alloyBlast',
    'molecularTransformerRecipes':'molecularTransform', 'cyclotronRecipes':'cyclotron',
    'digesterRecipes':'digest', 'preciseAssemblerRecipes':'preciseAssemble',
    'chemicalPlantRecipes':'chemicalPlant', 'componentAssemblyLineRecipes':'componentAssembly',
    'neutroniumCompressorRecipes':'neutronCompress', 'spaceAssemblerRecipes':'spaceAssemble',
    'cannerRecipes':'canner', 'fluidCannerRecipes':'canner',
    'pyrolyseRecipes':'pyrolyse', 'industrialCokeOvenRecipes':'industrialCoke',
    'quantumForceTransformerRecipes':'quantumTransform', 'pcbFactoryRecipes':'pcbFactory',
    'unpackagerRecipes':'unpack', 'algaePondRecipes':'algaePond',
    'mixerNonCellRecipes':'mix', 'centrifugeNonCellRecipes':'centrifuge',
    'neutronActivatorRecipes':'neutronActivate', 'nanoForgeRecipes':'nanoForge',
    'godforgePlasmaRecipes':'godforgePlasma', 'godforgeMoltenRecipes':'godforgeMolten', 'dissolutionTankRecipes':'dissolve',
    'naquadahFuelRefineFactoryRecipes':'naquadahRefine',
    'reactorProcessingUnitRecipes':'nuclearProcess',
    'multiblockRockBreakerRecipes':'rockBreak',
    'nanochipEncasementWrapper':'nanochipEncasement',
    'nanochipPartProcessorRecipes':'nanochipProcess',
    'packagerRecipes':'pack', 'electrolyzerNonCellRecipes':'electrolyze',
    'chemicalDehydratorNonCellRecipes':'dehydrate', 'simpleWasherRecipes':'simpleWash',
    'vacuumFurnaceRecipes':'vacuumFurnace', 'electricImplosionCompressorRecipes':'electricImplode',
    'fissionFuelProcessingRecipes':'fissionFuel', 'coldTrapRecipes':'coldTrap',
    'spargeTowerRecipes':'sparge', 'amplifierRecipes':'amplify',
    'nanochipConversionRecipes':'nanochipConvert', 'nanochipAssemblyMatrixRecipes':'nanochipAssemble',
    'nanochipBoardProcessorRecipes':'nanochipBoard', 'nanochipEtchingArray':'nanochipEtch',
    'nanochipCuttingChamber':'nanochipCut', 'nanochipWireTracer':'nanochipWire',
    'nanochipSuperconductorSplitter':'nanochipSplit', 'nanochipOpticalOrganizer':'nanochipOptical',
    'nanochipBiologicalCoordinator':'nanochipBio',
    'liquidFluorineThoriumReactorRecipes':'generateLFTR',
    'flotationCellRecipes':'flotation', 'printerRecipes':'print',
    'thermalBoilerRecipes':'thermalBoil',
    'bioLabRecipes':'bioLab',
    'bacterialVatRecipes':'bioVat',
    **dict(zip(['purificationClarifierRecipes','purificationOzonationRecipes','purificationFlocculationRecipes','purificationPhAdjustmentRecipes','purificationPlasmaHeatingRecipes','purificationUVTreatmentRecipes','purificationDegasifierRecipes','purificationParticleExtractionRecipes'],['purify'+str(n) for n in range(1,9)])),
    'Fuel':'registeredFuel', 'dieselFuels':'registeredDiesel', 'gasTurbineFuels':'registeredGas',
    'denseLiquidFuels':'registeredSemiFluid', 'plasmaFuels':'registeredPlasma', 'hotFuels':'registeredHot', 'magicFuels':'registeredMagic', 'acidGenFuels':'registeredAcid',
}
for tier,name in enumerate(('small','large','huge','extreme','ultraHuge'),4):
    MAPS[name+'NaquadahReactorFuels']='generateNaquadah'+str(tier)
ALIASES = {'Circuit_Board_Coated_Basic':'coatedBoard','Circuit_Parts_Resistor':'resistor',
 'Circuit_Parts_Wiring_Basic':'resistor','Circuit_Parts_Vacuum_Tube':'vacuumTube',
 'Circuit_BasicElectronic':'basicCircuit','Electric_Motor_LV':'motor','Electric_Pump_LV':'pump',
 'Circuit_Good':'goodCircuit','Circuit_Advanced':'advancedCircuit',
 'Circuit_Processor':'processor','Circuit_Nanoprocessor':'nanoCircuit',
 'Circuit_Quantumprocessor':'quantumCircuit','Circuit_Crystalprocessor':'crystalCircuit',
 'Circuit_Neuroprocessor':'wetwareCircuit','Circuit_Bioprocessor':'biowareCircuit',
 'Circuit_OpticalProcessor':'opticalCircuit','Circuit_ExoticProcessor':'exoticCircuit',
 'Circuit_CosmicProcessor':'cosmicCircuit','Circuit_TranscendentProcessor':'transcendentCircuit'}

REGISTERED_FLUIDS={
 'lava':('lava','熔岩','assets/minecraft/textures/blocks/lava_still.png'),
 'ic2distilledwater':('distilledWater','蒸馏水','assets/ic2/textures/blocks/fluids/distilledwater_still.png'),
 'squidink':('squidInk','墨汁','assets/gregtech/textures/blocks/fluids/fluid.squidink.png'),
 'ic2superheatedsteam':('superheatedSteam','过热蒸汽','assets/ic2/textures/blocks/fluids/superheatedsteam_still.png'),
 'ic2coolant':('ic2Coolant','IC2 冷却液','assets/ic2/textures/blocks/fluids/coolant_still.png'),
 'ic2hotcoolant':('ic2HotCoolant','IC2 热冷却液','assets/ic2/textures/blocks/fluids/hotcoolant_still.png'),
 'ic2pahoehoelava':('pahoehoeLava','玄武岩熔岩','assets/ic2/textures/blocks/fluids/pahoehoelava_still.png'),
 'supercriticalsteam':('supercriticalSteam','超临界蒸汽','assets/goodgenerator/textures/blocks/fluids/supercriticalSteam.still.png'),
}
VANILLA_GEMS={'Diamond':'diamond','Emerald':'emerald','EnderEye':'ender_eye',
              'EnderPearl':'ender_pearl','NetherQuartz':'quartz','NetherStar':'nether_star'}


def numeric(expression):
    for prefix,amount in [('dust',3628800),('dustSmall',907200),('dustTiny',403200)]:
        expression=expression.replace('OrePrefixes.'+prefix+'.getMaterialAmount()',str(amount))
    expression=expression.replace('MTEPurificationPlant.CYCLE_TIME_TICKS','2400').replace('MTEPurificationUnitOzonation.SUCCESS_PER_OZONE_DOUBLING','20').replace('HeatingCoilLevel.EV.getHeat()','4501')
    expression=expression.replace('GTRecipeBuilder.','')
    expression=expression.replace('GTValues.STEAM_PER_WATER','160')
    expression=re.sub(r'\bEIGHTH_INGOTS\b','18',expression)
    expression=re.sub(r'\bHOURS\b','72000',expression)
    expression=re.sub(r'\bTierEU\.(?!RECIPE_)(\w+)',r'TierEU.RECIPE_\1',expression)
    expression=re.sub(r'GTValues.V\[(\d+)\]',lambda m:str(8*4**int(m[1])),expression)
    expression=re.sub(r'(?<![\w.])RECIPE_(\w+)',r'TierEU.RECIPE_\1',expression)
    for index,tier in enumerate(('ULV','LV','MV','HV','EV','IV','LuV','ZPM','UV','UHV','UEV','UIV','UMV','UXV','MAX')):
        expression=expression.replace('VoltageIndex.'+tier,str(index))
    expression=re.sub(r'GTValues\.VP\[([^\]]+)\]',lambda m:str([7,30,120,480,1920,7680,30720,122880,491520,1966080,7864320,31457280,125829120,503316480,2013265920][int(numeric(m[1]))]),expression)
    functions={'sqrt':math.sqrt,'ceil':math.ceil,'floor':math.floor,'pow':math.pow,'powInt':lambda a,b:int(a)**int(b),'min':min,'max':max,'abs':abs,'log':math.log,'log10':math.log10,'exp':math.exp,'castInt':math.trunc}
    expression=expression.replace('Math.','').replace('GTUtility.powInt','powInt')
    # A Java cast applies only to its next unary expression. Preserve its
    # position: casting an ingredient amount is different from truncating EU/t.
    while re.search(r'\((?:int|long)\)',expression):
        matches=list(re.finditer(r'\((?:int|long)\)\s*',expression));m=matches[-1];start=m.end()
        if expression[start:start+1]=='(':
            end=base.matching(expression,start)+1
        else:
            term=re.match(r'[\w.]+',expression[start:])
            if not term:raise ValueError('unsupported numeric cast '+expression)
            end=start+term.end()
            if expression[end:end+1]=='(':end=base.matching(expression,end)+1
        expression=expression[:m.start()]+'castInt('+expression[start:end]+')'+expression[end:]
    expression=re.sub(r'\b(\d[\d_]*)[lLfFdD]\b',r'\1',expression)
    for key,value in {'MINUTES':1200,'SECONDS':20,'TICKS':1,'INGOTS':144,'HALF_INGOTS':72,'QUARTER_INGOTS':36,'NUGGETS':16,'STACKS':64}.items():
        expression=re.sub(r'\b'+key+r'\b',str(value),expression)
    for index,tier in enumerate(('ULV','LV','MV','HV','EV','IV','LuV','ZPM','UV','UHV','UEV','UIV','UMV','UXV','MAX')):
        expression=expression.replace('TierEU.RECIPE_'+tier,str([7,30,120,480,1920,7680,30720,122880,491520,1966080,7864320,31457280,125829120,503316480,2013265920][index]))
    node=ast.parse(expression.strip(),mode='eval').body
    def walk(n):
        if isinstance(n,ast.Constant) and type(n.value) in (int,float):return n.value
        if isinstance(n,ast.UnaryOp) and isinstance(n.op,(ast.USub,ast.UAdd)):return -walk(n.operand) if isinstance(n.op,ast.USub) else walk(n.operand)
        if isinstance(n,ast.BinOp):
            a,b=walk(n.left),walk(n.right)
            if isinstance(n.op,ast.Add):return a+b
            if isinstance(n.op,ast.Sub):return a-b
            if isinstance(n.op,ast.Mult):return a*b
            if isinstance(n.op,ast.Div):return math.trunc(a/b) if type(a) is int and type(b) is int else a/b
            if isinstance(n.op,ast.Mod):return a-math.trunc(a/b)*b
        if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id in functions and not n.keywords:return functions[n.func.id](*(walk(a) for a in n.args))
        raise ValueError('dynamic number: '+expression[:140])
    value=walk(node)
    if not math.isfinite(value) or abs(value)>2**53:raise ValueError('number outside game limits')
    return value


def scopes_at(text,positions):
    """Lexical block identity prevents method/loop locals leaking to siblings."""
    result={};scope=[];quote=False;escape=False;cursor=0
    for position in sorted(set(positions)):
        for index in range(cursor,position):
            char=text[index]
            if quote:
                if char=='"' and not escape:quote=False
                escape=char=='\\' and not escape
            elif char=='"':quote=True
            elif char=='{':scope.append(index)
            elif char=='}' and scope:scope.pop()
        result[position]=tuple(scope);cursor=position
    return result


def transform_code(text,transform):
    # Registry names and localization strings must not be treated as variables.
    parts=re.split(r'("(?:\\.|[^"\\])*")',text)
    return ''.join(part if index%2 else transform(part) for index,part in enumerate(parts))


class TechnologyImporter(base.Importer):
    def __init__(self,source,instance,core):
        super().__init__(source,instance)
        self.core=core
        self.extra_fuels=[]
        self.material_prefixes=set(base.SUFFIXES)
        self.circuit_items={};self.itemlist={};self.paths={};self.seen=set();self.active_file='';self.constants={}
        self.load_items()
        self.load_casings()
        self.load_machine_items()
        self.load_core_items()
        self.load_addon_materials()
        self.load_chemistry_items()
        self.load_gtpp_fluids()
        self.existing=json.loads((ROOT/'src/data/industry-import.js').read_text(encoding='utf-8').split('=',1)[1].rstrip(';\n'))
        self.items.update(self.existing['items'])
        self.existing_signatures={self.recipe_signature(r) for r in self.existing['recipes']}
        for material in self.materials.values():
            if material['metal'] and 'SMELTING_TO_FLUID' not in material['tags']:material['tags'].append('SMELTING_TO_FLUID')
        self.installed_mods={}
        for jar in sorted((instance/'.minecraft/mods').glob('*.jar')):
            try:
                with zipfile.ZipFile(jar) as archive:
                    if 'mcmod.info' in archive.namelist():
                        info=json.loads(archive.read('mcmod.info').decode('utf-8'))
                        for mod in info if isinstance(info,list) else info.get('modList',[]):
                            self.installed_mods[mod.get('modid','')]=mod.get('version','')
            except (ValueError,KeyError,UnicodeDecodeError): pass
        mods=(self.source/'gregtech/api/enums/Mods.java').read_text(encoding='utf-8')
        ids=dict(re.findall(r'(\w+)\s*=\s*"([^"\n]+)"',mods))
        self.mod_ids={key:ids.get(id,id) for key,id in re.findall(r'^\s*(\w+)\(ModIDs\.(\w+)\)',mods,re.M)}
        self.load_external_aliases()
        self.load_circuit_components()
        addon_spec=importlib.util.spec_from_file_location('addon_items',ROOT/'scripts/gtnh-addon-items.py')
        addon=importlib.util.module_from_spec(addon_spec);addon_spec.loader.exec_module(addon)
        addon.load(self,base.split_args,base.matching,numeric)
        avaritia_spec=importlib.util.spec_from_file_location('avaritia_items',ROOT/'scripts/gtnh-avaritia.py')
        avaritia=importlib.util.module_from_spec(avaritia_spec);avaritia_spec.loader.exec_module(avaritia)
        avaritia.load(self,ROOT)
        path=ROOT/'src/data/ic2-items-reference.json';ic2=json.loads(path.read_text(encoding='utf-8'))
        jar=instance/'.minecraft/mods'/ic2['jar']
        if hashlib.sha256(jar.read_bytes()).hexdigest()!=ic2['sha256']:raise ValueError('IC2 item mapping does not match installed jar')
        self.ic2_items=ic2['entries'];self.ic2_registry_ids={};self.ic2_ids={}
        for key,native in self.ic2_items.items():
            registry=(native['registry'],native['meta'])
            id=self.ic2_registry_ids.setdefault(registry,{'advancedCircuit':'advancedCircuit','electronicCircuit':'basicCircuit','resin':'resin'}.get(key,'ic2_'+key));self.ic2_ids[key]=id
            self.external_item_metadata[registry]=native
        self.paths['instance/mods/'+jar.name]=ic2['sha256'];self.paths['generated/ic2-items-reference.json']=hashlib.sha256(path.read_bytes()).hexdigest()
        gc_spec=importlib.util.spec_from_file_location('gc_items',ROOT/'scripts/gtnh-galacticraft-items.py')
        gc=importlib.util.module_from_spec(gc_spec);gc_spec.loader.exec_module(gc)
        gc.load(self,ROOT)
        glass_spec=importlib.util.spec_from_file_location('bw_glass',ROOT/'scripts/gtnh-bartworks-glass.py')
        glass=importlib.util.module_from_spec(glass_spec);glass_spec.loader.exec_module(glass)
        glass.load(self,base.split_args,base.matching)
        bio_spec=importlib.util.spec_from_file_location('biochemistry',ROOT/'scripts/gtnh-biochemistry.py')
        self.biochemistry=importlib.util.module_from_spec(bio_spec);bio_spec.loader.exec_module(self.biochemistry)
        self.biochemistry.load(self,ROOT,REGISTERED_FLUIDS,base.split_args,base.matching)
        # Backwards-compatible ItemList names often refer to the same physical
        # stack. Keep one ID per known registry/metadata, preferring established
        # application IDs. Otherwise output and input can become disconnected.
        self.itemlist_registry_ids={}
        for key,native in sorted(self.itemlist.items(),key=lambda row:(row[0] not in ALIASES,row[0])):
            if native.get('meta') is not None and not native.get('nbt'):self.itemlist_registry_ids.setdefault((native['registry'],native['meta']),ALIASES.get(key,'gtItem_'+key))

    def load_circuit_components(self):
        path=self.source/'gregtech/common/tileentities/machines/multi/nanochip/util/CircuitComponent.java'
        text=path.read_text(encoding='utf-8');self.components={}
        for match in re.finditer(r'^\s*(\w+)\(\s*(\d+),\s*"([^"]+)"',text,re.M):
            start=text.index('(',match.start());end=base.matching(text,start);args=base.split_args(text[start+1:end])
            self.components[match[1]]={'meta':int(match[2]),'name':self.lang.get(match[3],match[1]),'args':args[2:]}
        self.paths[str(path.relative_to(self.source))]=hashlib.sha256(path.read_bytes()).hexdigest()

    def circuit_component(self,key):
        component=self.components.get(key)
        if not component:raise ValueError('unknown circuit component '+key)
        id='nanoComponent_'+key
        if id in self.items:return id
        processed='true' in component['args'] or not any('->' in arg for arg in component['args'])
        native={'registry':'gregtech:fakecircuitcomponent','meta':component['meta'],
          'texture':'assets/gregtech/textures/items/gt.circuitcomponent/'+('processed/' if processed else '')+key.lower()+'.png'}
        item={'id':id,'name':component['name'],'kind':'item','category':'纳米芯片材料','nativeItem':native}
        self.items[id]=item
        if not processed:
            supplier=next((arg.split('->',1)[1].strip() for arg in component['args'] if '->' in arg),None)
            if supplier:
                try:
                    raw=self.stack(supplier)
                    if raw:item['icon']=self.items[raw[0]].get('icon',raw[0])
                except (ValueError,SyntaxError,KeyError):pass
        return id

    def load_external_aliases(self):
        self.external_aliases={}
        path=self.source/'gregtech/common/GTProxy.java'
        text=path.read_text(encoding='utf-8')
        for match in re.finditer(r'ItemList\.(\w+)\.set\(\s*(?:GTModHandler\.)?getModItem\(',text):
            start=text.index('getModItem(',match.start())+len('getModItem');end=base.matching(text,start)
            self.external_aliases[match[1]]=text[start-len('getModItem'):end+1]
        for match in re.finditer(r'ItemList\.(\w+)\.set\(GTModHandler\.getIC2Item\("(\w+)",\s*1L?\)\)',text):
            self.external_aliases[match[1]]='GTModHandler.getIC2Item("'+match[2]+'",1)'
        self.paths[str(path.relative_to(self.source))]=hashlib.sha256(path.read_bytes()).hexdigest()

    def load_items(self):
        for group in ('01','02','03'):
            enum=self.source/f'gregtech/common/items/IDMetaItem{group}.java'
            path=self.source/f'gregtech/common/items/MetaGeneratedItem{group}.java'
            if not enum.exists() or not path.exists():continue
            ids=dict(re.findall(r'^\s*(\w+)\((\d+)\)',enum.read_text(encoding='utf-8'),re.M))
            text=path.read_text(encoding='utf-8')
            text=re.sub(r'/\*.*?\*/|//[^\n]*',lambda m:'\n'*m[0].count('\n'),text,flags=re.S)
            self.paths[str(path)]=hashlib.sha256(path.read_bytes()).hexdigest()
            for m in re.finditer(r'ItemList\.(\w+)\s*\.set\(\s*addItemWithLocalizationKeys(?:AndArgs)?\(\s*(?:IDMetaItem\d+\.)?(\w+)\.ID,\s*"([^"\n]+)"',text):
                if m[2] not in ids:continue
                self.itemlist[m[1]]={'name':self.lang.get(m[3],m[1].replace('_',' ')),
                    'texture':f'assets/gregtech/textures/items/gt.metaitem.{group}/{ids[m[2]]}.png',
                    'registry':f'gregtech:gt.metaitem.{group}', 'meta':32000+int(ids[m[2]])}
            for m in re.finditer(r'ItemList\.(\w+)\s*\.set\(\s*addItem\(\s*(?:IDMetaItem\d+\.)?(\w+)\.ID,\s*\$\s*->\s*StatCollector.translateToLocal\("([^"\n]+)"\)',text):
                if m[2] in ids:
                    self.itemlist[m[1]]={'name':self.lang.get(m[3],m[1].replace('_',' ')),
                        'texture':f'assets/gregtech/textures/items/gt.metaitem.{group}/{ids[m[2]]}.png',
                        'registry':f'gregtech:gt.metaitem.{group}','meta':32000+int(ids[m[2]])}
            for match in re.finditer(r'ItemList\.(\w+)\s*\.set\(',text):
                end=base.matching(text,match.end()-1);body=text[match.end():end]
                tier=re.search(r'OrePrefixes.circuit.get\(Materials\.(\w+)\)',body)
                if tier and match[1] in self.itemlist:self.circuit_items.setdefault(tier[1],[]).append(match[1])
            for m in re.finditer(r'ItemList\.(\w+)\.set\(ItemList\.(\w+)\.get\(1\)\)',text):
                if m[2] in self.itemlist:self.itemlist[m[1]]=self.itemlist[m[2]]

    def load_casings(self):
        directory=self.source/'gregtech/common/blocks'
        for path in [*directory.glob('BlockCasings*.java'),*directory.glob('BlockGlass*.java')]:
            text=path.read_text(encoding='utf-8');group=re.search(r'"(gt.block(?:casings|glass)\w*)"',text)
            if not group:continue
            icons={int(meta):icon for meta,icon in re.findall(r'case (\d+) -> Textures.BlockIcons\.(\w+)\.getIcon\(\)',text)}
            self.paths[str(path.relative_to(self.source)).replace('\\','/')]=hashlib.sha256(path.read_bytes()).hexdigest()
            for meta,key in re.findall(r'register\((\d+),\s*ItemList\.(\w+)(?:\)|,)',text):
                texture='MACHINE_CASING_SOLID_STEEL'
                if key.startswith('Casing_Coil_'):texture='MACHINE_COIL_'+key.removeprefix('Casing_Coil_').upper()
                if int(meta) in icons:texture=icons[int(meta)]
                self.itemlist[key]={'name':self.lang.get(group[1]+'.'+meta+'.name',key.replace('_',' ')),
                    'texture':'assets/gregtech/textures/blocks/iconsets/'+texture+'.png','registry':'gregtech:'+group[1],'meta':int(meta)}
        # Real tier hulls are GT tile entities, distinct from battery hulls.
        for tier in ('ULV','LV','MV','HV','EV','IV','LuV','ZPM','UV','UHV','UEV','UIV','UMV','UXV','MAX'):
            key='Hull_'+tier
            self.itemlist[key]={'name':tier+' 机器外壳','texture':'assets/gregtech/textures/blocks/iconsets/MACHINE_CASING_SOLID_STEEL.png','registry':'gregtech:machine','meta':None}
        path=self.source/'gregtech/common/blocks/BlockReinforced.java'
        text=path.read_text(encoding='utf-8')
        icons={int(meta):icon for meta,icon in re.findall(r'case (\d+) -> Textures.BlockIcons\.(\w+)\.getIcon\(\)',text)}
        for match in re.finditer(r'ItemList\.(\w+)\.set\(\s*new ItemStack\(',text):
            start=text.index('(',text.index('new ItemStack',match.start()));end=base.matching(text,start);args=base.split_args(text[start+1:end])
            if len(args)!=3:continue
            meta=int(numeric(args[2]));texture='assets/gregtech/textures/blocks/iconsets/'+icons[meta]+'.png' if meta in icons else 'assets/minecraft/textures/blocks/coal_block.png'
            self.itemlist[match[1]]={'name':self.lang.get('gt.blockreinforced.'+str(meta)+'.name',match[1].replace('_',' ')),'registry':'gregtech:gt.blockreinforced','meta':meta,'texture':texture}
        self.paths[str(path.relative_to(self.source))]=hashlib.sha256(path.read_bytes()).hexdigest()

    def load_machine_items(self):
        ids_path=self.source/'gregtech/api/enums/MetaTileEntityIDs.java'
        ids={key:numeric(value) for key,value in re.findall(r'^\s*(\w+)\(([\d_]+)\)',ids_path.read_text(encoding='utf-8'),re.M)}
        self.paths[str(ids_path.relative_to(self.source))]=hashlib.sha256(ids_path.read_bytes()).hexdigest()
        self.machine_items={}
        for path in self.source.rglob('*.java'):
            text=path.read_text(encoding='utf-8')
            if '.set(' not in text or not re.search(r'(?:ItemList|GregtechItemList)\.',text):continue
            for match in re.finditer(r'(ItemList|GregtechItemList)\.(\w+)\s*\.set\(',text):
                try:end=base.matching(text,match.end()-1)
                except ValueError:continue
                body=text[match.end():end]
                registration=re.search(r'(?:new\s+(\w+)\s*\(|MTEBasicMachineWithRecipeBuilder\.builder\()\s*(?:MetaTileEntityIDs\.)?(\w+)\.ID',body)
                if not registration:continue
                meta=ids.get(registration[2]);title=re.findall(r'"([^"\n]+)"',body)
                if meta is None:continue
                name=title[1] if len(title)>1 else match[2].replace('_',' ')
                # Stable machine identity comes from the pinned registration;
                # the UI sprite is resolved separately from the matching overlay.
                native={'name':self.lang.get('gt.blockmachines.'+(title[0] if title else '')+'.name',name),'registry':'gregtech:gt.blockmachines','meta':meta,
                  'texture':'assets/gregtech/textures/blocks/iconsets/MACHINE_CASING_SOLID_STEEL.png'}
                self.machine_items[match[1]+'.'+match[2]]=native
                if match[1]=='ItemList':self.itemlist[match[2]]=native
                self.paths[str(path.relative_to(self.source)).replace('\\','/')]=hashlib.sha256(path.read_bytes()).hexdigest()

    def load_core_items(self):
        self.core_items={}
        self.core_blocks={}
        jar=next((self.instance/'.minecraft/mods').glob('GTNewHorizonsCoreMod-*.jar'),None)
        if jar:
            with zipfile.ZipFile(jar) as archive:
                language={}
                for path in ('assets/dreamcraft/lang/en_US.lang','assets/dreamcraft/lang/zh_CN.lang'):
                    if path in archive.namelist():
                        for line in archive.read(path).decode('utf-8').splitlines():
                            if '=' in line and not line.startswith('#'):
                                k,v=line.split('=',1);language[k]=v
                self.core_lang=language
        path=self.core/'com/dreammaster/item/NHItemList.java'
        if path.exists():
            text=path.read_text(encoding='utf-8')
            for key,registry in re.findall(r'^\s*(\w+)\("([^"\n]+)"',text,re.M):
                self.core_items[key]={'name':getattr(self,'core_lang',{}).get('item.'+registry+'.name',registry),
                   'registry':'dreamcraft:'+registry,'meta':0,
                   'texture':'assets/dreamcraft/textures/items/item'+registry+'.png'}
        path=self.core/'com/dreammaster/block/BlockList.java'
        if path.exists():
            text=path.read_text(encoding='utf-8');self.paths['NewHorizonsCoreMod/com/dreammaster/block/BlockList.java']=hashlib.sha256(path.read_bytes()).hexdigest()
            for key,registry in re.findall(r'^\s*(\w+)\("([^"\n]+)"',text,re.M):
                self.core_blocks[key]={'name':getattr(self,'core_lang',{}).get('tile.'+registry+'.name',registry),
                  'registry':'dreamcraft:'+registry,'meta':0,'texture':'assets/dreamcraft/textures/blocks/block'+registry+'.png'}

    def load_addon_materials(self):
        self.addon_materials={};self.addon_meta={}
        for namespace,file in [('WerkstoffLoader','bartworks/system/material/WerkstoffLoader.java'),('GGMaterial','goodgenerator/items/GGMaterial.java'),('WerkstoffMaterialPool','gtnhlanth/common/register/WerkstoffMaterialPool.java'),('BotWerkstoffMaterialPool','gtnhlanth/common/register/BotWerkstoffMaterialPool.java')]:
            path=self.source/file;text=path.read_text(encoding='utf-8')
            text=re.sub(r'/\*.*?\*/|//[^\n]*',lambda m:'\n'*m[0].count('\n'),text,flags=re.S)
            offsets={}
            for name,value in re.findall(r'(?:static\s+)?final\s+int\s+(\w+)\s*=\s*([^;]+);',text):
                try:offsets[name]=str(numeric(value))
                except (ValueError,SyntaxError):pass
            for m in re.finditer(r'(?:public\s+)?static\s+final\s+Werkstoff\s+(\w+)\s*=\s*new\s+Werkstoff\(',text):
                end=base.matching(text,m.end()-1);body=text[m.end():end]
                args=base.split_args(body)
                color=re.fullmatch(r'new\s+short\[\]\s*\{([^}]+)\}',args[0])
                name=re.fullmatch(r'"([^"]+)"',args[1]) if len(args)>1 else None
                if not name:continue
                inherited=re.fullmatch(r'Materials\.(\w+)\.getRGBA\(\)',args[0])
                try:rgb=[int(numeric(v)) for v in base.split_args(color[1])][:3] if color else [int(self.materials[inherited[1]]['color'][n:n+2],16) for n in (0,2,4)] if inherited else []
                except (ValueError,SyntaxError,KeyError):continue
                if len(rgb)!=3:continue
                key=namespace+'_'+m[1];self.addon_materials[namespace+'.'+m[1]]=key
                for arg in reversed(args):
                    expression=arg
                    for offset_name,value in offsets.items():expression=re.sub(r'\b'+re.escape(offset_name)+r'\b',value,expression)
                    try:
                        meta=numeric(expression)
                        if type(meta) is int:self.addon_meta[meta]=key;break
                    except (ValueError,SyntaxError,ZeroDivisionError):pass
                texture=re.search(r'TextureSet.SET_(\w+)',body)
                self.materials[key]={'id':key,'registry':name[1].replace(' ','').lower(),'name':name[1],
                  'texture':texture[1] if texture else 'DULL','color':''.join(f'{v:02x}' for v in rgb),
                  'ore':False,'metal':False,'dust':True,'cell':True,'plasma':False,'gems':False,
                  'oreMultiplier':1,'smelting':key,'blast':False,'fluid':True,'macerating':key,
                  'byproducts':[],'tags':[],'line':text.count('\n',0,m.start())+1,'processingEU':0,
                  'defaultDensity':False,'element':None,'components':[],'cracking':False,'decomposition':None}
            # Compatibility fields refer to the same registered Werkstoff.
            # In particular CeriumOreConcentrate aliases CeriumRichMixture.
            for alias,target in re.findall(r'(?:public\s+)?static\s+final\s+Werkstoff\s+(\w+)\s*=\s*(\w+)\s*;',text):
                if namespace+'.'+target in self.addon_materials:
                    self.addon_materials[namespace+'.'+alias]=self.addon_materials[namespace+'.'+target]
            self.paths[file]=hashlib.sha256(path.read_bytes()).hexdigest()
        self.load_gtpp_materials()

    def load_gtpp_materials(self):
        # Resolve GT++'s literal material definitions and their GT aliases. RGB
        # mixing follows Material.getRGBColorForMat: unique recursive elements,
        # not mass-weighted percentages. Unknown definitions remain unresolved.
        definitions={};aliases={};self.gtpp_states={}
        for path in (self.source/'gtPlusPlus/core/material').rglob('*.java'):
            text=path.read_text(encoding='utf-8')
            text=re.sub(r'/\*.*?\*/|//[^\n]*',lambda m:'\n'*m[0].count('\n'),text,flags=re.S)
            namespace=path.stem
            for m in re.finditer(r'(?:public\s+)?(?:static\s+)?(?:final\s+)?Material\s+(\w+)\s*=\s*',text):
                start=m.end();key=namespace+'.'+m[1]
                if namespace=='MaterialsElements' and 'class STANDALONE' in text[:start]:key='MaterialsElements.STANDALONE.'+m[1]
                alias=re.match(r'MaterialUtils\s*\.\s*generateMaterialFromGtENUM\(Materials\.(\w+)(?:\)|\s*,\s*TextureSet\.SET_\w+\))',text[start:])
                if alias:aliases[key]=alias[1];continue
                if not text[start:].startswith('new Material('):continue
                begin=start+len('new Material');end=base.matching(text,begin)
                args=base.split_args(text[begin+1:end])
                if len(args)<2 or not re.fullmatch(r'"[^"]+"',args[0]):continue
                definitions[key]=(args,namespace,text.count('\n',0,start)+1)
                self.paths[str(path.relative_to(self.source)).replace('\\','/')]=hashlib.sha256(path.read_bytes()).hexdigest()
        self.gtpp_materials=dict(aliases)
        # The pinned Elements constructor explicitly assigns these final
        # fields. They are aliases of GT Trinium, not new alloy definitions.
        path=self.source/'gtPlusPlus/core/material/MaterialsElements.java'
        constructor=re.search(r'public MaterialsElements\(\)\s*\{([^}]+)\}',path.read_text(encoding='utf-8'))
        if constructor:
            for field,core in re.findall(r'(\w+)\s*=\s*MaterialUtils\.generateMaterialFromGtENUM\(Materials\.(\w+)\);',constructor[1]):
                aliases['MaterialsElements.'+field]=core
            for field,target in re.findall(r'(\w+)\s*=\s*(\w+)\s*;',constructor[1]):
                if 'MaterialsElements.'+target in aliases:aliases['MaterialsElements.'+field]=aliases['MaterialsElements.'+target]
            self.gtpp_materials.update(aliases)
            self.paths[str(path.relative_to(self.source)).replace('\\','/')]=hashlib.sha256(path.read_bytes()).hexdigest()
        core_material_source=(self.source/'gregtech/loaders/materials/MaterialsInit.java').read_text(encoding='utf-8')
        for key in aliases.values():
            if key in self.materials:
                body=re.search(r'private static Materials load'+re.escape(key)+r'\(\)\s*\{(.*?)(?=\n    private static|\Z)',core_material_source,re.S)
                if body:
                    body=body[1]
                    # MaterialUtils checks molten/solid before liquid/gas,
                    # and defaults powders without fluids to SOLID.
                    self.gtpp_states[key]='SOLID' if self.materials[key]['metal'] or 'SMELTING_TO_FLUID' in self.materials[key]['tags'] or '.addSolid()' in body else 'LIQUID' if '.addFluid()' in body else 'GAS' if '.addGas()' in body else 'SOLID'
        leaves={key:{value} for key,value in aliases.items()}
        def resolve(key,visited=frozenset()):
            if key in self.gtpp_materials:return self.gtpp_materials[key]
            if key in visited or key not in definitions:return None
            args,namespace,line=definitions[key];name=args[0][1:-1]
            components=[];component_leaves=set()
            component_args=[]
            for arg in args:
                if re.fullmatch(r'new\s+MaterialStack\[\]\s*\{.*\}',arg,re.S):
                    component_args.extend(base.split_args(arg[arg.index('{')+1:arg.rindex('}')]))
                else:component_args.append(arg)
            for arg in component_args:
                match=re.fullmatch(r'new\s+MaterialStack\((.*)\)',arg,re.S)
                if not match:continue
                parts=base.split_args(match[1]);ref=re.sub(r'\s+','',parts[0]).replace('MaterialsElements.getInstance().','MaterialsElements.').replace('getInstance().',namespace+'.')
                if '.' not in ref:ref=namespace+'.'+ref
                material=resolve(ref,visited|{key})
                if not material:
                    core=ref.removeprefix('Materials.')
                    if core in self.materials:material=core
                    else:return None
                try:amount=numeric(parts[1])
                except (ValueError,SyntaxError):return None
                components.append((material,amount));component_leaves|=leaves.get(ref,{material})
            color_arg=next((arg for arg in args[2:] if re.fullmatch(r'new\s+short\[\]\s*\{[^}]+\}',arg,re.S)),None)
            inherited=next((re.fullmatch(r'Materials\.(\w+)\.mRGBa',arg) for arg in args if re.fullmatch(r'Materials\.(\w+)\.mRGBa',arg)),None)
            if color_arg:
                try:rgb=[numeric(n) for n in base.split_args(color_arg[color_arg.index('{')+1:color_arg.rindex('}')])][:3]
                except (ValueError,SyntaxError):return None
            elif inherited:
                color=self.materials[inherited[1]]['color'];rgb=[int(color[i:i+2],16) for i in (0,2,4)]
            elif component_leaves:
                colors=[self.materials[k]['color'] for k in component_leaves]
                rgb=[sum(int(c[i:i+2],16) for c in colors)//len(colors) for i in (0,2,4)]
                if 0 in rgb:rgb=[int(self.materials['Steel']['color'][i:i+2],16) for i in (0,2,4)]
            else:rgb=[int(self.materials['Steel']['color'][i:i+2],16) for i in (0,2,4)]
            material_id='GTPP_'+re.sub(r'[^A-Za-z0-9]','',name)
            texture_arg=next((re.search(r'TextureSet.SET_(\w+)',a)[1] for a in args if re.search(r'TextureSet.SET_(\w+)',a)),None)
            gem=sum(k in ('Aer','Aqua','Ignis','Terra','Magic') for k,n in components)
            shiny=sum(k in ('Gold','Silver','Platinum','Titanium','Germanium','Gallium','Mercury','Magic','Samarium','Tantalum') for k,n in components)
            textures=Counter(self.materials[k]['texture'] for k,n in components)
            texture=texture_arg or ('GEM_HORIZONTAL' if gem%2==0 else 'GEM_VERTICAL') if gem>=len(components)//2 else texture_arg or 'SHINY' if shiny>=len(components)//3 else texture_arg or (textures.most_common(1)[0][0] if textures else self.materials['Gold']['texture'])
            self.gtpp_states[material_id]=args[1]
            self.materials[material_id]={'id':material_id,'registry':re.sub(r'[^A-Za-z0-9]','',name),'name':name,
                'texture':texture,'color':''.join(f'{int(v):02x}' for v in rgb),'ore':False,'metal':False,'dust':True,'cell':True,
                'plasma':False,'gems':False,'oreMultiplier':1,'smelting':material_id,'blast':False,'fluid':True,'macerating':material_id,
                'byproducts':[],'tags':[],'line':line,'processingEU':0,'defaultDensity':False,'element':None,'components':components,
                'cracking':False,'decomposition':None}
            self.gtpp_materials[key]=material_id;leaves[key]=component_leaves or {material_id}
            return material_id
        for key in definitions:resolve(key)
        self.gtpp_definitions=definitions

    def load_chemistry_items(self):
        self.chemistry_items={}
        path=self.source/'gtPlusPlus/core/item/ModItems.java'
        text=path.read_text(encoding='utf-8')
        for key,group,meta in re.findall(r'GregtechItemList\.(\w+)\s*\.set\(new ItemStack\((genericChemItem|agrichemItem),\s*1,\s*(\d+)\)\)',text):
            registry='BasicGenericChemItem' if group=='genericChemItem' else 'BasicAgrichemItem'
            folder='science/general/MetaItem1' if group=='genericChemItem' else 'bioscience/MetaItem1'
            self.chemistry_items[key]={'name':key.replace('_',' '),'texture':f'assets/miscutils/textures/items/{folder}/{meta}.png','registry':'miscutils:item.'+registry,'meta':int(meta)}
        # Agrichem meta items are registered by ModItems rather than the
        # generic item table; preserve their stable registry and metadata.
        for key,meta in re.findall(r'GregtechItemList\.((?:\w+)?AlgaeBiomass)\.set\(new ItemStack\(agrichemItem(?:,\s*1,\s*(\d+))?\)', text):
            self.chemistry_items[key]={'name':key.replace('_',' '),'texture':f'assets/miscutils/textures/items/bioscience/MetaItem1/{int(meta or 0)}.png','registry':'miscutils:item.agrichemItem','meta':int(meta or 0)}
        meta_path=self.source/'gtPlusPlus/xmod/gregtech/common/items/MetaGeneratedGregtechItems.java'
        meta_text=meta_path.read_text(encoding='utf-8')
        ids=dict(re.findall(r'^\s*(\w+)\(([\d_]+)\)',(meta_path.parent/'MetaGeneratedItemIDs.java').read_text(encoding='utf-8'),re.M))
        for key,enum,title in re.findall(r'GregtechItemList\.(\w+)\s*\.set\(\s*this\.addItem(?:WithNameKey)?\(\s*(\w+)\.ID,\s*"([^"\n]+)"',meta_text):
            if enum not in ids:continue
            meta=int(numeric(ids[enum]));self.chemistry_items[key]={'name':title,'registry':'miscutils:MU-metaitem.01','meta':32000+meta,'texture':f'assets/miscutils/textures/items/MU-metaitem.01/{meta}.png'}
        for key,registry,texture in re.findall(r'GregtechItemList\.(\w+)\.set\(\s*new CoreItem\("([^"]+)"[^;]+?\.setTextureName\(GTPlusPlus.ID\s*\+\s*":([^"]+)"\)\)',text,re.S):
            self.chemistry_items[key]={'name':key.replace('_',' '),'registry':'miscutils:'+registry,'meta':0,'texture':'assets/miscutils/textures/items/'+texture+'.png'}
        for match in re.finditer(r'Item\[\]\s+(\w+)\s*=\s*ItemUtils\s*\.generateSpecialUseDusts\(\s*"([^"]+)",\s*"([^"]+)"[^;]+?Utils.rgbtoHexValue\((\d+),\s*(\d+),\s*(\d+)\)\)',text):
            var,registry,title,r,g,b=match.groups()
            for key,index in re.findall(r'GregtechItemList\.(\w+)\.set\('+re.escape(var)+r'\[(\d)\]\)',text):
                prefix=['Dust','DustSmall','DustTiny'][int(index)];color=''.join(f'{int(v):02x}' for v in (r,g,b))
                self.chemistry_items[key]={'name':title+' '+prefix,'registry':'miscutils:item'+prefix+registry,'meta':0,'color':color,'texture':'assets/gregtech/textures/items/materialicons/SHINY/'+{'Dust':'dust','DustSmall':'dustSmall','DustTiny':'dustTiny'}[prefix]+'.png'}
        blocks=self.source/'gtPlusPlus/core/block/ModBlocks.java'
        block_source=(self.source/'gtPlusPlus/core/block/general/BlockCompressedObsidian.java').read_text(encoding='utf-8')
        textures=dict(re.findall(r'textureArray\[(\d+)\]\s*=\s*iicon.registerIcon\(GTPlusPlus.ID\s*\+\s*":([^"]+)"',block_source))
        for key,meta in re.findall(r'GregtechItemList\.(\w+)\.set\(new ItemStack\(compressedObsidian(?:,\s*1,\s*(\d+))?\)\)',blocks.read_text(encoding='utf-8')):
            meta=meta or '0'
            self.chemistry_items[key]={'name':key,'registry':'miscutils:blockCompressedObsidian','meta':int(meta),'texture':'assets/miscutils/textures/blocks/'+textures[meta]+'.png'}
        for path in (self.source/'gtPlusPlus/core/item/ModItems.java',meta_path,meta_path.parent/'MetaGeneratedItemIDs.java',blocks):
            self.paths[str(path.relative_to(self.source))]=hashlib.sha256(path.read_bytes()).hexdigest()

    def load_gtpp_fluids(self):
        self.gtpp_fluids={}
        path=self.source/'gtPlusPlus/core/fluids/GTPPFluids.java'
        text=path.read_text(encoding='utf-8')
        colors={name:material for name,material in re.findall(r'short\[\]\s+(\w+)\s*=\s*Materials\.(\w+)\.mRGBa',text)}
        for m in re.finditer(r'(\w+)\s*=\s*FluidUtils\s*\.\s*(?:addGtFluid|addGTFluidNoPrefix|generateFluidNoPrefix|generateFluidNonMolten)\(',text):
            end=base.matching(text,m.end()-1);args=base.split_args(text[m.end():end])
            if len(args)<4 or not re.fullmatch(r'"[^"]+"',args[0]) or not re.fullmatch(r'"[^"]+"',args[1]):continue
            color=next((a for a in args if re.fullmatch(r'new\s+short\[\]\s*\{[^}]+\}',a,re.S)),None)
            if not color:continue
            try:
                rgb=[]
                for expression in base.split_args(color[color.index('{')+1:color.rindex('}')])[:3]:
                    inherited=re.fullmatch(r'(\w+)\[(\d)\]',expression.strip())
                    if inherited:
                        material=self.materials[colors[inherited[1]]];i=int(inherited[2])*2
                        rgb.append(int(material['color'][i:i+2],16))
                    else:rgb.append(numeric(expression))
            except (ValueError,SyntaxError,KeyError):continue
            key='GTPPFluid_'+m[1]
            self.materials[key]={'id':key,'registry':args[0][1:-1],'name':args[1][1:-1],'texture':'FLUID',
              'color':''.join(f'{int(v):02x}' for v in rgb),'ore':False,'metal':False,'dust':False,'cell':True,'plasma':False,'gems':False,
              'oreMultiplier':1,'smelting':key,'blast':False,'fluid':True,'macerating':key,'byproducts':[],'tags':[],
              'line':text.count('\n',0,m.start())+1,'processingEU':0,'defaultDensity':False,'element':None,'components':[],'cracking':False,'decomposition':None}
            self.gtpp_fluids[m[1]]=key
        self.bw_fluids={}
        path=self.source/'bartworks/common/loaders/FluidLoader.java'
        for field,name,r,g,b in re.findall(r'(\w+)\s*=\s*createAndRegisterFluid\("([^"]+)",\s*new Color\((\d+),\s*(\d+),\s*(\d+)\)',path.read_text(encoding='utf-8')):
            key='FluidLoader_'+field;self.bw_fluids[field]=key
            self.materials[key]={'id':key,'registry':name,'name':name,'texture':'FLUID','color':''.join(f'{int(v):02x}' for v in (r,g,b)),
              'ore':False,'metal':False,'dust':False,'cell':True,'plasma':False,'gems':False,'oreMultiplier':1,'smelting':key,'blast':False,'fluid':True,'macerating':key,'byproducts':[],'tags':[],'line':0,'processingEU':0,'defaultDensity':False,'element':None,'components':[],'cracking':False,'decomposition':None}
        self.paths[str(path.relative_to(self.source))]=hashlib.sha256(path.read_bytes()).hexdigest()
        # Brine is registered from the MaterialMisc object at runtime rather
        # than as a field in GTPPFluids.java.
        if 'BRINE' not in self.gtpp_fluids:
            key='GTPPFluid_Brine';self.gtpp_fluids['BRINE']=key
            self.materials[key]={'id':key,'registry':'brine','name':'卤水','texture':'FLUID','color':'9aa9b8',
              'ore':False,'metal':False,'dust':False,'cell':True,'plasma':False,'gems':False,'oreMultiplier':1,
              'smelting':key,'blast':False,'fluid':True,'macerating':key,'byproducts':[],'tags':[],'line':0,
              'processingEU':0,'defaultDensity':False,'element':None,'components':[],'cracking':False,'decomposition':None}

    def named(self,key):
        native=self.itemlist.get(key)
        if not native:raise ValueError('unresolved ItemList.'+key)
        id=ALIASES.get(key,'gtItem_'+key) if native.get('nbt') else getattr(self,'itemlist_registry_ids',{}).get((native['registry'],native.get('meta')),ALIASES.get(key,'gtItem_'+key))
        self.items[id]={'id':id,'name':native['name'],'kind':'item','category':'元件',
                        'nativeItem':native,'icon':id}
        return id

    def material(self,name,prefix='fluid'):
        if prefix=='gem' and name in VANILLA_GEMS:
            id=super().material(name,prefix);registry=VANILLA_GEMS[name]
            self.items[id].update(nativeVanilla=registry,nativeItem={'registry':'minecraft:'+registry,
                'meta':0,'texture':'assets/minecraft/textures/items/'+registry+'.png'})
            path=self.source/'gregtech/loaders/preload/LoaderGTOreDictionary.java'
            self.paths[str(path.relative_to(self.source)).replace('\\','/')]=hashlib.sha256(path.read_bytes()).hexdigest()
            return id
        if prefix=='plateAlloy' and name in ('Iridium','HV','Carbon'):
            return self.stack('GTModHandler.getIC2Item("'+{'Iridium':'iridiumPlate','HV':'advancedAlloy','Carbon':'carbonPlate'}[name]+'",1)')[0]
        if name=='GTPPFluid_Cryotheum' and prefix=='fluid':
            id='cryotheum'
            self.items[id]={'id':id,'name':'极寒之凛冰','kind':'fluid','category':'流体','native':{'material':name,'registry':'cryotheum','prefix':'fluid','texture':'FLUID','color':self.materials[name]['color']}}
            return id
        if name=='Paper' and prefix=='plate':
            # LoaderGTOreDictionary explicitly unifies platePaper to vanilla
            # paper. Keep one identity instead of inventing a second plate.
            id=super().material(name,prefix)
            self.items[id].update(name='纸',nativeVanilla='paper',nativeItem={'registry':'minecraft:paper','meta':0,'texture':'assets/minecraft/textures/items/paper.png'})
            path=self.source/'gregtech/loaders/preload/LoaderGTOreDictionary.java'
            self.paths[str(path.relative_to(self.source)).replace('\\','/')]=hashlib.sha256(path.read_bytes()).hexdigest()
            return id
        if name.startswith('Any'):
            if not hasattr(self,'ore_representatives'):
                path=self.source/'gregtech/api/enums/Materials.java'
                self.ore_representatives={}
                for member,group in re.findall(r'(\w+)\.mOreReRegistrations\.add\((Any\w+)\)',path.read_text(encoding='utf-8')):self.ore_representatives.setdefault(group,member)
                self.paths['gregtech/api/enums/Materials.java']=hashlib.sha256(path.read_bytes()).hexdigest()
            name=self.ore_representatives.get(name,name)
        if prefix=='gear':prefix='gearGt'
        if prefix=='milled':
            material=self.materials[name];id=name[0].lower()+name[1:]+'Milled'
            self.items[id]={'id':id,'name':material['name']+'研磨矿','kind':'item','category':'矿物处理',
              'nativeItem':{'registry':'miscutils:milled'+name,'meta':0,'texture':'assets/miscutils/textures/items/processing/MilledOre/milled.png','overlay':'assets/miscutils/textures/items/processing/MilledOre/milled_OVERLAY.png','color':material['color']}}
            return id
        if prefix=='wrapCircuit':
            tiers=['ULV','LV','MV','HV','EV','IV','LuV','ZPM','UV','UHV','UEV','UIV','UMV','UXV','MAX']
            if name not in tiers:raise ValueError('unknown wrapped circuit tier '+name)
            meta=tiers.index(name);id='circuitWrap'+name
            self.items[id]={'id':id,'name':name+' 电路包','kind':'item','category':'元件','nativeItem':{'registry':'GoodGenerator:circuitWrap','meta':meta,'texture':f'assets/goodgenerator/textures/items/wraps/{meta}.png'}}
            return id
        if prefix=='molten':
            material=self.materials.get(name)
            if not material:raise ValueError('unknown molten material '+name)
            base_id=base.ALIASES.get(name,name[0].lower()+name[1:]);id=base_id+'Molten'
            self.items[id]={'id':id,'name':'熔融'+material['name'],'kind':'fluid','category':'流体',
                'native':{'material':name,'registry':material['registry'],'prefix':'molten','texture':material['texture'],'color':material['color']}}
            return id
        return super().material(name,prefix)

    def resolve(self,s):
        s=transform_code(s,lambda part:re.sub(r'\s+','',part))
        s=s.replace('tectech.thing.CustomItemList.','CustomItemList.')
        s=s.replace('MaterialsElements.getInstance().','MaterialsElements.')
        s=re.sub(r'\b(MaterialsElements)\.(?!STANDALONE\.)(HYPOGEN|CHRONOMATIC_GLASS|CELESTIAL_TUNGSTEN|FORCE)\b',r'\1.STANDALONE.\2',s)
        plastics=['Polyethylene','PolyvinylChloride','Polytetrafluoroethylene','Epoxid','EpoxidFiberReinforced','Polybenzimidazole','Kevlar','RadoxPolymer']
        for _ in range(8):
            before=s
            # Static wildcard imports can add thousands of names. Replace
            # identifier tokens in one pass rather than compiling a regex for
            # every registered material on every ingredient.
            s=transform_code(s,lambda part:re.sub(r'(?<![\w.])\w+\b',lambda m:self.constants.get(m[0],m[0]),part))
            for key,value in self.constants.items():
                if key.isidentifier() or key not in s:continue
                value=transform_code(value,lambda part:re.sub(r'\s+','',part))
                if '.' in key and '(' in key:s=transform_code(s,lambda part:part.replace(key,value))
                else:s=transform_code(s,lambda part:re.sub(r'(?<![\w.])'+re.escape(key)+r'\b',lambda m:value,part))
            s=re.sub(r'PCBFactoryManager\.getPlasticMaterialFromTier\((\d+)\)',lambda m:'Materials.'+plastics[int(m[1])-1] if 1<=int(m[1])<=len(plastics) else m[0],s)
            s=s.replace('Materials.get("Artherium-Sn")','GGMaterial.artheriumSn')
            s=s.replace('MaterialsElements.getInstance().','MaterialsElements.')
            if s==before:break
        if re.search(r'Materials\.\w+\.m(?:MeltingPoint|BlastFurnaceTemp)',s):
            if not hasattr(self,'material_scalars'):
                self.material_scalars={}
                for label in ('gregtech/loaders/materials/MaterialsInit.java','gregtech/api/enums/MaterialBuilder.java'):
                    path=self.source/label;self.paths[label]=hashlib.sha256(path.read_bytes()).hexdigest()
                material_text=(self.source/'gregtech/loaders/materials/MaterialsInit.java').read_text(encoding='utf-8')
                for definition in re.finditer(r'private static Materials load(\w+)\(\)\s*\{(.*?)(?=\n    private static|\Z)',material_text,re.S):
                    for field,method,default in [('mMeltingPoint','MeltingPoint','-1'),('mBlastFurnaceTemp','BlastFurnaceTemp','0')]:
                        value=re.search(r'\.set'+method+r'\(([^)]+)\)',definition[2])
                        try:self.material_scalars['Materials.'+definition[1]+'.'+field]=str(numeric(value[1] if value else default))
                        except (ValueError,SyntaxError):pass
            s=re.sub(r'Materials\.\w+\.m(?:MeltingPoint|BlastFurnaceTemp)',lambda m:self.material_scalars.get(m[0],m[0]),s)
        return s

    def stack(self,expression):
        s=transform_code(self.resolve(expression),lambda part:re.sub(r'\s+','',part))
        while s.startswith('(') and base.matching(s,0)==len(s)-1:s=s[1:-1]
        if s.endswith('.copy()'):return self.stack(s[:-7])
        s=s.replace('newnet.minecraft.item.ItemStack(', 'newItemStack(')
        if hasattr(self,'biochemistry'):
            biological=self.biochemistry.stack(self,s,numeric)
            if biological:return biological
        hull=re.fullmatch(r'ItemList\.MACHINE_HULLS\[(\d+)\]\.get\((.+)\)',s)
        if hull:
            label='gregtech/api/enums/ItemList.java';path=self.source/label
            raw=path.read_text(encoding='utf-8');self.paths[label]=hashlib.sha256(path.read_bytes()).hexdigest()
            match=re.search(r'\bMACHINE_HULLS\s*=\s*\{([^}]+)}',raw)
            names=[value.strip() for value in match[1].split(',')]
            return self.named(names[int(hull[1])]),numeric(hull[2])
        ore_string=re.fullmatch(r'GTOreDictUnificator.get\("([^"]+)",(.+)\)',s)
        if ore_string:return self.stack('new OreDictItemStack("'+ore_string[1]+'",'+ore_string[2]+')')
        water=re.fullmatch(r'newFluidStack\(FluidRegistry\.(WATER|LAVA),(.+)\)',s)
        if water:return self.stack('FluidRegistry.getFluidStack("'+water[1].lower()+'",'+water[2]+')')
        native_fluid=re.fullmatch(r'newFluidStack\(ItemList\.(s\w+),(.+)\)',s)
        if native_fluid:
            if not hasattr(self,'native_fluid_materials'):
                self.native_fluid_materials={}
                label='gregtech/loaders/preload/LoaderGTBlockFluid.java';path=self.source/label
                self.paths[label]=hashlib.sha256(path.read_bytes()).hexdigest()
                raw=path.read_text(encoding='utf-8')
                for match in re.finditer(r'ItemList\.(s\w+)\s*=\s*([^;]+);',raw):
                    material=re.search(r'\.configureMaterials\(Materials\.(\w+)\)',match[2])
                    if material:self.native_fluid_materials[match[1]]=material[1]
            if native_fluid[1] in self.native_fluid_materials:return self.material(self.native_fluid_materials[native_fluid[1]]),numeric(native_fluid[2])
        thermal=re.fullmatch(r'newFluidStack\(TFFluids\.(fluidCryotheum|fluidPyrotheum),(.+)\)',s)
        if thermal:
            label='gtPlusPlus/xmod/thermalfoundation/fluid/TFFluids.java'
            path=self.source/label;self.paths[label]=hashlib.sha256(path.read_bytes()).hexdigest()
            return self.stack('newFluidStack(GTPPFluids.'+thermal[1].removeprefix('fluid')+','+thermal[2]+')')
        solder=re.fullmatch(r'getSolderingFluid\(Materials\.(\w+),(.+)\)',s)
        if solder and self.active_file=='NewHorizonsCoreMod/com/dreammaster/scripts/ScriptLogisticPipes.java':
            tags=self.materials[solder[1]]['tags']
            multiplier=1 if 'SOLDERING_MATERIAL_GOOD' in tags else 4 if 'SOLDERING_MATERIAL_BAD' in tags else 2 if 'SOLDERING_MATERIAL' in tags else None
            if multiplier is None:raise ValueError('invalid logistic solder '+solder[1])
            return self.material(solder[1],'molten'),numeric(solder[2])*multiplier
        fallback=re.fullmatch(r'newFluidStack\(FluidRegistry.getFluid\("([^"]+)"\)!=null\?FluidRegistry.getFluid\("\1"\):FluidRegistry.getFluid\("([^"]+)"\),(.+)\)',s)
        if fallback:
            # These GT++ fluids are registered in this pinned installation.
            # Do not choose arbitrary branches of other runtime conditions.
            targets={'molten.indalloy140':'MaterialsAlloy.INDALLOY_140','molten.mutatedlivingsolder':'MaterialMisc.MUTATED_LIVING_SOLDER'}
            if fallback[1] in targets and targets[fallback[1]] in self.gtpp_materials:
                return self.stack(targets[fallback[1]]+'.getFluidStack('+fallback[3]+')')
        s=re.sub(r'GTOreDictUnificator.get\(OrePrefixes\.(\w+)\.get\((Materials\.\w+)\),',r'GTOreDictUnificator.get(OrePrefixes.\1,\2,',s)
        sized_dust=re.fullmatch(r'GTOreDictUnificator.getDust\(Materials\.(\w+),(.+)\)',s)
        if sized_dust:
            unit=3628800
            amount_expression=sized_dust[2]
            for prefix,value in [('dust',unit),('dustSmall',unit//4),('dustTiny',unit//9)]:amount_expression=amount_expression.replace('OrePrefixes.'+prefix+'.getMaterialAmount()',str(value))
            amount=numeric(amount_expression)
            if amount<=0 or sized_dust[1] not in self.materials or not self.materials[sized_dust[1]]['dust']:raise ValueError('unregistered sized powder')
            prefix,count=('dust',amount//unit) if amount%unit==0 or amount>=unit*16 else ('dustSmall',amount*4//unit) if amount*4%unit==0 or amount>=unit*8 else ('dustTiny',amount*9//unit)
            if count<1:raise ValueError('powder amount below one tiny dust')
            return self.material(sized_dust[1],prefix),count
        split=re.fullmatch(r'(.+)\.splitStack\(([^()]+)\)',s)
        if split:
            original=self.stack(split[1])
            if original:return original[0],numeric(split[2])
        material_fluid=re.fullmatch(r'newFluidStack\(Materials\.(\w+)\.(mFluid|mGas|mStandardMoltenFluid|mPlasma),(.+)\)',s)
        if material_fluid:return self.material(material_fluid[1],{'mFluid':'fluid','mGas':'gas','mStandardMoltenFluid':'molten','mPlasma':'plasma'}[material_fluid[2]]),numeric(material_fluid[3])
        hand_tool=re.fullmatch(r'(?:MetaGeneratedTool01\.)?INSTANCE.getToolWithStats\((?:IDMetaTool01\.)?(MORTAR|KNIFE).ID,1,Materials.Flint,Materials.(Stone|Wood),null\)',s)
        if hand_tool and (hand_tool[1],hand_tool[2]) in {('MORTAR','Stone'),('KNIFE','Wood')}:
            key=hand_tool[1];id='mortar' if key=='MORTAR' else 'knife'
            texture='iconsets/MORTAR' if key=='MORTAR' else 'materialicons/NONE/toolKnife'
            self.items[id]={'id':id,'name':'燧石研钵' if key=='MORTAR' else '燧石小刀','kind':'item','category':'工具','nativeItem':{'registry':'gregtech:gt.metatool.01','meta':24 if key=='MORTAR' else 34,'texture':'assets/gregtech/textures/items/'+texture+'.png','color':self.materials['Flint' if key=='MORTAR' else 'Wood']['color']}}
            return id,1
        core_item=re.fullmatch(r'newItemStack\(NHItemList\.(\w+)\.item,([^,]+),0\)',s)
        if core_item:return self.stack('NHItemList.'+core_item[1]+'.get('+core_item[2]+')')
        bw=re.fullmatch(r'newItemStack\(ItemRegistry\.(bw_realglas2?|bw_glasses\[[01]\]),([^,]+)(?:,([^,]+))?\)',s)
        if bw:
            key={'bw_glasses[0]':'bw_realglas','bw_glasses[1]':'bw_realglas2'}.get(bw[1],bw[1])
            registry=self.bw_glass_blocks[key]
            return self.stack('getModItem(BartWorks.ID,"'+registry+'",'+bw[2]+','+(bw[3] or '0')+')')
        if s=='ItemRegistry.dehp':return self.named('DeepEarthHeatingPump'),1
        ic2=re.fullmatch(r'(?:GTModHandler\.)?getIC2Item\("(\w+)",([^,]+)(?:,null)?\)',s)
        ic2_field=re.fullmatch(r'Ic2Items\.(\w+)',s)
        if ic2_field and ic2_field[1] in self.ic2_items:return self.stack('GTModHandler.getIC2Item("'+ic2_field[1]+'",1)')
        if ic2 and ic2[1] in self.ic2_items:
            id=self.ic2_ids[ic2[1]];native=self.ic2_items[ic2[1]]
            self.items[id]={'id':id,'name':native['name'],'kind':'item','category':'元件','nativeItem':native}
            return id,numeric(ic2[2])
        block=re.fullmatch(r'BlockList\.(\w+)\.get\((.*)\)',s)
        if block:
            native=self.core_blocks.get(block[1])
            if not native:raise ValueError('unresolved core block '+block[1])
            id='nhBlock_'+block[1];self.items[id]={'id':id,'name':native['name'],'kind':'item','category':'结构','nativeItem':native}
            return id,numeric(block[2]) if block[2] else 1
        particle=re.fullmatch(r'Particle.getBaseParticle\(Particle\.(\w+)(?:,(.+))?\)',s)
        if particle:
            raw=(self.source/'gtPlusPlus/core/material/Particle.java').read_text(encoding='utf-8')
            name=re.search(r'\b'+particle[1]+r'\s*=\s*new Particle\(ElementaryGroup\.\w+,\s*"([^"]+)"',raw)
            types=(self.source/'gtPlusPlus/core/item/chemistry/StandardBaseParticles.java').read_text(encoding='utf-8')
            names=re.findall(r'"([^"]+)"',re.search(r'String\[\] aTypes = new String\[\]\s*\{(.*?)\};',types,re.S)[1])
            if not name or name[1] not in names:raise ValueError('unknown base particle '+particle[1])
            meta=names.index(name[1]);id='gtppParticle_'+particle[1]
            self.items[id]={'id':id,'name':name[1]+'粒子','kind':'item','category':'粒子','nativeItem':{'registry':'miscutils:particleBase','meta':meta,'texture':f'assets/miscutils/textures/items/particle/{meta}.png'}}
            return id,numeric(particle[2]) if particle[2] else 1
        addon=re.fullmatch(r'(CustomItemList|ItemRefer|GregtechItemList)\.(\w+)\.get\((.+)\)',s)
        if addon and (addon[1]!='GregtechItemList' or addon[1]+'.'+addon[2] in self.addon_items):
            native=self.addon_items.get(addon[1]+'.'+addon[2])
            if not native:raise ValueError('unresolved registered addon '+addon[1]+'.'+addon[2])
            id=({'CustomItemList':'ttItem_','ItemRefer':'ggItem_','GregtechItemList':'gtppItem_'}[addon[1]])+addon[2]
            self.items[id]={'id':id,'name':native['name'],'kind':'item','category':'元件','nativeItem':native}
            return id,numeric(addon[3])
        if re.fullmatch(r'(?:GregtechItemList.LavaFilter|ItemList.Component_LavaFilter)\.get\(\d+\)',s):
            self.items['lavaFilter']={'id':'lavaFilter','name':'熔岩过滤器','kind':'item','category':'设备耗材',
                'nativeItem':{'registry':'miscutils:itemLavaFilter','meta':0,'texture':'assets/miscutils/textures/items/itemLavaFilter.png'}}
            return 'lavaFilter',int(re.search(r'\((\d+)\)',s)[1])
        if s.startswith('getFluidStack('):s='FluidRegistry.'+s
        s=re.sub(r'(?:GTModHandler\.)?getIC2Coolant\((.+)\)',r'FluidRegistry.getFluidStack("ic2coolant",\1)',s)
        for helper,registry in [('getHotCoolant','ic2hotcoolant'),('getPahoehoeLava','ic2pahoehoelava'),('getSuperHeatedSteam','ic2superheatedsteam')]:
            s=re.sub(r'(?:GTModHandler\.)?'+helper+r'\((.+)\)',lambda m:'FluidRegistry.getFluidStack("'+registry+'",'+m[1]+')',s)
        registered=re.fullmatch(r'FluidRegistry.getFluidStack\("([^"]+)",(.+)\)',s)
        if registered and registered[1] in REGISTERED_FLUIDS:
            key=registered[1];id,title,texture=REGISTERED_FLUIDS[key]
            self.items[id]={'id':id,'name':title,'kind':'fluid','category':'流体',
              'nativeItem':{'registry':key,'meta':0,'texture':texture}}
            return id,numeric(registered[2])
        if registered:
            # A registry name and Material.getFluidStack must share one
            # identity, including GT++ PURE_LIQUID's molten.* registration.
            registry=re.sub(r'[^a-z0-9]','',registered[1].removeprefix('molten.').lower())
            gtpp=next((ref for ref,key in self.gtpp_materials.items() if re.sub(r'[^a-z0-9]','',self.materials.get(key,{}).get('registry','').lower())==registry),None)
            if gtpp:return self.stack(gtpp+'.getFluidStack('+registered[2]+')')
            key=next((key for key in self.gtpp_fluids.values() if self.materials[key]['registry'].lower()==registered[1].lower()),None)
            if key:return self.material(key),numeric(registered[2])
        unified=re.fullmatch(r'GTOreDictUnificator.get\((ItemList\.\w+\.get\([^()]+\))\)',s)
        if unified:return self.stack(unified[1])
        s=s.replace('GTUtility.copyAmountUnsafe(','GTUtility.copyAmount(')
        m=re.fullmatch(r'CircuitComponent\.(\w+)\.getFakeStack\((.+)\)',s)
        if m:return self.circuit_component(m[1]),numeric(m[2])
        m=re.fullmatch(r'newCircuitComponentStack\(CircuitComponent\.(\w+),(.+)\)',s)
        if m:return self.circuit_component(m[1]),numeric(m[2])
        m=re.fullmatch(r'newFluidStack\(([\w.]+\.get(?:Fluid|Plasma)\(\)),(.+)\)',s)
        if m:return self.stack(m[1][:-1]+m[2]+')')
        m=re.fullmatch(r'newFluidStack\(([\w.]+\.get(?:Fluid|Gas|Molten|FluidStack))\([^()]*\)\.getFluid\(\),(.+)\)',s)
        if m:return self.stack(m[1]+'('+m[2]+')')
        m=re.fullmatch(r'ItemUtils.getItemStackOfAmountFromOreDict\("([^"]+)",(.+)\)',s)
        if m:
            for prefix in sorted([*base.SUFFIXES,'cell'],key=len,reverse=True):
                if m[1].startswith(prefix) and m[1][len(prefix):] in self.materials:
                    return self.material(m[1][len(prefix):],prefix),numeric(m[2])*(1000 if prefix=='cell' else 1)
        m=re.fullmatch(r'newFluidStack\((\w+),(.+)\)',s)
        if m and getattr(self,'local_fluids',{}).get(m[1]):return self.material(self.local_fluids[m[1]]),numeric(m[2])
        m=re.fullmatch(r'newFluidStack\(FluidRegistry\.getFluid\("([^"]+)"\),(.+)\)',s)
        if m:
            if m[1].startswith('molten.'):
                return self.stack('FluidRegistry.getFluidStack("'+m[1]+'",'+m[2]+')')
            registry=m[1].lower();key=next((k for k,v in self.materials.items() if v.get('registry','').lower()==registry),None)
            if key:return self.material(key),numeric(m[2])
        m=re.fullmatch(r'newFluidStack\(FluidLoader\.(\w+),(.+)\)',s)
        if m:
            key=self.bw_fluids.get(m[1])
            if not key:raise ValueError('unknown registered BartWorks fluid '+m[1])
            return self.material(key),numeric(m[2])
        m=re.fullmatch(r'GregtechItemList\.(\w+)\.get\((.+)\)',s)
        if m and 'GregtechItemList.'+m[1] in self.machine_items:
            id='gtppItem_'+m[1];native=self.machine_items['GregtechItemList.'+m[1]]
            self.items[id]={'id':id,'name':native['name'],'kind':'item','category':'机器','nativeItem':native}
            return id,numeric(m[2])
        if m and m[1] in self.chemistry_items:
            id='gtppItem_'+m[1];native=self.chemistry_items[m[1]]
            self.items[id]={'id':id,'name':native['name'],'kind':'item','category':'化工材料','nativeItem':native}
            return id,numeric(m[2])
        m=re.fullmatch(r'Materials\.([A-Za-z0-9_]+)\.get(Nanite|FluidStack|Fluid|Gas|Plasma|Dust|SmallDust|TinyDust|Ingot|HotIngot|Plate|Plates|PlateDouble|PlateDense|PlateSuperdense|Gear|GearSmall|Rod|LongRod|Bolt|Screw|Ring|Rotor|FrameBox|FineWire|Foil|Crushed|PurifiedCrushed|CentrifugedCrushed)\((.*)\)',s)
        if m and m[1] in self.materials:
            prefix={'Nanite':'nanite','FluidStack':'fluid','Fluid':'fluid','Gas':'gas','Plasma':'plasma','Dust':'dust','SmallDust':'dustSmall','TinyDust':'dustTiny','Ingot':'ingot','HotIngot':'ingotHot','Plate':'plate','Plates':'plate','PlateDouble':'plateDouble','PlateDense':'plateDense','PlateSuperdense':'plateSuperdense','Gear':'gearGt','GearSmall':'gearGtSmall','Rod':'stick','LongRod':'stickLong','Bolt':'bolt','Screw':'screw','Ring':'ring','Rotor':'rotor','FrameBox':'frameGt','FineWire':'wireFine','Foil':'foil','Crushed':'crushed','PurifiedCrushed':'crushedPurified','CentrifugedCrushed':'crushedCentrifuged'}[m[2]]
            return self.material(m[1],prefix),numeric(m[3])*(1000 if prefix=='cell' else 1)
        m=re.fullmatch(r'(?:Materials\.get\("([^"]+)"\)|MaterialsElements\.(?:STANDALONE\.)?(\w+)|GGMaterial\.(\w+))\.get(FluidStack|Fluid|Plasma|Dust|SmallDust|TinyDust|Ingot|HotIngot|Plate|Plates|PlateDouble|PlateDense|PlateSuperdense|Gear|GearSmall|Rod|LongRod|Bolt|Screw|Ring|Rotor|FrameBox|FineWire|Foil|Crushed|PurifiedCrushed|CentrifugedCrushed)\((.*)\)',s)
        if m:
            target=next((x for x in m.groups()[:3] if x),None)
            key=next((k for k,v in self.materials.items() if v.get('name')==target or k==target),None)
            if not key:
                key=next((self.gtpp_materials.get(prefix+'.'+target) for prefix in ('MaterialsElements.STANDALONE','GGMaterial') if self.gtpp_materials.get(prefix+'.'+target)),None)
            if not key:key=self.addon_materials.get(('GGMaterial.' if m[3] else 'MaterialsElements.'+('STANDALONE.' if target in ('HYPOGEN','CHRONOMATIC_GLASS','CELESTIAL_TUNGSTEN','FORCE') else '') )+target)
            if key:
                prefix={'FluidStack':'fluid','Fluid':'fluid','Plasma':'plasma','Dust':'dust','SmallDust':'dustSmall','TinyDust':'dustTiny','Ingot':'ingot','HotIngot':'ingotHot','Plate':'plate','Plates':'plate','PlateDouble':'plateDouble','PlateDense':'plateDense','PlateSuperdense':'plateSuperdense','Gear':'gearGt','GearSmall':'gearGtSmall','Rod':'stick','LongRod':'stickLong','Bolt':'bolt','Screw':'screw','Ring':'ring','Rotor':'rotor','FrameBox':'frameGt','FineWire':'wireFine','Foil':'foil','Crushed':'crushed','PurifiedCrushed':'crushedPurified','CentrifugedCrushed':'crushedCentrifuged'}[m[4]]
                return self.material(key,prefix),numeric(m[5])
        m=re.fullmatch(r'newFluidStack\(GTPPFluids\.(\w+),(.+)\)',s)
        if m and m[1] in self.gtpp_fluids:return self.material(self.gtpp_fluids[m[1]]),numeric(m[2])
        m=re.fullmatch(r'newItemStack\(WerkstoffLoader.items.get\(OrePrefixes\.(\w+)\),(.+),([\d_]+)\)',s)
        if m and numeric(m[3]) in self.addon_meta:return self.material(self.addon_meta[numeric(m[3])],m[1]),numeric(m[2])
        if self.active_file.startswith('goodgenerator/loader/ComponentAssemblyLine'):
            m=re.fullmatch(r'get\((\w+),([\w.]+),(.+)\)',s)
            if m:
                key=m[2].removeprefix('Materials.')
                if key in self.materials:return self.material(key,m[1]),numeric(m[3])
                if key in self.addon_materials:return self.material(self.addon_materials[key],m[1]),numeric(m[3])
            m=re.fullmatch(r'get\((\w+),(.+)\)',s)
            if m and m[1] in self.itemlist:return self.named(m[1]),numeric(m[2])
            m=re.fullmatch(r'(\w+)\.get\((.*)\)',s)
            if m and m[1] in self.itemlist:return self.named(m[1]),numeric(m[2]) if m[2] else 1
        m=re.fullmatch(r'GTModHandler.getIC2Coolant\((.+)\)',s)
        if m:
            self.items['coolant']={'id':'coolant','name':'冷却液','kind':'fluid','category':'流体','icon':'water'}
            return 'coolant',numeric(m[1])
        m=re.fullmatch(r'(?:FluidRegistry\.)?getFluidStack\("(molten\.[^"]+|brine)",(.+)\)',s)
        if m:
            registry=re.sub(r'[^a-z0-9]','',m[1].removeprefix('molten.').lower())
            key=next((k for k,v in self.materials.items() if re.sub(r'[^a-z0-9]','',v['registry'].lower())==registry),None)
            if key:return self.material(key,'molten'),numeric(m[2])
        m=re.fullmatch(r'(WerkstoffLoader|GGMaterial|WerkstoffMaterialPool|BotWerkstoffMaterialPool)\.(\w+)\.(getFluidOrGas|getMolten|get)\((.*)\)',s)
        if m:
            key=self.addon_materials.get(m[1]+'.'+m[2])
            if not key:raise ValueError('unknown addon material '+m[1]+'.'+m[2])
            args=base.split_args(m[4])
            if m[3]=='get':prefix=args[0].removeprefix('OrePrefixes.');n=numeric(args[1]) if len(args)>1 else 1
            else:prefix='molten' if m[3]=='getMolten' else 'fluid';n=numeric(args[0])
            return self.material(key,prefix),n*(1000 if prefix=='cell' else 1)
        if s.startswith('newFluidStack(solderIndalloy,'):s='MaterialsAlloy.INDALLOY_140.getFluidStack('+s[len('newFluidStack(solderIndalloy,'):]
        m=re.fullmatch(r'([\w.]+)\.(getFluidStack|getFluid|getPlasma|getCell|getDust|getSmallDust|getTinyDust|getIngot|getHotIngot|getPlate|getPlateDouble|getPlateDense|getPlateSuperdense|getGear|getGearSmall|getRod|getLongRod|getBolt|getScrew|getRing|getRotor|getFrameBox|getFineWire|getFoil|getCrushed|getPurifiedCrushed|getCentrifugedCrushed)\((.*)\)',s)
        if m and m[1] in self.gtpp_materials:
            prefix={'getFluidStack':'fluid','getFluid':'fluid','getPlasma':'plasma','getCell':'cell','getDust':'dust','getSmallDust':'dustSmall','getTinyDust':'dustTiny','getIngot':'ingot','getHotIngot':'ingotHot','getPlate':'plate','getPlateDouble':'plateDouble','getPlateDense':'plateDense','getPlateSuperdense':'plateSuperdense','getGear':'gearGt','getGearSmall':'gearGtSmall','getRod':'stick','getLongRod':'stickLong','getBolt':'bolt','getScrew':'screw','getRing':'ring','getRotor':'rotor','getFrameBox':'frameGt','getFineWire':'wireFine','getFoil':'foil','getCrushed':'crushed','getPurifiedCrushed':'crushedPurified','getCentrifugedCrushed':'crushedCentrifuged'}[m[2]]
            key=self.gtpp_materials[m[1]]
            amount=numeric(m[3])*(1000 if prefix=='cell' else 1)
            if prefix in ('fluid','cell') and 'SOLID' in getattr(self,'gtpp_states',{}).get(key,''):prefix='molten'
            return self.material(key,prefix),amount
        m=re.fullmatch(r'GTOreDictUnificator.get\(OrePrefixes\.(\w+),(WerkstoffLoader|GGMaterial)\.(\w+).getGTMaterial\(\),(.+)\)',s)
        if m:
            key=self.addon_materials.get(m[2]+'.'+m[3])
            if key:return self.material(key,m[1]),numeric(m[4])
        m=re.fullmatch(r'NHItemList\.(\w+)\.get\((.*)\)',s)
        if m:
            if m[1].startswith(('Coin','Medal')):raise ValueError('quest reward item excluded from production')
            native=self.core_items.get(m[1])
            if not native:raise ValueError('unknown NHItemList '+m[1])
            id='nhItem_'+m[1]
            self.items[id]={'id':id,'name':native['name'],'kind':'item','category':'元件','nativeItem':native}
            return id,numeric(m[2]) if m[2] else 1
        fallback_item=re.fullmatch(r'(?:GTModHandler\.)?getModItem\((?:Mods\.)?(\w+)\.ID,"([^"]+)",([^,]+),([^,]+),newItemStack\(Blocks.fire\)\)',s)
        if fallback_item and self.mod_ids.get(fallback_item[1]) in self.installed_mods:
            return self.stack('getModItem('+fallback_item[1]+'.ID,"'+fallback_item[2]+'",'+fallback_item[3]+','+fallback_item[4]+')')
        m=re.fullmatch(r'(?:GTModHandler\.)?getModItem\((?:Mods\.)?(\w+)\.ID,"([^"]+)",([^,]+)(?:,([^,]+))?\)',s)
        if m:
            mod,registry,amount,meta=m.groups();meta=numeric(meta) if meta else 0;amount=numeric(amount)
            mod_id=self.mod_ids.get(mod,mod)
            core_key=next((key for key,value in self.core_items.items() if value.get('registry')==mod_id+':'+registry and value.get('meta')==meta),None)
            if core_key:return self.stack('NHItemList.'+core_key+'.get('+str(amount)+')')
            # IC2 reactor components have one registry each. Damage is NBT;
            # Core uses metadata 1 for fresh pieces, while Ic2Items uses 0.
            # Wildcard/damaged recipes stay separate and require state handling.
            if mod_id=='IC2' and registry.startswith('reactor') and meta==1 and ('IC2:'+registry,0) in self.ic2_registry_ids:meta=0
            if mod_id=='minecraft' and meta==0:return self.stack('new ItemStack(Items.'+registry+','+str(amount)+')')
            native_key=next((key for key,value in self.itemlist.items() if value.get('registry')==mod_id+':'+registry and value.get('meta')==meta and not value.get('nbt')),None)
            if native_key:return self.named(native_key),amount
            id='modItem_'+mod+'_'+re.sub(r'[^A-Za-z0-9]','',registry)+'_'+str(meta)
            id=self.ic2_registry_ids.get((mod_id+':'+registry,meta),id)
            native=getattr(self,'external_item_metadata',{}).get((mod_id+':'+registry,meta),{'name':registry,'registry':mod_id+':'+registry,'meta':meta,'texture':'assets/'+mod_id.lower()+'/textures/items/'+registry+'.png'})
            self.items[id]={'id':id,'name':native['name'],'kind':'item','category':'元件','nativeItem':native}
            return id,amount
        m=re.fullmatch(r'GTModHandler.getIC2Item\("(advancedCircuit|electronicCircuit)",(.+)\)',s)
        if m:
            id='advancedCircuit' if m[1]=='advancedCircuit' else 'basicCircuit'
            self.items.setdefault(id,{'id':id,'name':'高级电路' if id=='advancedCircuit' else '基础电路','kind':'item','category':'元件','icon':id})
            return id,numeric(m[2])
        m=re.fullmatch(r'GTModHandler.getIC2Item\("(scrap|scrapBox)",([^,]+)\)',s)
        if m:
            id='ic2_'+m[1];key='itemScrapbox' if m[1]=='scrapBox' else 'itemScrap'
            self.items[id]={'id':id,'name':'废料盒' if m[1]=='scrapBox' else '废料','kind':'item','category':'材料',
              'nativeItem':{'registry':'IC2:'+key,'meta':0,'texture':'assets/ic2/textures/items/'+key+'.png'}}
            return id,numeric(m[2])
        m=re.fullmatch(r'GTOreDictUnificator\.get\(OrePrefixes\.(\w+),(?:Materials\.)?(\w+),([^,]+)(?:,false)?\)',s)
        if m and m[2] in self.materials:return self.material(m[2],'molten' if m[1]=='cellMolten' else m[1]),numeric(m[3])*(1000 if m[1] in ('cell','cellMolten') else 1)
        m=re.fullmatch(r'GTModHandler.getIC2Item\("(dynamite|industrialTnt)",([^,]+)(?:,null)?\)',s)
        if m:
            id='ic2_'+m[1]
            self.items[id]={'id':id,'name':'炸药' if m[1]=='dynamite' else '工业 TNT','kind':'item','category':'材料','nativeItem':{'registry':'IC2:'+('itemDynamite' if m[1]=='dynamite' else 'blockITNT'),'meta':0,'texture':'assets/ic2/textures/'+('items/itemDynamite' if m[1]=='dynamite' else 'blocks/blockITNT')+'.png'}}
            return id,numeric(m[2])
        m=re.fullmatch(r'newItemStack\(Blocks.tnt,([^,]+)\)',s)
        if m:
            self.items['tnt']={'id':'tnt','name':'TNT','kind':'item','category':'材料','nativeVanilla':'tnt_side'}
            return 'tnt',numeric(m[1])
        m=re.fullmatch(r'(?:GTModHandler\.)?getModItem\(IndustrialCraft2.ID,"itemPartCircuit",([^,]+),0\)',s)
        if m:
            self.items['basicCircuit']={'id':'basicCircuit','name':'基础电路','kind':'item','category':'元件',
                'nativeItem':{'texture':'assets/ic2/textures/items/resources/circuit.png','registry':'IC2:itemPartCircuit','meta':0}}
            return 'basicCircuit',numeric(m[1])
        if re.fullmatch(r'ItemList.Cell_Empty.get\([^()]+\)',s):return None
        m=re.fullmatch(r'ItemList.Cell_Air.get\((.+)\)',s)
        if m:return self.material('Air'),numeric(m[1])*2000
        m=re.fullmatch(r'ItemList\.(\w+)\.get\((.+)\)',s)
        if m:
            # The remaining varargs are fallback stacks, used only if this
            # ItemList entry was never registered. Resolve the real entry
            # first; unknown entries still fail instead of using a guess.
            amount=base.split_args(m[2])[0]
            if m[1] in self.external_aliases:
                result=self.stack(self.external_aliases[m[1]])
                return result[0],numeric(amount)
            return self.named(m[1]),numeric(amount)
        m=re.fullmatch(r'Materials\.(\w+)\.get(Molten|Ingots|IngotsHot|Plates|Nuggets|Blocks)\((.+)\)',s)
        if m:return self.material(m[1],{'Molten':'molten','Ingots':'ingot','IngotsHot':'ingotHot','Plates':'plate','Nuggets':'nugget','Blocks':'block'}[m[2]]),numeric(m[3])
        m=re.fullmatch(r'GTUtility.getIntegratedCircuit\((.+)\)',s)
        if m:return '@circuit',numeric(m[1])
        m=re.fullmatch(r'(?:GTUtility\.)?copyAmount\(([^,]+),(.+)\)',s)
        if m:
            result=self.stack(m[2]);return (result[0],numeric(m[1])) if result else None
        m=re.fullmatch(r'newOreDictItemStack\("craftingLens(\w+)",(.+)\)',s)
        if m:
            # OreDictRegistrationHandler registers transparent material
            # lenses under their Dyes color; choose a legal representative.
            name={'Red':'Ruby','Green':'Emerald','Blue':'Sapphire','White':'Diamond','Yellow':'GarnetYellow','Purple':'Amethyst','Cyan':'GreenSapphire','Orange':'Topaz'}.get(m[1])
            if name:return self.material(name,'lens'),numeric(m[2])
        m=re.fullmatch(r'newOreDictItemStack\("paneGlass",(.+)\)',s)
        if m:return self.stack('new ItemStack(Blocks.glass_pane,'+m[1]+')')
        dictionary=re.fullmatch(r'newOreDictItemStack\("([^"\n]+)",(.+)\)',s)
        if dictionary:
            if dictionary[1] in ('plateAlloyCarbon','plateAlloyAdvanced','plateAlloyIridium'):
                return self.material({'plateAlloyCarbon':'Carbon','plateAlloyAdvanced':'HV','plateAlloyIridium':'Iridium'}[dictionary[1]],'plateAlloy'),numeric(dictionary[2])
            for prefix in sorted(self.material_prefixes,key=len,reverse=True):
                name=dictionary[1][len(prefix):] if dictionary[1].startswith(prefix) else ''
                if name in self.materials:return self.material(name,prefix),numeric(dictionary[2])
                if name:
                    matches=[key for key,value in self.materials.items() if re.sub(r'[^a-z0-9]','',value.get('registry','').lower())==name.lower()]
                    if len(matches)==1:return self.material(matches[0],prefix),numeric(dictionary[2])
        dye=re.fullmatch(r'newItemStack\(Items.dye,([^,]+),([^,]+)\)',s)
        if dye:
            meta=numeric(dye[2]);names=['black','red','green','brown','blue','purple','cyan','silver','gray','pink','lime','yellow','light_blue','magenta','orange','white']
            if not isinstance(meta,int) or not 0<=meta<len(names):raise ValueError('unsupported vanilla dye metadata')
            id='vanillaDye'+str(meta)
            self.items[id]={'id':id,'name':self.lang.get('item.dyePowder.'+names[meta]+'.name',names[meta]+' dye'),'kind':'item','category':'染料','nativeVanilla':'dye_powder_'+names[meta]}
            return id,numeric(dye[1])
        m=re.fullmatch(r'newItemStack\((Items|Blocks)\.(\w+)(?:,([^,]+)(?:,([^,]+))?)?\)',s)
        if m and (m[4] is None or numeric(m[4])==0):
            if m[1]=='Items' and m[2]=='paper':return self.material('Paper','plate'),numeric(m[3]) if m[3] else 1
            gem=next((name for name,registry in VANILLA_GEMS.items() if m[1]=='Items' and registry==m[2]),None)
            if gem:return self.material(gem,'gem'),numeric(m[3]) if m[3] else 1
            name=m[2];id={'log':'wood','clay_ball':'clay','cobblestone':'stone','slime_ball':'slime','snowball':'snow','glowstone_dust':'glowstoneDust','ender_pearl':'enderPearl','iron_ingot':'iron','gold_ingot':'gold','bucket':'ironBucket'}.get(name,name)
            texture={'log':'log_oak','planks':'planks_oak','grass':'grass_top','tnt':'tnt_side','stone':'stone','rail':'rail_normal','chest':'chest','wool':'wool_colored_white','crafting_table':'crafting_table_front','wooden_slab':'planks_oak','stone_slab':'stone_slab_top','brick_block':'brick','iron_bars':'iron_bars'}.get(name,name)
            self.items.setdefault(id,{'id':id,'name':name.replace('_',' '),'kind':'item','category':'资源','nativeVanilla':texture})
            if name=='bucket':self.items[id].update(name='铁桶',nativeVanilla='bucket_empty',nativeItem={'registry':'minecraft:bucket','meta':0,'texture':'assets/minecraft/textures/items/bucket_empty.png'})
            if name in ('log','planks'):
                self.items[id].update(nativeVanilla=texture,nativeItem={'registry':'minecraft:'+name,'meta':0,'texture':'assets/minecraft/textures/blocks/'+texture+'.png'})
                if name=='planks':self.items[id]['name']='橡木木板'
            return id,numeric(m[3]) if m[3] else 1
        return super().stack(s)

    def variants(self,expression):
        s=transform_code(self.resolve(expression),lambda part:re.sub(r'\s+','',part))
        s=re.sub(r'GTOreDictUnificator.get\(OrePrefixes\.(\w+)\.get\((Materials\.\w+)\),',r'GTOreDictUnificator.get(OrePrefixes.\1,\2,',s)
        m=re.fullmatch(r'newObject\[\]\{OrePrefixes\.(\w+).get\(Materials\.(\w+)\),(.+)\}',s)
        if m:
            prefix,name,n=m[1],m[2],m[3]
            if prefix=='circuit':return self.variants('GTOreDictUnificator.get(OrePrefixes.circuit,Materials.'+name+','+n+')')
            if name=='AnySyntheticRubber':return [(self.material(k,prefix),numeric(n)) for k in ('RubberSilicone','StyreneButadieneRubber')]
            return [(self.material(name,prefix),numeric(n))]
        m=re.fullmatch(r'new(?:ItemStack|Object)\[\]\{(.*)\}',s)
        if m:return [self.stack(arg) for arg in base.split_args(m[1])]
        m=re.fullmatch(r'GTOreDictUnificator.get\(OrePrefixes.circuit,Materials.(\w+),(.+)\)',s)
        if m:
            names=self.circuit_items.get(m[1],[])
            if m[1]=='LV':names=['@basicCircuit',*names]
            if not names:raise ValueError('no circuit variants '+m[1])
            return list(dict.fromkeys(('basicCircuit' if key=='@basicCircuit' else self.stack('ItemList.'+key+'.get(1)')[0],numeric(m[2])) for key in names))
        m=re.fullmatch(r'SubstituteFluidStack.soldering\((.*)\)',s)
        if m:
            n=numeric(m[1]) if m[1] else 144
            return [(self.material(material,'molten'),n*multiplier) for material,multiplier in [('SolderingAlloy',1),('Tin',2),('Lead',4)]]
        return [self.stack(expression)]

    def emit_recipe(self,process,inputs,outputs,ticks,power,line,tools,conditions,rolls,circuit,also_processes=()):
        fuel=process.startswith('generateNaquadah') or process in ('generateMagic','generateRTG')
        air_collection=process=='electricCompress' and outputs=={'air':2000} and self.active_file.endswith('/CompressorRecipes.java')
        if (not outputs and not fuel) or (not (inputs or tools) and process not in ('algaePond','massFabricate') and not air_collection) or ticks<=0 or power<0:raise ValueError('empty or invalid recipe')
        also_processes=sorted(set(also_processes)-{process})
        signature=json.dumps([process,also_processes,inputs,outputs,ticks,power,tools,conditions,rolls,circuit],sort_keys=True)
        id='tech29:'+hashlib.sha1(signature.encode()).hexdigest()[:16]
        if id in self.seen:return None
        self.seen.add(id)
        tier=next((i for i in range(15) if 8*4**i>=power),14)
        stage=max(1 if process in ('alloy','forgeHammer','blast') else 2,tier+1)
        r={'id':id,'name':' + '.join(self.items[k]['name'] for k in outputs) or '硅岩发电','stage':min(15,stage),
           'process':process,'inputs':inputs,'outputs':outputs,'seconds':ticks/20,'power':power,
           'source':'GTNH2.9','origin':{'file':self.active_file,'line':line}}
        if tools:r['tools']=tools
        if conditions:r['requirements']=conditions
        if 'boardBath' in conditions:
            fluid,waste=[('Materials.IronIIIChloride.getFluid(1)','GGMaterial.ferrousChloride.getFluidOrGas(1)'),
              ('Materials.GrowthMediumSterilized.getFluid(1)','Materials.GrowthMediumRaw.getFluid(1)'),
              ('Materials.BioMediumSterilized.getFluid(1)','Materials.BioMediumRaw.getFluid(1)'),
              ('Materials.PrismaticAcid.getFluid(1)','Materials.PrismaticGas.getFluid(1)'),
              ('Materials.UUMatter.getFluid(1)','Materials.UUAmplifier.getFluid(1)')][int(conditions['boardBath'])-1]
            r['bath']={'fluid':self.stack(fluid)[0],'waste':self.stack(waste)[0],'divisor':4 if conditions['boardBath']==4 else 1}
            r['requirements']={k:v for k,v in conditions.items() if k!='boardBath'}
        if conditions.get('nanochipCalibration'):
            r['calibrationType']=conditions['nanochipCalibration']
            r['requirements']={k:v for k,v in conditions.items() if k!='nanochipCalibration'}
        if rolls and any(x['chance']!=10000 for x in rolls):r['outputRolls']=rolls
        if circuit is not None:r['circuit']=circuit
        if also_processes:r['alsoProcesses']=also_processes
        if conditions.get('startup'):r['startup']=conditions['startup']
        if conditions.get('pcbNaniteMaterial'):
            nanite=self.material(conditions['pcbNaniteMaterial'],'nanite')
            r.setdefault('tools',{})[nanite]=1
        if self.recipe_signature(r) in self.existing_signatures:return None
        self.recipes.append(r)
        return r

    def dtpf_calculators(self,text):
        calculators={}
        pattern=r'DTPFCalculator\s+(\w+)\s*=\s*new\s+DTPFCalculator\(\)(.*?);'
        for m in re.finditer(pattern,text,re.S):
            name,chain=m.group(1),m.group(2)
            local_values={}
            prefix=text[:m.start()]
            for assignment in re.finditer(r'\b(?:final\s+)?(?:long|int|float|double)\s+(\w+)\s*=\s*([^;]+);',prefix):
                expression=assignment[2]
                for key,value in sorted(local_values.items(),key=lambda x:-len(x[0])):expression=re.sub(r'(?<![\w.])'+re.escape(key)+r'\b',str(value),expression)
                try:local_values[assignment[1]]=numeric(expression)
                except (ValueError,SyntaxError,KeyError,ZeroDivisionError):pass
            def arg(method,default=None):
                found=re.search(r'\.set'+method+r'\(([^()]*)\)',chain)
                if found:
                    expression=self.resolve(found[1])
                    for key,value in sorted(local_values.items(),key=lambda x:-len(x[0])):expression=re.sub(r'(?<![\w.])'+re.escape(key)+r'\b',str(value),expression)
                    return numeric(expression)
                return default
            parallel=arg('BaseParallel',1);low=arg('LowestCatalystTier',0);high=arg('HighestCatalystTier',3)
            scaling=arg('ScalingFactor',2);catalyst_discount=arg('CatalystDiscount',0);time_discount=arg('ProcessingTimeDiscount',0)
            eut_divisor=arg('EUtDivisor',1);custom=re.search(r'\.setCustomEBFinputItem\((.*?)\)',chain)
            generic=re.search(r'\.calculateGenericEBFBasedRecipe\(([^()]*)\)',chain)
            non_ebf=re.search(r'\.calculateNonEBFRecipe\((.*)\)',chain)
            if generic:
                material_expr=self.resolve(generic[1]).replace('MaterialsElements.getInstance().','MaterialsElements.')
                key=re.sub(r'\s+','',material_expr).removeprefix('Materials.')
                if key not in self.materials:
                    key=self.gtpp_materials.get(key,key)
                try:input_id=self.stack(custom[1])[0] if custom else self.material(key,'dust')
                except (ValueError,KeyError,TypeError):continue
                candidates=[r for r in self.recipes if r['process']=='electricBlast' and r['inputs'].get(input_id)]
                oganesson=self.material('WerkstoffLoader_Oganesson') if 'WerkstoffLoader_Oganesson' in self.materials else None
                chosen=next((r for r in candidates if oganesson and r['inputs'].get(oganesson)),None)
                chosen=chosen or next((r for r in candidates if not any(self.items[i].get('kind')=='fluid' for i in r['inputs'])),None)
                chosen=chosen or (candidates[0] if candidates else None)
                if not chosen:continue
                ebf_time=chosen['seconds']*20
                if oganesson and chosen['inputs'].get(oganesson):
                    ebf_time=round(ebf_time/.1*.3)
                else:ebf_time=round(ebf_time*.3)
                hot=next((i for i in chosen['outputs'] if i.endswith('HotIngot')),None)
                freeze=next((r for r in self.recipes if r['process']=='freeze' and hot and r['inputs'].get(hot)),None)
                freezeEU=(freeze['power'] if freeze else 0);freezeTime=(freeze['seconds']*20 if freeze else 0)
                totalEU=(freezeEU*freezeTime+chosen['power']*ebf_time)*parallel
                baseEU=totalEU//max(1,ebf_time)//10
                while baseEU>2147483647/(scaling**max(0,high-low)):baseEU//=scaling
                base_duration=ebf_time
            elif non_ebf:
                args=base.split_args(non_ebf[1]);expressions=[self.resolve(a) for a in args]
                for at in range(len(expressions)):
                    for key,value in sorted(local_values.items(),key=lambda x:-len(x[0])):expressions[at]=re.sub(r'(?<![\w.])'+re.escape(key)+r'\b',str(value),expressions[at])
                try:base_eu=numeric(expressions[0]);base_duration=numeric(expressions[1])
                except (ValueError,SyntaxError):continue
                totalEU=base_eu*base_duration*parallel;baseEU=totalEU//max(1,base_duration)//10
                while baseEU>2147483647/(scaling**max(0,high-low)):baseEU//=scaling
            else:continue
            catalyst_values={}
            catalyst_energy=[14514983,66768460,269326451,1073007393,4276767521]
            for index in range(int(low),int(high)+1):
                i=index-low
                value=((totalEU*(.8-i*.1)*(scaling**i)-baseEU*(scaling**i)*(base_duration/(scaling**(i+1)))/eut_divisor)/catalyst_energy[int(index)])*(1-catalyst_discount/100)
                catalyst_values[index]=int(value)
            calculators[name]={'duration':base_duration,'power':baseEU,'parallel':parallel,'low':low,'scaling':scaling,'catalysts':catalyst_values,'totalEU':totalEU}
        for key,calc in calculators.items():
            for index,value in calc['catalysts'].items():self.constants[key+'.getCatalystAmount('+str(index)+')']=str(value)
            for index,value in calc['catalysts'].items():self.constants[key+'.getResidueAmount('+str(index)+')']=str(int(value*((2**index)/8)))
            for index in calc['catalysts']:
                duration=int((calc['duration']/(calc['scaling']**(index+1-calc['low'])))*(1-time_discount/100))
                self.constants[key+'.getDuration('+str(index)+')']=str(duration)
                self.constants[key+'.getEUt('+str(index)+')']=str(int(calc['power']*(calc['scaling']**(index-calc['low']))/eut_divisor))
        return self.constants.copy() if calculators else {}

    @staticmethod
    def recipe_signature(r):
        rolls=r.get('outputRolls') or [{'id':k,'count':v,'chance':r.get('outputChances',{}).get(k,10000)} for k,v in r['outputs'].items()]
        return json.dumps([r['process'],r['inputs'],r['outputs'],r['seconds'],r.get('power',0),r.get('tools',{}),r.get('requirements',{}),sorted(rolls,key=lambda s:(s['id'],s['count'],s['chance'])),r.get('circuit')],sort_keys=True)

    def emit_expanded(self,dest,process,ins,outs,ticks,power,line,tools,conditions,rolls,circuit,also_processes=()):
        if process.startswith('purify'):
            tier=int(process[6:]);chance=conditions.pop('purificationChance')
            if tier==1:
                for id,n in list(ins.items()):
                    if self.items[id]['kind']!='fluid':tools[id]=n;del ins[id]
            r=self.emit_recipe(process,ins,outs,ticks,power,line,tools,conditions,rolls,circuit)
            if r:r['purification']={'tier':tier,'chance':chance}
            return
        if process=='thermalBoil':
            steam=next((id for id in ('steam','superheatedSteam') if id in outs),None)
            if not steam or power or ticks!=20:raise ValueError('unsupported thermal boiler cycle')
            r=self.emit_recipe(process,ins,outs,ticks,power,line,tools,conditions,rolls,circuit)
            if r:
                r.update(stage=5,thermalBoiler={'steam':steam,'amount':outs[steam]},energyOutputs=[steam])
                self.stack('ItemList.Component_LavaFilter.get(1)')
            return
        if process.startswith('registered'):
            family=process.removeprefix('registered')
            if family=='Fuel':
                kind=conditions.get('fuelType')
                if kind is None:raise ValueError('missing fuel type')
                family=['Diesel','Gas','Hot','SemiFluid','Plasma','Magic'][int(kind) if 0<=kind<6 else 3]
            value=conditions.get('fuelValue')
            if not value or len(ins)!=1:raise ValueError('unsupported fuel shape')
            if family=='Magic':
                id=next(iter(ins));solid=self.items[id]['kind']!='fluid'
                r=self.emit_recipe('generateMagic',ins,outs,10,0,line,tools,{},rolls,circuit)
                if r:r.update(stage=2,fuel=id,fuelEU=value,fuelFamily='Magic',itemFuel=solid)
                if not solid and not any(f['id']==id and f['family']==family for f in self.extra_fuels):self.extra_fuels.append({'id':id,'family':family,'eu':value,'origin':{'file':self.active_file,'line':line}})
                return
            if self.items[next(iter(ins))]['kind']!='fluid':raise ValueError('nonfluid fuel needs its own generator')
            id=next(iter(ins));entry={'id':id,'family':family,'eu':value,'origin':{'file':self.active_file,'line':line}}
            if not any(f['id']==id and f['family']==family for f in self.extra_fuels):self.extra_fuels.append(entry)
            return
        if process=='generateLFTR':
            generation=conditions.get('lftrOutput',0)*4
            if not generation:raise ValueError('missing LFTR output power')
            bonus=self.stack('MaterialsElements.getInstance().URANIUM233.getFluidStack(1)')[0]
            r=self.emit_recipe(process,ins,outs,ticks,0,line,tools,{},rolls,circuit)
            if r:r.update(stage=6,generationPower=generation,reactorBonus=bonus)
            return
        if process=='sparge':
            ids=list(outs);gas=next(iter(ins));amount=ins[gas];maximum=conditions.get('spargeMaximum')
            if maximum is None or len(ids)<3 or ids[1]!=gas:raise ValueError('unsupported sparge output order')
            byproducts=ids[2:]
            if maximum<1 or amount<=len(byproducts):raise ValueError('invalid sparge byproduct range')
            envelope={**outs,gas:amount-len(byproducts)}
            for id in byproducts:envelope[id]=min(maximum,amount-1)
            r=self.emit_recipe(process,ins,envelope,ticks,power,line,tools,{'spargeMaximum':maximum},[],circuit)
            if r:
                r.pop('requirements',None)
                r['sparging']={'gas':gas,'amount':amount,'maximum':maximum,'byproducts':byproducts}
            return
        if dest=='algaePondRecipes':
            output_tier=conditions['algaeTier']
            if output_tier<=14:
                self.emit_recipe(process,ins,outs,ticks,int(min(2147483640,8*4**output_tier)*9//10),line,tools,conditions,rolls,circuit)
            if output_tier>0:
                input_tier=output_tier-1
                compost=self.stack('GregtechItemList.Compost.get('+str(min(64,2**max(0,input_tier-1)))+')')
                req={**conditions,'algaeTier':input_tier,'compostBoost':True}
                self.emit_recipe(process,{**ins,compost[0]:compost[1]},outs,ticks,int(min(2147483640,8*4**input_tier)*9//10),line,tools,req,rolls,circuit)
            path=self.source/'gregtech/common/tileentities/machines/multi/MTEAlgaePond.java'
            self.paths[str(path.relative_to(self.source))]=hashlib.sha256(path.read_bytes()).hexdigest()
            return
        if dest=='implosionRecipes' and len(ins)==1:
            amount=max(0,min(conditions.get('ADDITIVE_AMOUNT',0),64))
            req={k:v for k,v in conditions.items() if k!='ADDITIVE_AMOUNT'}
            explosives=[('new ItemStack(Blocks.tnt, '+str(amount)+')',amount),('GTModHandler.getIC2Item("industrialTnt", '+str(max(1,amount//4))+')',max(1,amount//4))]
            if amount*2<65:explosives.append(('ItemList.Block_Powderbarrel.get('+str(amount*2)+')',amount*2))
            if max(1,amount//2)<17:explosives.append(('GTModHandler.getIC2Item("dynamite", '+str(max(1,amount//2))+')',max(1,amount//2)))
            for expression,count in explosives:
                if count<=0:continue
                id,_=self.stack(expression)
                self.emit_recipe(process,{**ins,id:count},outs,20,30,line,tools,req,rolls,circuit,also_processes)
            return
        if dest=='primitiveBlastRecipes':
            count=conditions.get('ADDITIVE_AMOUNT',0)
            if count<=0:raise ValueError('primitive furnace requires fuel amount')
            for name,prefix,amount,duration,ash in [('Coal','gem',count,ticks,'AshDark'),('Charcoal','gem',count,ticks,'AshDark'),('Coal','dust',count,ticks,'AshDark'),('Charcoal','dust',count,ticks,'AshDark'),('Coke','item',count//2,ticks*2//3,'Ash')]:
                if amount<=0:continue
                fuel='coke' if name=='Coke' else self.material(name,prefix)
                ash_id=self.material(ash,'dust');n=max(1,amount//9);chance=amount*10000//9 if amount<9 else 10000
                self.items.setdefault('coke',{'id':'coke','name':'焦煤','kind':'item','category':'燃料'})
                slots=[*rolls,{'id':ash_id,'count':n,'chance':chance}]
                self.emit_recipe(process,{**ins,fuel:ins.get(fuel,0)+amount},{**outs,ash_id:n},duration,0,line,tools,{},slots,circuit,also_processes)
            return
        if process.startswith('generateNaquadah'):
            tier=int(process.removeprefix('generateNaquadah'))
            efficiency=80 if tier==4 else 100+50*(tier-5)
            value=conditions.get('fuelValue')
            if not value or len(ins)!=1:raise ValueError('unsupported nuclear fuel shape')
            r=self.emit_recipe(process,ins,outs,10,0,line,tools,{},rolls,circuit)
            if r:r.update(stage=tier+1,fuel=next(iter(ins)),fuelEU=value*10*efficiency,fuelFamily='Naquadah'+str(tier))
            return
        if dest in ('BlastFurnaceWithGas','UniversalArcFurnace'):
            amount=conditions.get('ADDITIVE_AMOUNT',1000 if dest=='BlastFurnaceWithGas' else 10)
            req={k:v for k,v in conditions.items() if k not in ('ADDITIVE_AMOUNT','NO_GAS','NO_GAS_CIRCUIT_CONFIG','RECYCLE')}
            if not conditions.get('RECYCLE'):
                gases=[('Nitrogen',1,1),('Helium',.9,1),('Argon',.8,.85),('Radon',.7,.7),('WerkstoffLoader_Neon',.6,.55),('WerkstoffLoader_Krypton',.5,.4),('WerkstoffLoader_Xenon',.4,.25),('WerkstoffLoader_Oganesson',.3,.1)]
                for name,time_mult,amount_mult in gases:
                    if name not in self.materials:continue
                    gas=self.material(name,'gas')
                    self.emit_recipe(process,{**ins,gas:int(amount*amount_mult)},outs,max(1,int(ticks*time_mult)),power,line,tools,req,rolls,11 if dest=='UniversalArcFurnace' else circuit,also_processes)
                if dest=='UniversalArcFurnace':
                    for name,mass,ratio in [('Argon',40,24),('Nitrogen',14,4)]:
                        amount=max(1,ticks//(mass*16));plasma=self.material(name,'plasma');gas=self.material(name,'gas')
                        self.emit_recipe(process,{**ins,plasma:amount},{**outs,gas:amount},max(1,ticks//ratio),power,line,tools,req,rolls,11,also_processes)
            if dest=='UniversalArcFurnace' or conditions.get('NO_GAS'):
                self.emit_recipe(process,ins,outs,max(1,int(ticks*1.25)),power,line,tools,req,rolls,1 if dest=='UniversalArcFurnace' else conditions.get('NO_GAS_CIRCUIT_CONFIG',circuit),also_processes)
            return
        if dest=='WaferEngravingRecipes':
            grade=3 if 'gtItem_Circuit_Silicon_Wafer5' in ins else 2 if 'gtItem_Circuit_Silicon_Wafer4' in ins else 1 if 'gtItem_Circuit_Silicon_Wafer3' in ins else 0
            if grade:
                variants={1:[('distilledWater',1),('Grade1PurifiedWater',.75),('Grade2PurifiedWater',.5)],2:[('Grade3PurifiedWater',1),('Grade4PurifiedWater',.5)],3:[('Grade5PurifiedWater',1),('Grade6PurifiedWater',.5)]}[grade]
                for name,ratio in variants:
                    water='distilledWater' if name=='distilledWater' else self.material(name)
                    self.emit_recipe(process,{**ins,water:ins.get(water,0)+100},outs,int(ticks*ratio),power,line,tools,conditions,rolls,circuit,also_processes)
                return
        if any(k in conditions for k in ('ADDITIVE_AMOUNT','RECYCLE','NO_GAS','NO_GAS_CIRCUIT_CONFIG')):
            raise ValueError('map helper metadata requires expansion')
        if process=='plasmaMix':
            multiplier=conditions.get('euMultiplier',10)
            total=int(multiplier*power*ticks)
            if total<1 or total>9007199254740991:raise ValueError('prepaid batch EU exceeds exact integer storage')
            r=self.emit_recipe(process,ins,outs,ticks,power,line,tools,conditions,rolls,circuit,also_processes)
            if r:r.update(batchEU=total,euMultiplier=multiplier,stage=12)
            return
        self.emit_recipe(process,ins,outs,ticks,power,line,tools,conditions,rolls,circuit,also_processes)

    def builders_at(self,path,label):
        text=path.read_text(encoding='utf-8');self.active_file=label
        self.paths[label]=hashlib.sha256(path.read_bytes()).hexdigest()
        text=re.sub(r'/\*.*?\*/|//[^\n]*',lambda m:'\n'*m[0].count('\n'),text,flags=re.S)
        self.local_fluids={var:self.gtpp_materials.get('MaterialMisc.'+name,'GTPPFluid_'+name) for var,name in re.findall(r'FluidStack\s+(\w+)\s*=\s*(?:MaterialMisc\.)?(\w+)\.getFluidStack',text)}
        # Only immutable literal material aliases are safe across method scopes.
        self.constants=dict(re.findall(r'(?:final\s+)?Materials\s+(\w+)\s*=\s*((?:Materials\.\w+|(?:WerkstoffLoader|GGMaterial)\.\w+\.getGTMaterial\(\)))\s*;',text))
        for path,key in re.findall(r'^import static (gtPlusPlus\.core\.material\.[\w.]+)\.(\w+);',text,re.M):self.constants[key]=path.removeprefix('gtPlusPlus.core.material.').removeprefix('nuclear.')+'.'+key
        for namespace,key in re.findall(r'^import static (?:bartworks.system.material|goodgenerator.items|gtnhlanth.common.register)\.(\w+)\.(\w+);',text,re.M):self.constants[key]=namespace+'.'+key
        for key in re.findall(r'^import static gregtech.api.enums.Materials\.(\w+);',text,re.M):self.constants[key]='Materials.'+key
        for key in re.findall(r'^import static gregtech.api.enums.OrePrefixes\.(\w+);',text,re.M):self.constants[key]='OrePrefixes.'+key
        if re.search(r'^import static gregtech.api.enums.Materials\.\*;',text,re.M):
            self.constants.update({key:'Materials.'+key for key in self.materials if '.' not in key and not key.startswith(('GTPP','Werkstoff','FluidLoader'))})
        assignment=re.search(r'\bLuVMat\s*=\s*(WerkstoffLoader\.\w+\.getGTMaterial\(\));',text)
        if assignment:self.constants['LuVMat']=assignment[1]
        for key,kind in re.findall(r'(?:private\s+)?static\s+final\s+(\w+Key)\s+(\w+)\s*=\s*\1\.INSTANCE\s*;',text):
            self.constants[kind]=key+'.INSTANCE'
        self.constants.update({'MOTOR_CIRCUIT':'1','PISTON_CIRCUIT':'2','PUMP_CIRCUIT':'3','ROBOT_ARM_CIRCUIT':'4',
          'CONVEYOR_CIRCUIT':'5','EMITTER_CIRCUIT':'6','SENSOR_CIRCUIT':'7','FIELD_GENERATOR_CIRCUIT':'8'})
        for key,value in re.findall(r'\b(COAL_\w+|\w+_CIRCUIT)\s*=\s*(\d+)\s*[,;]',text):self.constants[key]=value
        self.constants.update(self.dtpf_calculators(text))
        # Ordered lists populated by configureSparging() are immutable once
        # initialized. Resolve references from their real .add() expressions.
        if label.endswith('/RecipeLoaderLFTR.java'):
            lists={}
            for match in re.finditer(r'(mSpargeGases|mNobleGases|mFluorideGases)\.add\(',text):
                end=base.matching(text,match.end()-1)
                value=text[match.end():end];key=match[1]+'.get('+str(len(lists.get(match[1],[])))+')'
                lists.setdefault(match[1],[]).append(value);self.constants[key]=value
        self.constants['PCBFactoryManager.mTiersOfPlastics']='8'
        config=(self.instance/'.minecraft/config/GregTech/GregTech.cfg').read_text(encoding='utf-8')
        self.constants['outputIngotAmount']='2' if 'B:mixedOreOnlyYieldsTwoThirdsOfPureOre=true' in config else '3'
        loops=[]
        if label=='bartworks/common/loaders/BioRecipeLoader.java':
            for loop in re.finditer(r'for\s*\(\s*FluidStack\s+(\w+)\s*:\s*(\w+)\s*\)\s*\{',text):
                declarations=list(re.finditer(r'FluidStack\[\]\s+'+re.escape(loop[2])+r'\s*=\s*\{([^}]+)}',text[:loop.start()]))
                if not declarations:continue
                values=base.split_args(declarations[-1][1]);start=loop.end()-1;depth=1;end=start+1
                while end<len(text) and depth:
                    depth+=(text[end]=='{')-(text[end]=='}');end+=1
                if all(re.fullmatch(r'Materials\.Water\.getFluid\([\d_]+\)|GTModHandler\.getDistilledWater\([\d_]+\)',v) for v in values):loops.append((loop[1],values,start,end))
        for loop in re.finditer(r'for\s*\(\s*(?:var|Materials|Werkstoff)\s+(\w+)\s*:\s*new\s+(?:Materials|Werkstoff)\[\]\s*\{([^}]+)\}\s*\)\s*\{',text):
            start=loop.end()-1;depth=1;end=start+1
            while end<len(text) and depth:
                depth+=(text[end]=='{')-(text[end]=='}');end+=1
            values=base.split_args(loop[2])
            # Unqualified Materials constants are legal under static wildcard imports.
            values=['Materials.'+v if v in self.materials else v for v in values]
            if all(re.fullmatch(r'(?:Materials|WerkstoffLoader|GGMaterial)\.\w+',v) for v in values):loops.append((loop[1],values,start,end))
        # Numeric counted loops are evaluated only for bounded literal ranges.
        counted=[]
        for loop in re.finditer(r'for\s*\(\s*(?:int|long)\s+(\w+)\s*=\s*([^;]+);\s*\1\s*(<=|<)\s*([^;]+);\s*\1\+\+\s*\)\s*\{',text):
            start=loop.end()-1;scope=scopes_at(text,[start+1])[start+1];depth=1;end=start+1
            while end<len(text) and depth:
                depth+=(text[end]=='{')-(text[end]=='}');end+=1
            try:
                low=int(numeric(self.resolve(loop[2])));high=int(numeric(self.resolve(loop[4])))+(loop[3]=='<=')
                if 0<=high-low<=64:counted.append((loop[1],[str(n) for n in range(low,high)],start,end))
            except (ValueError,SyntaxError,KeyError,IndexError):pass
        loops.extend(counted)
        declarations=list(re.finditer(r'\b(?:final\s+)?(ItemStack|FluidStack|Fluid|Materials|int|long|float|double)\s+(\w+)\s*=\s*([^;]+);',text))
        builders=list(re.finditer(r'GTValues\.RA\.stdBuilder\(\)',text))
        scopes=scopes_at(text,[m.start() for m in declarations+builders])
        imports=dict(self.constants)
        helpers=[]
        if label=='gregtech/loaders/postload/recipes/CuttingRecipes.java':
            for helper in ('recipeWithClassicFluids','recipeWithPurifiedWater'):
                declaration=re.search(r'public void '+helper+r'\((.*?)\)\s*\{',text,re.S)
                if not declaration:raise ValueError('changed cutting helper signature')
                parameters=[arg.strip().split()[-1] for arg in base.split_args(declaration[1])]
                start=declaration.end()-1;end=start+1;depth=1
                while end<len(text) and depth:
                    depth+=(text[end]=='{')-(text[end]=='}');end+=1
                options=[]
                for call in re.finditer(r'(?<!void )'+helper+r'\(',text):
                    close=base.matching(text,call.end()-1);args=base.split_args(text[call.end():close])
                    if len(args)!=len(parameters):raise ValueError('changed cutting helper arity')
                    for i,param in enumerate(parameters):
                        if param in ('duration','boostedDuration','eut'):
                            try:args[i]=str(numeric(self.resolve(args[i])))
                            except (ValueError,SyntaxError):pass
                    # Caller-local and loop references remain unresolved;
                    # only literal registrations can enter this expansion.
                    options.append(dict(zip(parameters,args)))
                helpers.append((start,end,options))
        if label=='gregtech/loaders/postload/recipes/ChemicalRecipes.java':
            declaration=re.search(r'public void addDefaultPolymerizationRecipes\(Fluid (\w+), Fluid (\w+)\)\s*\{',text)
            if not declaration:raise ValueError('changed polymerization helper signature')
            start=declaration.end()-1;end=start+1;depth=1
            while end<len(text) and depth:
                depth+=(text[end]=='{')-(text[end]=='}');end+=1
            parameters=declaration.groups();options=[]
            for call in re.finditer(r'(?<!void )addDefaultPolymerizationRecipes\(',text):
                close=base.matching(text,call.end()-1);args=base.split_args(text[call.end():close])
                if len(args)==len(parameters) and all(re.fullmatch(r'Materials\.\w+\.(?:mFluid|mGas|mStandardMoltenFluid)',arg.strip()) for arg in args):options.append(dict(zip(parameters,args)))
            if not options:raise ValueError('missing polymerization registrations')
            helpers.append((start,end,options))
        if label=='bartworks/system/material/gtenhancement/PlatinumSludgeRecipes.java':
            declaration=re.search(r'private static void registerConcentrateFeedRecipes\(Materials (\w+)\)\s*\{',text)
            if not declaration:raise ValueError('changed platinum feed helper signature')
            start=declaration.end()-1;end=start+1;depth=1
            while end<len(text) and depth:
                depth+=(text[end]=='{')-(text[end]=='}');end+=1
            options=[{declaration[1]:m[1]} for m in re.finditer(r'registerConcentrateFeedRecipes\((Materials\.\w+)\);',text)]
            if not options:raise ValueError('missing platinum concentrate feeds')
            helpers.append((start,end,options))
        for match in builders:
            line=text.count('\n',0,match.start())+1;body=text[match.end():text.find(';',match.end())]
            if any(re.search(r'\brunDevEnvironmentRecipes\s*\([^)]*\)\s*$',text[max(0,start-200):start]) for start in scopes[match.start()]):
                continue  # Development fixtures are never production recipes.
            contexts=[{}]
            for start,end,options in helpers:
                if start<match.start()<end:contexts=[{**context,**option} for context in contexts for option in options]
            for var,options,start,end in loops:
                if start<match.start()<end:
                    contexts=[{**context,var:value} for context in contexts for value in options]
            scope=scopes[match.start()]
            for context in contexts:
                self.constants={**imports,**context}
                for declaration in declarations:
                    if declaration.start()>=match.start():break
                    parent=scopes[declaration.start()]
                    if scope[:len(parent)]!=parent or declaration[2] in context:continue
                    # A for initializer belongs to that loop, not the method.
                    if re.search(r'for\s*\(\s*$',text[max(0,declaration.start()-20):declaration.start()]):continue
                    value=declaration[3]
                    if declaration[1] in ('int','long','float','double'):
                        try:value=str(numeric(self.resolve(value)))
                        except (ValueError,SyntaxError,KeyError,IndexError,ZeroDivisionError):continue
                    self.constants[declaration[2]]=value
                part=body
                if label=='gregtech/loaders/postload/recipes/CuttingRecipes.java' and context.get('inputs'):
                    for field,param in [('itemInputs','inputs'),('itemOutputs','outputs')]:
                        array=re.fullmatch(r'new\s+ItemStack\[\]\s*\{(.*)\}',context[param].strip(),re.S)
                        if array:part=part.replace('.'+field+'('+param+')','.'+field+'('+array[1]+')')
                # PCB's output list splits a computed total across stack slots.
                # Evaluate the actual list additions, including source quirks.
                if label.endswith('/PCBFactoryRecipes.java') and 'aBoards.toArray' in part and 'amountOfBoards' in self.constants:
                    amount=int(numeric(self.constants['amountOfBoards']));prefix=text[max(scope):match.start()]
                    adds=re.findall(r'aBoards\.add\((.*?)\);',prefix,re.S)
                    slots=[]
                    if len(adds)==2:
                        for i in range(amount,64,-64):
                            value=re.sub(r'\bi\b',str(i),adds[0]);value=re.sub(r'\bamountOfBoards\b',str(amount),value);slots.append(value);amount-=64
                        slots.append(re.sub(r'\bamountOfBoards\b',str(amount),adds[-1]))
                        part=re.sub(r'aBoards\.toArray\(new ItemStack\[0\]\)',','.join(slots),part)
                self.parse_builder(part,line,label)

    def parse_builder(self,body,line,label):
        try:
            calls={};metadata=[];pos=0
            while pos<len(body):
                m=re.search(r'\.([A-Za-z]\w*)\s*\(',body[pos:])
                if not m:break
                start=pos+m.end()-1;end=base.matching(body,start);arg=body[start+1:end]
                if m[1]=='metadata':metadata.append(base.split_args(arg))
                elif m[1] in calls and m[1] in {'itemInputs','itemInputsUnified','itemInputsUnsafe','itemOutputs','fluidInputs','fluidOutputs','outputChances','addTo'}:
                    calls[m[1]]+=','+arg
                else:calls[m[1]]=arg
                pos=end+1
            if 'fake' in calls:return  # NEI display entries are not executable recipes.
            allowed={'itemInputs','itemInputsUnified','itemOutputs','fluidInputs','fluidOutputs','duration','eut','addTo','circuit','outputChances','noOptimize','requiresCleanRoom','requiresLowGravity','specialValue','ignoreCollision','nbtSensitive','recipeCategory','itemInputsUnsafe','requireMods','hidden','special'}
            unknown=set(calls)-allowed
            if unknown:raise ValueError('unsupported builder '+','.join(sorted(unknown)))
            if 'nbtSensitive' in calls:raise ValueError('NBT sensitive recipe needs stack data')
            destinations=[value.strip().split('.')[-1] for value in base.split_args(calls.get('addTo',''))]
            if not destinations or any(not value for value in destinations):raise ValueError('missing recipe map')
            unsupported=sorted(set(destinations)-set(MAPS))
            if unsupported:raise ValueError('unsupported map '+', '.join(unsupported))
            dest=destinations[0]
            if 'fake' in calls:raise ValueError('display-only recipe')
            for mod in base.split_args(calls.get('requireMods','')):
                key=mod.strip().removeprefix('Mods.')
                if self.mod_ids.get(key) not in self.installed_mods:raise ValueError('required mod not installed: '+key)
            processes=list(dict.fromkeys(MAPS[value] for value in destinations))
            process=processes[0];also_processes=processes[1:]
            conditions={};tools={};circuit=numeric(self.resolve(calls['circuit'])) if 'circuit' in calls else None
            if 'special' in calls:
                if process!='bioVat':raise ValueError('unsupported special slot for '+process)
                culture=self.stack(calls['special'])
                if not culture or culture[1]!=1 or not self.items[culture[0]].get('nativeItem',{}).get('nbt',{}).get('Name'):raise ValueError('unresolved bacterial vat culture')
                conditions['bioCulture']=culture[0]
            if 'requiresCleanRoom' in calls:conditions['cleanroom']=True
            if 'requiresLowGravity' in calls:conditions['lowGravity']=True
            for key,value in metadata:
                key=self.resolve(key.strip())
                if key.endswith('CompressionTierKey.INSTANCE'):key='COMPRESSION_TIER'
                elif key.endswith('PurificationPlantBaseChanceKey.INSTANCE'):key='PURIFICATION_CHANCE'
                elif key.endswith('PCBFactoryTierKey.INSTANCE'):key='PCB_FACTORY_TIER'
                elif key.endswith('PCBFactoryUpgradeKey.INSTANCE'):key='PCB_FACTORY_UPGRADE'
                elif key.endswith('CentrifugeRecipeKey.INSTANCE'):key='HEAVY_CENTRIFUGE'
                elif key.endswith('NanochipAssemblyMatrixTierKey.INSTANCE'):key='NANOCHIP_TIER'
                elif key.endswith('BoardProcessingModuleFluidKey.INSTANCE'):key='BOARD_BATH'
                else:key=key.split('.')[-1]
                if key=='PURIFICATION_CHANCE':conditions['purificationChance']=numeric(self.resolve(value))
                elif key=='GLASS' and process=='bioVat':conditions['bioGlass']=numeric(self.resolve(value))
                elif key=='SIEVERT' and process=='bioVat':conditions['radiation']=self.biochemistry.sievert(self,value,numeric)
                elif key in ('COIL_HEAT','FUSION_THRESHOLD'):
                    conditions[{'COIL_HEAT':'heat','FUSION_THRESHOLD':'startup'}[key]]=numeric(self.resolve(value))
                elif key in ('ADDITIVE_AMOUNT','NO_GAS','NO_GAS_CIRCUIT_CONFIG','RECYCLE'):
                    conditions[key]=value.strip()=='true' if key in ('NO_GAS','RECYCLE') else numeric(value)
                elif key=='FUEL_VALUE':conditions['fuelValue']=numeric(value)
                elif key=='FUEL_TYPE':conditions['fuelType']=numeric(value)
                elif key=='LFTR_OUTPUT_POWER':conditions['lftrOutput']=numeric(self.resolve(value))
                elif key=='SPARGE_MAX_BYPRODUCT':conditions['spargeMaximum']=numeric(self.resolve(value))
                elif key in ('COMPRESSION_TIER','CHEMPLANT_CASING_TIER','PRECISE_ASSEMBLER_CASING_TIER','COAL_CASING_TIER','MODULE_TIER','EU_MULTIPLIER'):
                    conditions[{'COMPRESSION_TIER':'compressionTier','CHEMPLANT_CASING_TIER':'chemicalCasing','PRECISE_ASSEMBLER_CASING_TIER':'preciseCasing','COAL_CASING_TIER':'componentCasing','MODULE_TIER':'spaceModule','EU_MULTIPLIER':'euMultiplier'}[key]]=numeric(self.resolve(value))
                elif key=='DISSOLUTION_TANK_RATIO':conditions['dissolutionRatio']=numeric(self.resolve(value))
                elif key=='PCB_FACTORY_TIER':conditions['pcbTier']=numeric(self.resolve(value))
                elif key=='PCB_FACTORY_UPGRADE':
                    upgrade=value.strip().split('.')[-1]
                    if upgrade=='BIO':conditions['bioUpgrade']=True
                    elif upgrade!='NONE':raise ValueError('unknown PCB factory upgrade '+upgrade)
                elif key=='QFT_CATALYST':
                    catalyst=self.stack(value)
                    if catalyst:tools[catalyst[0]]=1
                elif key=='QFT_FOCUS_TIER':conditions['qftFocus']=numeric(self.resolve(value))
                elif key=='NKE_RANGE':
                    match=re.fullmatch(r'computeRangeNKE\(([^,]+),(.+)\)',self.resolve(value))
                    if match:
                        maximum=max(1,min(1100,numeric(match[1])));minimum=max(0,numeric(match[2]))
                        minimum=min(minimum,maximum-1);conditions['nkeRange']={'min':minimum,'max':maximum}
                    else:
                        encoded=numeric(self.resolve(value));conditions['nkeRange']={'min':encoded%10000,'max':encoded//10000}
                elif key in ('FOG_PLASMA_TIER','FOG_EXOTIC_TIER'):
                    conditions['plasmaTier' if key=='FOG_PLASMA_TIER' else 'exoticTier']=numeric(self.resolve(value))
                elif key=='FOG_PLASMA_MULTISTEP':conditions['multiStepPlasma']=value.strip()=='true'
                elif key=='NFR_COIL_TIER':conditions['refineryCoil']=numeric(self.resolve(value))
                elif key=='NANO_FORGE_TIER':conditions['nanoForgeTier']=numeric(self.resolve(value))
                elif key=='ALGAE_POND_TIER':conditions['algaeTier']=numeric(self.resolve(value))
                elif key=='PCB_NANITE_MATERIAL':
                    material=self.resolve(value).split('.')[-1]
                    conditions['pcbNaniteMaterial']=material
                    tools[self.material(material,'nanite')]=1
                elif key=='HEAVY_CENTRIFUGE':conditions['heavyCentrifuge']=value.strip()=='true'
                elif key=='NANOCHIP_TIER':conditions['nanochipTier']=numeric(self.resolve(value))
                elif key=='CIRCUIT_CALIBRATION_TYPE':conditions['nanochipCalibration']=self.resolve(value).split('.')[-1]
                elif key=='BOARD_BATH':conditions['boardBath']=numeric(value)
                elif key=='CLEANROOM':
                    boolean=self.resolve(value).strip()
                    if boolean not in ('true','false'):raise ValueError('unresolved cleanroom condition '+boolean)
                    if boolean=='true':conditions['cleanroom']=True
                elif key=='LOW_GRAVITY':conditions['lowGravity']=value.strip()=='true'
                elif key=='RESEARCH_ITEM':
                    item=self.stack(value);conditions['researchItem']=item[0]
                elif key=='SCANNING':
                    m=re.fullmatch(r'new\s+Scanning\((.*)\)',value,re.S)
                    if not m:raise ValueError('dynamic research')
                    args=base.split_args(m[1]);conditions['scanTicks']=numeric(args[0]);conditions['scanEUt']=numeric(args[1])
                else:raise ValueError('unsupported condition '+key)
            if 'specialValue' in calls:
                special=numeric(self.resolve(calls['specialValue']))
                if dest=='quantumForceTransformerRecipes':conditions['qftTier']=special
                elif MAPS[dest]=='electricBlast':conditions['heat']=special
                else:raise ValueError('untyped special value for '+dest)
            input_options=[];outs={};rolls=[]
            for field in ('itemInputs','itemInputsUnified','itemInputsUnsafe','fluidInputs'):
                for arg in base.split_args(calls.get(field,'')):
                    options=self.variants(arg)
                    if options==[None]:continue
                    if options[0][0]=='@circuit':circuit=options[0][1];continue
                    if any(n<0 for _,n in options):raise ValueError('negative ingredient')
                    if len(options)==1 and options[0][1]==0:tools[options[0][0]]=1;continue
                    if any(n<=0 for _,n in options):raise ValueError('invalid substitute amount')
                    input_options.append(options)
            for field in ('itemOutputs','fluidOutputs'):
                args=base.split_args(calls.get(field,''))
                chances=[numeric(x) for x in base.split_args(calls.get('outputChances',''))] if field=='itemOutputs' else []
                if chances and len(chances)!=len(args):raise ValueError('chance slot mismatch')
                for i,arg in enumerate(args):
                    result=self.stack(arg)
                    if result is None:continue
                    id,n=result
                    if n==0 and process=='sparge' and field=='fluidOutputs':n=1 # runtime randomized slots, expanded below
                    if n<=0:raise ValueError('invalid output count')
                    chance=chances[i] if chances else 10000
                    if not 0<=chance<=10000:raise ValueError('invalid probability')
                    outs[id]=outs.get(id,0)+n;rolls.append({'id':id,'count':n,'chance':chance})
            variants=1
            for options in input_options:variants*=len(options)
            if variants>4096:raise ValueError('too many substitute combinations')
            for selected in itertools.product(*input_options):
                ins={}
                for id,n in selected:ins[id]=ins.get(id,0)+n
                self.emit_expanded(dest,process,ins,outs,numeric(self.resolve(calls.get('duration','20' if dest=='implosionRecipes' else '0'))),numeric(self.resolve(calls.get('eut','30' if dest=='implosionRecipes' else '0'))),line,tools,conditions,rolls,circuit,also_processes)
        except (ValueError,KeyError,SyntaxError,IndexError,TypeError,ZeroDivisionError) as error:
            self.skipped.append({'file':label,'line':line,'reason':str(error)[:220]})

    def material_templates(self):
        shaping_spec=importlib.util.spec_from_file_location('material_shaping',ROOT/'scripts/gtnh-shaping.py')
        shaping=importlib.util.module_from_spec(shaping_spec);shaping_spec.loader.exec_module(shaping)
        shapes=shaping.Shaping(self,numeric,base.matching)
        text=(self.source/'gregtech/loaders/materials/MaterialsInit.java').read_text(encoding='utf-8')
        elements=(self.source/'gregtech/api/enums/Element.java').read_text(encoding='utf-8')
        masses={key:int(p)+int(n) for key,p,n in re.findall(r'^\s*(\w+)\((\d+),\s*(\d+),',elements,re.M)}
        def mass(name,visited=frozenset()):
            if name in visited:return None
            m=self.materials.get(name)
            if not m:return None
            if m['element']:return masses.get(m['element'])
            if not m['components']:return masses.get('Tc',98)
            parts=[(mass(k,visited|{name}),n) for k,n in m['components']]
            if any(v is None for v,n in parts):return None
            body=re.search(r'private static Materials load'+re.escape(name)+r'\(\)\s*\{(.*?)(?=\n    private static|\Z)',text,re.S)
            density=re.search(r'\.setDensity\(([^)]+)\)',body[1]) if body else None
            if not m['defaultDensity'] and not density:return None
            numerator,denominator=map(numeric,base.split_args(density[1])) if density else (1,1)
            fixed_density=int(3628800*numerator/denominator)
            return fixed_density*sum(v*n for v,n in parts)//(3628800*sum(n for v,n in parts))
        # Restore the source-specific ore routes excluded from the conservative
        # base import, keeping every output replacement in the actual chain.
        base.Importer.ore_locations(self)
        special_spec=importlib.util.spec_from_file_location('special_ores',ROOT/'scripts/gtnh-special-ores.py')
        special=importlib.util.module_from_spec(special_spec);special_spec.loader.exec_module(special)
        self.extra_ores=special.generate(self,mass,numeric)
        # Generate only forms actually needed by literal recipes or existing game
        # metals. A referenced ore prefix is evidence that the form is registered.
        needed={}
        # Literal Core/addon recipes and dynamic device references have already
        # populated these native forms. Include them before material expansion;
        # scanning only GT recipe files misses most high-tier dependencies.
        for item in self.items.values():
            native=item.get('native',{})
            if native.get('material') in self.materials and native.get('prefix'):needed.setdefault(native['material'],set()).add(native['prefix'])
        needed.setdefault('PolyphenyleneSulfide',set()).add('foil')
        for path in self.source.rglob('*.java'):
            if 'recipe' not in str(path).lower():continue
            t=path.read_text(encoding='utf-8')
            for form,name in re.findall(r'OrePrefixes\.(\w+),\s*Materials\.(\w+)',t):needed.setdefault(name,set()).add(form)
            for form,name in re.findall(r'OrePrefixes\.(\w+)\.get\(Materials\.(\w+)\)',t):needed.setdefault(name,set()).add(form)
            getters={'Plates':'plate','Ingots':'ingot','Nuggets':'nugget','Blocks':'block','Dust':'dust','Rods':'stick','LongRods':'stickLong'}
            for name,method in re.findall(r'Materials\.(\w+)\.get(Plates|Ingots|Nuggets|Blocks|Dust|Rods|LongRods)\(',t):needed.setdefault(name,set()).add(getters[method])
        for rod in ('Magnalium','Titanium','TungstenSteel','Americium'):needed.setdefault(rod,set()).add('stickLong')
        component_spec=importlib.util.spec_from_file_location('component_forms',ROOT/'scripts/gtnh-component-forms.py')
        component_forms=importlib.util.module_from_spec(component_spec);component_spec.loader.exec_module(component_forms)
        component_forms.generate(self,needed,mass,numeric)
        bootstrap_spec=importlib.util.spec_from_file_location('bootstrap',ROOT/'scripts/gtnh-bootstrap.py')
        bootstrap=importlib.util.module_from_spec(bootstrap_spec);bootstrap_spec.loader.exec_module(bootstrap)
        bootstrap.generate(self,numeric)
        gtpp_spec=importlib.util.spec_from_file_location('gtpp_forms',ROOT/'scripts/gtnh-gtpp-forms.py')
        gtpp_forms=importlib.util.module_from_spec(gtpp_spec);gtpp_spec.loader.exec_module(gtpp_forms)
        gtpp_forms.generate(self,needed,numeric,base.split_args,base.matching)
        self.items.setdefault('wrench',{'id':'wrench','name':'扳手','kind':'item','category':'工具','icon':'wrench'})
        self.items.setdefault('hammer',{'id':'hammer','name':'锻造锤','kind':'item','category':'工具','icon':'hammer'})
        self.active_file='gregtech/loaders/oreprocessing/ProcessingToolOther.java'
        self.paths[self.active_file]=hashlib.sha256((self.source/self.active_file).read_bytes()).hexdigest()
        wrench=self.emit_recipe('craft',{self.material('Iron','ingot'):6},{'wrench':1},1,0,44,{'hammer':1},{},[],None)
        if wrench:wrench.update(stage=0,grid=['iron',None,'iron','iron','iron','iron',None,'iron',None],gridTools={'1':'hammer'},handToolsAdapted=True,durationAdapted=True)
        # Wire bundling is outside ProcessingWire's NO_SMASHING check, and
        # applies to superconductors without ordinary metal ingots as well.
        self.active_file='gregtech/loaders/oreprocessing/ProcessingWire.java'
        self.paths[self.active_file]=hashlib.sha256((self.source/self.active_file).read_bytes()).hexdigest()
        for name,forms in list(needed.items()):
            if name not in self.materials:continue
            for width,ticks in [(2,150),(4,200),(8,300),(12,400),(16,500)]:
                suffix=str(width).zfill(2);prefix='wireGt'+suffix
                if prefix in forms or 'cableGt'+suffix in forms:
                    self.emit_recipe('assemble',{self.material(name,'wireGt01'):width},{self.material(name,prefix):1},ticks,self.materials[name]['processingEU'] or 8,116,{}, {},[],width)
        for name,m in self.materials.items():
            if not m['metal'] or 'NO_WORKING' in m['tags']:continue
            value=mass(name)
            if value is None:continue
            body=re.search(r'private static Materials load'+name+r'\(\)\s*\{(.*?)(?=\n    private static|\Z)',text,re.S)
            if not body:continue
            body=body[1]
            def number_field(pattern,default):
                match=re.search(pattern,body);return numeric(match[1]) if match else default
            forms=needed.get(name,set())|{'plate','stick','dust','ingot','molten','nugget'}
            for prefix in list(forms):
                if prefix.startswith('cableGt'):forms.add(prefix.replace('cableGt','wireGt'))
            if any(prefix.startswith('wireGt') for prefix in forms):forms.add('wireGt01')
            if 'wireGt01' in forms and '.removeOrePrefix(OrePrefixes.wireFine)' not in body:forms.add('wireFine')
            smelt_into=re.search(r'\.setSmeltingInto\(\(\) -> Materials\.(\w+)',body)
            m['smeltInto']=smelt_into[1] if smelt_into else name
            if '.addToolHeadItems()' in body and not any(tag in m['tags'] for tag in ('NO_SMASHING','BOUNCY')):
                forms|={'plateDouble','screw','bolt','stickLong','turbineBlade'}
            def form(prefix):return self.material(name,prefix)
            def emit(process,ins,outs,ticks,eu,template,tools=None,conditions=None,circuit=None):
                self.active_file=('gregtech/api/util/' if template=='GTRecipeRegistrator' else 'gregtech/loaders/oreprocessing/')+template+'.java'
                path=self.source/self.active_file;self.paths[self.active_file]=hashlib.sha256(path.read_bytes()).hexdigest()
                source=path.read_text(encoding='utf-8');marker='registerReverseFluidSmelting' if template=='GTRecipeRegistrator' and process=='melt' else 'registerWiremillRecipes' if template=='GTRecipeRegistrator' else 'public void registerOre'
                line=source.count('\n',0,max(0,source.find(marker)))+1
                r=self.emit_recipe(process,ins,outs,ticks,eu if process in ('electricBlast','freeze') else m['processingEU'] or eu,line,tools or {},conditions or {},[],circuit)
                if r:r['origin']['material']={'file':'gregtech/loaders/materials/MaterialsInit.java','line':m['line']}
            shapes.generate(name,m,value,forms,number_field(r'\.setBlastFurnaceTemp\(([^)]+)\)',0))
            if name not in ('Calcium','Magnesia') and 'foil' in forms:
                emit('bend',{form('plate'):1},{form('foil'):4},max(value,1),24,'ProcessingFoil',circuit=1)
            if 'itemCasing' in forms:
                try:tool=self.named('Shape_Extruder_Casing')
                except ValueError:tool=None
                if tool:emit('extrude',{form('ingot'):1},{form('itemCasing'):2},max(value,1),45,'ProcessingPlate',tools={tool:1})
                if name not in ('AnnealedCopper','CastIron'):
                    try:tool=self.named('Shape_Mold_Casing')
                    except ValueError:tool=None
                    if tool:emit('solidify',{form('molten'):72},{form('itemCasing'):1},16,8,'ProcessingPlate',tools={tool:1})
                for coolant,minimum,maximum,divisor,ratio in [('Water',4,1000,320,2),('DistilledWater',3,750,426,2),('Lubricant',1,250,1280,1),('DimensionallyShiftedSuperfluid',1,10,4000,.4)]:
                    liquid='distilledWater' if coolant=='DistilledWater' else self.material(coolant)
                    emit('cut',{form('plate'):1,liquid:max(minimum,min(maximum,max(value,1)*(m['processingEU'] or 16)//divisor))},{form('itemCasing'):2},max(1,int(value*ratio)),16,'ProcessingPlate')
            if m['blast'] and '.setAutoGenerateBlastFurnaceRecipes(false)' not in body:
                heat=number_field(r'\.setBlastFurnaceTemp\(([^)]+)\)',0)
                if heat>0 and 'NO_SMELTING' not in m['tags']:
                    target=form('ingotHot') if heat>1750 else form('ingot')
                    emit('electricBlast',{form('dust'):1},{target:1},max(value//40,1)*heat,120,'ProcessingDust',conditions={'heat':heat},circuit=1)
            # Hot ingots are cooled using the mass rule from ProcessingIngotHot.
            heat=number_field(r'\.setBlastFurnaceTemp\(([^)]+)\)',0)
            if m['blast'] and heat>1750 and '.setAutoGenerateVacuumFreezerRecipes(false)' not in body:
                emit('freeze',{form('ingotHot'):1},{form('ingot'):1},max(value*3,1),120,'ProcessingIngot')
            if 'NO_SMASHING' not in m['tags']:
                emit('bend',{form('ingot'):1},{form('plate'):1},max(value,1),24,'ProcessingIngot',circuit=1)
                for n,prefix in [(2,'plateDouble'),(3,'plateTriple'),(4,'plateQuadruple'),(5,'plateQuintuple'),(9,'plateDense')]:
                    if prefix in forms:emit('bend',{form('ingot'):n},{form(prefix):1},max(value*n,1),96,'ProcessingIngot',circuit=n)
                if 'wireGt01' in forms:
                    if 'wireFine' in forms:
                        emit('wire',{form('ingot'):1},{form('wireGt01'):2},100,4,'GTRecipeRegistrator',circuit=1)
                        emit('wire',{form('stick'):1},{form('wireGt01'):1},50,4,'GTRecipeRegistrator',circuit=1)
                        emit('wire',{form('ingot'):1},{form('wireFine'):8},100,4,'GTRecipeRegistrator',circuit=3)
                        emit('wire',{form('stick'):1},{form('wireFine'):4},50,4,'GTRecipeRegistrator',circuit=3)
                        for width,ingot_ticks,rod_ticks in [(2,150,100),(4,200,150),(8,250,200),(12,300,250),(16,350,300)]:
                            prefix='wireGt'+str(width).zfill(2)
                            if prefix in forms:
                                emit('wire',{form('ingot'):width//2},{form(prefix):1},ingot_ticks,4,'GTRecipeRegistrator',circuit=width)
                                emit('wire',{form('stick'):width},{form(prefix):1},rod_ticks,4,'GTRecipeRegistrator',circuit=width)
                    if 'wireFine' in forms:emit('wire',{form('wireGt01'):1},{form('wireFine'):4},200,8,'ProcessingWire',circuit=1)
            # Insulation differs between low-voltage alloys and high-tier
            # conductors. Use ProcessingWire's assembler routes, including PPS
            # foil for the latter; do not give every wire a cheap rubber route.
            low_cables={'RedAlloy','Cobalt','Lead','Tin','Zinc','SolderingAlloy','RedstoneAlloy','Iron','Nickel','Cupronickel','Copper','AnnealedCopper','ElectricalSteel','Kanthal','Gold','Electrum','Silver','BlueAlloy','EnergeticAlloy','Nichrome','Steel','BlackSteel','Titanium','Aluminium','TPVAlloy','VibrantAlloy'}
            for width in (1,2,4,8,12,16):
                cable='cableGt'+str(width).zfill(2)
                if cable not in forms:continue
                cost=width//4+1;wire=form('wireGt'+str(width).zfill(2))
                extra={} if name in low_cables else {self.material('PolyphenyleneSulfide','foil'):cost}
                rubbers=[('Rubber',144),('StyreneButadieneRubber',108),('RubberSilicone',72)] if name in low_cables else [('StyreneButadieneRubber',72),('RubberSilicone',72)]
                for rubber,amount in rubbers:
                    emit('assemble',{wire:1,**extra,self.material(rubber,'molten'):cost*amount},{form(cable):1},100,7 if name in low_cables else m['processingEU'] or 8,'ProcessingWire',circuit=24)
            # Turning conserves the original two small dust byproducts.
            emit('lathe',{form('ingot'):1},{form('stick'):1,self.material(m['macerating'],'dustSmall'):2},max(value*5,1),16,'ProcessingStick')
            if 'NO_SMASHING' not in m['tags']:
                if 'stickLong' in forms:emit('forgeHammer',{form('stick'):2},{form('stickLong'):1},max(value,1),16,'ProcessingStick')
                if 'springSmall' in forms:emit('bend',{form('stick'):1},{form('springSmall'):2},100,8,'ProcessingStick',circuit=1)
                if 'spring' in forms:emit('bend',{form('stickLong'):1},{form('spring'):1},200,16,'ProcessingStickLong',circuit=1)
            if 'stickLong' in forms:
                eu=m['processingEU'] or 4
                for liquid,minimum,maximum,divisor,ratio in [('Water',4,1000,320,2),('DistilledWater',3,750,426,2),('Lubricant',1,250,1280,1),('DimensionallyShiftedSuperfluid',1,10,4000,.4)]:
                    coolant='distilledWater' if liquid=='DistilledWater' else self.material(liquid)
                    emit('cut',{form('stickLong'):1,coolant:max(minimum,min(maximum,value*eu//divisor))},{form('stick'):2},max(1,int(value*ratio)),4,'ProcessingStickLong')
            if 'screw' in forms:emit('lathe',{form('bolt'):1},{form('screw'):1},max(value//8,1),4,'ProcessingScrew')
            if 'bolt' in forms or 'screw' in forms:
                eu=m['processingEU'] or 4;time=max(value*2,1)
                for liquid,minimum,maximum,divisor,ratio in [('Water',4,1000,320,2),('DistilledWater',3,750,426,2),('Lubricant',1,250,1280,1)]:
                    emit('cut',{form('stick'):1,('distilledWater' if liquid=='DistilledWater' else self.material(liquid)):max(minimum,min(maximum,time*ratio*eu//divisor))},{form('bolt'):4},time*ratio,4,'ProcessingStick')
            # Original reverse fluid smelting: 144 mB per ingot, 24 ticks;
            # EU/t follows the fluid temperature rather than machine tier.
            melting=number_field(r'\.setMeltingPoint\(([^)]+)\)',0)
            if melting>0 and 'SMELTING_TO_FLUID' in m['tags'] and 'NO_SMELTING' not in m['tags']:
                target=re.search(r'\.setSmeltingInto\(\(\) -> Materials\.(\w+)',body)
                target=target[1] if target else name
                if target in self.materials:
                    eu=max(8,int((2*melting)**.5));tier=next((i for i in range(15) if 8*4**i>=eu),14)
                    if tier>0:eu=min(eu,[7,30,120,480,1920,7680,30720,122880,491520,1966080,7864320,31457280,125829120,503316480,2013265920][tier])
                    emit('melt',{form('ingot'):1},{self.material(target,'molten'):144},24,eu,'GTRecipeRegistrator')
            # Fluid casting needs a reusable physical mold; it is never free.
            for prefix,mold,amount,ticks in [('ingot','Ingot',144,32),('plate','Plate',144,32),('nugget','Nugget',16,16),('gearGt','Gear',576,128),('gearGtSmall','Gear_Small',144,16)]:
                if prefix not in forms:continue
                try:tool=self.named('Shape_Mold_'+mold)
                except ValueError:continue
                if name not in ('AnnealedCopper','CastIron'):
                    template='ProcessingIngot' if prefix=='ingot' else 'ProcessingNugget' if prefix=='nugget' else 'ProcessingPlate' if prefix=='plate' else 'ProcessingGear'
                    emit('solidify',{form('molten'):amount},{form(prefix):1},ticks,4 if prefix=='nugget' else 8,template,tools={tool:1})

    def dust_size_templates(self):
        path=self.source/'gregtech/common/GTProxy.java'
        self.active_file=str(path.relative_to(self.source)).replace('\\','/')
        self.paths[self.active_file]=hashlib.sha256(path.read_bytes()).hexdigest()
        forms={}
        for id,item in list(self.items.items()):
            native=item.get('native',{})
            if native.get('prefix') in ('dust','dustSmall','dustTiny'):
                forms.setdefault(native['material'],{})[native['prefix']]=id
        for family in forms.values():
            dust=family.get('dust')
            if not dust:continue
            for prefix,count,indices,line in [('dustSmall',4,[0,1,3,4],816),('dustTiny',9,list(range(9)),820)]:
                small=family.get(prefix)
                if not small:continue
                for ins,outs,positions in [({dust:1},{small:count},[1 if count==4 else 0]),({small:count},{dust:1},indices)]:
                    r=self.emit_recipe('craft',ins,outs,1,0,line,{}, {},[],None)
                    if r:
                        r['stage']=0
                        r['grid']=[next(iter(ins)) if i in positions else None for i in range(9)]

    def turbine_templates(self):
        path=self.source/'gregtech/loaders/oreprocessing/ProcessingToolHead.java'
        self.active_file=str(path.relative_to(self.source)).replace('\\','/')
        self.paths[self.active_file]=hashlib.sha256(path.read_bytes()).hexdigest()
        materials=(self.source/'gregtech/loaders/materials/MaterialsInit.java').read_text(encoding='utf-8')
        for name,m in self.materials.items():
            body=re.search(r'private static Materials load'+re.escape(name)+r'\(\)\s*\{(.*?)(?=\n    private static|\Z)',materials,re.S)
            if not body:continue
            body=body[1]
            tool=re.search(r'\.setTool\(([^)]+)\)',body)
            if not tool or '.addToolHeadItems()' not in body or '.removeOrePrefix(OrePrefixes.turbineBlade)' in body:continue
            if any(tag in m['tags'] for tag in ('NO_WORKING','NO_SMASHING','BOUNCY')):continue
            try:
                durability,quality,speed=map(numeric,base.split_args(tool[1]))
                if min(durability,speed)<=0:continue
                mult=re.search(r'\.setTurbine\(([^)]+)\)',body)
                steam,gas,plasma=map(numeric,base.split_args(mult[1])) if mult else (1,1,1)
                blade=self.material(name,'turbineBlade')
                plate=self.material(name,'plateDouble');screw=self.material(name,'screw')
                self.emit_recipe('press',{plate:3,screw:2},{blade:1},200,m['processingEU'] or 60,1181,{}, {},[],None)
                for n,(size,title,rod,ticks,power,damage) in enumerate([
                    ('Small','小型','Magnalium',160,100,0),('Normal','普通','Titanium',320,400,2.5),
                    ('Large','大型','TungstenSteel',640,1600,5),('Huge','巨型','Americium',1280,6400,7.5)],1):
                    id='turbineRotor'+size+'_'+name
                    native={**self.items[blade]['native'],'prefix':'toolTurbine'}
                    self.items[id]={'id':id,'name':m['name']+title+'涡轮转子','kind':'item','category':'涡轮转子','native':native,
                        'rotor':{'durability':100*int(durability*n),'quality':quality,'efficiency':.5+(.5+damage+quality)*.1,
                                 'flow':speed*50*n,'steam':steam,'gas':gas,'plasma':plasma},'origin':{'file':'gregtech/loaders/materials/MaterialsInit.java','line':m['line']}}
                    self.emit_recipe('assemble',{blade:n*4,self.material(rod,'stickLong'):1},{id:1},ticks,m['processingEU'] or power,1132+8*(n-1),{}, {},[],None)
            except (ValueError,KeyError,SyntaxError,TypeError) as error:
                self.skipped.append({'file':self.active_file,'material':name,'reason':'turbine: '+str(error)[:180]})

    def heat_exchanger_templates(self):
        self.constants={}
        def fluid(registry):
            aliases={'molten.solarsalthot':'MaterialMisc.SOLAR_SALT_HOT.getFluidStack(1)',
                     'molten.solarsaltcold':'MaterialMisc.SOLAR_SALT_COLD.getFluidStack(1)'}
            return self.stack(aliases.get(registry,'FluidRegistry.getFluidStack("'+registry+'",1)'))[0]
        steam=self.material('Steam','gas');hotsteam=fluid('ic2superheatedsteam');critical=fluid('supercriticalsteam')
        self.active_file='gregtech/api/registries/LHECoolantRegistry.java'
        path=self.source/self.active_file;self.paths[self.active_file]=hashlib.sha256(path.read_bytes()).hexdigest()
        source=re.sub(r'//[^\n]*','',path.read_text(encoding='utf-8'))
        for match in re.finditer(r'registerCoolant\(\s*"([^"]+)",\s*"([^"]+)",\s*([^,]+),\s*([^)]+)\)',source):
            try:
                cold,hot=fluid(match[1]),fluid(match[2]);multiplier=numeric(match[3]);threshold=numeric(match[4])
                for process,scale in [('heatExchange',1),('heatExchangeXL',32)]:
                    r=self.emit_recipe(process,{hot:1000},{cold:1000},20,0,source.count('\n',0,match.start())+1,{}, {},[],None)
                    if r:
                        r['stage']=5 if scale==1 else 7
                        r['exchanger']={'hot':hot,'cold':cold,'multiplier':multiplier,'threshold':threshold,'scale':scale,'normal':steam,'heated':hotsteam}
                        r['energyOutputs']=[steam,hotsteam]
            except (ValueError,KeyError,SyntaxError,TypeError) as error:self.skipped.append({'file':self.active_file,'reason':'heat exchange: '+str(error)[:180]})
        self.active_file='goodgenerator/loader/RecipeLoader2.java'
        path=self.source/self.active_file;source=path.read_text(encoding='utf-8');self.paths[self.active_file]=hashlib.sha256(path.read_bytes()).hexdigest()
        for match in re.finditer(r'MyRecipeAdder.instance.addExtremeHeatExchangerRecipe\(',source):
            try:
                end=base.matching(source,match.end()-1);args=base.split_args(source[match.end():end])
                args=[re.sub(r'//[^\n]*','',a).strip() for a in args]
                stacks=[self.stack(a) for a in args[:5]];hot,cold,water,normal,heated=stacks
                r=self.emit_recipe('heatExchangeExtreme',{hot[0]:hot[1]},{cold[0]:cold[1]},20,0,source.count('\n',0,match.start())+1,{}, {},[],None)
                if r:
                    r['stage']=7;r['exchanger']={'extreme':True,'hot':hot[0],'cold':cold[0],'maxHot':hot[1],
                        'eut':int(water[1]*{'steam':4,'superheatedSteam':8,'supercriticalSteam':800}[normal[0]]),
                        'threshold':numeric(args[5]),'normal':normal[0],'heated':heated[0]}
                    r['energyOutputs']=[normal[0],heated[0]]
            except (ValueError,KeyError,SyntaxError,TypeError) as error:self.skipped.append({'file':self.active_file,'line':source.count('\n',0,match.start())+1,'reason':'extreme heat exchange: '+str(error)[:180]})
        # FinishLoadRecipe expands every registered plasma fuel. Keep Java's
        # float32 arithmetic and signed-int overflow in ExtremeHeatExchangerRecipe.
        f32=lambda n:struct.unpack('f',struct.pack('f',n))[0]
        dense=self.material('DenseSupercriticalSteam','gas')
        seen=set()
        for fuel in [*self.existing['fuels'],*self.extra_fuels]:
            if fuel['family']!='Plasma' or fuel['id'] in seen:continue
            seen.add(fuel['id']);hot=fuel['id'];native=self.items[hot].get('native',{});name=native.get('material')
            if name not in self.materials:continue
            material=self.materials[name]
            cold=self.material(name,'fluid' if material['fluid'] else 'molten')
            value=fuel['eu'];amount=25000 if value>500000 else 10000 if value>300000 else 2500 if value>100000 else 500 if value>10000 else 100
            water=int(f32(f32(f32(f32(value)*f32(.9))*amount)/160))
            water=(water+2**31)%2**32-2**31
            eut=(water*8+2**31)%2**32-2**31
            if eut<0 and eut!=-2**31:eut=-eut
            r=self.emit_recipe('heatExchangeExtreme',{hot:amount},{cold:amount},20,0,1571,{}, {},[],None)
            if r:
                r.update(stage=7,exchanger={'extreme':True,'plasma':True,'hot':hot,'cold':cold,'maxHot':amount,'eut':eut,'threshold':1,'normal':hotsteam,'heated':dense},energyOutputs=[dense])

    def milling_templates(self):
        path=self.source/'gtPlusPlus/core/item/base/ore/BaseItemMilledOre.java'
        registration=self.source/'gtPlusPlus/core/item/ModItems.java'
        self.active_file=str(path.relative_to(self.source)).replace('\\','/')
        self.paths[self.active_file]=hashlib.sha256(path.read_bytes()).hexdigest()
        self.paths[str(registration.relative_to(self.source)).replace('\\','/')]=hashlib.sha256(registration.read_bytes()).hexdigest()
        self.constants={}
        for match in re.finditer(r'BaseItemMilledOre.generate\(Materials\.(\w+),\s*(TierEU.RECIPE_\w+)(?:,\s*(new ItemStack\(Blocks.netherrack,\s*256\)))?\)',registration.read_text(encoding='utf-8')):
            name,power,custom=match.groups();out=self.material(name,'milled')
            for ball,durability in [('Soapstone',50),('Alumina',100)]:
                tool=self.stack('GregtechItemList.Milling_Ball_'+ball+'.get(1)')[0]
                sources=[(self.stack(custom)[0],256,16 if ball=='Soapstone' else 32,1200,11 if ball=='Soapstone' else 10)] if custom else [
                  (self.material(name,'ore'),16,48 if ball=='Soapstone' else 64,3000 if ball=='Soapstone' else 2400,11 if ball=='Soapstone' else 10),
                  (self.material(name,'rawOre'),16,48 if ball=='Soapstone' else 64,3000 if ball=='Soapstone' else 2400,12),
                  (self.material(name,'crushed'),16,16 if ball=='Soapstone' else 32,1500 if ball=='Soapstone' else 1200,11 if ball=='Soapstone' else 10)]
                for item,amount,count,ticks,circuit in sources:
                    r=self.emit_recipe('mill',{item:amount},{out:count},ticks,numeric(power),35 if not custom else 116,{tool:1},{},[],circuit)
                    if r:r['toolWear']={tool:durability}

    def simple_wash_templates(self):
        path=self.source/'gtPlusPlus/xmod/gregtech/registration/gregtech/GregtechSimpleWasher.java'
        self.active_file=str(path.relative_to(self.source)).replace('\\','/')
        self.paths[self.active_file]=hashlib.sha256(path.read_bytes()).hexdigest()
        # Use only forms already known to be registered. Special addon output
        # rewrites stay unresolved rather than granting clean precious metals.
        excluded={'Platinum','Osmium','Iridium','Palladium','AnyCopper','AnyIron','Naquadah','NaquadahEnriched','Naquadria','Cerium','Samarium'}
        for id,item in list(self.items.items()):
            native=item.get('native',{});name=native.get('material');prefix=native.get('prefix')
            if name not in self.materials or name in excluded or 'NO_ORE_PROCESSING' in self.materials[name]['tags']:continue
            target='dust' if prefix in ('dustImpure','dustPure') else 'crushedPurified' if prefix=='crushed' else None
            if target:self.emit_recipe('simpleWash',{id:1,'water':100},{self.material(name,target):1},5,7,197,{}, {},[],None)

    def run(self):
        self.milling_templates()
        self.builders_at(self.source/'gregtech/loaders/load/FuelLoader.java','gregtech/loaders/load/FuelLoader.java')
        self.builders_at(self.source/'bartworks/system/material/processingLoaders/AdditionalRecipes.java','bartworks/system/material/processingLoaders/AdditionalRecipes.java')
        self.builders_at(self.source/'bartworks/common/loaders/BioRecipeLoader.java','bartworks/common/loaders/BioRecipeLoader.java')
        directory=self.source/'gregtech/loaders/postload/recipes'
        for path in sorted(directory.glob('*.java')):
            self.builders_at(path,str(path.relative_to(self.source)).replace('\\','/'))
        for path in sorted((self.source/'gregtech/loaders/postload/chains').glob('*.java')):
            self.builders_at(path,str(path.relative_to(self.source)).replace('\\','/'))
        for directory in ('tectech/loader/recipe','bartworks/common/loaders/recipes','goodgenerator/loader','gtnhlanth/loader','gtnhintergalactic/loader','gtPlusPlus/xmod/gregtech/loaders/recipe','gtPlusPlus/core/recipe','gtPlusPlus/core/item/chemistry','gtPlusPlus/plugin','bartworks/system/material/gtenhancement'):
            for path in sorted((self.source/directory).rglob('*.java')):
                self.builders_at(path,str(path.relative_to(self.source)).replace('\\','/'))
        if self.core.exists():
            for path in sorted(self.core.rglob('*.java')):
                relative=str(path.relative_to(self.core)).replace('\\','/')
                if 'recipe' in relative.lower() or '/scripts/' in relative or path.name in ('BioItemLoader.java','BacteriaRegistry.java'):self.builders_at(path,'NewHorizonsCoreMod/'+relative)
            self.nanochip_helpers()
        self.simple_wash_templates()
        self.turbine_templates()
        self.heat_exchanger_templates()
        hand_spec=importlib.util.spec_from_file_location('hand_tools',ROOT/'scripts/gtnh-hand-tools.py')
        hand=importlib.util.module_from_spec(hand_spec);hand_spec.loader.exec_module(hand)
        hand.generate(self)
        crafting_spec=importlib.util.spec_from_file_location('static_crafting',ROOT/'scripts/gtnh-static-crafting.py')
        crafting=importlib.util.module_from_spec(crafting_spec);crafting_spec.loader.exec_module(crafting)
        paths=[(self.source/'gregtech/loaders/postload/CraftingRecipeLoader.java','gregtech/loaders/postload/CraftingRecipeLoader.java')]
        # These classes register their own physical components, molds and
        # schematics. They are not part of CraftingRecipeLoader's source.
        for name in ('MetaGeneratedItem01','MetaGeneratedItem02','MetaGeneratedItem03','MetaGeneratedTool01'):
            path=self.source/('gregtech/common/items/'+name+'.java')
            if path.exists():paths.append((path,str(path.relative_to(self.source)).replace('\\','/')))
        paths.extend((path,'NewHorizonsCoreMod/'+str(path.relative_to(self.core)).replace('\\','/')) for path in sorted((self.core/'com/dreammaster/scripts').glob('*.java')) if path.name.startswith('Script'))
        for path,label in [(self.source/'gregtech/loaders/load/MTERecipeLoader.java','gregtech/loaders/load/MTERecipeLoader.java'),(self.core/'com/dreammaster/gthandler/GT_CraftingRecipeLoader.java','NewHorizonsCoreMod/com/dreammaster/gthandler/GT_CraftingRecipeLoader.java')]:
            if path.exists():paths.append((path,label))
        included={path for path,label in paths}
        for directory in ('bartworks/common/loaders/recipes','gtPlusPlus/core/recipe','gtPlusPlus/xmod/gregtech/loaders/recipe','gtPlusPlus/xmod/gregtech/registration','goodgenerator/loader','gtnhlanth/loader','gtnhintergalactic/loader','tectech/loader/recipe'):
            for path in sorted((self.source/directory).rglob('*.java')):
                if path not in included:
                    paths.append((path,str(path.relative_to(self.source)).replace('\\','/')));included.add(path)
        crafting_report=crafting.import_crafting(self,paths,base.split_args,base.matching,scopes_at)
        purification_spec=importlib.util.spec_from_file_location('purification_data',ROOT/'scripts/gtnh-purification.py')
        purification=importlib.util.module_from_spec(purification_spec);purification_spec.loader.exec_module(purification)
        purification_items=purification.generate(self,ROOT,base.split_args,base.matching)
        nuclear_spec=importlib.util.spec_from_file_location('nuclear_data',ROOT/'scripts/gtnh-naquadah.py')
        nuclear=importlib.util.module_from_spec(nuclear_spec);nuclear_spec.loader.exec_module(nuclear)
        nuclear_items=nuclear.generate(self,ROOT,base.split_args)
        renewable_spec=importlib.util.spec_from_file_location('renewable_data',ROOT/'scripts/gtnh-renewables.py')
        renewable=importlib.util.module_from_spec(renewable_spec);renewable_spec.loader.exec_module(renewable)
        renewable_items=renewable.generate(self,ROOT,base.split_args,numeric)
        rtg_spec=importlib.util.spec_from_file_location('rtg_data',ROOT/'scripts/gtnh-rtg.py')
        rtg=importlib.util.module_from_spec(rtg_spec);rtg_spec.loader.exec_module(rtg)
        rtg_items=rtg.generate(self,ROOT,base.split_args,numeric,base.matching)
        reactor_spec=importlib.util.spec_from_file_location('reactor_data',ROOT/'scripts/gtnh-nuclear.py')
        reactor=importlib.util.module_from_spec(reactor_spec);reactor_spec.loader.exec_module(reactor)
        reactor_items=reactor.generate(self,ROOT,base.split_args,base.matching,numeric)
        fuel_spec=importlib.util.spec_from_file_location('special_fuels',ROOT/'scripts/gtnh-special-fuels.py')
        fuel_data=importlib.util.module_from_spec(fuel_spec);fuel_spec.loader.exec_module(fuel_data)
        fuel_items=fuel_data.generate(self,ROOT,base.split_args,base.matching,numeric)
        casting_spec=importlib.util.spec_from_file_location('casting_data',ROOT/'scripts/gtnh-casting.py')
        casting=importlib.util.module_from_spec(casting_spec);casting_spec.loader.exec_module(casting)
        casting_items=casting.generate(self,ROOT,base.split_args,base.matching,numeric,scopes_at)
        wood_spec=importlib.util.spec_from_file_location('wood_recipes',ROOT/'scripts/gtnh-wood.py')
        wood=importlib.util.module_from_spec(wood_spec);wood_spec.loader.exec_module(wood)
        wood.generate(self)
        smeltery_spec=importlib.util.spec_from_file_location('smeltery_recipes',ROOT/'scripts/gtnh-smeltery.py')
        smeltery=importlib.util.module_from_spec(smeltery_spec);smeltery_spec.loader.exec_module(smeltery)
        smeltery_items=smeltery.generate(self,ROOT,base.split_args,base.matching,numeric)
        matter_spec=importlib.util.spec_from_file_location('matter_recipes',ROOT/'scripts/gtnh-matter.py')
        matter=importlib.util.module_from_spec(matter_spec);matter_spec.loader.exec_module(matter)
        matter_items=matter.generate(self,ROOT,numeric)
        replication_spec=importlib.util.spec_from_file_location('replication_recipes',ROOT/'scripts/gtnh-replication.py')
        replication=importlib.util.module_from_spec(replication_spec);replication_spec.loader.exec_module(replication)
        replication_items=replication.generate(self,ROOT,numeric)
        self.material_templates()
        self.dust_size_templates()
        # Godforge molten variants derive from the completed EBF/material
        # catalog, so expand them only after generic material processing.
        godforge_spec=importlib.util.spec_from_file_location('godforge_data',ROOT/'scripts/gtnh-godforge.py')
        godforge=importlib.util.module_from_spec(godforge_spec);godforge_spec.loader.exec_module(godforge)
        godforge_items=godforge.generate(self,ROOT,base.split_args,base.matching,numeric)
        used={id for r in self.recipes for field in ('inputs','outputs','tools') for id in r.get(field,{})}
        used|=godforge_items
        used|=purification_items
        used|=nuclear_items
        used|=renewable_items
        used|=rtg_items
        used|=reactor_items
        used|=fuel_items
        used|=casting_items
        used|=smeltery_items
        used|=matter_items
        used|=replication_items
        used|={self.named(key) for key in self.bio_controller_keys}
        used|=self.bio_reference_items
        used|={r['requirements']['bioCulture'] for r in self.recipes if r.get('requirements',{}).get('bioCulture')}
        used|={r['requirements']['researchItem'] for r in self.recipes if r.get('requirements',{}).get('researchItem')}
        used|={r['reactorBonus'] for r in self.recipes if r.get('reactorBonus')}
        used|={f['id'] for f in self.extra_fuels}
        used|={id for r in self.recipes if r.get('bath') for id in (r['bath']['fluid'],r['bath']['waste'])}
        used|={id for r in self.recipes for id in r.get('energyOutputs',[])}
        for _ in range(4):used|={self.items[id]['icon'] for id in list(used) if self.items[id].get('icon') in self.items}
        items={id:self.items[id] for id in used}
        data={'version':base.VERSION,'items':items,'recipes':self.recipes,'fuels':self.extra_fuels,'oreMaterials':self.extra_ores}
        (ROOT/'src/data/technology-import.js').write_text('// Generated by scripts/import-gtnh-technology.py.\nexport const TECHNOLOGY_IMPORT='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
        report={'pack':'GTNH 2.9.0','gregtech':base.VERSION,'core':'2.9.99','recipes':len(self.recipes),
          'maps':dict(Counter(r['process'] for r in self.recipes)), 'conditions':dict(Counter(k for r in self.recipes for k in r.get('requirements',{}))),
          'sourceFiles':self.paths,'unresolved':self.skipped,'crafting':crafting_report,
          'limits':['Literal source builders only; not the final runtime registry.', 'No guessed values for dynamic stacks, metadata, conditions or addon material definitions.']}
        (ROOT/'src/data/technology-provenance.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(json.dumps({k:report[k] for k in ('recipes','maps','conditions')},ensure_ascii=True))
        print('Unresolved:',len(self.skipped))

    def nanochip_helpers(self):
        path=self.core/'com/dreammaster/scripts/ScriptNanochipRecipes.java'
        if not path.exists():return
        self.active_file='NewHorizonsCoreMod/com/dreammaster/scripts/ScriptNanochipRecipes.java'
        text=path.read_text(encoding='utf-8');text=re.sub(r'/\*.*?\*/|//[^\n]*',lambda m:'\n'*m[0].count('\n'),text,flags=re.S)
        self.constants={}
        def list_args(expression):
            match=re.fullmatch(r'(?:Arrays\.asList|List\.of|Collections\.singletonList)\((.*)\)',expression.strip(),re.S)
            if not match:raise ValueError('dynamic nanochip component list')
            return base.split_args(match[1])
        for match in re.finditer(r'(?<!void )addAssemblyMatrixRecipe\(',text):
            line=text.count('\n',0,match.start())+1
            try:
                end=base.matching(text,match.end()-1);args=base.split_args(text[match.end():end])
                if len(args)!=6:raise ValueError('dynamic nanochip matrix helper')
                inputs=[self.variants(arg) for arg in list_args(args[0])]
                inputs.extend(self.variants(arg) for arg in list_args(args[1]))
                expression=args[2]
                if re.fullmatch(r'CircuitComponent\.\w+',expression):expression+='.getFakeStack(1)'
                out=self.stack(expression);component=self.components[out[0].removeprefix('nanoComponent_')]
                calibration=next((re.search(r'CircuitCalibration\.(\w+)',arg)[1] for arg in component['args'] if re.search(r'CircuitCalibration\.(\w+)',arg)),'NONE')
                req={'nanochipTier':numeric(args[-1]),'nanochipCalibration':calibration}
                for selected in itertools.product(*inputs):
                    ins={}
                    for id,n in selected:ins[id]=ins.get(id,0)+n
                    self.emit_recipe('nanochipAssemble',ins,{out[0]:out[1]},numeric(args[3]),numeric(args[4]),line,{},req,[],None)
            except (ValueError,SyntaxError,KeyError,IndexError,TypeError) as error:self.skipped.append({'file':self.active_file,'line':line,'reason':str(error)[:220]})
        for match in re.finditer(r'(?<!void )addSimpleProcessingRecipe\(',text):
            line=text.count('\n',0,match.start())+1
            try:
                end=base.matching(text,match.end()-1);args=base.split_args(text[match.end():end])
                if len(args) not in (5,6):raise ValueError('dynamic nanochip helper')
                raw=self.stack(args[0]+'.getFakeStack(1)');out=self.stack(args[-4]+'.getFakeStack(1)');ins={raw[0]:raw[1]}
                if len(args)==6:
                    fluid=self.stack(args[1]);ins[fluid[0]]=ins.get(fluid[0],0)+fluid[1]
                process=MAPS[args[-1].strip().split('.')[-1]]
                self.emit_recipe(process,ins,{out[0]:out[1]},numeric(args[-2]),numeric(args[-3]),line,{}, {},[],None)
            except (ValueError,SyntaxError,KeyError,IndexError,TypeError) as error:self.skipped.append({'file':self.active_file,'line':line,'reason':str(error)[:220]})
        line=text.count('\n',0,text.index('private static void registerConversionRecipes'))+1
        for key,component in self.components.items():
            if 'true' in component['args']:continue
            supplier=next((arg.split('->',1)[1].strip() for arg in component['args'] if '->' in arg),None)
            if not supplier:continue
            try:
                raw=self.stack(supplier);internal=self.circuit_component(key)
                for inputs,outputs in [({raw[0]:1},{internal:1}),({internal:1},{raw[0]:1})]:
                    self.emit_recipe('nanochipConvert',inputs,outputs,100,0,line,{}, {},[],None)
            except (ValueError,SyntaxError,KeyError,TypeError) as error:self.skipped.append({'file':self.active_file,'line':line,'reason':'component '+key+': '+str(error)[:180]})

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,default=ROOT/f'.local/gtnh-energy/GT5-Unofficial-{base.VERSION}/src/main/java')
    parser.add_argument('--instance',type=Path,default=Path('D:/PrismLauncher/instances/GT_New_Horizons_2.9.0_Java_17-26'))
    parser.add_argument('--core',type=Path,default=ROOT/'.local/gtnh-technology/NewHorizonsCoreMod-2.9.99/src/main/java')
    args=parser.parse_args();TechnologyImporter(args.source,args.instance,args.core).run()
