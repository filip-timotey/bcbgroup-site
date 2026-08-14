/* =========================================================
   BCB GROUP
   SHARED COMPONENTS
   HEADER + FOOTER
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

  /* =======================================================
     COMPONENT LOADER
  ======================================================= */

  async function loadComponent(selector, path) {

    const mount = document.querySelector(selector);

    if (!mount) {
      return false;
    }

    try {

      const response = await fetch(path);

      if (!response.ok) {
        throw new Error(
          `Component load failed: ${path} (${response.status})`
        );
      }

      const html = await response.text();

      mount.innerHTML = html;

      return true;

    } catch (error) {

      console.error(
        `BCB component could not be loaded: ${path}`,
        error
      );

      return false;

    }

  }


  /* =======================================================
     LOAD HEADER
  ======================================================= */

  const headerLoaded = await loadComponent(
    "#bcb-header",
    "components/header.html"
  );


  /* =======================================================
     LOAD FOOTER
  ======================================================= */

  await loadComponent(
    "#bcb-footer",
    "components/footer.html"
  );


  /* =======================================================
     HEADER INIT
  ======================================================= */

  if (!headerLoaded) {
    return;
  }


  const header =
    document.querySelector(".bcb26-header");

  const menuToggle =
    document.querySelector(".bcb26-menu-toggle");

  const mobileMenu =
    document.querySelector(".bcb26-mobile-menu");

  const mobileOverlay =
    document.querySelector(".bcb26-mobile-overlay");

  const mobileLinks =
    document.querySelectorAll(".bcb26-mobile-menu a");


  /* =======================================================
     ACTIVE PAGE
  ======================================================= */

  const currentPage =
    window.location.pathname
      .split("/")
      .pop() || "index.html";


  document
    .querySelectorAll(
      ".bcb26-nav a, .bcb26-mobile-menu nav a"
    )
    .forEach(link => {

      const href =
        link.getAttribute("href");

      if (!href) {
        return;
      }

      const linkPage =
        href.split("#")[0];


      if (
        linkPage === currentPage ||
        (
          currentPage === "" &&
          linkPage === "index.html"
        )
      ) {

        link.classList.add("active");

      } else {

        link.classList.remove("active");

      }

    });


  /* =======================================================
     MOBILE MENU
  ======================================================= */

  function openMenu() {

    if (
      !menuToggle ||
      !mobileMenu ||
      !mobileOverlay
    ) {
      return;
    }


    menuToggle.classList.add("is-open");

    mobileMenu.classList.add("is-open");

    mobileOverlay.classList.add("is-open");


    menuToggle.setAttribute(
      "aria-expanded",
      "true"
    );


    document.body.style.overflow =
      "hidden";

  }


  function closeMenu() {

    if (
      !menuToggle ||
      !mobileMenu ||
      !mobileOverlay
    ) {
      return;
    }


    menuToggle.classList.remove("is-open");

    mobileMenu.classList.remove("is-open");

    mobileOverlay.classList.remove("is-open");


    menuToggle.setAttribute(
      "aria-expanded",
      "false"
    );


    document.body.style.overflow =
      "";

  }


  if (menuToggle) {

    menuToggle.addEventListener(
      "click",
      () => {

        const isOpen =
          menuToggle.classList.contains(
            "is-open"
          );


        if (isOpen) {

          closeMenu();

        } else {

          openMenu();

        }

      }
    );

  }


  if (mobileOverlay) {

    mobileOverlay.addEventListener(
      "click",
      closeMenu
    );

  }


  mobileLinks.forEach(link => {

    link.addEventListener(
      "click",
      closeMenu
    );

  });


  document.addEventListener(
    "keydown",
    event => {

      if (event.key === "Escape") {

        closeMenu();

      }

    }
  );


  window.addEventListener(
    "resize",
    () => {

      if (window.innerWidth > 850) {

        closeMenu();

      }

    }
  );


  /* =======================================================
     PREMIUM HEADER SCROLL
  ======================================================= */

  if (!header) {
    return;
  }


  let lastScrollY =
    window.scrollY;

  let ticking =
    false;


  function updateHeader() {

    const scrollY =
      window.scrollY;

    const scrollingDown =
      scrollY > lastScrollY;


    /* ---------------------------------------
       TOP
    --------------------------------------- */

    if (scrollY <= 30) {

      header.classList.remove(
        "is-scrolled",
        "is-fading",
        "is-hidden",
        "is-visible-up"
      );

      header.style.opacity = "1";

      header.style.transform =
        "translateX(-50%) translateY(0)";

    }


    /* ---------------------------------------
       BEGIN FADE
    --------------------------------------- */

    else if (scrollY > 30 && scrollY <= 220) {

      header.classList.add(
        "is-scrolled",
        "is-fading"
      );

      header.classList.remove(
        "is-hidden",
        "is-visible-up"
      );


      /*
         30px  = opacity 1
         220px = opacity aproximativ 0.30
      */

      const progress =
        Math.min(
          1,
          (scrollY - 30) / 190
        );


      const opacity =
        1 - (progress * 0.70);


      const moveY =
        progress * -9;


      header.style.opacity =
        opacity.toFixed(2);


      header.style.transform =
        `translateX(-50%) translateY(${moveY}px)`;

    }


    /* ---------------------------------------
       LOWER PAGE
    --------------------------------------- */

    else {

      header.classList.add(
        "is-scrolled"
      );


      /* DOWN = HIDE */

      if (scrollingDown) {

        header.classList.add(
          "is-hidden"
        );

        header.classList.remove(
          "is-visible-up"
        );


        header.style.opacity =
          "0";


        header.style.transform =
          "translateX(-50%) translateY(-120%)";


        header.style.pointerEvents =
          "none";

      }


      /* UP = SHOW AGAIN */

      else {

        header.classList.remove(
          "is-hidden"
        );

        header.classList.add(
          "is-visible-up"
        );


        header.style.opacity =
          "0.96";


        header.style.transform =
          "translateX(-50%) translateY(0)";


        header.style.pointerEvents =
          "auto";

      }

    }


    if (scrollY <= 220) {

      header.style.pointerEvents =
        "auto";

    }


    lastScrollY =
      Math.max(scrollY, 0);


    ticking =
      false;

  }


  window.addEventListener(
    "scroll",
    () => {

      if (!ticking) {

        window.requestAnimationFrame(
          updateHeader
        );

        ticking =
          true;

      }

    },
    {
      passive:true
    }
  );


  updateHeader();

});