(() => {
  const form = document.querySelector("#meal-form");
  if (!form) return;
  const panel = form.querySelector(".configuration-panel");
  const remember = form.querySelector("#remember");
  const saveKey = "koshimbir.meal-plan.v1";
  const savedFields = ["protein","slot","duration","food","juice","fruit"];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const candidates = [...form.querySelectorAll(".garden-plan")];
  const carriers = [...form.querySelectorAll(".carrier")];
  const tabs = form.querySelector(".plan-tabs");
  let lastPlan = "";

  function restoreSaved() {
    try {
      const raw = localStorage.getItem(saveKey);
      if (raw) {
        const stored = JSON.parse(raw);
        for (const name of savedFields) {
          const field = form.elements[name];
          const options = field instanceof RadioNodeList ? [...field] : [...field.options];
          if (options.some((option) => option.value === stored?.[name])) field.value = stored[name];
        }
        remember.checked = true;
      }
      remember.parentElement.hidden = false;
    } catch { /* The plan can still be configured in this visit. */ }
  }
  function renderPlan(animate=false) {
    const chosen = form.querySelector('[name="protein"]:checked');
    if (!chosen || chosen.value === lastPlan) return;
    lastPlan = chosen.value;
    const index = candidates.indexOf(chosen.closest(".garden-plan"));
    tabs.style.setProperty("--tab-index", String(index));
    carriers.forEach((carrier, i) => carrier.classList.toggle("is-selected", i === index));
    const displayName=candidates[index].querySelector(".plan-tab-name").textContent;
    form.querySelector("#chosen-name").textContent = displayName;
    form.querySelector("#selection-title").textContent = displayName;
    form.querySelector("#selection-copy").textContent = chosen.dataset.description;
    form.querySelector("#protein-note").textContent = chosen.dataset.note;
    candidates.forEach((candidate) => candidate.classList.toggle("is-selected", candidate.contains(chosen)));
    if (animate && !reduce.matches && typeof form.animate === "function") {
      const description = form.querySelector(".plan-service");
      description.getAnimations?.().forEach((animation) => animation.cancel());
      description.animate([{opacity:.38,transform:"translateY(6px)"},{opacity:1,transform:"none"}],
        {duration:350,easing:"cubic-bezier(.2,.7,.25,1)"});
    }
  }
  function syncForm(animate=false) {
    renderPlan(animate);
    const data = new FormData(form);
    const protein = data.get("protein"), slot = data.get("slot"), duration = data.get("duration");
    const name=lastPlan===protein ? form.querySelector("#selection-title").textContent : protein;
    const planName=name;
    form.querySelector("#summary").textContent = [planName,slot,duration].join(" · ");
    if (remember.checked) {
      try {
        localStorage.setItem(saveKey,JSON.stringify(Object.fromEntries(savedFields.map((field) => [field,data.get(field)]))));
      } catch { remember.checked=false; remember.parentElement.hidden=true; }
    }
    const extras = [];
    if (data.get("juice") !== "0") extras.push("juice ("+data.get("juice")+" daily)");
    if (data.get("fruit") !== "0") extras.push("fruit cuts ("+data.get("fruit")+" daily)");
    const message = [
      "Hello Koshimbir! I’d like to enquire about the "+planName+" for "+slot.toLowerCase()+", "+duration+", in Wagle Estate, Thane.",
      data.get("food") !== "No preference" ? "Food preference: "+data.get("food")+"." : "",
      extras.length ? "Add-ons: "+extras.join(" and ")+"." : "",
      "Please share pricing and availability."
    ].filter(Boolean).join(" ");
    form.querySelector("#enquire").href = "https://wa.me/917900144075?text="+encodeURIComponent(message);
  }
  candidates.forEach((candidate, index) => {
    const input = candidate.querySelector("input");
    const carrier = carriers[index];
    const focus = (on) => carrier.classList.toggle("is-focused", on);
    input.addEventListener("click", () => { panel.open = true; });
    input.addEventListener("focus", () => focus(true));
    input.addEventListener("blur", () => focus(false));
    candidate.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse") focus(true);
    });
    candidate.addEventListener("pointerleave", () => focus(false));
    carrier.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse") candidate.classList.add("is-pointed");
    });
    carrier.addEventListener("pointerleave", () => candidate.classList.remove("is-pointed"));
  });
  form.addEventListener("change", (event) => {
    if (event.target.name === "protein") panel.open = true;
    syncForm(event.target.name==="protein");
  });
  remember.addEventListener("change", () => {
    if (!remember.checked) { try { localStorage.removeItem(saveKey); } catch {} }
  });
  form.addEventListener("submit", (event) => {event.preventDefault();location.href=form.querySelector("#enquire").href;});
  restoreSaved();
  panel.open = remember.checked || location.hash==="#configure";
  panel.addEventListener("toggle",() => {
    if (!panel.open || reduce.matches || typeof panel.animate !== "function") return;
    const details=panel.querySelector(".plan-details");
    details.getAnimations?.().forEach((animation)=>animation.cancel());
    details.animate([{opacity:.5,transform:"translateY(-6px)"},{opacity:1,transform:"none"}],
      {duration:320,easing:"cubic-bezier(.22,.7,.22,1)"});
  });
  window.addEventListener("hashchange",()=>{if(location.hash==="#configure")panel.open=true;});
  window.addEventListener("pageshow",()=>syncForm());
  syncForm();
})();
