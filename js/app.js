const SV_BOUNDS = [
  [13.09, -90.18],
  [14.46, -87.65]
];

const SOURCE = {
  minsal: { color: "#1f8a70", label: "MINSAL" },
  osm: { color: "#c45c26", label: "OSM / Overpass" }
};

const osmCartographic = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
});

const esriSatellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
  maxZoom: 19,
  attribution: "Imágenes: Esri, Maxar, Earthstar Geographics"
});

const bases = {
  satellite: { label: "Satélite", layer: esriSatellite },
  osm: { label: "Cartográfico OSM", layer: osmCartographic }
};

const map = L.map("map", {
  center: [13.7, -88.9],
  zoom: 9,
  minZoom: 8,
  maxZoom: 19,
  zoomControl: true,
  layers: [esriSatellite]
});

map.fitBounds(SV_BOUNDS, { padding: [24, 24] });
L.control.scale({ metric: true, imperial: false }).addTo(map);

const vectorLayers = {};
const layerEnabled = { minsal: true, osm: true };
let activeBase = "satellite";
let features = [];

function popupHtml(p) {
  if (!p) return "";
  const rows = [
    ["Fuente", p.fuente],
    ["Tipo", p.tipo],
    ["Departamento", p.departamento],
    ["Municipio", p.municipio],
    ["Región", p.region],
    ["Operador", p.operador],
    ["Dirección", p.direccion],
    ["Teléfono", p.telefono],
    ["Horario", p.horario],
    ["OSM", p.osm_id]
  ].filter(([, v]) => v);

  const maps = p.google_maps
    ? `<p><a href="${p.google_maps}" target="_blank" rel="noopener">Abrir en Google Maps</a></p>`
    : "";

  return `<div class="popup">
    <h3>${p.nombre || "Sin nombre"}</h3>
    <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
    ${maps}
  </div>`;
}

function sourceKey(props) {
  return (props.fuente || "").toLowerCase().includes("minsal") ? "minsal" : "osm";
}

function styleFor(feature) {
  const key = sourceKey(feature.properties || {});
  const color = SOURCE[key].color;
  return {
    color,
    fillColor: color,
    weight: 2,
    fillOpacity: 0.22,
    opacity: 0.95
  };
}

function pointMarker(feature, latlng) {
  const key = sourceKey(feature.properties || {});
  const color = SOURCE[key].color;
  return L.circleMarker(latlng, {
    radius: key === "minsal" ? 6 : 7,
    color: "#fff",
    weight: 1.4,
    fillColor: color,
    fillOpacity: 0.95
  });
}

function bindFeature(layer, feature) {
  layer.bindPopup(popupHtml(feature.properties), { maxWidth: 300 });
  layer.on("mouseover", () => status(feature.properties.nombre || ""));
}

function makeLayer(geojson) {
  return L.geoJSON(geojson, {
    style: styleFor,
    pointToLayer: pointMarker,
    onEachFeature: (feature, layer) => bindFeature(layer, feature)
  });
}

function buildVectorLayers() {
  const minsal = window.MINSAL_GEOJSON;
  const osm = window.OSM_GEOJSON;
  if (!minsal || !osm) {
    status("No se encontraron las dos fuentes");
    return;
  }

  features = [
    ...(minsal.features || []),
    ...(osm.features || [])
  ];

  vectorLayers.minsal = makeLayer(minsal);
  vectorLayers.osm = makeLayer(osm);

  if (layerEnabled.minsal) vectorLayers.minsal.addTo(map);
  if (layerEnabled.osm) vectorLayers.osm.addTo(map);
  vectorLayers.osm.bringToFront();

  document.getElementById("count-minsal").textContent = (minsal.features || []).length;
  document.getElementById("count-osm").textContent = (osm.features || []).length;
  updateStats();
  renderOverlays();
  renderResults(visibleFeatures().slice(0, 12));
  status(`${visibleFeatures().length} registros en vista (MINSAL y OSM sin fusionar)`);
}

function visibleFeatures() {
  return features.filter((f) => {
    const key = sourceKey(f.properties);
    return layerEnabled[key] && map.hasLayer(vectorLayers[key]);
  });
}

function updateStats() {
  document.getElementById("count-all").textContent = visibleFeatures().length;
}

function renderBases() {
  const box = document.getElementById("bases");
  box.innerHTML = "";
  for (const [id, item] of Object.entries(bases)) {
    const btn = document.createElement("button");
    btn.className = `base-btn${id === activeBase ? " active" : ""}`;
    btn.type = "button";
    btn.textContent = item.label;
    btn.addEventListener("click", () => setBase(id));
    box.appendChild(btn);
  }
}

function setBase(id) {
  for (const item of Object.values(bases)) {
    if (map.hasLayer(item.layer)) map.removeLayer(item.layer);
  }
  activeBase = id;
  bases[id].layer.addTo(map);
  if (bases[id].layer.bringToBack) bases[id].layer.bringToBack();
  Object.values(vectorLayers).forEach((layer) => {
    if (map.hasLayer(layer)) layer.bringToFront();
  });
  renderBases();
}

function renderOverlays() {
  const box = document.getElementById("overlays");
  box.innerHTML = "";

  const addToggle = (id, label, layer, checked) => {
    const wrap = document.createElement("label");
    wrap.innerHTML = `<input type="checkbox" ${checked ? "checked" : ""} data-id="${id}"> ${label}`;
    wrap.querySelector("input").addEventListener("change", (ev) => {
      layerEnabled[id] = ev.target.checked;
      if (ev.target.checked) layer.addTo(map);
      else map.removeLayer(layer);
      updateStats();
      renderResults(visibleFeatures().slice(0, 12));
      status(`${visibleFeatures().length} registros en vista`);
    });
    box.appendChild(wrap);
  };

  addToggle("minsal", "MINSAL · puntos oficiales", vectorLayers.minsal, layerEnabled.minsal);
  addToggle("osm", "OSM / Overpass · predios", vectorLayers.osm, layerEnabled.osm);
}

function renderResults(list) {
  const box = document.getElementById("results");
  if (!list.length) {
    box.innerHTML = "<div class='result'>Sin coincidencias</div>";
    return;
  }
  box.innerHTML = "";
  for (const f of list.slice(0, 20)) {
    const p = f.properties;
    const btn = document.createElement("button");
    btn.className = "result";
    btn.type = "button";
    const extra = [p.fuente, p.municipio, p.departamento].filter(Boolean).join(" · ");
    btn.innerHTML = `<strong>${p.nombre}</strong><small>${p.tipo || ""}${extra ? " · " + extra : ""}</small>`;
    btn.addEventListener("click", () => focusFeature(f));
    box.appendChild(btn);
  }
}

function focusFeature(feature) {
  const key = sourceKey(feature.properties);
  const layer = vectorLayers[key];
  if (!layer) return;
  if (!map.hasLayer(layer)) layer.addTo(map);
  let found = false;
  layer.eachLayer((l) => {
    const p = l.feature && l.feature.properties;
    if (!p || p.id !== feature.properties.id) return;
    found = true;
    if (l.getLatLng) {
      map.setView(l.getLatLng(), Math.max(map.getZoom(), 16));
      l.openPopup();
    } else if (l.getBounds) {
      map.fitBounds(l.getBounds(), { maxZoom: 17, padding: [40, 40] });
      l.openPopup();
    }
  });
  if (!found && feature.properties.lat && feature.properties.lon) {
    map.setView([feature.properties.lat, feature.properties.lon], 16);
  }
}

function status(text) {
  document.getElementById("status").textContent = text;
}

document.getElementById("fit").addEventListener("click", () => {
  map.fitBounds(SV_BOUNDS, { padding: [24, 24] });
});

document.getElementById("search").addEventListener("input", (ev) => {
  const q = ev.target.value.trim().toLowerCase();
  const pool = visibleFeatures();
  const matches = !q ? pool.slice(0, 12) : pool.filter((f) => {
    const p = f.properties;
    const blob = `${p.nombre} ${p.tipo || ""} ${p.municipio || ""} ${p.departamento || ""} ${p.fuente || ""}`.toLowerCase();
    return blob.includes(q);
  });
  renderResults(matches);
  if (q && matches.length === 1) focusFeature(matches[0]);
});

renderBases();
buildVectorLayers();
