# Mi Primer Negocio 36 — versión 3.7.3

## Resumen
Actualización Android/WebView con compilación 20. La app mantiene los datos del negocio en almacenamiento local del dispositivo. No hay cuentas ni sincronización en la nube en esta versión.

## Novedades de 3.7.3
- Manolito es una mascota interactiva sin IA: consejos predeterminados según productos, ventas y registros.
- Botón «Dame un consejo» y accesos rápidos a Productos y Registrar venta.
- Opción para mostrar u ocultar la mascota desde Ajustes.
- Se conserva el registro de empleados y el cálculo estimado de pago por horas normales y extras.
- Se conserva el reporte PDF con secciones de los módulos que ya existen y tengan registros.
- Temas Cyberpunk y Galaxia con variantes visuales de modo claro y oscuro.
- Versión del sistema actualizada a 3.7.3, compilación 20.

## Rutas importantes
- Web publicada: `index.html`, `app.js`, `styles.css`, `features.css`.
- APK Android (archivos que carga el WebView): `app/src/main/assets/index.html`, `app/src/main/assets/app.js`, `app/src/main/assets/styles.css`, `app/src/main/assets/features.css`.
- Versión Android: `app/build.gradle`.

Los archivos raíz `index.html`, `app.js` y `features.css` deben mantenerse sincronizados con las copias incluidas en `app/src/main/assets/`.

## Actualizar desde Android
1. Haz una copia del repositorio y exporta un respaldo JSON desde la app. Comprueba que el archivo se guardó antes de continuar.
2. Sube los archivos del ZIP al repositorio correcto conservando la estructura de carpetas.
3. Abre **Actions** y ejecuta/espera el flujo de compilación Android. No descargues un artefacto si el flujo falló.
4. Descarga el APK de la ejecución exitosa e instálalo. No borres los datos de la app.
5. Abre **Menú → Versión del sistema** y confirma versión `3.7.3`, compilación `19`.
6. Prueba Manolito, registra un empleado de prueba, revisa el PDF y prueba ventas/inventario antes de usarlo en operaciones reales.

## Privacidad y limitaciones
Manolito no utiliza IA, no procesa lenguaje libre y no necesita conectarse a un servidor. Sus consejos se generan con reglas incluidas en `app.js` a partir de los datos locales. Los cálculos de pago de empleados son estimaciones y no sustituyen asesoría laboral o nómina. El PDF es un reporte de lectura, no un archivo de restauración.

## Verificación
Este paquete actualiza los archivos de origen, pero no contiene un APK compilado ni certifica pruebas en un dispositivo físico. La compilación y las pruebas deben confirmarse en GitHub Actions y en el dispositivo Android antes de publicar. Consulta `CAMBIOS_VERSION_3.7.3.txt` para la descripción detallada.
