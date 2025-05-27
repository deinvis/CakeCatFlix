
"use client";

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGrid } from '@/components/content-grid';
import { type ContentItemForCard, type ChannelItem } from '@/lib/constants';
import { getAllPlaylistsMetadata, getPlaylistItemsByGroup } from '@/lib/db';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';

const ITEMS_PER_PAGE = 28;

// Helper to transform a list of ChannelItems (for one baseChannelName) to a single ContentItemForCard
const aggregateChannelItemsToCard = (baseName: string, items: ChannelItem[]): ContentItemForCard => {
  if (items.length === 0) {
    return {
      id: baseName,
      title: baseName,
      type: 'channel',
      dataAiHint: `channel ${baseName}`.substring(0, 50).trim().toLowerCase(),
      imageUrl: `https://placehold.co/300x450.png`,
    };
  }
  const representativeItem = items[0];
  const uniqueQualities = Array.from(new Set(items.map(i => i.quality).filter(Boolean) as string[])).sort();

  return {
    id: baseName,
    title: baseName,
    imageUrl: representativeItem.logoUrl,
    type: 'channel',
    dataAiHint: `channel ${baseName}`.substring(0, 50).trim().toLowerCase(),
    qualities: uniqueQualities.length > 0 ? uniqueQualities : undefined,
    sourceCount: items.length,
  };
};

export default function ChannelGroupPage() {
  const params = useParams<{ groupName: string }>();
  const groupNameDecoded = params.groupName ? decodeURIComponent(params.groupName) : "Unknown Group";

  const [aggregatedChannelCards, setAggregatedChannelCards] = useState<ContentItemForCard[]>([]);
  const [allFetchedRawChannelsInGroup, setAllFetchedRawChannelsInGroup] = useState<ChannelItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isPaginating, setIsPaginating] = useState(false);
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState<boolean|null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const aggregateAndPaginateChannels = useCallback((rawChannels: ChannelItem[], page: number) => {
    const channelAggregates = new Map<string, ChannelItem[]>();
    rawChannels.forEach(item => {
      if (item.baseChannelName) {
        if (!channelAggregates.has(item.baseChannelName)) {
          channelAggregates.set(item.baseChannelName, []);
        }
        channelAggregates.get(item.baseChannelName)!.push(item);
      }
    });

    const allAggregatedForGroup: ContentItemForCard[] = [];
    channelAggregates.forEach((items, baseName) => {
      allAggregatedForGroup.push(aggregateChannelItemsToCard(baseName, items));
    });
    allAggregatedForGroup.sort((a,b) => a.title.localeCompare(b.title));

    const offset = (page - 1) * ITEMS_PER_PAGE;
    const nextPageItemsToDisplay = allAggregatedForGroup.slice(offset, offset + ITEMS_PER_PAGE);

    if (page === 1) {
      setAggregatedChannelCards(nextPageItemsToDisplay);
    } else {
      setAggregatedChannelCards(prevItems => {
          const existingIds = new Set(prevItems.map(item => item.id));
          const trulyNewItems = nextPageItemsToDisplay.filter(item => !existingIds.has(item.id));
          return trulyNewItems.length > 0 ? [...prevItems, ...trulyNewItems] : prevItems;
      });
    }
    setHasMore(allAggregatedForGroup.length > offset + ITEMS_PER_PAGE);
  }, []);


  const fetchChannelsByGroup = useCallback(async (playlistId: string, group: string) => {
    if (!playlistId || !group) return;
    setIsLoading(true); // Full load for initial fetch of a group
    try {
      // Fetch ALL raw channels for this group from the DB
      const itemsFromDB = await getPlaylistItemsByGroup(playlistId, group, 'channel');
      setAllFetchedRawChannelsInGroup(itemsFromDB as ChannelItem[]);
      setCurrentPage(1); // Reset to page 1 for new group data
      // Aggregation and pagination will be handled by the effect listening to allFetchedRawChannelsInGroup
    } catch (error) {
      console.error(`Failed to fetch channels for group "${group}":`, error);
      setAllFetchedRawChannelsInGroup([]);
      setAggregatedChannelCards([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function initialize() {
      setHasPlaylistsConfigured(null);
      setIsLoading(true);
      setAggregatedChannelCards([]);
      setAllFetchedRawChannelsInGroup([]);
      setCurrentPage(1);
      setHasMore(true);

      try {
        const playlists = await getAllPlaylistsMetadata();
        if (playlists.length > 0 && playlists[0]?.id) {
          setHasPlaylistsConfigured(true);
          const firstPlaylistId = playlists[0].id;
          setActivePlaylistId(firstPlaylistId);
          if (groupNameDecoded !== "Unknown Group") {
            await fetchChannelsByGroup(firstPlaylistId, groupNameDecoded);
          } else {
             setAggregatedChannelCards([]);
             setHasMore(false);
          }
        } else {
          setHasPlaylistsConfigured(false);
        }
      } catch (error) {
        console.error("Failed to initialize channel group page:", error);
        setHasPlaylistsConfigured(false);
      } finally {
        // setIsLoading(false); // fetchChannelsByGroup handles this for its part
      }
    }
    initialize();
  }, [groupNameDecoded, fetchChannelsByGroup]);

  // Effect for pagination and aggregation once raw data is fetched
  useEffect(() => {
    if (isLoading || allFetchedRawChannelsInGroup.length === 0 && groupNameDecoded === "Unknown Group") {
        if (!isLoading && allFetchedRawChannelsInGroup.length === 0 && hasPlaylistsConfigured) {
            setAggregatedChannelCards([]);
            setHasMore(false);
        }
        return;
    }
    setIsPaginating(true);
    aggregateAndPaginateChannels(allFetchedRawChannelsInGroup, currentPage);
    setIsPaginating(false);
  }, [allFetchedRawChannelsInGroup, currentPage, aggregateAndPaginateChannels, isLoading, hasPlaylistsConfigured, groupNameDecoded]);


  const loadMoreItems = () => {
    if (hasMore && !isLoading && !isPaginating) {
      setCurrentPage(prevPage => prevPage + 1);
    }
  };

  if (hasPlaylistsConfigured === null || (isLoading && aggregatedChannelCards.length === 0 && groupNameDecoded !== "Unknown Group")) {
    return (
         <div className="container mx-auto px-0">
            <div className="mb-4">
                <Skeleton className="h-10 w-48 rounded-md" />
            </div>
            <PageHeader title={groupNameDecoded} description={`Procurando canais em ${groupNameDecoded}...`} />
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

  if (!isLoading && !isPaginating && groupNameDecoded !== "Unknown Group" && aggregatedChannelCards.length === 0 && hasPlaylistsConfigured) {
     return (
      <div className="container mx-auto px-0 py-8 text-center">
        <PageHeader title="Grupo Vazio ou Inválido" description={`O grupo de canais "${groupNameDecoded}" não contém canais ou não foi encontrado.`} />
        <Button variant="outline" asChild className="mt-4">
          <Link href="/app/channels">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Grupos de Canais
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-0">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Button variant="outline" asChild>
          <Link href="/app/channels">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Grupos de Canais
          </Link>
        </Button>
        <Input
          type="search"
          placeholder={`Buscar em ${groupNameDecoded}...`}
          className="w-full sm:w-auto sm:max-w-xs"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          // TODO: Implement search logic by re-fetching or filtering client-side
        />
      </div>
      <PageHeader title={groupNameDecoded} description={`Explore os canais disponíveis em ${groupNameDecoded}.`} />
      {hasPlaylistsConfigured ? (
        aggregatedChannelCards.length > 0 || isLoading || isPaginating ? (
            <ContentGrid
            items={aggregatedChannelCards}
            type="channel" // Type is channel for ContentCard styling
            isLoading={isLoading && aggregatedChannelCards.length === 0}
            loadMoreItems={loadMoreItems}
            hasMore={hasMore}
            />
        ) : (
             !isLoading && !isPaginating && <p className="text-muted-foreground text-center py-8">Nenhum canal encontrado para o grupo "{groupNameDecoded}" nas suas playlists.</p>
        )
      ) : (
         <PlaceholderContent type="canais" message={`Nenhuma playlist configurada ou nenhum canal de ${groupNameDecoded} encontrado.`}/>
      )}
       {(isLoading && aggregatedChannelCards.length > 0) || (isPaginating && aggregatedChannelCards.length > 0) && (
        <p className="text-muted-foreground text-center py-8">Carregando mais canais...</p>
      )}
    </div>
  );
}
