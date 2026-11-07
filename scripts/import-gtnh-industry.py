"""Import supported GTNH 2.9 industrial game recipes from the pinned GT5 source.

This is a static importer, not a Java interpreter. Unresolved expressions and
special machine conditions go into the coverage report rather than guessed data.
It never writes to or starts the Minecraft instance.
"""
import argparse
import ast
import hashlib
import json
import math
import re
import zipfile
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = '5.09.54.265'
ALIASES = {'Fuel': 'diesel', 'Diesel': 'diesel', 'StainlessSteel': 'stainless',
           'TungstenSteel': 'tungstensteel', 'CosmicNeutronium': 'cosmic',
           'InfinityCatalyst': 'catalyst', 'SpaceTime': 'spacetime',
           'Sulfur': 'sulfur', 'Salt': 'salt', 'Bauxite': 'bauxite', 'Rutile': 'rutile',
           'RareEarth': 'rareEarth', 'Redstone': 'redstone', 'Diamond': 'diamond',
           'Coal': 'coal', 'Charcoal': 'charcoal', 'Wood': 'wood', 'Stone': 'stone',
           'Lithium': 'lithium', 'HeliumPlasma': 'plasma'}
SUFFIXES = {'dust': 'Dust', 'dustSmall': 'DustSmall', 'dustTiny': 'DustTiny',
            'dustImpure': 'ImpureDust', 'dustPure': 'PureDust', 'dustRefined': 'RefinedDust',
            'ore': 'Ore', 'rawOre': 'RawOre', 'crushed': 'Crushed',
            'crushedPurified': 'PurifiedCrushed', 'crushedCentrifuged': 'CentrifugedCrushed',
            'ingot': '', 'ingotHot': 'HotIngot', 'gem': 'Gem', 'gemExquisite': 'ExquisiteGem',
            'gemFlawless': 'FlawlessGem', 'gemFlawed': 'FlawedGem', 'gemChipped': 'ChippedGem',
            'nugget': 'Nugget', 'plate': 'Plate', 'stick': 'Rod', 'stickLong': 'LongRod',
            'foil': 'Foil', 'wireGt01': 'Wire', 'block': 'Block', 'bolt': 'Bolt', 'screw': 'Screw'}
TITLES = {'dust': '粉', 'dustSmall': '小撮粉', 'dustTiny': '小堆粉', 'dustImpure': '含杂粉',
          'dustPure': '纯净粉', 'dustRefined': '精炼粉', 'ore': '矿石', 'rawOre': '原矿',
          'crushed': '粉碎矿石', 'crushedPurified': '纯净粉碎矿石',
          'crushedCentrifuged': '离心粉碎矿石', 'ingot': '锭', 'ingotHot': '热锭',
          'gem': '宝石', 'gemExquisite': '精美宝石', 'gemFlawless': '无瑕宝石',
          'gemFlawed': '有瑕宝石', 'gemChipped': '破碎宝石', 'nugget': '粒', 'plate': '板',
          'stick': '杆', 'stickLong': '长杆', 'foil': '箔', 'wireGt01': '导线',
          'block': '块', 'bolt': '螺栓', 'screw': '螺丝'}
EXISTING_DUST = {'Sulfur', 'Salt', 'Bauxite', 'Rutile', 'RareEarth', 'Redstone'}
MAPS = {'chemicalReactorRecipes': 'chemistry', 'UniversalChemical': 'chemistry',
        'multiblockChemicalReactorRecipes': 'largeChemistry', 'electrolyzerRecipes': 'electrolyze',
        'centrifugeRecipes': 'centrifuge', 'mixerRecipes': 'mix',
        'distillationTowerRecipes': 'distill', 'distilleryRecipes': 'distillery',
        'chemicalBathRecipes': 'chemicalBath', 'thermalCentrifugeRecipes': 'thermalCentrifuge',
        'electroMagneticSeparatorRecipes': 'electromagnetic', 'sifterRecipes': 'sift',
        'fluidHeaterRecipes': 'fluidHeat', 'crackingRecipes': 'crack',
        'pyrolyseRecipes': 'pyrolyse', 'cokeOvenRecipes': 'coke', 'extractorRecipes': 'extract',
        'compressorRecipes': 'electricCompress', 'maceratorRecipes': 'grind'}
FILES = ['ChemicalRecipes', 'ElectrolyzerRecipes', 'CentrifugeRecipes', 'MixerRecipes',
         'DistilleryRecipes', 'ChemicalBathRecipes', 'ThermalCentrifugeRecipes',
         'ElectromagneticSeparatorRecipes', 'SifterRecipes', 'FluidHeaterRecipes',
         'PyrolyseRecipes', 'CokeOvenRecipes', 'CokeAndPyrolyseOven', 'ExtractorRecipes']


def split_args(s):
    result, start, stack, quoted, escaped = [], 0, [], False, False
    for i, c in enumerate(s):
        if quoted:
            if c == '"' and not escaped:
                quoted = False
            escaped = c == '\\' and not escaped
        elif c == '"':
            quoted = True
        elif c in '({[':
            stack.append(c)
        elif c in ')}]':
            stack.pop()
        elif c == ',' and not stack:
            result.append(s[start:i].strip())
            start = i + 1
    if s[start:].strip():
        result.append(s[start:].strip())
    return result


def matching(s, start):
    depth, quote, escape = 0, False, False
    for i in range(start, len(s)):
        c = s[i]
        if quote:
            if c == '"' and not escape:
                quote = False
            escape = c == '\\' and not escape
        elif c == '"':
            quote = True
        elif c == '(':
            depth += 1
        elif c == ')':
            depth -= 1
            if not depth:
                return i
    raise ValueError('unclosed call')


def number(s):
    s = re.sub(r'\b(\d[\d_]*)[lLfF]\b', r'\1', s)
    s = re.sub(r'\((?:int|long)\)', '', s)
    for k, v in {'MINUTES': 1200, 'SECONDS': 20, 'TICKS': 1, 'INGOTS': 144,
                 'HALF_INGOTS': 72, 'QUARTER_INGOTS': 36, 'NUGGETS': 16, 'STACKS': 64}.items():
        s = re.sub(r'\b'+k+r'\b', str(v), s)
    for i, tier in enumerate(['ULV', 'LV', 'MV', 'HV', 'EV', 'IV', 'LuV', 'ZPM', 'UV', 'UHV', 'UEV', 'UIV', 'UMV', 'UXV', 'MAX']):
        s = s.replace('TierEU.RECIPE_'+tier, str([7, 30, 120, 480, 1920, 7680, 30720, 122880, 491520, 1966080, 7864320, 31457280, 125829120, 503316480, 2013265920][i]))
    s = re.sub(r'\d[\d_]*', lambda m: m[0].replace('_', ''), s)
    node = ast.parse(s.strip(), mode='eval').body
    def walk(n):
        if isinstance(n, ast.Constant) and type(n.value) in (int, float):
            return n.value
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, ast.USub):
            return -walk(n.operand)
        if isinstance(n, ast.BinOp):
            a, b = walk(n.left), walk(n.right)
            if isinstance(n.op, ast.Add): return a + b
            if isinstance(n.op, ast.Sub): return a - b
            if isinstance(n.op, ast.Mult): return a * b
            if isinstance(n.op, ast.Div): return math.trunc(a / b)
        raise ValueError('dynamic number: '+s[:100])
    value = walk(node)
    if not math.isfinite(value) or abs(value) > 2**53:
        raise ValueError('number outside game limits')
    return value


class Importer:
    def __init__(self, source, instance):
        self.source, self.instance = source, instance
        self.items, self.recipes, self.fuels, self.materials, self.skipped = {}, [], [], {}, []
        jar = next((instance / '.minecraft/mods').glob('gregtech-*.jar'))
        if jar.name != f'gregtech-{VERSION}.jar':
            raise ValueError('installed GregTech does not match pinned source')
        self.jar, self.sha = jar.name, hashlib.sha256(jar.read_bytes()).hexdigest()
        with zipfile.ZipFile(jar) as z:
            lang = z.read('assets/gregtech/lang/zh_CN.lang').decode('utf-8')
            self.lang = dict(l.split('=', 1) for l in lang.splitlines() if '=' in l and not l.startswith('#'))
        generated_lang = instance / '.minecraft/GregTech_zh_CN.lang'
        if generated_lang.exists():
            for line in generated_lang.read_text(encoding='utf-8-sig').splitlines():
                if line.strip().startswith('S:') and '=' in line:
                    key, value = line.strip()[2:].split('=', 1)
                    self.lang[key] = value
        self.load_materials()
        fluid_source=(self.source/'gregtech/loaders/preload/LoaderGTBlockFluid.java').read_text(encoding='utf-8')
        self.registered_fluids=set(re.findall(r'configureMaterials\(Materials\.(\w+)\)|Materials\.(\w+)\.mFluid\s*=',fluid_source))
        self.registered_fluids={x for pair in self.registered_fluids for x in pair if x}

    def load_materials(self):
        s = (self.source / 'gregtech/loaders/materials/MaterialsInit.java').read_text(encoding='utf-8')
        registered = {method: name for name, method in re.findall(r'Materials\.(\w+)\s*=\s*load(\w+)\(\)', s)}
        for match in re.finditer(r'private static Materials load(\w+)\(\)\s*\{', s):
            material_id = match[1] if match[1] == 'Water' else registered.get(match[1], match[1])
            end = s.find('\n    private static', match.end())
            body = s[match.end():end if end >= 0 else len(s)]
            def field(pattern, default=None):
                m = re.search(pattern, body)
                return m.group(1) if m else default
            internal = field(r'\.setName\("([^\"]+)"\)', match[1])
            name = self.lang.get('Material.'+internal.lower(), field(r'\.setDefaultLocalName\("([^\"]+)"\)', internal))
            record = {'id': material_id, 'registry': internal, 'name': name,
                      'texture': field(r'TextureSet.SET_(\w+)', 'DULL'),
                      'color': field(r'\.setARGB\(0x(?:[\da-fA-F]{2})?([\da-fA-F]{6})\)', 'c8c8c8'),
                      'ore': '.addOreItems()' in body, 'metal': '.addMetalItems()' in body,
                      'dust': '.addDustItems()' in body, 'cell': '.addCell()' in body,
                      'plasma': '.addPlasma()' in body, 'gems': '.addGemItems()' in body,
                      'oreMultiplier': int(field(r'\.setOreMultiplier\((\d+)\)', '1')),
                      'smelting': field(r'\.setDirectSmelting\(\(\) -> Materials\.(\w+)', material_id),
                      'blast': '.setBlastFurnaceRequired(true)' in body,
                      'fluid': '.addFluid()' in body or '.addGas()' in body,
                      'macerating': field(r'\.setMaceratingInto\(\(\) -> Materials\.(\w+)', material_id),
                      'byproducts': re.findall(r'\.addOreByproduct\(\(\) -> Materials\.(\w+)', body),
                      'tags': re.findall(r'SubTag\.(\w+)', body),
                      'line': s.count('\n', 0, match.start())+1,
                      'processingEU': number(field(r'\.setProcessingMaterialTierEU\((TierEU\.RECIPE_\w+)\)', '0'))}
            record['defaultDensity'] = '.setDensity' not in body
            record['element'] = field(r'\.setElement\(Element\.(\w+)\)')
            record['components'] = [(k, int(n)) for k, n in re.findall(r'\.addMaterial\(Materials\.(\w+),\s*(\d+)\)', body)]
            record['cracking'] = '.addCrackingRecipes()' in body
            record['decomposition'] = 'electrolyze' if '.addElectrolyzerRecipe()' in body else 'centrifuge' if '.addCentrifugeRecipe()' in body else None
            self.materials[material_id] = record
            f = re.search(r'\.setFuel\(MaterialBuilder.FuelType\.(Diesel|Gas|SemiFluid),\s*([\d_]+)\)', body)
            if f:
                record['fuel'] = {'family': f[1], 'eu': number(f[2])}

    def material(self, name, prefix='fluid'):
        if name == 'Steam' and prefix in ('gas', 'fluid', 'cell'):
            self.items.setdefault('steam', {'id': 'steam', 'name': '蒸汽', 'category': '流体', 'kind': 'fluid', 'icon': 'steam'})
            return 'steam'
        m = self.materials.get(name)
        if not m:
            raise ValueError('unknown material '+name)
        base = ALIASES.get(name, name[0].lower()+name[1:])
        if prefix == 'plasma':
            id = 'plasma' if name == 'Helium' else base+'Plasma'
        elif prefix in ('fluid', 'gas', 'cell'):
            if prefix == 'cell' and (not m['cell'] or not (m['fluid'] or name in self.registered_fluids)):
                raise ValueError('nonfluid cell '+name)
            id = base
        elif prefix == 'dust' and name in EXISTING_DUST:
            id = base
        elif prefix == 'gem' and name in ('Diamond', 'Coal', 'Charcoal'):
            id = base
        elif prefix in SUFFIXES:
            id = base+SUFFIXES[prefix]
        else:
            raise ValueError('unsupported form '+prefix)
        fluid = prefix in ('fluid', 'gas', 'plasma', 'cell')
        self.items[id] = {'id': id, 'name': m['name']+('等离子体' if prefix == 'plasma' else '' if fluid else TITLES[prefix]),
                          'category': '流体' if fluid else '矿物处理' if prefix in ('crushed', 'crushedPurified', 'crushedCentrifuged', 'dustImpure', 'dustPure', 'dustRefined', 'ore', 'rawOre') else '加工材料',
                          'kind': 'fluid' if fluid else 'item', 'color': '#'+m['color'],
                          'native': {'material': name, 'registry': m['registry'], 'prefix': prefix, 'texture': m['texture'], 'color': m['color']}}
        return id

    def stack(self, s):
        s = re.sub(r'"(?:\\.|[^"\\])*"|\s+',lambda m:m[0] if m[0].startswith('"') else '',s)
        if s == 'logWood16': s = 'newOreDictItemStack("logWood",16)'
        wood = re.fullmatch(r'newOreDictItemStack\("logWood",(\d+)\)', s)
        if wood:
            self.material('Wood', 'ingot')
            return 'wood', int(wood[1])
        coke = re.fullmatch(r'(?:RailcraftToolItems.getCoalCoke|GTOreDictUnificator.get\("fuelCoke",)(.*)\)', s)
        if s.startswith('RailcraftToolItems.getCoalCoke('):
            self.items.setdefault('coke', {'id': 'coke', 'name': '焦煤', 'category': '燃料', 'kind': 'item', 'icon': 'coke'})
            return 'coke', number(s[len('RailcraftToolItems.getCoalCoke('):-1])
        if s.startswith('GTOreDictUnificator.get("fuelCoke",'):
            self.items.setdefault('coke', {'id': 'coke', 'name': '焦煤', 'category': '燃料', 'kind': 'item', 'icon': 'coke'})
            return 'coke', number(s[len('GTOreDictUnificator.get("fuelCoke",'):-1])
        if re.fullmatch(r'(?:ItemList.Cell_Empty.get|Materials.Empty.getCells)\([\dL]+\)', s): return None
        cracked = re.fullmatch(r'Materials\.(\w+)\.get(Lightly|Moderately|Severely)(Hydro|Steam)Cracked\((.*)\)', s)
        if cracked:
            base = self.material(cracked[1])
            id = base+cracked[2]+cracked[3]+'Cracked'
            original = self.items[base]
            self.items[id] = {**original, 'id': id,
                              'name': {'Lightly': '轻度', 'Moderately': '中度', 'Severely': '重度'}[cracked[2]]+('加氢裂化' if cracked[3] == 'Hydro' else '蒸汽裂化')+original['name'],
                              'icon': base}
            return id, number(cracked[4])
        m = re.fullmatch(r'(?:Materials\.(\w+)\.get(Fluid|Gas|Plasma|Dust|DustSmall|DustTiny|Cells|Gems))\((.*)\)', s)
        if m:
            prefix = {'Fluid': 'fluid', 'Gas': 'gas', 'Plasma': 'plasma', 'Dust': 'dust', 'DustSmall': 'dustSmall', 'DustTiny': 'dustTiny', 'Cells': 'cell', 'Gems': 'gem'}[m[2]]
            return self.material(m[1], prefix), number(m[3])*(1000 if prefix == 'cell' else 1)
        m = re.fullmatch(r'GTOreDictUnificator.get\(OrePrefixes\.(\w+),Materials\.(\w+),(.+)\)', s)
        if m:
            return self.material(m[2], m[1]), number(m[3])*(1000 if m[1] == 'cell' else 1)
        m = re.fullmatch(r'(?:GTModHandler\.)?getDistilledWater\((.+)\)', s)
        if m:
            self.items['distilledWater'] = {'id': 'distilledWater', 'name': '蒸馏水', 'kind': 'fluid', 'category': '流体', 'icon': 'water'}
            return 'distilledWater', number(m[1])
        # Resolve only known registry fluids, never silently fabricate a material.
        m = re.fullmatch(r'(?:FluidRegistry\.)?getFluidStack\("([^\"]+)",(.+)\)', s)
        if m:
            registry = m[1].replace('molten.', '').replace('fluid.', '').replace('.', '').lower()
            material = next((k for k, v in self.materials.items() if v['registry'].lower() == registry or k.lower() == registry), None)
            if material: return self.material(material), number(m[2])
        # Original vanilla solids needed by supported industrial maps.
        m = re.fullmatch(r'newItemStack\((?:Items|Blocks)\.(\w+),(\d+)\)', s)
        if m and m[1] in ('coal', 'clay_ball', 'sand', 'gravel', 'redstone', 'stone', 'cobblestone', 'glass', 'obsidian', 'slime_ball', 'sugar', 'snowball'):
            id = {'clay_ball': 'clay', 'cobblestone': 'stone', 'slime_ball': 'slime', 'snowball': 'snow'}.get(m[1], m[1])
            if id not in self.items:
                self.items[id] = {'id': id, 'name': {'obsidian': '黑曜石', 'slime': '黏液球', 'sugar': '糖', 'snow': '雪球'}.get(id, id), 'kind': 'item', 'category': '资源', 'nativeVanilla': m[1]}
            return id, int(m[2])
        raise ValueError('unresolved stack '+s[:140])

    def emit(self, process, inputs, outputs, ticks, power, source, line, chances=None, circuit=None, rolls=None):
        if not inputs or not outputs or ticks <= 0 or power < 0:
            raise ValueError('empty or invalid ordinary recipe')
        if len(inputs) > 9 or len(outputs) > 12:
            raise ValueError('slot count exceeds supported layout')
        signature = json.dumps([process, inputs, outputs, ticks, power, chances, circuit, rolls], sort_keys=True)
        id = 'gt29:'+hashlib.sha1(signature.encode()).hexdigest()[:14]
        if any(r['id'] == id for r in self.recipes): return
        tier = next((i for i, v in enumerate([8*4**i for i in range(15)]) if v >= power), 14)
        stage = max(1 if process in ('grind', 'forgeHammer', 'coke') else 2, tier+1)
        if stage > 15: raise ValueError('tier outside progression')
        r = {'id': id, 'name': ' + '.join(self.items[k]['name'] for k in outputs),
             'process': process, 'stage': stage, 'inputs': inputs, 'outputs': outputs,
             'seconds': ticks/20, 'power': power, 'source': 'GTNH2.9',
             'origin': {'file': source, 'line': line}}
        if source.startswith('Processing') or source=='FurnaceBackend.java':
            relative='gregtech/loaders/oreprocessing/'+source if source.startswith('Processing') else 'gregtech/api/recipe/maps/'+source
            template=(self.source/relative).read_text(encoding='utf-8')
            marker='public void registerOre' if source.startswith('Processing') else 'public'
            r['origin']={'file':relative,'line':template.count('\n',0,template.index(marker))+1,'material':{'file':'gregtech/loaders/materials/MaterialsInit.java','line':line}}
        if chances: r['outputChances'] = chances
        if rolls: r['outputRolls'] = rolls
        if circuit is not None: r['circuit'] = circuit
        self.recipes.append(r)

    def builders(self, name):
        path = self.source / ('gregtech/loaders/postload/recipes/'+name+'.java')
        if not path.exists(): return
        original = path.read_text(encoding='utf-8')
        # Preserve newlines so origin lines stay useful.
        s = re.sub(r'/\*.*?\*/|//[^\n]*', lambda m: '\n'*m[0].count('\n'), original, flags=re.S)
        for match in re.finditer(r'GTValues\.RA\.stdBuilder\(\)', s):
            line = s.count('\n', 0, match.start())+1
            end = s.find(';', match.end())
            body = s[match.end():end]
            try:
                calls = {}
                pos = 0
                while pos < len(body):
                    m = re.search(r'\.([A-Za-z]\w*)\s*\(', body[pos:])
                    if not m: break
                    begin = pos+m.end()-1
                    stop = matching(body, begin)
                    if m[1] in calls: raise ValueError('repeated builder method')
                    calls[m[1]] = body[begin+1:stop]
                    pos = stop+1
                unknown = set(calls)-{'itemInputs', 'itemOutputs', 'fluidInputs', 'fluidOutputs', 'duration', 'eut', 'addTo', 'circuit', 'outputChances', 'noOptimize'}
                if unknown: raise ValueError('unsupported conditions: '+','.join(sorted(unknown)))
                destinations = [x.strip().removeprefix('RecipeMaps.') for x in split_args(calls.get('addTo', ''))]
                process = next((MAPS[x] for x in destinations if x in MAPS), None)
                if not process: raise ValueError('unsupported recipe map')
                ins, outs, chances = {}, {}, {}
                for field, dst in [('itemInputs', ins), ('fluidInputs', ins), ('itemOutputs', outs), ('fluidOutputs', outs)]:
                    args = split_args(calls.get(field, ''))
                    probabilities = [number(x) for x in split_args(calls.get('outputChances', ''))] if field == 'itemOutputs' else []
                    if probabilities and len(probabilities) != len(args): raise ValueError('output chance length')
                    for i, arg in enumerate(args):
                        stack = self.stack(arg)
                        if stack is None: continue  # Physical fluid ports replace empty/filled cell transport.
                        id, amount = stack
                        if amount <= 0: raise ValueError('catalyst or zero-sized item requires a tool model')
                        if id in dst and probabilities: raise ValueError('duplicate independent chance output')
                        dst[id] = dst.get(id, 0)+amount
                        if probabilities and probabilities[i] < 10000:
                            if not 0 <= probabilities[i] <= 10000: raise ValueError('invalid probability')
                            chances[id] = probabilities[i]
                self.emit(process, ins, outs, number(calls['duration']), number(calls['eut']), name+'.java', line, chances,
                          number(calls['circuit']) if 'circuit' in calls else None)
            except (ValueError, KeyError, SyntaxError, ZeroDivisionError, IndexError) as error:
                self.skipped.append({'file': name+'.java', 'line': line, 'reason': str(error)[:200]})
        if name == 'DistilleryRecipes': self.distillations(s)

    def distillations(self, s):
        for m in re.finditer(r'(?<!void )addUniversalDistillationRecipe(withCircuit)?\s*\(', s):
            line = s.count('\n', 0, m.start())+1
            try:
                end = matching(s, m.end()-1)
                args = split_args(s[m.end():end])
                circuit_offset = 1 if m[1] else 0
                circuit = number(args[1]) if circuit_offset else None
                inp, fluid_array, solid, duration, power = [args[0], *args[1+circuit_offset:]]
                ins = dict([self.stack(inp)])
                array = re.fullmatch(r'new FluidStack\[\]\s*\{(.*)\}', fluid_array, re.S)
                if not array: raise ValueError('dynamic distillation outputs')
                fluids = [self.stack(x) for x in split_args(array[1])]
                outs = dict(fluids)
                extra = None if solid.strip() in ('GTValues.NI', 'null') else self.stack(solid)
                if extra: outs[extra[0]] = extra[1]
                ticks, eu = number(duration), number(power)
                self.emit('distill', ins, outs, ticks, eu, 'DistilleryRecipes.java', line, circuit=circuit)
                for index, (id, amount) in enumerate(fluids[:11]):
                    ratio = 1
                    for candidate in (2, 5, 10, 25, 50):
                        if all(n % candidate == 0 and n/candidate >= 25 for n in [*ins.values(), amount]) and (extra is None or extra[1] % candidate == 0): ratio = candidate
                    part = {id: amount//ratio}
                    if extra: part[extra[0]] = extra[1]//ratio
                    self.emit('distillery', {k: v//ratio for k, v in ins.items()}, part, 2*ticks//ratio, eu//4,
                              'DistilleryRecipes.java', line, circuit=index+1)
            except (ValueError, KeyError, SyntaxError, IndexError) as error:
                self.skipped.append({'file': 'DistilleryRecipes.java', 'line': line, 'reason': str(error)[:200]})

    def run(self):
        for name, m in self.materials.items():
            if m.get('fuel'):
                id = self.material(name)
                self.fuels.append({'id': id, **m['fuel'], 'origin': {'file': 'MaterialsInit.java', 'line': m['line']}})
        for name in FILES: self.builders(name)
        self.ore_processing()
        self.cracking()
        self.plasma_fuels()
        self.ore_locations()
        used = {k for r in self.recipes for d in ('inputs', 'outputs') for k in r[d]} | {f['id'] for f in self.fuels}
        used |= {self.items[k]['icon'] for k in list(used) if self.items[k].get('icon') in self.items}
        data = {'version': VERSION, 'items': {k: v for k, v in self.items.items() if k in used},
                'recipes': self.recipes, 'fuels': self.fuels,
                'oreMaterials': [m for m in self.materials.values() if m.get('importedOre')]}
        target = ROOT / 'src/data/industry-import.js'
        target.write_text('// Generated by scripts/import-gtnh-industry.py; do not hand edit.\nexport const INDUSTRY_IMPORT='+json.dumps(data, ensure_ascii=False, separators=(',', ':'))+';\n', encoding='utf-8')
        report = {'pack': 'GTNH 2.9.0', 'gregtech': VERSION, 'jar': self.jar, 'sha256': self.sha,
                  'source': f'https://github.com/GTNewHorizons/GT5-Unofficial/tree/{VERSION}/src/main/java',
                  'configuration': [{'path':str(p.relative_to(self.instance/'.minecraft')).replace('\\','/'),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [self.instance/'.minecraft/config/GregTech/MachineStats.cfg',self.instance/'.minecraft/config/GregTech/GregTech.cfg'] if p.exists()],
                  'sourceFiles': {str(p.relative_to(self.source)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(set([*self.source.glob('gregtech/loaders/postload/recipes/*.java'),*self.source.glob('gregtech/loaders/oreprocessing/*.java'),self.source/'gregtech/loaders/materials/MaterialsInit.java',self.source/'gregtech/api/enums/OreMixes.java']))},
                  'recipes': len(self.recipes), 'maps': dict(Counter(r['process'] for r in self.recipes)),
                  'fuels': len(self.fuels), 'unresolved': self.skipped,
                  'limits': ['Static subset, not a runtime registry snapshot.', 'Cell transport is normalized to physical fluid ports; no free fluid storage.',
                             'NBT, research, heat, vacuum, cleanroom, mod-conditional and dynamic expressions are not silently executed.',
                             'Ore material templates require override exclusions; runtime exporter remains authoritative.']}
        (ROOT / 'src/data/industry-provenance.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
        print(json.dumps({k: report[k] for k in ('recipes', 'maps', 'fuels')}, ensure_ascii=True))

    def ore_processing(self):
        # These GTNH addons replace precious-metal/rare-earth/naquadah products.
        # Exclude affected families until their own runtime registries are imported.
        overrides = {'Platinum', 'Palladium', 'Iridium', 'Osmium', 'Ruthenium', 'Rhodium',
                     'Naquadah', 'NaquadahEnriched', 'Naquadria', 'Cerium', 'Samarium'}
        elements = (self.source / 'gregtech/api/enums/Element.java').read_text(encoding='utf-8')
        masses = {k: int(p)+int(n) for k, p, n in re.findall(r'^\s*(\w+)\((\d+),\s*(\d+),', elements, re.M)}
        def mass(name, seen=frozenset()):
            if name in seen: return None
            m = self.materials.get(name)
            if not m or not m['defaultDensity']: return None
            if m['element']: return masses.get(m['element'])
            if not m['components']: return masses.get('Tc', 98)
            values = [(mass(k, seen | {name}), n) for k, n in m['components']]
            if any(v is None for v, _ in values): return None
            return sum(v*n for v, n in values)//sum(n for _, n in values)
        stone = self.material('Stone', 'dust')
        protons = {k: int(p) for k, p in re.findall(r'^\s*(\w+)\((\d+),', elements, re.M)}
        def atomic(name, seen=frozenset()):
            if name in seen or name not in self.materials: return None
            m = self.materials[name]
            if not m['defaultDensity']: return None
            if m['element']: return protons.get(m['element'])
            if not m['components']: return protons.get('Tc', 43)
            values = [(atomic(k, seen | {name}), n) for k, n in m['components']]
            if any(v is None for v, _ in values): return None
            return sum(v*n for v, n in values)//sum(n for _, n in values)
        for name, m in self.materials.items():
            if name in overrides: continue
            if m['metal'] and m['dust'] and not m['blast'] and 'NO_SMELTING' not in m['tags'] and not m['processingEU']:
                self.emit('electricSmelt', {self.material(name, 'dust'): 1}, {self.material(name, 'ingot'): 1}, 128, 4, 'FurnaceBackend.java', m['line'])
            parts = m['components']
            if not m['decomposition'] or not m['dust'] or not parts or not m['defaultDensity'] or any(k in overrides or k == 'Air' or k not in self.materials for k, _ in parts): continue
            count = sum(n for _, n in parts)
            if count > 64 or len(parts) > 6 or any(n > 64 for _, n in parts): continue
            outs, solid_count, fluid_count = {}, 0, 0
            for component, amount in parts:
                material = self.materials[component]
                if material['dust']:
                    out = self.material(component, 'dust');solid_count += 1
                elif material['cell'] and (material['fluid'] or component in self.registered_fluids):
                    out = self.material(component);amount *= 1000;fluid_count += 1
                    if fluid_count > 1: solid_count += 1  # Remaining fluid cells occupy GT item output slots.
                else:
                    break
                outs[out] = outs.get(out, 0)+amount
            else:
                n = atomic(name) if m['decomposition'] == 'electrolyze' else mass(name)
                if n is not None:
                    self.emit(m['decomposition'], {self.material(name, 'dust'): count}, outs,
                              max(1, n*(2 if m['decomposition'] == 'electrolyze' else 4)*count),
                              min(4, solid_count)*(30 if m['decomposition'] == 'electrolyze' else 5),
                              'ProcessingDust.java', m['line'])
        for name, m in self.materials.items():
            if not m['ore'] or 'NO_ORE_PROCESSING' in m['tags']: continue
            if m['macerating']!=name or name in ('Knightmetal','Oilsands') or 'PULVERIZING_CINNABAR' in m['tags']:
                self.skipped.append({'file':'oreprocessing/*','material':name,'reason':'special ore conversion requires runtime registry'})
                continue
            affected = overrides.intersection({name, *m['byproducts']})
            if affected:
                self.skipped.append({'file': 'oreprocessing/*', 'material': name, 'reason': 'addon output overrides: '+','.join(sorted(affected))})
                continue
            m['importedOre'] = True
            def form(prefix, material=name): return self.material(material, prefix)
            by = [form('dust', m['byproducts'][i] if i < len(m['byproducts']) else name) for i in range(3)]
            ore, crushed, clean, centrifuged, impure, pure, dust = [form(x) for x in ('ore', 'crushed', 'crushedPurified', 'crushedCentrifuged', 'dustImpure', 'dustPure', 'dust')]
            def emit(route, inputs, outputs, seconds, power, chances=None):
                slots, merged = [], {}
                for index, (id, count) in enumerate(outputs):
                    # The first slot is guaranteed except on the sifter.
                    chance = chances[index] if isinstance(chances,list) else (chances or {}).get(id,10000) if index or route.startswith('sift:') else 10000
                    slots.append({'id': id, 'count': count, 'chance': chance})
                    merged[id] = merged.get(id, 0)+count
                self.emit(route.split(':')[0], inputs, merged, int(seconds*20), power,
                          route.split(':')[-1]+'.java', m['line'], rolls=slots)
            # Standard stone-host ore; rich/poor/nether/end multipliers are separate.
            emit('grind:ProcessingOre', {ore: 1}, [(crushed, 2*m['oreMultiplier']), (form('gem',m['byproducts'][0] if m['byproducts'] else name) if self.materials[m['byproducts'][0] if m['byproducts'] else name]['gems'] else by[0], 1), (stone, 1)], 20, 2, [10000,1000,5000])
            emit('forgeHammer:ProcessingOre', {ore: 1}, [(form('gem') if m['gems'] else crushed, m['oreMultiplier'])], .5, 15)
            for src, target, product, template in [(crushed, impure, by[0],'ProcessingDirty'), (clean, pure, by[1],'ProcessingPure'), (centrifuged, dust, by[2],'ProcessingCrushedOre')]:
                emit('forgeHammer:'+template, {src: 1}, [(target, 1)], .5, 15)
                emit('grind:'+template, {src: 1}, [(target, 1), (product, 1)], 20, 2, {product: 1000})
            for src, target in [(crushed, clean)]:
                emit('oreWash:ProcessingDirty', {src: 1, 'water': 1000}, [(target, 1), (by[0], 1), (stone, 1)], 25, 15, [10000,1111,10000])
                self.items.setdefault('distilledWater', {'id': 'distilledWater', 'name': '蒸馏水', 'category': '流体', 'kind': 'fluid', 'icon': 'water'})
                emit('oreWash:ProcessingDirty', {src: 1, 'distilledWater': 200}, [(target, 1), (by[0], 1), (stone, 1)], 15, 15, [10000,1111,10000])
                emit('thermalCentrifuge:ProcessingDirty', {src: 1}, [(centrifuged if src == crushed else dust, 1), (by[1], 1), (stone, 1)], 25, 48, [10000,1111,10000])
            emit('thermalCentrifuge:ProcessingCrushedOre', {clean: 1}, [(centrifuged, 1), (by[1], 1)], 25, 48, {by[1]: 1111})
            if m['gems'] and name not in ('Salt', 'RockSalt', 'Spodumene', 'Coal'):
                prefixes = ['gemExquisite', 'gemFlawless', 'gem', 'gemFlawed', 'gemChipped', 'dust']
                special = name in ('Tanzanite', 'Sapphire', 'Olivine', 'GreenSapphire', 'Opal', 'Amethyst', 'Emerald', 'Ruby', 'Amber', 'Diamond', 'FoolsRuby', 'BlueTopaz', 'GarnetRed', 'Topaz', 'Jasper', 'GarnetYellow')
                probabilities = [300, 1200, 4500, 1400, 2800, 3500] if special else [100, 400, 1500, 2000, 4000, 5000]
                outputs = [(form(p), 1) for p in prefixes]
                emit('sift:ProcessingCrushedOre', {clean: 1}, outputs, 40, 15, {k: v for (k, _), v in zip(outputs, probabilities)})
            # Dust purification duration is the material's GT mass, not a fixed wait.
            material_mass = mass(name)
            for src, product in [(impure, by[0]), (pure, by[1])]:
                if material_mass is not None:
                    emit('centrifuge:ProcessingDust', {src: 1}, [(dust, 1), (product, 1)], max(1, material_mass*8)/20, 5, {product: 1111})
            for metal in ('Gold','Iron','Neodymium'):
                if 'ELECTROMAGNETIC_SEPERATION_'+metal.upper() in m['tags']:
                    small,nugget=form('dustSmall',metal),form('nugget',metal)
                    emit('electromagnetic:ProcessingDust',{pure:1},[(dust,1),(small,1),(nugget,1)],20,24,[10000,4000,2000])
            # GT chemical bath checks the ore and then its byproducts, first match per reagent.
            bath = {}
            for product in [name, *m['byproducts']]:
                tags = self.materials[product]['tags']
                if 'WASHING_MERCURY' in tags: bath.setdefault('Mercury', (product, 1000, 7000))
                if 'WASHING_MERCURY_99_PERCENT' in tags: bath.setdefault('Mercury', (product, 1000, 9900))
                if 'WASHING_SODIUMPERSULFATE' in tags: bath.setdefault('SodiumPersulfate', (product, 100, 7000))
            for reagent, (product, amount, chance) in bath.items():
                fluid, out = self.material(reagent), form('dust', product)
                for src, target in [(crushed, clean)]:
                    emit('chemicalBath:ProcessingDirty', {src: 1, fluid: amount}, [(target, 1), (out, 1), (stone, 1)], 40, 7, [10000,chance,4000])

    def ore_locations(self):
        source=(self.source/'gregtech/api/enums/OreMixes.java').read_text(encoding='utf-8')
        for part in source.split('new OreMixBuilder()')[1:]:
            dims=[]
            for call in re.findall(r'\.enableInDim\(([^)]*)\)',part): dims.extend(x.strip() for x in call.split(','))
            names=re.findall(r'\.(?:primary|secondary|inBetween|sporadic)\(Materials\.(\w+)\)',part)
            for name in names:
                if name in self.materials:
                    m=self.materials[name];m['dimensions']=sorted(set(m.get('dimensions',[])+dims))
        # Small deposits have their own registrations (not OreMixes), notably
        # Nether realgar, the early source of arsenic for diodes.
        source=(self.source/'gregtech/api/enums/SmallOres.java').read_text(encoding='utf-8')
        for part in source.split('new SmallOreBuilder()')[1:]:
            ore=re.search(r'\.ore\(Materials\.(\w+)\)',part)
            if not ore or ore[1] not in self.materials:continue
            dims=[dim.strip() for call in re.findall(r'\.enableInDim\(([^)]*)\)',part) for dim in call.split(',')]
            m=self.materials[ore[1]];m['dimensions']=sorted(set(m.get('dimensions',[])+dims))

    def plasma_fuels(self):
        path='gregtech/loaders/oreprocessing/ProcessingCell.java'
        source=(self.source/path).read_text(encoding='utf-8')
        # Enable literal overrides only. Formula-derived fuels require resolved mass.
        for match in re.finditer(r'case "(\w+)" -> recipeBuilder\.metadata\(FUEL_VALUE, ([\d_]+)\)',source):
            m=self.materials.get(match[1])
            if m and m['plasma']:
                self.fuels.append({'id':self.material(match[1],'plasma'),'family':'Plasma','eu':number(match[2]),'origin':{'file':path,'line':source.count('\n',0,match.start())+1}})

    def cracking(self):
        self.material('Hydrogen')
        self.items.setdefault('steam', {'id': 'steam', 'name': '蒸汽', 'category': '流体', 'kind': 'fluid', 'icon': 'steam'})
        for name, m in self.materials.items():
            if not m['cracking']: continue
            for i, degree in enumerate(('Lightly', 'Moderately', 'Severely')):
                for method, reagent in [('Hydro', 'hydrogen'), ('Steam', 'steam')]:
                    id, _ = self.stack(f'Materials.{name}.get{degree}{method}Cracked(1000)')
                    base = self.material(name)
                    amount = (2*i+2)*800 if method == 'Hydro' else 1000
                    self.emit('crack', {base: 1000, reagent: amount}, {id: 1000 if method == 'Hydro' else 1200},
                              (1+i)*20, 240, 'GTProxy.java', 1475 if method == 'Hydro' else 1539, circuit=i+1)
                    amount = (2*i+2)*1000 if method == 'Hydro' else 1000
                    self.emit('chemistry', {base: 1000, reagent: amount}, {id: 800}, (8+4*i)*20, 30, 'GTProxy.java', 1475 if method == 'Hydro' else 1539, circuit=i+1)
                    self.emit('largeChemistry', {base: 1000, reagent: amount}, {id: 800}, (4+2*i)*20, 480, 'GTProxy.java', 1475 if method == 'Hydro' else 1539, circuit=i+1)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', default=ROOT / f'.local/gtnh-energy/GT5-Unofficial-{VERSION}/src/main/java', type=Path)
    parser.add_argument('--instance', default=Path('D:/PrismLauncher/instances/GT_New_Horizons_2.9.0_Java_17-26'), type=Path)
    args = parser.parse_args()
    Importer(args.source, args.instance).run()
