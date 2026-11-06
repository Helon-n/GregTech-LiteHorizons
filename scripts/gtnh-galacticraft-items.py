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
    jar=imp.instance/'.minecraft/mods/Galacticraft-3.4.37-GTNH.jar'
    with zipfile.ZipFile(jar) as archive:
        files=set(archive.namelist())
        for meta,key in enumerate(re.findall(r'"([^"\n]+)"',names[1])):
            texture='assets/galacticraftcore/textures/items/basicItem.'+key+'.png'
            if texture not in files:raise ValueError('Missing original Galacticraft texture '+texture)
            name=imp.lang.get('item.basicItem.'+key+'.name',key)
            imp.external_item_metadata[('GalacticraftCore:item.basicItem',meta)]={'registry':'GalacticraftCore:item.basicItem','meta':meta,'texture':texture,'name':name}
    imp.paths['Galacticraft-3.4.37/ItemBasic.java']=hashlib.sha256(path.read_bytes()).hexdigest()
    imp.paths['instance/mods/'+jar.name]=hashlib.sha256(jar.read_bytes()).hexdigest()
