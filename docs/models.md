# Kettles and profiles

**English** · [Polski](#polski)

The card works with any Wi-Fi kettle that Home Assistant shows with a **start switch** (or a `water_heater`) and a
**current temperature**. A *profile* only sets the card's buttons – the temperatures of the kettle's own buttons and
the keep-warm times – and the heating rate used for the ETA before the card has measured your kettle. Presets and
keep-warm chips are always clamped to the range the kettle's entities accept.

## Kettles

| Kettle | Capacity / power | Temperatures | Keep warm | Integration | Profile | Status |
|---|---|---|---|---|---|---|
| **Götze & Jensen KT975K** | – | 0–100 °C (author uses 40 / 55 / 80 / 90 / 100) | switch + 0–120 min | Tuya (core) | `gotze_jensen_kt975k` | **tested** (author) |
| **SETTI+ KT950W** | 1.7 L / 2200 W | 40–100 °C, buttons 40 / 55 / 70 / 85 / boil | switch + time | Tuya (core), tuya-local | `setti_kt950w` | same entities as the KT975K (hejdom.pl, homeswitch.pl) |
| AENO EK7S (Kogan KASMTSSKTLA) | – | 40–100 °C, quick 40 / 55 / 80 / 90 / 100 | switch + 0–1440 min | Tuya (core), tuya-local | `aeno_ek7s` | untested |
| Fiesta DK1G | – | 0–100 °C / °F, quick 45 / 60 / 85 / 90 / 100 | switch + 0–360 min | tuya-local | `fiesta_dk1g` | untested |
| SilverCrest (Lidl Home) WK0828RT | – | 40–100 °C step 5 | switch + 0–120 min step 30 | tuya-local | `silvercrest` | untested |
| Webber PRISME WK115 WIFI | 1.5 L / 1800 W | 45 / 55 / 65 / 75 / 85 / 100 °C | up to 12 h | Tuya | `webber_wk115` | untested |
| Nedis SmartLife KAWK8000WIFI / WIFIWK10CGS | 1.7 L | 40–100 °C, buttons 70 / 80 / 90 / 100 | up to 1 h | Tuya (Nedis SmartLife) | `nedis_kawk` | untested |
| Weekett KE4071TF / KR4071TB, Weeket KES5211TE | – | 40–100 °C or 104–212 °F | switch | tuya-local | `weekett` | untested |
| Korex AX-WF306N | – | 50–100 °C step 5 | switch + keep-warm temperature | tuya-local, LocalTuya | `korex` | untested |
| Blow BK-17PBT | 1.7 L / 2500 W | 40–100 °C | yes | Tuya | `auto` | untested |
| Goldair GGK1000, Anko LD-K3068, Kogan glass 1.7 L | – | 0–100 °C | switch + time | tuya-local | `auto` | untested |
| Svensson Smart06C, ProfiCook PC-WKS 1167 G / Koenic KTM, Homend Royaltea, AENO EK1S | – | tea **modes** instead of a setpoint | – | tuya-local | – | partly – see below |

Not Tuya (the card does not apply): Xiaomi Mi Smart Kettle (Mi Home), Redmond SkyKettle (Bluetooth).

*Untested* rows come from tuya-local device files, shop pages and manuals – see [NOTICE](../NOTICE). Kettles
with tea **modes** (black tea, green tea, formula…) instead of a temperature work for boil / stop, keep warm and the
progress; a mode row is on the roadmap. **Your kettle is not here?** Open an issue *New kettle* with its entities.

## Entities the card looks for

**Tuya (core integration, Smart Life app)** – category `bh` *Smart kettle*. Found on the kettle device by their
translation keys, so the entity ids and the language of HA do not matter:

| Data point | Entity | translation key | English name |
|---|---|---|---|
| `start` | switch | `start` | Start |
| `temp_set` (`temp_set_f`) | number | `temperature` | Temperature |
| `temp_current` (`temp_current_f`) | sensor | `current_temperature` | Current temperature |
| `status` | sensor | `status` | Status |
| `warm` | switch | `heat_preservation` | Heat preservation |
| `warm_time` | number | `heat_preservation_time` | Heat preservation time |

A kettle reporting °C and °F gets two temperature entities (the °F one with `_2`); the card takes the °C one.

**tuya-local** – one `water_heater` (operation mode `off` / `electric` = start, `temperature` = target,
`current_temperature`), plus a *Keep warm* switch, a *Keep warm time* number and a *Status* sensor of the same device.

**LocalTuya** – entities are named by you, so set them in the card (`entities:`). Standard `bh` data points:
1 start · 2 current °C · 3 current °F · 8 target °C · 9 target °F · 13 keep warm · 14 keep-warm time (min) ·
15 status · 16 work mode · 18 time left · 19 fault.

## Status values

The core integration passes the status through untranslated; the card translates these:

| Value | Shown as |
|---|---|
| `standby` | standby |
| `heating`, `boiling` | heating / boiling |
| `cooling` | cooling |
| `warm`, `keeping_warm` | keeping warm |
| `heating_temp`, `boiling_temp`, `done` | ready (the meaning differs between kettles) |
| `no_water`, `lack_water`, `dry_heating` | no water – the top tile turns red |

## Profiles

| Profile | Presets | Keep-warm chips | Rate |
|---|---|---|---|
| `auto` | 40 / 55 / 70 / 85 / 100 °C | 30 / 60 / 120 min | 40 °C/min |
| `setti_kt950w` | 40 / 55 / 70 / 85 / 100 | 30 / 60 / 120 | 40 |
| `gotze_jensen_kt975k` | 40 / 55 / 80 / 90 / 100 | 30 / 60 / 120 | 40 |
| `aeno_ek7s` | 40 / 55 / 80 / 90 / 100 | 30 / 60 / 120 / 240 | 40 |
| `fiesta_dk1g` | 45 / 60 / 85 / 90 / 100 | 30 / 60 / 120 / 360 | 40 |
| `silvercrest` | 40 / 60 / 70 / 80 / 90 / 100 | 30 / 60 / 90 / 120 | 38 |
| `webber_wk115` | 45 / 55 / 65 / 75 / 85 / 100 | 60 / 120 / 360 | 36 |
| `nedis_kawk` | 70 / 80 / 90 / 100 | 30 / 60 | 38 |
| `weekett` | 40 / 70 / 80 / 90 / 100 (°F 104 / 158 / 176 / 194 / 212) | 30 / 60 / 120 | 40 |
| `korex` | 50 / 70 / 85 / 95 / 100 | – | 40 |
| `fahrenheit` | 104 / 140 / 175 / 195 / 212 °F | 30 / 60 / 120 | 72 °F/min |

The rate (1.7 L, 2200 W, full kettle ≈ 33–48 °C/min in the author's history) is only a start: after each boil the
card learns your kettle's rate and stores it in the browser.

---

## Polski

Karta działa z każdym czajnikiem Wi-Fi, który HA pokazuje z **przełącznikiem start** (albo `water_heater`) i
**temperaturą bieżącą**. *Profil* ustawia tylko przyciski karty (temperatury z przycisków czajnika, czasy
podtrzymania) i tempo grzania do szacowania czasu, zanim karta zmierzy Twój czajnik. Tabele powyżej są wspólne –
„tested” = sprawdzony przez autora, „untested” = dane z plików tuya-local, sklepów i instrukcji. Czajnik z trybami
herbat zamiast temperatury: działa gotowanie / stop, podtrzymanie i postęp; wiersz trybów jest w planach. Twojego
czajnika nie ma na liście? Załóż zgłoszenie *New kettle* z listą jego encji.
