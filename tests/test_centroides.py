import unittest

from scripts.preparar_fuentes import geom_centroid


class GeometryCentroidTests(unittest.TestCase):
    def assert_point_almost_equal(self, actual, expected):
        self.assertIsNotNone(actual)
        self.assertAlmostEqual(actual[0], expected[0], places=9)
        self.assertAlmostEqual(actual[1], expected[1], places=9)

    def test_polygon_is_weighted_by_area_not_vertex_count(self):
        geometry = {
            "type": "Polygon",
            "coordinates": [[
                [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
                [4, 2], [0, 2], [0, 0],
            ]],
        }
        self.assert_point_almost_equal(geom_centroid(geometry), (2, 1))

    def test_polygon_hole_is_subtracted_regardless_of_orientation(self):
        geometry = {
            "type": "Polygon",
            "coordinates": [
                [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
                [[6, 6], [8, 6], [8, 8], [6, 8], [6, 6]],
            ],
        }
        self.assert_point_almost_equal(geom_centroid(geometry), (472 / 96, 472 / 96))

    def test_multipolygon_uses_every_part_and_its_area(self):
        geometry = {
            "type": "MultiPolygon",
            "coordinates": [
                [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]],
                [[[10, 0], [14, 0], [14, 4], [10, 4], [10, 0]]],
            ],
        }
        self.assert_point_almost_equal(geom_centroid(geometry), (9.8, 1.8))

    def test_open_line_is_weighted_by_segment_length(self):
        geometry = {
            "type": "LineString",
            "coordinates": [[0, 0], [2, 0], [2, 6]],
        }
        # Segmentos de longitud 2 y 6, con puntos medios (1, 0) y (2, 3).
        self.assert_point_almost_equal(geom_centroid(geometry), (1.75, 2.25))

    def test_point_is_unchanged(self):
        geometry = {"type": "Point", "coordinates": [-89.2, 13.7]}
        self.assert_point_almost_equal(geom_centroid(geometry), (-89.2, 13.7))


if __name__ == "__main__":
    unittest.main()
