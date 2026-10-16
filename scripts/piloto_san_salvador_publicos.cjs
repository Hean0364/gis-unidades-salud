/* Piloto reproducible sin dependencias ni acceso de red. Solo escribe resultados. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'resultados/piloto_san_salvador_publicos');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const unique = a => [...new Set(a)];
const json = JSON.stringify;
const inputs = ['data/originales/minsal_establecimientos.csv', 'data/originales/overpass_salud.geojson', ...['minsal', 'overpass', 'hot', 'geofabrik'].map(n => `data/geojson/${n}.geojson`)];
const hashes = Object.fromEntries(inputs.map(p => [p, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex')]));
const sources = Object.fromEntries(['minsal', 'overpass', 'hot', 'geofabrik'].map(n => [n, JSON.parse(read(`data/geojson/${n}.geojson`)).features]));
const raw = new Map(JSON.parse(read('data/originales/overpass_salud.geojson')).features.map(f => [f.properties['@id'], f.properties]));
const refs = [];
for (const [source, features] of Object.entries(sources)) for (const f of features) refs.push({ source, file: `data/geojson/${source}.geojson`, f, p: f.properties, tags: raw.get(f.properties.osm_id) || {} });
const osm = refs.filter(r => r.source !== 'minsal');
const minsal = refs.filter(r => r.source === 'minsal');
function rings(g) { return g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []; }
function pointRing(p, r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i], b = r[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function contains(p, g) { return rings(g).some(r => pointRing(p, r[0]) && !r.slice(1).some(h => pointRing(p, h))); }
// Plano tangente equirectangular centrado en el punto, R=6371008.8 m.
// Solo cribado local <=1500 m; no se usa para áreas ni verificación catastral.
function distance(p, g) {
  if (contains(p, g)) return 0;
  const k = Math.PI / 180 * 6371008.8, c = Math.cos(p[1] * Math.PI / 180);
  const xy = q => [(q[0] - p[0]) * k * c, (q[1] - p[1]) * k];
  const lines = g.type === 'Point' ? [[g.coordinates]] : g.type === 'LineString' ? [g.coordinates] : rings(g).flat();
  let best = Infinity;
  for (const line of lines) {
    if (line.length === 1) best = Math.min(best, Math.hypot(...xy(line[0])));
    for (let i = 1; i < line.length; i++) {
      const a = xy(line[i - 1]), b = xy(line[i]), dx = b[0] - a[0], dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / (dx * dx + dy * dy || 1)));
      best = Math.min(best, Math.hypot(a[0] + t * dx, a[1] + t * dy));
    }
  }
  return best;
}
const stop = new Set('hospital nacional general de del la el los las san salvador ss dr dra doctor doctora departamento unidad medica instituto salud clinica clinicas centro anexo iss s isss en enfermera'.split(' '));
const tokens = s => unique(norm(s).split(' ').filter(w => w.length > 2 && !stop.has(w)));
function similarity(a, b) { const x = tokens(a), y = tokens(b); return x.length && y.length ? x.filter(w => y.includes(w)).length / Math.min(x.length, y.length) : 0; }
const nameOf = r => [r.p.nombre, r.tags.official_name, r.tags.alt_name, r.tags.short_name, r.tags.old_name].filter(Boolean).join(' | ');
function institution(r) {
  if (r.source === 'minsal') return 'MINSAL';
  const text = norm([r.p.nombre, r.p.operador, r.tags.operator, r.tags['operator:short']].join(' '));
  const isss = /\bisss\b|instituto salvadoreno del seguro social/.test(text);
  const ms = /\bminsal\b|ministerio de salud/.test(text);
  return isss && ms ? 'CONTRADICTORIA' : isss ? 'ISSS' : ms ? 'MINSAL' : 'NO_DETERMINADA';
}
// No corregir el tipo OSM de Geofabrik: cada identificador recibido permanece intacto.
const groups = new Map();
for (const r of osm) { const key = r.source === 'geofabrik' ? `geofabrik:${r.p.osm_id}` : `osm:${r.p.osm_id}`; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(r); }
const muniDeps = new Map();
for (const r of minsal) { const m = norm(r.p.municipio); if (!muniDeps.has(m)) muniDeps.set(m, new Set()); muniDeps.get(m).add(r.p.departamento); }
function location(rs) {
  const deps = unique(rs.flatMap(r => {
    if (r.p.departamento) return [r.p.departamento];
    const d = muniDeps.get(norm(r.p.municipio)); return d && d.size === 1 ? [...d] : [];
  }).map(norm));
  return { deps, eligible: deps.length === 1 && deps[0] === 'san salvador', conflict: deps.length > 1, outside: deps.length === 1 && deps[0] !== 'san salvador' };
}
const seeds = minsal.filter(r => norm(r.p.departamento) === 'san salvador' && /^Hospital/.test(r.p.tipo));
const establishments = [], candidates = [], features = [];
function rowFor(id, rs, inst, status, reason, anchor) {
  const loc = location(rs), p = anchor.p;
  return { establecimiento_id: id, nombre: p.nombre, institucion_propuesta: inst, tipo_original: p.tipo,
    departamento_declarado: unique(rs.map(r => r.p.departamento).filter(Boolean)).join(' | '), municipios_originales: unique(rs.map(r => r.p.municipio).filter(Boolean)).join(' | '),
    estado_alcance: status, motivo_alcance: reason, estado_ubicacion: loc.conflict ? 'contradictoria_pendiente' : loc.eligible ? 'administrativa_provisional_limite_pendiente' : 'pendiente_de_revision',
    estado_institucion: anchor.source === 'minsal' ? 'documentada_en_fuente_minsal' : 'indicada_por_osm_pendiente',
    estado_geografico: 'pendiente_de_revision', estado_operativo: 'validacion_operativa_pendiente',
    longitud_referencia: p.lon, latitud_referencia: p.lat, tipo_punto_referencia: anchor.source === 'minsal' ? 'punto_fuente_minsal' : anchor.f.geometry.type === 'Point' ? 'punto_osm' : 'promedio_vertices_no_centroide',
    registros_fuente: json(rs.map(r => ({archivo:r.file,id:r.p.id,osm_id:r.p.osm_id || '',propiedades:r.p}))),
    posibles_minsal: '', posibles_duplicados: '', n_poligonos_candidatos: 0, n_objetos_osm_recibidos: 0,
    estado_revision_manual: 'pendiente', observaciones_manuales: '', revisor: '', fecha_revision: '' };
}
for (const r of seeds) establishments.push({row:rowFor(r.p.id,[r],'MINSAL','prioritario_provisional','Hospital MINSAL con departamento declarado San Salvador',r),rs:[r],anchor:r});
for (const [id, rs] of groups) {
  const anchor = rs.find(r => r.source === 'hot') || rs[0], p = anchor.p, loc = location(rs);
  const insts = unique(rs.map(institution).filter(x => x !== 'NO_DETERMINADA'));
  const inst = insts.length === 1 ? insts[0] : insts.length ? 'CONTRADICTORIA' : 'NO_DETERMINADA';
  // Geofabrik hereda ubicación solo por ID recibido exacto; no por vecino más cercano.
  if (anchor.source === 'geofabrik') { const other = groups.get(`osm:${p.osm_id}`); if (other) rs.push(...other); }
  const geo = location(rs);
  if (geo.outside && !geo.conflict) continue;
  if (!geo.eligible && !geo.conflict && inst === 'NO_DETERMINADA') continue;
  const name = norm(p.nombre), hospital = rs.some(r => r.p.tipo === 'Hospital'), namedHospital = /\bhospital\b/.test(name);
  const excluded = /veterin|\bpets\b|clinica comunal|consultorio/.test(name) || rs.some(r => /privad/.test(norm(r.p.operador))) || (!hospital && !namedHospital && ['Farmacia','Dentista','Laboratorio','Optometría','Audiología','Puesto de salud','Promotor de salud','Toma de muestras','Medicina alternativa','Consejería'].includes(p.tipo));
  let status = excluded ? 'excluido_provisionalmente' : 'pendiente_de_revision';
  let reason = excluded ? 'Privado, veterinario o unidad pequeña según evidencia local; revisar contradicciones' : 'Institución, nivel hospitalario o ubicación insuficientemente respaldados';
  if (!excluded && geo.eligible && ['MINSAL','ISSS'].includes(inst) && hospital && namedHospital) { status='prioritario_provisional'; reason='Nombre hospitalario, etiqueta hospital y señal institucional; evidencia OSM no independiente'; }
  const point=[p.lon,p.lat];
  const links = seeds.filter(s => distance([s.p.lon,s.p.lat],anchor.f.geometry) <= 1500 && (similarity(s.p.nombre,nameOf(anchor)) >= .5) && inst !== 'ISSS');
  if (!excluded && links.length) { status='posible_representacion_minsal'; reason='Nombre/alias y proximidad compatibles con ficha MINSAL; no fusión validada'; }
  if (!excluded && anchor.source==='geofabrik' && groups.has(`osm:${p.osm_id}`)) {status='representacion_otra_fuente';reason='Mismo ID recibido en otra extracción; no establecimiento adicional';}
  const row=rowFor(id,rs,inst,status,reason,anchor); row.posibles_minsal=links.map(s=>s.p.id).join('|');
  establishments.push({row,rs,anchor});
}
const polygons=osm.filter(r=>rings(r.f.geometry).length);
for(const e of establishments){
  if(e.row.estado_alcance==='excluido_provisionalmente') continue;
  if(e.row.institucion_propuesta==='NO_DETERMINADA' && !e.rs.some(r=>r.p.tipo==='Hospital') && !e.row.posibles_minsal) continue;
  const point=[Number(e.row.longitud_referencia),Number(e.row.latitud_referencia)];
  for(const r of polygons){
    const d=distance(point,r.f.geometry), sim=similarity(e.row.nombre,nameOf(r));
    const own=e.rs.some(x=>x.source===r.source&&x.p.id===r.p.id);
    if(!own && !(d<=100 || d<=750&&sim>=.5)) continue;
    const role=r.p.detalle==='Edificio'?'edificio_segun_geofabrik':r.p.detalle==='Predio'?'predio_segun_geofabrik_no_verificado':r.tags.landuse?'recinto_posible':'poligono_funcion_pendiente';
    const row={candidato_id:`${e.row.establecimiento_id}::${r.source}::${r.p.id}`,establecimiento_id:e.row.establecimiento_id,fuente:r.source,archivo_fuente:r.file,id_original:r.p.id,osm_id_original:r.p.osm_id,nombre_original:r.p.nombre,tipo_original:r.p.tipo,operador_original:r.p.operador||r.tags.operator||'',funcion_poligono:role,
      contiene_punto:contains(point,r.f.geometry)?'si':'no',distancia_aproximada_m:+d.toFixed(2),similitud_tokens:+sim.toFixed(3),evidencia:own?'geometria_del_registro_fuente':d===0?'contencion_candidata':sim>=.5?'proximidad_y_nombre_alias':'solo_proximidad_evidencia_insuficiente',
      compatibilidad_institucional:institution(r)==='NO_DETERMINADA'?'sin_dato':institution(r)===e.row.institucion_propuesta?'compatible':'posible_conflicto',
      compatibilidad_departamental:r.p.departamento?(norm(r.p.departamento)==='san salvador'?'declarada_san_salvador':'contradiccion_revisar'):'sin_dato',
      compatibilidad_municipal:r.p.municipio&&e.anchor.p.municipio?(norm(r.p.municipio)===norm(e.anchor.p.municipio)?'coincide_texto':'diferencia_revisar_division_administrativa'):'sin_dato',
      grupo_representacion_osm:r.p.osm_id,advertencias:[r.source==='geofabrik'?'tipo_osm_inferido_por_importador_no_confiable':'',d>0&&sim<.5&&!own?'proximidad_no_demuestra_identidad':'','funcion_y_limites_sin_validar'].filter(Boolean).join('|'),
      estado_geografico:'candidato_identificado',estado_revision_manual:'pendiente',observaciones_manuales:'',revisor:'',fecha_revision:''};
    candidates.push(row);features.push({type:'Feature',properties:{...row,propiedades_originales:r.p,etiquetas_overpass_originales:r.tags},geometry:r.f.geometry});
  }
  const cs=candidates.filter(c=>c.establecimiento_id===e.row.establecimiento_id);
  e.row.n_poligonos_candidatos=cs.length;e.row.n_objetos_osm_recibidos=unique(cs.map(c=>c.osm_id_original)).length;
  e.row.estado_geografico=cs.length?(e.row.n_objetos_osm_recibidos>1?'ambiguo':'candidato_identificado'):'sin_poligono_identificado';
}
for(const e of establishments){e.row.posibles_duplicados=establishments.filter(x=>x!==e&&distance([e.anchor.p.lon,e.anchor.p.lat],x.anchor.f.geometry)<=750&&similarity(e.row.nombre,x.row.nombre)>=.5).map(x=>x.row.establecimiento_id).join('|');}
function parseCsv(text){let rows=[],row=[],v='',q=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){v+='"';i++;}else q=!q;}else if(c===','&&!q){row.push(v);v='';}else if(c==='\n'&&!q){row.push(v.replace(/\r$/,''));rows.push(row);row=[];v='';}else v+=c;}if(v||row.length){row.push(v);rows.push(row);}const keys=(rows.shift()||[]).map(k=>k.replace(/^\uFEFF/,''));return rows.map(r=>Object.fromEntries(keys.map((k,i)=>[k,r[i]||''])));}
// Retirar solo resultados automáticos obsoletos; nunca originales ni revisiones.
const hasReview = r => Object.entries(r).some(([k,v])=>/manual|revisor|fecha_revision/.test(k)&&v&&v!=='pendiente');
function merge(rows,old,key){const map=new Map(rows.map(r=>[r[key],r])),known=new Set(rows.flatMap(Object.keys));for(const prev of old){if(!map.has(prev[key])){if(hasReview(prev)||Object.keys(prev).some(k=>!known.has(k)))rows.push({...prev,fuera_generacion_actual:'si'});continue;}const r=map.get(prev[key]);for(const [k,v] of Object.entries(prev))if(!(k in r)||/manual|revisor|fecha_revision/.test(k))r[k]=v;}return rows;}
function csv(rows){const keys=unique(rows.flatMap(Object.keys));const esc=v=>'"'+String(v??'').replace(/"/g,'""')+'"';return '\uFEFF'+keys.map(esc).join(',')+'\n'+rows.map(r=>keys.map(k=>esc(r[k])).join(',')).join('\n')+'\n';}
fs.mkdirSync(outDir,{recursive:true});
function saveCsv(name,rows,key){const p=path.join(outDir,name);if(fs.existsSync(p))merge(rows,parseCsv(fs.readFileSync(p,'utf8')),key);fs.writeFileSync(p,csv(rows));}
saveCsv('establecimientos_publicos.csv',establishments.map(e=>e.row),'establecimiento_id');
saveCsv('candidatos_poligonos.csv',candidates,'candidato_id');
const gp=path.join(outDir,'candidatos_poligonos.geojson');
if(fs.existsSync(gp)){const old=JSON.parse(fs.readFileSync(gp)).features;const map=new Map(features.map(f=>[f.properties.candidato_id,f]));const known=new Set(features.flatMap(f=>Object.keys(f.properties)));for(const f of old){const cur=map.get(f.properties.candidato_id);if(!cur){if(hasReview(f.properties)||Object.keys(f.properties).some(k=>!known.has(k)))features.push({...f,properties:{...f.properties,fuera_generacion_actual:'si'}});}else{merge([cur.properties],[f.properties],'candidato_id');if(json(f.geometry)!==json(cur.geometry)){cur.properties.geometria_anterior=f.geometry;}}}}
// Sincronizar revisiones preservadas en CSV con GeoJSON.
const cm=new Map(candidates.map(c=>[c.candidato_id,c]));for(const f of features)if(cm.has(f.properties.candidato_id)){for(const [k,v] of Object.entries(cm.get(f.properties.candidato_id))){if(/manual|revisor|fecha_revision/.test(k)&&f.properties[k]&&f.properties[k]!=='pendiente'){if(v&&v!=='pendiente'&&v!==f.properties[k]){f.properties.conflictos_revision={...(f.properties.conflictos_revision||{}),[k]:{geojson:f.properties[k],csv:v}};}continue;}f.properties[k]=v;}}
fs.writeFileSync(gp,json({type:'FeatureCollection',metadata:{alcance:'Departamento San Salvador; MINSAL e ISSS',validacion:'Todos son candidatos, sin validación manual',fuentes_sha256:hashes},features},null,2)+'\n');
const priority=establishments.filter(e=>e.row.estado_alcance==='prioritario_provisional');
const summary={fichas_prioritarias:priority.length,MINSAL:priority.filter(e=>e.row.institucion_propuesta==='MINSAL').length,ISSS:priority.filter(e=>e.row.institucion_propuesta==='ISSS').length,con_poligonos:priority.filter(e=>e.row.n_poligonos_candidatos>0).length,sin_poligonos:priority.filter(e=>!e.row.n_poligonos_candidatos).length,varios_objetos_osm:priority.filter(e=>e.row.n_objetos_osm_recibidos>1).length,fichas_evaluadas:establishments.length,relaciones_candidatas:candidates.length};
let report=`# Piloto San Salvador: públicos MINSAL e ISSS\n\nFecha de elaboración: 2026-10-13. Ninguna coincidencia está aprobada.\n\n## Resultado automático\n\n${Object.entries(summary).map(([k,v])=>`- ${k}: ${v}`).join('\n')}\n\nSon fichas prioritarias provisionales, no un censo de establecimientos únicos confirmados. Las posibles representaciones MINSAL y las copias Geofabrik permanecen en el CSV sin inflar el conteo prioritario. Las otras unidades ISSS permanecen pendientes: nombre ISSS y etiqueta hospital no prueban capacidad hospitalaria.\n\n| Ficha | Nombre | Institución | Polígonos por fuente | IDs OSM recibidos distintos |\n|---|---|---|---:|---:|\n${priority.map(e=>`| ${e.row.establecimiento_id} | ${e.row.nombre} | ${e.row.institucion_propuesta} | ${e.row.n_poligonos_candidatos} | ${e.row.n_objetos_osm_recibidos} |`).join('\n')}\n\n## Método y límites\n\n- No hay límites departamentales locales. La ubicación se apoya en departamento declarado y, como respaldo provisional, municipio inequívoco en la tabla MINSAL nacional. No se equiparan divisiones históricas y actuales. Todas las ubicaciones requieren verificación territorial. Contradicciones quedan pendientes.\n- Las siete fichas hospitalarias MINSAL del departamento se conservan como anclas. Otros objetos requieren señal institucional explícita y nombre y etiqueta hospitalarios para priorizarse; no basta un edificio hospitalario sin nombre.\n- No se acredita vigencia operativa ni atención de emergencias. Fuentes OSM comparten origen y carecen de corroboración institucional independiente.\n- Contención considera huecos. Distancia al límite mediante plano local equirectangular R=6371008.8 m; aproximación de cribado, no medición catastral. Umbral 100 m para registrar vecinos (evidencia insuficiente por sí sola), hasta 750 m con similitud de tokens >=0.5. Regla de posible representación MINSAL: nombre/alias >=0.5 y distancia <=1500 m, sin institución ISSS. No es fusión validada.\n- Se conservan geometrías exactamente como aparecen en cada GeoJSON. Las coordenadas de referencia OSM de polígonos son promedios del importador, no centroides, entradas ni puntos interiores garantizados.\n- Misma clave OSM entre HOT/Overpass agrupa registros fuente, no valida establecimiento. Geofabrik permanece separado por el error conocido que convierte relaciones en way. El número de objetos distintos puede sobreestimar alternativas por este error.\n- Varias geometrías pueden ser edificios de un recinto, versiones o sitios diferentes: no se deduplican por proximidad. CSV conserva evidencia y GeoJSON conserva propiedades originales.\n- Las fechas declaradas de Geofabrik (2026-10-05) y HOT (2026-10-07) están fijadas por el importador; sus archivos originales faltan. Overpass original declara 2026-10-09T14:44:37Z. MINSAL no documenta fecha de extracción.\n- Privados/veterinarios/unidades pequeñas se conservan con exclusión provisional cuando hay evidencia; registros de institución desconocida quedan pendientes. El registro de evaluación contiene también fichas no prioritarias y representaciones, que deben filtrarse por estado_alcance. No contiene todo el país: este permanece íntegro en data/.\n\n## Problemas para revisión posterior\n\n${establishments.filter(e=>e.row.estado_alcance==='pendiente_de_revision'&&e.row.institucion_propuesta!=='NO_DETERMINADA').map(e=>`- ${e.row.establecimiento_id}: ${e.row.nombre}; ${e.row.motivo_alcance}; ${e.row.estado_ubicacion}.`).join('\n')}\n\nRevisar especialmente Rosales (predios/alias), Bloom (anexo y edificio), Zacamil (relación vs way inferido), las unidades ISSS y diferencias municipales HOT/Overpass. Hospitales militares/policiales no se incorporan como MINSAL/ISSS por ser públicos.\n\n## Plan siguiente\n\nRevisar manualmente identidad, institución, alcance y función de cada geometría solo tras autorización de la siguiente etapa. Obtener límites confiables únicamente con permiso de descarga. Mantener validación operativa separada. No modificar el visor. Plan completo: PLAN_TRABAJO.md.\n\n## Trazabilidad\n\nScript: scripts/piloto_san_salvador_publicos.cjs. Ejecución: node scripts/piloto_san_salvador_publicos.cjs.\n\n${Object.entries(hashes).map(([p,h])=>`- ${p}: SHA256 ${h}`).join('\n')}\n`;
const rp=path.join(outDir,'reporte_piloto.md');if(fs.existsSync(rp)){const old=fs.readFileSync(rp,'utf8');const marker='<!-- REVISIONES_MANUALES -->';const i=old.indexOf(marker);if(i>=0)report+='\n'+old.slice(i);else report+='\n'+marker+'\n\n## Informe anterior conservado\n\n'+old;}else report+='\n<!-- REVISIONES_MANUALES -->\n\n## Revisiones manuales\n\nSin revisiones manuales realizadas.\n';fs.writeFileSync(rp,report);
for(const p of inputs)if(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')!==hashes[p])throw Error('Fuente modificada: '+p);
console.log(json(summary,null,2));
