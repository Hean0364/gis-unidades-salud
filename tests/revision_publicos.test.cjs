'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const C = require('../js/revision_core.cjs');
const root = path.resolve(__dirname, '..'), read = p => fs.readFileSync(path.join(root, p), 'utf8');
const full = JSON.parse(read('resultados/piloto_san_salvador_publicos/candidatos_poligonos.geojson'));
const data = C.dataset(C.csv(read('resultados/piloto_san_salvador_publicos/establecimientos_publicos.csv')), full, C.csv(read('resultados/compatibilidad_2026-10-13/prioritarios_compatibilidad.csv')));
const f = data.candidatos.features[0];
function review(extra = {}) { return { revision_id: 'test-review', establecimiento_id: f.properties.establecimiento_id, estado_geografico: 'Coincidencia revisada', estado_documental: 'Pendiente', estado_operativo: 'Pendiente', candidato_id: f.properties.candidato_id, tipo_geometria: f.geometry.type, responsable: 'Revisor de prueba', fecha_revision: '2026-10-13T10:00:00-06:00', evidencias: [{ descripcion: 'Comparación de nombre y geometría local', fecha: '2026-10-13', ambito: 'Geográfico', referencia: 'Archivo local', campo_extra: 'conservar' }], observaciones: 'Prueba, no decisión real', poligono: C.clone(f), ...extra }; }
test('Carga 11 fichas, 139 relaciones completas y ningún estado aprobado por defecto', () => {
  assert.equal(data.establecimientos.length, 11); assert.equal(data.candidatos.features.length, 139);
  assert.equal(C.packet(data, []).revisiones.length, 0);
  for (const f of data.candidatos.features) assert.deepEqual(f, full.features.find(x => x.properties.candidato_id === f.properties.candidato_id));
  const filtered = new Set(['overpass','hot','geofabrik'].flatMap(s => JSON.parse(read(`data/mapa_san_salvador/${s}.geojson`)).features.map(f => `${s}:${f.properties.fuente_id}`)));
  assert.equal(data.candidatos.features.filter(f => !filtered.has(f.properties.fuente + ':' + f.properties.osm_id_original)).length, 79);
});
test('CSV mantiene BOM, comas, saltos de línea y comillas en observaciones', () => {
  assert.deepEqual(C.csv('\uFEFFid,nota\n1,"a, b\n""c"""\n'), [{ id:'1', nota:'a, b\n"c"' }]);
  assert.throws(() => C.csv('id,nota\n1,"incompleta'));
});
test('La coincidencia exige polígono, responsable, fecha y evidencia; no cambia otros estados', () => {
  const r = review(); assert.equal(C.validateReview(r, data), true); assert.equal(r.estado_operativo, 'Pendiente');
  for (const extra of [{ candidato_id: null }, { responsable: '' }, { evidencias: [] }, { fecha_revision: 'incorrecta' }, { candidato_id: 'otro' }, { tipo_geometria: 'Point' }, { estado_documental: 'Existencia documentada' }, { estado_operativo: 'Funcionamiento documentado' }]) assert.throws(() => C.validateReview(review(extra), data));
});
test('Exportación e importación conservan Unicode, atributos desconocidos y geometría completa', () => {
  const r = review({ extension_manual: { texto:'Observación: ñ, "comillas"\nlínea 2' } });
  const exported = C.packet(data, [r]); exported.extension_del_archivo = { conservar: true };
  const merged = C.importPacket(JSON.stringify(exported), []);
  assert.deepEqual(merged.reviews[0], r); assert.deepEqual(merged.archives[0], exported);
  const recovered = C.importPacket(JSON.stringify(C.packet(data, merged.reviews, merged.archives)), []);
  assert.deepEqual(recovered.reviews[0], r); assert.equal(recovered.archives[0].importaciones_originales[0].extension_del_archivo.conservar, true);
});
test('Reimportar no duplica decisiones; distintas versiones se conservan sin seleccionar ganadora', () => {
  const r = review(), second = review({revision_id:'second', estado_geografico:'Ambiguo'});
  assert.equal(C.importPacket(JSON.stringify(C.packet(data,[r])),[r]).reviews.length,1);
  const merged = C.importPacket(JSON.stringify(C.packet(data,[second])),[r]); assert.equal(merged.reviews.length,2); assert.equal(merged.reviews[0].estado_geografico,'Coincidencia revisada');
});
test('Conflicto del mismo ID y JSON inválido se rechazan sin mutar revisiones previas', () => {
  const current=[review()], before=C.clone(current);
  assert.throws(()=>C.importPacket(JSON.stringify(C.packet(data,[review({observaciones:'diferente'})])),current),/Conflicto/);
  assert.throws(()=>C.importPacket('{',current)); assert.throws(()=>C.importPacket('{"version":99}',current)); assert.deepEqual(current,before);
});
test('Cambios de conjunto no pierden la revisión histórica al reexportar e importar', () => {
  const r=review(), imported=C.importPacket(JSON.stringify(C.packet(data,[r])),[]);
  const changed=C.clone(data);changed.candidatos.features=changed.candidatos.features.filter(f=>f.properties.candidato_id!==r.candidato_id);
  const roundtrip=C.importPacket(JSON.stringify(C.packet(changed,imported.reviews,imported.archives)),[]);
  assert.deepEqual(roundtrip.reviews[0],r);
});
test('Advierte proximidad, conflicto institucional, identificadores y enlaces no confiables', () => {
  const proximity=data.candidatos.features.find(f=>f.properties.evidencia==='solo_proximidad_evidencia_insuficiente'); assert(C.warnings(proximity).some(w=>w.includes('Solo proximidad')));
  const conflict=data.candidatos.features.find(f=>f.properties.compatibilidad_institucional==='posible_conflicto'); assert(C.warnings(conflict).some(w=>w.includes('Conflicto institucional')));
  const geo=data.candidatos.features.find(f=>f.properties.fuente==='geofabrik'); assert(C.warnings(geo).some(w=>w.includes('ID')));
  assert.equal(C.osmUrl('javascript:alert(1)'),null);assert.equal(C.osmUrl('relation/8028286'),'https://www.openstreetmap.org/relation/8028286');
});
test('Fuentes y piloto siguen idénticos a la auditoría de compatibilidad',()=>{
  const audit=JSON.parse(read('resultados/compatibilidad_2026-10-13/hallazgos_compatibilidad.json'));
  for(const [p,h]of Object.entries(audit.fuentes_sha256))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex'),h,p);
});
