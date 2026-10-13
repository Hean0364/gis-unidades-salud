# Proceso completo de obtención, limpieza y deduplicación de unidades de salud

**Fecha de documentación:** 13 de octubre de 2026.

## 1. Propósito y alcance

Este documento describe el proceso aplicado en el proyecto para:

1. obtener datos de establecimientos de salud de cuatro fuentes;
2. convertirlos a formatos comunes;
3. calcular centroides;
4. limitar los datos al departamento de San Salvador;
5. conservar establecimientos con posible capacidad de atención a personas heridas;
6. clasificar el sector público, privado o no determinado;
7. retirar edificios internos que no representan establecimientos independientes;
8. deduplicar registros repetidos entre fuentes;
9. producir los archivos Excel y GeoJSON finales; y
10. mostrar los polígonos, puntos y centroides en el mapa web.

El resultado recomendado para análisis tabular es:

`data/unidades_salud_limpias_excel/unidades_salud_deduplicadas.xlsx`

El resultado geográfico unificado es:

`data/mapa_san_salvador/unidades_salud_deduplicadas.geojson`

El mapa final se abre desde:

`index_san_salvador.html`

> **Advertencia de uso:** el resultado es una integración de fuentes oficiales y colaborativas. Que un lugar aparezca como hospital, clínica o unidad de salud no garantiza que atienda emergencias, que esté abierto o que tenga capacidad disponible. La información debe verificarse antes de tomar decisiones operativas o trasladar pacientes.

---

## 2. Resumen de resultados

| Etapa | MINSAL | Overpass | Geofabrik | HOT/HDX | Total |
|---|---:|---:|---:|---:|---:|
| Registros nacionales preparados | 942 | 402 | 945 | 1,642 | 3,931 |
| Centroide dentro de San Salvador | 113 | 120 | 356 | 555 | 1,144 |
| Después del filtro funcional | 50 | 114 | 346 | 192 | 702 |
| Después de retirar edificios internos | 50 | 114 | 202 | 192 | 558 |

Los 558 registros conservados todavía incluyen repeticiones porque Overpass, Geofabrik y HOT derivan total o parcialmente de OpenStreetMap.

La deduplicación final produjo:

| Geometría | Antes de deduplicar | Duplicados consolidados | Resultado único |
|---|---:|---:|---:|
| Polígonos | 360 | 229 | 131 |
| Puntos | 198 | 73 | 125 |
| **Total** | **558** | **302** | **256** |

Los 256 elementos finales no significan necesariamente 256 establecimientos físicos distintos en todos los casos. En particular, un punto MINSAL y un polígono OSM cercanos no se fusionaron automáticamente, porque no se utilizó proximidad como prueba suficiente de identidad.

---

## 3. Fuentes y URLs

### 3.1 MINSAL

La fuente utilizada fue una capa pública de ArcGIS Feature Service atribuida al Ministerio de Salud de El Salvador.

- Ficha del elemento: <https://www.arcgis.com/home/item.html?id=4567409780cb478cb26ac9cc1324a16d>
- Servicio: <https://services.arcgis.com/8TF1bhVJYrFsuHwX/arcgis/rest/services/Salud_Ubicacion/FeatureServer/0>
- Consulta GeoJSON reproducible: <https://services.arcgis.com/8TF1bhVJYrFsuHwX/arcgis/rest/services/Salud_Ubicacion/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson>

La capa tiene 942 puntos. Su metadato indica que la última edición de los datos fue el 12 de octubre de 2020. Por lo tanto, aunque la descarga del proyecto se realizó posteriormente, no debe asumirse que todas las ubicaciones representan la red vigente en 2026.

Campos de origen usados:

- `OBJECTID`: identificador del registro;
- `name`: nombre del establecimiento;
- `tipo`: clasificación MINSAL;
- `dpto`: departamento;
- `muni`: municipio;
- `region`: región de salud; y
- geometría puntual.

El archivo local preparado fue:

`data/originales/minsal_establecimientos.csv`

Se renombraron campos al español normalizado, se transformó la geometría a longitud y latitud WGS 84, se conservó el `OBJECTID` como `arcgis_objectid` y se generó un enlace de Google Maps. El archivo contiene 942 filas.

La ficha de ArcGIS publica condiciones propias de visualización, consulta y uso. No se le asignó en este proyecto una licencia abierta distinta de la declarada por el propietario de la capa.

### 3.2 OpenStreetMap mediante Overpass Turbo

- Editor Overpass Turbo: <https://overpass-turbo.eu/>
- API de Overpass: <https://overpass-api.de/api/interpreter>
- Licencia y atribución OSM: <https://www.openstreetmap.org/copyright>
- Consulta guardada en el proyecto: `scripts/overpass_salud.overpassql`

La consulta buscó en todo El Salvador, usando el área con `ISO3166-1=SV`, nodos, vías y relaciones con las siguientes etiquetas:

- `amenity=hospital`;
- `amenity=clinic`;
- `amenity=health_post`;
- `amenity=doctors`;
- `healthcare=centre`;
- `healthcare=hospital`;
- `healthcare=clinic`; y
- `healthcare=health_post`.

La consulta terminó con `out geom`, por lo que se exportó la geometría completa y no solo un centro aproximado.

El resultado se guardó en:

`data/originales/overpass_salud.geojson`

El archivo registra la marca de tiempo `2026-10-09T14:44:37Z`, contiene 402 elementos y declara que los datos provienen de OpenStreetMap bajo ODbL.

Aunque la consulta contempla nodos, el archivo exportado utilizado por este proyecto quedó compuesto por 397 polígonos y 5 líneas. Las líneas cerradas se trataron como anillos cuando correspondía.

### 3.3 Geofabrik

- Página de descarga para El Salvador: <https://download.geofabrik.de/central-america/el-salvador.html>
- Shapefile libre usado como origen: <https://download.geofabrik.de/central-america/el-salvador-latest-free.shp.zip>
- Licencia y atribución: OpenStreetMap, ODbL.

La URL contiene la palabra `latest`, por lo que una descarga futura puede producir resultados distintos. La colección local registra como fecha de datos el 5 de octubre de 2026.

Del ZIP se leyeron tres capas:

| Capa Geofabrik | Campo revisado | Valores admitidos inicialmente | Detalle asignado |
|---|---|---|---|
| `gis_osm_pois_a_free_1` | `fclass` | `hospital`, `clinic`, `doctors` | Predio |
| `gis_osm_buildings_a_free_1` | `type` | `hospital` | Edificio |
| `gis_osm_pois_free_1` | `fclass` | `hospital`, `clinic`, `doctors` | Punto |

Durante esta extracción se descartaron nombres que indicaban claramente otro uso: farmacia, odontología o dentista, veterinaria, residencia, hogar de ancianos, `nursing` o asilo. También se evitó repetir el mismo identificador OSM entre las capas poligonales de predios y edificios.

El resultado nacional preparado contiene 945 elementos:

- 478 clínicas;
- 442 hospitales; y
- 25 consultorios.

Sus archivos principales son:

- `data/geojson/geofabrik.geojson`;
- `data/tablas/geofabrik_salud.csv`; y
- `data/mapa/geofabrik.js`.

El ZIP original de Geofabrik no quedó versionado en el repositorio; para una regeneración futura debe volver a descargarse. Para reproducir exactamente la edición local sería preferible conservar una copia fechada, porque el enlace `latest` cambia.

### 3.4 HOT / HDX

- Página del conjunto: <https://data.humdata.org/dataset/hotosm_slv_health_facilities>
- API de metadatos: <https://data.humdata.org/api/3/action/package_show?id=hotosm_slv_health_facilities>
- Descarga GeoJSON usada: <https://production-raw-data-api.s3.amazonaws.com/ISO3/SLV/health_facilities/hotosm_slv_health_facilities_osm_geojson.zip>
- Licencia: Open Database License, ODC-ODbL 1.0.

Se utilizó la instantánea con fecha 7 de octubre de 2026. Del ZIP se leyó `health_facilities.geojson`.

HOT/HDX es también una exportación de OpenStreetMap. Incluye hospitales y clínicas, pero además farmacias, dentistas, laboratorios, consultorios y otros servicios de salud. Después de validar geometría y centroide quedaron 1,642 elementos nacionales.

El proceso normalizó:

- tipo de establecimiento a partir de `amenity` y `healthcare`;
- tipo de operador;
- especialidades separadas por punto y coma;
- departamento y municipio de los campos administrativos HOT;
- geometría, identificador OSM y enlaces de consulta.

Sus archivos principales son:

- `data/geojson/hot.geojson`;
- `data/tablas/hot_salud.csv`; y
- `data/mapa/hot.js`.

El ZIP original tampoco quedó versionado. El enlace de descarga se actualiza periódicamente, por lo que una ejecución futura puede cambiar los conteos.

### 3.5 Límite departamental

Para decidir espacialmente qué elementos pertenecían a San Salvador se utilizó geoBoundaries ADM1 para El Salvador.

- API: <https://www.geoboundaries.org/api/current/gbOpen/SLV/ADM1/>
- GeoJSON de la edición utilizada: <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/SLV/ADM1/geoBoundaries-SLV-ADM1.geojson>
- Fuente de la geometría declarada por geoBoundaries: OpenStreetMap.
- Año representado: 2021.
- Licencia declarada: CC BY-SA 2.0.

Los 14 departamentos se guardaron en:

`data/geojson/departamentos.geojson`

El polígono de San Salvador se separó en:

`data/mapa_san_salvador/departamento.geojson`

---

## 4. Preparación nacional de las cuatro fuentes

El script principal de preparación es:

`scripts/preparar_fuentes.py`

Sus responsabilidades son:

- leer MINSAL y convertir sus coordenadas en puntos GeoJSON;
- leer el GeoJSON exportado por Overpass;
- clasificar tipos OSM;
- calcular centroides y cantidad de vértices;
- generar geometría WKT;
- crear enlaces al objeto OSM y a Google Maps;
- importar las capas seleccionadas de Geofabrik;
- importar el ZIP de HOT/HDX;
- escribir GeoJSON, CSV, KML y envoltorios JavaScript para el mapa.

Las fuentes se mantuvieron separadas en esta etapa. No se deduplicaron registros de MINSAL contra OSM ni se fusionaron Overpass, HOT y Geofabrik.

### 4.1 Clasificación básica de tipos OSM

Para Overpass se aplicaron estas reglas principales:

- `amenity=hospital` o `healthcare=hospital` → **Hospital**;
- `amenity=clinic` o `healthcare=clinic` → **Clínica**;
- `amenity=doctors`, `healthcare=doctor` o `healthcare=centre` → **Consultorio**;
- `amenity=health_post` o `healthcare=health_post` → **Puesto de salud**.

HOT tiene un catálogo más amplio de equivalencias para farmacia, dentista, laboratorio, rehabilitación, banco de sangre, casa de parto, optometría, audiología y otros tipos. Estas categorías se conservaron en la colección nacional, aunque varias se excluyeron después del resultado operativo de San Salvador.

---

## 5. Cálculo de centroides

Todos los cálculos usan coordenadas WGS 84, `EPSG:4326`, en orden GeoJSON `[longitud, latitud]`. En las tablas finales se escriben por separado como `centroide_latitud` y `centroide_longitud`.

La implementación está en `geom_centroid()` dentro de `scripts/preparar_fuentes.py`.

### 5.1 Puntos

Un punto conserva su coordenada original:

`centroide_metodo = coordenada_original`

No se desplaza ni se promedia con otros registros.

### 5.2 Polígonos

El centroide de cada anillo se calcula con la fórmula de Gauss o *shoelace*.

Para cada par consecutivo de vértices se calcula:

`cruce_i = x_i * y_(i+1) - x_(i+1) * y_i`

Luego:

`A = 1/2 * Σ cruce_i`

`Cx = 1/(6A) * Σ (x_i + x_(i+1)) * cruce_i`

`Cy = 1/(6A) * Σ (y_i + y_(i+1)) * cruce_i`

Antes de operar, el código traslada temporalmente los vértices cerca del origen para reducir cancelación numérica en polígonos pequeños expresados con longitudes y latitudes de valores absolutos grandes.

Reglas adicionales:

- el anillo exterior aporta área positiva;
- los huecos se restan usando el valor absoluto de su área, sin depender de la orientación de sus vértices;
- si el anillo es degenerado, se usa el promedio de sus puntos como respaldo; y
- el método se registra como `centroide_area`.

### 5.3 Multipolígonos

Se calcula el centroide y área de cada polígono. El centroide final es el promedio ponderado por el área de todas las partes. No se usa únicamente la primera parte del multipolígono.

### 5.4 Líneas

- Una línea cerrada con al menos cuatro coordenadas se trata como un anillo y usa centroide de área: `centroide_area_anillo`.
- Una línea abierta usa el punto medio de cada segmento, ponderado por la longitud del segmento: `centroide_linea`.
- Para aproximar la longitud en coordenadas geográficas, la diferencia de longitud se ajusta con el coseno de la latitud media del segmento.

### 5.5 Conteos nacionales por método

| Fuente | Coordenada original | Centroide de área | Área de anillo | Centroide de línea |
|---|---:|---:|---:|---:|
| MINSAL | 942 | 0 | 0 | 0 |
| Overpass | 0 | 397 | 3 | 2 |
| Geofabrik | 291 | 654 | 0 | 0 |
| HOT/HDX | 730 | 912 | 0 | 0 |

### 5.6 Limitación matemática

El centroide se calcula directamente sobre grados de longitud y latitud, no sobre una proyección métrica ni sobre un elipsoide. Para predios pequeños la aproximación es práctica, pero no debe utilizarse como cálculo geodésico de alta precisión. Además, el centroide geométrico de un polígono muy cóncavo puede quedar fuera de su superficie; no es un algoritmo de “punto garantizado dentro del polígono”.

### 5.7 Pruebas automatizadas

`tests/test_centroides.py` comprueba:

1. ponderación de un polígono por área y no por cantidad de vértices;
2. resta correcta de huecos sin depender de orientación;
3. ponderación de todas las partes de un multipolígono;
4. ponderación de líneas por longitud de segmento; y
5. conservación exacta de puntos.

---

## 6. Normalización tabular nacional

El script:

`scripts/normalizar_csv.py`

combina los atributos tabulares con las geometrías preparadas y genera un contrato uniforme de 27 campos. Entre ellos:

- identificadores globales y de fuente;
- nombre, tipo y códigos normalizados;
- departamento, municipio y región;
- dirección, operador, teléfono, horario y especialidad;
- etiquetas OSM;
- tipo de geometría y vértices;
- centroide y método;
- geometría WKT; y
- enlaces de origen y Google Maps.

También valida que:

- exista una geometría para cada fila;
- no sobren geometrías sin fila CSV;
- los centroides estén en rangos válidos;
- los identificadores globales no se repitan; y
- los campos obligatorios no estén vacíos.

Ejecución:

```bash
python scripts/normalizar_csv.py
```

Salidas:

| Archivo | Filas |
|---|---:|
| `data/normalizados/minsal.csv` | 942 |
| `data/normalizados/overpass.csv` | 402 |
| `data/normalizados/geofabrik.csv` | 945 |
| `data/normalizados/hot.csv` | 1,642 |
| `data/normalizados/establecimientos_salud.csv` | 3,931 |

En esta salida nacional combinada todavía no se deduplican fuentes.

---

## 7. Conversión de tablas originales a Excel

Los CSV fuente se convirtieron a libros XLSX sin eliminar los CSV originales:

| XLSX | Filas |
|---|---:|
| `data/tablas_originales_excel/minsal_establecimientos.xlsx` | 942 |
| `data/tablas_originales_excel/overpass_poligonos.xlsx` | 402 |
| `data/tablas_originales_excel/geofabrik_salud.xlsx` | 945 |
| `data/tablas_originales_excel/hot_salud.xlsx` | 1,642 |

Estos libros representan las tablas nacionales preparadas antes del filtro de San Salvador.

---

## 8. Selección espacial de San Salvador

La selección se realizó usando el centroide calculado de cada geometría y el polígono departamental de geoBoundaries.

El campo de auditoría de los libros limpios registra:

`Centroide dentro del límite departamental GeoJSON`

Este criterio se usó incluso cuando una fuente ya traía el nombre de un departamento. La etiqueta administrativa original se conservó en `departamento_fuente`, pero la inclusión espacial se decidió con el límite GeoJSON.

Conteos obtenidos antes del filtro funcional:

- MINSAL: 113;
- Overpass: 120;
- Geofabrik: 356; y
- HOT/HDX: 555.

Esta decisión tiene una limitación: una geometría que cruce el límite queda asignada según la posición de su centroide, no por porcentaje de área ni por cualquier intersección mínima.

---

## 9. Filtro funcional: qué se conservó y qué se eliminó

El objetivo fue aproximar establecimientos con capacidad de atención a personas heridas. No es una certificación clínica de servicios.

Se tomó una decisión conservadora adicional: **las clínicas se conservaron**, aunque su capacidad real puede ir desde atención básica hasta servicios más completos. Tampoco se eliminaron establecimientos por ser privados.

### 9.1 MINSAL

Se conservaron 50 puntos:

| Tipo | Conservados |
|---|---:|
| Unidad Comunitaria de Salud Familiar Intermedia (UCSFI) | 32 |
| Unidad Comunitaria de Salud Familiar Especializada (UCSFE) | 5 |
| Hospital departamental (II nivel) | 3 |
| Hospital especializado (III nivel) | 3 |
| Sistema de Emergencias Médicas (SEM) | 3 |
| Centro de Atención de Emergencias (CAE) | 2 |
| Hospital básico (II nivel) | 1 |
| Clínica de Empleados | 1 |

Se eliminaron 63 registros dentro del límite porque eran atención básica, apoyo, nutrición, alojamiento materno, farmacia, laboratorio, control sanitario o administración, y no se consideraron destinos principales para atención de heridos:

| Tipo eliminado | Cantidad | Motivo resumido |
|---|---:|---|
| UCSF Básica (UCSFB) | 29 | Primeros auxilios y referencia; capacidad limitada |
| Casa de Salud | 17 | Atención comunitaria básica, no destino de trauma |
| Centro Rural de Nutrición (CRN) | 6 | Nutrición, no atención de heridos |
| Nivel Administrativo II (SIBASI) | 4 | Administración |
| Nivel Administrativo Superior | 2 | Administración |
| Nivel Administrativo I (Región) | 1 | Administración |
| Laboratorio de Referencia Nacional | 1 | Diagnóstico de laboratorio |
| Oficina Sanitaria Internacional (OSI) | 1 | Control sanitario |
| Hogar de Espera Materna (HEM) | 1 | Alojamiento materno |
| Farmacia Especializada | 1 | Dispensación de medicamentos |

### 9.2 Overpass

Dentro del límite había 120 elementos. Se conservaron:

- 76 clínicas; y
- 38 hospitales.

Se eliminaron 6:

- 2 consultorios; y
- 4 elementos con tipo genérico `OSM`, sin evidencia suficiente para clasificarlos como hospital o clínica.

Resultado: 114 polígonos.

### 9.3 Geofabrik antes de revisar edificios internos

Dentro del límite había 356 elementos. Se eliminaron 10 consultorios y se conservaron inicialmente:

- 133 clínicas; y
- 213 hospitales.

Resultado provisional: 346 elementos.

Posteriormente se aplicó el proceso geométrico especial descrito en la sección 11, por lo que el resultado final de esta fuente bajó a 202.

### 9.4 HOT/HDX

Dentro del límite había 555 elementos. Se conservaron:

- 135 clínicas;
- 56 hospitales; y
- 1 elemento de tipo `Otro`, conservado porque su nombre es **Unidad de Salud Villa Mariona**.

Se eliminaron 363 registros que correspondían a servicios que no eran el destino buscado:

| Tipo eliminado | Cantidad |
|---|---:|
| Farmacia | 262 |
| Dentista | 63 |
| Laboratorio | 18 |
| Consultorio | 10 |
| Medicina alternativa | 6 |
| Rehabilitación | 1 |
| Toma de muestras | 1 |
| Banco de sangre | 1 |
| Audiología | 1 |

Resultado: 192 elementos.

### 9.5 Lo que no fue criterio de eliminación

No se eliminó un registro solo por:

- ser privado;
- no tener nombre;
- carecer de teléfono u horario;
- estar cerca de otro establecimiento; o
- tener un nombre parecido a otro.

---

## 10. Clasificación público, privado o no determinado

Esta clasificación se agregó como información descriptiva; no se usó para excluir establecimientos.

### 10.1 MINSAL

Todos los registros MINSAL se marcaron como:

- `sector = Público`;
- `es_privado = No`; y
- `criterio_clasificacion = Fuente oficial MINSAL`.

### 10.2 Fuentes OSM

Se revisaron el nombre y, cuando existía, el operador. Algunos indicadores públicos fueron:

- Ministerio de Salud;
- Hospital Nacional;
- Unidad de Salud;
- Unidad Comunitaria de Salud;
- ISSS o Instituto Salvadoreño del Seguro Social;
- FOSALUD;
- Hospital Militar; y
- operador municipal o declarado como público.

Indicadores privados o no lucrativos incluyeron:

- operador declarado como privado;
- operador declarado como privado sin fines de lucro; y
- Cruz Roja.

Cuando no hubo evidencia suficiente se escribió:

- `sector = No determinado`; y
- `es_privado = No determinado`.

Esta precaución evita asumir que toda clínica sin operador es privada o pública.

Conteos de las capas limpias:

| Fuente | Público | Privado | Privado sin fines de lucro | No determinado |
|---|---:|---:|---:|---:|
| MINSAL | 50 | 0 | 0 | 0 |
| Overpass | 41 | 0 | 0 | 73 |
| Geofabrik | 52 | 0 | 2 | 148 |
| HOT/HDX | 55 | 2 | 2 | 133 |

---

## 11. Eliminación de edificios internos de Geofabrik

La primera capa limpia de Geofabrik tenía 346 elementos:

- 115 predios;
- 158 edificios; y
- 73 puntos.

Se detectó que muchos edificios etiquetados como `hospital` eran construcciones internas de un predio sanitario ya representado. Contarlos como establecimientos independientes inflaba el resultado; por ejemplo, un mismo hospital podía aparecer como predio general y además como consulta externa, pabellón u otro edificio interno.

### 11.1 Criterio usado

Solo se retiró un edificio cuando su geometría estaba **completamente contenida** dentro de un predio Geofabrik conservado.

No se usó:

- cercanía del centroide;
- distancia arbitraria;
- intersección parcial; ni
- semejanza de nombres como única prueba.

La validación topológica eliminó 144 edificios, todos de tipo hospital:

- 143 tenían sector no determinado; y
- 1 estaba clasificado como público.

### 11.2 Edificios que se conservaron

Quedaron 14 edificios porque no estaban completamente contenidos en otro predio Geofabrik y podían representar instalaciones independientes:

| OSM ID | Nombre |
|---|---|
| `way/399501580` | Centro de Atención de Emergencias |
| `way/400014005` | Cruz Roja Salvadoreña |
| `way/329149250` | Diagnostico |
| `way/399696937` | Hospital Bautista |
| `way/400818634` | Hospital Médico Familiar |
| `way/399508488` | Hospital Paravida |
| `way/722678927` | Hospital Policlinico Arce ISSS |
| `way/8776650` | Hospital Pro Familia |
| `way/435907322` | Oncologia ISSS |
| `way/1208406964` | Sin nombre |
| `way/1463787670` | Sin nombre |
| `way/1529920230` | Sin nombre |
| `way/1534982706` | Sin nombre |
| `way/290099680` | Sin nombre |

El resultado Geofabrik final contiene 202 elementos:

- 115 predios;
- 14 edificios; y
- 73 puntos.

---

## 12. Archivos Excel limpios por fuente

Cada libro usa una hoja `San Salvador` y un esquema común de 33 columnas. Incluye campos de auditoría como fuente, método de asignación departamental, criterio de clasificación, geometría, centroide, WKT y enlaces.

| Archivo | Filas |
|---|---:|
| `data/unidades_salud_limpias_excel/minsal_san_salvador_limpio.xlsx` | 50 |
| `data/unidades_salud_limpias_excel/overpass_san_salvador_limpio.xlsx` | 114 |
| `data/unidades_salud_limpias_excel/geofabrik_san_salvador_limpio.xlsx` | 202 |
| `data/unidades_salud_limpias_excel/hot_san_salvador_limpio.xlsx` | 192 |

También se creó un libro sin deduplicar, con una hoja por fuente:

`data/unidades_salud_limpias_excel/unidades_salud_san_salvador_4_fuentes.xlsx`

Sus hojas son `MINSAL`, `HOT`, `Geofabrik` y `Overpass`, con 558 filas en total.

---

## 13. Deduplicación entre fuentes

### 13.1 Razón

Overpass, HOT y Geofabrik contienen datos de OpenStreetMap. El mismo objeto OSM puede aparecer en las tres fuentes con el mismo ID y geometría, con el orden de vértices invertido o con pequeñas diferencias de serialización. Sin consolidación, el mapa contaría varias veces el mismo objeto.

### 13.2 Reglas conservadoras

Se separaron puntos y polígonos; nunca se fusionó un punto con un polígono solo por cercanía.

Se consideraron coincidencias mediante:

1. identificador OSM compartido y geometría exactamente equivalente;
2. equivalencia geométrica del polígono, tolerando diferencias de representación que no cambian su forma, como orientación inversa del anillo; o
3. polígono geométricamente equivalente y nombre exactamente equivalente.

No se usaron radios de proximidad, coincidencia difusa de nombres ni supuestos del tipo “el punto MINSAL más cercano debe ser este polígono”. Esto reduce falsos positivos, aunque deja algunos establecimientos físicos representados una vez como punto MINSAL y otra como polígono OSM.

### 13.3 Selección del registro conservado

Cada grupo mantiene un registro representativo y registra toda su procedencia. Cuando los candidatos quedaban empatados en la selección, se utilizó esta prioridad:

1. Overpass;
2. HOT;
3. Geofabrik; y
4. MINSAL.

Los campos de trazabilidad agregados son:

- `fuente_conservada`;
- `fuentes_coincidentes`;
- `ids_fuente`; y
- `cantidad_fuentes`.

Que una fuente figure como “conservada” no elimina la información de procedencia de las demás.

### 13.4 Resultado de polígonos

Se partió de 360 polígonos:

- Overpass: 114;
- Geofabrik: 129; y
- HOT: 117.

Se consolidaron 229 repeticiones y quedaron 131 polígonos únicos.

Procedencia de los 131 registros representativos:

| Fuente conservada | Polígonos |
|---|---:|
| Overpass | 77 |
| HOT | 40 |
| Geofabrik | 14 |

De los 131 polígonos:

- 112 tienen coincidencias en tres fuentes;
- 5 tienen coincidencias en dos fuentes; y
- 14 aparecen en una sola fuente, todos ellos los edificios Geofabrik independientes descritos anteriormente.

### 13.5 Resultado de puntos

Se partió de 198 puntos:

- MINSAL: 50;
- Geofabrik: 73; y
- HOT: 75.

Los 73 puntos Geofabrik coincidían con puntos HOT del mismo objeto OSM. Se consolidaron y quedaron 125 puntos:

- 75 representados por HOT; y
- 50 puntos MINSAL conservados independientemente.

De los 125 puntos:

- 73 tienen coincidencia HOT + Geofabrik;
- 2 aparecen solamente en HOT; y
- 50 aparecen solamente en MINSAL.

### 13.6 Libro final

El libro final es:

`data/unidades_salud_limpias_excel/unidades_salud_deduplicadas.xlsx`

Contiene:

- hoja `Poligonos`: 131 filas;
- hoja `Puntos`: 125 filas; y
- total: 256 filas.

Cada hoja tiene 37 columnas: las 33 columnas normalizadas y 4 campos adicionales de procedencia.

Los archivos anteriores no se reemplazaron: las tablas por fuente y el libro de cuatro hojas se conservaron para auditoría.

---

## 14. GeoJSON y mapa unificado

Se generaron:

- `data/mapa_san_salvador/unidades_salud_deduplicadas.geojson`;
- `data/mapa_san_salvador/unidades_salud_deduplicadas.js`;
- `index_san_salvador.html`; y
- `js/app_san_salvador.js`.

El archivo `.js` asigna el mismo GeoJSON a `window.UNIFICADO_GEOJSON`. Esto permite abrir el mapa con archivos locales sin depender de una solicitud `fetch` que algunos navegadores bloquean bajo `file://`.

La capa **Unificado (sin duplicados)** está habilitada al iniciar. Las cuatro capas originales siguen disponibles, pero deshabilitadas por defecto, para comparar el resultado consolidado con cada fuente.

El mapa permite:

- activar o desactivar fuentes;
- filtrar por tipo;
- filtrar la capa unificada por fuente principal;
- consultar procedencia e identificadores originales;
- abrir el objeto original o Google Maps;
- alternar mapas base OSM, HOT y satélite Esri; y
- visualizar el límite de San Salvador.

Tecnologías y servicios de visualización:

- Leaflet 1.9.4: <https://unpkg.com/leaflet@1.9.4/dist/leaflet.js>
- teselas OSM: <https://tile.openstreetmap.org/>
- teselas HOT: <https://tile.openstreetmap.fr/hot/>
- imágenes Esri World Imagery: <https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer>

---

## 15. Último cambio: centroides visibles en el mapa nuevo

Al GeoJSON unificado se agregaron para los 256 registros:

- `centroide_latitud`;
- `centroide_longitud`; y
- `centroide_metodo`.

En el caso de los 125 puntos, estas coordenadas coinciden con la ubicación original. En el caso de los 131 polígonos, corresponden al centroide de área.

El mapa muestra un marcador adicional para cada centroide de polígono:

- círculo amarillo;
- borde oscuro;
- texto emergente `Centroide · nombre`; y
- ventana de información con `Representación = Centroide del polígono` y el método de cálculo.

Los centroides usan los mismos filtros y estado de visibilidad que el polígono al que pertenecen. Los 125 puntos originales continúan mostrándose como puntos; no se les agrega un segundo marcador superpuesto.

La capa unificada contiene ahora:

- 131 polígonos;
- 131 marcadores visuales de centroides de esos polígonos; y
- 125 puntos originales.

Los marcadores de centroide son una representación visual adicional: no aumentan el conteo de 256 establecimientos/geometrías únicas.

---

## 16. Validaciones realizadas

Se comprobaron los siguientes aspectos:

- los 5 casos de prueba de centroides pasan;
- todos los GeoJSON se pueden interpretar como JSON;
- los XLSX tienen estructura ZIP válida;
- `js/app.js`, `js/app_san_salvador.js` y el JavaScript de la capa unificada pasan `node --check`;
- el GeoJSON unificado contiene 131 polígonos y 125 puntos;
- los 131 polígonos tienen coordenadas de centroide;
- los 256 registros tienen método y coordenadas de centroide; y
- no quedan duplicados exactos según los criterios aplicados.

Comandos principales de validación:

```bash
python -m unittest discover -s tests -v
node --check js/app.js
node --check js/app_san_salvador.js
node --check data/mapa_san_salvador/unidades_salud_deduplicadas.js
```

Para revisar el mapa mediante un servidor local:

```bash
python -m http.server 8000
```

Luego abrir:

`http://localhost:8000/index_san_salvador.html`

---

## 17. Reproducibilidad y asuntos pendientes

Los pasos nacionales de preparación, normalización y cálculo de centroides están implementados en scripts versionados. Sin embargo, el filtrado específico de San Salvador, la creación de los XLSX limpios, la validación de edificios contenidos y la deduplicación final se ejecutaron como transformaciones de preparación de datos y actualmente no están reunidos en un único script reproducible.

Para una reproducción futura completamente automática se recomienda:

1. crear un script único para el filtro departamental y funcional;
2. incorporar la eliminación topológica de edificios internos;
3. incorporar las reglas de deduplicación y procedencia;
4. generar todos los XLSX y GeoJSON desde ese script;
5. conservar copias fechadas de los ZIP de Geofabrik y HOT; y
6. guardar fecha, URL y hash SHA-256 de cada descarga.

Sin esas copias fechadas, volver a usar URLs dinámicas como `latest` puede producir resultados diferentes aun ejecutando las mismas reglas.

---

## 18. Limitaciones finales

1. **Actualización:** MINSAL tiene metadatos de edición de 2020; OSM, HOT y Geofabrik cambian continuamente.
2. **Cobertura:** OSM es colaborativo y no exhaustivo. La cobertura urbana suele ser mayor que la rural.
3. **Servicios reales:** el tipo de establecimiento no confirma emergencia, horario, personal, insumos ni disponibilidad.
4. **Clínicas:** se conservaron por decisión del proyecto, aunque algunas solo atiendan casos leves o especialidades concretas.
5. **Clasificación de sector:** cuando no había evidencia se dejó `No determinado`; no debe inferirse propiedad privada por ausencia de datos.
6. **Centroides:** son centroides matemáticos en EPSG:4326 y pueden quedar fuera de polígonos cóncavos.
7. **Límite departamental:** la asignación usa el centroide; un predio que cruce el límite no se reparte por área.
8. **Deduplicación conservadora:** no usar proximidad evita fusiones incorrectas, pero puede dejar un mismo establecimiento físico como punto MINSAL y polígono OSM.
9. **Edificios internos:** se retiraron únicamente cuando estaban completamente contenidos; otros edificios potencialmente relacionados permanecieron para no borrar instalaciones independientes.
10. **Uso operativo:** antes de trasladar a una persona herida debe verificarse directamente la capacidad del establecimiento o utilizarse el sistema oficial de emergencias.

---

## 19. Inventario de archivos clave

### Orígenes y consultas

- `data/originales/minsal_establecimientos.csv`
- `data/originales/overpass_salud.geojson`
- `scripts/overpass_salud.overpassql`

### Preparación nacional

- `scripts/preparar_fuentes.py`
- `scripts/normalizar_csv.py`
- `data/geojson/minsal.geojson`
- `data/geojson/overpass.geojson`
- `data/geojson/geofabrik.geojson`
- `data/geojson/hot.geojson`
- `data/normalizados/establecimientos_salud.csv`

### Límite

- `data/geojson/departamentos.geojson`
- `data/mapa_san_salvador/departamento.geojson`

### Excel de San Salvador

- `data/unidades_salud_limpias_excel/minsal_san_salvador_limpio.xlsx`
- `data/unidades_salud_limpias_excel/overpass_san_salvador_limpio.xlsx`
- `data/unidades_salud_limpias_excel/geofabrik_san_salvador_limpio.xlsx`
- `data/unidades_salud_limpias_excel/hot_san_salvador_limpio.xlsx`
- `data/unidades_salud_limpias_excel/unidades_salud_san_salvador_4_fuentes.xlsx`
- `data/unidades_salud_limpias_excel/unidades_salud_deduplicadas.xlsx`

### Mapa final

- `data/mapa_san_salvador/unidades_salud_deduplicadas.geojson`
- `data/mapa_san_salvador/unidades_salud_deduplicadas.js`
- `index_san_salvador.html`
- `js/app_san_salvador.js`

### Pruebas y contratos

- `tests/test_centroides.py`
- `docs/establecimiento.schema.json`
- `docs/estandar_datos_api.md`

---

**Estado al cierre de esta documentación:** el resultado deduplicado tiene 256 elementos, los 131 polígonos muestran su centroide en el mapa y los cambios de centroides y este documento permanecen locales, sin commit ni push.
