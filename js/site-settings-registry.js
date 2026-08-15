export const SITE_SETTINGS_GROUPS = [
  { key:"identity", label:"Identitate companie", icon:"fa-building" },
  { key:"internal_access", label:"Acces intern", icon:"fa-shield-halved" },
  { key:"contact", label:"Contact", icon:"fa-address-book" },
  { key:"operations", label:"Program & zonă", icon:"fa-clock" },
  { key:"social", label:"Social Media", icon:"fa-share-nodes" },
  { key:"footer", label:"Footer & legal", icon:"fa-scale-balanced" }
];

export const SITE_SETTINGS = [
  { key:"brand_name", group:"identity", label:"Brand", type:"text", defaultValue:"BCB Group", help:"Numele comercial afișat public." },
  { key:"brand_long_name", group:"identity", label:"Denumire brand extinsă", type:"text", defaultValue:"Bocoiu Construction Brothers", help:"Forma extinsă a brandului." },
  { key:"legal_name", group:"identity", label:"Denumire juridică", type:"text", defaultValue:"BCB CONSTRUCT PRO S.R.L.", help:"Denumirea exactă din actele firmei." },
  { key:"cui", group:"identity", label:"CUI", type:"text", defaultValue:"54634520" },
  { key:"trade_register", group:"identity", label:"Registrul Comerțului", type:"text", defaultValue:"J2026030027006" },
  { key:"caen", group:"identity", label:"CAEN principal", type:"textarea", defaultValue:"4100 – Lucrări de construcții ale clădirilor rezidențiale și nerezidențiale" },

  { key:"manager_badge", group:"internal_access", label:"Etichetă buton", type:"text", defaultValue:"Familia Bocoiu · Acces intern", help:"Textul mic afișat deasupra titlului butonului flotant." },
  { key:"manager_title", group:"internal_access", label:"Titlu buton", type:"text", defaultValue:"Business Manager", help:"Titlul principal al butonului flotant." },
  { key:"manager_aria_label", group:"internal_access", label:"Descriere accesibilitate", type:"text", defaultValue:"Deschide BCB Business Manager — acces intern Familia Bocoiu", help:"Descriere pentru cititoare de ecran; nu este afișată vizual." },
  { key:"manager_url", group:"internal_access", label:"Link Business Manager", type:"text", defaultValue:"admin/", help:"Recomandat: admin/. Poți folosi și un URL https complet." },

  { key:"phone_display", group:"contact", label:"Telefon — afișare", type:"text", defaultValue:"0770 712 701", help:"Cum apare numărul pe site." },
  { key:"phone_e164", group:"contact", label:"Telefon — format tehnic", type:"tel", defaultValue:"40770712701", help:"Doar cifre, cu prefix de țară. Ex: 40770712701." },
  { key:"email", group:"contact", label:"Email principal", type:"email", defaultValue:"office@bcbgroup.ro" },
  { key:"whatsapp_e164", group:"contact", label:"WhatsApp", type:"tel", defaultValue:"40770712701", help:"Număr WhatsApp cu prefix de țară, doar cifre." },
  { key:"quote_cta", group:"contact", label:"Text buton ofertă", type:"text", defaultValue:"Solicită ofertă" },
  { key:"call_cta", group:"contact", label:"Text buton apel", type:"text", defaultValue:"Sună acum" },

  { key:"working_hours", group:"operations", label:"Program", type:"text", defaultValue:"Luni – Vineri · 08:00–18:00" },
  { key:"service_area", group:"operations", label:"Zonă principală", type:"text", defaultValue:"Oradea · Bihor" },
  { key:"headquarters", group:"operations", label:"Sediu social", type:"textarea", defaultValue:"Sat Roșia, Comuna Roșia, Jud. Bihor" },
  { key:"service_area_note", group:"operations", label:"Notă zonă servicii", type:"text", defaultValue:"Proiecte analizate și în alte zone" },

  { key:"instagram_url", group:"social", label:"Instagram", type:"url", defaultValue:"https://www.instagram.com/bcbgroup.ro/" },
  { key:"facebook_url", group:"social", label:"Facebook", type:"url", defaultValue:"https://www.facebook.com/bcbgroup.ro/" },
  { key:"tiktok_url", group:"social", label:"TikTok", type:"url", defaultValue:"https://www.tiktok.com/@bcbgroup.ro" },
  { key:"linkedin_url", group:"social", label:"LinkedIn", type:"url", defaultValue:"https://www.linkedin.com/company/bcb-construct-pro-srl/" },
  { key:"youtube_url", group:"social", label:"YouTube", type:"url", defaultValue:"", optional:true },

  { key:"footer_slogan", group:"footer", label:"Slogan footer", type:"textarea", defaultValue:"Construim nu doar clădiri, ci relații bazate pe încredere, seriozitate și respect." },
  { key:"footer_legal_line", group:"footer", label:"Text juridic footer", type:"textarea", defaultValue:"BCB Group este brandul comercial al BCB Construct Pro S.R.L." },
  { key:"footer_verse", group:"footer", label:"Verset footer", type:"textarea", defaultValue:"„Tot ce faceți, să faceți din toată inima, ca pentru Domnul.”" },
  { key:"footer_verse_reference", group:"footer", label:"Referință verset", type:"text", defaultValue:"Coloseni 3:23" },
  { key:"copyright_text", group:"footer", label:"Copyright", type:"text", defaultValue:"© 2026 BCB Group — Bocoiu Construction Brothers. Toate drepturile rezervate." }
];

export const DEFAULT_SITE_SETTINGS = Object.fromEntries(SITE_SETTINGS.map(item => [item.key, item.defaultValue]));
