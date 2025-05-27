
"use client";

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGroupRow } from '@/components/content-group-row';
import { getAllPlaylistsMetadata, getPlaylistItems, getAllGenresForPlaylist, type SeriesItem, type EpisodeItem } from '@/lib/db';
import type { ContentItemForCard } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';

const ITEMS_PER_ROW_PREVIEW = 6;

// Helper to transform SeriesItem (which represents a unique series) to ContentItemForCard
const transformSeriesItemToCardItem = (series: SeriesItem, episodeCount: number): ContentItemForCard => ({
  id: series.id!.toString(), // Use the SeriesItem's own DB ID
  title: series.title,
  imageUrl: series.logoUrl,
  type: 'series',
  genre: series.genre,
  dataAiHint: `series ${series.title || series.genre || ''}`.substring(0, 50).trim().toLowerCase(),
  seriesId: series.id!.toString(), // The seriesId for navigation is the SeriesItem's DB ID
  sourceCount: episodeCount, // Represents number of episodes
});

interface GroupedSeries {
  genre: string;
  items: ContentItemForCard[];
}

export default function SeriesPage() {
  const [groupedSeriesItems, setGroupedSeriesItems] = useState<GroupedSeries[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState<boolean | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);

  const fetchAndGroupSeries = useCallback(async (playlistId: string) => {
    if (!playlistId) return;
    setIsLoading(true);
    try {
      // Fetch all unique SeriesItems for the playlist
      const uniqueSeriesFromDB = await getPlaylistItems(playlistId, 'series') as SeriesItem[];

      // Fetch all episodes to correctly count them for each series
      const allEpisodesFromDB = await getPlaylistItems(playlistId, 'episode') as EpisodeItem[];
      const episodeCounts = new Map<number, number>();
      allEpisodesFromDB.forEach(ep => {
        episodeCounts.set(ep.seriesDbId, (episodeCounts.get(ep.seriesDbId) || 0) + 1);
      });

      const uniqueSeriesCardItems = uniqueSeriesFromDB.map(series =>
        transformSeriesItemToCardItem(series, episodeCounts.get(series.id!) || 0)
      );

      const genres = await getAllGenresForPlaylist(playlistId, 'series');

      const groups: GroupedSeries[] = genres.map(genre => ({
        genre: genre,
        items: uniqueSeriesCardItems.filter(item => item.genre?.toLowerCase() === genre.toLowerCase())
      })).filter(group => group.items.length > 0);

      setGroupedSeriesItems(groups.sort((a,b) => a.genre.localeCompare(b.genre)));

    } catch (error) {
      console.error("Failed to fetch or group series items:", error);
      setGroupedSeriesItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function initialize() {
      setHasPlaylistsConfigured(null);
      setIsLoading(true);
      try {
        const playlists = await getAllPlaylistsMetadata();
        if (playlists.length > 0 && playlists[0]?.id) {
          setHasPlaylistsConfigured(true);
          const firstPlaylistId = playlists[0].id;
          setActivePlaylistId(firstPlaylistId);
          await fetchAndGroupSeries(firstPlaylistId);
        } else {
          setHasPlaylistsConfigured(false);
          setGroupedSeriesItems([]);
        }
      } catch (error) {
        console.error("Failed to initialize series page:", error);
        setHasPlaylistsConfigured(false);
      } finally {
        // setIsLoading(false); // fetchAndGroupSeries handles this
      }
    }
    initialize();
  }, [fetchAndGroupSeries]);

  if (hasPlaylistsConfigured === null || (isLoading && groupedSeriesItems.length === 0)) {
     return (
      <div className="container mx-auto px-0">
        <PageHeader title="Séries de TV" description="Assista suas séries favoritas e descubra novas." />
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
      {hasPlaylistsConfigured ? (
        groupedSeriesItems.length > 0 ? (
          groupedSeriesItems.map(group => (
            <ContentGroupRow
              key={group.genre}
              title={`${group.genre} (${group.items.length})`}
              items={group.items}
              viewAllLink={`/app/series/genre/${encodeURIComponent(group.genre.toLowerCase())}`}
              itemType="series"
            />
          ))
        ) : (
          !isLoading && <p className="text-muted-foreground text-center py-8">Nenhuma série encontrada nas suas playlists.</p>
        )
      ) : (
        <PlaceholderContent type="séries" />
      )}
    </div>
  );
}
