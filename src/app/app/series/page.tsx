
"use client";

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGroupRow } from '@/components/content-group-row';
import { getAllPlaylistsMetadata, getPlaylistItems, getAllGenresForPlaylist, type PlaylistItem } from '@/lib/db';
import type { ContentItemForCard } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';

// Helper to transform PlaylistItem (series episode) to ContentItemForCard (representing a Series)
// This aggregation logic needs refinement if we want to represent unique series titles.
// For now, this creates a card per *episode* but typed as 'series' for the ContentCard display.
// A more robust solution would group episodes by seriesTitle first.
const transformPlaylistItemToSeriesCard = (item: PlaylistItem): ContentItemForCard => ({
  id: item.id!.toString(), // Each episode will still have its own ID for now
  title: item.seriesTitle || item.title, // Prefer seriesTitle if available
  imageUrl: item.logoUrl,
  type: 'series', // All items from series_episode type become 'series' card type
  genre: item.genre || item.groupTitle,
  dataAiHint: `series ${item.seriesTitle || item.genre || item.groupTitle || item.title || ''}`.substring(0, 50).trim().toLowerCase(),
  streamUrl: item.streamUrl, // This would be episode stream_url
  seriesId: item.tvgId || item.seriesTitle, // Identifier for the series
});


interface GroupedSeries {
  genre: string;
  items: ContentItemForCard[]; // These are ContentItemForCard, potentially representing unique series
}

// TODO: This page needs a more sophisticated aggregation of series episodes into unique series cards.
// The current implementation will show a card per episode, grouped by genre.
// For a true "Series" page, we should:
// 1. Fetch all 'series_episode' items.
// 2. Group them by `seriesTitle` (and `playlistDbId` to keep series from different playlists separate if needed).
// 3. For each unique series, create one `ContentItemForCard` (e.g., use logo of S01E01, count total episodes).
// 4. Then, group these *unique series cards* by genre.

export default function SeriesPage() {
  const [groupedSeriesItems, setGroupedSeriesItems] = useState<GroupedSeries[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState<boolean | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);

  const fetchAndGroupSeries = useCallback(async (playlistId: string) => {
    if (!playlistId) return;
    setIsLoading(true);
    try {
      // Fetches all 'series_episode' items
      const rawSeriesEpisodeItems = await getPlaylistItems(playlistId, 'series_episode');

      // Step 1: Aggregate episodes into unique series representations
      const seriesMap = new Map<string, ContentItemForCard>();
      rawSeriesEpisodeItems.forEach(episode => {
        const seriesKey = episode.seriesTitle || episode.title; // Key for grouping episodes into a series
        if (!seriesKey) return;

        if (!seriesMap.has(seriesKey)) {
          seriesMap.set(seriesKey, {
            id: episode.seriesTitle || episode.id!.toString(), // Use seriesTitle as ID for the series card or first episode id
            title: episode.seriesTitle || episode.title,
            imageUrl: episode.logoUrl, // Could pick one logo, e.g., from S01E01 or most recent
            type: 'series',
            genre: episode.genre || episode.groupTitle,
            dataAiHint: `series ${episode.seriesTitle || episode.genre || ''}`.substring(0, 50).trim().toLowerCase(),
            // streamUrl: undefined, // A series card doesn't have a single stream URL
            seriesId: episode.tvgId || episode.seriesTitle,
            sourceCount: 0, // This will be count of episodes
          });
        }
        const seriesCard = seriesMap.get(seriesKey)!;
        seriesCard.sourceCount = (seriesCard.sourceCount || 0) + 1;
        // Potentially update imageUrl if a better one is found (e.g., specific series cover art)
        if (episode.logoUrl && (!seriesCard.imageUrl || episode.seasonNumber === 1 && episode.episodeNumber === 1)){
            seriesCard.imageUrl = episode.logoUrl;
        }
      });
      const uniqueSeriesCardItems = Array.from(seriesMap.values());
      
      // Step 2: Group these unique series cards by genre
      const genres = Array.from(new Set(uniqueSeriesCardItems.map(s => s.genre).filter(Boolean) as string[])).sort();
      
      const groups: GroupedSeries[] = genres.map(genre => ({
        genre: genre,
        items: uniqueSeriesCardItems.filter(item => item.genre?.toLowerCase() === genre.toLowerCase())
      })).filter(group => group.items.length > 0);

      setGroupedSeriesItems(groups);

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
        setIsLoading(false);
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
              {Array.from({ length: 6 }).map((_, j) => (
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
              items={group.items} // These items are now unique series cards
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
