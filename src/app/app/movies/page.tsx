
"use client";

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGroupRow } from '@/components/content-group-row';
import { getAllPlaylistsMetadata, getPlaylistItems, getAllGenresForPlaylist, type MovieItem } from '@/lib/db';
import type { ContentItemForCard } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input'; // Import Input

const ITEMS_PER_ROW_PREVIEW = 6;

const transformMovieItemToCardItem = (item: MovieItem): ContentItemForCard => ({
  id: item.id!.toString(),
  title: item.title,
  imageUrl: item.logoUrl,
  type: 'movie',
  genre: item.genre,
  dataAiHint: `movie ${item.genre || item.title || ''}`.substring(0, 50).trim().toLowerCase(),
  streamUrl: item.streamUrl,
});

interface GroupedMovies {
  genre: string;
  items: ContentItemForCard[];
}

export default function MoviesPage() {
  const [allGroupedMovieItems, setAllGroupedMovieItems] = useState<GroupedMovies[]>([]);
  const [displayedGroupedMovieItems, setDisplayedGroupedMovieItems] = useState<GroupedMovies[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState<boolean | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAndGroupMovies = useCallback(async (playlistId: string) => {
    if (!playlistId) return;
    setIsLoading(true);
    try {
      const rawMovieItemsFromDB = await getPlaylistItems(playlistId, 'movie') as MovieItem[];
      const cardItems = rawMovieItemsFromDB.map(transformMovieItemToCardItem);
      const genres = await getAllGenresForPlaylist(playlistId, 'movie');

      const groups: GroupedMovies[] = genres.map(genre => ({
        genre: genre,
        items: cardItems.filter(item => item.genre?.toLowerCase() === genre.toLowerCase())
      })).filter(group => group.items.length > 0);

      const sortedGroups = groups.sort((a,b) => a.genre.localeCompare(b.genre));
      setAllGroupedMovieItems(sortedGroups);
      setDisplayedGroupedMovieItems(sortedGroups);

    } catch (error) {
      console.error("Failed to fetch or group movie items:", error);
      setAllGroupedMovieItems([]);
      setDisplayedGroupedMovieItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function initialize() {
      setHasPlaylistsConfigured(null);
      setIsLoading(true);
      setSearchTerm(''); 
      try {
        const playlists = await getAllPlaylistsMetadata();
        if (playlists.length > 0 && playlists[0]?.id) {
          setHasPlaylistsConfigured(true);
          const firstPlaylistId = playlists[0].id;
          setActivePlaylistId(firstPlaylistId);
          await fetchAndGroupMovies(firstPlaylistId);
        } else {
          setHasPlaylistsConfigured(false);
          setAllGroupedMovieItems([]);
          setDisplayedGroupedMovieItems([]);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to initialize movies page:", error);
        setHasPlaylistsConfigured(false);
        setIsLoading(false);
      }
    }
    initialize();
  }, [fetchAndGroupMovies]);

   useEffect(() => {
    if (isLoading) return;
    if (!searchTerm) {
      setDisplayedGroupedMovieItems(allGroupedMovieItems);
      return;
    }
    const filtered = allGroupedMovieItems.filter(group =>
      group.genre.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setDisplayedGroupedMovieItems(filtered);
  }, [searchTerm, allGroupedMovieItems, isLoading]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };


  if (hasPlaylistsConfigured === null || (isLoading && allGroupedMovieItems.length === 0)) {
     return (
      <div className="container mx-auto px-0">
        <PageHeader title="Filmes" description="Explore uma vasta coleção de filmes." />
        <Skeleton className="h-10 w-full sm:w-72 mb-6 rounded-md" /> 
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="mb-8 md:mb-12">
            <Skeleton className="h-8 w-1/4 mb-4 rounded-md" />
            <div className="flex overflow-x-auto space-x-4 pb-4">
              {Array.from({ length: ITEMS_PER_ROW_PREVIEW }).map((_, j) => (
                <div key={j} className="w-[150px] sm:w-[160px] md:w-[180px] flex-shrink-0">
                  <div className="aspect-[2/3] w-full">
                    <Skeleton className="h-full w-full rounded-lg" />
                  </div>
                  <Skeleton className="h-4 w-3/4 mt-2 rounded-md" />
                  <Skeleton className="h-3 w-1/2 mt-1 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-0">
      <PageHeader title="Filmes" description="Explore uma vasta coleção de filmes organizados por gênero." />
      <div className="mb-6">
        <Input
          type="search"
          placeholder="Buscar por gêneros de filmes..."
          className="w-full sm:w-72"
          value={searchTerm}
          onChange={handleSearchChange}
        />
      </div>
      {hasPlaylistsConfigured ? (
        displayedGroupedMovieItems.length > 0 ? (
          displayedGroupedMovieItems.map(group => (
            <ContentGroupRow
              key={group.genre}
              title={`${group.genre} (${group.items.length})`}
              items={group.items}
              viewAllLink={`/app/movies/genre/${encodeURIComponent(group.genre.toLowerCase())}`}
              itemType="movie"
            />
          ))
        ) : (
           !isLoading && searchTerm && <p className="text-muted-foreground text-center py-8">Nenhum gênero de filme encontrado para "{searchTerm}".</p>
        ) || (
           !isLoading && <p className="text-muted-foreground text-center py-8">Nenhum filme encontrado nas suas playlists.</p>
        )
      ) : (
        <PlaceholderContent type="filmes" />
      )}
    </div>
  );
}
