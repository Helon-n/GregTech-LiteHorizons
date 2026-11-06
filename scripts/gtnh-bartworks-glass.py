"""Resolve registered BartWorks glass subtypes and voltage ore dictionaries."""
import hashlib
import json
import re


def load(imp,split_args,matching):
    def read(label):
        path=imp.source/label
        imp.paths[label]=hashlib.sha256(path.read_bytes()).hexdigest()
        return path.read_text(encoding='utf-8')
    text=read('bartworks/common/loaders/ItemRegistry.java')
    main=read('bartworks/MainMod.java')
    tiers=read('gregtech/api/util/GlassTier.java')
    domain=imp.mod_ids['BartWorks']
    imp.bw_glass_blocks={};imp.bw_glass_ores={}
    for index,key in enumerate(['bw_realglas','bw_realglas2']):
        registration=re.search(r'registerBlock\(ItemRegistry\.bw_glasses\['+str(index)+r'\],[^;]*?"([^"\n]+)"\)',main)
        call=re.search(r'\b'+key+r'\s*=\s*new BWBlocksGlass2?\(',text)
        if not registration or not call:raise ValueError('missing registered BartWorks glass '+key)
        end=matching(text,call.end()-1);args=split_args(text[call.end():end])
        textures=re.findall(r'MainMod.MOD_ID\s*\+\s*":([^"\n]+)"',args[1])
        imp.bw_glass_blocks[key]=registration[1]
        for meta,texture in enumerate(textures):
            registry=domain+':'+registration[1]
            imp.external_item_metadata[(registry,meta)]={'registry':registry,'meta':meta,
                'name':imp.lang.get('tile.'+registration[1]+'.'+str(meta)+'.name',texture),
                'texture':'assets/'+domain.lower()+'/textures/blocks/'+texture+'.png'}
    names=['ULV','LV','MV','HV','EV','IV','LuV','ZPM','UV','UHV','UEV','UIV','UMV','UXV','MAX']
    # Subtier zero is the source's designated representative. Other variants
    # remain separate physical items, not free conversions between glass tiers.
    for key,meta,tier in re.findall(r'addCustomGlass\(ItemRegistry\.(bw_realglas2?),\s*(\d+),\s*(\d+),\s*0\)',tiers):
        imp.bw_glass_ores['blockGlass'+names[int(tier)]]='getModItem(BartWorks.ID,'+json.dumps(imp.bw_glass_blocks[key])+',1,'+meta+')'
