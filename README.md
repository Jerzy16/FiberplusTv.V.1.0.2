# Fiberplus

Aplicación IPTV para televisores LG con webOS. Al abrir la app se muestra primero la pantalla inicial de Fiberplus y, después, el login del proveedor. Ya no aparece una pantalla intermedia para elegir espacio de entretenimiento.

## Estructura del proyecto

- `appinfo.json` — nombre, identificador, versión e iconos de la app webOS.
- `js/services/providers.js` — configuración del proveedor Fiberplus y su conexión.
- `js/services/` — autenticación, carga y análisis de listas IPTV y reproducción de vídeo.
- `js/core/` — estado de la aplicación, navegación y soporte para el control remoto.
- `js/components/` — iconos y componentes visuales reutilizables.
- `js/pages/` — pantallas de inicio, acceso, canales y reproducción.
- `css/` — estilos de la aplicación.
- `assets/` — logotipos y recursos gráficos de Fiberplus.

## Sesión

Al iniciar, la app restaura la sesión y los canales guardados localmente en el televisor, para que no tengas que volver a ingresar tus credenciales. La opción de cerrar sesión elimina esos datos.

Los logos de canales ya cargados se conservan en memoria mientras la app está abierta para evitar solicitar y descargar de nuevo los mismos recursos al cambiar de canal.

## Reproducción

El reproductor reintenta fallos temporales de red y recupera errores de decodificación antes de mostrar el aviso de reproducción. Al reanudar un canal en directo, intenta volver al punto más reciente disponible en la señal.

## Crear un paquete IPK

Instala el CLI del SDK de webOS TV y ejecuta estos comandos desde la raíz del proyecto:

```powershell
# Validar la app sin crear un paquete
ares-package --check --app-exclude ".git" --app-exclude ".claude" --app-exclude "dist" --app-exclude "README.md" --app-exclude ".gitignore" .

# Crear el paquete en dist\
ares-package --verbose --outdir ".\dist" --app-exclude ".git" --app-exclude ".claude" --app-exclude "dist" --app-exclude "README.md" --app-exclude ".gitignore" .

# Revisar los metadatos del paquete
ares-package --info-detail ".\dist\com.fiberplus.iptv_1.0.2_all.ipk"
```

## Instalar en un televisor LG

Activa el modo desarrollador en el televisor y configúralo con las herramientas de webOS TV SDK. Luego lista los dispositivos y usa el alias configurado:

```powershell
ares-setup-device --list
ares-install ".\dist\com.fiberplus.iptv_1.0.2_all.ipk" --device "<ALIAS_DE_LA_TV>"
```

El identificador nuevo hace que webOS reconozca Fiberplus como una app independiente. Si la versión anterior sigue instalada, desinstálala desde el televisor cuando ya no la necesites. Es posible que tengas que volver a iniciar sesión.
