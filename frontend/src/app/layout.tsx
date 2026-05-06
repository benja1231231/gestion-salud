import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GestionSalud - Sistema Médico",
  description: "Clon profesional de BlipDoc",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <main className="min-h-screen bg-[#f5f5f7]">
          {children}
        </main>
      </body>
    </html>
  );
}
