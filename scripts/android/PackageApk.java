import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Stream;
import java.util.zip.*;

/** Assemble the APK using platform-independent ZIP names on every build host. */
class PackageApk {
    private static String zipPath(Path relative) {
        return relative.toString().replace(File.separatorChar, '/');
    }

    private static ZipEntry entry(String name) {
        if(name.indexOf('\\')>=0)throw new IllegalArgumentException("Invalid APK path: "+name);
        ZipEntry result=new ZipEntry(name);
        result.setTime(315532800000L);
        return result;
    }

    private static void addFile(ZipOutputStream out,Path file,String name) throws IOException {
        out.putNextEntry(entry(name));
        Files.copy(file,out);
        out.closeEntry();
    }

    public static void main(String[] args) throws IOException {
        if(args.length!=4)throw new IllegalArgumentException("linked.apk assets classes.dex output.apk");
        Path assets=Path.of(args[1]);
        List<Path> files;
        try(Stream<Path> paths=Files.walk(assets)) {
            files=paths.filter(Files::isRegularFile)
                .sorted(Comparator.comparing(p->zipPath(assets.relativize(p)))).toList();
        }
        try(ZipFile base=new ZipFile(args[0]);
            ZipOutputStream out=new ZipOutputStream(Files.newOutputStream(Path.of(args[3])))) {
            Enumeration<? extends ZipEntry> entries=base.entries();
            while(entries.hasMoreElements()) {
                ZipEntry original=entries.nextElement();
                ZipEntry target=entry(original.getName());
                // resources.arsc must remain uncompressed for Android 11+.
                target.setMethod(original.getMethod());
                if(original.getMethod()==ZipEntry.STORED) {
                    target.setSize(original.getSize());target.setCrc(original.getCrc());
                }
                out.putNextEntry(target);
                try(InputStream in=base.getInputStream(original)){in.transferTo(out);}
                out.closeEntry();
            }
            for(Path file:files)addFile(out,file,"assets/"+zipPath(assets.relativize(file)));
            addFile(out,Path.of(args[2]),"classes.dex");
        }
        try(ZipFile apk=new ZipFile(args[3])) {
            for(String name:new String[]{"assets/index.html","assets/core/engine.js","assets/assets/gtnh/wood.svg","classes.dex"})
                if(apk.getEntry(name)==null)throw new IOException("Missing APK entry: "+name);
            if(apk.stream().anyMatch(e->e.getName().indexOf('\\')>=0))throw new IOException("Invalid ZIP separator");
        }
        System.out.println("Packaged "+files.size()+" assets with Android ZIP paths.");
    }
}
