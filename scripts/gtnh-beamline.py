"""Pinned source chambers, collision modules and particle-count crafting.

Packets are transient directed connections. They are not physical particles,
warehouse goods, fluids, or an energy-free recipe ingredient.
"""
import hashlib
import json
import re
from collections import Counter


def generate(imp,root,split,matching,numeric):
    used=set();hashes={}
    def read(label):
        p=imp.source/label;hashes[label]=imp.paths[label]=hashlib.sha256(p.read_bytes()).hexdigest()
        return p.read_text(encoding='utf-8')
    particles={}
    text=read('gtnhlanth/common/beamline/Particle.java')
    text=text[:text.index('// The IDs must be in order.')]
    for name,args in re.findall(r'^    (\w+)\((.*?)\)(?:,|;)',text,re.M|re.S):
        a=split(args)
        if len(a)!=10:raise ValueError('changed particle '+name)
        id='beam_'+name;native='lanthItem_SOURCE_CHAMBER'
        particles[name]={'id':id,'index':numeric(a[1]),'mass':numeric(a[2]),'maxSourceEnergy':numeric(a[3]),'weight':numeric(a[8]),'accelerates':a[0]=='true'}
        imp.items[id]={'id':id,'name':{'ELECTRON':'电子','PROTON':'质子','NEUTRON':'中子','LAMBDA':'Λ 粒子','HIGGS':'希格斯玻色子','GRAVITON':'引力子'}.get(name,name)+'束流','kind':'beam','category':'粒子束','icon':native}
        used.add(id)
    controllers={k:imp.stack(v)[0] for k,v in {'source':'LanthItemList.SOURCE_CHAMBER','crafter':'ItemList.BeamCrafter.get(1)','collider':'ItemList.LargeHadronCollider.get(1)'}.items()}
    hatches={key:imp.stack('LanthItemList.LUV_BEAMLINE_'+key.upper()+'_HATCH')[0] for key in ('input','output')}
    used.update(controllers.values());used.update(hatches.values())
    label='gtnhlanth/common/tileentity/recipe/beamline/BeamlineRecipeLoader.java';text=read(label)
    source_recipes=[]
    for m in re.finditer(r'GTValues.RA.stdBuilder\(\)',text):
        body=text[m.end():text.index(';',m.end())]
        if '.addTo(sourceChamberRecipes)' not in body:continue
        particle=re.search(r'\.particleID\((?:Particle\.)?(\w+)\.ordinal\(\)\)',body)[1]
        rate=numeric(re.search(r'\.rate\(([^)]+)\)',body)[1]);energy=re.search(r'\.energy\(([^,]+),\s*([^)]+)\)',body)
        metadata={'particle':particle,'rate':rate,'maxEnergy':numeric(energy[1]),'ratio':numeric(energy[2]),'focus':numeric(re.search(r'\.focus\(([^)]+)\)',body)[1])}
        ins={};outs={};rolls=[]
        imp.constants={};imp.active_file=label
        for field,target in [('itemInputs',ins),('fluidInputs',ins),('itemOutputs',outs)]:
            match=re.search(r'\.'+field+r'\(',body)
            if match:
                args=body[match.end():matching(body,match.end()-1)]
                for arg in split(args):
                    id,n=imp.stack(arg);target[id]=target.get(id,0)+n
        chance=re.search(r'\.outputChances\((\d+)\)',body)
        if chance:rolls=[{'id':id,'count':n,'chance':int(chance[1])} for id,n in outs.items()]
        outs[particles[particle]['id']]=rate
        if rolls:rolls.append({'id':particles[particle]['id'],'count':rate,'chance':10000})
        r=imp.emit_recipe('beamSource',ins,outs,numeric(re.search(r'\.duration\(([^)]+)\)',body)[1]),numeric(re.search(r'\.eut\(([^)]+)\)',body)[1]),text.count('\n',0,m.start())+1,{}, {},rolls,None)
        if r:r.update(beamSource=metadata,fixedRuntime=True);source_recipes.append(r['id'])
    label='gregtech/loaders/postload/recipes/beamcrafter/BeamCrafterRecipes.java'
    imp.builders_at(imp.source/label,label)
    modules={name:re.findall(r'Particle\.(\w+)',args) for name,args in re.findall(r'^    (EM|Weak|Strong|Grav)\(ImmutableList.of\((.*?)\)\)',read('gregtech/common/tileentities/machines/multi/beamcrafting/LHCModule.java'),re.S|re.M)}
    read('gtnhlanth/common/tileentity/MTESourceChamber.java')
    read('gtnhlanth/common/hatch/MTEHatchBeamlineConnector.java')
    read('gregtech/common/tileentities/machines/multi/beamcrafting/MTEBeamCrafter.java')
    lhc=read('gregtech/common/tileentities/machines/multi/beamcrafting/MTELargeHadronCollider.java')
    if not all(s in lhc for s in ('RATE_SCALE_FACTOR = 1.3F','RATE_NERF_CUTOFF = 15000','MAXIMUM_PARTICLE_ENERGY_keV = 1_000_000_000','COLLISION_ENERGY_MULTIPLIER = 2')):raise ValueError('changed collider rules')
    # Physical detector casings gate each interaction module. Full three-
    # dimensional geometry and maintenance are explicitly idle adaptations.
    modules={k:{'particles':v,'casing':imp.named({'EM':'CMSCasing','Weak':'ATLASCasing','Strong':'ALICECasing','Grav':'LHCbCasing'}[k])} for k,v in modules.items()}
    for v in modules.values():used.add(v['casing'])
    result={'particles':particles,'controllers':controllers,'hatches':hatches,'modules':modules,'sources':source_recipes,'hashes':hashes,
        'adaptations':['Directed zero-distance packet links replace straight pipes. One packet is transferred per completed source/collider second; no warehouse or tank storage. Particle source voltage/energy/rate and beam-crafter per-particle progress are retained. Collider base machine is controller plus beam hatches; installing each detector module consumes one matching physical detector casing, not the full spatial multiblock. One beam-crafting operation at a time; original 1024-way parallelism, beam focussing/target-chamber masks, maintenance and packet phase offsets are not yet simulated. Collider accelerator keeps its source particle, mass thresholds, module-specific random pool and per-cycle EU; output filtering discards other rolls without rerolling.']}
    (root/'src/data/beamline-reference.js').write_text('// Generated by scripts/gtnh-beamline.py.\nexport const BEAMLINE_REFERENCE='+json.dumps(result,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    return used
