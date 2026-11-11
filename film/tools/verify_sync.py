#!/usr/bin/env python3
"""Verify cue -> sound alignment for a rendered audio folder.

    python3 tools/verify_sync.py <timeline.json> <audio_dir> [--name audio] [--plot out.png]
Exit code 1 if any cue is outside half a frame (peaks: 25 ms) of its frame.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "sound"))
from engine import analyze  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("timeline", type=Path)
    ap.add_argument("audio_dir", type=Path)
    ap.add_argument("--name", default="audio")
    ap.add_argument("--plot", type=Path)
    a = ap.parse_args()
    tl = json.loads(a.timeline.read_text())
    res = analyze.verify(tl, a.audio_dir, a.name)
    print(f"{'cue':<22}{'kind':<9}{'frame':>6} {'meas':<6}{'voice':>8}{'place':>8}{'error':>8}{'tol':>7}  ok")
    for r in res["cues"]:
        pl = "-" if r["placement_offset_ms"] is None else f"{r['placement_offset_ms']:.2f}"
        print(f"{r['id']:<22}{r['kind']:<9}{r['frame']:>6} {r['measured']:<6}{r['voice_offset_ms']:>8.2f}"
              f"{pl:>8}{r['error_ms']:>8.2f}{r['tolerance_ms']:>7.1f}  {'PASS' if r['pass'] else 'FAIL'}")
    print("\nALL PASS" if res["all_pass"] else "\nFAILURES PRESENT")
    if a.plot:
        analyze.plot_overview(tl, a.audio_dir, a.name, a.plot)
        print("overview:", a.plot)
    return 0 if res["all_pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
