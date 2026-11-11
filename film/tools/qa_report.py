#!/usr/bin/env python3
"""QA report for a harness render: DOM geometry + pixel motion + sound-cue correspondence.

    python3 tools/qa_report.py <out_dir> [--tag ""] [--audio-name audio]

Reads   <out_dir>/qa_dom[_tag].json, timeline.json, frames[_tag]/f_*.png
Writes  <out_dir>/qa_report.md, qa.json, av_sync.png
Exit code 1 when any FAIL is present (warnings do not fail).

Checks (thresholds are authored heuristics — see engine/qa.md):
  safe-area   settled text inside the title-safe box; any visible text inside the action-safe box
  overlap     two settled text blocks must not overlap
  dwell       a settled text block must stay readable: 0.3 s per word + 0.35 s
  min-size    font size >= 2.6% of frame height
  contrast    approx. WCAG contrast of text colour vs the pixels around it (>= 3.0 fail, < 4.5 note)
  dead-time   no run of identical frames > 0.6 s outside declared holds
  pops        no unexplained frame-difference spike (hard cuts must be declared with T.cut)
  cue-visual  every sound cue has visible change near its frame ("orphan sound" = FAIL)
"""
import argparse
import json
import math
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "sound"))


def safe_areas(w, h):
    def inset(l, t, r, b):
        return (w * l, h * t, w * (1 - r), h * (1 - b))
    if w > h:
        return {"action": inset(.035, .05, .035, .05), "title": inset(.07, .09, .07, .09)}
    if w == h:
        return {"action": inset(.04, .04, .04, .04), "title": inset(.08, .08, .08, .08)}
    return {"action": inset(.04, .05, .04, .10), "title": inset(.08, .10, .14, .22)}


def inside(r, box, tol=1.0):
    return r[0] >= box[0] - tol and r[1] >= box[1] - tol and r[2] <= box[2] + tol and r[3] <= box[3] + tol


def area(r):
    return max(0.0, r[2] - r[0]) * max(0.0, r[3] - r[1])


def inter(a, b):
    return area((max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])))


def union(rs):
    return (min(r[0] for r in rs), min(r[1] for r in rs), max(r[2] for r in rs), max(r[3] for r in rs))


def lum(rgb):
    def c(v):
        v /= 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = rgb
    return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b)


def contrast(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def parse_rgb(s):
    m = re.findall(r"[\d.]+", s)
    return tuple(float(x) for x in m[:3])


def runs(flags):
    """longest run of True in a list"""
    best = cur = 0
    for f in flags:
        cur = cur + 1 if f else 0
        best = max(best, cur)
    return best


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("out_dir", type=Path)
    ap.add_argument("--tag", default="")
    ap.add_argument("--audio-name", default="audio")
    a = ap.parse_args()
    sfx = f"_{a.tag}" if a.tag else ""
    dom = json.loads((a.out_dir / f"qa_dom{sfx}.json").read_text())
    tl = json.loads((a.out_dir / "timeline.json").read_text())
    cfg = dom["config"]
    W, H, FPS = cfg["width"], cfg["height"], cfg["fps"]
    frames_dir = a.out_dir / f"frames{sfx}"
    step = dom.get("every", 1)
    sa = safe_areas(W, H)
    fails, warns, notes = [], [], []

    # ------------------------------------------------------------ DOM-based checks
    ids = sorted({it["id"] for fr in dom["frames"] for it in fr["items"]})
    per = {i: [] for i in ids}  # id -> list of (frame, settled, bbox_full, bbox_vis, opacity, words, fs, color)
    for fr in dom["frames"]:
        by = {}
        for it in fr["items"]:
            by.setdefault(it["id"], []).append(it)
        for i, its in by.items():
            full_vis = all(
                it["vis"] is not None and it["opacity"] >= 0.95
                and area(it["vis"]) >= 0.97 * max(area(it["full"]), 1e-6) for it in its
            )
            vis_rects = [it["vis"] for it in its if it["vis"] is not None and it["opacity"] >= 0.5]
            per[i].append({
                "f": fr["f"], "settled": full_vis,
                "bbox": union([it.get("tbox") or it["full"] for it in its]) if full_vis else None,
                "visbox": union(vis_rects) if vis_rects else None,
                "words": its[0]["words"], "fs": its[0]["fontSize"], "color": its[0]["color"],
            })

    min_fs = H * 0.026
    for i, rows in per.items():
        words = max(r["words"] for r in rows) or 1
        # min size
        fs = rows[0]["fs"]
        if fs < min_fs - 0.5:
            fails.append(f"min-size: '{i}' font {fs:.0f}px < {min_fs:.0f}px")
        # safe areas
        def stable(k):
            r = rows[k]
            for n in (k - 1, k + 1):
                if 0 <= n < len(rows) and rows[n]["bbox"] is not None:
                    if max(abs(x - y) for x, y in zip(r["bbox"], rows[n]["bbox"])) > 1.0:
                        return False
            return True
        bad_title = [r["f"] for k, r in enumerate(rows)
                     if r["settled"] and stable(k) and not inside(r["bbox"], sa["title"])]
        if bad_title:
            fails.append(f"safe-area: '{i}' leaves the TITLE-safe box on settled frames {bad_title[0]}-{bad_title[-1]} "
                         f"({len(bad_title)} sampled)")
        bad_action = [r["f"] for r in rows if r["visbox"] and not inside(r["visbox"], sa["action"], 2.0)]
        if bad_action:
            warns.append(f"safe-area: '{i}' visible outside the ACTION-safe box on frames "
                         f"{bad_action[0]}-{bad_action[-1]} ({len(bad_action)} sampled)")
        # dwell
        need = math.ceil((0.3 * words + 0.35) * FPS / step)
        have = runs([r["settled"] for r in rows])
        if have < need:
            fails.append(f"dwell: '{i}' readable for {have * step} frames ({have * step / FPS:.2f}s), "
                         f"needs {need * step} ({(0.3 * words + 0.35):.2f}s for {words} word(s))")
    # overlap
    for x in range(len(ids)):
        for y in range(x + 1, len(ids)):
            A, B = per[ids[x]], per[ids[y]]
            bf = {r["f"]: r for r in B}
            hits = 0
            for r in A:
                o = bf.get(r["f"])
                if o and r["settled"] and o["settled"]:
                    ov = inter(r["bbox"], o["bbox"])
                    if ov > 0.02 * min(area(r["bbox"]), area(o["bbox"])):
                        hits += 1
            if hits:
                fails.append(f"overlap: '{ids[x]}' and '{ids[y]}' overlap on {hits} settled frame(s)")

    # ------------------------------------------------------------ pixel-based checks
    files = sorted(frames_dir.glob("f_*.png"))
    fnums = [int(re.search(r"f_(\d+)", p.name).group(1)) for p in files]
    thumbs = []
    for p in files:
        im = Image.open(p).convert("L")
        thumbs.append(np.asarray(im.resize((480, round(480 * im.height / im.width)), Image.BILINEAR), dtype=np.float32))
    # fraction of pixels that changed by > 6 levels (sensitive to thin lines and small text, unlike a mean)
    diff = [0.0] + [float(np.mean(np.abs(thumbs[k] - thumbs[k - 1]) > 6)) for k in range(1, len(thumbs))]
    diff = np.array(diff)

    cuts = {c["frame"] for c in tl.get("cuts", [])}
    holds = tl.get("holds", [])
    in_hold = lambda f: any(h["from"] <= f <= h["to"] for h in holds)  # noqa: E731

    # dead time
    eps = 1e-6
    dead_need = math.ceil(0.6 * FPS / step)
    k = 0
    while k < len(diff):
        if diff[k] < eps and not in_hold(fnums[k]):
            j = k
            while j < len(diff) and diff[j] < eps and not in_hold(fnums[j]):
                j += 1
            if j - k >= dead_need:
                warns.append(f"dead-time: no change on frames {fnums[k]}-{fnums[j - 1]} "
                             f"({(j - k) * step / FPS:.2f}s) — declare T.hold() if intentional")
            k = j
        else:
            k += 1

    # pops
    pos = diff[diff > eps]
    med = float(np.median(pos)) if len(pos) else 0.0
    for k, d in enumerate(diff):
        f = fnums[k]
        if d > max(10 * med, 0.25) and not any(abs(f - c) <= step for c in cuts):
            warns.append(f"pop: frame {f} differs sharply from the previous one ({d:.3f}) and is not a declared cut")

    # cue <-> visual
    cue_rows = []
    fidx = {f: i for i, f in enumerate(fnums)}
    for c in tl["cues"]:
        f = c["frame"]
        if c["kind"] in ("chime", "shimmer"):  # resolution cues: the visible event is the *arrival* just before
            lo, hi = f - 8, f + 3
        elif c["anchor"] == "start" or c["kind"] in ("impact", "thud", "snap", "click", "tick", "type", "pop", "blip"):
            lo, hi = f - 1, f + 4
        else:
            span = max(2, round(c["dur"] * FPS))
            lo, hi = f - round(span * c["peak"]), f + round(span * (1 - c["peak"]))
        idxs = [fidx[x] for x in range(lo, hi + 1) if x in fidx]
        if not idxs:
            continue
        local = float(np.max(diff[idxs]))
        base_idx = [fidx[x] for x in range(f - 20, f + 21) if x in fidx and not (lo <= x <= hi)]
        base = float(np.median(diff[base_idx])) if base_idx else 0.0
        ratio = local / base if base > 1e-6 else float("inf")
        ok = local > 2e-4 or ratio > 1.8
        cue_rows.append({"id": c["id"], "kind": c["kind"], "frame": f, "local": round(local, 5),
                         "baseline": round(base, 5), "ratio": None if math.isinf(ratio) else round(ratio, 1), "ok": ok})
        if not ok:
            fails.append(f"cue-visual: '{c['id']}' ({c['kind']}, f{f}) — nothing visible changes near its frame "
                         f"(orphan sound; scores: {c['scores']})")

    # contrast (approx)
    for i, rows in per.items():
        st = [r for r in rows if r["settled"]]
        if not st:
            continue
        r = st[len(st) // 2]
        p = frames_dir / f"f_{r['f']:05d}.png"
        im = np.asarray(Image.open(p).convert("RGB"), dtype=np.float32)
        x0, y0, x1, y1 = [int(round(v)) for v in r["bbox"]]
        pts = [(x0 - 3, y0 - 3), (x1 + 3, y0 - 3), (x0 - 3, y1 + 3), (x1 + 3, y1 + 3)]
        px = [im[min(max(y, 0), im.shape[0] - 1), min(max(x, 0), im.shape[1] - 1)] for x, y in pts]
        bg = tuple(np.median(np.array(px), axis=0))
        cr = contrast(parse_rgb(r["color"]), bg)
        if cr < 3.0:
            fails.append(f"contrast: '{i}' ≈{cr:.1f}:1 against its surroundings (< 3:1)")
        elif cr < 4.5 and r["fs"] < H * 0.05:
            notes.append(f"contrast: '{i}' ≈{cr:.1f}:1 at {r['fs']:.0f}px — fine for a decorative caption, "
                         f"weak for essential small text")

    # ------------------------------------------------------------ report
    result = {
        "config": cfg, "frames_checked": len(files), "sampled_every": step,
        "fails": fails, "warnings": warns, "notes": notes, "cue_visual": cue_rows,
        "motion": {"median_diff": med, "max_diff": float(diff.max())},
    }
    (a.out_dir / "qa.json").write_text(json.dumps(result, indent=2))
    md = [f"# QA — {cfg['id']}  ({W}x{H} @ {FPS}fps, {len(files)} frames checked)\n"]
    md.append(f"**Result: {'FAIL' if fails else 'PASS'}**  —  {len(fails)} fail, {len(warns)} warning, {len(notes)} note\n")
    for title, items in (("Failures", fails), ("Warnings", warns), ("Notes", notes)):
        if items:
            md.append(f"\n## {title}\n" + "\n".join(f"- {x}" for x in items))
    md.append("\n## Cue ↔ visual activity\n\n| cue | kind | frame | activity | baseline | ok |\n|---|---|---|---|---|---|")
    for r in cue_rows:
        md.append(f"| {r['id']} | {r['kind']} | {r['frame']} | {r['local']} | {r['baseline']} | {'✔' if r['ok'] else '✘'} |")
    (a.out_dir / "qa_report.md").write_text("\n".join(md) + "\n")

    # av overview (picture activity over the master waveform/spectrogram) when audio exists
    wav = a.out_dir / f"{a.audio_name}.wav"
    if wav.exists():
        from engine import analyze
        analyze.plot_overview(tl, a.out_dir, a.audio_name, a.out_dir / "av_sync.png", visual_activity=diff.tolist())

    print("\n".join(md[:1 + 1]))
    for title, items in (("FAIL", fails), ("WARN", warns), ("NOTE", notes)):
        for x in items:
            print(f"  {title}: {x}")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
