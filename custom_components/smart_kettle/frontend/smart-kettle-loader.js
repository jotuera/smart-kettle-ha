// Smart Kettle: loads the dashboard card bundled with the integration, unless the card is already
// installed as a Lovelace resource (then the user's own, possibly newer, copy wins).
const version = new URL(import.meta.url).searchParams.get("v") || "0";
const bundle = `/smart_kettle/smart-kettle-card.js?v=${version}`;

async function cardResourcePresent() {
  try {
    const { conn } = await window.hassConnection;
    const resources = await conn.sendMessagePromise({ type: "lovelace/resources" });
    return resources.some((r) => String(r.url).includes("smart-kettle-card"));
  } catch (err) {
    // no connection yet, or no right to list resources (non-admin): load the bundled card
    return false;
  }
}

if (customElements.get("smart-kettle-card")) {
  console.info("Smart Kettle: card already loaded");
} else if (await cardResourcePresent()) {
  console.info("Smart Kettle: using the card from a Lovelace resource");
} else {
  await import(bundle);
}
