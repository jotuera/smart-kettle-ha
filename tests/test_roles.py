#!/usr/bin/env python3
"""The integration (custom_components/smart_kettle/roles.py) and the card (dist/smart-kettle-card.js) must find the
same entities for the same kettle – every device of tests/fixtures_kettles.json, for every supported ecosystem.

    python3 tests/test_roles.py
"""
import importlib.util
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("roles", ROOT / "custom_components" / "smart_kettle" / "roles.py")
roles = importlib.util.module_from_spec(spec)
spec.loader.exec_module(roles)

fixtures = json.loads((ROOT / "tests" / "fixtures_kettles.json").read_text(encoding="utf-8"))
card = None
if shutil.which("node"):
    card = json.loads(subprocess.run(["node", str(ROOT / "tests" / "roles_card.js")], capture_output=True, text=True, check=True).stdout)

fail = 0
for name, fx in fixtures.items():
    got = roles.match_roles((eid, tk) for eid, tk, _ in fx["entities"])
    want = fx["roles"]
    errors = [f"{k}: {got.get(k)} != {v}" for k, v in want.items() if got.get(k) != v]
    is_kettle = roles.looks_like_kettle([tuple(e) for e in fx["entities"]], fx["device"])
    if is_kettle != fx.get("kettle", True):
        errors.append(f"looks_like_kettle={is_kettle}")
    if card is not None:
        c = card[name]
        if c["kettle"] != is_kettle:
            errors.append(f"card kettle={c['kettle']} integration kettle={is_kettle}")
        card_only = {"mode", "fault", "time_left"}  # the card shows them, the integration does not need them
        diff = {k for k in (set(got) | set(c["roles"])) - card_only if got.get(k) != c["roles"].get(k)}
        errors += [f"card/integration differ on {k}: {c['roles'].get(k)} / {got.get(k)}" for k in sorted(diff)]
    print(("ok  " if not errors else "FAIL ") + name + ("" if not errors else "\n     " + "\n     ".join(errors)))
    fail += bool(errors)

# the same kettle profiles in the card and in the integration
js = (ROOT / "dist" / "smart-kettle-card.js").read_text(encoding="utf-8")
seg = js[js.index("const PROFILES = {"):js.index("};", js.index("const PROFILES = {"))]
card_profiles = set(re.findall(r"^\s{2}(\w+): \{", seg, re.M))
const_src = (ROOT / "custom_components" / "smart_kettle" / "const.py").read_text(encoding="utf-8")
pseg = const_src[const_src.index("PROFILES = {"):const_src.index("}\n\n", const_src.index("PROFILES = {"))]
int_profiles = set(re.findall(r'^\s{4}"(\w+)": \{', pseg, re.M))
if card_profiles != int_profiles:
    print(f"FAIL profiles differ – card only {sorted(card_profiles - int_profiles)}, integration only {sorted(int_profiles - card_profiles)}")
    fail += 1
else:
    print(f"ok  {len(card_profiles)} profiles, the same in the card and in the integration")

print(f"\n{len(fixtures) - fail}/{len(fixtures)} kettles: integration and card agree" + ("" if card is not None else " (node not found – card not compared)"))
sys.exit(1 if fail else 0)
