import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGrid } from '@/components/content-grid';
import { MOCK_CONTENT_ITEMS, MOCK_PLAYLISTS, MOCK_MOVIE_GENRES } from '@/lib/constants';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface GenrePageProps {
  params: {
    genreName: string;
  };
}

const hasPlaylistsConfigured = MOCK_PLAYLISTS.length > 0;

export default function MovieGenrePage({ params }: GenrePageProps) {
  const genreNameDecoded = decodeURIComponent(params.genreName);
  
  // Normalize genre name for comparison (e.g., "sci-fi" vs "Sci-Fi")
  const foundGenre = MOCK_MOVIE_GENRES.find(g => g.toLowerCase() === genreNameDecoded.toLowerCase());

  if (!foundGenre) {
    notFound();
  }

  // Filter or fetch content based on foundGenre
  // Using a dynamic hint for placeholder images based on the genre
  const movieItems = hasPlaylistsConfigured ? MOCK_CONTENT_ITEMS(12, `${foundGenre.toLowerCase()} movie poster`) : [];

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
      <PageHeader title={foundGenre} description={`Discover the best ${foundGenre} movies.`} />
      {hasPlaylistsConfigured ? (
        <ContentGrid items={movieItems} type="movie" genre={foundGenre} />
      ) : (
        <PlaceholderContent type="movies" message={`No playlists configured to show ${foundGenre} movies.`}/>
      )}
    </div>
  );
}

export async function generateStaticParams() {
  return MOCK_MOVIE_GENRES.map((genre) => ({
    genreName: encodeURIComponent(genre.toLowerCase()),
  }));
}
