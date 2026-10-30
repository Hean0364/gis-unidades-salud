"""Depura duplicados solo en los siete departamentos pendientes.

No modifica los seis departamentos excluidos ni ejecuta tests. El mapa conjunto
se actualiza conservando exactamente los registros de los departamentos excluidos.
"""

from collections import Counter, defaultdict
import json

from deduplicar_departamentos import deduplicate_department
from generar_mapas_departamentales import DEPARTMENTS, write_layer


EXCLUDED = {"La Paz", "Cabañas", "Ahuachapán", "Sonsonate", "Usulután", "La Libertad"}
TARGETS = {"Chalatenango", "Cuscatlán", "La Unión", "Morazán", "San Miguel", "San Vicente", "Santa Ana"}


def main():
    general = json.loads((DEPARTMENTS / "establecimientos_todos.geojson").read_text(encoding="utf-8"))
    departments = general["meta"]["departamentos"]
    if set(departments) != TARGETS | EXCLUDED:
        raise ValueError("Los departamentos del mapa conjunto no coinciden con el alcance solicitado")
    original_features = defaultdict(list)
    for feature in general["features"]:
        original_features[feature["properties"]["departamento"]].append(feature)

    results = [deduplicate_department(department) for department in departments if department in TARGETS]
    replacements = {result["departamento"]: result["collection"]["features"] for result in results}
    general["features"] = [
        feature
        for department in departments
        for feature in (replacements[department] if department in TARGETS else original_features[department])
    ]
    counts = Counter(feature["geometry"]["type"] for feature in general["features"])
    general["meta"].update({
        "count": len(general["features"]),
        "puntos": counts["Point"],
        "poligonos": counts["Polygon"],
    })
    write_layer(DEPARTMENTS / "establecimientos_todos", "ESTABLECIMIENTOS_TODOS_GEOJSON", general)
    summary = {
        "departamentos_excluidos": sorted(EXCLUDED),
        "departamentos_actualizados": [
            {key: value for key, value in result.items() if key != "collection"}
            for result in results
        ],
        "duplicados_eliminados": sum(result["eliminados"] for result in results),
        "registros_mapa_general": general["meta"]["count"],
    }
    (DEPARTMENTS / "resumen_depuracion_departamentos.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("RESUMEN")
    for result in results:
        print(f"{result['departamento']}: {result['antes']} -> {result['despues']}; {result['eliminados']} duplicados eliminados")
    print(f"Total de duplicados eliminados: {summary['duplicados_eliminados']}")
    print(f"Mapa general actualizado: {summary['registros_mapa_general']} registros")
    print("Los seis departamentos excluidos se conservaron sin cambios.")


if __name__ == "__main__":
    main()
