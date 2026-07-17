"use strict";
/* PRIMORDIA — Barnes-Hut octree
   Pooled SoA octree: build, mass/COM pass, and theta-criterion traversal for O(N log N) long-range gravity.
   Depends on: config.js, particles.js
   ========================================================================== */
/* ============================================ BARNES–HUT OCTREE (gravity) ==
   Pooled Structure-of-Arrays octree. Build → compute mass/COM → traverse.
   ========================================================================== */
let maxNodes=0, nCx,nCy,nCz,nHalf,nMass,nComX,nComY,nComZ,nBody,nInternal,nChild,nDepth,nodeCount=0;
function allocOctree(){
  maxNodes=Math.max(256, N*4+64);
  nCx=new Float32Array(maxNodes); nCy=new Float32Array(maxNodes); nCz=new Float32Array(maxNodes);
  nHalf=new Float32Array(maxNodes); nMass=new Float32Array(maxNodes);
  nComX=new Float32Array(maxNodes); nComY=new Float32Array(maxNodes); nComZ=new Float32Array(maxNodes);
  nBody=new Int32Array(maxNodes); nInternal=new Uint8Array(maxNodes);
  nDepth=new Uint8Array(maxNodes);
  nChild=new Int32Array(maxNodes*8);
}
function newNode(cx,cy,cz,half,depth){
  const idx=nodeCount++;
  if(idx>=maxNodes) return idx-1; // guard (shouldn't happen with sizing)
  nCx[idx]=cx; nCy[idx]=cy; nCz[idx]=cz; nHalf[idx]=half; nDepth[idx]=depth;
  nMass[idx]=0; nComX[idx]=0; nComY[idx]=0; nComZ[idx]=0;
  nBody[idx]=-1; nInternal[idx]=0;
  const b=idx*8; for(let k=0;k<8;k++) nChild[b+k]=-1;
  return idx;
}
function octant(node,x,y,z){ let b=0; if(x>nCx[node])b|=1; if(y>nCy[node])b|=2; if(z>nCz[node])b|=4; return b; }
function childOf(node,b){
  const slot=node*8+b; let c=nChild[slot];
  if(c===-1){
    const h=nHalf[node]*0.5;
    const cx=nCx[node]+((b&1)?h:-h), cy=nCy[node]+((b&2)?h:-h), cz=nCz[node]+((b&4)?h:-h);
    c=newNode(cx,cy,cz,h,nDepth[node]+1); nChild[slot]=c;
  }
  return c;
}
function insertBody(root,i){
  let node=root, guard=0;
  while(guard++<64){
    if(nInternal[node]===0){
      if(nBody[node]===-1){ nBody[node]=i; return; }
      // subdivide
      const e=nBody[node]; nBody[node]=-1; nInternal[node]=1;
      if(nHalf[node]<0.02) return; // coincident guard: drop
      const ce=childOf(node, octant(node,px[e],py[e],pz[e])); nBody[ce]=e;
      const bi=octant(node,px[i],py[i],pz[i]); const ci=childOf(node,bi);
      if(ci===ce){ node=ci; continue; } // collision → subdivide deeper
      nBody[ci]=i; return;
    } else {
      node=childOf(node, octant(node,px[i],py[i],pz[i]));
    }
  }
}
function computeMass(node){
  if(nInternal[node]===0){
    const b=nBody[node];
    if(b>=0){ nMass[node]=pmass[b]; nComX[node]=px[b]; nComY[node]=py[b]; nComZ[node]=pz[b]; }
    return;
  }
  let m=0,cx=0,cy=0,cz=0; const base=node*8;
  for(let k=0;k<8;k++){ const c=nChild[base+k]; if(c!==-1){ computeMass(c);
    const mc=nMass[c]; m+=mc; cx+=nComX[c]*mc; cy+=nComY[c]*mc; cz+=nComZ[c]*mc; } }
  if(m>0){ nMass[node]=m; nComX[node]=cx/m; nComY[node]=cy/m; nComZ[node]=cz/m; }
}
function buildOctree(){
  nodeCount=0;
  const h=CFG.worldHalf+1;
  const root=newNode(0,0,0,h,0);
  for(let i=0;i<N;i++) insertBody(root,i);
  if(nodeCount>0) computeMass(root);
  return root;
}
// gravity acceleration on particle i (iterative stack traversal)
const bhStack=new Int32Array(4096);
function gravityAccel(root,i,out){
  const theta2=CFG.theta*CFG.theta, soft2=CFG.softening*CFG.softening, G=CFG.G;
  let sp=0; bhStack[sp++]=root;
  const xi=px[i],yi=py[i],zi=pz[i];
  let ax=0,ay=0,az=0;
  while(sp>0){
    const node=bhStack[--sp];
    if(nMass[node]===0) continue;
    if(nInternal[node]===0){
      const b=nBody[node]; if(b===i||b<0) continue;
      const dx=nComX[node]-xi, dy=nComY[node]-yi, dz=nComZ[node]-zi;
      const d2=dx*dx+dy*dy+dz*dz+soft2; const inv=1/Math.sqrt(d2);
      const f=G*nMass[node]*inv/d2; ax+=dx*f; ay+=dy*f; az+=dz*f;
    } else {
      const dx=nComX[node]-xi, dy=nComY[node]-yi, dz=nComZ[node]-zi;
      const d2=dx*dx+dy*dy+dz*dz;
      const s=nHalf[node]*2;
      if(s*s < theta2*d2){ // far enough → single body
        const dd=d2+soft2, inv=1/Math.sqrt(dd);
        const f=G*nMass[node]*inv/dd; ax+=dx*f; ay+=dy*f; az+=dz*f;
      } else {
        const base=node*8;
        for(let k=0;k<8;k++){ const c=nChild[base+k]; if(c!==-1 && sp<4090) bhStack[sp++]=c; }
      }
    }
  }
  out[0]=ax; out[1]=ay; out[2]=az;
}
// sample gravitational acceleration at an arbitrary point (for field/lattice viz)
function gravityAccelAt(root,xi,yi,zi,out){
  const theta2=CFG.theta*CFG.theta, soft2=CFG.softening*CFG.softening, G=CFG.G;
  let sp=0; bhStack[sp++]=root; let ax=0,ay=0,az=0;
  while(sp>0){
    const node=bhStack[--sp];
    if(nMass[node]===0) continue;
    if(nInternal[node]===0){
      const b=nBody[node]; if(b<0) continue;
      const dx=nComX[node]-xi, dy=nComY[node]-yi, dz=nComZ[node]-zi;
      const d2=dx*dx+dy*dy+dz*dz+soft2; const inv=1/Math.sqrt(d2);
      const f=G*nMass[node]*inv/d2; ax+=dx*f; ay+=dy*f; az+=dz*f;
    } else {
      const dx=nComX[node]-xi, dy=nComY[node]-yi, dz=nComZ[node]-zi;
      const d2=dx*dx+dy*dy+dz*dz; const s=nHalf[node]*2;
      if(s*s < theta2*d2){ const dd=d2+soft2, inv=1/Math.sqrt(dd);
        const f=G*nMass[node]*inv/dd; ax+=dx*f; ay+=dy*f; az+=dz*f;
      } else { const base=node*8;
        for(let k=0;k<8;k++){ const c=nChild[base+k]; if(c!==-1 && sp<4090) bhStack[sp++]=c; }
      }
    }
  }
  out[0]=ax; out[1]=ay; out[2]=az;
}

