// Prints the roles the card finds for every device of tests/fixtures_kettles.json (used by tests/test_roles.py).
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const defined = {};
const sandbox = {
  console: { info() {}, log() {} }, Date, Math, JSON, Object, Array, String, Number, isNaN, parseFloat, Promise, setTimeout, clearTimeout,
  setInterval: () => 0, clearInterval() {}, navigator: {},
  HTMLElement: class { attachShadow() { this.shadowRoot = { innerHTML: "", addEventListener() {} }; return this.shadowRoot; } },
  CustomEvent: class {}, customElements: { define: (n, c) => { defined[n] = c; } },
  localStorage: { getItem: () => null, setItem() {} }, document: { createElement: () => ({}) },
};
sandbox.window = sandbox;
vm.createContext(sandbox);
const src = fs.readFileSync(path.join(__dirname, "..", "dist", "smart-kettle-card.js"), "utf8");
vm.runInContext(src + "\n;globalThis.__findKettle = findKettle;", sandbox);

const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures_kettles.json"), "utf8"));
const out = {};
for (const [name, fx] of Object.entries(fixtures)) {
  const states = {}, entities = {};
  for (const [id, tk, platform] of fx.entities) {
    states[id] = { entity_id: id, state: "off", attributes: id.endsWith("_problem") ? { device_class: "problem" } : {} };
    entities[id] = { entity_id: id, device_id: "dev", translation_key: tk, platform };
  }
  const hass = { states, entities, devices: { dev: { model: fx.device, name: fx.device } } };
  const auto = sandbox.__findKettle(hass, {});
  const forced = sandbox.__findKettle(hass, { device: "dev" });
  const roles = {};
  for (const [k, v] of Object.entries(forced.ent)) if (!k.startsWith("s_") && !["start_temp", "drink", "ready_at", "ready_at_on"].includes(k)) roles[k] = v;
  out[name] = { kettle: auto.device === "dev", roles };
}
process.stdout.write(JSON.stringify(out));
