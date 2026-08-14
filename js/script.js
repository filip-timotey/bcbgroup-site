/* =========================================================
   BCB GROUP — GLOBAL SCRIPT
   Reveal + contact form
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  /* =======================================================
     GLOBAL REVEAL
  ======================================================= */

  const revealElements =
    document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window) {

    const revealObserver =
      new IntersectionObserver(
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
          threshold:0.12,
          rootMargin:"0px 0px -35px 0px"
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
     CONTACT FORM
  ======================================================= */

  const contactForm =
    document.getElementById("oferta");


  if (contactForm) {

    contactForm.addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        const formData =
          new FormData(contactForm);


        try {

          const response =
            await fetch(
              "https://formspree.io/f/xkolagbg",
              {
                method:"POST",
                body:formData,
                headers:{
                  Accept:"application/json"
                }
              }
            );


          if (response.ok) {

            window.location.href =
              "multumim.html";

          } else {

            alert(
              "A apărut o problemă. Te rugăm să încerci din nou sau să ne contactezi telefonic."
            );

          }

        } catch (error) {

          console.error(
            "BCB contact form error:",
            error
          );

          alert(
            "Eroare de conexiune. Te rugăm să încerci din nou."
          );

        }

      }
    );

  }

});