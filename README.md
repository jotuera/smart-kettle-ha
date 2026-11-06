# SETTI+ Kettle Card

**English** · [Polski](README.pl.md)

[![CI](https://github.com/jotuera/setti-kettle-card/actions/workflows/ci.yml/badge.svg)](https://github.com/jotuera/setti-kettle-card/actions/workflows/ci.yml)
[![HACS](https://img.shields.io/badge/HACS-custom-41BDF5)](https://hacs.xyz)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2024.8%2B-41BDF5?logo=homeassistant&logoColor=white)](https://www.home-assistant.io)
[![Languages](https://img.shields.io/badge/languages-9-8A2BE2)](i18n)
[![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial-blue)](LICENSE)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-jotuera-FFDD00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/jotuera)

**A Lovelace card for Tuya / Smart Life Wi-Fi kettles – SETTI+ KT950W, Götze & Jensen KT975K and others.** In Home
Assistant a smart kettle is a switch, a number and a temperature sensor. This card turns them into a kettle: how far it
is to the target and how long it will take, one-tap temperatures, Boil / Stop, keep warm with its time, and boil
counters that tell you when to clean and descale. One JavaScript file, no other custom cards, no YAML templates.

> Built on the author's **Götze & Jensen KT975K** (Tuya core integration), from a button-card dashboard used since
> September 2026. The **SETTI+ KT950W** has the same entities in HA. Other kettles: [docs/models.md](docs/models.md).
>
> **Status: beta (0.1.0).** Tested on one kettle; logic covered by tests with a mocked HA.

<img src="docs/img/cards-en.png" width="700" alt="Kettle card: ready, boiling, boiled, keeping warm">

<sub>The four states of the top tile: ready (ETA to the target), boiling (progress from the start temperature, ETA from
the live rate), boiled, keeping warm. Counters turn red when cleaning / descaling is due.</sub>

## What it does

| Part | What you get |
|---|---|
| **Top tile** | *Kettle ready – to 100 °C in about 2 min* → *Boiling to 100 °C – about 55 s left · 41 °C/min* with a progress bar → *Boiled · 100 °C – ready 30 s ago* (3 min) → *Keeping warm · 80 °C*. Also *unavailable* and *no water*. Tap = history. |
| **Presets** | One tap sets the target temperature; the current one glows. From the kettle's profile, clamped to its range. |
| **Boil / Stop** | Boil starts the kettle (*Target 100 °C · now 21 °C · standby*). Stop switches off heating **and** keep warm. |
| **Keep warm** | Switch and time chips (30 min, 1 h, 2 h …), limited to the kettle's maximum. |
| **Counters** | Boils today, since cleaning (every 20), since descaling (every 60) – **hold** to reset. Optional. |

- **Finds the kettle by itself** – core Tuya entities by their translation keys, so it does not matter what the
  entities are called or which language HA uses (`_temperatura`, `_temperature`, `_temperatur` …). tuya-local
  kettles by their `water_heater`. Every entity can be set by hand (LocalTuya).
- **Progress without helpers** – the water temperature at the moment you pressed Boil is read from the recorder.
- **Learns your kettle** – after each boil the card stores the measured heating rate (°C/min) in the browser and
  uses it for the ETA before heating starts.
- **°F kettles**, **9 languages** (English, Polski, Deutsch, Čeština, Slovenčina, Français, Italiano, Español,
  Nederlands – the language of your HA profile), visual editor, theme colours you can override.

## Installation

**HACS** (custom repository): HACS → ⋮ → *Custom repositories* → `https://github.com/jotuera/setti-kettle-card`,
type *Dashboard* → install *SETTI+ Kettle Card* → reload the browser.

**Manual:** copy `dist/setti-kettle-card.js` to `/config/www/`, then Settings → Dashboards → ⋮ → *Resources* →
add `/local/setti-kettle-card.js` as *JavaScript module*.

Add the card – *SETTI+ Kettle Card* in the card picker, or:

```yaml
type: custom:setti-kettle-card
```

That is all for a kettle in the Tuya integration: the first kettle is found automatically.

## Configuration

```yaml
type: custom:setti-kettle-card
title: Kettle                        # "" hides the header
profile: setti_kt950w                # see docs/models.md – presets and keep-warm times of your kettle
presets: [40, 55, 70, 85, 100]       # optional – overrides the profile
keep_warm_times: [30, 60, 120]       # optional – minutes
device: 0123456789abcdef0123456789abcdef   # optional – when you have more than one kettle
entities:                            # optional – only what was not found
  start: switch.kettle_start
  target: number.kettle_temperature
  current: sensor.kettle_current_temperature
  status: sensor.kettle_status
  keep_warm: switch.kettle_heat_preservation
  keep_warm_time: number.kettle_heat_preservation_time
  # water_heater: water_heater.kettle    # tuya-local instead of start / target / current
  # start_temp: input_number.kettle_start_temperature   # not needed – the recorder is used
counters:                            # optional – default: the helpers of packages/setti_kettle.yaml
  today: counter.kettle_boils_today
  cleaning: counter.kettle_boils_since_cleaning
  descaling: counter.kettle_boils_since_descaling
cleaning_every: 20
descaling_every: 60
rate: 40                             # optional °C/min – fixed instead of learned
show: { header: true, presets: true, controls: true, keep_warm: true, counters: true }
```

Colours follow the theme; override them with card-mod or a theme: `--setti-blue`, `--setti-purple`,
`--setti-green`, `--setti-red`, `--setti-yellow`, `--setti-peach`, `--setti-radius`.

## Boil counters (optional)

1. Copy [`packages/setti_kettle.yaml`](packages/setti_kettle.yaml) to `/config/packages/` (three `counter`
   helpers; `homeassistant: packages: !include_dir_named packages` in `configuration.yaml`) and restart.
2. Import the blueprint
   [`setti_kettle_boil_counter.yaml`](blueprints/automation/jotuera/setti_kettle_boil_counter.yaml)
   (Settings → Automations → Blueprints → *Import*, paste the file's GitHub URL) and create an automation from it with
   your kettle's *Current temperature*. A boil counts when the water stays above 90 °C for 20 s, at most once per
   10 minutes; *boils today* resets at midnight.
3. The card shows the counters by itself. After cleaning or descaling **hold** the counter to reset it.

Your own counters work too – set them under `counters:`.

## Kettles

| Kettle | Integration | Profile | Status |
|---|---|---|---|
| **Götze & Jensen KT975K** | Tuya | `gotze_jensen_kt975k` | **tested** |
| **SETTI+ KT950W** | Tuya, tuya-local | `setti_kt950w` | same entities as the KT975K |
| AENO EK7S, Fiesta DK1G, SilverCrest (Lidl Home), Webber WK115, Nedis SmartLife, Weekett, Korex, Blow, Goldair… | Tuya, tuya-local | own profiles / `auto` | untested |

The full list with temperatures, keep-warm ranges, the entities and the status values: **[docs/models.md](docs/models.md)**.
Kettles with tea *modes* instead of a temperature (Svensson, ProfiCook / Koenic, AENO EK1S) work for boil / stop and
keep warm; a mode row is on the roadmap.

## Good to know

- **The kettle is in the cloud.** The Tuya integration gets the kettle's changes pushed (MQTT) – usually within a
  second or two. If the temperature only updates every minute, try tuya-local (local, no cloud).
- **Started from HA, the kettle sometimes beeps twice and stops** (reported for the KT950W) – that is the kettle's
  own protection (lifted from the base, no water); press Boil again.
- **ETA before heating** uses the learned rate (or the profile's 40 °C/min ≈ 1.7 L / 2200 W full kettle). Half a
  kettle heats about twice as fast – the ETA while heating comes from the live rate.
- **"Boiled"** shows for 3 minutes after the kettle switched itself off at the target.

## Development

```bash
python3 tools/build_i18n.py          # after editing i18n/*.json – inlines the texts into the card
python3 tools/build_i18n.py --check  # CI: every language complete, card up to date
node tests/test_card.js              # card logic with a mocked Home Assistant
python3 -m http.server 8781          # then http://localhost:8781/tests/preview.html?lang=pl – all states
```

A new language: copy `i18n/en.json`, translate, add the code to `LANGS` in `tools/build_i18n.py`, run the build.

## License

[PolyForm Noncommercial 1.0.0](LICENSE) – free for personal and other noncommercial use; commercial use needs a
license from the author. Acknowledgements: [NOTICE](NOTICE).

If the card saves you a walk to the kitchen – [buy me a coffee](https://buymeacoffee.com/jotuera) ☕
