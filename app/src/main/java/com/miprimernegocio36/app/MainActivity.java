
package com.miprimernegocio36.app;

import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

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
                    String error = "Error JavaScript: " + message.message();
                    Log.e("MiNegocio36", error);
                    Toast.makeText(
                        MainActivity.this,
                        error,
                        Toast.LENGTH_LONG
                    ).show();
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
                    String description = error.getDescription().toString();

                    String html =
                        "<html><body style='font-family:sans-serif;" +
                        "padding:24px;background:#111;color:white'>" +
                        "<h2>No se pudo abrir Mi Primer Negocio 36</h2>" +
                        "<p>Android no pudo cargar index.html.</p>" +
                        "<p>Error: " + error.getErrorCode() + "</p>" +
                        "<p>Detalle: " + description + "</p>" +
                        "<p>Revisa que el archivo exista en " +
                        "app/src/main/assets/index.html</p>" +
                        "</body></html>";

                    view.loadDataWithBaseURL(
                        null,
                        html,
                        "text/html",
                        "UTF-8",
                        null
                    );
                }
            }
        });

        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");
    }
}
