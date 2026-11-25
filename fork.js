(() => {
  const chapter = document.querySelector(".fork-chapter");
  if (!chapter) return;
  const stage = chapter.querySelector(".fork-stage");
  const camera = chapter.querySelector(".fork-camera");
  const object = chapter.querySelector(".fork-object");
  const controls = chapter.querySelector(".focus-choices");
  const buttons = [...controls.querySelectorAll("[data-focus]")];
  const notes = [...chapter.querySelectorAll("[data-note]")];
  const stops = buttons.map((button) => button.dataset.point.split(" ").map(Number));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const narrow = matchMedia("(max-width:760px), (orientation:portrait) and (max-width:900px)");
  const last = stops.length - 1;
  const clamp = (v,low=0,high=1) => Math.max(low,Math.min(high,v));
  const blend = (a,b,t) => a+(b-a)*t;
  const ease = (v) => { const n = clamp(v); return n*n*(3-2*n); };

  let start = 0, travel = 1, stageHeight = 1;
  let target = 0, position = 0, active = -1, frame = 0, visible = true;
  let pointerX = 0, pointerY = 0, leanX = 0, leanY = 0, manual = null;
  function setNote(index) {
    if (index === active) return;
    active = index;
    const key = buttons[index].dataset.focus;
    buttons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
    notes.forEach((note) => {
      const selected = note.dataset.note === key;
      note.classList.toggle("is-current", selected);
      note.setAttribute("aria-hidden", String(!selected));
    });
    controls.style.setProperty("--choice-left", (index * 100 / buttons.length) + "%");
  }
  function readProgress() { return clamp((scrollY - start) / travel); }
  let previousTime = 0;
  function draw(time) {
    const elapsed = previousTime ? Math.min(45, time - previousTime) : 16.667;
    previousTime = time;
    const follow = 1 - Math.exp(-elapsed / 111);
    frame = 0;
    if (!visible || document.hidden) return;
    if (reduce.matches) {
      position = target;
      leanX = leanY = 0;
    } else {
      position = blend(position,target,follow);
      leanX = blend(leanX,pointerX,follow);
      leanY = blend(leanY,pointerY,follow);
    }
    if (Math.abs(position-target)<.001) position=target;
    const left = Math.min(last,Math.floor(position));
    const right = Math.min(last,left+1);
    const t = ease(position-left);
    const fx = blend(stops[left][0],stops[right][0],t);
    const fy = blend(stops[left][1],stops[right][1],t);
    setNote(Math.round(position));
    stage.style.setProperty("--key-x",(62+position*3+leanX*.55).toFixed(2)+"%");
    stage.style.setProperty("--place-shift", ((position / last - .5) * 25 + leanX*.40).toFixed(2)+"px");
    stage.style.setProperty("--place-depth", ((position / last - .5) * 21 - leanY*.7).toFixed(2)+"px");
    stage.style.setProperty("--place-light", (.30 + .25*position/last).toFixed(3));
    // A single bead stretches and releases from the photographed tip as the lens reaches the dressing.
    const finish = clamp((position - (last - .77)) / .73);
    const drop = clamp((finish - .50) / .42);
    const light = ease(clamp((position - .58) / 1.25));
    const proximity = reduce.matches ? 0 : Math.sin(Math.PI * position / last);
    stage.style.setProperty("--fork-warmth",(.10+.26*proximity).toFixed(3));
    stage.style.setProperty("--fork-light", light.toFixed(3));
    object.style.setProperty("--fork-glint", ((finish - .5) * 38).toFixed(1) + "%");
    object.style.setProperty("--bead-size", (ease(finish / .41) * (.84 - drop * .14)).toFixed(3));
    object.style.setProperty("--bead-fall", (drop * drop * 330).toFixed(1) + "%");
    object.style.setProperty("--bead-alpha", (Math.min(1,finish * 4) * (1 - ease((drop - .67) / .33))).toFixed(3));
    const entrance = reduce.matches ? 1 : ease(clamp((scrollY+stageHeight-start)/stageHeight));
    // Lift the same fork into the set, then follow the ingredient under the lens.
    const horizontal = (43-fx) * (narrow.matches ? .40 : .9) + leanX;
    const vertical = (22-fy) * stageHeight * (narrow.matches ? .00160 : .0026)
      + (1-entrance) * stageHeight * .10 + leanY;
    camera.style.setProperty("--fork-x",horizontal.toFixed(2)+"px");
    camera.style.setProperty("--fork-y",vertical.toFixed(2)+"px");
    camera.style.setProperty("--fork-turn",(-4+(position/Math.max(last,1))*7-5*(1-entrance)+leanX*.09).toFixed(2)+"deg");
    camera.style.setProperty("--fork-lens",(1+.024*position/last+proximity*(narrow.matches?.047:.115)).toFixed(4));
    if (Math.abs(position-target)>.001||Math.abs(leanX-pointerX)+Math.abs(leanY-pointerY)>.15) requestDraw();
    else previousTime = 0;
  }
  function requestDraw() { if (!frame&&visible&&!document.hidden) frame=requestAnimationFrame(draw); }
  function fromScroll() {
    if (!reduce.matches && travel>1 && !navigator.connection?.saveData) {
      const progress=readProgress();
      if (manual && (scrollY < start - stageHeight * .35 || scrollY > start + travel + stageHeight * .35)) manual = null;
      if (!manual) target=last*progress;
      else if (progress<manual.scroll) target=manual.value*progress/Math.max(.001,manual.scroll);
      else target=manual.value+(last-manual.value)*(progress-manual.scroll)/Math.max(.001,1-manual.scroll);
    }
    requestDraw();
  }
  function measure() {
    start=chapter.getBoundingClientRect().top+scrollY;
    stageHeight=stage.offsetHeight;
    travel=Math.max(1,chapter.offsetHeight-stageHeight);
    fromScroll();
  }
  function select(index) {
    target=index;
    manual={scroll:readProgress(),value:target};
    if (reduce.matches) position=index;
    requestDraw();
  }
  buttons.forEach((button,i) => {
    button.addEventListener("click",()=>select(i));
    button.addEventListener("keydown",(event)=>{
      const keys={ArrowLeft:Math.max(0,i-1),ArrowRight:Math.min(last,i+1),Home:0,End:last};
      if (!(event.key in keys)) return;
      event.preventDefault();
      buttons[keys[event.key]].focus();
      select(keys[event.key]);
    });
  });
  stage.addEventListener("pointermove",(event)=>{
    if (reduce.matches||!fine.matches||event.pointerType!=="mouse") return;
    const rect=stage.getBoundingClientRect();
    pointerX=((event.clientX-rect.left)/rect.width-.5)*14;
    pointerY=((event.clientY-rect.top)/rect.height-.5)*8;
    requestDraw();
  },{passive:true});
  stage.addEventListener("pointerleave",()=>{pointerX=pointerY=0;requestDraw();});
  function motionMode() {
    chapter.classList.toggle("has-focus-film",!reduce.matches&&!navigator.connection?.saveData);
    pointerX=pointerY=0;
    manual=null;
    measure();
  }
  controls.hidden=false;
  controls.style.setProperty("--choice-width",100/buttons.length+"%");
  chapter.classList.add("has-fork");
  setNote(0);
  motionMode();
  reduce.addEventListener("change",motionMode);
  window.addEventListener("scroll",fromScroll,{passive:true});
  window.addEventListener("resize",measure);
  window.addEventListener("pageshow",measure);
  document.addEventListener("visibilitychange",requestDraw);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry])=>{
      visible=entry.isIntersecting;
      if (visible) {measure();requestDraw();}
    },{rootMargin:"60px 0px"}).observe(chapter);
  }
})();
