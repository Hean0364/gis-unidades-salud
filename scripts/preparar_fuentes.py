# -*- coding: utf-8 -*-
"""Exporta MINSAL, Overpass, Geofabrik y HOT como capas separadas, sin fusionar."""
from __future__ import annotations

import csv
import json
import math
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORIGINALES = ROOT / "data" / "originales"
GEOJSON = ROOT / "data" / "geojson"
TABLAS = ROOT / "data" / "tablas"
MAPA = ROOT / "data" / "mapa"

CSV_PATH = ORIGINALES / "minsal_establecimientos.csv"
OSM_PATH = ORIGINALES / "overpass_salud.geojson"
HOT_ZIP = ORIGINALES / "hot_salud_hdx.zip"

OUT_MINSAL = GEOJSON / "minsal.geojson"
OUT_OSM = GEOJSON / "overpass.geojson"
OUT_GEOFABRIK = GEOJSON / "geofabrik.geojson"
OUT_HOT = GEOJSON / "hot.geojson"

OUT_OSM_CSV = TABLAS / "overpass_poligonos.csv"
OUT_OSM_KML = TABLAS / "overpass_poligonos.kml"
OUT_GEOFABRIK_CSV = TABLAS / "geofabrik_salud.csv"
OUT_HOT_CSV = TABLAS / "hot_salud.csv"

OUT_MINSAL_JS = MAPA / "minsal.js"
OUT_OSM_JS = MAPA / "overpass.js"
OUT_GEOFABRIK_JS = MAPA / "geofabrik.js"
OUT_HOT_JS = MAPA / "hot.js"

HOT_TIPO = {
    "hospital": "Hospital",
    "clinic": "Clínica",
    "doctors": "Consultorio",
    "doctor": "Consultorio",
    "centre": "Consultorio",
    "health_post": "Puesto de salud",
    "pharmacy": "Farmacia",
    "dentist": "Dentista",
    "laboratory": "Laboratorio",
    "alternative": "Medicina alternativa",
    "rehabilitation": "Rehabilitación",
    "blood_donation": "Banco de sangre",
    "birthing_centre": "Casa de parto",
    "optometrist": "Optometría",
    "counselling": "Consejería",
    "audiologist": "Audiología",
    "sample_collection": "Toma de muestras",
    "community_health_worker": "Promotor de salud",
}
HOT_OPERADOR = {
    "government": "Público",
    "public": "Público",
    "public/government": "Público",
    "private": "Privado",
    "private_non_profit": "Privado sin fines de lucro",
    "association": "Asociación",
}
HOT_ESPECIALIDAD = {
    "general": "Medicina general",
    "community": "Comunitaria",
    "chiropractic": "Quiropraxia",
    "emergency": "Emergencia",
    "orthodontics": "Ortodoncia",
    "dentistry": "Odontología",
    "odontology": "Odontología",
    "radiology": "Radiología",
    "dermatology": "Dermatología",
    "gastroenterology": "Gastroenterología",
    "blood_check": "Análisis de sangre",
    "urine_check": "Análisis de orina",
    "paediatrics": "Pediatría",
    "nephrology": "Nefrología",
    "cardiology": "Cardiología",
    "vaccination": "Vacunación",
    "stomatology": "Estomatología",
    "ophthalmology": "Oftalmología",
    "cytology": "Citología",
    "prenatal_care": "Control prenatal",
    "surgery": "Cirugía",
    "internal": "Medicina interna",
    "gynaecology": "Ginecología",
    "orthopaedics": "Ortopedia",
    "neurosurgery": "Neurocirugía",
    "neurology": "Neurología",
    "urology": "Urología",
    "pneumology": "Neumología",
    "infectology": "Infectología",
    "endocrinology": "Endocrinología",
    "oncology": "Oncología",
    "psychiatry": "Psiquiatría",
    "psychology": "Psicología",
    "homeopathy": "Homeopatía",
    "dentist": "Odontología",
    "clinic": "Clínica",
    "otorhinolaringology": "Otorrinolaringología",
    "otorhinolaryngology": "Otorrinolaringología",
    "physiatry": "Fisiatría",
    "phototherapy": "Fototerapia",
}

GEOFABRIK_HEALTH = {
    "hospital": "Hospital",
    "clinic": "Clínica",
    "doctors": "Consultorio",
}
GEOFABRIK_BUILDINGS = {
    "hospital": "Hospital",
}
GEOFABRIK_NAME_SKIP = ("farmacia", "odont", "dentist", "veterin", "residenc", "anciano", "nursing", "asilo")


def write_geojson(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_js(path: Path, variable: str, data) -> None:
    path.write_text(
        f"window.{variable} = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )


def _point_xy(point):
    if not point or len(point) < 2:
        return None
    try:
        x, y = float(point[0]), float(point[1])
    except (TypeError, ValueError):
        return None
    if not math.isfinite(x) or not math.isfinite(y):
        return None
    return x, y


def _mean_point(points):
    clean = [_point_xy(point) for point in points or []]
    clean = [point for point in clean if point is not None]
    if len(clean) > 1 and clean[0] == clean[-1]:
        clean.pop()
    if not clean:
        return None
    return (
        sum(point[0] for point in clean) / len(clean),
        sum(point[1] for point in clean) / len(clean),
    )


def _ring_area_centroid(ring):
    """Retorna (centroide, área con signo) usando la fórmula de Gauss."""
    points = [_point_xy(point) for point in ring or []]
    points = [point for point in points if point is not None]
    if len(points) > 1 and points[0] == points[-1]:
        points.pop()
    if len(points) < 3:
        return _mean_point(points), 0.0

    # Trasladar cerca del origen evita cancelación numérica con polígonos
    # pequeños expresados como longitud/latitud de valores absolutos grandes.
    origin_x, origin_y = points[0]
    local_points = [(x - origin_x, y - origin_y) for x, y in points]
    twice_area = 0.0
    cx_numerator = 0.0
    cy_numerator = 0.0
    for current, following in zip(local_points, local_points[1:] + local_points[:1]):
        cross = current[0] * following[1] - following[0] * current[1]
        twice_area += cross
        cx_numerator += (current[0] + following[0]) * cross
        cy_numerator += (current[1] + following[1]) * cross

    if abs(twice_area) < 1e-15:
        return _mean_point(points), 0.0
    return (
        origin_x + cx_numerator / (3.0 * twice_area),
        origin_y + cy_numerator / (3.0 * twice_area),
    ), twice_area / 2.0


def _polygon_area_centroid(rings):
    """Centro de masa de un polígono; resta huecos sin depender de orientación."""
    if not rings:
        return None, 0.0
    weighted_x = 0.0
    weighted_y = 0.0
    total_area = 0.0
    for index, ring in enumerate(rings):
        centroid, signed_area = _ring_area_centroid(ring)
        if not centroid or not signed_area:
            continue
        area = abs(signed_area) if index == 0 else -abs(signed_area)
        weighted_x += centroid[0] * area
        weighted_y += centroid[1] * area
        total_area += area
    if total_area > 1e-15:
        return (weighted_x / total_area, weighted_y / total_area), total_area
    return _mean_point(rings[0]), 0.0


def _line_centroid(line):
    """Punto medio ponderado por la longitud de cada segmento."""
    points = [_point_xy(point) for point in line or []]
    points = [point for point in points if point is not None]
    if not points:
        return None
    if len(points) >= 4 and points[0] == points[-1]:
        centroid, area = _polygon_area_centroid([points])
        if centroid and area:
            return centroid

    weighted_x = 0.0
    weighted_y = 0.0
    total_length = 0.0
    for start, end in zip(points, points[1:]):
        mean_latitude = math.radians((start[1] + end[1]) / 2.0)
        dx = (end[0] - start[0]) * math.cos(mean_latitude)
        dy = end[1] - start[1]
        length = math.hypot(dx, dy)
        if not length:
            continue
        weighted_x += ((start[0] + end[0]) / 2.0) * length
        weighted_y += ((start[1] + end[1]) / 2.0) * length
        total_length += length
    if total_length:
        return weighted_x / total_length, weighted_y / total_length
    return points[0]


def geom_centroid(geom):
    """Calcula el centro de masa de una geometría GeoJSON en EPSG:4326.

    Los polígonos se ponderan por área, incluidos huecos y todas las partes de
    un multipolígono. Las líneas abiertas se ponderan por longitud.
    """
    if not geom:
        return None
    geometry_type = geom.get("type")
    coordinates = geom.get("coordinates")
    if geometry_type == "Point":
        return _point_xy(coordinates)
    if geometry_type == "LineString":
        return _line_centroid(coordinates)
    if geometry_type == "Polygon":
        centroid, _ = _polygon_area_centroid(coordinates)
        return centroid
    if geometry_type == "MultiPolygon":
        polygons = []
        for polygon in coordinates or []:
            centroid, area = _polygon_area_centroid(polygon)
            if centroid and area:
                polygons.append((centroid, area))
        total_area = sum(area for _, area in polygons)
        if total_area:
            return (
                sum(centroid[0] * area for centroid, area in polygons) / total_area,
                sum(centroid[1] * area for centroid, area in polygons) / total_area,
            )
        return None
    return None


def coord_pair(pt) -> str:
    return f"{pt[0]} {pt[1]}"


def ring_wkt(ring) -> str:
    return ", ".join(coord_pair(p) for p in ring)


def geom_wkt(geom) -> str:
    if not geom:
        return ""
    t = geom.get("type")
    c = geom.get("coordinates") or []
    if t == "Point":
        return f"POINT ({coord_pair(c)})"
    if t == "LineString":
        return f"LINESTRING ({ring_wkt(c)})"
    if t == "Polygon":
        parts = ", ".join(f"({ring_wkt(r)})" for r in c)
        return f"POLYGON ({parts})"
    if t == "MultiPolygon":
        polys = []
        for poly in c:
            parts = ", ".join(f"({ring_wkt(r)})" for r in poly)
            polys.append(f"({parts})")
        return f"MULTIPOLYGON ({', '.join(polys)})"
    return ""


def vertex_count(geom) -> int:
    if not geom:
        return 0
    t = geom.get("type")
    c = geom.get("coordinates") or []
    if t == "Point":
        return 1
    if t == "LineString":
        return len(c)
    if t == "Polygon":
        return sum(len(r) for r in c)
    if t == "MultiPolygon":
        return sum(len(r) for poly in c for r in poly)
    return 0


def osm_tipo(props: dict) -> str:
    amenity = props.get("amenity") or ""
    healthcare = props.get("healthcare") or ""
    if amenity == "hospital" or healthcare == "hospital":
        return "Hospital"
    if amenity == "clinic" or healthcare == "clinic":
        return "Clínica"
    if amenity == "doctors" or healthcare in {"doctor", "centre"}:
        return "Consultorio"
    if amenity == "health_post" or healthcare == "health_post":
        return "Puesto de salud"
    return amenity or healthcare or "OSM"


def load_minsal():
    features = []
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            try:
                lat = float(row["latitud"])
                lon = float(row["longitud"])
            except (TypeError, ValueError):
                continue
            props = {
                "id": f"minsal-{row.get('arcgis_objectid') or len(features)+1}",
                "fuente": "MINSAL",
                "nombre": (row.get("nombre") or "").strip(),
                "tipo": (row.get("tipo") or "").strip(),
                "departamento": (row.get("departamento") or "").strip().title(),
                "municipio": (row.get("municipio") or "").strip().title(),
                "region": (row.get("region") or "").strip().title(),
                "minsal_id": int(row["arcgis_objectid"]) if row.get("arcgis_objectid") else None,
                "google_maps": (row.get("google_maps") or "").strip(),
                "lat": lat,
                "lon": lon,
            }
            props = {k: v for k, v in props.items() if v not in ("", None)}
            features.append({
                "type": "Feature",
                "properties": props,
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
            })
    return {
        "type": "FeatureCollection",
        "name": "minsal_establecimientos",
        "meta": {"fuente": "MINSAL", "count": len(features)},
        "features": features,
    }


def load_osm():
    raw = json.loads(OSM_PATH.read_text(encoding="utf-8"))
    features = []
    for f in raw.get("features") or []:
        props_in = f.get("properties") or {}
        geom = f.get("geometry")
        centro = geom_centroid(geom)
        nombre = props_in.get("name") or props_in.get("official_name") or props_in.get("alt_name") or "Sin nombre"
        props = {
            "id": props_in.get("@id") or f"osm-{len(features)+1}",
            "fuente": "OSM",
            "nombre": nombre,
            "tipo": osm_tipo(props_in),
            "amenity": props_in.get("amenity") or "",
            "healthcare": props_in.get("healthcare") or "",
            "municipio": props_in.get("addr:city") or "",
            "direccion": ", ".join(
                x for x in [
                    props_in.get("addr:street"),
                    props_in.get("addr:housenumber"),
                    props_in.get("addr:city"),
                ] if x
            ),
            "operador": props_in.get("operator") or "",
            "telefono": props_in.get("phone") or "",
            "horario": props_in.get("opening_hours") or "",
            "osm_id": props_in.get("@id") or "",
        }
        if centro:
            props["lon"] = centro[0]
            props["lat"] = centro[1]
        props = {k: v for k, v in props.items() if v not in ("", None)}
        features.append({
            "type": "Feature",
            "properties": props,
            "geometry": geom,
        })
    return {
        "type": "FeatureCollection",
        "name": "osm_overpass_unidades",
        "meta": {"fuente": "OpenStreetMap / Overpass Turbo", "count": len(features)},
        "features": features,
    }


def xml_escape(text) -> str:
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def kml_coord(pt) -> str:
    return f"{pt[0]:.7f},{pt[1]:.7f},0"


def kml_ring(ring) -> str:
    return " ".join(kml_coord(p) for p in ring)


def ring_closed(ring) -> bool:
    if len(ring) < 4:
        return False
    a, b = ring[0], ring[-1]
    return abs(a[0] - b[0]) < 1e-9 and abs(a[1] - b[1]) < 1e-9


def polygon_kml(rings) -> str:
    parts = [
        "<Polygon>",
        "<outerBoundaryIs><LinearRing><coordinates>",
        kml_ring(rings[0]),
        "</coordinates></LinearRing></outerBoundaryIs>",
    ]
    for hole in rings[1:]:
        parts.extend([
            "<innerBoundaryIs><LinearRing><coordinates>",
            kml_ring(hole),
            "</coordinates></LinearRing></innerBoundaryIs>",
        ])
    parts.append("</Polygon>")
    return "".join(parts)


def geometry_kml(geom) -> str:
    if not geom:
        return ""
    t = geom.get("type")
    c = geom.get("coordinates") or []
    if t == "Polygon" and c:
        return polygon_kml(c)
    if t == "MultiPolygon" and c:
        return "<MultiGeometry>" + "".join(polygon_kml(poly) for poly in c if poly) + "</MultiGeometry>"
    if t == "LineString" and c:
        if ring_closed(c):
            return polygon_kml([c])
        return f"<LineString><tessellate>1</tessellate><coordinates>{kml_ring(c)}</coordinates></LineString>"
    if t == "Point" and c:
        return f"<Point><coordinates>{kml_coord(c)}</coordinates></Point>"
    return ""


def write_osm_kml(raw: dict):
    by_tipo = {}
    skipped = 0
    for feat in raw.get("features") or []:
        props = feat.get("properties") or {}
        geom = feat.get("geometry") or {}
        body = geometry_kml(geom)
        if not body:
            skipped += 1
            continue
        centro = geom_centroid(geom)
        osm_id = props.get("@id") or ""
        nombre = props.get("name") or props.get("official_name") or props.get("alt_name") or "Sin nombre"
        tipo = osm_tipo(props)
        direccion = ", ".join(
            x for x in [
                props.get("addr:street"),
                props.get("addr:housenumber"),
                props.get("addr:city"),
            ] if x
        )
        lat = centro[1] if centro else ""
        lon = centro[0] if centro else ""
        osm_url = f"https://www.openstreetmap.org/{osm_id}" if osm_id else ""
        maps = f"https://www.google.com/maps/search/?api=1&query={lat},{lon}" if centro else ""
        fields = [
            ("Tipo", tipo),
            ("Geometría", geom.get("type") or ""),
            ("Municipio", props.get("addr:city") or ""),
            ("Dirección", direccion),
            ("Operador", props.get("operator") or ""),
            ("Teléfono", props.get("phone") or ""),
            ("Horario", props.get("opening_hours") or ""),
            ("OSM", osm_id),
            ("Vértices", str(vertex_count(geom))),
        ]
        desc_lines = [f"<b>{xml_escape(k)}:</b> {xml_escape(v)}" for k, v in fields if v]
        if osm_url:
            desc_lines.append(f'<a href="{xml_escape(osm_url)}">Abrir en OpenStreetMap</a>')
        if maps:
            desc_lines.append(f'<a href="{xml_escape(maps)}">Centro en Google Maps</a>')
        data_xml = "".join(
            f'<Data name="{xml_escape(k)}"><value>{xml_escape(v)}</value></Data>'
            for k, v in fields if v
        )
        placemark = (
            "<Placemark>"
            f"<name>{xml_escape(nombre)}</name>"
            f"<description><![CDATA[{'<br/>'.join(desc_lines)}]]></description>"
            f"<ExtendedData>{data_xml}</ExtendedData>"
            "<styleUrl>#predio</styleUrl>"
            f"{body}"
            "</Placemark>"
        )
        by_tipo.setdefault(tipo, []).append(placemark)

    folders = []
    for tipo in sorted(by_tipo):
        folders.append(
            "<Folder>"
            f"<name>{xml_escape(tipo)} ({len(by_tipo[tipo])})</name>"
            + "".join(by_tipo[tipo])
            + "</Folder>"
        )
    kml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<kml xmlns="http://www.opengis.net/kml/2.2">\n'
        "<Document>\n"
        "<name>Polígonos OSM · Unidades de Salud</name>\n"
        "<description>Predios de OpenStreetMap para revisar sobre el satélite de Google My Maps.</description>\n"
        "<Style id=\"predio\">"
        "<LineStyle><color>ff265cc4</color><width>2</width></LineStyle>"
        "<PolyStyle><color>59265cc4</color><fill>1</fill><outline>1</outline></PolyStyle>"
        "</Style>\n"
        + "\n".join(folders)
        + "\n</Document>\n</kml>\n"
    )
    OUT_OSM_KML.write_text(kml, encoding="utf-8")
    total = sum(len(v) for v in by_tipo.values())
    print("osm_kml", OUT_OSM_KML, total, "omitidos", skipped)
    for tipo, items in sorted(by_tipo.items()):
        print(f"  {tipo}: {len(items)}")


def write_osm_csv(raw: dict):
    fields = [
        "osm_id",
        "nombre",
        "tipo",
        "amenity",
        "healthcare",
        "edificio",
        "municipio",
        "direccion",
        "operador",
        "telefono",
        "horario",
        "geometria",
        "vertices",
        "latitud",
        "longitud",
        "wkt",
        "osm_url",
        "google_maps",
    ]
    with OUT_OSM_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for feat in raw.get("features") or []:
            props = feat.get("properties") or {}
            geom = feat.get("geometry") or {}
            centro = geom_centroid(geom)
            osm_id = props.get("@id") or ""
            lat = centro[1] if centro else ""
            lon = centro[0] if centro else ""
            maps = f"https://www.google.com/maps/search/?api=1&query={lat},{lon}" if centro else ""
            osm_url = f"https://www.openstreetmap.org/{osm_id}" if osm_id else ""
            nombre = props.get("name") or props.get("official_name") or props.get("alt_name") or "Sin nombre"
            direccion = ", ".join(
                x for x in [
                    props.get("addr:street"),
                    props.get("addr:housenumber"),
                    props.get("addr:city"),
                ] if x
            )
            writer.writerow({
                "osm_id": osm_id,
                "nombre": nombre,
                "tipo": osm_tipo(props),
                "amenity": props.get("amenity") or "",
                "healthcare": props.get("healthcare") or "",
                "edificio": props.get("building") or "",
                "municipio": props.get("addr:city") or "",
                "direccion": direccion,
                "operador": props.get("operator") or "",
                "telefono": props.get("phone") or "",
                "horario": props.get("opening_hours") or "",
                "geometria": geom.get("type") or "",
                "vertices": vertex_count(geom),
                "latitud": lat,
                "longitud": lon,
                "wkt": geom_wkt(geom),
                "osm_url": osm_url,
                "google_maps": maps,
            })


def _as_geojson_geom(shape):
    geom = shape.__geo_interface__
    if not geom or not geom.get("coordinates"):
        return None
    return {"type": geom["type"], "coordinates": geom["coordinates"]}


def _geofabrik_feature(geom, osm_id, nombre, tipo, detalle):
    centro = geom_centroid(geom)
    if not centro or not geom:
        return None
    lon, lat = centro
    oid = str(osm_id).strip()
    kind = "node" if geom.get("type") == "Point" else "way"
    return {
        "type": "Feature",
        "properties": {
            "id": f"geofabrik-{kind}-{oid}",
            "fuente": "Geofabrik",
            "nombre": (nombre or "").strip() or "Sin nombre",
            "tipo": tipo,
            "detalle": detalle,
            "osm_id": f"{kind}/{oid}",
            "google_maps": f"https://www.google.com/maps/search/?api=1&query={lat},{lon}",
            "lat": lat,
            "lon": lon,
        },
        "geometry": geom,
    }


def _read_geofabrik_layer(folder: Path, stem: str, health_field: str, labels: dict, detalle: str, seen: set):
    import shapefile

    reader = shapefile.Reader(str(folder / stem), encoding="utf-8")
    features = []
    try:
        for i, rec in enumerate(reader.iterRecords()):
            clase = (rec[health_field] or "").strip()
            tipo = labels.get(clase)
            if not tipo:
                continue
            nombre = rec["name"] or ""
            if any(word in nombre.lower() for word in GEOFABRIK_NAME_SKIP):
                continue
            oid = str(rec["osm_id"]).strip()
            if oid in seen:
                continue
            try:
                geom = _as_geojson_geom(reader.shape(i))
            except shapefile.ShapefileException:
                continue
            feat = _geofabrik_feature(geom, oid, rec["name"], tipo, detalle)
            if not feat:
                continue
            seen.add(oid)
            features.append(feat)
    finally:
        reader.close()
    return features


def import_geofabrik(zip_path: Path):
    """Filtra salud del shapefile libre de Geofabrik y lo deja como tercera fuente."""
    zip_path = Path(zip_path)
    stems = {
        "gis_osm_pois_free_1",
        "gis_osm_pois_a_free_1",
        "gis_osm_buildings_a_free_1",
    }
    with tempfile.TemporaryDirectory(prefix="geofabrik-") as tmp:
        dest = Path(tmp)
        with zipfile.ZipFile(zip_path) as archive:
            for info in archive.infolist():
                if Path(info.filename).stem in stems:
                    archive.extract(info, dest)
        seen_ways = set()
        polygons = _read_geofabrik_layer(
            dest, "gis_osm_pois_a_free_1", "fclass", GEOFABRIK_HEALTH, "Predio", seen_ways
        )
        buildings = _read_geofabrik_layer(
            dest, "gis_osm_buildings_a_free_1", "type", GEOFABRIK_BUILDINGS, "Edificio", seen_ways
        )
        points = _read_geofabrik_layer(
            dest, "gis_osm_pois_free_1", "fclass", GEOFABRIK_HEALTH, "Punto", set()
        )
    features = polygons + buildings + points
    collection = {
        "type": "FeatureCollection",
        "name": "geofabrik_salud",
        "meta": {
            "fuente": "Geofabrik",
            "fecha": "2026-10-05",
            "licencia": "ODbL / OpenStreetMap",
            "count": len(features),
        },
        "features": features,
    }
    write_geojson(OUT_GEOFABRIK, collection)
    write_js(OUT_GEOFABRIK_JS, "GEOFABRIK_GEOJSON", collection)
    with OUT_GEOFABRIK_CSV.open("w", encoding="utf-8-sig", newline="") as handle:
        fields = ["osm_id", "nombre", "tipo", "detalle", "geometria", "vertices", "latitud", "longitud", "osm_url", "google_maps"]
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for feat in features:
            props = feat["properties"]
            geom = feat["geometry"]
            kind, oid = props["osm_id"].split("/", 1)
            writer.writerow({
                "osm_id": props["osm_id"],
                "nombre": props["nombre"],
                "tipo": props["tipo"],
                "detalle": props["detalle"],
                "geometria": geom.get("type") or "",
                "vertices": vertex_count(geom),
                "latitud": props["lat"],
                "longitud": props["lon"],
                "osm_url": f"https://www.openstreetmap.org/{kind}/{oid}",
                "google_maps": props["google_maps"],
            })
    print("geofabrik", len(features), OUT_GEOFABRIK)
    from collections import Counter
    for (tipo, detalle), count in sorted(Counter((f["properties"]["tipo"], f["properties"]["detalle"]) for f in features).items()):
        print(f"  {tipo} / {detalle}: {count}")


def hot_tipo(props: dict) -> str:
    amenity = ((props.get("amenity") or "").split(";")[0]).strip()
    healthcare = ((props.get("healthcare") or "").split(";")[0]).strip()
    for key in (amenity, healthcare):
        if key in HOT_TIPO:
            return HOT_TIPO[key]
    if amenity and amenity not in {"yes", "school"}:
        return amenity
    if healthcare and healthcare not in {"yes", "salud", "school"}:
        return healthcare
    return "Otro"


def hot_especialidad(value: str) -> str:
    parts = []
    seen = set()
    for token in (value or "").split(";"):
        token = token.strip()
        if not token or token in seen:
            continue
        seen.add(token)
        parts.append(HOT_ESPECIALIDAD.get(token, token.replace("_", " ")))
    return ", ".join(parts)


def load_hot(zip_path: Path | None = None):
    zip_path = Path(zip_path or HOT_ZIP)
    with zipfile.ZipFile(zip_path) as archive:
        raw = json.loads(archive.read("health_facilities.geojson"))
    features = []
    for feat in raw.get("features") or []:
        props_in = feat.get("properties") or {}
        geom = feat.get("geometry")
        centro = geom_centroid(geom)
        if not geom or not centro:
            continue
        lon, lat = centro
        osm_id = str(props_in.get("id") or "").strip()
        nombre = (
            props_in.get("name")
            or props_in.get("name_latin")
            or props_in.get("name_es")
            or ""
        ).strip() or "Sin nombre"
        municipio = (
            props_in.get("adm3_name")
            or props_in.get("adm2_name")
            or props_in.get("addr_city")
            or ""
        ).strip()
        operador = HOT_OPERADOR.get((props_in.get("operator_type") or "").strip(), "")
        props = {
            "id": f"hot-{osm_id.replace('/', '-')}" if osm_id else f"hot-{len(features)+1}",
            "fuente": "HOT",
            "nombre": nombre,
            "tipo": hot_tipo(props_in),
            "detalle": "Punto" if geom.get("type") == "Point" else "Polígono",
            "departamento": (props_in.get("adm1_name") or "").strip(),
            "municipio": municipio,
            "direccion": (props_in.get("addr_full") or props_in.get("addr_city") or "").strip(),
            "operador": operador,
            "especialidad": hot_especialidad(props_in.get("healthcare_speciality") or ""),
            "osm_id": osm_id,
            "google_maps": f"https://www.google.com/maps/search/?api=1&query={lat},{lon}",
            "lat": lat,
            "lon": lon,
        }
        if props_in.get("capacity_persons") not in (None, ""):
            props["capacidad"] = props_in.get("capacity_persons")
        props = {k: v for k, v in props.items() if v not in ("", None)}
        features.append({"type": "Feature", "properties": props, "geometry": geom})
    features.sort(key=lambda feat: feat["geometry"].get("type") == "Point")
    return {
        "type": "FeatureCollection",
        "name": "hot_salud",
        "meta": {
            "fuente": "HOT / HDX",
            "fecha": "2026-10-07",
            "licencia": "ODbL / OpenStreetMap",
            "url": "https://data.humdata.org/dataset/hotosm_slv_health_facilities",
            "count": len(features),
        },
        "features": features,
    }


def import_hot(zip_path: Path | None = None):
    collection = load_hot(zip_path)
    features = collection["features"]
    write_geojson(OUT_HOT, collection)
    write_js(OUT_HOT_JS, "HOT_GEOJSON", collection)
    fields = [
        "osm_id", "nombre", "tipo", "detalle", "departamento", "municipio",
        "direccion", "operador", "especialidad", "geometria", "vertices",
        "latitud", "longitud", "osm_url", "google_maps",
    ]
    with OUT_HOT_CSV.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for feat in features:
            props = feat["properties"]
            geom = feat["geometry"]
            osm_id = props.get("osm_id") or ""
            writer.writerow({
                "osm_id": osm_id,
                "nombre": props["nombre"],
                "tipo": props["tipo"],
                "detalle": props["detalle"],
                "departamento": props.get("departamento") or "",
                "municipio": props.get("municipio") or "",
                "direccion": props.get("direccion") or "",
                "operador": props.get("operador") or "",
                "especialidad": props.get("especialidad") or "",
                "geometria": geom.get("type") or "",
                "vertices": vertex_count(geom),
                "latitud": props["lat"],
                "longitud": props["lon"],
                "osm_url": f"https://www.openstreetmap.org/{osm_id}" if osm_id else "",
                "google_maps": props["google_maps"],
            })
    print("hot", len(features), OUT_HOT)
    from collections import Counter
    for (tipo, detalle), count in sorted(Counter((f["properties"]["tipo"], f["properties"]["detalle"]) for f in features).items()):
        print(f"  {tipo} / {detalle}: {count}")


def main():
    raw_osm = json.loads(OSM_PATH.read_text(encoding="utf-8"))
    minsal = load_minsal()
    osm = load_osm()
    write_osm_csv(raw_osm)
    write_osm_kml(raw_osm)
    write_geojson(OUT_MINSAL, minsal)
    write_geojson(OUT_OSM, osm)
    write_js(OUT_MINSAL_JS, "MINSAL_GEOJSON", minsal)
    write_js(OUT_OSM_JS, "OVERPASS_GEOJSON", osm)
    print("minsal", minsal["meta"]["count"])
    print("osm", osm["meta"]["count"])
    print("osm_csv", OUT_OSM_CSV)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "hot":
        import_hot()
    else:
        main()
