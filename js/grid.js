"use strict";
/* PRIMORDIA — uniform grid
   Counting-sort spatial grid (cell = rMax) for O(N) short-range neighbour queries, plus the particle-life force kernel.
   Depends on: config.js, particles.js
   ========================================================================== */
/* ============================================ UNIFORM GRID (short-range) ===
   Cell size = rMax. Counting-sort build (GC-free). 27-neighborhood queries.
   ========================================================================== */
let gN=1, gCells=1, cellOf, cellStart, sortedIdx, cellCount;
function rebuildGridDims(){
  const world=CFG.worldHalf*2;
  gN=Math.max(1, Math.floor(world/CFG.rMax));
  gN=Math.min(gN,64);
  gCells=gN*gN*gN;
  cellOf=new Int32Array(N);
  sortedIdx=new Int32Array(N);
  cellStart=new Int32Array(gCells+1);
  cellCount=new Int32Array(gCells);
}
function cellIndex(x,y,z){
  const h=CFG.worldHalf, inv=gN/(h*2);
  let ix=((x+h)*inv)|0, iy=((y+h)*inv)|0, iz=((z+h)*inv)|0;
  if(ix<0)ix=0; else if(ix>=gN)ix=gN-1;
  if(iy<0)iy=0; else if(iy>=gN)iy=gN-1;
  if(iz<0)iz=0; else if(iz>=gN)iz=gN-1;
  return ix + iy*gN + iz*gN*gN;
}
function buildGrid(){
  cellCount.fill(0);
  for(let i=0;i<N;i++){ const c=cellIndex(px[i],py[i],pz[i]); cellOf[i]=c; cellCount[c]++; }
  let acc=0; for(let c=0;c<gCells;c++){ cellStart[c]=acc; acc+=cellCount[c]; } cellStart[gCells]=acc;
  const cursor=cellStart.slice(0,gCells);
  for(let i=0;i<N;i++){ const c=cellOf[i]; sortedIdx[cursor[c]++]=i; }
}

/* particle-life force profile */
function plForce(rn, a){
  if(rn<CFG.beta) return rn/CFG.beta - 1.0;      // repel core
  if(rn<1.0) return a*(1.0 - Math.abs(2.0*rn-1.0-CFG.beta)/(1.0-CFG.beta));
  return 0.0;
}

