"""Registered physical representatives for reusable manual crafting tools.

Material stats and durability remain an explicit idle adaptation. Recipes are
read from the pinned source; late materials never gain generic hand recipes.
"""
import hashlib
import re


def generate(imp):
    for key,secondary in [('MORTAR','Stone'),('KNIFE','Wood')]:
        imp.stack('MetaGeneratedTool01.INSTANCE.getToolWithStats(IDMetaTool01.'+key+'.ID,1,Materials.Flint,Materials.'+secondary+',null)')
    label='gregtech/loaders/oreprocessing/ProcessingToolHead.java'
    path=imp.source/label;text=path.read_text(encoding='utf-8')
    imp.paths[label]=hashlib.sha256(path.read_bytes()).hexdigest()
    for key in ('ToolMortar','ToolKnife','ToolSoftMallet'):
        source=imp.source/('gregtech/common/tools/'+key+'.java')
        imp.paths[str(source.relative_to(imp.source)).replace('\\','/')]=hashlib.sha256(source.read_bytes()).hexdigest()
    form=imp.core/'com/dreammaster/item/WoodenBrickForm.java'
    imp.paths['NewHorizonsCoreMod/com/dreammaster/item/WoodenBrickForm.java']=hashlib.sha256(form.read_bytes()).hexdigest()
    branch=text.index('case "toolHeadHammer", "toolHeadMallet"')
    match=re.search(r'new Object\[\] \{ "XX ", "XXS", "XX ", \'X\',\s*aMaterial == Materials.Wood \? OrePrefixes.plank.get\(Materials.Wood\)\s*: OrePrefixes.ingot.get\(aMaterial\),\s*\'S\', OrePrefixes.stick.get\(aMaterial.mHandleMaterial\) \}',text[branch:])
    if not match:raise ValueError('changed native wooden mallet recipe')
    wood=imp.materials['Wood']
    imp.items['softMallet']={'id':'softMallet','name':'木软锤','kind':'item','category':'工具','nativeItem':{'registry':'gregtech:gt.metatool.01','meta':14,'texture':'assets/gregtech/textures/items/materialicons/NONE/toolHeadMallet.png','color':wood['color'],'overlay':'assets/gregtech/textures/items/materialicons/NONE/handleMallet.png','overlayColor':wood['color']}}
    imp.active_file=label;imp.constants={}
    plank=imp.stack('new ItemStack(Blocks.planks,1)')[0]
    stick=imp.stack('new ItemStack(Items.stick,1)')[0]
    recipe=imp.emit_recipe('craft',{plank:6,stick:1},{'softMallet':1},1,0,text.count('\n',0,branch+match.start())+1,{}, {},[],None)
    if recipe:recipe.update(stage=0,grid=[plank,plank,None,plank,plank,stick,plank,plank,None],handToolsAdapted=True,durationAdapted=True)
