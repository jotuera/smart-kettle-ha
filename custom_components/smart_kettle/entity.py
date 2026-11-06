"""Base entity: attached to the kettle's own device, refreshed by the brain."""
from __future__ import annotations

from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import Entity

from .brain import KettleBrain
from .const import SIGNAL_UPDATE


class KettleEntity(Entity):
    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, brain: KettleBrain, key: str) -> None:
        self.brain = brain
        self._attr_translation_key = key
        self._attr_unique_id = f"{brain.device_id}_{key}"
        # the entities appear on the kettle's own device page, next to the Tuya entities – linked the way
        # Home Assistant helpers link to a device of another integration (no device of our own is created)
        self.device_entry = dr.async_get(brain.hass).async_get(brain.device_id)

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(async_dispatcher_connect(
            self.hass, SIGNAL_UPDATE.format(self.brain.entry.entry_id), self.async_write_ha_state))
