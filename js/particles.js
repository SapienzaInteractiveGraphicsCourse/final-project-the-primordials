"use strict";
/* PRIMORDIA — particles
   Structure-of-Arrays particle buffers, seeding, the asymmetric attraction matrix, and the InstancedMesh that draws them.
   Depends on: config.js, scene.js
   ========================================================================== */
/* ------------------------------------------------------ particle buffers -- */
let N = CFG.count;
let px,py,pz, vx,vy,vz, ptype, psize, pmass;
function allocParticles(n){
  px=new Float32Array(n); py=new Float32Array(n); pz=new Float32Array(n);
  vx=new Float32Array(n); vy=new Float32Array(n); vz=new Float32Array(n);
  ptype=new Uint8Array(n); psize=new Float32Array(n); pmass=new Float32Array(n);
}
function seedParticles(){
  const R=CFG.worldHalf*0.7;
  for(let i=0;i<N;i++){
    // random point in a sphere
    let a=Math.random()*2-1, b=Math.random()*2-1, cc=Math.random()*2-1;
    const L=Math.sqrt(a*a+b*b+cc*cc)||1; const r=Math.cbrt(Math.random())*R;
    px[i]=a/L*r; py[i]=b/L*r; pz[i]=cc/L*r;
    vx[i]=vy[i]=vz[i]=0;
    ptype[i]=(Math.random()*CFG.types)|0;
    const base=0.55, sv=CFG.sizeVariance;
    const s=base*(1-sv) + base*sv*(0.4+Math.pow(Math.random(),2.2)*3.4); // skew toward small, few big
    psize[i]=s;
    pmass[i]=s*s*s; // volume-like mass → big balls dominate gravity
  }
}

/* attraction matrix A[i][j] in [-1,1], asymmetric */
let A=[];
function randomizeMatrix(){
  A=[]; for(let i=0;i<CFG.types;i++){ A[i]=[]; for(let j=0;j<CFG.types;j++){
    A[i][j]=Math.round((Math.random()*2-1)*100)/100;
  }}
}
function randomizeCell(i,j){ A[i][j]=Math.round((Math.random()*2-1)*100)/100; }

/* --------------------------------------------------------- instanced mesh -- */
let mesh=null;
const dummy=new THREEc.Object3D();
const col=new THREEc.Color();
function buildMesh(){
  if(mesh){ scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); }
  const geo=new THREEc.SphereGeometry(1, 10, 8);
  const mat=new THREEc.MeshStandardMaterial({
    map:texAlbedo, normalMap:texNormal, roughnessMap:texRough,
    roughness:0.72, metalness:0.15,
    emissive:0x000000, emissiveIntensity:0.9
  });
  mat.normalScale=new THREEc.Vector2(0.6,0.6);
  mesh=new THREEc.InstancedMesh(geo, mat, N);
  mesh.instanceMatrix.setUsage(THREEc.DynamicDrawUsage);
  scene.add(mesh);
  refreshColors();
}
function refreshColors(){
  for(let i=0;i<N;i++){ col.setHex(PALETTE[ptype[i]%PALETTE.length]); mesh.setColorAt(i,col); }
  if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true;
}
