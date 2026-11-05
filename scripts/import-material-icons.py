"""Import the processing additions from original GTNH assets as SVG paths."""
import argparse
import importlib.util
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('gtnh_icons', ROOT / 'scripts/import-icons.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def run(instance, output=ROOT / 'src/assets/gtnh'):
    importer = object.__new__(module.Importer)
    importer.instance, importer.output = instance, output
    output.mkdir(parents=True, exist_ok=True)
    importer.archives, importer.files, importer.manifest, importer.used = [], {}, {}, []
    importer.gregtech = next((instance / '.minecraft/mods').glob('gregtech-*.jar'))
    for archive in sorted((instance / '.minecraft/mods').glob('*.jar')):
        importer.add_archive(archive)
    importer.materials = importer.read_materials()
    gt = module.GT
    for item, process in [('bender', 'bender'), ('lathe', 'lathe')]:
        importer.save(item, importer.machine(importer.find(gt + f'blocks/basicmachines/{process}/OVERLAY_FRONT.png')))
    importer.save('forgeHammer', importer.machine(importer.find(gt + 'blocks/iconsets/OVERLAY_FRONT_STEAM_HAMMER.png')))
    for item, head, handle in [('file', 'toolHeadFile', 'stick'), ('screwdriver', 'toolHeadScrewdriver', 'stick'), ('wireCutter', 'toolWireCutter', None)]:
        image = importer.material('Iron', head)
        if handle:
            image.alpha_composite(importer.material('Wood', handle).resize(image.size, Image.Resampling.NEAREST))
        importer.save(item, image)
    for item, form in [('ironBolt', 'bolt'), ('ironScrew', 'screw')]:
        importer.save(item, importer.material('Iron', form))
    material_rules = json.loads((ROOT / 'src/data/material-provenance.json').read_text(encoding='utf-8'))
    # Names match the generated material rule file, without importing application code.
    rules = json.loads((ROOT / 'src/data/material-processing.js').read_text(encoding='utf-8').split(' = ', 1)[1].strip().rstrip(';'))
    for item, rule in rules.items():
        importer.save(item + 'DustSmall', importer.material(rule['material'], 'dustSmall'))
    path = importer.output / 'sources.json'
    manifest = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'pack': 'GTNH 2.9.0', 'resourcePacks': [], 'format': 'SVG paths traced from original pixel artwork', 'icons': {}}
    manifest['icons'].update(importer.manifest)
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Imported {len(importer.manifest)} processing icons from {material_rules["gregtech"]}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--instance', required=True, type=Path)
    parser.add_argument('--output', default=ROOT / 'src/assets/gtnh', type=Path)
    args = parser.parse_args()
    run(args.instance, args.output)
