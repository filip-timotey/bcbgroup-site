/* =========================================================
   BCB GROUP 2026
   VISUAL INTERACTIONS / MOTION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  const prefersReducedMotion =
    window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;


  /* =======================================================
     FLOATING HERO CARDS
  ======================================================= */

  const floatingCards =
    document.querySelectorAll(
      ".bcb26-floating-card"
    );


  if (
    floatingCards.length &&
    !prefersReducedMotion
  ) {

    const floatingSettings = [
      {
        x:0,
        y:-7,
        duration:4.8
      },
      {
        x:-4,
        y:8,
        duration:5.6
      },
      {
        x:4,
        y:-8,
        duration:5.2
      },
      {
        x:-3,
        y:7,
        duration:6
      }
    ];


    floatingCards.forEach(
      (card, index) => {

        const settings =
          floatingSettings[
            index %
            floatingSettings.length
          ];


        let direction = 1;


        const animateCard = () => {

          direction *= -1;


          const animation =
            card.animate(
              [
                {
                  transform:
                    "translate3d(0,0,0)"
                },
                {
                  transform:
                    `translate3d(
                      ${settings.x * direction}px,
                      ${settings.y * direction}px,
                      0
                    )`
                },
                {
                  transform:
                    "translate3d(0,0,0)"
                }
              ],
              {
                duration:
                  settings.duration * 1000,

                iterations:1,

                easing:
                  "ease-in-out"
              }
            );


          animation.finished
            .then(() => {

              if (
                document.body.contains(card)
              ) {
                animateCard();
              }

            })
            .catch(() => {});

        };


        setTimeout(
          animateCard,
          index * 260
        );

      }
    );

  }


  /* =======================================================
     HERO MOUSE PARALLAX
  ======================================================= */

  const hero =
    document.querySelector(
      ".bcb26-hero"
    );

  const floatingArea =
    document.querySelector(
      ".bcb26-floating-area"
    );


  if (
    hero &&
    floatingArea &&
    !prefersReducedMotion &&
    window.matchMedia(
      "(pointer:fine)"
    ).matches
  ) {

    hero.addEventListener(
      "mousemove",
      event => {

        const rect =
          hero.getBoundingClientRect();


        const x =
          (
            event.clientX -
            rect.left
          ) /
          rect.width -
          0.5;


        const y =
          (
            event.clientY -
            rect.top
          ) /
          rect.height -
          0.5;


        floatingArea.style.transform =
          `translate3d(
            ${x * 10}px,
            ${y * 8}px,
            0
          )`;

      }
    );


    hero.addEventListener(
      "mouseleave",
      () => {

        floatingArea.style.transform =
          "translate3d(0,0,0)";

      }
    );

  }


  /* =======================================================
     DIVISION CARD 3D TILT
  ======================================================= */

  const divisionCards =
    document.querySelectorAll(
      ".bcb26-division-card"
    );


  if (
    divisionCards.length &&
    !prefersReducedMotion &&
    window.matchMedia(
      "(pointer:fine)"
    ).matches
  ) {

    divisionCards.forEach(card => {

      card.addEventListener(
        "mousemove",
        event => {

          const rect =
            card.getBoundingClientRect();


          const x =
            event.clientX -
            rect.left;


          const y =
            event.clientY -
            rect.top;


          const centerX =
            rect.width / 2;


          const centerY =
            rect.height / 2;


          const rotateY =
            (
              (x - centerX) /
              centerX
            ) * 4;


          const rotateX =
            (
              (centerY - y) /
              centerY
            ) * 4;


          card.style.transform =
            `translateY(-10px)
             perspective(900px)
             rotateX(${rotateX}deg)
             rotateY(${rotateY}deg)`;

        }
      );


      card.addEventListener(
        "mouseleave",
        () => {

          card.style.transform = "";

        }
      );

    });

  }


  /* =======================================================
     SCROLL PROGRESS
  ======================================================= */

  let progress =
    document.querySelector(
      ".bcb26-scroll-progress"
    );


  if (!progress) {

    progress =
      document.createElement("div");


    progress.className =
      "bcb26-scroll-progress";


    document.body.appendChild(
      progress
    );

  }


  let progressTicking = false;


  const updateProgress = () => {

    const scrollTop =
      window.scrollY;


    const documentHeight =
      document.documentElement
        .scrollHeight -
      window.innerHeight;


    const percentage =
      documentHeight > 0
        ? Math.min(
            100,
            Math.max(
              0,
              (
                scrollTop /
                documentHeight
              ) * 100
            )
          )
        : 0;


    progress.style.width =
      `${percentage}%`;


    progressTicking = false;

  };


  window.addEventListener(
    "scroll",
    () => {

      if (!progressTicking) {

        window.requestAnimationFrame(
          updateProgress
        );


        progressTicking = true;

      }

    },
    {
      passive:true
    }
  );


  updateProgress();

});