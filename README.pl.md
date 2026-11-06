# SETTI+ Kettle Card

[English](README.md) · **Polski**

[![CI](https://github.com/jotuera/setti-kettle-card/actions/workflows/ci.yml/badge.svg)](https://github.com/jotuera/setti-kettle-card/actions/workflows/ci.yml)
[![HACS](https://img.shields.io/badge/HACS-custom-41BDF5)](https://hacs.xyz)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2024.8%2B-41BDF5?logo=homeassistant&logoColor=white)](https://www.home-assistant.io)
[![Języki](https://img.shields.io/badge/j%C4%99zyki-9-8A2BE2)](i18n)
[![Licencja](https://img.shields.io/badge/licencja-PolyForm%20Noncommercial-blue)](LICENSE)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-jotuera-FFDD00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/jotuera)

**Karta Lovelace do czajników Wi-Fi Tuya / Smart Life – SETTI+ KT950W, Götze & Jensen KT975K i innych.** W Home
Assistant inteligentny czajnik to przełącznik, liczba i czujnik temperatury. Ta karta robi z nich czajnik: ile
zostało do zadanej temperatury i ile to potrwa, temperatury jednym dotknięciem, Gotuj / Stop, podtrzymywanie z
czasem i liczniki gotowań, które przypominają o myciu i odkamienianiu. Jeden plik JavaScript, bez innych kart
custom, bez szablonów YAML.

> Zbudowana na czajniku autora **Götze & Jensen KT975K** (integracja Tuya w HA), z karty button-card używanej od
> września 2026. **SETTI+ KT950W** ma w HA te same encje. Inne czajniki: [docs/models.md](docs/models.md).
>
> **Status: beta (0.1.0).** Przetestowana na jednym czajniku; logika pokryta testami z atrapą HA.

<img src="docs/img/cards-pl.png" width="700" alt="Karta czajnika: gotowy, gotowanie, zagotowane, podtrzymywanie">

<sub>Cztery stany górnego kafla: gotowy (czas dojścia do celu), gotowanie (postęp od temperatury startowej, czas z
bieżącego tempa), zagotowane, podtrzymywanie. Liczniki robią się czerwone, gdy czas na mycie / odkamienianie.</sub>

## Co robi

| Część | Co dostajesz |
|---|---|
| **Górny kafel** | *Czajnik gotowy – do 100 °C ok. 2 min* → *Gotowanie do 100 °C – zostało ok. 55 s · 41 °C/min* z paskiem postępu → *Zagotowane · 100 °C – gotowe 30 s temu* (3 min) → *Podtrzymywanie · 80 °C*. Także *niedostępny* i *brak wody*. Dotknięcie = historia. |
| **Temperatury** | Jedno dotknięcie ustawia temperaturę docelową; bieżąca świeci. Z profilu czajnika, przycięte do jego zakresu. |
| **Gotuj / Stop** | Gotuj włącza czajnik (*Cel 100 °C · teraz 21 °C · czuwa*). Stop wyłącza grzanie **i** podtrzymywanie. |
| **Podtrzymuj** | Przełącznik i czasy (30 min, 1 h, 2 h …), ograniczone do maksimum czajnika. |
| **Liczniki** | Gotowania dziś, od mycia (co 20), od odkamieniania (co 60) – **przytrzymaj**, aby wyzerować. Opcjonalne. |

- **Sama znajduje czajnik** – encje integracji Tuya po kluczach tłumaczeń, więc nie ma znaczenia, jak się nazywają
  ani w jakim języku jest HA (`_temperatura`, `_temperature`, `_temperatur` …). Czajniki z tuya-local po ich
  `water_heater`. Każdą encję można wskazać ręcznie (LocalTuya).
- **Postęp bez pomocników** – temperatura wody w chwili naciśnięcia Gotuj jest odczytywana z historii (recorder).
- **Uczy się Twojego czajnika** – po każdym gotowaniu karta zapamiętuje w przeglądarce zmierzone tempo grzania
  (°C/min) i używa go do szacowania czasu przed startem.
- **Czajniki °F**, **9 języków** (English, Polski, Deutsch, Čeština, Slovenčina, Français, Italiano, Español,
  Nederlands – język Twojego profilu HA), edytor wizualny, kolory motywu do nadpisania.

## Instalacja

**HACS** (repozytorium niestandardowe): HACS → ⋮ → *Custom repositories* → `https://github.com/jotuera/setti-kettle-card`,
typ *Dashboard* → zainstaluj *SETTI+ Kettle Card* → odśwież przeglądarkę.

**Ręcznie:** skopiuj `dist/setti-kettle-card.js` do `/config/www/`, potem Ustawienia → Dashboardy → ⋮ → *Zasoby* →
dodaj `/local/setti-kettle-card.js` jako *Moduł JavaScript*.

Dodaj kartę – *SETTI+ Kettle Card* w wyborze kart, albo:

```yaml
type: custom:setti-kettle-card
```

To wszystko dla czajnika w integracji Tuya: pierwszy czajnik zostanie znaleziony automatycznie.

## Konfiguracja

```yaml
type: custom:setti-kettle-card
title: Czajnik                       # "" ukrywa nagłówek
profile: setti_kt950w                # zob. docs/models.md – temperatury i czasy podtrzymania Twojego czajnika
presets: [40, 55, 70, 85, 100]       # opcjonalnie – zastępuje profil
keep_warm_times: [30, 60, 120]       # opcjonalnie – minuty
device: 0123456789abcdef0123456789abcdef   # opcjonalnie – gdy masz więcej niż jeden czajnik
entities:                            # opcjonalnie – tylko to, czego nie znalazła
  start: switch.czajnik_start
  target: number.czajnik_temperatura
  current: sensor.czajnik_current_temperature
  status: sensor.czajnik_status
  keep_warm: switch.czajnik_heat_preservation
  keep_warm_time: number.czajnik_heat_preservation_time
  # water_heater: water_heater.czajnik   # tuya-local zamiast start / target / current
counters:                            # opcjonalnie – domyślnie pomocniki z packages/setti_kettle.yaml
  today: counter.kettle_boils_today
  cleaning: counter.kettle_boils_since_cleaning
  descaling: counter.kettle_boils_since_descaling
cleaning_every: 20
descaling_every: 60
rate: 40                             # opcjonalnie °C/min – stałe zamiast wyuczonego
show: { header: true, presets: true, controls: true, keep_warm: true, counters: true }
```

Kolory idą za motywem; nadpiszesz je card-modem albo w motywie: `--setti-blue`, `--setti-purple`, `--setti-green`,
`--setti-red`, `--setti-yellow`, `--setti-peach`, `--setti-radius`.

## Liczniki gotowań (opcjonalnie)

1. Skopiuj [`packages/setti_kettle.yaml`](packages/setti_kettle.yaml) do `/config/packages/` (trzy pomocniki
   `counter`; w `configuration.yaml` `homeassistant: packages: !include_dir_named packages`) i zrestartuj HA.
2. Zaimportuj blueprint
   [`setti_kettle_boil_counter.yaml`](blueprints/automation/jotuera/setti_kettle_boil_counter.yaml)
   (Ustawienia → Automatyzacje → Blueprinty → *Importuj*, wklej adres pliku na GitHubie) i utwórz z niego automatyzację
   z *Current temperature* swojego czajnika. Gotowanie liczy się, gdy woda trzyma powyżej 90 °C przez 20 s, najwyżej
   raz na 10 minut; *gotowania dziś* zerują się o północy.
3. Karta sama pokaże liczniki. Po myciu lub odkamienianiu **przytrzymaj** licznik, aby go wyzerować.

Własne liczniki też działają – wskaż je w `counters:`.

## Czajniki

| Czajnik | Integracja | Profil | Status |
|---|---|---|---|
| **Götze & Jensen KT975K** | Tuya | `gotze_jensen_kt975k` | **przetestowany** |
| **SETTI+ KT950W** | Tuya, tuya-local | `setti_kt950w` | te same encje co KT975K |
| AENO EK7S, Fiesta DK1G, SilverCrest (Lidl Home), Webber WK115, Nedis SmartLife, Weekett, Korex, Blow, Goldair… | Tuya, tuya-local | własne profile / `auto` | nieprzetestowane |

Pełna lista z temperaturami, zakresami podtrzymania, encjami i wartościami statusu: **[docs/models.md](docs/models.md)**.
Czajniki z *trybami* herbat zamiast temperatury (Svensson, ProfiCook / Koenic, AENO EK1S) działają dla gotowania /
stopu i podtrzymania; wiersz trybów jest w planach.

## Dobrze wiedzieć

- **Czajnik jest w chmurze.** Integracja Tuya dostaje zmiany czajnika wypychane (MQTT) – zwykle w sekundę, dwie.
  Jeśli temperatura odświeża się co minutę, spróbuj tuya-local (lokalnie, bez chmury).
- **Włączony z HA czajnik czasem pika dwa razy i się wyłącza** (zgłaszane dla KT950W) – to zabezpieczenie samego
  czajnika (zdjęty z podstawy, brak wody); naciśnij Gotuj jeszcze raz.
- **Czas przed startem** liczony jest z wyuczonego tempa (albo 40 °C/min z profilu ≈ pełny czajnik 1,7 L / 2200 W).
  Pół czajnika grzeje się mniej więcej dwa razy szybciej – w trakcie grzania czas liczony jest z bieżącego tempa.
- **„Zagotowane”** widać przez 3 minuty od samoczynnego wyłączenia czajnika po osiągnięciu celu.

## Rozwój

```bash
python3 tools/build_i18n.py          # po zmianie i18n/*.json – wkleja teksty do karty
python3 tools/build_i18n.py --check  # CI: komplet języków, karta aktualna
node tests/test_card.js              # logika karty z atrapą Home Assistant
python3 -m http.server 8781          # potem http://localhost:8781/tests/preview.html?lang=pl – wszystkie stany
```

Nowy język: skopiuj `i18n/en.json`, przetłumacz, dopisz kod do `LANGS` w `tools/build_i18n.py`, uruchom build.

## Licencja

[PolyForm Noncommercial 1.0.0](LICENSE) – za darmo do użytku prywatnego i innego niekomercyjnego; użycie komercyjne
wymaga licencji od autora. Podziękowania: [NOTICE](NOTICE).

Jeśli karta oszczędza Ci spaceru do kuchni – [postaw mi kawę](https://buymeacoffee.com/jotuera) ☕
