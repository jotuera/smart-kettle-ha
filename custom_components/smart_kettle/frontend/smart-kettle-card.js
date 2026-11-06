/*
 * Smart Kettle Card – a Lovelace card for Tuya / Smart Life Wi-Fi kettles
 * Copyright (c) 2026 JoTu – PolyForm Noncommercial 1.0.0 (see LICENSE).
 *
 *   type: custom:smart-kettle-card
 *   device: <device id>           # optional – the first kettle is found automatically
 *   profile: auto                 # auto | setti_kt950w | gotze_jensen_kt975k | … (see PROFILES)
 *   presets: [40, 55, 70, 85, 100]        # optional – overrides the profile
 *   keep_warm_times: [30, 60, 120]        # optional – minutes
 *   drinks: [green_tea, coffee, black_tea, yerba, formula, drink_water]   # keys of DRINKS or own objects
 *   entities: { start, target, current, status, keep_warm, keep_warm_time, water_heater, mode, start_temp,
 *               drink, ready_at, ready_at_on }
 *   counters: { today, cleaning, descaling }   # optional counter.* helpers (packages/smart_kettle.yaml)
 *   cleaning_every: 20 · descaling_every: 60 · water_hardness: soft | medium | hard
 *   power: 2200 · price: 1.10 · price_entity · energy_entity · compact: false
 *
 * Two ways to talk to the kettle:
 *  - core Tuya (category "bh"): switch Start, number Temperature, sensor Current temperature, sensor Status,
 *    switch Heat preservation, number Heat preservation time, select Work mode – found on the device by their
 *    translation keys, so the entity ids and the HA language do not matter;
 *  - tuya-local: one water_heater entity (+ keep warm switch / time number, status sensor, mode select).
 * Texts are generated from i18n/*.json by tools/build_i18n.py – edit the JSON files, not the TEXTS block.
 */

const VERSION = "0.3.0";
const CARD = "smart-kettle-card";

// ---- kettle profiles: card presets, keep-warm chips, power and the heating rate used before the first boil
// presets in °C; for a °F kettle the °F list is used (or the °C list converted and rounded to 5 °F)
const PROFILES = {
  auto: { name: "Auto (from the entities)", presets: [40, 55, 70, 85, 100], keep: [30, 60, 120], rate: 40, power: 2200 },
  setti_kt950w: { name: "SETTI+ KT950W", presets: [40, 55, 70, 85, 100], keep: [30, 60, 120], rate: 40, power: 2200 },
  gotze_jensen_kt975k: { name: "Götze & Jensen KT975K", presets: [40, 55, 80, 90, 100], keep: [30, 60, 120], rate: 40, power: 2200 },
  aeno_ek7s: { name: "AENO EK7S", presets: [40, 55, 80, 90, 100], keep: [30, 60, 120, 240], rate: 40, power: 2200 },
  fiesta_dk1g: { name: "Fiesta DK1G", presets: [45, 60, 85, 90, 100], keep: [30, 60, 120, 360], rate: 40, power: 2200 },
  silvercrest: { name: "SilverCrest (Lidl Home)", presets: [40, 60, 70, 80, 90, 100], keep: [30, 60, 90, 120], rate: 38, power: 2200 },
  webber_wk115: { name: "Webber PRISME WK115", presets: [45, 55, 65, 75, 85, 100], keep: [60, 120, 360], rate: 36, power: 1800 },
  nedis_kawk: { name: "Nedis SmartLife kettle", presets: [70, 80, 90, 100], keep: [30, 60], rate: 38, power: 2200 },
  weekett: { name: "Weekett / Weeket", presets: [40, 70, 80, 90, 100], presets_f: [104, 158, 176, 194, 212], keep: [30, 60, 120], rate: 40, power: 2200 },
  korex: { name: "Korex AX-WF306N", presets: [50, 70, 85, 95, 100], keep: [], rate: 40, power: 2200 },
  fahrenheit: { name: "Generic °F kettle", presets_f: [104, 140, 175, 195, 212], keep: [30, 60, 120], rate: 72, power: 1500 },
};

// ---- drinks: temperature (°C), keep warm (min), steeping time (min), "then" = second stage after boiling
// (formula: boil for safety, then cool down to 45 °C and hold it)
const DRINKS = {
  green_tea: { icon: "mdi:leaf", temp: 80, steep: 2.5 },
  white_tea: { icon: "mdi:flower-outline", temp: 75, steep: 4 },
  matcha: { icon: "mdi:cup-outline", temp: 75 },
  oolong: { icon: "mdi:tea-outline", temp: 90, steep: 4 },
  coffee: { icon: "mdi:coffee", temp: 95, steep: 4 },
  yerba: { icon: "mdi:grass", temp: 75, keep: 30 },
  black_tea: { icon: "mdi:tea", temp: 100, steep: 4 },
  herbal: { icon: "mdi:flower", temp: 100, steep: 5 },
  formula: { icon: "mdi:baby-bottle-outline", temp: 100, then: 45, keep: 120 },
  honey: { icon: "mdi:bee", temp: 40, keep: 60 },
  oatmeal: { icon: "mdi:bowl-mix-outline", temp: 100 },
  drink_water: { icon: "mdi:cup-water", temp: 55, keep: 60 },
};
const DEFAULT_DRINKS = ["green_tea", "coffee", "black_tea", "yerba", "formula", "drink_water"];
const HARDNESS = { soft: 120, medium: 60, hard: 30 };   // boils between descaling

// raw status values of the kettles (core Tuya passes them through untranslated) -> text key + kind
const STATUS = {
  standby: ["st_standby", "idle"], idle: ["st_standby", "idle"], off: ["st_standby", "idle"],
  heating: ["st_heating", "heat"], boiling: ["st_boiling", "heat"], heating_temp: ["st_done", "done"],
  boiling_temp: ["st_done", "done"], done: ["st_done", "done"], at_temperature: ["st_done", "done"],
  cooling: ["st_cooling", "idle"], warm: ["st_warm", "warm"], keeping_warm: ["st_warm", "warm"],
  keep_warm: ["st_warm", "warm"], no_water: ["st_no_water", "fault"], lack_water: ["st_no_water", "fault"],
  dry_heating: ["st_no_water", "fault"],
};

// core Tuya translation keys (and fallbacks for other integrations) of the kettle's entities
const ROLES = {
  start: [["switch"], ["start"], /_start$|_power$|_switch$/],
  target: [["number"], ["temperature", "target_temperature", "temp_set"], /_temperatur[ae]$|_temp_set$|_target_temperature$/],
  current: [["sensor"], ["current_temperature"], /_current_temperature$|_temperature$/],
  status: [["sensor"], ["status", "kettle_status"], /_status$/],
  keep_warm: [["switch"], ["heat_preservation", "keep_warm"], /_heat_preservation$|_keep_warm$|_warm$/],
  keep_warm_time: [["number"], ["heat_preservation_time", "keep_warm_time"], /_heat_preservation_time$|_keep_warm_time$|_warm_time$/],
  mode: [["select"], ["kettle_work_mode", "kettle_mode", "work_mode", "mode"], /_work_mode$|_kettle_mode$|_mode$/],
  water_heater: [["water_heater"], ["kettle"], /./],
};

// helpers created by packages/smart_kettle.yaml – used when they exist and none are configured
const DEFAULT_COUNTERS = {
  today: "counter.kettle_boils_today", cleaning: "counter.kettle_boils_since_cleaning",
  descaling: "counter.kettle_boils_since_descaling",
};
const DEFAULT_HELPERS = { drink: "input_text.kettle_drink", ready_at: "input_datetime.kettle_ready_at", ready_at_on: "input_boolean.kettle_ready_at" };

// ---- card texts, generated from i18n/*.json by tools/build_i18n.py – do not edit by hand
// TEXTS-BEGIN
const TEXTS = {
  en: {"almost": "almost ready", "boil": "Boil", "boil_label": "Target {t} · now {c}", "boiled": "Boiled · {t}", "boiling_to": "Boiling to {t}", "boils_today": "Boils today", "cleaning": "Cleaning", "d_black_tea": "Black tea", "d_coffee": "Coffee", "d_drink_water": "Warm water", "d_formula": "Baby formula", "d_green_tea": "Green tea", "d_herbal": "Herbal tea", "d_honey": "Honey water", "d_matcha": "Matcha", "d_oatmeal": "Porridge / noodles", "d_oolong": "Oolong", "d_white_tea": "White tea", "d_yerba": "Yerba mate", "descaling": "Descaling", "e_cleaning": "Boils since cleaning", "e_cleaning_every": "Clean every … boils", "e_compact": "Compact (one row)", "e_counters": "Counters (optional)", "e_current": "Current temperature", "e_descaling": "Boils since descaling", "e_descaling_every": "Descale every … boils", "e_device": "Kettle (device)", "e_drink": "Drink helper (input_text)", "e_drinks": "Drinks", "e_energy": "Energy and cost (optional)", "e_energy_entity": "Energy sensor (kWh)", "e_entities": "Entities (optional – found automatically)", "e_keep_warm": "Keep warm switch", "e_keep_warm_time": "Keep warm time", "e_keep_warm_times": "Keep-warm times (min)", "e_mode": "Work mode (select)", "e_power": "Kettle power", "e_presets": "Temperature presets", "e_price": "Price per kWh", "e_price_entity": "Price entity", "e_profile": "Kettle profile", "e_rate": "Heating rate", "e_ready_at": "Ready at – time (input_datetime)", "e_ready_at_on": "Ready at – on / off (input_boolean)", "e_start": "Start switch", "e_start_temp": "Start temperature helper", "e_status": "Status", "e_target": "Target temperature", "e_title": "Title", "e_today": "Boils today", "e_water_hardness": "Water hardness", "e_water_heater": "Water heater (tuya-local)", "fault_info": "check the water and the base", "h_device": "Leave empty – the first kettle is found automatically.", "h_drink": "Lets the blueprints know the drink (steeping notification, formula stage 2).", "h_drinks": "Drinks shown on the Drinks tab. Hold a drink to boil it at once.", "h_energy_entity": "Optional – a kWh meter of the kettle's plug, instead of the estimate.", "h_keep_warm_times": "Comma separated minutes, e.g. 30, 60, 120.", "h_power": "Rated power – for the amount of water and the energy estimate.", "h_presets": "Comma separated, e.g. 40, 55, 70, 85, 100 – overrides the profile.", "h_rate": "Used for the ETA before the card has measured your kettle. Empty = learned / profile.", "h_start_temp": "Not needed – the card reads the start temperature from the recorder.", "h_water_hardness": "Descaling interval when not set: soft 120, medium 60, hard 30 boils.", "hard_hard": "hard water", "hard_medium": "medium water", "hard_soft": "soft water", "heating_to": "Heating to {t}", "hold_boil": "hold to boil at once", "hold_reset": "hold to reset", "idle": "Kettle ready", "idle_hot": "the water is already {t}", "idle_need": "to {t} in about {eta}", "keep_on": "keep warm is on", "keep_warm": "Keep warm", "keeping": "Keeping warm · {t}", "keeping_for": "keeping warm for {m} min", "keeping_info": "the kettle holds the temperature", "last_boil": "last {t} ({d})", "left": "about {eta} left · {rate}", "low_water": "little water?", "no_kettle": "No kettle found – pick the device or the entities in the card editor.", "offline": "Kettle unavailable", "offline_info": "check Wi-Fi and the base", "reached": "Ready · {t}", "ready_ago": "ready {eta} ago", "ready_at": "Ready at {t}", "ready_off": "schedule off", "ready_set": "change", "ready_start": "start at about {t}", "reset_confirm": "Reset the counter “{n}”?", "st_boiling": "boiling", "st_cooling": "cooling", "st_done": "ready", "st_heating": "heating", "st_no_water": "no water", "st_standby": "standby", "st_warm": "keeping warm", "stage2": "now cooling down to {t} and keeping warm", "steep_done": "ready – take the tea out", "steep_left": "steeping – {t} left", "stop": "Stop", "stop_heating": "stop heating", "stop_idle": "nothing is heating", "stop_keep": "switch off keep warm", "tab_drinks": "Drinks", "tab_modes": "Modes", "tab_temps": "°C", "title": "Kettle", "today_energy": "today {kwh} kWh", "water": "about {l} l"},
  pl: {"almost": "prawie gotowe", "boil": "Gotuj", "boil_label": "Cel {t} · teraz {c}", "boiled": "Zagotowane · {t}", "boiling_to": "Gotowanie do {t}", "boils_today": "Gotowania dziś", "cleaning": "Mycie", "d_black_tea": "Czarna herbata", "d_coffee": "Kawa", "d_drink_water": "Ciepła woda", "d_formula": "Mleko modyfikowane", "d_green_tea": "Zielona herbata", "d_herbal": "Zioła", "d_honey": "Woda z miodem", "d_matcha": "Matcha", "d_oatmeal": "Owsianka / zupka", "d_oolong": "Oolong", "d_white_tea": "Biała herbata", "d_yerba": "Yerba mate", "descaling": "Odkamienianie", "e_cleaning": "Gotowania od mycia", "e_cleaning_every": "Myj co … gotowań", "e_compact": "Kompaktowa (jeden wiersz)", "e_counters": "Liczniki (opcjonalnie)", "e_current": "Temperatura bieżąca", "e_descaling": "Gotowania od odkamieniania", "e_descaling_every": "Odkamieniaj co … gotowań", "e_device": "Czajnik (urządzenie)", "e_drink": "Pomocnik napoju (input_text)", "e_drinks": "Napoje", "e_energy": "Energia i koszt (opcjonalnie)", "e_energy_entity": "Czujnik energii (kWh)", "e_entities": "Encje (opcjonalnie – wykrywane automatycznie)", "e_keep_warm": "Przełącznik podtrzymania", "e_keep_warm_time": "Czas podtrzymania", "e_keep_warm_times": "Czasy podtrzymania (min)", "e_mode": "Tryb pracy (select)", "e_power": "Moc czajnika", "e_presets": "Temperatury (przyciski)", "e_price": "Cena za kWh", "e_price_entity": "Encja ceny", "e_profile": "Profil czajnika", "e_rate": "Tempo grzania", "e_ready_at": "Gotowe na – godzina (input_datetime)", "e_ready_at_on": "Gotowe na – wł. / wył. (input_boolean)", "e_start": "Przełącznik Start", "e_start_temp": "Pomocnik temperatury startowej", "e_status": "Status", "e_target": "Temperatura zadana", "e_title": "Tytuł", "e_today": "Gotowania dziś", "e_water_hardness": "Twardość wody", "e_water_heater": "Podgrzewacz wody (tuya-local)", "fault_info": "sprawdź wodę i podstawę", "h_device": "Zostaw puste – pierwszy czajnik zostanie znaleziony automatycznie.", "h_drink": "Przekazuje napój blueprintom (powiadomienie o parzeniu, 2. etap mleka).", "h_drinks": "Napoje na zakładce Napoje. Przytrzymaj napój, aby od razu gotować.", "h_energy_entity": "Opcjonalnie – licznik kWh gniazdka czajnika zamiast szacunku.", "h_keep_warm_times": "Minuty po przecinku, np. 30, 60, 120.", "h_power": "Moc znamionowa – do ilości wody i szacowania energii.", "h_presets": "Po przecinku, np. 40, 55, 70, 85, 100 – zastępuje profil.", "h_rate": "Do szacowania czasu, zanim karta zmierzy Twój czajnik. Puste = wyuczone / z profilu.", "h_start_temp": "Niepotrzebny – karta odczytuje temperaturę startową z historii.", "h_water_hardness": "Odkamienianie, gdy nie ustawione: miękka 120, średnia 60, twarda 30 gotowań.", "hard_hard": "woda twarda", "hard_medium": "woda średnia", "hard_soft": "woda miękka", "heating_to": "Grzanie do {t}", "hold_boil": "przytrzymaj, aby od razu gotować", "hold_reset": "przytrzymaj, aby wyzerować", "idle": "Czajnik gotowy", "idle_hot": "woda ma już {t}", "idle_need": "do {t} ok. {eta}", "keep_on": "podtrzymywanie temperatury włączone", "keep_warm": "Podtrzymuj", "keeping": "Podtrzymywanie · {t}", "keeping_for": "podtrzymuje jeszcze {m} min", "keeping_info": "czajnik utrzymuje temperaturę", "last_boil": "ostatnio {t} ({d})", "left": "zostało ok. {eta} · {rate}", "low_water": "mało wody?", "no_kettle": "Nie znaleziono czajnika – wybierz urządzenie lub encje w edytorze karty.", "offline": "Czajnik niedostępny", "offline_info": "sprawdź Wi-Fi i podstawę", "reached": "Gotowe · {t}", "ready_ago": "gotowe {eta} temu", "ready_at": "Gotowe na {t}", "ready_off": "harmonogram wyłączony", "ready_set": "zmień", "ready_start": "start ok. {t}", "reset_confirm": "Wyzerować licznik „{n}”?", "st_boiling": "gotuje", "st_cooling": "stygnie", "st_done": "gotowe", "st_heating": "grzeje", "st_no_water": "brak wody", "st_standby": "czuwa", "st_warm": "podtrzymuje", "stage2": "teraz stygnie do {t} i podtrzymuje", "steep_done": "gotowe – wyjmij herbatę", "steep_left": "parzenie – jeszcze {t}", "stop": "Stop", "stop_heating": "przerwij grzanie", "stop_idle": "nic nie grzeje", "stop_keep": "wyłącz podtrzymywanie", "tab_drinks": "Napoje", "tab_modes": "Tryby", "tab_temps": "°C", "title": "Czajnik", "today_energy": "dziś {kwh} kWh", "water": "ok. {l} l"},
  de: {"almost": "gleich fertig", "boil": "Kochen", "boil_label": "Ziel {t} · jetzt {c}", "boiled": "Gekocht · {t}", "boiling_to": "Kochen auf {t}", "boils_today": "Heute gekocht", "cleaning": "Reinigen", "d_black_tea": "Schwarzer Tee", "d_coffee": "Kaffee", "d_drink_water": "Warmes Wasser", "d_formula": "Babynahrung", "d_green_tea": "Grüner Tee", "d_herbal": "Kräutertee", "d_honey": "Honigwasser", "d_matcha": "Matcha", "d_oatmeal": "Porridge / Nudeln", "d_oolong": "Oolong", "d_white_tea": "Weißer Tee", "d_yerba": "Mate", "descaling": "Entkalken", "e_cleaning": "Kochvorgänge seit Reinigung", "e_cleaning_every": "Reinigen alle … Kochvorgänge", "e_compact": "Kompakt (eine Zeile)", "e_counters": "Zähler (optional)", "e_current": "Aktuelle Temperatur", "e_descaling": "Kochvorgänge seit Entkalkung", "e_descaling_every": "Entkalken alle … Kochvorgänge", "e_device": "Wasserkocher (Gerät)", "e_drink": "Getränke-Helfer (input_text)", "e_drinks": "Getränke", "e_energy": "Energie und Kosten (optional)", "e_energy_entity": "Energiesensor (kWh)", "e_entities": "Entitäten (optional – automatisch gefunden)", "e_keep_warm": "Warmhalte-Schalter", "e_keep_warm_time": "Warmhaltezeit", "e_keep_warm_times": "Warmhaltezeiten (min)", "e_mode": "Betriebsmodus (Select)", "e_power": "Leistung des Kochers", "e_presets": "Temperatur-Tasten", "e_price": "Preis pro kWh", "e_price_entity": "Preis-Entität", "e_profile": "Kocher-Profil", "e_rate": "Heizrate", "e_ready_at": "Fertig um – Uhrzeit (input_datetime)", "e_ready_at_on": "Fertig um – an / aus (input_boolean)", "e_start": "Start-Schalter", "e_start_temp": "Helfer Starttemperatur", "e_status": "Status", "e_target": "Zieltemperatur", "e_title": "Titel", "e_today": "Heute gekocht", "e_water_hardness": "Wasserhärte", "e_water_heater": "Warmwasserbereiter (tuya-local)", "fault_info": "Wasser und Sockel prüfen", "h_device": "Leer lassen – der erste Wasserkocher wird automatisch gefunden.", "h_drink": "Teilt den Blueprints das Getränk mit (Ziehzeit-Meldung, Babynahrung Stufe 2).", "h_drinks": "Getränke auf dem Tab Getränke. Getränk halten, um sofort zu kochen.", "h_energy_entity": "Optional – kWh-Zähler der Steckdose statt der Schätzung.", "h_keep_warm_times": "Minuten kommagetrennt, z. B. 30, 60, 120.", "h_power": "Nennleistung – für Wassermenge und Energieschätzung.", "h_presets": "Kommagetrennt, z. B. 40, 55, 70, 85, 100 – ersetzt das Profil.", "h_rate": "Für die Restzeit, bevor die Karte Ihren Kocher gemessen hat. Leer = gelernt / Profil.", "h_start_temp": "Nicht nötig – die Karte liest die Starttemperatur aus dem Verlauf.", "h_water_hardness": "Entkalken, wenn nicht gesetzt: weich 120, mittel 60, hart 30 Kochvorgänge.", "hard_hard": "hartes Wasser", "hard_medium": "mittelhartes Wasser", "hard_soft": "weiches Wasser", "heating_to": "Erhitzen auf {t}", "hold_boil": "halten, um sofort zu kochen", "hold_reset": "zum Zurücksetzen halten", "idle": "Wasserkocher bereit", "idle_hot": "das Wasser hat schon {t}", "idle_need": "auf {t} in ca. {eta}", "keep_on": "Warmhalten ist an", "keep_warm": "Warmhalten", "keeping": "Warmhalten · {t}", "keeping_for": "hält noch {m} min warm", "keeping_info": "der Kocher hält die Temperatur", "last_boil": "zuletzt {t} ({d})", "left": "noch ca. {eta} · {rate}", "low_water": "wenig Wasser?", "no_kettle": "Kein Wasserkocher gefunden – Gerät oder Entitäten im Karteneditor wählen.", "offline": "Wasserkocher nicht erreichbar", "offline_info": "WLAN und Sockel prüfen", "reached": "Fertig · {t}", "ready_ago": "fertig vor {eta}", "ready_at": "Fertig um {t}", "ready_off": "Zeitplan aus", "ready_set": "ändern", "ready_start": "Start ca. {t}", "reset_confirm": "Zähler „{n}“ zurücksetzen?", "st_boiling": "kocht", "st_cooling": "kühlt ab", "st_done": "fertig", "st_heating": "heizt", "st_no_water": "kein Wasser", "st_standby": "Standby", "st_warm": "hält warm", "stage2": "kühlt jetzt auf {t} ab und hält warm", "steep_done": "fertig – Tee herausnehmen", "steep_left": "Ziehzeit – noch {t}", "stop": "Stopp", "stop_heating": "Heizen abbrechen", "stop_idle": "nichts heizt", "stop_keep": "Warmhalten ausschalten", "tab_drinks": "Getränke", "tab_modes": "Modi", "tab_temps": "°C", "title": "Wasserkocher", "today_energy": "heute {kwh} kWh", "water": "ca. {l} l"},
  cs: {"almost": "téměř hotovo", "boil": "Vařit", "boil_label": "Cíl {t} · nyní {c}", "boiled": "Uvařeno · {t}", "boiling_to": "Vaření na {t}", "boils_today": "Vaření dnes", "cleaning": "Mytí", "d_black_tea": "Černý čaj", "d_coffee": "Káva", "d_drink_water": "Teplá voda", "d_formula": "Kojenecké mléko", "d_green_tea": "Zelený čaj", "d_herbal": "Bylinkový čaj", "d_honey": "Voda s medem", "d_matcha": "Matcha", "d_oatmeal": "Ovesná kaše / polévka", "d_oolong": "Oolong", "d_white_tea": "Bílý čaj", "d_yerba": "Yerba maté", "descaling": "Odvápnění", "e_cleaning": "Vaření od mytí", "e_cleaning_every": "Mýt každých … vaření", "e_compact": "Kompaktní (jeden řádek)", "e_counters": "Počítadla (volitelné)", "e_current": "Aktuální teplota", "e_descaling": "Vaření od odvápnění", "e_descaling_every": "Odvápnit každých … vaření", "e_device": "Konvice (zařízení)", "e_drink": "Pomocník nápoje (input_text)", "e_drinks": "Nápoje", "e_energy": "Energie a cena (volitelné)", "e_energy_entity": "Senzor energie (kWh)", "e_entities": "Entity (volitelné – nalezeny automaticky)", "e_keep_warm": "Spínač udržování", "e_keep_warm_time": "Doba udržování", "e_keep_warm_times": "Doby udržování (min)", "e_mode": "Pracovní režim (select)", "e_power": "Příkon konvice", "e_presets": "Teploty (tlačítka)", "e_price": "Cena za kWh", "e_price_entity": "Entita ceny", "e_profile": "Profil konvice", "e_rate": "Rychlost ohřevu", "e_ready_at": "Hotovo v – čas (input_datetime)", "e_ready_at_on": "Hotovo v – zap. / vyp. (input_boolean)", "e_start": "Spínač Start", "e_start_temp": "Pomocník počáteční teploty", "e_status": "Stav", "e_target": "Cílová teplota", "e_title": "Název", "e_today": "Vaření dnes", "e_water_hardness": "Tvrdost vody", "e_water_heater": "Ohřívač vody (tuya-local)", "fault_info": "zkontrolujte vodu a podstavec", "h_device": "Nechte prázdné – první konvice se najde automaticky.", "h_drink": "Předá nápoj blueprintům (oznámení o louhování, 2. fáze mléka).", "h_drinks": "Nápoje na kartě Nápoje. Podržte nápoj pro okamžité vaření.", "h_energy_entity": "Volitelné – měřič kWh zásuvky místo odhadu.", "h_keep_warm_times": "Minuty oddělené čárkou, např. 30, 60, 120.", "h_power": "Jmenovitý příkon – pro množství vody a odhad energie.", "h_presets": "Oddělené čárkou, např. 40, 55, 70, 85, 100 – nahrazuje profil.", "h_rate": "Pro odhad času, než karta změří vaši konvici. Prázdné = naučené / profil.", "h_start_temp": "Není potřeba – karta čte počáteční teplotu z historie.", "h_water_hardness": "Odvápnění, pokud není nastaveno: měkká 120, střední 60, tvrdá 30 vaření.", "hard_hard": "tvrdá voda", "hard_medium": "středně tvrdá voda", "hard_soft": "měkká voda", "heating_to": "Ohřev na {t}", "hold_boil": "podržte pro okamžité vaření", "hold_reset": "podržte pro vynulování", "idle": "Konvice připravena", "idle_hot": "voda už má {t}", "idle_need": "na {t} za cca {eta}", "keep_on": "udržování teploty zapnuto", "keep_warm": "Udržovat", "keeping": "Udržování · {t}", "keeping_for": "udržuje ještě {m} min", "keeping_info": "konvice udržuje teplotu", "last_boil": "naposledy {t} ({d})", "left": "zbývá cca {eta} · {rate}", "low_water": "málo vody?", "no_kettle": "Konvice nenalezena – vyberte zařízení nebo entity v editoru karty.", "offline": "Konvice nedostupná", "offline_info": "zkontrolujte Wi-Fi a podstavec", "reached": "Hotovo · {t}", "ready_ago": "hotovo před {eta}", "ready_at": "Hotovo v {t}", "ready_off": "plán vypnut", "ready_set": "změnit", "ready_start": "start cca {t}", "reset_confirm": "Vynulovat počítadlo „{n}“?", "st_boiling": "vaří", "st_cooling": "chladne", "st_done": "hotovo", "st_heating": "hřeje", "st_no_water": "chybí voda", "st_standby": "pohotovost", "st_warm": "udržuje", "stage2": "nyní chladne na {t} a udržuje", "steep_done": "hotovo – vyjměte čaj", "steep_left": "louhování – ještě {t}", "stop": "Stop", "stop_heating": "přerušit ohřev", "stop_idle": "nic nehřeje", "stop_keep": "vypnout udržování", "tab_drinks": "Nápoje", "tab_modes": "Režimy", "tab_temps": "°C", "title": "Konvice", "today_energy": "dnes {kwh} kWh", "water": "cca {l} l"},
  sk: {"almost": "takmer hotovo", "boil": "Variť", "boil_label": "Cieľ {t} · teraz {c}", "boiled": "Uvarené · {t}", "boiling_to": "Varenie na {t}", "boils_today": "Varenia dnes", "cleaning": "Umývanie", "d_black_tea": "Čierny čaj", "d_coffee": "Káva", "d_drink_water": "Teplá voda", "d_formula": "Dojčenské mlieko", "d_green_tea": "Zelený čaj", "d_herbal": "Bylinkový čaj", "d_honey": "Voda s medom", "d_matcha": "Matcha", "d_oatmeal": "Ovsená kaša / polievka", "d_oolong": "Oolong", "d_white_tea": "Biely čaj", "d_yerba": "Yerba maté", "descaling": "Odvápnenie", "e_cleaning": "Varenia od umytia", "e_cleaning_every": "Umývať každých … varení", "e_compact": "Kompaktná (jeden riadok)", "e_counters": "Počítadlá (voliteľné)", "e_current": "Aktuálna teplota", "e_descaling": "Varenia od odvápnenia", "e_descaling_every": "Odvápniť každých … varení", "e_device": "Kanvica (zariadenie)", "e_drink": "Pomocník nápoja (input_text)", "e_drinks": "Nápoje", "e_energy": "Energia a cena (voliteľné)", "e_energy_entity": "Senzor energie (kWh)", "e_entities": "Entity (voliteľné – nájdené automaticky)", "e_keep_warm": "Spínač udržiavania", "e_keep_warm_time": "Čas udržiavania", "e_keep_warm_times": "Časy udržiavania (min)", "e_mode": "Pracovný režim (select)", "e_power": "Príkon kanvice", "e_presets": "Teploty (tlačidlá)", "e_price": "Cena za kWh", "e_price_entity": "Entita ceny", "e_profile": "Profil kanvice", "e_rate": "Rýchlosť ohrevu", "e_ready_at": "Hotovo o – čas (input_datetime)", "e_ready_at_on": "Hotovo o – zap. / vyp. (input_boolean)", "e_start": "Spínač Štart", "e_start_temp": "Pomocník počiatočnej teploty", "e_status": "Stav", "e_target": "Cieľová teplota", "e_title": "Názov", "e_today": "Varenia dnes", "e_water_hardness": "Tvrdosť vody", "e_water_heater": "Ohrievač vody (tuya-local)", "fault_info": "skontrolujte vodu a podstavec", "h_device": "Nechajte prázdne – prvá kanvica sa nájde automaticky.", "h_drink": "Odovzdá nápoj blueprintom (oznámenie o lúhovaní, 2. fáza mlieka).", "h_drinks": "Nápoje na karte Nápoje. Podržte nápoj pre okamžité varenie.", "h_energy_entity": "Voliteľné – merač kWh zásuvky namiesto odhadu.", "h_keep_warm_times": "Minúty oddelené čiarkou, napr. 30, 60, 120.", "h_power": "Menovitý príkon – pre množstvo vody a odhad energie.", "h_presets": "Oddelené čiarkou, napr. 40, 55, 70, 85, 100 – nahrádza profil.", "h_rate": "Na odhad času, kým karta nezmeria vašu kanvicu. Prázdne = naučené / profil.", "h_start_temp": "Netreba – karta číta počiatočnú teplotu z histórie.", "h_water_hardness": "Odvápnenie, ak nie je nastavené: mäkká 120, stredná 60, tvrdá 30 varení.", "hard_hard": "tvrdá voda", "hard_medium": "stredne tvrdá voda", "hard_soft": "mäkká voda", "heating_to": "Ohrev na {t}", "hold_boil": "podržte pre okamžité varenie", "hold_reset": "podržte pre vynulovanie", "idle": "Kanvica pripravená", "idle_hot": "voda už má {t}", "idle_need": "na {t} o cca {eta}", "keep_on": "udržiavanie teploty zapnuté", "keep_warm": "Udržiavať", "keeping": "Udržiavanie · {t}", "keeping_for": "udržiava ešte {m} min", "keeping_info": "kanvica udržiava teplotu", "last_boil": "naposledy {t} ({d})", "left": "zostáva cca {eta} · {rate}", "low_water": "málo vody?", "no_kettle": "Kanvica sa nenašla – vyberte zariadenie alebo entity v editore karty.", "offline": "Kanvica nedostupná", "offline_info": "skontrolujte Wi-Fi a podstavec", "reached": "Hotovo · {t}", "ready_ago": "hotovo pred {eta}", "ready_at": "Hotovo o {t}", "ready_off": "plán vypnutý", "ready_set": "zmeniť", "ready_start": "štart cca {t}", "reset_confirm": "Vynulovať počítadlo „{n}“?", "st_boiling": "varí", "st_cooling": "chladne", "st_done": "hotovo", "st_heating": "hreje", "st_no_water": "chýba voda", "st_standby": "pohotovosť", "st_warm": "udržiava", "stage2": "teraz chladne na {t} a udržiava", "steep_done": "hotovo – vyberte čaj", "steep_left": "lúhovanie – ešte {t}", "stop": "Stop", "stop_heating": "prerušiť ohrev", "stop_idle": "nič nehreje", "stop_keep": "vypnúť udržiavanie", "tab_drinks": "Nápoje", "tab_modes": "Režimy", "tab_temps": "°C", "title": "Kanvica", "today_energy": "dnes {kwh} kWh", "water": "cca {l} l"},
  fr: {"almost": "presque prêt", "boil": "Bouillir", "boil_label": "Cible {t} · actuel {c}", "boiled": "Bouilli · {t}", "boiling_to": "Ébullition à {t}", "boils_today": "Ébullitions aujourd'hui", "cleaning": "Nettoyage", "d_black_tea": "Thé noir", "d_coffee": "Café", "d_drink_water": "Eau tiède", "d_formula": "Lait infantile", "d_green_tea": "Thé vert", "d_herbal": "Tisane", "d_honey": "Eau au miel", "d_matcha": "Matcha", "d_oatmeal": "Porridge / nouilles", "d_oolong": "Oolong", "d_white_tea": "Thé blanc", "d_yerba": "Maté", "descaling": "Détartrage", "e_cleaning": "Ébullitions depuis le nettoyage", "e_cleaning_every": "Nettoyer toutes les … ébullitions", "e_compact": "Compacte (une ligne)", "e_counters": "Compteurs (facultatif)", "e_current": "Température actuelle", "e_descaling": "Ébullitions depuis le détartrage", "e_descaling_every": "Détartrer toutes les … ébullitions", "e_device": "Bouilloire (appareil)", "e_drink": "Entrée boisson (input_text)", "e_drinks": "Boissons", "e_energy": "Énergie et coût (facultatif)", "e_energy_entity": "Capteur d'énergie (kWh)", "e_entities": "Entités (facultatif – trouvées automatiquement)", "e_keep_warm": "Interrupteur maintien au chaud", "e_keep_warm_time": "Durée du maintien", "e_keep_warm_times": "Durées de maintien (min)", "e_mode": "Mode de fonctionnement (select)", "e_power": "Puissance de la bouilloire", "e_presets": "Températures (boutons)", "e_price": "Prix du kWh", "e_price_entity": "Entité du prix", "e_profile": "Profil de bouilloire", "e_rate": "Vitesse de chauffe", "e_ready_at": "Prêt à – heure (input_datetime)", "e_ready_at_on": "Prêt à – marche / arrêt (input_boolean)", "e_start": "Interrupteur Start", "e_start_temp": "Entrée température de départ", "e_status": "État", "e_target": "Température cible", "e_title": "Titre", "e_today": "Ébullitions aujourd'hui", "e_water_hardness": "Dureté de l'eau", "e_water_heater": "Chauffe-eau (tuya-local)", "fault_info": "vérifiez l'eau et le socle", "h_device": "Laisser vide – la première bouilloire est trouvée automatiquement.", "h_drink": "Transmet la boisson aux blueprints (notification d'infusion, 2e étape du lait).", "h_drinks": "Boissons de l'onglet Boissons. Maintenez une boisson pour la lancer tout de suite.", "h_energy_entity": "Facultatif – compteur kWh de la prise au lieu de l'estimation.", "h_keep_warm_times": "Minutes séparées par des virgules, ex. 30, 60, 120.", "h_power": "Puissance nominale – pour la quantité d'eau et l'estimation d'énergie.", "h_presets": "Séparées par des virgules, ex. 40, 55, 70, 85, 100 – remplace le profil.", "h_rate": "Pour estimer le temps avant que la carte ait mesuré votre bouilloire. Vide = appris / profil.", "h_start_temp": "Inutile – la carte lit la température de départ dans l'historique.", "h_water_hardness": "Détartrage si non réglé : douce 120, moyenne 60, dure 30 ébullitions.", "hard_hard": "eau dure", "hard_medium": "eau moyenne", "hard_soft": "eau douce", "heating_to": "Chauffe à {t}", "hold_boil": "maintenir pour bouillir tout de suite", "hold_reset": "maintenir pour remettre à zéro", "idle": "Bouilloire prête", "idle_hot": "l'eau est déjà à {t}", "idle_need": "à {t} en env. {eta}", "keep_on": "maintien au chaud activé", "keep_warm": "Maintien au chaud", "keeping": "Maintien au chaud · {t}", "keeping_for": "maintient encore {m} min", "keeping_info": "la bouilloire maintient la température", "last_boil": "dernière {t} ({d})", "left": "encore env. {eta} · {rate}", "low_water": "peu d'eau ?", "no_kettle": "Aucune bouilloire trouvée – choisissez l'appareil ou les entités dans l'éditeur de la carte.", "offline": "Bouilloire indisponible", "offline_info": "vérifiez le Wi-Fi et le socle", "reached": "Prêt · {t}", "ready_ago": "prêt il y a {eta}", "ready_at": "Prêt à {t}", "ready_off": "programme désactivé", "ready_set": "modifier", "ready_start": "départ vers {t}", "reset_confirm": "Remettre à zéro le compteur « {n} » ?", "st_boiling": "bout", "st_cooling": "refroidit", "st_done": "prêt", "st_heating": "chauffe", "st_no_water": "pas d'eau", "st_standby": "veille", "st_warm": "maintien au chaud", "stage2": "refroidit maintenant à {t} et maintient", "steep_done": "prêt – retirez le thé", "steep_left": "infusion – encore {t}", "stop": "Stop", "stop_heating": "arrêter la chauffe", "stop_idle": "rien ne chauffe", "stop_keep": "couper le maintien au chaud", "tab_drinks": "Boissons", "tab_modes": "Modes", "tab_temps": "°C", "title": "Bouilloire", "today_energy": "aujourd'hui {kwh} kWh", "water": "env. {l} l"},
  it: {"almost": "quasi pronto", "boil": "Bolli", "boil_label": "Obiettivo {t} · ora {c}", "boiled": "Bollito · {t}", "boiling_to": "Ebollizione a {t}", "boils_today": "Bolliture oggi", "cleaning": "Pulizia", "d_black_tea": "Tè nero", "d_coffee": "Caffè", "d_drink_water": "Acqua tiepida", "d_formula": "Latte in polvere", "d_green_tea": "Tè verde", "d_herbal": "Tisana", "d_honey": "Acqua e miele", "d_matcha": "Matcha", "d_oatmeal": "Porridge / noodles", "d_oolong": "Oolong", "d_white_tea": "Tè bianco", "d_yerba": "Yerba mate", "descaling": "Decalcificazione", "e_cleaning": "Bolliture dalla pulizia", "e_cleaning_every": "Pulisci ogni … bolliture", "e_compact": "Compatta (una riga)", "e_counters": "Contatori (facoltativi)", "e_current": "Temperatura attuale", "e_descaling": "Bolliture dalla decalcificazione", "e_descaling_every": "Decalcifica ogni … bolliture", "e_device": "Bollitore (dispositivo)", "e_drink": "Helper bevanda (input_text)", "e_drinks": "Bevande", "e_energy": "Energia e costo (facoltativo)", "e_energy_entity": "Sensore di energia (kWh)", "e_entities": "Entità (facoltative – trovate automaticamente)", "e_keep_warm": "Interruttore mantenimento", "e_keep_warm_time": "Tempo di mantenimento", "e_keep_warm_times": "Tempi di mantenimento (min)", "e_mode": "Modalità di lavoro (select)", "e_power": "Potenza del bollitore", "e_presets": "Temperature (pulsanti)", "e_price": "Prezzo per kWh", "e_price_entity": "Entità del prezzo", "e_profile": "Profilo bollitore", "e_rate": "Velocità di riscaldamento", "e_ready_at": "Pronto alle – ora (input_datetime)", "e_ready_at_on": "Pronto alle – on / off (input_boolean)", "e_start": "Interruttore Start", "e_start_temp": "Helper temperatura iniziale", "e_status": "Stato", "e_target": "Temperatura obiettivo", "e_title": "Titolo", "e_today": "Bolliture oggi", "e_water_hardness": "Durezza dell'acqua", "e_water_heater": "Scaldacqua (tuya-local)", "fault_info": "controlla l'acqua e la base", "h_device": "Lascia vuoto – il primo bollitore viene trovato automaticamente.", "h_drink": "Comunica la bevanda ai blueprint (notifica infusione, 2ª fase del latte).", "h_drinks": "Bevande della scheda Bevande. Tieni premuta una bevanda per avviarla subito.", "h_energy_entity": "Facoltativo – contatore kWh della presa invece della stima.", "h_keep_warm_times": "Minuti separati da virgola, es. 30, 60, 120.", "h_power": "Potenza nominale – per la quantità d'acqua e la stima dell'energia.", "h_presets": "Separate da virgola, es. 40, 55, 70, 85, 100 – sostituisce il profilo.", "h_rate": "Per stimare il tempo prima che la scheda misuri il tuo bollitore. Vuoto = appreso / profilo.", "h_start_temp": "Non serve – la scheda legge la temperatura iniziale dallo storico.", "h_water_hardness": "Decalcificazione se non impostata: dolce 120, media 60, dura 30 bolliture.", "hard_hard": "acqua dura", "hard_medium": "acqua media", "hard_soft": "acqua dolce", "heating_to": "Riscaldamento a {t}", "hold_boil": "tieni premuto per bollire subito", "hold_reset": "tieni premuto per azzerare", "idle": "Bollitore pronto", "idle_hot": "l'acqua è già a {t}", "idle_need": "a {t} in ca. {eta}", "keep_on": "mantenimento attivo", "keep_warm": "Mantieni caldo", "keeping": "Mantenimento · {t}", "keeping_for": "mantiene ancora {m} min", "keeping_info": "il bollitore mantiene la temperatura", "last_boil": "ultima {t} ({d})", "left": "ancora ca. {eta} · {rate}", "low_water": "poca acqua?", "no_kettle": "Nessun bollitore trovato – scegli il dispositivo o le entità nell'editor della scheda.", "offline": "Bollitore non disponibile", "offline_info": "controlla Wi-Fi e base", "reached": "Pronto · {t}", "ready_ago": "pronto {eta} fa", "ready_at": "Pronto alle {t}", "ready_off": "programma spento", "ready_set": "cambia", "ready_start": "avvio verso le {t}", "reset_confirm": "Azzerare il contatore «{n}»?", "st_boiling": "bolle", "st_cooling": "si raffredda", "st_done": "pronto", "st_heating": "riscalda", "st_no_water": "manca acqua", "st_standby": "standby", "st_warm": "mantiene caldo", "stage2": "ora si raffredda a {t} e mantiene", "steep_done": "pronto – togli il tè", "steep_left": "infusione – ancora {t}", "stop": "Stop", "stop_heating": "interrompi riscaldamento", "stop_idle": "niente in riscaldamento", "stop_keep": "spegni mantenimento", "tab_drinks": "Bevande", "tab_modes": "Modalità", "tab_temps": "°C", "title": "Bollitore", "today_energy": "oggi {kwh} kWh", "water": "ca. {l} l"},
  es: {"almost": "casi listo", "boil": "Hervir", "boil_label": "Objetivo {t} · ahora {c}", "boiled": "Hervido · {t}", "boiling_to": "Hirviendo a {t}", "boils_today": "Hervidos hoy", "cleaning": "Limpieza", "d_black_tea": "Té negro", "d_coffee": "Café", "d_drink_water": "Agua templada", "d_formula": "Leche de fórmula", "d_green_tea": "Té verde", "d_herbal": "Infusión", "d_honey": "Agua con miel", "d_matcha": "Matcha", "d_oatmeal": "Avena / fideos", "d_oolong": "Oolong", "d_white_tea": "Té blanco", "d_yerba": "Yerba mate", "descaling": "Descalcificación", "e_cleaning": "Hervidos desde la limpieza", "e_cleaning_every": "Limpiar cada … hervidos", "e_compact": "Compacta (una fila)", "e_counters": "Contadores (opcional)", "e_current": "Temperatura actual", "e_descaling": "Hervidos desde la descalcificación", "e_descaling_every": "Descalcificar cada … hervidos", "e_device": "Hervidor (dispositivo)", "e_drink": "Ayudante de bebida (input_text)", "e_drinks": "Bebidas", "e_energy": "Energía y coste (opcional)", "e_energy_entity": "Sensor de energía (kWh)", "e_entities": "Entidades (opcional – se encuentran automáticamente)", "e_keep_warm": "Interruptor mantener caliente", "e_keep_warm_time": "Tiempo de mantenimiento", "e_keep_warm_times": "Tiempos de mantenimiento (min)", "e_mode": "Modo de trabajo (select)", "e_power": "Potencia del hervidor", "e_presets": "Temperaturas (botones)", "e_price": "Precio por kWh", "e_price_entity": "Entidad del precio", "e_profile": "Perfil del hervidor", "e_rate": "Velocidad de calentamiento", "e_ready_at": "Listo a las – hora (input_datetime)", "e_ready_at_on": "Listo a las – on / off (input_boolean)", "e_start": "Interruptor Start", "e_start_temp": "Ayudante de temperatura inicial", "e_status": "Estado", "e_target": "Temperatura objetivo", "e_title": "Título", "e_today": "Hervidos hoy", "e_water_hardness": "Dureza del agua", "e_water_heater": "Calentador de agua (tuya-local)", "fault_info": "revisa el agua y la base", "h_device": "Déjalo vacío – el primer hervidor se encuentra automáticamente.", "h_drink": "Comunica la bebida a los blueprints (aviso de infusión, 2ª fase de la leche).", "h_drinks": "Bebidas de la pestaña Bebidas. Mantén pulsada una bebida para hervirla ya.", "h_energy_entity": "Opcional – contador kWh del enchufe en lugar de la estimación.", "h_keep_warm_times": "Minutos separados por comas, p. ej. 30, 60, 120.", "h_power": "Potencia nominal – para la cantidad de agua y la estimación de energía.", "h_presets": "Separadas por comas, p. ej. 40, 55, 70, 85, 100 – sustituye al perfil.", "h_rate": "Para estimar el tiempo antes de que la tarjeta mida tu hervidor. Vacío = aprendido / perfil.", "h_start_temp": "No hace falta – la tarjeta lee la temperatura inicial del historial.", "h_water_hardness": "Descalcificación si no se fija: blanda 120, media 60, dura 30 hervidos.", "hard_hard": "agua dura", "hard_medium": "agua media", "hard_soft": "agua blanda", "heating_to": "Calentando a {t}", "hold_boil": "mantén pulsado para hervir ya", "hold_reset": "mantén pulsado para poner a cero", "idle": "Hervidor listo", "idle_hot": "el agua ya está a {t}", "idle_need": "a {t} en aprox. {eta}", "keep_on": "mantener caliente activado", "keep_warm": "Mantener caliente", "keeping": "Manteniendo caliente · {t}", "keeping_for": "mantiene {m} min más", "keeping_info": "el hervidor mantiene la temperatura", "last_boil": "último {t} ({d})", "left": "quedan aprox. {eta} · {rate}", "low_water": "¿poca agua?", "no_kettle": "No se encontró ningún hervidor – elige el dispositivo o las entidades en el editor de la tarjeta.", "offline": "Hervidor no disponible", "offline_info": "revisa el Wi-Fi y la base", "reached": "Listo · {t}", "ready_ago": "listo hace {eta}", "ready_at": "Listo a las {t}", "ready_off": "programa apagado", "ready_set": "cambiar", "ready_start": "inicio hacia las {t}", "reset_confirm": "¿Poner a cero el contador «{n}»?", "st_boiling": "hirviendo", "st_cooling": "enfriando", "st_done": "listo", "st_heating": "calentando", "st_no_water": "sin agua", "st_standby": "en espera", "st_warm": "manteniendo caliente", "stage2": "ahora se enfría a {t} y mantiene", "steep_done": "listo – saca el té", "steep_left": "infusionando – faltan {t}", "stop": "Parar", "stop_heating": "detener el calentamiento", "stop_idle": "nada calienta", "stop_keep": "apagar mantener caliente", "tab_drinks": "Bebidas", "tab_modes": "Modos", "tab_temps": "°C", "title": "Hervidor", "today_energy": "hoy {kwh} kWh", "water": "aprox. {l} l"},
  nl: {"almost": "bijna klaar", "boil": "Koken", "boil_label": "Doel {t} · nu {c}", "boiled": "Gekookt · {t}", "boiling_to": "Koken tot {t}", "boils_today": "Vandaag gekookt", "cleaning": "Schoonmaken", "d_black_tea": "Zwarte thee", "d_coffee": "Koffie", "d_drink_water": "Warm water", "d_formula": "Flesvoeding", "d_green_tea": "Groene thee", "d_herbal": "Kruidenthee", "d_honey": "Honingwater", "d_matcha": "Matcha", "d_oatmeal": "Pap / noedels", "d_oolong": "Oolong", "d_white_tea": "Witte thee", "d_yerba": "Yerba mate", "descaling": "Ontkalken", "e_cleaning": "Keer gekookt sinds schoonmaken", "e_cleaning_every": "Schoonmaken elke … keer", "e_compact": "Compact (één rij)", "e_counters": "Tellers (optioneel)", "e_current": "Huidige temperatuur", "e_descaling": "Keer gekookt sinds ontkalken", "e_descaling_every": "Ontkalken elke … keer", "e_device": "Waterkoker (apparaat)", "e_drink": "Drank-helper (input_text)", "e_drinks": "Dranken", "e_energy": "Energie en kosten (optioneel)", "e_energy_entity": "Energiesensor (kWh)", "e_entities": "Entiteiten (optioneel – automatisch gevonden)", "e_keep_warm": "Warmhoudschakelaar", "e_keep_warm_time": "Warmhoudtijd", "e_keep_warm_times": "Warmhoudtijden (min)", "e_mode": "Werkmodus (select)", "e_power": "Vermogen waterkoker", "e_presets": "Temperaturen (knoppen)", "e_price": "Prijs per kWh", "e_price_entity": "Prijs-entiteit", "e_profile": "Waterkokerprofiel", "e_rate": "Opwarmsnelheid", "e_ready_at": "Klaar om – tijd (input_datetime)", "e_ready_at_on": "Klaar om – aan / uit (input_boolean)", "e_start": "Startschakelaar", "e_start_temp": "Helper starttemperatuur", "e_status": "Status", "e_target": "Doeltemperatuur", "e_title": "Titel", "e_today": "Vandaag gekookt", "e_water_hardness": "Waterhardheid", "e_water_heater": "Waterverwarmer (tuya-local)", "fault_info": "controleer het water en de voet", "h_device": "Leeg laten – de eerste waterkoker wordt automatisch gevonden.", "h_drink": "Geeft de drank door aan de blueprints (trekmelding, flesvoeding fase 2).", "h_drinks": "Dranken op het tabblad Dranken. Houd een drank vast om meteen te koken.", "h_energy_entity": "Optioneel – kWh-meter van het stopcontact in plaats van de schatting.", "h_keep_warm_times": "Minuten komma-gescheiden, bv. 30, 60, 120.", "h_power": "Nominaal vermogen – voor de hoeveelheid water en de energieschatting.", "h_presets": "Komma-gescheiden, bv. 40, 55, 70, 85, 100 – vervangt het profiel.", "h_rate": "Voor de resttijd voordat de kaart uw waterkoker heeft gemeten. Leeg = geleerd / profiel.", "h_start_temp": "Niet nodig – de kaart leest de starttemperatuur uit de geschiedenis.", "h_water_hardness": "Ontkalken indien niet ingesteld: zacht 120, middel 60, hard 30 keer.", "hard_hard": "hard water", "hard_medium": "middelhard water", "hard_soft": "zacht water", "heating_to": "Verwarmen tot {t}", "hold_boil": "vasthouden om meteen te koken", "hold_reset": "vasthouden om op nul te zetten", "idle": "Waterkoker klaar", "idle_hot": "het water is al {t}", "idle_need": "tot {t} in ca. {eta}", "keep_on": "warmhouden staat aan", "keep_warm": "Warmhouden", "keeping": "Warmhouden · {t}", "keeping_for": "houdt nog {m} min warm", "keeping_info": "de waterkoker houdt de temperatuur", "last_boil": "laatst {t} ({d})", "left": "nog ca. {eta} · {rate}", "low_water": "weinig water?", "no_kettle": "Geen waterkoker gevonden – kies het apparaat of de entiteiten in de kaarteditor.", "offline": "Waterkoker niet beschikbaar", "offline_info": "controleer wifi en de voet", "reached": "Klaar · {t}", "ready_ago": "klaar sinds {eta}", "ready_at": "Klaar om {t}", "ready_off": "schema uit", "ready_set": "wijzigen", "ready_start": "start rond {t}", "reset_confirm": "Teller „{n}” op nul zetten?", "st_boiling": "kookt", "st_cooling": "koelt af", "st_done": "klaar", "st_heating": "verwarmt", "st_no_water": "geen water", "st_standby": "stand-by", "st_warm": "houdt warm", "stage2": "koelt nu af tot {t} en houdt warm", "steep_done": "klaar – haal de thee eruit", "steep_left": "trekken – nog {t}", "stop": "Stop", "stop_heating": "verwarmen stoppen", "stop_idle": "er verwarmt niets", "stop_keep": "warmhouden uitzetten", "tab_drinks": "Dranken", "tab_modes": "Modi", "tab_temps": "°C", "title": "Waterkoker", "today_energy": "vandaag {kwh} kWh", "water": "ca. {l} l"},
};
// TEXTS-END

const langOf = (hass) => {
  const l = ((hass && (hass.locale && hass.locale.language || hass.language)) || "en").toLowerCase();
  return TEXTS[l] ? l : TEXTS[l.slice(0, 2)] ? l.slice(0, 2) : "en";
};
const tr = (hass, key, vars) => {
  const l = langOf(hass);
  let s = (TEXTS[l] && TEXTS[l][key]) || (TEXTS.en && TEXTS.en[key]) || key;
  if (vars) for (const k of Object.keys(vars)) s = s.split("{" + k + "}").join(vars[k]);
  return s;
};
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v) => { const x = parseFloat(v); return isNaN(x) ? null : x; };
const listOf = (v) => Array.isArray(v) ? v.map(Number).filter((x) => !isNaN(x))
  : typeof v === "string" && v.trim() ? v.split(/[ ,;]+/).map(Number).filter((x) => !isNaN(x)) : null;
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(CARD + ":" + k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(CARD + ":" + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
};
const midnight = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

// ---- find the kettle and its entities
function findKettle(hass, config) {
  const ents = hass.entities || {};
  const cfg = config.entities || {};
  const out = {};
  let device = config.device || null;
  if (!device) {
    const pick = (eid) => ents[eid] && ents[eid].device_id;
    device = pick(cfg.start) || pick(cfg.water_heater) || pick(cfg.current) || null;
  }
  if (!device) {
    // first device with a kettle water_heater (tuya-local) or a Start switch + Current temperature (core Tuya)
    const byDev = {};
    for (const e of Object.values(ents)) {
      if (!e.device_id || !hass.states[e.entity_id]) continue;
      const d = (byDev[e.device_id] = byDev[e.device_id] || {});
      const dom = e.entity_id.split(".")[0];
      if (dom === "water_heater" && (e.translation_key === "kettle" || /kettle|czajnik|wasserkocher/i.test(e.entity_id))) d.wh = 1;
      if (dom === "switch" && e.translation_key === "start") d.start = 1;
      if (dom === "sensor" && e.translation_key === "current_temperature") d.cur = 1;
      if (dom === "switch" && e.translation_key === "heat_preservation") d.keep = 1;
    }
    device = Object.keys(byDev).find((k) => byDev[k].wh) || Object.keys(byDev).find((k) => byDev[k].start && byDev[k].cur && byDev[k].keep)
      || Object.keys(byDev).find((k) => byDev[k].start && byDev[k].cur) || null;
  }
  const all = device ? Object.values(ents).filter((e) => e.device_id === device && hass.states[e.entity_id]) : [];
  // entities of the Smart Kettle integration on the kettle's device (counters, rate, energy, drink, ready at)
  for (const e of all) if (e.platform === "smart_kettle" && e.translation_key) out["s_" + e.translation_key] = e.entity_id;
  const devEnts = all.filter((e) => !e.hidden && e.platform !== "smart_kettle");
  for (const role of Object.keys(ROLES)) {
    if (cfg[role]) { out[role] = cfg[role]; continue; }
    const [doms, keys, re] = ROLES[role];
    const cands = devEnts.filter((e) => doms.includes(e.entity_id.split(".")[0]));
    // °C entity before the °F twin (Tuya creates "_2" for temp_set_f / temp_current_f)
    const byKey = cands.filter((e) => keys.includes(e.translation_key)).sort((a, b) => a.entity_id.length - b.entity_id.length);
    let hit = byKey[0];
    if (!hit && role !== "water_heater") {
      const others = cands.filter((e) => re.test(e.entity_id) && !Object.values(out).includes(e.entity_id));
      // _current_temperature must not be taken as the target, _heat_preservation_time not as the switch
      hit = others.filter((e) => !(role === "target" && /current/.test(e.entity_id)) && !(role === "keep_warm" && /time/.test(e.entity_id))
        && !(role === "mode" && /unit/.test(e.entity_id)))
        .sort((a, b) => a.entity_id.length - b.entity_id.length)[0];
    }
    if (hit) out[role] = hit.entity_id;
  }
  const fromInt = { drink: out.s_drink, ready_at: out.s_ready_at, ready_at_on: out.s_ready_at_enabled };
  for (const k of ["start_temp", "drink", "ready_at", "ready_at_on"]) {
    if (cfg[k]) out[k] = cfg[k];
    else if (fromInt[k]) out[k] = fromInt[k];
    else if (DEFAULT_HELPERS[k] && hass.states[DEFAULT_HELPERS[k]]) out[k] = DEFAULT_HELPERS[k];
  }
  return { device, ent: out };
}

// the drinks of the card: keys of DRINKS or own objects {name, icon, temp, keep, steep, then}
function drinksOf(config) {
  const list = Array.isArray(config.drinks) ? config.drinks
    : typeof config.drinks === "string" && config.drinks.trim() ? config.drinks.split(/[ ,;]+/) : DEFAULT_DRINKS;
  return list.map((d, i) => {
    if (typeof d === "string") return DRINKS[d] ? Object.assign({ key: d }, DRINKS[d]) : null;
    if (d && typeof d === "object" && num(d.temp) !== null) {
      const base = d.key && DRINKS[d.key] ? DRINKS[d.key] : {};
      return Object.assign({ icon: "mdi:cup" }, base, d, { key: d.key || "own" + i });
    }
    return null;
  }).filter(Boolean);
}

// ---- the card
class SmartKettleCard extends HTMLElement {
  static getConfigElement() { return document.createElement(CARD + "-editor"); }
  static getStubConfig() { return {}; }

  setConfig(config) {
    this._config = Object.assign({}, config || {});
    this._sig = null;
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() { return this._config && this._config.compact ? 2 : 9; }
  getGridOptions() { return { columns: 12, min_columns: 6, rows: "auto" }; }

  connectedCallback() {
    // every second while steeping (countdown), every 10 s while heating / just boiled
    this._tick = setInterval(() => {
      const vm = this._vm;
      if (!vm) return;
      this._n = (this._n || 0) + 1;
      if (vm.steeping || ((vm.mode === "heat" || vm.mode === "done") && this._n % 10 === 0) || this._n % 60 === 0) { this._sig = null; this._render(); }
    }, 1000);
  }
  disconnectedCallback() { clearInterval(this._tick); }

  // ---- state of the kettle -> view model
  _model() {
    const hass = this._hass, c = this._config;
    const { device, ent } = findKettle(hass, c);
    const st = (id) => id && hass.states[id];
    const wh = st(ent.water_heater);
    const profile = PROFILES[c.profile] || PROFILES.auto;
    const vm = { device, ent, profile, wh: !!wh, key: device || "x" };
    const l = langOf(hass);

    const curS = wh || st(ent.current);
    vm.unit = (st(ent.current) && st(ent.current).attributes.unit_of_measurement) || (wh && wh.attributes.temperature_unit)
      || (hass.config && hass.config.unit_system && hass.config.unit_system.temperature) || "°C";
    const F = /F/.test(vm.unit);
    vm.F = F;
    vm.cur = wh ? num(wh.attributes.current_temperature) : curS ? num(curS.state) : null;
    const tgtS = st(ent.target);
    vm.tgt = wh ? num(wh.attributes.temperature) : tgtS ? num(tgtS.state) : null;
    vm.max = wh ? num(wh.attributes.max_temp) : tgtS ? num(tgtS.attributes.max) : null;
    vm.min = wh ? num(wh.attributes.min_temp) : tgtS ? num(tgtS.attributes.min) : null;
    vm.step = tgtS ? num(tgtS.attributes.step) || 1 : 1;
    vm.boil = F ? 212 : 100;
    if (vm.tgt === null) vm.tgt = vm.max || vm.boil;

    const startS = st(ent.start);
    vm.on = wh ? !["off", "unavailable", "unknown"].includes(wh.state) : !!startS && startS.state === "on";
    vm.unavailable = !curS || ["unavailable", "unknown"].includes((wh || startS || curS).state);
    vm.changed = (wh || startS) ? new Date((wh || startS).last_changed).getTime() : 0;
    vm.since = vm.changed ? (Date.now() - vm.changed) / 60000 : 999;
    const keepS = st(ent.keep_warm);
    vm.keep = !!keepS && keepS.state === "on";
    const ktS = st(ent.keep_warm_time);
    vm.keepTime = ktS ? num(ktS.state) : null;
    vm.keepMax = ktS ? num(ktS.attributes.max) : null;
    const sS = st(ent.status);
    vm.statusRaw = sS ? sS.state : "";
    const stx = STATUS[vm.statusRaw];
    vm.statusKind = stx ? stx[1] : "";
    vm.statusText = stx ? tr(hass, stx[0]) : vm.statusRaw && hass.formatEntityState ? hass.formatEntityState(sS) : vm.statusRaw;
    if (vm.statusKind === "heat") vm.on = true;

    // presets and keep-warm chips, clamped to what the kettle accepts
    let presets = listOf(c.presets) || (F ? profile.presets_f || (profile.presets || []).map((x) => this._toF(x)) : profile.presets) || [];
    vm.presets = presets.filter((x) => (vm.min === null || x >= vm.min) && (vm.max === null || x <= vm.max));
    const keep = listOf(c.keep_warm_times) || profile.keep || [];
    vm.keepTimes = ent.keep_warm_time ? keep.filter((x) => vm.keepMax === null || x <= vm.keepMax) : [];

    // drinks – temperatures snapped to the kettle; the active one (chosen in this card, last 6 h)
    vm.drinks = drinksOf(c).map((d) => Object.assign({}, d, { t: this._snap(vm, F ? this._toF(d.temp) : d.temp),
      then: d.then != null ? this._snap(vm, F ? this._toF(d.then) : d.then) : null, name: d.name || tr(hass, "d_" + d.key) }));
    const act = store.get("drink:" + vm.key);
    vm.drink = act && Date.now() - act.at < 6 * 3600000 ? act : null;

    // mode select (tuya-local tea modes, core Tuya work mode)
    const mS = st(ent.mode);
    vm.modes = mS ? (mS.attributes.options || []).map((o) => ({ o, label: hass.formatEntityState ? hass.formatEntityState(mS, o) : o.replace(/_/g, " ") })) : [];
    vm.modeNow = mS ? mS.state : null;

    // heating rate and power
    // the integration learns the rate in Home Assistant (all browsers), else this browser does
    vm.integration = !!ent.s_heating_rate;
    const rS = st(ent.s_heating_rate);
    const learned = rS && rS.attributes.learned ? num(rS.state) : vm.integration ? null : num(store.get("rate:" + vm.key));
    vm.rate = num(c.rate) || learned || (F ? (profile.rate || 40) * 1.8 : profile.rate || 40);
    vm.rateLearned = !c.rate && !!learned;
    vm.power = num(c.power) || profile.power || 2200;
    vm.t0 = this._t0 && this._t0.key === vm.changed ? this._t0.value : null;
    if (ent.start_temp && st(ent.start_temp)) {
      const v = num(st(ent.start_temp).state);
      if (v !== null) vm.t0 = v;
    }

    // what the top tile shows
    const T = (v) => Math.round(v) + " " + vm.unit;
    const eta = (mins) => this._eta(mins);
    const drinkNow = vm.drink && vm.drink.at < vm.changed + 60000 ? vm.drink : vm.drink && vm.on ? vm.drink : null;
    const steep = drinkNow && num(drinkNow.steep);
    const doneWindow = steep ? steep + 2 : 3;
    if (vm.unavailable) {
      Object.assign(vm, { mode: "off", icon: "mdi:kettle-off-outline", name: tr(hass, "offline"), info: tr(hass, "offline_info"), pct: 0, right: "" });
    } else if (vm.on && vm.cur !== null) {
      const start = vm.t0 !== null && vm.t0 < vm.cur + 0.5 ? vm.t0 : null;
      const s0 = start !== null ? start : vm.cur;
      const span = Math.max(1, vm.tgt - s0);
      const pct = start !== null ? Math.round(Math.min(100, Math.max(0, (vm.cur - start) / span * 100))) : Math.round(Math.min(100, vm.cur / vm.tgt * 100));
      const measured = start !== null && vm.since > 0.25 && vm.cur > start + 5;
      const live = measured ? (vm.cur - start) / vm.since : vm.rate;
      const rate = Math.max(vm.rate / 4, Math.min(vm.rate * 3, live));
      const left = Math.max(0, (vm.tgt - vm.cur) / rate);
      // amount of water from the heating rate: m = P·η / (c · dT/dt)  (η ≈ 0.9, c = 4186 J/kg·K)
      const perMin = F ? rate / 1.8 : rate;
      vm.litres = measured ? vm.power * 0.9 * 60 / (4186 * perMin) : null;
      const parts = [pct >= 100 || left < 0.05 ? tr(hass, "almost") : tr(hass, "left", { eta: eta(left), rate: Math.round(rate) + " " + vm.unit + "/min" })];
      if (vm.litres !== null && vm.litres > 0.05 && vm.litres < 3) parts.push(tr(hass, "water", { l: (Math.round(vm.litres * 10) / 10).toLocaleString(l) }));
      if (vm.litres !== null && vm.litres < 0.3) parts.push(tr(hass, "low_water"));
      Object.assign(vm, {
        mode: "heat", icon: drinkNow ? drinkNow.icon : "mdi:kettle-steam", pct, right: T(vm.cur), liveRate: rate,
        name: drinkNow ? drinkNow.name + " · " + T(vm.tgt) : tr(hass, vm.tgt >= vm.boil ? "boiling_to" : "heating_to", { t: T(vm.tgt) }),
        info: parts.join(" · "), lowWater: vm.litres !== null && vm.litres < 0.3,
      });
    } else if (!vm.on && vm.since < doneWindow && vm.cur !== null && vm.cur >= vm.tgt - 3 - (drinkNow && drinkNow.then != null ? 60 : 0)) {
      let info = vm.keep ? tr(hass, "keep_on") : tr(hass, "ready_ago", { eta: eta(vm.since) });
      if (steep) {
        const leftS = Math.round(steep * 60 - vm.since * 60);
        vm.steeping = leftS > 0;
        info = leftS > 0 ? tr(hass, "steep_left", { t: Math.floor(leftS / 60) + ":" + String(leftS % 60).padStart(2, "0") })
          : tr(hass, "steep_done");
      } else if (drinkNow && drinkNow.then != null) info = tr(hass, "stage2", { t: T(drinkNow.then) });
      Object.assign(vm, {
        mode: "done", icon: drinkNow ? drinkNow.icon : "mdi:kettle-alert", right: T(vm.cur),
        pct: steep ? Math.min(100, Math.round(vm.since / steep * 100)) : 100,
        name: drinkNow ? drinkNow.name + " · " + T(drinkNow.t) : tr(hass, vm.tgt >= vm.boil ? "boiled" : "reached", { t: T(vm.tgt) }), info,
      });
    } else if ((vm.keep && vm.statusKind !== "idle") || vm.statusKind === "warm") {
      Object.assign(vm, {
        mode: "warm", icon: "mdi:kettle-steam-outline", pct: vm.cur !== null ? Math.min(100, Math.round(vm.cur / vm.tgt * 100)) : 0,
        right: vm.cur !== null ? T(vm.cur) : "", name: tr(hass, "keeping", { t: T(vm.tgt) }),
        info: vm.keepTime ? tr(hass, "keeping_for", { m: Math.round(vm.keepTime) }) : tr(hass, "keeping_info"),
      });
    } else if (vm.statusKind === "fault") {
      Object.assign(vm, { mode: "fault", icon: "mdi:kettle-alert-outline", pct: 0, right: vm.cur !== null ? T(vm.cur) : "", name: vm.statusText, info: tr(hass, "fault_info") });
    } else {
      const need = vm.cur !== null ? Math.max(0, (vm.tgt - vm.cur) / vm.rate) : null;
      Object.assign(vm, {
        mode: "idle", icon: "mdi:kettle-outline", pct: vm.cur !== null ? Math.min(100, Math.round(vm.cur / vm.boil * 100)) : 0,
        right: vm.cur !== null ? T(vm.cur) : "", name: tr(hass, "idle"),
        info: need !== null && need > 0.02 ? tr(hass, "idle_need", { t: T(vm.tgt), eta: eta(need) }) : vm.cur !== null ? tr(hass, "idle_hot", { t: T(vm.cur) }) : "",
      });
    }

    // ready at (blueprint + helpers): start time estimated from the rate
    const raS = st(ent.ready_at), raOn = st(ent.ready_at_on);
    if (raS) {
      const hh = num(raS.attributes.hour), mm = num(raS.attributes.minute);
      const [h, m] = hh !== null ? [hh, mm || 0] : String(raS.state).split(":").map(Number);
      if (!isNaN(h)) {
        const at = new Date(); at.setHours(h, m || 0, 0, 0);
        if (at.getTime() < Date.now() - 60000) at.setDate(at.getDate() + 1);
        const need = vm.cur !== null ? Math.max(0, (vm.tgt - vm.cur) / vm.rate) + 0.5 : 3;
        const fmt = (d) => d.toLocaleTimeString(l, { hour: "2-digit", minute: "2-digit" });
        const rsS = st(ent.s_ready_start);
        const startAt = rsS && !isNaN(Date.parse(rsS.state)) ? new Date(rsS.state) : new Date(at.getTime() - need * 60000);
        vm.readyAt = { time: fmt(at), start: fmt(startAt), on: !!raOn && raOn.state === "on" };
      }
    }

    // counters (optional) – descaling interval from the water hardness unless set
    const cc = c.counters || {};
    vm.counters = [];
    // integration sensors (reset with its buttons), else counter helpers
    const intC = { today: ent.s_boils_today, cleaning: ent.s_boils_since_cleaning, descaling: ent.s_boils_since_descaling };
    const intReset = { cleaning: ent.s_cleaned, descaling: ent.s_descaled };
    const add = (key, icon, every) => {
      const id = cc[key] || (cc[key] === undefined ? intC[key] || (hass.states[DEFAULT_COUNTERS[key]] ? DEFAULT_COUNTERS[key] : null) : null);
      if (!id || !hass.states[id]) return;
      const s = hass.states[id];
      const v = num(s.state) || 0;
      const isInt = id === intC[key];
      if (isInt && key !== "today" && !num(c[key + "_every"])) every = num(s.attributes.every) || every;
      const reset = id.startsWith("counter.") ? { d: "counter", s: "reset", id } : isInt && intReset[key] ? { d: "button", s: "press", id: intReset[key] } : null;
      vm.counters.push({ key, id, icon, v, every, due: every ? v >= every : false, reset });
    };
    add("today", "mdi:kettle", 0);
    add("cleaning", "mdi:spray-bottle", num(c.cleaning_every) || 20);
    add("descaling", "mdi:kettle-alert", num(c.descaling_every) || HARDNESS[c.water_hardness] || 60);

    // today's energy / cost and the last boil (from the recorder, refreshed by _fetchToday)
    let td = this._today && this._today.day === midnight() ? this._today : null;
    const eS = st(ent.s_energy_today), lS = st(ent.s_last_boil);
    if (eS && !c.energy_entity) {
      const lastAt = lS && Date.parse(lS.state);
      td = { day: midnight(), minutes: 0, count: 0, kwh: num(eS.state) || 0,
             last: lastAt && lastAt >= midnight() ? { at: lastAt, min: num(lS.attributes.minutes) || 0 } : null };
    }
    if (td) {
      const kwh = td.kwh !== null ? td.kwh : vm.power / 1000 * td.minutes / 60;
      const priceS = c.price_entity && st(c.price_entity);
      const price = priceS ? num(priceS.state) : num(c.price);
      const cur = (hass.config && hass.config.currency) || "";
      const parts = [];
      if (td.count || kwh > 0) parts.push(tr(hass, "today_energy", { kwh: kwh.toLocaleString(l, { maximumFractionDigits: 2 }) }) +
        (price !== null ? " · " + (kwh * price).toLocaleString(l, { style: cur ? "currency" : "decimal", currency: cur || undefined, maximumFractionDigits: 2 }) : ""));
      if (td.last) parts.push(tr(hass, "last_boil", { t: new Date(td.last.at).toLocaleTimeString(l, { hour: "2-digit", minute: "2-digit" }),
        d: this._eta(td.last.min) }));
      vm.stats = parts.join(" · ");
    }
    return vm;
  }

  _toF(c) { const f = c * 9 / 5 + 32; return c >= 100 ? 212 : Math.round(f / 5) * 5; }
  _snap(vm, t) {
    let v = t;
    if (vm.max !== null) v = Math.min(v, vm.max);
    if (vm.min !== null) v = Math.max(v, vm.min);
    const s = vm.step || 1, b = vm.min || 0;
    return Math.round(Math.round((v - b) / s) * s + b);
  }

  _eta(mins) {
    const l = langOf(this._hass);
    if (mins < 1) return Math.max(5, Math.round(mins * 60 / 5) * 5) + " s";
    if (mins >= 90) return Math.floor(mins / 60) + " h " + Math.round(mins % 60) + " min";
    return (Math.round(mins * 10) / 10).toLocaleString(l) + " min";
  }

  // temperature when the kettle was switched on – from the recorder, for the progress bar
  _fetchStart(vm) {
    if (!vm.on || !vm.changed || !vm.ent.current || vm.ent.start_temp || vm.wh) return;
    if (this._t0 && this._t0.key === vm.changed) return;
    this._t0 = { key: vm.changed, value: null };
    const at = vm.changed;
    this._hass.callWS({
      type: "history/history_during_period", entity_ids: [vm.ent.current], minimal_response: true, no_attributes: true,
      significant_changes_only: false, start_time: new Date(at - 15 * 60000).toISOString(), end_time: new Date(at + 3000).toISOString(),
    }).then((res) => {
      const rows = (res && res[vm.ent.current]) || [];
      let v = null;
      for (const r of rows) {
        const t = (r.lu || r.lc || 0) * 1000;
        const x = num(r.s);
        if (x !== null && (t <= at + 3000 || v === null)) v = x;
      }
      if (this._t0 && this._t0.key === at) { this._t0.value = v; this._sig = null; this._render(); }
    }).catch(() => {});
  }

  // today's boils from the recorder: heating minutes, the last boil, energy (estimated or from energy_entity)
  _fetchToday(vm) {
    const sw = vm.ent.start || vm.ent.water_heater;
    if (!sw || !this._hass.callWS || (vm.ent.s_energy_today && !this._config.energy_entity)) return;
    const day = midnight();
    const key = day + "|" + vm.changed;
    if (this._todayKey === key && Date.now() - (this._todayAt || 0) < 600000) return;
    this._todayKey = key;
    this._todayAt = Date.now();
    const energy = this._config.energy_entity;
    const ids = [sw].concat(energy ? [energy] : []);
    this._hass.callWS({
      type: "history/history_during_period", entity_ids: ids, minimal_response: true, no_attributes: true,
      significant_changes_only: false, start_time: new Date(day).toISOString(),
    }).then((res) => {
      const rows = (res && res[sw]) || [];
      let onAt = null, minutes = 0, count = 0, last = null;
      const isOn = (s) => !["off", "unavailable", "unknown"].includes(s);
      for (const r of rows) {
        const t = (r.lu || r.lc || 0) * 1000;
        if (isOn(r.s) && onAt === null) onAt = Math.max(t, day);
        else if (!isOn(r.s) && onAt !== null) {
          const m = (t - onAt) / 60000;
          if (m > 0.1 && m < 30) { minutes += m; count++; last = { at: t, min: m }; }
          onAt = null;
        }
      }
      if (onAt !== null) minutes += Math.min(30, (Date.now() - onAt) / 60000);
      let kwh = null;
      if (energy) {
        const er = ((res && res[energy]) || []).map((r) => num(r.s)).filter((x) => x !== null);
        if (er.length) kwh = Math.max(0, er[er.length - 1] - er[0]);
      }
      this._today = { day, minutes, count, last, kwh };
      this._sig = null;
      this._render();
    }).catch(() => {});
  }

  // learn the heating rate of this kettle after each boil to the target (start temperature known)
  _learn(vm) {
    const was = this._wasOn;
    this._wasOn = vm.on ? { t0: vm.t0, at: vm.changed, tgt: vm.tgt } : null;
    if (!was || vm.on || was.t0 === null || vm.cur === null || vm.integration) return;
    const mins = (vm.changed - was.at) / 60000;
    if (mins < 0.5 || mins > 15 || vm.cur < was.tgt - 3 || vm.cur - was.t0 < 20) return;
    const r = (vm.cur - was.t0) / mins;
    const old = num(store.get("rate:" + vm.key));
    store.set("rate:" + vm.key, Math.round((old ? old * 0.7 + r * 0.3 : r) * 10) / 10);
  }

  // second stage of a drink (formula: boil, then hold 45 °C) – when no helper lets the blueprint do it
  _stage2(vm) {
    const d = vm.drink;
    if (!d || d.then == null || vm.ent.drink || vm.integration || vm.mode !== "done" || d.stage2 === vm.changed || d.at > vm.changed) return;
    d.stage2 = vm.changed;
    store.set("drink:" + vm.key, d);
    this._setTarget(vm, d.then);
    if (vm.ent.keep_warm_time && d.keep) this._call("number", "set_value", { entity_id: vm.ent.keep_warm_time, value: Math.min(d.keep, vm.keepMax || d.keep) });
    if (vm.ent.keep_warm) this._call("switch", "turn_on", { entity_id: vm.ent.keep_warm });
  }

  _render() {
    if (!this._hass || !this._config) return;
    const hass = this._hass;
    const vm = this._model();
    this._vm = vm;
    this._fetchStart(vm);
    this._fetchToday(vm);
    this._learn(vm);
    this._stage2(vm);
    const watch = Object.values(vm.ent).concat(vm.counters.map((x) => x.id));
    const sig = [vm.mode, vm.t0, vm.info, vm.stats, this._tabName(vm), JSON.stringify(vm.drink), langOf(hass), JSON.stringify(this._config)]
      .concat(watch.map((id) => { const s = hass.states[id]; return s ? s.state + "|" + (s.attributes.temperature || "") + "|" + (s.attributes.current_temperature || "") : "?"; })).join("§");
    if (sig === this._sig) return;
    this._sig = sig;
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
      this.shadowRoot.addEventListener("click", (ev) => this._click(ev));
      this.shadowRoot.addEventListener("pointerdown", (ev) => this._down(ev));
      ["pointerup", "pointerleave", "pointercancel"].forEach((n) => this.shadowRoot.addEventListener(n, () => clearTimeout(this._hold)));
      this.shadowRoot.addEventListener("contextmenu", (ev) => { if (ev.target.closest && ev.target.closest("[data-hold]")) ev.preventDefault(); });
    }
    this.shadowRoot.innerHTML = this._html(vm);
  }

  _tabName(vm) {
    const tabs = this._tabs(vm);
    const t = this._tab || store.get("tab:" + vm.key) || this._config.tab || "temps";
    return tabs.includes(t) ? t : tabs[0];
  }
  _tabs(vm) {
    const t = [];
    if (vm.presets.length && (vm.ent.target || vm.wh)) t.push("temps");
    if (vm.drinks.length && (vm.ent.target || vm.wh)) t.push("drinks");
    if (vm.modes.length) t.push("modes");
    return t;
  }

  _html(vm) {
    const hass = this._hass, c = this._config;
    const show = Object.assign({ header: true, presets: true, controls: true, keep_warm: true, counters: true, stats: true, ready_at: true }, c.show || {});
    const t = (k, v) => esc(tr(hass, k, v));
    if (!vm.ent.start && !vm.ent.water_heater) {
      return `<style>${CSS}</style><ha-card><div class="empty"><ha-icon icon="mdi:kettle-off-outline"></ha-icon><div>${t("no_kettle")}</div></div></ha-card>`;
    }
    const U = vm.unit;
    const status = `
      <div class="status ${vm.lowWater ? "low" : ""}" data-act="more" data-id="${esc(vm.ent.current || vm.ent.water_heater)}" role="button" tabindex="0">
        <ha-icon class="sicon" icon="${vm.icon}"></ha-icon>
        <div class="stext"><div class="sname">${esc(vm.name)}</div><div class="sinfo">${esc(vm.info)}</div></div>
        <div class="stemp">${esc(vm.right)}</div>
        ${c.compact ? `<div class="cbtn ${vm.on || vm.keep ? "stop" : "boil"}" data-act="${vm.on || vm.keep ? "stop" : "start"}" role="button" tabindex="0">
          <ha-icon icon="${vm.on || vm.keep ? "mdi:stop" : "mdi:kettle-steam"}"></ha-icon></div>` : ""}
        <div class="bar"><div class="fill" style="width:${vm.pct}%"></div></div>
      </div>`;
    const header = show.header && c.title !== "" ? `<div class="hdr"><ha-icon icon="${esc(c.icon || "mdi:kettle-steam")}"></ha-icon><span>${esc(c.title || tr(hass, "title"))}</span></div>` : "";
    if (c.compact) return `<style>${CSS}</style><ha-card class="compact mode-${vm.mode}">${header}${status}</ha-card>`;

    // tabs: temperatures / drinks / kettle modes
    const tabs = this._tabs(vm), tab = this._tabName(vm);
    const tabsHtml = tabs.length > 1 ? `<div class="tabs">${tabs.map((x) => `<div class="tab ${x === tab ? "sel" : ""}" data-act="tab" data-v="${x}" role="button" tabindex="0">${t("tab_" + x)}</div>`).join("")}</div>` : "";
    let rowHtml = "";
    if (tab === "temps") {
      rowHtml = `<div class="row" style="grid-template-columns: repeat(${vm.presets.length}, 1fr)">${vm.presets.map((p) => {
        const act = Math.round(vm.tgt) === Math.round(p);
        return `<div class="tile preset ${act ? "active" : ""}" data-act="target" data-v="${p}" data-hold="boil" title="${t("hold_boil")}" role="button" tabindex="0">
          <ha-icon icon="${p >= vm.boil ? "mdi:thermometer-high" : "mdi:thermometer"}"></ha-icon><b>${p} ${esc(U)}</b></div>`;
      }).join("")}</div>`;
    } else if (tab === "drinks") {
      const cols = vm.drinks.length <= 4 ? vm.drinks.length : vm.drinks.length <= 6 ? 3 : 4;
      rowHtml = `<div class="row" style="grid-template-columns: repeat(${cols}, 1fr)">${vm.drinks.map((d) => {
        const act = vm.drink && vm.drink.key === d.key && (Math.round(vm.tgt) === d.t || Math.round(vm.tgt) === d.then);
        const sub = [d.t + " " + U + (d.then != null ? " → " + d.then + " " + U : ""), d.steep ? d.steep.toLocaleString(langOf(hass)) + " min" : d.keep ? "⏲ " + d.keep + " min" : ""].filter(Boolean).join(" · ");
        return `<div class="tile drink ${act ? "active" : ""}" data-act="drink" data-v="${esc(d.key)}" data-hold="boil" title="${t("hold_boil")}" role="button" tabindex="0">
          <ha-icon icon="${esc(d.icon)}"></ha-icon><b>${esc(d.name)}</b><span>${esc(sub)}</span></div>`;
      }).join("")}</div>`;
    } else if (tab === "modes") {
      const cols = Math.min(4, vm.modes.length);
      rowHtml = `<div class="row" style="grid-template-columns: repeat(${cols}, 1fr)">${vm.modes.map((m) =>
        `<div class="tile mode ${m.o === vm.modeNow ? "active" : ""}" data-act="mode" data-v="${esc(m.o)}" role="button" tabindex="0"><b>${esc(m.label)}</b></div>`).join("")}</div>`;
    }

    const nowTxt = vm.cur === null ? "—" : Math.round(vm.cur) + " " + U;
    const boilLabel = t("boil_label", { t: Math.round(vm.tgt) + " " + U, c: nowTxt }) + (vm.statusText ? " · " + esc(vm.statusText) : "");
    const stopLabel = vm.on ? t("stop_heating") : vm.keep ? t("stop_keep") : t("stop_idle");
    const keepHtml = (vm.ent.keep_warm || vm.keepTimes.length) ? `
      <div class="row" style="grid-template-columns: repeat(${(vm.ent.keep_warm ? 1 : 0) + vm.keepTimes.length}, 1fr)">
        ${vm.ent.keep_warm ? `<div class="tile keep ${vm.keep ? "on" : ""}" data-act="keep" role="button" tabindex="0"><ha-icon icon="mdi:fire"></ha-icon><b>${t("keep_warm")}</b></div>` : ""}
        ${vm.keepTimes.map((m) => `<div class="tile timer ${vm.keepTime !== null && Math.round(vm.keepTime) === m ? "active" : ""}" data-act="keep_time" data-v="${m}" role="button" tabindex="0">
          <ha-icon icon="mdi:timer-outline"></ha-icon><b>${m >= 120 && m % 60 === 0 ? m / 60 + " h" : m + " min"}</b></div>`).join("")}
      </div>` : "";
    const readyHtml = vm.readyAt ? `
      <div class="row ready">
        <div class="tile wide ${vm.readyAt.on ? "on" : ""}" data-act="ready_toggle" role="button" tabindex="0">
          <ha-icon icon="${vm.readyAt.on ? "mdi:alarm-check" : "mdi:alarm-off"}"></ha-icon>
          <div><b>${t("ready_at", { t: vm.readyAt.time })}</b><span>${vm.readyAt.on ? t("ready_start", { t: vm.readyAt.start }) : t("ready_off")}</span></div></div>
        <div class="tile" data-act="more" data-id="${esc(vm.ent.ready_at)}" role="button" tabindex="0"><ha-icon icon="mdi:clock-edit-outline"></ha-icon><b>${t("ready_set")}</b></div>
      </div>` : "";
    const counterName = { today: t("boils_today"), cleaning: t("cleaning"), descaling: t("descaling") };
    const countersHtml = vm.counters.length ? `
      <div class="row" style="grid-template-columns: repeat(${vm.counters.length}, 1fr)">
        ${vm.counters.map((x) => `<div class="tile counter ${x.key} ${x.due ? "due" : ""}" data-hold="reset" data-id="${esc(x.id)}" data-name="${counterName[x.key]}"
            data-act="more" title="${x.every ? t("hold_reset") : ""}" role="button" tabindex="0">
          <ha-icon icon="${x.icon}"></ha-icon><b>${x.v}${x.every ? " / " + x.every : ""}</b><span>${counterName[x.key]}</span></div>`).join("")}
      </div>` : "";
    return `<style>${CSS}</style>
    <ha-card class="mode-${vm.mode}">
      ${header}
      ${status}
      ${show.presets ? tabsHtml + rowHtml : ""}
      ${show.controls ? `<div class="row two">
        <div class="tile big boil ${vm.on ? "on" : ""}" data-act="start" role="button" tabindex="0">
          <ha-icon icon="mdi:kettle-steam"></ha-icon><b>${t("boil")}</b><span>${boilLabel}</span></div>
        <div class="tile big stop ${vm.on || vm.keep ? "on" : ""}" data-act="stop" role="button" tabindex="0">
          <ha-icon icon="mdi:stop-circle-outline"></ha-icon><b>${t("stop")}</b><span>${stopLabel}</span></div>
      </div>` : ""}
      ${show.keep_warm ? keepHtml : ""}
      ${show.ready_at ? readyHtml : ""}
      ${show.counters ? countersHtml : ""}
      ${show.stats && vm.stats ? `<div class="stats"><ha-icon icon="mdi:lightning-bolt-outline"></ha-icon>${esc(vm.stats)}</div>` : ""}
    </ha-card>`;
  }

  _call(domain, service, data) { return this._hass.callService(domain, service, data); }

  _setTarget(vm, v) {
    if (vm.wh) return this._call("water_heater", "set_temperature", { entity_id: vm.ent.water_heater, temperature: v });
    return this._call("number", "set_value", { entity_id: vm.ent.target, value: v });
  }

  _start(vm) {
    const e = vm.ent;
    if (vm.wh) {
      const modes = (this._hass.states[e.water_heater].attributes.operation_list || []).filter((m) => m !== "off");
      if (modes.length) return this._call("water_heater", "set_operation_mode", { entity_id: e.water_heater, operation_mode: modes.includes("electric") ? "electric" : modes[0] });
      return this._call("water_heater", "turn_on", { entity_id: e.water_heater });
    }
    return this._call("switch", "turn_on", { entity_id: e.start });
  }

  // a drink: target, keep warm, kettle work mode; remembered for the steeping countdown and the blueprints
  _drink(vm, key, andStart) {
    const d = vm.drinks.find((x) => x.key === key);
    if (!d) return;
    const e = vm.ent;
    const rec = { key: d.key, name: d.name, icon: d.icon, t: d.t, then: d.then, keep: d.keep || 0, steep: d.steep || 0, at: Date.now() };
    // the integration's drink select applies a built-in drink in Home Assistant (target, keep warm, its stages)
    const sel = e.drink && e.drink.startsWith("select.") && this._hass.states[e.drink];
    if (sel && (sel.attributes.options || []).includes(d.key) && d.t === this._snap(vm, DRINKS[d.key] ? (vm.F ? this._toF(DRINKS[d.key].temp) : DRINKS[d.key].temp) : d.t)) {
      store.set("drink:" + vm.key, rec);
      this._call("select", "select_option", { entity_id: e.drink, option: d.key });
      if (andStart) setTimeout(() => this._start(vm), 1200);
      this._sig = null;
      this._render();
      return;
    }
    const mS = e.mode && this._hass.states[e.mode];
    const ent = this._hass.entities && this._hass.entities[e.mode];
    if (mS && ent && ent.translation_key === "kettle_work_mode") {
      const want = d.keep || d.then != null ? (d.t >= vm.boil ? "temp_boiling" : "temp_setting") : d.t >= vm.boil ? "boiling_quick" : "temp_setting";
      if ((mS.attributes.options || []).includes(want)) this._call("select", "select_option", { entity_id: e.mode, option: want });
    }
    this._setTarget(vm, d.t);
    if (d.keep && d.then == null) {
      if (e.keep_warm_time) this._call("number", "set_value", { entity_id: e.keep_warm_time, value: Math.min(d.keep, vm.keepMax || d.keep) });
      if (e.keep_warm) this._call("switch", "turn_on", { entity_id: e.keep_warm });
    } else if (vm.keep && e.keep_warm) this._call("switch", "turn_off", { entity_id: e.keep_warm });
    store.set("drink:" + vm.key, rec);
    if (e.drink && e.drink.startsWith("input_text.") && this._hass.states[e.drink]) {
      const v = JSON.stringify({ k: d.key, n: d.name, t: d.t, then: d.then, keep: d.keep || 0, steep: d.steep || 0 });
      this._call("input_text", "set_value", { entity_id: e.drink, value: v.slice(0, 255) });
    }
    if (andStart) setTimeout(() => this._start(vm), 400);
    this._sig = null;
    this._render();
  }

  _click(ev) {
    if (this._held) { this._held = false; return; }
    const el = ev.target.closest && ev.target.closest("[data-act]");
    if (!el) return;
    const vm = this._vm, e = vm.ent, act = el.dataset.act;
    const v = num(el.dataset.v);
    if (act === "target") {
      store.set("drink:" + vm.key, null);
      this._setTarget(vm, v);
    } else if (act === "drink") {
      this._drink(vm, el.dataset.v, false);
    } else if (act === "mode") {
      this._call("select", "select_option", { entity_id: e.mode, option: el.dataset.v });
    } else if (act === "tab") {
      this._tab = el.dataset.v;
      store.set("tab:" + vm.key, this._tab);
      this._sig = null;
      this._render();
    } else if (act === "start") {
      this._start(vm);
    } else if (act === "stop") {
      const ids = [e.start, e.keep_warm].filter(Boolean);
      if (vm.wh) {
        const modes = this._hass.states[e.water_heater].attributes.operation_list || [];
        if (modes.includes("off")) this._call("water_heater", "set_operation_mode", { entity_id: e.water_heater, operation_mode: "off" });
        else this._call("water_heater", "turn_off", { entity_id: e.water_heater });
      }
      if (ids.length) this._call("switch", "turn_off", { entity_id: ids });
    } else if (act === "keep") {
      this._call("switch", "toggle", { entity_id: e.keep_warm });
    } else if (act === "keep_time") {
      this._call("number", "set_value", { entity_id: e.keep_warm_time, value: v });
    } else if (act === "ready_toggle") {
      if (e.ready_at_on) this._call(e.ready_at_on.split(".")[0], "toggle", { entity_id: e.ready_at_on });
      else this._more(e.ready_at);
    } else if (act === "more") {
      this._more(el.dataset.id);
    }
  }

  _more(id) {
    if (id) this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  // hold: a temperature / drink = set it and boil at once; a counter = reset it (after cleaning / descaling)
  _down(ev) {
    const el = ev.target.closest && ev.target.closest("[data-hold]");
    if (!el) return;
    clearTimeout(this._hold);
    this._hold = setTimeout(() => {
      this._held = true;
      const vm = this._vm;
      if (el.dataset.hold === "reset") {
        const cnt = vm.counters.find((x) => x.id === el.dataset.id);
        if (cnt && cnt.reset && window.confirm(tr(this._hass, "reset_confirm", { n: el.dataset.name }))) this._call(cnt.reset.d, cnt.reset.s, { entity_id: cnt.reset.id });
      } else if (el.dataset.act === "drink") {
        this._drink(vm, el.dataset.v, true);
      } else if (el.dataset.act === "target") {
        store.set("drink:" + vm.key, null);
        this._setTarget(vm, num(el.dataset.v));
        setTimeout(() => this._start(vm), 400);
      }
      if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) { /* not supported */ }
    }, 600);
  }
}

const CSS = `
  :host { --sk-blue: var(--kettle-blue, #4f8cff); --sk-purple: var(--kettle-purple, #c77dff); --sk-green: var(--kettle-green, #35d66b);
          --sk-red: var(--kettle-red, #ff4d6d); --sk-yellow: var(--kettle-yellow, #ffc107); --sk-peach: var(--kettle-peach, #ff9800);
          --sk-teal: var(--kettle-teal, #2ec4b6);
          --sk-line: var(--divider-color, rgba(127,127,127,.25)); --sk-radius: var(--kettle-radius, 12px); }
  ha-card { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
  ha-card.compact { padding: 8px; gap: 6px; }
  .hdr { display: flex; align-items: center; gap: 6px; padding: 0 2px; opacity: .55; }
  .hdr ha-icon { --mdc-icon-size: 15px; }
  .hdr span { font-size: 10.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .status { display: grid; grid-template-columns: auto 1fr auto; grid-template-areas: "i t v" "b b b"; align-items: center; column-gap: 10px; row-gap: 12px;
            padding: 12px 14px; border: 1px solid var(--sk-line); border-radius: var(--sk-radius); cursor: pointer; --c: var(--secondary-text-color); }
  .compact .status { grid-template-columns: auto 1fr auto auto; grid-template-areas: "i t v c" "b b b b"; row-gap: 8px; padding: 10px 12px; }
  .sicon { grid-area: i; color: var(--c); --mdc-icon-size: 26px; }
  .mode-idle .sicon, .mode-off .sicon { opacity: .6; }
  .stext { grid-area: t; min-width: 0; }
  .sname { font-size: 13px; font-weight: 700; }
  .sinfo { font-size: 12px; font-weight: 600; opacity: .8; margin-top: 3px; }
  .stemp { grid-area: v; font-size: 22px; font-weight: 800; }
  .cbtn { grid-area: c; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%;
          border: 1px solid var(--sk-line); --c: var(--sk-purple); color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent); }
  .cbtn.stop { --c: var(--sk-red); }
  .bar { grid-area: b; height: 8px; border-radius: 4px; background: rgba(127,127,127,.22); overflow: hidden; }
  .fill { height: 100%; border-radius: 4px; background: var(--c); transition: width .6s ease; }
  .mode-heat .status { --c: var(--sk-peach); }
  .mode-done .status { --c: var(--sk-green); }
  .mode-warm .status { --c: var(--sk-yellow); }
  .mode-fault .status, .status.low { --c: var(--sk-red); }
  .mode-idle .status .fill, .mode-off .status .fill { opacity: .55; }
  .tabs { display: flex; gap: 6px; margin-bottom: -2px; }
  .tab { font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 999px; border: 1px solid var(--sk-line); cursor: pointer; opacity: .7; user-select: none; }
  .tab.sel { opacity: 1; border-color: color-mix(in srgb, var(--sk-teal) 70%, transparent); background: color-mix(in srgb, var(--sk-teal) 16%, transparent); }
  .row { display: grid; gap: 8px; }
  .row.two { grid-template-columns: 1fr 1fr; }
  .row.ready { grid-template-columns: 3fr 1fr; }
  .tile { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 10px 4px; min-width: 0; text-align: center;
          border: 1px solid var(--sk-line); border-radius: var(--sk-radius); cursor: pointer; user-select: none; -webkit-user-select: none;
          -webkit-touch-callout: none; transition: background .2s, border-color .2s, transform .1s; --c: var(--sk-blue); }
  .tile:active { transform: scale(.97); }
  .tile ha-icon { color: var(--c); --mdc-icon-size: 20px; }
  .tile b { font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .tile span { font-size: 11px; font-weight: 600; opacity: .75; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .tile.wide { flex-direction: row; justify-content: flex-start; gap: 10px; padding: 10px 14px; text-align: left; --c: var(--sk-purple); }
  .tile.wide div { display: flex; flex-direction: column; min-width: 0; }
  .tile.wide.on { --c: var(--sk-teal); background: color-mix(in srgb, var(--sk-teal) 14%, transparent); border-color: color-mix(in srgb, var(--sk-teal) 70%, transparent); }
  .tile.active { --c: var(--sk-green); background: color-mix(in srgb, var(--sk-green) 20%, transparent); border-color: color-mix(in srgb, var(--sk-green) 70%, transparent);
                 box-shadow: 0 0 10px color-mix(in srgb, var(--sk-green) 35%, transparent); }
  .drink { --c: var(--sk-teal); }
  .mode { --c: var(--sk-teal); }
  .tile.big { padding: 14px 6px; }
  .tile.big ha-icon { --mdc-icon-size: 26px; }
  .tile.big b { font-size: 14px; text-transform: uppercase; letter-spacing: .03em; }
  .boil { --c: var(--sk-purple); background: color-mix(in srgb, var(--sk-purple) 14%, transparent); border-color: color-mix(in srgb, var(--sk-purple) 70%, transparent); }
  .boil.on { --c: var(--sk-peach); background: color-mix(in srgb, var(--sk-peach) 18%, transparent); border-color: var(--sk-peach);
             box-shadow: 0 0 12px color-mix(in srgb, var(--sk-peach) 40%, transparent); }
  .stop { --c: var(--sk-red); background: color-mix(in srgb, var(--sk-red) 7%, transparent); border-color: color-mix(in srgb, var(--sk-red) 25%, transparent); opacity: .55; }
  .stop.on { opacity: 1; background: color-mix(in srgb, var(--sk-red) 16%, transparent); border-color: color-mix(in srgb, var(--sk-red) 75%, transparent); }
  .keep { --c: var(--sk-purple); }
  .keep.on { --c: var(--sk-yellow); background: color-mix(in srgb, var(--sk-yellow) 16%, transparent); border-color: color-mix(in srgb, var(--sk-yellow) 70%, transparent); }
  .timer { --c: var(--sk-purple); }
  .counter.today { --c: var(--sk-blue); }
  .counter.cleaning, .counter.descaling { --c: var(--sk-red); }
  .counter.due { background: color-mix(in srgb, var(--sk-red) 14%, transparent); border-color: color-mix(in srgb, var(--sk-red) 70%, transparent); }
  .stats { display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 600; opacity: .7; padding: 0 4px; }
  .stats ha-icon { --mdc-icon-size: 14px; color: var(--sk-yellow); }
  .empty { display: flex; gap: 10px; align-items: center; padding: 8px; opacity: .8; }
`;

// ---- visual editor (ha-form)
class SmartKettleCardEditor extends HTMLElement {
  setConfig(config) { this._config = Object.assign({}, config || {}); this._render(); }
  set hass(hass) { this._hass = hass; if (this._form) this._form.hass = hass; else this._render(); }

  _schema() {
    const L = (k) => tr(this._hass, k);
    const ent = (domain) => ({ selector: { entity: { domain } } });
    return [
      { name: "device", selector: { device: {} } },
      { type: "grid", name: "", schema: [
        { name: "title", selector: { text: {} } },
        { name: "profile", selector: { select: { mode: "dropdown", options: Object.keys(PROFILES).map((k) => ({ value: k, label: PROFILES[k].name })) } } },
      ] },
      { type: "grid", name: "", schema: [
        { name: "presets", selector: { text: {} } },
        { name: "keep_warm_times", selector: { text: {} } },
      ] },
      { name: "drinks", selector: { select: { multiple: true, mode: "list", options: Object.keys(DRINKS).map((k) => ({ value: k, label: L("d_" + k) + " – " + DRINKS[k].temp + " °C" })) } } },
      { type: "grid", name: "", schema: [
        { name: "compact", selector: { boolean: {} } },
        { name: "water_hardness", selector: { select: { mode: "dropdown", options: Object.keys(HARDNESS).map((k) => ({ value: k, label: L("hard_" + k) })) } } },
      ] },
      { type: "expandable", name: "entities", title: L("e_entities"), schema: [
        { name: "start", ...ent("switch") }, { name: "target", ...ent("number") }, { name: "current", ...ent("sensor") },
        { name: "status", ...ent("sensor") }, { name: "keep_warm", ...ent("switch") }, { name: "keep_warm_time", ...ent("number") },
        { name: "mode", ...ent("select") }, { name: "water_heater", ...ent("water_heater") }, { name: "start_temp", ...ent(["input_number", "sensor"]) },
        { name: "drink", ...ent("input_text") }, { name: "ready_at", ...ent("input_datetime") }, { name: "ready_at_on", ...ent("input_boolean") },
      ] },
      { type: "expandable", name: "counters", title: L("e_counters"), schema: [
        { name: "today", ...ent("counter") }, { name: "cleaning", ...ent("counter") }, { name: "descaling", ...ent("counter") },
        { type: "grid", name: "", schema: [
          { name: "cleaning_every", selector: { number: { min: 1, max: 500, mode: "box" } } },
          { name: "descaling_every", selector: { number: { min: 1, max: 1000, mode: "box" } } },
        ] },
      ] },
      { type: "expandable", name: "energy", title: L("e_energy"), schema: [
        { type: "grid", name: "", schema: [
          { name: "power", selector: { number: { min: 500, max: 3500, step: 50, mode: "box", unit_of_measurement: "W" } } },
          { name: "rate", selector: { number: { min: 5, max: 150, step: 0.5, mode: "box", unit_of_measurement: "°/min" } } },
          { name: "price", selector: { number: { min: 0, max: 100, step: 0.01, mode: "box" } } },
        ] },
        { name: "price_entity", ...ent(["sensor", "input_number", "number"]) },
        { name: "energy_entity", ...ent("sensor") },
      ] },
    ];
  }

  _data() {
    const c = Object.assign({}, this._config);
    for (const k of ["presets", "keep_warm_times"]) if (Array.isArray(c[k])) c[k] = c[k].join(", ");
    // own drink objects cannot be edited in the form – the list shows only the built-in keys
    if (Array.isArray(c.drinks)) c.drinks = c.drinks.filter((d) => typeof d === "string");
    else if (!c.drinks) c.drinks = DEFAULT_DRINKS.slice();
    // these live at the top level of the config, the form shows them inside the sections
    c.counters = Object.assign({}, c.counters || {}, { cleaning_every: c.cleaning_every, descaling_every: c.descaling_every });
    c.energy = { power: c.power, rate: c.rate, price: c.price, price_entity: c.price_entity, energy_entity: c.energy_entity };
    for (const k of ["power", "rate", "price", "price_entity", "energy_entity"]) delete c[k];
    return c;
  }

  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => tr(this._hass, "e_" + s.name);
      this._form.computeHelper = (s) => { const h = tr(this._hass, "h_" + s.name); return h === "h_" + s.name ? undefined : h; };
      this._form.addEventListener("value-changed", (ev) => this._changed(ev.detail.value));
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = this._schema();
    this._form.data = this._data();
  }

  _changed(v) {
    const c = Object.assign({}, v);
    for (const k of ["presets", "keep_warm_times"]) {
      const l = listOf(c[k]);
      if (l && l.length) c[k] = l; else delete c[k];
    }
    const own = Array.isArray(this._config.drinks) ? this._config.drinks.filter((d) => typeof d === "object") : [];
    const keys = Array.isArray(c.drinks) ? c.drinks : [];
    if (!own.length && keys.join() === DEFAULT_DRINKS.join()) delete c.drinks; else c.drinks = keys.concat(own);
    const cnt = Object.assign({}, c.counters || {});
    for (const k of ["cleaning_every", "descaling_every"]) { if (cnt[k]) c[k] = cnt[k]; else delete c[k]; delete cnt[k]; }
    for (const k of Object.keys(cnt)) if (!cnt[k]) delete cnt[k];
    if (Object.keys(cnt).length) c.counters = cnt; else delete c.counters;
    const en = c.energy || {};
    for (const k of ["power", "rate", "price", "price_entity", "energy_entity"]) if (en[k] !== undefined && en[k] !== "" && en[k] !== null) c[k] = en[k];
    delete c.energy;
    if (c.entities) { for (const k of Object.keys(c.entities)) if (!c.entities[k]) delete c.entities[k]; if (!Object.keys(c.entities).length) delete c.entities; }
    for (const k of Object.keys(c)) if (c[k] === "" || c[k] === undefined || c[k] === null || c[k] === false) delete c[k];
    if (c.profile === "auto") delete c.profile;
    this._config = c;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: c }, bubbles: true, composed: true }));
  }
}

customElements.define(CARD, SmartKettleCard);
customElements.define(CARD + "-editor", SmartKettleCardEditor);
window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD, name: "Smart Kettle Card", preview: true, documentationURL: "https://github.com/jotuera/smart-kettle-ha",
  description: "Tuya / Smart Life Wi-Fi kettle: progress and ETA, temperatures and drinks, boil / stop, keep warm, steeping, ready-at, energy, counters.",
});
console.info(`%c SMART-KETTLE-CARD %c ${VERSION} `, "color:#fff;background:#c77dff;font-weight:700", "color:#c77dff;background:#222;font-weight:700");
