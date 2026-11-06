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
  navigator: {},
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "dist", "setti-kettle-card.js"), "utf8"), sandbox);
const Card = defined["setti-kettle-card"];
assert(Card, "card defined");
assert(defined["setti-kettle-card-editor"], "editor defined");

const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
function makeHass({ lang = "en", unit = "°C", cur = 21, tgt = 100, on = false, changed = 30, keep = false, status = "standby",
                    keepTime = 0, tuyaLocal = false, counters = true, startTemp = null, helpers = false, history = null, mode = null } = {}) {
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
  if (helpers) {
    add("input_text.kettle_drink", "", {}, null, null);
    add("input_datetime.kettle_ready_at", "06:30:00", { hour: 6, minute: 30, has_date: false, has_time: true }, null, null);
    add("input_boolean.kettle_ready_at", "on", {}, null, null);
  }
  if (mode) add("select.czajnik_work_mode", mode[0], { options: mode }, "kettle_work_mode");
  return {
    states, entities, calls, language: lang, locale: { language: lang }, config: { unit_system: { temperature: unit } },
    callService: (d, s, data) => { calls.push([d, s, data]); return Promise.resolve(); },
    callWS: (msg) => Promise.resolve(history ? history(msg) : {}),
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

const clear = () => { for (const k of Object.keys(store)) delete store[k]; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  ok("drinks tab: tap sets the temperature and keep warm, remembers the drink, writes the helper", () => {
    clear();
    const h = makeHass({ helpers: true, keep: true });
    const c = card({ tab: "drinks", drinks: ["green_tea", "yerba", "formula"] }, h);
    assert(/data-act="drink" data-v="green_tea"/.test(c.shadowRoot.innerHTML));
    h.calls.length = 0;
    click(c, "drink", "green_tea");
    const calls = JSON.parse(JSON.stringify(h.calls));
    assert.deepStrictEqual(calls[0], ["number", "set_value", { entity_id: "number.czajnik_temperatura", value: 80 }]);
    assert.deepStrictEqual(calls[1], ["switch", "turn_off", { entity_id: "switch.czajnik_heat_preservation" }]);  // no keep warm for tea
    assert.strictEqual(calls[2][0], "input_text");
    assert.strictEqual(JSON.parse(calls[2][2].value).steep, 2.5);
    h.calls.length = 0;
    click(c, "drink", "yerba");
    assert.deepStrictEqual(JSON.parse(JSON.stringify(h.calls.slice(0, 3))), [
      ["number", "set_value", { entity_id: "number.czajnik_temperatura", value: 75 }],
      ["number", "set_value", { entity_id: "number.czajnik_heat_preservation_time", value: 30 }],
      ["switch", "turn_on", { entity_id: "switch.czajnik_heat_preservation" }],
    ]);
  });

  ok("drink temperature snapped to the range and step of the kettle, own drinks", () => {
    clear();
    const h = makeHass();
    h.states["number.czajnik_temperatura"].attributes = { min: 40, max: 90, step: 5 };
    const c = card({ drinks: ["honey", "coffee", { name: "Puer", temp: 97, steep: 3 }] }, h);
    assert.deepStrictEqual(Array.from(c._vm.drinks.map((d) => d.t)), [40, 90, 90]);
    assert.strictEqual(c._vm.drinks[2].name, "Puer");
  });

  ok("steeping countdown after the drink is ready", () => {
    clear();
    store["setti-kettle-card:drink:kettle1"] = JSON.stringify({ key: "green_tea", name: "Green tea", icon: "mdi:leaf", t: 80, steep: 2.5, at: Date.now() - 3 * 60000 });
    const c = card({}, makeHass({ on: false, changed: 1, cur: 80, tgt: 80 }));
    assert.strictEqual(c._vm.mode, "done");
    assert.strictEqual(c._vm.steeping, true);
    assert(/steeping – 1:[23]\d left/.test(c._vm.info), c._vm.info);
    assert(/Green tea · 80 °C/.test(c._vm.name));
    const c2 = card({}, makeHass({ on: false, changed: 3, cur: 79, tgt: 80 }));
    assert(/take the tea out/.test(c2._vm.info), c2._vm.info);
  });

  ok("formula: after boiling the card sets 45 °C and keep warm (no helper)", () => {
    clear();
    store["setti-kettle-card:drink:kettle1"] = JSON.stringify({ key: "formula", name: "Baby formula", icon: "mdi:baby-bottle-outline", t: 100, then: 45, keep: 120, at: Date.now() - 5 * 60000 });
    const h = makeHass({ on: false, changed: 0.5, cur: 99, tgt: 100 });
    const c = card({}, h);
    assert(/cooling down to 45 °C/.test(c._vm.info), c._vm.info);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(h.calls)), [
      ["number", "set_value", { entity_id: "number.czajnik_temperatura", value: 45 }],
      ["number", "set_value", { entity_id: "number.czajnik_heat_preservation_time", value: 120 }],
      ["switch", "turn_on", { entity_id: "switch.czajnik_heat_preservation" }],
    ]);
    c.hass = h;  // only once per boil
    assert.strictEqual(h.calls.length, 3);
  });

  ok("amount of water from the heating rate, low water warning", () => {
    clear();
    let c = card({ entities: { start_temp: "input_number.kettle_start" } }, makeHass({ on: true, changed: 1, cur: 61, startTemp: 21 }));
    assert(/about 0.7 l/.test(c._vm.info), c._vm.info);  // 2200 W · 0.9 · 60 / (4186 · 40)
    c = card({ entities: { start_temp: "input_number.kettle_start" } }, makeHass({ on: true, changed: 0.5, cur: 71, startTemp: 21 }));
    assert(/little water/.test(c._vm.info), c._vm.info);
    assert.strictEqual(c._vm.lowWater, true);
  });

  ok("ready at: shows the time and the estimated start, toggles the helper", () => {
    clear();
    const h = makeHass({ helpers: true, cur: 20 });
    const c = card({}, h);
    assert.strictEqual(c._vm.readyAt.on, true);
    assert(/0?6:30/.test(c._vm.readyAt.time), c._vm.readyAt.time);
    assert(/0?6:2[78]/.test(c._vm.readyAt.start), c._vm.readyAt.start);
    click(c, "ready_toggle");
    assert.deepStrictEqual(JSON.parse(JSON.stringify(h.calls.pop())), ["input_boolean", "toggle", { entity_id: "input_boolean.kettle_ready_at" }]);
  });

  ok("modes tab from the work mode select; a drink picks the work mode", () => {
    clear();
    const h = makeHass({ mode: ["temp_setting", "temp_boiling", "boiling_quick", "setting_quick"] });
    const c = card({ tab: "modes" }, h);
    assert(/data-act="mode" data-v="temp_boiling"/.test(c.shadowRoot.innerHTML));
    click(c, "drink", "formula");
    assert.deepStrictEqual(JSON.parse(JSON.stringify(h.calls[0])), ["select", "select_option", { entity_id: "select.czajnik_work_mode", option: "temp_boiling" }]);
  });

  ok("compact card and descaling interval from the water hardness", () => {
    clear();
    const c = card({ compact: true, water_hardness: "soft" }, makeHass());
    assert(/class="cbtn boil"/.test(c.shadowRoot.innerHTML));
    assert(!/data-act="target"/.test(c.shadowRoot.innerHTML));
    assert.strictEqual(c._vm.counters.find((x) => x.key === "descaling").every, 120);
  });

  {
    clear();
    const day = new Date(); day.setHours(0, 0, 0, 0);
    const s = (min) => (day.getTime() + min * 60000) / 1000;
    const history = (msg) => msg.entity_ids[0] === "switch.czajnik_start" && !msg.end_time ? { "switch.czajnik_start": [
      { s: "off", lu: s(0) }, { s: "on", lu: s(400) }, { s: "off", lu: s(402) }, { s: "on", lu: s(500) }, { s: "off", lu: s(501.5) }] } : {};
    const c = card({ price: 1.1 }, makeHass({ history }));
    await wait(20);
    assert.strictEqual(c._today.count, 2);
    assert(Math.abs(c._today.minutes - 3.5) < 0.01);
    assert(/today 0.13 kWh/.test(c._vm.stats), c._vm.stats);   // 2.2 kW · 3.5 min
    assert(/last /.test(c._vm.stats) && /1.5 min/.test(c._vm.stats), c._vm.stats);
    n++; console.log("ok  energy today and the last boil from the recorder");
  }

  {
    clear();
    const h = makeHass();
    const c = card({ drinks: ["black_tea"] }, h);
    c._drink(c._vm, "black_tea", true);
    await wait(450);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(h.calls.pop())), ["switch", "turn_on", { entity_id: "switch.czajnik_start" }]);
    n++; console.log("ok  hold a drink = set and boil");
  }

  console.log(`\n${n} tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
