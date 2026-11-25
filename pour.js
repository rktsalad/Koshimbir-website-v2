(() => {
  const data = window.KoshimbirPour;
  if (!data) return;
  const one = (selector) => document.querySelector(selector);
  const stage = one(".stage");
  const journey = one(".journey");
  const wrist = one(".wrist");
  const shadow = one(".cast-shadow");
  const cup = one("#cup-art");
  const canvas = one("#ribbons");
  const fluidCanvas = one("#stream");
  const wet = canvas.getContext("2d");
  const fluid = fluidCanvas.getContext("2d");
  if (!wet || !fluid) return;
  const camera = one(".camera");
  const copy = one(".hero-message");
  const finishCopy = one(".finishing-message");
  let finishIsRead = false;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const scarce = Boolean(navigator.connection?.saveData);
  const atlas = new Image();
  atlas.fetchPriority = "low";
  cup.fetchPriority = "low";
  const underlay = document.createElement("canvas");
  underlay.width = canvas.width;
  underlay.height = canvas.height;
  const base = underlay.getContext("2d");
  if (!base) return;

  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  function ease(value) { const t = clamp(value); return t * t * (3 - 2 * t); }
  const startFlow = .15;
  const endFlow = .86;

  let timeline = 0, painted = 0, lastRibbon = -1;
  let renderedPose = -1;
  let startY = 0, distance = 1, frame = 0;
  let visible = true, ready = false, loading;
  function measured() {
    startY = journey.getBoundingClientRect().top + scrollY;
    distance = Math.max(1, journey.offsetHeight - stage.offsetHeight);
  }
  function scrollFraction() { return clamp((scrollY - startY) / distance); }
  function paintTile(context, index) {
    const [sx, sy, width, height, x, y] = data.tiles[index];
    if (width) context.drawImage(atlas, sx, sy, width, height, x, y, width, height);
  }
  function dress(fraction) {
    const amount = fraction * data.tiles.length;
    if (Math.abs(lastRibbon - amount) < .015) return;
    lastRibbon = amount;
    const full = Math.floor(amount);
    if (full < painted) {
      base.clearRect(0, 0, canvas.width, canvas.height);
      painted = 0;
    }
    while (painted < full) paintTile(base, painted++);
    wet.clearRect(0, 0, canvas.width, canvas.height);
    if (full) wet.drawImage(underlay, 0, 0);
    if (full < data.tiles.length && amount > full) {
      wet.globalAlpha = amount - full;
      paintTile(wet, full);
      wet.globalAlpha = 1;
    }
  }
  function targetAt(fraction) {
    const index = fraction * (data.path.length - 1);
    const a = data.path[Math.floor(index)], b = data.path[Math.ceil(index)];
    const t = index % 1;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
  function strand(lipX, lipY, hitX, hitY, amount, fraction) {
    if (amount <= 0) return;
    const endY = lipY + (hitY - lipY) * amount;
    const endX = lipX + (hitX - lipX) * amount;
    const bend = 5 * Math.sin(fraction * Math.PI * 5);
    const w = 5.2 + 1.1 * Math.sin(fraction * 42);
    const middle = lipY + (endY - lipY) * .58;
    const glaze = fluid.createLinearGradient(lipX - w, lipY, endX + w * 1.7, endY);
    glaze.addColorStop(0, "#bec17f");
    glaze.addColorStop(.2, "#e7e4a7");
    glaze.addColorStop(.7, "#dad79b");
    glaze.addColorStop(1, "#cfce94");
    fluid.fillStyle = glaze;
    fluid.beginPath();
    fluid.moveTo(lipX - w, lipY - 2);
    fluid.bezierCurveTo(lipX - w + bend, middle, endX - w * .55, endY - 12, endX - w * .8, endY);
    fluid.quadraticCurveTo(endX + 1, endY + 4, endX + w * .72, endY);
    fluid.bezierCurveTo(endX + w * .58, endY - 12, lipX + w + bend, middle, lipX + w, lipY - 2);
    fluid.fill();
    fluid.beginPath();
    fluid.moveTo(lipX - w * .48, lipY);
    fluid.bezierCurveTo(lipX - w * .4 + bend, middle, endX - w * .3, endY - 12, endX - 1, endY);
    fluid.lineWidth = 1.7;
    fluid.strokeStyle = "rgba(255,251,208,.74)";
    fluid.stroke();
  }
  function pose() {
    const dose = clamp((timeline - startFlow) / (endFlow - startFlow));
    const showFinish = timeline > .015 && (finishIsRead || dose >= .73);
    if (finishIsRead !== showFinish) {
      finishIsRead=showFinish;
      finishCopy.hidden=!showFinish;
      copy.classList.toggle("is-finish",showFinish);
      copy.querySelector(".opening-message").setAttribute("aria-hidden",String(showFinish));
      finishCopy.setAttribute("aria-hidden",String(!showFinish));
    }
    camera.style.setProperty("--pour-lens", String(reduce.matches || scarce ? 1 : 1 + .024 * ease(timeline)));
    dress(dose);
    fluid.setTransform(1, 0, 0, 1, 0, 0);
    fluid.clearRect(0, 0, fluidCanvas.width, fluidCanvas.height);
    const handVisible = !reduce.matches && timeline > .005 && timeline < .997;
    wrist.hidden = !handVisible;
    shadow.hidden = !handVisible;
    if (!handVisible) return;
    const [hitX, hitY] = targetAt(dose);
    const approach = 1 - ease(timeline / startFlow);
    const retreat = ease((timeline - endFlow) / (1 - endFlow));
    const travel = approach + retreat;
    // The lip leads the trace on the leaves by the short flight time of the dressing.
    const next = targetAt(clamp(dose + .004));
    const lead = clamp((next[0]-hitX)*.6,-14,14);
    const lipX = hitX + 6 + lead + 5 * Math.sin(dose * 19) + travel * 440;
    const lipY = hitY - 131 - 14 * Math.cos(dose * 10) - travel * 470;
    wrist.style.left = (lipX / 1536 * 100) + "%";
    wrist.style.top = (lipY / 1024 * 100) + "%";
    shadow.style.left = ((hitX + 45 + travel * 200) / 1536 * 100) + "%";
    shadow.style.top = ((hitY + 22) / 1024 * 100) + "%";
    shadow.style.opacity = String(.46 * (1-travel));
    const rotation = -9 + Math.sin(dose * 13) * 3 - travel * 21;
    wrist.style.transform = "translate(-1.56682%, -78.20690%) rotate(" + rotation + "deg)";
    const amount = ease((timeline - startFlow + .020) / .020) * (1 - ease((timeline - endFlow + .007) / .021));
    const sx = fluidCanvas.width / 800, sy = fluidCanvas.height / 650;
    fluid.setTransform(sx, 0, 0, sy, -560 * sx, -30 * sy);
    if (amount > .92) {
      // Soft occlusion and a small meniscus sit on the food, below the stream.
      fluid.beginPath();
      fluid.ellipse(hitX+3,hitY+2,9.3,3.5,-.22,0,Math.PI*2);
      fluid.fillStyle = "rgba(69,61,27,.18)";
      fluid.fill();
      fluid.beginPath();
      fluid.ellipse(hitX,hitY,7.2,3.0,-.22,0,Math.PI*2);
      fluid.fillStyle = "#d8d69f";
      fluid.fill();
    }
    strand(lipX, lipY, hitX, hitY, amount, dose);
    // The final bead falls after the cup tips back. Its path is reversible when scrubbed.
    const release = (timeline - endFlow - .015) / .039;
    if (release > 0 && release < 1) {
      const y = hitY - 128 + 128 * release * release;
      const x = hitX + 12 * (1-release);
      fluid.beginPath();
      fluid.ellipse(x,y,3.8,5.2+2*release,-.05,0,Math.PI*2);
      fluid.fillStyle = "#dfdda7";
      fluid.fill();
      fluid.beginPath();
      fluid.ellipse(x-1,y-1,1.2,2.6,-.05,0,Math.PI*2);
      fluid.fillStyle = "#f4efc6";
      fluid.fill();
    }
  }
  function queue() { if (!frame && ready && visible && !document.hidden) frame = requestAnimationFrame(draw); }
  function draw() {
    frame = 0;
    if (!visible || document.hidden) return;
    if (renderedPose!==timeline) {pose();renderedPose=timeline;}
  }
  function scrollPose() {
    timeline=reduce.matches || scarce ? 0 : scrollFraction();
    queue();
  }
  function enable() {
    if (loading) return loading;
    cup.sizes = "(max-width: 760px) 112vw, 82vw";
    cup.srcset = "assets/pour-hand-small.webp 1302w, assets/pour-hand.webp 2170w";
    cup.src = "assets/pour-hand.webp";
    atlas.src = "assets/pour-ribbons.webp";
    loading = Promise.all([cup.decode(), atlas.decode()]).then(() => {
      ready = true;
      document.body.classList.add("pour-ready");
      measured();
      if (!reduce.matches && !scarce) timeline = scrollFraction();

      queue();
    }).catch(() => { document.body.classList.remove("has-pour"); });
    return loading;
  }
  window.addEventListener("scroll",scrollPose,{passive:true});
  const remeasure=()=>{measured();scrollPose();};
  window.addEventListener("resize",remeasure);
  window.addEventListener("pageshow",remeasure);
  if ("IntersectionObserver" in window) new IntersectionObserver(([entry])=>{
    visible=entry.isIntersecting;if(visible)scrollPose();
  }).observe(stage);
  document.addEventListener("visibilitychange",scrollPose);
  function mode(){
    document.body.classList.toggle("has-pour",!reduce.matches&&!scarce);
    if(!reduce.matches&&!scarce)enable();
    renderedPose=-1;remeasure();
  }
  reduce.addEventListener("change",mode);
  mode();
})();
