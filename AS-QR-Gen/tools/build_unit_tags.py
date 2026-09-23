"""Build unit_tags.json for the AS-QR-Gen dev copy from the game lua dump.

Reads cfg_pet.lua (shared/pet) and writes ../unit_tags.json:
  { "<internal_id>": {"star": 6, "e1": 3, "e2": 1, "faction": 1004}, ... }

Column map (from the lua `key` table):
  Star=9, FirstElement=10, SecondElement=11, Tags=13, Prof=14, FriendTeam=16
Elements: 1=Water 2=Fire 3=Forest 4=Thunder 6=No Element (special, Claymore only)
  SecondElement 0 = single-element (no secondary).
Factions (Tags[0]): 1001 Lumopolis, 1002 Umbraton, 1003 Illumina Federation,
  1004 Northland, 1005 Rediesel Wrench, 1006 True Order, 1007 Independent,
  1009 Longzhou (1008 Eclipse has no playable units).
Classes (Prof): 2001 Converter, 2002 Sniper, 2003 Detonator, 2004 Support
  (names from str_pet_tag_job_name_* in str_pet.lua).

MANUAL_OVERRIDES covers units missing from the lua dump (newer than the dump).

Usage: py tools/build_unit_tags.py [path-to-cfg_pet.lua]
Default lua path is the local dump; override if yours lives elsewhere.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_LUA = r"C:\Stuff\AlchemyStarsLua\all 1.43 lua in original path\PublishResources\config\shared\pet\cfg_pet.lua"
OUT = os.path.join(os.path.dirname(HERE), "unit_tags.json")

# Units missing from the lua dump (added to the game later). Values confirmed by hand.
# Sheol: 6★, Water/Water, Umbraton, Sniper. Pepita: 6★, Fire/Fire, True Order, Converter.
MANUAL_OVERRIDES = {
    "1101061": {"star": 6, "e1": 1, "e2": 1, "faction": 1002, "class": 2002},
    "1602411": {"star": 6, "e1": 2, "e2": 2, "faction": 1006, "class": 2001},
}


def main():
    lua_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_LUA
    t = open(lua_path, encoding="utf-8").read()

    common_block = re.search(r"local common = \{(.*?)\n\}", t, re.S).group(1)
    tokens = []
    pat = re.compile(r'"([^"]*)"|\{([^}]*)\}|nil|(-?[\d.]+)')
    for m in pat.finditer(common_block):
        if m.group(1) is not None:
            tokens.append(m.group(1))
        elif m.group(2) is not None:
            inner = m.group(2).strip()
            if not inner:
                tokens.append([])
            elif '"' in inner:
                tokens.append(re.findall(r'"([^"]*)"', inner))
            else:
                tokens.append([int(x) for x in re.findall(r"-?\d+", inner)])
        elif m.group(0) == "nil":
            tokens.append(None)
        else:
            v = m.group(3)
            tokens.append(float(v) if "." in v else int(v))

    def split_top(body):
        """Split a lua table body into top-level comma-separated values."""
        parts, depth, instr, cur = [], 0, False, []
        i = 0
        while i < len(body):
            c = body[i]
            if instr:
                cur.append(c)
                if c == '"':
                    instr = False
            elif c == '"':
                instr = True
                cur.append(c)
            elif c in "{(":
                depth += 1
                cur.append(c)
            elif c in "})":
                depth -= 1
                cur.append(c)
            elif c == "," and depth == 0:
                parts.append("".join(cur))
                cur = []
            else:
                cur.append(c)
            i += 1
        if "".join(cur).strip():
            parts.append("".join(cur))
        return parts

    def resolve(v):
        v = v.strip().rstrip(",").strip()
        if not v:
            return None
        m = re.match(r"common\[(\d+)\]", v)
        if m:
            return tokens[int(m.group(1)) - 1]
        if v == "nil":
            return None
        if v.startswith('"'):
            return v.strip('"')
        if v.startswith("{"):
            inner = v.strip()[1:-1].strip()
            if not inner:
                return []
            if '"' in inner:
                return re.findall(r'"([^"]*)"', inner)
            return [int(x) for x in re.findall(r"-?\d+", inner)]
        try:
            return int(v)
        except ValueError:
            try:
                return float(v)
            except ValueError:
                return v

    out = {}
    blocks = re.findall(r"\[(\d{7})\] = \{(.*?)\n  \},", t, re.S)
    proflist = {}
    for pid, body in blocks:
        vals = [resolve(part) for part in split_top(body)]
        tags = vals[12] if isinstance(vals[12], list) else []
        out[pid] = {
            "star": vals[8],
            "e1": vals[9],
            "e2": vals[10],
            "faction": tags[0] if tags else None,
            "class": vals[13],
        }
        proflist[vals[13]] = proflist.get(vals[13], 0) + 1

    out.update(MANUAL_OVERRIDES)

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1)
    print("wrote %s (%d pets)" % (OUT, len(out)))
    print("prof distribution:", proflist)


if __name__ == "__main__":
    main()
