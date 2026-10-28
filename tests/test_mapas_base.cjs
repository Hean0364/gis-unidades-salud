const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "js/mapas_base.js"), "utf8");

function setup(protocol, fetchImpl = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) })) {
  const notices = new Set();
  const context = {
    window: { location: { protocol } },
    fetch: fetchImpl,
    L: {
      tileLayer(url, options) {
        return Object.assign(new EventEmitter(), { url, options });
      },
      control() {
        return {
          addTo() {
            this.element = this.onAdd();
            notices.add(this);
          },
          remove() { notices.delete(this); }
        };
      },
      DomUtil: {
        create() { return { setAttribute() {} }; }
      },
      DomEvent: {
        disableClickPropagation() {},
        disableScrollPropagation() {}
      }
    }
  };
  vm.runInNewContext(source, context);
  return { config: context.window.MAP_BASES, notices };
}

test("file:// starts on satellite and disables only the OSM radio", () => {
  const { config, notices } = setup("file:");
  assert.equal(config.initialId, "satellite");
  const radio = {};
  config.configureRadio(radio, "osm");
  assert.equal(radio.disabled, true);
  assert.match(radio.title, /abrir_mapas\.cmd/);
  const satellite = {};
  config.configureRadio(satellite, "satellite");
  assert.equal(satellite.disabled, undefined);
  config.watchOsm({ hasLayer: () => false }, config.createOsm(), () => assert.fail());
  assert.match([...notices][0].element.textContent, /Archivo local/);
});

for (const protocol of ["http:", "https:"]) {
  test(`${protocol} enables OSM with the official URL and browser Referer policy`, () => {
    const { config, notices } = setup(protocol);
    assert.equal(config.initialId, "osm");
    const radio = {};
    config.configureRadio(radio, "osm");
    assert.equal(radio.disabled, undefined);
    const layer = config.createOsm();
    assert.equal(layer.url, "https://tile.openstreetmap.org/{z}/{x}/{y}.png");
    assert.equal(layer.options.referrerPolicy, "strict-origin-when-cross-origin");
    assert.equal(layer.options.updateWhenZooming, false);
    assert.equal(layer.options.updateWhenIdle, true);
    assert.match(layer.options.attribution, /openstreetmap\.org\/copyright/);
    config.watchOsm({ hasLayer: () => true }, layer, () => assert.fail());
    assert.equal(notices.size, 0);
  });
}

test("satellite overzooms level 18 imagery instead of requesting missing level 19 tiles", () => {
  const { config } = setup("http:");
  const layer = config.createSatellite();
  assert.equal(layer.url, "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}");
  assert.equal(layer.options.maxNativeZoom, 18);
  assert.equal(layer.options.maxZoom, 19);
  assert.equal(layer.options.updateWhenZooming, false);
  assert.match(layer.options.attribution, /Esri/);
});

test("every viewer uses the shared satellite detail limit", () => {
  for (const file of ["app.js", "app_departamento.js", "app_san_salvador.js", "app_todos_departamentos.js"]) {
    const app = fs.readFileSync(path.join(root, "js", file), "utf8");
    assert.match(app, /MAP_BASES\.createSatellite\(\)/, file);
    assert.doesNotMatch(app, /World_Imagery\/MapServer\/tile/, file);
  }
});

test("an OSM tile error switches once to satellite and preserves vector layers", async () => {
  const { config, notices } = setup("http:");
  const osm = config.createOsm();
  const satellite = {};
  const facilities = {};
  const boundary = {};
  const layers = new Set([osm, facilities, boundary]);
  let switches = 0;
  config.watchOsm({ hasLayer: (layer) => layers.has(layer) }, osm, () => {
    switches += 1;
    layers.delete(osm);
    layers.add(satellite);
  });
  osm.emit("tileerror");
  osm.emit("tileerror");
  osm.emit("load");
  assert.equal(switches, 1);
  assert.deepEqual([...layers], [facilities, boundary, satellite]);
  assert.equal(notices.size, 1);
  assert.match([...notices][0].element.textContent, /Se cambió a Satélite/);
  layers.add(osm);
  osm.emit("add");
  osm.emit("tileload", { tile: { src: "https://tile.openstreetmap.org/9/129/236.png" } });
  await new Promise(setImmediate);
  assert.equal(notices.size, 0);
});

test("a valid PNG returned with HTTP 403 also triggers fallback", async () => {
  const requests = [];
  const { config, notices } = setup("http:", async (url, options) => {
    requests.push({ url, options });
    return { ok: false, status: 403, arrayBuffer: async () => new ArrayBuffer(0) };
  });
  const osm = config.createOsm();
  let active = true;
  let switches = 0;
  config.watchOsm({ hasLayer: () => active }, osm, () => {
    switches += 1;
    active = false;
  });
  const tile = { src: "https://tile.openstreetmap.org/9/129/236.png" };
  osm.emit("tileload", { tile });
  osm.emit("tileload", { tile });
  await new Promise(setImmediate);
  assert.equal(switches, 1);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, tile.src);
  assert.equal(requests[0].options.cache, undefined);
  assert.match([...notices][0].element.textContent, /Se cambió a Satélite/);
});

test("a previous activation's HTTP check cannot override a new selection", async () => {
  let finishRequest;
  const { config, notices } = setup("http:", () => new Promise((resolve) => { finishRequest = resolve; }));
  const osm = config.createOsm();
  config.watchOsm({ hasLayer: () => true }, osm, () => assert.fail());
  osm.emit("tileload", { tile: { src: "https://tile.openstreetmap.org/9/129/236.png" } });
  osm.emit("remove");
  osm.emit("add");
  finishRequest({ ok: false, arrayBuffer: async () => new ArrayBuffer(0) });
  await new Promise(setImmediate);
  assert.equal(notices.size, 0);
});

test("late OSM errors do not override a user's different base selection", () => {
  const { config, notices } = setup("http:");
  const osm = config.createOsm();
  config.watchOsm({ hasLayer: () => false }, osm, () => assert.fail());
  osm.emit("tileerror");
  assert.equal(notices.size, 0);
});

test("every map loads the shared configuration before its app", () => {
  const pages = ["index.html", "index_san_salvador.html", "index_san_salvador_sin_publicas.html"];
  const departmentRoot = path.join(root, "data/por_departamento");
  pages.push("data/por_departamento/index.html");
  for (const entry of fs.readdirSync(departmentRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && fs.existsSync(path.join(departmentRoot, entry.name, "index.html"))) {
      pages.push(`data/por_departamento/${entry.name}/index.html`);
    }
  }
  assert.equal(pages.length, 17);
  for (const relativePath of pages) {
    const pagePath = path.join(root, relativePath);
    const html = fs.readFileSync(pagePath, "utf8");
    const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((match) => match[1]);
    const configIndex = scripts.findIndex((src) => src.endsWith("/mapas_base.js"));
    const appIndex = scripts.findIndex((src) => /\/app[^/]*\.js$/.test(src));
    assert.ok(configIndex > 0 && configIndex < appIndex, relativePath);
    assert.equal(path.resolve(path.dirname(pagePath), scripts[configIndex]), path.join(root, "js/mapas_base.js"));
  }
});
