
"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { VideoPlayer } from '@/components/player/video-player';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ArrowLeft, Clapperboard, Tv } from 'lucide-react';
import { 
  getSeriesItemById, 
  getEpisodesForSeriesAcrossPlaylists, 
  getAllPlaylistsMetadata, 
  getPlaylistMetadata 
} from '@/lib/db';
import type { SeriesItem, EpisodeItem, PlaylistMetadata } from '@/lib/constants';

interface EpisodeSource {
  playlistId: string;
  playlistName: string;
  streamUrl: string;
  logoUrl?: string; // Episode specific logo from this source
}

interface DisplayEpisode {
  title: string; // e.g., "S01E01 - Pilot"
  seasonNumber: number;
  episodeNumber: number;
  sources: EpisodeSource[];
  // Potentially other shared metadata if consistent across sources
  primaryLogoUrl?: string; // A representative logo for the episode
}

interface GroupedEpisodes {
  [seasonNumber: number]: DisplayEpisode[];
}

export default function SeriesPlayerPage() {
  const params = useParams<{ seriesId: string }>();
  const router = useRouter();
  const seriesNumericId = parseInt(params.seriesId, 10);

  const [seriesInfo, setSeriesInfo] = useState<SeriesItem | null>(null);
  const [allRawEpisodes, setAllRawEpisodes] = useState<EpisodeItem[]>([]);
  const [playlistMetas, setPlaylistMetas] = useState<Map<string, PlaylistMetadata>>(new Map());
  
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null); // Season number as string for Tabs
  const [currentStreamUrl, setCurrentStreamUrl] = useState<string | null>(null);
  const [currentEpisodeTitle, setCurrentEpisodeTitle] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSeriesData = useCallback(async () => {
    if (isNaN(seriesNumericId)) {
      setError("ID da série inválido.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const seriesData = await getSeriesItemById(seriesNumericId);
      if (!seriesData) {
        setError("Série não encontrada.");
        setIsLoading(false);
        return;
      }
      setSeriesInfo(seriesData);

      const playlists = await getAllPlaylistsMetadata();
      const activePlaylistIds = playlists.map(p => p.id);
      const metas = new Map(playlists.map(p => [p.id, p]));
      setPlaylistMetas(metas);

      const episodesData = await getEpisodesForSeriesAcrossPlaylists(seriesNumericId, activePlaylistIds);
      setAllRawEpisodes(episodesData);

      if (episodesData.length > 0) {
        // Determine default season to select
        const firstSeason = episodesData.reduce((min, ep) => Math.min(min, ep.seasonNumber || Infinity), Infinity);
        if (firstSeason !== Infinity) {
          setSelectedSeason(firstSeason.toString());
        }
      }

    } catch (err: any) {
      console.error("Erro ao buscar dados da série ou episódios:", err);
      setError(err.message || "Falha ao carregar dados da série.");
    } finally {
      setIsLoading(false);
    }
  }, [seriesNumericId]);

  useEffect(() => {
    fetchSeriesData();
  }, [fetchSeriesData]);

  const groupedAndSortedEpisodes = useMemo(() => {
    const groups: GroupedEpisodes = {};
    const episodeMap = new Map<string, DisplayEpisode>(); // Key: "S<season>E<episode>"

    allRawEpisodes.forEach(rawEp => {
      if (rawEp.seasonNumber === undefined || rawEp.episodeNumber === undefined) return;

      const episodeKey = `S${rawEp.seasonNumber}E${rawEp.episodeNumber}`;
      const playlistName = playlistMetas.get(rawEp.playlistDbId)?.name || `Fonte ${rawEp.playlistDbId.slice(-4)}`;
      const source: EpisodeSource = {
        playlistId: rawEp.playlistDbId,
        playlistName: playlistName,
        streamUrl: rawEp.streamUrl,
        logoUrl: rawEp.logoUrl,
      };

      if (episodeMap.has(episodeKey)) {
        const existingDisplayEp = episodeMap.get(episodeKey)!;
        existingDisplayEp.sources.push(source);
        if (!existingDisplayEp.primaryLogoUrl && source.logoUrl) {
          existingDisplayEp.primaryLogoUrl = source.logoUrl;
        }
      } else {
        episodeMap.set(episodeKey, {
          title: rawEp.title, // This should be the episode-specific title
          seasonNumber: rawEp.seasonNumber,
          episodeNumber: rawEp.episodeNumber,
          sources: [source],
          primaryLogoUrl: source.logoUrl || seriesInfo?.logoUrl,
        });
      }
    });

    episodeMap.forEach(displayEp => {
      if (!groups[displayEp.seasonNumber]) {
        groups[displayEp.seasonNumber] = [];
      }
      groups[displayEp.seasonNumber].push(displayEp);
    });

    // Sort episodes within each season
    for (const season in groups) {
      groups[season].sort((a, b) => a.episodeNumber - b.episodeNumber);
    }
    return groups;
  }, [allRawEpisodes, playlistMetas, seriesInfo?.logoUrl]);

  const availableSeasons = useMemo(() => {
    return Object.keys(groupedAndSortedEpisodes).map(Number).sort((a,b) => a - b);
  }, [groupedAndSortedEpisodes]);

  const handleEpisodePlay = (episode: DisplayEpisode, sourceStreamUrl?: string) => {
    if (sourceStreamUrl) {
      setCurrentStreamUrl(sourceStreamUrl);
      setCurrentEpisodeTitle(`${seriesInfo?.title || 'Série'} - ${episode.title}`);
    } else if (episode.sources.length === 1) {
      setCurrentStreamUrl(episode.sources[0].streamUrl);
      setCurrentEpisodeTitle(`${seriesInfo?.title || 'Série'} - ${episode.title}`);
    } else if (episode.sources.length > 0) {
      // If multiple sources and none pre-selected, default to the first one
      // Or ideally, this case is handled by the source selector for the episode
      setCurrentStreamUrl(episode.sources[0].streamUrl); 
      setCurrentEpisodeTitle(`${seriesInfo?.title || 'Série'} - ${episode.title} (${episode.sources[0].playlistName})`);
    }
  };
  
  // Auto-play first episode of selected season
  useEffect(() => {
    if (selectedSeason && groupedAndSortedEpisodes[parseInt(selectedSeason)]?.length > 0) {
      const firstEpisodeOfSeason = groupedAndSortedEpisodes[parseInt(selectedSeason)][0];
      if (firstEpisodeOfSeason && !currentStreamUrl) { // Only if nothing is playing yet
         handleEpisodePlay(firstEpisodeOfSeason);
      }
    }
  }, [selectedSeason, groupedAndSortedEpisodes, currentStreamUrl]);


  if (isLoading && !seriesInfo) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <Skeleton className="h-10 w-1/3 mb-2" />
        <Skeleton className="h-8 w-2/3 mb-6" />
        <Skeleton className="w-full aspect-video rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full col-span-2" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 md:p-6 text-center">
        <PageHeader title="Erro no Player de Série" />
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
  
  if (!seriesInfo) {
      return (
          <div className="container mx-auto p-4 md:p-6 text-center">
              <PageHeader title="Série não Carregada" description="Não foi possível carregar informações da série."/>
               <Button onClick={() => router.back()}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
          </div>
      )
  }

  const episodesInSelectedSeason = selectedSeason ? groupedAndSortedEpisodes[parseInt(selectedSeason)] || [] : [];

  return (
    <div className="container mx-auto p-0 md:p-2 lg:p-4 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {seriesInfo.logoUrl && (
            <img src={seriesInfo.logoUrl} alt={seriesInfo.title} className="h-20 w-auto md:h-28 object-contain rounded-md bg-muted p-1" onError={(e) => e.currentTarget.style.display = 'none'}/>
          )}
          <div className="flex-1">
            <PageHeader title={seriesInfo.title} description={seriesInfo.genre || seriesInfo.groupTitle || 'Série de TV'} />
            {currentEpisodeTitle && <p className="text-sm text-muted-foreground -mt-4 mb-2 truncate" title={currentEpisodeTitle}>{currentEpisodeTitle}</p>}
          </div>
        </div>
        <Button variant="outline" onClick={() => router.back()} className="flex-shrink-0 self-start sm:self-center">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      </div>

      <VideoPlayer streamUrl={currentStreamUrl} />

      <Tabs value={selectedSeason || undefined} onValueChange={setSelectedSeason} className="w-full">
        <ScrollArea className="w-full whitespace-nowrap rounded-md border">
            <TabsList className="bg-card border-b">
            {availableSeasons.length > 0 ? availableSeasons.map(seasonNum => (
                <TabsTrigger key={seasonNum} value={seasonNum.toString()} className="text-sm px-3 py-2">
                Temporada {seasonNum}
                </TabsTrigger>
            )) : <div className="p-2 text-muted-foreground">Nenhuma temporada encontrada.</div>}
            </TabsList>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {availableSeasons.map(seasonNum => (
          <TabsContent key={seasonNum} value={seasonNum.toString()} className="mt-0">
            {selectedSeason === seasonNum.toString() && (
              <ScrollArea className="h-[300px] w-full rounded-md border p-1 md:p-2">
                {episodesInSelectedSeason.length > 0 ? (
                  <ul className="space-y-1">
                    {episodesInSelectedSeason.map((ep, idx) => (
                      <li key={`${ep.seasonNumber}-${ep.episodeNumber}-${idx}`} 
                          className="p-2.5 rounded-md hover:bg-muted/50 transition-colors group">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div className="flex-1 min-w-0">
                                <button 
                                    onClick={() => handleEpisodePlay(ep)} 
                                    disabled={ep.sources.length === 0}
                                    className="text-sm font-medium text-left w-full disabled:opacity-50 hover:text-primary truncate block"
                                    title={ep.title}
                                >
                                    Ep. {ep.episodeNumber}: {ep.title}
                                </button>
                                {ep.primaryLogoUrl && seriesInfo.logoUrl !== ep.primaryLogoUrl && ( // Show episode thumb if different from series
                                    <img src={ep.primaryLogoUrl} alt={`Thumbnail ${ep.title}`} className="h-10 w-auto rounded mt-1 opacity-70 group-hover:opacity-100" onError={(e) => e.currentTarget.style.display = 'none'}/>
                                )}
                            </div>
                          
                          {ep.sources.length > 1 && (
                            <Select 
                                onValueChange={(streamUrl) => handleEpisodePlay(ep, streamUrl)}
                                defaultValue={ep.sources[0].streamUrl}
                            >
                              <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs mt-1 sm:mt-0">
                                <SelectValue placeholder="Selecionar Fonte" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                    <SelectLabel className="text-xs">Fontes Disponíveis</SelectLabel>
                                    {ep.sources.map(source => (
                                    <SelectItem key={source.playlistId + source.streamUrl} value={source.streamUrl} className="text-xs">
                                        {source.playlistName}
                                    </SelectItem>
                                    ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          )}
                           {ep.sources.length === 1 && (
                               <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => handleEpisodePlay(ep)}
                                    className="w-full sm:w-auto text-xs h-9 mt-1 sm:mt-0"
                                >
                                    <Tv className="mr-2 h-3 w-3"/> Assistir ({ep.sources[0].playlistName})
                                </Button>
                           )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-center p-8">Nenhum episódio encontrado para esta temporada.</p>
                )}
              </ScrollArea>
            )}
          </TabsContent>
        ))}
      </Tabs>
       {allRawEpisodes.length === 0 && !isLoading && (
            <p className="text-muted-foreground text-center py-8">Nenhum episódio encontrado para esta série nas suas playlists.</p>
        )}
    </div>
  );
}
