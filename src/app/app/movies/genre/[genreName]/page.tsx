
"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGrid } from '@/components/content-grid';
import { type ContentItemForCard, type PlaylistItem, MOCK_MOVIE_GENRES } from '@/lib/constants';
import { getAllPlaylistsMetadata, getPlaylistItemsByGroup } from '@/lib/db';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';

const ITEMS_PER_PAGE = 28;

const transformPlaylistItemToCardItem = (item: PlaylistItem): ContentItemForCard => ({
  id: item.id!.toString(),
  title: item.title,
  imageUrl: item.logoUrl,
  type: 'movie',
  genre: item.genre || item.groupTitle,
  dataAiHint: `movie ${item.genre || item.groupTitle || item.title || ''}`.substring(0, 50).trim().toLowerCase(),
  streamUrl: item.streamUrl,
});

export default function MovieGenrePage() {
  const params = useParams<{ genreName: string }>();
  const genreNameDecoded = params.genreName ? decodeURIComponent(params.genreName) : "Unknown Genre";

  const [allFetchedItemsForGenre, setAllFetchedItemsForGenre] = useState<ContentItemForCard[]>([]);
  const [displayedItems, setDisplayedItems] = useState<ContentItemForCard[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isPaginating, setIsPaginating] = useState(false);
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState<boolean|null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [genreExistsInMock, setGenreExistsInMock] = useState<boolean | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const foundGenre = MOCK_MOVIE_GENRES.find(g => g.toLowerCase() === genreNameDecoded.toLowerCase());
    setGenreExistsInMock(!!foundGenre);
  }, [genreNameDecoded]);

  const fetchAllMoviesForGenre = useCallback(async (playlistId: string, genre: string) => {
    if (!playlistId || !genre) return;
    setIsLoading(true);
    try {
      // Fetch ALL items for this genre from the DB, no limit/offset initially for client-side search
      const itemsFromDB = await getPlaylistItemsByGroup(playlistId, genre, undefined, undefined, 'movie');
      const cardItems = itemsFromDB.map(transformPlaylistItemToCardItem);
      setAllFetchedItemsForGenre(cardItems);
      setCurrentPage(1); // Reset page when new full list is fetched
    } catch (error) {
      console.error(`Failed to fetch all movies for genre "${genre}":`, error);
      setAllFetchedItemsForGenre([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function initialize() {
      setHasPlaylistsConfigured(null);
      setIsLoading(true);
      setAllFetchedItemsForGenre([]);
      setDisplayedItems([]);
      setCurrentPage(1);
      setHasMore(true);
      setSearchTerm('');

      try {
        const playlists = await getAllPlaylistsMetadata();
        if (playlists.length > 0 && playlists[0]?.id) {
          setHasPlaylistsConfigured(true);
          const firstPlaylistId = playlists[0].id;
          setActivePlaylistId(firstPlaylistId);
          if (genreNameDecoded !== "Unknown Genre") {
            await fetchAllMoviesForGenre(firstPlaylistId, genreNameDecoded);
          } else {
            setAllFetchedItemsForGenre([]);
          }
        } else {
          setHasPlaylistsConfigured(false);
        }
      } catch (error) {
        console.error("Failed to initialize movie genre page:", error);
        setHasPlaylistsConfigured(false);
      }
    }
    if (genreNameDecoded !== "Unknown Genre") {
        initialize();
    } else {
        setIsLoading(false);
        setDisplayedItems([]);
        setHasPlaylistsConfigured(false);
    }
  }, [genreNameDecoded, fetchAllMoviesForGenre]);

  // Effect for filtering and pagination
  useEffect(() => {
    if (isLoading) return; // Don't process if initial full load is happening

    setIsPaginating(true);
    const filtered = allFetchedItemsForGenre.filter(item =>
      item.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const offset = (currentPage - 1) * ITEMS_PER_PAGE;
    const newPageItems = filtered.slice(offset, offset + ITEMS_PER_PAGE);

    if (currentPage === 1) {
      setDisplayedItems(newPageItems);
    } else {
      setDisplayedItems(prevItems => [...prevItems, ...newPageItems]);
    }
    setHasMore(filtered.length > offset + ITEMS_PER_PAGE);
    setIsPaginating(false);

  }, [allFetchedItemsForGenre, searchTerm, currentPage, isLoading]);


  const loadMoreItems = () => {
    if (hasMore && !isPaginating && !isLoading) {
      setCurrentPage(prevPage => prevPage + 1);
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1); // Reset to first page on new search
    setDisplayedItems([]); // Clear displayed items to re-trigger pagination effect for new search
  };
  
  if (hasPlaylistsConfigured === null || (isLoading && allFetchedItemsForGenre.length === 0 && genreNameDecoded !== "Unknown Genre")) {
    return (
         <div className="container mx-auto px-0">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <Skeleton className="h-10 w-48 rounded-md" />
                <Skeleton className="h-10 w-full sm:w-auto sm:max-w-xs rounded-md" />
            </div>
            <PageHeader title={genreNameDecoded} description={`Descobrindo os melhores filmes de ${genreNameDecoded}...`} />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 md:gap-6">
            {Array.from({ length: 14 }).map((_, i) => (
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
  
  if (genreExistsInMock === false && !isLoading && allFetchedItemsForGenre.length === 0 && hasPlaylistsConfigured === true) {
     return (
      <div className="container mx-auto px-0 py-8 text-center">
        <PageHeader title="Gênero Não Encontrado" description={`O gênero de filme "${genreNameDecoded}" não parece existir ou nenhum conteúdo está disponível nas suas playlists.`} />
        <Button variant="outline" asChild className="mt-4">
          <Link href="/app/movies">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Gêneros de Filmes
          </Link>
        </Button>
      </div>
    );
  }


  return (
    <div className="container mx-auto px-0">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Button variant="outline" asChild>
          <Link href="/app/movies">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Gêneros de Filmes
          </Link>
        </Button>
        <Input 
          type="search" 
          placeholder={`Buscar em ${genreNameDecoded}...`} 
          className="w-full sm:w-auto sm:max-w-xs"
          value={searchTerm}
          onChange={handleSearchChange}
        />
      </div>
      <PageHeader title={genreNameDecoded} description={`Descubra os melhores filmes de ${genreNameDecoded}.`} />
      {hasPlaylistsConfigured ? (
        (displayedItems.length > 0 || isLoading || isPaginating) ? (
            <ContentGrid 
            items={displayedItems} 
            type="movie" 
            isLoading={isLoading && displayedItems.length === 0} // Show loading for grid only if it's the initial full load and no items yet
            loadMoreItems={loadMoreItems}
            hasMore={hasMore}
            />
        ) : (
             !isLoading && !isPaginating && searchTerm && <p className="text-muted-foreground text-center py-8">Nenhum filme encontrado para "{searchTerm}" em "{genreNameDecoded}".</p>
        ) || (
             !isLoading && !isPaginating && <p className="text-muted-foreground text-center py-8">Nenhum filme encontrado para o gênero "{genreNameDecoded}" nas suas playlists.</p>
        )
      ) : (
         <PlaceholderContent type="filmes" message={`Nenhuma playlist configurada ou nenhum filme de ${genreNameDecoded} encontrado.`}/>
      )}
       {(isPaginating && displayedItems.length > 0) && ( // Show paginating indicator if not initial load
        <p className="text-muted-foreground text-center py-8">Carregando mais filmes...</p>
      )}
    </div>
  );
}

