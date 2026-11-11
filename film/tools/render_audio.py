#!/usr/bin/env python3
"""Thin launcher so the sound engine runs from anywhere: python3 tools/render_audio.py ..."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "sound"))
from engine.render_audio import main  # noqa: E402

if __name__ == "__main__":
    main()
