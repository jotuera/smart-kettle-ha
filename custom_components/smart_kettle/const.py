"""Constants of Smart Kettle."""
from __future__ import annotations

from homeassistant.const import Platform

DOMAIN = "smart_kettle"
PLATFORMS = [Platform.SENSOR, Platform.BINARY_SENSOR, Platform.BUTTON, Platform.SELECT, Platform.SWITCH, Platform.TIME]

CONF_DEVICE = "device_id"
CONF_PROFILE = "profile"
CONF_POWER = "power"
CONF_PRICE = "price"
CONF_PRICE_ENTITY = "price_entity"
CONF_CLEANING_EVERY = "cleaning_every"
CONF_DESCALING_EVERY = "descaling_every"
CONF_NOTIFY = "notify"
CONF_NOTIFY_BOILED = "notify_boiled"
CONF_NOTIFY_STEEPED = "notify_steeped"
CONF_READY_TEMP = "ready_temperature"
CONF_BOIL_THRESHOLD = "boil_threshold"

DEFAULT_CLEANING_EVERY = 20
DEFAULT_DESCALING_EVERY = 60
DEFAULT_BOIL_THRESHOLD = 90

# same profiles as the card: power (W) and the heating rate before the first measured boil (°C/min)
PROFILES = {
    "auto": {"name": "Auto", "power": 2200, "rate": 40},
    "setti_kt950w": {"name": "SETTI+ KT950W", "power": 2200, "rate": 40},
    "gotze_jensen_kt975k": {"name": "Götze & Jensen KT975K", "power": 2200, "rate": 40},
    "aeno_ek7s": {"name": "AENO EK7S", "power": 2200, "rate": 40},
    "fiesta_dk1g": {"name": "Fiesta DK1G", "power": 2200, "rate": 40},
    "silvercrest": {"name": "SilverCrest (Lidl Home)", "power": 2200, "rate": 38},
    "webber_wk115": {"name": "Webber PRISME WK115", "power": 1800, "rate": 36},
    "nedis_kawk": {"name": "Nedis SmartLife kettle", "power": 2200, "rate": 38},
    "weekett": {"name": "Weekett / Weeket", "power": 2200, "rate": 40},
    "korex": {"name": "Korex AX-WF306N", "power": 2200, "rate": 40},
    "fahrenheit": {"name": "Generic °F kettle", "power": 1500, "rate": 72},
    "blaupunkt_bkw825": {"name": "Blaupunkt BKW825 (UAE)", "power": 2200, "rate": 40},
    "statesman_uk": {"name": "Statesman / DMD SmartStream (UK)", "power": 1800, "rate": 36},
    "uk_3kw": {"name": "UK 3 kW kettle", "power": 3000, "rate": 55},
    "kogan_glass": {"name": "Kogan / Smart Ape glass (AU, NZ)", "power": 2200, "rate": 42},
    "anko_kmart": {"name": "Anko LD-K3068 (Kmart AU)", "power": 2200, "rate": 42},
    "homend_royaltea": {"name": "Homend Royaltea", "power": 2200, "rate": 38},
    "tea_modes": {"name": "Tea-mode kettle (G&J / Svensson / Kogan in tuya-local)", "power": 2200, "rate": 40},
    "us_gooseneck": {"name": "US gooseneck (°F, 1200 W)", "power": 1200, "rate": 60},
    "xiaomi_kettle_2_pro": {"name": "Xiaomi Smart Kettle 2 Pro (xiaomi_miot)", "power": 1800, "rate": 40},
    "mi_kettle_pro_ble": {"name": "Xiaomi Mi Smart Kettle Pro (BLE)", "power": 1800, "rate": 40},
    "fellow_stagg": {"name": "Fellow Stagg EKG Pro / EKG+", "power": 1200, "rate": 45},
    "skykettle": {"name": "Redmond SkyKettle", "power": 2200, "rate": 40},
    "smarter_ikettle": {"name": "Smarter iKettle 3.0 (UK)", "power": 3000, "rate": 55},
    "govee": {"name": "Govee H7171 / H7173 (govee2mqtt)", "power": 1500, "rate": 50},
}

# same drinks as the card: temperature °C, keep warm min, steeping min, second stage °C
DRINKS = {
    "green_tea": {"temp": 80, "steep": 2.5},
    "white_tea": {"temp": 75, "steep": 4},
    "matcha": {"temp": 75},
    "oolong": {"temp": 90, "steep": 4},
    "coffee": {"temp": 95, "steep": 4},
    "yerba": {"temp": 75, "keep": 30},
    "black_tea": {"temp": 100, "steep": 4},
    "herbal": {"temp": 100, "steep": 5},
    "formula": {"temp": 100, "then": 45, "keep": 120},
    "honey": {"temp": 40, "keep": 60},
    "oatmeal": {"temp": 100},
    "drink_water": {"temp": 55, "keep": 60},
}
DRINK_NONE = "none"

# notification texts – {drink} {t}
NOTIFY_TEXTS = {
    "en": {"title": "Kettle", "boiled": "{drink} – water ready ({t} °C)", "water": "Water ready ({t} °C)",
           "steeped": "{drink} – steeping done, take the tea out", "ready_at": "Kettle switched on – ready at {t}"},
    "pl": {"title": "Czajnik", "boiled": "{drink} – woda gotowa ({t} °C)", "water": "Woda gotowa ({t} °C)",
           "steeped": "{drink} – koniec parzenia, wyjmij herbatę", "ready_at": "Czajnik włączony – gotowe na {t}"},
    "de": {"title": "Wasserkocher", "boiled": "{drink} – Wasser fertig ({t} °C)", "water": "Wasser fertig ({t} °C)",
           "steeped": "{drink} – Ziehzeit vorbei, Tee herausnehmen", "ready_at": "Wasserkocher eingeschaltet – fertig um {t}"},
    "cs": {"title": "Konvice", "boiled": "{drink} – voda hotová ({t} °C)", "water": "Voda hotová ({t} °C)",
           "steeped": "{drink} – louhování skončilo, vyjměte čaj", "ready_at": "Konvice zapnuta – hotovo v {t}"},
    "sk": {"title": "Kanvica", "boiled": "{drink} – voda hotová ({t} °C)", "water": "Voda hotová ({t} °C)",
           "steeped": "{drink} – lúhovanie skončilo, vyberte čaj", "ready_at": "Kanvica zapnutá – hotovo o {t}"},
    "fr": {"title": "Bouilloire", "boiled": "{drink} – eau prête ({t} °C)", "water": "Eau prête ({t} °C)",
           "steeped": "{drink} – infusion terminée, retirez le thé", "ready_at": "Bouilloire allumée – prête à {t}"},
    "it": {"title": "Bollitore", "boiled": "{drink} – acqua pronta ({t} °C)", "water": "Acqua pronta ({t} °C)",
           "steeped": "{drink} – infusione finita, togli il tè", "ready_at": "Bollitore acceso – pronto alle {t}"},
    "es": {"title": "Hervidor", "boiled": "{drink} – agua lista ({t} °C)", "water": "Agua lista ({t} °C)",
           "steeped": "{drink} – infusión terminada, saca el té", "ready_at": "Hervidor encendido – listo a las {t}"},
    "nl": {"title": "Waterkoker", "boiled": "{drink} – water klaar ({t} °C)", "water": "Water klaar ({t} °C)",
           "steeped": "{drink} – trektijd voorbij, haal de thee eruit", "ready_at": "Waterkoker aan – klaar om {t}"},
}

SIGNAL_UPDATE = f"{DOMAIN}_update_{{}}"
