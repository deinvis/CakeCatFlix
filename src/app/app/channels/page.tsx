
"use client";

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGroupRow } from '@/components/content-group-row'; // Changed from ContentGrid
import { getAllPlaylistsMetadata, getPlaylistItems, getAllGenresForPlaylist, type ChannelItem } from '@/lib/db';
import type { ContentItemForCard } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';

const ITEMS_PER_ROW_PREVIEW = 6;

// Helper to transform a list of ChannelItems (for one baseChannelName) to a single ContentItemForCard
const aggregateChannelItemsToCard = (baseName: string, items: ChannelItem[]): ContentItemForCard => {
  if (items.length === 0) {
    // Should not happen if called correctly, but handle defensively
    return {
      id: baseName,
      title: baseName,
      type: 'channel',
      dataAiHint: `channel ${baseName}`.substring(0, 50).trim().toLowerCase(),
      imageUrl: `https://placehold.co/300x450.png`, // Default placeholder
    };
  }
  const representativeItem = items[0]; // Use first item for general info like logo
  const uniqueQualities = Array.from(new Set(items.map(i => i.quality).filter(Boolean) as string[])).sort();

  return {
    id: baseName, // ID for aggregated card is the baseChannelName
    title: baseName,
    imageUrl: representativeItem.logoUrl,
    type: 'channel',
    dataAiHint: `channel ${baseName}`.substring(0, 50).trim().toLowerCase(),
    qualities: uniqueQualities.length > 0 ? uniqueQualities : undefined,
    sourceCount: items.length,
  };
};

interface GroupedChannels {
  groupTitle: string;
  items: ContentItemForCard[]; // These are aggregated channel cards
}

export default function ChannelsPage() {
  const [groupedChannelItems, setGroupedChannelItems] = useState<GroupedChannels[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState<boolean | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);

  const fetchAndGroupChannels = useCallback(async (playlistId: string) => {
    if (!playlistId) return;
    setIsLoading(true);
    try {
      const rawChannelItemsFromDB = await getPlaylistItems(playlistId, 'channel') as ChannelItem[];
      const groupTitles = await getAllGenresForPlaylist(playlistId, 'channel'); // Gets unique groupTitles for channels

      const groups: GroupedChannels[] = groupTitles.map(groupTitle => {
        const channelsInGroup = rawChannelItemsFromDB.filter(ch => ch.groupTitle === groupTitle);

        // Aggregate channels within this group by baseChannelName
        const channelAggregates = new Map<string, ChannelItem[]>();
        channelsInGroup.forEach(item => {
          if (item.baseChannelName) {
            if (!channelAggregates.has(item.baseChannelName)) {
              channelAggregates.set(item.baseChannelName, []);
            }
            channelAggregates.get(item.baseChannelName)!.push(item);
          }
        });

        const aggregatedCardsForGroup: ContentItemForCard[] = [];
        channelAggregates.forEach((items, baseName) => {
          aggregatedCardsForGroup.push(aggregateChannelItemsToCard(baseName, items));
        });
        
        return {
          groupTitle: groupTitle,
          items: aggregatedCardsForGroup.sort((a,b) => a.title.localeCompare(b.title))
        };
      }).filter(group => group.items.length > 0); // Only keep groups with items

      setGroupedChannelItems(groups.sort((a,b) => a.groupTitle.localeCompare(b.groupTitle)));

    } catch (error) {
      console.error("Failed to fetch or group channel items:", error);
      setGroupedChannelItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function initializePage() {
      setHasPlaylistsConfigured(null);
      setIsLoading(true);
      try {
        const playlists = await getAllPlaylistsMetadata();
        if (playlists.length > 0 && playlists[0]?.id) {
          setHasPlaylistsConfigured(true);
          const firstPlaylistId = playlists[0].id;
          setActivePlaylistId(firstPlaylistId);
          await fetchAndGroupChannels(firstPlaylistId);
        } else {
          setHasPlaylistsConfigured(false);
          setGroupedChannelItems([]);
        }
      } catch (error) {
        console.error("Failed to initialize channels page:", error);
        setHasPlaylistsConfigured(false);
      } finally {
        // setIsLoading(false); // fetchAndGroupChannels handles this
      }
    }
    initializePage();
  }, [fetchAndGroupChannels]);


  if (hasPlaylistsConfigured === null || (isLoading && groupedChannelItems.length === 0)) {
    return (
      <div className="container mx-auto px-0">
        <PageHeader title="Canais ao Vivo" description="Assista seus canais de TV favoritos."/>
        {Array.from({ length: 3 }).map((_, i) => ( // Skeleton for 3 rows
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
      <PageHeader title="Canais ao Vivo" description="Assista seus canais de TV favoritos, organizados por categoria."/>
      {hasPlaylistsConfigured ? (
        (groupedChannelItems.length > 0) ? (
          groupedChannelItems.map(group => (
            <ContentGroupRow
              key={group.groupTitle}
              title={`${group.groupTitle} (${group.items.length})`}
              items={group.items} // These are aggregated ContentItemForCard
              viewAllLink={`/app/channels/group/${encodeURIComponent(group.groupTitle.toLowerCase())}`}
              itemType="channel"
            />
          ))
        ) : (
          !isLoading && <p className="text-muted-foreground text-center py-8">Nenhum canal encontrado nas suas playlists configuradas.</p>
        )
      ) : (
        <PlaceholderContent type="canais" />
      )}
    </div>
  );
}
