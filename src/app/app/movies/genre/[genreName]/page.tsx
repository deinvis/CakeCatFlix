
"use client";

import { useEffect, useState, useCallback } from 'react';
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
import { Input } from '@/components/ui/input'; // Added Input import

const ITEMS_PER_PAGE = 28;

const transformPlaylistItemToCardItem = (item: PlaylistItem): ContentItemForCard => ({
  id: item.id!.toString(),
  title: item.title,
  imageUrl: item.logoUrl,
  type: 'movie',
  genre: item.genre || item.groupTitle,
  dataAiHint: `movie ${item.genre || item.groupTitle || item.title || ''}`.substring(0, 50).trim().toLowerCase(),
  streamUrl: item.streamUrl, // Assuming streamUrl is directly on the PlaylistItem for movies
});

export default function MovieGenrePage() {
  const params = useParams<{ genreName: string }>();
  const genreNameDecoded = params.genreName ? decodeURIComponent(params.genreName) : "Unknown Genre";

  const [movieItems, setMovieItems] = useState<ContentItemForCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState<boolean|null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [genreExistsInMock, setGenreExistsInMock] = useState<boolean | null>(null);
  const [searchTerm, setSearchTerm] = useState(''); // For future search functionality

  useEffect(() => {
    // This check is based on mock genres for UI consistency before DB is fully queried for all genres
    const foundGenre = MOCK_MOVIE_GENRES.find(g => g.toLowerCase() === genreNameDecoded.toLowerCase());
    setGenreExistsInMock(!!foundGenre);
  }, [genreNameDecoded]);


  const fetchMoviesByGenre = useCallback(async (playlistId: string, genre: string, page: number) => {
    if (!playlistId || !genre) return;
    setIsLoading(true);
    try {
      const offset = (page - 1) * ITEMS_PER_PAGE;
      // TODO: When search is implemented, pass searchTerm to getPlaylistItemsByGroup
      const itemsFromDB = await getPlaylistItemsByGroup(playlistId, genre, ITEMS_PER_PAGE, offset, 'movie');
      
      const newCardItems = itemsFromDB.map(transformPlaylistItemToCardItem);
      
      setMovieItems(prevItems => page === 1 ? newCardItems : [...prevItems, ...newCardItems]);
      setHasMore(newCardItems.length === ITEMS_PER_PAGE);

    } catch (error) {
      console.error(`Failed to fetch movies for genre "${genre}":`, error);
      setMovieItems(prev => page === 1 ? [] : prev); 
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function initialize() {
      setHasPlaylistsConfigured(null);
      setIsLoading(true);
      setMovieItems([]); 
      setCurrentPage(1); 
      setHasMore(true);

      try {
        const playlists = await getAllPlaylistsMetadata();
        if (playlists.length > 0 && playlists[0]?.id) {
          setHasPlaylistsConfigured(true);
          const firstPlaylistId = playlists[0].id; 
          setActivePlaylistId(firstPlaylistId);
          await fetchMoviesByGenre(firstPlaylistId, genreNameDecoded, 1);
        } else {
          setHasPlaylistsConfigured(false);
        }
      } catch (error) {
        console.error("Failed to initialize movie genre page:", error);
        setHasPlaylistsConfigured(false);
      } finally {
        setIsLoading(false);
      }
    }
    if (genreNameDecoded !== "Unknown Genre") {
        initialize();
    } else {
        setIsLoading(false);
        setHasPlaylistsConfigured(false); 
    }
  }, [genreNameDecoded, fetchMoviesByGenre]); // fetchMoviesByGenre added as dependency

  const loadMoreItems = () => {
    if (activePlaylistId && hasMore && !isLoading) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage); 
      fetchMoviesByGenre(activePlaylistId, genreNameDecoded, nextPage);
    }
  };
  
  if (hasPlaylistsConfigured === null || (isLoading && movieItems.length === 0 && genreNameDecoded !== "Unknown Genre")) {
    return (
         <div className="container mx-auto px-0">
            <div className="mb-4">
                <Skeleton className="h-10 w-48 rounded-md" />
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
  
  if (genreExistsInMock === false && !isLoading && movieItems.length === 0 && hasPlaylistsConfigured === true) {
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
          onChange={(e) => setSearchTerm(e.target.value)}
          // TODO: Implement search logic by re-fetching or filtering client-side
        />
      </div>
      <PageHeader title={genreNameDecoded} description={`Descubra os melhores filmes de ${genreNameDecoded}.`} />
      {hasPlaylistsConfigured ? (
        movieItems.length > 0 || isLoading ? (
            <ContentGrid 
            items={movieItems} 
            type="movie" 
            isLoading={isLoading && movieItems.length === 0}
            loadMoreItems={loadMoreItems}
            hasMore={hasMore}
            />
        ) : (
             !isLoading && <p className="text-muted-foreground text-center py-8">Nenhum filme encontrado para o gênero "{genreNameDecoded}" nas suas playlists.</p>
        )
      ) : (
         <PlaceholderContent type="filmes" message={`Nenhuma playlist configurada ou nenhum filme de ${genreNameDecoded} encontrado.`}/>
      )}
       {isLoading && movieItems.length > 0 && (
        <p className="text-muted-foreground text-center py-8">Carregando mais filmes...</p>
      )}
    </div>
  );
}

