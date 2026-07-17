# Primordia

A 3D emergent-life sandbox built with Three.js: **Barnes–Hut N-body gravity** combined with **short-range particle-life "chemistry"**, a piloted, procedurally-animated hierarchical creature, real-time space-warping tools, and a dynamic streamline visualization of the gravitational field.

Project for the **Interactive Graphics** course — Prof. Marco Schaerf, Dept. of Computer, Control and Management Engineering (DIAG), Sapienza University of Rome.

**🔗 Live demo:** https://sapienzainteractivegraphicscourse.github.io/final-project-the-primordials/

**📄 Project report:** <https://raw.githubusercontent.com/SapienzaInteractiveGraphicsCourse/final-project-the-primordials/main/docs/report.pdf>

---

## Overview

Primordia simulates thousands of particles under two combined force scales:

- **Chemistry (short-range):** an asymmetric, type-based attraction/repulsion matrix (à la particle-life / Clusters) that produces emergent local patterns — cells, chasing trails, worms, crystals.
- **Gravity (long-range):** universal mass-based attraction accelerated with a Barnes–Hut octree, producing large-scale structures such as clusters and orbits.

Both scales can run together or separately, and every rule is exposed as a live, tunable control.

## Features

- **Hierarchical, procedurally-animated creature ("the Grazer")** — a piloted articulated model (hip → thigh → knee → shin → foot, per leg) with a JavaScript-driven procedural gait, no imported animations. It exerts its own attract/repel force field on nearby particles and has a solid body that particles collide with.
- **Barnes–Hut octree gravity** — O(N log N) N-body simulation with adjustable accuracy/speed trade-off (θ), softening, and an octree visualization.
- **Particle-life chemistry** — an editable NxN attraction-rule matrix, adjustable interaction radius, repulsion core, and friction.
- **Space intervention tools** — Push, Pull, and an aggressive Warp tool (swirl + collapse + axial lensing) to physically deform the simulation space, plus one-shot impulses (Shockwave, Implode, Vortex, Warp, Fold, Jitter), all scaled by a global intensity control.
- **Deforming space lattice** — a wireframe grid that visibly bends under gravity and warps under the space tools.
- **Flowing gravitational-field visualization** — animated streamlines with pulses that travel along the field vectors toward mass, in the style of fluid-dynamics flow visualization.
- **Presets** — one-click configurations (Cells, Chase, Galaxies, Web, Orbits, Worms, Crystal, Nebula, Swarm) demonstrating different emergent regimes.
- **Full camera and interaction controls** — orbit, pan, zoom, follow-camera mode (auto-disables on manual pan), and a collapsible control panel with an explanation for every setting.

## Environment & libraries

- **Rendering:** [Three.js](https://threejs.org/) (WebGL)
- No physics engine, no imported models, no imported animations — all geometry, animation, and simulation logic is implemented in JavaScript for this project.

## Controls

| Input | Action |
|---|---|
| Left-drag | Active tool (Orbit / Push / Pull / Warp) |
| Right-drag | Orbit camera |
| Middle-drag / Shift + drag | Pan camera (disables Follow if active) |
| Scroll | Zoom |
| W A S D | Pilot the Grazer |
| Q / E | Grazer up / down |
| Shift | Boost |
| H | Toggle control panel |

## Running locally

This is a self-contained static page — no build step required.

```bash
git clone https://github.com/SapienzaInteractiveGraphicsCourse/final-project-the-primordials.git
cd final-project-the-primordials
# open index.html directly, or serve it locally, e.g.:
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Credits

Concept inspired by hunar4321's *Particle Life* and Jeffrey Ventrella's *Clusters*, extended to 3D with variable mass, Barnes–Hut gravity, space-warping tools, and a piloted articulated creature.

## Authors

_[team member names]_
