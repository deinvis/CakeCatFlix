import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

interface ContentCardProps {
  id: string;
  title: string;
  imageUrl: string;
  type: 'movie' | 'series' | 'channel';
  genre?: string; // For constructing genre-specific links if needed
  dataAiHint: string;
}

export function ContentCard({ id, title, imageUrl, type, genre, dataAiHint }: ContentCardProps) {
  // Simplified link: assumes a detail page exists at /app/[type]s/[id] or /app/[type]s/genre/[genre]/[id]
  // This structure might need adjustment based on actual routing for detail pages.
  // For now, clicking a card doesn't lead to a specific implemented page beyond genre listing.
  const detailPath = genre ? `/app/${type}s/genre/${encodeURIComponent(genre.toLowerCase())}#${id}` : `/app/${type}s#${id}`;

  return (
    <Link href={detailPath} className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg">
      <Card className="overflow-hidden transition-all duration-300 ease-in-out group-hover:shadow-2xl group-hover:scale-105 group-focus:scale-105 group-focus:shadow-2xl bg-card border-border hover:border-primary/50 focus:border-primary/50">
        <CardContent className="p-0">
          <div className="aspect-[2/3] relative w-full bg-muted overflow-hidden">
            <Image 
              src={imageUrl} 
              alt={title} 
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
              className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-110 group-focus:scale-110" 
              data-ai-hint={dataAiHint}
            />
          </div>
          <div className="p-3 min-h-[60px] flex items-center">
            <h3 className="font-semibold text-sm text-foreground group-hover:text-primary group-focus:text-primary line-clamp-2 leading-tight">
              {title}
            </h3>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
