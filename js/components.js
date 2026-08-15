/* =========================================================
   BCB GROUP
   SHARED COMPONENTS
   HEADER + FOOTER
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

  import("./public-access-dock.js").catch(error => {
    console.error("BCB public access dock error:", error);
  });

  const currentPublicPage = window.location.pathname.split("/").pop() || "index.html";
  if (currentPublicPage === "index.html" || currentPublicPage === "") {
    import("./home-hero-media.js").catch(error => {
      console.error("BCB home hero media error:", error);
    });
  }

  async function loadComponent(selector, path) {
    const mount = document.querySelector(selector);
    if (!mount) return false;

    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Component load failed: ${path} (${response.status})`);
      mount.innerHTML = await response.text();
      return true;
    } catch (error) {
      console.error(`BCB component could not be loaded: ${path}`, error);
      return false;
    }
  }

  const headerLoaded = await loadComponent("#bcb-header", "components/header.html");
  await loadComponent("#bcb-footer", "components/footer.html");
  document.dispatchEvent(new CustomEvent("bcb:components-loaded"));
  if (!headerLoaded) return;

  const header = document.querySelector(".bcb26-header");
  const menuToggle = document.querySelector(".bcb26-menu-toggle");
  const mobileMenu = document.querySelector(".bcb26-mobile-menu");
  const mobileOverlay = document.querySelector(".bcb26-mobile-overlay");
  const mobileLinks = document.querySelectorAll(".bcb26-mobile-menu a");
  const currentPage = window.location.pathname.split("/").pop() || "index.html";

  document.querySelectorAll(".bcb26-nav a, .bcb26-mobile-menu nav a").forEach(link => {
    const href = link.getAttribute("href");
    if (!href) return;
    const linkPage = href.split("#")[0];
    if (linkPage === currentPage || (currentPage === "" && linkPage === "index.html")) link.classList.add("active");
    else link.classList.remove("active");
  });

  function openMenu() {
    if (!menuToggle || !mobileMenu || !mobileOverlay) return;
    menuToggle.classList.add("is-open");
    mobileMenu.classList.add("is-open");
    mobileOverlay.classList.add("is-open");
    menuToggle.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }

  function closeMenu() {
    if (!menuToggle || !mobileMenu || !mobileOverlay) return;
    menuToggle.classList.remove("is-open");
    mobileMenu.classList.remove("is-open");
    mobileOverlay.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  menuToggle?.addEventListener("click", () => menuToggle.classList.contains("is-open") ? closeMenu() : openMenu());
  mobileOverlay?.addEventListener("click", closeMenu);
  mobileLinks.forEach(link => link.addEventListener("click", closeMenu));
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeMenu(); });
  window.addEventListener("resize", () => { if (window.innerWidth > 850) closeMenu(); });

  if (!header) return;
  let lastScrollY = window.scrollY;
  let ticking = false;

  function updateHeader() {
    const scrollY = window.scrollY;
    const scrollingDown = scrollY > lastScrollY;
    if (scrollY <= 30) {
      header.classList.remove("is-scrolled", "is-fading", "is-hidden", "is-visible-up");
      header.style.opacity = "1";
      header.style.transform = "translateX(-50%) translateY(0)";
    } else if (scrollY <= 220) {
      header.classList.add("is-scrolled", "is-fading");
      header.classList.remove("is-hidden", "is-visible-up");
      const progress = Math.min(1, (scrollY - 30) / 190);
      header.style.opacity = (1 - progress * .70).toFixed(2);
      header.style.transform = `translateX(-50%) translateY(${progress * -9}px)`;
    } else {
      header.classList.add("is-scrolled");
      if (scrollingDown) {
        header.classList.add("is-hidden");
        header.classList.remove("is-visible-up");
        header.style.opacity = "0";
        header.style.transform = "translateX(-50%) translateY(-120%)";
        header.style.pointerEvents = "none";
      } else {
        header.classList.remove("is-hidden");
        header.classList.add("is-visible-up");
        header.style.opacity = "0.96";
        header.style.transform = "translateX(-50%) translateY(0)";
        header.style.pointerEvents = "auto";
      }
    }
    if (scrollY <= 220) header.style.pointerEvents = "auto";
    lastScrollY = Math.max(scrollY, 0);
    ticking = false;
  }

  window.addEventListener("scroll", () => {
    if (!ticking) {
      window.requestAnimationFrame(updateHeader);
      ticking = true;
    }
  }, { passive:true });
  updateHeader();
});
