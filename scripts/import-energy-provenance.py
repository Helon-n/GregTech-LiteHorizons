"""Record the read-only GTNH 2.9 energy sources and installed-file hashes."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TAG = '5.09.54.265'
SOURCES = [
    'gregtech/api/enums/GTValues.java',
    'gregtech/common/tileentities/boilers/MTEBoiler.java',
    'gregtech/common/tileentities/boilers/MTEBoilerBronze.java',
    'gregtech/common/tileentities/generators/MTESteamTurbine.java',
    'gregtech/common/tileentities/generators/MTEDieselGenerator.java',
    'gregtech/common/tileentities/generators/MTEGasTurbine.java',
    'gregtech/common/tileentities/generators/MTEPlasmaGenerator.java',
    'gregtech/api/metatileentity/MetaTileEntity.java',
    'gregtech/api/metatileentity/implementations/MTEBasicGenerator.java',
    'gregtech/api/metatileentity/implementations/MTEBasicMachine.java',
    'gregtech/api/metatileentity/implementations/MTEBasicMachineBronze.java',
    'gregtech/api/metatileentity/implementations/MTEBasicBatteryBuffer.java',
    'gregtech/api/objects/overclockdescriber/SteamOverclockDescriber.java',
    'gregtech/api/util/OverclockCalculator.java',
    'gregtech/api/objects/overclockdescriber/FusionOverclockDescriber.java',
    'gregtech/common/tileentities/machines/multi/MTEFusionComputer.java',
    'gregtech/common/items/MetaGeneratedItem01.java',
    'gregtech/loaders/preload/LoaderMetaTileEntities.java',
    'gregtech/loaders/materials/MaterialsInit.java',
    'gregtech/loaders/oreprocessing/ProcessingCell.java',
    'gregtech/loaders/oreprocessing/ProcessingOre.java',
    'gregtech/loaders/postload/recipes/AlloySmelterRecipes.java',
    'gregtech/loaders/postload/recipes/ElectrolyzerRecipes.java',
    'gregtech/loaders/postload/recipes/CentrifugeRecipes.java',
    'gregtech/loaders/postload/recipes/FusionReactorRecipes.java',
    'gtnhintergalactic/tile/multi/TileEntityDysonSwarm.java',
    'gtnhintergalactic/config/IGConfig.java',
]


def run(instance):
    minecraft = instance / '.minecraft'
    names = [f'mods/gregtech-{TAG}.jar', 'mods/GTNewHorizonsCoreMod-2.9.99.jar',
             'mods/industrialcraft-2-2.2.828-experimental.jar',
             'config/GregTech/GregTech.cfg', 'config/gtnhintergalactic.cfg']
    files = []
    for name in names:
        path = minecraft / name
        files.append({'path': name, 'size': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    base = f'https://github.com/GTNewHorizons/GT5-Unofficial/blob/{TAG}/src/main/java/'
    record = {'pack': 'GTNH 2.9.0', 'gregtech': TAG, 'files': files,
              'sources': [{'path': p, 'url': base + p} for p in SOURCES],
              'bytecodeCrossCheck': ['MTEBoilerBronze production/temperature/fuel/cooldown', 'MTESteamTurbine fuel value/consumption', 'IDMetaItem01 battery IDs'],
              'scope': 'Energy constants and source review. No game execution, runtime recipe export or gameplay tests.',
              'notes': 'Construction and uncalibrated material recipes remain adapted; see docs/ENERGY.md.'}
    (ROOT/'src/data/energy-provenance.json').write_text(json.dumps(record, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print('Recorded energy source provenance for ' + TAG)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--instance', required=True, type=Path)
    run(parser.parse_args().instance)
