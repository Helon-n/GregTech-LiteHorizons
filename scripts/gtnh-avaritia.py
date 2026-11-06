"""Exact Avaritia 1.100 subtype names and render layers; original jar assets only."""
import hashlib
import re
import zipfile


def load(imp, root):
    source=root/'.local/gtnh-technology/Avaritia-1.100/src/main/java/fox/spiteful/avaritia'
    if not source.exists():
        raise ValueError('Pinned Avaritia 1.100 source is required for subtype metadata')
    def read(name):
        path=source/name
        imp.paths['Avaritia-1.100/'+name]=hashlib.sha256(path.read_bytes()).hexdigest()
        return path.read_text(encoding='utf-8')
    lang={}
    jar=next((imp.instance/'.minecraft/mods').glob('Avaritia-1.100*.jar'),None)
    if jar is None:jar=next((imp.instance/'.minecraft/mods').glob('avaritia-1.100*.jar'),None)
    if jar is None:raise ValueError('Installed Avaritia version differs from pinned 1.100')
    with zipfile.ZipFile(jar) as z:
        for name in ('en_US','zh_CN'):
            path='assets/avaritia/lang/'+name+'.lang'
            if path in z.namelist():
                lang.update(line.split('=',1) for line in z.read(path).decode('utf-8-sig').splitlines() if '=' in line and not line.startswith('#'))
    imp.paths['instance/mods/'+jar.name]=hashlib.sha256(jar.read_bytes()).hexdigest()
    registered={}
    mod=imp.mod_ids['Avaritia']
    def add(registry,meta,texture,name,**extra):
        registered[(mod+':'+registry,meta)]={'name':lang.get(name+'.name',name),'registry':mod+':'+registry,'meta':meta,'texture':'assets/avaritia/textures/'+texture+'.png',**extra}
    text=read('items/ItemResource.java')
    types=re.findall(r'"([^"]+)"',re.search(r'String\[\] types\s*=\s*new String\[\]\s*\{([^}]+)\}',text)[1])
    for i,t in enumerate(types):add('Resource',i,'items/resource_'+t,'item.avaritia_resource.'+t)
    text=read('items/ItemSingularity.java')
    types=re.findall(r'"([^"]+)"',re.search(r'String\[\] types\s*=\s*new String\[\]\s*\{([^}]+)\}',text)[1])
    colors={key:re.findall(r'0x([0-9a-fA-F]+)',re.search(r'int\[\] '+key+r'\s*=\s*new int\[\]\s*\{([^}]+)\}',text)[1]) for key in ('colors','colors2')}
    for i,t in enumerate(types):add('Singularity',i,'items/singularity2','item.singularity_'+t,color=colors['colors2'][i],overlay='assets/avaritia/textures/items/singularity.png',overlayColor=colors['colors'][i])
    read('blocks/LudicrousBlocks.java')
    for registry,cls,texture in [('Double_Craft','BlockDoubleCraft','double_craft'),('Triple_Craft','BlockTripleCraft','triple_craft'),('Dire_Crafting','BlockDireCrafting','dire_crafting_side'),('Crystal_Matrix','BlockCrystalMatrix','block_crystal_matrix'),('Neutron_Collector','BlockNeutronCollector','collector_front'),('Neutronium_Compressor','BlockCompressor','compressor_front')]:
        text=read('blocks/'+cls+'.java')
        name=re.search(r'setBlockName\("([^"]+)"',text)
        add(registry,0,'blocks/'+texture,'tile.'+(name[1] if name else registry))
    read('blocks/BlockResource.java');read('blocks/ItemBlockResource.java')
    for i,t in enumerate(('neutronium','infinity')):add('Resource_Block',i,'blocks/block_'+t,'tile.block_'+t)
    imp.external_item_metadata=registered
