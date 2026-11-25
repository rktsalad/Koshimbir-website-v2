(() => {
  const mast = document.querySelector(".mast");
  const menu = mast.querySelector(".compact-menu");
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      mast.classList.toggle("on-paper", !entry.isIntersecting && entry.boundingClientRect.top < 0);
    }, {rootMargin: "-80px 0px 0px 0px"}).observe(document.querySelector(".stage"));
  }
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href^='#']");
    if (link && link.hash !== "#top" && document.getElementById(link.hash.slice(1))) mast.classList.add("on-paper");
  });
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) menu.open = false;
  });
  document.addEventListener("pointerdown", (event) => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.open) {
      menu.open = false;
      menu.querySelector("summary").focus();
    }
  });

})();
