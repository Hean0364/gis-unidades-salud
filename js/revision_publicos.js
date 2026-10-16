/* Página independiente: lecturas HTTP locales, decisiones en memoria y archivos JSON. */
'use strict';
const C = window.RevisionCore;
const $ = id => document.getElementById(id);
const colors = { overpass: '#c5651a', geofabrik: '#246ca8', hot: '#9236ab' };
const sourceNames = { overpass: 'Overpass', geofabrik: 'Geofabrik', hot: 'HOT/HDX' };
const roleNames = { edificio_segun_geofabrik: 'Edificio individual (según Geofabrik)', predio_segun_geofabrik_no_verificado: 'Predio o recinto (según Geofabrik; sin verificar)', recinto_posible: 'Posible recinto; pendiente de revisión', poligono_funcion_pendiente: 'Función sin determinar: no asumir edificio o terreno' };
const evidenceNames = { solo_proximidad_evidencia_insuficiente: 'Solo proximidad; evidencia insuficiente', contencion_candidata: 'Contención de la referencia', proximidad_y_nombre_alias: 'Proximidad y nombre o alias', geometria_del_registro_fuente: 'Geometría del mismo registro de origen' };
let data, active, map, markers, layers = new Map(), backdrop, reviews = [], archives = [], dirty = false, unexported = false, loaded = null;
function node(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
function message(text, error = false) { $('message').textContent = text; $('message').className = error ? 'error' : ''; }
function link(text, url) { const a = node('a', text); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; }
function currentFeatures() { return data.candidatos.features.filter(f => f.properties.establecimiento_id === active.establecimiento_id); }
function touched() { dirty = true; $('draft-status').textContent = 'Cambios sin registrar. Registra una versión y después exporta el JSON.'; }
function canLeave() { return !dirty || window.confirm('Hay cambios del formulario sin registrar. ¿Descartarlos para continuar? Las versiones ya registradas se conservan.'); }
function localDate() { return new Date(Date.now() - 6 * 3600000).toISOString().slice(0, 16); }
function fillOptions(id, values) { $(id).replaceChildren(...values.map(v => { const option = node('option', v); option.value = v; return option; })); }
function buildList() {
  $('establishments').replaceChildren();
  for (const e of data.establecimientos) {
    const button = node('button', undefined, 'entry' + (active?.establecimiento_id === e.establecimiento_id ? ' selected' : ''));
    button.append(node('strong', e.nombre), node('small', `${e.institucion_propuesta} · ${e.establecimiento_id}`), node('small', `${reviews.filter(r => r.establecimiento_id === e.establecimiento_id).length} versiones registradas; sin aprobación automática`));
    button.onclick = () => { if (canLeave()) selectEstablishment(e); };
    $('establishments').append(button);
  }
}
function addEvidence(value = {}) {
  const row = node('div', undefined, 'evidence-row'); row.original = C.clone(value);
  for (const [key, title, type] of [['descripcion', 'Evidencia utilizada', 'text'], ['referencia', 'URL o referencia documental', 'text'], ['fecha', 'Fecha de la evidencia', 'date']]) {
    const label = node('label', title), input = node('input'); input.type = type; input.dataset.key = key; input.value = value[key] || ''; input.required = key !== 'referencia'; label.append(input); row.append(label);
  }
  const label = node('label', 'Ámbito de la evidencia'), select = node('select'); select.dataset.key = 'ambito';
  for (const v of ['Geográfico', 'Documental', 'Operativo']) { const option = node('option', v); select.append(option); }
  if (value.ambito && !['Geográfico', 'Documental', 'Operativo'].includes(value.ambito)) select.append(node('option', value.ambito));
  select.value = value.ambito || 'Geográfico'; label.append(select); row.append(label);
  const remove = node('button', 'Quitar evidencia del borrador'); remove.type = 'button'; remove.onclick = () => { row.remove(); touched(); }; row.append(remove); $('evidence').append(row);
}
function resetForm(review = null) {
  loaded = review ? C.clone(review) : null;
  $('geo-state').value = review?.estado_geografico || 'Pendiente'; $('doc-state').value = review?.estado_documental || 'Pendiente'; $('op-state').value = review?.estado_operativo || 'Pendiente';
  $('polygon').value = review?.candidato_id || ''; $('geometry-role').value = review?.funcion_geometria || 'Sin determinar';
  $('observations').value = review?.observaciones || ''; $('reviewer').value = review?.responsable || '';
  $('review-date').value = review?.fecha_revision ? new Date(Date.parse(review.fecha_revision) - 6 * 3600000).toISOString().slice(0, 16) : localDate();
  $('evidence').replaceChildren(); (review?.evidencias || []).forEach(addEvidence);
  dirty = false; polygonChanged(false); $('draft-status').textContent = review ? 'Versión cargada como borrador. Registrar creará una nueva versión; no reemplazará la anterior.' : 'Sin decisión registrada para este formulario. Todos los estados están pendientes.';
}
function history() {
  $('history').replaceChildren();
  const list = reviews.filter(r => r.establecimiento_id === active.establecimiento_id);
  if (!list.length) $('history').append(node('p', 'Sin versiones registradas.', 'muted'));
  for (const r of list) {
    const div = node('div', undefined, 'version'); div.append(node('strong', `${r.estado_geografico} · ${r.responsable}`), node('p', `${r.fecha_revision} · Documental: ${r.estado_documental} · Operativo: ${r.estado_operativo}`));
    const btn = node('button', 'Cargar esta versión como borrador');
    btn.onclick = () => {
      if (r.candidato_id) {
        const f = currentFeatures().find(f => f.properties.candidato_id === r.candidato_id);
        if (!f || (r.poligono && JSON.stringify(r.poligono.geometry) !== JSON.stringify(f.geometry))) { message('La versión usa un polígono ausente o diferente al piloto actual. Se conserva en la exportación; no se aplicó al formulario.', true); return; }
      }
      if (canLeave()) resetForm(r);
    };
    const details = node('details'); details.append(node('summary', 'Ver revisión completa'), node('pre', JSON.stringify(r, null, 2))); div.append(btn, details); $('history').append(div);
  }
}
function initMap(boundary) {
  if (!window.L) { $('map').append(node('p', 'No se pudo cargar Leaflet desde el CDN del visor existente. Revisa la conexión y recarga para inspeccionar el mapa. El formulario y la exportación siguen disponibles.', 'warning')); return; }
  map = L.map('map', { center: [13.7, -89.2], zoom: 13 });
  L.control.scale({ imperial: false }).addTo(map); markers = L.featureGroup().addTo(map);
  L.geoJSON(boundary, { interactive: false, style: { color: '#4e6466', weight: 2, dashArray: '6 6', fill: false } }).addTo(map);
  $('base').onchange = () => {
    if (backdrop) map.removeLayer(backdrop);
    const base = $('base').value;
    if (base === 'none') return;
    backdrop = L.tileLayer(base === 'osm' ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: base === 'osm' ? '&copy; OpenStreetMap' : 'Esri, Maxar, Earthstar Geographics' }).addTo(map);
    backdrop.bringToBack();
  };
}
function fit() { if (!map) return; const group = L.featureGroup([markers, ...[...layers.values()].filter(l => map.hasLayer(l))]); if (group.getBounds().isValid()) map.fitBounds(group.getBounds(), { padding: [25, 25], maxZoom: 17 }); }
function visibility(id, show) { const layer = layers.get(id); if (map && layer) { if (show) layer.addTo(map); else map.removeLayer(layer); } }
function polygonChanged(mark = true) {
  const feature = currentFeatures().find(f => f.properties.candidato_id === $('polygon').value);
  $('geometry-type').value = feature?.geometry.type || 'Sin seleccionar';
  document.querySelectorAll('.candidate').forEach(card => card.classList.toggle('selected', card.dataset.id === $('polygon').value));
  if (feature && C.warnings(feature).length) message('Candidato seleccionado con advertencias. Documenta la evidencia y los conflictos; la selección no aprueba la coincidencia.');
  if (mark) touched();
}
function selectEstablishment(e) {
  active = e; layers.forEach(l => { if (map) map.removeLayer(l); }); layers.clear(); if (markers) markers.clearLayers();
  $('selected-title').textContent = e.nombre;
  const isMinsal = e.tipo_punto_referencia === 'punto_fuente_minsal';
  $('point-description').textContent = `${isMinsal ? 'Punto original de la fuente MINSAL' : 'Referencia del piloto calculada del polígono OSM: promedio de vértices; no es un punto original de levantamiento'}: ${e.latitud_referencia}, ${e.longitud_referencia}.`;
  const compatibility = data.compatibilidad.find(r => r.establecimiento_id === e.establecimiento_id);
  $('issues').textContent = compatibility?.problemas || 'Identidad, institución, ubicación y funcionamiento pendientes de revisión.';
  $('source-info').textContent = JSON.stringify({ ficha_original: e, compatibilidad: compatibility }, null, 2);
  if (map) L.circleMarker([+e.latitud_referencia, +e.longitud_referencia], { radius: 7, color: '#101c23', fillColor: '#fff', fillOpacity: 1, weight: 3 }).bindPopup(node('span', $('point-description').textContent)).addTo(markers);
  const fs = currentFeatures(); $('candidate-count').textContent = `(${fs.length})`; $('candidates').replaceChildren();
  $('polygon').replaceChildren(new Option('Ninguno — sin decisión', ''));
  for (const f of fs) {
    const p = f.properties, warnings = C.warnings(f), color = colors[p.fuente] || '#555';
    const card = node('article', undefined, 'candidate'); card.dataset.id = p.candidato_id; card.style.setProperty('--source', color);
    const toggleLabel = node('label'), checkbox = node('input'); checkbox.type = 'checkbox'; checkbox.checked = true; checkbox.dataset.candidate = p.candidato_id; checkbox.onchange = () => visibility(p.candidato_id, checkbox.checked); toggleLabel.append(checkbox, document.createTextNode(` Mostrar ${sourceNames[p.fuente] || p.fuente} · ${p.osm_id_original}`));
    card.append(toggleLabel, node('h3', p.nombre_original || 'Sin nombre'), node('p', `${f.geometry.type} · ${roleNames[p.funcion_poligono] || p.funcion_poligono}`), node('p', `Tipo: ${p.tipo_original || 'Sin dato'} · Operador: ${p.operador_original || 'No informado'}`), node('p', `Evidencia: ${evidenceNames[p.evidencia] || p.evidencia}. Distancia aproximada: ${p.distancia_aproximada_m} m. Contiene referencia: ${p.contiene_punto}.`, 'muted'));
    for (const w of warnings) card.append(node('p', w, 'warning'));
    const details = node('details'); details.append(node('summary', 'Ver IDs, atributos, evidencia y geometría originales'), node('pre', JSON.stringify(f, null, 2))); card.append(details);
    const actions = node('div', undefined, 'actions'), zoom = node('button', 'Encuadrar'); zoom.type = 'button'; zoom.onclick = () => { if (map) { visibility(p.candidato_id, true); checkbox.checked = true; map.fitBounds(layers.get(p.candidato_id).getBounds(), { padding: [20, 20], maxZoom: 19 }); } };
    const choose = node('button', 'Seleccionar para la revisión'); choose.type = 'button'; choose.onclick = () => { $('polygon').value = p.candidato_id; polygonChanged(); };
    actions.append(zoom, choose); const osmUrl = C.osmUrl(p.osm_id_original); if (osmUrl) actions.append(link('OpenStreetMap (ID recibido)', osmUrl));
    const original = p.propiedades_originales || {}, lat = Number(original.lat ?? e.latitud_referencia), lon = Number(original.lon ?? e.longitud_referencia);
    if (Number.isFinite(lat) && Number.isFinite(lon)) actions.append(link('Google Maps (referencia)', `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`));
    card.append(actions); $('candidates').append(card);
    $('polygon').append(new Option(`${sourceNames[p.fuente]} · ${p.osm_id_original} · ${p.nombre_original}`, p.candidato_id));
    if (map) { const layer = L.geoJSON(f, { style: { color, weight: 2, fillOpacity: .12, dashArray: /edificio/.test(p.funcion_poligono) ? '4 3' : null } }).bindPopup(node('span', `${sourceNames[p.fuente]} · ${p.osm_id_original} · ${p.nombre_original}. ${p.funcion_poligono}. ${p.evidencia}`)).addTo(map); layers.set(p.candidato_id, layer); }
  }
  $('review-fields').disabled = false; resetForm(); buildList(); history(); fit();
}
function getEvidence() { return [...$('evidence').children].map(row => { const value = { ...row.original }; row.querySelectorAll('[data-key]').forEach(input => { value[input.dataset.key] = input.value; }); return value; }); }
$('review-form').oninput = touched; $('review-form').onchange = touched;
$('polygon').onchange = () => polygonChanged(); $('add-evidence').onclick = () => { addEvidence(); touched(); };
$('review-form').onsubmit = ev => {
  ev.preventDefault();
  try {
    const candidate = currentFeatures().find(f => f.properties.candidato_id === $('polygon').value);
    if ($('geo-state').value === 'Coincidencia revisada' && candidate && C.warnings(candidate).length && !$('observations').value.trim()) throw Error('Documenta en observaciones cómo evaluaste las advertencias del candidato.');
    const r = { ...(loaded ? C.clone(loaded) : {}), revision_id: crypto.randomUUID(), revision_anterior: loaded?.revision_id || null, establecimiento_id: active.establecimiento_id, estado_geografico: $('geo-state').value, estado_documental: $('doc-state').value, estado_operativo: $('op-state').value, candidato_id: candidate?.properties.candidato_id || null, tipo_geometria: candidate?.geometry.type || null, funcion_geometria: $('geometry-role').value, evidencias: getEvidence(), observaciones: $('observations').value, responsable: $('reviewer').value, fecha_revision: $('review-date').value + ':00-06:00', registrado_en: new Date().toISOString(), poligono: candidate ? C.clone(candidate) : null, ficha_original: C.clone(active) };
    C.validateReview(r, data); reviews.push(r); loaded = C.clone(r); dirty = false; unexported = true; history(); buildList(); $('draft-status').textContent = 'Versión registrada en memoria. Exporta el JSON para conservarla.'; message('Revisión registrada por intervención manual. Existencia documental y funcionamiento mantienen sus estados independientes.');
  } catch (err) { message(err.message, true); }
};
$('export').onclick = () => {
  if (dirty) { message('Registra primero el borrador del formulario. La exportación conserva versiones registradas, no cambios sin registrar.', true); return; }
  const text = JSON.stringify(C.packet(data, reviews, archives), null, 2), blob = new Blob([text], { type: 'application/json;charset=utf-8' }), url = URL.createObjectURL(blob), a = node('a');
  a.href = url; a.download = `revisiones_san_salvador_${new Date().toISOString().replace(/[:.]/g, '-')}.json`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); unexported = false;
  message('Exportación solicitada. Comprueba el archivo descargado: contiene versiones, IDs, geometrías completas e importaciones preservadas. No se ha enviado a ningún servidor.');
};
$('import').onchange = async ev => {
  const file = ev.target.files[0]; if (!file) return;
  try {
    const result = C.importPacket(await file.text(), reviews, archives); reviews = result.reviews; archives = result.archives; unexported = true; buildList(); history();
    const outside = reviews.filter(r => !data.establecimientos.some(e => e.establecimiento_id === r.establecimiento_id)).length;
    message(`Importación conservada: ${reviews.length} versiones en total; ${outside} de fichas ajenas a esta lista, archivadas en el JSON. El formulario actual no se modificó. Selecciona una versión para cargarla; exporta para conservar la combinación.`);
  } catch (err) { message(`No se importó ningún cambio: ${err.message}`, true); } finally { ev.target.value = ''; }
};
for (const [id, value] of [['show-all', true], ['hide-all', false]]) $(id).onclick = () => document.querySelectorAll('[data-candidate]').forEach(c => { c.checked = value; visibility(c.dataset.candidate, value); });
$('fit').onclick = fit;
window.addEventListener('beforeunload', event => { if (dirty || unexported) { event.preventDefault(); event.returnValue = ''; } });
async function start() {
  try {
    const urls = ['resultados/piloto_san_salvador_publicos/establecimientos_publicos.csv', 'resultados/piloto_san_salvador_publicos/candidatos_poligonos.geojson', 'resultados/compatibilidad_2026-10-13/prioritarios_compatibilidad.csv', 'data/mapa_san_salvador/departamento.geojson'];
    const texts = await Promise.all(urls.map(async url => { const response = await fetch(url); if (!response.ok) throw Error(`${url}: HTTP ${response.status}`); return response.text(); }));
    data = C.dataset(C.csv(texts[0]), JSON.parse(texts[1]), C.csv(texts[2]));
    data.archivos = await Promise.all(urls.map(async (archivo, i) => ({ archivo, sha256: crypto.subtle ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texts[i])))].map(x => x.toString(16).padStart(2, '0')).join('') : null })));
    fillOptions('geo-state', C.geographic); fillOptions('doc-state', C.documentary); fillOptions('op-state', C.operational);
    initMap(JSON.parse(texts[3])); ['export', 'import', 'fit', 'show-all', 'hide-all'].forEach(id => { $(id).disabled = false; }); selectEstablishment(data.establecimientos[0]);
    message(`11 fichas y ${data.candidatos.features.length} relaciones candidatas completas. Sin decisiones aprobadas ni revisiones aplicadas automáticamente.${map ? '' : ' El mapa no está disponible: no se pudo cargar Leaflet.'}`);
  } catch (err) { message(`No se pudo iniciar: ${err.message}. Abre esta página mediante el servidor local indicado en la guía, no con file://.`, true); }
}
start();
