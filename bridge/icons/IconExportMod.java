package dev.gtnhidle;

import cpw.mods.fml.common.Mod;
import cpw.mods.fml.common.FMLCommonHandler;
import cpw.mods.fml.common.event.FMLLoadCompleteEvent;
import cpw.mods.fml.common.eventhandler.SubscribeEvent;
import cpw.mods.fml.common.gameevent.TickEvent;
import cpw.mods.fml.common.registry.GameRegistry;
import com.google.gson.*;
import java.io.*;
import java.lang.reflect.*;
import java.nio.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import static org.lwjgl.opengl.GL11.*;
import static org.lwjgl.opengl.GL30.*;

/** Development-only exporter. Run only in the isolated directory prepared by the script. */
@Mod(modid="litehorizonsicons",name="LiteHorizons Icon Export",version="1.0",dependencies="required-after:gregtech")
public class IconExportMod {
    private boolean ready,done; private int index,delay=100; private JsonArray tasks,results=new JsonArray();
    private Object mc,renderer,font,texture,camera; private int fbo,color,depth;
    private static Object field(Object o,String...names)throws Exception {
        Class<?> c=o instanceof Class?(Class<?>)o:o.getClass();
        for(String n:names)for(Class<?> t=c;t!=null;t=t.getSuperclass())try{Field f=t.getDeclaredField(n);f.setAccessible(true);return f.get(o instanceof Class?null:o);}catch(NoSuchFieldException ignored){}
        throw new NoSuchFieldException(java.util.Arrays.toString(names));
    }
    private static Object call(Object o,String names,Object...args)throws Exception {
        Class<?> c=o instanceof Class?(Class<?>)o:o.getClass();
        for(String name:names.split("/"))for(Method m:c.getMethods())if(m.getName().equals(name)&&m.getParameterTypes().length==args.length){
            try{return m.invoke(o instanceof Class?null:o,args);}catch(IllegalArgumentException ignored){}
        }
        throw new NoSuchMethodException(c+"."+names);
    }
    private static void set(Object o,Object value,String...names)throws Exception {
        for(String n:names)for(Class<?> c=o.getClass();c!=null;c=c.getSuperclass())try{Field f=c.getDeclaredField(n);f.setAccessible(true);f.set(o,value);return;}catch(NoSuchFieldException ignored){}
        throw new NoSuchFieldException(java.util.Arrays.toString(names));
    }
    @Mod.EventHandler public void loaded(FMLLoadCompleteEvent e)throws Exception {
        tasks=new JsonParser().parse(new String(Files.readAllBytes(Paths.get("icon-tasks.json")),StandardCharsets.UTF_8)).getAsJsonArray();
        JsonArray machines=new JsonArray();Object entries=field(Class.forName("gregtech.api.GregTechAPI"),"METATILEENTITIES");
        for(int i=0;i<Array.getLength(entries);i++){Object m=Array.get(entries,i);if(m!=null){JsonObject r=new JsonObject();r.addProperty("meta",i);r.addProperty("class",m.getClass().getName());r.addProperty("name",String.valueOf(field(m,"mName")));machines.add(r);}}
        Files.write(Paths.get("machine-registry.json"),new GsonBuilder().setPrettyPrinting().create().toJson(machines).getBytes(StandardCharsets.UTF_8));
        JsonArray subtypes=new JsonArray();java.util.Set<String> seen=new java.util.HashSet<String>();
        for(JsonElement element:tasks)try {
            String registry=element.getAsJsonObject().get("registry").getAsString();if(!seen.add(registry))continue;int sep=registry.indexOf(':');
            Object item=call(GameRegistry.class,"findItem",registry.substring(0,sep),registry.substring(sep+1));if(item==null)continue;
            java.util.List<Object> stacks=new java.util.ArrayList<Object>();call(item,"getSubItems/func_150895_a",item,null,stacks);
            JsonObject row=new JsonObject();row.addProperty("registry",registry);JsonArray values=new JsonArray();
            for(Object stack:stacks){JsonObject v=new JsonObject();v.addProperty("meta",((Number)call(stack,"getItemDamage/func_77960_j")).intValue());v.addProperty("name",String.valueOf(call(stack,"getDisplayName/func_82833_r")));values.add(v);}row.add("values",values);subtypes.add(row);
        }catch(Throwable ignored){}
        Files.write(Paths.get("item-subtypes.json"),new GsonBuilder().setPrettyPrinting().create().toJson(subtypes).getBytes(StandardCharsets.UTF_8));
        Object registry=field(Class.forName("net.minecraft.item.Item"),"itemRegistry","field_150901_e");Files.write(Paths.get("item-keys.json"),new Gson().toJson(call(registry,"getKeys/func_148742_b")).getBytes(StandardCharsets.UTF_8));
        FMLCommonHandler.instance().bus().register(this); ready=true;
    }
    private void init()throws Exception {
        mc=call(Class.forName("net.minecraft.client.Minecraft"),"getMinecraft/func_71410_x");
        font=field(mc,"fontRenderer","field_71466_p"); texture=call(mc,"getTextureManager/func_110434_K");
        renderer=Class.forName("net.minecraft.client.renderer.entity.RenderItem").newInstance();
        Object renderManager=field(Class.forName("net.minecraft.client.renderer.entity.RenderManager"),"instance","field_78727_a");set(renderManager,texture,"renderEngine","field_78724_e");
        // Some inventory renderers ask the camera entity for brightness even at the main menu.
        Class<?> ws=Class.forName("net.minecraft.world.WorldSettings"),gt=Class.forName("net.minecraft.world.WorldSettings$GameType"),difficulty=Class.forName("net.minecraft.world.EnumDifficulty");
        Object settings=ws.getConstructor(long.class,gt,boolean.class,boolean.class,Class.forName("net.minecraft.world.WorldType")).newInstance(0L,gt.getEnumConstants()[0],false,false,field(Class.forName("net.minecraft.world.WorldType"),"DEFAULT","field_77137_b"));
        Object profile=Class.forName("com.mojang.authlib.GameProfile").getConstructor(java.util.UUID.class,String.class).newInstance(new java.util.UUID(0,1),"IconAudit");
        Constructor<?> hc=Class.forName("net.minecraft.client.network.NetHandlerPlayClient").getConstructors()[0];Object[] ha=new Object[hc.getParameterCount()];for(int i=0;i<ha.length;i++){String name=hc.getParameterTypes()[i].getName();ha[i]=name.endsWith("Minecraft")?mc:name.endsWith("GameProfile")?profile:null;}
        Object handler=hc.newInstance(ha);
        Object world=Class.forName("net.minecraft.client.multiplayer.WorldClient").getConstructors()[0].newInstance(handler,settings,0,difficulty.getEnumConstants()[0],field(mc,"mcProfiler","field_71424_I"));
        Constructor<?> pc=Class.forName("net.minecraft.client.entity.EntityClientPlayerMP").getConstructors()[0];Object[] pa=new Object[pc.getParameterCount()];for(int i=0;i<pa.length;i++){String name=pc.getParameterTypes()[i].getName();pa[i]=name.endsWith("Minecraft")?mc:name.endsWith("World")?world:name.endsWith("NetHandlerPlayClient")?handler:name.endsWith("Session")?call(mc,"getSession/func_110432_I"):name.endsWith("StatFileWriter")?Class.forName(name).newInstance():null;}
        camera=pc.newInstance(pa);
        fbo=glGenFramebuffers();glBindFramebuffer(GL_FRAMEBUFFER,fbo);
        color=glGenTextures();glBindTexture(GL_TEXTURE_2D,color);
        glTexImage2D(GL_TEXTURE_2D,0,GL_RGBA8,64,64,0,GL_RGBA,GL_UNSIGNED_BYTE,(ByteBuffer)null);
        glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_NEAREST);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_NEAREST);
        glFramebufferTexture2D(GL_FRAMEBUFFER,GL_COLOR_ATTACHMENT0,GL_TEXTURE_2D,color,0);
        depth=glGenRenderbuffers();glBindRenderbuffer(GL_RENDERBUFFER,depth);glRenderbufferStorage(GL_RENDERBUFFER,GL_DEPTH_COMPONENT24,64,64);
        glFramebufferRenderbuffer(GL_FRAMEBUFFER,GL_DEPTH_ATTACHMENT,GL_RENDERBUFFER,depth);
        if(glCheckFramebufferStatus(GL_FRAMEBUFFER)!=GL_FRAMEBUFFER_COMPLETE)throw new IOException("Incomplete framebuffer");
        glBindFramebuffer(GL_FRAMEBUFFER,0);Files.createDirectories(Paths.get("icon-renders"));
    }
    @SubscribeEvent public void render(TickEvent.RenderTickEvent e) {
        if(!ready||done||e.phase!=TickEvent.Phase.END||delay-->0)return;
        try {
            if(mc==null)init();
            for(int n=0;n<8&&index<tasks.size();n++,index++) {
                JsonObject task=tasks.get(index).getAsJsonObject(),row=task.deepCopy();
                try{renderOne(task,row);row.addProperty("ok",true);}catch(Throwable ex){row.addProperty("error",ex.toString());ex.printStackTrace();try{Object tess=field(Class.forName("net.minecraft.client.renderer.Tessellator"),"instance","field_78398_a");set(tess,false,"isDrawing","field_78415_z");}catch(Exception ignored){}}
                results.add(row);
            }
            Files.write(Paths.get("icon-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results).getBytes(StandardCharsets.UTF_8));
            if(index%80==0)System.out.println("[Icon Export] "+index+"/"+tasks.size());
            if(index>=tasks.size()) {
                Files.write(Paths.get("icon-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results).getBytes(StandardCharsets.UTF_8));
                done=true;System.out.println("[Icon Export] Complete "+index);call(mc,"shutdown/func_71400_g");
            }
        }catch(Throwable ex){ex.printStackTrace();done=true;try{Files.write(Paths.get("icon-fatal.txt"),ex.toString().getBytes(StandardCharsets.UTF_8));call(mc,"shutdown/func_71400_g");}catch(Exception ignored){}}
    }
    private void renderOne(JsonObject t,JsonObject row)throws Exception {
        String registry=t.get("registry").getAsString();int sep=registry.indexOf(':');
        Object item=call(GameRegistry.class,"findItem",registry.substring(0,sep),registry.substring(sep+1));
        Object stack;
        if(t.has("fieldClass")){
            Object block=field(Class.forName(t.get("fieldClass").getAsString()),t.get("fieldName").getAsString());
            item=call(Class.forName("net.minecraft.item.Item"),"getItemFromBlock/func_150898_a",block);
        }
        if(t.has("trackEnum")){
            Object track=Enum.valueOf((Class)Class.forName("mods.railcraft.common.blocks.tracks.EnumTrack"),t.get("trackEnum").getAsString());stack=call(track,"getItem");item=call(stack,"getItem/func_77973_b");
        }else{
            if(item==null)throw new IOException("Unregistered item "+registry);
            int meta=t.has("previewMeta")?t.get("previewMeta").getAsInt():t.get("meta").getAsInt();
            stack=Class.forName("net.minecraft.item.ItemStack").getConstructor(Class.forName("net.minecraft.item.Item"),int.class,int.class).newInstance(item,1,meta);
        }
        Object ir=field(Class.forName("net.minecraft.item.Item"),"itemRegistry","field_150901_e");row.addProperty("resolvedRegistry",String.valueOf(call(ir,"getNameForObject/func_148750_c",item)));row.addProperty("resolvedMeta",((Number)call(stack,"getItemDamage/func_77960_j")).intValue());
        row.addProperty("itemClass",item.getClass().getName());
        row.addProperty("displayName",String.valueOf(call(stack,"getDisplayName/func_82833_r")));
        int old=glGetInteger(GL_FRAMEBUFFER_BINDING);
        glPushAttrib(GL_ALL_ATTRIB_BITS);glBindFramebuffer(GL_FRAMEBUFFER,fbo);glViewport(0,0,64,64);
        glMatrixMode(GL_PROJECTION);glPushMatrix();glLoadIdentity();glOrtho(0,32,32,0,-1000,1000);
        glMatrixMode(GL_MODELVIEW);glPushMatrix();glLoadIdentity();glTranslatef(0,0,-100);
        try{
            set(mc,camera,"thePlayer","field_71439_g");set(mc,camera,"renderViewEntity","field_71451_h");
            glClearColor(0,0,0,0);glClear(GL_COLOR_BUFFER_BIT|GL_DEPTH_BUFFER_BIT);glEnable(GL_TEXTURE_2D);glEnable(GL_ALPHA_TEST);glAlphaFunc(GL_GREATER,0.01f);glColor4f(1,1,1,1);
            call(Class.forName("net.minecraft.client.renderer.RenderHelper"),"enableGUIStandardItemLighting/func_74520_c");
            call(renderer,"renderItemAndEffectIntoGUI/func_82406_b",font,texture,stack,8,8);
            glFinish();ByteBuffer pixels=ByteBuffer.allocateDirect(64*64*4);glReadPixels(0,0,64,64,GL_RGBA,GL_UNSIGNED_BYTE,pixels);
            BufferedImage image=new BufferedImage(64,64,BufferedImage.TYPE_INT_ARGB);int visible=0;
            for(int y=0;y<64;y++)for(int x=0;x<64;x++){int p=(x+(63-y)*64)*4;int r=pixels.get(p)&255,g=pixels.get(p+1)&255,b=pixels.get(p+2)&255,a=pixels.get(p+3)&255;if(a>0)visible++;image.setRGB(x,y,(a<<24)|(r<<16)|(g<<8)|b);}
            if(visible==0)throw new IOException("Empty render");row.addProperty("pixels",visible);
            ImageIO.write(image,"png",Paths.get("icon-renders",t.get("key").getAsString()+".png").toFile());
        }finally{set(mc,null,"thePlayer","field_71439_g");set(mc,null,"renderViewEntity","field_71451_h");glMatrixMode(GL_MODELVIEW);glPopMatrix();glMatrixMode(GL_PROJECTION);glPopMatrix();glBindFramebuffer(GL_FRAMEBUFFER,old);glPopAttrib();glMatrixMode(GL_MODELVIEW);}
    }
}
