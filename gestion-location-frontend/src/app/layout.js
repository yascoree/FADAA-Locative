import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { LanguageProvider } from "@/context/LanguageContext";

// Applique le thème stocké avant le premier rendu, pour éviter un flash de
// thème clair au chargement d'une page backoffice quand l'utilisateur a
// choisi le mode sombre (voir ThemeContext.jsx pour le reste de la logique).
const THEME_INIT_SCRIPT = `
try {
  var t = window.localStorage.getItem("fadaa-theme");
  if (t === "dark") document.documentElement.setAttribute("data-theme", "dark");
} catch (e) {}
`;

// Même principe pour la langue : évite un flash LTR->RTL au chargement quand
// l'arabe est déjà choisi (voir LanguageContext.jsx).
const LOCALE_INIT_SCRIPT = `
try {
  var l = window.localStorage.getItem("fadaa-locale");
  if (l === "en" || l === "ar") {
    document.documentElement.lang = l;
    document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
  }
} catch (e) {}
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const SITE_URL = "https://www.fadaalocative.ma";
const SITE_NAME = "FADAA Locative";
const DEFAULT_DESCRIPTION =
  "FADAA Locative est le logiciel de gestion locative et immobilière au Maroc : baux, paiements de loyer, quittances et agences, tout en un.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Logiciel de gestion locative au Maroc`,
    template: `%s — ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: [
    "gestion locative Maroc",
    "logiciel de gestion locative",
    "gestion immobilière",
    "bail de location",
    "paiement du loyer",
    "agence immobilière",
  ],
  robots: { index: true, follow: true },
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "fr_MA",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Logiciel de gestion locative au Maroc`,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Logiciel de gestion locative au Maroc`,
    description: DEFAULT_DESCRIPTION,
  },
};

const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/icon.png`,
  email: "contact@fadaalocative.ma",
  telephone: "+212500000000",
  address: { "@type": "PostalAddress", addressCountry: "MA" },
  sameAs: [
    "https://web.facebook.com/fadaascol/",
    "https://www.linkedin.com/company/fadaa-solutions/",
    "https://www.instagram.com/fadaa_ma/",
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
        />
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <Script id="locale-init" strategy="beforeInteractive">
          {LOCALE_INIT_SCRIPT}
        </Script>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>{children}</AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
