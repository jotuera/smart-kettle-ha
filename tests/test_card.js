// Node test of the card logic with a mocked Home Assistant (no browser):  node tests/test_card.js
// Covers: discovery of core Tuya entities by translation key, the tuya-local water_heater adapter,
// the top tile modes, presets clamped to the kettle, °F, counters, service calls of the buttons, all languages.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const defined = {};
const store = {};
const sandbox = {
  console: { info() {}, log: console.log }, Date, Math, JSON, Object, Array, String, Number, isNaN, parseFloat, Promise, setTimeout, clearTimeout,
  setInterval: () => 0, clearInterval() {},
  HTMLElement: class { dispatchEvent() {} attachShadow() { this.shadowRoot = { innerHTML: "", addEventListener() {} }; return this.shadowRoot; } },
  CustomEvent: class { constructor(n, o) { this.type = n; Object.assign(this, o); } },
  customElements: { define: (n, c) => { defined[n] = c; } },
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
  document: { createElement: () => ({}) },
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "dist", "setti-kettle-card.js"), "utf8"), sandbox);
const Card = defined["setti-kettle-card"];
assert(Card, "card defined");
assert(defined["setti-kettle-card-editor"], "editor defined");

const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
function makeHass({ lang = "en", unit = "°C", cur = 21, tgt = 100, on = false, changed = 30, keep = false, status = "standby",
                    keepTime = 0, tuyaLocal = false, counters = true, startTemp = null } = {}) {
  const states = {}, entities = {}, calls = [];
  const add = (id, state, attributes = {}, tk = null, device = "kettle1", lc = 60) => {
    states[id] = { entity_id: id, state: String(state), attributes, last_changed: ago(lc) };
    entities[id] = { entity_id: id, device_id: device, translation_key: tk, platform: tuyaLocal ? "tuya_local" : "tuya" };
  };
  if (tuyaLocal) {
    add("water_heater.kettle", on ? "electric" : "off", { current_temperature: cur, temperature: tgt, min_temp: 40, max_temp: 100,
      operation_list: ["off", "electric"], temperature_unit: unit }, "kettle", "kettle1", changed);
    add("switch.kettle_keep_warm", keep ? "on" : "off", {}, null);
    add("number.kettle_keep_warm_time", keepTime, { min: 0, max: 360, step: 1 }, null);
    add("sensor.kettle_status", status, {}, "status");
  } else {
    add("switch.czajnik_start", on ? "on" : "off", {}, "start", "kettle1", changed);
    add("number.czajnik_temperatura", tgt, unit === "°C" ? { min: 0, max: 100, step: 1 } : { min: 32, max: 212, step: 1 }, "temperature");
    add("sensor.czajnik_current_temperature", cur, { unit_of_measurement: unit, state_class: "measurement" }, "current_temperature");
    add("sensor.czajnik_status", status, { options: ["standby", "heating", "cooling", "warm"] }, "status");
    add("switch.czajnik_heat_preservation", keep ? "on" : "off", {}, "heat_preservation");
    add("number.czajnik_heat_preservation_time", keepTime, { min: 0, max: 120, step: 1 }, "heat_preservation_time");
  }
  // an unrelated device with a Start switch must not be taken
  add("switch.washer_start", "off", {}, "start", "washer");
  if (counters) {
    add("counter.kettle_boils_today", 3, {}, null, null);
    add("counter.kettle_boils_since_cleaning", 25, {}, null, null);
    add("counter.kettle_boils_since_descaling", 12, {}, null, null);
  }
  if (startTemp !== null) add("input_number.kettle_start", startTemp, {}, null, null);
  return {
    states, entities, calls, language: lang, locale: { language: lang }, config: { unit_system: { temperature: unit } },
    callService: (d, s, data) => { calls.push([d, s, data]); return Promise.resolve(); },
    callWS: () => Promise.resolve({}),
    formatEntityState: (s) => s.state,
  };
}
function card(config, hass) {
  const c = new Card();
  c.setConfig(config);
  c.hass = hass;
  return c;
}
const click = (c, act, v, id) => c._click({ target: { closest: () => ({ dataset: { act, v: v == null ? undefined : String(v), id } }) } });
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log("ok  " + name); };

ok("core Tuya: entities found by translation key on the kettle device", () => {
  const c = card({}, makeHass());
  const e = c._vm.ent;
  assert.strictEqual(e.start, "switch.czajnik_start");
  assert.strictEqual(e.target, "number.czajnik_temperatura");
  assert.strictEqual(e.current, "sensor.czajnik_current_temperature");
  assert.strictEqual(e.keep_warm, "switch.czajnik_heat_preservation");
  assert.strictEqual(e.keep_warm_time, "number.czajnik_heat_preservation_time");
  assert.strictEqual(c._vm.mode, "idle");
  assert(/to 100 °C in about 2 min/.test(c._vm.info), c._vm.info);
});

ok("idle: presets from the profile, active preset, counters with thresholds", () => {
  const c = card({ profile: "gotze_jensen_kt975k" }, makeHass({ tgt: 80 }));
  assert.deepStrictEqual(Array.from(c._vm.presets), [40, 55, 80, 90, 100]);
  assert(/class="tile preset active" data-act="target" data-v="80"/.test(c.shadowRoot.innerHTML));
  const cl = c._vm.counters.find((x) => x.key === "cleaning");
  assert.strictEqual(cl.due, true);
  assert.strictEqual(c._vm.counters.find((x) => x.key === "descaling").due, false);
});

ok("heating: progress from the start temperature, ETA from the live rate", () => {
  const c = card({ entities: { start_temp: "input_number.kettle_start" } }, makeHass({ on: true, changed: 1, cur: 61, startTemp: 21, status: "heating" }));
  assert.strictEqual(c._vm.mode, "heat");
  assert.strictEqual(c._vm.pct, 51); // (61-21)/(100-21)
  assert(/40 °C\/min/.test(c._vm.info), c._vm.info);
  assert(/Boiling to 100 °C/.test(c._vm.name));
});

ok("heating below 100: 'Heating to'", () => {
  const c = card({}, makeHass({ on: true, tgt: 80, cur: 50, changed: 0.5 }));
  assert(/Heating to 80 °C/.test(c._vm.name), c._vm.name);
});

ok("just boiled, then keep warm", () => {
  let c = card({}, makeHass({ on: false, changed: 1, cur: 99 }));
  assert.strictEqual(c._vm.mode, "done");
  c = card({}, makeHass({ on: false, changed: 10, cur: 78, tgt: 80, keep: true, status: "warm", keepTime: 60 }));
  assert.strictEqual(c._vm.mode, "warm");
  assert(/60 min/.test(c._vm.info));
});

ok("unavailable kettle", () => {
  const h = makeHass();
  h.states["sensor.czajnik_current_temperature"].state = "unavailable";
  h.states["switch.czajnik_start"].state = "unavailable";
  assert.strictEqual(card({}, h)._vm.mode, "off");
});

ok("buttons call the right services", () => {
  const h = makeHass({ keep: true });
  const c = card({}, h);
  click(c, "target", 85);
  click(c, "start");
  click(c, "stop");
  click(c, "keep_time", 120);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(h.calls)), [
    ["number", "set_value", { entity_id: "number.czajnik_temperatura", value: 85 }],
    ["switch", "turn_on", { entity_id: "switch.czajnik_start" }],
    ["switch", "turn_off", { entity_id: ["switch.czajnik_start", "switch.czajnik_heat_preservation"] }],
    ["number", "set_value", { entity_id: "number.czajnik_heat_preservation_time", value: 120 }],
  ]);
});

ok("keep-warm chips clamped to the kettle's maximum", () => {
  const c = card({ keep_warm_times: "30, 60, 120, 240" }, makeHass());
  assert.deepStrictEqual(Array.from(c._vm.keepTimes), [30, 60, 120]);
});

ok("tuya-local water_heater adapter", () => {
  const h = makeHass({ tuyaLocal: true, cur: 30, tgt: 90 });
  const c = card({}, h);
  assert.strictEqual(c._vm.ent.water_heater, "water_heater.kettle");
  assert.strictEqual(c._vm.ent.keep_warm, "switch.kettle_keep_warm");
  assert.strictEqual(c._vm.ent.keep_warm_time, "number.kettle_keep_warm_time");
  assert.strictEqual(c._vm.tgt, 90);
  click(c, "target", 70);
  click(c, "start");
  click(c, "stop");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(h.calls.slice(0, 3))), [
    ["water_heater", "set_temperature", { entity_id: "water_heater.kettle", temperature: 70 }],
    ["water_heater", "set_operation_mode", { entity_id: "water_heater.kettle", operation_mode: "electric" }],
    ["water_heater", "set_operation_mode", { entity_id: "water_heater.kettle", operation_mode: "off" }],
  ]);
});

ok("°F kettle: presets converted, boiling at 212 °F", () => {
  const c = card({}, makeHass({ unit: "°F", cur: 70, tgt: 212 }));
  assert.deepStrictEqual(Array.from(c._vm.presets), [105, 130, 160, 185, 212]);
  assert.strictEqual(c._vm.boil, 212);
});

ok("no kettle -> hint instead of an error", () => {
  const h = makeHass();
  for (const id of Object.keys(h.entities)) if (id.startsWith("switch.czajnik") || id.startsWith("sensor.czajnik")) h.entities[id].device_id = null;
  h.entities["switch.washer_start"].translation_key = "other";
  const c = card({}, h);
  assert(/No kettle found/.test(c.shadowRoot.innerHTML));
});

ok("every language renders every state", () => {
  for (const lang of ["en", "pl", "de", "cs", "sk", "fr", "it", "es", "nl"]) {
    for (const o of [{}, { on: true, changed: 1, cur: 50 }, { changed: 1, cur: 99 }, { keep: true, status: "warm" }]) {
      const c = card({}, makeHass(Object.assign({ lang }, o)));
      assert(!/\{[a-z]+\}/.test(c.shadowRoot.innerHTML), lang + " left a placeholder");
    }
  }
  assert(/Gotowanie do 100 °C/.test(card({}, makeHass({ lang: "pl", on: true, changed: 1, cur: 50 }))._vm.name));
});

console.log(`\n${n} tests passed`);
