# -*- coding: utf-8 -*-
"""Exporta MINSAL y OSM como dos capas separadas, sin fusionar."""
from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "fuentes" / "minsal_establecimientos.csv"
OSM_PATH = ROOT / "data" / "fuentes" / "overpass_export.geojson"
OUT_MINSAL = ROOT / "data" / "minsal.geojson"
OUT_OSM = ROOT / "data" / "osm.geojson"
OUT_OSM_CSV = ROOT / "data" / "fuentes" / "osm_poligonos.csv"
OUT_JS = ROOT / "data" / "unidades.js"


def ring_centroid(ring):
    if not ring:
        return None
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return (sum(xs) / len(xs), sum(ys) / len(ys))


def geom_centroid(geom):
    if not geom:
        return None
    t = geom.get("type")
    c = geom.get("coordinates")
    if t == "Point":
        return (c[0], c[1])
    if t == "LineString":
        return ring_centroid(c)
    if t == "Polygon":
        return ring_centroid(c[0] if c else [])
    if t == "MultiPolygon":
        return ring_centroid(c[0][0] if c else [])
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


def main():
    raw_osm = json.loads(OSM_PATH.read_text(encoding="utf-8"))
    minsal = load_minsal()
    osm = load_osm()
    write_osm_csv(raw_osm)
    OUT_MINSAL.write_text(json.dumps(minsal, ensure_ascii=False), encoding="utf-8")
    OUT_OSM.write_text(json.dumps(osm, ensure_ascii=False), encoding="utf-8")
    OUT_JS.write_text(
        "window.MINSAL_GEOJSON = " + json.dumps(minsal, ensure_ascii=False) + ";\n"
        + "window.OSM_GEOJSON = " + json.dumps(osm, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    print("minsal", minsal["meta"]["count"])
    print("osm", osm["meta"]["count"])
    print("osm_csv", OUT_OSM_CSV)


if __name__ == "__main__":
    main()
