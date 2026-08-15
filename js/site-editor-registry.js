export const SITE_EDITOR_PAGES = [
  { key: "home", label: "Acasă", url: "../index.html" },
  { key: "about", label: "Despre noi", url: "../despre.html" },
  { key: "services", label: "Servicii", url: "../servicii.html" },
  { key: "social", label: "Social Media", url: "../social-media.html" },
  { key: "contact", label: "Contact", url: "../contact.html" }
];

export const SITE_EDITOR_FIELDS = [
  /* ACASĂ — HERO */
  { key:"home.hero.line1", page:"home", group:"Hero", label:"Titlu — linia 1", type:"textnode", selector:".bcb26-hero h1", node:0, defaultValue:"Construim" },
  { key:"home.hero.accent1", page:"home", group:"Hero", label:"Titlu — accent auriu", type:"text", selector:".bcb26-hero h1 span", defaultValue:"excelență." },
  { key:"home.hero.line2", page:"home", group:"Hero", label:"Titlu — linia 2", type:"textnode", selector:".bcb26-hero h1", node:1, defaultValue:"Dezvoltăm" },
  { key:"home.hero.accent2", page:"home", group:"Hero", label:"Titlu — accent final", type:"text", selector:".bcb26-hero h1 strong", defaultValue:"viitorul." },
  { key:"home.hero.description", page:"home", group:"Hero", label:"Descriere principală", type:"text", selector:".bcb26-hero-description", defaultValue:"Construcții civile, instalații electrice, instalații sanitare și finisaje coordonate printr-o singură structură. Mai puțină fragmentare. Mai multă responsabilitate." },
  { key:"home.hero.background", page:"home", group:"Hero", label:"Fundal Hero", type:"background", selector:".bcb26-hero-bg", defaultValue:"assets/images/bg.site.home.png" },

  /* ACASĂ — INTRO */
  { key:"home.intro.title1", page:"home", group:"Introducere BCB Group", label:"Titlu — început", type:"textnode", selector:".bcb26-intro-left h2", node:0, defaultValue:"Un singur grup." },
  { key:"home.intro.accent", page:"home", group:"Introducere BCB Group", label:"Titlu — accent", type:"text", selector:".bcb26-intro-left h2 span", defaultValue:"Patru specializări." },
  { key:"home.intro.title2", page:"home", group:"Introducere BCB Group", label:"Titlu — final", type:"textnode", selector:".bcb26-intro-left h2", node:1, defaultValue:"Un singur standard." },
  { key:"home.intro.p1", page:"home", group:"Introducere BCB Group", label:"Paragraf 1", type:"text", selector:".bcb26-intro-right p:nth-of-type(1)", defaultValue:"BCB Group reunește serviciile principale necesare construcției și finalizării unui proiect într-o structură comună și coerentă." },
  { key:"home.intro.p2", page:"home", group:"Introducere BCB Group", label:"Paragraf 2", type:"text", selector:".bcb26-intro-right p:nth-of-type(2)", defaultValue:"De la lucrările de construcție până la instalații și detaliile finale, obiectivul nostru este ca fiecare etapă să fie bine organizată și tratată cu responsabilitate." },

  /* ACASĂ — DIVIZII */
  { key:"home.divisions.heading", page:"home", group:"Divizii", label:"Titlu secțiune", type:"textnode", selector:".bcb26-divisions .bcb26-section-heading h2", node:0, defaultValue:"Expertiză integrată pentru" },
  { key:"home.divisions.accent", page:"home", group:"Divizii", label:"Titlu — accent", type:"text", selector:".bcb26-divisions .bcb26-section-heading h2 span", defaultValue:"fiecare etapă." },
  { key:"home.divisions.description", page:"home", group:"Divizii", label:"Descriere secțiune", type:"text", selector:".bcb26-divisions .bcb26-section-heading > p", defaultValue:"Fiecare divizie are propria specializare, dar toate lucrează sub aceeași direcție: un proiect bine executat." },
  { key:"home.divisions.construct.desc", page:"home", group:"Divizii — carduri", label:"Construct — descriere", type:"text", selector:".bcb26-division-construct .bcb26-division-content p", defaultValue:"Construcții civile, case, structuri și proiecte complete." },
  { key:"home.divisions.electric.desc", page:"home", group:"Divizii — carduri", label:"Electric — descriere", type:"text", selector:".bcb26-division-electric .bcb26-division-content p", defaultValue:"Instalații electrice, tablouri, iluminat și soluții pentru clădiri." },
  { key:"home.divisions.sanitary.desc", page:"home", group:"Divizii — carduri", label:"Sanitare — descriere", type:"text", selector:".bcb26-division-sanitary .bcb26-division-content p", defaultValue:"Instalații sanitare, apă, canalizare și sisteme termice." },
  { key:"home.divisions.finish.desc", page:"home", group:"Divizii — carduri", label:"Finisaje — descriere", type:"text", selector:".bcb26-division-finish .bcb26-division-content p", defaultValue:"Glet, zugrăveli, gresie, faianță și detalii finale." },

  /* ACASĂ — PROIECT */
  { key:"home.project.title", page:"home", group:"Proiect prezentat", label:"Titlu proiect — început", type:"textnode", selector:".bcb26-project-content h2", node:0, defaultValue:"Prima casă" },
  { key:"home.project.accent", page:"home", group:"Proiect prezentat", label:"Titlu proiect — accent", type:"text", selector:".bcb26-project-content h2 span", defaultValue:"BCB Group." },
  { key:"home.project.description", page:"home", group:"Proiect prezentat", label:"Descriere proiect", type:"text", selector:".bcb26-project-content > p:not(.bcb26-label)", defaultValue:"Urmărim și documentăm evoluția proiectului pentru a arăta concret modul în care lucrăm, de la pregătirea terenului până la finalizarea construcției." },
  { key:"home.project.image", page:"home", group:"Proiect prezentat", label:"Imagine proiect prezentat", type:"image", selector:".bcb26-project-photo img", defaultValue:"assets/images/proiecte/casa-1.jpg" },

  /* ACASĂ — PROCES */
  { key:"home.process.title", page:"home", group:"Proces", label:"Titlu — început", type:"textnode", selector:".bcb26-process .bcb26-section-heading h2", node:0, defaultValue:"De la idee" },
  { key:"home.process.accent", page:"home", group:"Proces", label:"Titlu — accent", type:"text", selector:".bcb26-process .bcb26-section-heading h2 span", defaultValue:"la rezultat." },
  { key:"home.process.description", page:"home", group:"Proces", label:"Descriere proces", type:"text", selector:".bcb26-process .bcb26-section-heading > p", defaultValue:"Un proces clar înseamnă mai puține surprize, comunicare mai bună și un proiect mai bine organizat." },
  { key:"home.process.step1", page:"home", group:"Proces", label:"Discuție — descriere", type:"text", selector:".bcb26-process-step:nth-child(1) p", defaultValue:"Înțelegem proiectul, obiectivele și nevoile clientului." },
  { key:"home.process.step2", page:"home", group:"Proces", label:"Analiză — descriere", type:"text", selector:".bcb26-process-step:nth-child(2) p", defaultValue:"Evaluăm lucrarea și stabilim soluțiile potrivite." },
  { key:"home.process.step3", page:"home", group:"Proces", label:"Execuție — descriere", type:"text", selector:".bcb26-process-step:nth-child(3) p", defaultValue:"Organizăm și executăm fiecare etapă cu responsabilitate." },
  { key:"home.process.step4", page:"home", group:"Proces", label:"Finalizare — descriere", type:"text", selector:".bcb26-process-step:nth-child(4) p", defaultValue:"Urmărim proiectul până la ultimele detalii și predare." },

  /* ACASĂ — VALORI / MANIFEST / CTA */
  { key:"home.values.title", page:"home", group:"Valori & familie", label:"Titlu — început", type:"textnode", selector:".bcb26-values-left h2", node:0, defaultValue:"Construim proiecte." },
  { key:"home.values.accent", page:"home", group:"Valori & familie", label:"Titlu — accent", type:"text", selector:".bcb26-values-left h2 span", defaultValue:"Construim și un nume." },
  { key:"home.values.description", page:"home", group:"Valori & familie", label:"Descriere", type:"text", selector:".bcb26-values-left > p:not(.bcb26-label)", defaultValue:"BCB Group este dezvoltat ca o afacere de familie, cu o viziune pe termen lung și cu responsabilitatea de a face lucrurile cât mai bine." },
  { key:"home.manifest.main", page:"home", group:"Manifest", label:"Manifest — început", type:"textnode", selector:".bcb26-manifest blockquote", node:0, defaultValue:"„Nu ne-am propus să fim cei mai mari." },
  { key:"home.manifest.accent", page:"home", group:"Manifest", label:"Manifest — accent", type:"text", selector:".bcb26-manifest blockquote strong", defaultValue:"Vrem să fim cei mai buni." },
  { key:"home.cta.title", page:"home", group:"CTA final", label:"Titlu — început", type:"textnode", selector:".bcb26-final-copy h2", node:0, defaultValue:"Ai ceva în plan?" },
  { key:"home.cta.accent", page:"home", group:"CTA final", label:"Titlu — accent", type:"text", selector:".bcb26-final-copy h2 span", defaultValue:"Hai să discutăm." },
  { key:"home.cta.description", page:"home", group:"CTA final", label:"Descriere", type:"text", selector:".bcb26-final-copy > p:not(.bcb26-label)", defaultValue:"Spune-ne ce vrei să construiești și analizăm împreună următorii pași." },

  /* DESPRE — HERO */
  { key:"about.hero.line1", page:"about", group:"Hero", label:"Titlu principal", type:"textnode", selector:".about26-hero h1", node:0, defaultValue:"Construim mai mult decât" },
  { key:"about.hero.accent", page:"about", group:"Hero", label:"Titlu — accent", type:"text", selector:".about26-hero h1 strong", defaultValue:"clădiri." },
  { key:"about.hero.description", page:"about", group:"Hero", label:"Text introductiv", type:"text", selector:".about26-hero-text", defaultValue:"Construim un nume bazat pe responsabilitate, seriozitate și respect pentru oamenii care ne încredințează proiectele lor." },

  /* DESPRE — POVESTEA */
  { key:"about.story.title", page:"about", group:"Povestea BCB", label:"Titlu — început", type:"textnode", selector:".about26-story-heading h2", node:0, defaultValue:"Bocoiu" },
  { key:"about.story.accent", page:"about", group:"Povestea BCB", label:"Titlu — accent", type:"text", selector:".about26-story-heading h2 span", defaultValue:"Construction Brothers" },
  { key:"about.story.lead", page:"about", group:"Povestea BCB", label:"Introducere", type:"text", selector:".about26-story-lead", defaultValue:"BCB Group este rezultatul unei viziuni comune: construirea unei companii serioase, bine organizate și dezvoltate pentru termen lung." },
  { key:"about.story.p1", page:"about", group:"Povestea BCB", label:"Poveste — paragraf 1", type:"text", selector:".about26-story-columns p:nth-child(1)", defaultValue:"Provenim dintr-o familie unită, unde am învățat că lucrurile durabile se construiesc cu răbdare, muncă, implicare și atenție la detalii. Aceleași principii vrem să le aplicăm astăzi în fiecare proiect BCB Group." },
  { key:"about.story.p2", page:"about", group:"Povestea BCB", label:"Poveste — paragraf 2", type:"text", selector:".about26-story-columns p:nth-child(2)", defaultValue:"Pentru noi, fiecare lucrare reprezintă mai mult decât un contract. Este o responsabilitate față de client și o nouă piesă din reputația pe care vrem să o construim prin fapte și rezultate." },

  /* DESPRE — PRINCIPII */
  { key:"about.foundation.title", page:"about", group:"Principii", label:"Titlu — început", type:"textnode", selector:".about26-foundation-heading h2", node:0, defaultValue:"Lucrurile solide încep cu" },
  { key:"about.foundation.accent", page:"about", group:"Principii", label:"Titlu — accent", type:"text", selector:".about26-foundation-heading h2 span", defaultValue:"principii solide." },
  { key:"about.principle1.desc", page:"about", group:"Principii", label:"Încredere — descriere", type:"text", selector:".about26-principle:nth-child(1) p", defaultValue:"Construim relații corecte, bazate pe transparență, comunicare și respect." },
  { key:"about.principle2.desc", page:"about", group:"Principii", label:"Calitate — descriere", type:"text", selector:".about26-principle:nth-child(2) p", defaultValue:"Ne dorim lucrări executate atent și soluții care rezistă în timp." },
  { key:"about.principle3.desc", page:"about", group:"Principii", label:"Responsabilitate — descriere", type:"text", selector:".about26-principle:nth-child(3) p", defaultValue:"Fiecare etapă este tratată ca o responsabilitate asumată față de client." },
  { key:"about.principle4.desc", page:"about", group:"Principii", label:"Credință — descriere", type:"text", selector:".about26-principle:nth-child(4) p", defaultValue:"Credem în integritate, principii curate și în lucrul făcut din toată inima." },

  /* DESPRE — FAMILIE / VIZIUNE / CTA */
  { key:"about.family.title", page:"about", group:"Familie", label:"Titlu — început", type:"textnode", selector:".about26-family-copy h2", node:0, defaultValue:"Construim pentru" },
  { key:"about.family.accent", page:"about", group:"Familie", label:"Titlu — accent", type:"text", selector:".about26-family-copy h2 span", defaultValue:"generațiile care urmează." },
  { key:"about.family.p1", page:"about", group:"Familie", label:"Paragraf 1", type:"text", selector:".about26-family-copy > p:not(.about26-label):nth-of-type(2)", defaultValue:"BCB Group nu este gândit ca un proiect pe termen scurt. Vrem să construim o companie stabilă, cunoscută pentru seriozitate și pentru modul în care tratează fiecare lucrare." },
  { key:"about.vision.title", page:"about", group:"Viziune", label:"Titlu — început", type:"textnode", selector:".about26-vision-heading h2", node:0, defaultValue:"Patru divizii." },
  { key:"about.vision.accent", page:"about", group:"Viziune", label:"Titlu — accent", type:"text", selector:".about26-vision-heading h2 span", defaultValue:"O singură direcție." },
  { key:"about.cta.title", page:"about", group:"CTA final", label:"Titlu — început", type:"textnode", selector:".about26-cta-copy h2", node:0, defaultValue:"Următorul proiect poate începe cu" },
  { key:"about.cta.accent", page:"about", group:"CTA final", label:"Titlu — accent", type:"text", selector:".about26-cta-copy h2 span", defaultValue:"o conversație." },
  { key:"about.cta.description", page:"about", group:"CTA final", label:"Descriere", type:"text", selector:".about26-cta-copy > p:not(.about26-label)", defaultValue:"Spune-ne ce ai în plan și discutăm despre soluțiile potrivite pentru proiectul tău." },

  /* SERVICII — HERO / INTRO */
  { key:"services.hero.line1", page:"services", group:"Hero", label:"Titlu principal", type:"textnode", selector:".services26-hero h1", node:0, defaultValue:"Patru divizii." },
  { key:"services.hero.accent", page:"services", group:"Hero", label:"Titlu — accent", type:"text", selector:".services26-hero h1 strong", defaultValue:"Un singur proiect." },
  { key:"services.hero.description", page:"services", group:"Hero", label:"Text introductiv", type:"text", selector:".services26-hero-text", defaultValue:"Construcții civile, instalații electrice, instalații sanitare și finisaje coordonate printr-o singură structură." },
  { key:"services.intro.title", page:"services", group:"Introducere", label:"Titlu — început", type:"textnode", selector:".services26-intro-heading h2", node:0, defaultValue:"Tot ce ai nevoie pentru" },
  { key:"services.intro.accent", page:"services", group:"Introducere", label:"Titlu — accent", type:"text", selector:".services26-intro-heading h2 span", defaultValue:"un proiect complet." },
  { key:"services.intro.p1", page:"services", group:"Introducere", label:"Paragraf 1", type:"text", selector:".services26-intro-copy p:nth-child(1)", defaultValue:"BCB Group funcționează ca un brand principal sub care diviziile specializate lucrează împreună pentru proiecte bine organizate și coordonate." },
  { key:"services.intro.p2", page:"services", group:"Introducere", label:"Paragraf 2", type:"text", selector:".services26-intro-copy p:nth-child(2)", defaultValue:"Fiecare divizie are propria expertiză, dar aceeași direcție: seriozitate, comunicare clară și responsabilitate în fiecare etapă." },

  /* SERVICII — DIVIZII */
  { key:"services.construct.lead", page:"services", group:"BCB Construct", label:"Descriere principală", type:"text", selector:"#construct .services26-service-lead", defaultValue:"Divizia dedicată construcțiilor civile, caselor și proiectelor complete de la fundație până la predarea finală." },
  { key:"services.electric.lead", page:"services", group:"BCB Electric", label:"Descriere principală", type:"text", selector:"#electric .services26-service-lead", defaultValue:"Soluții electrice pentru locuințe, spații comerciale și proiecte civile, executate curat, sigur și organizat." },
  { key:"services.sanitary.lead", page:"services", group:"BCB Sanitare", label:"Descriere principală", type:"text", selector:"#sanitare .services26-service-lead", defaultValue:"Instalații sanitare și termice integrate corect în proiect, cu atenție la funcționalitate, durabilitate și execuție curată." },
  { key:"services.finish.lead", page:"services", group:"BCB Finisaje", label:"Descriere principală", type:"text", selector:"#finisaje .services26-service-lead", defaultValue:"Finisaje realizate cu grijă la detalii, pentru proiecte curate, elegante și pregătite pentru utilizare." },

  /* SERVICII — SISTEM / PROCES / CTA */
  { key:"services.system.title", page:"services", group:"Un singur sistem", label:"Titlu — început", type:"textnode", selector:".services26-system-copy h2", node:0, defaultValue:"Patru specializări." },
  { key:"services.system.accent", page:"services", group:"Un singur sistem", label:"Titlu — accent", type:"text", selector:".services26-system-copy h2 span", defaultValue:"O singură responsabilitate." },
  { key:"services.system.description", page:"services", group:"Un singur sistem", label:"Descriere", type:"text", selector:".services26-system-copy > p:not(.services26-label)", defaultValue:"Avantajul unei structuri integrate este simplu: mai puțină fragmentare între etape și o imagine mai clară asupra întregului proiect." },
  { key:"services.process.title", page:"services", group:"Proces", label:"Titlu — început", type:"textnode", selector:".services26-process-heading h2", node:0, defaultValue:"Clar de la început." },
  { key:"services.process.accent", page:"services", group:"Proces", label:"Titlu — accent", type:"text", selector:".services26-process-heading h2 span", defaultValue:"Organizat până la final." },
  { key:"services.cta.title", page:"services", group:"CTA final", label:"Titlu — început", type:"textnode", selector:".services26-cta-copy h2", node:0, defaultValue:"Spune-ne ce ai în plan." },
  { key:"services.cta.accent", page:"services", group:"CTA final", label:"Titlu — accent", type:"text", selector:".services26-cta-copy h2 span", defaultValue:"Noi începem cu o discuție." },
  { key:"services.cta.description", page:"services", group:"CTA final", label:"Descriere", type:"text", selector:".services26-cta-copy > p:not(.services26-label)", defaultValue:"Prezintă-ne proiectul și analizăm împreună ce divizii și ce soluții sunt potrivite pentru lucrarea ta." },

  /* SOCIAL MEDIA */
  { key:"social.hero.line1", page:"social", group:"Hero", label:"Titlu principal", type:"textnode", selector:".social26-hero h1", node:0, defaultValue:"Nu spunem doar ce facem." },
  { key:"social.hero.accent", page:"social", group:"Hero", label:"Titlu — accent", type:"text", selector:".social26-hero h1 strong", defaultValue:"Arătăm cum facem." },
  { key:"social.hero.description", page:"social", group:"Hero", label:"Text introductiv", type:"text", selector:".social26-hero-text", defaultValue:"Urmărește activitatea BCB Group direct din teren: proiecte în desfășurare, etape de execuție, detalii tehnice, filmări și evoluția reală a lucrărilor." },
  { key:"social.intro.title", page:"social", group:"Introducere", label:"Titlu secțiune", type:"textnode", selector:".social26-intro-heading h2", node:0, defaultValue:"Urmărește" },
  { key:"social.intro.description", page:"social", group:"Introducere", label:"Text secțiune", type:"text", selector:".social26-intro-copy p", defaultValue:"Vezi proiectele BCB Group dincolo de fotografiile finale: progres, detalii, lucrări și momente din teren." },

  /* CONTACT */
  { key:"contact.hero.line1", page:"contact", group:"Hero", label:"Titlu principal", type:"textnode", selector:".contact26-hero h1", node:0, defaultValue:"Hai să discutăm despre" },
  { key:"contact.hero.accent", page:"contact", group:"Hero", label:"Titlu — accent", type:"text", selector:".contact26-hero h1 strong", defaultValue:"proiectul tău." },
  { key:"contact.hero.description", page:"contact", group:"Hero", label:"Text introductiv", type:"text", selector:".contact26-hero-text", defaultValue:"Fie că vrei să construiești, să renovezi sau ai nevoie de una dintre diviziile BCB Group, începem cu o discuție clară despre lucrare." },
  { key:"contact.info.title", page:"contact", group:"Contact direct", label:"Titlu — început", type:"textnode", selector:".contact26-info h2", node:0, defaultValue:"Spune-ne ce ai" },
  { key:"contact.info.accent", page:"contact", group:"Contact direct", label:"Titlu — accent", type:"text", selector:".contact26-info h2 span", defaultValue:"în plan." },
  { key:"contact.info.description", page:"contact", group:"Contact direct", label:"Descriere", type:"text", selector:".contact26-info-lead", defaultValue:"Pentru o discuție eficientă, ne poți trimite câteva detalii despre proiect, zona lucrării și etapa în care te afli." },
  { key:"contact.form.title", page:"contact", group:"Formular ofertă", label:"Titlu — început", type:"textnode", selector:".contact26-form-heading h2", node:0, defaultValue:"Trimite-ne" },
  { key:"contact.form.accent", page:"contact", group:"Formular ofertă", label:"Titlu — accent", type:"text", selector:".contact26-form-heading h2 span", defaultValue:"detaliile lucrării." },
  { key:"contact.form.description", page:"contact", group:"Formular ofertă", label:"Descriere formular", type:"text", selector:".contact26-form-heading > p:last-child", defaultValue:"Completează informațiile de mai jos. Cu cât avem mai multe detalii, cu atât putem înțelege mai bine proiectul." },
  { key:"contact.final.title", page:"contact", group:"CTA final", label:"Titlu — început", type:"textnode", selector:".contact26-final-copy h2", node:0, defaultValue:"Un proiect bun începe" },
  { key:"contact.final.accent", page:"contact", group:"CTA final", label:"Titlu — accent", type:"text", selector:".contact26-final-copy h2 span", defaultValue:"cu o discuție bună." },
  { key:"contact.final.description", page:"contact", group:"CTA final", label:"Descriere", type:"text", selector:".contact26-final-copy > p:not(.contact26-label)", defaultValue:"Sună-ne, scrie-ne pe WhatsApp sau trimite formularul de ofertă. Alegem apoi împreună următorul pas." }
];
