import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const dm = DM_Sans({
  variable: "--font-dm",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "RoleRadar — Tunisia → Europe job radar + AI apply packs",
  description:
    "Live job board for Ali Slaimia: Europe/remote roles, skill match scores, AI cover letters and interview prep.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${syne.variable} ${dm.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
