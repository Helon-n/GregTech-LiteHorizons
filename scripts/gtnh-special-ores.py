"""Stone-host processing for ores excluded by the basic importer.

Preserve GTNH's PGM residues, naquadah earths and lanthanide concentrates.
This does not claim parity for other host stones or special ore overrides.
"""
import hashlib
import re


def generate(imp, mass, numeric):
    directory='gregtech/loaders/oreprocessing/'
    labels=[directory+n+'.java' for n in ('ProcessingOre','ProcessingDirty','ProcessingPure','ProcessingCrushedOre','ProcessingDust')]
    labels += ['bartworks/system/material/gtenhancement/PlatinumSludgeOutputs.java',
               'goodgenerator/util/NaquadahRecipeOutputs.java','gtnhlanth/util/LanthanidesRecipeOutputs.java',
               'gtPlusPlus/xmod/gregtech/registration/gregtech/GregtechSimpleWasher.java']
    for label in labels:imp.paths[label]=hashlib.sha256((imp.source/label).read_bytes()).hexdigest()
    pgm={'Platinum':'PTMetallicPowder','Palladium':'PDMetallicPowder','Iridium':'IrLeachResidue','Osmium':'IrOsLeachResidue'}
    naq={'Naquadah':'naquadahEarth','NaquadahEnriched':'enrichedNaquadahEarth','Naquadria':'naquadriaEarth'}
    rare={'Cerium':'CeriumRichMixture','Samarium':'SamariumOreConcentrate'}
    blacklist={'HSSS','EnderiumBase','Osmiridium','TPV','SuperconductorEVBase','SuperconductorZPMBase','SuperconductorUVBase'}
    override=set(pgm)|set(naq)|set(rare)|{'Ruthenium','Rhodium'}
    material_text=(imp.source/'gregtech/loaders/materials/MaterialsInit.java').read_text(encoding='utf-8')

    def convert(item,count,kind,source):
        native=imp.items[item].get('native',{});name=native.get('material');prefix=native.get('prefix')
        if name in pgm and source not in blacklist and prefix in ('dust','dustImpure','dustPure','dustSmall','dustTiny'):
            form='dust' if prefix in ('dustImpure','dustPure') else prefix
            return imp.stack('WerkstoffLoader.'+pgm[name]+'.get(OrePrefixes.'+form+',1)')[0],count*2
        if name in naq and prefix in ('dust','dustSmall','dustTiny'):
            return imp.stack('GGMaterial.'+naq[name]+'.get(OrePrefixes.'+prefix+',1)')[0],count*(1 if kind=='decomposition' else 2)
        if name in rare and kind not in ('naquadah','pgm') and prefix in ('dust','dustSmall','dustTiny'):
            return imp.stack('WerkstoffMaterialPool.'+rare[name]+'.get(OrePrefixes.'+prefix+',1)')[0],count*(1 if kind=='decomposition' else 2)
        return item,count

    def emit(source,process,inputs,slots,ticks,power,line,material,kind='ore'):
        imp.active_file=source;outputs={};rolls=[]
        for item,count,chance in slots:
            item,count=convert(item,count,kind,material)
            outputs[item]=outputs.get(item,0)+count
            rolls.append({'id':item,'count':count,'chance':chance})
        r=imp.emit_recipe(process,inputs,outputs,max(1,ticks),power,line,{}, {},rolls,None)
        if r:r['origin']['outputRules']=['PlatinumSludgeOutputs','NaquadahRecipeOutputs']+(['LanthanidesRecipeOutputs'] if kind not in ('naquadah','pgm') else [])
        return r

    imp.constants={};ores=[]
    for name,m in list(imp.materials.items()):
        if not m['ore'] or not (override & {name,*m['byproducts']}):continue
        if 'NO_ORE_PROCESSING' in m['tags'] or m['macerating']!=name or name in ('Knightmetal','Oilsands') or 'PULVERIZING_CINNABAR' in m['tags']:
            imp.skipped.append({'file':directory+'*','material':name,'reason':'special ore conversion still requires its own registrator'});continue
        value=mass(name)
        if value is None:continue
        f=lambda prefix,n=name:imp.material(n,prefix)
        ore,crushed,clean,centrifuged,impure,pure,dust=[f(p) for p in ('ore','crushed','crushedPurified','crushedCentrifuged','dustImpure','dustPure','dust')]
        stone=imp.material('Stone','dust')
        by=[m['byproducts'][i] if i<len(m['byproducts']) else name for i in range(3)]
        body=re.search(r'private static Materials load'+re.escape(name)+r'\(\)\s*\{(.*?)(?=\n    private static|\Z)',material_text,re.S)
        multiplier=re.search(r'\.setByProductMultiplier\(([^)]+)\)',body[1]) if body else None
        multiplier=numeric(multiplier[1]) if multiplier else 1
        by_gem=imp.material(by[0],'gem' if imp.materials[by[0]]['gems'] else 'dust')
        r=emit(directory+'ProcessingOre.java','grind',{ore:1},[(crushed,2*m['oreMultiplier'],10000),(by_gem,1,min(10000,1000*multiplier)),(stone,1,5000)],400,2,258,name)
        if r:r.update(oreHost='stone',hostAdapted=True)
        emit(directory+'ProcessingOre.java','forgeHammer',{ore:1},[(f('gem') if m['gems'] else crushed,m['oreMultiplier'],10000)],10,15,228,name,'naquadah')
        for src,target,product,template,line in [(crushed,impure,by[0],'ProcessingDirty',43),(clean,pure,by[1],'ProcessingPure',33),(centrifuged,dust,by[2],'ProcessingCrushedOre',37)]:
            kind='ore' if template=='ProcessingCrushedOre' else 'naquadah'
            emit(directory+template+'.java','forgeHammer',{src:1},[(target,1,10000)],10,15,line,name,kind)
            emit(directory+template+'.java','grind',{src:1},[(target,1,10000),(f('dust',product),1,1000)],400,2,line+9,name)
        for water,amount,ticks,line in [('water',1000,500,76),('distilledWater',200,300,97)]:
            emit(directory+'ProcessingDirty.java','oreWash',{crushed:1,water:amount},[(clean,1,10000),(f('dust',by[0]),1,1111),(stone,1,10000)],ticks,15,line,name)
        emit(directory+'ProcessingDirty.java','thermalCentrifuge',{crushed:1},[(centrifuged,1,10000),(f('dust',by[1]),1,1111),(stone,1,10000)],500,48,119,name)
        emit(directory+'ProcessingCrushedOre.java','thermalCentrifuge',{clean:1},[(centrifuged,1,10000),(f('dust',by[1]),1,1111)],500,48,65,name)
        for src,product in [(impure,by[0]),(pure,by[1])]:
            emit(directory+'ProcessingDust.java','centrifuge',{src:1},[(dust,1,10000),(f('dust',product),1,1111)],max(1,value*8),5,550,name)
        if m['gems'] and name not in ('Salt','RockSalt','Spodumene','Coal'):
            prefixes=['gemExquisite','gemFlawless','gem','gemFlawed','gemChipped','dust']
            special=name in ('Tanzanite','Sapphire','Olivine','GreenSapphire','Opal','Amethyst','Emerald','Ruby','Amber','Diamond','FoolsRuby','BlueTopaz','GarnetRed','Topaz','Jasper','GarnetYellow')
            chances=[300,1200,4500,1400,2800,3500] if special else [100,400,1500,2000,4000,5000]
            emit(directory+'ProcessingCrushedOre.java','sift',{clean:1},[(f(p),1,ch) for p,ch in zip(prefixes,chances)],800,15,93,name,'naquadah')
        bath={}
        for product in [name,*m['byproducts']]:
            tags=imp.materials[product]['tags'];target=imp.materials[product]['macerating']
            if 'WASHING_MERCURY' in tags:bath.setdefault('Mercury',(target,1000,7000))
            if 'WASHING_MERCURY_99_PERCENT' in tags:bath.setdefault('Mercury',(target,1000,9900))
            if 'WASHING_SODIUMPERSULFATE' in tags:bath.setdefault('SodiumPersulfate',(target,100,7000))
        for fluid,(product,amount,chance) in bath.items():
            emit(directory+'ProcessingDirty.java','chemicalBath',{crushed:1,imp.material(fluid):amount},[(clean,1,10000),(f('dust',product),1,chance),(stone,1,4000)],800,7,157,name,'naquadah')
        simple='gtPlusPlus/xmod/gregtech/registration/gregtech/GregtechSimpleWasher.java'
        emit(simple,'simpleWash',{crushed:1,'water':100},[(clean,1,10000)],5,7,168,name,'decomposition')
        if name not in pgm and name not in ('AnyCopper','AnyIron'):
            for src in (impure,pure):emit(simple,'simpleWash',{src:1,'water':100},[(dust,1,10000)],5,7,127,name,'decomposition')
        ores.append({'id':name,'name':m['name'],'item':ore,'dimensions':m.get('dimensions',[])})
    return ores
