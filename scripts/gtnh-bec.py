"""Expand the pinned BEC helpers, bounded loops and slot-specific nanite data.

This is a deliberately small source reader, not a Java evaluator. Unknown
statements fail the import rather than silently granting a replacement recipe.
"""
import hashlib
import itertools
import json
import re


def generate(imp, root, split, matching, numeric):
    def matching(text, start, left='(', right=')'):
        depth = 1; quote = None; escaped = False
        for end in range(start + 1, len(text)):
            char = text[end]
            if quote:
                if escaped: escaped = False
                elif char == '\\': escaped = True
                elif char == quote: quote = None
            elif char in ('"', "'"): quote = char
            elif char == left: depth += 1
            elif char == right:
                depth -= 1
                if depth == 0: return end
        raise ValueError('unbalanced BEC source')
    used = set()
    reference = {'condensates': {}, 'nanites': [], 'machines': {}, 'hashes': {}}

    def read(label, path=None):
        text = (path or imp.source / label).read_text(encoding='utf-8')
        digest = hashlib.sha256(text.encode()).hexdigest()
        imp.paths[label] = reference['hashes'][label] = digest
        return re.sub(r'/\*.*?\*/|//[^\n]*', lambda m: '\n' * m[0].count('\n'), text, flags=re.S)

    condensates = read('gregtech/api/enums/CondensateType.java')
    for m in re.finditer(r'^    (\w+)\(\s*"(\w+)"', condensates, re.M):
        end = matching(condensates, condensates.index('(', m.start()))
        args = split(condensates[condensates.index('(', m.start()) + 1:end])
        expression = args[3].split('->', 1)[1].strip()
        imp.constants = {}; source, amount = imp.stack(expression)
        id = 'condensate_' + m[1]
        imp.items[id] = {'id': id, 'name': imp.items[source]['name'] + ' · 纠缠凝聚态',
                         'kind': 'condensate', 'category': 'BEC 凝聚态', 'icon': source,
                         'condensate': m[1]}
        reference['condensates'][m[1]] = {'id': id, 'source': source, 'unit': numeric(args[2])}
        used.update([id, source]); imp.active_file = 'gregtech/api/enums/CondensateType.java'
        imp.emit_recipe('condensateGenerate', {source: amount}, {id: amount}, numeric(args[4]),
                        numeric(args[5]), condensates.count('\n', 0, m.start()) + 1, {}, {}, [], None)

    nt = read('gregtech/api/enums/NaniteTier.java')
    materials = dict(re.findall(r'case (\w+) -> Materials\.(\w+)', nt))
    for name, tier in re.findall(r'^    (\w+)\((\d+)\)', nt, re.M):
        item = imp.material(materials[name], 'nanite'); used.add(item)
        reference['nanites'].append({'item': item, 'tier': int(tier), 'code': name})
    order = ['Carbon', 'Silver', 'Gold', 'Transcendent', 'SixPhasedCopper', 'WhiteDwarf',
             'BlackDwarf', 'Universium', 'Eternity', 'MagMatter']

    class Reader:
        def __init__(self, text, label):
            self.text, self.label = text, label
            self.methods = {}
            self.globals = {}
            for m in re.finditer(r'^    (?:private|public) (?:static )?(?:void|\w+(?:\[\])?) (\w+)\((.*?)\)\s*\{', text, re.M | re.S):
                # Do not let a multiline regex consume a field initializer.
                if ';' in m[2] or '{' in m[2]:
                    continue
                end = matching(text, m.end() - 1, '{', '}')
                self.methods[m[1]] = (split(m[2]), text[m.end():end], text.count('\n', 0, m.end()) + 1)
            for m in re.finditer(r'(?:private )?static final \w+(?:\[\])? (\w+)\s*=\s*([^;]+);', text):
                if m[1] == 'TIER_TO_NANITE':
                    continue
                self.globals[m[1]] = self.value(m[2], self.globals)
            self.imports = {}
            for path, key in re.findall(r'^import static ([\w.]+)\.(\w+);', text, re.M):
                qualified = path + '.' + key
                if qualified.startswith(('gtPlusPlus.core.material.', 'gtPlusPlus.core.material.nuclear.')):
                    qualified = qualified.removeprefix('gtPlusPlus.core.material.').removeprefix('nuclear.')
                else:
                    qualified = path.split('.')[-1] + '.' + key
                self.imports[key] = qualified

        def value(self, expression, env):
            s = expression.strip()
            if s in env:
                return env[s]
            arr = re.fullmatch(r'(?:new \w+\[\]\s*)?\{(.*)\}', s, re.S)
            if arr:
                return [self.value(v, env) for v in split(arr[1])]
            arr = re.fullmatch(r'new \w+\[(\d+)\]', s)
            if arr:
                return [None] * int(arr[1])
            # Substitute only whole Java identifier tokens, outside quotes.
            for _ in range(20):
                old = s
                s = re.sub(r'(?<![\w.])([A-Za-z_]\w*)\[([^\[\]]+)\]',
                           lambda m: str(env[m[1]][int(self.value(m[2],env))]) if m[1] in env and isinstance(env[m[1]], list) else m[0], s)
                parts = re.split(r'("(?:[^"\\]|\\.)*")', s)
                for i in range(0, len(parts), 2):
                    parts[i] = re.sub(r'(?<![\w.])\b[A-Za-z_]\w*\b',
                                     lambda m: str(env[m[0]]) if m[0] in env and not isinstance(env[m[0]], list) else m[0], parts[i])
                s = ''.join(parts)
                if old == s:
                    break
            s = re.sub(r'\bItemList\.(\w+)\[(\d+)\]', self.item_array, s)
            part = re.fullmatch(r'(plate|foil|fineWire|ring|rod|longRod)Part\((.*)\)', s, re.S)
            if part:
                mat, n = split(part[2]); prefix = {'plate': 'plate', 'foil': 'foil', 'fineWire': 'wireFine', 'ring': 'ring', 'rod': 'stick', 'longRod': 'stickLong'}[part[1]]
                if mat.startswith('Materials.'):
                    s = f'GTOreDictUnificator.get(OrePrefixes.{prefix},{mat},{n})'
                elif mat.startswith(('GGMaterial.', 'WerkstoffLoader.')):
                    s = f'{mat}.get(OrePrefixes.{prefix},{n})'
                else:
                    method = {'plate': 'Plate', 'foil': 'Foil', 'fineWire': 'FineWire', 'ring': 'Ring', 'rod': 'Rod', 'longRod': 'LongRod'}[part[1]]
                    s = f'{mat}.get{method}({n})'
            cosmic = re.fullmatch(r'cosmicSolder\((.+)\)', s)
            if cosmic:
                t = int(numeric(cosmic[1]))
                s = 'CondensateType.TranscendentMetal.getEntangled(69*INGOTS)' if t == 0 else f'CondensateType.BoundlessCosmicSolder.getEntangled({10000*t})'
            nanites = re.fullmatch(r'(nanitesShifted|nanites)\((.*)\)', s, re.S)
            if nanites:
                nums = [int(numeric(v)) for v in split(nanites[2])]; shift = nums.pop(0) if nanites[1] == 'nanitesShifted' else 0
                return [order[n - 1 + shift] for n in nums]
            nanite = re.fullmatch(r'nanite\((.+)\)', s)
            if nanite:
                return order[int(numeric(nanite[1])) - 1]
            try:
                return numeric(s)
            except (ValueError, SyntaxError, KeyError, TypeError):
                return s

        def item_array(self, m):
            if not hasattr(self, 'item_arrays'):
                text = (imp.source / 'gregtech/api/enums/ItemList.java').read_text(encoding='utf-8')
                self.item_arrays = {}
                for a in re.finditer(r'\b(\w+)\s*=\s*(?:new ItemList\[\]\s*)?\{([^}]+)}', text):
                    self.item_arrays[a[1]] = split(a[2])
            values = self.item_arrays.get(m[1])
            if not values:
                raise ValueError('unknown ItemList array ' + m[1])
            return 'ItemList.' + values[int(m[2])].removeprefix('ItemList.')

        def condition(self, s, env):
            for mod in re.findall(r'(?:Mods\.)?(\w+)\.isModLoaded\(\)', s):
                s = s.replace(('Mods.' if 'Mods.'+mod+'.isModLoaded()' in s else '')+mod+'.isModLoaded()', '1' if imp.mod_ids.get(mod) in imp.installed_mods else '0')
            parts = re.split(r'(&&|\|\|)', s)
            if len(parts) > 1:
                values = [self.condition(p, env) for p in parts[::2]]
                return all(values) if '&&' in parts else any(values)
            m = re.fullmatch(r'\s*(.+?)\s*(==|!=|<=|>=|<|>)\s*(.+)\s*', s)
            if m:
                a, b = self.value(m[1], env), self.value(m[3], env)
                return {'==': lambda: a == b, '!=': lambda: a != b, '<': lambda: a < b, '>': lambda: a > b, '<=': lambda: a <= b, '>=': lambda: a >= b}[m[2]]()
            value = self.value(s, env)
            if not isinstance(value, (int, float)):
                raise ValueError('unknown condition ' + s)
            return bool(value)

        def run(self, method, values=()):
            params, body, line = self.methods[method]
            env = dict(self.globals)
            env.update({p.split()[-1]: v for p, v in zip(params, values)})
            self.block(body, env, line)

        def statement_end(self, text, start):
            pos = start
            while pos < len(text):
                if text[pos] in '({[':
                    a = text[pos]; pos = matching(text, pos, a, {'(': ')', '{': '}', '[': ']'}[a])
                elif text[pos] == ';':
                    return pos + 1
                pos += 1
            return pos

        def block(self, text, env, line):
            pos = 0
            while pos < len(text):
                while pos < len(text) and text[pos].isspace(): pos += 1
                if pos >= len(text): break
                current_line = line + text.count('\n', 0, pos)
                control = re.match(r'(if|for)\s*\(', text[pos:])
                if control:
                    start = pos + control.end() - 1; end = matching(text, start)
                    condition = text[start+1:end]; at = end + 1
                    while text[at].isspace(): at += 1
                    if text[at] == '{':
                        stop = matching(text, at, '{', '}'); body = text[at+1:stop]; nextpos = stop+1
                    else:
                        nextpos = self.statement_end(text, at); body = text[at:nextpos]
                    if control[1] == 'for':
                        m = re.fullmatch(r'\s*int (\w+)\s*=\s*(\d+);\s*\1\s*<\s*(\d+);\s*(?:\+\+\1|\1\+\+)\s*', condition)
                        if not m or int(m[3])-int(m[2]) > 64: raise ValueError('unbounded BEC loop '+condition)
                        for n in range(int(m[2]), int(m[3])):
                            env[m[1]] = n; self.block(body, env, current_line)
                    else:
                        accept = self.condition(condition, env)
                        if accept: self.block(body, env, current_line)
                        rest = re.match(r'\s*else\s*', text[nextpos:])
                        if rest:
                            at = nextpos + rest.end()
                            if text[at] != '{': raise ValueError('unsupported else')
                            stop = matching(text, at, '{', '}')
                            if not accept: self.block(text[at+1:stop], env, current_line)
                            nextpos = stop+1
                    pos = nextpos; continue
                end = self.statement_end(text, pos); statement = text[pos:end].strip().rstrip(';').strip(); pos = end
                assignment = re.fullmatch(r'(?:(?:final )?\w+(?:\[\])?\s+)?(\w+)(?:\[([^]]+)\])?\s*=\s*(.*)', statement, re.S)
                if assignment:
                    key, index, expr = assignment.groups(); value = self.value(expr, env)
                    if index is None: env[key] = value
                    else: env[key][int(self.value(index, env))] = value
                    continue
                if re.fullmatch(r'(?:final )?\w+(?:\[\])? \w+', statement): continue
                call = re.fullmatch(r'(\w+)\((.*)\)', statement, re.S)
                if not call: raise ValueError('unsupported BEC statement '+statement[:100])
                name = call[1]; args = [self.value(v, env) for v in split(call[2])]
                if name in ('addBec', 'addBecUnsafe'):
                    imp.constants = self.imports; imp.active_file = self.label
                    self.emit(args, current_line)
                elif name in self.methods:
                    self.run(name, args)
                else: raise ValueError('unsupported BEC call '+name)

        def emit(self, args, line):
            out, inputs, nanites = args[:3]
            if len(args) == 7:
                cs, amounts, ticks, eu = args[3:]
                fluids = [f'{c}.getEntangled({n*reference["condensates"][c.split(".")[-1]]["unit"]})' for c, n in zip(cs, amounts)]
            elif len(args) == 6:
                fluids, ticks, eu = args[3:]
            else: raise ValueError('changed BEC helper arity')
            if len(inputs) != len(nanites): raise ValueError('BEC nanite slot count mismatch')
            variants = [imp.variants(str(v)) for v in inputs]
            condensate_inputs = {}
            for fluid in fluids:
                m = re.fullmatch(r'CondensateType\.(\w+)\.getEntangled\((.*)\)', str(fluid), re.S)
                if not m: raise ValueError('unresolved condensate '+str(fluid))
                id = reference['condensates'][m[1]]['id']; condensate_inputs[id] = condensate_inputs.get(id, 0)+numeric(m[2])
            output = imp.stack(str(out))
            for chosen in itertools.product(*variants):
                stacks = dict(condensate_inputs); slots = []
                for (id, n), nanite in zip(chosen, nanites):
                    stacks[id] = stacks.get(id, 0) + n
                    code = str(nanite).removeprefix('NaniteTier.')
                    nt = next(n for n in reference['nanites'] if n['code'] == code)
                    slots.append({'item': id, 'count': n, 'nanite': nt['item'], 'tier': nt['tier']})
                r = imp.emit_recipe('condensateAssemble', stacks, {output[0]: output[1]}, ticks, eu, line, {}, {'becSlots': slots}, [], None)
                if r: r['fixedRuntime'] = True

    for label, path in [
        ('gregtech/loaders/postload/recipes/BECRecipes.java', None),
        ('gregtech/loaders/postload/recipes/BECMetaMaterialRecipes.java', None),
        ('NewHorizonsCoreMod/com/dreammaster/gthandler/recipes/BECRecipes.java', imp.core/'com/dreammaster/gthandler/recipes/BECRecipes.java'),
    ]:
        reader = Reader(read(label, path), label)
        for name in ('run', 'runLate', 'runLateRecipes'):
            if name in reader.methods: reader.run(name)

    # Original structures are collapsed into paid placement costs; the
    # assembler placement includes exactly one I/O node, not free global IO.
    for kind, cls, controller in [('storage', 'MTEBECStorage', 'BEC_Storage'), ('generator', 'MTEBECGenerator', 'BEC_Generator'), ('assembler', 'MTEBECAssembler', 'BEC_Assembler'), ('node', 'MTEBECIONode', 'BEC_IONode')]:
        label = 'tectech/thing/metaTileEntity/multi/bec/'+cls+'.java'; text = read(label)
        imp.constants = {}; cost = {}
        for count, casing in re.findall(r'\.addCasing\("(\d+(?:-\d+)?)", (\w+)\.getLocalizedName\(\)', text):
            id = imp.named(casing); cost[id] = int(count.split('-')[-1]); used.add(id)
        # Names are resolved from the actual loader, below, not guessed.
        loader = (imp.source/'tectech/loader/thing/MachineLoader.java').read_text(encoding='utf-8')
        m = re.search(r'(?:CustomItemList\.)?(Machine_Multi_\w+)\s*\.set\(\s*new '+cls+r'\(', loader)
        if not m: raise ValueError('missing BEC controller '+cls)
        item = imp.stack('CustomItemList.'+m[1]+'.get(1)')[0]; cost[item] = 1; used.add(item)
        reference['machines'][kind] = {'controller': item, 'cost': cost}
    used.update(id for r in imp.recipes if r['process'].startswith('condensate') for id in (*r['inputs'], *r['outputs']))
    (root/'src/data/bec-reference.js').write_text('// Generated by scripts/gtnh-bec.py.\nexport const BEC_REFERENCE='+json.dumps(reference, ensure_ascii=False, separators=(',', ':'))+';\n', encoding='utf-8')
    return used
