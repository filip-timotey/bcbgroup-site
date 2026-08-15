/* =========================================================
   BCB GROUP — GLOBAL SCRIPT
   Reveal + page modules
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  import("./site-content.js").catch(error => {
    console.error("BCB site content module error:", error);
  });

  import("./site-settings.js").catch(error => {
    console.error("BCB site settings module error:", error);
  });

  const revealElements = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("show");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      {
        threshold:0.12,
        rootMargin:"0px 0px -35px 0px"
      }
    );

    revealElements.forEach(element => revealObserver.observe(element));
  } else {
    revealElements.forEach(element => element.classList.add("show"));
  }

  if (document.getElementById("oferta")) {
    import("./contact-request.js").catch(error => {
      console.error("BCB contact module error:", error);
    });
  }

  if (document.querySelector(".projects26-page")) {
    import("./projects-public.js").catch(error => {
      console.error("BCB projects module error:", error);
    });
  }

  if (
    document.querySelector(".bcb26-hero") ||
    document.querySelector(".about26-hero") ||
    document.querySelector(".services26-hero") ||
    document.querySelector(".social26-hero")
  ) {
    import("./live-project-highlight.js").catch(error => {
      console.error("BCB LIVE project module error:", error);
    });
  }
});
