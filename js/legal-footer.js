(() => {
  if (window.__bcbLegalFooterLoaded) return;
  window.__bcbLegalFooterLoaded = true;

  const isAdmin = window.location.pathname.includes('/admin/');
  const base = isAdmin ? '../' : '';

  function ensureStyles() {
    if (document.querySelector('link[data-bcb-legal-footer]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${base}css/legal-footer.css`;
    link.dataset.bcbLegalFooter = 'true';
    document.head.appendChild(link);
  }

  function mount() {
    if (document.querySelector('.bcb-global-legalbar')) return;
    ensureStyles();

    const footer = document.createElement('footer');
    footer.className = `bcb-global-legalbar${isAdmin ? ' is-admin' : ''}`;
    footer.setAttribute('aria-label', 'Informații juridice și dezvoltator');
    footer.innerHTML = `
      <div class="bcb-global-legalbar__inner">
        <div class="bcb-global-legalbar__legal">
          <span>© ${new Date().getFullYear()} BCB Group. Toate drepturile rezervate.</span>
          <nav aria-label="Linkuri juridice">
            <a href="${base}termeni-si-conditii.html">Termeni și condiții</a>
            <span aria-hidden="true">·</span>
            <a href="${base}politica-de-confidentialitate.html">Politica de confidențialitate</a>
          </nav>
        </div>
        <div class="bcb-global-legalbar__creator">
          <span>Site &amp; Business Manager</span>
          <strong>Creat și fondat de BCB Unified Systems — Bocoiu Filip</strong>
        </div>
      </div>`;

    document.body.appendChild(footer);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
