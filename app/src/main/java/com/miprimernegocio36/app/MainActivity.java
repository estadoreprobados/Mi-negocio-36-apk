
package com.miprimernegocio36.app;

import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.DownloadListener;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import android.content.Intent;
import android.net.Uri;
import android.os.Environment;
import android.content.ContentValues;
import android.provider.MediaStore;

import java.io.OutputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage message) {
                if (message.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
                    Log.e("MiNegocio36", message.message());
                }
                return true;
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(
                    WebView view,
                    WebResourceRequest request,
                    WebResourceError error) {

                if (request.isForMainFrame()) {
                    Toast.makeText(
                        MainActivity.this,
                        "No se pudo cargar la aplicación.",
                        Toast.LENGTH_LONG
                    ).show();
                }
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                if (url.startsWith("data:text/csv")) {
                    String content = URLDecoder.decode(
                        url.substring(url.indexOf(",") + 1),
                        "UTF-8"
                    );
                    saveFile(content, "mi-primer-negocio-36.csv", "text/csv");
                } else {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                }
            } catch (Exception e) {
                Log.e("MiNegocio36", "Error al descargar", e);
                Toast.makeText(
                    MainActivity.this,
                    "No se pudo descargar el archivo.",
                    Toast.LENGTH_LONG
                ).show();
            }
        });

        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");
    }

    private void saveFile(String content, String fileName, String mimeType) {
        try {
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
            values.put(
                MediaStore.MediaColumns.RELATIVE_PATH,
                Environment.DIRECTORY_DOWNLOADS
            );

            Uri uri = getContentResolver().insert(
                MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                values
            );

            if (uri == null) {
                throw new Exception("No se pudo crear el archivo.");
            }

            try (OutputStream output = getContentResolver().openOutputStream(uri)) {
                if (output == null) {
                    throw new Exception("No se pudo escribir el archivo.");
                }
                output.write(content.getBytes(StandardCharsets.UTF_8));
            }

            Toast.makeText(
                this,
                "CSV guardado en Descargas.",
                Toast.LENGTH_LONG
            ).show();

        } catch (Exception e) {
            Log.e("MiNegocio36", "Error al guardar archivo", e);
            Toast.makeText(
                this,
                "Error al guardar el archivo.",
                Toast.LENGTH_LONG
            ).show();
        }
    }
}
