package com.miprimernegocio36.app;

import android.content.Context;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
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

    public static boolean hasLegacyData(Context context) {
        return readLegacyData(context) != null;
    }
}
