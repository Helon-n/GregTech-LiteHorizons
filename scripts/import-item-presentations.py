"""Resolve display metadata from pinned GTNH jars and literal subtype definitions.

Presentation only: registry, damage, item IDs and recipe operands never change.
Unknown subtypes are reported, never assigned another subtype's name/texture.
"""
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.local/gtnh-technology'
DEFAULT_INSTANCE = Path('D:/PrismLauncher/instances/GT_New_Horizons_2.9.0_Java_17-26')


def strings(raw, variable):
    match = re.search(r'\b' + re.escape(variable) + r'\s*=\s*(?:new String\[\]\s*)?\{(.*?)\}', raw, re.S)
    return re.findall(r'"([^"\\]*(?:\\.[^"\\]*)*)"', match[1]) if match else []


def suspicious(item):
    name = item['name']
    registry = item.get('nativeItem', {}).get('registry', '')
    return '\ufffd' in name or name == registry.split(':', 1)[-1] or bool(re.match(r'^(?:item|tile)\.', name)) or name in ('controller', 'brick', 'drain', 'tank')


class Resolver:
    def __init__(self, instance):
        self.instance = instance
        self.sources, self.entries, self.jars, self.assets = {}, {}, {}, {}
        self.languages = defaultdict(lambda: {'en': {}, 'zh': {}})
        for path in sorted((instance / '.minecraft/mods').glob('*.jar')):
            jar = zipfile.ZipFile(path)
            domains = set()
            for name in jar.namelist():
                if name.startswith('assets/') and name.endswith('.png'):
                    self.assets[name] = (jar, path)
                match = re.fullmatch(r'assets/([^/]+)/lang/(en_US|zh_CN)\.(?:lang|properties)', name, re.I)
                if not match:
                    continue
                domain, locale = match[1], match[2][:2].lower()
                domains.add(domain)
                text = jar.read(name).decode('utf-8-sig')
                for line in text.splitlines():
                    if '=' not in line or line.lstrip().startswith(('#', '!')):
                        continue
                    key, value = line.split('=', 1)
                    value = re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m[1], 16)), value.strip())
                    self.languages[domain][locale][key.strip()] = value
                self.sources[path.name + '/' + name] = hashlib.sha256(jar.read(name)).hexdigest()
            ids = set(domains)
            if 'mcmod.info' in jar.namelist():
                try:
                    info = json.loads(jar.read('mcmod.info').decode('utf-8-sig'))
                    for mod in info if isinstance(info, list) else info.get('modList', []):
                        ids.add(mod['modid'])
                except (ValueError, KeyError):
                    pass
            for id in ids:
                self.jars[id.lower()] = (path, domains)
        vanilla = Path('D:/PrismLauncher/libraries/com/mojang/minecraft/1.7.10/minecraft-1.7.10-client.jar')
        jar = zipfile.ZipFile(vanilla)
        for locale in ('en_US', 'zh_CN'):
            name = 'assets/minecraft/lang/' + locale + '.lang'
            if name in jar.namelist():
                language_bytes = jar.read(name)
            else:
                assets = Path('D:/PrismLauncher/assets')
                index = json.loads((assets / 'indexes/1.7.10.json').read_text(encoding='utf-8'))
                digest = index['objects']['minecraft/lang/' + locale + '.lang']['hash']
                language_bytes = (assets / 'objects' / digest[:2] / digest).read_bytes()
            for line in language_bytes.decode('utf-8-sig').splitlines():
                if '=' in line and not line.startswith('#'):
                    key, value = line.split('=', 1)
                    self.languages['minecraft'][locale[:2]][key] = value
            self.sources[vanilla.name + '/' + name] = hashlib.sha256(language_bytes).hexdigest()
        for name in jar.namelist():
            if name.startswith('assets/') and name.endswith('.png'):
                self.assets[name] = (jar, vanilla)
        self.jars['minecraft'] = (vanilla, {'minecraft'})

    def read(self, path):
        path = CACHE / path
        raw = path.read_text(encoding='utf-8')
        self.sources[str(path.relative_to(CACHE)).replace('\\', '/')] = hashlib.sha256(path.read_bytes()).hexdigest()
        return raw

    def label(self, domain, key):
        lang = self.languages[domain]
        value = lang['zh'].get(key) or lang['en'].get(key)
        if not value or '\ufffd' in value or value == key:
            return None
        return re.sub(r'§.', '', value)

    def add(self, registry, meta, domain, key, texture=None, name=None, **native):
        label = name or self.label(domain, key)
        if not label:
            return
        entry = {'name': label, 'languageKey': key, 'domain': domain}
        # Paths must exist in the original jars, never resource packs.
        if texture and texture in self.assets:
            entry['nativeItem'] = {'name': label, 'registry': registry, 'meta': meta, 'texture': texture, **native}
        self.entries[registry + '@' + str(meta)] = entry

    def tconstruct(self):
        prefix = 'TConstruct-1.14.123-source/src/main/java/tconstruct/'
        raw = self.read(prefix + 'tools/items/MaterialItem.java')
        for meta, (name, tex) in enumerate(zip(strings(raw, 'materialNames'), strings(raw, 'craftingTextures'))):
            self.add('TConstruct:materials', meta, 'tinker', 'item.tconstruct.Materials.' + name + '.name',
                     'assets/tinker/textures/items/materials/material_' + tex + '.png')
        for registry, cls, keybase, texbase in [('metalPattern', 'smeltery/items/MetalPattern', 'MetalPattern', 'cast_'),
                                               ('clayPattern', 'smeltery/items/ClayPattern', 'ClayPattern', 'clay_cast_'),
                                               ('woodPattern', 'tools/items/Pattern', 'Pattern', 'pattern_')]:
            raw = self.read(prefix + cls + '.java')
            for meta, name in enumerate(strings(raw, 'patternName')):
                if name:
                    self.add('TConstruct:' + registry, meta, 'tinker', 'item.tconstruct.' + keybase + '.' + name + '.name',
                             'assets/tinker/textures/items/materials/' + texbase + name + '.png')
        weaponry = self.read(prefix + 'weaponry/TinkerWeaponry.java')
        patterns = self.read(prefix + 'weaponry/items/WeaponryPattern.java')
        for registry, keybase, texbase in [('Cast', 'MetalPattern', 'cast_'), ('Clay Cast', 'ClayPattern', 'clay_cast_')]:
            for meta, name in enumerate(strings(patterns, 'patternName')):
                self.add('TConstruct:' + registry, meta, 'tinker', 'item.tconstruct.' + keybase + '.' + name + '.name',
                         'assets/tinker/textures/items/patterns/' + texbase + name + '.png')
        tools = self.read(prefix + 'tools/TinkerTools.java')
        for meta, name in enumerate(strings(tools, 'blanks')):
            self.add('TConstruct:blankPattern', meta, 'tinker', 'item.tconstruct.Pattern.' + name + '.name',
                     'assets/tinker/textures/items/materials/' + name + '.png')
        for registry, path, names, textures, keybase, folder in [
            ('oreBerries', 'world/items/OreBerries.java', 'names', 'tex', 'item.oreberry.', 'oreberries/'),
            ('jerky', 'armor/items/Jerky.java', 'itemNames', 'textureNames', 'item.tconstruct.', 'food/jerky_')]:
            raw = self.read(prefix + path)
            for meta, (name, tex) in enumerate(zip(strings(raw, names), strings(raw, textures))):
                self.add('TConstruct:' + registry, meta, 'tinker', keybase + name + '.name',
                         'assets/tinker/textures/items/' + folder + tex + '.png')
        for registry, path, keybase in [
            ('Smeltery', 'smeltery/itemblocks/SmelteryItemBlock.java', 'Smeltery'),
            ('SmelteryNether', 'smeltery/itemblocks/SmelteryItemBlock.java', 'Smeltery'),
            ('SearedBlock', 'smeltery/itemblocks/SearedTableItemBlock.java', 'SearedBlock'),
            ('SearedBlockNether', 'smeltery/itemblocks/SearedTableItemBlock.java', 'SearedBlock'),
            ('LavaTank', 'smeltery/itemblocks/LavaTankItemBlock.java', 'LavaTank'),
            ('ToolStationBlock', 'tools/itemblocks/ToolStationItemBlock.java', 'ToolStation'),
            ('CraftingSlab', 'tools/itemblocks/CraftingSlabItemBlock.java', 'ToolStation'),
            ('CraftedSoil', 'world/itemblocks/CraftedSoilItemBlock.java', 'CraftedSoil'),
            ('slime.gel', 'world/itemblocks/SlimeGelItemBlock.java', 'block.slime.congealed'),
            ('SpeedBlock', 'smeltery/itemblocks/SpeedBlockItem.java', 'block'),
            ('SpeedSlab', 'smeltery/itemblocks/SpeedSlabItem.java', 'block'),
            ('SearedSlab', 'smeltery/itemblocks/SearedSlabItem.java', 'block.searedstone.slab'),
            ('LavaTankNether', 'smeltery/itemblocks/LavaTankItemBlock.java', 'LavaTank'),
            ('MetalBlock', 'smeltery/itemblocks/MetalItemBlock.java', 'StorageMetals')]:
            raw = self.read(prefix + path)
            for meta, name in enumerate(strings(raw, 'blockTypes')):
                key = keybase + '.' + name + '.name'
                if registry == 'SpeedSlab':
                    key = keybase + '.' + name + '.slab.name'
                if registry == 'CraftingSlab' and meta in (0, 5):
                    key = name + '.name'
                if registry == 'CraftedSoil' and meta > 4:
                    key = 'block.slime.soil.' + name + '.name'
                self.add('TConstruct:' + registry, meta, 'tinker', key)
        glass = self.read(prefix + 'smeltery/itemblocks/StainedGlassClearItem.java')
        for meta, color in enumerate(strings(glass, 'blockTypes')):
            self.add('TConstruct:GlassBlock.StainedClear', meta, 'tinker', 'block.stainedglass.' + color + '.name')
        self.read(prefix + 'smeltery/itemblocks/GlassPaneItem.java')
        self.add('TConstruct:GlassPane', 0, 'tinker', 'block.glass.pure.pane.name')
        self.read(prefix + 'gadgets/TinkerGadgets.java')
        for registry in ('slimesling', 'slime_boots'):
            self.add('TConstruct:' + registry, 0, 'tinker', 'item.TConstruct.' + registry + '.name')
        food = self.read(prefix + 'world/items/StrangeFood.java')
        arrays = re.findall(r'new String\[\]\s*\{(.*?)\}', food, re.S)
        for meta, (name, texture) in enumerate(zip(re.findall(r'"([^"]+)"', arrays[0]), re.findall(r'"([^"]+)"', arrays[1]))):
            self.add('TConstruct:strangeFood', meta, 'tinker', 'item.tconstruct.strangefood.' + name + '.name',
                     'assets/tinker/textures/items/' + texture + '.png')
        self.read(prefix + 'armor/items/HeartCanister.java')
        self.add('TConstruct:heartCanister', 0, 'tinker', 'item.tconstruct.canister.empty.name', 'assets/tinker/textures/items/canister_empty.png')
        self.read(prefix + 'mechworks/TinkerMechworks.java')
        self.read(prefix + 'mechworks/itemblocks/ItemBlockLandmine.java')
        for meta in range(4):
            self.add('TConstruct:Redstone.Landmine', meta, 'tinker', 'tile.landmine.name')
        # The registered block names use the same language key at every wood/metal subtype.
        for meta in range(16):
            self.add('TConstruct:ToolForgeBlock', meta, 'tinker', 'tile.ToolForge.name')
        smeltery = self.read(prefix + 'smeltery/blocks/SmelteryBlock.java')
        textures = strings(smeltery, 'textureNames')
        for registry in ('Smeltery', 'SmelteryNether'):
            for meta in range(12):
                key = 'TConstruct:' + registry + '@' + str(meta)
                # Explicit getIcon branches: controller front, drain out, brick,
                # furnace then the stone variants. Meta 11 is the creeper block.
                texture = textures[[1, 4, 6, 6, 7, 8, 9, 10, 11, 12, 13, 14][meta]]
                if registry.endswith('Nether'):
                    texture = 'nether_' + texture
                entry = self.entries.get(key)
                if entry:
                    self.add(registry='TConstruct:' + registry, meta=meta, domain='tinker', key=entry['languageKey'],
                             texture='assets/tinker/textures/blocks/' + texture + '.png')
        for registry in ('SearedBlock', 'SearedBlockNether'):
            for meta, texture in enumerate(('castingtable_top', 'faucet', 'blockcast_top')):
                key = 'TConstruct:' + registry + '@' + str(meta)
                entry = self.entries.get(key)
                if entry:
                    self.add('TConstruct:' + registry, meta, 'tinker', entry['languageKey'],
                             'assets/tinker/textures/blocks/' + ('nether_' if registry.endswith('Nether') else '') + texture + '.png')
        for registry, cls, keybase, suffix in [('bowstring', 'Bowstring', 'Bowstring', '_bowstring'),
                                              ('fletching', 'Fletching', 'Fletching', '_fletching')]:
            raw = self.read(prefix + 'tools/items/' + cls + '.java')
            for meta, (name, tex) in enumerate(zip(strings(raw, 'toolMaterialNames'), strings(raw, 'toolTextureNames'))):
                self.add('TConstruct:' + registry, meta, 'tinker', 'item.tconstruct.' + keybase + '.' + name + '.name',
                         'assets/tinker/textures/items/parts/' + tex + suffix + '.png')
        # Literal material IDs + dynamic part registration; material prefix and
        # part template use the same substitution as DynamicToolPart.java.
        self.read(prefix + 'library/tools/DynamicToolPart.java')
        material_ids = {int(meta): name.lower() for name, meta in re.findall(r'public static final int (\w+) = (\d+);', tools[tools.index('class MaterialID'):])}
        material_colors = {}
        for material, args in re.findall(r'addToolMaterial\(\s*MaterialID\.(\w+),([\s\S]*?)\);', tools):
            colors = re.findall(r'0x([0-9a-fA-F]{6})\b', args)
            if colors:
                material_colors[material.lower()] = colors[-1].lower()
        tool_parts = re.search(r'Item\[\] toolParts = \{(.*?)\}', tools, re.S)
        aliases = dict(zip(re.findall(r'TinkerTools\.(\w+)', tool_parts[1]), strings(tools, 'toolPartStrings')))
        aliases.update({field: registry for field, registry in re.findall(r'GameRegistry.registerItem\((\w+), "([^"]+)"\)', weaponry)})
        for field, tex, part in re.findall(r'(\w+) = new DynamicToolPart\("([^"]+)", "([^"]+)"\)', tools + '\n' + weaponry):
            registry = aliases.get(field)
            if not registry:
                continue
            for meta, material in material_ids.items():
                custom = self.label('tinker', 'toolpart.' + part + '.' + material)
                template = self.label('tinker', 'toolpart.' + part)
                matname = self.label('tinker', 'toolpart.material.' + material) or self.label('tinker', 'material.' + material)
                if custom or template and matname:
                    label = custom or template.replace('%%material', matname)
                    texture = 'assets/tinker/textures/items/parts/' + material + tex + '.png'
                    tint = {}
                    if texture not in self.assets:
                        texture = 'assets/tinker/textures/items/parts/' + tex + '.png'
                        if material not in material_colors:
                            continue
                        tint['color'] = material_colors[material]
                    self.add('TConstruct:' + registry, meta, 'tinker', 'toolpart.' + part,
                             texture, name=label, **tint)

    def ae2(self):
        prefix = 'Applied-Energistics-2-Unofficial-rv3-beta-1095-GTNH/src/main/java/appeng/'
        colors = self.read(prefix + 'api/util/AEColor.java')
        color_keys = re.findall(r'^\s{4}\w+\("([^"]+)"', colors, re.M)
        self.read(prefix + 'core/features/NameResolver.java')
        for registry, path, category in [('item.ItemMultiMaterial', 'items/materials/MaterialType.java', 'ItemMaterial'),
                                         ('item.ItemMultiPart', 'items/parts/PartType.java', 'ItemPart')]:
            raw = self.read(prefix + path)
            for name, damage in re.findall(r'^\s{4}(\w+)\((\d+)[,)]', raw, re.M):
                damage = int(damage)
                # Part variants occupy offsets from the explicit base ID, never ordinal IDs.
                variants = range(17) if name in ('CableGlass', 'CableCovered', 'CableSmart', 'CableDense', 'CableDenseCovered') else range(1)
                for variant in variants:
                    key = 'item.appliedenergistics2.' + category + '.' + name + '.name'
                    texname = category + '.' + name
                    label = None
                    if len(variants) > 1:
                        label = self.label('appliedenergistics2', key) + ' - ' + self.label('appliedenergistics2', color_keys[variant])
                    if name.startswith('P2PTunnel'):
                        key = 'item.appliedenergistics2.ItemPart.P2PTunnel.name'
                        texname = 'ItemPart.P2PTunnel'
                        extra = re.search(r'\b' + name + r'\(.*?GuiText\.(\w+)\)', raw, re.S)
                        if extra:
                            label = self.label('appliedenergistics2', key) + ' - ' + self.label('appliedenergistics2', 'gui.appliedenergistics2.' + extra[1])
                    self.add('appliedenergistics2:' + registry, damage + variant, 'appliedenergistics2', key,
                             'assets/appliedenergistics2/textures/items/' + texname + '.png', name=label)

    def opencomputers(self):
        prefix = 'OpenComputers-1.12.68-GTNH-source/src/main/scala/li/cil/oc/'
        raw = self.read(prefix + 'common/init/Items.scala')
        # Delegate construction order is the persisted meta ID, including hidden items
        # and delegates whose integration is disabled. Do not count EEPROM/nondelegates.
        body = raw[raw.index('GameRegistry.registerItem(multi, "item")'):]
        self.read(prefix + 'common/item/Delegator.scala')
        self.read(prefix + 'common/item/traits/Delegate.scala')
        for meta, match in enumerate(re.finditer(r'new item\.(\w+)\(multi(?:,\s*Tier\.(\w+))?\)', body)):
            cls, tier = match.groups()
            sub = self.read(prefix + 'common/item/' + cls + '.scala')
            name = cls
            if tier and 'unlocalizedName' in sub:
                tier_id = {'One': 0, 'Two': 1, 'Three': 2, 'Four': 3, 'Five': 4, 'Six': 5}[tier]
                if re.search(r'unlocalizedName(?:\s*:\s*String)?\s*=\s*super(?:\[Delegate\])?\.unlocalizedName\s*\+\s*tier', sub):
                    name += str(tier_id)
                else:
                    # Leave special constructors unresolved instead of shifting subsequent IDs.
                    continue
            literal = re.search(r'override (?:val|def) unlocalizedName\s*=\s*"([^"\n]+)"', sub)
            if literal:
                name = literal[1]
            self.add('OpenComputers:item', meta, 'opencomputers', 'item.oc.' + name + '.name',
                     'assets/opencomputers/textures/items/' + name + '.png')

    def logistics(self):
        prefix = 'LogisticsPipes-1.5.39-GTNH-source/src/main/java/logisticspipes/'
        raw = self.read(prefix + 'items/ItemModule.java')
        constants = {}
        for name, value in re.findall(r'public static final int (\w+) = ([^;]+);', raw):
            value = re.sub(r'ItemModule\.(\w+)', lambda m: str(constants[m[1]]), value)
            if re.fullmatch(r'[\d+\s]+', value):
                constants[name] = sum(map(int, value.split('+')))
        for field, cls in re.findall(r'registerModule\(ItemModule\.(\w+), (\w+)(?:\.class)?\);', raw):
            if field not in constants:
                continue
            texture = 'assets/logisticspipes/textures/items/itemModule/blank.png'
            if cls != 'null':
                sub = self.read(prefix + 'modules/' + cls + '.java')
                icon = re.search(r'registerIcon\("logisticspipes:([^"\n]+)"\)', sub)
                if icon:
                    texture = 'assets/logisticspipes/textures/items/' + icon[1] + '.png'
            self.add('LogisticsPipes:item.itemModule', constants[field], 'logisticspipes',
                     'item.' + ('ModuleBlank' if cls == 'null' else cls), texture)
        self.read(prefix + 'items/RemoteOrderer.java')
        for meta in range(17):
            self.add('LogisticsPipes:item.remoteOrdererItem', meta, 'logisticspipes', 'item.remoteOrdererItem',
                     'assets/logisticspipes/textures/items/remoteOrdererItem/' + str(meta) + '.png')
        raw = self.read(prefix + 'items/ItemUpgrade.java')
        constants = {key: int(value) for key, value in re.findall(r'public static final int (\w+) = (\d+);', raw)}
        icons = dict(re.findall(r'icons\[(\d+)\] = [\s\S]*?registerIcon\("logisticspipes:([^"\n]+)"\)', raw))
        for field, cls, texture_id in re.findall(r'registerUpgrade\(ItemUpgrade\.(\w+), (\w+)\.class, (\d+)\)', raw):
            self.add('LogisticsPipes:item.itemUpgrade', constants[field], 'logisticspipes', 'item.' + cls,
                     'assets/logisticspipes/textures/items/' + icons.get(texture_id, '') + '.png')

    def direct(self, items):
        for item in items:
            native = item.get('nativeItem', {})
            registry, meta = native.get('registry', ''), native.get('meta', 0)
            if ':' not in registry or registry + '@' + str(meta) in self.entries or not suspicious(item):
                continue
            mod, tail = registry.split(':', 1)
            match = self.jars.get(mod.lower())
            if not match:
                continue
            _, domains = match
            found = []
            for domain in sorted(domains):
                namespace = {'opencomputers': 'oc'}.get(domain, domain)
                if tail.startswith(('item.', 'tile.')):
                    category, rest = tail.split('.', 1)
                    bases = [tail, category + '.' + namespace + '.' + rest]
                else:
                    bases = ['item.' + tail, 'tile.' + tail, tail, 'item.' + namespace + '.' + tail, 'tile.' + namespace + '.' + tail]
                keys = [base + '.' + str(meta) + '.name' for base in bases]
                if meta == 0:
                    keys += [base + suffix for suffix in ('.name', '') for base in bases]
                found.extend((domain, key, self.label(domain, key)) for key in keys if self.label(domain, key))
            if not found:
                continue
            # An exact key must be unambiguous within a multi-mod jar.
            firstkey = found[0][1]
            candidates = [x for x in found if x[1] == firstkey]
            if len({x[2] for x in candidates}) != 1:
                continue
            domain, key, _ = candidates[0]
            texture = native.get('texture')
            if texture not in self.assets:
                # Exact registry spelling under the jar's real domain. No fuzzy
                # texture search: blocks and items with similar names can differ.
                stem = re.sub(r'^(?:item|tile)\.', '', tail)
                paths = [f'assets/{domain}/textures/{folder}/{stem}.png' for folder in ('items', 'blocks')]
                matches = [path for path in paths if path in self.assets]
                texture = matches[0] if len(matches) == 1 else None
            self.add(registry, meta, domain, key, texture)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--instance', type=Path, default=DEFAULT_INSTANCE)
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding='utf-8')
    result = subprocess.run(['node', '--input-type=module', '-e',
        "import {CATALOG} from './src/data/catalog.js';process.stdout.write(JSON.stringify(Object.values(CATALOG.items)));"],
        cwd=ROOT, capture_output=True, check=True)
    items = json.loads(result.stdout)
    # Audit original imported labels even when the assembled catalog already
    # includes this presentation layer. Re-running must produce identical data.
    original = {}
    for file in ('industry-import.js', 'technology-import.js'):
        raw = (ROOT / 'src/data' / file).read_text(encoding='utf-8').split('=', 1)[1].rstrip(';\n')
        original.update(json.loads(raw)['items'])
    for item in items:
        before = original.get(item['id'])
        if before and before.get('nativeItem') and before['nativeItem'].get('registry') == item.get('nativeItem', {}).get('registry'):
            item['name'] = before['name']
            item['nativeItem'] = before['nativeItem']
    resolver = Resolver(args.instance)
    resolver.tconstruct()
    resolver.ae2()
    resolver.opencomputers()
    resolver.logistics()
    resolver.direct(items)
    used = {}
    for item in items:
        native = item.get('nativeItem', {})
        key = native.get('registry', '') + '@' + str(native.get('meta', 0))
        if key in resolver.entries:
            used[key] = resolver.entries[key]
    target = ROOT / 'src/data/item-presentations.js'
    target.write_text('// Generated by scripts/import-item-presentations.py. Presentation only; registry/meta identity is unchanged.\n'
                      + 'export const ITEM_PRESENTATIONS=' + json.dumps(dict(sorted(used.items())), ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    unresolved = [{'id': item['id'], 'name': item['name'], 'registry': item['nativeItem']['registry'], 'meta': item['nativeItem'].get('meta', 0)}
                  for item in items if suspicious(item) and item.get('nativeItem') and
                  item['nativeItem'].get('registry', '') + '@' + str(item['nativeItem'].get('meta', 0)) not in used]
    report = {'description': 'Exact language keys and literal subtype registrations from GTNH 2.9 original jars/source. No resource packs. No guessed subtype names.',
              'resolved': len(used), 'byMod': dict(Counter(k.split(':', 1)[0] for k in used).most_common()),
              'sourceSHA256': dict(sorted(resolver.sources.items())), 'unresolved': unresolved}
    (ROOT / 'src/data/item-presentation-provenance.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'resolved': len(used), 'unresolved': len(unresolved), 'byMod': report['byMod']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
