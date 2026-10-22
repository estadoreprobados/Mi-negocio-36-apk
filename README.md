# Mi Primer Negocio 36 — Paquete Android

Este paquete contiene:
- La versión web/PWA actual en `web/`.
- Un proyecto Android sencillo con WebView.
- Un flujo de GitHub Actions para compilar un APK de prueba automáticamente.

## Importante
Este ZIP **no contiene un APK ya compilado**. En este entorno no hay Android SDK/Gradle para generar y probar un APK real. Al subir este proyecto a GitHub, la acción de GitHub Actions compilará `app-debug.apk` y lo publicará como un artefacto descargable.

La app Android abre la versión publicada en:
https://estadoreprobados.github.io/Mi-negocio-36-demo/

Para que funcione sin conexión, la web debe estar publicada con su `manifest.json` y `sw.js`, y el teléfono debe abrirla al menos una vez con internet para que el service worker guarde los recursos. Prueba el modo avión antes de usarla en un negocio real.

## Cómo usarlo desde Android
1. Descarga y extrae este ZIP.
2. En tu repositorio de GitHub, crea una rama nueva o un repositorio separado para probar.
3. Sube el contenido de esta carpeta (incluidos `.github`, `app`, `web`, `build.gradle`, `settings.gradle`, `gradle.properties` y `AndroidManifest.xml` está dentro de `app/src/main`).
4. En GitHub, abre la pestaña **Actions** y espera a que termine `Build Android APK`.
5. Abre la ejecución exitosa, baja a **Artifacts** y descarga `Mi-Primer-Negocio-36-debug-apk`.
6. Extrae el artefacto ZIP y encontrarás `app-debug.apk`. Instálalo en tu Android para probar.

## Limitaciones actuales
- Es un APK de depuración (`debug`), útil para pruebas; no es una compilación final firmada para distribución comercial.
- La aplicación web carga desde GitHub Pages, por lo que la primera apertura requiere internet. El modo sin conexión depende del caché del service worker.
- Los datos actuales siguen guardándose localmente en el navegador/WebView de ese dispositivo. No incluye aún cuentas reales, sincronización multiusuario ni nube.
- No ingreses datos financieros confidenciales hasta completar una revisión de seguridad y respaldos.
- No se garantiza que todas las funciones (por ejemplo, descargas CSV o PDF/CDN) funcionen igual dentro del WebView; deben probarse en el APK.
