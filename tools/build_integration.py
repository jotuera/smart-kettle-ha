#!/usr/bin/env python3
"""Build the integration's generated files:

  - custom_components/setti_kettle/frontend/setti-kettle-card.js  = copy of dist/setti-kettle-card.js
  - custom_components/setti_kettle/strings.json + translations/<lang>.json  from TEXTS below
    (drink names come from i18n/<lang>.json of the card, so they are the same on the card and in HA)

    python3 tools/build_integration.py          # write
    python3 tools/build_integration.py --check  # CI: everything up to date
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COMP = ROOT / "custom_components" / "setti_kettle"
LANGS = ["en", "pl", "de", "cs", "sk", "fr", "it", "es", "nl"]
DRINKS = ["green_tea", "white_tea", "matcha", "oolong", "coffee", "yerba", "black_tea", "herbal", "formula", "honey", "oatmeal", "drink_water"]

# key order: config flow, options, entities
K = [
    "user_title", "user_desc", "device_id", "profile", "power", "power_desc", "no_kettle", "already",
    "opt_title", "opt_desc", "price", "price_entity", "cleaning_every", "descaling_every", "boil_threshold", "boil_threshold_desc",
    "ready_temperature", "notify", "notify_desc", "notify_boiled", "notify_steeped",
    "boils_today", "boils_since_cleaning", "boils_since_descaling", "heating_rate", "water_amount", "energy_today", "cost_today",
    "last_boil", "ready_start", "cleaning_due", "descaling_due", "cleaned", "descaled", "drink", "drink_none", "ready_at_enabled", "ready_at",
]
TEXTS = {
    "en": ["SETTI Kettle", "Found {count} kettle(s). The card, counters, drinks and \"ready at\" are added to the kettle's device.",
           "Kettle", "Kettle profile", "Power", "Rated power – for the amount of water and the energy. Empty = from the profile.",
           "No Wi-Fi kettle found. Add the kettle to Home Assistant first (Tuya, tuya-local or LocalTuya).", "All kettles are already set up.",
           "SETTI Kettle", "Energy, counters, \"ready at\" and notifications.", "Price per kWh", "Price entity (instead of a fixed price)",
           "Clean every … boils", "Descale every … boils", "A boil counts above", "The water has to stay above this for 20 s.",
           "\"Ready at\" temperature", "Notify", "Mobile apps or scripts (a script gets the variables title and message).",
           "Notify when the water is ready", "Notify when the steeping time is over",
           "Boils today", "Boils since cleaning", "Boils since descaling", "Heating rate", "Water in the last boil", "Energy today", "Cost today",
           "Last boil", "\"Ready at\" start", "Cleaning due", "Descaling due", "Cleaned", "Descaled", "Drink", "None", "Ready at – on", "Ready at"],
    "pl": ["SETTI Kettle", "Znaleziono czajników: {count}. Karta, liczniki, napoje i „gotowe na” zostaną dodane do urządzenia czajnika.",
           "Czajnik", "Profil czajnika", "Moc", "Moc znamionowa – do ilości wody i energii. Puste = z profilu.",
           "Nie znaleziono czajnika Wi-Fi. Najpierw dodaj czajnik do Home Assistant (Tuya, tuya-local lub LocalTuya).", "Wszystkie czajniki są już skonfigurowane.",
           "SETTI Kettle", "Energia, liczniki, „gotowe na” i powiadomienia.", "Cena za kWh", "Encja ceny (zamiast stałej ceny)",
           "Myj co … gotowań", "Odkamieniaj co … gotowań", "Gotowanie liczy się powyżej", "Woda musi trzymać tę temperaturę przez 20 s.",
           "Temperatura „gotowe na”", "Powiadamiaj", "Aplikacje mobilne lub skrypty (skrypt dostaje zmienne title i message).",
           "Powiadom, gdy woda gotowa", "Powiadom po czasie parzenia",
           "Gotowania dziś", "Gotowania od mycia", "Gotowania od odkamieniania", "Tempo grzania", "Woda w ostatnim gotowaniu", "Energia dziś", "Koszt dziś",
           "Ostatnie gotowanie", "Start „gotowe na”", "Czas na mycie", "Czas na odkamienianie", "Umyty", "Odkamieniony", "Napój", "Brak", "Gotowe na – wł.", "Gotowe na"],
    "de": ["SETTI Kettle", "{count} Wasserkocher gefunden. Karte, Zähler, Getränke und „fertig um“ werden dem Gerät hinzugefügt.",
           "Wasserkocher", "Kocher-Profil", "Leistung", "Nennleistung – für Wassermenge und Energie. Leer = aus dem Profil.",
           "Kein WLAN-Wasserkocher gefunden. Zuerst den Kocher in Home Assistant einbinden (Tuya, tuya-local oder LocalTuya).", "Alle Wasserkocher sind bereits eingerichtet.",
           "SETTI Kettle", "Energie, Zähler, „fertig um“ und Benachrichtigungen.", "Preis pro kWh", "Preis-Entität (statt festem Preis)",
           "Reinigen alle … Kochvorgänge", "Entkalken alle … Kochvorgänge", "Kochvorgang zählt über", "Das Wasser muss 20 s darüber bleiben.",
           "Temperatur „fertig um“", "Benachrichtigen", "Mobile Apps oder Skripte (ein Skript erhält die Variablen title und message).",
           "Benachrichtigen, wenn das Wasser fertig ist", "Benachrichtigen nach der Ziehzeit",
           "Heute gekocht", "Kochvorgänge seit Reinigung", "Kochvorgänge seit Entkalkung", "Heizrate", "Wasser beim letzten Kochen", "Energie heute", "Kosten heute",
           "Letztes Kochen", "Start „fertig um“", "Reinigung fällig", "Entkalkung fällig", "Gereinigt", "Entkalkt", "Getränk", "Keins", "Fertig um – an", "Fertig um"],
    "cs": ["SETTI Kettle", "Nalezeno konvic: {count}. Karta, počítadla, nápoje a „hotovo v“ budou přidány k zařízení konvice.",
           "Konvice", "Profil konvice", "Příkon", "Jmenovitý příkon – pro množství vody a energii. Prázdné = z profilu.",
           "Nenalezena žádná Wi-Fi konvice. Nejprve přidejte konvici do Home Assistant (Tuya, tuya-local nebo LocalTuya).", "Všechny konvice jsou již nastaveny.",
           "SETTI Kettle", "Energie, počítadla, „hotovo v“ a oznámení.", "Cena za kWh", "Entita ceny (místo pevné ceny)",
           "Mýt každých … vaření", "Odvápnit každých … vaření", "Vaření se počítá nad", "Voda musí zůstat nad touto teplotou 20 s.",
           "Teplota „hotovo v“", "Oznamovat", "Mobilní aplikace nebo skripty (skript dostane proměnné title a message).",
           "Oznámit, když je voda hotová", "Oznámit po louhování",
           "Vaření dnes", "Vaření od mytí", "Vaření od odvápnění", "Rychlost ohřevu", "Voda při posledním vaření", "Energie dnes", "Cena dnes",
           "Poslední vaření", "Start „hotovo v“", "Čas na mytí", "Čas na odvápnění", "Umyto", "Odvápněno", "Nápoj", "Žádný", "Hotovo v – zap.", "Hotovo v"],
    "sk": ["SETTI Kettle", "Nájdené kanvice: {count}. Karta, počítadlá, nápoje a „hotovo o“ sa pridajú k zariadeniu kanvice.",
           "Kanvica", "Profil kanvice", "Príkon", "Menovitý príkon – pre množstvo vody a energiu. Prázdne = z profilu.",
           "Nenašla sa žiadna Wi-Fi kanvica. Najprv pridajte kanvicu do Home Assistant (Tuya, tuya-local alebo LocalTuya).", "Všetky kanvice sú už nastavené.",
           "SETTI Kettle", "Energia, počítadlá, „hotovo o“ a oznámenia.", "Cena za kWh", "Entita ceny (namiesto pevnej ceny)",
           "Umývať každých … varení", "Odvápniť každých … varení", "Varenie sa počíta nad", "Voda musí zostať nad touto teplotou 20 s.",
           "Teplota „hotovo o“", "Oznamovať", "Mobilné aplikácie alebo skripty (skript dostane premenné title a message).",
           "Oznámiť, keď je voda hotová", "Oznámiť po lúhovaní",
           "Varenia dnes", "Varenia od umytia", "Varenia od odvápnenia", "Rýchlosť ohrevu", "Voda pri poslednom varení", "Energia dnes", "Cena dnes",
           "Posledné varenie", "Štart „hotovo o“", "Čas na umytie", "Čas na odvápnenie", "Umyté", "Odvápnené", "Nápoj", "Žiadny", "Hotovo o – zap.", "Hotovo o"],
    "fr": ["SETTI Kettle", "{count} bouilloire(s) trouvée(s). La carte, les compteurs, les boissons et « prête à » sont ajoutés à l'appareil.",
           "Bouilloire", "Profil de bouilloire", "Puissance", "Puissance nominale – pour la quantité d'eau et l'énergie. Vide = celle du profil.",
           "Aucune bouilloire Wi-Fi trouvée. Ajoutez d'abord la bouilloire à Home Assistant (Tuya, tuya-local ou LocalTuya).", "Toutes les bouilloires sont déjà configurées.",
           "SETTI Kettle", "Énergie, compteurs, « prête à » et notifications.", "Prix du kWh", "Entité du prix (au lieu d'un prix fixe)",
           "Nettoyer toutes les … ébullitions", "Détartrer toutes les … ébullitions", "Une ébullition compte au-dessus de", "L'eau doit y rester 20 s.",
           "Température « prête à »", "Notifier", "Applications mobiles ou scripts (un script reçoit les variables title et message).",
           "Notifier quand l'eau est prête", "Notifier à la fin de l'infusion",
           "Ébullitions aujourd'hui", "Ébullitions depuis le nettoyage", "Ébullitions depuis le détartrage", "Vitesse de chauffe", "Eau de la dernière ébullition", "Énergie aujourd'hui", "Coût aujourd'hui",
           "Dernière ébullition", "Départ « prête à »", "Nettoyage à faire", "Détartrage à faire", "Nettoyée", "Détartrée", "Boisson", "Aucune", "Prête à – activé", "Prête à"],
    "it": ["SETTI Kettle", "Bollitori trovati: {count}. Scheda, contatori, bevande e «pronto alle» vengono aggiunti al dispositivo.",
           "Bollitore", "Profilo bollitore", "Potenza", "Potenza nominale – per la quantità d'acqua e l'energia. Vuoto = dal profilo.",
           "Nessun bollitore Wi-Fi trovato. Aggiungi prima il bollitore a Home Assistant (Tuya, tuya-local o LocalTuya).", "Tutti i bollitori sono già configurati.",
           "SETTI Kettle", "Energia, contatori, «pronto alle» e notifiche.", "Prezzo per kWh", "Entità del prezzo (invece di un prezzo fisso)",
           "Pulisci ogni … bolliture", "Decalcifica ogni … bolliture", "Una bollitura conta sopra", "L'acqua deve restarci sopra 20 s.",
           "Temperatura «pronto alle»", "Notifica", "App mobili o script (uno script riceve le variabili title e message).",
           "Notifica quando l'acqua è pronta", "Notifica a fine infusione",
           "Bolliture oggi", "Bolliture dalla pulizia", "Bolliture dalla decalcificazione", "Velocità di riscaldamento", "Acqua dell'ultima bollitura", "Energia oggi", "Costo oggi",
           "Ultima bollitura", "Avvio «pronto alle»", "Pulizia da fare", "Decalcificazione da fare", "Pulito", "Decalcificato", "Bevanda", "Nessuna", "Pronto alle – attivo", "Pronto alle"],
    "es": ["SETTI Kettle", "Hervidores encontrados: {count}. La tarjeta, los contadores, las bebidas y «listo a las» se añaden al dispositivo.",
           "Hervidor", "Perfil del hervidor", "Potencia", "Potencia nominal – para la cantidad de agua y la energía. Vacío = la del perfil.",
           "No se encontró ningún hervidor Wi-Fi. Añade primero el hervidor a Home Assistant (Tuya, tuya-local o LocalTuya).", "Todos los hervidores ya están configurados.",
           "SETTI Kettle", "Energía, contadores, «listo a las» y notificaciones.", "Precio por kWh", "Entidad del precio (en lugar de un precio fijo)",
           "Limpiar cada … hervidos", "Descalcificar cada … hervidos", "Un hervido cuenta por encima de", "El agua debe mantenerse 20 s por encima.",
           "Temperatura «listo a las»", "Notificar", "Apps móviles o scripts (un script recibe las variables title y message).",
           "Notificar cuando el agua esté lista", "Notificar al terminar la infusión",
           "Hervidos hoy", "Hervidos desde la limpieza", "Hervidos desde la descalcificación", "Velocidad de calentamiento", "Agua del último hervido", "Energía hoy", "Coste hoy",
           "Último hervido", "Inicio «listo a las»", "Toca limpiar", "Toca descalcificar", "Limpiado", "Descalcificado", "Bebida", "Ninguna", "Listo a las – activo", "Listo a las"],
    "nl": ["SETTI Kettle", "Waterkokers gevonden: {count}. Kaart, tellers, dranken en „klaar om” worden aan het apparaat toegevoegd.",
           "Waterkoker", "Waterkokerprofiel", "Vermogen", "Nominaal vermogen – voor de hoeveelheid water en de energie. Leeg = uit het profiel.",
           "Geen wifi-waterkoker gevonden. Voeg eerst de waterkoker toe aan Home Assistant (Tuya, tuya-local of LocalTuya).", "Alle waterkokers zijn al ingesteld.",
           "SETTI Kettle", "Energie, tellers, „klaar om” en meldingen.", "Prijs per kWh", "Prijs-entiteit (in plaats van een vaste prijs)",
           "Schoonmaken elke … keer", "Ontkalken elke … keer", "Koken telt boven", "Het water moet er 20 s boven blijven.",
           "Temperatuur „klaar om”", "Melden", "Mobiele apps of scripts (een script krijgt de variabelen title en message).",
           "Melden als het water klaar is", "Melden als de trektijd voorbij is",
           "Vandaag gekookt", "Keer gekookt sinds schoonmaken", "Keer gekookt sinds ontkalken", "Opwarmsnelheid", "Water bij laatste keer", "Energie vandaag", "Kosten vandaag",
           "Laatst gekookt", "Start „klaar om”", "Schoonmaken nodig", "Ontkalken nodig", "Schoongemaakt", "Ontkalkt", "Drank", "Geen", "Klaar om – aan", "Klaar om"],
}


def build(lang: str) -> dict:
    t = dict(zip(K, TEXTS[lang]))
    card = json.loads((ROOT / "i18n" / f"{lang}.json").read_text(encoding="utf-8"))
    drinks = {DRINK: card[f"d_{DRINK}"] for DRINK in DRINKS}
    return {
        "config": {
            "step": {"user": {"title": t["user_title"], "description": t["user_desc"],
                              "data": {"device_id": t["device_id"], "profile": t["profile"], "power": t["power"]},
                              "data_description": {"power": t["power_desc"]}}},
            "abort": {"no_kettle": t["no_kettle"], "already_configured": t["already"]},
        },
        "options": {"step": {"init": {
            "title": t["opt_title"], "description": t["opt_desc"],
            "data": {k: t[k] for k in ("profile", "power", "price", "price_entity", "cleaning_every", "descaling_every",
                                       "boil_threshold", "ready_temperature", "notify", "notify_boiled", "notify_steeped")},
            "data_description": {"boil_threshold": t["boil_threshold_desc"], "notify": t["notify_desc"], "power": t["power_desc"]},
        }}},
        "entity": {
            "sensor": {k: {"name": t[k]} for k in ("boils_today", "boils_since_cleaning", "boils_since_descaling", "heating_rate",
                                                  "water_amount", "energy_today", "cost_today", "last_boil", "ready_start")},
            "binary_sensor": {k: {"name": t[k]} for k in ("cleaning_due", "descaling_due")},
            "button": {k: {"name": t[k]} for k in ("cleaned", "descaled")},
            "select": {"drink": {"name": t["drink"], "state": {"none": t["drink_none"], **drinks}}},
            "switch": {"ready_at_enabled": {"name": t["ready_at_enabled"]}},
            "time": {"ready_at": {"name": t["ready_at"]}},
        },
    }


def main() -> None:
    check = "--check" in sys.argv
    out: dict[Path, str] = {}
    for lang in LANGS:
        assert len(TEXTS[lang]) == len(K), (lang, len(TEXTS[lang]), len(K))
        out[COMP / "translations" / f"{lang}.json"] = json.dumps(build(lang), ensure_ascii=False, indent=2) + "\n"
    out[COMP / "strings.json"] = out[COMP / "translations" / "en.json"]
    out[COMP / "frontend" / "setti-kettle-card.js"] = (ROOT / "dist" / "setti-kettle-card.js").read_text(encoding="utf-8")
    stale = [p for p, s in out.items() if not p.exists() or p.read_text(encoding="utf-8") != s]
    if check:
        if stale:
            print("out of date – run python3 tools/build_integration.py:\n  " + "\n  ".join(str(p.relative_to(ROOT)) for p in stale))
            sys.exit(1)
        print(f"ok – integration translations ({len(LANGS)} languages) and bundled card up to date")
        return
    for p in stale:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(out[p], encoding="utf-8", newline="\n")
    print(f"written: {len(stale)} file(s)")


if __name__ == "__main__":
    main()
