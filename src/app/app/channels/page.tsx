
"use client";

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGrid } from '@/components/content-grid';
import { getAllPlaylistsMetadata, getPlaylistItems, type ChannelItem } from '@/lib/db'; // Changed PlaylistItem to ChannelItem
import type { ContentItemForCard } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';

const ITEMS_PER_PAGE = 28; 

export default function ChannelsPage() {
  const [allFetchedRawChannels, setAllFetchedRawChannels] = useState<ChannelItem[]>([]); // Changed to ChannelItem[]
  const [aggregatedChannelItems, setAggregatedChannelItems] = useState<ContentItemForCard[]>([]);
  
  const [isLoading, setIsLoading] = useState(true); 
  const [isPaginating, setIsPaginating] = useState(false); 

  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState<boolean | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const aggregateChannels = useCallback((rawChannels: ChannelItem[]): ContentItemForCard[] => { // Changed to ChannelItem[]
    const channelGroups = new Map<string, ChannelItem[]>(); // Changed to ChannelItem[]

    rawChannels.forEach(item => {
      // For ChannelItem, itemType is implicit. We check baseChannelName.
      if (item.baseChannelName) {
        if (!channelGroups.has(item.baseChannelName)) {
          channelGroups.set(item.baseChannelName, []);
        }
        channelGroups.get(item.baseChannelName)!.push(item);
      }
    });

    const aggregated: ContentItemForCard[] = [];
    channelGroups.forEach((items, baseName) => {
      const representativeItem = items[0]; 
      const uniqueQualities = Array.from(new Set(items.map(i => i.quality).filter(Boolean) as string[])).sort();
      
      aggregated.push({
        id: baseName, 
        title: baseName,
        imageUrl: representativeItem.logoUrl,
        type: 'channel',
        dataAiHint: `channel ${baseName}`.substring(0, 50).trim().toLowerCase(),
        qualities: uniqueQualities.length > 0 ? uniqueQualities : undefined,
        sourceCount: items.length,
      });
    });
    return aggregated.sort((a, b) => a.title.localeCompare(b.title));
  }, []);
  
  useEffect(() => {
    async function initializePage() {
      setIsLoading(true);
      setHasPlaylistsConfigured(null); 
      try {
        const playlists = await getAllPlaylistsMetadata();
        if (playlists.length > 0 && playlists[0]?.id) {
          const firstPlaylistId = playlists[0].id;
          setHasPlaylistsConfigured(true);
          setActivePlaylistId(firstPlaylistId);
          // Fetch ALL raw channels for this playlist from CHANNELS_STORE
          const rawItemsFromDB = await getPlaylistItems(firstPlaylistId, 'channel') as ChannelItem[]; // Specify 'channel'
          setAllFetchedRawChannels(rawItemsFromDB);
          setCurrentPage(1); 
        } else {
          setHasPlaylistsConfigured(false);
          setAllFetchedRawChannels([]);
          setAggregatedChannelItems([]); 
        }
      } catch (error) {
        console.error("Failed to initialize channels page:", error);
        setHasPlaylistsConfigured(false);
        setAllFetchedRawChannels([]);
        setAggregatedChannelItems([]);
      } finally {
        setIsLoading(false);
      }
    }
    initializePage();
  }, []); 


  useEffect(() => {
    if (!hasPlaylistsConfigured || isLoading) { 
      if (!isLoading && hasPlaylistsConfigured && allFetchedRawChannels.length === 0) {
         setAggregatedChannelItems([]);
         setHasMore(false);
      }
      return;
    }
    
    setIsPaginating(true); 

    const aggregated = aggregateChannels(allFetchedRawChannels);
    const offset = (currentPage - 1) * ITEMS_PER_PAGE;
    const nextPageItemsToDisplay = aggregated.slice(offset, offset + ITEMS_PER_PAGE);

    if (currentPage === 1) {
      setAggregatedChannelItems(nextPageItemsToDisplay);
    } else {
      setAggregatedChannelItems(prevItems => {
          const existingIds = new Set(prevItems.map(item => item.id));
          const trulyNewItems = nextPageItemsToDisplay.filter(item => !existingIds.has(item.id));
          if (trulyNewItems.length > 0) {
            return [...prevItems, ...trulyNewItems];
          }
          return prevItems;
      });
    }
    setHasMore(aggregated.length > offset + ITEMS_PER_PAGE);
    setIsPaginating(false);

  }, [allFetchedRawChannels, currentPage, aggregateChannels, hasPlaylistsConfigured, isLoading]);


  const loadMoreItems = () => {
    if (hasMore && !isLoading && !isPaginating) { 
      setCurrentPage(prevPage => prevPage + 1);
    }
  };
  
  if (hasPlaylistsConfigured === null || (isLoading && aggregatedChannelItems.length === 0) ) {
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
        (aggregatedChannelItems.length > 0 || isLoading || isPaginating) ? (
          <ContentGrid 
            items={aggregatedChannelItems} 
            type="channel" 
            isLoading={isLoading && aggregatedChannelItems.length === 0} 
            loadMoreItems={loadMoreItems}
            hasMore={hasMore}
          />
        ) : (
          !isLoading && !isPaginating && <p className="text-muted-foreground text-center py-8">Nenhum canal encontrado nas suas playlists configuradas.</p>
        )
      ) : (
        <PlaceholderContent type="canais" />
      )}
       {isPaginating && aggregatedChannelItems.length > 0 && (
        <p className="text-muted-foreground text-center py-8">Carregando mais canais...</p>
      )}
    </div>
  );
}

