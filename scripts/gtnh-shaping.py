"""Expand the common shaping builders from their actual GT source formulas."""
import hashlib
import re


class Shaping:
    def __init__(self,imp,numeric,matching):
        self.imp=imp;self.numeric=numeric;self.matching=matching
        self.label='gregtech/loaders/oreprocessing/ProcessingShaping.java'
        path=imp.source/self.label;self.text=path.read_text(encoding='utf-8')
        imp.paths[self.label]=hashlib.sha256(path.read_bytes()).hexdigest()
        self.templates=[]
        common={'block','pipeTiny','pipeSmall','pipeMedium','pipeLarge','pipeHuge','plate','gearGtSmall','gearGt','turbineBlade','stick','stickLong','ring','screw','bolt','round','wireGt01','toolHeadHammer','toolHeadFile','toolHeadSaw'}
        # A match must stop at this builder's first addTo, even when it belongs
        # to another recipe map. Otherwise alloy-smelter inputs can leak into
        # the next extruder/solidifier output.
        for match in re.finditer(r'GTValues\.RA\.stdBuilder\(\)((?:(?!GTValues\.RA\.stdBuilder\(\)).)*?\.addTo\((\w+)\))',self.text,re.S):
            if match[2] not in ('extruderRecipes','fluidSolidifierRecipes','alloySmelterRecipes'):continue
            code=match[1];process={'extruderRecipes':'extrude','fluidSolidifierRecipes':'solidify','alloySmelterRecipes':'alloy'}[match[2]]
            output=re.search(r'GTOreDictUnificator.get\(OrePrefixes\.(\w+),\s*aMaterial(?:.mSmeltInto)?,\s*([^,)]+)\)',code)
            tool=re.search(r'ItemList\.(Shape_\w+).get\(0L\)',code)
            if not output or output[1] not in common or not tool:continue
            # Only common registered material forms; weapon / armor / bottle /
            # anvil and the special clay/wood branches retain their own rules.
            def operand(name):
                m=re.search(r'\.'+name+r'\(',code)
                return code[m.end():matching(code,m.end()-1)] if m else None
            input_amount=re.search(r'GTUtility.copyAmount\(([^,]+),\s*aStack\)',code)
            molten=re.search(r'aMaterial.getMolten\(([^)]+)\)',code)
            if process in ('extrude','alloy') and not input_amount or process=='solidify' and not molten:continue
            eut=operand('eut')
            if not eut or not eut.startswith('calculateRecipeEU(aMaterial,'):continue
            self.templates.append({'process':process,'prefix':output[1],'output':output[2],'tool':tool[1],
              'input':input_amount[1] if process!='solidify' else molten[1],'ticks':operand('duration'),
              'eut':eut[len('calculateRecipeEU(aMaterial,'):-1],
              'aluminiumRod':process=='extrude' and output[1]=='stick' and '10 * SECONDS' in code,
              'line':self.text.count('\n',0,match.start())+1})

    def generate(self,name,material,mass,forms,heat):
        imp=self.imp
        if name in ('Calcium','Magnesia') or 'NO_SMELTING' in material['tags']:return
        multiplier=60 if heat>=2800 else 15
        if 'NO_SMASHING' in material['tags']:multiplier//=4
        def number(s):
            s=re.sub(r'\baMaterialMass\b',str(mass),s)
            s=re.sub(r'\btAmount\b','1',s)
            s=re.sub(r'\btVoltageMultiplier\b',str(multiplier),s)
            return self.numeric(s)
        for t in self.templates:
            target=name if t['process']=='solidify' else material.get('smeltInto',name)
            if target not in imp.materials:continue
            # Form availability is checked on mSmeltInto in the original.
            if target!=name or t['prefix'] not in forms:continue
            if t['prefix']=='block' and name in ('Ichorium','Obsidian'):continue
            if t['process']=='extrude' and t['prefix']=='stick':
                if name=='Obsidian' or t['aluminiumRod']!=(name=='Aluminium'):continue
            if t['process']=='solidify' and name in ('AnnealedCopper','CastIron'):continue
            if t['process']=='alloy':
                if material['processingEU']>=8192:continue
                if t['prefix']=='plate' and (name in ('StyreneButadieneRubber','RubberSilicone'))!=(number(t['input'])==1):continue
            try:tool=imp.named(t['tool'])
            except ValueError:continue
            imp.active_file=self.label
            inputs={imp.material(name,'molten' if t['process']=='solidify' else 'ingot'):number(t['input'])}
            r=imp.emit_recipe(t['process'],inputs,{imp.material(target,t['prefix']):number(t['output'])},max(1,number(t['ticks'])),material['processingEU'] or number(t['eut']),t['line'],{tool:1},{},[],None)
            if r:r['origin']['material']={'file':'gregtech/loaders/materials/MaterialsInit.java','line':material['line']}
