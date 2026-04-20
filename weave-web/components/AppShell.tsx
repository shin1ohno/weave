"use client";

import { usePathname } from "next/navigation";
import {
  Navbar,
  NavbarItem,
  NavbarLabel,
  NavbarSection,
  NavbarSpacer,
} from "@/components/ui/navbar";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/mappings", label: "Mappings" },
  { href: "/glyphs", label: "Glyphs" },
  { href: "/edges", label: "Edges" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCurrent = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href) ?? false;

  return (
    <>
      <header className="border-b border-zinc-950/5 bg-white px-6 dark:border-white/10 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl items-center">
          <Navbar>
            <NavbarItem href="/">
              <NavbarLabel className="text-lg font-semibold">
                weave
              </NavbarLabel>
            </NavbarItem>
            <NavbarSpacer />
            <NavbarSection>
              {NAV.map((n) => (
                <NavbarItem
                  key={n.href}
                  href={n.href}
                  current={isCurrent(n.href)}
                >
                  {n.label}
                </NavbarItem>
              ))}
            </NavbarSection>
          </Navbar>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>
    </>
  );
}
