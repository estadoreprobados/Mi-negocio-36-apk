
package com.miprimernegocio36.app;

import android.app.Activity;
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
    private ValueCallback<Uri[]> filePathCallback;
    private static final int FILE_CHOOSER_REQUEST = 2048;
    private PermissionRequest pendingWebPermission;
    private static final int CAMERA_PERMISSION_REQUEST = 2049;
    private boolean pendingNativeScanAfterPermission = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

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

        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");
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
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript("if (window.__mpnGoDashboard) window.__mpnGoDashboard();", null);
        } else {
            super.onBackPressed();
        }
    }
}
