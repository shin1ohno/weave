import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { UIStateProvider } from "@/lib/ws";
import { RecentEventsProvider } from "@/lib/recent-events";
import { AppShell } from "@/components/AppShell";
import { CommandPalette } from "@/components/CommandPalette";
import { HelpOverlay } from "@/components/HelpOverlay";
import { KeyboardBindings } from "@/components/KeyboardBindings";
import { CommandUIProvider } from "@/hooks/useCommandUI";
import { RowSelectionProvider } from "@/hooks/useRowSelection";
import { ThemeProvider } from "@/hooks/useTheme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "weave",
  description: "IoT device ↔ service routing engine",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
  drawer,
}: Readonly<{
  children: React.ReactNode;
  drawer: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950">
        <ThemeProvider>
          <UIStateProvider>
            <RecentEventsProvider>
              <CommandUIProvider>
                <RowSelectionProvider>
                  <AppShell>{children}</AppShell>
                  {drawer}
                  <KeyboardBindings />
                  <CommandPalette />
                  <HelpOverlay />
                </RowSelectionProvider>
              </CommandUIProvider>
            </RecentEventsProvider>
          </UIStateProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
