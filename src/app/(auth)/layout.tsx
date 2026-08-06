import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthLayout } from "@/components/auth/auth-layout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Venom CRM — Authentication",
  description: "Sign in to Venom CRM",
  robots: { index: false, follow: false },
};

export default function AuthRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthLayout>
      {children}
    </AuthLayout>
  );
}
