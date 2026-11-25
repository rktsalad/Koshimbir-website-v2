(() => {
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const simple = () => motion.matches || Boolean(navigator.connection?.saveData);
  const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));

  function directionalKeys(group, buttons, choose) {
    group.addEventListener("keydown", (event) => {
      const index = buttons.indexOf(document.activeElement);
      if (index < 0) return;
      const targets = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: buttons.length - 1 };
      if (!(event.key in targets)) return;
      event.preventDefault();
      const next = clamp(targets[event.key], 0, buttons.length - 1);
      buttons[next].focus();
      choose(next);
    });
  }

  const rail = document.querySelector(".story-rail");
  const scenes=[...rail.querySelectorAll("figure")];
  const sceneChoices = document.querySelector(".story-controls");

  const sceneButtons = [...sceneChoices.querySelectorAll("button")];
  let currentScene = 0, requestedScene = null, scrollTimer = 0;
  function markScene(index) {
    currentScene = index;
    sceneChoices.style.setProperty("--index", String(index));
    sceneButtons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
  }
  function goToScene(index) {
    markScene(index);
    requestedScene = index;
    rail.scrollTo({left: rail.clientWidth * index, behavior: simple() ? "instant" : "smooth"});
  }
  function settleScene() {
    requestedScene = null;
    if (rail.clientWidth) markScene(clamp(Math.round(rail.scrollLeft / rail.clientWidth), 0, scenes.length - 1));
  }
  sceneButtons.forEach((button, i) => button.addEventListener("click", () => goToScene(i)));
  directionalKeys(sceneChoices, sceneButtons, goToScene);
  rail.addEventListener("keydown", (event) => {
    if (event.target !== rail || !["ArrowLeft","ArrowRight","Home","End"].includes(event.key)) return;
    event.preventDefault();
    const next = {ArrowLeft: currentScene-1, ArrowRight: currentScene+1, Home: 0, End: scenes.length-1}[event.key];
    goToScene(clamp(next,0,scenes.length-1));
  });
  rail.addEventListener("pointerdown", () => { requestedScene = null; }, {passive:true});
  rail.addEventListener("wheel", () => { requestedScene = null; }, {passive:true});
  rail.addEventListener("scroll", () => {
    if (requestedScene === null && rail.clientWidth) markScene(clamp(Math.round(rail.scrollLeft/rail.clientWidth),0,scenes.length-1));
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(settleScene, 160);
  }, {passive:true});
  rail.addEventListener("scrollend", settleScene);
  let lastWidth = rail.clientWidth;
  if ("ResizeObserver" in window) new ResizeObserver(() => {
    const width = rail.clientWidth;
    if (!width || width === lastWidth) return;
    lastWidth = width;
    rail.scrollTo({left: width*currentScene, behavior:"instant"});
  }).observe(rail);
  sceneChoices.hidden = false;

  const observed = new Set();
  const moving = new Map([
    [rail, () => {
      const top = rail.getBoundingClientRect().top;
      const fraction = clamp((innerHeight - top)/(innerHeight + rail.offsetHeight)) - .5;
      rail.style.setProperty("--story-shift", (fraction*6).toFixed(2) + "px");
    }],
    [document.querySelector(".folio"), (folio) => {
      const fraction = clamp((innerHeight*.98 - folio.getBoundingClientRect().top)/(innerHeight*.60));
      const open = (1-fraction)*(1-fraction);
      folio.style.setProperty("--page-angle",(open*13).toFixed(2)+"deg");
      folio.style.setProperty("--book-depth",(1+open*.35).toFixed(3));
    }],
    [document.querySelector(".field-notes"), (notes) => {
      const box = notes.getBoundingClientRect();
      const fraction = clamp((innerHeight-box.top)/(innerHeight+box.height))-.5;
      notes.style.setProperty("--window-drift",(fraction*40).toFixed(2)+"px");
    }],
    [document.querySelector(".brand-contact"), (contact) => {
      const box = contact.getBoundingClientRect();
      contact.style.setProperty("--contact-sun",(42+18*clamp((innerHeight-box.top)/(innerHeight+box.height))).toFixed(2)+"%");
    }]
  ]);
  // Each title borrows its movement from the object beside it. Text and inline
  // emphasis remain in reading order, including when animation is disabled.
  const titleProfiles={
    "inside-title":{from:i=>"translateY("+(.48-i*.06)+"em) rotate("+(-3+i)+"deg)",duration:880,stagger:75},
    "table-title":{from:i=>"translateX("+(i%2?-.33:.33)+"em) skewX(-4deg)",duration:920,stagger:88},
    "unpack-title":{from:i=>"perspective(7em) translateY("+(.30-i*.045)+"em) rotateX("+(-24+3*i)+"deg)",duration:1000,stagger:100},
    "plan-title":{from:i=>"translateY("+(.37-i*.035)+"em) scale("+(.93+i*.01)+")",duration:760,stagger:82},
    "belief-title":{from:i=>"perspective(6em) rotateY("+(i%2?12:-12)+"deg) translateX(.16em)",duration:980,stagger:92},
    "contact-title":{from:i=>"translateX("+(i?-.26:.26)+"em) rotate("+(i?1.8:-1.8)+"deg)",duration:930,stagger:120}
  };
  const titleReveals=new Map();
  function revealTitle(title) {
    if(simple() || !title.animate || titleReveals.has(title)) return;
    const profile=titleProfiles[title.id];
    const players=[...title.querySelectorAll(".ink-word")].map((word,i)=>word.animate(
      [{transform:profile.from(i)},{transform:"none"}],
      {duration:profile.duration,delay:i*profile.stagger,easing:"cubic-bezier(.18,.73,.18,1)",fill:"backwards"}
    ));
    titleReveals.set(title,players);
  }
  for(const id of Object.keys(titleProfiles)) {
    const title=document.getElementById(id);
    if(!title)continue;
    const walker=document.createTreeWalker(title,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes) {
      const fragment=document.createDocumentFragment();
      for(const token of node.textContent.split(/(\s+)/)) {
        if(!token.trim()) {fragment.append(token);continue;}
        const mask=document.createElement("span"),word=document.createElement("span");
        mask.className="ink-mask";word.className="ink-word";word.textContent=token;
        mask.append(word);fragment.append(mask);
      }
      node.replaceWith(fragment);
    }
    title.classList.add("moving-title");
    moving.set(title,()=>{
      const rect=title.getBoundingClientRect();
      const phase=clamp((innerHeight*.90-rect.top)/(innerHeight*.60));
      title.style.setProperty("--type-rise",((1-phase)*6).toFixed(2)+"px");
      if(rect.top<innerHeight*.93 && rect.bottom>0)revealTitle(title);
    });
  }
  motion.addEventListener("change",()=>{
    if(simple())for(const players of titleReveals.values())for(const player of players)player.cancel();
  });
  let frame = 0;
  function paint() {
    frame = 0;
    if (document.hidden || simple()) return;
    for (const item of observed) moving.get(item)(item);
  }
  function schedule() {
    if (!frame && observed.size && !simple() && !document.hidden) frame = requestAnimationFrame(paint);
  }
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.isIntersecting ? observed.add(entry.target) : observed.delete(entry.target));
      schedule();
    }, {rootMargin:"110px 0px"});
    for (const node of moving.keys()) observer.observe(node);
  } else for (const node of moving.keys()) observed.add(node);
  window.addEventListener("scroll",schedule,{passive:true});
  window.addEventListener("resize",schedule);
  window.addEventListener("pageshow",schedule);
  document.addEventListener("visibilitychange",schedule);
  motion.addEventListener("change", () => {
    rail.style.removeProperty("--story-shift");
    document.querySelector(".folio").style.removeProperty("--page-angle");
    document.querySelector(".folio").style.removeProperty("--book-depth");
    schedule();
  });
  schedule();

  const book = document.querySelector(".folio");
  const content = [...book.querySelectorAll("[data-principle]")];
  const pages = book.querySelector(".folio-visual");
  const left = pages.querySelector(".folio-left");
  const right = pages.querySelector(".folio-right");
  const bookTabs = document.querySelector(".book-tabs");
  const leaves = [...bookTabs.querySelectorAll("button")];
  let activeLeaf = 0, turns=[];
  let curledPrint=null;
  const plates=content.map(article=>article.querySelector("img").cloneNode(false));
  function preparePlates(){
    for(const plate of plates) {plate.loading="eager";plate.decode?.().catch(()=>{});}
  }
  if("IntersectionObserver" in window){
    const preload=new IntersectionObserver(([entry])=>{
      if(entry.isIntersecting){preparePlates();preload.disconnect?.();}
    },{rootMargin:"1200px 0px"});
    preload.observe(book);
  } else preparePlates();
  function textAt(index) { return content[index].querySelector(".leaf-reading").cloneNode(true); }
  function settleBook() {
    for(const anim of turns) {anim.onfinish=null;anim.cancel();}
    turns=[];
    curledPrint?.remove();
    curledPrint=null;
    left.classList.remove("turning-print");
  }
  function turnPrint(index,forward) {
    const photo=plates[index],width=left.clientWidth,height=left.clientHeight;
    if(!photo.complete || !photo.naturalWidth || !width || !height)return;
    // Six hinged strips carry one uninterrupted photographic print. Every strip
    // samples the exact same crop as the flat image below it.
    const strips=6,stride=width/strips,sign=forward?1:-1;
    const mount=document.createElement("div");
    mount.className="print-mount";
    let parent=mount;
    for(let i=0;i<strips;i++) {
      const piece=document.createElement("div");
      piece.className="print-joint";
      const position=forward ? strips-1-i : i;
      piece.style.width=stride+"px";
      piece.style.left=(i===0?position*stride:-sign*stride)+"px";
      piece.style.transformOrigin=forward?"100% 50%":"0 50%";
      const surface=document.createElement("div");
      surface.className="print-surface";
      const strip=photo.cloneNode(false);
      strip.style.cssText="width:"+width+"px;height:"+height+"px;left:"+(-position*stride)+"px";
      surface.append(strip);piece.append(surface);parent.append(piece);parent=piece;
      const curl=sign*(i===0?9:3.7);
      turns.push(piece.animate([
        {transform:"rotateY("+curl+"deg)"},
        {transform:"rotateY("+(-curl*.17)+"deg)",offset:.65},
        {transform:"rotateY(0deg)"}
      ],{duration:630+i*24,delay:i*9,fill:"both",easing:"cubic-bezier(.23,.57,.20,1)"}));
    }
    curledPrint=mount;
    left.append(mount);
    left.classList.add("turning-print");
    turns.at(-1).onfinish=settleBook;
  }
  function turnTo(index) {
    if(index===activeLeaf)return;
    settleBook();
    const forward=index>activeLeaf;
    activeLeaf=index;
    preparePlates();
    left.replaceChildren(plates[index]);
    right.replaceChildren(textAt(index));
    book.dataset.leaf=index;
    leaves.forEach((button,i)=>button.setAttribute("aria-pressed",String(i===index)));
    content.forEach((item,i)=>{item.hidden=i!==index;});
    bookTabs.style.setProperty("--index",String(index));
    if(simple() || !right.animate)return;
    const sign=forward?1:-1;
    for(const [i,part] of [...right.querySelectorAll("h3,p")].entries()) {
      turns.push(part.animate([
        {transform:"perspective(700px) translateX("+sign*(i?5:10)+"px) rotateY("+sign*(i?2:7)+"deg)"},
        {transform:"none"}
      ],{duration:640,delay:i*38,easing:"cubic-bezier(.18,.70,.18,1)",fill:"backwards"}));
    }
    turnPrint(index,forward);
  }
  pages.hidden = false;
  book.classList.add("is-bound");
  bookTabs.hidden = false;
  content.forEach((item,i) => {item.hidden = i !== 0;});
  leaves.forEach((button, i) => button.addEventListener("click", () => turnTo(i)));
  directionalKeys(bookTabs, leaves, turnTo);
  motion.addEventListener("change", settleBook);
  window.addEventListener("resize",settleBook,{passive:true});

  const conversation = document.querySelector(".conversation");
  const topics = [...conversation.querySelectorAll('[name="topic"]')];
  const topicSwitch = conversation.querySelector(".topic-switch");
  const note = conversation.querySelector("textarea");
  const draft = conversation.querySelector(".email-draft");
  const prompts = ["Ask us about your weekday meals…","Tell us what you’d like to work on together…","Tell us your idea for better living…"];
  function prepareEmail() {
    const index = topics.findIndex((topic) => topic.checked);
    if (index < 0) return;
    topicSwitch.style.setProperty("--index", String(index));
    note.placeholder = prompts[index];
    const subject = "Koshimbir — " + topics[index].value;
    const message = note.value.trim();
    draft.href = "mailto:hello@koshimbir.com?subject=" + encodeURIComponent(subject) +
      (message ? "&body=" + encodeURIComponent(message) : "");
  }
  topics.forEach((topic) => topic.addEventListener("change",prepareEmail));
  note.addEventListener("input",prepareEmail);
  window.addEventListener("pageshow",prepareEmail);
  prepareEmail();
  conversation.hidden = false;
  const contact=document.querySelector(".brand-contact");
  for (const surface of [contact, ...document.querySelectorAll(".fork-stage,.packing-page,.plan-counter,.field-notes,.weekday-stories")]) {
      const air=document.createElement("div");
      air.className="chapter-air";
      air.setAttribute("aria-hidden","true");
      const depth=Array.from({length:3},()=>{
        const plane=document.createElement("div");
        plane.className="air-layer";
        air.append(plane);
        return plane;
      });
      for(let i=0;i<18;i++){
        const mote=document.createElement("i");
        mote.style.left=(3+(i*37)%94)+"%";
        mote.style.top=(6+(i*17)%89)+"%";
        mote.style.setProperty("--size",(2+i%3)+"px");
        mote.style.setProperty("--sweep",(i%2?1:-1)*(12+i%5*5)+"px");
        mote.style.animationDuration=(10+i%7)+"s";
        mote.style.animationDelay=(-i*2.8)+"s";
        depth[i%3].append(mote);
      }
      surface.prepend(air);
    let visible=false;
    const update=()=>surface.classList.toggle("air-visible",visible && !simple() && !document.hidden);
    if ("IntersectionObserver" in window) new IntersectionObserver(([entry])=>{
      visible=entry.isIntersecting;
      update();
    }).observe(surface);
    document.addEventListener("visibilitychange",update);
    motion.addEventListener("change",update);
    surface.addEventListener("pointermove",event=>{
      if (!visible || simple() || event.pointerType!=="mouse") return;
      const rect=surface.getBoundingClientRect();
      surface.style.setProperty("--air-x",((event.clientX-rect.left)/rect.width*16-8)+"px");
      surface.style.setProperty("--air-y",((event.clientY-rect.top)/rect.height*10-5)+"px");
    },{passive:true});
    surface.addEventListener("pointerleave",()=>{
      surface.style.removeProperty("--air-x");
      surface.style.removeProperty("--air-y");
    });
  }
})();
