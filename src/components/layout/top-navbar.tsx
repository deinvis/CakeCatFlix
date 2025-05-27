
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AppLogo } from '@/components/app-logo';
import { NAV_LINKS, SETTINGS_NAV_LINK } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export function TopNavbar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Close mobile menu on route change
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const allLinks = [...NAV_LINKS, SETTINGS_NAV_LINK];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center">
        <div className="mr-4 hidden md:flex">
          <AppLogo />
        </div>

        {/* Mobile Menu Trigger & Logo */}
        <div className="flex flex-1 items-center md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="mr-2"
            aria-label="Toggle mobile menu"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
          <AppLogo /> {/* Show logo next to hamburger on mobile */}
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                pathname === link.href ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden flex-initial items-center justify-end md:flex">
           <Link
              href={SETTINGS_NAV_LINK.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                pathname === SETTINGS_NAV_LINK.href ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <SETTINGS_NAV_LINK.icon className="h-4 w-4" />
              {SETTINGS_NAV_LINK.label}
            </Link>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="absolute top-16 left-0 right-0 z-40 border-t border-border/40 bg-background shadow-lg md:hidden">
          <nav className="flex flex-col gap-1 p-4">
            {allLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-3 text-base font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  pathname === link.href ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setIsMobileMenuOpen(false)} // Close menu on link click
              >
                <link.icon className="h-5 w-5" />
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
