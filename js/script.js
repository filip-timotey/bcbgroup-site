document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".division-card");

  cards.forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -5;
      const rotateY = ((x - centerX) / centerX) * 5;

      card.style.transform =
        `translateY(-10px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "translateY(0) rotateX(0) rotateY(0)";
    });
  });

  const revealElements = document.querySelectorAll(".reveal");

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if(entry.isIntersecting){
        entry.target.classList.add("show");
      }
    });
  }, { threshold: 0.15 });

  revealElements.forEach((el) => revealObserver.observe(el));

  const counters = document.querySelectorAll("[data-count]");
  let countersStarted = false;

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if(entry.isIntersecting && !countersStarted){
        countersStarted = true;

        counters.forEach(counter => {
          const target = Number(counter.dataset.count);
          let current = 0;
          const step = Math.ceil(target / 60);

          const interval = setInterval(() => {
            current += step;

            if(current >= target){
              counter.textContent = target + (target === 100 ? "%" : "");
              clearInterval(interval);
            }else{
              counter.textContent = current;
            }
          }, 25);
        });
      }
    });
  }, { threshold: 0.4 });

  const counterSection = document.querySelector(".counter-section");
  if(counterSection){
    counterObserver.observe(counterSection);
  }
});