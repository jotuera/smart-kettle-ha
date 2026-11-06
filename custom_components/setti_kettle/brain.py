"""The kettle's brain: follows the kettle's own entities and adds what the kettle does not have.

- counts boils (today / since cleaning / since descaling), resets "today" at midnight;
- learns the heating rate from each boil, estimates the amount of water and today's energy;
- applies a drink (target, keep warm), runs its second stage (formula: boil, then hold 45 °C),
  notifies when the water is ready and when the steeping time is over;
- "ready at": switches the kettle on early enough to be ready at a time.
Everything is stored in .storage, so it survives restarts.
"""
from __future__ import annotations

from datetime import datetime, time, timedelta
import logging
import re
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import STATE_OFF, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import CALLBACK_TYPE, Event, EventStateChangedData, HomeAssistant, callback
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import (
    async_call_later,
    async_track_state_change_event,
    async_track_time_change,
    async_track_time_interval,
)
from homeassistant.helpers.storage import Store
from homeassistant.helpers.translation import async_get_translations
from homeassistant.util import dt as dt_util

from .const import (
    CONF_BOIL_THRESHOLD,
    CONF_CLEANING_EVERY,
    CONF_DESCALING_EVERY,
    CONF_DEVICE,
    CONF_NOTIFY,
    CONF_NOTIFY_BOILED,
    CONF_NOTIFY_STEEPED,
    CONF_POWER,
    CONF_PROFILE,
    CONF_READY_TEMP,
    DEFAULT_BOIL_THRESHOLD,
    DEFAULT_CLEANING_EVERY,
    DEFAULT_DESCALING_EVERY,
    DOMAIN,
    DRINK_NONE,
    DRINKS,
    NOTIFY_TEXTS,
    PROFILES,
    SIGNAL_UPDATE,
)

_LOGGER = logging.getLogger(__name__)
STORE_VERSION = 1
OFF_STATES = (STATE_OFF, STATE_UNAVAILABLE, STATE_UNKNOWN)

# role -> (domain, translation keys, entity id fallback)
ROLES: dict[str, tuple[str, tuple[str, ...], str]] = {
    "start": ("switch", ("start",), r"_start$|_power$"),
    "target": ("number", ("temperature", "target_temperature", "temp_set"), r"_temperatur[ae]$|_temp_set$|_target_temperature$"),
    "current": ("sensor", ("current_temperature",), r"_current_temperature$"),
    "status": ("sensor", ("status", "kettle_status"), r"_status$"),
    "keep_warm": ("switch", ("heat_preservation", "keep_warm"), r"_heat_preservation$|_keep_warm$"),
    "keep_warm_time": ("number", ("heat_preservation_time", "keep_warm_time"), r"_heat_preservation_time$|_keep_warm_time$"),
    "water_heater": ("water_heater", ("kettle",), r"."),
}


def resolve_kettle(hass: HomeAssistant, device_id: str) -> dict[str, str]:
    """Entities of the kettle device by their translation keys (any language, any entity id)."""
    reg = er.async_get(hass)
    ents = [e for e in er.async_entries_for_device(reg, device_id) if not e.disabled_by and e.platform != DOMAIN]
    out: dict[str, str] = {}
    for role, (domain, keys, pattern) in ROLES.items():
        cands = sorted((e for e in ents if e.domain == domain and e.translation_key in keys), key=lambda e: len(e.entity_id))
        if not cands and role != "water_heater":
            cands = sorted(
                (e for e in ents if e.domain == domain and re.search(pattern, e.entity_id) and e.entity_id not in out.values()
                 and not (role == "target" and "current" in e.entity_id) and not (role == "keep_warm" and "time" in e.entity_id)),
                key=lambda e: len(e.entity_id),
            )
        if role == "water_heater" and not cands:
            cands = [e for e in ents if e.domain == "water_heater"]
        if cands:
            out[role] = cands[0].entity_id
    return out


def find_kettles(hass: HomeAssistant) -> dict[str, str]:
    """device_id -> name of every device that looks like a kettle."""
    devs = dr.async_get(hass)
    found: dict[str, str] = {}
    by_dev: dict[str, set[str]] = {}
    for e in er.async_get(hass).entities.values():
        if not e.device_id or e.disabled_by or e.platform == DOMAIN:
            continue
        tags = by_dev.setdefault(e.device_id, set())
        if e.domain == "water_heater" and (e.translation_key == "kettle" or re.search("kettle|czajnik|kocher", e.entity_id)):
            tags.add("wh")
        if e.domain == "switch" and e.translation_key == "start":
            tags.add("start")
        if e.domain == "sensor" and e.translation_key == "current_temperature":
            tags.add("cur")
    for dev_id, tags in by_dev.items():
        if "wh" in tags or {"start", "cur"} <= tags:
            d = devs.async_get(dev_id)
            if d:
                found[dev_id] = d.name_by_user or d.name or dev_id
    return found


class KettleBrain:
    """State and logic of one kettle."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self.device_id: str = entry.data[CONF_DEVICE]
        self.ent: dict[str, str] = {}
        self._store: Store[dict[str, Any]] = Store(hass, STORE_VERSION, f"{DOMAIN}.{entry.entry_id}")
        self.data: dict[str, Any] = {}
        self._unsubs: list[CALLBACK_TYPE] = []
        self._boil_check: CALLBACK_TYPE | None = None
        self._cool_check: CALLBACK_TYPE | None = None
        self._steep_timer: CALLBACK_TYPE | None = None
        self._on_at: datetime | None = None
        self._t0: float | None = None

    # ---- options
    @property
    def opts(self) -> dict[str, Any]:
        return {**self.entry.data, **self.entry.options}

    @property
    def profile(self) -> dict[str, Any]:
        return PROFILES.get(self.opts.get(CONF_PROFILE, "auto"), PROFILES["auto"])

    @property
    def power(self) -> float:
        return float(self.opts.get(CONF_POWER) or self.profile["power"])

    @property
    def rate(self) -> float:
        return float(self.data.get("rate") or self.profile["rate"])

    @property
    def cleaning_every(self) -> int:
        return int(self.opts.get(CONF_CLEANING_EVERY) or DEFAULT_CLEANING_EVERY)

    @property
    def descaling_every(self) -> int:
        return int(self.opts.get(CONF_DESCALING_EVERY) or DEFAULT_DESCALING_EVERY)

    # ---- lifecycle
    async def async_setup(self) -> None:
        self.data = await self._store.async_load() or {}
        self.data.setdefault("today", 0)
        self.data.setdefault("cleaning", 0)
        self.data.setdefault("descaling", 0)
        self.data.setdefault("energy_today", 0.0)
        self.data.setdefault("drink", DRINK_NONE)
        self.data.setdefault("ready_time", "06:30:00")
        self.data.setdefault("ready_on", False)
        self._new_day_if_needed()
        self.ent = resolve_kettle(self.hass, self.device_id)
        if not self.ent.get("start") and not self.ent.get("water_heater"):
            _LOGGER.warning("SETTI Kettle: no Start switch / water heater found on device %s", self.device_id)
        watch = [x for x in (self.ent.get("start"), self.ent.get("water_heater"), self.ent.get("current")) if x]
        if watch:
            self._unsubs.append(async_track_state_change_event(self.hass, watch, self._on_change))
        self._unsubs.append(async_track_time_change(self.hass, self._midnight, hour=0, minute=0, second=1))
        self._unsubs.append(async_track_time_interval(self.hass, self._ready_tick, timedelta(seconds=30)))
        if self.is_on:
            self._on_at = dt_util.utcnow()
            self._t0 = self.current

    async def async_unload(self) -> None:
        for u in self._unsubs:
            u()
        for t in (self._boil_check, self._cool_check, self._steep_timer):
            if t:
                t()
        await self._store.async_save(self.data)

    def _save(self) -> None:
        self._store.async_delay_save(lambda: self.data, 2)
        async_dispatcher_send(self.hass, SIGNAL_UPDATE.format(self.entry.entry_id))

    def device_info_ids(self) -> set[tuple[str, str]]:
        d = dr.async_get(self.hass).async_get(self.device_id)
        return set(d.identifiers) if d else {(DOMAIN, self.device_id)}

    # ---- kettle state
    def _state(self, role: str):
        eid = self.ent.get(role)
        return self.hass.states.get(eid) if eid else None

    @property
    def is_on(self) -> bool:
        wh = self._state("water_heater")
        if wh is not None:
            return wh.state not in OFF_STATES
        s = self._state("start")
        return s is not None and s.state == "on"

    @property
    def current(self) -> float | None:
        wh = self._state("water_heater")
        try:
            if wh is not None:
                return float(wh.attributes.get("current_temperature"))
            s = self._state("current")
            return float(s.state) if s else None
        except (TypeError, ValueError):
            return None

    @property
    def target(self) -> float | None:
        wh = self._state("water_heater")
        try:
            if wh is not None:
                return float(wh.attributes.get("temperature"))
            s = self._state("target")
            return float(s.state) if s else None
        except (TypeError, ValueError):
            return None

    def _limits(self) -> tuple[float, float, float]:
        s = self._state("water_heater") or self._state("target")
        if s is None:
            return 0, 100, 1
        a = s.attributes
        return float(a.get("min", a.get("min_temp", 0)) or 0), float(a.get("max", a.get("max_temp", 100)) or 100), float(a.get("step", 1) or 1)

    def snap(self, t: float) -> float:
        lo, hi, step = self._limits()
        v = min(max(t, lo), hi)
        return round(round((v - lo) / step) * step + lo)

    # ---- actions on the kettle
    async def async_set_target(self, t: float) -> None:
        t = self.snap(t)
        if self.ent.get("water_heater"):
            await self.hass.services.async_call("water_heater", "set_temperature", {"entity_id": self.ent["water_heater"], "temperature": t}, blocking=True)
        elif self.ent.get("target"):
            await self.hass.services.async_call("number", "set_value", {"entity_id": self.ent["target"], "value": t}, blocking=True)

    async def async_start(self) -> None:
        if self.ent.get("water_heater"):
            wh = self._state("water_heater")
            modes = [m for m in (wh.attributes.get("operation_list") or []) if m != "off"] if wh else []
            if modes:
                await self.hass.services.async_call("water_heater", "set_operation_mode", {
                    "entity_id": self.ent["water_heater"], "operation_mode": "electric" if "electric" in modes else modes[0]}, blocking=True)
            else:
                await self.hass.services.async_call("water_heater", "turn_on", {"entity_id": self.ent["water_heater"]}, blocking=True)
        elif self.ent.get("start"):
            await self.hass.services.async_call("switch", "turn_on", {"entity_id": self.ent["start"]}, blocking=True)

    async def async_keep_warm(self, minutes: float | None) -> None:
        if minutes and self.ent.get("keep_warm_time"):
            s = self._state("keep_warm_time")
            mx = float(s.attributes.get("max", minutes)) if s else minutes
            await self.hass.services.async_call("number", "set_value", {"entity_id": self.ent["keep_warm_time"], "value": min(minutes, mx)}, blocking=True)
        if self.ent.get("keep_warm"):
            await self.hass.services.async_call("switch", "turn_on" if minutes else "turn_off", {"entity_id": self.ent["keep_warm"]}, blocking=True)

    async def async_set_drink(self, key: str, start: bool = False) -> None:
        """Set a drink (from the select entity or the card): target, keep warm; remembered for its stages."""
        self.data["drink"] = key
        self.data["drink_at"] = dt_util.utcnow().isoformat()
        self.data["stage2_done"] = None
        self._save()
        d = DRINKS.get(key)
        if not d:
            return
        await self.async_set_target(d["temp"])
        keep_now = d.get("keep") if d.get("then") is None else None
        k = self._state("keep_warm")
        if keep_now or (k is not None and k.state == "on"):
            await self.async_keep_warm(keep_now)
        if start:
            await self.async_start()

    def drink_now(self) -> dict[str, Any] | None:
        key = self.data.get("drink")
        at = dt_util.parse_datetime(self.data.get("drink_at") or "")
        if key in (None, DRINK_NONE) or key not in DRINKS or not at or dt_util.utcnow() - at > timedelta(hours=6):
            return None
        return {"key": key, **DRINKS[key]}

    # ---- counting and learning
    def _new_day_if_needed(self) -> None:
        today = dt_util.now().date().isoformat()
        if self.data.get("day") != today:
            self.data["day"] = today
            self.data["today"] = 0
            self.data["energy_today"] = 0.0

    @callback
    def _midnight(self, _now: datetime) -> None:
        self._new_day_if_needed()
        self._save()

    def reset(self, which: str) -> None:
        self.data[which] = 0
        self._save()

    @callback
    def _on_change(self, event: Event[EventStateChangedData]) -> None:
        eid = event.data["entity_id"]
        new, old = event.data["new_state"], event.data["old_state"]
        if eid in (self.ent.get("start"), self.ent.get("water_heater")):
            was_on = old is not None and old.state not in OFF_STATES
            now_on = self.is_on
            if now_on and not was_on:
                self._on_at = dt_util.utcnow()
                self._t0 = self.current
            elif was_on and not now_on and new is not None and new.state not in (STATE_UNAVAILABLE, STATE_UNKNOWN):
                self.hass.async_create_task(self._after_heating())
        cur = self.current
        if cur is None:
            return
        thr = float(self.opts.get(CONF_BOIL_THRESHOLD) or DEFAULT_BOIL_THRESHOLD)
        if cur >= thr and not self.data.get("in_cycle") and not self._boil_check:
            self._boil_check = async_call_later(self.hass, 20, self._confirm_boil)
        if cur < 60 and self.data.get("in_cycle") and not self._cool_check:
            self._cool_check = async_call_later(self.hass, 180, self._confirm_cool)

    @callback
    def _confirm_boil(self, _now: datetime) -> None:
        self._boil_check = None
        thr = float(self.opts.get(CONF_BOIL_THRESHOLD) or DEFAULT_BOIL_THRESHOLD)
        if (self.current or 0) >= thr and not self.data.get("in_cycle"):
            self._new_day_if_needed()
            for k in ("today", "cleaning", "descaling"):
                self.data[k] = int(self.data.get(k, 0)) + 1
            self.data["in_cycle"] = True
            self._save()

    @callback
    def _confirm_cool(self, _now: datetime) -> None:
        self._cool_check = None
        if (self.current or 100) < 60:
            self.data["in_cycle"] = False
            self._save()

    async def _after_heating(self) -> None:
        """The kettle switched off: energy, heating rate, water, drink stages, notifications."""
        on_at, t0 = self._on_at, self._t0
        self._on_at = None
        if on_at is None:
            return
        mins = (dt_util.utcnow() - on_at).total_seconds() / 60
        cur, tgt = self.current, self.target
        if 0.05 < mins < 30:
            self._new_day_if_needed()
            self.data["energy_today"] = round(float(self.data.get("energy_today", 0)) + self.power * mins / 60000, 4)
            self.data["last_boil"] = dt_util.utcnow().isoformat()
            self.data["last_minutes"] = round(mins, 2)
        reached = cur is not None and tgt is not None and cur >= tgt - 5
        if reached and t0 is not None and 0.5 < mins < 15 and cur - t0 >= 20:
            r = (cur - t0) / mins
            old = self.data.get("rate")
            self.data["rate"] = round(old * 0.7 + r * 0.3 if old else r, 1)
            per_min = r / 1.8 if (self._limits()[1] > 150) else r
            self.data["water"] = round(self.power * 0.9 * 60 / (4186 * per_min), 2)
        self._save()
        if not reached:
            return
        drink = self.drink_now()
        if drink and drink.get("then") is not None and self.data.get("stage2_done") != self.data.get("drink_at"):
            self.data["stage2_done"] = self.data.get("drink_at")
            self._save()
            await self.async_set_target(drink["then"])
            await self.async_keep_warm(drink.get("keep") or 60)
        name = await self._drink_name(drink["key"]) if drink else None
        if self.opts.get(CONF_NOTIFY_BOILED):
            key = "boiled" if name else "water"
            await self._notify(self._text(key).format(drink=name, t=round(cur)))
        if drink and drink.get("steep") and self.opts.get(CONF_NOTIFY_STEEPED, True):
            if self._steep_timer:
                self._steep_timer()
            text = self._text("steeped").format(drink=name, t=round(cur))

            @callback
            def _steeped(_now: datetime) -> None:
                self._steep_timer = None
                self.hass.async_create_task(self._notify(text))

            self._steep_timer = async_call_later(self.hass, float(drink["steep"]) * 60, _steeped)

    # ---- ready at
    @callback
    def _ready_tick(self, _now: datetime) -> None:
        if not self.data.get("ready_on") or self.is_on:
            return
        now = dt_util.now()
        try:
            t = time.fromisoformat(self.data.get("ready_time") or "06:30:00")
        except ValueError:
            return
        ready = now.replace(hour=t.hour, minute=t.minute, second=0, microsecond=0)
        if self.data.get("ready_done") == now.date().isoformat():
            return
        temp = float(self.opts.get(CONF_READY_TEMP) or 100)
        need = max(0.0, (temp - (self.current or 20)) / self.rate) + 1
        left = (ready - now).total_seconds() / 60
        if -2 < left <= need:
            self.data["ready_done"] = now.date().isoformat()
            self._save()

            async def _go() -> None:
                await self.async_set_target(temp)
                await self.async_start()
                if self.opts.get(CONF_NOTIFY_BOILED):
                    await self._notify(self._text("ready_at").format(t=ready.strftime("%H:%M")))

            self.hass.async_create_task(_go())

    def ready_start(self) -> datetime | None:
        try:
            t = time.fromisoformat(self.data.get("ready_time") or "06:30:00")
        except ValueError:
            return None
        now = dt_util.now()
        ready = now.replace(hour=t.hour, minute=t.minute, second=0, microsecond=0)
        if ready < now - timedelta(minutes=2):
            ready += timedelta(days=1)
        temp = float(self.opts.get(CONF_READY_TEMP) or 100)
        return ready - timedelta(minutes=max(0.0, (temp - (self.current or 20)) / self.rate) + 1)

    # ---- notifications
    def _text(self, key: str) -> str:
        lang = (self.hass.config.language or "en").split("-")[0]
        return NOTIFY_TEXTS.get(lang, NOTIFY_TEXTS["en"])[key]

    async def _drink_name(self, key: str) -> str:
        lang = self.hass.config.language or "en"
        tr = await async_get_translations(self.hass, lang, "entity", [DOMAIN])
        return tr.get(f"component.{DOMAIN}.entity.select.drink.state.{key}", key.replace("_", " ").capitalize())

    async def _notify(self, message: str) -> None:
        for target in self.opts.get(CONF_NOTIFY) or []:
            domain, _, service = target.partition(".")
            if not service:
                domain, service = "notify", target
            payload: dict[str, Any] = {"title": self._text("title"), "message": message}
            if domain == "notify" and service.startswith("mobile_app_"):
                payload["data"] = {"tag": f"{DOMAIN}_{self.entry.entry_id}"}
            try:
                # a script gets the variables "title" and "message"
                await self.hass.services.async_call(domain, service, payload, blocking=False)
            except Exception as err:  # noqa: BLE001 – a broken notify target must not break the kettle
                _LOGGER.warning("SETTI Kettle: notify %s failed: %s", target, err)
