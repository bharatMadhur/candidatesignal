import type { Metadata } from "next";
import "./styles.css";
import "./styles/public-home.css";

export const metadata: Metadata = {
  title: "candidateSignal.ai",
  description: "Resume parsing, candidate intelligence, and HR campaign matching workspace",
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
