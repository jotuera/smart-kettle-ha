#!/usr/bin/env python3
"""Inline i18n/*.json into dist/smart-kettle-card.js (between TEXTS-BEGIN / TEXTS-END).

    python3 tools/build_i18n.py          # write the card
    python3 tools/build_i18n.py --check  # CI: every language has every English key, no extra keys,
                                         # same {placeholders}, and the card is up to date
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CARD = ROOT / "dist" / "smart-kettle-card.js"
I18N = ROOT / "i18n"
LANGS = ["en", "pl", "de", "cs", "sk", "fr", "it", "es", "nl"]


def load():
    texts, errors = {}, []
    for lang in LANGS:
        path = I18N / f"{lang}.json"
        if not path.exists():
            errors.append(f"missing {path.name}")
            continue
        texts[lang] = json.loads(path.read_text(encoding="utf-8"))
    extra = sorted(p.stem for p in I18N.glob("*.json") if p.stem not in LANGS)
    if extra:
        errors.append(f"languages not in LANGS: {extra}")
    en = texts.get("en", {})
    ph = lambda s: sorted(re.findall(r"\{(\w+)\}", s))
    for lang, t in texts.items():
        for k in en:
            if k not in t:
                errors.append(f"{lang}: missing key {k}")
            elif ph(t[k]) != ph(en[k]):
                errors.append(f"{lang}: {k} placeholders {ph(t[k])} != en {ph(en[k])}")
            elif not t[k].strip():
                errors.append(f"{lang}: {k} is empty")
        for k in t:
            if k not in en:
                errors.append(f"{lang}: extra key {k}")
    return texts, errors


def block(texts):
    lines = ["const TEXTS = {"]
    for lang in LANGS:
        lines.append(f"  {lang}: {json.dumps(texts[lang], ensure_ascii=False, sort_keys=True)},")
    lines.append("};")
    return "\n".join(lines)


def main():
    check = "--check" in sys.argv
    texts, errors = load()
    src = CARD.read_text(encoding="utf-8")
    m = re.search(r"(// TEXTS-BEGIN\n)(.*?)(\n// TEXTS-END)", src, re.S)
    if not m:
        errors.append("TEXTS-BEGIN / TEXTS-END markers not found in the card")
    if errors:
        print("\n".join(errors))
        sys.exit(1)
    new = src[: m.start(2)] + block(texts) + src[m.end(2):]
    if check:
        if new != src:
            print("dist/smart-kettle-card.js is out of date – run python3 tools/build_i18n.py")
            sys.exit(1)
        print(f"ok – {len(LANGS)} languages, {len(texts['en'])} keys")
        return
    if new != src:
        CARD.write_text(new, encoding="utf-8", newline="\n")
        print("card updated")
    else:
        print("card already up to date")


if __name__ == "__main__":
    main()
