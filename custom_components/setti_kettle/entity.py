"""Base entity: attached to the kettle's own device, refreshed by the brain."""
from __future__ import annotations

from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import Entity

from .brain import KettleBrain
from .const import SIGNAL_UPDATE


class SettiEntity(Entity):
    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, brain: KettleBrain, key: str) -> None:
        self.brain = brain
        self._attr_translation_key = key
        self._attr_unique_id = f"{brain.device_id}_{key}"
        # the entities appear on the kettle's device page, next to the Tuya entities
        self._attr_device_info = DeviceInfo(identifiers=brain.device_info_ids())

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(async_dispatcher_connect(
            self.hass, SIGNAL_UPDATE.format(self.brain.entry.entry_id), self.async_write_ha_state))
