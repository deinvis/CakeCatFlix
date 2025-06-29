
"use client";

import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import type { ContentItemForCard } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Tv2, Film, Clapperboard, Server } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface ContentCardProps extends ContentItemForCard {}

export function ContentCard({
  id,
  title,
  imageUrl,
  type,
  genre,
  dataAiHint,
  qualities,
  sourceCount,
  seriesId,
  year
}: ContentCardProps) {
  const router = useRouter();
  const [imageError, setImageError] = useState(false);

  const defaultPlaceholder = `https://placehold.co/300x450.png`;
  // Determine the image source: original imageUrl, or placeholder if imageUrl is missing or an error occurred.
  const imageSrc = imageError || !imageUrl || imageUrl.trim() === '' ? defaultPlaceholder : imageUrl;
  const finalDataAiHint = dataAiHint || `${type} ${title}`.substring(0, 50).toLowerCase();

  const handleClick = () => {
    if (type === 'movie' && id) {
      router.push(`/app/player/movie/${id.toString()}`);
    } else if (type === 'series' && (seriesId || id)) {
      const navigationId = seriesId || id;
      router.push(`/app/player/series/${navigationId.toString()}`);
    } else if (type === 'channel' && id) {
      // For channels, 'id' is the baseChannelName
      router.push(`/app/player/channel/${encodeURIComponent(id)}`);
    } else {
      console.log(`Item clicked: ${title} (Type: ${type}, ID: ${id}). No navigation rule defined or ID missing.`);
    }
  };

  const TypeIcon = type === 'movie' ? Film : type === 'series' ? Clapperboard : Tv2;

  return (
    <div
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg cursor-pointer"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
      aria-label={`Play or view details for ${title}`}
    >
      <Card className="overflow-hidden transition-all duration-300 ease-in-out group-hover:shadow-2xl group-hover:scale-105 group-focus:scale-105 group-focus:shadow-2xl bg-card border-border hover:border-primary/50 focus:border-primary/50 flex flex-col h-full">
        <CardContent className="p-0 flex-grow flex flex-col">
          <div className="aspect-[2/3] relative w-full bg-muted overflow-hidden">
            <Image
              key={imageSrc} // Add key here to force re-render when imageSrc changes to placeholder
              src={imageSrc}
              alt={title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
              className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-110 group-focus:scale-110"
              data-ai-hint={finalDataAiHint}
              onError={() => {
                if (!imageError) { // Prevent infinite loop if placeholder also fails
                  console.error(`Image failed to load: ${imageUrl}`);
                  setImageError(true);
                }
              }}
              unoptimized={imageError || imageSrc === defaultPlaceholder} // If using placeholder, or original caused error, no need to optimize it
              priority={true} // Add priority for images that might be LCP
            />
            <Badge variant="default" className="absolute top-2 left-2 text-xs shadow-md">
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
               {year && (type === 'movie' || type === 'series') && (
                <Badge variant="outline" className="text-xs">
                  {year}
                </Badge>
              )}
              {type === 'channel' && sourceCount && sourceCount > 1 && (
                <Badge variant="outline" className="text-xs" title={`${sourceCount} fontes/qualidades disponíveis`}>
                  <Server className="h-3 w-3 mr-1" /> {sourceCount}
                </Badge>
              )}
              {type === 'channel' && qualities && qualities.length > 0 && (!sourceCount || sourceCount === 1) && (
                 <Badge variant="outline" className="text-xs">
                  {qualities.join('/')}
                </Badge>
              )}
               {type === 'series' && sourceCount && sourceCount > 0 && (
                <Badge variant="outline" className="text-xs" title={`${sourceCount} ${sourceCount === 1 ? 'episódio' : 'episódios'}`}>
                  <Clapperboard className="h-3 w-3 mr-1" /> {sourceCount} {sourceCount === 1 ? 'Ep.' : 'Eps.'}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
