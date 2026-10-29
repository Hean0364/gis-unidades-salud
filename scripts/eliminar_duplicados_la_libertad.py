"""Elimina duplicados confirmados de La Libertad, sin ejecutar tests."""

from deduplicar_departamentos import deduplicate_department


def main():
    deduplicate_department("La Libertad")


if __name__ == "__main__":
    main()
