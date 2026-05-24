import type { Metadata } from "next";
import "./styles/base.css";
import "./styles/primitives.css";
import "./styles.css";
import "./styles/public-home.css";

export const metadata: Metadata = {
  title: "candidateSignal.ai",
  description: "Resume parsing, candidate intelligence, and HR campaign matching workspace",
  robots: process.env.NEXT_PUBLIC_DEPLOY_ENV === "staging" ? {
    index: false,
    follow: false,
    nocache: true,
  } : undefined,
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
