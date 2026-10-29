
package com.miprimernegocio36.app;

import android.app.Activity;
import android.content.res.Configuration;
import android.webkit.WebViewClient;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.os.Bundle;
import android.os.Build;
import android.os.Environment;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.Manifest;
import android.webkit.PermissionRequest;
import android.content.Intent;
import android.webkit.ValueCallback;
import android.net.Uri;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import org.json.JSONObject;
import android.webkit.WebSettings;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.io.IOException;
import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;
import com.journeyapps.barcodescanner.CaptureActivity;

public class MainActivity extends Activity {
    private WebView webView;
    private static MainActivity activeInstance;
    private ValueCallback<Uri[]> filePathCallback;
    private static final int FILE_CHOOSER_REQUEST = 2048;
    private PermissionRequest pendingWebPermission;
    private static final int CAMERA_PERMISSION_REQUEST = 2049;
    private boolean pendingNativeScanAfterPermission = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        activeInstance = this;

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        webView.addJavascriptInterface(new DownloadBridge(), "AndroidFiles");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean asksCamera = false;
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) asksCamera = true;
                    }
                    if (!asksCamera) { request.deny(); return; }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                        pendingWebPermission = request;
                        requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST);
                    } else { request.grant(request.getResources()); }
                });
            }
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                // Permite elegir tanto respaldos PDF como archivos CSV desde el selector de Android.
                intent.setType("*/*");
                try {
                    startActivityForResult(Intent.createChooser(intent, "Selecciona un archivo PDF o CSV"),
                            FILE_CHOOSER_REQUEST);
                } catch (Exception e) {
                    filePathCallback = null;
                    Toast.makeText(MainActivity.this, "No se pudo abrir el selector de archivos.", Toast.LENGTH_LONG).show();
                    return false;
                }
                return true;
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // Guarda una copia privada de los datos actuales para preparar la migración nativa.
                // No reemplaza localStorage ni cambia la interfaz web existente.
                String migrationBackupScript = "(function(){try{var k='mpn36_v2_data';var send=function(){try{var v=localStorage.getItem(k);if(v&&window.AndroidFiles&&typeof window.AndroidFiles.saveLegacyData==='function'){window.AndroidFiles.saveLegacyData(v);}}catch(e){}};var p=Storage.prototype;if(!p.__mpn36NativeBackupWrapped){var original=p.setItem;p.setItem=function(key,value){original.call(this,key,value);if(key===k){send();}};Object.defineProperty(p,'__mpn36NativeBackupWrapped',{value:true,configurable:false});}send();var add=function(){if(document.getElementById('mpn36-native-preview'))return;var b=document.createElement('button');b.id='mpn36-native-preview';b.type='button';b.textContent='Probar interfaz nativa';b.setAttribute('aria-label','Abrir vista nativa de prueba');b.style.cssText='position:fixed;right:12px;bottom:12px;z-index:2147483647;border:0;border-radius:24px;padding:12px 16px;background:#23425b;color:#fff;font:600 13px sans-serif;box-shadow:0 3px 12px #0003;';b.onclick=function(){try{window.AndroidFiles.openNativePreview();}catch(e){alert('No se pudo abrir la vista nativa.');}};document.body.appendChild(b);};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',add,{once:true});else add();}catch(e){}})();";
                view.evaluateJavascript(migrationBackupScript, null);
            }
        });
        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");
    }

    /** Aplica los cambios guardados desde la pantalla nativa al almacenamiento real de la app. */
    public static boolean applyNativeData(String json) {
        MainActivity activity = activeInstance;
        if (activity == null || activity.webView == null || json == null) return false;
        try {
            JSONObject parsed = new JSONObject(json);
            if (!parsed.has("products") || !parsed.has("sales") || !parsed.has("settings")) return false;
            if (!NativeDataStore.writeLegacyData(activity, parsed)) return false;
            String quoted = JSONObject.quote(parsed.toString());
            activity.runOnUiThread(() -> activity.webView.evaluateJavascript(
                "try{localStorage.setItem('mpn36_v2_data', JSON.parse(" + quoted + "));location.reload();true}catch(e){false}", null));
            return true;
        } catch (Exception e) {
            android.util.Log.e("MPN36Migration", "No se pudieron aplicar los cambios nativos", e);
            return false;
        }
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        if (webView != null) webView.requestLayout();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_PERMISSION_REQUEST) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (pendingWebPermission != null) {
                if (granted) pendingWebPermission.grant(pendingWebPermission.getResources());
                else pendingWebPermission.deny();
                pendingWebPermission = null;
            }
            if (pendingNativeScanAfterPermission) {
                pendingNativeScanAfterPermission = false;
                if (granted) launchNativeBarcodeScanner();
                else notifyScannerError("Permiso de cámara denegado. Puedes escribir el código manualmente en el buscador.");
            }
        }
    }

    private void launchNativeBarcodeScanner() {
        try {
            if (!getPackageManager().hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)) {
                notifyScannerError("Este dispositivo no tiene una cámara disponible.");
                return;
            }
            IntentIntegrator integrator = new IntentIntegrator(MainActivity.this);
            integrator.setCaptureActivity(CaptureActivity.class);
            integrator.setDesiredBarcodeFormats(IntentIntegrator.ALL_CODE_TYPES);
            integrator.setPrompt("Enfoca el código de barras del producto");
            integrator.setBeepEnabled(false);
            integrator.setOrientationLocked(false);
            integrator.setBarcodeImageEnabled(false);
            integrator.initiateScan();
        } catch (Exception e) {
            android.util.Log.e("MPN36Scanner", "No se pudo iniciar el escáner", e);
            notifyScannerError("No se pudo iniciar la cámara. Revisa los permisos o escribe el código manualmente.");
            Toast.makeText(MainActivity.this, "El escáner no pudo abrirse. La aplicación sigue disponible.", Toast.LENGTH_LONG).show();
        }
    }

    private void notifyScannerError(String message) {
        if (webView == null) return;
        webView.post(() -> webView.evaluateJavascript(
                "window.onNativeBarcodeError && window.onNativeBarcodeError(" + JSONObject.quote(message) + ")", null));
    }

    private class DownloadBridge {
        @JavascriptInterface
        public void openNativePreview() {
            runOnUiThread(() -> {
                try { startActivity(new Intent(MainActivity.this, NativeHomeActivity.class)); }
                catch (Exception e) { Toast.makeText(MainActivity.this, "No se pudo abrir la vista nativa de prueba.", Toast.LENGTH_LONG).show(); }
            });
        }

        @JavascriptInterface
        public void startBarcodeScan() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                    pendingNativeScanAfterPermission = true;
                    requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST);
                    return;
                }
                launchNativeBarcodeScanner();
            });
        }

        @JavascriptInterface
        public void printHtml(String html) {
            runOnUiThread(() -> {
                try {
                    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.KITKAT) {
                        Toast.makeText(MainActivity.this, "La impresión requiere Android 4.4 o posterior.", Toast.LENGTH_LONG).show();
                        return;
                    }
                    WebView printView = new WebView(MainActivity.this);
                    printView.setWebViewClient(new WebViewClient() {
                        @Override public void onPageFinished(WebView view, String url) {
                            try {
                                PrintManager printManager = (PrintManager) getSystemService(PRINT_SERVICE);
                                if (printManager == null) throw new IllegalStateException("Servicio de impresión no disponible");
                                printManager.print("Ticket Mi Primer Negocio 36", view.createPrintDocumentAdapter("Ticket Mi Primer Negocio 36"), new PrintAttributes.Builder().build());
                            } catch (Exception e) {
                                Toast.makeText(MainActivity.this, "No se pudo abrir la impresión del ticket.", Toast.LENGTH_LONG).show();
                                android.util.Log.e("MPN36Print", "Error al imprimir ticket", e);
                            }
                        }
                    });
                    printView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "No se pudo preparar el ticket para imprimir.", Toast.LENGTH_LONG).show();
                    android.util.Log.e("MPN36Print", "Error al preparar ticket", e);
                }
            });
        }

        @JavascriptInterface
        public void saveLegacyData(String json) {
            // JavaScript interface callbacks run off the UI thread. Save atomically in app-private storage.
            try {
                if (json == null || json.length() > 20 * 1024 * 1024) return;
                JSONObject parsed = new JSONObject(json);
                if (!parsed.has("products") || !parsed.has("sales") || !parsed.has("settings")) return;
                File target = new File(getFilesDir(), NativeDataStore.FILE_NAME);
                File temp = new File(getFilesDir(), NativeDataStore.FILE_NAME + ".tmp");
                byte[] bytes = json.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                try (FileOutputStream stream = new FileOutputStream(temp)) {
                    stream.write(bytes);
                    stream.getFD().sync();
                }
                if (target.exists() && !target.delete()) {
                    temp.delete();
                    return;
                }
                if (!temp.renameTo(target)) {
                    try (FileOutputStream stream = new FileOutputStream(target)) { stream.write(bytes); stream.getFD().sync(); }
                    temp.delete();
                }
            } catch (Exception e) {
                android.util.Log.w("MPN36Migration", "No se pudo actualizar la copia privada de migración", e);
            }
        }

        @JavascriptInterface
        public void saveBase64(String filename, String mimeType, String base64) {
            runOnUiThread(() -> {
                try {
                    byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                    OutputStream output;

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                        values.put(MediaStore.MediaColumns.RELATIVE_PATH,
                                Environment.DIRECTORY_DOWNLOADS);

                        Uri uri = getContentResolver().insert(
                                MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);

                        if (uri == null) {
                            throw new IOException("No se pudo crear el archivo.");
                        }

                        output = getContentResolver().openOutputStream(uri);
                        if (output == null) {
                            throw new IOException("No se pudo abrir el archivo.");
                        }
                    } else {
                        File folder = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                        if (folder == null) {
                            throw new IOException("No se encontró la carpeta.");
                        }
                        if (!folder.exists() && !folder.mkdirs()) {
                            throw new IOException("No se pudo crear la carpeta.");
                        }
                        output = new FileOutputStream(new File(folder, filename));
                    }

                    try (OutputStream stream = output) {
                        stream.write(bytes);
                    }

                    Toast.makeText(MainActivity.this,
                            "Archivo guardado: " + filename,
                            Toast.LENGTH_LONG).show();

                } catch (Exception e) {
                    Toast.makeText(MainActivity.this,
                            "Error al guardar: " + e.getMessage(),
                            Toast.LENGTH_LONG).show();
                }
            });
        }
    }


    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent intent) {
        super.onActivityResult(requestCode, resultCode, intent);
        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (filePathCallback != null) {
                Uri[] results = null;
                if (resultCode == RESULT_OK && intent != null && intent.getData() != null) {
                    results = new Uri[] { intent.getData() };
                }
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
            return;
        }

        if (requestCode != IntentIntegrator.REQUEST_CODE) return;
        IntentResult scanResult = IntentIntegrator.parseActivityResult(requestCode, resultCode, intent);
        if (scanResult != null) {
            if (scanResult.getContents() != null) {
                String code = JSONObject.quote(scanResult.getContents());
                if (webView != null) webView.evaluateJavascript(
                        "window.onNativeBarcodeScanned && window.onNativeBarcodeScanned(" + code + ")", null);
            } else {
                Toast.makeText(this, "Escaneo cancelado. La aplicación sigue abierta.", Toast.LENGTH_SHORT).show();
            }
            return;
        }
    }

    @Override
    protected void onDestroy() {
        if (activeInstance == this) activeInstance = null;
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript("if (window.__mpnGoDashboard) window.__mpnGoDashboard();", null);
        } else {
            super.onBackPressed();
        }
    }
}
