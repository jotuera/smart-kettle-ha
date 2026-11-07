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

from .roles import HEAT_STATUS, match_roles, looks_like_kettle
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

def resolve_kettle(hass: HomeAssistant, device_id: str) -> dict[str, str]:
    """Entities of the kettle device by their translation keys or entity id endings (any language, any integration)."""
    reg = er.async_get(hass)
    return match_roles((e.entity_id, e.translation_key) for e in er.async_entries_for_device(reg, device_id)
                       if not e.disabled_by and e.platform != DOMAIN)


def find_kettles(hass: HomeAssistant) -> dict[str, str]:
    """device_id -> name of every device that looks like a kettle."""
    devs = dr.async_get(hass)
    by_dev: dict[str, list[tuple[str, str | None, str | None]]] = {}
    for e in er.async_get(hass).entities.values():
        if e.device_id and not e.disabled_by and e.platform != DOMAIN:
            by_dev.setdefault(e.device_id, []).append((e.entity_id, e.translation_key, e.platform))
    found: dict[str, str] = {}
    for dev_id, ents in by_dev.items():
        d = devs.async_get(dev_id)
        if d and looks_like_kettle(ents, " ".join(x for x in (d.model, d.model_id, d.name, d.name_by_user) if x)):
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
        if not any(self.ent.get(k) for k in ("start", "water_heater", "climate", "start_button")):
            _LOGGER.warning("Smart Kettle: no start switch / button, water heater or climate found on device %s", self.device_id)
        _LOGGER.debug("Smart Kettle entities of %s: %s", self.device_id, self.ent)
        watch = [self.ent[k] for k in ("start", "water_heater", "climate", "status", "current") if self.ent.get(k)]
        if watch:
            self._unsubs.append(async_track_state_change_event(self.hass, watch, self._on_change))
        self._unsubs.append(async_track_time_change(self.hass, self._midnight, hour=0, minute=0, second=1))
        self._unsubs.append(async_track_time_interval(self.hass, self._ready_tick, timedelta(seconds=30)))
        self._was_on = self.is_on
        if self._was_on:
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

    # ---- kettle state
    def _state(self, role: str):
        eid = self.ent.get(role)
        return self.hass.states.get(eid) if eid else None

    def _main(self):
        """The kettle's main entity: water_heater or climate (None for switch / number kettles)."""
        return self._state("water_heater") or self._state("climate")

    def _ops(self) -> list[str]:
        wh = self._state("water_heater")
        return list(wh.attributes.get("operation_list") or []) if wh else []

    @property
    def is_on(self) -> bool:
        s = self._state("start")
        if s is not None:
            on = s.state == "on"
        elif (cl := self._state("climate")) is not None:
            on = cl.state not in OFF_STATES or cl.attributes.get("hvac_action") == "heating"
        elif (wh := self._state("water_heater")) is not None and self._ops():
            on = wh.state not in OFF_STATES
        else:
            on = False
        st = self._state("status")
        if st is not None and re.sub(r"[\s-]+", "_", st.state.lower()) in HEAT_STATUS:
            on = True
        return on

    @staticmethod
    def _f(v: Any) -> float | None:
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    @property
    def current(self) -> float | None:
        m = self._main()
        if m is not None and (v := self._f(m.attributes.get("current_temperature"))) is not None:
            return v
        s = self._state("current")
        return self._f(s.state) if s else None

    @property
    def target(self) -> float | None:
        s = self._state("target")
        if s is not None:
            return self._f(s.state)
        m = self._main()
        return self._f(m.attributes.get("temperature")) if m is not None else None

    def _limits(self) -> tuple[float, float, float]:
        s = self._state("target") or self._main()
        if s is None:
            return 0, 100, 1
        a = s.attributes
        return (float(a.get("min", a.get("min_temp", 0)) or 0), float(a.get("max", a.get("max_temp", 100)) or 100),
                float(a.get("step", a.get("target_temp_step", 1)) or 1))

    def snap(self, t: float) -> float:
        lo, hi, step = self._limits()
        v = min(max(t, lo), hi)
        return round(round((v - lo) / step) * step + lo)

    # ---- actions on the kettle
    async def _call(self, domain: str, service: str, data: dict[str, Any]) -> None:
        await self.hass.services.async_call(domain, service, data, blocking=True)

    async def async_set_target(self, t: float) -> None:
        t = self.snap(t)
        if self.ent.get("target"):
            await self._call("number", "set_value", {"entity_id": self.ent["target"], "value": t})
        elif (wh := self._state("water_heater")) is not None and wh.attributes.get("temperature") is not None:
            await self._call("water_heater", "set_temperature", {"entity_id": self.ent["water_heater"], "temperature": t})
        elif (cl := self._state("climate")) is not None and cl.attributes.get("temperature") is not None:
            await self._call("climate", "set_temperature", {"entity_id": self.ent["climate"], "temperature": t})

    def _heat_mode(self) -> str | None:
        ops = [m for m in self._ops() if m != "off"]
        if "electric" in ops:
            return "electric"
        if "boil" in ops and ((self.target or 100) >= 90 or "heat" not in ops):
            return "boil"
        for m in ("heat", "on", "eco", "performance"):
            if m in ops:
                return m
        return ops[0] if ops else None

    async def async_start(self) -> None:
        if self.ent.get("start"):
            await self._call("switch", "turn_on", {"entity_id": self.ent["start"]})
        elif self.ent.get("climate") and not self.ent.get("water_heater"):
            await self._call("climate", "set_hvac_mode", {"entity_id": self.ent["climate"], "hvac_mode": "heat"})
        elif self.ent.get("water_heater") and (mode := self._heat_mode()):
            await self._call("water_heater", "set_operation_mode", {"entity_id": self.ent["water_heater"], "operation_mode": mode})
        elif self.ent.get("start_button"):
            await self._call("button", "press", {"entity_id": self.ent["start_button"]})
        elif self.ent.get("water_heater"):
            await self._call("water_heater", "turn_on", {"entity_id": self.ent["water_heater"]})

    @staticmethod
    def _minutes(v: Any) -> float:
        s = str(v)
        if re.match(r"^\d+:\d+", s):
            h, m = s.split(":")[:2]
            return int(h) * 60 + int(m)
        x = re.match(r"^\s*(\d+(?:\.\d+)?)", s)
        return float(x.group(1)) * (60 if "h" in s.lower() and "min" not in s.lower() else 1) if x else 0

    def _closest_option(self, eid: str, value: float) -> str | None:
        s = self.hass.states.get(eid)
        opts = list(s.attributes.get("options") or []) if s else []
        nums = [(abs(self._minutes(o) - value), o) for o in opts if re.match(r"^\s*\d", str(o))]
        return min(nums)[1] if nums else (opts[0] if opts else None)

    async def async_keep_warm(self, minutes: float | None) -> None:
        """Keep warm for `minutes` (None / 0 = off): time as number, time entity or select; then the switch."""
        eid = self.ent.get("keep_warm_time")
        if eid:
            dom = eid.split(".")[0]
            s = self.hass.states.get(eid)
            if minutes and dom == "number":
                mx = self._f(s.attributes.get("max")) if s else None
                await self._call("number", "set_value", {"entity_id": eid, "value": min(minutes, mx) if mx else minutes})
            elif minutes and dom == "time":
                m = int(min(minutes, 1439))
                await self._call("time", "set_value", {"entity_id": eid, "time": f"{m // 60:02d}:{m % 60:02d}:00"})
            elif dom == "select" and s is not None:
                opts = list(s.attributes.get("options") or [])
                off = next((o for o in opts if not re.match(r"^\s*[1-9]", str(o))), None)
                option = self._closest_option(eid, minutes) if minutes else off
                if option:
                    await self._call("select", "select_option", {"entity_id": eid, "option": option})
        if self.ent.get("keep_warm"):
            await self._call("switch", "turn_on" if minutes else "turn_off", {"entity_id": self.ent["keep_warm"]})

    async def async_hold_at(self, temp: float, minutes: float) -> None:
        """Second stage of a drink: hold `temp` – the kettle's keep-warm temperature when it has one, else the target."""
        eid = self.ent.get("keep_warm_temp")
        if eid and eid.startswith("select."):
            option = self._closest_option(eid, temp)
            if option:
                await self._call("select", "select_option", {"entity_id": eid, "option": option})
        elif eid:
            await self._call("number", "set_value", {"entity_id": eid, "value": temp})
        else:
            await self.async_set_target(temp)
        await self.async_keep_warm(minutes)

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
        new = event.data["new_state"]
        # heating on / off from the start switch, the main entity or the status – whichever the kettle has
        if new is not None and new.state != STATE_UNAVAILABLE:
            was_on, now_on = getattr(self, "_was_on", False), self.is_on
            self._was_on = now_on
            if now_on and not was_on:
                self._on_at = dt_util.utcnow()
                self._t0 = self.current
            elif was_on and not now_on:
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
            await self.async_hold_at(drink["then"], drink.get("keep") or 60)
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
                _LOGGER.warning("Smart Kettle: notify %s failed: %s", target, err)
