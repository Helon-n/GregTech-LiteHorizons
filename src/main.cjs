const { app, BrowserWindow } = require('electron');
const path = require('node:path');
function createWindow() {
  const win=new BrowserWindow({width:1440,height:960,minWidth:1040,minHeight:720,show:!isTest,backgroundColor:'#101512',title:'GregTech-LiteHorizons',icon:path.join(__dirname,'assets','app-icon.png'),autoHideMenuBar:true,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:!isTest}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',event=>event.preventDefault());
  win.loadFile(path.join(__dirname,'index.html'));
}
app.setName('GregTech-LiteHorizons');
const isTest=process.env.GTNH_TEST_DATA;
// Keep existing saves and Chromium storage after the display name changes.
app.setPath('userData',isTest?path.resolve(isTest):path.join(app.getPath('appData'),'GTNH Idle'));
app.whenReady().then(()=>{createWindow();app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)createWindow();});});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
