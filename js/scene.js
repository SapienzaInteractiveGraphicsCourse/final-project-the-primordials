"use strict";
/* PRIMORDIA — scene
   Renderer, camera object, lights, boundary cage, poke marker, and the procedurally generated albedo/normal/roughness textures.
   Depends on: config.js
   ========================================================================== */
/* -------------------------------------------------------------- renderer -- */
const app = document.getElementById('app');
const renderer = new THREEc.WebGLRenderer({antialias:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREEc.sRGBEncoding;
app.appendChild(renderer.domElement);

const scene = new THREEc.Scene();
scene.background = new THREEc.Color(0x05070d);
scene.fog = new THREEc.FogExp2(0x05070d, 0.006);

const camera = new THREEc.PerspectiveCamera(55, window.innerWidth/window.innerHeight, 0.5, 2000);

/* ------------------------------------------------------------- lighting -- */
const ambient = new THREEc.AmbientLight(0x33405a, 0.55);
scene.add(ambient);
const sun = new THREEc.DirectionalLight(0xbcd3ff, 0.85);
sun.position.set(60, 90, 40);
scene.add(sun);
const rim = new THREEc.DirectionalLight(0x2a4a7a, 0.5);
rim.position.set(-50, -20, -60);
scene.add(rim);
const p1 = new THREEc.PointLight(0x37e0c8, 1.6, 260, 2.0); p1.position.set(0, 30, 0);
const p2 = new THREEc.PointLight(0xff6bb0, 1.2, 220, 2.0); p2.position.set(-40, -30, 30);
scene.add(p1); scene.add(p2);

/* boundary cage (subtle, rebuildable when the world is resized) */
let cage = null;
const cageMat = new THREEc.LineBasicMaterial({color:0x1b2740, transparent:true, opacity:0.6});
function rebuildCage(){
  if(cage){ scene.remove(cage); cage.geometry.dispose(); }
  const w=CFG.worldHalf*2;
  cage = new THREEc.LineSegments(new THREEc.EdgesGeometry(new THREEc.BoxGeometry(w,w,w)), cageMat);
  scene.add(cage);
}
rebuildCage();

/* intervention marker: a soft ring that shows where you are poking */
const pokeMarker = new THREEc.Mesh(
  new THREEc.SphereGeometry(1, 20, 16),
  new THREEc.MeshBasicMaterial({color:0x37e0c8, transparent:true, opacity:0.12, depthWrite:false})
);
const pokeRing = new THREEc.Mesh(
  new THREEc.TorusGeometry(1, 0.02, 8, 40),
  new THREEc.MeshBasicMaterial({color:0x37e0c8, transparent:true, opacity:0.7, depthWrite:false})
);
pokeMarker.add(pokeRing);
pokeMarker.visible=false;
scene.add(pokeMarker);

/* --------------------------------------------------- procedural textures -- */
// Albedo: soft radial shading + faint speckle, kept light so per-instance
// color tints it. Normal map: bumpy detail. Roughness map: varied micro-surface.
function makeAlbedo(){
  const s=128, c=document.createElement('canvas'); c.width=c.height=s;
  const x=c.getContext('2d');
  const g=x.createRadialGradient(s*0.38,s*0.34,4, s*0.5,s*0.5,s*0.62);
  g.addColorStop(0,'#ffffff'); g.addColorStop(0.6,'#d9dde6'); g.addColorStop(1,'#aeb6c6');
  x.fillStyle=g; x.fillRect(0,0,s,s);
  for(let i=0;i<900;i++){ x.fillStyle='rgba(255,255,255,'+(Math.random()*0.10)+')';
    x.fillRect(Math.random()*s,Math.random()*s,1,1); }
  const t=new THREEc.CanvasTexture(c); t.encoding=THREEc.sRGBEncoding; return t;
}
function makeNormal(){
  const s=128, c=document.createElement('canvas'); c.width=c.height=s;
  const x=c.getContext('2d'); x.fillStyle='#8080ff'; x.fillRect(0,0,s,s);
  for(let i=0;i<70;i++){
    const px=Math.random()*s, py=Math.random()*s, r=4+Math.random()*10;
    const g=x.createRadialGradient(px,py,0,px,py,r);
    const dx=(Math.random()*2-1), dy=(Math.random()*2-1);
    const nr=Math.round(128+dx*60), ng=Math.round(128+dy*60);
    g.addColorStop(0,'rgba('+nr+','+ng+',255,0.9)');
    g.addColorStop(1,'rgba(128,128,255,0)');
    x.fillStyle=g; x.beginPath(); x.arc(px,py,r,0,7); x.fill();
  }
  const t=new THREEc.CanvasTexture(c); return t;
}
function makeRough(){
  const s=128, c=document.createElement('canvas'); c.width=c.height=s;
  const x=c.getContext('2d'); x.fillStyle='#9a9a9a'; x.fillRect(0,0,s,s);
  for(let i=0;i<1400;i++){ const v=Math.floor(80+Math.random()*140);
    x.fillStyle='rgba('+v+','+v+','+v+',0.5)';
    x.fillRect(Math.random()*s,Math.random()*s,2,2); }
  const t=new THREEc.CanvasTexture(c); return t;
}
const texAlbedo=makeAlbedo(), texNormal=makeNormal(), texRough=makeRough();
