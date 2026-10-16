/* Compartido entre navegador y pruebas Node. Sin acceso a red ni escritura. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RevisionCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const geographic = ['Pendiente', 'Coincidencia revisada', 'Ambiguo', 'Descartado'];
  const documentary = ['Pendiente', 'Existencia documentada', 'No acreditada', 'Contradictoria'];
  const operational = ['Pendiente', 'Funcionamiento documentado', 'No operativo documentado', 'Contradictorio'];
  function csv(text) {
    const rows = []; let row = [], value = '', quoted = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') { if (quoted && text[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
      else if (c === ',' && !quoted) { row.push(value); value = ''; }
      else if (c === '\n' && !quoted) { row.push(value.replace(/\r$/, '')); rows.push(row); row = []; value = ''; }
      else value += c;
    }
    if (quoted) throw Error('CSV incompleto: comillas sin cerrar.');
    if (value || row.length) { row.push(value); rows.push(row); }
    const keys = rows.shift();
    return rows.filter(r => r.some(Boolean)).map(r => {
      if (r.length !== keys.length) throw Error('CSV con columnas incompletas.');
      return Object.fromEntries(keys.map((k, i) => [k, r[i]]));
    });
  }
  function dataset(rows, geojson, compatibility) {
    const establishments = rows.filter(r => r.estado_alcance === 'prioritario_provisional');
    if (establishments.length !== 11 || new Set(establishments.map(r => r.establecimiento_id)).size !== 11) throw Error('Se esperaban las 11 fichas prioritarias del piloto. Revisar los datos antes de continuar.');
    const ids = new Set(establishments.map(r => r.establecimiento_id));
    const features = geojson.features.filter(f => ids.has(f.properties.establecimiento_id));
    if (new Set(features.map(f => f.properties.candidato_id)).size !== features.length) throw Error('IDs de candidatos repetidos.');
    return { establecimientos: establishments, candidatos: { type: 'FeatureCollection', metadata: geojson.metadata, features }, compatibilidad: compatibility.filter(r => ids.has(r.establecimiento_id)) };
  }
  function validateReview(review, data) {
    if (!review || typeof review !== 'object') throw Error('Revisión inválida.');
    if (!geographic.includes(review.estado_geografico) || !documentary.includes(review.estado_documental) || !operational.includes(review.estado_operativo)) throw Error('Estado de revisión desconocido.');
    if (!data.establecimientos.some(e => e.establecimiento_id === review.establecimiento_id)) throw Error('La ficha no está en el conjunto exportado.');
    if (!review.revision_id || !review.responsable?.trim() || !review.fecha_revision || !Number.isFinite(Date.parse(review.fecha_revision))) throw Error('Indica responsable y fecha de revisión válidos.');
    if (!Array.isArray(review.evidencias) || review.evidencias.some(e => typeof e.descripcion !== 'string' || !e.descripcion.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(e.fecha || '') || !Number.isFinite(Date.parse(e.fecha)))) throw Error('Cada evidencia debe tener descripción y fecha.');
    if ([review.estado_geografico, review.estado_documental, review.estado_operativo].some(s => s !== 'Pendiente') && !review.evidencias.length) throw Error('Añade al menos una evidencia fechada para documentar la decisión.');
    for (const [state, scope] of [[review.estado_geografico, 'Geográfico'], [review.estado_documental, 'Documental'], [review.estado_operativo, 'Operativo']]) {
      if (state !== 'Pendiente' && !review.evidencias.some(e => e.ambito === scope)) throw Error(`Añade evidencia fechada de ámbito ${scope} para ese estado.`);
    }
    if (review.estado_geografico === 'Coincidencia revisada' && !review.candidato_id) throw Error('Selecciona explícitamente un polígono para marcar coincidencia revisada.');
    if (review.candidato_id) {
      const f = data.candidatos.features.find(f => f.properties.candidato_id === review.candidato_id && f.properties.establecimiento_id === review.establecimiento_id);
      if (!f) throw Error('El polígono seleccionado no corresponde a esta ficha.');
      if (review.tipo_geometria !== f.geometry.type) throw Error('Tipo de geometría incompatible.');
      if (review.poligono && JSON.stringify(review.poligono.geometry) !== JSON.stringify(f.geometry)) throw Error('La geometría de la revisión difiere de su conjunto exportado.');
    }
    return true;
  }
  function packet(data, reviews, archives = []) {
    return clone({ formato: 'revision-publicos-san-salvador', version: 1, datos: data, revisiones: reviews, importaciones_originales: archives });
  }
  function importPacket(text, current, archives = []) {
    const incoming = JSON.parse(text);
    if (incoming.formato !== 'revision-publicos-san-salvador' || incoming.version !== 1 || !incoming.datos || !Array.isArray(incoming.datos.establecimientos) || !Array.isArray(incoming.datos.candidatos?.features) || !Array.isArray(incoming.revisiones)) throw Error('Formato incompatible. Usa un JSON exportado por esta página (versión 1).');
    const reviews = clone(current), ids = new Map(reviews.map(r => [r.revision_id, r]));
    function validateInArchive(r, p) {
      try { validateReview(r, p.datos); return true; } catch (err) {
        for (const archive of p.importaciones_originales || []) {
          if (archive.revisiones?.some(old => JSON.stringify(old) === JSON.stringify(r)) && validateInArchive(r, archive)) return true;
        }
        return false;
      }
    }
    for (const r of incoming.revisiones) {
      if (!validateInArchive(r, incoming)) throw Error('Una revisión no corresponde a su conjunto original o tiene datos incompletos. No se importó nada.');
      if (ids.has(r.revision_id)) {
        if (JSON.stringify(ids.get(r.revision_id)) !== JSON.stringify(r)) throw Error('Conflicto: el mismo revision_id contiene decisiones diferentes. No se importó nada. Conserva ambos archivos.');
      } else { const copy = clone(r); reviews.push(copy); ids.set(r.revision_id, copy); }
    }
    // Conservar también campos desconocidos, versiones del conjunto y archivos importados completos.
    const kept = clone(archives);
    if (!kept.some(p => JSON.stringify(p) === JSON.stringify(incoming))) kept.push(clone(incoming));
    return { reviews, archives: kept };
  }
  function warnings(f) {
    const p = f.properties, tags = p.etiquetas_overpass_originales || {}, original = p.propiedades_originales || {};
    const result = [];
    if (p.evidencia === 'solo_proximidad_evidencia_insuficiente') result.push('Solo proximidad: no demuestra identidad.');
    if (p.compatibilidad_institucional === 'posible_conflicto') result.push('Conflicto institucional: puede pertenecer a otro establecimiento.');
    if (p.fuente === 'geofabrik') result.push('Geofabrik infiere way para polígonos: el tipo de ID podría ser incorrecto. El enlace abre el ID recibido, sin corregirlo.');
    if (p.compatibilidad_municipal?.includes('diferencia')) result.push('Municipio diferente: revisar divisiones administrativas.');
    if (p.compatibilidad_departamental === 'contradiccion_revisar') result.push('Departamento contradictorio.');
    if (/privad|private/i.test([original.operador, tags['operator:type']].join(' '))) result.push('Señal de carácter privado: fuera de alcance o en conflicto; conservar como incidencia, no aceptar sin resolver la evidencia.');
    if (tags.amenity && tags.healthcare && tags.amenity !== tags.healthcare) result.push(`Etiquetas distintas: amenity=${tags.amenity}; healthcare=${tags.healthcare}.`);
    if (tags.old_name) result.push(`Nombre histórico: ${tags.old_name}.`);
    return result;
  }
  function osmUrl(id) { return /^(node|way|relation)\/\d+$/.test(id || '') ? `https://www.openstreetmap.org/${id}` : null; }
  return { clone, csv, dataset, validateReview, packet, importPacket, warnings, osmUrl, geographic, documentary, operational };
});
