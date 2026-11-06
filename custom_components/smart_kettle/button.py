"""Buttons: cleaned, descaled (reset the counters)."""
from __future__ import annotations

from homeassistant.components.button import ButtonEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import KettleConfigEntry
from .brain import KettleBrain
from .entity import KettleEntity


async def async_setup_entry(hass: HomeAssistant, entry: KettleConfigEntry, add: AddEntitiesCallback) -> None:
    b = entry.runtime_data
    add([KettleReset(b, "cleaned", "cleaning", "mdi:spray-bottle"), KettleReset(b, "descaled", "descaling", "mdi:kettle-alert")])


class KettleReset(KettleEntity, ButtonEntity):
    def __init__(self, brain: KettleBrain, key: str, counter: str, icon: str) -> None:
        super().__init__(brain, key)
        self._counter = counter
        self._attr_icon = icon

    async def async_press(self) -> None:
        self.brain.reset(self._counter)
