"""Render real registry/meta icons in a private, offline GTNH client, never the player instance.

Copies configs/scripts/mods only. No saves, launcher accounts, resource packs or options.
All generated client files stay under .local/icon-client. The task input is reviewable JSON.
"""
import json, os, shutil, subprocess, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
INSTANCE=Path('D:/PrismLauncher/instances/GT_New_Horizons_2.9.0_Java_17-26')
LIBS=Path('D:/PrismLauncher/libraries')
JAVA=Path('D:/java_jdk/jdk25/bin')
CLIENT=ROOT/'.local/icon-client'

def coordinate(name):
    group,artifact,version,*classifier=name.split(':')
    return Path(group.replace('.','/'))/artifact/version/(artifact+'-'+version+('-'+classifier[0] if classifier else '')+'.jar')

def prepare():
    CLIENT.mkdir(parents=True,exist_ok=True)
    for folder in ['mods','config','scripts']:
        source=INSTANCE/'.minecraft'/folder
        if source.exists() and not (CLIENT/folder).exists():shutil.copytree(source,CLIENT/folder)
    (CLIENT/'options.txt').write_text('resourcePacks:[]\nlang:zh_CN\nmipmapLevels:0\nanaglyph3d:false\n',encoding='utf-8')
    patches=sorted((json.loads(p.read_text(encoding='utf-8')) for p in (INSTANCE/'patches').glob('*.json')),key=lambda p:p.get('order',0))
    libs={};jvm=[];tweakers=[]
    for patch in patches:
        jvm+=patch.get('+jvmArgs',[]);tweakers+=patch.get('+tweakers',[])
        for lib in patch.get('libraries',[]):
            name=lib['name']
            if lib.get('natives') and not lib.get('downloads',{}).get('artifact'):continue
            if lib.get('rules') and not any(r.get('action')=='allow' and r.get('os',{}).get('name','windows')=='windows' for r in lib['rules']):continue
            if 'natives-' in name and ('natives-windows:' not in name):continue
            local=INSTANCE/'libraries'/coordinate(name).name
            file=local if local.exists() else LIBS/coordinate(name)
            libs[':'.join(name.split(':')[:2])]=file
        if 'mainJar' in patch:libs['minecraft']=LIBS/coordinate(patch['mainJar']['name'])
    cp=list(libs.values())
    for file in cp:
        if not file.exists():raise FileNotFoundError(file)
    forge=next(p for p in cp if p.name.startswith('forge-'))
    gson=next(p for p in cp if p.name.startswith('gson-'))
    gl=next(p for p in cp if p.name.startswith('lwjgl-opengl-') and 'natives' not in p.name)
    classes=ROOT/'.local/icon-export-classes';classes.mkdir(exist_ok=True)
    subprocess.run([str(JAVA/'javac.exe'),'--release','8','-encoding','UTF-8','-cp',os.pathsep.join(map(str,[forge,gson,gl])),'-d',str(classes),str(ROOT/'bridge/icons/IconExportMod.java')],check=True)
    subprocess.run([str(JAVA/'jar.exe'),'cf',str(CLIENT/'mods/litehorizons-icons.jar'),'-C',str(classes),'dev'],check=True)
    args=['-Xms1G','-Xmx7G','-Duser.language=en','-Duser.country=US',*jvm,'-cp',os.pathsep.join(map(str,cp)),'com.gtnewhorizons.retrofuturabootstrap.MainStartOnFirstThread',
          '--username','IconAudit','--version','1.7.10','--gameDir',str(CLIENT),'--assetsDir','D:/PrismLauncher/assets','--assetIndex','1.7.10','--uuid','00000000000000000000000000000001','--accessToken','0','--userProperties','{}','--userType','legacy','--width','800','--height','600']
    for t in tweakers:args+=['--tweakClass',t]
    # Java argfile quotes preserve Windows paths and classpath without shell interpretation.
    (CLIENT/'launch.args').write_text('\n'.join('"'+a.replace('\\','/').replace('"','\\"')+'"' for a in args),encoding='utf-8')
    print('Prepared isolated client:',CLIENT,flush=True)

if __name__=='__main__':
    prepare()
    if '--run' in sys.argv:
        (CLIENT/'icon-fatal.txt').unlink(missing_ok=True)
        with (CLIENT/'export.log').open('w',encoding='utf-8') as log:
            result=subprocess.run([str(JAVA/'java.exe'),'@launch.args'],cwd=CLIENT,stdout=log,stderr=subprocess.STDOUT,timeout=1200)
        print('Client exit:',result.returncode)
