
"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { VideoPlayer } from '@/components/player/video-player';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { getAllPlaylistsMetadata, getChannelItemsByBaseNameAcrossPlaylists, getPlaylistMetadata, type ChannelItem } from '@/lib/db';
import type { PlaylistMetadata, MediaItemForPlayer } from '@/lib/constants';

interface StreamOption {
  id: string; // Unique identifier for the option, e.g., streamUrl or playlistId_quality
  label: string; // e.g., "Playlist Name - HD"
  streamUrl: string;
  logoUrl?: string;
  playlistName: string;
  quality: string;
}

export default function ChannelPlayerPage() {
  const params = useParams<{ channelName: string }>();
  const router = useRouter();
  const channelNameDecoded = useMemo(() => params.channelName ? decodeURIComponent(params.channelName) : "Canal Desconhecido", [params.channelName]);

  const [streamOptions, setStreamOptions] = useState<StreamOption[]>([]);
  const [selectedStreamOptionId, setSelectedStreamOptionId] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [channelTitle, setChannelTitle] = useState<string>(channelNameDecoded);
  const [channelLogo, setChannelLogo] = useState<string | undefined>(undefined);

  // Memoized MediaItemForPlayer
  const mediaItemForPlayer: MediaItemForPlayer | null = useMemo(() => {
    if (!selectedStreamOptionId) return null;
    const selectedOpt = streamOptions.find(opt => opt.id === selectedStreamOptionId);
    if (!selectedOpt) return null;

    return {
      id: channelNameDecoded + "_" + selectedOpt.streamUrl, // Composite ID for player
      streamUrl: selectedOpt.streamUrl,
      title: `${channelTitle} (${selectedOpt.playlistName} - ${selectedOpt.quality})`,
      type: 'channel',
      posterUrl: selectedOpt.logoUrl || channelLogo,
    };
  }, [selectedStreamOptionId, streamOptions, channelTitle, channelLogo, channelNameDecoded]);


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
      const firstLogo = rawChannelItems.find(item => item.logoUrl)?.logoUrl;
      setChannelLogo(firstLogo);

      const options: StreamOption[] = [];
      const playlistMetaMap = new Map(playlists.map(p => [p.id, p]));

      for (const item of rawChannelItems) {
        const playlistMeta = playlistMetaMap.get(item.playlistDbId);
        const playlistName = playlistMeta?.name || `Fonte ${item.playlistDbId.slice(-4)}`;
        const quality = item.quality || 'Padrão';
        options.push({
          id: `${item.playlistDbId}_${item.streamUrl}_${quality}`, 
          label: `${playlistName} - ${quality}`,
          streamUrl: item.streamUrl,
          logoUrl: item.logoUrl,
          playlistName: playlistName,
          quality: quality,
        });
      }
      
      const qualityOrder = ['FHD', 'HD', 'SD', 'Padrão'];
      options.sort((a, b) => {
        if (a.playlistName.toLowerCase() !== b.playlistName.toLowerCase()) {
          return a.playlistName.toLowerCase().localeCompare(b.playlistName.toLowerCase());
        }
        return qualityOrder.indexOf(a.quality) - qualityOrder.indexOf(b.quality);
      });
      
      setStreamOptions(options);

      if (options.length > 0) {
        const defaultHdOption = options.find(opt => opt.quality === 'HD');
        const defaultStandardOption = options.find(opt => opt.quality === 'Padrão');
        const defaultOption = defaultHdOption || defaultStandardOption || options[0];
        
        setSelectedStreamOptionId(defaultOption.id);
        if (defaultOption.logoUrl && !channelLogo) { 
          setChannelLogo(defaultOption.logoUrl);
        }
      }

    } catch (err: any) {
      console.error("Erro ao buscar dados do canal:", err);
      setError(err.message || "Falha ao carregar dados do canal.");
    } finally {
      setIsLoading(false);
    }
  }, [channelNameDecoded, channelLogo]); // Adicionado channelLogo para evitar re-fetch desnecessário por causa dele

  useEffect(() => {
    fetchChannelData();
  }, [fetchChannelData]);

  const handleStreamSelectionChange = (selectedId: string) => {
    setSelectedStreamOptionId(selectedId);
    const selectedOpt = streamOptions.find(opt => opt.id === selectedId);
    if (selectedOpt?.logoUrl) {
      setChannelLogo(selectedOpt.logoUrl);
    } else if (streamOptions.length > 0 && !selectedOpt?.logoUrl) {
        // Se a opção selecionada não tem logo, mas há um logo global para o canal, mantenha-o.
        // Se não, tente o logo da primeira opção como fallback.
        const firstLogoOverall = streamOptions.find(item => item.logoUrl)?.logoUrl;
        setChannelLogo(channelLogo || firstLogoOverall);
    }
  };


  if (isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <Skeleton className="h-10 w-1/3 mb-2" />
        <Skeleton className="h-8 w-1/4 mb-6" />
        <Skeleton className="w-full aspect-video rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
  
  if (streamOptions.length === 0 && !isLoading) {
     return (
      <div className="container mx-auto p-4 md:p-6 text-center">
        <PageHeader title={channelTitle} description="Nenhuma fonte ou qualidade encontrada" />
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
      
      <VideoPlayer item={mediaItemForPlayer} />

      <div className="grid grid-cols-1 gap-4 p-4 bg-card rounded-lg shadow">
        <div>
          <Label htmlFor="stream-select" className="mb-2 block font-medium text-foreground">Fonte / Qualidade</Label>
          <Select 
            value={selectedStreamOptionId || undefined} 
            onValueChange={handleStreamSelectionChange}
            disabled={streamOptions.length === 0}
          >
            <SelectTrigger id="stream-select" className="w-full">
              <SelectValue placeholder={streamOptions.length > 0 ? "Selecione uma fonte e qualidade" : "Nenhuma opção disponível"} />
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
      <div className="text-xs text-muted-foreground p-2 break-all">
        URL Atual: {mediaItemForPlayer?.streamUrl || "Nenhuma"}
      </div>
    </div>
  );
}

    