# Clasificación de las unidades de salud en El Salvador

Guía de cómo se organiza la red pública de salud (MINSAL) y qué servicios suele tener cada tipo de establecimiento que aparece en este proyecto.

> **Aviso:** los servicios descritos son los *típicos* de cada categoría. No todos los establecimientos del mismo tipo tienen lo mismo, y los horarios cambian. Antes de mover a un paciente, confirma por teléfono. Ante una emergencia, llama al **132** (Sistema de Emergencias Médicas).

Los conteos salen de `data/geojson/minsal.geojson` (942 establecimientos).

---

## 1. Cómo está organizada la red

El MINSAL trabaja con las **Redes Integrales e Integradas de Salud (RIIS)**. Los establecimientos se ordenan en **niveles de atención**: el paciente entra por el más cercano y, si hace falta, se le *refiere* (traslada) al nivel siguiente.

| Nivel | Qué atiende | Establecimientos |
|---|---|---|
| **Primer nivel** | Prevención, consulta general, control de embarazo y niño sano, vacunas, curaciones | UCSF Básica, Intermedia y Especializada; Casa de Salud; CRN; HEM |
| **Segundo nivel** | Hospitalización, cirugía, partos, emergencias, especialidades básicas | Hospitales básicos, departamentales y regionales |
| **Tercer nivel** | Casos complejos, subespecialidades y referencia nacional | Hospitales especializados (Rosales, Bloom, de la Mujer) |
| **Emergencias** | Atención prehospitalaria y estabilización | SEM, CAE |
| **Administrativo** | Gestión, vigilancia, control sanitario; no atienden pacientes | Ministerio, Regiones, SIBASI, OSI |

El país se divide en **5 regiones de salud**: Occidental, Central, Paracentral, Metropolitana y Oriental. Cada región se subdivide en **SIBASI** (Sistemas Básicos de Salud Integral), que coordinan las unidades de un departamento o zona.

---

## 2. Primer nivel de atención

### UCSF Básica (UCSFB): 416
Unidad Comunitaria de Salud Familiar Básica. Es la más pequeña y la más numerosa, sobre todo en zonas rurales.

- Consulta de medicina general (a veces no todos los días).
- Enfermería: curaciones, inyecciones, control de presión.
- Vacunación, control prenatal, control de niño sano, planificación familiar.
- Promotores de salud que visitan las comunidades.
- **Para heridos:** solo primeros auxilios y referencia.

### UCSF Intermedia (UCSFI): 291
Más personal y horario más amplio que la básica.

- Medicina general todos los días hábiles.
- Odontología en muchas de ellas.
- Enfermería, farmacia, y en algunas laboratorio básico.
- Programas preventivos (vacunas, embarazo, crónicos como diabetes e hipertensión).
- **Para heridos:** heridas leves (suturas, curaciones) en horario de atención.

### UCSF Especializada (UCSFE): 39
La unidad de primer nivel más completa; funciona como cabecera de su zona.

- Especialistas: medicina interna, pediatría, ginecología.
- Odontología, laboratorio clínico, farmacia; algunas tienen rayos X y fisioterapia.
- Varias tienen horario extendido o atención de emergencias, que no siempre es de 24 horas.
- **Para heridos:** heridas moderadas y estabilización antes de trasladar.

### Casa de Salud: 61
Local comunitario en caseríos o cantones lejanos.

- Atención por promotor o personal de enfermería en días específicos.
- Vacunación, control de peso y talla, entrega de medicamentos básicos.
- **Para heridos:** no; solo orientación y primeros auxilios.

### Centro Rural de Nutrición (CRN): 40
- Vigilancia del crecimiento y la nutrición de niños pequeños.
- Educación alimentaria a madres.
- **Para heridos:** no.

### Hogar de Espera Materna (HEM): 21
- Alojamiento para embarazadas de zonas lejanas en los días previos al parto, cerca de un hospital.
- **Para heridos:** no.

### Centro Integral de Salud Materno Infantil y de Nutrición: 1
- Atención a madres, embarazadas y niños; nutrición.

---

## 3. Segundo nivel: hospitales

### Hospital básico: 11
- Las cuatro especialidades básicas: medicina interna, cirugía general, pediatría y ginecología/obstetricia.
- Emergencia, hospitalización, partos, cirugías sencillas.
- **Para heridos:** sí; estabiliza y opera casos no complejos.

### Hospital departamental: 14
- Lo mismo que el básico, más especialidades (ortopedia, anestesiología, etc., según el hospital).
- Emergencia 24 horas, quirófanos, laboratorio, rayos X, a veces cuidados intermedios.
- **Para heridos:** sí; es la opción fuerte fuera de la capital.

### Hospital regional: 2
- **San Juan de Dios de Santa Ana** (occidente) y **San Juan de Dios de San Miguel** (oriente).
- Subespecialidades, cuidados intensivos, referencia de toda su región.
- **Para heridos:** sí, incluso graves.

---

## 4. Tercer nivel: hospitales especializados: 3

Todos en San Salvador; reciben los casos más complejos del país.

| Hospital | Atiende |
|---|---|
| **Hospital Nacional Rosales** | Adultos; trauma mayor, cirugía especializada, cuidados intensivos |
| **Hospital Nacional de Niños Benjamín Bloom** | Niños y adolescentes; trauma, quemados, cirugía pediátrica |
| **Hospital Nacional de la Mujer "Dra. María Isabel Rodríguez"** | Embarazadas de alto riesgo, ginecología, neonatología |

---

## 5. Emergencias

### Sistema de Emergencias Médicas (SEM): 4
- Bases de ambulancias: Santa Tecla, Montserrat, Soyapango y Zacamil.
- No son lugares a donde llevar al paciente: se llama al **132** y despachan la ambulancia.

### Centro de Atención de Emergencias (CAE): 2
- **Apopa** y **San Martín**.
- Atención de emergencias y estabilización antes de trasladar a un hospital.

---

## 6. Administrativo y apoyo (no atienden pacientes)

| Tipo | Cantidad | Función |
|---|---|---|
| Nivel Administrativo Superior | 2 | Oficinas centrales del Ministerio |
| Nivel Administrativo I (Región) | 5 | Sede de cada región de salud |
| Nivel Administrativo II (SIBASI) | 17 | Coordinación departamental de las unidades |
| Oficina Sanitaria Internacional (OSI) | 10 | Control sanitario en fronteras, puertos y aeropuerto; vacunación de viajeros |
| Laboratorio de Referencia Nacional | 1 | Análisis especializados y vigilancia epidemiológica |
| Farmacia Especializada | 1 | Medicamentos de alto costo o especiales |
| Clínica de Empleados | 1 | Atención al personal del Ministerio |

---

## 7. Distribución por región

| Tipo | Central | Metropolitana | Occidental | Oriental | Paracentral | Total |
|---|---:|---:|---:|---:|---:|---:|
| UCSF Básica | 50 | 29 | 90 | 146 | 101 | 416 |
| UCSF Intermedia | 51 | 32 | 54 | 90 | 64 | 291 |
| UCSF Especializada | 7 | 5 | 7 | 15 | 5 | 39 |
| Casa de Salud | 2 | 18 | 8 | 33 | 0 | 61 |
| CRN | 9 | 4 | 6 | 5 | 16 | 40 |
| HEM | 4 | 1 | 5 | 7 | 4 | 21 |
| Hospital básico | 1 | 1 | 2 | 5 | 2 | 11 |
| Hospital departamental | 2 | 3 | 2 | 3 | 4 | 14 |
| Hospital regional | 0 | 0 | 1 | 1 | 0 | 2 |
| Hospital especializado | 0 | 3 | 0 | 0 | 0 | 3 |
| CAE | 0 | 2 | 0 | 0 | 0 | 2 |
| SEM | 1 | 3 | 0 | 0 | 0 | 4 |

---

## 8. Prioridad para atender a un herido

De mayor a menor capacidad:

1. **Hospitales especializados**: trauma grave (Rosales adultos, Bloom niños, de la Mujer embarazadas).
2. **Hospitales regionales**: Santa Ana y San Miguel.
3. **Hospitales departamentales y básicos**: el hospital más cercano fuera de la capital.
4. **CAE**: Apopa y San Martín, para estabilizar.
5. **UCSF Especializada**: heridas moderadas y estabilización.
6. **UCSF Intermedia**: heridas leves, en horario.

No sirven para heridos: UCSF Básica (solo primeros auxilios), Casa de Salud, CRN, HEM y los establecimientos administrativos.

---

## 9. Otras fuentes del proyecto (OpenStreetMap)

Las capas **Overpass**, **Geofabrik** y **HOT** vienen de OpenStreetMap y no usan la clasificación del MINSAL. Incluyen además establecimientos que el MINSAL no lista:

- Hospitales y clínicas del **Seguro Social (ISSS)**.
- Hospital Militar y Bienestar Magisterial.
- Hospitales, clínicas, farmacias, laboratorios y dentistas **privados**.

Cómo leer sus tipos:

| Tipo en OSM | Qué suele ser | Para heridos |
|---|---|---|
| Hospital | Hospital público, del ISSS o privado | Sí |
| Clínica | Desde una UCSF hasta un consultorio privado pequeño | Depende; verificar |
| Consultorio | Médico particular | Solo casos leves |
| Farmacia, Laboratorio, Dentista, Optometría, etc. | Servicio específico | No |

Datos útiles que a veces trae OSM:

- `emergency=yes` en la capa Overpass (30 establecimientos): el lugar declara atención de emergencias.
- `especialidad` con "Emergencia" en la capa HOT (6 establecimientos).
- `horario` y `telefono` en algunos registros de Overpass.

Al ser datos colaborativos, pueden estar incompletos o desactualizados.
