// Kettles of other ecosystems, with the entities their Home Assistant integrations create:  node tests/test_brands.js
// Fellow Stagg EKG Pro (climate), Fellow EKG+ (water_heater on/off + number), Redmond SkyKettle (water_heater
// heat / boil / boil_heat), Xiaomi Kettle 2 Pro (xiaomi_miot: switch on + number + button stop), Smarter iKettle 3.0
// (switch boiling), Govee H7173 (govee2mqtt), tuya-local Fiesta (start button), AENO EK7S (keep-warm time entity),
// Kogan glass (climate, no target), a tuya-local fault binary sensor.
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
  document: { createElement: () => ({}) }, navigator: {},
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "dist", "smart-kettle-card.js"), "utf8"), sandbox);
const Card = defined["smart-kettle-card"];

const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
// rows: [entity_id, state, attributes, translation_key, platform]
function hassOf(rows, lang = "en", model = "Smart Kettle") {
  const states = {}, entities = {}, calls = [];
  for (const [id, state, attributes = {}, tk = null, platform = "x", lc = 30] of rows) {
    states[id] = { entity_id: id, state: String(state), attributes, last_changed: ago(lc) };
    entities[id] = { entity_id: id, device_id: "dev", translation_key: tk, platform };
  }
  return { states, entities, calls, devices: { dev: { model, name: model } }, language: lang, locale: { language: lang }, config: { unit_system: { temperature: "°C" } },
    callService: (d, s, data) => { calls.push([d, s, data]); return Promise.resolve(); }, callWS: () => Promise.resolve({}),
    formatEntityState: (s, v) => (v === undefined ? s.state : v) };
}
const card = (config, hass) => { const c = new Card(); c.setConfig(config); c.hass = hass; return c; };
const click = (c, act, v) => c._click({ target: { closest: () => ({ dataset: { act, v: v == null ? undefined : String(v) } }) } });
const calls = (h) => JSON.parse(JSON.stringify(h.calls));
let n = 0;
const ok = (name, fn) => { for (const k of Object.keys(store)) delete store[k]; fn(); n++; console.log("ok  " + name); };

ok("Fellow Stagg EKG Pro: climate heat / off, target, presets as modes, hold duration select", () => {
  const h = hassOf([
    ["climate.stagg_ekg_pro", "off", { hvac_modes: ["off", "heat"], current_temperature: 24, temperature: 93, min_temp: 40, max_temp: 100,
      target_temp_step: 0.5, preset_modes: ["none", "white_tea", "green_tea", "pour_over_coffee", "boil"], preset_mode: "none" }, null, "fellow_stagg"],
    ["select.stagg_ekg_pro_hold_duration", "Off", { options: ["Off", "15 min", "30 min", "45 min", "60 min"] }, "hold_duration", "fellow_stagg"],
    ["sensor.stagg_ekg_pro_eta", "unknown", {}, null, "fellow_stagg"],
  ]);
  const c = card({ profile: "fellow_stagg" }, h);
  assert.strictEqual(c._vm.ent.climate, "climate.stagg_ekg_pro");
  assert.strictEqual(c._vm.ent.keep_warm_time, "select.stagg_ekg_pro_hold_duration");
  assert.strictEqual(c._vm.tgt, 93);
  assert.strictEqual(c._vm.modeKind, "preset");
  assert.deepStrictEqual(Array.from(c._vm.modes.map((m) => m.o)), ["white_tea", "green_tea", "pour_over_coffee", "boil"]);
  click(c, "start");
  click(c, "target", 80);
  click(c, "mode", "green_tea");
  click(c, "keep_time", 30);
  click(c, "stop");
  assert.deepStrictEqual(calls(h), [
    ["climate", "set_hvac_mode", { entity_id: "climate.stagg_ekg_pro", hvac_mode: "heat" }],
    ["climate", "set_temperature", { entity_id: "climate.stagg_ekg_pro", temperature: 80 }],
    ["climate", "set_preset_mode", { entity_id: "climate.stagg_ekg_pro", preset_mode: "green_tea" }],
    ["select", "select_option", { entity_id: "select.stagg_ekg_pro_hold_duration", option: "30 min" }],
    ["climate", "set_hvac_mode", { entity_id: "climate.stagg_ekg_pro", hvac_mode: "off" }],
  ]);
});

ok("Fellow EKG Pro heating: hvac on, ETA from the kettle's own countdown", () => {
  const h = hassOf([
    ["climate.stagg", "heat", { current_temperature: 60, temperature: 93, min_temp: 40, max_temp: 100, hvac_action: "heating" }, null, "fellow_stagg", 1],
    ["sensor.stagg_eta", 0.75, { unit_of_measurement: "min" }, "eta", "fellow_stagg"],
  ]);
  const c = card({}, h);
  assert.strictEqual(c._vm.mode, "heat");
  assert(/45 s/.test(c._vm.info), c._vm.info);
});

ok("Fellow EKG+ (levi): water_heater on / off + target number", () => {
  const h = hassOf([
    ["water_heater.stagg_ekg", "off", { operation_list: ["off", "on"], current_temperature: 30 }, null, "fellow_stagg"],
    ["number.stagg_ekg_target_temperature", 96, { min: 40, max: 100, step: 1 }, null, "fellow_stagg"],
    ["sensor.stagg_ekg_current_temp", 30, { unit_of_measurement: "°C" }, null, "fellow_stagg"],
    ["switch.stagg_ekg_power", "off", {}, null, "fellow_stagg"],
  ]);
  const c = card({}, h);
  assert.strictEqual(c._vm.ent.target, "number.stagg_ekg_target_temperature");
  assert.strictEqual(c._vm.ent.start, "switch.stagg_ekg_power");
  click(c, "start");
  click(c, "target", 90);
  assert.deepStrictEqual(calls(h), [
    ["switch", "turn_on", { entity_id: "switch.stagg_ekg_power" }],
    ["number", "set_value", { entity_id: "number.stagg_ekg_target_temperature", value: 90 }],
  ]);
});

ok("Redmond SkyKettle: water_heater boil above 90 °C, heat below, modes heat / boil / boil_heat", () => {
  const rows = (tgt) => [["water_heater.skykettle_rk_g211s", "off", { operation_list: ["off", "heat", "boil", "boil_heat", "lamp"],
    operation_mode: "off", current_temperature: 22, temperature: tgt, min_temp: 25, max_temp: 100, target_temp_step: 5 }, null, "skykettle"]];
  let h = hassOf(rows(100));
  let c = card({}, h);
  assert.strictEqual(c._vm.modeKind, "operation");
  click(c, "start");
  h.calls.length && assert.deepStrictEqual(calls(h)[0], ["water_heater", "set_operation_mode", { entity_id: "water_heater.skykettle_rk_g211s", operation_mode: "boil" }]);
  h = hassOf(rows(70));
  c = card({}, h);
  click(c, "start");
  click(c, "mode", "boil_heat");
  click(c, "stop");
  assert.deepStrictEqual(calls(h), [
    ["water_heater", "set_operation_mode", { entity_id: "water_heater.skykettle_rk_g211s", operation_mode: "heat" }],
    ["water_heater", "set_operation_mode", { entity_id: "water_heater.skykettle_rk_g211s", operation_mode: "boil_heat" }],
    ["water_heater", "set_operation_mode", { entity_id: "water_heater.skykettle_rk_g211s", operation_mode: "off" }],
  ]);
});

ok("Xiaomi Kettle 2 Pro (xiaomi_miot): switch on, number target, keep warm switch / time / temperature, status words", () => {
  const p = "xiaomi_miot";
  const h = hassOf([
    ["switch.xiaomi_v20_ab12_on", "off", {}, null, p],
    ["number.xiaomi_v20_ab12_target_temperature", 85, { min: 40, max: 99, step: 1 }, null, p],
    ["sensor.xiaomi_v20_ab12_temperature", 25, { unit_of_measurement: "°C" }, null, p],
    ["sensor.xiaomi_v20_ab12_status", "Keep-Warm", {}, null, p],
    ["switch.xiaomi_v20_ab12_auto_keep_warm", "on", {}, null, p],
    ["number.xiaomi_v20_ab12_keep_warm_time", 60, { min: 60, max: 1440, step: 1 }, null, p],
    ["number.xiaomi_v20_ab12_keep_warm_temperature", 50, { min: 0, max: 100 }, null, p],
    ["button.xiaomi_v20_ab12_stop_work", "unknown", {}, null, p],
  ], "en", "xiaomi.kettle.v20");
  const c = card({ profile: "xiaomi_kettle_2_pro" }, h);
  const e = c._vm.ent;
  assert.strictEqual(e.start, "switch.xiaomi_v20_ab12_on");
  assert.strictEqual(e.target, "number.xiaomi_v20_ab12_target_temperature");
  assert.strictEqual(e.current, "sensor.xiaomi_v20_ab12_temperature");
  assert.strictEqual(e.keep_warm, "switch.xiaomi_v20_ab12_auto_keep_warm");
  assert.strictEqual(e.keep_warm_time, "number.xiaomi_v20_ab12_keep_warm_time");
  assert.strictEqual(e.keep_warm_temp, "number.xiaomi_v20_ab12_keep_warm_temperature");
  assert.strictEqual(c._vm.statusKind, "warm");
  assert.strictEqual(c._vm.mode, "warm");
  assert.strictEqual(c._vm.max, 99);
  assert.deepStrictEqual(Array.from(c._vm.presets).slice(-1), [99]);
});

ok("Smarter iKettle 3.0: switch boiling, boil temperature, water temperature, keep warm minutes", () => {
  const p = "smarter";
  const h = hassOf([
    ["switch.ikettle_boiling", "off", {}, null, p],
    ["number.ikettle_boil_temperature", 100, { min: 0, max: 100 }, null, p],
    ["sensor.ikettle_water_temperature", 18, { unit_of_measurement: "°C" }, null, p],
    ["sensor.ikettle_target_temperature", 100, { unit_of_measurement: "°C" }, null, p],
    ["number.ikettle_keep_warm_time", 0, { min: 0, max: 40 }, null, p],
    ["sensor.ikettle_state", "Ready", {}, null, p],
  ]);
  const c = card({ profile: "smarter_ikettle" }, h);
  const e = c._vm.ent;
  assert.strictEqual(e.start, "switch.ikettle_boiling");
  assert.strictEqual(e.target, "number.ikettle_boil_temperature");
  assert.strictEqual(e.current, "sensor.ikettle_water_temperature");
  assert.strictEqual(e.keep_warm_time, "number.ikettle_keep_warm_time");
  assert.strictEqual(c._vm.statusKind, "idle");
  assert.deepStrictEqual(Array.from(c._vm.keepTimes), [10, 20, 30, 40]);
});

ok("Govee H7173 (govee2mqtt): power switch, temperature number and sensor, work mode select", () => {
  const p = "mqtt";
  const h = hassOf([
    ["switch.govee_kettle_powerswitch", "off", {}, null, p],
    ["number.govee_kettle_temperaturesetting", 90, { min: 40, max: 100 }, null, p],
    ["sensor.govee_kettle_temperature", 21, { unit_of_measurement: "°C" }, null, p],
    ["select.govee_kettle_mode", "DIY", { options: ["DIY", "Boiling", "Tea", "Coffee"] }, null, p],
  ]);
  const c = card({}, h);
  assert.strictEqual(c._vm.ent.start, "switch.govee_kettle_powerswitch");
  assert.strictEqual(c._vm.ent.target, "number.govee_kettle_temperaturesetting");
  assert.strictEqual(c._vm.modeKind, "select");
});

ok("tuya-local Fiesta: water_heater without modes + Start button; heating from the status", () => {
  const p = "tuya_local";
  const h = hassOf([
    ["water_heater.fiesta_kettle", "unknown", { current_temperature: 55, temperature: 100, min_temp: 0, max_temp: 100 }, "kettle", p],
    ["button.fiesta_kettle_start", "unknown", {}, null, p],
    ["sensor.fiesta_kettle_status", "heating", {}, "status", p, 1],
    ["switch.fiesta_kettle_keep_warm", "off", {}, null, p],
    ["number.fiesta_kettle_keep_warm_time", 0, { min: 0, max: 360 }, "timer", p],
  ]);
  const c = card({}, h);
  assert.strictEqual(c._vm.ent.start_button, "button.fiesta_kettle_start");
  assert.strictEqual(c._vm.mode, "heat");
  click(c, "start");
  assert.deepStrictEqual(calls(h)[0], ["button", "press", { entity_id: "button.fiesta_kettle_start" }]);
});

ok("AENO EK7S (tuya-local): keep-warm time as a time entity, work-mode select", () => {
  const p = "tuya_local";
  const h = hassOf([
    ["water_heater.aeno_kettle", "off", { operation_list: ["off", "electric"], current_temperature: 20, temperature: 80, min_temp: 40, max_temp: 100 }, "kettle", p],
    ["switch.aeno_kettle_keep_warm", "off", {}, null, p],
    ["time.aeno_kettle_keep_warm_time", "01:00:00", {}, null, p],
    ["select.aeno_kettle_mode", "heat", { options: ["quick_heat", "quick_boil", "heat", "boil"] }, "kettle_mode", p],
  ]);
  const c = card({ profile: "aeno_ek7s", keep_warm_times: [30, 120] }, h);
  assert.strictEqual(c._vm.keepTime, 60);
  click(c, "keep_time", 120);
  click(c, "start");
  assert.deepStrictEqual(calls(h), [
    ["time", "set_value", { entity_id: "time.aeno_kettle_keep_warm_time", time: "02:00:00" }],
    ["water_heater", "set_operation_mode", { entity_id: "water_heater.aeno_kettle", operation_mode: "electric" }],
  ]);
});

ok("Kogan glass (tuya-local climate, no target): boil only, presets hidden", () => {
  const h = hassOf([["climate.kogan_glass_kettle", "off", { hvac_modes: ["off", "heat"], current_temperature: 23 }, null, "tuya_local"]]);
  const c = card({}, h);
  assert.strictEqual(c._vm.tgtEntity, null);
  assert(!/data-act="target"/.test(c.shadowRoot.innerHTML));
  click(c, "start");
  assert.deepStrictEqual(calls(h)[0], ["climate", "set_hvac_mode", { entity_id: "climate.kogan_glass_kettle", hvac_mode: "heat" }]);
});

ok("fault binary sensor (tuya-local): red tile with the fault description", () => {
  const p = "tuya_local";
  const h = hassOf([
    ["water_heater.gj_kettle", "off", { operation_list: ["off", "electric"], current_temperature: 20, temperature: 100 }, "kettle", p],
    ["binary_sensor.gj_kettle_problem", "on", { device_class: "problem", description: "dry_heating" }, null, p],
  ]);
  const c = card({}, h);
  assert.strictEqual(c._vm.mode, "fault");
  assert(/Dry heating/.test(c._vm.info), c._vm.info);
});

ok("unknown words are shown as they are, reserve_* hidden", () => {
  const h = hassOf([
    ["switch.k_start", "off", {}, "start", "tuya"], ["sensor.k_current_temperature", 20, { unit_of_measurement: "°C" }, "current_temperature", "tuya"],
    ["number.k_temperature", 100, { min: 0, max: 100 }, "temperature", "tuya"], ["sensor.k_status", "reserve_2", {}, "status", "tuya"],
  ]);
  assert.strictEqual(card({}, h)._vm.statusText, "");
});

console.log(`\n${n} brand tests passed`);
