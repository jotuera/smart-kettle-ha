"""Binary sensors: cleaning due, descaling due."""
from __future__ import annotations

from homeassistant.components.binary_sensor import BinarySensorDeviceClass, BinarySensorEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import SettiConfigEntry
from .brain import KettleBrain
from .entity import SettiEntity


async def async_setup_entry(hass: HomeAssistant, entry: SettiConfigEntry, add: AddEntitiesCallback) -> None:
    b = entry.runtime_data
    add([SettiDue(b, "cleaning_due", "cleaning", "mdi:spray-bottle"), SettiDue(b, "descaling_due", "descaling", "mdi:kettle-alert")])


class SettiDue(SettiEntity, BinarySensorEntity):
    _attr_device_class = BinarySensorDeviceClass.PROBLEM

    def __init__(self, brain: KettleBrain, key: str, counter: str, icon: str) -> None:
        super().__init__(brain, key)
        self._counter = counter
        self._attr_icon = icon

    @property
    def is_on(self) -> bool:
        every = self.brain.cleaning_every if self._counter == "cleaning" else self.brain.descaling_every
        return int(self.brain.data.get(self._counter, 0)) >= every
