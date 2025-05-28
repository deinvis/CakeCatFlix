
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AppLogo } from '@/components/app-logo';
import { NAV_LINKS, SETTINGS_NAV_LINK, STARTUP_PAGES } from '@/lib/constants'; // Added STARTUP_PAGES
import type { NavLink } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Menu, X, ChevronDown } from 'lucide-react';
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

interface GenreOrGroup {
  name: string;
  path: string;
}

const defaultAppHomePage = `/app/${STARTUP_PAGES[0].value}`;

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
        setActivePlaylistId(null);
        setMovieGenres([]);
        setSeriesGenres([]);
        setChannelGroups([]);
      }
    } catch (error) {
      console.error("Error fetching submenu data:", error);
      setHasPlaylistsConfigured(false);
      setActivePlaylistId(null);
      setMovieGenres([]);
      setSeriesGenres([]);
      setChannelGroups([]);
    } finally {
      setIsLoadingSubmenus(false);
    }
  }, []); 

  useEffect(() => {
    fetchSubmenuData();
  }, [fetchSubmenuData, pathname]); 

  useEffect(() => {
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  }, [pathname, isMobileMenuOpen]);

  const mainNavLinks = NAV_LINKS.filter(link => link.href !== '/app/favoritos'); 
  const favoritesLink = NAV_LINKS.find(link => link.href === '/app/favoritos');

  const renderNavLink = (link: NavLink, isMobile: boolean = false) => {
    const commonClasses = cn(
      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
      isMobile ? "py-3 text-base gap-3" : "text-sm",
      pathname === link.href || (link.href !== defaultAppHomePage && pathname.startsWith(link.href)) 
        ? "bg-primary text-primary-foreground hover:bg-primary/90" 
        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
    );

    let subMenuContent: GenreOrGroup[] = [];
    let subMenuLabel = "";
    let subMenuPathPrefix = "";

    if (link.href === "/app/movies") {
      subMenuContent = movieGenres;
      subMenuLabel = "Gêneros de Filmes";
      subMenuPathPrefix = "/app/movies/genre/";
    } else if (link.href === "/app/series") {
      subMenuContent = seriesGenres;
      subMenuLabel = "Gêneros de Séries";
      subMenuPathPrefix = "/app/series/genre/";
    } else if (link.href === "/app/channels") {
      subMenuContent = channelGroups;
      subMenuLabel = "Grupos de Canais";
      subMenuPathPrefix = "/app/channels/group/";
    }
    
    const isActivePathForDropdown = pathname.startsWith(subMenuPathPrefix);

    if (subMenuContent.length > 0 && !isMobile && hasPlaylistsConfigured) { 
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                commonClasses,
                "hover:bg-primary/80", 
                 isActivePathForDropdown ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
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
                <DropdownMenuItem key={item.path} asChild
                  className={cn(pathname === item.path ? "bg-accent text-accent-foreground" : "")}
                >
                  <Link href={item.path} className="w-full">
                    {item.name}
                  </Link>
                </DropdownMenuItem>
              ))
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
    ...NAV_LINKS,
    SETTINGS_NAV_LINK
  ];


  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center">
        <div className="mr-4 hidden md:flex">
          <Link href={defaultAppHomePage} aria-label="Página Inicial">
            <AppLogo />
          </Link>
        </div>

        <div className="flex flex-1 items-center md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="mr-2"
            aria-label="Alternar menu móvel"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
          <div onClick={() => setIsMobileMenuOpen(false)}>
             <Link href={defaultAppHomePage} aria-label="Página Inicial">
                <AppLogo />
            </Link>
          </div>
        </div>

        <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {mainNavLinks.map((link) => (
            <div key={link.href}>{renderNavLink(link, false)}</div>
          ))}
          {favoritesLink && (
            <Link
              href={favoritesLink.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                pathname === favoritesLink.href ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
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
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                pathname === SETTINGS_NAV_LINK.href ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <SETTINGS_NAV_LINK.icon className="h-4 w-4" />
              {SETTINGS_NAV_LINK.label}
            </Link>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div 
          className="absolute top-16 left-0 right-0 z-40 border-t border-border/40 bg-background shadow-lg md:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsMobileMenuOpen(false);
            }
          }}
        >
          <nav className="flex flex-col gap-1 p-4">
            {allLinksForMobile.map((link) => (
              <div key={link.href} onClick={() => setIsMobileMenuOpen(false)}> 
                 {renderNavLink(link, true)}
              </div>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
