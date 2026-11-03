"""Export one reproducible, unsmoothed QEOxford comparison for the project page.

Source prediction logs stay in result/ locally. This script publishes only the
selected 400-frame XY coordinates and transparent alignment metadata.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
RESULT = ROOT / "result"
OUTPUT = ROOT / "assets" / "trajectory-0300.json"
START = 38650  # zero-based frame index in the common 17-14-03-00 test sequence
COUNT = 400

# LightLoc's folder is named 17-13-03-00 in the supplied material. Its GT file
# exactly matches GTRLoc's 17-14-03-00 GT, so it is the same sequence.
SOURCES = {
    "BiLi": {
        "folder": "Our_BiLi/QEOxford/2019-01-17-14-03-00-radar-oxford-10k",
        "shift": 0,
    },
    "LightLoc": {"folder": "LightLoc/QEOxford/17-13-03-00", "shift": 0},
    "RALoc": {"folder": "RALoc/QEOxford/17-14-03-00", "shift": 5},
    "GTRLoc": {"folder": "GTRLoc/QEOxford/17-14-03-00", "shift": 0},
}


def load_xy(path: Path) -> np.ndarray:
    points = np.loadtxt(path, usecols=(0, 1), dtype=np.float64)
    if points.ndim != 2 or points.shape[1] != 2 or not np.isfinite(points).all():
        raise ValueError(f"Invalid XY trajectory: {path}")
    return points


def round_points(points: np.ndarray) -> list[list[float]]:
    # Rounding to 0.1 mm limits JSON size; no temporal filtering is performed.
    return np.round(points, 4).tolist()


def main() -> None:
    reference_folder = RESULT / SOURCES["GTRLoc"]["folder"]
    reference_gt = load_xy(reference_folder / "gt_t.txt")
    if len(reference_gt) != 43695:
        raise ValueError(f"Unexpected reference length: {len(reference_gt)}")
    end = START + COUNT
    if end > len(reference_gt):
        raise ValueError("Window is outside the reference trajectory")

    # A common local origin keeps coordinates compact. It does not change shape.
    origin = reference_gt[START].copy()
    selected_gt = reference_gt[START:end] - origin
    series = []

    for name, source in SOURCES.items():
        folder = RESULT / source["folder"]
        shift = source["shift"]
        own_gt = load_xy(folder / "gt_t.txt")
        pred = load_xy(folder / "pred_t.txt")
        if len(own_gt) != len(pred):
            raise ValueError(f"GT/prediction length mismatch for {name}")
        aligned_gt = own_gt[shift : shift + len(reference_gt)]
        aligned_pred = pred[shift : shift + len(reference_gt)]
        if len(aligned_gt) != len(reference_gt):
            raise ValueError(f"Insufficient frames for {name}")

        # Only a constant translation is permitted. Reject any incorrect
        # sequence or time alignment instead of warping it into agreement.
        offset = np.median(aligned_gt - reference_gt, axis=0)
        residual = np.linalg.norm(aligned_gt - offset - reference_gt, axis=1)
        if float(np.quantile(residual, 0.99)) > 0.002:
            raise ValueError(f"GT alignment failed for {name}")

        selected_pred = aligned_pred[START:end] - offset
        error = np.linalg.norm(selected_pred - reference_gt[START:end], axis=1)
        third_difference = np.diff(selected_pred, n=3, axis=0)
        jitter = np.linalg.norm(third_difference, axis=1)
        series.append(
            {
                "name": name,
                "xy": round_points(selected_pred - origin),
                "mean_xy_error_m": round(float(np.mean(error)), 3),
                "mean_third_difference_m_per_frame3": round(
                    float(np.mean(jitter)), 3
                ),
                "source": f"result/{source['folder']}/pred_t.txt",
                "frame_shift": shift,
                "translation_removed_xy_m": np.round(offset, 4).tolist(),
                "gt_alignment_p99_residual_m": round(
                    float(np.quantile(residual, 0.99)), 6
                ),
            }
        )

    payload = {
        "dataset": "Quality-enhanced Oxford RobotCar",
        "sequence": "17-14-03-00",
        "frame_start_zero_based": START,
        "frame_end_zero_based_inclusive": end - 1,
        "frame_count": COUNT,
        "reference_gt": "result/GTRLoc/QEOxford/17-14-03-00/gt_t.txt",
        "local_origin_xy_m": np.round(origin, 4).tolist(),
        "ground_truth_xy": round_points(selected_gt),
        "series": series,
        "notes": [
            "All four panels use the same frame indices, XY bounds, ground truth, and rendering.",
            "Predictions are raw supplied positions with only a GT-verified constant coordinate translation removed; RALoc additionally starts five records later.",
            "No prediction has been smoothed, interpolated, or retimed.",
            "The road graphic is a schematic ribbon derived from the ground-truth path, not a geographic basemap.",
            "The displayed 400-frame window is illustrative; paper tables report full-sequence metrics.",
        ],
    }
    OUTPUT.parent.mkdir(exist_ok=True)
    OUTPUT.write_text(
        json.dumps(payload, separators=(",", ":"), ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT} ({OUTPUT.stat().st_size} bytes)")
    for item in series:
        print(
            item["name"],
            "mean XY error:",
            item["mean_xy_error_m"],
            "mean third difference:",
            item["mean_third_difference_m_per_frame3"],
            "frame shift:",
            item["frame_shift"],
        )


if __name__ == "__main__":
    main()
