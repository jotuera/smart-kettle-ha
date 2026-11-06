# Changelog

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
- **Ready at** a time – row on the card + blueprint `setti_kettle_ready_at.yaml` (start computed from the water
  temperature and the heating rate).
- **Blueprint `setti_kettle_ready.yaml`** – your actions when the water is ready and after steeping (notification,
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
