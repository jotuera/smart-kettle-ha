"""Time: "ready at"."""
from __future__ import annotations

from datetime import time

from homeassistant.components.time import TimeEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import SettiConfigEntry
from .entity import SettiEntity


async def async_setup_entry(hass: HomeAssistant, entry: SettiConfigEntry, add: AddEntitiesCallback) -> None:
    add([SettiReadyAt(entry.runtime_data, "ready_at")])


class SettiReadyAt(SettiEntity, TimeEntity):
    _attr_icon = "mdi:alarm"

    @property
    def native_value(self) -> time | None:
        try:
            return time.fromisoformat(self.brain.data.get("ready_time") or "06:30:00")
        except ValueError:
            return None

    async def async_set_value(self, value: time) -> None:
        self.brain.data["ready_time"] = value.strftime("%H:%M:%S")
        self.brain.data["ready_done"] = None
        self.brain._save()  # noqa: SLF001
