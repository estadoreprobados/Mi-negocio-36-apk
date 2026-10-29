package com.miprimernegocio36.app;

import android.content.Context;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Acceso de solo lectura a la copia privada de los datos de la versión WebView.
 * Esta clase prepara la migración; no cambia todavía la pantalla ni la base de datos activa.
 */
public final class NativeDataStore {
    public static final String FILE_NAME = "mpn36_legacy_data.json";
    private NativeDataStore() {}

    public static JSONObject readLegacyData(Context context) {
        File file = new File(context.getFilesDir(), FILE_NAME);
        if (!file.isFile() || file.length() <= 0 || file.length() > 20L * 1024L * 1024L) return null;
        try (FileInputStream in = new FileInputStream(file); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
            JSONObject data = new JSONObject(new String(out.toByteArray(), StandardCharsets.UTF_8));
            if (!data.has("products") || !data.has("sales") || !data.has("settings")) return null;
            return data;
        } catch (Exception e) {
            android.util.Log.w("MPN36Migration", "No se pudo leer la copia de datos anterior", e);
            return null;
        }
    }


    /** Guarda una copia validada de los datos migrados mediante escritura atómica. */
    public static boolean writeLegacyData(Context context, JSONObject data) {
        if (data == null || !data.has("products") || !data.has("sales") || !data.has("settings")) return false;
        File target = new File(context.getFilesDir(), FILE_NAME);
        File temp = new File(context.getFilesDir(), FILE_NAME + ".tmp");
        byte[] bytes = data.toString().getBytes(StandardCharsets.UTF_8);
        if (bytes.length == 0 || bytes.length > 20 * 1024 * 1024) return false;
        try (FileOutputStream out = new FileOutputStream(temp)) {
            out.write(bytes);
            out.getFD().sync();
        } catch (Exception e) {
            android.util.Log.w("MPN36Migration", "No se pudo escribir el respaldo nativo", e);
            temp.delete();
            return false;
        }
        if (target.exists() && !target.delete()) { temp.delete(); return false; }
        if (temp.renameTo(target)) return true;
        try (FileOutputStream out = new FileOutputStream(target)) {
            out.write(bytes); out.getFD().sync(); temp.delete(); return true;
        } catch (Exception e) {
            android.util.Log.w("MPN36Migration", "No se pudo finalizar el respaldo nativo", e);
            temp.delete(); return false;
        }
    }

    public static boolean hasLegacyData(Context context) {
        return readLegacyData(context) != null;
    }
}
