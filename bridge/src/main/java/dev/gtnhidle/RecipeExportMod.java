package dev.gtnhidle;

import cpw.mods.fml.common.Mod;
import cpw.mods.fml.common.event.FMLLoadCompleteEvent;
import java.io.*;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** Read-only runtime export. Uses SRG/mapped reflection to avoid patched MC dependencies. */
@Mod(modid="gtnhidleexport", name="GTNH Idle Recipe Export", version="0.1.0", dependencies="required-after:gregtech", acceptableRemoteVersions="*")
public final class RecipeExportMod {
    private static final List<String> errors = new ArrayList<String>();

    @Mod.EventHandler
    public void loaded(FMLLoadCompleteEvent event) {
        try {
            Path dir=Paths.get("config","gtnh-idle-export");
            Files.createDirectories(dir);
            Path target=dir.resolve("recipes.json"), temp=dir.resolve("recipes.json.tmp");
            int count=0;
            try(BufferedWriter out=Files.newBufferedWriter(temp,StandardCharsets.UTF_8)) {
                errors.clear();
                out.write("{\"schema\":2,\"source\":\"GTNH runtime registry\",\"exporter\":\"0.1.0\",\"recipes\":[");
                Class<?> mapClass=Class.forName("gregtech.api.recipe.RecipeMap");
                Map<?,?> maps=(Map<?,?>)mapClass.getField("ALL_RECIPE_MAPS").get(null);
                List<Map.Entry<?,?>> entries=new ArrayList<Map.Entry<?,?>>(maps.entrySet());
                Collections.sort(entries,new Comparator<Map.Entry<?,?>>() {public int compare(Map.Entry<?,?> a,Map.Entry<?,?> b){return a.getKey().toString().compareTo(b.getKey().toString());}});
                for(Map.Entry<?,?> entry:entries) {
                    Collection<?> recipes=(Collection<?>)mapClass.getMethod("getAllRecipes").invoke(entry.getValue());
                    int index=0;
                    for(Object recipe:recipes) {
                        try {
                            Map<String,Object> data=machineRecipe(recipe,String.valueOf(entry.getKey()),index++);
                            if(count++>0)out.write(',');out.write(json(data));
                        }catch(Exception ex){errors.add(entry.getKey()+": "+ex.toString());}
                    }
                }
                try {
                    Class<?> type=Class.forName("gregtech.api.util.GTRecipe$RecipeAssemblyLine");
                    Collection<?> assembly=(Collection<?>)type.getField("sAssemblylineRecipes").get(null);
                    int index=0;
                    for(Object recipe:assembly) {
                        Map<String,Object> data=machineRecipe(recipe,"assembly_line",index++);
                        data.put("outputs",Collections.singletonList(stack(field(recipe,"mOutput"))));
                        data.put("researchItem",stack(field(recipe,"mResearchItem")));
                        data.put("researchTime",field(recipe,"mResearchTime"));
                        data.put("researchVoltage",field(recipe,"mResearchVoltage"));
                        data.put("inputAlternatives",stackArrays(field(recipe,"mOreDictAlt")));
                        if(count++>0)out.write(',');out.write(json(data));
                    }
                }catch(Exception ex){errors.add("assembly_line: "+ex.toString());}
                out.write("],\"crafting\":"+json(craftingRecipes())+",\"furnace\":"+json(furnaceRecipes()));
                out.write(",\"count\":"+count+",\"errors\":"+json(errors)+",\"limitations\":[\"Includes GT RecipeMaps, assembly lines, CraftingManager and FurnaceRecipes; independent addon registries may remain.\",\"Special values, metadata and NBT require an explicit gameplay implementation; exporting does not enable a recipe.\",\"Unknown custom ingredient or metadata types retain their Java class and description.\",\"Names follow the active game language.\"]}");
            }
            Files.move(temp,target,StandardCopyOption.REPLACE_EXISTING);
            System.out.println("[GTNH Idle Export] Exported "+count+" recipes to "+target.toAbsolutePath()+" ("+errors.size()+" errors)");
        }catch(Exception ex){ex.printStackTrace();}
    }

    private static Map<String,Object> machineRecipe(Object r,String map,int index)throws Exception {
        Map<String,Object> data=new LinkedHashMap<String,Object>();
        data.put("map",map);data.put("index",index);
        data.put("inputs",stacks(field(r,"mInputs")));
        data.put("outputs",stacks(field(r,"mOutputs")));
        data.put("fluidInputs",fluids(field(r,"mFluidInputs")));
        data.put("fluidOutputs",fluids(field(r,"mFluidOutputs")));
        data.put("duration",field(r,"mDuration"));data.put("eut",field(r,"mEUt"));
        data.put("special",field(r,"mSpecialValue"));data.put("enabled",field(r,"mEnabled"));
        data.put("fake",field(r,"mFakeRecipe"));data.put("hidden",field(r,"mHidden"));
        data.put("inputChances",array(field(r,"mInputChances")));
        data.put("outputChances",array(field(r,"mOutputChances")));
        data.put("fluidInputChances",array(field(r,"mFluidInputChances")));
        data.put("fluidOutputChances",array(field(r,"mFluidOutputChances")));
        data.put("metadata",metadata(r));
        Object special=field(r,"mSpecialItems");if(special!=null)data.put("specialItemDescription",String.valueOf(special));
        return data;
    }
    private static List<Object> metadata(Object recipe) {
        List<Object> result=new ArrayList<Object>();
        Object storage=call(recipe,"getMetadataStorage"), entries=call(storage,"getEntries");
        if(entries instanceof Iterable)for(Object entry:(Iterable<?>)entries) {
            Map.Entry<?,?> pair=(Map.Entry<?,?>)entry;
            Map<String,Object> row=new LinkedHashMap<String,Object>();
            row.put("key",String.valueOf(pair.getKey()));
            row.put("identifier",field(pair.getKey(),"identifier"));
            row.put("value",referenceValue(pair.getValue(),0));result.add(row);
        }
        Collections.sort(result,new Comparator<Object>(){public int compare(Object a,Object b){return json(a).compareTo(json(b));}});
        return result;
    }
    private static Object referenceValue(Object value,int depth) {
        if(value==null||value instanceof Number||value instanceof Boolean||value instanceof String)return value;
        if(value instanceof Enum)return ((Enum<?>)value).name();
        if(depth>6)return String.valueOf(value);
        if(value.getClass().isArray()){List<Object> result=new ArrayList<Object>();for(Object v:array(value))result.add(referenceValue(v,depth+1));return result;}
        if(value instanceof Iterable){List<Object> result=new ArrayList<Object>();for(Object v:(Iterable<?>)value)result.add(referenceValue(v,depth+1));return result;}
        if(value instanceof Map){Map<String,Object> result=new LinkedHashMap<String,Object>();for(Map.Entry<?,?> e:((Map<?,?>)value).entrySet())result.put(String.valueOf(e.getKey()),referenceValue(e.getValue(),depth+1));return result;}
        try{if(Class.forName("net.minecraft.item.ItemStack").isInstance(value))return stack(value);}catch(ClassNotFoundException ignored){}
        try{if(Class.forName("net.minecraftforge.fluids.FluidStack").isInstance(value))return fluids(new Object[]{value}).get(0);}catch(ClassNotFoundException ignored){}
        Map<String,Object> result=new LinkedHashMap<String,Object>();result.put("javaType",value.getClass().getName());result.put("description",String.valueOf(value));
        for(String key:new String[]{"mName","time","voltage","tier","duration","eut"}){Object v=field(value,key);if(v instanceof Number||v instanceof String||v instanceof Boolean)result.put(key,v);}
        return result;
    }
    private static List<Object> craftingRecipes() {
        List<Object> result=new ArrayList<Object>();
        try {
            Class<?> type=Class.forName("net.minecraft.item.crafting.CraftingManager");
            Object manager=staticCall(type,"getInstance","func_77594_a");
            Object recipes=call(manager,"getRecipeList","func_77592_b");
            if(!(recipes instanceof Iterable))throw new IllegalStateException("CraftingManager list unavailable");
            int index=0;
            for(Object recipe:(Iterable<?>)recipes)try {
                Map<String,Object> row=new LinkedHashMap<String,Object>();row.put("index",index++);row.put("javaType",recipe.getClass().getName());
                row.put("output",stack(call(recipe,"getRecipeOutput","func_77571_b")));
                Object input=call(recipe,"getInput");
                if(input==null)input=field(recipe,"recipeXY","recipeItems","field_77574_d","field_77579_b","input");
                row.put("inputs",referenceValue(input,0));
                row.put("width",field(recipe,"recipeWidth","field_77576_b","width"));row.put("height",field(recipe,"recipeHeight","field_77577_c","height"));
                row.put("shapeless",recipe.getClass().getName().toLowerCase(Locale.ROOT).contains("shapeless"));
                if(input==null)row.put("dynamic",true);
                result.add(row);
            }catch(Exception ex){errors.add("crafting: "+ex.toString());}
        }catch(Exception ex){errors.add("crafting registry: "+ex.toString());}
        return result;
    }
    private static List<Object> furnaceRecipes() {
        List<Object> result=new ArrayList<Object>();
        try {
            Class<?> type=Class.forName("net.minecraft.item.crafting.FurnaceRecipes");
            Object manager=staticCall(type,"smelting","func_77602_a"), recipes=call(manager,"getSmeltingList","func_77599_b");
            if(!(recipes instanceof Map))throw new IllegalStateException("FurnaceRecipes map unavailable");
            for(Map.Entry<?,?> entry:((Map<?,?>)recipes).entrySet()) {
                Map<String,Object> row=new LinkedHashMap<String,Object>();row.put("input",stack(entry.getKey()));row.put("output",stack(entry.getValue()));result.add(row);
            }
        }catch(Exception ex){errors.add("furnace registry: "+ex.toString());}
        return result;
    }
    private static Object staticCall(Class<?> type,String...names) {
        for(String name:names)try{return type.getMethod(name).invoke(null);}catch(Exception ignored){}
        return null;
    }
    private static Object field(Object o,String...names) {
        if(o==null)return null;
        for(String n:names)for(Class<?> c=o.getClass();c!=null;c=c.getSuperclass())try{Field f=c.getDeclaredField(n);f.setAccessible(true);return f.get(o);}catch(Exception ignored){}
        return null;
    }
    private static Object call(Object o,String...names) {
        if(o==null)return null;
        for(String n:names)try{return o.getClass().getMethod(n).invoke(o);}catch(Exception ignored){}
        return null;
    }
    private static List<Object> array(Object value) {
        List<Object> list=new ArrayList<Object>();if(value!=null&&value.getClass().isArray())for(int i=0;i<Array.getLength(value);i++)list.add(Array.get(value,i));return list;
    }
    private static List<Object> stacks(Object value) {
        List<Object> list=new ArrayList<Object>();for(Object s:array(value))if(s!=null)list.add(stack(s));return list;
    }
    private static List<Object> stackArrays(Object value) {
        List<Object> list=new ArrayList<Object>();for(Object a:array(value))list.add(stacks(a));return list;
    }
    private static Map<String,Object> stack(Object s) {
        Map<String,Object> data=new LinkedHashMap<String,Object>();if(s==null)return data;
        try {
            Object item=call(s,"getItem","func_77973_b");
            Class<?> itemType=Class.forName("net.minecraft.item.Item");
            Object registry=null;for(String n:new String[]{"itemRegistry","field_150901_e"})try{registry=itemType.getField(n).get(null);break;}catch(Exception ignored){}
            Object id=null;if(registry!=null)for(String n:new String[]{"getNameForObject","func_148750_c"})try{id=registry.getClass().getMethod(n,Object.class).invoke(registry,item);break;}catch(Exception ignored){}
            data.put("id",id==null?String.valueOf(item):String.valueOf(id));
            data.put("meta",call(s,"getItemDamage","func_77960_j"));
            data.put("count",field(s,"stackSize","field_77994_a"));
            data.put("name",call(s,"getDisplayName","func_82833_r"));
            Object tag=field(s,"stackTagCompound","field_77990_d");if(tag!=null)data.put("nbt",String.valueOf(tag));
            List<Object> ores=new ArrayList<Object>();
            Class<?> od=Class.forName("net.minecraftforge.oredict.OreDictionary");
            Object ids=od.getMethod("getOreIDs",s.getClass()).invoke(null,s);
            for(Object n:array(ids))ores.add(od.getMethod("getOreName",int.class).invoke(null,n));
            data.put("oreNames",ores);
        }catch(Exception ex){data.put("error",ex.toString());}
        return data;
    }
    private static List<Object> fluids(Object value) {
        List<Object> list=new ArrayList<Object>();
        for(Object s:array(value))if(s!=null){Map<String,Object>d=new LinkedHashMap<String,Object>();Object f=call(s,"getFluid");d.put("id",call(f,"getName"));d.put("name",call(s,"getLocalizedName"));d.put("amount",field(s,"amount"));Object tag=field(s,"tag");if(tag!=null)d.put("nbt",String.valueOf(tag));list.add(d);}return list;
    }
    private static String json(Object value) {
        if(value==null)return"null";if(value instanceof Number||value instanceof Boolean)return String.valueOf(value);
        if(value instanceof Map){StringBuilder b=new StringBuilder("{");boolean first=true;for(Map.Entry<?,?>e:((Map<?,?>)value).entrySet()){if(!first)b.append(',');first=false;b.append(json(String.valueOf(e.getKey()))).append(':').append(json(e.getValue()));}return b.append('}').toString();}
        if(value instanceof Iterable){StringBuilder b=new StringBuilder("[");boolean first=true;for(Object x:(Iterable<?>)value){if(!first)b.append(',');first=false;b.append(json(x));}return b.append(']').toString();}
        String s=String.valueOf(value);StringBuilder b=new StringBuilder("\"");for(int i=0;i<s.length();i++){char c=s.charAt(i);switch(c){case '"':b.append("\\\"");break;case '\\':b.append("\\\\");break;case '\n':b.append("\\n");break;case '\r':b.append("\\r");break;case '\t':b.append("\\t");break;default:if(c<32)b.append(String.format("\\u%04x",(int)c));else b.append(c);}}return b.append('"').toString();
    }
}
