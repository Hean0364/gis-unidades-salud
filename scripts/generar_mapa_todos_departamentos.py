"""Genera las capas del mapa conjunto sin modificar los 13 mapas individuales.

Ejecutar: python "Unidades de Salud/scripts/generar_mapa_todos_departamentos.py"
Los datos se leen directamente de los Excel departamentales filtrados.
La Paz y La Libertad utilizan solo las filas verdes de sus mapas individuales.

Para actualizar solo un departamento sin regenerar los demás:
python scripts/generar_mapa_todos_departamentos.py --departamento "La Libertad"
"""

from __future__ import annotations

import argparse
import json
from collections import Counter

from generar_mapas_departamentales import BOUNDARIES, DEPARTMENTS, collection, records, write_layer


def update_department(department: str) -> None:
    """Actualiza el mapa individual y reemplaza solo ese departamento en el general."""
    general = json.loads((DEPARTMENTS / "establecimientos_todos.geojson").read_text(encoding="utf-8"))
    departments = general["meta"]["departamentos"]
    if department not in departments:
        raise ValueError(f"Departamento desconocido: {department}")
    folder = DEPARTMENTS / department
    data = collection(department, records(folder / "establecimientos_salud.xlsx"))
    features = []
    for name in departments:
        features.extend(data["features"] if name == department else [
            feature for feature in general["features"]
            if feature["properties"]["departamento"] == name
        ])
    counts = Counter(feature["geometry"]["type"] for feature in features)
    general["features"] = features
    general["meta"].update(count=len(features), puntos=counts["Point"], poligonos=counts["Polygon"])
    write_layer(folder / "establecimientos", "ESTABLECIMIENTOS_DEPARTAMENTO_GEOJSON", data)
    write_layer(DEPARTMENTS / "establecimientos_todos", "ESTABLECIMIENTOS_TODOS_GEOJSON", general)
    print(f"{department}: {data['meta']['count']} registros; {data['meta']['puntos']} puntos; {data['meta']['poligonos']} polígonos")
    print(f"Mapa general: {general['meta']['count']} registros. Otros departamentos sin cambios.")


def main() -> None:
    boundary_source = json.loads(BOUNDARIES.read_text(encoding="utf-8"))
    by_name = {f["properties"]["nombre"]: f for f in boundary_source["features"]}
    excel_paths = sorted(DEPARTMENTS.glob("*/establecimientos_salud.xlsx"))
    if len(excel_paths) != 13 or {path.parent.name for path in excel_paths} != set(by_name) - {"San Salvador"}:
        raise ValueError("Se esperaban exactamente 13 Excel, uno por departamento fuera de San Salvador")

    features = []
    departments = []
    ids = set()
    for path in excel_paths:
        department = path.parent.name
        data = collection(department, records(path))
        for feature in data["features"]:
            identifier = feature["properties"]["id"]
            if identifier in ids:
                raise ValueError(f"ID repetido entre Excel: {identifier}")
            ids.add(identifier)
        features.extend(data["features"])
        departments.append(department)
        print(f"{department}: {data['meta']['count']} registros")

    counts = Counter(feature["geometry"]["type"] for feature in features)
    establishments = {
        "type": "FeatureCollection",
        "name": "establecimientos_salud_13_departamentos",
        "meta": {
            "fuente": "data/por_departamento/*/establecimientos_salud.xlsx",
            "departamentos": departments,
            "count": len(features),
            "puntos": counts["Point"],
            "poligonos": counts["Polygon"],
        },
        "features": features,
    }
    boundaries = {
        "type": "FeatureCollection",
        "name": "limites_13_departamentos",
        "meta": {"fuente": boundary_source.get("meta"), "count": len(departments)},
        "features": [by_name[name] for name in departments],
    }
    write_layer(DEPARTMENTS / "establecimientos_todos", "ESTABLECIMIENTOS_TODOS_GEOJSON", establishments)
    write_layer(DEPARTMENTS / "limites_departamentales", "LIMITES_DEPARTAMENTALES_GEOJSON", boundaries)
    print(f"Mapa conjunto: {len(features)} registros, {len(departments)} límites")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--departamento", help="Actualizar únicamente el departamento indicado")
    args = parser.parse_args()
    if args.departamento:
        update_department(args.departamento)
    else:
        main()
