import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-latin",
  display: "swap",
});

// Every label on this portal carries Hindi. Without a Devanagari face the
// text falls back to a system font that renders conjuncts badly.
const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-deva",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Resident Complaint Portal — Town Office",
  description:
    "Raise and track township maintenance complaints for the Nuvoco Sonadih town office.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4338ca",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${devanagari.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col font-sans"
        style={
          {
            "--font-app-sans":
              "var(--font-latin), var(--font-deva), system-ui, sans-serif",
          } as React.CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
