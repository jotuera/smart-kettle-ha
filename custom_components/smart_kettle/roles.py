"""Which entity of a kettle device plays which role – pure Python, no Home Assistant imports (tested in CI).

Same rules as the card (dist/smart-kettle-card.js, ROLES): core Tuya by translation key; tuya-local, Xiaomi MIoT,
Fellow Stagg, Redmond SkyKettle, Smarter iKettle and Govee (govee2mqtt) by the endings of their entity ids.
"""
from __future__ import annotations

import re
from collections.abc import Iterable

# role -> (domains, translation keys, entity id fallback, entity id exclusion)
ROLES: dict[str, tuple[tuple[str, ...], tuple[str, ...], str, str | None]] = {
    "water_heater": (("water_heater",), ("kettle",), r".", None),
    "climate": (("climate",), ("kettle",), r".", r"cold"),
    "start": (("switch",), ("start", "boiling", "power"), r"_start$|_power$|_boiling$|_on$|_power_switch$|_powerswitch$",
              r"keep|warm|light|sound|lock|child"),
    "start_button": (("button",), ("start", "heat", "boil"), r"_start$|_heat$|_boil$", r"stop|reset"),
    "stop_button": (("button",), ("stop", "stop_work"), r"_stop$|_stop_work$", None),
    "target": (("number",), ("temperature", "target_temperature", "temp_set", "boil_temperature"),
               r"_temperatur[ae]$|_temp_set$|_target_temperature$|_boil_temperature$|_temperaturesetting$", r"current|keep|warm|water_temp|hold"),
    "current": (("sensor",), ("current_temperature", "water_temperature"),
                r"_current_temperature$|_water_temperature$|_current_temp$|_temperature$", r"target|keep|warm|boil_temp|setting"),
    "status": (("sensor",), ("status", "kettle_status", "device_state", "state"), r"_status$|_device_state$|_state$", r"water_level|unit"),
    "keep_warm": (("switch",), ("heat_preservation", "keep_warm", "auto_keep_warm"), r"_heat_preservation$|_keep_warm$|_warm$", r"time|temp"),
    "keep_warm_time": (("number", "time", "select"), ("heat_preservation_time", "keep_warm_time", "hold_duration", "warm_time"),
                       r"_heat_preservation_time$|_keep_warm_time$|_warm_time$|_hold_duration$", None),
    "keep_warm_temp": (("number", "select"), ("keep_warm_temperature",), r"_keep_warm_temperature$|_warm_temperature$", None),
}
KETTLE_PLATFORMS = ("skykettle", "fellow_stagg", "stagg_ekg", "staggassistant", "smarter", "mi_kettle_pro")
KETTLE_NAME = re.compile(r"kettle|czajnik|kocher|bouilloire|bollitore|hervidor|waterkoker|konvice|kanvica|stagg|ekg", re.I)
HEAT_STATUS = {"heating", "boiling", "cooking", "heat"}


def match_roles(entities: Iterable[tuple[str, str | None]]) -> dict[str, str]:
    """(entity_id, translation_key) of one device -> role -> entity_id. The °C entity before its "_2" °F twin."""
    ents = list(entities)
    out: dict[str, str] = {}
    for role, (domains, keys, pattern, exclude) in ROLES.items():
        free = [(eid, tk) for eid, tk in ents if eid.split(".")[0] in domains and eid not in out.values()]
        cands = sorted((eid for eid, tk in free if tk in keys), key=len)
        if not cands:
            cands = sorted((eid for eid, _ in free if re.search(pattern, eid) and not (exclude and re.search(exclude, eid))), key=len)
        if cands:
            out[role] = cands[0]
    return out


def looks_like_kettle(entities: Iterable[tuple[str, str | None, str | None]], device_text: str = "") -> bool:
    """(entity_id, translation_key, platform) of one device + its model / name -> is it a kettle?"""
    dev_kettle = bool(KETTLE_NAME.search(device_text or ""))
    wh = start = cur = False
    start_re, start_not = ROLES["start"][2], ROLES["start"][3]
    for eid, tk, platform in entities:
        dom = eid.split(".")[0]
        kettly = tk == "kettle" or platform in KETTLE_PLATFORMS or bool(KETTLE_NAME.search(eid)) or dev_kettle
        if dom in ("water_heater", "climate") and kettly and "cold" not in eid:
            wh = True
        if dom == "switch" and (tk == "start" or (kettly and re.search(start_re, eid) and not re.search(start_not, eid))):
            start = True
        if dom == "button" and kettly and re.search(ROLES["start_button"][2], eid) and not re.search(ROLES["start_button"][3], eid):
            start = True
        if dom == "sensor" and (tk == "current_temperature" or (kettly and eid.endswith("temperature"))):
            cur = True
    return wh or (start and cur)
