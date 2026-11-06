"""Element scans and UU replication from the pinned scanner/backend rules.

NBT data orbs use distinct catalog identities. Only elements whose first
linked material can be established from the actual MaterialsInit call order
are emitted; addon-only element registration is retained as a coverage gap.
"""
import hashlib
import json
import math
import re
import struct
from collections import defaultdict


def generate(imp, root, numeric):
    sources = {}

    def read(label):
        path = imp.source / label
        sources[label] = hashlib.sha256(path.read_bytes()).hexdigest()
        imp.paths[label] = sources[label]
        return path.read_text(encoding='utf-8')

    loader = 'gregtech/loaders/postload/GTPostLoad.java'
    read(loader)
    scanner = 'gregtech/loaders/postload/ScannerHandlerLoader.java'
    scan_text = read(scanner)
    backend = 'gregtech/api/recipe/maps/ReplicatorBackend.java'
    backend_text = read(backend)
    elements_text = read('gregtech/api/enums/Element.java')
    materials_text = read('gregtech/loaders/materials/MaterialsInit.java')
    read('gregtech/api/enums/Materials.java')
    read('gregtech/common/tileentities/machines/basic/MTEScanner.java')
    read('gregtech/common/tileentities/machines/basic/MTEReplicator.java')
    read('gregtech/common/items/behaviors/BehaviourDataOrb.java')
    read('gregtech/api/util/GTUtility.java')
    # In this version BW appends or fills an empty link list; it does not
    # replace GT's first linked core element. Record both implementations.
    read('bartworks/system/material/werkstoff_loaders/registration/BridgeMaterialsLoader.java')
    read('bartworks/system/material/werkstoff_loaders/recipe/CellLoader.java')
    registration = read('gregtech/loaders/preload/LoaderMetaTileEntities.java')
    if 'ELEMENT_SCAN_DURATION_MULTIPLIER = 8192L' not in scan_text:
        raise ValueError('changed element scanning duration')
    if '.duration(GTUtility.safeInt(uum * 512L, 1))' not in backend_text:
        raise ValueError('changed replicator duration')
    config = imp.instance / '.minecraft/config/GregTech/OverpoweredStuff.cfg'
    setting = re.search(r'S:replicatorExponent\s*=\s*([^\s]+)', config.read_text(encoding='utf-8'))
    if not setting:
        raise ValueError('missing instance replicator exponent')
    # OPStuff stores float; widening to double in GTProxy preserves float32.
    exponent = struct.unpack('f', struct.pack('f', float(setting[1])))[0]
    if not math.isfinite(exponent) or exponent <= 0:
        raise ValueError('invalid replicator exponent')
    read('gregtech/common/config/OPStuff.java')
    elements = {key: {'mass': int(p)+int(n)+int(extra), 'isotope': isotope == 'true'}
                for key, p, n, extra, isotope in re.findall(
                    r'^\s*(\w+)\((\d+),\s*(\d+),\s*(\d+),\s*"[^"]*",\s*(true|false)\)', elements_text, re.M)}

    # Follow actual constructor calls instead of assuming alphabetic order
    # or allowing every allotrope associated with an element to replicate.
    methods = {}
    for match in re.finditer(r'(?:public|private) static (?:void|Materials) (\w+)\(\)\s*\{', materials_text):
        at = match.end(); end = at; depth = 1
        while end < len(materials_text) and depth:
            depth += (materials_text[end] == '{') - (materials_text[end] == '}'); end += 1
        methods[match[1]] = materials_text[at:end-1]
    linked = defaultdict(list)
    visited = set()

    def visit(method):
        if method in visited:
            return
        visited.add(method)
        for call in re.findall(r'\b(load\w*)\(\)', methods.get(method, '')):
            name = call[4:]
            if name in imp.materials and imp.materials[name].get('element'):
                element = imp.materials[name]['element']
                if name not in linked[element]:
                    linked[element].append(name)
            else:
                visit(call)
    visit('load')
    imp.constants = {}
    orb = imp.named('Tool_DataOrb')
    empty_cell = imp.stack('GTModHandler.getIC2Item("cell",1)')[0]
    uum = imp.material('UUMatter')
    controllers = []
    codes = ['LV', 'MV', 'HV', 'EV', 'IV', 'LuV', 'ZPM', 'UV', 'UHV', 'UEV', 'UIV', 'UMV']
    for tier, code in enumerate(codes, 1):
        for kind, java in [('scanner', 'MTEScanner'), ('replicator', 'MTEReplicator')]:
            key = 'Machine_'+code+'_'+kind.title() if tier <= 5 else kind.title()+code
            if not re.search(r'ItemList\.'+key+r'\s*\.set\(\s*new '+java+r'\(', registration):
                raise ValueError('unregistered '+kind+' '+key)
            controllers.append({'tier': tier, 'code': code, 'kind': kind, 'item': imp.named(key)})

    rows = []
    unresolved = []
    for element, spec in elements.items():
        if spec['isotope'] or spec['mass'] <= 0:
            continue
        names = linked.get(element, [])
        if not names:
            unresolved.append({'element': element, 'reason': 'no resolved core first linked material'})
            continue
        canonical = names[0]
        if canonical == 'Magic':
            continue
        m = imp.materials[canonical]
        if m['dust']:
            output = imp.material(canonical, 'dust'); amount = 1
        elif m['cell'] and (m['fluid'] or canonical in imp.registered_fluids):
            output = imp.material(canonical); amount = 1000
        else:
            unresolved.append({'element': element, 'material': canonical, 'reason': 'no resolved dust or filled fluid cell'})
            continue
        data = 'elementScan_'+element
        imp.items[data] = {'id': data, 'name': m['name']+'元素扫描数据', 'kind': 'item', 'category': '研究', 'icon': orb,
                           'nativeItem': {**imp.items[orb]['nativeItem'], 'nbt': {'mDataTitle': 'Elemental-Scan', 'mDataName': element}}}
        # The scan consumes both the sample and the blank data orb. A fluid
        # sample additionally consumes a real cell, matching its filled cell.
        inputs = {output: amount, orb: 1}
        if amount == 1000:
            inputs[empty_cell] = 1
        imp.active_file = scanner
        line = scan_text.count('\n', 0, scan_text.index('public static @Nullable GTScannerResult getElementScanResult'))+1
        r = imp.emit_recipe('elementScan', inputs, {data: 1}, min(spec['mass']*8192, 2147483646), 30, line, {}, {}, [], None)
        if r:
            r.update(element=element, containerPortAdapted=amount == 1000)
        matter = min(int(math.pow(spec['mass'], exponent)), 2147483646)
        if matter < 1:
            raise ValueError('zero replication cost '+element)
        imp.active_file = backend
        line = backend_text.count('\n', 0, backend_text.index('private static Collection<GTRecipe> replicatorRecipeEmitter'))+1
        r = imp.emit_recipe('replicate', {uum: matter}, {output: amount}, min(matter*512, 2147483646), 30, line, {data: 1}, {}, [], None)
        if r:
            r.update(element=element)
        rows.append({'element': element, 'material': canonical, 'data': data, 'mass': spec['mass'], 'matter': matter, 'output': output, 'amount': amount})
    reference = {'orb': orb, 'emptyCell': empty_cell, 'matter': uum, 'exponent': exponent, 'controllers': controllers, 'elements': rows,
                 'unresolved': unresolved, 'sourceFiles': sources,
                 'config': {'path': str(config), 'sha256': hashlib.sha256(config.read_bytes()).hexdigest()},
                 'adaptation': ['Elemental-Scan NBT is encoded in separate item identities; replication retains the required data orb.',
                                'Fluid samples consume 1000 mB through a physical container port and one actual empty cell; the original consumes the filled cell.',
                                'Addon-only linked materials and nonfluid cells remain unresolved.']}
    (root/'src/data/replication-reference.js').write_text('// Generated by scripts/gtnh-replication.py.\nexport const REPLICATION_REFERENCE='+json.dumps(reference, ensure_ascii=False, separators=(',', ':'))+';\n', encoding='utf-8')
    return {orb, empty_cell, uum, *(row['item'] for row in controllers), *(row['data'] for row in rows)}
