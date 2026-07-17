"use strict";
/* PRIMORDIA — main loop
   requestAnimationFrame loop, HUD, resize handling, and the bootstrap that wires everything together. Load this last.
   Depends on: all of the above
   ========================================================================== */
/* ============================================================ MAIN LOOP ==== */
const hud=document.getElementById('hud');
let last=performance.now(), fpsAcc=0, fpsN=0, fps=0, vizTick=0;
function frame(now){
  const rdt=Math.min(0.05,(now-last)/1000); last=now;
  const t=now/1000;
  fpsAcc+=rdt; fpsN++; if(fpsAcc>0.4){ fps=fpsN/fpsAcc; fpsAcc=0; fpsN=0; }

  let octRoot=-1;
  if(CFG.running){ octRoot=simulate(1/60*Math.min(2,rdt*60)); }
  pilot(rdt);
  animateCreature(rdt, t);
  syncMesh();
  // build an octree just for the visualizations if the sim didn't build one this frame
  if((CFG.showField||CFG.showLattice) && CFG.gravity && octRoot<0){ octRoot=buildOctree(); }
  if(CFG.showOctree && CFG.gravity) updateOctreeViz(octRoot); else if(octLines){ scene.remove(octLines); octLines=null; }
  vizTick=(vizTick+1)&3;
  if(CFG.showField && CFG.gravity){
    if(!fieldLines || vizTick===0) buildFieldSamples(octRoot); // refresh sample directions periodically
    animateField(t);                                           // stream the pulses every frame
  } else if(fieldLines){ disposeField(); }
  updateLattice(octRoot);

  // intervention marker
  if(Poke.active){ pokeMarker.visible=true; pokeMarker.position.set(Poke.x,Poke.y,Poke.z);
    pokeMarker.scale.setScalar(Poke.radius); pokeRing.rotation.z=t*2;
    const col=(Poke.sign>0)?0xff8a5c:0x37e0c8; pokeMarker.material.color.setHex(col); pokeRing.material.color.setHex(col);
  } else pokeMarker.visible=false;

  // lights follow soup a touch
  p1.position.set(Math.sin(t*0.3)*40,30,Math.cos(t*0.3)*40);

  if(CFG.follow && creature.root){ cam.target.lerp(creature.root.position,0.05); }
  applyCam();
  renderer.render(scene,camera);

  hud.innerHTML =
    '<div><span class="hk">fps</span> <b>'+fps.toFixed(0)+'</b></div>'+
    '<div><span class="hk">particles</span> <b>'+N+'</b></div>'+
    '<div><span class="hk">pairs/frame</span> <b>'+(lastPairs/1000).toFixed(1)+'k</b></div>'+
    '<div><span class="hk">octree</span> <b>'+(CFG.gravity?nodeCount:'off')+'</b></div>'+
    '<div><span class="hk">mode</span> <b>'+(CFG.gravity?'2-scale':'chem')+'</b></div>';

  requestAnimationFrame(frame);
}

window.addEventListener('resize',()=>{
  camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
});

/* ------------------------------------------------------------- bootstrap -- */
allocParticles(N); allocOctree(); rebuildGridDims();
randomizeMatrix(); seedParticles(); buildMesh(); buildCreature(); buildLattice(); buildPanel();
applyCam();
requestAnimationFrame(frame);
