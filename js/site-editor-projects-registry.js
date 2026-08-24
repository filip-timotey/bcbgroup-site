import { SITE_EDITOR_FIELDS, SITE_EDITOR_PAGES } from "./site-editor-registry.js";

const page = { key:"projects", label:"Proiecte", url:"../proiecte.html" };
if (!SITE_EDITOR_PAGES.some(item => item.key === page.key)) SITE_EDITOR_PAGES.push(page);

const PROJECT_FIELDS = [
  { key:"projects.hero.eyebrow", page:"projects", group:"Hero", label:"Etichetă Hero", type:"textnode", selector:".projects26-eyebrow", node:0, defaultValue:"Proiecte BCB Group" },
  { key:"projects.hero.title", page:"projects", group:"Hero", label:"Titlu — început", type:"textnode", selector:".projects26-hero-copy h1", node:0, defaultValue:"Lucrări reale." },
  { key:"projects.hero.accent", page:"projects", group:"Hero", label:"Titlu — accent", type:"text", selector:".projects26-hero-copy h1 strong", defaultValue:"Progres real." },
  { key:"projects.hero.description", page:"projects", group:"Hero", label:"Descriere Hero", type:"text", selector:".projects26-hero-text", defaultValue:"Prezentăm transparent proiectele aflate în desfășurare și etapele prin care fiecare lucrare evoluează de la teren până la forma finală." },
  { key:"projects.hero.image", page:"projects", group:"Hero", label:"Imagine Hero proiect", type:"image", selector:".projects26-hero-photo img", defaultValue:"assets/images/proiecte/casa-1.jpg" },
  { key:"projects.hero.status", page:"projects", group:"Hero", label:"Status proiect Hero", type:"textnode", selector:".projects26-project-chip", node:0, defaultValue:"Proiect în desfășurare" },
  { key:"projects.hero.projectNo", page:"projects", group:"Hero", label:"Cod proiect", type:"text", selector:".projects26-project-title small", defaultValue:"PROIECT 01" },
  { key:"projects.hero.projectTitle", page:"projects", group:"Hero", label:"Nume proiect", type:"text", selector:".projects26-project-title strong", defaultValue:"Prima casă BCB Group" },
  { key:"projects.hero.primaryButton", page:"projects", group:"Hero", label:"Buton principal", type:"textnode", selector:".projects26-hero-actions .bcb26-primary-btn", node:0, defaultValue:"Vezi proiectul" },
  { key:"projects.hero.secondaryButton", page:"projects", group:"Hero", label:"Buton ofertă", type:"text", selector:".projects26-hero-actions .bcb26-secondary-btn", defaultValue:"Solicită ofertă" },

  { key:"projects.live.title", page:"projects", group:"Proiecte publicate din Business Manager", label:"Titlu secțiune Live", type:"text", selector:".bcb-live-projects-heading h2", defaultValue:"Proiecte publicate direct din teren." },
  { key:"projects.live.description", page:"projects", group:"Proiecte publicate din Business Manager", label:"Descriere secțiune Live", type:"text", selector:".bcb-live-projects-heading > p", defaultValue:"Fotografiile, videoclipurile și progresul sunt actualizate de echipa BCB și apar automat aici." },

  { key:"projects.featured.image", page:"projects", group:"Proiect principal", label:"Imagine proiect principal", type:"image", selector:".projects26-featured-frame img", defaultValue:"assets/images/proiecte/casa-1.jpg" },
  { key:"projects.featured.location", page:"projects", group:"Proiect principal", label:"Locație afișată", type:"textnode", selector:".projects26-featured-badge", node:0, defaultValue:"Bihor" },
  { key:"projects.featured.label", page:"projects", group:"Proiect principal", label:"Etichetă status", type:"text", selector:".projects26-featured-copy .projects26-label", defaultValue:"Proiect în desfășurare" },
  { key:"projects.featured.title", page:"projects", group:"Proiect principal", label:"Titlu — început", type:"textnode", selector:".projects26-featured-copy h2", node:0, defaultValue:"Prima casă" },
  { key:"projects.featured.accent", page:"projects", group:"Proiect principal", label:"Titlu — accent", type:"text", selector:".projects26-featured-copy h2 span", defaultValue:"BCB Group." },
  { key:"projects.featured.lead", page:"projects", group:"Proiect principal", label:"Descriere principală", type:"text", selector:".projects26-featured-lead", defaultValue:"Primul proiect prezentat sub brandul BCB Group urmărește parcursul unei case construite cu atenție la structură, organizare, detalii și execuție." },
  { key:"projects.featured.description", page:"projects", group:"Proiect principal", label:"Descriere secundară", type:"text", selector:".projects26-featured-copy > p:not(.projects26-label):not(.projects26-featured-lead)", defaultValue:"Vom documenta evoluția proiectului prin imagini reale și cadre aeriene, astfel încât fiecare etapă să poată fi urmărită clar." },
  { key:"projects.featured.status1.title", page:"projects", group:"Proiect principal — avantaje", label:"Status 1 — titlu", type:"text", selector:".projects26-status-list > div:nth-child(1) strong", defaultValue:"Construcție în desfășurare" },
  { key:"projects.featured.status1.desc", page:"projects", group:"Proiect principal — avantaje", label:"Status 1 — descriere", type:"textnode", selector:".projects26-status-list > div:nth-child(1) span", node:0, defaultValue:"Proiectul evoluează etapizat." },
  { key:"projects.featured.status2.title", page:"projects", group:"Proiect principal — avantaje", label:"Status 2 — titlu", type:"text", selector:".projects26-status-list > div:nth-child(2) strong", defaultValue:"Galerie foto" },
  { key:"projects.featured.status2.desc", page:"projects", group:"Proiect principal — avantaje", label:"Status 2 — descriere", type:"textnode", selector:".projects26-status-list > div:nth-child(2) span", node:0, defaultValue:"Imaginile vor fi actualizate pe parcurs." },
  { key:"projects.featured.status3.title", page:"projects", group:"Proiect principal — avantaje", label:"Status 3 — titlu", type:"text", selector:".projects26-status-list > div:nth-child(3) strong", defaultValue:"Filmări aeriene" },
  { key:"projects.featured.status3.desc", page:"projects", group:"Proiect principal — avantaje", label:"Status 3 — descriere", type:"textnode", selector:".projects26-status-list > div:nth-child(3) span", node:0, defaultValue:"Cadrele cu drona vor fi adăugate în curând." },

  { key:"projects.timeline.label", page:"projects", group:"Evoluția proiectului", label:"Etichetă secțiune", type:"text", selector:".projects26-timeline .projects26-section-heading .projects26-label", defaultValue:"Evoluția proiectului" },
  { key:"projects.timeline.title", page:"projects", group:"Evoluția proiectului", label:"Titlu — început", type:"textnode", selector:".projects26-timeline .projects26-section-heading h2", node:0, defaultValue:"De la teren" },
  { key:"projects.timeline.accent", page:"projects", group:"Evoluția proiectului", label:"Titlu — accent", type:"text", selector:".projects26-timeline .projects26-section-heading h2 span", defaultValue:"la construcția finală." },
  { key:"projects.timeline.description", page:"projects", group:"Evoluția proiectului", label:"Descriere", type:"text", selector:".projects26-timeline .projects26-section-heading > p", defaultValue:"Fiecare etapă va fi documentată pe măsură ce proiectul avansează." },
  { key:"projects.timeline.step1.title", page:"projects", group:"Etape proiect", label:"Etapa 1 — titlu", type:"text", selector:".projects26-timeline-step:nth-child(1) h3", defaultValue:"Pregătire teren" },
  { key:"projects.timeline.step1.desc", page:"projects", group:"Etape proiect", label:"Etapa 1 — descriere", type:"text", selector:".projects26-timeline-step:nth-child(1) p", defaultValue:"Trasare, organizare și pregătirea zonei de lucru." },
  { key:"projects.timeline.step2.title", page:"projects", group:"Etape proiect", label:"Etapa 2 — titlu", type:"text", selector:".projects26-timeline-step:nth-child(2) h3", defaultValue:"Structură" },
  { key:"projects.timeline.step2.desc", page:"projects", group:"Etape proiect", label:"Etapa 2 — descriere", type:"text", selector:".projects26-timeline-step:nth-child(2) p", defaultValue:"Fundații, beton, zidărie și elemente structurale." },
  { key:"projects.timeline.step3.title", page:"projects", group:"Etape proiect", label:"Etapa 3 — titlu", type:"text", selector:".projects26-timeline-step:nth-child(3) h3", defaultValue:"Instalații" },
  { key:"projects.timeline.step3.desc", page:"projects", group:"Etape proiect", label:"Etapa 3 — descriere", type:"text", selector:".projects26-timeline-step:nth-child(3) p", defaultValue:"Electric, sanitare și soluții tehnice integrate." },
  { key:"projects.timeline.step4.title", page:"projects", group:"Etape proiect", label:"Etapa 4 — titlu", type:"text", selector:".projects26-timeline-step:nth-child(4) h3", defaultValue:"Finisaje" },
  { key:"projects.timeline.step4.desc", page:"projects", group:"Etape proiect", label:"Etapa 4 — descriere", type:"text", selector:".projects26-timeline-step:nth-child(4) p", defaultValue:"Detalii interioare și exterioare până la finalizare." },

  { key:"projects.gallery.label", page:"projects", group:"Galerie", label:"Etichetă secțiune", type:"text", selector:".projects26-gallery .projects26-section-heading .projects26-label", defaultValue:"Galerie proiect" },
  { key:"projects.gallery.title", page:"projects", group:"Galerie", label:"Titlu — început", type:"textnode", selector:".projects26-gallery .projects26-section-heading h2", node:0, defaultValue:"Etapele lucrării," },
  { key:"projects.gallery.accent", page:"projects", group:"Galerie", label:"Titlu — accent", type:"text", selector:".projects26-gallery .projects26-section-heading h2 span", defaultValue:"surprinse în imagini." },
  { key:"projects.gallery.description", page:"projects", group:"Galerie", label:"Descriere", type:"text", selector:".projects26-gallery .projects26-section-heading > p", defaultValue:"Galeria se va completa pe măsură ce apar noi etape ale proiectului." },
  { key:"projects.gallery.mainImage", page:"projects", group:"Galerie", label:"Imagine principală galerie", type:"image", selector:".projects26-gallery-main img", defaultValue:"assets/images/proiecte/casa-1.jpg" },
  { key:"projects.gallery.caption", page:"projects", group:"Galerie", label:"Descriere imagine principală", type:"textnode", selector:".projects26-gallery-main figcaption", node:0, defaultValue:"Prima etapă documentată" },

  { key:"projects.drone.label", page:"projects", group:"Dronă / Video", label:"Etichetă secțiune", type:"text", selector:".projects26-drone-copy .projects26-label", defaultValue:"Filmări aeriene" },
  { key:"projects.drone.title", page:"projects", group:"Dronă / Video", label:"Titlu — început", type:"textnode", selector:".projects26-drone-copy h2", node:0, defaultValue:"Proiectele BCB Group" },
  { key:"projects.drone.accent", page:"projects", group:"Dronă / Video", label:"Titlu — accent", type:"text", selector:".projects26-drone-copy h2 span", defaultValue:"văzute de sus." },
  { key:"projects.drone.description", page:"projects", group:"Dronă / Video", label:"Descriere", type:"text", selector:".projects26-drone-copy > p:not(.projects26-label)", defaultValue:"Filmările cu drona vor oferi o imagine clară asupra șantierului, organizării lucrării și progresului proiectului." },
  { key:"projects.drone.status", page:"projects", group:"Dronă / Video", label:"Status video", type:"text", selector:".projects26-drone-box strong", defaultValue:"Disponibil în curând" },
  { key:"projects.drone.image", page:"projects", group:"Dronă / Video", label:"Imagine ecran dronă", type:"image", selector:".projects26-drone-screen img", defaultValue:"assets/images/proiecte/casa-1.jpg" },

  { key:"projects.values.label", page:"projects", group:"Cum lucrăm", label:"Etichetă secțiune", type:"text", selector:".projects26-values .projects26-section-heading .projects26-label", defaultValue:"Cum lucrăm" },
  { key:"projects.values.title", page:"projects", group:"Cum lucrăm", label:"Titlu — început", type:"textnode", selector:".projects26-values .projects26-section-heading h2", node:0, defaultValue:"Fiecare proiect este" },
  { key:"projects.values.accent", page:"projects", group:"Cum lucrăm", label:"Titlu — accent", type:"text", selector:".projects26-values .projects26-section-heading h2 span", defaultValue:"o responsabilitate." },
  { key:"projects.values.description", page:"projects", group:"Cum lucrăm", label:"Descriere secțiune", type:"text", selector:".projects26-values .projects26-section-heading > p", defaultValue:"Modul în care lucrăm este la fel de important ca rezultatul final." },
  { key:"projects.values.v1.title", page:"projects", group:"Cum lucrăm — valori", label:"Valoare 1 — titlu", type:"text", selector:".projects26-value:nth-child(1) h3", defaultValue:"Planificare" },
  { key:"projects.values.v1.desc", page:"projects", group:"Cum lucrăm — valori", label:"Valoare 1 — descriere", type:"text", selector:".projects26-value:nth-child(1) p", defaultValue:"Lucrările sunt organizate atent înainte de execuție." },
  { key:"projects.values.v2.title", page:"projects", group:"Cum lucrăm — valori", label:"Valoare 2 — titlu", type:"text", selector:".projects26-value:nth-child(2) h3", defaultValue:"Execuție" },
  { key:"projects.values.v2.desc", page:"projects", group:"Cum lucrăm — valori", label:"Valoare 2 — descriere", type:"text", selector:".projects26-value:nth-child(2) p", defaultValue:"Fiecare etapă este tratată cu seriozitate și responsabilitate." },
  { key:"projects.values.v3.title", page:"projects", group:"Cum lucrăm — valori", label:"Valoare 3 — titlu", type:"text", selector:".projects26-value:nth-child(3) h3", defaultValue:"Principii" },
  { key:"projects.values.v3.desc", page:"projects", group:"Cum lucrăm — valori", label:"Valoare 3 — descriere", type:"text", selector:".projects26-value:nth-child(3) p", defaultValue:"Lucrăm cu integritate, respect și dorința de a face lucrurile bine." },
  { key:"projects.values.v4.title", page:"projects", group:"Cum lucrăm — valori", label:"Valoare 4 — titlu", type:"text", selector:".projects26-value:nth-child(4) h3", defaultValue:"Calitate" },
  { key:"projects.values.v4.desc", page:"projects", group:"Cum lucrăm — valori", label:"Valoare 4 — descriere", type:"text", selector:".projects26-value:nth-child(4) p", defaultValue:"Ne dorim lucrări durabile, curate și bine executate." },

  { key:"projects.cta.label", page:"projects", group:"CTA final", label:"Etichetă", type:"text", selector:".projects26-cta-copy .projects26-label", defaultValue:"Ai un proiect?" },
  { key:"projects.cta.title", page:"projects", group:"CTA final", label:"Titlu — început", type:"textnode", selector:".projects26-cta-copy h2", node:0, defaultValue:"Hai să discutăm despre" },
  { key:"projects.cta.accent", page:"projects", group:"CTA final", label:"Titlu — accent", type:"text", selector:".projects26-cta-copy h2 span", defaultValue:"construcția ta." },
  { key:"projects.cta.description", page:"projects", group:"CTA final", label:"Descriere", type:"text", selector:".projects26-cta-copy > p:not(.projects26-label)", defaultValue:"Fie că este vorba despre o casă sau despre un proiect civil complet, putem discuta împreună următorii pași." },
  { key:"projects.cta.primaryButton", page:"projects", group:"CTA final", label:"Text buton ofertă", type:"textnode", selector:".projects26-cta-actions .bcb26-primary-btn", node:0, defaultValue:"Solicită ofertă" },
  { key:"projects.cta.phone", page:"projects", group:"CTA final", label:"Telefon afișat", type:"textnode", selector:".projects26-phone-btn", node:0, defaultValue:"0770 712 701" }
];

for (const field of PROJECT_FIELDS) {
  if (!SITE_EDITOR_FIELDS.some(item => item.key === field.key)) SITE_EDITOR_FIELDS.push(field);
}
