
"use client";

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGroupRow } from '@/components/content-group-row';
import { getAllPlaylistsMetadata, getPlaylistItems, getAllGenresForPlaylist, type SeriesItem, type EpisodeItem } from '@/lib/db';
import type { ContentItemForCard } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { normalizeText } from '@/lib/utils';

const ITEMS_PER_ROW_PREVIEW = 6;

const transformSeriesItemToCardItem = (series: SeriesItem, episodeCount: number): ContentItemForCard => ({
  id: series.id!.toString(), // This is the SeriesItem.id
  seriesId: series.id!.toString(), // Explicitly for navigation
  title: series.title,
  imageUrl: series.logoUrl,
  type: 'series',
  genre: series.genre,
  dataAiHint: `series ${series.title || series.genre || ''}`.substring(0, 50).trim().toLowerCase(),
  sourceCount: episodeCount, // Number of episodes for this series
});

interface GroupedSeries {
  genre: string; // The original, display-friendly genre name
  items: ContentItemForCard[];
}

export default function SeriesPage() {
  const [allRawSeriesItems, setAllRawSeriesItems] = useState<SeriesItem[]>([]);
  const [allEpisodeItems, setAllEpisodeItems] = useState<EpisodeItem[]>([]);
  const [allSeriesGenres, setAllSeriesGenres] = useState<string[]>([]); // Stores original genre names
  const [displayedGroupedSeriesItems, setDisplayedGroupedSeriesItems] = useState<GroupedSeries[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState<boolean | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAllSeriesData = useCallback(async (playlistId: string) => {
    if (!playlistId) return;
    setIsLoading(true);
    try {
      const uniqueSeriesFromDB = await getPlaylistItems(playlistId, 'series') as SeriesItem[];
      setAllRawSeriesItems(uniqueSeriesFromDB);
      
      const episodesFromDB = await getPlaylistItems(playlistId, 'episode') as EpisodeItem[];
      setAllEpisodeItems(episodesFromDB);

      const genresFromDB = await getAllGenresForPlaylist(playlistId, 'series');
      setAllSeriesGenres(genresFromDB); // These are already de-duplicated original names

    } catch (error) {
      console.error("Failed to fetch series data:", error);
      setAllRawSeriesItems([]);
      setAllEpisodeItems([]);
      setAllSeriesGenres([]);
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
          await fetchAllSeriesData(firstPlaylistId);
        } else {
          setHasPlaylistsConfigured(false);
          setAllRawSeriesItems([]);
          setAllEpisodeItems([]);
          setAllSeriesGenres([]);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to initialize series page:", error);
        setHasPlaylistsConfigured(false);
        setIsLoading(false);
      }
    }
    initialize();
  }, [fetchAllSeriesData]);

   useEffect(() => {
    if (isLoading) return;

    const normalizedSearchTerm = normalizeText(searchTerm);
    let seriesToGroupAndFilter = allRawSeriesItems;

    if (searchTerm) {
      seriesToGroupAndFilter = allRawSeriesItems.filter(series =>
        normalizeText(series.title).includes(normalizedSearchTerm)
      );
    }

    const episodeCounts = new Map<number, number>();
    allEpisodeItems.forEach(ep => {
      if (ep.seriesDbId !== undefined) {
        episodeCounts.set(ep.seriesDbId, (episodeCounts.get(ep.seriesDbId) || 0) + 1);
      }
    });
    
    const groups: GroupedSeries[] = allSeriesGenres.map(originalGenre => {
      const normalizedGenre = normalizeText(originalGenre);
      const itemsForThisGenre = seriesToGroupAndFilter
        .filter(series => normalizeText(series.genre) === normalizedGenre)
        .map(series => transformSeriesItemToCardItem(series, series.id !== undefined ? (episodeCounts.get(series.id) || 0) : 0));
      
      return {
        genre: originalGenre, // Display original genre name
        items: itemsForThisGenre
      };
    }).filter(group => group.items.length > 0);
    
    setDisplayedGroupedSeriesItems(groups);

  }, [searchTerm, allRawSeriesItems, allEpisodeItems, allSeriesGenres, isLoading]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };


  if (hasPlaylistsConfigured === null || (isLoading && allRawSeriesItems.length === 0 && allSeriesGenres.length === 0)) {
     return (
      <div className="container mx-auto px-0">
        <PageHeader title="Séries de TV" description="Assista suas séries favoritas e descubra novas." />
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
      <PageHeader title="Séries de TV" description="Assista suas séries favoritas e descubra novas." />
       <div className="mb-6">
        <Input
          type="search"
          placeholder="Buscar por séries..." 
          className="w-full sm:w-72"
          value={searchTerm}
          onChange={handleSearchChange}
        />
      </div>
      {hasPlaylistsConfigured ? (
        displayedGroupedSeriesItems.length > 0 ? (
          displayedGroupedSeriesItems.map(group => (
            <ContentGroupRow
              key={group.genre} // Use original genre name as key
              title={`${group.genre} (${group.items.length})`}
              items={group.items}
              viewAllLink={`/app/series/genre/${encodeURIComponent(group.genre)}`} // Use original for link
              itemType="series"
            />
          ))
        ) : (
          !isLoading && searchTerm && <p className="text-muted-foreground text-center py-8">Nenhuma série encontrada para "{searchTerm}".</p>
        ) || (
          !isLoading && <p className="text-muted-foreground text-center py-8">Nenhuma série encontrada nas suas playlists.</p>
        )
      ) : (
        <PlaceholderContent type="séries" />
      )}
    </div>
  );
}
