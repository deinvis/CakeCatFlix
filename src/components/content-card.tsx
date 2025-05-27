
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import type { ContentItemForCard } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Tv2, Film, Clapperboard, Server } from 'lucide-react'; // Added Server for sourceCount

interface ContentCardProps extends ContentItemForCard {}

export function ContentCard({ 
  id, 
  title, 
  imageUrl, 
  type, 
  genre, 
  dataAiHint, 
  streamUrl,
  qualities,
  sourceCount
}: ContentCardProps) {
  
  const imageSrc = imageUrl || `https://placehold.co/300x450.png`;
  const finalDataAiHint = dataAiHint || `${type} ${title}`.substring(0,50).toLowerCase();

  const handleClick = () => {
    // TODO: Navigate to a dedicated player page: /app/player/[type]/[id]
    // For aggregated channels, id might be baseChannelName. Player page needs to handle fetching specific stream URLs.
    if (streamUrl) {
      console.log(`Attempting to play: ${title} - ${streamUrl}`);
      alert(`Play: ${title}\nURL: ${streamUrl}\n(Player not implemented)`);
    } else if (type === 'channel' && sourceCount && sourceCount > 0) {
      console.log(`Aggregated channel clicked: ${title}. Navigate to detail/player page to select stream.`);
      alert(`Channel: ${title}\n${sourceCount} sources available.\n(Player/Detail page not implemented)`);
    } else {
      console.log(`No stream URL for: ${title}. Consider navigating to a detail page.`);
       alert(`Details for: ${title}\n(Detail page not implemented)`);
    }
  };

  const TypeIcon = type === 'movie' ? Film : type === 'series' ? Clapperboard : Tv2;

  return (
    <div 
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg cursor-pointer"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick();}}
      aria-label={`Play or view details for ${title}`}
    >
      <Card className="overflow-hidden transition-all duration-300 ease-in-out group-hover:shadow-2xl group-hover:scale-105 group-focus:scale-105 group-focus:shadow-2xl bg-card border-border hover:border-primary/50 focus:border-primary/50 flex flex-col h-full">
        <CardContent className="p-0 flex-grow flex flex-col">
          <div className="aspect-[2/3] relative w-full bg-muted overflow-hidden">
            <Image 
              src={imageSrc} 
              alt={title} 
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
              className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-110 group-focus:scale-110" 
              data-ai-hint={finalDataAiHint}
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://placehold.co/300x450.png`;
              }}
            />
             {/* Type Badge Top-Left */}
            <Badge variant="default" className="absolute top-2 left-2 text-xs">
              <TypeIcon className="h-3 w-3 mr-1" />
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Badge>
          </div>
          <div className="p-3 space-y-1 mt-auto">
            <h3 className="font-semibold text-sm text-foreground group-hover:text-primary group-focus:text-primary line-clamp-2 leading-tight">
              {title}
            </h3>
            <div className="flex flex-wrap gap-1 items-center">
              {genre && (
                <Badge variant="secondary" className="text-xs">
                  {genre}
                </Badge>
              )}
              {type === 'channel' && sourceCount && sourceCount > 1 && (
                <Badge variant="outline" className="text-xs" title={`${sourceCount} fontes/qualidades disponíveis`}>
                  <Server className="h-3 w-3 mr-1" /> {sourceCount}
                </Badge>
              )}
              {type === 'channel' && qualities && qualities.length > 0 && sourceCount === 1 && (
                 <Badge variant="outline" className="text-xs">
                  {qualities.join('/')}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
