"use strict";
/* PRIMORDIA — camera control
   Orbit/zoom/pan, screen-to-world unprojection, and the mouse/touch bindings that drive the poke tool.
   Depends on: config.js, scene.js
   ========================================================================== */
/* ============================================================ CAMERA CTRL == */
const cam={ target:new THREEc.Vector3(0,0,0), theta:0.7, phi:1.15, radius:130 };
function applyCam(){
  const st=Math.sin(cam.phi), r=cam.radius;
  camera.position.set(
    cam.target.x + r*st*Math.sin(cam.theta),
    cam.target.y + r*Math.cos(cam.phi),
    cam.target.z + r*st*Math.cos(cam.theta)
  );
  camera.lookAt(cam.target);
}
// project a screen position onto a plane through cam.target facing the camera
const _ray=new THREEc.Raycaster(), _ndc=new THREEc.Vector2(), _plane=new THREEc.Plane(), _hit=new THREEc.Vector3(), _n=new THREEc.Vector3();
function screenToWorld(clientX, clientY, out){
  const rect=renderer.domElement.getBoundingClientRect();
  _ndc.x=((clientX-rect.left)/rect.width)*2-1;
  _ndc.y=-((clientY-rect.top)/rect.height)*2+1;
  _ray.setFromCamera(_ndc, camera);
  camera.getWorldDirection(_n);
  _plane.setFromNormalAndCoplanarPoint(_n, cam.target);
  const r=_ray.ray.intersectPlane(_plane, _hit);
  if(r){ out.copy(_hit); return true; }
  return false;
}
function startPoke(clientX, clientY){
  if(screenToWorld(clientX, clientY, _hit)){
    Poke.active=true; Poke.x=_hit.x; Poke.y=_hit.y; Poke.z=_hit.z;
    Poke.kind = CFG.tool;
    Poke.sign = (CFG.tool==='push')? 1 : -1; Poke.radius=CFG.pokeRadius;
    camera.getWorldDirection(_n); Poke.ax=_n.x; Poke.ay=_n.y; Poke.az=_n.z; // swirl axis = view dir
  }
}
function endPoke(){ Poke.active=false; }

(function bindCamera(){
  const el=renderer.domElement; let drag=false,pan=false,lx=0,ly=0;
  el.addEventListener('mousedown',e=>{
    if(e.button===1 || (e.shiftKey && e.button===0)){ pan=true;
      if(CFG.follow && window.__setFollow) window.__setFollow(false); // moving the view breaks follow
    }
    else if(e.button===2){ drag=true; }                 // right-drag always orbits
    else if(e.button===0){ if(CFG.tool==='orbit'){ drag=true; } else { startPoke(e.clientX,e.clientY); } }
    lx=e.clientX;ly=e.clientY;
  });
  window.addEventListener('mouseup',()=>{drag=false;pan=false;endPoke();});
  window.addEventListener('mousemove',e=>{
    const dx=e.clientX-lx, dy=e.clientY-ly; lx=e.clientX; ly=e.clientY;
    if(Poke.active){ startPoke(e.clientX,e.clientY); }
    else if(drag){ cam.theta-=dx*0.005; cam.phi=Math.max(0.08,Math.min(Math.PI-0.08,cam.phi-dy*0.005)); }
    else if(pan){ const s=cam.radius*0.0016;
      const rt=new THREEc.Vector3(Math.cos(cam.theta),0,-Math.sin(cam.theta));
      const up=new THREEc.Vector3(0,1,0);
      cam.target.addScaledVector(rt,-dx*s); cam.target.addScaledVector(up,dy*s);
    }
  });
  el.addEventListener('wheel',e=>{ e.preventDefault(); cam.radius=Math.max(20,Math.min(500,cam.radius*(1+Math.sign(e.deltaY)*0.08))); },{passive:false});
  el.addEventListener('contextmenu',e=>e.preventDefault());
  // touch
  let pinch=0;
  el.addEventListener('touchstart',e=>{ if(e.touches.length===1){drag=true;lx=e.touches[0].clientX;ly=e.touches[0].clientY;}
    else if(e.touches.length===2){pinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);} },{passive:true});
  el.addEventListener('touchmove',e=>{
    if(e.touches.length===1&&drag){ const dx=e.touches[0].clientX-lx,dy=e.touches[0].clientY-ly; lx=e.touches[0].clientX;ly=e.touches[0].clientY;
      cam.theta-=dx*0.006; cam.phi=Math.max(0.08,Math.min(Math.PI-0.08,cam.phi-dy*0.006)); }
    else if(e.touches.length===2){ const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
      if(pinch)cam.radius=Math.max(20,Math.min(500,cam.radius*pinch/d)); pinch=d; }
  },{passive:true});
  el.addEventListener('touchend',()=>{drag=false;pinch=0;});
})();

