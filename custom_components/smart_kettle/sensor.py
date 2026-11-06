"""Sensors: boil counters, heating rate, water, energy and cost today, last boil, ready-at start."""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorEntityDescription, SensorStateClass
from homeassistant.const import UnitOfEnergy, UnitOfVolume
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.util import dt as dt_util

from . import KettleConfigEntry
from .brain import KettleBrain
from .const import CONF_PRICE, CONF_PRICE_ENTITY
from .entity import KettleEntity


def _price(b: KettleBrain) -> float | None:
    eid = b.opts.get(CONF_PRICE_ENTITY)
    if eid and (s := b.hass.states.get(eid)) is not None:
        try:
            return float(s.state)
        except ValueError:
            return None
    p = b.opts.get(CONF_PRICE)
    return float(p) if p not in (None, "") else None


def _cost(b: KettleBrain) -> float | None:
    p = _price(b)
    return round(float(b.data.get("energy_today", 0)) * p, 2) if p is not None else None


def _ts(v: str | None) -> datetime | None:
    return dt_util.parse_datetime(v) if v else None


@dataclass(frozen=True, kw_only=True)
class KettleSensorDescription(SensorEntityDescription):
    value: Callable[[KettleBrain], Any]
    attrs: Callable[[KettleBrain], dict[str, Any]] | None = None


SENSORS: tuple[KettleSensorDescription, ...] = (
    KettleSensorDescription(key="boils_today", icon="mdi:kettle", state_class=SensorStateClass.MEASUREMENT,
                           value=lambda b: b.data.get("today", 0)),
    KettleSensorDescription(key="boils_since_cleaning", icon="mdi:spray-bottle", state_class=SensorStateClass.MEASUREMENT,
                           value=lambda b: b.data.get("cleaning", 0), attrs=lambda b: {"every": b.cleaning_every}),
    KettleSensorDescription(key="boils_since_descaling", icon="mdi:kettle-alert", state_class=SensorStateClass.MEASUREMENT,
                           value=lambda b: b.data.get("descaling", 0), attrs=lambda b: {"every": b.descaling_every}),
    KettleSensorDescription(key="heating_rate", icon="mdi:speedometer", native_unit_of_measurement="°/min",
                           suggested_display_precision=1, value=lambda b: b.rate,
                           attrs=lambda b: {"learned": bool(b.data.get("rate")), "power": b.power}),
    KettleSensorDescription(key="water_amount", icon="mdi:cup-water", native_unit_of_measurement=UnitOfVolume.LITERS,
                           suggested_display_precision=1, value=lambda b: b.data.get("water")),
    KettleSensorDescription(key="energy_today", device_class=SensorDeviceClass.ENERGY, state_class=SensorStateClass.TOTAL_INCREASING,
                           native_unit_of_measurement=UnitOfEnergy.KILO_WATT_HOUR, suggested_display_precision=2,
                           value=lambda b: round(float(b.data.get("energy_today", 0)), 3)),
    KettleSensorDescription(key="cost_today", icon="mdi:cash", suggested_display_precision=2, value=_cost),
    KettleSensorDescription(key="last_boil", device_class=SensorDeviceClass.TIMESTAMP,
                           value=lambda b: _ts(b.data.get("last_boil")), attrs=lambda b: {"minutes": b.data.get("last_minutes")}),
    KettleSensorDescription(key="ready_start", device_class=SensorDeviceClass.TIMESTAMP, icon="mdi:alarm",
                           value=lambda b: b.ready_start() if b.data.get("ready_on") else None),
)


async def async_setup_entry(hass: HomeAssistant, entry: KettleConfigEntry, add: AddEntitiesCallback) -> None:
    add(KettleSensor(entry.runtime_data, d) for d in SENSORS)


class KettleSensor(KettleEntity, SensorEntity):
    entity_description: KettleSensorDescription

    def __init__(self, brain: KettleBrain, description: KettleSensorDescription) -> None:
        super().__init__(brain, description.key)
        self.entity_description = description
        if description.key == "cost_today":
            self._attr_native_unit_of_measurement = brain.hass.config.currency

    @property
    def native_value(self) -> Any:
        return self.entity_description.value(self.brain)

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        return self.entity_description.attrs(self.brain) if self.entity_description.attrs else None
