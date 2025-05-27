
"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import VideoPlayer from '@/components/player/video-player';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ArrowLeft, Film } from 'lucide-react';
import { getMovieItemById, getMovieItemsByTitleYearAcrossPlaylists, getAllPlaylistsMetadata, getPlaylistMetadata, type MovieItem } from '@/lib/db';

interface StreamOption {
  id: string;
  label: string;
  streamUrl: string; // This MUST be the original stream URL
  posterUrl?: string;
  playlistName: string;
}

export default function MoviePlayerPage() {
  const params = useParams<{ itemId: string }>();
  const router = useRouter();
  const movieNumericId = useMemo(() => parseInt(params.itemId, 10), [params.itemId]);

  const [primaryMovieInfo, setPrimaryMovieInfo] = useState<MovieItem | null>(null);
  const [streamOptions, setStreamOptions] = useState<StreamOption[]>([]);
  const [selectedStreamOptionId, setSelectedStreamOptionId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedStreamUrl = useMemo(() => {
    if (!selectedStreamOptionId) return null;
    const selectedOpt = streamOptions.find(opt => opt.id === selectedStreamOptionId);
    // Ensure this returns the ORIGINAL stream URL, not a proxied one
    return selectedOpt?.streamUrl || null;
  }, [selectedStreamOptionId, streamOptions]);

  const fetchMovieData = useCallback(async () => {
    if (isNaN(movieNumericId)) {
      setError("ID do filme inválido.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    setStreamOptions([]);
    setSelectedStreamOptionId(null);

    try {
      const mainMovie = await getMovieItemById(movieNumericId);
      if (!mainMovie) {
        setError("Filme não encontrado.");
        setIsLoading(false);
        return;
      }
      setPrimaryMovieInfo(mainMovie);

      const playlists = await getAllPlaylistsMetadata();
      if (playlists.length === 0) {
        setError("Nenhuma playlist configurada. Adicione playlists nas configurações.");
        setIsLoading(false);
        return;
      }
      const activePlaylistIds = playlists.map(p => p.id);
      const playlistMetaMap = new Map(playlists.map(p => [p.id, p]));

      const allInstances = await getMovieItemsByTitleYearAcrossPlaylists(
        mainMovie.title,
        mainMovie.year,
        activePlaylistIds
      );

      let finalOptions: StreamOption[] = [];

      if (allInstances.length > 0) {
        finalOptions = allInstances.map(instance => {
          const playlistMeta = playlistMetaMap.get(instance.playlistDbId);
          const playlistName = playlistMeta?.name || `Fonte ${instance.playlistDbId.slice(-4)}`;
          return {
            id: `${instance.playlistDbId}_${instance.streamUrl}`,
            label: playlistName,
            streamUrl: instance.streamUrl, // Store the original stream URL
            posterUrl: instance.logoUrl,
            playlistName: playlistName,
          };
        });
      } else if (mainMovie?.streamUrl) {
        const playlistMeta = playlistMetaMap.get(mainMovie.playlistDbId);
        finalOptions = [{
           id: mainMovie.playlistDbId + "_" + mainMovie.streamUrl,
           label: playlistMeta?.name || `Fonte Padrão`,
           streamUrl: mainMovie.streamUrl, // Store the original stream URL
           posterUrl: mainMovie.logoUrl,
           playlistName: playlistMeta?.name || `Fonte Padrão`,
        }];
      }

      finalOptions.sort((a,b) => a.playlistName.localeCompare(b.playlistName));
      setStreamOptions(finalOptions);

      if (finalOptions.length > 0) {
        const primaryOptionInFinal = finalOptions.find(opt => opt.streamUrl === mainMovie.streamUrl && opt.id.startsWith(mainMovie.playlistDbId));
        setSelectedStreamOptionId(primaryOptionInFinal ? primaryOptionInFinal.id : finalOptions[0].id);
      } else {
        setError(`Nenhuma fonte de stream disponível para "${mainMovie.title}".`);
      }

    } catch (err: any) {
      console.error("Erro ao buscar dados do filme:", err);
      setError(err.message || "Falha ao carregar dados do filme.");
    } finally {
      setIsLoading(false);
    }
  }, [movieNumericId]);

  useEffect(() => {
    fetchMovieData();
  }, [fetchMovieData]);

  const handleStreamSelectionChange = (newStreamOptionId: string) => {
    setSelectedStreamOptionId(newStreamOptionId);
  };

  const descriptionParts = [];
  if (primaryMovieInfo?.genre) descriptionParts.push(primaryMovieInfo.genre);
  if (primaryMovieInfo?.year) descriptionParts.push(`(${primaryMovieInfo.year})`);
  const movieDescription = descriptionParts.join(' ');


  if (isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
            <Skeleton className="h-20 w-14 md:h-28 md:w-[74px] rounded-md" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-6 w-1/2" />
            </div>
        </div>
        <Skeleton className="w-full aspect-video rounded-lg" />
        <Skeleton className="h-12 w-full md:w-1/2 mt-4" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 md:p-6 text-center">
        <PageHeader title="Erro no Player" />
        <div className="flex flex-col items-center justify-center bg-muted p-8 rounded-lg shadow">
          <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
          <p className="text-xl text-destructive mb-4">{error}</p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        </div>
      </div>
    );
  }

  if (!primaryMovieInfo) {
    return (
        <div className="container mx-auto p-4 md:p-6 text-center">
          <PageHeader title="Filme Não Encontrado" description="Não foi possível carregar os detalhes do filme." />
          <Button onClick={() => router.back()} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        </div>
    );
  }

  return (
    <div className="container mx-auto p-0 md:p-2 lg:p-4 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {primaryMovieInfo.logoUrl ? (
            <img
              src={primaryMovieInfo.logoUrl}
              alt={primaryMovieInfo.title}
              className="h-20 w-auto md:h-28 object-contain rounded-md bg-muted p-1 shadow"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.onerror = null;
                target.style.display = 'none';
                const fallbackIconContainer = target.nextElementSibling;
                if (fallbackIconContainer && fallbackIconContainer.classList.contains('fallback-film-icon-container')) {
                   fallbackIconContainer.classList.remove('hidden');
                }
              }}
            />
          ) : (
            <div className="h-20 w-14 md:h-28 md:w-[74px] flex items-center justify-center bg-muted rounded-md shadow fallback-film-icon-container">
              <Film className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground" />
            </div>
          )}
          {!primaryMovieInfo.logoUrl && ( /* This ensures fallback is shown if logoUrl is initially null/undefined */
            <div className="h-20 w-14 md:h-28 md:w-[74px] flex items-center justify-center bg-muted rounded-md shadow fallback-film-icon-container">
              <Film className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1">
             <PageHeader
                title={primaryMovieInfo.title}
                description={movieDescription}
             />
          </div>
        </div>
        <Button variant="outline" onClick={() => router.back()} className="flex-shrink-0 self-start sm:self-center">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      </div>

      <VideoPlayer src={selectedStreamUrl} title={primaryMovieInfo.title} />

      {streamOptions.length > 1 && (
        <div className="grid grid-cols-1 gap-4 p-4 bg-card rounded-lg shadow">
          <div>
            <Label htmlFor="source-select" className="mb-2 block font-medium text-foreground">Fonte do Filme</Label>
            <Select
              value={selectedStreamOptionId || undefined}
              onValueChange={handleStreamSelectionChange}
            >
              <SelectTrigger id="source-select" className="w-full md:w-1/2">
                <SelectValue placeholder="Selecione uma fonte" />
              </SelectTrigger>
              <SelectContent>
                {streamOptions.map(opt => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
       {streamOptions.length === 1 && primaryMovieInfo && selectedStreamUrl !== primaryMovieInfo.streamUrl && (
         <p className="text-sm text-muted-foreground p-2">Fonte: {streamOptions[0].label}</p>
      )}
      <div className="text-xs text-muted-foreground p-2 break-all">
        URL Atual para Player: {selectedStreamUrl || "Nenhuma"}
      </div>
    </div>
  );
}
