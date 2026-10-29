# Estándar de datos para la API de establecimientos de salud

## Salidas normalizadas

Los CSV originales no se modifican. `scripts/normalizar_csv.py` produce archivos con el mismo esquema en `data/normalizados/`:

| Archivo | Filas | Contenido |
|---|---:|---|
| `minsal.csv` | 942 | Establecimientos MINSAL |
| `overpass.csv` | 402 | Elementos OSM obtenidos con Overpass |
| `geofabrik.csv` | 945 | Elementos OSM obtenidos de Geofabrik |
| `hot.csv` | 1,642 | Elementos OSM obtenidos de HOT/HDX |
| `establecimientos_salud.csv` | 3,931 | Las cuatro fuentes, sin deduplicarlas entre sí |

Para regenerarlos desde la raíz del proyecto:

```bash
python scripts/normalizar_csv.py
```

## Convenciones del archivo

- Codificación: UTF-8 sin BOM.
- Formato: CSV delimitado por coma, encabezado obligatorio y saltos de línea LF.
- Nombres de campos: `snake_case`, en minúsculas y sin tildes.
- Valores ausentes: celda vacía. Al importar a la API deben convertirse a `null`, no a una cadena vacía.
- Coordenadas: WGS 84 (`EPSG:4326`), grados decimales.
- En campos separados se usa latitud y después longitud. En WKT y GeoJSON el orden espacial es longitud, latitud (`x y`).
- Identificadores, teléfonos y códigos se importan como texto. No se deben convertir los IDs a números.
- El contrato JSON equivalente está en `docs/establecimiento.schema.json`.

## Campos estándar

| Campo | Tipo API | Obligatorio | Descripción |
|---|---|---:|---|
| `id` | string | sí | ID global estable: `{fuente}-{fuente_id_normalizado}`. |
| `fuente` | enum | sí | `minsal`, `overpass`, `geofabrik`, `hot` o `manual` para incorporaciones manuales en los Excel departamentales. |
| `fuente_id` | string | sí | ID nativo sin alterar (`1`, `way/123`, `relation/456`); en registros manuales, una clave local estable. |
| `nombre` | string | sí | Nombre reportado por la fuente; puede ser `Sin nombre`. |
| `tipo` | string | sí | Clasificación legible de la fuente. |
| `tipo_codigo` | string | sí | Versión estable, sin tildes y en `snake_case`, para filtros. |
| `detalle` | string/null | no | Detalle de representación: punto, predio, edificio o polígono según la fuente. |
| `detalle_codigo` | string/null | no | Versión normalizada de `detalle`. |
| `departamento` | string/null | no | Uno de los 14 departamentos, con escritura normalizada. |
| `municipio` | string/null | no | Municipio informado por la fuente. |
| `region` | string/null | no | Región MINSAL sin el prefijo “Región”. |
| `direccion` | string/null | no | Dirección disponible. |
| `operador` | string/null | no | Institución operadora. |
| `telefono` | string/null | no | Teléfono tal como lo publica la fuente. |
| `horario` | string/null | no | Horario, normalmente en sintaxis de OpenStreetMap. |
| `especialidad` | string/null | no | Una o más especialidades informadas. |
| `amenity` | string/null | no | Etiqueta OSM `amenity` original. |
| `healthcare` | string/null | no | Etiqueta OSM `healthcare` original. |
| `edificio` | string/null | no | Etiqueta OSM `building` original. |
| `geometria_tipo` | enum | sí | `Point`, `LineString`, `Polygon` o `MultiPolygon`. |
| `vertices` | integer | sí | Número de vértices de la geometría. |
| `centroide_latitud` | number | sí | Latitud del punto o del centro calculado. |
| `centroide_longitud` | number | sí | Longitud del punto o del centro calculado. |
| `centroide_metodo` | enum | sí | Método usado; se detalla en la siguiente sección. |
| `geometria_wkt` | string | sí | Geometría completa en WKT, con coordenadas `longitud latitud`. |
| `fuente_url` | string/null | no | URL del objeto en la fuente, cuando existe. |
| `google_maps` | string | sí | Enlace construido con el centroide recalculado. |

`tipo` no se debe usar como un catálogo único: MINSAL tiene categorías administrativas y niveles de atención más detallados que OSM. `tipo_codigo` estabiliza la escritura, pero no cambia el significado de la fuente.

Los registros con `fuente = manual` conservan la geometría dibujada por el usuario;
no se les asigna un identificador OSM ni se inventan etiquetas OSM de origen.
`fuente_url` puede indicar la publicación consultada para completar sus datos.

## Centro de masa de las geometrías

El algoritmo anterior promediaba los vértices. Ese promedio depende de cuántos nodos tenga cada borde y no representa el centro de masa del área.

El cálculo actual, implementado en `scripts/preparar_fuentes.py`, aplica estas reglas:

| Método | Registros | Regla |
|---|---:|---|
| `coordenada_original` | 1,963 | Conserva la coordenada de un `Point`. |
| `centroide_area` | 1,963 | Centroide de área por fórmula de Gauss; resta huecos y pondera todas las partes de un multipolígono. |
| `centroide_area_anillo` | 3 | Trata un `LineString` cerrado como anillo y calcula su centroide de área. |
| `centroide_linea` | 2 | Punto medio ponderado por longitud para líneas abiertas. |

El cálculo de área es planar sobre las coordenadas WGS 84. Para predios y edificios del tamaño presente en estos datos, la diferencia frente a proyectar localmente es despreciable. Un centro de masa puede quedar fuera de una forma muy cóncava; no debe interpretarse como un “punto garantizado dentro”.

Frente al promedio antiguo, cambiaron más de un metro 371 centros de Overpass, 607 de Geofabrik y 808 de HOT. El mayor ajuste fue de aproximadamente 48 metros.

## Revisión de calidad de los CSV de entrada

| Fuente | Filas | Columnas originales | Resultado |
|---|---:|---:|---|
| MINSAL | 942 | 9 | IDs y coordenadas completos y únicos. No trae dirección, teléfono, horario ni geometría de predio. |
| Overpass | 402 | 18 | IDs y geometrías únicos. Faltan municipio en 184 filas, teléfono en 385 y horario en 385. Aunque el archivo se llama `poligonos`, contiene 397 polígonos y 5 líneas. |
| Geofabrik | 945 | 10 | IDs completos y únicos. Solo aporta nombre, tipo, detalle y geometría; no trae datos administrativos ni de contacto. |
| HOT | 1,642 | 15 | IDs, departamento, municipio y coordenadas completos. Faltan dirección en 892 filas, operador en 1,542 y especialidad en 1,503. |

Todos los CSV de entrada se leen correctamente como UTF-8 con BOM y todas sus coordenadas son numéricas y están dentro de El Salvador. Los caracteres acentuados están bien almacenados; cualquier texto como `Cl�nica` mostrado por una consola indica una configuración de salida de la terminal, no corrupción del archivo.

Las tres fuentes OSM se superponen y pueden describir el mismo lugar. Se preservan como registros distintos mediante `fuente` e `id`. La deduplicación espacial y nominal debe ser una fase posterior y conservar trazabilidad hacia todas las fuentes originales.

## Validación

Las pruebas unitarias del centroide cubren polígonos con distribución desigual de vértices, huecos, multipolígonos, líneas y puntos:

```bash
python -m unittest discover -s tests -v
```
