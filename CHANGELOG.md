# Changelog

## 0.4.0 – 2026-11-07

- **Kettles worldwide** – besides Tuya, the card and the integration now work with the kettles of **Xiaomi / Mijia**
  (xiaomi_miot, mi_kettle_pro), **Fellow Stagg EKG Pro / EKG+**, **Redmond SkyKettle**, **Smarter iKettle 3.0** and
  **Govee** (govee2mqtt), and with every tuya-local kettle layout: kettles started by a `climate` (heat / off, presets
  as the *Modes* tab), by a `button` (Start / Stop), by a `water_heater` with any heating mode (electric, on, boil,
  heat, boil_heat), keep-warm time as a number, `time` entity or select, a separate keep-warm temperature (used for
  the formula's second step), a fault binary sensor (red tile) and the kettle's own countdown.
- Devices are recognised by their model too (e.g. `xiaomi.kettle.v20`); status words of all integrations translated.
- **14 new profiles** – Blaupunkt BKW825, Statesman / DMD (UK), UK 3 kW, Kogan glass (AU / NZ), Anko (Kmart), Homend,
  tea-mode kettles, US gooseneck (°F), Xiaomi 2 Pro, Mi Kettle Pro, Fellow Stagg, SkyKettle, Smarter, Govee.
- [docs/models.md](docs/models.md) – ecosystems and ~30 Tuya kettles by region.
- The entity rules live in `custom_components/smart_kettle/roles.py`; `tests/test_roles.py` checks that the card and
  the integration find the same entities and profiles for 14 kettles; `tests/test_brands.js` – 12 brand tests.

## 0.3.0 – 2026-11-07

- **New name: Smart Kettle** – the project works with any Tuya / Smart Life kettle, not only SETTI+. Repository
  `smart-kettle-ha`, integration `smart_kettle`, card `custom:smart-kettle-card` (was `custom:setti-kettle-card`),
  blueprints and package `smart_kettle_*`, theme variables `--kettle-*` (were `--setti-*`).
- **Smart Kettle integration** (`custom_components/smart_kettle`, HACS type *Integration*) – install in three clicks:
  HACS → restart → *Add integration* (the kettle is found by itself). It serves the card (no Lovelace resource) and
  adds its entities to the kettle's own device: boil counters with *Cleaned* / *Descaled* buttons and *due* binary
  sensors, learned heating rate, water in the last boil, energy and cost today, last boil, a *Drink* select,
  *Ready at* time + switch. In Home Assistant, without a browser: boil counting, the drinks' second stage
  (formula), notifications when the water is ready and after steeping, *ready at*. Options: profile, power,
  price, intervals, boil threshold, notification targets. Works on top of Tuya / tuya-local / LocalTuya, no local
  key. Translations in 9 languages (drink names shared with the card).
- **Card 0.3.0** uses the integration's entities when they are there (counters reset with its buttons, its rate,
  energy, drink select and *ready at*); without the integration it works as before.
- `tools/build_integration.py` copies the card into the integration and builds its translations; CI checks it and
  runs hassfest. 24 card tests.

## 0.2.0 – 2026-11-07

- **Drinks** – a *Drinks* tab next to the temperatures: 12 drinks (green / white / black tea, matcha, oolong, coffee,
  yerba mate, herbal tea, baby formula, honey water, porridge, warm water) with their temperature, keep warm and
  steeping time, snapped to what the kettle can set; own drinks in the config. Baby formula: boil, then 45 °C and
  keep warm (two steps).
- **Hold = set and boil** on every temperature and drink tile.
- **Steeping countdown** in the top tile after the drink is ready (*steeping – 1:25 left* → *take the tea out*).
- **Amount of water** from the heating rate and the kettle's power, *little water?* warning.
- **Energy and cost today**, the last boil – from the recorder, estimated from the power or from a plug's kWh meter
  (`energy_entity`); price fixed or from an entity.
- **Ready at** a time – row on the card + blueprint `smart_kettle_ready_at.yaml` (start computed from the water
  temperature and the heating rate).
- **Blueprint `smart_kettle_ready.yaml`** – your actions when the water is ready and after steeping (notification,
  TTS), the formula's second step without a browser; helper `input_text.kettle_drink`.
- **Modes tab** for kettles with a mode select (tea modes in tuya-local, *Work mode* in core Tuya); a drink picks the
  kettle's work mode when it has one.
- **Compact card** (`compact: true`), **descaling interval from the water hardness** (`water_hardness`).
- Profiles carry the kettle's power; editor sections *Drinks* and *Energy and cost*; 9 languages updated (111 texts).
- Tests: 22 (drinks, steeping, formula, water, energy, ready-at, modes, compact, hold).

## 0.1.0 – 2026-11-06

First version – the author's button-card kettle dashboard rewritten as one JavaScript card, no other custom cards
needed.

- **Finds the kettle by itself**: core Tuya entities by their translation keys (works whatever the entity ids and
  the HA language), tuya-local by its `water_heater`; every entity can be set by hand (LocalTuya).
- **Top tile**: progress from the start temperature (read from the recorder, no helper) to the target, ETA from the
  live heating rate, *boiled* / *ready* for 3 minutes, keep warm, offline, no water.
- **Learns the heating rate** of your kettle after each boil (stored in the browser) for the ETA before heating.
- Temperature presets, Boil / Stop, keep warm with time chips, boil counters (hold to reset after cleaning /
  descaling) – presets and chips clamped to what the kettle accepts, °F kettles supported.
- **Profiles** of 11 kettles / families (presets and keep-warm times of the kettle's own buttons).
- **9 languages**: English, Polski, Deutsch, Čeština, Slovenčina, Français, Italiano, Español, Nederlands.
- Visual editor, blueprint counting the boils, package with the counter helpers.
- Tests: `node tests/test_card.js` (mocked HA), `tests/preview.html` (all modes in a browser), CI.
