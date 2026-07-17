"use strict";
/* PRIMORDIA — creature
   The piloted Grazer: hierarchical scene-graph model, procedural gait, and WASD/QE input handling.
   Depends on: config.js, scene.js, particles.js (textures)
   ========================================================================== */
/* ============================================================ CREATURE ====
   A hierarchical, self-animated "Grazer": body → 4 legs (hip→thigh→shin→foot)
   + a rotating sensor. Real THREE scene-graph so child transforms compose.
   Gait is a phase-offset procedural walk written in JS (no imported clips).
   Emits a local radial force field on nearby particles when piloted.
   ========================================================================== */
const creature = { root:null, legs:[], sensor:null, aura:null, eye:null, blink:0, phase:0, vel:new THREEc.Vector3(), heading:0 };
function buildCreature(){
  // ---- cute pastel material set (soft glow, low metalness) ----
  const bodyMat  = new THREEc.MeshStandardMaterial({color:0x6fe9d6, normalMap:texNormal, metalness:0.05, roughness:0.55, emissive:0x1b7a6c, emissiveIntensity:0.55});
  bodyMat.normalScale=new THREEc.Vector2(0.25,0.25);
  const bellyMat = new THREEc.MeshStandardMaterial({color:0xd7fff6, metalness:0.0, roughness:0.7, emissive:0x2a8f80, emissiveIntensity:0.35});
  const legMat   = new THREEc.MeshStandardMaterial({color:0x53c9bb, metalness:0.05, roughness:0.6, emissive:0x14544b, emissiveIntensity:0.4});
  const footMat  = new THREEc.MeshStandardMaterial({color:0xffb3d1, metalness:0.0, roughness:0.5, emissive:0x8a3b5c, emissiveIntensity:0.55});
  const cheekMat = new THREEc.MeshStandardMaterial({color:0xff9ec4, metalness:0.0, roughness:0.6, emissive:0xaa3f66, emissiveIntensity:0.7});
  const whiteMat = new THREEc.MeshStandardMaterial({color:0xffffff, metalness:0.0, roughness:0.25, emissive:0x223046, emissiveIntensity:0.15});
  const pupilMat = new THREEc.MeshStandardMaterial({color:0x14202e, metalness:0.0, roughness:0.2});
  const antMat   = new THREEc.MeshStandardMaterial({color:0x9fead9, metalness:0.05, roughness:0.5});
  const bulbMat  = new THREEc.MeshStandardMaterial({color:0x37e0c8, metalness:0.0, roughness:0.3, emissive:0x1f9a8a, emissiveIntensity:0.9});

  const root=new THREEc.Group();

  // rounded body (a soft blob: main sphere + a slightly squashed belly)
  const body=new THREEc.Mesh(new THREEc.SphereGeometry(2.6,28,22), bodyMat);
  body.scale.set(1.05,0.92,1.0); root.add(body);
  const belly=new THREEc.Mesh(new THREEc.SphereGeometry(2.15,24,18), bellyMat);
  belly.position.set(0,-0.5,0.55); belly.scale.set(1.0,0.85,0.9); root.add(belly);

  // big friendly eye, facing +z (forward)
  const face=new THREEc.Group(); face.position.set(0,0.35,0); root.add(face); creature.sensor=face;
  const eye=new THREEc.Group(); eye.position.set(0,0.2,2.25); face.add(eye); creature.eye=eye;
  const sclera=new THREEc.Mesh(new THREEc.SphereGeometry(1.15,24,20), whiteMat); sclera.scale.set(1,1,0.7); eye.add(sclera);
  const pupil=new THREEc.Mesh(new THREEc.SphereGeometry(0.6,20,16), pupilMat); pupil.position.set(0,0,0.62); eye.add(pupil);
  const glint=new THREEc.Mesh(new THREEc.SphereGeometry(0.17,10,10), whiteMat); glint.position.set(0.22,0.28,1.05); eye.add(glint);
  const glint2=new THREEc.Mesh(new THREEc.SphereGeometry(0.09,8,8), whiteMat); glint2.position.set(-0.12,-0.1,1.08); eye.add(glint2);

  // rosy cheeks
  const chL=new THREEc.Mesh(new THREEc.SphereGeometry(0.42,12,10), cheekMat); chL.position.set(-1.35,-0.2,1.9); chL.scale.set(1,0.7,0.5); face.add(chL);
  const chR=chL.clone(); chR.position.x=1.35; face.add(chR);

  // two springy antennae with glowing bulbs (bob in animateCreature)
  creature.antennae=[];
  for(const sx of [-0.8,0.8]){
    const ant=new THREEc.Group(); ant.position.set(sx,2.2,0.2); ant.rotation.z=-sx*0.25; root.add(ant);
    const stalk=new THREEc.Mesh(new THREEc.CylinderGeometry(0.08,0.11,1.5,8), antMat); stalk.position.y=0.75; ant.add(stalk);
    const bulb=new THREEc.Mesh(new THREEc.SphereGeometry(0.32,14,12), bulbMat); bulb.position.y=1.6; ant.add(bulb);
    creature.antennae.push(ant);
  }

  // influence aura: translucent pulsing sphere = the field radius (colour set by mode)
  const aura=new THREEc.Mesh(
    new THREEc.SphereGeometry(1,24,18),
    new THREEc.MeshBasicMaterial({color:0x7aa2ff, transparent:true, opacity:0.10, depthWrite:false, side:THREEc.BackSide})
  );
  const auraRing=new THREEc.Mesh(
    new THREEc.TorusGeometry(1,0.012,8,48),
    new THREEc.MeshBasicMaterial({color:0x7aa2ff, transparent:true, opacity:0.5, depthWrite:false})
  );
  auraRing.rotation.x=Math.PI/2; aura.add(auraRing);
  root.add(aura); creature.aura=aura; creature.auraRing=auraRing;

  // ---- four hierarchical legs (hip → thigh → knee → shin → foot) ----
  // Each segment's geometry lies along +x from 0..L; the next joint sits at (L,0,0)
  // as a child, so segments stay welded together in every pose. Hips sit ON the
  // body surface (radius > body) and thighs point OUTWARD so nothing clips the body.
  const L1=1.3, L2=1.55, legN=4, hipR=2.45;
  for(let k=0;k<legN;k++){
    const ang=(k/legN)*Math.PI*2 + Math.PI/4;
    const hip=new THREEc.Group();
    hip.position.set(Math.cos(ang)*hipR, -1.05, Math.sin(ang)*hipR);
    hip.rotation.y=-ang;                 // local +x points radially outward
    root.add(hip);

    const thighGeo=new THREEc.CylinderGeometry(0.2,0.16,L1,10);
    thighGeo.rotateZ(-Math.PI/2); thighGeo.translate(L1/2,0,0); // lie along +x, span 0..L1
    const thigh=new THREEc.Mesh(thighGeo, legMat);
    const thighPivot=new THREEc.Group(); thighPivot.add(thigh); hip.add(thighPivot);

    const knee=new THREEc.Group(); knee.position.set(L1,0,0); thighPivot.add(knee); // at thigh tip
    const kj=new THREEc.Mesh(new THREEc.SphereGeometry(0.24,12,10), legMat); knee.add(kj);

    const shinGeo=new THREEc.CylinderGeometry(0.15,0.09,L2,10);
    shinGeo.rotateZ(-Math.PI/2); shinGeo.translate(L2/2,0,0); // lie along +x, span 0..L2
    const shin=new THREEc.Mesh(shinGeo, legMat);
    const shinPivot=new THREEc.Group(); shinPivot.add(shin); knee.add(shinPivot);

    const foot=new THREEc.Mesh(new THREEc.SphereGeometry(0.28,12,10), footMat); // round cute paw
    foot.position.set(L2,0,0); foot.scale.set(1.1,0.9,1.1); shinPivot.add(foot);

    creature.legs.push({hip, thighPivot, shinPivot, phase:(k/legN)*Math.PI*2});
  }
  root.position.set(18,6,10);
  scene.add(root); creature.root=root;
}
function animateCreature(dt, t){
  const c=creature; if(!c.root) return;
  const moving=c.vel.length();
  const gaitSpeed = 5 + moving*0.5;
  c.phase += dt*gaitSpeed;
  // hover bob
  c.root.position.y += Math.sin(t*2.2)*0.02;
  // face heading
  c.root.rotation.y += (c.heading - c.root.rotation.y)*Math.min(1,dt*6);

  // springy antennae bob (lean back a touch when moving fast)
  if(c.antennae){ const lean=Math.min(0.5,moving*0.02);
    c.antennae.forEach((a,i)=>{ const s=(i? -1:1);
      a.rotation.z = -s*0.25 + Math.sin(t*3.4+i)*0.16;
      a.rotation.x = -lean + Math.sin(t*2.1+i*1.7)*0.10;
    });
  }
  // occasional blink (squash the eye)
  c.blink -= dt; if(c.blink<0) c.blink = 2.5 + Math.random()*2.5;
  if(c.eye){ const b=c.blink<0.14 ? 0.12+ (0.14-c.blink)/0.14*0.88 : 1; c.eye.scale.y = b; }

  // aura pulses and is sized to the actual influence radius, coloured by mode
  if(c.aura){ const R=CFG.creatureField; const pulse=1+Math.sin(t*2.6)*0.03;
    c.aura.scale.setScalar(R*pulse); c.auraRing.rotation.z=t*0.8;
    c.aura.visible = CFG.creature;
    const col=(CFG.creatureMode>0)?0xff8a5c:0x7aa2ff; // repel=warm, attract=cool
    c.aura.material.color.setHex(col); c.auraRing.material.color.setHex(col);
  }

  for(const leg of c.legs){
    const ph=c.phase+leg.phase;
    const lift=Math.max(0,Math.sin(ph));       // stride lift
    const swing=Math.cos(ph);
    // thigh reaches OUTWARD (slightly up); shin bends down at the knee → bent bug leg
    leg.thighPivot.rotation.z = 0.18 + swing*0.24 - lift*0.10;
    leg.thighPivot.rotation.y = swing*0.16;
    leg.shinPivot.rotation.z = -1.7 + lift*0.5;
  }
}

/* creature piloting input */
const keys={};
window.addEventListener('keydown',e=>{ keys[e.key.toLowerCase()]=true; });
window.addEventListener('keyup',e=>{ keys[e.key.toLowerCase()]=false; });
function pilot(dt){
  const c=creature; if(!c.root||!CFG.creature) return;
  const accel=new THREEc.Vector3();
  const fwd=new THREEc.Vector3(Math.sin(c.root.rotation.y),0,Math.cos(c.root.rotation.y));
  const right=new THREEc.Vector3(fwd.z,0,-fwd.x);
  let active=false;
  const boost=keys['shift']?2.2:1;
  if(keys['w']){accel.add(fwd);active=true;}
  if(keys['s']){accel.sub(fwd);active=true;}
  if(keys['a']){accel.sub(right);active=true;}
  if(keys['d']){accel.add(right);active=true;}
  if(keys['q']){accel.y+=1;active=true;}
  if(keys['e']){accel.y-=1;active=true;}
  if(active){
    if(keys['a']||keys['d']){ c.heading += (keys['d']?-1:1)*dt*1.8; }
    accel.normalize().multiplyScalar(60*boost);
  }
  c.vel.addScaledVector(accel,dt);
  c.vel.multiplyScalar(Math.pow(0.02,dt)); // strong damping
  c.root.position.addScaledVector(c.vel,dt);
  const h=CFG.worldHalf-3;
  c.root.position.clamp(new THREEc.Vector3(-h,-h,-h), new THREEc.Vector3(h,h,h));
  document.getElementById('pilot').classList.toggle('show', CFG.creature && (active|| c.vel.length()>0.5));
}
