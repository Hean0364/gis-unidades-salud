const SAN_SALVADOR_BOUNDS = [
  [13.4756208, -89.2928405],
  [14.0647772, -89.025446]
];

const FILTERED_SOURCE_IDS = ["unificado_poligonos", "unificado_puntos"];
const SOURCE_ORDER = [...FILTERED_SOURCE_IDS, "minsal", "osm", "geofabrik", "hot"];
const ADMINISTRATIVE_ORDER = ["departamentos"];

const SOURCE = {
  unificado_poligonos: { color: "#0f766e", label: "Polígonos depurados", hint: "Sin privados lucrativos ni edificios internos · los centroides acompañan a cada polígono" },
  unificado_puntos: { color: "#d97706", label: "Puntos depurados", hint: "Sin privados lucrativos ni puntos superpuestos con polígonos" },
  minsal: { color: "#1f8a70", label: "MINSAL", hint: "Registros vinculados con la capa principal filtrada" },
  osm: { color: "#c45c26", label: "OSM / Overpass", hint: "Registros vinculados con la capa principal filtrada" },
  geofabrik: { color: "#2458a6", label: "Geofabrik", hint: "Registros vinculados con la capa principal filtrada" },
  hot: { color: "#a21caf", label: "HOT / HDX", hint: "Registros vinculados con la capa principal filtrada" }
};

const ADMINISTRATIVE = {
  departamentos: {
    color: "#475569",
    fillColor: "#94a3b8",
    label: "San Salvador",
    hint: "Límite del departamento de San Salvador"
  }
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
  center: [13.76, -89.15],
  zoom: 11,
  minZoom: 9,
  maxZoom: 19,
  zoomControl: true,
  layers: [osmCartographic]
});

map.fitBounds(SAN_SALVADOR_BOUNDS, { padding: [24, 24] });
L.control.scale({ metric: true, imperial: false }).addTo(map);
map.createPane("administrativePane");
map.getPane("administrativePane").style.zIndex = 350;
map.attributionControl.addAttribution('Límite: <a href="https://www.geoboundaries.org/" target="_blank" rel="noopener">geoBoundaries</a> / OpenStreetMap');

const vectorLayers = {};
const members = Object.fromEntries(SOURCE_ORDER.map((sourceId) => [sourceId, []]));
const collections = {};
const typeOn = Object.fromEntries(SOURCE_ORDER.map((sourceId) => [sourceId, {}]));
const extraOn = Object.fromEntries(SOURCE_ORDER.map((sourceId) => [sourceId, "all"]));
const layerEnabled = Object.fromEntries(SOURCE_ORDER.map((sourceId) => (
  [sourceId, FILTERED_SOURCE_IDS.includes(sourceId)]
)));
const administrativeEnabled = { departamentos: true };
const expanded = {
  fuentes: true,
  limites: true,
  bases: true,
  unificado_poligonos: true,
  unificado_puntos: true,
  minsal: false,
  osm: false,
  geofabrik: false,
  hot: false
};
let activeBase = "osm";
let selectedLayer = "unificado_poligonos";
let searchIndex = [];
let searchMatches = [];
let activeSearchResult = -1;

const ICONS = {
  folder: '<svg viewBox="0 0 16 16"><path d="M1.5 3.5h5l1.5 1.5h6.5v8h-13z" fill="#f2c94c" stroke="#b8902a"/></svg>',
  raster: '<svg viewBox="0 0 16 16"><rect x="1.5" y="2.5" width="13" height="11" fill="#dcebd5" stroke="#5b7f52"/><path d="M2 13l4-5 3 3 2-2 3.5 4z" fill="#7fa86f"/><circle cx="11" cy="5.5" r="1.3" fill="#e8b84a"/></svg>',
  filter: '<svg viewBox="0 0 16 16"><path d="M2 3h12l-4.5 5.5V13l-3-1.5v-3z" fill="#e8b84a" stroke="#9a6b12"/></svg>'
};

function extraKey(sourceId) {
  if (FILTERED_SOURCE_IDS.includes(sourceId)) return "fuente_conservada";
  if (sourceId === "minsal") return "region";
  if (sourceId === "geofabrik" || sourceId === "hot") return "detalle";
  return null;
}

function extraCaption(sourceId) {
  if (FILTERED_SOURCE_IDS.includes(sourceId)) return "Fuente principal";
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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character]);
}

function isPointSource(sourceId) {
  return sourceId === "minsal" || sourceId === "unificado_puntos";
}

function externalLink(url, label) {
  if (!url) return "";
  try {
    const parsed = new URL(String(url), window.location.href);
    if (!['http:', 'https:'].includes(parsed.protocol)) return "";
    return `<a href="${escapeHtml(parsed.href)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`;
  } catch {
    return "";
  }
}

function popupHtml(p) {
  if (!p) return "";
  const rectifiedType = p.tipo_rectificado || p.tipo;
  const investigatedSector = p.sector_investigado || p.sector;
  const originalName = p.nombre_original && p.nombre_original !== p.nombre ? p.nombre_original : "";
  const originalType = p.tipo_original && p.tipo_original !== rectifiedType ? p.tipo_original : "";
  const rows = [
    ["Fuente", p.fuente],
    ["Fuente principal", p.fuente_conservada],
    ["Fuentes coincidentes", p.fuentes_coincidentes],
    ["Registros combinados", p.cantidad_fuentes],
    ["Representación", p.representacion || p.detalle],
    ["Método centroide", p.centroide_metodo],
    ["Tipo", rectifiedType],
    ["Tipo original", originalType],
    ["Categoría", p.tipo_general],
    ["Detalle", p.detalle],
    ["Sector", investigatedSector],
    ["Confianza", p.nivel_confianza],
    ["Privado", p.es_privado],
    ["Descripción", p.descripcion_breve],
    ["Criterio", p.criterio_sector],
    ["Nombre original", originalName],
    ["Departamento", p.departamento],
    ["Municipio", p.municipio],
    ["Región", p.region ? prettyExtra("minsal", p.region) : ""],
    ["Especialidad", p.especialidad],
    ["Operador", p.operador],
    ["Dirección", p.direccion],
    ["Teléfono", p.telefono],
    ["Horario", p.horario],
    ["ID fuente", p.fuente_id],
    ["IDs originales", p.ids_fuente]
  ].filter(([, value]) => value);

  const linkDefinitions = [
    [p.fuente_url, "Abrir registro original"],
    [p.fuente_investigacion_1, "Fuente de investigación 1"],
    [p.fuente_investigacion_2, "Fuente de investigación 2"],
    [p.fuente_investigacion_3, "Fuente de investigación 3"],
    [p.google_maps, "Abrir en Google Maps"]
  ];
  const seenUrls = new Set();
  const links = linkDefinitions
    .filter(([url]) => url && !seenUrls.has(String(url)) && seenUrls.add(String(url)))
    .map(([url, label]) => externalLink(url, label))
    .filter(Boolean);
  const linksHtml = links.length ? `<p>${links.join("<br>")}</p>` : "";

  return `<div class="popup">
    <h3>${escapeHtml(p.nombre || "Sin nombre")}</h3>
    <dl>${rows.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl>
    ${linksHtml}
  </div>`;
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
    radius: isPointSource(sourceId) ? 6 : 5,
    color: "#fff",
    weight: 1.5,
    fillColor: colorForTipo(sourceId, tipo),
    fillOpacity: 0.95
  });
}

function centroidMarker(feature) {
  const properties = feature.properties || {};
  const latitude = Number(properties.centroide_latitud);
  const longitude = Number(properties.centroide_longitud);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const marker = L.circleMarker([latitude, longitude], {
    radius: 4,
    color: "#111827",
    weight: 1.25,
    fillColor: "#facc15",
    fillOpacity: 1
  });
  marker.feature = feature;
  marker.isCentroid = true;
  marker.bindPopup(popupHtml({
    ...properties,
    representacion: "Centroide del polígono"
  }), { maxWidth: 320 });
  const tooltip = document.createElement("span");
  tooltip.textContent = `Centroide · ${properties.nombre || "Sin nombre"}`;
  marker.bindTooltip(tooltip, { direction: "top" });
  marker.on("mouseover", () => status(`Centroide · ${properties.nombre || "Sin nombre"}`));
  return marker;
}

function bindFeature(layer, feature) {
  layer.bindPopup(popupHtml(feature.properties), { maxWidth: 320 });
  layer.on("mouseover", () => status(feature.properties.nombre || ""));
}

function makeLayer(geojson, sourceId) {
  const group = L.geoJSON(geojson, {
    style: (feature) => styleFor(feature, sourceId),
    pointToLayer: (feature, latlng) => pointMarker(feature, latlng, sourceId),
    onEachFeature: (feature, layer) => {
      bindFeature(layer, feature);
      members[sourceId].push(layer);
    }
  });
  if (sourceId === "unificado_poligonos") {
    for (const feature of geojson.features || []) {
      const geometryType = feature.geometry && feature.geometry.type;
      if (geometryType !== "Polygon" && geometryType !== "MultiPolygon") continue;
      const marker = centroidMarker(feature);
      if (!marker) continue;
      members[sourceId].push(marker);
      group.addLayer(marker);
    }
  }
  return group;
}

function departmentPopup(properties) {
  const p = properties || {};
  return `<div class="popup">
    <h3>${p.nombre || "Departamento"}</h3>
    <dl>
      <dt>Nivel</dt><dd>Departamento</dd>
      <dt>Fuente</dt><dd>geoBoundaries / OpenStreetMap</dd>
    </dl>
  </div>`;
}

function makeDepartmentLayer(geojson) {
  let group;
  group = L.geoJSON(geojson, {
    pane: "administrativePane",
    style: {
      color: ADMINISTRATIVE.departamentos.color,
      fillColor: ADMINISTRATIVE.departamentos.fillColor,
      weight: 1.5,
      opacity: 0.9,
      fillOpacity: 0.08
    },
    onEachFeature: (feature, layer) => {
      const nombre = (feature.properties || {}).nombre || "Departamento";
      layer.bindTooltip(nombre, { sticky: true, direction: "top" });
      layer.bindPopup(departmentPopup(feature.properties), { maxWidth: 320 });
      layer.on({
        mouseover: () => {
          layer.setStyle({ weight: 3, fillOpacity: 0.18 });
          layer.bringToFront();
          status(nombre);
        },
        mouseout: () => group.resetStyle(layer)
      });
    }
  });
  return group;
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
  for (const id of ["osm", "geofabrik", "hot", "minsal", "unificado_poligonos", "unificado_puntos"]) {
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

function syncAdministrativeLayer(layerId) {
  const layer = vectorLayers[layerId];
  if (!layer) return;
  if (administrativeEnabled[layerId]) {
    if (!map.hasLayer(layer)) layer.addTo(map);
  } else if (map.hasLayer(layer)) {
    map.removeLayer(layer);
  }
  raiseVectors();
}

function referenceIds(filteredFeatures, sourceId) {
  const sourceName = {
    minsal: "minsal",
    osm: "overpass",
    geofabrik: "geofabrik",
    hot: "hot"
  }[sourceId];
  const ids = new Set();

  for (const feature of filteredFeatures) {
    const properties = feature.properties || {};
    for (const entry of String(properties.ids_fuente || "").split(";")) {
      const separator = entry.indexOf(":");
      if (separator < 0) continue;
      const label = entry.slice(0, separator).trim().toLocaleLowerCase("es");
      const sourceRecordId = entry.slice(separator + 1).trim();
      if (label === sourceName && sourceRecordId) ids.add(sourceRecordId);
    }
    const conserved = String(properties.fuente_conservada || "").trim().toLocaleLowerCase("es");
    const conservedId = String(properties.fuente_id || "").trim();
    if (conserved === sourceName && conservedId) ids.add(conservedId);
  }
  return ids;
}

function filterReferenceCollection(collection, sourceId, filteredFeatures) {
  const ids = referenceIds(filteredFeatures, sourceId);
  const features = (collection.features || []).filter((feature) => (
    ids.has(String((feature.properties || {}).fuente_id || "").trim())
  ));
  return {
    ...collection,
    meta: {
      ...(collection.meta || {}),
      count: features.length,
      filtro_sectorial: "Solo registros vinculados con el XLSX depurado"
    },
    features
  };
}

function buildVectorLayers() {
  const filtered = window.UNIDADES_DEPURADAS_GEOJSON;
  const filteredFeatures = (filtered && filtered.features) || [];
  const packs = {
    unificado_poligonos: filtered ? {
      ...filtered,
      name: `${filtered.name}_poligonos`,
      features: filteredFeatures.filter((feature) => ["Polygon", "MultiPolygon"].includes(feature.geometry && feature.geometry.type))
    } : null,
    unificado_puntos: filtered ? {
      ...filtered,
      name: `${filtered.name}_puntos`,
      features: filteredFeatures.filter((feature) => ["Point", "MultiPoint"].includes(feature.geometry && feature.geometry.type))
    } : null,
    minsal: window.MINSAL_GEOJSON && filterReferenceCollection(window.MINSAL_GEOJSON, "minsal", filteredFeatures),
    osm: window.OVERPASS_GEOJSON && filterReferenceCollection(window.OVERPASS_GEOJSON, "osm", filteredFeatures),
    geofabrik: window.GEOFABRIK_GEOJSON && filterReferenceCollection(window.GEOFABRIK_GEOJSON, "geofabrik", filteredFeatures),
    hot: window.HOT_GEOJSON && filterReferenceCollection(window.HOT_GEOJSON, "hot", filteredFeatures)
  };
  if (SOURCE_ORDER.some((sourceId) => !packs[sourceId]) || !window.DEPARTAMENTOS_GEOJSON) {
    status("No se encontraron todas las capas locales");
    return;
  }

  vectorLayers.departamentos = makeDepartmentLayer(window.DEPARTAMENTOS_GEOJSON);
  syncAdministrativeLayer("departamentos");

  for (const id of SOURCE_ORDER) {
    indexSource(id, packs[id]);
    vectorLayers[id] = makeLayer(packs[id], id);
    syncSource(id);
  }
  searchIndex = FILTERED_SOURCE_IDS.flatMap((sourceId) => (
    collections[sourceId].features.map((feature) => {
      const properties = feature.properties || {};
      const name = properties.nombre || "Sin nombre";
      const details = [properties.tipo, properties.representacion, properties.municipio, properties.direccion]
        .filter(Boolean)
        .join(" · ");
      const searchable = [
        name,
        properties.nombre_original,
        properties.tipo,
        properties.tipo_original,
        properties.municipio,
        properties.direccion,
        properties.sector,
        properties.descripcion_breve
      ].filter(Boolean).join(" ");
      return { sourceId, feature, name, details, normalized: normalizeSearchText(searchable) };
    })
  ));
  renderLayers();
  refreshView();
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

function renderSearchResults(query) {
  const input = document.getElementById("map-search-input");
  const results = document.getElementById("map-search-results");
  const normalizedQuery = normalizeSearchText(query);
  results.replaceChildren();
  searchMatches = [];
  activeSearchResult = -1;

  if (normalizedQuery.length < 2) {
    results.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    return;
  }

  searchMatches = searchIndex
    .filter((item) => item.normalized.includes(normalizedQuery))
    .sort((a, b) => {
      const aName = normalizeSearchText(a.name);
      const bName = normalizeSearchText(b.name);
      const aRank = aName.startsWith(normalizedQuery) ? 0 : aName.includes(normalizedQuery) ? 1 : 2;
      const bRank = bName.startsWith(normalizedQuery) ? 0 : bName.includes(normalizedQuery) ? 1 : 2;
      return aRank - bRank || a.name.localeCompare(b.name, "es");
    });

  if (!searchMatches.length) {
    const empty = document.createElement("div");
    empty.className = "search-empty";
    empty.textContent = "No se encontraron unidades de salud";
    results.append(empty);
  } else {
    const visibleMatches = searchMatches.slice(0, 8);
    visibleMatches.forEach((item, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.id = `map-search-option-${index}`;
      option.className = "search-result";
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      const name = document.createElement("span");
      name.className = "search-result-name";
      name.textContent = item.name;
      option.append(name);
      if (item.details) {
        const details = document.createElement("span");
        details.className = "search-result-detail";
        details.textContent = item.details;
        option.append(details);
      }
      option.addEventListener("click", () => selectSearchResult(item));
      results.append(option);
    });
    if (searchMatches.length > visibleMatches.length) {
      const more = document.createElement("div");
      more.className = "search-empty";
      more.textContent = `${visibleMatches.length} de ${searchMatches.length} coincidencias; escribe más para afinar`;
      results.append(more);
    }
  }

  results.hidden = false;
  input.setAttribute("aria-expanded", "true");
  input.removeAttribute("aria-activedescendant");
}

function highlightSearchResult(index) {
  const options = [...document.querySelectorAll("#map-search-results [role='option']")];
  if (!options.length) return;
  activeSearchResult = (index + options.length) % options.length;
  options.forEach((option, optionIndex) => {
    const active = optionIndex === activeSearchResult;
    option.classList.toggle("is-active", active);
    option.setAttribute("aria-selected", String(active));
  });
  const active = options[activeSearchResult];
  document.getElementById("map-search-input").setAttribute("aria-activedescendant", active.id);
  active.scrollIntoView({ block: "nearest" });
}

function selectSearchResult(item) {
  const feature = item.feature;
  const properties = feature.properties || {};
  const id = properties.id;
  const tipo = properties.tipo || "Sin tipo";
  const sourceId = item.sourceId;

  layerEnabled[sourceId] = true;
  typeOn[sourceId][tipo] = true;
  extraOn[sourceId] = "all";
  selectedLayer = sourceId;
  expanded.fuentes = true;
  expanded[sourceId] = true;
  syncSource(sourceId);
  renderLayers();

  const layer = members[sourceId].find((member) => (
    member.feature && member.feature.properties && member.feature.properties.id === id &&
    (member.isCentroid || member.feature.geometry.type === "Point")
  )) || members[sourceId].find((member) => (
    member.feature && member.feature.properties && member.feature.properties.id === id
  ));
  if (!layer) {
    status(`No se pudo ubicar ${item.name}`);
    return;
  }

  let location;
  if (layer.getLatLng) {
    location = layer.getLatLng();
  } else {
    location = layer.getBounds().getCenter();
  }

  const zoom = layer.isCentroid ? 16 : 17;
  map.setView(location, Math.max(map.getZoom(), zoom));
  layer.openPopup();
  const input = document.getElementById("map-search-input");
  input.value = item.name;
  document.getElementById("map-search-results").hidden = true;
  input.setAttribute("aria-expanded", "false");
  input.removeAttribute("aria-activedescendant");
  status(`Resultado: ${item.name}`);
}

function swatch(fill, sourceId, stroke) {
  const mark = document.createElement("span");
  mark.className = `swatch ${isPointSource(sourceId) ? "point" : "area"}`;
  mark.style.background = fill;
  if (stroke) mark.style.borderColor = stroke;
  return mark;
}

function icon(name) {
  const span = document.createElement("span");
  span.className = "tree-icon";
  span.innerHTML = ICONS[name];
  return span;
}

function update(sourceId) {
  syncSource(sourceId);
  renderLayers();
  refreshView();
}

function treeRow(depth, tag = "div") {
  const row = document.createElement(tag);
  row.className = "tree-row";
  row.setAttribute("role", "treeitem");
  row.style.setProperty("--depth", depth);
  return row;
}

function twisty(key) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `twisty${expanded[key] ? " open" : ""}`;
  btn.setAttribute("aria-label", expanded[key] ? "Contraer" : "Expandir");
  btn.setAttribute("aria-expanded", String(!!expanded[key]));
  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    expanded[key] = !expanded[key];
    renderLayers();
  });
  return btn;
}

function twistySpace() {
  const span = document.createElement("span");
  span.className = "twisty-space";
  return span;
}

function checkbox(checked, onChange, label) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  if (label) input.setAttribute("aria-label", label);
  input.addEventListener("click", (event) => event.stopPropagation());
  input.addEventListener("change", () => onChange(input.checked));
  return input;
}

function rowText(text, count) {
  const name = document.createElement("span");
  name.className = "tree-name";
  name.textContent = text;
  if (count === undefined) return [name];
  const total = document.createElement("span");
  total.className = "tree-count";
  total.textContent = `[${count}]`;
  return [name, total];
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
  const row = treeRow(2, "label");
  row.classList.add("tree-filter");
  const caption = document.createElement("span");
  caption.className = "tree-name";
  caption.textContent = extraCaption(sourceId);
  const select = document.createElement("select");

  const all = document.createElement("option");
  all.value = "all";
  all.textContent = "Todas";
  select.append(all);

  for (const [value, count] of extraValues(sourceId)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `${prettyExtra(sourceId, value)} [${count}]`;
    select.append(option);
  }
  select.value = extraOn[sourceId];
  select.addEventListener("change", () => {
    extraOn[sourceId] = select.value;
    update(sourceId);
  });
  row.append(twistySpace(), icon("filter"), caption, select);
  return row;
}

function setAllTipos(sourceId, on) {
  for (const tipo of Object.keys(typeOn[sourceId])) typeOn[sourceId][tipo] = on;
  update(sourceId);
}

function buildBulkRow(sourceId) {
  const row = treeRow(2);
  row.classList.add("tree-actions");
  row.append(twistySpace());
  for (const [text, on] of [["Mostrar todas", true], ["Ocultar todas", false]]) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "link-btn";
    btn.textContent = text;
    btn.addEventListener("click", () => setAllTipos(sourceId, on));
    row.append(btn);
  }
  return row;
}

function buildCategoryRow(sourceId, tipo) {
  const count = countTipo(sourceId, tipo);
  const row = treeRow(2, "label");
  row.classList.add("is-category");
  if (!count) row.classList.add("is-empty");
  if (!layerEnabled[sourceId]) row.classList.add("is-off");
  row.title = tipo;
  const input = checkbox(!!typeOn[sourceId][tipo], (on) => {
    typeOn[sourceId][tipo] = on;
    update(sourceId);
  });
  const stroke = isPointSource(sourceId) ? null : SOURCE[sourceId].color;
  row.append(
    twistySpace(),
    input,
    swatch(colorForTipo(sourceId, tipo), sourceId, stroke),
    ...rowText(legendLabel(tipo), count)
  );
  return row;
}

function selectLayer(sourceId) {
  selectedLayer = sourceId;
  document.querySelectorAll(".tree-row[data-layer]").forEach((row) => {
    row.classList.toggle("is-selected", row.dataset.layer === sourceId);
  });
}

function buildSourceNode(sourceId) {
  const meta = SOURCE[sourceId];
  const node = document.createElement("div");
  const row = treeRow(1);
  row.classList.add("is-layer");
  row.dataset.layer = sourceId;
  if (selectedLayer === sourceId) row.classList.add("is-selected");
  if (!layerEnabled[sourceId]) row.classList.add("is-off");
  row.title = `${meta.hint}\nDoble clic: zoom a la capa`;
  row.addEventListener("click", () => selectLayer(sourceId));
  row.addEventListener("dblclick", () => zoomToLayer(sourceId));

  const toggle = checkbox(layerEnabled[sourceId], (on) => {
    layerEnabled[sourceId] = on;
    update(sourceId);
  }, `Mostrar ${meta.label}`);
  const fill = isPointSource(sourceId) ? meta.color : `${meta.color}66`;
  row.append(
    twisty(sourceId),
    toggle,
    swatch(fill, sourceId, isPointSource(sourceId) ? null : meta.color),
    ...rowText(meta.label, filteredCount(sourceId))
  );
  if (extraKey(sourceId) && extraOn[sourceId] !== "all") {
    const mark = icon("filter");
    mark.title = `Filtrada por ${extraCaption(sourceId).toLowerCase()}`;
    row.append(mark);
  }
  node.append(row);

  if (expanded[sourceId]) {
    const children = document.createElement("div");
    children.setAttribute("role", "group");
    const extra = buildExtraFilter(sourceId);
    if (extra) children.append(extra);
    children.append(buildBulkRow(sourceId));
    for (const tipo of tiposOf(sourceId)) children.append(buildCategoryRow(sourceId, tipo));
    node.append(children);
  }
  return node;
}

function buildGroup(key, label, control, buildChildren) {
  const node = document.createElement("div");
  const row = treeRow(0);
  row.classList.add("is-group");
  row.append(twisty(key));
  if (control) row.append(control);
  row.append(icon("folder"), ...rowText(label));
  node.append(row);
  if (expanded[key]) {
    const children = document.createElement("div");
    children.setAttribute("role", "group");
    children.append(...buildChildren());
    node.append(children);
  }
  return node;
}

function buildSourcesGroup() {
  const on = SOURCE_ORDER.filter((id) => layerEnabled[id]).length;
  const control = checkbox(on === SOURCE_ORDER.length, (checked) => {
    for (const id of SOURCE_ORDER) {
      layerEnabled[id] = checked;
      syncSource(id);
    }
    renderLayers();
    refreshView();
  }, "Mostrar todas las fuentes");
  control.indeterminate = on > 0 && on < SOURCE_ORDER.length;
  return buildGroup("fuentes", "Unidades de salud", control, () => SOURCE_ORDER.map(buildSourceNode));
}

function buildAdministrativeNode(layerId) {
  const meta = ADMINISTRATIVE[layerId];
  const row = treeRow(1, "label");
  row.classList.add("is-layer");
  row.dataset.layer = layerId;
  if (selectedLayer === layerId) row.classList.add("is-selected");
  if (!administrativeEnabled[layerId]) row.classList.add("is-off");
  row.title = `${meta.hint}\nDoble clic: zoom a la capa`;
  row.addEventListener("click", () => selectLayer(layerId));
  row.addEventListener("dblclick", () => zoomToLayer(layerId));

  const toggle = checkbox(administrativeEnabled[layerId], (on) => {
    administrativeEnabled[layerId] = on;
    syncAdministrativeLayer(layerId);
    renderLayers();
    status(on ? `${meta.label} visibles` : `${meta.label} ocultos`);
  }, `Mostrar ${meta.label}`);
  const count = vectorLayers[layerId] ? vectorLayers[layerId].getLayers().length : 0;
  row.append(
    twistySpace(),
    toggle,
    swatch(`${meta.fillColor}33`, "area", meta.color),
    ...rowText(meta.label, count)
  );
  return row;
}

function buildAdministrativeGroup() {
  const on = ADMINISTRATIVE_ORDER.filter((id) => administrativeEnabled[id]).length;
  const control = checkbox(on === ADMINISTRATIVE_ORDER.length, (checked) => {
    for (const id of ADMINISTRATIVE_ORDER) {
      administrativeEnabled[id] = checked;
      syncAdministrativeLayer(id);
    }
    renderLayers();
    status(checked ? "Límites administrativos visibles" : "Límites administrativos ocultos");
  }, "Mostrar todos los límites administrativos");
  control.indeterminate = on > 0 && on < ADMINISTRATIVE_ORDER.length;
  return buildGroup("limites", "Límites administrativos", control, () => (
    ADMINISTRATIVE_ORDER.map(buildAdministrativeNode)
  ));
}

function buildBaseRow(id, item) {
  const row = treeRow(1, "label");
  row.classList.add("is-layer");
  const input = document.createElement("input");
  input.type = "radio";
  input.name = "base";
  input.checked = id === activeBase;
  input.addEventListener("change", () => setBase(id));
  row.append(twistySpace(), input, icon("raster"), ...rowText(item.label));
  return row;
}

function buildBasesGroup() {
  return buildGroup("bases", "Mapas base", null, () => (
    Object.entries(bases).map(([id, item]) => buildBaseRow(id, item))
  ));
}

function renderLayers() {
  const box = document.getElementById("layers");
  const top = box.scrollTop;
  box.replaceChildren(buildSourcesGroup(), buildAdministrativeGroup(), buildBasesGroup());
  box.scrollTop = top;
}

function setExpanded(open) {
  for (const key of Object.keys(expanded)) expanded[key] = open;
  renderLayers();
}

function zoomToLayer(sourceId) {
  const group = vectorLayers[sourceId];
  const meta = SOURCE[sourceId] || ADMINISTRATIVE[sourceId];
  const enabled = SOURCE[sourceId] ? layerEnabled[sourceId] : administrativeEnabled[sourceId];
  if (!group || !enabled || !group.getLayers().length) {
    status(`${meta.label} no tiene elementos visibles`);
    return;
  }
  map.fitBounds(group.getBounds(), { padding: [24, 24] });
  status(`Zoom a ${meta.label}`);
}

function setBase(id) {
  for (const item of Object.values(bases)) {
    if (map.hasLayer(item.layer)) map.removeLayer(item.layer);
  }
  activeBase = id;
  bases[id].layer.addTo(map);
  if (bases[id].layer.bringToBack) bases[id].layer.bringToBack();
  raiseVectors();
  renderLayers();
}

function refreshView() {
  status(`${visibleFeatures().length} registros activos`);
}

function status(text) {
  document.getElementById("status").textContent = text;
}

document.getElementById("expand-all").addEventListener("click", () => setExpanded(true));
document.getElementById("collapse-all").addEventListener("click", () => setExpanded(false));
document.getElementById("zoom-layer").addEventListener("click", () => {
  if (selectedLayer) zoomToLayer(selectedLayer);
  else status("Selecciona una capa en el panel");
});
document.getElementById("full-extent").addEventListener("click", () => {
  map.fitBounds(SAN_SALVADOR_BOUNDS, { padding: [24, 24] });
});

const searchInput = document.getElementById("map-search-input");
const searchResults = document.getElementById("map-search-results");
searchInput.addEventListener("input", () => renderSearchResults(searchInput.value));
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" && !searchResults.hidden) {
    event.preventDefault();
    highlightSearchResult(activeSearchResult + 1);
  } else if (event.key === "ArrowUp" && !searchResults.hidden) {
    event.preventDefault();
    highlightSearchResult(activeSearchResult < 0 ? 0 : activeSearchResult - 1);
  } else if (event.key === "Enter" && !searchResults.hidden) {
    const index = activeSearchResult < 0 ? 0 : activeSearchResult;
    if (searchMatches[index]) {
      event.preventDefault();
      selectSearchResult(searchMatches[index]);
    }
  } else if (event.key === "Escape" && !searchResults.hidden) {
    searchResults.hidden = true;
    searchInput.setAttribute("aria-expanded", "false");
    searchInput.removeAttribute("aria-activedescendant");
  }
});
document.getElementById("map-search-clear").addEventListener("click", () => {
  searchInput.value = "";
  renderSearchResults("");
  searchInput.focus();
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".map-search")) {
    searchResults.hidden = true;
    searchInput.setAttribute("aria-expanded", "false");
    searchInput.removeAttribute("aria-activedescendant");
  }
});

const coords = document.getElementById("coords");
map.on("mousemove", (event) => {
  coords.textContent = `Lat ${event.latlng.lat.toFixed(5)}  Lon ${event.latlng.lng.toFixed(5)}`;
});

buildVectorLayers();
