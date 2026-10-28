"""Sirve los mapas por HTTP local para que OSM reciba el Referer del navegador."""

from __future__ import annotations

import argparse
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def make_server(port: int) -> ThreadingHTTPServer:
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    return ThreadingHTTPServer(("127.0.0.1", port), handler)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    try:
        server = make_server(args.port)
    except OSError as exc:
        parser.exit(1, f"No se pudo iniciar el servidor: {exc}\nPrueba con --port 8001.\n")
    with server:
        origin = f"http://127.0.0.1:{server.server_port}"
        url = f"{origin}/data/por_departamento/"
        print(f"Mapa conjunto: {url}", flush=True)
        print(f"La Paz: {origin}/data/por_departamento/La%20Paz/", flush=True)
        print("Deja esta ventana abierta. Para cerrar el servidor, presiona Ctrl+C.", flush=True)
        if not args.no_browser:
            webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
