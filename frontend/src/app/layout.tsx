import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";

// App-wide pairing (previously the field officer UI only, now applied
// everywhere for a consistent identity): a geometric display face for
// headings and a highly legible UI sans for body text. Naming these
// variables exactly `--font-sans`/`--font-heading` — rather than
// `--font-geist-sans` as before — is what actually wires them up: the
// Tailwind theme's `font-sans`/`font-heading` utilities reference those
// exact variable names, and the previous mismatch meant the app had
// silently been rendering in the browser's default font the whole time.
const bodyFont = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const headingFont = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Election Monitor",
  description: "Real-time field-officer and polling-unit monitoring",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Election Monitor",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${headingFont.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-center" />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
