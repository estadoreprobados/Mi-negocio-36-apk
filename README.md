# Mi Primer Negocio 36

Aplicación para organizar productos, inventario y movimientos de un pequeño negocio. Este repositorio contiene el proyecto Android y los recursos web que la aplicación carga actualmente dentro de un WebView.

## Versión 3.7.01

**Estado:** paquete de actualización en preparación. Las funciones descritas como pendientes deben implementarse y probarse antes de anunciarse como disponibles en una publicación final.

### Cambios y trabajo de esta actualización

- **Productos e inventario:** continuar las mejoras de tarjetas de producto, fotografías locales, favoritos, lista de reabastecimiento y calculadora de precios por margen.
- **Empleados y mano de obra:** incorporar un apartado de empleados con horarios, horas trabajadas, salario y horas extras, además de una calculadora del costo de mano de obra por producto o pedido. Los cálculos de nómina deberán validarse según las reglas laborales aplicables.
- **Reportes PDF:** ampliar el reporte para incluir los registros disponibles de productos, inventario, ventas, gastos, caja, empleados, mano de obra, clientes, saldos, abonos, proveedores, notas e impuestos calculados. Los reportes por periodo y las fotografías dependerán de la información disponible y del tamaño del archivo.
- **Temas Cyberpunk y Galaxia:** adaptar ambos temas a modo claro y oscuro, con fondos adecuados y vistas previas independientes.
- **Ayuda:** documentar cómo utilizar empleados, mano de obra, horas extras, reportes y las opciones relacionadas.
- **Versión del sistema:** mostrar la versión 3.7.01 y una descripción organizada de los cambios de esta entrega.
- **Conservación de datos:** priorizar los respaldos y la validación de los datos locales antes de cualquier migración o cambio de almacenamiento.

### Funciones existentes de la base 3.7.0

- Catálogo de productos con costo, precio y ganancia estimada.
- Fotografías de producto y favoritos.
- Calculadora de precios basada en margen sobre el precio de venta.
- Lista de reabastecimiento basada en el stock mínimo.
- Ajustes visuales y mascota Manolito.
- Funciones previas de ventas, gastos, estadísticas, temas y exportaciones que estén presentes en el código de esta base.

## Datos y privacidad

Los datos web se guardan localmente en el almacenamiento del WebView mediante `localStorage`; no se sincronizan automáticamente entre dispositivos. No borres los datos de la aplicación ni la desinstales sin exportar y verificar antes un respaldo. Un PDF es un reporte de lectura y no sustituye un respaldo restaurable.

## Compilación Android

El flujo de GitHub Actions compila el APK firmado y requiere los secretos de firma configurados en el repositorio. Tras subir los cambios, ejecuta el flujo de compilación y revisa que finalice correctamente antes de distribuir el APK.

## Importante

Esta versión sigue utilizando WebView; la migración completa a Android nativo con Java y XML no debe considerarse terminada hasta que el código y la persistencia nativa estén implementados y probados. No anuncies como terminada una función que no haya pasado pruebas en un dispositivo real.
