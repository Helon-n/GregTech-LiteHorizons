"""Resolve Galacticraft basic-item subtypes from the installed original jar."""
import hashlib
import re
import zipfile


def load(imp,root):
    directory=root/'.local/gtnh-technology/Galacticraft-3.4.37/micdoodle8/mods/galacticraft/core/items'
    path=directory/'ItemBasic.java'
    text=path.read_text(encoding='utf-8')
    names=re.search(r'String\[\] names = new String\[\]\{([^}]+)\}',text)
    if not names:raise ValueError('Galacticraft basic item subtype table missing')
    imp.compressed_items={}
    jar=imp.instance/'.minecraft/mods/Galacticraft-3.4.37-GTNH.jar'
    with zipfile.ZipFile(jar) as archive:
        files=set(archive.namelist())
        for meta,key in enumerate(re.findall(r'"([^"\n]+)"',names[1])):
            texture='assets/galacticraftcore/textures/items/basicItem.'+key+'.png'
            if texture not in files:raise ValueError('Missing original Galacticraft texture '+texture)
            name=imp.lang.get('item.basicItem.'+key+'.name',key)
            imp.external_item_metadata[('GalacticraftCore:item.basicItem',meta)]={'registry':'GalacticraftCore:item.basicItem','meta':meta,'texture':texture,'name':name}
            if key.startswith('compressed'):
                material={'Aluminum':'Aluminium'}.get(key[10:],key[10:])
                if material in imp.materials:imp.compressed_items[material]='getModItem(GalacticraftCore.ID,"item.basicItem",1,'+str(meta)+')'
    imp.paths['Galacticraft-3.4.37/ItemBasic.java']=hashlib.sha256(path.read_bytes()).hexdigest()
    imp.paths['instance/mods/'+jar.name]=hashlib.sha256(jar.read_bytes()).hexdigest()
    # GCItems registers this separate subtype as compressedMeteoricIron.
    # Dreamcraft disables Galacticraft's compressor recipe, but GT's
    # ProcessingPlate still registers the triple-plate implosion route.
    gcitems=directory/'GCItems.java';raw=gcitems.read_text(encoding='utf-8')
    if not re.search(r'registerOre\(\(String\)"compressedMeteoricIron",\s*\(ItemStack\)new ItemStack\(meteoricIronIngot, 1, 1\)\)',raw):raise ValueError('changed compressed meteoric iron registration')
    imp.paths['Galacticraft-3.4.37/GCItems.java']=hashlib.sha256(gcitems.read_bytes()).hexdigest()
    imp.compressed_items['MeteoricIron']='getModItem(GalacticraftCore.ID,"item.meteoricIronIngot",1,1)'
    # GT removes the old compressed-item crafting recipes and registers its
    # triple-plate implosion route. Core's space plates share that prefix.
    dictionary=imp.core/'com/dreammaster/gthandler/GT_Loader_OreDictionary.java'
    raw=dictionary.read_text(encoding='utf-8')
    for material,key in re.findall(r'\.registerOre\(\s*OrePrefixes\.compressed,\s*Materials\.(\w+),\s*NHItemList\.(\w+)\.get\(\)\)',raw):
        imp.compressed_items[material]='NHItemList.'+key+'.get(1)'
    imp.paths['NewHorizonsCoreMod/com/dreammaster/gthandler/GT_Loader_OreDictionary.java']=hashlib.sha256(dictionary.read_bytes()).hexdigest()
    imp.material_prefixes.add('compressed')
