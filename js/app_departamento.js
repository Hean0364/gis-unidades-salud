/* Visor compartido por los 13 mapas generados desde los Excel departamentales. */
const facilities = window.ESTABLECIMIENTOS_DEPARTAMENTO_GEOJSON;
const boundaries = window.LIMITE_DEPARTAMENTO_GEOJSON;

if (!facilities || !boundaries || !window.L || boundaries.features.length !== 1) {
  document.getElementById("status").textContent = "No se encontraron las capas locales o Leaflet";
} else {
  const department = facilities.meta.departamento;
  const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  });
  const hot = L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, HOT'
  });
  const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19,
    attribution: "Imágenes: Esri, Maxar, Earthstar Geographics"
  });
  const bases = { osm: ["Cartográfico OSM", osm], hot: ["Humanitario OSM", hot], satellite: ["Satélite", satellite] };
  const map = L.map("map", { zoomControl: true, maxZoom: 19, layers: [osm] });
  L.control.scale({ metric: true, imperial: false }).addTo(map);
  map.createPane("administrativePane");
  map.getPane("administrativePane").style.zIndex = 350;
  map.attributionControl.addAttribution('Límites: <a href="https://www.geoboundaries.org/" target="_blank" rel="noopener">geoBoundaries</a> / OpenStreetMap');

  const limit = L.geoJSON(boundaries, {
    pane: "administrativePane",
    style: { color: "#475569", fillColor: "#94a3b8", weight: 2, opacity: 0.9, fillOpacity: 0.08 },
    onEachFeature: (feature, layer) => {
      layer.bindTooltip(escapeHtml(feature.properties.nombre), { sticky: true });
      layer.bindPopup(`<div class="popup"><h3>${escapeHtml(feature.properties.nombre)}</h3><dl><dt>Nivel</dt><dd>Departamento</dd><dt>Fuente</dt><dd>geoBoundaries / OpenStreetMap</dd></dl></div>`);
    }
  }).addTo(map);
  const extent = limit.getBounds();
  map.fitBounds(extent, { padding: [24, 24] });

  const groups = { puntos: L.featureGroup().addTo(map), poligonos: L.featureGroup().addTo(map), limite: limit };
  const labels = { puntos: "Puntos", poligonos: "Polígonos", limite: `Límite · ${department}` };
  const active = { puntos: true, poligonos: true, limite: true };
  const expanded = { unidades: true, limites: true, bases: true, tipos: true };
  const items = [];
  const categoryOn = new Map();
  let base = "osm";
  let selected = "puntos";
  let matches = [];
  let matchIndex = -1;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function safeLink(value) {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? escapeHtml(url.href) : null;
    } catch (_) {
      return null;
    }
  }

  function status(text) {
    document.getElementById("status").textContent = text;
  }

  function color(feature) {
    const p = feature.properties;
    const t = String(p.tipo || "").toLocaleLowerCase("es");
    if (t.includes("hospital")) return "#d64545";
    if (t.includes("ucsfe")) return "#1d4ed8";
    if (t.includes("ucsfi")) return "#0f766e";
    if (t.includes("ucsfb")) return "#15803d";
    if (t.includes("casa de salud")) return "#4d7c0f";
    if (t.includes("clínica") || t.includes("clinica")) return "#2f80ed";
    if (t.includes("consultorio")) return "#9b51e0";
    if (t.includes("sem") || t.includes("emergencia")) return "#b45309";
    return p.fuente === "minsal" ? "#1f8a70" : "#c45c26";
  }

  function popup(p) {
    const fields = [
      ["Fuente", p.fuente], ["Tipo", p.tipo], ["Detalle", p.detalle],
      ["Departamento", p.departamento], ["Municipio", p.municipio], ["Región", p.region],
      ["Especialidad", p.especialidad], ["Operador", p.operador], ["Dirección", p.direccion],
      ["Teléfono", p.telefono], ["Horario", p.horario], ["ID", p.id]
    ].filter(([, value]) => value !== null && value !== undefined && value !== "");
    const links = [["Abrir en Google Maps", p.google_maps], ["Ver fuente", p.fuente_url]]
      .map(([label, value]) => [label, safeLink(value)])
      .filter(([, url]) => url)
      .map(([label, url]) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`)
      .join(" · ");
    return `<div class="popup"><h3>${escapeHtml(p.nombre || "Sin nombre")}</h3><dl>${fields.map(([key, value]) => (
      `<dt>${key}</dt><dd>${escapeHtml(value)}</dd>`
    )).join("")}</dl>${links ? `<p>${links}</p>` : ""}</div>`;
  }

  function bindFeature(layer, p) {
    layer.bindPopup(popup(p), { maxWidth: 320 });
    layer.on("mouseover", () => status(p.nombre || "Sin nombre"));
  }

  for (const feature of facilities.features) {
    const p = feature.properties;
    const kind = feature.geometry.type === "Point" ? "puntos" : "poligonos";
    const tipo = p.tipo || "Sin tipo";
    categoryOn.set(tipo, true);
    const colorValue = color(feature);
    let layers;
    let focus;
    let location;
    if (kind === "puntos") {
      focus = L.circleMarker([feature.geometry.coordinates[1], feature.geometry.coordinates[0]], {
        radius: 6, color: "#fff", weight: 1.5, fillColor: colorValue, fillOpacity: 0.95
      });
      layers = [focus];
      location = focus.getLatLng();
    } else {
      const area = L.geoJSON(feature, {
        style: { color: p.fuente === "minsal" ? "#1f8a70" : "#c45c26", fillColor: colorValue, weight: 2, fillOpacity: 0.38 }
      });
      focus = area.getLayers()[0];
      layers = [area];
      location = [Number(p.centroide_latitud), Number(p.centroide_longitud)];
    }
    bindFeature(focus, p);
    const item = { feature, kind, tipo, layers, focus, location };
    items.push(item);
  }

  function sync() {
    for (const item of items) {
      const group = groups[item.kind];
      const show = active[item.kind] && categoryOn.get(item.tipo);
      for (const layer of item.layers) {
        if (show && !group.hasLayer(layer)) group.addLayer(layer);
        if (!show && group.hasLayer(layer)) group.removeLayer(layer);
      }
    }
    for (const id of ["puntos", "poligonos", "limite"]) {
      if (active[id] && !map.hasLayer(groups[id])) groups[id].addTo(map);
      if (!active[id] && map.hasLayer(groups[id])) map.removeLayer(groups[id]);
    }
    status(`${items.filter((item) => active[item.kind] && categoryOn.get(item.tipo)).length} registros activos · ${department}`);
  }

  function row(depth, text, options = {}) {
    const element = document.createElement("div");
    element.className = "tree-row";
    element.style.setProperty("--depth", depth);
    element.setAttribute("role", "treeitem");
    if (options.group) element.classList.add("is-group");
    if (options.layer) {
      element.dataset.layer = options.layer;
      if (selected === options.layer) element.classList.add("is-selected");
      if (!active[options.layer]) element.classList.add("is-off");
      element.title = "Doble clic: zoom a la capa";
      element.addEventListener("click", () => { selected = options.layer; render(); });
      element.addEventListener("dblclick", () => zoomTo(options.layer));
    }
    if (options.expand) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `twisty${expanded[options.expand] ? " open" : ""}`;
      button.setAttribute("aria-label", expanded[options.expand] ? "Contraer" : "Expandir");
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        expanded[options.expand] = !expanded[options.expand];
        render();
      });
      element.append(button);
    } else {
      const space = document.createElement("span");
      space.className = "twisty-space";
      element.append(space);
    }
    if (options.checked !== undefined) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = options.checked;
      checkbox.setAttribute("aria-label", `Mostrar ${text}`);
      checkbox.addEventListener("click", (event) => event.stopPropagation());
      checkbox.addEventListener("change", () => { options.toggle(checkbox.checked); sync(); render(); });
      element.append(checkbox);
    }
    if (options.color) {
      const swatch = document.createElement("span");
      swatch.className = `swatch ${options.point ? "point" : "area"}`;
      swatch.style.background = options.color;
      element.append(swatch);
    }
    const name = document.createElement("span");
    name.className = "tree-name";
    name.textContent = text;
    name.title = text;
    element.append(name);
    if (options.count !== undefined) {
      const count = document.createElement("span");
      count.className = "tree-count";
      count.textContent = `[${options.count}]`;
      element.append(count);
    }
    return element;
  }

  function render() {
    const tree = document.getElementById("layers");
    const scroll = tree.scrollTop;
    const nodes = [row(0, "Unidades de salud", { group: true, expand: "unidades", count: items.length })];
    if (expanded.unidades) {
      for (const id of ["puntos", "poligonos"]) {
        nodes.push(row(1, labels[id], {
          layer: id, checked: active[id], toggle: (value) => { active[id] = value; },
          color: id === "puntos" ? "#1f8a70" : "#c45c2666", point: id === "puntos",
          count: items.filter((item) => item.kind === id && categoryOn.get(item.tipo)).length
        }));
      }
      nodes.push(row(1, "Tipos de establecimiento", { group: true, expand: "tipos" }));
      if (expanded.tipos) {
        const counts = new Map();
        for (const item of items) counts.set(item.tipo, (counts.get(item.tipo) || 0) + 1);
        for (const [tipo, count] of [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))) {
          const sample = items.find((item) => item.tipo === tipo);
          nodes.push(row(2, tipo, {
            checked: categoryOn.get(tipo), toggle: (value) => { categoryOn.set(tipo, value); },
            color: color(sample.feature), point: true, count
          }));
        }
      }
    }
    nodes.push(row(0, "Límites administrativos", { group: true, expand: "limites" }));
    if (expanded.limites) nodes.push(row(1, labels.limite, {
      layer: "limite", checked: active.limite, toggle: (value) => { active.limite = value; },
      color: "#94a3b833", count: 1
    }));
    nodes.push(row(0, "Mapas base", { group: true, expand: "bases" }));
    if (expanded.bases) {
      for (const [id, [label]] of Object.entries(bases)) {
        const baseRow = row(1, label);
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "base";
        radio.checked = base === id;
        radio.setAttribute("aria-label", label);
        radio.addEventListener("change", () => {
          map.removeLayer(bases[base][1]);
          base = id;
          bases[base][1].addTo(map).bringToBack();
          render();
        });
        baseRow.insertBefore(radio, baseRow.children[1]);
        nodes.push(baseRow);
      }
    }
    tree.replaceChildren(...nodes);
    tree.scrollTop = scroll;
  }

  function zoomTo(id) {
    const layer = groups[id];
    if (!active[id] || !layer.getLayers().length) {
      status(`${labels[id]} no tiene elementos visibles`);
      return;
    }
    map.fitBounds(layer.getBounds(), { padding: [24, 24] });
    status(`Zoom a ${labels[id]}`);
  }

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
  }

  const input = document.getElementById("map-search-input");
  const results = document.getElementById("map-search-results");
  const searchIndex = items.map((item) => ({
    item,
    text: normalize([item.feature.properties.nombre, item.feature.properties.municipio,
      item.tipo, item.feature.properties.id].join(" "))
  }));

  function hideResults() {
    results.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }

  function choose(item) {
    active[item.kind] = true;
    categoryOn.set(item.tipo, true);
    selected = item.kind;
    expanded.unidades = true;
    sync();
    render();
    const p = item.feature.properties;
    map.setView(item.location, Math.max(map.getZoom(), 16));
    item.focus.openPopup(item.location);
    input.value = p.nombre || "Sin nombre";
    hideResults();
    status(`Resultado: ${p.nombre || "Sin nombre"}`);
  }

  function search() {
    const query = normalize(input.value);
    results.replaceChildren();
    matches = [];
    matchIndex = -1;
    if (query.length < 2) return hideResults();
    matches = searchIndex.filter(({ text }) => text.includes(query)).sort((a, b) => {
      const aName = normalize(a.item.feature.properties.nombre);
      const bName = normalize(b.item.feature.properties.nombre);
      return Number(!aName.startsWith(query)) - Number(!bName.startsWith(query)) || aName.localeCompare(bName, "es");
    });
    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "search-empty";
      empty.textContent = "No se encontraron establecimientos";
      results.append(empty);
    }
    for (const { item } of matches.slice(0, 8)) {
      const p = item.feature.properties;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "search-result";
      button.setAttribute("role", "option");
      const name = document.createElement("span");
      name.className = "search-result-name";
      name.textContent = p.nombre || "Sin nombre";
      const detail = document.createElement("span");
      detail.className = "search-result-detail";
      detail.textContent = `${p.tipo} · ${p.municipio || department} · ${p.id}`;
      button.append(name, detail);
      button.addEventListener("click", () => choose(item));
      results.append(button);
    }
    if (matches.length > 8) {
      const more = document.createElement("div");
      more.className = "search-empty";
      more.textContent = `8 de ${matches.length} coincidencias; escribe más para afinar`;
      results.append(more);
    }
    results.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  input.addEventListener("input", search);
  input.addEventListener("keydown", (event) => {
    const options = [...results.querySelectorAll("[role='option']")];
    if (event.key === "Escape") { hideResults(); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (results.hidden || !options.length) return;
      event.preventDefault();
      matchIndex = (matchIndex + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      options.forEach((option, i) => option.classList.toggle("is-active", i === matchIndex));
      options[matchIndex].scrollIntoView({ block: "nearest" });
    }
    if (event.key === "Enter" && !results.hidden && options.length) {
      event.preventDefault();
      choose(matches[Math.max(0, matchIndex)].item);
    }
  });
  document.getElementById("map-search-clear").addEventListener("click", () => {
    input.value = "";
    hideResults();
    input.focus();
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".map-search")) hideResults();
  });
  document.getElementById("expand-all").addEventListener("click", () => {
    Object.keys(expanded).forEach((key) => { expanded[key] = true; });
    render();
  });
  document.getElementById("collapse-all").addEventListener("click", () => {
    Object.keys(expanded).forEach((key) => { expanded[key] = false; });
    render();
  });
  document.getElementById("zoom-layer").addEventListener("click", () => zoomTo(selected));
  document.getElementById("full-extent").addEventListener("click", () => {
    map.fitBounds(extent, { padding: [24, 24] });
  });
  map.on("mousemove", (event) => {
    document.getElementById("coords").textContent = `Lat ${event.latlng.lat.toFixed(5)}  Lon ${event.latlng.lng.toFixed(5)}`;
  });

  sync();
  render();
}
