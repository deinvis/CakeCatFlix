
"use client";

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { MOCK_SERIES_GENRES } from '@/lib/constants'; // MOCK_PLAYLISTS removed
import { getAllPlaylistsMetadata } from '@/lib/db';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight, Clapperboard } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function SeriesPage() {
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // TODO: Fetch genres dynamically from active playlist if desired
  const [genres, setGenres] = useState<string[]>(MOCK_SERIES_GENRES);

  useEffect(() => {
    async function checkPlaylists() {
      setIsLoading(true);
      try {
        const playlists = await getAllPlaylistsMetadata();
        setHasPlaylistsConfigured(playlists.length > 0);
        // Example for dynamic genres:
        // if (playlists.length > 0 && playlists[0]?.id) {
        //   const fetchedGenres = await getAllGenresForPlaylist(playlists[0].id, 'series');
        //   if (fetchedGenres.length > 0) setGenres(fetchedGenres);
        // }
      } catch (error) {
        console.error("Failed to check playlists:", error);
        setHasPlaylistsConfigured(false);
      } finally {
        setIsLoading(false);
      }
    }
    checkPlaylists();
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto px-0">
        <PageHeader title="TV Series" description="Binge-watch your favorite TV series and discover new ones."/>
        <Card className="shadow-lg border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clapperboard className="h-6 w-6 text-primary" />
              Browse by Genre
            </CardTitle>
            <CardDescription>Loading genres...</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-0">
      <PageHeader title="TV Series" description="Binge-watch your favorite TV series and discover new ones."/>
      {hasPlaylistsConfigured ? (
         <Card className="shadow-lg border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clapperboard className="h-6 w-6 text-primary" />
              Browse by Genre
            </CardTitle>
            <CardDescription>Select a genre to discover TV series.</CardDescription>
          </CardHeader>
          <CardContent>
            {genres.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {genres.map(genre => (
                  <Button 
                    key={genre} 
                    variant="outline" 
                    className="justify-between w-full text-left h-auto p-4 rounded-lg hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground" 
                    asChild
                  >
                    <Link href={`/app/series/genre/${encodeURIComponent(genre.toLowerCase())}`}>
                      <span className="text-base font-medium">{genre}</span>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </Link>
                  </Button>
                ))}
              </div>
            ) : (
               <p className="text-muted-foreground text-center py-4">No series genres found in your playlists.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <PlaceholderContent type="series" />
      )}
    </div>
  );
}
