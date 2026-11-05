"""Trace the added energy icons from the installed GTNH jar; never read resource packs."""
import argparse
import importlib.util
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('gtnh_icons', ROOT / 'scripts/import-icons.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def run(instance, output=ROOT / 'src/assets/gtnh'):
    jar = next((instance / '.minecraft/mods').glob('gregtech-*.jar'))
    importer = object.__new__(module.Importer)
    importer.output = output
    output.mkdir(parents=True, exist_ok=True)
    importer.archives, importer.files, importer.manifest, importer.used = [], {}, {}, []
    for archive in sorted((instance / '.minecraft/mods').glob('*.jar')):
        importer.add_archive(archive)
    gt = module.GT
    batteries = [('LV', 518), ('MV', 528), ('HV', 538), ('EV', 540), ('IV', 545),
                 ('LuV', 550), ('ZPM', 555), ('UV', 560), ('UHV', 570), ('UEV', 575),
                 ('UIV', 580), ('UMV', 585), ('UXV', 590)]
    for tier, meta in batteries:
        target = gt + f'items/gt.metaitem.01/{meta}.png'
        exact = target in importer.files
        importer.save('battery' + tier, importer.sprite(importer.find(target, gt + 'items/gt.metaitem.01/538.png')),
                      'Original GTNH rechargeable battery artwork.' if exact else
                      f'The installed original jars lack the artwork for meta {meta}; shares the original HV lithium battery silhouette. The UI tier label identifies this battery.')
    importer.save('lithiumDust', importer.sprite(importer.find(gt + 'items/materialicons/DULL/dust.png', gt + 'items/materialicons/NONE/dust.png'), 0xe1dcff),
                  'Lithium: MaterialsInit, DULL/NONE material texture fallback, color 0xe1dcff.')
    importer.save('cryotheum', importer.sprite(importer.find('assets/miscutils/textures/blocks/fluids/fluid.cryotheum.png')))
    importer.save('gasTurbine', importer.machine(importer.find(gt + 'blocks/iconsets/GAS_TURBINE_SIDE.png')),
                  'Original GTNH gas-turbine overlay on the same steel casing used by the existing generators.')
    importer.save('centrifuge', importer.machine(importer.find(gt + 'blocks/basicmachines/centrifuge/OVERLAY_FRONT.png')))
    for fluid in ['deuterium', 'tritium']:
        importer.save(fluid, importer.sprite(importer.find(gt + f'blocks/fluids/fluid.{fluid}.png')))
    # MACHINE_CASINGS[LV] and the real four-ampere output overlay.
    entries = list(importer.files)
    casing = next((p for p in entries if re.search(r'iconsets/MACHINE_CASING_(?:LV|1)\.png$', p)), None)
    if not casing:
        casing = importer.find(gt + 'blocks/iconsets/MACHINE_CASING_SOLID_STEEL.png')
    overlay = next((p for p in entries if 'ENERGY_OUT' in p and ('MULTI_4A' in p or '4A' in p) and ('LV' in p or '_2.' in p)), None)
    image = importer.load(casing)
    if overlay:
        image.alpha_composite(importer.load(overlay).resize(image.size))
    importer.save('batteryBuffer', importer.cube(image), 'GTNH casing and available four-ampere overlay, four-slot battery box.')
    manifest_path = importer.output / 'sources.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {
        'pack': 'GTNH 2.9.0', 'format': 'SVG paths traced from original pixel artwork',
        'resourcePacks': [], 'icons': {}}
    manifest['icons'].update(importer.manifest)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Imported {len(importer.manifest)} energy icons from {jar.name}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--instance', required=True, type=Path)
    parser.add_argument('--output', default=ROOT / 'src/assets/gtnh', type=Path)
    args = parser.parse_args()
    run(args.instance, args.output)
