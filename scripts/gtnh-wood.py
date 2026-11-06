"""Oak representative of GT's log registrator, pinned to the pack config.

Vanilla oak's single-log output is four planks before ProcessingLog replaces
it. Other tree subtypes are not silently collapsed into oak.
"""
import hashlib
import re


def generate(imp):
    label='gregtech/loaders/oreprocessing/ProcessingLog.java'
    path=imp.source/label
    text=path.read_text(encoding='utf-8')
    cfg=imp.instance/'.minecraft/config/GregTech/GregTech.cfg'
    flag=re.search(r'B:nerfedWoodPlank=(true|false)',cfg.read_text(encoding='utf-8'))
    if not flag:raise ValueError('missing nerfedWoodPlank config')
    nerfed=flag[1]=='true'
    imp.paths[label]=hashlib.sha256(path.read_bytes()).hexdigest()
    imp.paths['instance/config/GregTech/GregTech.cfg']=hashlib.sha256(cfg.read_bytes()).hexdigest()
    imp.active_file=label;imp.constants={}
    log=imp.stack('new ItemStack(Blocks.log,1,0)')[0]
    plank=imp.stack('new ItemStack(Blocks.planks,1,0)')[0]
    def emit(process,inputs,outputs,ticks,power,marker,tools=None):
        line=text.count('\n',0,text.index(marker))+1
        return imp.emit_recipe(process,inputs,outputs,ticks,power,line,tools or {},{},[],None)
    r=emit('craft',{log:1},{plank:2 if nerfed else 4},20,0,'GTModHandler.addShapelessCraftingRecipe(')
    if r:r.update(stage=0,craftingSource='shapeless',durationAdapted=True)
    r=emit('craft',{log:1},{plank:4 if nerfed else 5},20,0,'GTModHandler.addCraftingRecipe(',{'saw':1})
    if r:r.update(stage=0,craftingSource='shaped',durationAdapted=True,grid=[None,None,None,log,None,None,None,None,None],gridTools={'0':'saw'},handToolsAdapted=True)
    for fluid,amount,ticks,boards,dust in [('DimensionallyShiftedSuperfluid',1,80,6,1),('Lubricant',1,200,6,1),('Water',5,400,4 if nerfed else 5,2),('DistilledWater',3,400,4 if nerfed else 5,2)]:
        fid=imp.stack('GTModHandler.getDistilledWater(1)')[0] if fluid=='DistilledWater' else imp.material(fluid)
        emit('cut',{log:1,fid:amount},{plank:boards,imp.material('Wood','dust'):dust},ticks,8,'.fluidInputs('+('GTModHandler.getDistilledWater' if fluid=='DistilledWater' else 'Materials.'+fluid))
