"use strict";
/* PRIMORDIA — user interface
   Control-panel widget factory, the console panel, attraction-matrix editor, space perturbations, and presets.
   Depends on: config.js, particles.js, simulation.js, camera.js
   ========================================================================== */
/* ================================================================= UI ===== */
function el(tag,cls,html){ const e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e; }
function slider(label,min,max,step,get,set,fmt,desc){
  const wrap=el('div','slider'); const row=el('div','row');
  const l=el('label',null,label); const v=el('span','val'); row.appendChild(l); row.appendChild(v);
  const inp=el('input'); inp.type='range'; inp.min=min; inp.max=max; inp.step=step; inp.value=get();
  const show=()=>{ v.textContent=(fmt?fmt(parseFloat(inp.value)):inp.value); };
  inp.addEventListener('input',()=>{ set(parseFloat(inp.value)); show(); });
  show(); wrap.appendChild(row); wrap.appendChild(inp);
  if(desc) wrap.appendChild(el('div','desc',desc));
  wrap.__inp=inp; wrap.__show=show; return wrap;
}
function toggle(label,get,set){
  const t=el('div','toggle'+(get()?' on':'')); t.appendChild(el('span',null,label)); t.appendChild(el('div','sw'));
  t.addEventListener('click',()=>{ const nv=!get(); set(nv); t.classList.toggle('on',nv); }); return t;
}
// wrap any control with an explanation line beneath it (keeps a reference to the control)
function withDesc(node,text){ const w=el('div','ctlwrap'); w.appendChild(node); if(text) w.appendChild(el('div','desc',text)); return w; }
// collapsible section: clicking the header toggles the body. Appends are redirected to the body.
function group(title,collapsed=true){
  const g=el('div','group'+(collapsed?' collapsed':''));
  const head=el('div','glabel');
  head.appendChild(el('span','gtitle',title));
  head.appendChild(el('span','gline'));
  head.appendChild(el('span','gchev','▾'));
  const body=el('div','gbody');
  g.appendChild(head); g.appendChild(body);
  head.addEventListener('click',()=>g.classList.toggle('collapsed'));
  g.appendChild=body.appendChild.bind(body); // redirect subsequent appends into the body
  return g;
}
function btn(label,cls,fn){ const b=el('button','ctl'+(cls?' '+cls:''),label); b.addEventListener('click',fn); return b; }

function buildMatrixUI(container){
  container.innerHTML='';
  const grid=el('div'); grid.id='matrix';
  grid.style.gridTemplateColumns='16px repeat('+CFG.types+',1fr)';
  grid.appendChild(el('div','mhdr'));
  for(let j=0;j<CFG.types;j++){ const s=el('div','mhdr'); const sw=el('div','swatch'); sw.style.background='#'+PALETTE[j].toString(16).padStart(6,'0'); s.appendChild(sw); grid.appendChild(s); }
  for(let i=0;i<CFG.types;i++){
    const rh=el('div','mhdr'); const sw=el('div','swatch'); sw.style.background='#'+PALETTE[i].toString(16).padStart(6,'0'); rh.appendChild(sw); grid.appendChild(rh);
    for(let j=0;j<CFG.types;j++){
      const cell=el('div','mcell'); paintCell(cell,A[i][j]);
      const upd=()=>{ paintCell(cell,A[i][j]); cell.title='type '+i+' → '+j+'  ('+A[i][j].toFixed(2)+')'; };
      upd();
      cell.addEventListener('click',()=>{ A[i][j]=cycleAttraction(A[i][j]); upd(); });
      grid.appendChild(cell);
    }
  }
  container.appendChild(grid);
  container.appendChild(el('div','mhint','Rows act on columns. Click a cell to cycle: green → light green → neutral → light red → red (+1 · +0.5 · 0 · −0.5 · −1). Rules are asymmetric — that is what makes chasing behaviour appear.'));
}
// discrete cycle: +1 → +0.5 → 0 → −0.5 → −1 → back to +1
const ATTR_STEPS=[1, 0.5, 0, -0.5, -1];
function cycleAttraction(v){
  let best=0, bd=Infinity;
  for(let k=0;k<ATTR_STEPS.length;k++){ const d=Math.abs(v-ATTR_STEPS[k]); if(d<bd){bd=d;best=k;} }
  return ATTR_STEPS[(best+1)%ATTR_STEPS.length];
}
function paintCell(cell,v){
  // v in [-1,1] → red..dark..green
  const g=Math.max(0,v), r=Math.max(0,-v);
  const R=Math.round(20+r*200), G=Math.round(20+g*200);
  cell.style.background='rgb('+R+','+G+',40)';
}

let sCount, sTypes;
function buildPanel(){
  const P=document.getElementById('panel'); P.innerHTML='';

  // transport
  const gt=group('Simulation');
  const transport=el('div','btns three');
  const bPlay=btn(CFG.running?'Pause':'Run', CFG.running?'':'primary', ()=>{ CFG.running=!CFG.running; bPlay.textContent=CFG.running?'Pause':'Run'; bPlay.classList.toggle('primary',!CFG.running); });
  transport.appendChild(bPlay);
  transport.appendChild(btn('Reset','',()=>{ seedParticles(); refreshColors(); }));
  transport.appendChild(btn('Reroll','',()=>{ randomizeMatrix(); buildMatrixUI(matBox); }));
  gt.appendChild(transport);
  gt.appendChild(el('div','desc','Run / pause the physics · Reset re-scatters the particles · Reroll draws a brand-new random rule matrix.'));
  P.appendChild(gt);

  // matrix
  const gm=group('Attraction rules');
  const matBox=el('div'); gm.appendChild(matBox); P.appendChild(gm);
  window.__matBox=matBox;

  // chemistry sliders
  const gc=group('Chemistry (short-range)');
  gc.appendChild(el('div','desc','Short-range, type-based forces (the “particle-life” rules). This is what shapes local patterns: cells, chains, chasing.'));
  gc.appendChild(slider('Force strength',0.2,8,0.1,()=>CFG.forceStrength,v=>CFG.forceStrength=v,v=>v.toFixed(1),
    'Overall power of the type-vs-type rules. Higher = snappier, more violent clustering.'));
  gc.appendChild(slider('Interaction radius',3,20,0.5,()=>CFG.rMax,v=>{CFG.rMax=v;rebuildGridDims();},v=>v.toFixed(1),
    'How far a particle can “feel” others. Larger = looser, longer-range structures.'));
  gc.appendChild(slider('Repulsion core',0.05,0.6,0.01,()=>CFG.beta,v=>CFG.beta=v,v=>v.toFixed(2),
    'Size of the hard push-apart zone at very close range — stops everything collapsing into a dot.'));
  gc.appendChild(slider('Friction half-life',0.01,0.2,0.005,()=>CFG.frictionHalfLife,v=>CFG.frictionHalfLife=v,v=>v.toFixed(3),
    'How fast motion decays. Low = thick, damped, syrupy; high = lively and bouncy.'));
  P.appendChild(gc);

  // gravity / barnes-hut
  const gg=group('Gravity (Barnes–Hut)');
  gg.appendChild(el('div','desc','Long-range, mass-based pull affecting every particle (accelerated with a Barnes–Hut octree). This builds large-scale structure.'));
  gg.appendChild(withDesc(toggle('Enable gravity',()=>CFG.gravity,v=>CFG.gravity=v),
    'Turns universal mass attraction on/off. HUD shows “2-scale” when combined with chemistry.'));
  gg.appendChild(slider('Strength G',0,4,0.05,()=>CFG.G,v=>CFG.G=v,v=>v.toFixed(2),
    'How hard gravity pulls. Higher = faster collapse into dense clumps.'));
  gg.appendChild(slider('θ  (accuracy ↔ speed)',0.2,1.6,0.05,()=>CFG.theta,v=>CFG.theta=v,v=>v.toFixed(2),
    'Barnes–Hut opening angle: low = accurate but slow, high = fast but approximate.'));
  gg.appendChild(slider('Softening',0.5,6,0.25,()=>CFG.softening,v=>CFG.softening=v,v=>v.toFixed(2),
    'Smooths gravity at tiny distances so close pairs don’t fling apart to infinity.'));
  gg.appendChild(withDesc(toggle('Show octree',()=>CFG.showOctree,v=>CFG.showOctree=v),
    'Draws the cube subdivision the octree uses to group distant mass — the trick that makes gravity fast.'));
  gg.appendChild(withDesc(toggle('Show gravity field',()=>CFG.showField,v=>CFG.showField=v),
    'Draws the gravitational field as animated streamlines: bright pulses flow along each vector toward mass, with a wave sweeping across space. Needs gravity ON.'));
  gg.appendChild(slider('Field density',3,20,1,()=>CFG.fieldN,v=>CFG.fieldN=v,v=>(v|0)+'³',
    'Vectors sampled per axis. Bright pulses stream along them toward mass, like flow-visualisation streamlines. Crank it up for a dense, beautiful field — it costs more to compute.'));
  P.appendChild(gg);

  // population
  const gp=group('Population', true);
  sCount=slider('Particles',200,3000,100,()=>CFG.count,v=>CFG.count=v,v=>v|0,
    'Total particle count. More = richer emergence, but heavier. Applies when you release the slider.');
  sCount.__inp.addEventListener('change',()=>{ applyPopulation(); });
  gp.appendChild(sCount);
  sTypes=slider('Types',2,PALETTE.length,1,()=>CFG.types,v=>CFG.types=v,v=>v|0,
    'Number of species (colours) — and the size of the rule matrix above.');
  sTypes.__inp.addEventListener('change',()=>{ randomizeMatrix(); buildMatrixUI(window.__matBox); reseedTypes(); });
  gp.appendChild(sTypes);
  gp.appendChild(slider('Size variance',0,1,0.05,()=>CFG.sizeVariance,v=>{CFG.sizeVariance=v;reseedSizes();},v=>v.toFixed(2),
    'Spread of particle sizes. Bigger particles carry more gravitational mass, so they dominate clumps.'));
  P.appendChild(gp);

  // intervene in the space
  const gi=group('Intervene in space');
  gi.appendChild(slider('Intensity',0.2,6,0.1,()=>CFG.intensity,v=>CFG.intensity=v,v=>v.toFixed(1)+'×',
    'Master multiplier for every intervention below — both the drag tools and the one-shot impulses.'));
  const toolDefs=[['orbit','Orbit'],['push','Push'],['pull','Pull'],['warp','Warp']];
  const toolBtns=el('div','btns'); const toolMap={};
  function setTool(t){ CFG.tool=t; for(const k in toolMap) toolMap[k].classList.toggle('primary',CFG.tool===k); }
  toolDefs.forEach(([k,lbl])=>{ const b=btn(lbl, CFG.tool===k?'primary':'', ()=>setTool(k)); toolMap[k]=b; toolBtns.appendChild(b); });
  gi.appendChild(toolBtns);
  gi.appendChild(el('div','desc','Left-drag tool: Orbit rotates the camera · Push shoves particles away · Pull draws them in · Warp violently bends space (swirl + collapse + axial lensing). Right-drag always orbits.'));
  gi.appendChild(slider('Brush radius',5,60,1,()=>CFG.pokeRadius,v=>CFG.pokeRadius=v,v=>v|0,
    'Radius of the drag tool’s influence sphere, shown as a ring in the scene.'));
  gi.appendChild(el('div','desc','One-shot impulses centred on what you’re looking at (all scaled by Intensity):'));
  const imp=el('div','btns three');
  [['Shockwave','shock'],['Implode','implode'],['Vortex','vortex'],['Warp','warp'],['Fold','fold'],['Jitter','jitter']]
    .forEach(([lbl,key])=>imp.appendChild(btn(lbl,'',()=>perturb(key))));
  gi.appendChild(imp);
  gi.appendChild(el('div','desc','Shockwave blasts outward · Implode sucks inward · Vortex spins around vertical · Warp swirls+collapses · Fold mirrors the far half of space onto the near half · Jitter adds random kicks. Tip: enable “Show space lattice” to watch space bend as you Warp.'));
  P.appendChild(gi);

  // world / render
  const gw=group('World & render', true);
  gw.appendChild(slider('World size',20,80,1,()=>CFG.worldHalf,v=>setWorldHalf(v),v=>(v*2)|0,
    'Edge length of the simulation cube. Bigger = more room, sparser soup.'));
  gw.appendChild(withDesc(toggle('Wrap edges (torus)',()=>CFG.wrap,v=>CFG.wrap=v),
    'Torus space: particles leaving one face re-enter the opposite face, with forces wrapping too.'));
  gw.appendChild(withDesc(toggle('Accent point lights',()=>CFG.pointLights,v=>{CFG.pointLights=v; p1.visible=v; p2.visible=v;}),
    'Two coloured moving point lights (teal + pink) that tint the particles for depth.'));
  gw.appendChild(withDesc(toggle('Show space lattice',()=>CFG.showLattice,v=>CFG.showLattice=v),
    'A wireframe grid of space that deforms live: it bends toward mass when gravity is on, and twists/collapses under the Warp tool — space made visible.'));
  P.appendChild(gw);

  // creature
  const gcr=group('Grazer (hierarchical model)');
  gcr.appendChild(withDesc(toggle('Show creature',()=>CFG.creature,v=>{CFG.creature=v; creature.root.visible=v;}),
    'The piloted, self-animated articulated creature. Hidden = no creature and no creature force field.'));
  const followTog=toggle('Follow camera',()=>CFG.follow,v=>CFG.follow=v);
  gcr.appendChild(withDesc(followTog,'Camera keeps the Grazer centred. Auto-disables the moment you pan with the middle mouse.'));
  window.__setFollow=(v)=>{ CFG.follow=v; followTog.classList.toggle('on',v); };
  const modeBtns=el('div','btns');
  const bA=btn('Field: Attract',CFG.creatureMode<0?'primary':'',()=>{CFG.creatureMode=-1;bA.classList.add('primary');bR.classList.remove('primary');});
  const bR=btn('Field: Repel',CFG.creatureMode>0?'primary':'',()=>{CFG.creatureMode=1;bR.classList.add('primary');bA.classList.remove('primary');});
  modeBtns.appendChild(bA); modeBtns.appendChild(bR); gcr.appendChild(modeBtns);
  gcr.appendChild(el('div','desc','Does the Grazer gather particles (Attract, cool aura) or scatter them (Repel, warm aura)? Either way it also gently swirls them.'));
  gcr.appendChild(slider('Field radius',6,40,1,()=>CFG.creatureField,v=>CFG.creatureField=v,v=>v|0,
    'Reach of the creature’s influence — matches the glowing aura bubble around it.'));
  gcr.appendChild(slider('Field strength',0,400,10,()=>CFG.creatureStrength,v=>CFG.creatureStrength=v,v=>v|0,
    'How forcefully it pulls / pushes nearby particles. 0 = it just wanders harmlessly.'));
  gcr.appendChild(el('div','desc','Pilot with W A S D · Q/E up-down · Shift to boost. The legs run a procedural gait written in JS (no imported animation).'));
  P.appendChild(gcr);

  // presets
  const gpr=group('Presets');
  gpr.appendChild(el('div','desc','One click reconfigures rules, gravity and sizes into a known regime. Each is a different flavour of emergence:'));
  const presetInfo={
    cells:['Cells','Type rules gather particles into soft, membrane-like blobs — think living cells.'],
    chase:['Chase','Strongly asymmetric rules: some types relentlessly hunt others in moving trails.'],
    galaxy:['Galaxies','Gravity ON — mass pulls the soup into spiral, orbiting clumps like galaxies.'],
    web:['Web','Many types with tight bonds knit a connected, filament-like network.'],
    orbits:['Orbits','Gentle gravity + weak chemistry: particles settle into slow, stable orbits.'],
    worms:['Worms','A long interaction radius makes particles crawl in wriggling, worm-like chains.'],
    crystal:['Crystal','Strong close-range repulsion locks particles into a rigid, lattice-like solid.'],
    nebula:['Nebula','Soft gravity + varied sizes form diffuse glowing clouds that slowly swirl.'],
    swarm:['Swarm','Loose alignment produces a flocking, bird-like swarm that drifts together.'],
  };
  const plist=el('div','presetlist');
  ['cells','chase','galaxy','web','orbits','worms','crystal','nebula','swarm'].forEach(key=>{
    const inf=presetInfo[key]; const item=el('div','preset');
    item.appendChild(btn(inf[0],'',()=>preset(key)));
    item.appendChild(el('div','pd',inf[1]));
    plist.appendChild(item);
  });
  gpr.appendChild(plist);
  P.appendChild(gpr);

  P.appendChild(el('div','foot','Ventrella “Clusters”. Extended to 3D, variable mass, Barnes–Hut &amp; a piloted articulated model for the Interactive Graphics course.'));

  buildMatrixUI(matBox);
}

function applyPopulation(){
  CFG.count=CFG.count|0; N=CFG.count;
  allocParticles(N); allocOctree(); rebuildGridDims(); seedParticles(); buildMesh();
}
function reseedTypes(){ for(let i=0;i<N;i++) ptype[i]=(Math.random()*CFG.types)|0; refreshColors(); }
function reseedSizes(){ for(let i=0;i<N;i++){ const base=0.55,sv=CFG.sizeVariance;
  const s=base*(1-sv)+base*sv*(0.4+Math.pow(Math.random(),2.2)*3.4); psize[i]=s; pmass[i]=s*s*s; } }

/* ---- resize the simulation volume live (rebuild cage + grid, keep particles in) ---- */
function setWorldHalf(v){
  const old=CFG.worldHalf; CFG.worldHalf=v;
  const scale=v/old;
  const h=v;
  for(let i=0;i<N;i++){
    px[i]*=scale; py[i]*=scale; pz[i]*=scale;
    if(px[i]>h)px[i]=h; else if(px[i]<-h)px[i]=-h;
    if(py[i]>h)py[i]=h; else if(py[i]<-h)py[i]=-h;
    if(pz[i]>h)pz[i]=h; else if(pz[i]<-h)pz[i]=-h;
  }
  rebuildCage(); rebuildGridDims(); buildLattice();
}

/* ---- space perturbations (one-shot impulses) ---- */
function perturb(kind){
  const c=cam.target;                 // epicentre = what you're looking at
  const gI=CFG.intensity;             // scale everything by the global intensity
  camera.getWorldDirection(_n);       // view axis for warp
  const ax=_n.x, ay=_n.y, az=_n.z;
  for(let i=0;i<N;i++){
    const dx=px[i]-c.x, dy=py[i]-c.y, dz=pz[i]-c.z;
    const d=Math.sqrt(dx*dx+dy*dy+dz*dz)||1;
    if(kind==='shock'){ const m=40*gI/(1+d*0.05); vx[i]+=dx/d*m; vy[i]+=dy/d*m; vz[i]+=dz/d*m; }
    else if(kind==='implode'){ const m=45*gI/(1+d*0.04); vx[i]-=dx/d*m; vy[i]-=dy/d*m; vz[i]-=dz/d*m; }
    else if(kind==='vortex'){ // tangential around vertical axis through epicentre
      const r=Math.sqrt(dx*dx+dz*dz)||1; const m=35*gI;
      vx[i]+=(-dz/r)*m; vz[i]+=(dx/r)*m; vy[i]+=(Math.random()-0.5)*6*gI;
    }
    else if(kind==='jitter'){ const m=40*gI; vx[i]+=(Math.random()-0.5)*m; vy[i]+=(Math.random()-0.5)*m; vz[i]+=(Math.random()-0.5)*m; }
    else if(kind==='warp'){ // violent swirl + collapse around the view axis
      const tx=ay*dz-az*dy, ty=az*dx-ax*dz, tz=ax*dy-ay*dx; // axis × radial
      const sw=90*gI/(1+d*0.03), inw=60*gI/(1+d*0.03);
      vx[i]+=tx*sw*0.1 - dx/d*inw; vy[i]+=ty*sw*0.1 - dy/d*inw; vz[i]+=tz*sw*0.1 - dz/d*inw;
    }
    else if(kind==='fold'){ // reflect the far half of space onto the near half (a real space fold)
      const along=dx*ax+dy*ay+dz*az; // signed distance from the fold plane through the view target
      if(along>0){
        px[i]-=2*along*ax; py[i]-=2*along*ay; pz[i]-=2*along*az;      // mirror position
        const vn=vx[i]*ax+vy[i]*ay+vz[i]*az;
        vx[i]-=2*vn*ax; vy[i]-=2*vn*ay; vz[i]-=2*vn*az;              // mirror velocity
      }
    }
  }
}

const PRESETS={
  cells:   {types:5, gravity:false, rMax:10, forceStrength:3.2, beta:0.30, frictionHalfLife:0.045, sizeVariance:0.6},
  chase:   {types:4, gravity:false, rMax:12, forceStrength:4.5, beta:0.25, frictionHalfLife:0.060, sizeVariance:0.5},
  galaxy:  {types:3, gravity:true, G:1.6, theta:0.9, rMax:8,  forceStrength:1.5, beta:0.30, frictionHalfLife:0.120, sizeVariance:0.85},
  web:     {types:6, gravity:false, rMax:9,  forceStrength:3.8, beta:0.40, frictionHalfLife:0.050, sizeVariance:0.6},
  orbits:  {types:3, gravity:true, G:2.4, theta:1.0, rMax:6,  forceStrength:0.9, beta:0.20, frictionHalfLife:0.180, sizeVariance:0.95},
  worms:   {types:3, gravity:false, rMax:14, forceStrength:5.0, beta:0.18, frictionHalfLife:0.080, sizeVariance:0.4},
  crystal: {types:4, gravity:false, rMax:8,  forceStrength:2.6, beta:0.50, frictionHalfLife:0.030, sizeVariance:0.3},
  nebula:  {types:5, gravity:true, G:0.7, theta:0.8, rMax:11, forceStrength:2.2, beta:0.30, frictionHalfLife:0.090, sizeVariance:0.75},
  swarm:   {types:3, gravity:false, rMax:13, forceStrength:4.2, beta:0.15, frictionHalfLife:0.070, sizeVariance:0.5},
};
function preset(name){
  const p=PRESETS[name]; if(!p) return;
  CFG.gravity=false; CFG.G=CFG.G; // reset gravity defaults handled per-preset
  for(const k in p){ CFG[k]=p[k]; }
  if(!('gravity' in p)) CFG.gravity=false;
  randomizeMatrix(); rebuildGridDims(); reseedSizes(); reseedTypes(); seedParticles();
  buildPanel();
}

/* collapse */
const consoleEl=document.getElementById('console');
document.getElementById('tab').addEventListener('click',()=>consoleEl.classList.remove('collapsed'));
document.getElementById('hide').addEventListener('click',()=>consoleEl.classList.add('collapsed'));
window.addEventListener('keydown',e=>{ if(e.key==='h'||e.key==='H'){ consoleEl.classList.toggle('collapsed'); }});

