
"use client";

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGroupRow } from '@/components/content-group-row';
import { getAllPlaylistsMetadata, getPlaylistItems, getAllGenresForPlaylist, type MovieItem } from '@/lib/db';
import type { ContentItemForCard } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';

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
  const [allRawMovieCardItems, setAllRawMovieCardItems] = useState<ContentItemForCard[]>([]);
  const [allMovieGenres, setAllMovieGenres] = useState<string[]>([]);
  const [displayedGroupedMovieItems, setDisplayedGroupedMovieItems] = useState<GroupedMovies[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState<boolean | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAllMovieData = useCallback(async (playlistId: string) => {
    if (!playlistId) return;
    setIsLoading(true);
    try {
      const rawMovieItemsFromDB = await getPlaylistItems(playlistId, 'movie') as MovieItem[];
      const cardItems = rawMovieItemsFromDB.map(transformMovieItemToCardItem);
      setAllRawMovieCardItems(cardItems);

      const genresFromDB = await getAllGenresForPlaylist(playlistId, 'movie');
      setAllMovieGenres(genresFromDB.sort((a,b) => a.localeCompare(b)));

    } catch (error) {
      console.error("Failed to fetch movie data:", error);
      setAllRawMovieCardItems([]);
      setAllMovieGenres([]);
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
          await fetchAllMovieData(firstPlaylistId);
        } else {
          setHasPlaylistsConfigured(false);
          setAllRawMovieCardItems([]);
          setAllMovieGenres([]);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to initialize movies page:", error);
        setHasPlaylistsConfigured(false);
        setIsLoading(false);
      }
    }
    initialize();
  }, [fetchAllMovieData]);

   useEffect(() => {
    if (isLoading) return;

    let itemsToGroup = allRawMovieCardItems;
    if (searchTerm) {
      itemsToGroup = allRawMovieCardItems.filter(item =>
        item.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    const groups: GroupedMovies[] = allMovieGenres.map(genre => ({
      genre: genre,
      items: itemsToGroup.filter(item => item.genre?.toLowerCase() === genre.toLowerCase())
    })).filter(group => group.items.length > 0);
    
    // If searching and groups result from filtered items, sort them. 
    // Otherwise, genres are already sorted.
    // No, sorting groups by genre name should always be consistent.
    const sortedGroups = groups.sort((a,b) => a.genre.localeCompare(b.genre));
    setDisplayedGroupedMovieItems(sortedGroups);

  }, [searchTerm, allRawMovieCardItems, allMovieGenres, isLoading]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  if (hasPlaylistsConfigured === null || (isLoading && allRawMovieCardItems.length === 0 && allMovieGenres.length === 0)) {
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
          placeholder="Buscar por filmes..." // Updated placeholder
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
           !isLoading && searchTerm && <p className="text-muted-foreground text-center py-8">Nenhum filme encontrado para "{searchTerm}".</p>
        ) || (
           !isLoading && <p className="text-muted-foreground text-center py-8">Nenhum filme encontrado nas suas playlists.</p>
        )
      ) : (
        <PlaceholderContent type="filmes" />
      )}
    </div>
  );
}
