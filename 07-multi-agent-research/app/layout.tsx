import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Multi-Agent Research Assistant",
  description:
    "Search, Summarizer, Fact-Checker, and Writer agents collaborate to produce cited research briefs with per-claim confidence.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
