# Abrir los mapas sin el bloqueo OSM 403

En Windows, haz doble clic en **`abrir_mapas.cmd`**, en la carpeta principal.
Requiere Python 3 y abre el mapa conjunto en el navegador. Selecciona **La Paz**
en el selector de departamentos o abre su mapa individual:

<http://127.0.0.1:8000/data/por_departamento/La%20Paz/>

Deja la consola abierta mientras consultas los mapas. Para detener el servidor,
presiona `Ctrl+C`. El servidor escucha solo en este equipo (`127.0.0.1`).

También puedes ejecutarlo desde la carpeta principal:

```powershell
python scripts/servir_mapas.py
```

Si el puerto está ocupado, usa `python scripts/servir_mapas.py --port 8001`
y las direcciones que imprime la consola.

## Qué cambió

- OSM usa su URL oficial `https://tile.openstreetmap.org/{z}/{x}/{y}.png`,
  sin los subdominios antiguos, y permite enviar el `Referer` real del navegador.
- Al abrir un HTML directamente (`file://`), el navegador no envía ese
  `Referer`. Por eso el visor inicia con **Satélite** y deshabilita **Cartográfico
  OSM** en ese modo, mostrando cómo abrirlo por HTTP local.
- Si OSM falla incluso por HTTP (por ejemplo, por un bloqueo de red), el visor
  cambia a **Satélite** y muestra un aviso. Esto no levanta un bloqueo de OSM.
  Se comprueba el estado HTTP de una tesela ya visible por activación, con la
  caché normal: algunas respuestas 403 contienen un PNG que Leaflet acepta como imagen.
- Los puntos, polígonos, límites y filtros no se modifican. Los fondos y Leaflet
  siguen necesitando conexión a Internet.

## Satélite al acercar hasta la escala de unos 20 m

Esri no tiene imágenes del nivel 19 en algunas zonas de La Paz y responde con
teselas grises que dicen «Map data not yet available». No es el bloqueo 403 de OSM.

Todos los visores solicitan imágenes Esri hasta el nivel 18 (`maxNativeZoom: 18`).
Al acercarse al nivel 19, Leaflet amplía esas imágenes en vez de pedir las que no
existen. Los puntos y polígonos mantienen su ubicación y se pueden seguir ampliando;
la foto puede verse más pixelada, pero ese acercamiento no añade resolución real.

## Registros de La Paz

El mapa individual de La Paz y el mapa general de departamentos muestran únicamente
las filas marcadas con relleno verde en `data/por_departamento/La Paz/establecimientos_salud.xlsx`.
Las filas rojas o sin marcar no se incluyen. El filtro se aplica al generar las capas;
los demás departamentos conservan todos sus registros.

La opción Satélite Sentinel-2 · 2025 se retiró de ambos visores departamentales.

No se falsifican cabeceras, se rotan servidores ni se fuerzan descargas de teselas.
Se conserva la caché normal del navegador y la atribución de cada proveedor.
Consulta la [política de teselas de OSM](https://operations.osmfoundation.org/policies/tiles/).
