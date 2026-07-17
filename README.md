# Primordia — 3D Emergence Lab

A 3D particle-life simulation with Barnes–Hut gravity and a piloted articulated creature.
Everything is generated in JS — no assets, no build step.

## Running

Open `index.html` in a browser. That's it — the files load as classic scripts, so
`file://` works with no local server needed.

## Directory layout

```
primordia/
├── index.html          markup + script load order
├── css/
│   └── style.css       all styling (panel, HUD, sliders, matrix, pilot hint)
└── js/
    ├── config.js       CFG tunables, Poke state, PALETTE
    ├── scene.js        renderer, camera, lights, cage, procedural textures
    ├── particles.js    SoA buffers, seeding, attraction matrix, InstancedMesh
    ├── creature.js     Grazer model, procedural gait, WASD piloting
    ├── grid.js         uniform grid (short-range) + particle-life force kernel
    ├── octree.js       Barnes–Hut octree (long-range gravity)
    ├── simulation.js   integrator + debug visualisations + mesh sync
    ├── camera.js       orbit/zoom + poke input
    ├── ui.js           console panel, matrix editor, presets, perturbations
    └── main.js         frame loop, HUD, bootstrap
```

## How the split works

The original file was one script sharing a single global scope. Rather than rewriting
it into ES modules (which would mean adding `export`/`import` to every cross-file
reference and would require a server), the code is split into **classic scripts loaded
in dependency order**. Top-level `const`/`let`/`function` declarations are still visible
to every script that loads after them, so the code is unchanged — only relocated.

**The order in `index.html` matters.** Each file assumes the ones above it have already
run. `config.js` first (everything reads `CFG`), `main.js` last (it bootstraps). Each
file's header comment lists what it depends on.

## If you later want ES modules

Add `type="module"` to a single `<script src="js/main.js">`, then in each file export
what other files use and import it where needed. You'd need to serve over `http://`
(e.g. `python3 -m http.server`) since modules are blocked on `file://`. The current
dependency order in `index.html` is exactly the import graph you'd be encoding, so the
work is mechanical.
