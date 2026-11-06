"""Smart Kettle – a smarter Tuya / Smart Life Wi-Fi kettle in Home Assistant.

Works on top of the kettle's own entities (Tuya, tuya-local, LocalTuya) – no cloud account, no local key:
boil counters, learned heating rate, water amount, energy, drinks with steeping and two-stage formula,
"ready at", notifications – and it serves its Lovelace card (custom:smart-kettle-card) by itself.
"""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components import frontend
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.loader import async_get_integration

from .brain import KettleBrain
from .const import DOMAIN, PLATFORMS

_LOGGER = logging.getLogger(__name__)

# the card is served by the integration, so `type: custom:smart-kettle-card` works without a Lovelace resource;
# the loader imports it unless the user installed a copy of the card as a resource (that copy wins)
CARD_URL = f"/{DOMAIN}/smart-kettle-card.js"
CARD_FILE = Path(__file__).parent / "frontend" / "smart-kettle-card.js"
LOADER_URL = f"/{DOMAIN}/smart-kettle-loader.js"
LOADER_FILE = Path(__file__).parent / "frontend" / "smart-kettle-loader.js"

type KettleConfigEntry = ConfigEntry[KettleBrain]


async def _async_register_card(hass: HomeAssistant, version: str | None) -> None:
    """Serve the card bundle and its loader once per Home Assistant run."""
    if hass.data.get(f"{DOMAIN}_card") or not CARD_FILE.is_file() or not LOADER_FILE.is_file():
        return
    hass.data[f"{DOMAIN}_card"] = True
    from homeassistant.components.http import StaticPathConfig

    await hass.http.async_register_static_paths([
        StaticPathConfig(CARD_URL, str(CARD_FILE), False),
        StaticPathConfig(LOADER_URL, str(LOADER_FILE), False),
    ])
    frontend.add_extra_js_url(hass, f"{LOADER_URL}?v={version or '0'}")


async def async_setup_entry(hass: HomeAssistant, entry: KettleConfigEntry) -> bool:
    integration = await async_get_integration(hass, DOMAIN)
    await _async_register_card(hass, str(integration.version) if integration.version else None)
    brain = KettleBrain(hass, entry)
    await brain.async_setup()
    entry.runtime_data = brain
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_reload))
    return True


async def _async_reload(hass: HomeAssistant, entry: KettleConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: KettleConfigEntry) -> bool:
    ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if ok:
        await entry.runtime_data.async_unload()
    return ok
