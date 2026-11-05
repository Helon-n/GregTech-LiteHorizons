"""Extract the material processing rules from the matching GT5 source archive.

Reads the installed instance for provenance only; never starts or changes Minecraft.
"""
import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TAG = '5.09.54.265'
NAMES = dict(zip(
    ['copper', 'tin', 'iron', 'bronze', 'steel', 'aluminium', 'stainless', 'titanium',
     'tungstensteel', 'iridium', 'europium', 'neutronium', 'cosmic', 'catalyst',
     'infinity', 'spacetime', 'eternity'],
    ['Copper', 'Tin', 'Iron', 'Bronze', 'Steel', 'Aluminium', 'StainlessSteel', 'Titanium',
     'TungstenSteel', 'Iridium', 'Europium', 'Neutronium', 'CosmicNeutronium',
     'InfinityCatalyst', 'Infinity', 'SpaceTime', 'Eternity']))
CODES = ['ULV', 'LV', 'MV', 'HV', 'EV', 'IV', 'LuV', 'ZPM', 'UV', 'UHV', 'UEV', 'UIV', 'UMV', 'UXV', 'MAX']
SOURCES = ['gregtech/loaders/materials/MaterialsInit.java', 'gregtech/api/enums/Materials.java',
           'gregtech/api/enums/Element.java', 'gregtech/api/enums/GTValues.java',
           'gregtech/api/util/GTUtility.java', 'gregtech/api/util/GTRecipeRegistrator.java',
           'gregtech/loaders/oreprocessing/ProcessingPlate.java',
           'gregtech/loaders/oreprocessing/ProcessingIngot.java',
           'gregtech/loaders/oreprocessing/ProcessingStick.java',
           'gregtech/loaders/oreprocessing/ProcessingWire.java',
           'gregtech/loaders/oreprocessing/ProcessingFineWire.java',
           'gregtech/loaders/postload/recipes/WiremillRecipes.java',
           'gregtech/loaders/oreprocessing/ProcessingToolHead.java',
           'gregtech/loaders/oreprocessing/ProcessingToolOther.java',
           'gregtech/loaders/oreprocessing/ProcessingBolt.java',
           'gregtech/loaders/oreprocessing/ProcessingScrew.java']


def run(instance, archive):
    with zipfile.ZipFile(archive) as z:
        texts = {p: z.read(next(n for n in z.namelist() if n.endswith('/src/main/java/' + p))).decode('utf-8') for p in SOURCES}
    init = texts[SOURCES[0]]
    bodies = dict(re.findall(r'private static Materials load(\w+)\(\) \{(.*?)\n    }', init, re.S))
    elements = {name: int(p) + int(n) + int(a) for name, p, n, a in re.findall(
        r'^    (\w+)\((-?[\d_]+), (-?[\d_]+), (-?[\d_]+),', texts[SOURCES[2]], re.M)}

    def mass(name):
        body = bodies[name]
        element = re.search(r'\.setElement\(Element\.(\w+)\)', body)
        if element:
            return elements[element[1]]
        parts = re.findall(r'\.addMaterial\(Materials\.(\w+), ([\d_]+)\)', body)
        if not parts:
            return elements['Tc']
        density = re.search(r'\.setDensity\((\d+), (\d+)\)', body)
        num, den = map(int, density.groups()) if density else (1, 1)
        return num * sum(mass(p) * int(n) for p, n in parts) // (den * sum(int(n) for _, n in parts))

    rules = {}
    for key, name in NAMES.items():
        body = bodies[name]
        tier = re.search(r'\.setProcessingMaterialTierEU\(TierEU\.RECIPE_(\w+)\)', body)
        tier_index = CODES.index(tier[1]) if tier else None
        eu = (8 * 4 ** tier_index) * 30 // 32 if tier else 0
        rules[key] = {'material': name, 'mass': mass(name), 'processingEU': eu,
                      'handPlate': eu < 8192 and 'SubTag.NO_SMASHING' not in body,
                      'handRod': eu < 8192 and 'SubTag.NO_WORKING' not in body,
                      'handWire': eu < 8192 and 'SubTag.NO_WORKING' not in body,
                      'wireTicks': 168 if key == 'spacetime' else 100}
    output = '// Generated from GT5 ' + TAG + '; see material-provenance.json.\n'
    output += 'export const MATERIAL_PROCESSING = ' + json.dumps(rules, ensure_ascii=False, indent=2) + ';\n'
    (ROOT / 'src/data/material-processing.js').write_text(output, encoding='utf-8')
    jar = instance / '.minecraft/mods' / ('gregtech-' + TAG + '.jar')
    provenance = {'pack': 'GTNH 2.9.0', 'gregtech': TAG,
                  'installedJar': {'name': jar.name, 'sha256': hashlib.sha256(jar.read_bytes()).hexdigest()},
                  'sourceArchiveSha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
                  'sources': [{'path': p, 'url': f'https://github.com/GTNewHorizons/GT5-Unofficial/blob/{TAG}/src/main/java/{p}',
                               'sha256': hashlib.sha256(texts[p].encode()).hexdigest()} for p in SOURCES],
                  'scope': 'Plate/rod/wire processing eligibility, input/output ratios, processing EU and machine duration. Source inspection; no runtime recipe export.',
                  'boundaries': 'Unlock stages, construction and material production remain adapted. Existing Wire items aggregate the project wire forms; this is not a complete runtime ore-dictionary export. Hand crafting time and reusable tool durability are adapted.',
                  'notes': ['TungstenSteel, Iridium and Europium have processingEU=0; do not infer a hand-crafting ban from progression stage.',
                            'GTUtility.calculateRecipeEU uses processingEU when nonzero, otherwise the route base EU/t.',
                            'SpaceTime has an explicit wiremill duration of 168 ticks; its processingEU still overrides the LuV base.',
                            'Machine plate route: bender, 1 ingot -> 1 plate, circuit 1. Forge hammer: 3 ingots -> 2 plates, only processing tier < IV.',
                            'Lathe: 1 ingot -> 1 rod + 2 small dusts. Manual wire: 1 plate -> 1 wire, wire cutter.']}
    (ROOT / 'src/data/material-provenance.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Imported processing rules for ' + str(len(rules)) + ' materials')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--instance', required=True, type=Path)
    parser.add_argument('--source', required=True, type=Path)
    args = parser.parse_args()
    run(args.instance, args.source)
