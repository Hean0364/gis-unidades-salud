"""Genera las capas del mapa conjunto sin modificar los 13 mapas individuales.

Ejecutar: python "Unidades de Salud/scripts/generar_mapa_todos_departamentos.py"
Los datos se leen directamente de los Excel departamentales filtrados.
"""

from __future__ import annotations

import json
from collections import Counter

from generar_mapas_departamentales import BOUNDARIES, DEPARTMENTS, collection, records, write_layer


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
    main()
