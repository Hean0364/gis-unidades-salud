/* Mapas base compartidos: acceso OSM y límite de detalle satelital. */
(() => {
  const osmAvailable = ["http:", "https:"].includes(window.location.protocol);
  const localMessage = "Archivo local: se usa Satélite. Para ver Cartográfico OSM, abre abrir_mapas.cmd.";

  window.MAP_BASES = {
    osmAvailable,
    initialId: osmAvailable ? "osm" : "satellite",

    createOsm() {
      return L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        updateWhenIdle: true,
        updateWhenZooming: false,
        referrerPolicy: "strict-origin-when-cross-origin",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      });
    },

    createSatellite() {
      return L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        // En La Paz el nivel 19 devuelve "Map data not yet available".
        // Ampliar las imágenes del nivel 18 sin limitar el zoom de los vectores.
        maxNativeZoom: 18,
        updateWhenIdle: true,
        updateWhenZooming: false,
        attribution: "Imágenes: Esri, Maxar, Earthstar Geographics"
      });
    },

    configureRadio(input, id) {
      if (id === "osm" && !osmAvailable) {
        input.disabled = true;
        input.title = localMessage;
      }
    },

    watchOsm(map, layer, useSatellite) {
      let notice;
      let activation = 0;
      let checkPending = true;
      function showNotice(message) {
        if (notice) notice.remove();
        notice = L.control({ position: "topright" });
        notice.onAdd = () => {
          const element = L.DomUtil.create("div", "map-notice");
          element.setAttribute("role", "status");
          element.textContent = message;
          L.DomEvent.disableClickPropagation(element);
          L.DomEvent.disableScrollPropagation(element);
          return element;
        };
        notice.addTo(map);
      }

      function fallback() {
        // Ignorar errores tardíos de una base que el usuario ya desactivó.
        if (!map.hasLayer(layer)) return;
        useSatellite();
        showNotice("No se pudo cargar Cartográfico OSM. Se cambió a Satélite; las capas de salud siguen disponibles.");
      }

      layer.on("tileerror", fallback);
      layer.on("add", () => {
        activation += 1;
        checkPending = true;
      });
      layer.on("remove", () => { activation += 1; });
      layer.on("tileload", async ({ tile }) => {
        if (!checkPending || !map.hasLayer(layer)) return;
        checkPending = false;
        const currentActivation = activation;
        try {
          // Un 403 puede contener un PNG válido y disparar tileload, no tileerror.
          // Comprobar solo una tesela ya visible por activación, con caché normal.
          const response = await fetch(tile.currentSrc || tile.src, {
            referrerPolicy: "strict-origin-when-cross-origin"
          });
          await response.arrayBuffer();
          if (currentActivation !== activation || !map.hasLayer(layer)) return;
          if (!response.ok) fallback();
          else if (notice) {
            notice.remove();
            notice = null;
          }
        } catch (_) {
          if (currentActivation === activation) fallback();
        }
      });
      if (!osmAvailable) showNotice(localMessage);
    }
  };
})();
