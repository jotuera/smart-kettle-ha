# Changelog

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
