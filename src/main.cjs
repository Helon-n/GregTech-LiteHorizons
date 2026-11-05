const { app, BrowserWindow } = require('electron');
const path = require('node:path');
function createWindow() {
  const win=new BrowserWindow({width:1440,height:960,minWidth:1040,minHeight:720,backgroundColor:'#101512',title:'格雷的长路 · GTNH Idle',icon:path.join(__dirname,'assets','app-icon.png'),autoHideMenuBar:true,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',event=>event.preventDefault());
  win.loadFile(path.join(__dirname,'index.html'));
}
app.setName('GTNH Idle');
const isTest=process.env.GTNH_TEST_DATA;
if(isTest)app.setPath('userData',path.resolve(isTest));
app.whenReady().then(()=>{createWindow();app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)createWindow();});});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
