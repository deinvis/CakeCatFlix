
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

  const [allFetchedRawChannelsInGroup, setAllFetchedRawChannelsInGroup] = useState<ChannelItem[]>([]);
  const [allAggregatedBaseChannels, setAllAggregatedBaseChannels] = useState<ContentItemForCard[]>([]); // Stores ALL aggregated cards for search
  const [displayedChannelCards, setDisplayedChannelCards] = useState<ContentItemForCard[]>([]); // Paginated & Searched

  const [isLoading, setIsLoading] = useState(true);
  const [isPaginating, setIsPaginating] = useState(false);
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState<boolean|null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetches ALL raw channels for this group from the DB
  const fetchAllChannelsForGroup = useCallback(async (playlistId: string, group: string) => {
    if (!playlistId || !group) return;
    setIsLoading(true);
    try {
      const itemsFromDB = await getPlaylistItemsByGroup(playlistId, group, undefined, undefined, 'channel');
      setAllFetchedRawChannelsInGroup(itemsFromDB as ChannelItem[]);
      setCurrentPage(1); // Reset page for new group data
    } catch (error) {
      console.error(`Failed to fetch channels for group "${group}":`, error);
      setAllFetchedRawChannelsInGroup([]);
    } finally {
      setIsLoading(false); 
    }
  }, []);

  // Initializes the page, fetching playlist config and then all channels for the group
  useEffect(() => {
    async function initialize() {
      setHasPlaylistsConfigured(null);
      setIsLoading(true);
      setAllFetchedRawChannelsInGroup([]);
      setAllAggregatedBaseChannels([]);
      setDisplayedChannelCards([]);
      setCurrentPage(1);
      setHasMore(true);
      setSearchTerm('');

      try {
        const playlists = await getAllPlaylistsMetadata();
        if (playlists.length > 0 && playlists[0]?.id) {
          setHasPlaylistsConfigured(true);
          const firstPlaylistId = playlists[0].id;
          setActivePlaylistId(firstPlaylistId);
          if (groupNameDecoded !== "Unknown Group") {
            await fetchAllChannelsForGroup(firstPlaylistId, groupNameDecoded);
          } else {
             setAllFetchedRawChannelsInGroup([]);
             setIsLoading(false); // Ensure loading stops if group is unknown
          }
        } else {
          setHasPlaylistsConfigured(false);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to initialize channel group page:", error);
        setHasPlaylistsConfigured(false);
        setIsLoading(false);
      }
    }
    initialize();
  }, [groupNameDecoded, fetchAllChannelsForGroup]);

  // Aggregates raw channels once they are fetched
  useEffect(() => {
    if (isLoading || allFetchedRawChannelsInGroup.length === 0 && groupNameDecoded === "Unknown Group" && !hasPlaylistsConfigured) {
      if (!isLoading) setAllAggregatedBaseChannels([]);
      return;
    }
    
    const channelAggregates = new Map<string, ChannelItem[]>();
    allFetchedRawChannelsInGroup.forEach(item => {
      if (item.baseChannelName) {
        if (!channelAggregates.has(item.baseChannelName)) {
          channelAggregates.set(item.baseChannelName, []);
        }
        channelAggregates.get(item.baseChannelName)!.push(item);
      }
    });

    const aggregated: ContentItemForCard[] = [];
    channelAggregates.forEach((items, baseName) => {
      aggregated.push(aggregateChannelItemsToCard(baseName, items));
    });
    aggregated.sort((a,b) => a.title.localeCompare(b.title));
    setAllAggregatedBaseChannels(aggregated);
    setCurrentPage(1); // Reset page when aggregation changes

  }, [allFetchedRawChannelsInGroup, isLoading, groupNameDecoded, hasPlaylistsConfigured]);


  // Effect for filtering and pagination based on allAggregatedBaseChannels, searchTerm, and currentPage
  useEffect(() => {
    if (allAggregatedBaseChannels.length === 0 && !isLoading) { // If no base channels and not loading, ensure display is empty
        setDisplayedChannelCards([]);
        setHasMore(false);
        return;
    }
    if (isLoading && allAggregatedBaseChannels.length === 0) return; // Wait if initial load still in progress

    setIsPaginating(true);
    const filtered = allAggregatedBaseChannels.filter(card =>
      card.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const offset = (currentPage - 1) * ITEMS_PER_PAGE;
    const newPageItems = filtered.slice(offset, offset + ITEMS_PER_PAGE);

    if (currentPage === 1) {
      setDisplayedChannelCards(newPageItems);
    } else {
       // Prevent adding duplicates if effect runs multiple times with same newPageItems
        setDisplayedChannelCards(prevItems => {
            const existingIds = new Set(prevItems.map(item => item.id));
            const trulyNewItems = newPageItems.filter(item => !existingIds.has(item.id));
            return trulyNewItems.length > 0 ? [...prevItems, ...trulyNewItems] : prevItems;
        });
    }
    setHasMore(filtered.length > offset + ITEMS_PER_PAGE);
    setIsPaginating(false);

  }, [allAggregatedBaseChannels, searchTerm, currentPage, isLoading]);


  const loadMoreItems = () => {
    if (hasMore && !isLoading && !isPaginating) {
      setCurrentPage(prevPage => prevPage + 1);
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1); 
    setDisplayedChannelCards([]);
  };

  if (hasPlaylistsConfigured === null || (isLoading && allFetchedRawChannelsInGroup.length === 0 && groupNameDecoded !== "Unknown Group")) {
    return (
         <div className="container mx-auto px-0">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <Skeleton className="h-10 w-48 rounded-md" />
                <Skeleton className="h-10 w-full sm:w-auto sm:max-w-xs rounded-md" />
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

  if (!isLoading && !isPaginating && groupNameDecoded !== "Unknown Group" && displayedChannelCards.length === 0 && hasPlaylistsConfigured && !searchTerm && allAggregatedBaseChannels.length === 0) {
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
          onChange={handleSearchChange}
        />
      </div>
      <PageHeader title={groupNameDecoded} description={`Explore os canais disponíveis em ${groupNameDecoded}.`} />
      {hasPlaylistsConfigured ? (
        (displayedChannelCards.length > 0 || isLoading || isPaginating) ? (
            <ContentGrid
            items={displayedChannelCards}
            type="channel"
            isLoading={isLoading && displayedChannelCards.length === 0}
            loadMoreItems={loadMoreItems}
            hasMore={hasMore}
            />
        ) : (
             !isLoading && !isPaginating && searchTerm && <p className="text-muted-foreground text-center py-8">Nenhum canal encontrado para "{searchTerm}" no grupo "{groupNameDecoded}".</p>
        ) || (
             !isLoading && !isPaginating && <p className="text-muted-foreground text-center py-8">Nenhum canal encontrado para o grupo "{groupNameDecoded}" nas suas playlists.</p>
        )
      ) : (
         <PlaceholderContent type="canais" message={`Nenhuma playlist configurada ou nenhum canal de ${groupNameDecoded} encontrado.`}/>
      )}
       {(isPaginating && displayedChannelCards.length > 0) && (
        <p className="text-muted-foreground text-center py-8">Carregando mais canais...</p>
      )}
    </div>
  );
}
