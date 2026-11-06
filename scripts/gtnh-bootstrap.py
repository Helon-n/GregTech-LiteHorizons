"""Source-backed routes needed before the first electric circuit."""
import hashlib
import re


def generate(imp, numeric):
    directory='gregtech/loaders/oreprocessing/'
    def emit(file, inputs, outputs, line, tools=None, grid=None, slots=None):
        imp.active_file=directory+file+'.java'
        imp.paths[imp.active_file]=hashlib.sha256((imp.source/imp.active_file).read_bytes()).hexdigest()
        r=imp.emit_recipe('craft',inputs,outputs,1,0,line,tools or {},{},[],None)
        if r:
            r.update(stage=1,craftingSource='shaped' if grid else 'shapeless',durationAdapted=True)
            if grid:r['grid']=grid
            if slots:r['gridTools']=slots
    # Scope this expansion to bootstrap conductors. Later materials must not
    # acquire generic hand routes simply because a form appears in a recipe.
    for name in ('Copper','Tin','Iron','Steel','RedAlloy','Rubber'):
        m=imp.materials[name]
        if m['processingEU']>=8192:continue
        f=lambda prefix:imp.material(name,prefix)
        plate=f('plate')
        if 'NO_SMASHING' not in m['tags']:
            emit('ProcessingPlate',{plate:1},{f('foil'):2},127,{'hammer':1},[None,plate,None,None,None,None,None,None,None],{'0':'hammer'})
            emit('ProcessingPlate',{plate:1},{f('itemCasing'):1},412,{'hammer':1},[None,None,plate,None,None,None,None,None,None],{'0':'hammer'})
        if 'NO_WORKING' not in m['tags']:
            foil=f('foil')
            emit('ProcessingFineWire',{foil:1},{f('wireFine'):1},26,{'wireCutter':1},[foil,None,None,None,None,None,None,None,None],{'1':'wireCutter'})
            emit('ProcessingWire',{plate:1},{f('wireGt01'):1},99,{'wireCutter':1},[plate,None,None,None,None,None,None,None,None],{'1':'wireCutter'})
        if name in ('Tin','RedAlloy'):
            emit('ProcessingWire',{f('wireGt01'):1,imp.material('Rubber','plate'):1},{f('cableGt01'):1},241)
    # The original alloy loader uses a MaterialStack[][] loop rather than
    # literal builders. Only registered dust/ingot forms are expanded.
    file='gregtech/loaders/postload/recipes/AlloySmelterRecipes.java'
    imp.active_file=file
    path=imp.source/file;text=path.read_text(encoding='utf-8')
    imp.paths[file]=hashlib.sha256(path.read_bytes()).hexdigest()
    pattern=r'\{\s*new MaterialStack\(Materials\.(\w+),\s*(\d+)L\),\s*new MaterialStack\(Materials\.(\w+),\s*(\d+)L\),\s*new MaterialStack\(Materials\.(\w+),\s*(\d+)L\)\s*}'
    for match in re.finditer(pattern,text):
        a,na,b,nb,out,nout=match.groups();na=int(na);nb=int(nb);nout=int(nout)
        if not imp.materials[out]['metal']:continue
        for pa in ('dust','ingot'):
            for pb in ('dust','ingot'):
                if pa=='ingot' and not imp.materials[a]['metal'] or pb=='ingot' and not imp.materials[b]['metal']:continue
                imp.emit_recipe('alloy',{imp.material(a,pa):na,imp.material(b,pb):nb},{imp.material(out,'ingot'):nout},nout*50,15,text.count('\n',0,match.start())+1,{}, {},[],None)
