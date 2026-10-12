# Unidades de salud según los datos del proyecto

Este documento resume **solo lo que dicen los archivos del proyecto**. No agrega información de otras fuentes. Si un dato no aparece en los archivos, se indica como "no viene en los datos".

## Archivos usados

| Fuente | Archivo | Qué trae |
|---|---|---|
| MINSAL | `data/geojson/minsal.geojson` (de `data/originales/minsal_establecimientos.csv`) | 942 establecimientos: nombre, tipo, departamento, municipio, región y coordenadas |
| OSM / Overpass | `data/originales/overpass_salud.geojson` | 402 predios con las etiquetas de OpenStreetMap: tipo, operador, especialidades, emergencia, horario, teléfono |
| Geofabrik | `data/geojson/geofabrik.geojson` | 945 elementos: nombre, tipo y geometría |
| HOT / HDX | `data/geojson/hot.geojson` | 1642 elementos: tipo, especialidad, operador, departamento, municipio |
| Directorio telefónico | `directorio-telefonico-fijo-establecimientos-region-oriental.pdf` | 168 líneas de teléfono fijo de la Región Oriental |

El CSV del MINSAL **no trae servicios, horarios ni teléfonos**: solo el nombre del tipo. Los servicios que aparecen más abajo salen de las etiquetas de OpenStreetMap (Overpass y HOT), que llenan voluntarios y solo existen para una parte de los lugares.

---

## 1. MINSAL: cómo se dividen

### Tipos de establecimiento

El nombre del tipo es tal como viene en el CSV. Algunos traen el nivel de atención entre paréntesis ("II Nivel", "III Nivel").

| Grupo | Tipo (como viene en el dato) | Cantidad |
|---|---|---:|
| **Hospitales** | Hospital Especializado (III Nivel) | 3 |
| | Hospital regional (II Nivel) | 2 |
| | Hospital departamental (II Nivel) | 14 |
| | Hospital básico (II Nivel) | 11 |
| **Unidades Comunitarias de Salud Familiar** | Unidad Comunitaria Salud Familiar Especializada (UCSFE) | 39 |
| | Unidad Comunitaria Salud Familiar Intermedia (UCSFI) | 291 |
| | Unidad Comunitaria Salud Familiar Básica (UCSFB) | 416 |
| **Comunitarios** | Casa de Salud | 61 |
| | Centro Rural de Nutrición (CRN) | 40 |
| | Hogar de Espera Materna (HEM) | 21 |
| | Centro Integral de Salud Materno Infantil y de Nutrición | 1 |
| **Emergencias** | Centro de Atención de Emergencias (CAE) | 2 |
| | Sistema de Emergencias Médicas (SEM) | 4 |
| **Administrativos y apoyo** | Nivel Administrativo Superior | 2 |
| | Nivel Administrativo I (Región) | 5 |
| | Nivel Administrativo II (SIBASI) | 17 |
| | Oficina Sanitaria Internacional (OSI) | 10 |
| | Laboratorio de Referencia Nacional | 1 |
| | Farmacia Especializada | 1 |
| | Clínica de Empleados | 1 |
| **Total** | | **942** |

### Por región

El dato trae 5 regiones.

| Tipo | Central | Metropolitana | Occidental | Oriental | Paracentral |
|---|---:|---:|---:|---:|---:|
| Hospital especializado (III) | 0 | 3 | 0 | 0 | 0 |
| Hospital regional (II) | 0 | 0 | 1 | 1 | 0 |
| Hospital departamental (II) | 2 | 3 | 2 | 3 | 4 |
| Hospital básico (II) | 1 | 1 | 2 | 5 | 2 |
| UCSFE | 7 | 5 | 7 | 15 | 5 |
| UCSFI | 51 | 32 | 54 | 90 | 64 |
| UCSFB | 50 | 29 | 90 | 146 | 101 |
| Casa de Salud | 2 | 18 | 8 | 33 | 0 |
| CRN | 9 | 4 | 6 | 5 | 16 |
| HEM | 4 | 1 | 5 | 7 | 4 |
| CAE | 0 | 2 | 0 | 0 | 0 |
| SEM | 1 | 3 | 0 | 0 | 0 |
| SIBASI | 2 | 4 | 3 | 4 | 4 |
| OSI | 1 | 1 | 5 | 2 | 1 |

### Por departamento

| Departamento | Hospitales | UCSFE | UCSFI | UCSFB | Comunitarios | Emergencias | Admin. y apoyo | Total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Ahuachapán | 1 | 2 | 15 | 37 | 6 | 0 | 3 | 64 |
| Cabañas | 2 | 2 | 11 | 23 | 7 | 0 | 1 | 46 |
| Chalatenango | 2 | 4 | 28 | 30 | 7 | 0 | 2 | 73 |
| Cuscatlán | 2 | 1 | 15 | 26 | 1 | 0 | 1 | 46 |
| La Libertad | 1 | 3 | 23 | 20 | 8 | 1 | 2 | 58 |
| La Paz | 1 | 1 | 24 | 30 | 11 | 0 | 2 | 69 |
| La Unión | 2 | 1 | 24 | 25 | 14 | 0 | 3 | 69 |
| Morazán | 1 | 5 | 16 | 34 | 11 | 0 | 1 | 68 |
| San Miguel | 3 | 5 | 25 | 30 | 13 | 0 | 2 | 78 |
| San Salvador | 7 | 5 | 32 | 29 | 23 | 5 | 11 | 112 |
| San Vicente | 1 | 1 | 14 | 22 | 1 | 0 | 2 | 41 |
| Santa Ana | 3 | 3 | 21 | 30 | 3 | 0 | 4 | 64 |
| Sonsonate | 1 | 2 | 18 | 23 | 10 | 0 | 3 | 57 |
| Usulután | 3 | 4 | 25 | 57 | 7 | 0 | 1 | 97 |

"Comunitarios" agrupa Casa de Salud, CRN, HEM y el Centro Integral Materno Infantil. "Emergencias" agrupa CAE y SEM.

### Los 30 hospitales del MINSAL

| Tipo | Hospital | Municipio | Departamento |
|---|---|---|---|
| Especializado (III) | Hospital Nacional Rosales | San Salvador | San Salvador |
| Especializado (III) | Hospital Nacional Benjamín Bloom | San Salvador | San Salvador |
| Especializado (III) | Hospital Nacional de la Mujer "Dra. María Isabel Rodríguez" | San Salvador | San Salvador |
| Regional (II) | Hospital Nacional Santa Ana "San Juan de Dios" | Santa Ana | Santa Ana |
| Regional (II) | Hospital Nacional San Miguel "San Juan de Dios" | San Miguel | San Miguel |
| Departamental (II) | Hospital Nacional Ahuachapán "Dr. Francisco Menéndez" | Ahuachapán | Ahuachapán |
| Departamental (II) | Hospital Nacional Sensuntepeque | Sensuntepeque | Cabañas |
| Departamental (II) | Hospital Nacional Chalatenango "Dr. Luis Edmundo Vásquez" | Chalatenango | Chalatenango |
| Departamental (II) | Hospital Nacional Cojutepeque "Nuestra Señora de Fátima" | Cojutepeque | Cuscatlán |
| Departamental (II) | Hospital Nacional Santa Tecla "San Rafael" | Nueva San Salvador | La Libertad |
| Departamental (II) | Hospital Nacional Zacatecoluca "Santa Teresa" | Zacatecoluca | La Paz |
| Departamental (II) | Hospital Nacional La Unión | La Unión | La Unión |
| Departamental (II) | Hospital Nacional San Francisco Gotera "Dr. Héctor Antonio Hernández Flores" | San Francisco Gotera | Morazán |
| Departamental (II) | Hospital Nacional Neumológico "Dr. José Antonio Saldaña" | San Salvador | San Salvador |
| Departamental (II) | Hospital Nacional Soyapango "Dr. José Molina Martínez" | Soyapango | San Salvador |
| Departamental (II) | Hospital Nacional Mejicanos (Zacamil) "Dr. Juan José Fernández" | Mejicanos | San Salvador |
| Departamental (II) | Hospital Nacional San Vicente "Santa Gertrudis" | San Vicente | San Vicente |
| Departamental (II) | Hospital Nacional Sonsonate "Dr. Jorge Mazzini Villacorta" | Sonsonate | Sonsonate |
| Departamental (II) | Hospital Nacional Usulután "San Pedro" | Usulután | Usulután |
| Básico (II) | Hospital Nacional Ilobasco "Dr. José Luis Saca" | Ilobasco | Cabañas |
| Básico (II) | Hospital Nacional Nueva Concepción | Nueva Concepción | Chalatenango |
| Básico (II) | Hospital Nacional Suchitoto | Suchitoto | Cuscatlán |
| Básico (II) | Hospital Nacional Santa Rosa de Lima | Santa Rosa de Lima | La Unión |
| Básico (II) | Hospital Nacional Ciudad Barrios "Monseñor Oscar Arnulfo Romero y Galdámez" | Ciudad Barrios | San Miguel |
| Básico (II) | Hospital Nacional Nueva Guadalupe | Nueva Guadalupe | San Miguel |
| Básico (II) | Hospital Nacional Ilopango "Enf. Angélica Vidal de Najarro" | Ilopango | San Salvador |
| Básico (II) | Hospital Nacional Chalchuapa | Chalchuapa | Santa Ana |
| Básico (II) | Hospital Nacional Metapán "Dr. Arturo Morales" | Metapán | Santa Ana |
| Básico (II) | Hospital Nacional Jiquilisco | Jiquilisco | Usulután |
| Básico (II) | Hospital Nacional Santiago de María "Dr. Jorge Arturo Mena" | Santiago de María | Usulután |

### Emergencias en el MINSAL

| Tipo | Nombre | Municipio |
|---|---|---|
| CAE | CAE Apopa | Apopa |
| CAE | CAE San Martín | San Martín |
| SEM | SEM Santa Tecla | Nueva San Salvador |
| SEM | SEM Montserrat | San Salvador |
| SEM | SEM Soyapango | Soyapango |
| SEM | SEM Zacamil | Mejicanos |

---

## 2. OSM / Overpass: qué servicios declaran

De los 402 predios, 389 tienen tipo de servicio: **272 clínicas**, **113 hospitales** y **4 consultorios**.

### Quién los opera

83 predios traen operador. Agrupados (en OSM el mismo operador aparece escrito de varias formas):

| Operador | Predios |
|---|---:|
| Ministerio de Salud / MINSAL / Gobierno | 63 |
| Instituto Salvadoreño del Seguro Social (ISSS) | 10 |
| Privados y fundaciones (Hospital Cáder, Hospital Ave María, Orden de Malta, Asociación Ágape, Fundación de Desarrollo Social) | 5 |
| Alcaldías (Municipal, Alcaldía de Sonsonate) | 2 |
| FAES, FOSALUD, Cruz Roja | 3 |

### Especialidades

66 predios declaran especialidades. Cuántos predios declaran cada una:

| Especialidad | Predios | Especialidad | Predios |
|---|---:|---|---:|
| Medicina general | 36 | Cardiología | 5 |
| Pediatría | 14 | Dermatología | 5 |
| Comunitaria | 11 | Medicina interna | 5 |
| **Emergencia** | 11 | Endocrinología | 5 |
| Odontología | 9 | Vacunación | 4 |
| Ginecología | 7 | Ortopedia | 4 |
| Oftalmología | 7 | Urología | 4 |
| Radiología | 7 | Nefrología | 4 |
| Cirugía | 6 | Otorrinolaringología | 4 |
| Psiquiatría | 5 | Quiropraxia | 3 |
| | | Fisiatría | 3 |

Con 1 o 2 predios: oncología, maternidad, neurocirugía, neurología, estomatología, geriatría, neumología, infectología, fototerapia, psicología, reumatología, cuidados intensivos, anestesia, hematología, gastroenterología y análisis de sangre.

### Lugares que declaran emergencia (`emergency=yes`): 30

| Lugar | Ciudad (si viene) | Operador (si viene) |
|---|---|---|
| Hospital Nacional San Juan de Dios (horario 24/7) | Santa Ana | Ministerio de Salud |
| Hospital Nacional de Sonsonate "Jorge Mazzini Villacorta" | Sonsonate | Ministerio de Salud |
| Hospital Nacional General Francisco Menéndez | | Ministerio de Salud |
| Hospital Nacional San Rafael | Santa Tecla | Ministerio de Salud |
| Hospital Nacional Dr. Luis Edmundo Vásquez | Chalatenango | MINSAL |
| Hospital Nacional Nueva Concepción | Nueva Concepción | Ministerio de Salud |
| Hospital Nacional de Ilobasco | Ilobasco | |
| Hospital Nacional de San Bartolo | San Bartolo | Ministerio de Salud |
| Hospital Nacional General y de Psiquiatría Dr. José Molina Martínez | | Ministerio de Salud |
| Hospital Nacional Dr. José Antonio Saldaña | | Gobierno de El Salvador |
| Hospital de La Mujer | San Salvador | |
| Hospital Nacional de La Unión | La Unión | |
| Hospital Nacional de San Francisco Gotera | | Ministerio de Salud |
| Centro Médico de Oriente | San Miguel | Ministerio de Salud |
| Hospital Medico Quirurgico ISSS | | |
| Hospital Regional ISSS | | |
| Hospital Regional ISSS Santa Ana | Santa Ana | ISSS |
| Hospital 1 de Mayo | San Salvador | ISSS |
| ISSS 15 de Septiembre | | |
| ISSS Atlacatl | | |
| ISSS Santa Tecla | Santa Tecla | ISSS |
| Unidad Médica Soyapango-ISSS | Soyapango | |
| Seguro Social de Puerto El Triunfo ISSS | Puerto El Triunfo | |
| Unidad de Salud de Apopa | | Ministerio de Salud |
| Unidad de Salud Barrios | | |
| Unidad de Salud Concepción Quezaltepeque | Concepción Quezaltepeque | |
| Unidad de Salud Familiar de Ilopango | | |
| Unidad de Salud Zacamil | | |
| Unidad de Salud Isla Tasajera | | Ministerio de Salud |
| Clínica Parroquial Inmaculada Concepción | Santa Tecla | |

2 predios declaran `emergency=no`.

### Horarios

17 predios traen horario. Los que dicen **24/7** (8):

- Hospital Nacional San Juan de Dios (Santa Ana)
- Hospital Cáder
- Unidad de Salud Doctor Carlos Díaz del Pinal
- Unidad de Salud Aguilar Rivas
- USCF Tonacatepeque
- Unidad de Salud Berlín
- Unidad Comunitaria de Salud Familiar "Dr. Hugo Morán Quijada"
- Un predio sin nombre

El resto tiene horario diurno (por ejemplo, de lunes a viernes de 7:00 a 17:00). 17 predios traen teléfono.

---

## 3. HOT / HDX: tipos y especialidades

### Tipos

| Tipo | Cantidad | Tipo | Cantidad |
|---|---:|---|---:|
| Farmacia | 683 | Medicina alternativa | 11 |
| Clínica | 487 | Otro | 11 |
| Hospital | 185 | Rehabilitación | 4 |
| Dentista | 155 | Banco de sangre | 3 |
| Laboratorio | 66 | Casa de parto | 2 |
| Consultorio | 29 | Otros (1 cada uno) | 6 |

Los 6 con un solo registro: optometría, promotor de salud, toma de muestras, puesto de salud, consejería y audiología.

Geometría: 912 polígonos y 730 puntos. Operador (solo 100 registros lo traen): 88 público, 8 privado, 3 privado sin fines de lucro y 1 asociación.

### Hospitales por departamento (tipo "Hospital" en HOT)

| Departamento | Hospitales | Departamento | Hospitales |
|---|---:|---|---:|
| San Salvador | 57 | Chalatenango | 8 |
| Santa Ana | 22 | Cuscatlán | 8 |
| La Libertad | 19 | La Unión | 8 |
| Sonsonate | 12 | San Vicente | 7 |
| San Miguel | 11 | La Paz | 6 |
| Usulután | 10 | Cabañas | 5 |
| Ahuachapán | 9 | Morazán | 3 |

Esta cuenta incluye hospitales públicos, del ISSS y privados; HOT no siempre dice cuál es cuál.

### Especialidades más declaradas

Medicina general (58), odontología (19), pediatría (19), comunitaria (16), **emergencia (13)**, cirugía (10), ginecología (10), medicina interna (8), dermatología (8), quiropraxia (8), oftalmología (8), radiología (8), cardiología (7) y psiquiatría (6).

### Lugares con "Emergencia" en la especialidad: 13

| Lugar | Municipio | Tipo |
|---|---|---|
| Hospital Nacional San Juan de Dios | Santa Ana | Hospital |
| Hospital Regional ISSS Santa Ana | Santa Ana | Hospital |
| Hospital Nacional General Francisco Menéndez | Ahuachapán | Hospital |
| Hospital Nacional San Rafael | Santa Tecla | Hospital |
| ISSS Santa Tecla | Santa Tecla | Hospital |
| Hospital Climosal | Santa Tecla | Hospital |
| Hospital Centro de Cirugía de Sonsonate | Sonsonate | Hospital |
| Clínica El Carmelo | Delgado | Hospital |
| Cruz Roja Salvadoreña Seccional Chalatenango | Chalatenango | Hospital |
| Unidad de Salud Concepción Quezaltepeque | Concepción Quezaltepeque | Hospital |
| Unidad de Salud Isla Tasajera | San Luis La Herradura | Hospital |
| EMERGENCIAS | San Antonio del Monte | Hospital |
| Unidad de Salud | San Alejo | Clínica |

---

## 4. Geofabrik

Solo trae nombre, tipo y geometría; no trae servicios.

| Tipo | Predio | Edificio | Punto | Total |
|---|---:|---:|---:|---:|
| Hospital | 114 | 263 | 65 | 442 |
| Clínica | 273 | 0 | 205 | 478 |
| Consultorio | 4 | 0 | 21 | 25 |

---

## 5. Directorio telefónico de la Región Oriental (PDF)

168 líneas de teléfono fijo de establecimientos del MINSAL en la Región Oriental. Incluye:

- Unidades de salud y UCSF de San Miguel, Usulután, La Unión y Morazán, que son la mayoría de las líneas.
- Oficinas SIBASI de Usulután, La Unión y Morazán, con varias líneas cada una.
- Casas de espera materna (La Unión, Anamorós, Corinto, San Gerardo, Perquín) y una casa de salud (Agua Zarca, Osicala).
- El puesto de salud de la frontera El Amatillo.
- Oficinas regionales, almacenes y el laboratorio de control de calidad de agua.

**No incluye hospitales.**

---

## 6. Qué sirve para atender a un herido, según estos datos

Solo con lo que traen los archivos:

1. **Hospitales del MINSAL (30):** 3 especializados de III nivel, 2 regionales, 14 departamentales y 11 básicos (ver la lista de arriba).
2. **CAE del MINSAL (2):** Apopa y San Martín, por ser "Centro de Atención de Emergencias".
3. **Lugares que declaran emergencia en OSM:** 30 en Overpass y 13 en HOT. Varios se repiten entre las dos fuentes, e incluyen hospitales del ISSS y algunos privados que el MINSAL no lista.
4. **Lugares 24/7 en Overpass (8)**, aunque no declaren emergencia.

Los SEM (4) aparecen en el MINSAL como "Sistema de Emergencias Médicas", no como lugar de atención.

## 7. Lo que los datos no dicen

- **Servicios de las unidades del MINSAL:** el CSV solo trae el tipo. No dice qué especialidades, horario ni si atienden emergencias.
- **Horarios y teléfonos:** solo 17 predios de Overpass los traen. El directorio PDF cubre únicamente la Región Oriental y no incluye hospitales.
- **Etiquetas de OSM:** son colaborativas y parciales. Que un lugar no tenga `emergency=yes` no significa que no atienda emergencias.
- **Repetidos entre fuentes:** las fuentes no están fusionadas, así que el mismo hospital puede aparecer en MINSAL, Overpass, Geofabrik y HOT.
