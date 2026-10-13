#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Normaliza las cuatro fuentes CSV al contrato tabular usado por la API."""
from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

if __package__:
    from .preparar_fuentes import geom_centroid, geom_wkt, vertex_count
else:  # Permite ejecutar también: python scripts/normalizar_csv.py
    from preparar_fuentes import geom_centroid, geom_wkt, vertex_count


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "data" / "normalizados"

FIELDS = [
    "id",
    "fuente",
    "fuente_id",
    "nombre",
    "tipo",
    "tipo_codigo",
    "detalle",
    "detalle_codigo",
    "departamento",
    "municipio",
    "region",
    "direccion",
    "operador",
    "telefono",
    "horario",
    "especialidad",
    "amenity",
    "healthcare",
    "edificio",
    "geometria_tipo",
    "vertices",
    "centroide_latitud",
    "centroide_longitud",
    "centroide_metodo",
    "geometria_wkt",
    "fuente_url",
    "google_maps",
]

SOURCES = [
    {
        "slug": "minsal",
        "csv": ROOT / "data" / "originales" / "minsal_establecimientos.csv",
        "geojson": ROOT / "data" / "geojson" / "minsal.geojson",
        "csv_id": "arcgis_objectid",
        "geojson_id": "minsal_id",
    },
    {
        "slug": "overpass",
        "csv": ROOT / "data" / "tablas" / "overpass_poligonos.csv",
        "geojson": ROOT / "data" / "geojson" / "overpass.geojson",
        "csv_id": "osm_id",
        "geojson_id": "osm_id",
    },
    {
        "slug": "geofabrik",
        "csv": ROOT / "data" / "tablas" / "geofabrik_salud.csv",
        "geojson": ROOT / "data" / "geojson" / "geofabrik.geojson",
        "csv_id": "osm_id",
        "geojson_id": "osm_id",
    },
    {
        "slug": "hot",
        "csv": ROOT / "data" / "tablas" / "hot_salud.csv",
        "geojson": ROOT / "data" / "geojson" / "hot.geojson",
        "csv_id": "osm_id",
        "geojson_id": "osm_id",
    },
]

DEPARTAMENTOS = {
    "ahuachapan": "Ahuachapán",
    "cabanas": "Cabañas",
    "chalatenango": "Chalatenango",
    "cuscatlan": "Cuscatlán",
    "la_libertad": "La Libertad",
    "la_paz": "La Paz",
    "la_union": "La Unión",
    "morazan": "Morazán",
    "san_miguel": "San Miguel",
    "san_salvador": "San Salvador",
    "san_vicente": "San Vicente",
    "santa_ana": "Santa Ana",
    "sonsonate": "Sonsonate",
    "usulutan": "Usulután",
}


def clean(value) -> str:
    if value is None:
        return ""
    return " ".join(str(value).strip().split())


def slugify(value) -> str:
    text = unicodedata.normalize("NFKD", clean(value)).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def normalize_department(value) -> str:
    text = clean(value)
    return DEPARTAMENTOS.get(slugify(text), text.title()) if text else ""


def normalize_region(value) -> str:
    text = clean(value)
    text = re.sub(r"^regi[oó]n\s+", "", text, flags=re.IGNORECASE)
    return text.title()


def normalize_municipality(value, source: str) -> str:
    text = clean(value)
    return text.title() if source == "minsal" else text


def source_key(value) -> str:
    text = clean(value)
    if re.fullmatch(r"\d+\.0", text):
        text = text[:-2]
    return text


def format_coordinate(value: float) -> str:
    return f"{value:.8f}".rstrip("0").rstrip(".")


def centroid_method(geometry: dict) -> str:
    geometry_type = geometry.get("type")
    if geometry_type == "Point":
        return "coordenada_original"
    if geometry_type in {"Polygon", "MultiPolygon"}:
        return "centroide_area"
    if geometry_type == "LineString":
        coordinates = geometry.get("coordinates") or []
        if len(coordinates) >= 4 and coordinates[0][:2] == coordinates[-1][:2]:
            return "centroide_area_anillo"
        return "centroide_linea"
    return ""


def read_csv(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def geometry_index(path: Path, id_field: str) -> dict[str, dict]:
    collection = json.loads(path.read_text(encoding="utf-8-sig"))
    index = {}
    for feature in collection.get("features") or []:
        properties = feature.get("properties") or {}
        key = source_key(properties.get(id_field))
        if not key:
            raise ValueError(f"{path}: geometría sin {id_field}")
        if key in index:
            raise ValueError(f"{path}: {id_field} duplicado: {key}")
        index[key] = feature.get("geometry")
    return index


def global_id(source: str, source_id_value: str) -> str:
    identifier = re.sub(r"[^a-zA-Z0-9]+", "-", source_id_value).strip("-").lower()
    return f"{source}-{identifier}"


def normalize_source(config: dict) -> list[dict]:
    source = config["slug"]
    rows = read_csv(config["csv"])
    geometries = geometry_index(config["geojson"], config["geojson_id"])
    normalized = []

    for line_number, row in enumerate(rows, start=2):
        source_id_value = source_key(row.get(config["csv_id"]))
        geometry = geometries.get(source_id_value)
        if not geometry:
            raise ValueError(
                f"{config['csv']}:{line_number}: no se encontró geometría para {source_id_value!r}"
            )
        centroid = geom_centroid(geometry)
        if not centroid:
            raise ValueError(
                f"{config['geojson']}: no se pudo calcular centroide de {source_id_value!r}"
            )
        longitude, latitude = centroid
        if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
            raise ValueError(f"Centroide fuera de rango para {source}/{source_id_value}")

        type_name = clean(row.get("tipo"))
        detail = clean(row.get("detalle"))
        normalized.append(
            {
                "id": global_id(source, source_id_value),
                "fuente": source,
                "fuente_id": source_id_value,
                "nombre": clean(row.get("nombre")),
                "tipo": type_name,
                "tipo_codigo": slugify(type_name),
                "detalle": detail,
                "detalle_codigo": slugify(detail),
                "departamento": normalize_department(row.get("departamento")),
                "municipio": normalize_municipality(row.get("municipio"), source),
                "region": normalize_region(row.get("region")),
                "direccion": clean(row.get("direccion")),
                "operador": clean(row.get("operador")),
                "telefono": clean(row.get("telefono")),
                "horario": clean(row.get("horario")),
                "especialidad": clean(row.get("especialidad")),
                "amenity": clean(row.get("amenity")),
                "healthcare": clean(row.get("healthcare")),
                "edificio": clean(row.get("edificio")),
                "geometria_tipo": clean(geometry.get("type")),
                "vertices": vertex_count(geometry),
                "centroide_latitud": format_coordinate(latitude),
                "centroide_longitud": format_coordinate(longitude),
                "centroide_metodo": centroid_method(geometry),
                "geometria_wkt": geom_wkt(geometry),
                "fuente_url": clean(row.get("osm_url")),
                "google_maps": (
                    "https://www.google.com/maps/search/?api=1&query="
                    f"{format_coordinate(latitude)},{format_coordinate(longitude)}"
                ),
            }
        )

    csv_keys = {source_key(row.get(config["csv_id"])) for row in rows}
    unused_geometries = set(geometries) - csv_keys
    if unused_geometries:
        raise ValueError(
            f"{config['geojson']}: {len(unused_geometries)} geometrías no tienen fila CSV"
        )
    return normalized


def validate(rows: list[dict]) -> None:
    ids = [row["id"] for row in rows]
    duplicates = [identifier for identifier, count in Counter(ids).items() if count > 1]
    if duplicates:
        raise ValueError(f"ID global duplicado: {duplicates[0]}")
    for row in rows:
        for field in ("id", "fuente", "fuente_id", "nombre", "tipo", "geometria_tipo"):
            if not row[field]:
                raise ValueError(f"{row['id']}: falta el campo obligatorio {field}")


def write_csv(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def run(output_directory: Path) -> list[dict]:
    output_directory.mkdir(parents=True, exist_ok=True)
    all_rows = []
    for config in SOURCES:
        rows = normalize_source(config)
        validate(rows)
        write_csv(output_directory / f"{config['slug']}.csv", rows)
        all_rows.extend(rows)
        methods = ", ".join(
            f"{method}={count}"
            for method, count in sorted(Counter(row["centroide_metodo"] for row in rows).items())
        )
        print(f"{config['slug']}: {len(rows)} filas ({methods})")
    validate(all_rows)
    write_csv(output_directory / "establecimientos_salud.csv", all_rows)
    print(f"total: {len(all_rows)} filas -> {output_directory / 'establecimientos_salud.csv'}")
    return all_rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"directorio de salida (predeterminado: {DEFAULT_OUTPUT})",
    )
    args = parser.parse_args()
    run(args.output_dir.resolve())


if __name__ == "__main__":
    main()
