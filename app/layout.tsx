import type React from "react"
import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { AuthProvider } from "@/components/auth-provider"
import { ErrorBoundary } from "@/components/error-boundary"
import { Toaster } from "@/components/toaster"
import { InstallAppToast } from "@/components/install-app-toast"
import "./globals.css"

export const metadata: Metadata = {
  title: "IEEE SB GEHU - Attendance Manager",
  description: "Progressive Web App for IEEE Student Branch GEHU attendance management",
  generator: "NEXT.js",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "IEEE Attendance",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const themeColor = "#1e293b";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <ErrorBoundary>
          <AuthProvider>
            {children}
            <Toaster />
            <InstallAppToast />
            {/* Show install app toast if available */}
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
