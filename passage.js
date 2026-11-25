(() => {
  const passage = document.querySelector(".tiffin-passage");
  if (!passage) return;
  const story = passage.querySelector(".packing-story");
  const page = passage.querySelector(".packing-page");
  const port = page.querySelector(".packing-port");
  const stage = passage.querySelector(".flight-window");
  const garden = passage.querySelector(".garden-set");
  const planCounter = passage.querySelector(".plan-counter");
  const docks = [...garden.querySelectorAll(".carrier")];
  const sprites = [...stage.querySelectorAll("[data-tier-photo]")];
  const controls = page.querySelector(".packing-controls");
  const buttons = [...controls.querySelectorAll("button")];
  const notes = [...page.querySelectorAll("[data-pack-note]")];
  const still = port.querySelector(".still-carrier");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const quiet = () => reduce.matches || Boolean(navigator.connection?.saveData);
  const clamp = (n,low=0,high=1) => Math.max(low,Math.min(n,high));
  const mix = (a,b,t) => a+(b-a)*t;
  const ease = (a,b,n) => { const t=clamp((n-a)/(b-a)); return t*t*(3-2*t); };
  const marks = [0,.63,1];
  // The front tier unfolds into the centre, the left and right tiers keep their sides.
  const station = [1,0,2];
  let view, warming = false, lost = false, near = true, frame = 0, controlAnchor, lastState;
  let target = 0, progress = 0, noteIndex = -1, lastTime = 0;
  let lightX = 0, desiredLight = 0, hovered = -1;
  const rotation = [0,0,0];
  const speed = [0,0,0];
  let holding = -1, clock = 0, drift = 0;
  const tilt = [0,0,0];
  let selected = passage.querySelector("input[name=protein]:checked")?.closest(".garden-plan")?.dataset.plan;
  const keys = docks.map(dock=>dock.dataset.carrier);
  const planLabels = keys.map(key=>passage.querySelector('.garden-plan[data-plan="'+key+'"]'));

  function mark(index) {
    if (index === noteIndex) return;
    noteIndex = index;
    buttons.forEach((button,i)=>button.setAttribute("aria-pressed",String(i===index)));
    notes.forEach((p,i)=>{p.hidden = i!==index;});
  }

  function rawProgress() {
    return clamp(-story.getBoundingClientRect().top / Math.max(1, story.offsetHeight-page.offsetHeight));
  }
  function anchored(value) {
    if (!controlAnchor) return value;
    if (Math.abs(scrollY-controlAnchor.y)<1) return controlAnchor.value;
    if (value <= 0 || value >= 1) {
      controlAnchor=null;
      return value;
    }
    if (value < controlAnchor.at) return controlAnchor.value*value/Math.max(.001,controlAnchor.at);
    return mix(controlAnchor.value,1,(value-controlAnchor.at)/Math.max(.001,1-controlAnchor.at));
  }
  function choose(index) {
    target = marks[index];
    controlAnchor={at:rawProgress(),y:scrollY,value:target};
    if (quiet()) {
      mark(index);
      still.src=index===0?"assets/turntable/still-4.webp":"assets/turntable/tiffin-open-still.webp";
    } else requestPaint();
  }
  buttons.forEach((button,i)=>{
    button.addEventListener("click",()=>choose(i));
    button.addEventListener("keydown",event=>{
      const choices={ArrowLeft:i-1,ArrowRight:i+1,Home:0,End:buttons.length-1};
      if (!(event.key in choices)) return;
      event.preventDefault();
      const index=clamp(choices[event.key],0,buttons.length-1);
      buttons[index].focus();
      choose(index);
    });
  });

  function photoAt(image,x,foot,width,rotation,opacity=1) {
    const h=width*Number(image.getAttribute("height"))/Number(image.getAttribute("width"));
    image.style.width=width.toFixed(2)+"px";
    image.style.transform="translate3d("+(x-width/2).toFixed(2)+"px,"+(foot-h).toFixed(2)+"px,0) rotate("+rotation.toFixed(2)+"deg)";
    image.style.opacity=opacity.toFixed(3);
  }
  const ground=document.createElement("div");
  ground.className="packing-shadow";
  stage.prepend(ground);
  const storyLabels=[...stage.querySelectorAll(".flight-labels span")];
  // Each tier has its own composited layer. Rerasterize only when its angle
  // changes or it needs a higher-resolution crop. Flight itself is a transform.
  const tray=stage.querySelector(".photographic-tins");
  const surfaces=Array.from({length:5},()=>{
    const canvas=document.createElement("canvas");
    canvas.className="baked-piece";
    canvas.hidden=true;
    tray.append(canvas);
    return {canvas,brush:canvas.getContext("2d"),plate:null};
  });
  const frames=new Map();
  const mast=document.querySelector(".mast");
  const copy=page.querySelector(".packing-copy");
  const landingTitle=planCounter.querySelector(".landing-heading");
  let spin=0,wantedSpin=0,drag=null;
  const turn=Math.PI*2;
  function frameAt(index) {
    const n=(index%32+32)%32;
    let img=frames.get(n);
    if(!img) {
      img=new Image();
      img.decoding="async";
      img.onload=requestPaint;
      img.src="assets/turntable/"+String(n).padStart(2,"0")+".webp";
      frames.set(n,img);
    }
    if(img.complete && img.naturalWidth) {
      frames.delete(n);
      frames.set(n,img);
      while(frames.size>6) frames.delete(frames.keys().next().value);
      return img;
    }
    // A decoded product frame keeps the fine print sharp while another angle loads.
    let nearest=null,best=Infinity;
    for(const [index,loaded] of frames) {
      if(!loaded.naturalWidth) continue;
      const delta=Math.abs(n-index),distance=Math.min(delta,32-delta);
      if(distance<best){best=distance;nearest=loaded;}
    }
    return nearest;
  }

  // The cover lifts first. Each following tier clears the one below before its
  // outward sweep; perspective makes the front serving read as the nearest.
  function paths(state) {
    const r=state.port,p=state.pose,t=state.transfer;
    const base=r.y+r.height*.82;
    const narrow=r.height>r.width;
    const centre=r.x+r.width*(narrow?.50:.515);
    const spread=ease(.005,.33,p);
    const closedWidth=Math.min(r.width*.62,r.height*.484);
    const width=mix(closedWidth,Math.min(r.width*(narrow?.282:.267),r.height*.38),spread);
    const right=ease(.265,.535,p), left=ease(.605,.85,p);
    const offset=[.010*spread,-.345*left,.345*right];
    const mid=base-width*(.29+.68*ease(.49,.61,p));
    const top=base-width*(.58+.75*ease(.105,.28,p));
    const positions=[
      mix(base,r.y+r.height*.835,ease(.62,1,p)),
      mix(mid,r.y+r.height*.675,ease(.84,1,p)),
      mix(top,r.y+r.height*.59,ease(.54,.89,p))
    ];
    const vector=[.24,-.82,.72];
    const dolly=Math.sin(Math.PI*p);
    const lift=ease(.004,.19,p);
    const parts=station.map((j,i)=>{
      const dock=state.anchors[j];
      const flight=clamp(t+(.5-j*.5)*.30*Math.sin(Math.PI*t));
      const arch=Math.sin(Math.PI*flight);
      const opened=[ease(.46,1,p),left,right][i];
      const w=width*(1+[.075,-.015,-.055][i]*opened);
      const floating=opened*(1-flight);
      const release=[ease(.40,.80,p),ease(.46,.87,p),ease(.08,.55,p)][i];
      const counterTurn=Math.sin(Math.PI*release)*(1-flight);
      const x=centre+r.width*offset[i]+floating*r.width*.005*Math.sin(state.clock*.54+i);
      const y=positions[i]+floating*r.height*.010*Math.sin(state.clock*.76+i*1.7);
      const landingLift=state.hover[j]*flight*Math.min(16,dock.width*.065);
      const size=mix(w,dock.width,flight)*(1+state.hover[j]*flight*.033);
      const foot=mix(y,dock.y,flight)-arch*r.height*(.043+.029*j)-landingLift;
      let lateral=mix(x,dock.x,flight);
      // As the copy rail scrolls away, keep the whole silhouette in its art lane.
      for(const rail of state.rails || []) {
        const gap=Math.max(rail.top-foot,foot-size*.8-rail.bottom);
        const influence=1-ease(12,92,gap);
        lateral=mix(lateral,Math.max(lateral,rail.right+size*.58+8),influence);
      }
      return {x:lateral,y:foot,w:size,alpha:1,j,
        angle:state.spin+vector[i]*opened*(1-flight)+[.17,.13,-.21][i]*counterTurn+state.rotation[j]*flight,
        bank:opened*(1-flight)*[.028,-.085,.068][i]+arch*[.045,-.057,.058][i],
        pitch:opened*(1-flight)*[-.035,.065,.10][i]+dolly*.04*(1-flight)+arch*.060};
    });
    // The lid follows the rising rim until the tier has cleared it. A rounded
    // minimum blends the clearance constraint into its final suspended position.
    const parked=mix(base-width*.88,r.y+r.height*(narrow?.37:.26),lift);
    const clearance=Math.min(positions[1],positions[2])-width*(.30+.56*lift);
    const radius=width*.075;
    const capY=Math.min(parked,clearance)-Math.max(0,radius-Math.abs(parked-clearance))**2/(4*radius);
    const departure=ease(0,.65,t);
    parts.push({x:centre+r.width*(-.095*lift+.045*Math.sin(Math.PI*p)+.105*departure),
      y:capY-r.height*.19*departure,
      w:width*mix(1,.79,lift)*(1-.12*departure),alpha:1-ease(.14,.65,t),
      angle:state.spin+.70*lift+.26*departure,bank:-.125*lift-.055*departure,pitch:.27*lift});
    return parts;
  }
  function drawPhotographs(state) {
    const art=frameAt(Math.round(state.spin*32/turn));
    if (!art || !surfaces[0].brush) {
      state.parts.forEach((v,i)=>photoAt(sprites[i],v.x,v.y,v.w,0,v.alpha));
      return;
    }
    const packed=state.pose<.012;
    surfaces.forEach((surface,i)=>{
      const v=state.parts[i===4?0:i];
      const show=i===4 ? packed : !packed && v.alpha>.002;
      surface.canvas.hidden=!show;
      if(!show)return;
      const plate=frameAt(Math.round(v.angle*32/turn)) || art;
      const cell=plate.naturalHeight,side=v.w*3.14/2.04;
      const native=Math.min(cell,Math.max(128,Math.ceil(side*Math.min(devicePixelRatio||1,2)/128)*128));
      const {canvas,brush}=surface;
      if(plate!==surface.plate || canvas.width<native || canvas.width>native*1.5) {
        canvas.width=canvas.height=native;
        brush.imageSmoothingQuality="high";
        brush.drawImage(plate,cell*i,0,cell,cell,0,0,native,native);
        surface.plate=plate;
      }
      const scale=side/512,vertical=scale*(1-(v.pitch||0)*.22);
      canvas.style.transform="translate3d("+v.x+"px,"+v.y+"px,0) rotate("+(-(v.bank||0))+"rad) scale("+scale+","+vertical+") translate(-50%,"+(i===3?"-98.1%":"-97.2%")+")";
      canvas.style.opacity=v.alpha;
    });
    passage.classList.add("baked-ready");
  }
  function requestPaint() {
    if(quiet()!==passage.classList.contains("passage-quiet")) {mode();return;}
    if (!frame && near && !document.hidden && !quiet()) frame=requestAnimationFrame(paint);
  }
  let layout, needsLayout=true, slowFrames=0, detail=1;
  function invalidate() {
    needsLayout=true;
    requestPaint();
  }
  function measure() {
    const s=stage.getBoundingClientRect(), intro=page.getBoundingClientRect();
    const art=port.getBoundingClientRect(), bed=garden.getBoundingClientRect();
    const top=planCounter.getBoundingClientRect().top;
    const end=clamp(bed.top-top+Math.min(s.height*.12,94),s.height*.23,s.height*.46);
    const ratio=clamp((s.height*1.32-bed.top)/(s.height*1.32-end));
    const rect={x:art.left-s.left,y:art.top-intro.top+Math.max(0,intro.top-s.top),width:art.width,height:art.height};
    const anchors=docks.map(dock=>{
      const d=dock.getBoundingClientRect();
      return {x:d.left+d.width/2-s.left,y:d.top-s.top,width:d.width};
    });
    const rails=[copy,landingTitle].map(el=>el.getBoundingClientRect()).filter(box=>
      box.right<s.left+s.width*.62 && box.width>0
    ).map(box=>({right:box.right-s.left,top:box.top-s.top,bottom:box.bottom-s.top}));
    const clearance=clamp(mast.getBoundingClientRect().bottom-s.top,0,s.height);
    stage.style.setProperty("--mast-clearance",clearance+"px");
    needsLayout=false;
    return {s,rect,anchors,ratio,rails,raw:rawProgress()};
  }
  function paint(now) {
    frame=0;
    if(quiet()) {mode();return;}
    if (!near || document.hidden) return;
    if(needsLayout || !layout) layout=measure();
    const {s,rect,anchors,ratio}=layout;
    if (!s.width || !s.height) return;
    target=anchored(layout.raw);
    const elapsed=lastTime?now-lastTime:16;
    if(view && !lost) {
      slowFrames=elapsed>85?slowFrames+1:Math.max(0,slowFrames-1);
      if(slowFrames===4)detail=.9;
      if(slowFrames>=12){
        lost=true;
        passage.classList.remove("passage-webgl");
      }
    }
    const dt=lastTime?clamp(now-lastTime,0,64):16;
    const step=lastTime?1-Math.exp(-Math.min(120,Math.max(1,now-lastTime))/79):1;
    lastTime=now;
    progress=mix(progress,target,step);
    if(Math.abs(target-progress)<.001) progress=target;
    lightX=mix(lightX,desiredLight,step);
    spin=mix(spin,wantedSpin,step);
    for(let i=0;i<tilt.length;i++) tilt[i]=mix(tilt[i],hovered===i?1:0,step);
    const transfer=ratio-Math.sin(turn*ratio)*.105;
    const active=keys.indexOf(selected);
    clock+=dt/1000;
    if(!drag) drift=(drift+dt*.000128*(1-transfer))%turn;
    for(let i=0;i<rotation.length;i++) {
      const rate=holding===i?0:hovered===i?.00054:active===i?.000205:0;
      speed[i]=holding===i?0:mix(speed[i],rate,1-Math.exp(-dt/260));
      rotation[i]+=speed[i]*dt*transfer;
    }
    const state={width:s.width,height:s.height,detail,port:rect,rails:layout.rails,pose:Math.max(progress,ease(0,.32,transfer)),spin:spin+drift+lightX*.14*(1-transfer),clock,transfer,anchors,hover:tilt,rotation,light:lightX,selected:active};
    state.parts=paths(state);
    const base=state.parts[0];
    const shadowWidth=base.w*(1.03+.18*state.pose);
    const shadowHeight=base.w*(.13+.04*state.pose);
    ground.style.width=shadowWidth.toFixed(2)+"px";
    ground.style.height=shadowHeight.toFixed(2)+"px";
    ground.style.transform="translate3d("+(base.x-shadowWidth*.49).toFixed(1)+"px,"+(base.y-shadowHeight*.48+base.w*.028).toFixed(1)+"px,0)";
    ground.style.opacity=((1-transfer)*(.88-.41*state.pose)).toFixed(3);
    state.parts.slice(0,3).forEach((v,i)=>{
      const label=storyLabels[station[i]];
      label.style.left=v.x+"px";label.style.top=(v.y+8)+"px";
      label.style.opacity=(ease(i===2 ? .53 : .76,i===2 ? .68 : .91,state.pose)*(1-ease(.45,.9,transfer))).toFixed(3);
    });
    lastState=state;
    mark(progress<.34?0:progress<.82?1:2);
    passage.style.setProperty("--pack-sun",(progress*23+lightX*5).toFixed(2)+"px");
    passage.style.setProperty("--garden-light",(53+12*transfer+8*lightX).toFixed(2)+"%");
    garden.style.setProperty("--garden-ray",((transfer-.5)*25+lightX*7).toFixed(2)+"%");
    garden.style.setProperty("--herb-sway",((transfer-.5)*3+lightX*2).toFixed(2)+"px");
    docks.forEach((dock,i)=>{
      dock.style.setProperty("--contact",(.14+.86*ease(.38,1,transfer)-tilt[i]*.10).toFixed(3));
      dock.style.setProperty("--pressure",(1.2-.20*transfer+tilt[i]*.08).toFixed(3));
    });
    if (view && !lost) paintModel(state);
    else drawPhotographs(state);
    passage.classList.add("passage-painted");
    if (near) requestPaint();
  }

  function paintModel(state) {
    if (!passage.classList.contains("passage-webgl")) drawPhotographs(state);
    try {
      view.render(state);
      passage.classList.add("passage-webgl");
    } catch {
      lost=true;
      drawPhotographs(state);
      passage.classList.remove("passage-webgl");
    }
  }
  async function warmModel() {
    if(warming || quiet() || !window.WebGL2RenderingContext) return;
    warming=true;
    try {
      const canvas=stage.querySelector(".tiffin-canvas");
      const context=canvas.getContext("webgl2",{alpha:true,antialias:true,powerPreference:"low-power"});
      if (!context) return;
      const {createCarrierView}=await import("./tiffin-gl.js");
      if (quiet()) {warming=false;return;}
      const model=await createCarrierView(canvas,context);
      view=model;
      if(lastState && !quiet()) paintModel(lastState);
      requestPaint();
    } catch {
      lost=true;
      passage.classList.remove("passage-webgl");
      requestPaint();
    }
  }
  stage.querySelector(".tiffin-canvas").addEventListener("webglcontextlost",event=>{
    event.preventDefault();
    lost=true;
    if(lastState) drawPhotographs(lastState);
    passage.classList.remove("passage-webgl");
    requestPaint();
  });
  stage.querySelector(".tiffin-canvas").addEventListener("webglcontextrestored",()=>{
    lost=false;slowFrames=0;detail=1;
    if(view && lastState && !quiet()) paintModel(lastState);
    requestPaint();
  });
  function mode() {
    passage.classList.toggle("passage-quiet",quiet());
    port.tabIndex=quiet()?-1:0;
    controlAnchor=null;
    if(quiet()) {
      mark(0);still.src="assets/turntable/still-4.webp";
      passage.classList.remove("passage-webgl");
    } else {
      progress=anchored(rawProgress());
      if(near) { prepareRotation();warmModel(); }
      requestPaint();
    }
  }
  for (const [i,dock] of docks.entries()) {
    const label=planLabels[i];
    const button=dock.querySelector(".carrier-flight");
    let start=null, suppressClick=false;
    function turn(angle) {
      speed[i]=0;
      rotation[i]=angle%(Math.PI*2);
      if (quiet()) {
        const n=(Math.round(rotation[i]*16/Math.PI)%32+32)%32;
        button.style.setProperty("--quiet-image",'url("assets/turntable/'+String(n).padStart(2,"0")+'.webp")');
        button.style.setProperty("--cell",String(station.indexOf(i)));
        button.classList.add("inspect-still");
      } else requestPaint();
    }
    button.addEventListener("pointerdown",event=>{
      if(event.button!==0 || !event.isPrimary)return;
      holding=i;speed[i]=0;
      start={id:event.pointerId,x:event.clientX,angle:rotation[i]};
      suppressClick=false;
      button.setPointerCapture(event.pointerId);
    });
    button.addEventListener("pointermove",event=>{
      if(start?.id!==event.pointerId)return;
      const dx=event.clientX-start.x;
      if(!suppressClick && Math.abs(dx)<5)return;
      suppressClick=true;
      turn(start.angle+dx*Math.PI*2/Math.max(80,button.clientWidth*.85));
    });
    button.addEventListener("lostpointercapture",()=>{start=null;holding=-1;requestPaint();});
    button.addEventListener("click",event=>{
      if(!suppressClick || event.detail===0) document.getElementById(button.dataset.input).click();
      suppressClick=false;
    });
    button.addEventListener("keydown",event=>{
      if(!["ArrowLeft","ArrowRight","Home"].includes(event.key))return;
      event.preventDefault();turn(event.key==="Home"?0:rotation[i]+(event.key==="ArrowLeft"?-1:1)*Math.PI/8);
    });
    for(const hit of [dock,label]) {
      hit.addEventListener("pointerenter",event=>{if(event.pointerType==="mouse"){hovered=i;requestPaint();}});
      hit.addEventListener("pointerleave",()=>{hovered=-1;requestPaint();});
    }
    label.addEventListener("focusin",()=>{hovered=i;requestPaint();});
    label.addEventListener("focusout",()=>{hovered=-1;requestPaint();});
  }
  function prepareRotation(){
    if(!quiet() && !view && !frames.size) frameAt(0);
  }
  port.addEventListener("pointerenter",prepareRotation,{passive:true});
  port.addEventListener("focus",prepareRotation);
  port.addEventListener("pointerdown",event=>{
    if(quiet() || event.button!==0)return;
    prepareRotation();
    drag={x:event.clientX,angle:wantedSpin,id:event.pointerId};
    port.setPointerCapture(event.pointerId);
    port.classList.add("turning");
  });
  port.addEventListener("pointermove",event=>{
    if(!drag || event.pointerId!==drag.id)return;
    wantedSpin=drag.angle+(event.clientX-drag.x)*Math.PI*2/Math.max(150,port.clientWidth*.72);
    requestPaint();
  });
  port.addEventListener("lostpointercapture",()=>{drag=null;port.classList.remove("turning");});
  port.addEventListener("keydown",event=>{
    if(quiet() || !["ArrowLeft","ArrowRight","Home"].includes(event.key))return;
    event.preventDefault();
    prepareRotation();
    wantedSpin=event.key==="Home"?0:wantedSpin+(event.key==="ArrowLeft"?-1:1)*Math.PI/8;
    requestPaint();
  });
  passage.addEventListener("change",event=>{
    if(event.target.name==="protein") {selected=event.target.closest(".garden-plan").dataset.plan;requestPaint();}
  });
  passage.addEventListener("pointermove",event=>{
    if(event.pointerType!=="mouse" || quiet()) return;
    desiredLight=clamp(event.clientX/Math.max(1,innerWidth))*2-1;
    requestPaint();
  },{passive:true});
  passage.addEventListener("pointerleave",()=>{desiredLight=0;requestPaint();});
  controls.hidden=false;
  passage.classList.add("passage-active");
  if("IntersectionObserver" in window) {
    near=false;
    const inShot=new Set();
    const visibility=new IntersectionObserver(entries=>{
      for(const entry of entries) {
        if(entry.isIntersecting) inShot.add(entry.target);
        else inShot.delete(entry.target);
      }
      const visible=inShot.size>0;
      if(near!==visible){lastTime=0;needsLayout=true;}
      near=visible;
      if(near) {prepareRotation();warmModel();requestPaint();}
    },{rootMargin:"35px 0px"});
    visibility.observe(story);
    visibility.observe(garden);
    const preheat=new IntersectionObserver(([entry])=>{
      if(entry.isIntersecting) {prepareRotation();warmModel();preheat.disconnect?.();}
    },{rootMargin:"720px 0px"});
    preheat.observe(story);
    new IntersectionObserver(([entry])=>garden.classList.toggle("sill-in-view",entry.isIntersecting)).observe(garden);
  }
  function geometryChanged() {
    const bed=garden.getBoundingClientRect();
    if (bed.width) {
      const positions=planLabels.map(label=>{
        const rect=label.getBoundingClientRect();
        return (rect.left+rect.width/2-bed.left)/bed.width*100;
      });
      docks.forEach((dock,i)=>dock.style.setProperty("--station",positions[i].toFixed(4)+"%"));
    }
    lastTime=0;
    invalidate();
  }
  if("ResizeObserver" in window) {
    const observer=new ResizeObserver(geometryChanged);observer.observe(page);observer.observe(garden);observer.observe(planCounter);
  }
  window.addEventListener("scroll",invalidate,{passive:true});
  window.addEventListener("resize",geometryChanged);
  window.addEventListener("pageshow",geometryChanged);
  document.addEventListener("visibilitychange",()=>{lastTime=0;requestPaint();});
  reduce.addEventListener("change",mode);
  geometryChanged();
  mode();
})();
