import threading
import unittest
from urllib.request import urlopen

from scripts.generar_mapas_departamentales import html_page
from scripts.servir_mapas import make_server


class MapServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = make_server(0)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.origin = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def test_server_binds_only_to_loopback_and_serves_la_paz(self):
        self.assertEqual(self.server.server_address[0], "127.0.0.1")
        with urlopen(f"{self.origin}/data/por_departamento/La%20Paz/") as response:
            html = response.read().decode("utf-8")
        self.assertIn("Unidades de Salud · La Paz", html)
        self.assertIn('../../../js/mapas_base.js', html)

    def test_shared_config_is_available(self):
        with urlopen(f"{self.origin}/js/mapas_base.js") as response:
            self.assertIn("window.MAP_BASES", response.read().decode("utf-8"))

    def test_generator_keeps_config_before_department_app(self):
        html = html_page("La Paz")
        self.assertLess(html.index("js/mapas_base.js"), html.index("js/app_departamento.js"))


if __name__ == "__main__":
    unittest.main()
