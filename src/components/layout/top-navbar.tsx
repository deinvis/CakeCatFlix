
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AppLogo } from '@/components/app-logo';
import { NAV_LINKS, SETTINGS_NAV_LINK } from '@/lib/constants';
import type { NavLink } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Menu, X, ChevronDown, Film, Tv2, Clapperboard, Settings } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAllPlaylistsMetadata, getAllGenresForPlaylist } from '@/lib/db';
import type { PlaylistMetadata } from '@/lib/db'; // Assuming PlaylistMetadata is exported from db.ts or constants.ts

interface GenreOrGroup {
  name: string;
  path: string;
}

export function TopNavbar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [movieGenres, setMovieGenres] = useState<GenreOrGroup[]>([]);
  const [seriesGenres, setSeriesGenres] = useState<GenreOrGroup[]>([]);
  const [channelGroups, setChannelGroups] = useState<GenreOrGroup[]>([]);
  const [isLoadingSubmenus, setIsLoadingSubmenus] = useState(true);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState<boolean | null>(null);

  const fetchSubmenuData = useCallback(async () => {
    setIsLoadingSubmenus(true);
    setHasPlaylistsConfigured(null);
    try {
      const playlists = await getAllPlaylistsMetadata();
      if (playlists.length > 0 && playlists[0]?.id) {
        const currentPlaylistId = playlists[0].id;
        setActivePlaylistId(currentPlaylistId);
        setHasPlaylistsConfigured(true);

        const [movies, series, channels] = await Promise.all([
          getAllGenresForPlaylist(currentPlaylistId, 'movie'),
          getAllGenresForPlaylist(currentPlaylistId, 'series'),
          getAllGenresForPlaylist(currentPlaylistId, 'channel')
        ]);

        setMovieGenres(movies.map(genre => ({ name: genre, path: `/app/movies/genre/${encodeURIComponent(genre)}` })));
        setSeriesGenres(series.map(genre => ({ name: genre, path: `/app/series/genre/${encodeURIComponent(genre)}` })));
        setChannelGroups(channels.map(group => ({ name: group, path: `/app/channels/group/${encodeURIComponent(group)}` })));
        
      } else {
        setHasPlaylistsConfigured(false);
        setMovieGenres([]);
        setSeriesGenres([]);
        setChannelGroups([]);
      }
    } catch (error) {
      console.error("Error fetching submenu data:", error);
      setHasPlaylistsConfigured(false);
      setMovieGenres([]);
      setSeriesGenres([]);
      setChannelGroups([]);
    } finally {
      setIsLoadingSubmenus(false);
    }
  }, []);

  useEffect(() => {
    fetchSubmenuData();
  }, [fetchSubmenuData]);

  useEffect(() => {
    // Close mobile menu on route change
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  }, [pathname, isMobileMenuOpen]);

  const mainNavLinks = NAV_LINKS.filter(link => link.href !== '/app/favoritos'); // Favoritos will be handled separately for now
  const favoritesLink = NAV_LINKS.find(link => link.href === '/app/favoritos');

  const renderNavLink = (link: NavLink, isMobile: boolean = false) => {
    const commonClasses = cn(
      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
      isMobile ? "py-3 text-base gap-3" : "text-sm",
      pathname === link.href ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
    );

    let subMenuContent: GenreOrGroup[] = [];
    let subMenuLabel = "";

    if (link.href === "/app/movies") {
      subMenuContent = movieGenres;
      subMenuLabel = "Gêneros de Filmes";
    } else if (link.href === "/app/series") {
      subMenuContent = seriesGenres;
      subMenuLabel = "Gêneros de Séries";
    } else if (link.href === "/app/channels") {
      subMenuContent = channelGroups;
      subMenuLabel = "Grupos de Canais";
    }

    if (subMenuContent.length > 0 && !isMobile) { // Dropdowns only for desktop for now
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                commonClasses,
                "hover:bg-accent hover:text-accent-foreground",
                 pathname.startsWith(link.href) && link.href !== "/app" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <link.icon className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
              {link.label}
              <ChevronDown className="h-4 w-4 ml-1 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 max-h-96 overflow-y-auto">
            <DropdownMenuLabel>{subMenuLabel}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isLoadingSubmenus ? (
              <DropdownMenuItem disabled>Carregando...</DropdownMenuItem>
            ) : (
              subMenuContent.map(item => (
                <DropdownMenuItem key={item.path} asChild>
                  <Link href={item.path} className="w-full">
                    {item.name}
                  </Link>
                </DropdownMenuItem>
              ))
            )}
            {hasPlaylistsConfigured === false && !isLoadingSubmenus && (
                <DropdownMenuItem disabled>Nenhuma playlist configurada</DropdownMenuItem>
            )}
             {hasPlaylistsConfigured && !isLoadingSubmenus && subMenuContent.length === 0 && (
                <DropdownMenuItem disabled>Nenhum {subMenuLabel.toLowerCase().replace("de ", "")} encontrado</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
      <Link href={link.href} className={commonClasses}>
        <link.icon className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
        {link.label}
      </Link>
    );
  };
  
  const allLinksForMobile = [
    ...NAV_LINKS, // includes Filmes, Series, Canais, Favoritos
    SETTINGS_NAV_LINK
  ];


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
          <div onClick={() => setIsMobileMenuOpen(false)}> {/* Close menu on logo click */}
            <AppLogo />
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {mainNavLinks.map((link) => (
            <div key={link.href}>{renderNavLink(link, false)}</div>
          ))}
           {/* Favorites link without dropdown */}
          {favoritesLink && (
            <Link
              href={favoritesLink.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                 pathname === favoritesLink.href ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <favoritesLink.icon className="h-4 w-4" />
              {favoritesLink.label}
            </Link>
          )}
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
        <div 
          className="absolute top-16 left-0 right-0 z-40 border-t border-border/40 bg-background shadow-lg md:hidden"
          onClick={(e) => {
            // Close menu if clicking outside the actual link items (e.g. on the background of the drawer)
            // This helps if the drawer takes full width.
            if (e.target === e.currentTarget) {
              setIsMobileMenuOpen(false);
            }
          }}
        >
          <nav className="flex flex-col gap-1 p-4">
            {allLinksForMobile.map((link) => (
              <div key={link.href} onClick={() => setIsMobileMenuOpen(false)}> {/* Close menu on link click */}
                 {renderNavLink(link, true)}
              </div>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
