
"use client";

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGrid } from '@/components/content-grid';
import { getAllPlaylistsMetadata, getPlaylistItems, type PlaylistItem } from '@/lib/db';
import type { ContentItemForCard } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';

const ITEMS_PER_PAGE = 28; 

interface AggregatedChannel extends ContentItemForCard {
  originalItems: PlaylistItem[];
}

export default function ChannelsPage() {
  const [aggregatedChannelItems, setAggregatedChannelItems] = useState<ContentItemForCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState<boolean | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  
  // For pagination of aggregated channels
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [allFetchedRawChannels, setAllFetchedRawChannels] = useState<PlaylistItem[]>([]);


  const aggregateChannels = useCallback((rawChannels: PlaylistItem[]): ContentItemForCard[] => {
    const channelGroups = new Map<string, PlaylistItem[]>();

    rawChannels.forEach(item => {
      if (item.itemType === 'channel' && item.baseChannelName) {
        if (!channelGroups.has(item.baseChannelName)) {
          channelGroups.set(item.baseChannelName, []);
        }
        channelGroups.get(item.baseChannelName)!.push(item);
      }
    });

    const aggregated: ContentItemForCard[] = [];
    channelGroups.forEach((items, baseName) => {
      const representativeItem = items[0]; // Use first item for common details
      const uniqueQualities = Array.from(new Set(items.map(i => i.quality).filter(Boolean) as string[])).sort();
      
      aggregated.push({
        id: baseName, // Use baseName as a unique ID for the aggregated card
        title: baseName,
        imageUrl: representativeItem.logoUrl,
        type: 'channel',
        dataAiHint: `channel ${baseName}`.substring(0, 50).trim().toLowerCase(),
        qualities: uniqueQualities.length > 0 ? uniqueQualities : undefined,
        sourceCount: items.length,
        // streamUrl is intentionally omitted for aggregated card; player page should handle selection
      });
    });
    return aggregated.sort((a, b) => a.title.localeCompare(b.title)); // Sort by title
  }, []);
  
  const fetchAndAggregateChannels = useCallback(async (playlistId: string, initialFetch: boolean = false) => {
    if (!playlistId) return;
    setIsLoading(true);
    try {
      // For channels, we fetch ALL channels from the playlist at once to perform aggregation.
      // Pagination will be applied to the *aggregated* list.
      // If this becomes too slow for extremely large playlists, a more complex server-side/worker aggregation might be needed.
      const rawItemsFromDB = await getPlaylistItems(playlistId, 'channel'); // Fetches all channels
      
      if (initialFetch) {
        setAllFetchedRawChannels(rawItemsFromDB);
        const aggregated = aggregateChannels(rawItemsFromDB);
        const paginatedAggregated = aggregated.slice(0, ITEMS_PER_PAGE);
        setAggregatedChannelItems(paginatedAggregated);
        setHasMore(aggregated.length > ITEMS_PER_PAGE);
        setCurrentPage(1);
      } else {
        // This part handles loading more *aggregated* items
        const currentAggregatedList = aggregateChannels(allFetchedRawChannels);
        const offset = currentPage * ITEMS_PER_PAGE;
        const nextPageItems = currentAggregatedList.slice(offset, offset + ITEMS_PER_PAGE);
        setAggregatedChannelItems(prev => [...prev, ...nextPageItems]);
        setHasMore(currentAggregatedList.length > offset + ITEMS_PER_PAGE);
      }

    } catch (error) {
      console.error("Failed to fetch or aggregate channel items:", error);
    } finally {
      setIsLoading(false);
    }
  }, [aggregateChannels, allFetchedRawChannels, currentPage]);


  useEffect(() => {
    async function initialize() {
      setIsLoading(true);
      setHasPlaylistsConfigured(null); // Set to null to show loading skeleton
      try {
        const playlists = await getAllPlaylistsMetadata();
        if (playlists.length > 0 && playlists[0]?.id) {
          setHasPlaylistsConfigured(true);
          const firstPlaylistId = playlists[0].id;
          setActivePlaylistId(firstPlaylistId);
          await fetchAndAggregateChannels(firstPlaylistId, true); // Initial fetch
        } else {
          setHasPlaylistsConfigured(false);
          setAggregatedChannelItems([]);
          setAllFetchedRawChannels([]);
        }
      } catch (error) {
        console.error("Failed to initialize channels page:", error);
        setHasPlaylistsConfigured(false);
      } finally {
        setIsLoading(false);
      }
    }
    initialize();
  }, [fetchAndAggregateChannels]); // fetchAndAggregateChannels will manage its own dependencies

  const loadMoreItems = () => {
    if (activePlaylistId && hasMore && !isLoading) {
      setCurrentPage(prevPage => {
        const nextPage = prevPage + 1;
        // We don't re-fetch raw channels, just re-paginate the existing aggregated list
        // The fetchAndAggregateChannels handles this logic based on `initialFetch` flag.
        // However, the current fetchAndAggregateChannels is not setup for this,
        // so we need to adjust how `loadMoreItems` works with pre-fetched raw data.
        
        // Re-aggregate and slice the next page
        const currentAggregatedList = aggregateChannels(allFetchedRawChannels);
        const offset = nextPage * ITEMS_PER_PAGE; // offset for the *next* page
        const newPageAggregatedItems = currentAggregatedList.slice((nextPage-1)*ITEMS_PER_PAGE, nextPage*ITEMS_PER_PAGE);

        setAggregatedChannelItems(prevAggregated => {
             // Ensure we don't add duplicates if items were already loaded
            const existingIds = new Set(prevAggregated.map(item => item.id));
            const trulyNewItems = newPageAggregatedItems.filter(item => !existingIds.has(item.id));
            return [...prevAggregated, ...trulyNewItems];
        });
        setHasMore(currentAggregatedList.length > nextPage * ITEMS_PER_PAGE);
        return nextPage;
      });
    }
  };
  
  if (hasPlaylistsConfigured === null) {
    return (
      <div className="container mx-auto px-0">
        <PageHeader title="Canais ao Vivo" description="Assista seus canais de TV favoritos."/>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 md:gap-6">
          {Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
            <div key={i} className="aspect-[2/3] w-full">
              <Skeleton className="h-full w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4 mt-2 rounded-md" />
               <Skeleton className="h-3 w-1/2 mt-1 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-0">
      <PageHeader title="Canais ao Vivo" description="Assista seus canais de TV favoritos."/>
      {hasPlaylistsConfigured ? (
        aggregatedChannelItems.length > 0 || isLoading ? (
          <ContentGrid 
            items={aggregatedChannelItems} 
            type="channel" 
            isLoading={isLoading && aggregatedChannelItems.length === 0} // Show loading only if no items yet
            loadMoreItems={loadMoreItems}
            hasMore={hasMore}
          />
        ) : (
          <p className="text-muted-foreground text-center py-8">Nenhum canal encontrado nas suas playlists configuradas.</p>
        )
      ) : (
        <PlaceholderContent type="canais" />
      )}
       {isLoading && aggregatedChannelItems.length > 0 && (
        <p className="text-muted-foreground text-center py-8">Carregando mais canais...</p>
      )}
    </div>
  );
}
