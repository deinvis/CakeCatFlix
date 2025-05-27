
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { VideoPlayer } from '@/components/player/video-player';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ArrowLeft, Tv } from 'lucide-react';
import { getAllPlaylistsMetadata, getChannelItemsByBaseNameAcrossPlaylists, getPlaylistMetadata, type ChannelItem } from '@/lib/db';
import type { PlaylistMetadata } from '@/lib/constants';

interface ChannelSource {
  playlistId: string;
  playlistName: string;
  qualities: { qualityLabel: string; streamUrl: string }[];
  logoUrl?: string; // Representative logo for this source
}

export default function ChannelPlayerPage() {
  const params = useParams<{ channelName: string }>();
  const router = useRouter();
  const channelNameDecoded = params.channelName ? decodeURIComponent(params.channelName) : "Canal Desconhecido";

  const [channelSources, setChannelSources] = useState<ChannelSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<string | null>(null);
  const [currentStreamUrl, setCurrentStreamUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [channelTitle, setChannelTitle] = useState<string>(channelNameDecoded);
  const [channelLogo, setChannelLogo] = useState<string | undefined>(undefined);

  const fetchChannelData = useCallback(async () => {
    if (!channelNameDecoded || channelNameDecoded === "Canal Desconhecido") {
      setError("Nome do canal inválido.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const playlists = await getAllPlaylistsMetadata();
      if (playlists.length === 0) {
        setError("Nenhuma playlist configurada. Adicione playlists nas configurações.");
        setIsLoading(false);
        return;
      }
      const activePlaylistIds = playlists.map(p => p.id);
      const rawChannelItems = await getChannelItemsByBaseNameAcrossPlaylists(channelNameDecoded, activePlaylistIds);

      if (rawChannelItems.length === 0) {
        setError(`Nenhuma fonte encontrada para o canal "${channelNameDecoded}".`);
        setIsLoading(false);
        return;
      }

      setChannelTitle(rawChannelItems[0].baseChannelName || channelNameDecoded);
      // Use the first available logo as representative
      const firstLogo = rawChannelItems.find(item => item.logoUrl)?.logoUrl;
      setChannelLogo(firstLogo);

      const sourcesMap = new Map<string, { playlistName: string; items: ChannelItem[] }>();
      for (const item of rawChannelItems) {
        if (!sourcesMap.has(item.playlistDbId)) {
          const playlistMeta = await getPlaylistMetadata(item.playlistDbId);
          sourcesMap.set(item.playlistDbId, { 
            playlistName: playlistMeta?.name || `Fonte ${item.playlistDbId.slice(-4)}`,
            items: [] 
          });
        }
        sourcesMap.get(item.playlistDbId)!.items.push(item);
      }
      
      const groupedSources: ChannelSource[] = Array.from(sourcesMap.entries()).map(([playlistId, data]) => {
        const qualities = data.items
          .map(item => ({
            qualityLabel: item.quality || 'Padrão',
            streamUrl: item.streamUrl,
          }))
          .sort((a, b) => { // Simple sort: FHD > HD > SD > Padrão
            const order = ['FHD', 'HD', 'SD', 'Padrão'];
            return order.indexOf(a.qualityLabel) - order.indexOf(b.qualityLabel);
          });
        
        return {
          playlistId,
          playlistName: data.playlistName,
          qualities,
          logoUrl: data.items.find(i => i.logoUrl)?.logoUrl // Logo for this specific source
        };
      });

      setChannelSources(groupedSources);

      if (groupedSources.length > 0) {
        const firstSource = groupedSources[0];
        setSelectedSourceId(firstSource.playlistId);
        if (firstSource.qualities.length > 0) {
          const defaultQuality = firstSource.qualities.find(q => q.qualityLabel === 'HD') || 
                                 firstSource.qualities.find(q => q.qualityLabel === 'Padrão') ||
                                 firstSource.qualities[0];
          setSelectedQuality(defaultQuality.qualityLabel);
          setCurrentStreamUrl(defaultQuality.streamUrl);
        }
      }

    } catch (err: any) {
      console.error("Erro ao buscar dados do canal:", err);
      setError(err.message || "Falha ao carregar dados do canal.");
    } finally {
      setIsLoading(false);
    }
  }, [channelNameDecoded]);

  useEffect(() => {
    fetchChannelData();
  }, [fetchChannelData]);

  useEffect(() => {
    if (selectedSourceId && selectedQuality) {
      const source = channelSources.find(s => s.playlistId === selectedSourceId);
      if (source) {
        const qualityObj = source.qualities.find(q => q.qualityLabel === selectedQuality);
        if (qualityObj) {
          setCurrentStreamUrl(qualityObj.streamUrl);
          // Update channel logo if the selected source has a specific one
          if(source.logoUrl) setChannelLogo(source.logoUrl);
        }
      }
    }
  }, [selectedSourceId, selectedQuality, channelSources]);

  const currentSelectedSource = channelSources.find(s => s.playlistId === selectedSourceId);

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <Skeleton className="h-10 w-1/3 mb-2" />
        <Skeleton className="h-8 w-1/4 mb-6" />
        <Skeleton className="w-full aspect-video rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
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
  
  if (channelSources.length === 0 && !isLoading) {
     return (
      <div className="container mx-auto p-4 md:p-6 text-center">
        <PageHeader title={channelTitle} description="Nenhuma fonte encontrada" />
         <Button onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar aos canais
          </Button>
      </div>
    )
  }


  return (
    <div className="container mx-auto p-0 md:p-2 lg:p-4 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                 {channelLogo && <img src={channelLogo} alt={channelTitle} className="h-10 w-10 md:h-12 md:w-12 object-contain rounded-sm bg-muted p-0.5" onError={(e) => e.currentTarget.style.display = 'none'} />}
                <PageHeader title={channelTitle} description="Selecione a fonte e qualidade abaixo" />
            </div>
            <Button variant="outline" onClick={() => router.back()} className="flex-shrink-0">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
        </div>
      
      <VideoPlayer streamUrl={currentStreamUrl} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-card rounded-lg shadow">
        <div>
          <Label htmlFor="source-select" className="mb-2 block font-medium text-foreground">Fonte (Playlist)</Label>
          <Select 
            value={selectedSourceId || undefined} 
            onValueChange={(value) => {
              setSelectedSourceId(value);
              // Reset quality when source changes, then useEffect will pick best default
              const newSource = channelSources.find(s => s.playlistId === value);
              if (newSource && newSource.qualities.length > 0) {
                const defaultQuality = newSource.qualities.find(q => q.qualityLabel === 'HD') || 
                                       newSource.qualities.find(q => q.qualityLabel === 'Padrão') ||
                                       newSource.qualities[0];
                setSelectedQuality(defaultQuality.qualityLabel); 
              } else {
                setSelectedQuality(null);
              }
            }}
          >
            <SelectTrigger id="source-select" className="w-full">
              <SelectValue placeholder="Selecione uma fonte" />
            </SelectTrigger>
            <SelectContent>
              {channelSources.map(source => (
                <SelectItem key={source.playlistId} value={source.playlistId}>
                  {source.playlistName} ({source.qualities.length} {source.qualities.length === 1 ? 'qualidade' : 'qualidades'})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="quality-select" className="mb-2 block font-medium text-foreground">Qualidade</Label>
          <Select 
            value={selectedQuality || undefined} 
            onValueChange={setSelectedQuality}
            disabled={!selectedSourceId || !currentSelectedSource || currentSelectedSource.qualities.length === 0}
          >
            <SelectTrigger id="quality-select" className="w-full">
              <SelectValue placeholder={currentSelectedSource && currentSelectedSource.qualities.length > 0 ? "Selecione uma qualidade" : "Nenhuma qualidade disponível"} />
            </SelectTrigger>
            <SelectContent>
              {currentSelectedSource?.qualities.map(q => (
                <SelectItem key={q.qualityLabel} value={q.qualityLabel}>
                  {q.qualityLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="text-xs text-muted-foreground p-2 break-all">
        URL Atual: {currentStreamUrl || "Nenhuma"}
      </div>
    </div>
  );
}
