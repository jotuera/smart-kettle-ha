"""Switch: "ready at" on / off."""
from __future__ import annotations

from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import SettiConfigEntry
from .entity import SettiEntity


async def async_setup_entry(hass: HomeAssistant, entry: SettiConfigEntry, add: AddEntitiesCallback) -> None:
    add([SettiReadyOn(entry.runtime_data, "ready_at_enabled")])


class SettiReadyOn(SettiEntity, SwitchEntity):
    _attr_icon = "mdi:alarm-check"

    @property
    def is_on(self) -> bool:
        return bool(self.brain.data.get("ready_on"))

    async def async_turn_on(self, **kwargs: Any) -> None:
        self.brain.data["ready_on"] = True
        self.brain._save()  # noqa: SLF001

    async def async_turn_off(self, **kwargs: Any) -> None:
        self.brain.data["ready_on"] = False
        self.brain._save()  # noqa: SLF001
