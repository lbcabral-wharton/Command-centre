import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/nav";
import { auth } from "@/lib/auth";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Command Centre",
  description: "Personal · Finance · Ventures",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Command Centre",
  },
};

export const viewport: Viewport = {
  themeColor: "#f3f1fb",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${mono.variable} ${playfair.variable} font-sans`}
      >
        {session ? (
          <>
            <Sidebar user={session.user ?? null} />
            <main className="md:pl-64">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {children}
              </div>
            </main>
          </>
        ) : (
          <main>{children}</main>
        )}
      </body>
    </html>
  );
}
