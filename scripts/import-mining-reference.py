"""Read-only import of pinned GT ore levels and installed harvest settings."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '.local/gtnh-energy/GT5-Unofficial-5.09.54.265/src/main/java'
INSTANCE = Path('D:/PrismLauncher/instances/GT_New_Horizons_2.9.0_Java_17-26/.minecraft')
files = [SOURCE / 'gregtech/loaders/materials/MaterialsInit.java',
         SOURCE / 'gregtech/api/enums/MaterialBuilder.java',
         SOURCE / 'gregtech/common/blocks/GTBlockOre.java',
         SOURCE / 'gregtech/common/ores/SmallOreDrops.java',
         INSTANCE / 'config/GregTech/GregTech.cfg']
text = files[0].read_text(encoding='utf-8')
config = files[-1].read_text(encoding='utf-8')
assert 'B:activateHarvestLevelChange=false' in config
maximum = int(re.search(r'I:maxHarvestLevel=(\d+)', config)[1])
materials = {}
registered = dict((method, name) for name, method in re.findall(r'Materials\.(\w+)\s*=\s*load(\w+)\(\)', text))
for match in re.finditer(r'private static Materials load(\w+)\(\)\s*\{(.*?)(?=\n    private static|\Z)', text, re.S):
    quality = re.search(r'\.setTool\([^,]+,\s*(\d+)', match[2])
    override = re.search(r'\.setMiningLevel\((\d+)\)', match[2])
    level = int((override or quality)[1]) if override or quality else 0
    tier = re.search(r'\.setProcessingMaterialTierEU\(TierEU\.RECIPE_(\w+)\)', match[2])
    tiers = ['ULV','LV','MV','HV','EV','IV','LuV','ZPM','UV','UHV','UEV','UIV','UMV','UXV','MAX']
    processing = (8 * 4 ** tiers.index(tier[1]) * 15 // 16) if tier else 0
    materials[registered.get(match[1], match[1])] = {'level': level, 'oreLevel': min(maximum, level),
                                                   'processingEU': processing,
                                                   'line': text.count('\n', 0, match.start()) + 1}
result = {'pack': 'GTNH 2.9.0', 'maximumOreLevel': maximum, 'materials': materials,
          'sources': [{'file': str(p.relative_to(SOURCE) if p.is_relative_to(SOURCE) else p.relative_to(INSTANCE)).replace('\\', '/'),
                       'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in files],
          'limits': ['GT material tool quality and ordinary ore clamping, not Tinkers tool XP/boost levels.',
                     'Idle gathering has no host-rock block variants. Small iron/tin sites use quality minus one and exclusive crushed/impure drops.',
                     'Pick crafting, portals and two rocket travel bands are documented idle adaptations.']}
(ROOT / 'src/data/mining-reference.js').write_text('export const MINING_REFERENCE=' + json.dumps(result, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
