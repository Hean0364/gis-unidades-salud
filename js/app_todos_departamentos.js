/* Mapa conjunto: cada departamento tiene sus propias capas de puntos, polígonos y límite. */
(() => {
  const data = window.ESTABLECIMIENTOS_TODOS_GEOJSON;
  const borders = window.LIMITES_DEPARTAMENTALES_GEOJSON;
  const statusElement = document.getElementById("status");
  if (!window.L || !data || !borders || borders.features.length !== 13) {
    statusElement.textContent = "No se encontraron las capas locales o Leaflet";
    return;
  }

  const picker = document.getElementById("department-select");
  const customOption = picker.querySelector('[value="__custom"]');
  const searchInput = document.getElementById("map-search-input");
  const results = document.getElementById("map-search-results");
  const departments = data.meta.departamentos;
  const totals = new Map(departments.map((name) => [name, 0]));
  for (const feature of data.features) {
    const name = feature.properties.departamento;
    if (!totals.has(name)) throw new Error(`Departamento desconocido: ${name}`);
    totals.set(name, totals.get(name) + 1);
  }
  for (const name of departments) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = `${name} [${totals.get(name)}]`;
    picker.append(option);
  }

  const bases = {
    osm: ["Cartográfico OSM", L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    })],
    hot: ["Humanitario OSM", L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, HOT'
    })],
    satellite: ["Satélite", L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19, attribution: "Imágenes: Esri, Maxar, Earthstar Geographics"
    })]
  };
  const map = L.map("map", { zoomControl: true, maxZoom: 19, layers: [bases.osm[1]] });
  L.control.scale({ metric: true, imperial: false }).addTo(map);
  map.createPane("administrativePane");
  map.getPane("administrativePane").style.zIndex = 350;
  map.attributionControl.addAttribution('Límites: <a href="https://www.geoboundaries.org/" target="_blank" rel="noopener">geoBoundaries</a> / OpenStreetMap');

  const expanded = { departamentos: true, tipos: true, bases: true };
  const departmentOn = new Map(departments.map((name) => [name, true]));
  const sublayerOn = new Map(departments.map((name) => [name, { puntos: true, poligonos: true, limite: true }]));
  for (const name of departments) expanded[`dept:${name}`] = name === departments[0];
  const typeOn = new Map();
  const entries = [];
  const boundariesByName = new Map();
  const layersByKey = new Map();
  let base = "osm";
  let selected = `${departments[0]}:puntos`;
  let matches = [];
  let matchIndex = -1;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function link(value) {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? escapeHtml(url.href) : null;
    } catch (_) {
      return null;
    }
  }

  function popup(p) {
    const fields = [
      ["Fuente", p.fuente], ["Tipo", p.tipo], ["Detalle", p.detalle],
      ["Departamento", p.departamento], ["Municipio", p.municipio], ["Región", p.region],
      ["Especialidad", p.especialidad], ["Operador", p.operador], ["Dirección", p.direccion],
      ["Teléfono", p.telefono], ["Horario", p.horario], ["ID", p.id]
    ].filter(([, value]) => value !== null && value !== undefined && value !== "");
    const links = [["Abrir en Google Maps", p.google_maps], ["Ver fuente", p.fuente_url]]
      .map(([name, value]) => [name, link(value)])
      .filter(([, url]) => url)
      .map(([name, url]) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${name}</a>`)
      .join(" · ");
    return `<div class="popup"><h3>${escapeHtml(p.nombre || "Sin nombre")}</h3><dl>${fields.map(([name, value]) => (
      `<dt>${name}</dt><dd>${escapeHtml(value)}</dd>`
    )).join("")}</dl>${links ? `<p>${links}</p>` : ""}</div>`;
  }

  function color(feature) {
    const t = String(feature.properties.tipo || "").toLocaleLowerCase("es");
    if (t.includes("hospital")) return "#d64545";
    if (t.includes("ucsfe")) return "#1d4ed8";
    if (t.includes("ucsfi")) return "#0f766e";
    if (t.includes("ucsfb")) return "#15803d";
    if (t.includes("casa de salud")) return "#4d7c0f";
    if (t.includes("clínica") || t.includes("clinica")) return "#2f80ed";
    if (t.includes("consultorio")) return "#9b51e0";
    return feature.properties.fuente === "minsal" ? "#1f8a70" : "#c45c26";
  }

  function boundaryStyle(feature) {
    const enabled = enabledDepartments();
    const chosen = enabled.length === 1 && feature.properties.nombre === enabled[0];
    return {
      color: chosen ? "#1d4ed8" : "#475569", fillColor: chosen ? "#60a5fa" : "#94a3b8",
      weight: chosen ? 3 : 1.5, opacity: 0.9, fillOpacity: chosen ? 0.12 : 0.04
    };
  }

  const groups = new Map();
  for (const feature of borders.features) {
    const name = feature.properties.nombre;
    const boundary = L.geoJSON(feature, {
      pane: "administrativePane", style: boundaryStyle,
      onEachFeature: (_, layer) => {
        layer.bindTooltip(escapeHtml(name), { sticky: true });
        layer.on("click", () => selectDepartment(name));
      }
    }).addTo(map);
    boundariesByName.set(name, boundary);
    const layers = {
      puntos: L.featureGroup().addTo(map),
      poligonos: L.featureGroup().addTo(map),
      limite: boundary
    };
    groups.set(name, layers);
    for (const [kind, layer] of Object.entries(layers)) layersByKey.set(`${name}:${kind}`, layer);
  }
  const fullExtent = L.latLngBounds([]);
  for (const boundary of boundariesByName.values()) fullExtent.extend(boundary.getBounds());
  map.fitBounds(fullExtent, { padding: [24, 24] });

  for (const feature of data.features) {
    const p = feature.properties;
    const kind = feature.geometry.type === "Point" ? "puntos" : "poligonos";
    const tipo = p.tipo || "Sin tipo";
    typeOn.set(tipo, true);
    const fill = color(feature);
    let focus;
    let layers;
    let location;
    if (kind === "puntos") {
      focus = L.circleMarker([feature.geometry.coordinates[1], feature.geometry.coordinates[0]], {
        radius: 6, color: "#fff", weight: 1.5, fillColor: fill, fillOpacity: 0.95
      });
      layers = [focus];
      location = focus.getLatLng();
    } else {
      const area = L.geoJSON(feature, {
        style: { color: p.fuente === "minsal" ? "#1f8a70" : "#c45c26", fillColor: fill, weight: 2, fillOpacity: 0.38 }
      });
      focus = area.getLayers()[0];
      layers = [area];
      location = [Number(p.centroide_latitud), Number(p.centroide_longitud)];
    }
    focus.bindPopup(popup(p), { maxWidth: 320 });
    focus.on("mouseover", () => { statusElement.textContent = p.nombre || "Sin nombre"; });
    entries.push({ feature, department: p.departamento, kind, tipo, layers, focus, location });
  }

  function inDepartment(entry) {
    return departmentOn.get(entry.department);
  }

  function enabledDepartments() {
    return departments.filter((name) => departmentOn.get(name));
  }

  function updatePicker() {
    const names = enabledDepartments();
    const custom = names.length !== 1 && names.length !== departments.length;
    customOption.hidden = !custom;
    customOption.textContent = names.length ? `${names.length} departamentos seleccionados` : "Ningún departamento seleccionado";
    picker.value = custom ? "__custom" : names.length === 1 ? names[0] : "";
  }

  function fitEnabled() {
    const names = enabledDepartments();
    const bounds = names.length ? L.latLngBounds([]) : fullExtent;
    for (const name of names) bounds.extend(boundariesByName.get(name).getBounds());
    map.fitBounds(bounds, { padding: [24, 24] });
  }

  function sync() {
    let visible = 0;
    for (const entry of entries) {
      const group = groups.get(entry.department)[entry.kind];
      const show = inDepartment(entry) && sublayerOn.get(entry.department)[entry.kind] && typeOn.get(entry.tipo);
      if (show) visible += 1;
      for (const layer of entry.layers) {
        if (show && !group.hasLayer(layer)) group.addLayer(layer);
        if (!show && group.hasLayer(layer)) group.removeLayer(layer);
      }
    }
    for (const name of departments) {
      const enabled = departmentOn.get(name);
      for (const [kind, group] of Object.entries(groups.get(name))) {
        if (enabled && sublayerOn.get(name)[kind] && !map.hasLayer(group)) group.addTo(map);
        if ((!enabled || !sublayerOn.get(name)[kind]) && map.hasLayer(group)) map.removeLayer(group);
      }
      boundariesByName.get(name).setStyle(boundaryStyle);
    }
    const names = enabledDepartments();
    const scope = names.length === departments.length ? "Todos los departamentos"
      : names.length === 1 ? names[0] : names.length ? `${names.length} departamentos` : "Ningún departamento";
    statusElement.textContent = `${visible} registros activos · ${scope}`;
  }

  function selectDepartment(name) {
    if (name && !departmentOn.has(name)) return;
    for (const department of departments) {
      departmentOn.set(department, !name || department === name);
      if (!name || department === name) {
        for (const kind of ["puntos", "poligonos", "limite"]) sublayerOn.get(department)[kind] = true;
      }
    }
    searchInput.value = "";
    hideResults();
    updatePicker();
    sync();
    render();
    fitEnabled();
  }

  function row(depth, text, options = {}) {
    const element = document.createElement("div");
    element.className = "tree-row";
    element.style.setProperty("--depth", depth);
    element.setAttribute("role", "treeitem");
    if (options.group) element.classList.add("is-group");
    if (options.off) element.classList.add("is-off");
    if (options.layer) {
      element.dataset.layer = options.layer;
      if (selected === options.layer) element.classList.add("is-selected");
      if (options.off) element.classList.add("is-off");
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
      checkbox.indeterminate = !!options.indeterminate;
      checkbox.setAttribute("aria-label", `Mostrar ${text}`);
      checkbox.addEventListener("click", (event) => event.stopPropagation());
      checkbox.addEventListener("change", () => {
        options.toggle(checkbox.checked);
        sync();
        render();
        if (options.zoomOnToggle) fitEnabled();
      });
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
    const enabled = enabledDepartments();
    const nodes = [row(0, "Departamentos", {
      group: true, expand: "departamentos", checked: enabled.length === departments.length,
      indeterminate: enabled.length > 0 && enabled.length < departments.length,
      toggle: (value) => {
        for (const name of departments) {
          departmentOn.set(name, value);
          if (value) for (const kind of ["puntos", "poligonos", "limite"]) sublayerOn.get(name)[kind] = true;
        }
        searchInput.value = "";
        hideResults();
        updatePicker();
      },
      zoomOnToggle: true, count: enabled.length
    })];
    if (expanded.departamentos) {
      for (const name of departments) {
        nodes.push(row(1, name, {
          group: true, expand: `dept:${name}`,
          checked: departmentOn.get(name), off: !departmentOn.get(name),
          toggle: (value) => {
            departmentOn.set(name, value);
            if (value && !Object.values(sublayerOn.get(name)).some(Boolean)) {
              for (const kind of ["puntos", "poligonos", "limite"]) sublayerOn.get(name)[kind] = true;
            }
            searchInput.value = "";
            hideResults();
            updatePicker();
          },
          zoomOnToggle: true, color: "#94a3b833", count: totals.get(name)
        }));
        if (expanded[`dept:${name}`]) {
          const own = entries.filter((entry) => entry.department === name);
          for (const kind of ["puntos", "poligonos", "limite"]) {
            const labels = { puntos: "Puntos", poligonos: "Polígonos", limite: "Límite departamental" };
            nodes.push(row(2, labels[kind], {
              layer: `${name}:${kind}`,
              checked: sublayerOn.get(name)[kind],
              off: !departmentOn.get(name) || !sublayerOn.get(name)[kind],
              toggle: (value) => {
                sublayerOn.get(name)[kind] = value;
                if (value) departmentOn.set(name, true);
                updatePicker();
              },
              color: kind === "puntos" ? "#1f8a70" : kind === "poligonos" ? "#c45c2666" : "#94a3b833",
              point: kind === "puntos",
              count: kind === "limite" ? 1 : own.filter((entry) => entry.kind === kind && typeOn.get(entry.tipo)).length
            }));
          }
        }
      }
    }
    nodes.push(row(0, "Tipos de establecimiento", { group: true, expand: "tipos" }));
    if (expanded.tipos) {
      const local = entries.filter(inDepartment);
      const counts = new Map();
      for (const entry of local) counts.set(entry.tipo, (counts.get(entry.tipo) || 0) + 1);
      for (const [tipo, count] of [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))) {
        nodes.push(row(1, tipo, {
          checked: typeOn.get(tipo), toggle: (value) => { typeOn.set(tipo, value); },
          color: color(local.find((entry) => entry.tipo === tipo).feature), point: true, count
        }));
      }
    }
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
    const [name, kind] = id.split(":");
    const layer = layersByKey.get(id);
    if (!layer || !departmentOn.get(name) || !sublayerOn.get(name)[kind] || !layer.getLayers().length) {
      statusElement.textContent = "La capa no tiene elementos visibles";
      return;
    }
    map.fitBounds(layer.getBounds(), { padding: [24, 24] });
  }

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
  }

  const searchIndex = entries.map((entry) => ({
    entry,
    text: normalize([entry.feature.properties.nombre, entry.feature.properties.municipio,
      entry.tipo, entry.feature.properties.id].join(" "))
  }));

  function hideResults() {
    results.hidden = true;
    searchInput.setAttribute("aria-expanded", "false");
    searchInput.removeAttribute("aria-activedescendant");
  }

  function choose(entry) {
    departmentOn.set(entry.department, true);
    sublayerOn.get(entry.department)[entry.kind] = true;
    typeOn.set(entry.tipo, true);
    selected = `${entry.department}:${entry.kind}`;
    expanded.departamentos = true;
    expanded[`dept:${entry.department}`] = true;
    updatePicker();
    sync();
    render();
    const p = entry.feature.properties;
    map.setView(entry.location, Math.max(map.getZoom(), 16));
    entry.focus.openPopup(entry.location);
    searchInput.value = p.nombre || "Sin nombre";
    hideResults();
    statusElement.textContent = `Resultado: ${p.nombre || "Sin nombre"} · ${p.departamento}`;
  }

  function search() {
    const query = normalize(searchInput.value);
    results.replaceChildren();
    matches = [];
    matchIndex = -1;
    if (query.length < 2) return hideResults();
    matches = searchIndex.filter(({ entry, text }) => inDepartment(entry) && text.includes(query))
      .sort((a, b) => {
        const aName = normalize(a.entry.feature.properties.nombre);
        const bName = normalize(b.entry.feature.properties.nombre);
        return Number(!aName.startsWith(query)) - Number(!bName.startsWith(query)) || aName.localeCompare(bName, "es");
      });
    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "search-empty";
      empty.textContent = "No se encontraron establecimientos";
      results.append(empty);
    }
    for (const { entry } of matches.slice(0, 8)) {
      const p = entry.feature.properties;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "search-result";
      button.setAttribute("role", "option");
      const name = document.createElement("span");
      name.className = "search-result-name";
      name.textContent = p.nombre || "Sin nombre";
      const detail = document.createElement("span");
      detail.className = "search-result-detail";
      detail.textContent = `${p.tipo} · ${p.departamento} · ${p.municipio || ""}`;
      button.append(name, detail);
      button.addEventListener("click", () => choose(entry));
      results.append(button);
    }
    if (matches.length > 8) {
      const more = document.createElement("div");
      more.className = "search-empty";
      more.textContent = `8 de ${matches.length} coincidencias; escribe más para afinar`;
      results.append(more);
    }
    results.hidden = false;
    searchInput.setAttribute("aria-expanded", "true");
  }

  picker.addEventListener("change", () => selectDepartment(picker.value));
  searchInput.addEventListener("input", search);
  searchInput.addEventListener("keydown", (event) => {
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
      choose(matches[Math.max(0, matchIndex)].entry);
    }
  });
  document.getElementById("map-search-clear").addEventListener("click", () => {
    searchInput.value = "";
    hideResults();
    searchInput.focus();
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
    selectDepartment("");
  });
  map.on("mousemove", (event) => {
    document.getElementById("coords").textContent = `Lat ${event.latlng.lat.toFixed(5)}  Lon ${event.latlng.lng.toFixed(5)}`;
  });

  sync();
  render();
})();
