# Kettles, ecosystems and profiles

**English** · [Polski](#polski)

Smart Kettle works on top of the entities that a kettle's own Home Assistant integration creates – it does not talk
to the kettle itself. Any kettle with a **way to start it** (switch, button, `water_heater` or `climate`) and a
**water temperature** works; the card and the integration find the entities by themselves. A *profile* only sets
the buttons (temperatures, keep-warm times), the kettle's power (for the amount of water and the energy) and the
heating rate used before the first boil is measured.

## Ecosystems

| Ecosystem | Kettles | Home Assistant integration | Connection | Smart Kettle | Status |
|---|---|---|---|---|---|
| **Tuya / Smart Life** and its white-label apps (Lidl Home, Nedis SmartLife, Kogan SmarterHome, AENO…) | most smart kettles in Europe, UK, Australia, Middle East | core **Tuya** | cloud (push) | switch Start + number + sensor | **tested** (Götze & Jensen KT975K) |
| same kettles, local | | [**tuya-local**](https://github.com/make-all/tuya-local) (HACS) – 18 kettle configs | local Wi-Fi | `water_heater` (off / electric), `climate` (Kogan glass, formula makers), Start button (Fiesta), keep-warm time as number or `time`, fault sensor | untested on hardware, entity layout from the device configs |
| | | LocalTuya | local Wi-Fi | set the entities in the card (no templates exist) | – |
| **Xiaomi / Mijia** – Smart Kettle 2 Pro (xiaomi.kettle.v20/v21), Thermostatic Kettle 2 Pro / 3 Pro | EU, Asia, global | [**xiaomi_miot**](https://github.com/al-one/hass-xiaomi-miot) (HACS) | Wi-Fi (cloud or local token) | switch *on* + number target + sensor + keep-warm switch / time / temperature + stop button | untested on hardware |
| Xiaomi Mi Smart Kettle Pro (BLE, yunmi.kettle.v9) | | [mi_kettle_pro](https://github.com/asruda/mi_kettle_pro) | Bluetooth | Heat button + number + sensor; no stop | untested |
| **Fellow Stagg EKG Pro** | US, EU – specialty coffee | [fellow_stagg](https://github.com/bramboe/stagg-ekg-plus-ha), [staggassistant](https://github.com/fabiankirchen/staggassistant) | local Wi-Fi / BLE | `climate` heat / off, presets (white tea … boil) as the *Modes* tab, hold duration select | untested |
| Fellow Stagg EKG+ | | [stagg-ekg-plus-ha](https://github.com/levi/stagg-ekg-plus-ha) | Bluetooth | `water_heater` on / off + power switch + target number | untested |
| **Redmond SkyKettle** (RK-G2xxS, RK-M1xx/2xxS, RFS-KKL00x) | CIS, Baltics | [skykettle-ha](https://github.com/ClusterM/skykettle-ha) | Bluetooth (proxies work) | `water_heater` heat / boil / boil_heat (boil above 90 °C, heat-and-hold below) as the *Modes* tab | untested |
| **Smarter iKettle 3.0** | UK | [ha-smarter-integration](https://github.com/kbirger/ha-smarter-integration) – unmaintained, Smarter cloud | cloud | switch *Boiling* + boil temperature + water temperature + keep warm minutes | untested |
| **Govee** H7170 / H7171 / H7173 | US, EU | [govee2mqtt](https://github.com/wez/govee2mqtt) | Govee cloud API | power switch + temperature number + sensor + work-mode select; no keep warm | untested, entity names may differ |
| COSORI (VeSync), Breville / Sage, Hamilton Beach, Chefman, Bosch, Electrolux | | none | | not possible – no integration exposes these kettles | – |
| Matter / Zigbee | | – | | no smart kettle on the market yet | – |

**Your kettle is not found?** Set its entities in the card editor (*Entities*) – `start`, `target`, `current`,
`water_heater` or `climate`, `start_button` / `stop_button`, `keep_warm`, `keep_warm_time` (number, time or select),
`keep_warm_temp`, `status`, `mode`, `fault`, `time_left` – and open an issue *New kettle* with the list of its
entities: every kettle added makes Smart Kettle work in more kitchens.

## Tuya kettles by region

| Region | Kettle | Temperatures | Keep warm | App | Profile | Evidence |
|---|---|---|---|---|---|---|
| PL / EU | **Götze & Jensen KT975K** | 0–100 °C | 0–120 min | Tuya | `gotze_jensen_kt975k` | **tested** |
| PL / EU | **SETTI+ KT950W** | 40–100 °C (or °F) | 0–360 min | Tuya | `setti_kt950w` | same entities as the KT975K |
| EU | AENO EK7S (also Kogan KASMTSSKTLA) | 40–100 °C, quick 40 / 55 / 80 / 90 / 100 | up to 1440 min (time entity) | AENO | `aeno_ek7s` | tuya-local |
| EU | AENO EK1S | tea modes only | mode | AENO | `tea_modes` | tuya-local |
| EU | Fiesta DK-1G | 0–100 °C / 32–212 °F | 0–360 min | Tuya | `fiesta_dk1g` | tuya-local |
| EU / UK | SilverCrest (Lidl) WK0828RT | 40–100 °C, step 5 | 0–120 min, step 30 | Lidl Home | `silvercrest` | tuya-local |
| Baltics | Svensson Smart06C / 06B | 0–100 °C + tea modes | 0–720 min | Tuya | `tea_modes` | tuya-local |
| UK / EU | WeeKett KE4071TF / KR4071TB / KES5211TE | 40–100 °C or 70 / 80 / 90 / 100 | up to 60 min | Smart Life | `weekett` | tuya-local |
| DE / FR | Koenic KTM 221723 M, ProfiCook PC-WKS 1167 G | 30–95 °C + modes | 0–240 min | Smart Life | `tea_modes` | tuya-local |
| TR / EU | Homend Royaltea | 50 / 65 / 85 / 90 | 15–180 min | Tuya | `homend_royaltea` | tuya-local |
| EU | Nedis WIFIWK10CGS / KAWK8000WIFI | 40–100 °C | yes | Nedis SmartLife | `nedis_kawk` | nedis.com |
| PL / Baltics | Blow BK-17PBT | 40–100 °C, step 5 | 2 h | Tuya | `silvercrest` | shop pages |
| PL | Webber PRISME WK115 | 45–100 °C | up to 12 h | Tuya | `webber_wk115` | shop pages |
| DE / FR | Rosenstein & Söhne WSK-360.app (Pearl) | 40–100 °C, step 5 | yes | ELESION | `silvercrest` | low confidence |
| UK | Statesman smart 1.5 L, DMD SmartStream | 40 / 60 / 85 / 90 / 100 | 2 h | Smart Life | `statesman_uk` | shop pages |
| UK / ME | Geepas GK38034 | digital | yes | Tuya | `auto` | shop pages |
| AU / NZ | Kogan SmarterHome glass 1.7 L | 70 / 80 / 90 / 100 | 30–60 min | Kogan | `kogan_glass` | tuya-local (climate) |
| AU | Kogan KASMCDSKTLA / GK2009CT | 40–100 °C + modes | – | Kogan | `tea_modes` | tuya-local |
| AU | Korex AX-WF306N | 50–100 °C step 5 (enum), °F | keep-warm temperature | Tuya | `korex` | tuya-local, LocalTuya |
| AU | Anko LD-K3068 (Kmart) | 80 / 85 / 90 / 95 / 100 | 40 min | Tuya | `anko_kmart` | tuya-local |
| AU | Mercator Ikuü SHA171 | set temperature + hold | yes | Mercator Ikuü | `auto` | medium confidence |
| NZ | Goldair GGK1000, Smart Ape 1.7 L | 0–100 °C | 0–720 min | Tuya | `kogan_glass` | tuya-local |
| UAE | Blaupunkt BKW825 | 40 / 55 / 80 / 90 / 100 | yes | Tuya | `blaupunkt_bkw825` | shop pages |
| ZA | Vizia SMT-KET-BLK | 5 presets | yes | Smart Life | `auto` | shop pages |
| US | VNPONV gooseneck 0.8 L | 100–212 °F | – | Smart Life | `us_gooseneck` | shop pages |

Rows from tuya-local device configs, manufacturer pages and shops – see [NOTICE](../NOTICE). *Tested* = the author's
kettle; everything else is the entity layout the integrations create, checked by the tests (`tests/test_brands.js`,
`tests/test_roles.py`), not by a kettle on the bench.

## What the card does with the differences

- **°C / °F** – the unit comes from the entities; °F kettles get the °F presets (or the °C ones converted, boiling at
  212 °F). Kettles with a unit select (SETTI, Fiesta, WeeKett, Korex) follow it.
- **5 °C steps, preset-only temperatures** – every preset and drink is snapped to the kettle's min / max / step.
- **Tea modes** (`kettle_mode` select of tuya-local, Govee work mode) and **presets** (Fellow) and **water_heater
  modes** (SkyKettle heat / boil / boil_heat) appear on the *Modes* tab.
- **Keep warm** – a switch with time as a number (minutes), a `time` entity (AENO) or a select ("30 min", Fellow);
  a separate keep-warm temperature (Xiaomi, Götze & Jensen in tuya-local) is used for the formula's 45 °C.
- **Faults** – a problem binary sensor (dry heating, no water, off the base) turns the top tile red.
- **Countdown** – the kettle's own time left (Fellow ETA, tuya-local `time_remaining`) replaces the estimate.
- **Status words** of every integration are translated: standby, heating, boiling, done / at temperature, cooling,
  keeping warm / holding, no water / boiled dry, off the base, fault; reserved values are hidden.

## Status values (core Tuya)

The core integration passes the status through untranslated: `standby`, `heating`, `cooling`, `warm`,
`heating_temp` / `boiling_temp` (ready – the meaning differs between kettles).

## Profiles

| Profile | Presets | Keep warm | Power | Rate |
|---|---|---|---|---|
| `auto` | 40 / 55 / 70 / 85 / 100 °C | 30 / 60 / 120 | 2200 W | 40 °C/min |
| `setti_kt950w` | 40 / 55 / 70 / 85 / 100 | 30 / 60 / 120 | 2200 | 40 |
| `gotze_jensen_kt975k` | 40 / 55 / 80 / 90 / 100 | 30 / 60 / 120 | 2200 | 40 |
| `aeno_ek7s` | 40 / 55 / 80 / 90 / 100 | 30 / 60 / 120 / 240 | 2200 | 40 |
| `fiesta_dk1g` | 45 / 60 / 85 / 90 / 100 | 30 / 60 / 120 / 360 | 2200 | 40 |
| `silvercrest` | 40 / 60 / 70 / 80 / 90 / 100 | 30 / 60 / 90 / 120 | 2200 | 38 |
| `webber_wk115` | 45 / 55 / 65 / 75 / 85 / 100 | 60 / 120 / 360 | 1800 | 36 |
| `nedis_kawk` | 70 / 80 / 90 / 100 | 30 / 60 | 2200 | 38 |
| `weekett` | 40 / 70 / 80 / 90 / 100 (°F 104 … 212) | 30 / 60 / 120 | 2200 | 40 |
| `korex` | 50 / 70 / 85 / 95 / 100 | – | 2200 | 40 |
| `fahrenheit` | 104 / 140 / 175 / 195 / 212 °F | 30 / 60 / 120 | 1500 | 72 °F/min |
| `blaupunkt_bkw825` | 40 / 55 / 80 / 90 / 100 | 30 / 60 / 120 | 2200 | 40 |
| `statesman_uk` | 40 / 60 / 85 / 90 / 100 | 30 / 60 / 120 | 1800 | 36 |
| `uk_3kw` | 70 / 80 / 90 / 100 | 30 / 60 | 3000 | 55 |
| `kogan_glass` | 70 / 80 / 90 / 100 | 30 / 60 | 2200 | 42 |
| `anko_kmart` | 80 / 85 / 90 / 95 / 100 | 40 | 2200 | 42 |
| `homend_royaltea` | 50 / 65 / 85 / 90 / 100 | 15 / 60 / 180 | 2200 | 38 |
| `tea_modes` | 40 / 60 / 80 / 90 / 100 | 30 / 60 / 120 / 720 | 2200 | 40 |
| `us_gooseneck` | 140 / 160 / 175 / 185 / 195 / 205 / 212 °F | 30 / 60 | 1200 | 60 °F/min |
| `xiaomi_kettle_2_pro` | 40 / 50 / 60 / 70 / 80 / 90 / 99 | 60 / 120 / 360 / 720 | 1800 | 40 |
| `mi_kettle_pro_ble` | 50 / 60 / 70 / 80 / 90 / 100 | – | 1800 | 40 |
| `fellow_stagg` | 79 / 80 / 91 / 93 / 96 / 100 (°F 175 … 212) | 15 / 30 / 45 / 60 | 1200 | 45 |
| `skykettle` | 40 / 60 / 70 / 80 / 90 / 100 | – | 2200 | 40 |
| `smarter_ikettle` | 65 / 80 / 90 / 100 | 10 / 20 / 30 / 40 | 3000 | 55 |
| `govee` | 40 / 60 / 70 / 80 / 90 / 100 (°F 104 … 212) | 30 / 60 / 120 | 1500 | 50 |

The rate is only a start: the card (or the integration) learns your kettle's rate after each boil.

---

## Polski

Smart Kettle działa na encjach, które tworzy integracja samego czajnika – nie rozmawia z czajnikiem bezpośrednio.
Pasuje każdy czajnik, który ma **sposób uruchomienia** (przełącznik, przycisk, `water_heater` albo `climate`) i
**temperaturę wody**. Obsługiwane ekosystemy: **Tuya / Smart Life** (Tuya w HA – przetestowany KT975K; tuya-local;
LocalTuya z ręcznie wskazanymi encjami), **Xiaomi / Mijia** (xiaomi_miot, mi_kettle_pro), **Fellow Stagg EKG Pro /
EKG+**, **Redmond SkyKettle**, **Smarter iKettle 3.0**, **Govee** (govee2mqtt). Nie da się: COSORI (VeSync),
Breville / Sage, Hamilton Beach, Chefman, Bosch, Electrolux – żadna integracja nie udostępnia tych czajników; na
Matter / Zigbee nie ma jeszcze czajników. Tabele powyżej: „tested” = czajnik autora, reszta = układ encji z
integracji, sprawdzony testami, nie czajnikiem na blacie. Czajnika nie ma? Wskaż encje w edytorze karty i załóż
zgłoszenie *New kettle*.
