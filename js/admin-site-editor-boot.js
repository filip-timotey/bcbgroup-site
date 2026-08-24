try {
  await import("./site-editor-projects-registry.js");
  await import("./admin-site-editor.js");
} catch (error) {
  console.error("BCB Site Editor boot failed:", error);
  const root = document.querySelector("#site-editor-content");
  if (root) root.innerHTML = '<div class="bcb-admin-empty">Site Editor nu a putut porni. Reîncarcă pagina.</div>';
}
