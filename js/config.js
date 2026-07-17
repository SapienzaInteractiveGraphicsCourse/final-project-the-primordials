"use strict";
/* PRIMORDIA — config
   Global tunables (CFG), poke state, colour palette. Single source of truth: every other file reads CFG and never redefines it.
   Depends on: THREE (global)
   ========================================================================== */
/* ============================================================================
   PRIMORDIA — 3D Particle Life with Barnes–Hut gravity
   Two-scale emergence:
     • short-range, type-dependent "chemistry" (asymmetric attraction matrix)
       accelerated with a uniform spatial grid  → O(N)
     • long-range, mass-dependent gravity        → Barnes–Hut octree, O(N log N)
   Plus a hierarchical, self-animated creature the user pilots, which stirs
   the soup with a local force field.
   Everything (models, textures, animation) is generated in JS. No imports.
   ========================================================================== */

const THREEc = THREE;

/* ---------------------------------------------------------------- config -- */
const CFG = {
  count: 1000,
  types: 5,
  rMax: 10,          // interaction radius (world units) for particle-life
  beta: 0.30,        // repulsion-core fraction of rMax
  forceStrength: 3.2,
  frictionHalfLife: 0.045,
  gravity: false,
  G: 0.9,            // gravity strength
  theta: 0.8,        // Barnes-Hut opening angle
  softening: 2.0,
  sizeVariance: 0.6, // 0 = uniform, 1 = very varied
  wrap: false,
  worldHalf: 45,
  running: true,
  showOctree: false,
  pointLights: true,
  creature: true,
  creatureMode: -1,  // -1 attract, +1 repel
  creatureField: 22, // creature influence radius
  creatureStrength: 160, // creature field strength
  creatureBodyR: 3.2, // solid body radius (particles can't enter / bounce off)
  follow: false,
  tool: 'orbit',     // 'orbit' | 'push' | 'pull' | 'warp'
  pokeRadius: 16,
  intensity: 1.6,    // global multiplier for ALL space interventions (poke + impulses)
  showField: false,  // gravity field arrows
  fieldN: 8,         // gravity field samples per axis (density of arrows)
  showLattice: false,// deforming space lattice (warp made visible)
};

// user-intervention state (mouse "poke" in the scene)
// kind: 'push' | 'pull' | 'warp' ; axis = swirl axis (camera forward)
const Poke = { active:false, x:0, y:0, z:0, sign:1, radius:16, kind:'push', ax:0, ay:0, az:1 };

const PALETTE = [
  0x37e0c8, 0xff6bb0, 0x9d7bff, 0xffd24a, 0x54ff9f, 0xff8a5c, 0x53b9ff, 0xf45b69
];

