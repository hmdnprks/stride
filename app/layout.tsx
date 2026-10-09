import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { InlineScript } from "@/components/inline-script";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: "Stride",
  description: "Running, recovery and fitness from your Garmin watch.",
};

// Applies the saved theme (or the system one) before first paint.
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${archivo.variable} h-full antialiased`}>
      <head>
        <InlineScript html={themeScript} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
