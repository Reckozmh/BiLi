# BiLi — Bridging the Last Mile in LiDAR Localization

Project website: **[reckozmh.github.io/BiLi/](https://reckozmh.github.io/BiLi/)**  
Manuscript: [BiLi PDF](Paper/BiLi_Final_poster%20%281%29.pdf)

BiLi combines implicit scene-manifold regularization, a distilled kinematic prior, and dynamic manifold gating to improve the spatial accuracy and temporal consistency of LiDAR localization. The supplied manuscript identifies the work as a NeurIPS 2026 manuscript. The implementation and release materials are being prepared; this repository contains the website and its trajectory visualization, **not** the model inference/training code.

## What the website shows

- Motivation, architecture, implicit neural-field reconstruction, and qualitative figures from the supplied paper materials.
- A synchronized 2 × 2 replay of BiLi, LightLoc, RALoc, and GTRLoc on the same 400 frames of QEOxford sequence `17-14-03-00`.
- An offline-generated QR image linking to the project page.

The replay uses zero-based reference frames **38650–39049**. All panels have identical spatial bounds, timestamps, rendering, and ground-truth-derived schematic road. The colored paths are raw supplied prediction positions. No prediction is temporally smoothed, interpolated, or retimed. Each method's coordinate origin is aligned by subtracting a single constant XY offset verified against its ground-truth log. RALoc has five leading extra records, so its records are shifted by five to match the reference sequence. LightLoc's supplied folder is named `17-13-03-00`, but its ground-truth file is identical to GTRLoc's `17-14-03-00` ground truth. The replay is one illustrative segment and is **not** a complete benchmark evaluation.

The small values beneath each panel are computed only on this selected 2D window: mean XY distance to ground truth (metres) and the mean norm of the third frame-to-frame difference (m/frame³). The Oxford/NCLT values farther down the page come from the manuscript's full-sequence tables; do not compare the segment numbers to them as if they used the same evaluation scope.

## Rebuilding the replay data locally

The original experimental logs remain in `result/` and are intentionally excluded from Git because of their size. If you have the supplied logs in the same layout, run:

```powershell
python tools/build_trajectory.py
```

This regenerates `assets/trajectory-0300.json`, including alignment offsets and source paths. The script rejects ground-truth alignments with more than 2 mm 99th-percentile residual.

To preview this static site locally:

```powershell
python -m http.server 8000
```

Then open `http://127.0.0.1:8000/`. A local web server is required because browsers block JSON `fetch` from `file://` pages.

## Materials and contact

The manuscript is in `Paper/`; supplied figures are in `FIG/`, and the supplied neural-field visualization is in `mesh/`. For research questions, contact [mihoo@stu.xmu.edu.cn](mailto:mihoo@stu.xmu.edu.cn).
