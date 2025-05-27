import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGrid } from '@/components/content-grid';
import { MOCK_CONTENT_ITEMS, MOCK_PLAYLISTS, MOCK_SERIES_GENRES } from '@/lib/constants';
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

export default function SeriesGenrePage({ params }: GenrePageProps) {
  const genreNameDecoded = decodeURIComponent(params.genreName);

  const foundGenre = MOCK_SERIES_GENRES.find(g => g.toLowerCase() === genreNameDecoded.toLowerCase());

  if (!foundGenre) {
    notFound();
  }
  
  const seriesItems = hasPlaylistsConfigured ? MOCK_CONTENT_ITEMS(10, `${foundGenre.toLowerCase()} series poster`) : [];

  return (
    <div className="container mx-auto px-0">
      <div className="mb-4">
        <Button variant="outline" asChild>
          <Link href="/app/series">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Series Genres
          </Link>
        </Button>
      </div>
      <PageHeader title={foundGenre} description={`Explore the best ${foundGenre} TV series.`} />
      {hasPlaylistsConfigured ? (
        <ContentGrid items={seriesItems} type="series" genre={foundGenre} />
      ) : (
        <PlaceholderContent type="series" message={`No playlists configured to show ${foundGenre} series.`} />
      )}
    </div>
  );
}

export async function generateStaticParams() {
  return MOCK_SERIES_GENRES.map((genre) => ({
    genreName: encodeURIComponent(genre.toLowerCase()),
  }));
}
