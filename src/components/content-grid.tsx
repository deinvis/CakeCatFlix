import { ContentCard } from './content-card';
import type { MockContentItem } from '@/lib/constants';

interface ContentGridProps {
  items: MockContentItem[];
  type: 'movie' | 'series' | 'channel';
  genre?: string;
}

export function ContentGrid({ items, type, genre }: ContentGridProps) {
  if (!items || items.length === 0) {
    // This case should ideally be handled by PlaceholderContent at page level if items are globally empty.
    // This could be for an empty genre.
    return <p className="text-muted-foreground text-center py-8">No content found in this category.</p>;
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 md:gap-6">
      {items.map(item => (
        <ContentCard 
          key={item.id} 
          id={item.id}
          title={item.title}
          imageUrl={item.imageUrl}
          dataAiHint={item.dataAiHint}
          type={type} 
          genre={genre} 
        />
      ))}
    </div>
  );
}
