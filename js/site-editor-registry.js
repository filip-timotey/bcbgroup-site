export const SITE_EDITOR_PAGES = [
  { key: "home", label: "Acasă", url: "../index.html" },
  { key: "about", label: "Despre noi", url: "../despre.html" },
  { key: "services", label: "Servicii", url: "../servicii.html" },
  { key: "social", label: "Social Media", url: "../social-media.html" },
  { key: "contact", label: "Contact", url: "../contact.html" }
];

export const SITE_EDITOR_FIELDS = [
  { key:"home.hero.line1", page:"home", group:"Hero", label:"Titlu — linia 1", type:"textnode", selector:".bcb26-hero h1", node:0, defaultValue:"Construim" },
  { key:"home.hero.accent1", page:"home", group:"Hero", label:"Titlu — accent auriu", type:"text", selector:".bcb26-hero h1 span", defaultValue:"excelență." },
  { key:"home.hero.line2", page:"home", group:"Hero", label:"Titlu — linia 2", type:"textnode", selector:".bcb26-hero h1", node:1, defaultValue:"Dezvoltăm" },
  { key:"home.hero.accent2", page:"home", group:"Hero", label:"Titlu — accent final", type:"text", selector:".bcb26-hero h1 strong", defaultValue:"viitorul." },
  { key:"home.project.accent", page:"home", group:"Proiect prezentat", label:"Titlu proiect — accent", type:"text", selector:".bcb26-project-content h2 span", defaultValue:"BCB Group." },
  { key:"home.project.description", page:"home", group:"Proiect prezentat", label:"Descriere proiect", type:"text", selector:".bcb26-project-content > p", defaultValue:"Urmărim și documentăm evoluția proiectului pentru a arăta concret modul în care lucrăm, de la pregătirea terenului până la finalizarea construcției." },
  { key:"home.project.image", page:"home", group:"Imagini", label:"Imagine proiect prezentat", type:"image", selector:".bcb26-project-photo img", defaultValue:"assets/images/proiecte/casa-1.jpg" },
  { key:"home.hero.background", page:"home", group:"Imagini", label:"Fundal Hero", type:"background", selector:".bcb26-hero-bg", defaultValue:"assets/images/bg.site.home.png" },

  { key:"about.hero.line1", page:"about", group:"Hero", label:"Titlu principal", type:"textnode", selector:".about26-hero h1", node:0, defaultValue:"Construim mai mult decât" },
  { key:"about.hero.accent", page:"about", group:"Hero", label:"Titlu — accent", type:"text", selector:".about26-hero h1 strong", defaultValue:"clădiri." },
  { key:"about.hero.description", page:"about", group:"Hero", label:"Text introductiv", type:"text", selector:".about26-hero-text", defaultValue:"Construim un nume bazat pe responsabilitate, seriozitate și respect pentru oamenii care ne încredințează proiectele lor." },

  { key:"services.hero.line1", page:"services", group:"Hero", label:"Titlu principal", type:"textnode", selector:".services26-hero h1", node:0, defaultValue:"Patru divizii." },
  { key:"services.hero.accent", page:"services", group:"Hero", label:"Titlu — accent", type:"text", selector:".services26-hero h1 strong", defaultValue:"Un singur proiect." },
  { key:"services.hero.description", page:"services", group:"Hero", label:"Text introductiv", type:"text", selector:".services26-hero-text", defaultValue:"Construcții civile, instalații electrice, instalații sanitare și finisaje coordonate printr-o singură structură." },

  { key:"social.hero.line1", page:"social", group:"Hero", label:"Titlu principal", type:"textnode", selector:".social26-hero h1", node:0, defaultValue:"Nu spunem doar ce facem." },
  { key:"social.hero.accent", page:"social", group:"Hero", label:"Titlu — accent", type:"text", selector:".social26-hero h1 strong", defaultValue:"Arătăm cum facem." },
  { key:"social.hero.description", page:"social", group:"Hero", label:"Text introductiv", type:"text", selector:".social26-hero-text", defaultValue:"Urmărește activitatea BCB Group direct din teren: proiecte în desfășurare, etape de execuție, detalii tehnice, filmări și evoluția reală a lucrărilor." },

  { key:"contact.hero.line1", page:"contact", group:"Hero", label:"Titlu principal", type:"textnode", selector:".contact26-hero h1", node:0, defaultValue:"Hai să discutăm despre" },
  { key:"contact.hero.accent", page:"contact", group:"Hero", label:"Titlu — accent", type:"text", selector:".contact26-hero h1 strong", defaultValue:"proiectul tău." },
  { key:"contact.hero.description", page:"contact", group:"Hero", label:"Text introductiv", type:"text", selector:".contact26-hero-text", defaultValue:"Fie că vrei să construiești, să renovezi sau ai nevoie de una dintre diviziile BCB Group, începem cu o discuție clară despre lucrare." }
];
