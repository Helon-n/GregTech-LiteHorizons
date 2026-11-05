"""Build standalone item sprites from a read-only GTNH instance.

Uses only original Minecraft and mod assets, never resource-pack overrides. Material colors,
texture sets and meta-item IDs are read from the installed GregTech bytecode.
Block icons combine the source top/side/front textures into an inventory cube.
Requires Pillow, NumPy, Node and javap for this development import only.
"""
import argparse
import io
import json
import re
import subprocess
import zipfile
from pathlib import Path
from PIL import Image, ImageChops, ImageEnhance
import numpy as np

PROJECT = Path(__file__).resolve().parents[1]
GT = 'assets/gregtech/textures/'
MC = 'assets/minecraft/textures/'


def bytecode(jar, name):
    result = subprocess.run(['javap', '-c', '-p', '-classpath', str(jar), name],
                            capture_output=True, text=True, encoding='utf-8', errors='replace', check=True)
    return result.stdout


def integer(line):
    match = re.search(r'\b(?:sipush|bipush)\s+(-?\d+)', line) or re.search(r'// int (-?\d+)', line)
    if match:
        return int(match[1])
    match = re.search(r'\biconst_(\d)', line)
    return int(match[1]) if match else None


class Importer:
    def __init__(self, instance, vanilla, output):
        self.instance, self.output = instance, output
        self.archives, self.files, self.manifest = [], {}, {}
        self.add_archive(vanilla)
        mods = instance / '.minecraft/mods'
        for jar in sorted(mods.glob('*.jar')):
            self.add_archive(jar)
        self.gregtech = next(mods.glob('gregtech-*.jar'))
        self.packs = []
        self.materials = self.read_materials()
        self.meta = {}
        for suffix in ['01', '03']:
            code = bytecode(self.gregtech, 'gregtech.common.items.IDMetaItem' + suffix)
            for match in re.finditer(r'// String (\w+)\n(.*?)(?=invokespecial)', code, re.S):
                numbers = [integer(line) for line in match[2].splitlines()]
                numbers = [n for n in numbers if n is not None]
                if numbers:
                    self.meta[match[1]] = GT + f'items/gt.metaitem.{suffix}/{numbers[-1]}.png'
        output.mkdir(parents=True, exist_ok=True)

    def add_archive(self, path):
        archive = zipfile.ZipFile(path)
        self.archives.append(archive)
        for name in archive.namelist():
            if name.startswith('assets/') and name.endswith('.png'):
                self.files[name] = (archive, path.name)

    def read_materials(self):
        code = bytecode(self.gregtech, 'gregtech.loaders.materials.MaterialsInit')
        materials = {}
        for method in re.split(r'\n  (?:private|public) static ', code):
            name = re.search(r'// String (\w+)\n\s*\d+: invokevirtual.*MaterialBuilder.setName:', method)
            if not name:
                continue
            color, texture = 0xffffff, 'NONE'
            lines = method.splitlines()
            for index, line in enumerate(lines):
                if 'MaterialBuilder.setARGB:' in line:
                    color = integer(lines[index - 1])
                match = re.search(r'TextureSet.SET_(\w+):', line)
                if match:
                    texture = match[1]
            materials[name[1].lower()] = {'color': color, 'texture': texture}
        return materials

    def find(self, *candidates):
        for candidate in candidates:
            if candidate in self.files:
                return candidate
        raise ValueError('Missing texture: ' + ', '.join(candidates))

    def search(self, expression):
        found = [path for path in self.files if re.search(expression, path, re.I)]
        if not found:
            raise ValueError('No texture for ' + expression)
        return sorted(found, key=lambda s: (len(s), s))[0]

    def load(self, path, tint=None):
        self.used.append({'archive': self.files[path][1], 'texture': path, **({'tint': f'#{tint & 0xffffff:06x}'} if tint is not None else {})})
        image = Image.open(io.BytesIO(self.files[path][0].read(path))).convert('RGBA')
        # Minecraft animated sprites stack square frames vertically.
        if image.height > image.width:
            image = image.crop((0, 0, image.width, image.width))
        if tint is not None:
            alpha = image.getchannel('A')
            rgb = ((tint >> 16) & 255, (tint >> 8) & 255, tint & 255)
            image = ImageChops.multiply(image.convert('RGB'), Image.new('RGB', image.size, rgb))
            image.putalpha(alpha)
        return image

    def sprite(self, path, tint=None):
        image = self.load(path, tint)
        overlay = path[:-4] + '_OVERLAY.png'
        if overlay in self.files:
            image.alpha_composite(self.load(overlay).resize(image.size, Image.Resampling.NEAREST))
        return image

    def cube(self, front, top=None, side=None):
        front = front.resize((16, 16), Image.Resampling.NEAREST)
        top = (top or front).resize((16, 16), Image.Resampling.NEAREST)
        side = (side or front).resize((16, 16), Image.Resampling.NEAREST)
        result = Image.new('RGBA', (64, 64))
        for image, matrix, brightness in [
            (top, (.25, .5, -8, -.25, .5, 8), 1),
            (side, (.5, 0, 0, -.25, .5, -8), .7),
            (front, (.5, 0, -16, .25, .5, -24), .88),
        ]:
            face = ImageEnhance.Brightness(image).enhance(brightness)
            result.alpha_composite(face.transform((64, 64), Image.Transform.AFFINE, matrix, Image.Resampling.NEAREST))
        return result

    def save(self, item, image, note=''):
        # Trace same-color pixel runs into vector paths. No embedded raster image.
        pixels = image.convert('RGBA')
        colors = {}
        for y in range(pixels.height):
            x = 0
            while x < pixels.width:
                color = pixels.getpixel((x, y))
                start = x
                while x < pixels.width and pixels.getpixel((x, y)) == color:
                    x += 1
                if color[3]:
                    colors.setdefault(color, []).append(f'M{start} {y}h{x-start}v1h{start-x}z')
        paths = []
        for (r, g, b, a), runs in colors.items():
            opacity = f' fill-opacity="{a/255:.6f}"' if a < 255 else ''
            paths.append(f'<path fill="#{r:02x}{g:02x}{b:02x}"{opacity} d="{"".join(runs)}"/>')
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {pixels.width} {pixels.height}" shape-rendering="crispEdges">{"".join(paths)}</svg>\n'
        (self.output / (item + '.svg')).write_text(svg, encoding='utf-8')
        self.manifest[item] = {'sources': self.used, **({'note': note} if note else {})}
        self.used = []

    def material(self, material, form):
        key = material.lower()
        data = self.materials.get(key)
        if data is None:
            raise ValueError('Material registry not found: ' + material)
        folder = 'blocks' if form in ['ore', 'wire'] else 'items'
        base = GT + f'{folder}/materialicons/'
        path = self.find(base + f'CUSTOM/{key}/{form}.png', base + f'{data["texture"]}/{form}.png', base + f'NONE/{form}.png')
        image = self.sprite(path, data['color'])
        overlay = base + f'CUSTOM/{key}/{form}_OVERLAY.png'
        if not path.startswith(base + f'CUSTOM/{key}/') and overlay in self.files:
            image.alpha_composite(self.load(overlay).resize(image.size, Image.Resampling.NEAREST))
        if form == 'ore':
            stone=self.load(self.find(MC+'blocks/stone.png')).resize(image.size,Image.Resampling.NEAREST)
            stone.alpha_composite(image)
            image=stone
        return image

    def machine(self, overlay, casing='MACHINE_CASING_SOLID_STEEL', top=None):
        base_path = self.find(GT + f'blocks/iconsets/{casing}.png')
        base = self.load(base_path)
        front = base.copy()
        if overlay:
            front.alpha_composite(self.load(overlay).resize(base.size, Image.Resampling.NEAREST))
        return self.cube(front, self.load(top) if top else base, base)

    def rocket(self, tier):
        """Rasterize Galacticraft's actual cuboid model with its source UVs."""
        jar = next((self.instance/'.minecraft/mods').glob('Galacticraft-*.jar'))
        model = 'core.client.model.ModelRocketTier1' if tier == 1 else 'planets.mars.client.model.ModelTier2Rocket'
        code = bytecode(jar,'micdoodle8.mods.galacticraft.'+model)
        texture_path = f'assets/galacticraft{"core" if tier==1 else "mars"}/textures/model/rocketT{tier}.png'
        texture = self.load(texture_path)
        parts = []
        def number(line):
            floating = re.search(r'// float (-?[\d.]+)f',line)
            if floating:return float(floating[1])
            constant = re.search(r'fconst_(\d)',line)
            return float(constant[1]) if constant else integer(line)
        for block in re.split(r'\n\s*\d+: new\s+.*class net/minecraft/client/model/ModelRenderer',code)[1:]:
            lines=block.splitlines();uv=box=point=rotation=None
            for index,line in enumerate(lines):
                if 'ModelRenderer."<init>"' in line:
                    uv=[number(s) for s in lines[:index] if number(s) is not None][-2:]
                if 'func_78789_a:' in line or 'func_78790_a:' in line or '.addBox:' in line:
                    box=[number(s) for s in lines[:index] if number(s) is not None][-6:]
                if 'func_78793_a:' in line or '.setRotationPoint:' in line:
                    point=[number(s) for s in lines[:index] if number(s) is not None][-3:]
                if 'Method setRotation:' in line:
                    rotation=[number(s) for s in lines[:index] if number(s) is not None][-3:]
            if uv and box and point:parts.append((uv,box,point,rotation or [0,0,0]))
        if not parts:raise ValueError('No Galacticraft rocket model parts')
        yaw,pitch=np.radians(28),np.radians(-9)
        view=np.array([[np.cos(yaw),0,np.sin(yaw)],[np.sin(pitch)*np.sin(yaw),np.cos(pitch),-np.sin(pitch)*np.cos(yaw)],[-np.cos(pitch)*np.sin(yaw),np.sin(pitch),np.cos(pitch)*np.cos(yaw)]])
        faces=[]
        for (u,v),(x,y,z,w,h,d),point,rotation in parts:
            vertices=np.array([[x,y,z],[x+w,y,z],[x+w,y+h,z],[x,y+h,z],[x,y,z+d],[x+w,y,z+d],[x+w,y+h,z+d],[x,y+h,z+d]],dtype=float)
            a,b,c=rotation
            rx=np.array([[1,0,0],[0,np.cos(a),-np.sin(a)],[0,np.sin(a),np.cos(a)]])
            ry=np.array([[np.cos(b),0,np.sin(b)],[0,1,0],[-np.sin(b),0,np.cos(b)]])
            rz=np.array([[np.cos(c),-np.sin(c),0],[np.sin(c),np.cos(c),0],[0,0,1]])
            vertices=((vertices@(rz@ry@rx).T)+point)@view.T
            for indices,rect in [([5,1,2,6],(u+d+w,v+d,u+d+w+d,v+d+h)),([0,4,7,3],(u,v+d,u+d,v+d+h)),([5,4,0,1],(u+d,v,u+d+w,v+d)),([2,3,7,6],(u+d+w,v,u+d+2*w,v+d)),([1,0,3,2],(u+d,v+d,u+d+w,v+d+h)),([4,5,6,7],(u+d+w+d,v+d,u+d+w+d+w,v+d+h))]:
                faces.append((vertices[indices],np.array([[rect[2],rect[1]],[rect[0],rect[1]],[rect[0],rect[3]],[rect[2],rect[3]]])))
        all_vertices=np.concatenate([face[0] for face in faces]);low=all_vertices[:,:2].min(axis=0);extent=np.ptp(all_vertices[:,:2],axis=0);scale=116/max(extent)
        canvas=np.zeros((128,128,4),dtype=np.uint8);depth=np.full((128,128),-np.inf);pixels=np.asarray(texture)
        for vertices,uv in faces:
            vertices=vertices.copy();vertices[:,:2]=(vertices[:,:2]-low)*scale+(128-extent*scale)/2
            for ids in [[0,1,2],[0,2,3]]:
                triangle=vertices[ids];coords=uv[ids];a,b,c=triangle[:,:2]
                denom=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
                if abs(denom)<1e-6:continue
                lo=np.maximum(0,np.floor(triangle[:,:2].min(axis=0)).astype(int));hi=np.minimum(127,np.ceil(triangle[:,:2].max(axis=0)).astype(int))
                yy,xx=np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1]
                wa=((b[1]-c[1])*(xx+.5-c[0])+(c[0]-b[0])*(yy+.5-c[1]))/denom
                wb=((c[1]-a[1])*(xx+.5-c[0])+(a[0]-c[0])*(yy+.5-c[1]))/denom;wc=1-wa-wb
                zz=wa*triangle[0,2]+wb*triangle[1,2]+wc*triangle[2,2]
                tex=wa[...,None]*coords[0]+wb[...,None]*coords[1]+wc[...,None]*coords[2]
                # Original model UVs use a 256 x 256 atlas.
                tx=np.clip((tex[...,0]*texture.width/256).astype(int),0,texture.width-1);ty=np.clip((tex[...,1]*texture.height/256).astype(int),0,texture.height-1)
                sample=pixels[ty,tx];mask=(wa>=0)&(wb>=0)&(wc>=0)&(sample[...,3]>0)&(zz>depth[yy,xx])
                canvas[yy[mask],xx[mask]]=sample[mask];depth[yy[mask],xx[mask]]=zz[mask]
        return Image.fromarray(canvas)

    def run(self):
        catalog = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
            "import {items,MATERIALS,machines} from './src/data/catalog.js';console.log(JSON.stringify({items,MATERIALS,machines}));"], cwd=PROJECT, text=True, encoding='utf-8'))
        self.used = []
        # Vanilla assets are read from the unmodified Minecraft archive.
        vanilla_items = {'stick': 'stick', 'flint': 'flint', 'clay': 'clay_ball', 'coal': 'coal',
                         'brick': 'brick', 'redstone': 'redstone_dust', 'diamond': 'diamond',
                         'ironBucket': 'bucket_empty', 'ui-research': 'book_normal', 'ui-overview': 'compass'}
        for item, texture in vanilla_items.items():
            self.save(item, self.sprite(self.find(MC + f'items/{texture}.png')))
        vanilla_blocks = {'wood': ('log_oak', 'log_oak_top'), 'stone': ('cobblestone', None),
                          'gravel': ('gravel', None), 'sand': ('sand', None), 'glass': ('glass', None),
                          'workbench': ('crafting_table_front', 'crafting_table_top')}
        for item, (front, top) in vanilla_blocks.items():
            self.save(item, self.cube(self.load(MC + f'blocks/{front}.png'), self.load(MC + f'blocks/{top}.png') if top else None))
        for item, material, form in [('sulfur','Sulfur','dust'),('salt','Salt','dust'),('bauxite','Bauxite','ore'),
              ('rutile','Rutile','ore'),('tungstate','Tungstate','ore'),('platinumOre','Platinum','ore'),
              ('rareEarth','RareEarth','dust'),('naquadahOre','Naquadah','ore'),('rubber','Rubber','plate')]:
            image = self.material(material, form)
            self.save(item, self.cube(image) if form == 'ore' else image)
        aliases = {'stainless':'StainlessSteel','tungstensteel':'TungstenSteel','cosmic':'CosmicNeutronium',
                   'spacetime':'SpaceTime','catalyst':'InfinityCatalyst','chrome':'Chrome'}
        for item, *_ in catalog['MATERIALS']:
            material = aliases.get(item, item)
            for suffix, form in [('', 'ingot'),('Plate','plate'),('Dust','dust'),('Rod','stick'),('Wire','wire')]:
                self.save(item + suffix, self.material(material, form))
            if item + 'Ore' in catalog['items']:
                self.save(item + 'Ore', self.cube(self.material(material, 'ore')))
        for material in ['chrome','nickel','platinum']:
            self.save(material, self.material(aliases.get(material,material),'ingot'))
        meta_items = {
            'vacuumTube':'Circuit_Primitive','coatedBoard':'Circuit_Board_Basic','resistor':'Circuit_Parts_Wiring_Basic',
            'motor':'Electric_Motor_LV','pump':'Electric_Pump_LV','silicon':'Circuit_Silicon_Wafer',
            'basicCircuit':'Circuit_BasicElectronic','goodCircuit':'Circuit_Integrated_Good',
            'advancedCircuit':'Circuit_Advanced','processor':'Circuit_Processor','nanoCircuit':'Circuit_Nanoprocessor',
            'quantumCircuit':'Circuit_Quantumprocessor','crystalCircuit':'Circuit_Crystalprocessor',
            'wetwareCircuit':'Circuit_Neuroprocessor','biowareCircuit':'Circuit_Bioprocessor',
            'opticalCircuit':'Circuit_OpticalProcessor','exoticCircuit':'Circuit_ExoticProcessor',
            'cosmicCircuit':'Circuit_CosmicProcessor','transcendentCircuit':'Circuit_TranscendentProcessor',
            'fieldGenerator':'Field_Generator_IV','starCore':'QuantumStar','fusionCore':'NuclearStar',
        }
        for item, enum in meta_items.items():
            path = self.meta.get(enum)
            if not path:
                raise ValueError('GregTech meta-item missing: ' + enum)
            self.save(item, self.sprite(self.find(path)))
        for item, expr in {
            'resin':r'assets/ic2/textures/items/itemHarz.png$',
            'coke':r'assets/railcraft/textures/items/fuel.coke.png$',
            'stargate':r'assets/dreamcraft/textures/items/itemStargateChevron.png$',
            'singularity':r'assets/avaritia/textures/items/singularity.png$',
            'dyson':r'textures/items/.*dyson.*\.png$',
            'spacetimeCircuit':r'assets/dreamcraft/textures/items/itemCircuitUXV.png$',
            'ultimateCircuit':r'assets/dreamcraft/textures/items/itemCircuitMAX.png$',
        }.items():
            self.save(item, self.sprite(self.search(expr)), 'GTNH counterpart for the adapted progression item.' if item in ['dyson','starCore','fusionCore','spacetimeCircuit','ultimateCircuit'] else '')
        for item,tier in [('rocket',1),('advancedRocket',2)]:
            self.save(item,self.rocket(tier),'Rendered from the installed Galacticraft model geometry and texture.')
        for item, expression in {'moonRock':r'assets/galacticraftmoon/textures/blocks/middle\.png$',
                                 'marsRock':r'assets/galacticraftmars/textures/blocks/cobblestone\.png$',
                                 'asteroid':r'assets/galacticraftasteroids/textures/blocks/asteroid0.png$'}.items():
            self.save(item,self.cube(self.load(self.search(expression))))
        self.save('woodBucket',self.sprite(self.find(MC+'items/bucket_empty.png'),self.materials['wood']['color']),'The adapted wooden bucket uses the GTNH bucket silhouette with GregTech wood color.')
        self.save('spaceTime',self.material('SpaceTime','ingot'),'Shared with the spacetime material.')
        for item, fluid in {'water':'water_still','steam':'fluid.steam','creosote':'fluid.creosote',
             'oxygen':'fluid.oxygen','hydrogen':'fluid.hydrogen','oil':'fluid.oil','diesel':'fluid.fuel',
             'sulfuricAcid':'fluid.sulfuricacid','chlorine':'fluid.chlorine','titaniumTetrachloride':'fluid.titaniumtetrachloride',
            'helium':'fluid.helium','plasma':'fluid.plasma.autogenerated'}.items():
            candidates=[MC+f'blocks/{fluid}.png',GT+f'blocks/fluids/{fluid}.png']
            if item=='diesel':candidates.append(self.search(r'blocks/fluids/fluid\.(?:diesel|dieselfuel|fuel).*\.png$'))
            self.save(item,self.sprite(self.find(*candidates)))
        # GT tools use independently colored tool heads and wooden handles.
        for item, material, head, handle in [
            ('flintPick','Flint','toolHeadPickaxe','stick'),('hammer','Iron','toolHeadHammer','stick'),
            ('wrench','Iron','toolHeadWrench',None),('saw','Iron','toolHeadSaw','handleSaw')]:
            image = self.material(material,head)
            if handle:
                image.alpha_composite(self.material('Wood',handle).resize(image.size,Image.Resampling.NEAREST))
            self.save(item,image)
        # Controllers use their real GTNH casing and front overlay.
        faces = {
            'boiler':'BOILER_FRONT', 'steamMacerator':'OVERLAY_FRONT_STEAM_MACERATOR',
            'alloySmelter':'OVERLAY_FRONT_STEAM_ALLOY_SMELTER', 'compressor':'OVERLAY_FRONT_STEAM_COMPRESSOR',
            'ebf':'OVERLAY_FRONT_ELECTRIC_BLAST_FURNACE',
            'distiller':'OVERLAY_FRONT_DISTILLATION_TOWER','vacuumFreezer':'OVERLAY_FRONT_VACUUM_FREEZER',
            'assemblyLine':'OVERLAY_FRONT_ASSEMBLY_LINE',
            'fusionGenerator':'LARGETURBINE_NEW5','cleanroom':'OVERLAY_TOP_CLEANROOM',
            'turbine':'LARGETURBINE_NEW5',
            'dieselGenerator':'DIESEL_GENERATOR_TOP',
        }
        basics={'assembler':'assembler','wiremill':'wiremill','electrolyzer':'electrolyzer',
                'chemical':'chemical_reactor'}
        special={'stellarForge':r'gregtech/textures/blocks/iconsets/GODFORGE_CONTROLLER\.png$',
                 'spaceElevator':r'gtnhintergalactic/textures/blocks/spaceElevator/BaseCasing\.png$',
                 'precisionAssembler':r'gregtech/textures/blocks/iconsets/MACHINE_CASING_PRECISE_STATIONARY\.png$',
                 'dimensionFactory':r'miscutils/textures/blocks/TileEntities/adv_machine_dimensional\.png$',
                 'dysonGenerator':r'gregtech/textures/blocks/iconsets/OVERLAY_FRONT_DYSONSPHERE\.png$',
                 'cosmicFabricator':r'gregtech/textures/blocks/iconsets/EM_OUTER_SPACETIME_REINFORCED_EOH_CASING\.png$'}
        for item in catalog['machines']:
            if item in ['gasTurbine','batteryBuffer','centrifuge','bender','lathe','forgeHammer']:
                continue  # Imported with the energy items below.
            if item == 'workbench':
                continue
            if item == 'furnace':
                overlay=self.find(GT+'blocks/iconsets/OVERLAY_FRONT_STEAM_FURNACE.png')
                self.save(item,self.machine(overlay,'MACHINE_CASING_BRICKEDBLASTFURNACE_INACTIVE'),'GTNH steam furnace texture on a brick-era casing.')
                continue
            if item == 'cokeOven':
                self.save(item,self.machine(self.find(GT+'blocks/iconsets/COKE_OVEN_OVERLAY_INACTIVE.png'),'COKE_OVEN_CASING'),'GTNH coke oven casing and controller texture.')
                continue
            if item == 'bbf':
                self.save(item,self.cube(self.load(self.find(GT+'blocks/iconsets/MACHINE_CASING_BRICKEDBLASTFURNACE_INACTIVE.png'))),'GTNH brick blast furnace casing texture.')
                continue
            if item == 'fusion':
                self.save(item,self.cube(self.load(self.find(GT+'blocks/iconsets/MACHINE_CASING_FUSION.png'))),'GTNH fusion casing texture.')
                continue
            if item in faces:
                overlay=self.find(GT+f'blocks/iconsets/{faces[item]}.png')
            elif item in basics:
                overlay=self.find(GT+f'blocks/basicmachines/{basics[item]}/OVERLAY_FRONT.png')
            elif item in ['spaceElevator','precisionAssembler','dimensionFactory','cosmicFabricator']:
                self.save(item,self.cube(self.load(self.search(special[item]))),'GTNH casing texture for the closest matching machine.')
                continue
            else:
                overlay=self.search(special[item])
            casing='MACHINE_CASING_FUSION' if item=='fusionGenerator' else 'MACHINE_CASING_SOLID_STEEL'
            top=None
            if item in ['steamMacerator','alloySmelter','compressor']:
                casing='MACHINE_BRONZE_SIDE';top=self.find(GT+'blocks/iconsets/MACHINE_BRONZE_TOP.png')
            if item=='boiler':
                casing='MACHINE_BRONZEBRICKS_SIDE';top=self.find(GT+'blocks/iconsets/MACHINE_BRONZEBRICKS_TOP.png')
            self.save(item,self.machine(overlay,casing,top),'GTNH controller textures for the adapted machine; inventory projection is generated from source faces.')
        for item, front in {'fluidTank':'MACHINE_CASING_TANK_0','largeTank':'MACHINE_CASING_TANK_2','legacyTank':'MACHINE_CASING_TANK_1'}.items():
            self.save(item,self.cube(self.load(self.find(GT+f'blocks/iconsets/{front}.png'))))
        self.save('ui-inventory',self.cube(self.load(self.find(MC+'blocks/planks_oak.png'))),'GTNH oak storage block, navigation icon.')
        pack=Image.open(self.instance/'gtnh_icon.png').convert('RGBA')
        self.used = [{'archive':'instance','texture':'gtnh_icon.png'}]
        self.save('pack', pack, 'GTNH pack logo traced into SVG paths.')
        pack.resize((256,256),Image.Resampling.NEAREST).save(self.output.parent/'app-icon.ico',sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
        (self.output.parent/'app-icon.png').unlink(missing_ok=True)
        missing=set(catalog['items'])-set(self.manifest)
        if missing:
            import sys
            subprocess.run([sys.executable, str(PROJECT/'scripts/import-energy-icons.py'), '--instance', str(self.instance), '--output', str(self.output)], check=True)
            subprocess.run([sys.executable, str(PROJECT/'scripts/import-material-icons.py'), '--instance', str(self.instance), '--output', str(self.output)], check=True)
            energy_icons=json.loads((self.output/'sources.json').read_text(encoding='utf-8'))['icons']
            for item in missing:
                if item in energy_icons:self.manifest[item]=energy_icons[item]
            missing=set(catalog['items'])-set(self.manifest)
        if missing:
            raise ValueError('Missing item icons: '+', '.join(sorted(missing)))
        (self.output/'sources.json').write_text(json.dumps({'pack':'GTNH 2.9.0','format':'SVG paths traced from original pixel artwork','resourcePacks':self.packs,'icons':self.manifest},ensure_ascii=False,indent=2),encoding='utf-8')
        # Retire only previously generated raster item icons in this output folder.
        for item in self.manifest:
            (self.output / (item + '.png')).unlink(missing_ok=True)
        print(f'Imported {len(self.manifest)} icons into {self.output}')


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--instance',required=True,type=Path)
    parser.add_argument('--vanilla',required=True,type=Path)
    parser.add_argument('--output',default=PROJECT/'src/assets/gtnh',type=Path)
    args=parser.parse_args()
    Importer(args.instance,args.vanilla,args.output).run()
