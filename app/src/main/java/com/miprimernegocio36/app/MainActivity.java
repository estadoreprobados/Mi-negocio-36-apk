
package com.miprimernegocio36.app;

import android.app.Activity;
import android.os.Bundle;
import android.os.Build;
import android.os.Environment;
import android.content.ContentValues;
import android.content.Intent;
import android.webkit.ValueCallback;
import android.net.Uri;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.io.IOException;

public class MainActivity extends Activity {
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private static final int FILE_CHOOSER_REQUEST = 2048;

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

    private class DownloadBridge {
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
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
