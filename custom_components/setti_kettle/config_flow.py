"""Config flow: pick the kettle (found automatically), then options."""
from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import callback
from homeassistant.helpers import selector

from .brain import find_kettles
from .const import (
    CONF_BOIL_THRESHOLD,
    CONF_CLEANING_EVERY,
    CONF_DESCALING_EVERY,
    CONF_DEVICE,
    CONF_NOTIFY,
    CONF_NOTIFY_BOILED,
    CONF_NOTIFY_STEEPED,
    CONF_POWER,
    CONF_PRICE,
    CONF_PRICE_ENTITY,
    CONF_PROFILE,
    CONF_READY_TEMP,
    DEFAULT_BOIL_THRESHOLD,
    DEFAULT_CLEANING_EVERY,
    DEFAULT_DESCALING_EVERY,
    DOMAIN,
    PROFILES,
)


def _profile_selector() -> selector.SelectSelector:
    return selector.SelectSelector(selector.SelectSelectorConfig(
        options=[selector.SelectOptionDict(value=k, label=v["name"]) for k, v in PROFILES.items()],
        mode=selector.SelectSelectorMode.DROPDOWN))


class SettiKettleConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        kettles = find_kettles(self.hass)
        configured = {e.data.get(CONF_DEVICE) for e in self._async_current_entries()}
        free = {k: v for k, v in kettles.items() if k not in configured}
        if not free:
            return self.async_abort(reason="no_kettle" if not kettles else "already_configured")
        if user_input is not None:
            await self.async_set_unique_id(user_input[CONF_DEVICE])
            self._abort_if_unique_id_configured()
            data = {CONF_DEVICE: user_input[CONF_DEVICE]}
            options = {CONF_PROFILE: user_input.get(CONF_PROFILE, "auto")}
            if user_input.get(CONF_POWER):
                options[CONF_POWER] = user_input[CONF_POWER]
            return self.async_create_entry(title=free[user_input[CONF_DEVICE]], data=data, options=options)
        schema = vol.Schema({
            vol.Required(CONF_DEVICE, default=next(iter(free))): selector.SelectSelector(selector.SelectSelectorConfig(
                options=[selector.SelectOptionDict(value=k, label=v) for k, v in free.items()], mode=selector.SelectSelectorMode.DROPDOWN)),
            vol.Required(CONF_PROFILE, default="auto"): _profile_selector(),
            vol.Optional(CONF_POWER): selector.NumberSelector(selector.NumberSelectorConfig(
                min=500, max=3500, step=50, unit_of_measurement="W", mode=selector.NumberSelectorMode.BOX)),
        })
        return self.async_show_form(step_id="user", data_schema=schema, description_placeholders={"count": str(len(free))})

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return SettiKettleOptionsFlow()


class SettiKettleOptionsFlow(OptionsFlow):
    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(data={k: v for k, v in user_input.items() if v not in (None, "", [])})
        o = self.config_entry.options
        notify = sorted(f"notify.{s}" for s in self.hass.services.async_services().get("notify", {})
                        if s not in ("notify", "send_message", "persistent_notification"))
        notify += sorted(f"script.{s}" for s in self.hass.services.async_services().get("script", {})
                         if s not in ("reload", "turn_on", "turn_off", "toggle"))
        schema = vol.Schema({
            vol.Required(CONF_PROFILE, default=o.get(CONF_PROFILE, "auto")): _profile_selector(),
            vol.Optional(CONF_POWER, description={"suggested_value": o.get(CONF_POWER)}): selector.NumberSelector(selector.NumberSelectorConfig(
                min=500, max=3500, step=50, unit_of_measurement="W", mode=selector.NumberSelectorMode.BOX)),
            vol.Optional(CONF_PRICE, description={"suggested_value": o.get(CONF_PRICE)}): selector.NumberSelector(selector.NumberSelectorConfig(
                min=0, max=100, step=0.01, mode=selector.NumberSelectorMode.BOX)),
            vol.Optional(CONF_PRICE_ENTITY, description={"suggested_value": o.get(CONF_PRICE_ENTITY)}): selector.EntitySelector(
                selector.EntitySelectorConfig(domain=["sensor", "input_number", "number"])),
            vol.Required(CONF_CLEANING_EVERY, default=o.get(CONF_CLEANING_EVERY, DEFAULT_CLEANING_EVERY)): selector.NumberSelector(
                selector.NumberSelectorConfig(min=1, max=500, mode=selector.NumberSelectorMode.BOX)),
            vol.Required(CONF_DESCALING_EVERY, default=o.get(CONF_DESCALING_EVERY, DEFAULT_DESCALING_EVERY)): selector.NumberSelector(
                selector.NumberSelectorConfig(min=1, max=1000, mode=selector.NumberSelectorMode.BOX)),
            vol.Required(CONF_BOIL_THRESHOLD, default=o.get(CONF_BOIL_THRESHOLD, DEFAULT_BOIL_THRESHOLD)): selector.NumberSelector(
                selector.NumberSelectorConfig(min=40, max=212, mode=selector.NumberSelectorMode.BOX, unit_of_measurement="°")),
            vol.Required(CONF_READY_TEMP, default=o.get(CONF_READY_TEMP, 100)): selector.NumberSelector(
                selector.NumberSelectorConfig(min=40, max=212, mode=selector.NumberSelectorMode.BOX, unit_of_measurement="°")),
            vol.Optional(CONF_NOTIFY, default=o.get(CONF_NOTIFY, [])): selector.SelectSelector(selector.SelectSelectorConfig(
                options=notify, multiple=True, custom_value=True, mode=selector.SelectSelectorMode.DROPDOWN)),
            vol.Required(CONF_NOTIFY_BOILED, default=o.get(CONF_NOTIFY_BOILED, False)): selector.BooleanSelector(),
            vol.Required(CONF_NOTIFY_STEEPED, default=o.get(CONF_NOTIFY_STEEPED, True)): selector.BooleanSelector(),
        })
        return self.async_show_form(step_id="init", data_schema=schema)
