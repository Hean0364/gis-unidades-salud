const SV_BOUNDS = [
  [13.09, -90.18],
  [14.46, -87.65]
];

const SOURCE_ORDER = ["minsal", "osm", "geofabrik", "hot"];

const SOURCE = {
  minsal: { color: "#1f8a70", label: "MINSAL", hint: "Puntos oficiales · color según el tipo" },
  osm: { color: "#c45c26", label: "OSM / Overpass", hint: "Predios · el borde marca la fuente" },
  geofabrik: { color: "#2458a6", label: "Geofabrik", hint: "Salud, 5 oct 2026 · el borde marca la fuente" },
  hot: { color: "#a21caf", label: "HOT / HDX", hint: "OSM humanitario, 7 oct 2026 · el borde marca la fuente" }
};

const DETALLE_ORDER = ["Predio", "Edificio", "Polígono", "Punto"];

const osmCartographic = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
});

const osmHumanitarian = L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
  maxZoom: 19,
  subdomains: "abc",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, teselas HOT por <a href="https://www.hotosm.org/">Humanitarian OpenStreetMap Team</a>'
});

const esriSatellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
  maxZoom: 19,
  attribution: "Imágenes: Esri, Maxar, Earthstar Geographics"
});

const bases = {
  satellite: { label: "Satélite", layer: esriSatellite },
  osm: { label: "Cartográfico OSM", layer: osmCartographic },
  hot: { label: "Humanitario OSM", layer: osmHumanitarian }
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
const members = { minsal: [], osm: [], geofabrik: [], hot: [] };
const collections = {};
const typeOn = { minsal: {}, osm: {}, geofabrik: {}, hot: {} };
const extraOn = { minsal: "all", osm: "all", geofabrik: "all", hot: "all" };
const layerEnabled = { minsal: true, osm: true, geofabrik: true, hot: true };
const legendScroll = {};
let activeBase = "satellite";

function extraKey(sourceId) {
  if (sourceId === "minsal") return "region";
  if (sourceId === "geofabrik" || sourceId === "hot") return "detalle";
  return null;
}

function extraCaption(sourceId) {
  if (sourceId === "minsal") return "Región";
  if (sourceId === "geofabrik" || sourceId === "hot") return "Geometría";
  return "";
}

function prettyExtra(sourceId, value) {
  if (sourceId === "minsal") return String(value).replace(/^Region\b/, "Región");
  return value;
}

function legendLabel(tipo) {
  const text = String(tipo || "Sin tipo");
  const acronym = text.match(/\(([A-Z]{2,})\)/);
  if (acronym) return acronym[1];
  return text.replace(/\s*\([^)]*\)/g, "").trim();
}

function minsalColor(tipo) {
  const t = String(tipo || "").toLowerCase();
  if (t.includes("especializado") || t.includes("iii nivel")) return "#7f1d1d";
  if (t.includes("hospital regional")) return "#e11d48";
  if (t.includes("departamental")) return "#b91c1c";
  if (t.includes("básico") || t.includes("basico")) return "#f43f5e";
  if (t.includes("hospital")) return "#d64545";
  if (t.includes("ucsfe")) return "#1d4ed8";
  if (t.includes("ucsfi")) return "#0f766e";
  if (t.includes("ucsfb")) return "#15803d";
  if (t.includes("casa de salud")) return "#4d7c0f";
  if (t.includes("integral")) return "#0369a1";
  if (t.includes("crn") || t.includes("nutrici")) return "#c2410c";
  if (t.includes("hem") || t.includes("materna")) return "#be185d";
  if (t.includes("sibasi")) return "#64748b";
  if (t.includes("administrativo i")) return "#475569";
  if (t.includes("superior")) return "#334155";
  if (t.includes("osi")) return "#1e3a8a";
  if (t.includes("(sem)")) return "#b45309";
  if (t.includes("(cae)")) return "#d97706";
  if (t.includes("empleados")) return "#7c3aed";
  if (t.includes("laboratorio")) return "#0e7490";
  if (t.includes("farmacia")) return "#6d28d9";
  return "#1f8a70";
}

function colorForTipo(sourceId, tipo) {
  if (sourceId === "minsal") return minsalColor(tipo);
  const t = String(tipo || "").toLowerCase();
  if (t.includes("hospital")) return "#d64545";
  if (t.includes("clínica") || t.includes("clinica")) return "#2f80ed";
  if (t.includes("consultorio") || t.includes("doctor")) return "#9b51e0";
  if (t.includes("puesto") || t.includes("promotor")) return "#219653";
  if (t.includes("farmacia")) return "#0f766e";
  if (t.includes("dentista") || t.includes("odont")) return "#db2777";
  if (t.includes("laboratorio")) return "#0891b2";
  if (t.includes("rehabilit")) return "#ca8a04";
  if (t.includes("parto") || t.includes("sangre")) return "#e11d48";
  if (t.includes("optometr") || t.includes("audiolog")) return "#7c3aed";
  if (t.includes("alternativa") || t.includes("consejer") || t.includes("muestra")) return "#4d7c0f";
  if (t === "osm" || t === "otro") return "#c45c26";
  return SOURCE[sourceId].color;
}

function popupHtml(p) {
  if (!p) return "";
  const rows = [
    ["Fuente", p.fuente],
    ["Tipo", p.tipo],
    ["Detalle", p.detalle],
    ["Departamento", p.departamento],
    ["Municipio", p.municipio],
    ["Región", p.region ? prettyExtra("minsal", p.region) : ""],
    ["Especialidad", p.especialidad],
    ["Capacidad", p.capacidad],
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
  const fuente = (props.fuente || "").toLowerCase();
  if (fuente.includes("minsal")) return "minsal";
  if (fuente.includes("geofabrik")) return "geofabrik";
  if (fuente.includes("hot")) return "hot";
  return "osm";
}

function styleFor(feature, sourceId) {
  const tipo = (feature.properties || {}).tipo || "Sin tipo";
  return {
    color: SOURCE[sourceId].color,
    fillColor: colorForTipo(sourceId, tipo),
    weight: 2,
    fillOpacity: 0.38,
    opacity: 0.95
  };
}

function pointMarker(feature, latlng, sourceId) {
  const tipo = (feature.properties || {}).tipo || "Sin tipo";
  return L.circleMarker(latlng, {
    radius: sourceId === "minsal" ? 6 : 5,
    color: "#fff",
    weight: 1.5,
    fillColor: colorForTipo(sourceId, tipo),
    fillOpacity: 0.95
  });
}

function bindFeature(layer, feature) {
  layer.bindPopup(popupHtml(feature.properties), { maxWidth: 320 });
  layer.on("mouseover", () => status(feature.properties.nombre || ""));
}

function makeLayer(geojson, sourceId) {
  return L.geoJSON(geojson, {
    style: (feature) => styleFor(feature, sourceId),
    pointToLayer: (feature, latlng) => pointMarker(feature, latlng, sourceId),
    onEachFeature: (feature, layer) => {
      bindFeature(layer, feature);
      members[sourceId].push(layer);
    }
  });
}

function indexSource(sourceId, geojson) {
  collections[sourceId] = geojson;
  typeOn[sourceId] = {};
  for (const feature of geojson.features || []) {
    const tipo = (feature.properties && feature.properties.tipo) || "Sin tipo";
    typeOn[sourceId][tipo] = true;
  }
}

function passesExtra(sourceId, props) {
  const key = extraKey(sourceId);
  const selected = extraOn[sourceId];
  if (!key || selected === "all") return true;
  return ((props && props[key]) || "Sin dato") === selected;
}

function passes(sourceId, feature) {
  const props = feature.properties || {};
  const tipo = props.tipo || "Sin tipo";
  return !!typeOn[sourceId][tipo] && passesExtra(sourceId, props);
}

function tiposOf(sourceId) {
  return Object.keys(typeOn[sourceId]).sort((a, b) => (
    totalTipo(sourceId, b) - totalTipo(sourceId, a) || a.localeCompare(b, "es")
  ));
}

function totalTipo(sourceId, tipo) {
  return collections[sourceId].features.filter((feature) => (
    ((feature.properties && feature.properties.tipo) || "Sin tipo") === tipo
  )).length;
}

function countTipo(sourceId, tipo) {
  return collections[sourceId].features.filter((feature) => {
    const props = feature.properties || {};
    return (props.tipo || "Sin tipo") === tipo && passesExtra(sourceId, props);
  }).length;
}

function filteredCount(sourceId) {
  return collections[sourceId].features.filter((feature) => passes(sourceId, feature)).length;
}

function visibleFeatures() {
  const list = [];
  for (const id of SOURCE_ORDER) {
    if (!layerEnabled[id]) continue;
    for (const feature of collections[id].features) {
      if (passes(id, feature)) list.push(feature);
    }
  }
  return list;
}

function raiseVectors() {
  for (const id of ["osm", "geofabrik", "hot", "minsal"]) {
    const layer = vectorLayers[id];
    if (layer && map.hasLayer(layer)) layer.bringToFront();
  }
}

function syncSource(sourceId) {
  const group = vectorLayers[sourceId];
  if (!group) return;
  const enabled = layerEnabled[sourceId];
  for (const layer of members[sourceId]) {
    const show = enabled && passes(sourceId, layer.feature);
    const inside = group.hasLayer(layer);
    if (show && !inside) group.addLayer(layer);
    else if (!show && inside) group.removeLayer(layer);
  }
  if (enabled) {
    if (!map.hasLayer(group)) group.addTo(map);
  } else if (map.hasLayer(group)) {
    map.removeLayer(group);
  }
  raiseVectors();
}

function buildVectorLayers() {
  const packs = {
    minsal: window.MINSAL_GEOJSON,
    osm: window.OVERPASS_GEOJSON,
    geofabrik: window.GEOFABRIK_GEOJSON,
    hot: window.HOT_GEOJSON
  };
  if (!packs.minsal || !packs.osm || !packs.geofabrik || !packs.hot) {
    status("No se encontraron las cuatro fuentes");
    return;
  }

  for (const id of SOURCE_ORDER) {
    indexSource(id, packs[id]);
    vectorLayers[id] = makeLayer(packs[id], id);
    syncSource(id);
  }
  renderLayers();
  refreshView();
}

function updateStats() {
  let total = 0;
  for (const id of SOURCE_ORDER) {
    const n = layerEnabled[id] ? filteredCount(id) : 0;
    total += n;
    document.getElementById(`count-${id}`).textContent = n;
  }
  document.getElementById("count-all").textContent = total;
}

function tipoSelectValue(sourceId, tipos) {
  const on = tipos.filter((tipo) => typeOn[sourceId][tipo]);
  if (on.length === tipos.length) return "all";
  if (on.length === 1) return on[0];
  return "custom";
}

function applyTipoFilter(sourceId, value) {
  if (value === "custom") return;
  for (const tipo of Object.keys(typeOn[sourceId])) {
    typeOn[sourceId][tipo] = value === "all" || tipo === value;
  }
  syncSource(sourceId);
  renderLayers();
  refreshView();
}

function swatch(color, sourceId) {
  const mark = document.createElement("span");
  mark.className = `swatch ${sourceId === "minsal" ? "point" : "area"}`;
  mark.style.color = color;
  mark.style.background = color;
  return mark;
}

function buildTipoFilter(sourceId) {
  const wrap = document.createElement("label");
  wrap.className = "filter-label";
  const caption = document.createElement("span");
  caption.textContent = "Tipo";
  const select = document.createElement("select");
  select.className = "filter-select";

  const tipos = tiposOf(sourceId);
  const selected = tipoSelectValue(sourceId, tipos);

  const all = document.createElement("option");
  all.value = "all";
  all.textContent = "Todos los tipos";
  select.append(all);

  if (selected === "custom") {
    const custom = document.createElement("option");
    custom.value = "custom";
    const on = tipos.filter((tipo) => typeOn[sourceId][tipo]).length;
    custom.textContent = on === 0 ? "Ninguno" : "Varios tipos";
    select.append(custom);
  }

  for (const tipo of tipos) {
    const option = document.createElement("option");
    option.value = tipo;
    option.textContent = `${legendLabel(tipo)} (${countTipo(sourceId, tipo)})`;
    option.title = tipo;
    select.append(option);
  }
  select.value = selected;
  select.addEventListener("change", () => applyTipoFilter(sourceId, select.value));
  wrap.append(caption, select);
  return wrap;
}

function extraValues(sourceId) {
  const key = extraKey(sourceId);
  const counts = new Map();
  for (const feature of collections[sourceId].features) {
    const value = (feature.properties && feature.properties[key]) || "Sin dato";
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  const values = [...counts.keys()];
  if (sourceId === "geofabrik" || sourceId === "hot") {
    values.sort((a, b) => {
      const ia = DETALLE_ORDER.indexOf(a);
      const ib = DETALLE_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  } else {
    values.sort((a, b) => a.localeCompare(b, "es"));
  }
  return values.map((value) => [value, counts.get(value)]);
}

function buildExtraFilter(sourceId) {
  if (!extraKey(sourceId)) return null;
  const wrap = document.createElement("label");
  wrap.className = "filter-label";
  const caption = document.createElement("span");
  caption.textContent = extraCaption(sourceId);
  const select = document.createElement("select");
  select.className = "filter-select";

  const all = document.createElement("option");
  all.value = "all";
  all.textContent = "Todas";
  select.append(all);

  for (const [value, count] of extraValues(sourceId)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `${prettyExtra(sourceId, value)} (${count})`;
    select.append(option);
  }
  select.value = extraOn[sourceId];
  select.addEventListener("change", () => {
    extraOn[sourceId] = select.value;
    syncSource(sourceId);
    renderLayers();
    refreshView();
  });
  wrap.append(caption, select);
  return wrap;
}

function buildLegend(sourceId) {
  const legend = document.createElement("div");
  legend.className = "legend";
  legend.dataset.source = sourceId;

  for (const tipo of tiposOf(sourceId)) {
    const count = countTipo(sourceId, tipo);
    const row = document.createElement("label");
    row.title = tipo;
    if (!count) row.classList.add("is-empty");

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!typeOn[sourceId][tipo];
    input.addEventListener("change", () => {
      typeOn[sourceId][tipo] = input.checked;
      syncSource(sourceId);
      renderLayers();
      refreshView();
    });

    const name = document.createElement("span");
    name.className = "legend-name";
    name.textContent = legendLabel(tipo);
    const total = document.createElement("em");
    total.textContent = String(count);
    row.append(input, swatch(colorForTipo(sourceId, tipo), sourceId), name, total);
    legend.append(row);
  }
  return legend;
}

function buildLayerCard(sourceId) {
  const meta = SOURCE[sourceId];
  const card = document.createElement("article");
  card.className = `layer-card${layerEnabled[sourceId] ? " is-on" : ""}`;
  card.style.setProperty("--source", meta.color);

  const head = document.createElement("header");
  head.className = "layer-head";
  const toggle = document.createElement("label");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = layerEnabled[sourceId];
  checkbox.setAttribute("aria-label", `Mostrar ${meta.label}`);
  checkbox.addEventListener("change", () => {
    layerEnabled[sourceId] = checkbox.checked;
    syncSource(sourceId);
    renderLayers();
    refreshView();
  });
  const title = document.createElement("span");
  title.className = "layer-title";
  title.textContent = meta.label;
  toggle.append(checkbox, swatch(meta.color, sourceId), title);

  const count = document.createElement("b");
  count.className = "layer-count";
  count.textContent = `${filteredCount(sourceId)} / ${collections[sourceId].features.length}`;
  head.append(toggle, count);

  const hint = document.createElement("p");
  hint.className = "layer-hint";
  hint.textContent = meta.hint;

  card.append(head, hint, buildTipoFilter(sourceId));
  const extra = buildExtraFilter(sourceId);
  if (extra) card.append(extra);
  card.append(buildLegend(sourceId));
  return card;
}

function renderLayers() {
  const panel = document.querySelector(".panel");
  const panelTop = panel ? panel.scrollTop : 0;
  document.querySelectorAll(".legend").forEach((legend) => {
    legendScroll[legend.dataset.source] = legend.scrollTop;
  });

  const box = document.getElementById("layers");
  box.replaceChildren();
  for (const id of SOURCE_ORDER) box.append(buildLayerCard(id));

  document.querySelectorAll(".legend").forEach((legend) => {
    const saved = legendScroll[legend.dataset.source];
    if (saved) legend.scrollTop = saved;
  });
  if (panel) panel.scrollTop = panelTop;
}

function renderBases() {
  const box = document.getElementById("bases");
  box.replaceChildren();
  for (const [id, item] of Object.entries(bases)) {
    const btn = document.createElement("button");
    btn.className = `base-btn${id === activeBase ? " active" : ""}`;
    btn.type = "button";
    btn.textContent = item.label;
    btn.addEventListener("click", () => setBase(id));
    box.append(btn);
  }
}

function setBase(id) {
  for (const item of Object.values(bases)) {
    if (map.hasLayer(item.layer)) map.removeLayer(item.layer);
  }
  activeBase = id;
  bases[id].layer.addTo(map);
  if (bases[id].layer.bringToBack) bases[id].layer.bringToBack();
  raiseVectors();
  renderBases();
}

function renderResults(list) {
  const box = document.getElementById("results");
  box.replaceChildren();
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "result";
    empty.textContent = "Sin coincidencias";
    box.append(empty);
    return;
  }

  for (const feature of list.slice(0, 20)) {
    const props = feature.properties;
    const key = sourceKey(props);
    const btn = document.createElement("button");
    btn.className = "result";
    btn.type = "button";
    const strong = document.createElement("strong");
    strong.append(
      swatch(colorForTipo(key, props.tipo || ""), key),
      document.createTextNode(props.nombre || "Sin nombre")
    );
    const small = document.createElement("small");
    small.textContent = [legendLabel(props.tipo || ""), props.fuente, props.municipio, props.departamento]
      .filter(Boolean)
      .join(" · ");
    btn.append(strong, small);
    btn.addEventListener("click", () => focusFeature(feature));
    box.append(btn);
  }
}

function queryMatches(list, q) {
  if (!q) return list.slice(0, 12);
  return list.filter((feature) => {
    const props = feature.properties;
    const blob = [
      props.nombre,
      props.tipo,
      props.municipio,
      props.departamento,
      props.region,
      props.detalle,
      props.fuente
    ].filter(Boolean).join(" ").toLowerCase();
    return blob.includes(q);
  });
}

function currentQuery() {
  return document.getElementById("search").value.trim().toLowerCase();
}

function refreshView() {
  updateStats();
  const q = currentQuery();
  const matches = queryMatches(visibleFeatures(), q);
  renderResults(matches);
  status(q ? `${matches.length} coincidencias` : `${visibleFeatures().length} registros activos`);
}

function focusFeature(feature) {
  const key = sourceKey(feature.properties);
  const group = vectorLayers[key];
  if (!group) return;

  const tipo = (feature.properties.tipo || "Sin tipo");
  let changed = false;
  if (!layerEnabled[key]) {
    layerEnabled[key] = true;
    changed = true;
  }
  if (!typeOn[key][tipo]) {
    typeOn[key][tipo] = true;
    changed = true;
  }
  const keyName = extraKey(key);
  if (keyName && extraOn[key] !== "all") {
    const value = feature.properties[keyName] || "Sin dato";
    if (value !== extraOn[key]) {
      extraOn[key] = "all";
      changed = true;
    }
  }
  if (changed) {
    syncSource(key);
    renderLayers();
    refreshView();
  }

  let found = false;
  group.eachLayer((layer) => {
    const props = layer.feature && layer.feature.properties;
    if (!props || props.id !== feature.properties.id) return;
    found = true;
    if (layer.getLatLng) {
      map.setView(layer.getLatLng(), Math.max(map.getZoom(), 16));
      layer.openPopup();
    } else if (layer.getBounds) {
      map.fitBounds(layer.getBounds(), { maxZoom: 17, padding: [40, 40] });
      layer.openPopup();
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

document.getElementById("search").addEventListener("input", () => {
  const q = currentQuery();
  const matches = queryMatches(visibleFeatures(), q);
  renderResults(matches);
  status(q ? `${matches.length} coincidencias` : `${visibleFeatures().length} registros activos`);
  if (q && matches.length === 1) focusFeature(matches[0]);
});

renderBases();
buildVectorLayers();
