import Image from 'next/image';
import Link from 'next/link'; // Link might not be used if we handle click differently for player
import { Card, CardContent } from '@/components/ui/card';
import type { ContentItemForCard } from '@/lib/constants'; // Import the specific type

// Update props to use ContentItemForCard or a subset of its properties
interface ContentCardProps extends Omit<ContentItemForCard, 'id' | 'dataAiHint' | 'streamUrl'> {
  // id from ContentItemForCard will be a string, consistent with original MockContentItem's id
  // This id is item.id.toString() from PlaylistItemCore in channels/page.tsx
  // Or it could be a unique string ID generated if PlaylistItemCore.id is not suitable directly
  id: string; 
  dataAiHint: string;
  streamUrl?: string; // Make streamUrl optional if not always present/needed by card directly
}


export function ContentCard({ id, title, imageUrl, type, genre, dataAiHint, streamUrl }: ContentCardProps) {
  // Simplified link: clicking a card could open a player or a detail page.
  // For now, let's assume it might try to navigate, but player integration is separate.
  // The `id` here is the `item.id.toString()` from the database item's primary key.
  const detailPath = genre 
    ? `/app/${type}s/genre/${encodeURIComponent(genre.toLowerCase())}#${id}` 
    : `/app/${type}s#${id}`;

  // Fallback image if imageUrl is not provided or invalid
  const imageSrc = imageUrl || `https://placehold.co/300x450.png`;
  const finalDataAiHint = dataAiHint || `${type} ${title}`.substring(0,50).toLowerCase();

  // TODO: Implement onClick to handle playing the streamUrl if available
  const handleClick = () => {
    if (streamUrl) {
      console.log(`Attempting to play: ${title} - ${streamUrl}`);
      // Here you would integrate with a video player component/modal
      // For example, dispatch an event, set state for a player modal, etc.
      alert(`Play: ${title}\nURL: ${streamUrl}\n(Player not implemented)`);
    } else {
      console.log(`No stream URL for: ${title}`);
      // Potentially navigate to detailPath if no streamUrl for direct play
      // For now, we keep the Link component behavior as a fallback.
    }
  };


  return (
    // Using div with onClick for now to intercept play action.
    // If navigation is primary, Link component is better.
    <div 
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg cursor-pointer"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick();}}
      aria-label={`Play ${title}`}
    >
      <Card className="overflow-hidden transition-all duration-300 ease-in-out group-hover:shadow-2xl group-hover:scale-105 group-focus:scale-105 group-focus:shadow-2xl bg-card border-border hover:border-primary/50 focus:border-primary/50">
        <CardContent className="p-0">
          <div className="aspect-[2/3] relative w-full bg-muted overflow-hidden">
            <Image 
              src={imageSrc} 
              alt={title} 
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
              className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-110 group-focus:scale-110" 
              data-ai-hint={finalDataAiHint}
              onError={(e) => {
                // Fallback for broken images
                (e.target as HTMLImageElement).src = `https://placehold.co/300x450.png`;
              }}
            />
          </div>
          <div className="p-3 min-h-[60px] flex items-center">
            <h3 className="font-semibold text-sm text-foreground group-hover:text-primary group-focus:text-primary line-clamp-2 leading-tight">
              {title}
            </h3>
          </div>
        </CardContent>
      </Card>
    </div>
    // If simple navigation is preferred for now, revert to:
    // <Link href={detailPath} className="group block ..."> ... </Link>
  );
}
