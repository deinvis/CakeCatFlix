
"use client";

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGroupRow } from '@/components/content-group-row';
import { getAllPlaylistsMetadata, getPlaylistItems, getAllGenresForPlaylist, type SeriesItem, type EpisodeItem } from '@/lib/db';
import type { ContentItemForCard } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';

const ITEMS_PER_ROW_PREVIEW = 6;

const transformSeriesItemToCardItem = (series: SeriesItem, episodeCount: number): ContentItemForCard => ({
  id: series.id!.toString(),
  title: series.title,
  imageUrl: series.logoUrl,
  type: 'series',
  genre: series.genre,
  dataAiHint: `series ${series.title || series.genre || ''}`.substring(0, 50).trim().toLowerCase(),
  seriesId: series.id!.toString(), // Critical for navigation to series player
  sourceCount: episodeCount, // Number of episodes
});

interface GroupedSeries {
  genre: string;
  items: ContentItemForCard[];
}

export default function SeriesPage() {
  const [allRawSeriesCardItems, setAllRawSeriesCardItems] = useState<ContentItemForCard[]>([]);
  const [allSeriesGenres, setAllSeriesGenres] = useState<string[]>([]);
  const [displayedGroupedSeriesItems, setDisplayedGroupedSeriesItems] = useState<GroupedSeries[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState<boolean | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAllSeriesData = useCallback(async (playlistId: string) => {
    if (!playlistId) return;
    setIsLoading(true);
    try {
      // Fetch unique series (SeriesItem)
      const uniqueSeriesFromDB = await getPlaylistItems(playlistId, 'series') as SeriesItem[];
      
      // Fetch all episodes to count them for each series
      const allEpisodesFromDB = await getPlaylistItems(playlistId, 'episode') as EpisodeItem[];
      const episodeCounts = new Map<number, number>();
      allEpisodesFromDB.forEach(ep => {
        if (ep.seriesDbId !== undefined) {
          episodeCounts.set(ep.seriesDbId, (episodeCounts.get(ep.seriesDbId) || 0) + 1);
        }
      });

      const cardItems = uniqueSeriesFromDB.map(series =>
        transformSeriesItemToCardItem(series, series.id !== undefined ? (episodeCounts.get(series.id) || 0) : 0)
      );
      setAllRawSeriesCardItems(cardItems);

      const genresFromDB = await getAllGenresForPlaylist(playlistId, 'series');
      setAllSeriesGenres(genresFromDB.sort((a,b)=> a.localeCompare(b)));

    } catch (error) {
      console.error("Failed to fetch series data:", error);
      setAllRawSeriesCardItems([]);
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
          setAllRawSeriesCardItems([]);
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

    let itemsToGroup = allRawSeriesCardItems;
    if (searchTerm) {
      itemsToGroup = allRawSeriesCardItems.filter(item =>
        item.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    const groups: GroupedSeries[] = allSeriesGenres.map(genre => ({
      genre: genre,
      items: itemsToGroup.filter(item => item.genre?.toLowerCase() === genre.toLowerCase())
    })).filter(group => group.items.length > 0);

    const sortedGroups = groups.sort((a,b) => a.genre.localeCompare(b.genre));
    setDisplayedGroupedSeriesItems(sortedGroups);

  }, [searchTerm, allRawSeriesCardItems, allSeriesGenres, isLoading]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };


  if (hasPlaylistsConfigured === null || (isLoading && allRawSeriesCardItems.length === 0 && allSeriesGenres.length === 0)) {
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
          placeholder="Buscar por séries..." // Updated placeholder
          className="w-full sm:w-72"
          value={searchTerm}
          onChange={handleSearchChange}
        />
      </div>
      {hasPlaylistsConfigured ? (
        displayedGroupedSeriesItems.length > 0 ? (
          displayedGroupedSeriesItems.map(group => (
            <ContentGroupRow
              key={group.genre}
              title={`${group.genre} (${group.items.length})`}
              items={group.items}
              viewAllLink={`/app/series/genre/${encodeURIComponent(group.genre.toLowerCase())}`}
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
