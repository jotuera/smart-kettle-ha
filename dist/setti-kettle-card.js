/*
 * SETTI+ Kettle Card – a Lovelace card for Tuya / Smart Life Wi-Fi kettles
 * Copyright (c) 2026 JoTu – PolyForm Noncommercial 1.0.0 (see LICENSE).
 *
 *   type: custom:setti-kettle-card
 *   device: <device id>           # optional – the first kettle is found automatically
 *   profile: auto                 # auto | setti_kt950w | gotze_jensen_kt975k | … (see PROFILES)
 *   presets: [40, 55, 70, 85, 100]        # optional – overrides the profile
 *   keep_warm_times: [30, 60, 120]        # optional – minutes
 *   entities: { start, target, current, status, keep_warm, keep_warm_time, water_heater, start_temp }
 *   counters: { today, cleaning, descaling }   # optional counter.* helpers (packages/setti_kettle.yaml)
 *   cleaning_every: 20
 *   descaling_every: 60
 *
 * Two ways to talk to the kettle:
 *  - core Tuya (category "bh"): switch Start, number Temperature, sensor Current temperature, sensor Status,
 *    switch Heat preservation, number Heat preservation time – found on the device by their translation keys,
 *    so the entity ids and the HA language do not matter;
 *  - tuya-local: one water_heater entity (+ keep warm switch / time number, status sensor of the same device).
 * Texts are generated from i18n/*.json by tools/build_i18n.py – edit the JSON files, not the TEXTS block.
 */

const VERSION = "0.1.0";
const CARD = "setti-kettle-card";

// ---- kettle profiles: card presets, keep-warm chips and the heating rate used before the first boil is measured
// presets in °C; for a °F kettle the °F list is used (or the °C list converted and rounded to 5 °F)
const PROFILES = {
  auto: { name: "Auto (from the entities)", presets: [40, 55, 70, 85, 100], keep: [30, 60, 120], rate: 40 },
  setti_kt950w: { name: "SETTI+ KT950W", presets: [40, 55, 70, 85, 100], keep: [30, 60, 120], rate: 40 },
  gotze_jensen_kt975k: { name: "Götze & Jensen KT975K", presets: [40, 55, 80, 90, 100], keep: [30, 60, 120], rate: 40 },
  aeno_ek7s: { name: "AENO EK7S", presets: [40, 55, 80, 90, 100], keep: [30, 60, 120, 240], rate: 40 },
  fiesta_dk1g: { name: "Fiesta DK1G", presets: [45, 60, 85, 90, 100], keep: [30, 60, 120, 360], rate: 40 },
  silvercrest: { name: "SilverCrest (Lidl Home)", presets: [40, 60, 70, 80, 90, 100], keep: [30, 60, 90, 120], rate: 38 },
  webber_wk115: { name: "Webber PRISME WK115", presets: [45, 55, 65, 75, 85, 100], keep: [60, 120, 360], rate: 36 },
  nedis_kawk: { name: "Nedis SmartLife kettle", presets: [70, 80, 90, 100], keep: [30, 60], rate: 38 },
  weekett: { name: "Weekett / Weeket", presets: [40, 70, 80, 90, 100], presets_f: [104, 158, 176, 194, 212], keep: [30, 60, 120], rate: 40 },
  korex: { name: "Korex AX-WF306N", presets: [50, 70, 85, 95, 100], keep: [], rate: 40 },
  fahrenheit: { name: "Generic °F kettle", presets_f: [104, 140, 175, 195, 212], keep: [30, 60, 120], rate: 72 },
};

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
  water_heater: [["water_heater"], ["kettle"], /./],
};

// counters created by packages/setti_kettle.yaml – used when they exist and none are configured
const DEFAULT_COUNTERS = {
  today: "counter.kettle_boils_today", cleaning: "counter.kettle_boils_since_cleaning",
  descaling: "counter.kettle_boils_since_descaling",
};

// ---- card texts, generated from i18n/*.json by tools/build_i18n.py – do not edit by hand
// TEXTS-BEGIN
const TEXTS = {
  en: {"almost": "almost ready", "boil": "Boil", "boil_label": "Target {t} · now {c}", "boiled": "Boiled · {t}", "boiling_to": "Boiling to {t}", "boils_today": "Boils today", "cleaning": "Cleaning", "descaling": "Descaling", "e_cleaning": "Boils since cleaning", "e_cleaning_every": "Clean every … boils", "e_counters": "Counters (optional)", "e_current": "Current temperature", "e_descaling": "Boils since descaling", "e_descaling_every": "Descale every … boils", "e_device": "Kettle (device)", "e_entities": "Entities (optional – found automatically)", "e_keep_warm": "Keep warm switch", "e_keep_warm_time": "Keep warm time", "e_keep_warm_times": "Keep-warm times (min)", "e_presets": "Temperature presets", "e_profile": "Kettle profile", "e_rate": "Heating rate", "e_start": "Start switch", "e_start_temp": "Start temperature helper", "e_status": "Status", "e_target": "Target temperature", "e_title": "Title", "e_today": "Boils today", "e_water_heater": "Water heater (tuya-local)", "fault_info": "check the water and the base", "h_device": "Leave empty – the first kettle is found automatically.", "h_keep_warm_times": "Comma separated minutes, e.g. 30, 60, 120.", "h_presets": "Comma separated, e.g. 40, 55, 70, 85, 100 – overrides the profile.", "h_rate": "Used for the ETA before the card has measured your kettle. Empty = learned / profile.", "h_start_temp": "Not needed – the card reads the start temperature from the recorder.", "heating_to": "Heating to {t}", "hold_reset": "hold to reset", "idle": "Kettle ready", "idle_hot": "the water is already {t}", "idle_need": "to {t} in about {eta}", "keep_on": "keep warm is on", "keep_warm": "Keep warm", "keeping": "Keeping warm · {t}", "keeping_for": "keeping warm for {m} min", "keeping_info": "the kettle holds the temperature", "left": "about {eta} left · {rate}", "no_kettle": "No kettle found – pick the device or the entities in the card editor.", "offline": "Kettle unavailable", "offline_info": "check Wi-Fi and the base", "reached": "Ready · {t}", "ready_ago": "ready {eta} ago", "reset_confirm": "Reset the counter “{n}”?", "st_boiling": "boiling", "st_cooling": "cooling", "st_done": "ready", "st_heating": "heating", "st_no_water": "no water", "st_standby": "standby", "st_warm": "keeping warm", "stop": "Stop", "stop_heating": "stop heating", "stop_idle": "nothing is heating", "stop_keep": "switch off keep warm", "title": "Kettle"},
  pl: {"almost": "prawie gotowe", "boil": "Gotuj", "boil_label": "Cel {t} · teraz {c}", "boiled": "Zagotowane · {t}", "boiling_to": "Gotowanie do {t}", "boils_today": "Gotowania dziś", "cleaning": "Mycie", "descaling": "Odkamienianie", "e_cleaning": "Gotowania od mycia", "e_cleaning_every": "Myj co … gotowań", "e_counters": "Liczniki (opcjonalnie)", "e_current": "Temperatura bieżąca", "e_descaling": "Gotowania od odkamieniania", "e_descaling_every": "Odkamieniaj co … gotowań", "e_device": "Czajnik (urządzenie)", "e_entities": "Encje (opcjonalnie – wykrywane automatycznie)", "e_keep_warm": "Przełącznik podtrzymania", "e_keep_warm_time": "Czas podtrzymania", "e_keep_warm_times": "Czasy podtrzymania (min)", "e_presets": "Temperatury (przyciski)", "e_profile": "Profil czajnika", "e_rate": "Tempo grzania", "e_start": "Przełącznik Start", "e_start_temp": "Pomocnik temperatury startowej", "e_status": "Status", "e_target": "Temperatura zadana", "e_title": "Tytuł", "e_today": "Gotowania dziś", "e_water_heater": "Podgrzewacz wody (tuya-local)", "fault_info": "sprawdź wodę i podstawę", "h_device": "Zostaw puste – pierwszy czajnik zostanie znaleziony automatycznie.", "h_keep_warm_times": "Minuty po przecinku, np. 30, 60, 120.", "h_presets": "Po przecinku, np. 40, 55, 70, 85, 100 – zastępuje profil.", "h_rate": "Do szacowania czasu, zanim karta zmierzy Twój czajnik. Puste = wyuczone / z profilu.", "h_start_temp": "Niepotrzebny – karta odczytuje temperaturę startową z historii.", "heating_to": "Grzanie do {t}", "hold_reset": "przytrzymaj, aby wyzerować", "idle": "Czajnik gotowy", "idle_hot": "woda ma już {t}", "idle_need": "do {t} ok. {eta}", "keep_on": "podtrzymywanie temperatury włączone", "keep_warm": "Podtrzymuj", "keeping": "Podtrzymywanie · {t}", "keeping_for": "podtrzymuje jeszcze {m} min", "keeping_info": "czajnik utrzymuje temperaturę", "left": "zostało ok. {eta} · {rate}", "no_kettle": "Nie znaleziono czajnika – wybierz urządzenie lub encje w edytorze karty.", "offline": "Czajnik niedostępny", "offline_info": "sprawdź Wi-Fi i podstawę", "reached": "Gotowe · {t}", "ready_ago": "gotowe {eta} temu", "reset_confirm": "Wyzerować licznik „{n}”?", "st_boiling": "gotuje", "st_cooling": "stygnie", "st_done": "gotowe", "st_heating": "grzeje", "st_no_water": "brak wody", "st_standby": "czuwa", "st_warm": "podtrzymuje", "stop": "Stop", "stop_heating": "przerwij grzanie", "stop_idle": "nic nie grzeje", "stop_keep": "wyłącz podtrzymywanie", "title": "Czajnik"},
  de: {"almost": "gleich fertig", "boil": "Kochen", "boil_label": "Ziel {t} · jetzt {c}", "boiled": "Gekocht · {t}", "boiling_to": "Kochen auf {t}", "boils_today": "Heute gekocht", "cleaning": "Reinigen", "descaling": "Entkalken", "e_cleaning": "Kochvorgänge seit Reinigung", "e_cleaning_every": "Reinigen alle … Kochvorgänge", "e_counters": "Zähler (optional)", "e_current": "Aktuelle Temperatur", "e_descaling": "Kochvorgänge seit Entkalkung", "e_descaling_every": "Entkalken alle … Kochvorgänge", "e_device": "Wasserkocher (Gerät)", "e_entities": "Entitäten (optional – automatisch gefunden)", "e_keep_warm": "Warmhalte-Schalter", "e_keep_warm_time": "Warmhaltezeit", "e_keep_warm_times": "Warmhaltezeiten (min)", "e_presets": "Temperatur-Tasten", "e_profile": "Kocher-Profil", "e_rate": "Heizrate", "e_start": "Start-Schalter", "e_start_temp": "Helfer Starttemperatur", "e_status": "Status", "e_target": "Zieltemperatur", "e_title": "Titel", "e_today": "Heute gekocht", "e_water_heater": "Warmwasserbereiter (tuya-local)", "fault_info": "Wasser und Sockel prüfen", "h_device": "Leer lassen – der erste Wasserkocher wird automatisch gefunden.", "h_keep_warm_times": "Minuten kommagetrennt, z. B. 30, 60, 120.", "h_presets": "Kommagetrennt, z. B. 40, 55, 70, 85, 100 – ersetzt das Profil.", "h_rate": "Für die Restzeit, bevor die Karte Ihren Kocher gemessen hat. Leer = gelernt / Profil.", "h_start_temp": "Nicht nötig – die Karte liest die Starttemperatur aus dem Verlauf.", "heating_to": "Erhitzen auf {t}", "hold_reset": "zum Zurücksetzen halten", "idle": "Wasserkocher bereit", "idle_hot": "das Wasser hat schon {t}", "idle_need": "auf {t} in ca. {eta}", "keep_on": "Warmhalten ist an", "keep_warm": "Warmhalten", "keeping": "Warmhalten · {t}", "keeping_for": "hält noch {m} min warm", "keeping_info": "der Kocher hält die Temperatur", "left": "noch ca. {eta} · {rate}", "no_kettle": "Kein Wasserkocher gefunden – Gerät oder Entitäten im Karteneditor wählen.", "offline": "Wasserkocher nicht erreichbar", "offline_info": "WLAN und Sockel prüfen", "reached": "Fertig · {t}", "ready_ago": "fertig vor {eta}", "reset_confirm": "Zähler „{n}“ zurücksetzen?", "st_boiling": "kocht", "st_cooling": "kühlt ab", "st_done": "fertig", "st_heating": "heizt", "st_no_water": "kein Wasser", "st_standby": "Standby", "st_warm": "hält warm", "stop": "Stopp", "stop_heating": "Heizen abbrechen", "stop_idle": "nichts heizt", "stop_keep": "Warmhalten ausschalten", "title": "Wasserkocher"},
  cs: {"almost": "téměř hotovo", "boil": "Vařit", "boil_label": "Cíl {t} · nyní {c}", "boiled": "Uvařeno · {t}", "boiling_to": "Vaření na {t}", "boils_today": "Vaření dnes", "cleaning": "Mytí", "descaling": "Odvápnění", "e_cleaning": "Vaření od mytí", "e_cleaning_every": "Mýt každých … vaření", "e_counters": "Počítadla (volitelné)", "e_current": "Aktuální teplota", "e_descaling": "Vaření od odvápnění", "e_descaling_every": "Odvápnit každých … vaření", "e_device": "Konvice (zařízení)", "e_entities": "Entity (volitelné – nalezeny automaticky)", "e_keep_warm": "Spínač udržování", "e_keep_warm_time": "Doba udržování", "e_keep_warm_times": "Doby udržování (min)", "e_presets": "Teploty (tlačítka)", "e_profile": "Profil konvice", "e_rate": "Rychlost ohřevu", "e_start": "Spínač Start", "e_start_temp": "Pomocník počáteční teploty", "e_status": "Stav", "e_target": "Cílová teplota", "e_title": "Název", "e_today": "Vaření dnes", "e_water_heater": "Ohřívač vody (tuya-local)", "fault_info": "zkontrolujte vodu a podstavec", "h_device": "Nechte prázdné – první konvice se najde automaticky.", "h_keep_warm_times": "Minuty oddělené čárkou, např. 30, 60, 120.", "h_presets": "Oddělené čárkou, např. 40, 55, 70, 85, 100 – nahrazuje profil.", "h_rate": "Pro odhad času, než karta změří vaši konvici. Prázdné = naučené / profil.", "h_start_temp": "Není potřeba – karta čte počáteční teplotu z historie.", "heating_to": "Ohřev na {t}", "hold_reset": "podržte pro vynulování", "idle": "Konvice připravena", "idle_hot": "voda už má {t}", "idle_need": "na {t} za cca {eta}", "keep_on": "udržování teploty zapnuto", "keep_warm": "Udržovat", "keeping": "Udržování · {t}", "keeping_for": "udržuje ještě {m} min", "keeping_info": "konvice udržuje teplotu", "left": "zbývá cca {eta} · {rate}", "no_kettle": "Konvice nenalezena – vyberte zařízení nebo entity v editoru karty.", "offline": "Konvice nedostupná", "offline_info": "zkontrolujte Wi-Fi a podstavec", "reached": "Hotovo · {t}", "ready_ago": "hotovo před {eta}", "reset_confirm": "Vynulovat počítadlo „{n}“?", "st_boiling": "vaří", "st_cooling": "chladne", "st_done": "hotovo", "st_heating": "hřeje", "st_no_water": "chybí voda", "st_standby": "pohotovost", "st_warm": "udržuje", "stop": "Stop", "stop_heating": "přerušit ohřev", "stop_idle": "nic nehřeje", "stop_keep": "vypnout udržování", "title": "Konvice"},
  sk: {"almost": "takmer hotovo", "boil": "Variť", "boil_label": "Cieľ {t} · teraz {c}", "boiled": "Uvarené · {t}", "boiling_to": "Varenie na {t}", "boils_today": "Varenia dnes", "cleaning": "Umývanie", "descaling": "Odvápnenie", "e_cleaning": "Varenia od umytia", "e_cleaning_every": "Umývať každých … varení", "e_counters": "Počítadlá (voliteľné)", "e_current": "Aktuálna teplota", "e_descaling": "Varenia od odvápnenia", "e_descaling_every": "Odvápniť každých … varení", "e_device": "Kanvica (zariadenie)", "e_entities": "Entity (voliteľné – nájdené automaticky)", "e_keep_warm": "Spínač udržiavania", "e_keep_warm_time": "Čas udržiavania", "e_keep_warm_times": "Časy udržiavania (min)", "e_presets": "Teploty (tlačidlá)", "e_profile": "Profil kanvice", "e_rate": "Rýchlosť ohrevu", "e_start": "Spínač Štart", "e_start_temp": "Pomocník počiatočnej teploty", "e_status": "Stav", "e_target": "Cieľová teplota", "e_title": "Názov", "e_today": "Varenia dnes", "e_water_heater": "Ohrievač vody (tuya-local)", "fault_info": "skontrolujte vodu a podstavec", "h_device": "Nechajte prázdne – prvá kanvica sa nájde automaticky.", "h_keep_warm_times": "Minúty oddelené čiarkou, napr. 30, 60, 120.", "h_presets": "Oddelené čiarkou, napr. 40, 55, 70, 85, 100 – nahrádza profil.", "h_rate": "Na odhad času, kým karta nezmeria vašu kanvicu. Prázdne = naučené / profil.", "h_start_temp": "Netreba – karta číta počiatočnú teplotu z histórie.", "heating_to": "Ohrev na {t}", "hold_reset": "podržte pre vynulovanie", "idle": "Kanvica pripravená", "idle_hot": "voda už má {t}", "idle_need": "na {t} o cca {eta}", "keep_on": "udržiavanie teploty zapnuté", "keep_warm": "Udržiavať", "keeping": "Udržiavanie · {t}", "keeping_for": "udržiava ešte {m} min", "keeping_info": "kanvica udržiava teplotu", "left": "zostáva cca {eta} · {rate}", "no_kettle": "Kanvica sa nenašla – vyberte zariadenie alebo entity v editore karty.", "offline": "Kanvica nedostupná", "offline_info": "skontrolujte Wi-Fi a podstavec", "reached": "Hotovo · {t}", "ready_ago": "hotovo pred {eta}", "reset_confirm": "Vynulovať počítadlo „{n}“?", "st_boiling": "varí", "st_cooling": "chladne", "st_done": "hotovo", "st_heating": "hreje", "st_no_water": "chýba voda", "st_standby": "pohotovosť", "st_warm": "udržiava", "stop": "Stop", "stop_heating": "prerušiť ohrev", "stop_idle": "nič nehreje", "stop_keep": "vypnúť udržiavanie", "title": "Kanvica"},
  fr: {"almost": "presque prêt", "boil": "Bouillir", "boil_label": "Cible {t} · actuel {c}", "boiled": "Bouilli · {t}", "boiling_to": "Ébullition à {t}", "boils_today": "Ébullitions aujourd'hui", "cleaning": "Nettoyage", "descaling": "Détartrage", "e_cleaning": "Ébullitions depuis le nettoyage", "e_cleaning_every": "Nettoyer toutes les … ébullitions", "e_counters": "Compteurs (facultatif)", "e_current": "Température actuelle", "e_descaling": "Ébullitions depuis le détartrage", "e_descaling_every": "Détartrer toutes les … ébullitions", "e_device": "Bouilloire (appareil)", "e_entities": "Entités (facultatif – trouvées automatiquement)", "e_keep_warm": "Interrupteur maintien au chaud", "e_keep_warm_time": "Durée du maintien", "e_keep_warm_times": "Durées de maintien (min)", "e_presets": "Températures (boutons)", "e_profile": "Profil de bouilloire", "e_rate": "Vitesse de chauffe", "e_start": "Interrupteur Start", "e_start_temp": "Entrée température de départ", "e_status": "État", "e_target": "Température cible", "e_title": "Titre", "e_today": "Ébullitions aujourd'hui", "e_water_heater": "Chauffe-eau (tuya-local)", "fault_info": "vérifiez l'eau et le socle", "h_device": "Laisser vide – la première bouilloire est trouvée automatiquement.", "h_keep_warm_times": "Minutes séparées par des virgules, ex. 30, 60, 120.", "h_presets": "Séparées par des virgules, ex. 40, 55, 70, 85, 100 – remplace le profil.", "h_rate": "Pour estimer le temps avant que la carte ait mesuré votre bouilloire. Vide = appris / profil.", "h_start_temp": "Inutile – la carte lit la température de départ dans l'historique.", "heating_to": "Chauffe à {t}", "hold_reset": "maintenir pour remettre à zéro", "idle": "Bouilloire prête", "idle_hot": "l'eau est déjà à {t}", "idle_need": "à {t} en env. {eta}", "keep_on": "maintien au chaud activé", "keep_warm": "Maintien au chaud", "keeping": "Maintien au chaud · {t}", "keeping_for": "maintient encore {m} min", "keeping_info": "la bouilloire maintient la température", "left": "encore env. {eta} · {rate}", "no_kettle": "Aucune bouilloire trouvée – choisissez l'appareil ou les entités dans l'éditeur de la carte.", "offline": "Bouilloire indisponible", "offline_info": "vérifiez le Wi-Fi et le socle", "reached": "Prêt · {t}", "ready_ago": "prêt il y a {eta}", "reset_confirm": "Remettre à zéro le compteur « {n} » ?", "st_boiling": "bout", "st_cooling": "refroidit", "st_done": "prêt", "st_heating": "chauffe", "st_no_water": "pas d'eau", "st_standby": "veille", "st_warm": "maintien au chaud", "stop": "Stop", "stop_heating": "arrêter la chauffe", "stop_idle": "rien ne chauffe", "stop_keep": "couper le maintien au chaud", "title": "Bouilloire"},
  it: {"almost": "quasi pronto", "boil": "Bolli", "boil_label": "Obiettivo {t} · ora {c}", "boiled": "Bollito · {t}", "boiling_to": "Ebollizione a {t}", "boils_today": "Bolliture oggi", "cleaning": "Pulizia", "descaling": "Decalcificazione", "e_cleaning": "Bolliture dalla pulizia", "e_cleaning_every": "Pulisci ogni … bolliture", "e_counters": "Contatori (facoltativi)", "e_current": "Temperatura attuale", "e_descaling": "Bolliture dalla decalcificazione", "e_descaling_every": "Decalcifica ogni … bolliture", "e_device": "Bollitore (dispositivo)", "e_entities": "Entità (facoltative – trovate automaticamente)", "e_keep_warm": "Interruttore mantenimento", "e_keep_warm_time": "Tempo di mantenimento", "e_keep_warm_times": "Tempi di mantenimento (min)", "e_presets": "Temperature (pulsanti)", "e_profile": "Profilo bollitore", "e_rate": "Velocità di riscaldamento", "e_start": "Interruttore Start", "e_start_temp": "Helper temperatura iniziale", "e_status": "Stato", "e_target": "Temperatura obiettivo", "e_title": "Titolo", "e_today": "Bolliture oggi", "e_water_heater": "Scaldacqua (tuya-local)", "fault_info": "controlla l'acqua e la base", "h_device": "Lascia vuoto – il primo bollitore viene trovato automaticamente.", "h_keep_warm_times": "Minuti separati da virgola, es. 30, 60, 120.", "h_presets": "Separate da virgola, es. 40, 55, 70, 85, 100 – sostituisce il profilo.", "h_rate": "Per stimare il tempo prima che la scheda misuri il tuo bollitore. Vuoto = appreso / profilo.", "h_start_temp": "Non serve – la scheda legge la temperatura iniziale dallo storico.", "heating_to": "Riscaldamento a {t}", "hold_reset": "tieni premuto per azzerare", "idle": "Bollitore pronto", "idle_hot": "l'acqua è già a {t}", "idle_need": "a {t} in ca. {eta}", "keep_on": "mantenimento attivo", "keep_warm": "Mantieni caldo", "keeping": "Mantenimento · {t}", "keeping_for": "mantiene ancora {m} min", "keeping_info": "il bollitore mantiene la temperatura", "left": "ancora ca. {eta} · {rate}", "no_kettle": "Nessun bollitore trovato – scegli il dispositivo o le entità nell'editor della scheda.", "offline": "Bollitore non disponibile", "offline_info": "controlla Wi-Fi e base", "reached": "Pronto · {t}", "ready_ago": "pronto {eta} fa", "reset_confirm": "Azzerare il contatore «{n}»?", "st_boiling": "bolle", "st_cooling": "si raffredda", "st_done": "pronto", "st_heating": "riscalda", "st_no_water": "manca acqua", "st_standby": "standby", "st_warm": "mantiene caldo", "stop": "Stop", "stop_heating": "interrompi riscaldamento", "stop_idle": "niente in riscaldamento", "stop_keep": "spegni mantenimento", "title": "Bollitore"},
  es: {"almost": "casi listo", "boil": "Hervir", "boil_label": "Objetivo {t} · ahora {c}", "boiled": "Hervido · {t}", "boiling_to": "Hirviendo a {t}", "boils_today": "Hervidos hoy", "cleaning": "Limpieza", "descaling": "Descalcificación", "e_cleaning": "Hervidos desde la limpieza", "e_cleaning_every": "Limpiar cada … hervidos", "e_counters": "Contadores (opcional)", "e_current": "Temperatura actual", "e_descaling": "Hervidos desde la descalcificación", "e_descaling_every": "Descalcificar cada … hervidos", "e_device": "Hervidor (dispositivo)", "e_entities": "Entidades (opcional – se encuentran automáticamente)", "e_keep_warm": "Interruptor mantener caliente", "e_keep_warm_time": "Tiempo de mantenimiento", "e_keep_warm_times": "Tiempos de mantenimiento (min)", "e_presets": "Temperaturas (botones)", "e_profile": "Perfil del hervidor", "e_rate": "Velocidad de calentamiento", "e_start": "Interruptor Start", "e_start_temp": "Ayudante de temperatura inicial", "e_status": "Estado", "e_target": "Temperatura objetivo", "e_title": "Título", "e_today": "Hervidos hoy", "e_water_heater": "Calentador de agua (tuya-local)", "fault_info": "revisa el agua y la base", "h_device": "Déjalo vacío – el primer hervidor se encuentra automáticamente.", "h_keep_warm_times": "Minutos separados por comas, p. ej. 30, 60, 120.", "h_presets": "Separadas por comas, p. ej. 40, 55, 70, 85, 100 – sustituye al perfil.", "h_rate": "Para estimar el tiempo antes de que la tarjeta mida tu hervidor. Vacío = aprendido / perfil.", "h_start_temp": "No hace falta – la tarjeta lee la temperatura inicial del historial.", "heating_to": "Calentando a {t}", "hold_reset": "mantén pulsado para poner a cero", "idle": "Hervidor listo", "idle_hot": "el agua ya está a {t}", "idle_need": "a {t} en aprox. {eta}", "keep_on": "mantener caliente activado", "keep_warm": "Mantener caliente", "keeping": "Manteniendo caliente · {t}", "keeping_for": "mantiene {m} min más", "keeping_info": "el hervidor mantiene la temperatura", "left": "quedan aprox. {eta} · {rate}", "no_kettle": "No se encontró ningún hervidor – elige el dispositivo o las entidades en el editor de la tarjeta.", "offline": "Hervidor no disponible", "offline_info": "revisa el Wi-Fi y la base", "reached": "Listo · {t}", "ready_ago": "listo hace {eta}", "reset_confirm": "¿Poner a cero el contador «{n}»?", "st_boiling": "hirviendo", "st_cooling": "enfriando", "st_done": "listo", "st_heating": "calentando", "st_no_water": "sin agua", "st_standby": "en espera", "st_warm": "manteniendo caliente", "stop": "Parar", "stop_heating": "detener el calentamiento", "stop_idle": "nada calienta", "stop_keep": "apagar mantener caliente", "title": "Hervidor"},
  nl: {"almost": "bijna klaar", "boil": "Koken", "boil_label": "Doel {t} · nu {c}", "boiled": "Gekookt · {t}", "boiling_to": "Koken tot {t}", "boils_today": "Vandaag gekookt", "cleaning": "Schoonmaken", "descaling": "Ontkalken", "e_cleaning": "Keer gekookt sinds schoonmaken", "e_cleaning_every": "Schoonmaken elke … keer", "e_counters": "Tellers (optioneel)", "e_current": "Huidige temperatuur", "e_descaling": "Keer gekookt sinds ontkalken", "e_descaling_every": "Ontkalken elke … keer", "e_device": "Waterkoker (apparaat)", "e_entities": "Entiteiten (optioneel – automatisch gevonden)", "e_keep_warm": "Warmhoudschakelaar", "e_keep_warm_time": "Warmhoudtijd", "e_keep_warm_times": "Warmhoudtijden (min)", "e_presets": "Temperaturen (knoppen)", "e_profile": "Waterkokerprofiel", "e_rate": "Opwarmsnelheid", "e_start": "Startschakelaar", "e_start_temp": "Helper starttemperatuur", "e_status": "Status", "e_target": "Doeltemperatuur", "e_title": "Titel", "e_today": "Vandaag gekookt", "e_water_heater": "Waterverwarmer (tuya-local)", "fault_info": "controleer het water en de voet", "h_device": "Leeg laten – de eerste waterkoker wordt automatisch gevonden.", "h_keep_warm_times": "Minuten komma-gescheiden, bv. 30, 60, 120.", "h_presets": "Komma-gescheiden, bv. 40, 55, 70, 85, 100 – vervangt het profiel.", "h_rate": "Voor de resttijd voordat de kaart uw waterkoker heeft gemeten. Leeg = geleerd / profiel.", "h_start_temp": "Niet nodig – de kaart leest de starttemperatuur uit de geschiedenis.", "heating_to": "Verwarmen tot {t}", "hold_reset": "vasthouden om op nul te zetten", "idle": "Waterkoker klaar", "idle_hot": "het water is al {t}", "idle_need": "tot {t} in ca. {eta}", "keep_on": "warmhouden staat aan", "keep_warm": "Warmhouden", "keeping": "Warmhouden · {t}", "keeping_for": "houdt nog {m} min warm", "keeping_info": "de waterkoker houdt de temperatuur", "left": "nog ca. {eta} · {rate}", "no_kettle": "Geen waterkoker gevonden – kies het apparaat of de entiteiten in de kaarteditor.", "offline": "Waterkoker niet beschikbaar", "offline_info": "controleer wifi en de voet", "reached": "Klaar · {t}", "ready_ago": "klaar sinds {eta}", "reset_confirm": "Teller „{n}” op nul zetten?", "st_boiling": "kookt", "st_cooling": "koelt af", "st_done": "klaar", "st_heating": "verwarmt", "st_no_water": "geen water", "st_standby": "stand-by", "st_warm": "houdt warm", "stop": "Stop", "stop_heating": "verwarmen stoppen", "stop_idle": "er verwarmt niets", "stop_keep": "warmhouden uitzetten", "title": "Waterkoker"},
};
// TEXTS-END

const LANGS = Object.keys(TEXTS);
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
  const devEnts = device ? Object.values(ents).filter((e) => e.device_id === device && !e.hidden && hass.states[e.entity_id]) : [];
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
      hit = others.filter((e) => !(role === "target" && /current/.test(e.entity_id)) && !(role === "keep_warm" && /time/.test(e.entity_id)))
        .sort((a, b) => a.entity_id.length - b.entity_id.length)[0];
    }
    if (hit) out[role] = hit.entity_id;
  }
  if (cfg.start_temp) out.start_temp = cfg.start_temp;
  return { device, ent: out };
}

// ---- the card
class SettiKettleCard extends HTMLElement {
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

  getCardSize() { return 8; }
  getGridOptions() { return { columns: 12, min_columns: 6, rows: "auto" }; }

  connectedCallback() {
    this._tick = setInterval(() => { if (this._busy()) { this._sig = null; this._render(); } }, 10000);
  }
  disconnectedCallback() { clearInterval(this._tick); }

  _busy() { return this._vm && (this._vm.mode === "heat" || this._vm.mode === "done"); }

  // ---- state of the kettle -> view model
  _model() {
    const hass = this._hass, c = this._config;
    const { device, ent } = findKettle(hass, c);
    const st = (id) => id && hass.states[id];
    const wh = st(ent.water_heater);
    const profile = PROFILES[c.profile] || PROFILES.auto;
    const vm = { device, ent, profile, wh: !!wh };

    const curS = wh || st(ent.current);
    vm.unit = (st(ent.current) && st(ent.current).attributes.unit_of_measurement) || (wh && wh.attributes.temperature_unit)
      || (hass.config && hass.config.unit_system && hass.config.unit_system.temperature) || "°C";
    const F = /F/.test(vm.unit);
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
    let presets = listOf(c.presets) || (F ? profile.presets_f || (profile.presets || []).map((x) => Math.round((x * 9 / 5 + 32) / 5) * 5) : profile.presets) || [];
    if (F && presets.includes(210)) presets = presets.map((x) => (x === 210 ? 212 : x));
    vm.presets = presets.filter((x) => (vm.min === null || x >= vm.min) && (vm.max === null || x <= vm.max));
    const keep = listOf(c.keep_warm_times) || profile.keep || [];
    vm.keepTimes = ent.keep_warm_time ? keep.filter((x) => vm.keepMax === null || x <= vm.keepMax) : [];

    // heating rate: learned from the last boils of this kettle, else the profile's
    const learned = num(localStorage.getItem(CARD + ":rate:" + (device || "x")));
    vm.rate = num(c.rate) || learned || (F ? (profile.rate || 40) * 1.8 : profile.rate || 40);
    vm.rateLearned = !c.rate && !!learned;
    vm.t0 = this._t0 && this._t0.key === vm.changed ? this._t0.value : null;
    if (ent.start_temp && st(ent.start_temp)) {
      const v = num(st(ent.start_temp).state);
      if (v !== null) vm.t0 = v;
    }

    // what the top tile shows
    const T = (v) => Math.round(v) + " " + vm.unit;
    const eta = (mins) => this._eta(mins);
    if (vm.unavailable) {
      Object.assign(vm, { mode: "off", icon: "mdi:kettle-off-outline", name: tr(hass, "offline"), info: tr(hass, "offline_info"), pct: 0, right: "" });
    } else if (vm.on && vm.cur !== null) {
      const start = vm.t0 !== null && vm.t0 < vm.cur + 0.5 ? vm.t0 : null;
      const s0 = start !== null ? start : vm.cur;
      const span = Math.max(1, vm.tgt - s0);
      const pct = start !== null ? Math.round(Math.min(100, Math.max(0, (vm.cur - start) / span * 100))) : Math.round(Math.min(100, vm.cur / vm.tgt * 100));
      const live = start !== null && vm.since > 0.15 && vm.cur > start + 2 ? (vm.cur - start) / vm.since : vm.rate;
      const rate = Math.max(vm.rate / 4, Math.min(vm.rate * 2, live));
      const left = Math.max(0, (vm.tgt - vm.cur) / rate);
      Object.assign(vm, {
        mode: "heat", icon: "mdi:kettle-steam", pct, right: T(vm.cur), liveRate: rate,
        name: tr(hass, vm.tgt >= vm.boil ? "boiling_to" : "heating_to", { t: T(vm.tgt) }),
        info: pct >= 100 || left < 0.05 ? tr(hass, "almost") : tr(hass, "left", { eta: eta(left), rate: Math.round(rate) + " " + vm.unit + "/min" }),
      });
    } else if (!vm.on && vm.since < 3 && vm.cur !== null && vm.cur >= vm.tgt - 3) {
      Object.assign(vm, {
        mode: "done", icon: "mdi:kettle-alert", pct: 100, right: T(vm.cur),
        name: tr(hass, vm.tgt >= vm.boil ? "boiled" : "reached", { t: T(vm.tgt) }),
        info: vm.keep ? tr(hass, "keep_on") : tr(hass, "ready_ago", { eta: eta(vm.since) }),
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

    // counters (optional)
    const cc = c.counters || {};
    vm.counters = [];
    const add = (key, icon, every) => {
      const id = cc[key] || (cc[key] === undefined && hass.states[DEFAULT_COUNTERS[key]] ? DEFAULT_COUNTERS[key] : null);
      if (!id || !hass.states[id]) return;
      const v = num(hass.states[id].state) || 0;
      vm.counters.push({ key, id, icon, v, every, due: every ? v >= every : false });
    };
    add("today", "mdi:kettle", 0);
    add("cleaning", "mdi:spray-bottle", num(c.cleaning_every) || 20);
    add("descaling", "mdi:kettle-alert", num(c.descaling_every) || 60);
    return vm;
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

  // learn the heating rate of this kettle after each boil to the target (start temperature known)
  _learn(vm) {
    const was = this._wasOn;
    this._wasOn = vm.on ? { t0: vm.t0, at: vm.changed, tgt: vm.tgt } : null;
    if (!was || vm.on || was.t0 === null || vm.cur === null) return;
    const mins = (vm.changed - was.at) / 60000;
    if (mins < 0.5 || mins > 15 || vm.cur < was.tgt - 3 || vm.cur - was.t0 < 20) return;
    const r = (vm.cur - was.t0) / mins;
    const key = CARD + ":rate:" + (vm.device || "x");
    const old = num(localStorage.getItem(key));
    try { localStorage.setItem(key, String(Math.round((old ? old * 0.7 + r * 0.3 : r) * 10) / 10)); } catch (e) { /* private mode */ }
  }

  _render() {
    if (!this._hass || !this._config) return;
    const hass = this._hass;
    const vm = this._model();
    this._vm = vm;
    this._fetchStart(vm);
    this._learn(vm);
    const watch = Object.values(vm.ent).concat(vm.counters.map((x) => x.id));
    const sig = [vm.mode, vm.t0, Math.floor(vm.since * 6), langOf(hass), JSON.stringify(this._config)]
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

  _html(vm) {
    const hass = this._hass, c = this._config;
    const show = Object.assign({ header: true, presets: true, controls: true, keep_warm: true, counters: true }, c.show || {});
    const t = (k, v) => esc(tr(hass, k, v));
    if (!vm.ent.start && !vm.ent.water_heater) {
      return `<style>${CSS}</style><ha-card><div class="empty"><ha-icon icon="mdi:kettle-off-outline"></ha-icon><div>${t("no_kettle")}</div></div></ha-card>`;
    }
    const U = vm.unit;
    const presetsHtml = vm.presets.map((p) => {
      const act = Math.round(vm.tgt) === Math.round(p);
      return `<div class="tile preset ${act ? "active" : ""}" data-act="target" data-v="${p}" role="button" tabindex="0">
        <ha-icon icon="${p >= vm.boil ? "mdi:thermometer-high" : "mdi:thermometer"}"></ha-icon><b>${p} ${esc(U)}</b></div>`;
    }).join("");
    const nowTxt = vm.cur === null ? "—" : Math.round(vm.cur) + " " + U;
    const boilLabel = t("boil_label", { t: Math.round(vm.tgt) + " " + U, c: nowTxt }) + (vm.statusText ? " · " + esc(vm.statusText) : "");
    const stopLabel = vm.on ? t("stop_heating") : vm.keep ? t("stop_keep") : t("stop_idle");
    const keepHtml = (vm.ent.keep_warm || vm.keepTimes.length) ? `
      <div class="row" style="grid-template-columns: repeat(${(vm.ent.keep_warm ? 1 : 0) + vm.keepTimes.length}, 1fr)">
        ${vm.ent.keep_warm ? `<div class="tile keep ${vm.keep ? "on" : ""}" data-act="keep" role="button" tabindex="0"><ha-icon icon="mdi:fire"></ha-icon><b>${t("keep_warm")}</b></div>` : ""}
        ${vm.keepTimes.map((m) => `<div class="tile timer ${vm.keepTime !== null && Math.round(vm.keepTime) === m ? "active" : ""}" data-act="keep_time" data-v="${m}" role="button" tabindex="0">
          <ha-icon icon="mdi:timer-outline"></ha-icon><b>${m >= 120 && m % 60 === 0 ? m / 60 + " h" : m + " min"}</b></div>`).join("")}
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
      ${show.header && c.title !== "" ? `<div class="hdr"><ha-icon icon="${esc(c.icon || "mdi:kettle-steam")}"></ha-icon><span>${esc(c.title || tr(hass, "title"))}</span></div>` : ""}
      <div class="status" data-act="more" data-id="${esc(vm.ent.current || vm.ent.water_heater)}" role="button" tabindex="0">
        <ha-icon class="sicon" icon="${vm.icon}"></ha-icon>
        <div class="stext"><div class="sname">${esc(vm.name)}</div><div class="sinfo">${esc(vm.info)}</div></div>
        <div class="stemp">${esc(vm.right)}</div>
        <div class="bar"><div class="fill" style="width:${vm.pct}%"></div></div>
      </div>
      ${show.presets && vm.presets.length && (vm.ent.target || vm.wh) ? `<div class="row" style="grid-template-columns: repeat(${vm.presets.length}, 1fr)">${presetsHtml}</div>` : ""}
      ${show.controls ? `<div class="row two">
        <div class="tile big boil ${vm.on ? "on" : ""}" data-act="start" role="button" tabindex="0">
          <ha-icon icon="mdi:kettle-steam"></ha-icon><b>${t("boil")}</b><span>${boilLabel}</span></div>
        <div class="tile big stop ${vm.on || vm.keep ? "on" : ""}" data-act="stop" role="button" tabindex="0">
          <ha-icon icon="mdi:stop-circle-outline"></ha-icon><b>${t("stop")}</b><span>${stopLabel}</span></div>
      </div>` : ""}
      ${show.keep_warm ? keepHtml : ""}
      ${show.counters ? countersHtml : ""}
    </ha-card>`;
  }

  _call(domain, service, data) { return this._hass.callService(domain, service, data); }

  _click(ev) {
    if (this._held) { this._held = false; return; }
    const el = ev.target.closest && ev.target.closest("[data-act]");
    if (!el) return;
    const vm = this._vm, e = vm.ent, act = el.dataset.act;
    const v = num(el.dataset.v);
    if (act === "target") {
      if (vm.wh) this._call("water_heater", "set_temperature", { entity_id: e.water_heater, temperature: v });
      else this._call("number", "set_value", { entity_id: e.target, value: v });
    } else if (act === "start") {
      if (vm.wh) {
        const modes = (this._hass.states[e.water_heater].attributes.operation_list || []).filter((m) => m !== "off");
        if (modes.length) this._call("water_heater", "set_operation_mode", { entity_id: e.water_heater, operation_mode: modes.includes("electric") ? "electric" : modes[0] });
        else this._call("water_heater", "turn_on", { entity_id: e.water_heater });
      } else this._call("switch", "turn_on", { entity_id: e.start });
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
    } else if (act === "more") {
      const id = el.dataset.id;
      if (id) this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
    }
  }

  // hold a counter to reset it (after cleaning / descaling)
  _down(ev) {
    const el = ev.target.closest && ev.target.closest("[data-hold]");
    if (!el) return;
    clearTimeout(this._hold);
    this._hold = setTimeout(() => {
      this._held = true;
      if (window.confirm(tr(this._hass, "reset_confirm", { n: el.dataset.name }))) this._call("counter", "reset", { entity_id: el.dataset.id });
    }, 700);
  }
}

const CSS = `
  :host { --sk-blue: var(--setti-blue, #4f8cff); --sk-purple: var(--setti-purple, #c77dff); --sk-green: var(--setti-green, #35d66b);
          --sk-red: var(--setti-red, #ff4d6d); --sk-yellow: var(--setti-yellow, #ffc107); --sk-peach: var(--setti-peach, #ff9800);
          --sk-line: var(--divider-color, rgba(127,127,127,.25)); --sk-radius: var(--setti-radius, 12px); }
  ha-card { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
  .hdr { display: flex; align-items: center; gap: 6px; padding: 0 2px; opacity: .55; }
  .hdr ha-icon { --mdc-icon-size: 15px; }
  .hdr span { font-size: 10.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .status { display: grid; grid-template-columns: auto 1fr auto; grid-template-areas: "i t v" "b b b"; align-items: center; column-gap: 10px; row-gap: 12px;
            padding: 12px 14px; border: 1px solid var(--sk-line); border-radius: var(--sk-radius); cursor: pointer; --c: var(--secondary-text-color); }
  .sicon { grid-area: i; color: var(--c); --mdc-icon-size: 26px; }
  .mode-idle .sicon, .mode-off .sicon { opacity: .6; }
  .stext { grid-area: t; min-width: 0; }
  .sname { font-size: 13px; font-weight: 700; }
  .sinfo { font-size: 12px; font-weight: 600; opacity: .8; margin-top: 3px; }
  .stemp { grid-area: v; font-size: 22px; font-weight: 800; }
  .bar { grid-area: b; height: 8px; border-radius: 4px; background: rgba(127,127,127,.22); overflow: hidden; }
  .fill { height: 100%; border-radius: 4px; background: var(--c); transition: width .6s ease; }
  .mode-heat .status { --c: var(--sk-peach); }
  .mode-done .status { --c: var(--sk-green); }
  .mode-warm .status { --c: var(--sk-yellow); }
  .mode-fault .status { --c: var(--sk-red); }
  .mode-idle .status .fill, .mode-off .status .fill { opacity: .55; }
  .row { display: grid; gap: 8px; }
  .row.two { grid-template-columns: 1fr 1fr; }
  .tile { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 10px 4px; min-width: 0; text-align: center;
          border: 1px solid var(--sk-line); border-radius: var(--sk-radius); cursor: pointer; user-select: none; -webkit-user-select: none;
          transition: background .2s, border-color .2s, transform .1s; --c: var(--sk-blue); }
  .tile:active { transform: scale(.97); }
  .tile ha-icon { color: var(--c); --mdc-icon-size: 20px; }
  .tile b { font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .tile span { font-size: 11px; font-weight: 600; opacity: .75; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .tile.active { --c: var(--sk-green); background: color-mix(in srgb, var(--sk-green) 20%, transparent); border-color: color-mix(in srgb, var(--sk-green) 70%, transparent);
                 box-shadow: 0 0 10px color-mix(in srgb, var(--sk-green) 35%, transparent); }
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
  .empty { display: flex; gap: 10px; align-items: center; padding: 8px; opacity: .8; }
`;

// ---- visual editor (ha-form)
class SettiKettleCardEditor extends HTMLElement {
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
      { type: "expandable", name: "entities", title: L("e_entities"), schema: [
        { name: "start", ...ent("switch") }, { name: "target", ...ent("number") }, { name: "current", ...ent("sensor") },
        { name: "status", ...ent("sensor") }, { name: "keep_warm", ...ent("switch") }, { name: "keep_warm_time", ...ent("number") },
        { name: "water_heater", ...ent("water_heater") }, { name: "start_temp", ...ent(["input_number", "sensor"]) },
      ] },
      { type: "expandable", name: "counters", title: L("e_counters"), schema: [
        { name: "today", ...ent("counter") }, { name: "cleaning", ...ent("counter") }, { name: "descaling", ...ent("counter") },
        { type: "grid", name: "", schema: [
          { name: "cleaning_every", selector: { number: { min: 1, max: 500, mode: "box" } } },
          { name: "descaling_every", selector: { number: { min: 1, max: 1000, mode: "box" } } },
        ] },
      ] },
      { name: "rate", selector: { number: { min: 5, max: 150, step: 0.5, mode: "box", unit_of_measurement: "°/min" } } },
    ];
  }

  _data() {
    const c = Object.assign({}, this._config);
    for (const k of ["presets", "keep_warm_times"]) if (Array.isArray(c[k])) c[k] = c[k].join(", ");
    // counters thresholds live at the top level of the config, the form shows them inside the "counters" section
    c.counters = Object.assign({}, c.counters || {}, { cleaning_every: c.cleaning_every, descaling_every: c.descaling_every });
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
    const cnt = Object.assign({}, c.counters || {});
    for (const k of ["cleaning_every", "descaling_every"]) { if (cnt[k]) c[k] = cnt[k]; else delete c[k]; delete cnt[k]; }
    for (const k of Object.keys(cnt)) if (!cnt[k]) delete cnt[k];
    if (Object.keys(cnt).length) c.counters = cnt; else delete c.counters;
    if (c.entities) { for (const k of Object.keys(c.entities)) if (!c.entities[k]) delete c.entities[k]; if (!Object.keys(c.entities).length) delete c.entities; }
    for (const k of Object.keys(c)) if (c[k] === "" || c[k] === undefined || c[k] === null) delete c[k];
    if (c.profile === "auto") delete c.profile;
    this._config = c;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: c }, bubbles: true, composed: true }));
  }
}

customElements.define(CARD, SettiKettleCard);
customElements.define(CARD + "-editor", SettiKettleCardEditor);
window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD, name: "SETTI+ Kettle Card", preview: true, documentationURL: "https://github.com/jotuera/setti-kettle-card",
  description: "Tuya / Smart Life Wi-Fi kettle: progress and ETA, temperature presets, boil / stop, keep warm, boil counters.",
});
console.info(`%c SETTI-KETTLE-CARD %c ${VERSION} `, "color:#fff;background:#c77dff;font-weight:700", "color:#c77dff;background:#222;font-weight:700");
