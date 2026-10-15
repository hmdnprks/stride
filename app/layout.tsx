import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { InlineScript } from "@/components/inline-script";
import { Pwa } from "@/components/pwa";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: "Stride",
  description: "Running, recovery and fitness from your Garmin watch.",
  appleWebApp: { capable: true, title: "Stride", statusBarStyle: "default" },
};

// Updated to the page theme by <Pwa /> (the theme toggle can differ from the system's).
export const viewport: Viewport = { themeColor: "#ffffff", viewportFit: "cover" };

// Applies the saved theme (or the system one) before first paint.
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${archivo.variable} h-full antialiased`}>
      <head>
        <InlineScript html={themeScript} />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <Pwa />
      </body>
    </html>
  );
}
