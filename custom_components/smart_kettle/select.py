"""Select: the drink – sets the temperature and keep warm, remembered for steeping and the formula's 2nd stage."""
from __future__ import annotations

from homeassistant.components.select import SelectEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import KettleConfigEntry
from .const import DRINK_NONE, DRINKS
from .entity import KettleEntity


async def async_setup_entry(hass: HomeAssistant, entry: KettleConfigEntry, add: AddEntitiesCallback) -> None:
    add([KettleDrink(entry.runtime_data, "drink")])


class KettleDrink(KettleEntity, SelectEntity):
    _attr_icon = "mdi:cup"
    _attr_options = [DRINK_NONE, *DRINKS]

    @property
    def current_option(self) -> str:
        return self.brain.data.get("drink") if self.brain.drink_now() else DRINK_NONE

    async def async_select_option(self, option: str) -> None:
        await self.brain.async_set_drink(option)
