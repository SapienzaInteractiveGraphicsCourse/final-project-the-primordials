"use strict";
/* PRIMORDIA — simulation
   The integrator (grid chemistry + gravity + creature field + poke), and the debug visualisations: octree wireframe, field arrows, space lattice, mesh sync.
   Depends on: config.js, scene.js, particles.js, creature.js, grid.js, octree.js
   ========================================================================== */
/* ============================================================ SIMULATION == */
const gout=[0,0,0];
let lastPairs=0;
function simulate(dt){
  buildGrid();
  let octRoot=-1;
  if(CFG.gravity){ octRoot=buildOctree(); }
  const rMax=CFG.rMax, r2=rMax*rMax, h=CFG.worldHalf;
  const mu=Math.pow(0.5, dt/CFG.frictionHalfLife);
  const fs=CFG.forceStrength;
  const cRoot=creature.root, cActive=CFG.creature && cRoot;
  const cx=cActive?cRoot.position.x:0, cy=cActive?cRoot.position.y:0, cz=cActive?cRoot.position.z:0;
  const cR=CFG.creatureField, cR2=cR*cR, cMode=CFG.creatureMode, cStr=CFG.creatureStrength, cBodyR=CFG.creatureBodyR;
  const wrap=CFG.wrap, worldW=2*h;
  const pkAct=Poke.active, pkx=Poke.x, pky=Poke.y, pkz=Poke.z, pkSign=Poke.sign, pkR=Poke.radius, pkR2=pkR*pkR;
  const pkKind=Poke.kind, pkAx=Poke.ax, pkAy=Poke.ay, pkAz=Poke.az;
  const gI=CFG.intensity; // global intervention intensity
  let pairs=0;

  for(let i=0;i<N;i++){
    const xi=px[i],yi=py[i],zi=pz[i]; const ti=ptype[i];
    let ax=0,ay=0,az=0;

    // ---- short-range particle-life via 27-cell neighborhood ----
    const ci=cellOf[i];
    const iz=(ci/(gN*gN))|0, iy=((ci-(iz*gN*gN))/gN)|0, ix=ci-(iz*gN*gN)-(iy*gN);
    const pg=wrap&&gN>=3;
    for(let dz=-1;dz<=1;dz++){ let zz=iz+dz; if(zz<0||zz>=gN){ if(pg)zz=(zz+gN)%gN; else continue; }
     for(let dy=-1;dy<=1;dy++){ let yy=iy+dy; if(yy<0||yy>=gN){ if(pg)yy=(yy+gN)%gN; else continue; }
      for(let dx=-1;dx<=1;dx++){ let xx=ix+dx; if(xx<0||xx>=gN){ if(pg)xx=(xx+gN)%gN; else continue; }
        const c=xx+yy*gN+zz*gN*gN; const s0=cellStart[c], s1=cellStart[c+1];
        for(let s=s0;s<s1;s++){ const j=sortedIdx[s]; if(j===i)continue;
          let ddx=px[j]-xi, ddy=py[j]-yi, ddz=pz[j]-zi;
          if(wrap){ // minimum-image: interact across the periodic boundary
            if(ddx>h)ddx-=worldW; else if(ddx<-h)ddx+=worldW;
            if(ddy>h)ddy-=worldW; else if(ddy<-h)ddy+=worldW;
            if(ddz>h)ddz-=worldW; else if(ddz<-h)ddz+=worldW;
          }
          const dd=ddx*ddx+ddy*ddy+ddz*ddz;
          if(dd>0 && dd<r2){ const dist=Math.sqrt(dd); const rn=dist/rMax;
            const f=plForce(rn, A[ti][ptype[j]]); const inv=f/dist;
            ax+=ddx*inv; ay+=ddy*inv; az+=ddz*inv; pairs++;
          }
        }
      }}}
    ax*=rMax*fs; ay*=rMax*fs; az*=rMax*fs;

    // ---- long-range gravity (Barnes–Hut) ----
    if(CFG.gravity){ gravityAccel(octRoot,i,gout); ax+=gout[0]; ay+=gout[1]; az+=gout[2]; }

    // ---- creature force field (attract/repel + gentle swirl so particles orbit it) ----
    if(cActive){ const dx=xi-cx, dy=yi-cy, dz=zi-cz; const dd=dx*dx+dy*dy+dz*dz;
      if(dd<cR2 && dd>0.01){ const dist=Math.sqrt(dd); const fall=(1-dist/cR);
        const strength=cMode*cStr*fall*fall/dist; ax+=dx*strength; ay+=dy*strength; az+=dz*strength;
        const sw=cStr*0.25*fall/dist; ax+=(-dz)*sw; az+=(dx)*sw; // swirl around vertical axis
      }
    }

    // ---- user intervention field (click-drag in the scene) ----
    if(pkAct){ const dx=xi-pkx, dy=yi-pky, dz=zi-pkz; const dd=dx*dx+dy*dy+dz*dz;
      if(dd<pkR2 && dd>0.01){ const dist=Math.sqrt(dd); const fall=(1-dist/pkR);
        if(pkKind==='push'||pkKind==='pull'){
          const strength=pkSign*420*gI*fall*fall/dist; ax+=dx*strength; ay+=dy*strength; az+=dz*strength;
        } else if(pkKind==='warp'){
          // aggressive spacetime warp: strong swirl + inward pull + axial compression
          const tx=pkAy*dz-pkAz*dy, ty=pkAz*dx-pkAx*dz, tz=pkAx*dy-pkAy*dx;
          const sw=620*gI*fall*fall; ax+=tx*sw; ay+=ty*sw; az+=tz*sw;
          const pull=-520*gI*fall*fall/dist; ax+=dx*pull; ay+=dy*pull; az+=dz*pull;
          // squeeze space along the view axis (creates a lensing / folding feel)
          const axial=(dx*pkAx+dy*pkAy+dz*pkAz);
          const comp=-300*gI*fall; ax+=pkAx*axial*comp; ay+=pkAy*axial*comp; az+=pkAz*axial*comp;
        }
      }
    }

    // ---- integrate (semi-implicit Euler) ----
    let nvx=vx[i]*mu+ax*dt, nvy=vy[i]*mu+ay*dt, nvz=vz[i]*mu+az*dt;
    // clamp velocity to keep stable
    const sp2=nvx*nvx+nvy*nvy+nvz*nvz, vmax=90;
    if(sp2>vmax*vmax){ const k=vmax/Math.sqrt(sp2); nvx*=k;nvy*=k;nvz*=k; }
    vx[i]=nvx; vy[i]=nvy; vz[i]=nvz;
  }

  // position update + walls (separate pass so forces use start-of-step pos)
  for(let i=0;i<N;i++){
    px[i]+=vx[i]*dt; py[i]+=vy[i]*dt; pz[i]+=vz[i]*dt;
    if(CFG.wrap){
      // map into [-h, h) regardless of overshoot → no edge flicker
      px[i]-=worldW*Math.floor((px[i]+h)/worldW);
      py[i]-=worldW*Math.floor((py[i]+h)/worldW);
      pz[i]-=worldW*Math.floor((pz[i]+h)/worldW);
    } else {
      if(px[i]>h){px[i]=h;vx[i]*=-0.6;} else if(px[i]<-h){px[i]=-h;vx[i]*=-0.6;}
      if(py[i]>h){py[i]=h;vy[i]*=-0.6;} else if(py[i]<-h){py[i]=-h;vy[i]*=-0.6;}
      if(pz[i]>h){pz[i]=h;vz[i]*=-0.6;} else if(pz[i]<-h){pz[i]=-h;vz[i]*=-0.6;}
    }
    // ---- solid creature body: keep particles on/outside its surface (collisions + interaction) ----
    if(cActive){
      const ddx=px[i]-cx, ddy=py[i]-cy, ddz=pz[i]-cz; const dd2=ddx*ddx+ddy*ddy+ddz*ddz;
      const bR=cBodyR+psize[i];
      if(dd2<bR*bR && dd2>1e-6){
        const d=Math.sqrt(dd2), nx=ddx/d, ny=ddy/d, nz=ddz/d;
        px[i]=cx+nx*bR; py[i]=cy+ny*bR; pz[i]=cz+nz*bR;         // project onto the surface
        const vn=vx[i]*nx+vy[i]*ny+vz[i]*nz;
        if(vn<0){ const j=-vn*1.4; vx[i]+=nx*j; vy[i]+=ny*j; vz[i]+=nz*j; } // bounce outward
      }
    }
  }
  lastPairs=pairs;
  return octRoot;
}

/* --------------------------------------------------- octree visualization -- */
let octLines=null;
function updateOctreeViz(root){
  if(octLines){ scene.remove(octLines); octLines.geometry.dispose(); octLines.material.dispose(); octLines=null; }
  if(!CFG.showOctree || root<0) return;
  const positions=[];
  const maxDepth=6;
  function box(node){
    if(nDepth[node]>maxDepth) return;
    if(nInternal[node]===0 && nBody[node]<0) return;
    const x=nCx[node],y=nCy[node],z=nCz[node],hh=nHalf[node];
    const c=[[x-hh,y-hh,z-hh],[x+hh,y-hh,z-hh],[x+hh,y+hh,z-hh],[x-hh,y+hh,z-hh],
             [x-hh,y-hh,z+hh],[x+hh,y-hh,z+hh],[x+hh,y+hh,z+hh],[x-hh,y+hh,z+hh]];
    const E=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
    for(const e of E){ positions.push(...c[e[0]],...c[e[1]]); }
    if(nInternal[node]){ const base=node*8; for(let k=0;k<8;k++){const ch=nChild[base+k]; if(ch!==-1)box(ch);} }
  }
  box(root);
  const g=new THREEc.BufferGeometry();
  g.setAttribute('position', new THREEc.Float32BufferAttribute(positions,3));
  octLines=new THREEc.LineSegments(g, new THREEc.LineBasicMaterial({color:0x37e0c8, transparent:true, opacity:0.22}));
  scene.add(octLines);
}

/* --------------------------------- gravity field (flowing, fluid-dynamics style) --
   Each grid sample keeps a faint full-length vector plus a bright pulse that streams
   along it toward the mass. A per-position phase offset makes a wave sweep across the
   whole field, like streamlines in flow visualisation. Samples are rebuilt on a
   throttle (as clusters move); the pulse is re-drawn every frame from those samples. */
let fieldLines=null;
const gtmp=[0,0,0];
const _fcTeal=new THREEc.Color(0x37e0c8), _fcWarm=new THREEc.Color(0xff8a5c);
// per-sample state (length K = fieldN^3, constant unless density changes)
let FLD={K:0, bx:null,by:null,bz:null, ux:null,uy:null,uz:null, len:null, ph:null, str:null};
function disposeField(){ if(fieldLines){ scene.remove(fieldLines); fieldLines.geometry.dispose(); fieldLines.material.dispose(); fieldLines=null; } }
function buildFieldSamples(root){
  if(!CFG.showField || !CFG.gravity || root<0){ disposeField(); return; }
  const FN=Math.max(2,CFG.fieldN|0), K=FN*FN*FN;
  const h=CFG.worldHalf, step=(2*h)/(FN-1), maxLen=step*0.95;
  if(!FLD.bx || FLD.K!==K){
    FLD={K,
      bx:new Float32Array(K),by:new Float32Array(K),bz:new Float32Array(K),
      ux:new Float32Array(K),uy:new Float32Array(K),uz:new Float32Array(K),
      len:new Float32Array(K),ph:new Float32Array(K),str:new Float32Array(K)};
  }
  let maxMag=1e-6; let k=0;
  // pass 1: directions + magnitudes
  for(let iz=0;iz<FN;iz++)for(let iy=0;iy<FN;iy++)for(let ix=0;ix<FN;ix++,k++){
    const x=-h+ix*step, y=-h+iy*step, z=-h+iz*step;
    gravityAccelAt(root,x,y,z,gtmp);
    const m=Math.sqrt(gtmp[0]*gtmp[0]+gtmp[1]*gtmp[1]+gtmp[2]*gtmp[2])||1e-9;
    if(m>maxMag)maxMag=m;
    FLD.bx[k]=x; FLD.by[k]=y; FLD.bz[k]=z;
    FLD.ux[k]=gtmp[0]/m; FLD.uy[k]=gtmp[1]/m; FLD.uz[k]=gtmp[2]/m;
    FLD.str[k]=m;
    FLD.ph[k]=(x*0.05 + y*0.045 + z*0.04); // travelling-wave phase across space
  }
  // pass 2: normalise strength → length + stored strength in [0,1]
  for(let i=0;i<K;i++){ const t=Math.min(1,FLD.str[i]/maxMag);
    FLD.len[i]=maxLen*(0.25+0.75*t); FLD.str[i]=t; }
  // (re)allocate geometry: 2 segments (4 verts) per sample
  if(!fieldLines || fieldLines.__K!==K){
    disposeField();
    const g=new THREEc.BufferGeometry();
    g.setAttribute('position', new THREEc.BufferAttribute(new Float32Array(K*4*3),3));
    g.setAttribute('color', new THREEc.BufferAttribute(new Float32Array(K*4*3),3));
    fieldLines=new THREEc.LineSegments(g, new THREEc.LineBasicMaterial({vertexColors:true, transparent:true, opacity:0.9, blending:THREEc.AdditiveBlending, depthWrite:false}));
    fieldLines.__K=K; scene.add(fieldLines);
  }
}
function animateField(t){
  if(!fieldLines || !FLD.K) return;
  const K=FLD.K, pos=fieldLines.geometry.attributes.position.array, colr=fieldLines.geometry.attributes.color.array;
  const speed=1.15, dashHalf=0.22; // pulse travels along each vector; dash half-length as a fraction
  for(let k=0;k<K;k++){
    const L=FLD.len[k], s=FLD.str[k];
    const bx=FLD.bx[k],by=FLD.by[k],bz=FLD.bz[k], ux=FLD.ux[k],uy=FLD.uy[k],uz=FLD.uz[k];
    const o=k*12;
    if(s<0.04){ // negligible field → collapse both segments to a point (invisible)
      for(let q=0;q<12;q++){ pos[o+q]=bx; }
      for(let q=0;q<12;q++){ colr[o+q]=0; }
      continue;
    }
    // segment A: faint full-length vector (structure)
    const ex=bx+ux*L, ey=by+uy*L, ez=bz+uz*L;
    pos[o]=bx;   pos[o+1]=by;   pos[o+2]=bz;
    pos[o+3]=ex; pos[o+4]=ey;   pos[o+5]=ez;
    // colour by strength: teal → warm
    const cr=_fcTeal.r*(1-s)+_fcWarm.r*s, cg=_fcTeal.g*(1-s)+_fcWarm.g*s, cb=_fcTeal.b*(1-s)+_fcWarm.b*s;
    const faint=0.16;
    colr[o]=cr*faint;   colr[o+1]=cg*faint;   colr[o+2]=cb*faint;
    colr[o+3]=cr*faint; colr[o+4]=cg*faint;   colr[o+5]=cb*faint;
    // segment B: bright pulse streaming along the vector toward the mass
    let f=((t*speed + FLD.ph[k]) % 1 + 1) % 1;   // 0..1 travelling parameter
    let a0=(f-dashHalf)*L, a1=(f+dashHalf)*L;
    if(a0<0)a0=0; if(a1>L)a1=L;
    const glow=(0.45+0.55*Math.sin(f*Math.PI)) * (0.5+0.5*s); // bright mid-travel, scaled by strength
    pos[o+6]=bx+ux*a0; pos[o+7]=by+uy*a0; pos[o+8]=bz+uz*a0;
    pos[o+9]=bx+ux*a1; pos[o+10]=by+uy*a1; pos[o+11]=bz+uz*a1;
    colr[o+6]=cr*glow*0.25; colr[o+7]=cg*glow*0.25; colr[o+8]=cb*glow*0.25; // tail
    colr[o+9]=cr*glow;      colr[o+10]=cg*glow;     colr[o+11]=cb*glow;     // head (bright)
  }
  fieldLines.geometry.attributes.position.needsUpdate=true;
  fieldLines.geometry.attributes.color.needsUpdate=true;
}

/* ------------------------------------------- deforming space lattice (warp) */
let lattice=null;
const LAT_N=9;
function buildLattice(){
  if(lattice){ scene.remove(lattice); lattice.geometry.dispose(); lattice.material.dispose(); lattice=null; }
  const n=LAT_N, h=CFG.worldHalf, step=(2*h)/(n-1);
  const idx=(x,y,z)=>x+y*n+z*n*n;
  const rest=new Float32Array(n*n*n*3);
  for(let z=0;z<n;z++)for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const i=idx(x,y,z)*3; rest[i]=-h+x*step; rest[i+1]=-h+y*step; rest[i+2]=-h+z*step;
  }
  const segs=[];
  for(let z=0;z<n;z++)for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    if(x<n-1)segs.push(idx(x,y,z),idx(x+1,y,z));
    if(y<n-1)segs.push(idx(x,y,z),idx(x,y+1,z));
    if(z<n-1)segs.push(idx(x,y,z),idx(x,y,z+1));
  }
  const pos=new Float32Array(segs.length*3);
  const g=new THREEc.BufferGeometry();
  g.setAttribute('position',new THREEc.BufferAttribute(pos,3));
  lattice=new THREEc.LineSegments(g, new THREEc.LineBasicMaterial({color:0x3a72d8, transparent:true, opacity:0.16}));
  lattice.__segs=segs; lattice.__rest=rest; lattice.__cur=new Float32Array(n*n*n*3);
  lattice.visible=false; scene.add(lattice);
}
function updateLattice(root){
  if(!lattice) return;
  lattice.visible=CFG.showLattice; if(!CFG.showLattice) return;
  const n=LAT_N, rest=lattice.__rest, cur=lattice.__cur;
  const grav=CFG.gravity && root>=0, pkAct=Poke.active, gI=CFG.intensity;
  const nn=n*n*n;
  for(let k=0;k<nn;k++){
    const i=k*3; const x=rest[i], y=rest[i+1], z=rest[i+2];
    let ox=0,oy=0,oz=0;
    if(grav){ gravityAccelAt(root,x,y,z,gtmp); ox+=gtmp[0]*7; oy+=gtmp[1]*7; oz+=gtmp[2]*7; }
    if(pkAct){ const dx=x-Poke.x, dy=y-Poke.y, dz=z-Poke.z; const dd=dx*dx+dy*dy+dz*dz; const R=Poke.radius*1.5;
      if(dd<R*R && dd>0.001){ const dist=Math.sqrt(dd), fall=(1-dist/R), kd=Poke.kind;
        if(kd==='push'){ const m=fall*fall*11*gI/dist; ox+=dx*m; oy+=dy*m; oz+=dz*m; }
        else if(kd==='pull'){ const m=-fall*fall*11*gI/dist; ox+=dx*m; oy+=dy*m; oz+=dz*m; }
        else { const tx=Poke.ay*dz-Poke.az*dy, ty=Poke.az*dx-Poke.ax*dz, tz=Poke.ax*dy-Poke.ay*dx;
          const sw=fall*fall*3.2*gI; ox+=tx*sw; oy+=ty*sw; oz+=tz*sw;
          const m=-fall*fall*9*gI/dist; ox+=dx*m; oy+=dy*m; oz+=dz*m; }
      }
    }
    const om=Math.sqrt(ox*ox+oy*oy+oz*oz), cap=9;
    if(om>cap){ const s=cap/om; ox*=s; oy*=s; oz*=s; }
    cur[i]=x+ox; cur[i+1]=y+oy; cur[i+2]=z+oz;
  }
  const segs=lattice.__segs, pos=lattice.geometry.attributes.position.array;
  for(let s=0;s<segs.length;s++){ const nd=segs[s]*3, o=s*3; pos[o]=cur[nd]; pos[o+1]=cur[nd+1]; pos[o+2]=cur[nd+2]; }
  lattice.geometry.attributes.position.needsUpdate=true;
}

/* --------------------------------------------------------- write to mesh -- */
function syncMesh(){
  for(let i=0;i<N;i++){
    dummy.position.set(px[i],py[i],pz[i]);
    dummy.scale.setScalar(psize[i]);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate=true;
}

