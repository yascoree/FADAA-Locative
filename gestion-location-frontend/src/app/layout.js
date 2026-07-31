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

export const metadata = {
  title: "FADAA Locative",
  description: "Plateforme de gestion locative",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
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
