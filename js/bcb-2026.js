/* =========================================================
   BCB GROUP 2026
   INTERACTIONS / MOTION / MOBILE NAV
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  /* =======================================================
     ELEMENTS
  ======================================================= */

  const header = document.querySelector(".bcb26-header");
  const menuToggle = document.querySelector(".bcb26-menu-toggle");
  const mobileMenu = document.querySelector(".bcb26-mobile-menu");
  const mobileOverlay = document.querySelector(".bcb26-mobile-overlay");
  const mobileLinks = document.querySelectorAll(".bcb26-mobile-menu a");

  const floatingCards = document.querySelectorAll(".bcb26-floating-card");
  const divisionCards = document.querySelectorAll(".bcb26-division-card");

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;


  /* =======================================================
     HEADER SCROLL STATE
  ======================================================= */

  const updateHeader = () => {
    if (!header) return;

    if (window.scrollY > 40) {
      header.classList.add("is-scrolled");
    } else {
      header.classList.remove("is-scrolled");
    }
  };

  updateHeader();

  window.addEventListener(
    "scroll",
    updateHeader,
    { passive: true }
  );


  /* =======================================================
     MOBILE MENU
  ======================================================= */

  const openMobileMenu = () => {
    if (!menuToggle || !mobileMenu || !mobileOverlay) return;

    menuToggle.classList.add("is-open");
    mobileMenu.classList.add("is-open");
    mobileOverlay.classList.add("is-open");

    menuToggle.setAttribute("aria-expanded", "true");

    document.body.style.overflow = "hidden";
  };


  const closeMobileMenu = () => {
    if (!menuToggle || !mobileMenu || !mobileOverlay) return;

    menuToggle.classList.remove("is-open");
    mobileMenu.classList.remove("is-open");
    mobileOverlay.classList.remove("is-open");

    menuToggle.setAttribute("aria-expanded", "false");

    document.body.style.overflow = "";
  };


  if (menuToggle) {
    menuToggle.addEventListener("click", () => {

      const isOpen =
        menuToggle.classList.contains("is-open");

      if (isOpen) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }

    });
  }


  if (mobileOverlay) {
    mobileOverlay.addEventListener(
      "click",
      closeMobileMenu
    );
  }


  mobileLinks.forEach(link => {
    link.addEventListener(
      "click",
      closeMobileMenu
    );
  });


  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeMobileMenu();
    }
  });


  window.addEventListener("resize", () => {
    if (window.innerWidth > 850) {
      closeMobileMenu();
    }
  });


  /* =======================================================
     FLOATING HERO CARDS
  ======================================================= */

  if (!prefersReducedMotion) {

    const floatingSettings = [
      {
        x: 0,
        y: -7,
        duration: 4.8
      },
      {
        x: -4,
        y: 8,
        duration: 5.6
      },
      {
        x: 4,
        y: -8,
        duration: 5.2
      },
      {
        x: -3,
        y: 7,
        duration: 6
      }
    ];


    floatingCards.forEach((card, index) => {

      const settings =
        floatingSettings[index % floatingSettings.length];

      let direction = 1;

      const animateCard = () => {

        direction *= -1;

        card.animate(
          [
            {
              transform:
                "translate3d(0, 0, 0)"
            },
            {
              transform:
                `translate3d(${settings.x * direction}px, ${settings.y * direction}px, 0)`
            },
            {
              transform:
                "translate3d(0, 0, 0)"
            }
          ],
          {
            duration: settings.duration * 1000,
            iterations: 1,
            easing: "ease-in-out"
          }
        ).finished
          .then(animateCard)
          .catch(() => {});
      };

      setTimeout(
        animateCard,
        index * 260
      );

    });

  }


  /* =======================================================
     HERO MOUSE PARALLAX
  ======================================================= */

  const hero = document.querySelector(".bcb26-hero");
  const floatingArea = document.querySelector(".bcb26-floating-area");

  if (
    hero &&
    floatingArea &&
    !prefersReducedMotion &&
    window.matchMedia("(pointer:fine)").matches
  ) {

    hero.addEventListener("mousemove", event => {

      const rect = hero.getBoundingClientRect();

      const x =
        (event.clientX - rect.left) / rect.width - 0.5;

      const y =
        (event.clientY - rect.top) / rect.height - 0.5;

      floatingArea.style.transform =
        `translate3d(${x * 10}px, ${y * 8}px, 0)`;

    });


    hero.addEventListener("mouseleave", () => {

      floatingArea.style.transform =
        "translate3d(0,0,0)";

    });

  }


  /* =======================================================
     DIVISION CARD 3D TILT
  ======================================================= */

  if (
    !prefersReducedMotion &&
    window.matchMedia("(pointer:fine)").matches
  ) {

    divisionCards.forEach(card => {

      card.addEventListener("mousemove", event => {

        const rect = card.getBoundingClientRect();

        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateY =
          ((x - centerX) / centerX) * 4;

        const rotateX =
          ((centerY - y) / centerY) * 4;

        card.style.transform =
          `translateY(-10px) perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

      });


      card.addEventListener("mouseleave", () => {

        card.style.transform = "";

      });

    });

  }


  /* =======================================================
     REVEAL OBSERVER — BCB 2026
  ======================================================= */

  const revealElements = document.querySelectorAll(
    ".bcb26-intro .reveal, " +
    ".bcb26-divisions .reveal, " +
    ".bcb26-project .reveal, " +
    ".bcb26-process .reveal, " +
    ".bcb26-values .reveal, " +
    ".bcb26-final-cta .reveal"
  );


  if ("IntersectionObserver" in window) {

    const revealObserver = new IntersectionObserver(
      entries => {

        entries.forEach(entry => {

          if (entry.isIntersecting) {

            entry.target.classList.add("show");

            revealObserver.unobserve(
              entry.target
            );

          }

        });

      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -40px 0px"
      }
    );


    revealElements.forEach(element => {
      revealObserver.observe(element);
    });

  } else {

    revealElements.forEach(element => {
      element.classList.add("show");
    });

  }


  /* =======================================================
     ACTIVE NAV STATE
  ======================================================= */

  const currentPage =
    window.location.pathname.split("/").pop() || "index.html";

  document
    .querySelectorAll(".bcb26-nav a, .bcb26-mobile-menu nav a")
    .forEach(link => {

      const href =
        link.getAttribute("href");

      if (!href) return;

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
     SCROLL PROGRESS
  ======================================================= */

  const progress = document.createElement("div");

  progress.className =
    "bcb26-scroll-progress";

  document.body.appendChild(progress);


  const updateProgress = () => {

    const scrollTop =
      window.scrollY;

    const documentHeight =
      document.documentElement.scrollHeight -
      window.innerHeight;

    const percentage =
      documentHeight > 0
        ? (scrollTop / documentHeight) * 100
        : 0;

    progress.style.width =
      `${percentage}%`;

  };


  updateProgress();

  window.addEventListener(
    "scroll",
    updateProgress,
    { passive: true }
  );

});