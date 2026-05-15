import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "candidatSignal.ai",
  description: "Resume parsing, candidate intelligence, and HR campaign matching workspace",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
