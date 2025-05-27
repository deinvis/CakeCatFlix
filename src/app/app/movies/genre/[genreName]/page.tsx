
"use client";

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGrid } from '@/components/content-grid';
import { MOCK_MOVIE_GENRES, type ContentItemForCard, type PlaylistItemCore } from '@/lib/constants';
import { getAllPlaylistsMetadata, getPlaylistItemsByGroup } from '@/lib/db';
import { notFound, useParams } from 'next/navigation'; // Use useParams for client component
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const ITEMS_PER_PAGE = 28;

// Helper function (can be moved to a shared utils if used elsewhere)
const transformPlaylistItemToCardItem = (item: PlaylistItemCore): ContentItemForCard => ({
  id: item.id!.toString(),
  title: item.displayName || item.tvgName || 'Unknown Movie',
  imageUrl: item.tvgLogo,
  type: 'movie',
  genre: item.groupTitle,
  dataAiHint: `movie ${item.groupTitle || item.displayName || ''}`.substring(0, 50).trim().toLowerCase(),
  streamUrl: item.url,
});

export default function MovieGenrePage() {
  const params = useParams<{ genreName: string }>(); // Use hook for params
  const genreNameDecoded = decodeURIComponent(params.genreName);

  const [movieItems, setMovieItems] = useState<ContentItemForCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState(false);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [genreExists, setGenreExists] = useState<boolean | null>(null);


  // Validate genre (client-side, consider implications if generateStaticParams is used)
  useEffect(() => {
    const foundGenre = MOCK_MOVIE_GENRES.find(g => g.toLowerCase() === genreNameDecoded.toLowerCase());
    setGenreExists(!!foundGenre);
    if (!foundGenre) {
        // notFound() can only be used in Server Components.
        // For client components, you might redirect or show a "not found" UI.
        // For now, we will rely on the ContentGrid showing "no content" if items are empty.
        console.warn(`Genre "${genreNameDecoded}" not found in MOCK_MOVIE_GENRES.`);
    }
  }, [genreNameDecoded]);


  const fetchMoviesByGenre = useCallback(async (playlistId: string, genre: string, page: number) => {
    if (!playlistId || !genre) return;
    setIsLoading(true);
    try {
      const offset = (page - 1) * ITEMS_PER_PAGE;
      const itemsFromDB = await getPlaylistItemsByGroup(playlistId, genre, ITEMS_PER_PAGE, offset);
      
      const newCardItems = itemsFromDB.map(transformPlaylistItemToCardItem);
      
      setMovieItems(prevItems => page === 1 ? newCardItems : [...prevItems, ...newCardItems]);
      setHasMore(newCardItems.length === ITEMS_PER_PAGE);

    } catch (error) {
      console.error(`Failed to fetch movies for genre "${genre}":`, error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function initialize() {
      setIsLoading(true);
      try {
        const playlists = await getAllPlaylistsMetadata();
        if (playlists.length > 0) {
          setHasPlaylistsConfigured(true);
          const firstPlaylistId = playlists[0].id; // Use first playlist
          setActivePlaylistId(firstPlaylistId);
          setMovieItems([]);
          setCurrentPage(1);
          // The genre for getPlaylistItemsByGroup should be the actual groupTitle from M3U
          // MOCK_MOVIE_GENRES might not perfectly match group-title values.
          // For now, we assume genreNameDecoded is a valid groupTitle or a close match.
          // A more robust solution would be to fetch all unique groupTitles from DB.
          await fetchMoviesByGenre(firstPlaylistId, genreNameDecoded, 1);
        } else {
          setHasPlaylistsConfigured(false);
          setMovieItems([]);
        }
      } catch (error) {
        console.error("Failed to initialize movie genre page:", error);
        setHasPlaylistsConfigured(false);
      } finally {
        setIsLoading(false);
      }
    }
    if (genreExists === true) { // Only initialize if genre is valid based on MOCK_MOVIE_GENRES
        initialize();
    } else if (genreExists === false) {
        setIsLoading(false); // Stop loading if genre is invalid
        setHasPlaylistsConfigured(false); // Assume no content can be shown
    }
  }, [genreNameDecoded, fetchMoviesByGenre, genreExists]);

  const loadMoreItems = () => {
    if (activePlaylistId && hasMore && !isLoading && genreExists) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      fetchMoviesByGenre(activePlaylistId, genreNameDecoded, nextPage);
    }
  };

  if (genreExists === false && !isLoading) {
    // Handle not found on client side if preferred over just showing empty content grid
    // This check runs after initial useEffect for genreExists determination
     return (
      <div className="container mx-auto px-0 py-8 text-center">
        <PageHeader title="Genre Not Found" description={`The movie genre "${genreNameDecoded}" does not exist.`} />
        <Button variant="outline" asChild className="mt-4">
          <Link href="/app/movies">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Movie Genres
          </Link>
        </Button>
      </div>
    );
  }


  return (
    <div className="container mx-auto px-0">
      <div className="mb-4">
        <Button variant="outline" asChild>
          <Link href="/app/movies">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Movie Genres
          </Link>
        </Button>
      </div>
      <PageHeader title={genreNameDecoded} description={`Discover the best ${genreNameDecoded} movies.`} />
      {hasPlaylistsConfigured ? (
        <ContentGrid 
          items={movieItems} 
          type="movie" 
          genre={genreNameDecoded} 
          isLoading={isLoading}
          loadMoreItems={loadMoreItems}
          hasMore={hasMore}
        />
      ) : (
         isLoading ? <p className="text-muted-foreground text-center py-8">Verificando playlists e filmes...</p> : <PlaceholderContent type="movies" message={`No playlists configured or no ${genreNameDecoded} movies found.`}/>
      )}
    </div>
  );
}

// generateStaticParams might need to be re-evaluated if MOCK_MOVIE_GENRES
// is replaced by dynamic genres from the database.
// For now, it uses MOCK_MOVIE_GENRES. If a genre from DB is accessed directly
// via URL and not in this list, it would be a dynamic route render (SSR/ISR).
export async function generateStaticParams() {
  return MOCK_MOVIE_GENRES.map((genre) => ({
    genreName: encodeURIComponent(genre.toLowerCase()),
  }));
}
