import type { Metadata } from "next";
import { Geologica, IBM_Plex_Mono, Onest, Unbounded } from "next/font/google";
import Link from "next/link";
import "./globals.css";

// The same fonts as on the landing
const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic"],
});

const geologica = Geologica({
  variable: "--font-geologica",
  subsets: ["latin", "cyrillic"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin", "cyrillic"],
  weight: "400",
});

// Only the big letter "Ч" on the empty list and error pages uses it, so it is not preloaded
const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin", "cyrillic"],
  weight: "900",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "Контакты — Чигабугадага",
    template: "%s — Чигабугадага",
  },
  description: "Контакты людей, которых я знаю лично, и заметки о разговорах",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${onest.variable} ${geologica.variable} ${ibmPlexMono.variable} ${unbounded.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="mx-auto w-full max-w-3xl px-5.5 pt-5.5 md:px-8 md:pt-7">
          <div className="flex items-center justify-between gap-4 border-b pb-3.5 md:pb-4">
            <Link
              href="/"
              className="font-heading text-logo font-medium hover:opacity-85"
            >
              {/* Red "Ч" as the big letter on the landing */}
              <span className="text-brand">Ч</span>игабугадага
            </Link>
            <span className="font-mono text-label">ЛИЧНЫЕ КОНТАКТЫ</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-5.5 pt-8 pb-14 md:px-8 md:pt-12 md:pb-20">
          {children}
        </main>
      </body>
    </html>
  );
}
