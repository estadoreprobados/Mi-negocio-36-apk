
package com.miprimernegocio36.app;

import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.res.Configuration;
import android.webkit.WebViewClient;
import androidx.core.app.NotificationCompat;
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
import android.content.ClipData;
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
    private static final int NOTIFICATION_PERMISSION_REQUEST = 2050;
    private static final String NOTIFICATION_CHANNEL_ID = "mpn36_business_alerts";
    private boolean pendingNativeScanAfterPermission = false;
    private boolean pendingNotificationPermission = false;
    private Uri pendingCameraPhotoUri;

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
                try {
                    String[] accepted = params.getAcceptTypes();
                    boolean wantsImage = false;
                    if (accepted != null) for (String type : accepted) if (type != null && type.toLowerCase().contains("image")) wantsImage = true;
                    Intent picker = new Intent(Intent.ACTION_GET_CONTENT);
                    picker.addCategory(Intent.CATEGORY_OPENABLE);
                    picker.setType(wantsImage ? "image/*" : "*/*");

                    // La cámara se agrega como opción independiente al selector de galería.
                    // Es importante usar EXTRA_OUTPUT: muchas cámaras no devuelven una miniatura
                    // en data cuando se solicita una fotografía de resolución completa.
                    Intent chooser = Intent.createChooser(picker,
                            wantsImage ? "Tomar una foto o elegir de galería" : "Seleccionar archivo");
                    if (wantsImage && getPackageManager().hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)) {
                        Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                        if (camera.resolveActivity(getPackageManager()) != null) {
                            ContentValues values = new ContentValues();
                            values.put(MediaStore.Images.Media.DISPLAY_NAME,
                                    "MPN36_" + System.currentTimeMillis() + ".jpg");
                            values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                                values.put(MediaStore.Images.Media.RELATIVE_PATH,
                                        Environment.DIRECTORY_PICTURES + "/Mi Primer Negocio 36");
                            }
                            pendingCameraPhotoUri = getContentResolver().insert(
                                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                            if (pendingCameraPhotoUri != null) {
                                camera.putExtra(MediaStore.EXTRA_OUTPUT, pendingCameraPhotoUri);
                                camera.setClipData(ClipData.newRawUri("Fotografía del producto", pendingCameraPhotoUri));
                                camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                                chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                                chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
                            }
                        }
                    }
                    startActivityForResult(chooser, FILE_CHOOSER_REQUEST);
                } catch (Exception e) {
                    filePathCallback = null;
                    pendingCameraPhotoUri = null;
                    Toast.makeText(MainActivity.this, "No se pudo abrir la cámara o el selector de archivos.", Toast.LENGTH_LONG).show();
                    return false;
                }
                return true;
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // Conserva una copia privada de compatibilidad, sin mostrar ni abrir la interfaz nativa.
                // La interfaz original en WebView es la única pantalla de uso de la aplicación.
                String migrationBackupScript = "(function(){try{var k='mpn36_v2_data';var send=function(){try{var v=localStorage.getItem(k);if(v&&window.AndroidFiles&&typeof window.AndroidFiles.saveLegacyData==='function'){window.AndroidFiles.saveLegacyData(v);}}catch(e){}};var p=Storage.prototype;if(!p.__mpn36NativeBackupWrapped){var original=p.setItem;p.setItem=function(key,value){original.call(this,key,value);if(key===k){send();}};Object.defineProperty(p,'__mpn36NativeBackupWrapped',{value:true,configurable:false});}send();}catch(e){}})();";
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
                "try{localStorage.setItem('mpn36_v2_data', " + quoted + ");location.reload();true}catch(e){false}", null));
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
        if (requestCode == NOTIFICATION_PERMISSION_REQUEST) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            pendingNotificationPermission = false;
            notifyWebNotificationPermission(granted);
            return;
        }
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

    private void notifyWebNotificationPermission(boolean granted) {
        if (webView != null) webView.post(() -> webView.evaluateJavascript(
                "window.onNativeNotificationPermission && window.onNativeNotificationPermission(" + granted + ")", null));
    }

    private void requestAndroidNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            if (!pendingNotificationPermission) {
                pendingNotificationPermission = true;
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_REQUEST);
            }
        } else {
            notifyWebNotificationPermission(true);
        }
    }

    private void showBusinessNotification(String title, String message) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                if (manager != null && manager.getNotificationChannel(NOTIFICATION_CHANNEL_ID) == null) {
                    manager.createNotificationChannel(new NotificationChannel(NOTIFICATION_CHANNEL_ID,
                            "Avisos del negocio", NotificationManager.IMPORTANCE_DEFAULT));
                }
            }
            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
            NotificationCompat.Builder builder = new NotificationCompat.Builder(MainActivity.this, NOTIFICATION_CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setContentTitle(title == null ? "Mi Primer Negocio 36" : title)
                    .setContentText(message == null ? "Tienes un nuevo aviso." : message)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(message == null ? "Tienes un nuevo aviso." : message))
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT).setAutoCancel(true);
            NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (manager != null) manager.notify((int) (System.currentTimeMillis() & 0x7fffffff), builder.build());
        } catch (Exception e) { android.util.Log.w("MPN36Notify", "No se pudo mostrar la notificación", e); }
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
        public void requestNotificationPermission() {
            runOnUiThread(() -> requestAndroidNotificationPermission());
        }

        @JavascriptInterface
        public void showNotification(String title, String message) {
            runOnUiThread(() -> showBusinessNotification(title, message));
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


    private boolean hasImageContent(Uri uri) {
        if (uri == null) return false;
        try (java.io.InputStream input = getContentResolver().openInputStream(uri)) {
            return input != null && input.read() != -1;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent intent) {
        super.onActivityResult(requestCode, resultCode, intent);
        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (filePathCallback != null) {
                Uri[] results = null;
                Uri selected = null;
                if (resultCode == RESULT_OK && intent != null) {
                    if (intent.getClipData() != null && intent.getClipData().getItemCount() > 0) {
                        selected = intent.getClipData().getItemAt(0).getUri();
                    } else {
                        selected = intent.getData();
                    }
                }
                // Algunas apps de cámara guardan correctamente la foto en EXTRA_OUTPUT,
                // pero devuelven RESULT_CANCELED o un Intent sin data. Comprobamos el URI.
                if (selected == null && pendingCameraPhotoUri != null && hasImageContent(pendingCameraPhotoUri)) {
                    selected = pendingCameraPhotoUri;
                }
                if (selected != null) results = new Uri[]{selected};
                if (pendingCameraPhotoUri != null && !pendingCameraPhotoUri.equals(selected)) {
                    try { getContentResolver().delete(pendingCameraPhotoUri, null, null); } catch (Exception ignored) {}
                } else if (pendingCameraPhotoUri != null && selected == null) {
                    try { getContentResolver().delete(pendingCameraPhotoUri, null, null); } catch (Exception ignored) {}
                }
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
                pendingCameraPhotoUri = null;
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
