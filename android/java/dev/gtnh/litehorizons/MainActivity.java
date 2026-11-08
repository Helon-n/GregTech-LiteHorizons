package dev.gtnh.litehorizons;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.content.pm.ApplicationInfo;
import android.util.Log;
import android.webkit.*;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final String TAG="GTLHWebView";
    private static final String HOST="appassets.androidplatform.net";
    private static final String HOME="https://"+HOST+"/assets/index.html";
    private static final int EXPORT=1, IMPORT=2;
    private static final int MAX_SAVE=5_000_000;
    private WebView web;
    private String requestId, exportText;
    private boolean foreground, ready, fileBusy;
    private volatile String startupError;
    private boolean startupAlert;
    private final ExecutorService io=Executors.newSingleThreadExecutor();

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        // Browser profile lives in the application's private directory, separate from Windows saves.
        web=new WebView(this);FrameLayout frame=new FrameLayout(this);
        frame.addView(web,new FrameLayout.LayoutParams(-1,-1));setContentView(frame);
        if(android.os.Build.VERSION.SDK_INT>=28)frame.setOnApplyWindowInsetsListener((view,insets)->{
            android.view.DisplayCutout cutout=insets.getDisplayCutout();
            if(cutout==null)view.setPadding(0,0,0,0);
            else view.setPadding(cutout.getSafeInsetLeft(),cutout.getSafeInsetTop(),cutout.getSafeInsetRight(),cutout.getSafeInsetBottom());
            return insets;
        });
        WebSettings settings=web.getSettings();
        settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);settings.setTextZoom(100);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setHorizontalScrollBarEnabled(false);web.setVerticalScrollBarEnabled(false);
        web.addJavascriptInterface(new Bridge(),"GTLHAndroid");
        web.setWebViewClient(new WebViewClient(){
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){ready=false;startupError=null;startupAlert=false;}
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){return resource(request.getUrl());}
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return !trusted(request.getUrl());}
            @Override public void onPageFinished(WebView view,String url){
                if(!HOME.equals(url))return;
                web.evaluateJavascript("typeof window.gtlhBack==='function' && document.getElementById('page').children.length>0",loaded->{
                    if(isFinishing()||isDestroyed())return;
                    ready="true".equals(loaded);
                    if(!ready){showStartupError();return;}
                    web.evaluateJavascript("window.gtlhLifecycle("+!foreground+")",r->{if(!foreground&&!isDestroyed()){web.onPause();web.pauseTimers();}});
                });
            }
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){
                if(!ready)startupError=error.getDescription().toString()+"\n"+request.getUrl().getPath();
                if(request.isForMainFrame())showStartupError();
            }
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public void onProgressChanged(WebView view,int progress){if(progress==100)immersive();}
            @Override public boolean onConsoleMessage(ConsoleMessage message){
                if(message.messageLevel()==ConsoleMessage.MessageLevel.ERROR){
                    if(!ready&&startupError==null)startupError=message.message()+"\n"+Uri.parse(message.sourceId()).getPath()+":"+message.lineNumber();
                    Log.e(TAG,message.message()+" ("+message.sourceId()+":"+message.lineNumber()+")");
                }
                return true;
            }
        });
        WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags&ApplicationInfo.FLAG_DEBUGGABLE)!=0);
        immersive();web.loadUrl(HOME);
    }
    private boolean trusted(Uri uri){return "https".equals(uri.getScheme())&&HOST.equals(uri.getHost())&&(uri.getPort()==-1||uri.getPort()==443)&&uri.getPath()!=null&&uri.getPath().startsWith("/assets/");}
    private WebResourceResponse resource(Uri uri){
        if(!trusted(uri))return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
        String path=uri.getPath().substring(8);
        if(path.contains("..")||path.contains("\\")||path.indexOf('\0')>=0)return new WebResourceResponse("text/plain","UTF-8",null);
        String ext=path.substring(path.lastIndexOf('.')+1).toLowerCase(Locale.ROOT),mime;
        switch(ext){case "js":case "mjs":mime="text/javascript";break;case "html":mime="text/html";break;
            case "css":mime="text/css";break;case "json":mime="application/json";break;
            case "svg":mime="image/svg+xml";break;case "woff2":mime="font/woff2";break;default:mime="application/octet-stream";}
        Map<String,String> headers=new HashMap<>();headers.put("Cache-Control","no-cache");headers.put("X-Content-Type-Options","nosniff");
        try{return new WebResourceResponse(mime,"UTF-8",200,"OK",headers,getAssets().open(path));}
        catch(IOException error){if(!ready&&startupError==null)startupError="无法读取本地文件："+path;Log.e(TAG,"Asset could not be opened: "+path,error);return new WebResourceResponse("text/plain","UTF-8",404,"Not found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
    }
    private void showStartupError(){
        if(startupAlert||isFinishing()||isDestroyed())return;startupAlert=true;
        String detail=startupError==null?"游戏脚本未完成加载。":startupError;
        if(detail.length()>700)detail=detail.substring(0,700);
        new AlertDialog.Builder(this).setTitle("游戏未能启动")
            .setMessage("请重试；若仍失败，请更新 Android System WebView。\n\n"+detail)
            .setPositiveButton("重试",(d,w)->web.reload()).setNegativeButton("关闭",(d,w)->finish()).setCancelable(false).show();
    }
    private void immersive(){
        if(android.os.Build.VERSION.SDK_INT>=28){WindowManager.LayoutParams attrs=getWindow().getAttributes();attrs.layoutInDisplayCutoutMode=WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;getWindow().setAttributes(attrs);}
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }
    @Override protected void onResume(){super.onResume();foreground=true;if(web!=null){web.onResume();web.resumeTimers();if(ready)web.evaluateJavascript("window.gtlhLifecycle?.(false)",null);immersive();}}
    @Override protected void onPause(){foreground=false;if(web!=null&&ready)web.evaluateJavascript("window.gtlhLifecycle?.(true)",r->{if(!foreground&&!isDestroyed()){web.onPause();web.pauseTimers();}});super.onPause();}
    @Override public void onWindowFocusChanged(boolean focus){super.onWindowFocusChanged(focus);if(focus)immersive();}
    @Override public void onBackPressed(){
        if(!ready){finish();return;}
        web.evaluateJavascript("window.gtlhBack?.()",handled->{if(!"true".equals(handled))new AlertDialog.Builder(this)
            .setTitle("退出游戏？").setMessage("当前进度已保存。").setNegativeButton("继续",null)
            .setPositiveButton("退出",(d,w)->finish()).show();});
    }
    @Override protected void onDestroy(){if(web!=null){web.removeJavascriptInterface("GTLHAndroid");web.destroy();}io.shutdown();super.onDestroy();}
    private final class Bridge {
        @JavascriptInterface public void request(String json){
            if(json.length()>MAX_SAVE*2+8192)return;
            runOnUiThread(()->{
                if(!ready||!trusted(Uri.parse(web.getUrl())))return;
                String id="";
                try{
                    JSONObject req=new JSONObject(json);id=req.getString("id");
                    if(fileBusy)throw new IOException("请先完成当前文件操作");
                    String action=req.getString("action");
                    if("export".equals(action)){
                        String text=req.getString("text");if(text.getBytes(StandardCharsets.UTF_8).length>MAX_SAVE)throw new IOException("存档文件过大");
                        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json");
                        intent.putExtra(Intent.EXTRA_TITLE,req.optString("filename","GregTech-LiteHorizons.json").replaceAll("[^a-zA-Z0-9._-]","_"));
                        requestId=id;exportText=text;fileBusy=true;startActivityForResult(intent,EXPORT);
                    }else if("import".equals(action)){
                        Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                        requestId=id;fileBusy=true;startActivityForResult(intent,IMPORT);
                    }else throw new IOException("未知文件操作");
                }catch(Exception error){if(id.equals(requestId)){fileBusy=false;requestId=null;exportText=null;}reply(id,error(error));}
            });
        }
    }
    private JSONObject error(Exception error){JSONObject result=new JSONObject();try{result.put("error",error.getMessage()==null?"文件操作失败":error.getMessage());}catch(Exception ignored){}return result;}
    private void reply(String id,JSONObject result){runOnUiThread(()->{if(!isFinishing()&&!isDestroyed())web.evaluateJavascript("window.gtlhNativeResult?.("+JSONObject.quote(id)+","+result+")",null);});}
    @Override protected void onActivityResult(int code,int result,Intent data){
        super.onActivityResult(code,result,data);if(code!=EXPORT&&code!=IMPORT)return;
        final String id=requestId,text=exportText;requestId=null;exportText=null;
        if(result!=RESULT_OK||data==null||data.getData()==null){fileBusy=false;try{reply(id,new JSONObject().put("cancelled",true));}catch(Exception ignored){}return;}
        final Uri uri=data.getData();
        io.execute(()->{
            JSONObject response=new JSONObject();
            try{
                if(code==EXPORT){try(OutputStream stream=getContentResolver().openOutputStream(uri,"wt")){if(stream==null)throw new IOException("无法写入文件");stream.write(text.getBytes(StandardCharsets.UTF_8));stream.flush();}response.put("saved",true);}
                else{try(InputStream stream=getContentResolver().openInputStream(uri);ByteArrayOutputStream bytes=new ByteArrayOutputStream()){
                    if(stream==null)throw new IOException("无法读取文件");byte[] buffer=new byte[16384];int count;
                    while((count=stream.read(buffer))!=-1){if(bytes.size()+count>MAX_SAVE)throw new IOException("存档文件过大");bytes.write(buffer,0,count);}
                    response.put("text",bytes.toString("UTF-8"));
                }}
            }catch(Exception exception){response=error(exception);}
            JSONObject completed=response;runOnUiThread(()->{fileBusy=false;reply(id,completed);});
        });
    }
}
