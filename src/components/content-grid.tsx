import { ContentCard } from './content-card';
import type { ContentItemForCard } from '@/lib/constants'; // Updated type

interface ContentGridProps {
  items: ContentItemForCard[];
  type: 'movie' | 'series' | 'channel'; // Retained for ContentCard, might be redundant if item has type
  genre?: string; // Retained for ContentCard context
  isLoading?: boolean;
  loadMoreItems?: () => void; // Optional function to load more items
  hasMore?: boolean; // Optional flag to indicate if more items can be loaded
}

export function ContentGrid({ items, type, genre, isLoading, loadMoreItems, hasMore }: ContentGridProps) {
  if (isLoading && items.length === 0) {
     return <p className="text-muted-foreground text-center py-8">Carregando conteúdo...</p>;
  }
  
  if (!items || items.length === 0) {
    return <p className="text-muted-foreground text-center py-8">Nenhum conteúdo encontrado nesta categoria.</p>;
  }

  // This is a very basic way to trigger loadMore. 
  // A more robust solution would use Intersection Observer.
  // For now, a button if `loadMoreItems` is provided.
  // Or, it could be attached to the scroll event of the parent container.

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 md:gap-6">
        {items.map(item => (
          <ContentCard 
            key={item.id} 
            id={item.id} // This ID comes from ContentItemForCard, should be unique string
            title={item.title}
            imageUrl={item.imageUrl}
            dataAiHint={item.dataAiHint} // Ensure this is populated from DB item or defaulted
            type={item.type} // Use item's own type
            genre={item.genre || genre} // Use item's genre or context genre
            // streamUrl={item.streamUrl} // If ContentCard needs it directly
          />
        ))}
      </div>
      {isLoading && items.length > 0 && (
        <p className="text-muted-foreground text-center py-8">Carregando mais...</p>
      )}
      {loadMoreItems && hasMore && !isLoading && (
        <div className="flex justify-center mt-8">
          <button 
            onClick={loadMoreItems}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Carregar Mais
          </button>
        </div>
      )}
    </>
  );
}
