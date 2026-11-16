# Mi Primer Negocio 36 — versión 3.13.0 (Build 37)

## Proyecto
Aplicación Android basada en una interfaz web local dentro de WebView. La pantalla de uso sigue siendo `MainActivity` con `file:///android_asset/index.html`; `NativeHomeActivity` no se usa como pantalla principal.

Los datos principales permanecen en el almacenamiento local del dispositivo con la clave `mpn36_v2_data`. Se conserva el identificador `com.miprimernegocio36.app` para permitir actualizar una instalación existente sin cambiar de paquete.

## Archivos principales
- `app/src/main/java/com/miprimernegocio36/app/MainActivity.java`: WebView, selector de archivos/cámara, impresión, notificaciones Android y escáner.
- `app/src/main/assets/index.html`: interfaz.
- `app/src/main/assets/app.js`: lógica de negocio y almacenamiento local.
- `app/src/main/assets/styles.css`, `features.css`, `menu-tools.css`: diseño y temas.
- `app/src/main/AndroidManifest.xml`: permisos y configuración Android.
- `app/build.gradle`: versión y dependencias.
- `.github/workflows/build-android.yml`: compilación en GitHub Actions.

## Cambios de 3.13.0
- Centro visual de notificaciones y avisos nativos de Android.
- Opción para ocultar/mostrar el desglose de IVA en tickets sin alterar el total.
- Indicadores y gráficas en Productos, Ventas, Gastos y Estadísticas.
- Cámara y galería para fotografías de productos.
- Calendario de rachas visible en la vista compacta.
- Versión 3.13.0, código 37.

## Compilar desde Android con GitHub
1. Antes de instalar una actualización, exporta un respaldo desde la app y comprueba que el archivo se guardó.
2. Sube el contenido de este ZIP al repositorio, conservando las carpetas.
3. Abre la pestaña **Actions** y espera a que termine el flujo `build-android.yml`.
4. Descarga el artefacto APK únicamente si la ejecución terminó correctamente.
5. Instálalo como actualización, sin borrar los datos de la aplicación.
6. En **Versión del sistema**, comprueba `3.13.0 (37)` y realiza las pruebas descritas en `CAMBIOS_VERSION_3.13.0.txt`.

## Validación y límites
`app.js` pasó `node --check`. Se verificó que Gradle declare `versionName 3.13.0` y `versionCode 37`. Este paquete contiene el código fuente, no un APK recién compilado. No se pudo ejecutar una compilación Android local en este entorno; GitHub Actions y las pruebas físicas en Android siguen siendo necesarias, especialmente para cámara y permisos de notificaciones.
