"""Source pools for Godforge's per-device, randomized exotic challenges."""
import re


def extract(imp, raw, split_args, matching, numeric, used):
    pools={'items':[],'fluids':[],'magmatter':[]};unresolved=[]
    def add(pool,expression,weight):
        try:
            id=imp.stack(expression)[0];native=imp.items[id].get('native',{});material=native.get('material')
            if not material:raise ValueError('missing plasma material identity '+id)
            plasma=imp.material(material,'plasma');used.update([id,plasma])
            pools[pool].append({'sample':id,'plasma':plasma,'weight':weight})
        except (ValueError,KeyError,SyntaxError) as err:unresolved.append({'expression':expression,'reason':str(err)})
    for m in re.finditer(r'exoticModule(PlasmaItem|PlasmaFluid|MagmatterItem)Map\.put\(',raw):
        end=matching(raw,m.end()-1);args=split_args(raw[m.end():end])
        if len(args)!=2 or 'plasmaGTMaterialList' in args[0]:continue
        add({'PlasmaItem':'items','PlasmaFluid':'fluids','MagmatterItem':'magmatter'}[m[1]],args[0],numeric(args[1]))
    names=re.search(r'plasmaGTMaterialList.addAll\(\s*Arrays.asList\((.*?)\)\)',raw,re.S)[1]
    weight_text=re.search(r'plasmaGTWeightList.addAll\(\s*Arrays.asList\((.*?)\)\)',raw,re.S)[1]
    weights=[int(n) for n in re.findall(r'(\d+)\s*/\*',weight_text)]
    materials=re.findall(r'Materials\.(\w+)',names)
    if len(weights)!=len(materials):raise ValueError('Godforge material/weight array mismatch')
    for name,weight in zip(materials,weights):
        dust=imp.materials[name]['dust'];add('items' if dust else 'fluids',f'Materials.{name}.get'+('Dust' if dust else 'Gas')+'(1)',weight)
    ids={name:imp.material(name,form) for name,form in [('QuarkGluonPlasma','fluid'),('MagMatter','molten'),('Time','molten'),('Space','molten')]}
    used.update(ids.values())
    controller=imp.stack('CustomItemList.Machine_Multi_QuarkGluonPlasmaModule.get(1)')[0];used.add(controller)
    return {**pools,'quark':ids['QuarkGluonPlasma'],'mag':ids['MagMatter'],'time':ids['Time'],'space':ids['Space'],'controller':controller,'unresolved':unresolved}
