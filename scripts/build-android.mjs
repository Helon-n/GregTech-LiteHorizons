import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {build as bundle} from 'esbuild';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const diagnostic=process.argv.includes('--debug-webview');
const sdk=path.resolve(process.env.ANDROID_SDK_ROOT||process.env.ANDROID_HOME||'.local/android-sdk');
const javaHome=process.env.JAVA_HOME;
if(!javaHome)throw Error('设置 JAVA_HOME 指向 JDK 17，再运行构建。');
const java=name=>path.join(javaHome,'bin',name+(process.platform==='win32'?'.exe':''));
const bt=path.join(sdk,'build-tools','35.0.0');
const tool=name=>path.join(bt,name+(process.platform==='win32'?'.exe':''));
const androidJar=path.join(sdk,'platforms','android-35','android.jar');
await fs.access(androidJar).catch(()=>{throw Error('缺少 Android SDK 35。安装 platforms;android-35 和 build-tools;35.0.0。');});
const build=path.join(root,'android/build'),assets=path.join(build,'assets');
// Only generated build files are removed. Signing keys and real saves are never touched.
await fs.rm(build,{recursive:true,force:true});
for(const dir of [assets,path.join(build,'classes'),path.join(build,'dex')])await fs.mkdir(dir,{recursive:true});
await fs.cp('src',assets,{recursive:true,filter:source=>!['main.cjs','app-icon.ico'].includes(path.basename(source))});
await bundle({entryPoints:['src/recipe-tree-worker.js'],bundle:true,format:'iife',platform:'browser',target:'chrome89',minify:true,outfile:path.join(assets,'recipe-tree-worker.android.js')});
const manifest=JSON.parse(await fs.readFile('package.json','utf8'));
const [major,minor,patch]=manifest.version.split('.').map(Number),versionCode=major*1000000+minor*10000+patch*10;
const run=(cmd,args)=>{
  const result=spawnSync(cmd,args,{cwd:root,stdio:'inherit',env:process.env});
  if(result.error)throw result.error;
  if(result.status!==0)throw Error(`${path.basename(cmd)} 退出码 ${result.status}`);
};
run(tool('aapt2'),['compile','--dir','android/res','-o',path.join(build,'resources.zip')]);
const linked=path.join(build,'linked.apk'),unsigned=path.join(build,'unsigned.apk');
run(tool('aapt2'),['link',...(diagnostic?['--debug-mode']:[]),'-I',androidJar,'--manifest','android/AndroidManifest.xml','--min-sdk-version','26','--target-sdk-version','35','--version-code',String(versionCode),'--version-name',manifest.version,'-o',linked,path.join(build,'resources.zip')]);
const source='android/java/dev/gtnh/litehorizons/MainActivity.java';
run(java('javac'),['-encoding','UTF-8','--release','8','-classpath',androidJar,'-d',path.join(build,'classes'),source]);
const classes=[];
async function scan(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())await scan(file);else if(file.endsWith('.class'))classes.push(file);}}
await scan(path.join(build,'classes'));
run(java('java'),['-cp',path.join(bt,'lib','d8.jar'),'com.android.tools.r8.D8','--lib',androidJar,'--min-api','26','--output',path.join(build,'dex'),...classes]);
// aapt2 -A on Windows writes backslashes into nested ZIP names. Android cannot
// open those assets, even though some desktop ZIP readers normalize the names.
run(java('java'),['--source','17','scripts/android/PackageApk.java',linked,assets,path.join(build,'dex/classes.dex'),unsigned]);
const aligned=path.join(build,'aligned.apk');run(tool('zipalign'),['-f','4',unsigned,aligned]);
const key=path.join(root,'.local/android-signing/preview.keystore');await fs.mkdir(path.dirname(key),{recursive:true});
try{await fs.access(key);}catch{
  run(java('keytool'),['-genkeypair','-keystore',key,'-storepass','android','-keypass','android','-alias','androiddebugkey','-dname','CN=Android Debug,O=Android,C=US','-keyalg','RSA','-keysize','2048','-validity','10000']);
}
const output=diagnostic?'.local/android-diagnostics':'release/android';
await fs.mkdir(output,{recursive:true});
const apk=path.resolve(`${output}/GregTech-LiteHorizons-${manifest.version}-Android.apk`);
const signer=['-jar',path.join(bt,'lib/apksigner.jar')];
run(java('java'),[...signer,'sign','--ks',key,'--ks-key-alias','androiddebugkey','--ks-pass','pass:android','--key-pass','pass:android','--v4-signing-enabled','false','--out',apk,aligned]);
await fs.rm(apk+'.idsig',{force:true});
run(java('java'),[...signer,'verify','--verbose',apk]);
run(tool('zipalign'),['-c','4',apk]);
const hash=createHash('sha256').update(await fs.readFile(apk)).digest('hex');
await fs.writeFile(path.join(output,'SHA256SUMS.txt'),`${hash}  ${path.basename(apk)}\n`);
console.log(`APK: ${apk}\n签名：本机开发测试密钥，保存在 .local/android-signing/（不提交）。`);
