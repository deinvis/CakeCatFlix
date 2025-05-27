
"use client";

import React, { useEffect, useRef, useCallback, useState } from 'react';
import Hls from 'hls.js';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, WifiOff } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface VideoPlayerProps {
  streamUrl: string | null;
  itemId?: string | number;
  itemType?: 'movie' | 'series' | 'channel';
  itemTitle?: string;
  posterUrl?: string;
}

const TEST_STREAMS = {
  NONE: 'none',
  HLS_BIG_BUCK_BUNNY: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  MP4_BIG_BUCK_BUNNY: 'https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4',
};

export function VideoPlayer({
  streamUrl: propStreamUrl,
  itemId,
  itemType,
  itemTitle,
  posterUrl
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTestStream, setCurrentTestStream] = useState<string>(TEST_STREAMS.NONE);

  const streamUrlToPlay = currentTestStream === TEST_STREAMS.NONE ? propStreamUrl : currentTestStream;
  const currentItemTitleForLogs = currentTestStream === TEST_STREAMS.NONE ? itemTitle :
                           currentTestStream === TEST_STREAMS.HLS_BIG_BUCK_BUNNY ? "Test HLS (Big Buck Bunny)" :
                           currentTestStream === TEST_STREAMS.MP4_BIG_BUCK_BUNNY ? "Test MP4 (Big Buck Bunny)" : "Test Stream";


  const logMediaError = useCallback((context: string, error: MediaError | null, currentStreamUrlForLog?: string) => {
    let userFriendlyMessage = "Ocorreu um erro desconhecido ao tentar reproduzir o vídeo.";
    const consoleLogFn = error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED ? console.warn : console.error;

    if (error) {
      let details = `Error Code: ${error.code}`;
      if (error.message) details += `, Message: ${error.message}`;
      
      switch (error.code) {
        case MediaError.MEDIA_ERR_ABORTED: // code 1
          details += ' (A busca pelo recurso de mídia foi abortada pelo usuário.)';
          userFriendlyMessage = "A reprodução foi interrompida.";
          break;
        case MediaError.MEDIA_ERR_NETWORK: // code 2
          details += ' (Ocorreu um erro de rede ao buscar o recurso de mídia.)';
          userFriendlyMessage = "Erro de rede ao carregar o vídeo. Verifique sua conexão com a internet.";
          break;
        case MediaError.MEDIA_ERR_DECODE: // code 3
          details += ' (Ocorreu um erro ao decodificar o recurso de mídia.)';
          userFriendlyMessage = "Erro ao decodificar o vídeo. O arquivo pode estar corrompido ou em um formato não suportado.";
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: // code 4
          details += ' (O recurso de mídia especificado não era adequado ou o formato não é suportado.)';
          userFriendlyMessage = `Formato de vídeo não suportado ou fonte inválida. Verifique o console do navegador (F12) para possíveis erros de CORS ou rede. URL: ${currentStreamUrlForLog ? currentStreamUrlForLog.slice(0,70)+'...' : 'N/A'}`;
          if (currentStreamUrlForLog && currentStreamUrlForLog.toLowerCase().endsWith('.ts')) {
            userFriendlyMessage += " Streams .ts podem ter compatibilidade limitada no navegador.";
          }
          break;
        default:
          details += ` (Código de erro desconhecido: ${error.code}).`;
          userFriendlyMessage = `Ocorreu um erro ao carregar o vídeo (${currentStreamUrlForLog ? currentStreamUrlForLog.slice(0,70)+'...' : 'N/A'}). Verifique a URL, sua conexão e o console do navegador para detalhes. (Código: ${error.code || 'N/A'})`;
      }
      const suspectedCorsIssue = error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED && currentStreamUrlForLog && !currentStreamUrlForLog.toLowerCase().includes('.m3u8');
      if (suspectedCorsIssue) {
        userFriendlyMessage += " Problemas de CORS são comuns com arquivos de vídeo diretos. Verifique o console para mais detalhes.";
      }
      consoleLogFn(`${context}: ${details}`, error, "URL:", currentStreamUrlForLog);
    } else {
      const suspectedCorsMessage = currentStreamUrlForLog?.toLowerCase().endsWith('.mp4') ? " Isso frequentemente ocorre devido a restrições de CORS no servidor do vídeo." : "";
      userFriendlyMessage = `Ocorreu um erro ao carregar o vídeo (${currentStreamUrlForLog ? currentStreamUrlForLog.slice(0,70)+'...' : 'N/A'}). Verifique a URL, sua conexão e o console do navegador (F12) para detalhes (CORS, rede).${suspectedCorsMessage}`;
      consoleLogFn(`${context}: Erro não especificado ou video.error nulo. URL: ${currentStreamUrlForLog}`);
    }
    setPlayerError(userFriendlyMessage);
    setIsLoading(false);
  }, [setPlayerError, setIsLoading]);

  const tryPlay = useCallback((element: HTMLVideoElement, sourceDescription: string) => {
    console.log(`VideoPlayer: Tentando reproduzir: ${sourceDescription} (URL: ${element.src || streamUrlToPlay})`);
    setIsLoading(true);
    element.play()
      .then(() => {
        console.log(`VideoPlayer: Play promise resolvido para ${sourceDescription}`);
        setPlayerError(null);
      })
      .catch(playError => {
        if (playError.name === 'NotAllowedError' || playError.name === 'NotSupportedError') {
          console.warn(`VideoPlayer: Play promise rejeitado (autoplay bloqueado ou não suportado) para ${sourceDescription}:`, playError.name, playError.message);
          setPlayerError("A reprodução automática foi bloqueada. Clique no play para iniciar.");
        } else {
          console.error(`VideoPlayer: Play promise rejeitado com erro inesperado para ${sourceDescription}:`, playError);
          logMediaError(`VideoPlayer Erro no play() para ${currentItemTitleForLogs} (${streamUrlToPlay})`, playError as any, streamUrlToPlay);
        }
         setIsLoading(false);
      });
  }, [streamUrlToPlay, currentItemTitleForLogs, logMediaError, setIsLoading, setPlayerError]);

  const setupVideoEventListeners = useCallback((videoElement: HTMLVideoElement, playerContext: string) => {
    const onLoadedMetadata = () => {
      console.log(`VideoPlayer (${playerContext}): Metadados carregados para`, streamUrlToPlay);
      setPlayerError(null); 
      tryPlay(videoElement, `${playerContext} stream (onloadedmetadata)`);
    };

    const onError = () => {
      logMediaError(`VideoPlayer (${playerContext}) Erro no elemento <video> para ${currentItemTitleForLogs} (${streamUrlToPlay})`, videoElement.error, streamUrlToPlay);
    };

    const onPlaying = () => {
      console.log(`VideoPlayer (${playerContext}): Reprodução iniciada para ${streamUrlToPlay}`);
      setIsLoading(false);
      setPlayerError(null);
    };
    
    const onWaiting = () => {
      console.log(`VideoPlayer (${playerContext}): Aguardando dados (buffering) para ${streamUrlToPlay}`);
      if (!playerError) setIsLoading(true); 
    };

    const onCanPlay = () => {
      console.log(`VideoPlayer (${playerContext}): Pode reproduzir para ${streamUrlToPlay}`);
       if (!playerError && videoElement.paused) { // Only set isLoading to false if it's not already playing due to autoplay block
            // setIsLoading(false); // Autoplay might be blocked, user interaction needed.
       } else if (!playerError) {
            setIsLoading(false);
       }
    };
    
    videoElement.addEventListener('loadedmetadata', onLoadedMetadata);
    videoElement.addEventListener('error', onError);
    videoElement.addEventListener('playing', onPlaying);
    videoElement.addEventListener('waiting', onWaiting);
    videoElement.addEventListener('canplay', onCanPlay);

    return () => {
      videoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
      videoElement.removeEventListener('error', onError);
      videoElement.removeEventListener('playing', onPlaying);
      videoElement.removeEventListener('waiting', onWaiting);
      videoElement.removeEventListener('canplay', onCanPlay);
    };
  }, [streamUrlToPlay, currentItemTitleForLogs, tryPlay, logMediaError, setIsLoading, setPlayerError]);

  useEffect(() => {
    console.log(`VideoPlayer: Configurando para item: "${currentItemTitleForLogs}", URL: "${streamUrlToPlay}", Tipo: ${itemType}, ID: ${itemId}`);
    setPlayerError(null);
    setIsLoading(true); 

    if (!streamUrlToPlay || streamUrlToPlay.trim() === "" || streamUrlToPlay === TEST_STREAMS.NONE) {
      console.log("VideoPlayer: streamUrlToPlay é nulo, vazio ou 'none'.");
      setIsLoading(false);
      if (streamUrlToPlay === TEST_STREAMS.NONE && !propStreamUrl) {
         setPlayerError("Nenhuma fonte de vídeo selecionada.");
      }
      return;
    }
    
    const videoElement = videoRef.current;
    if (!videoElement) {
        console.error("VideoPlayer: Referência do elemento de vídeo não encontrada.");
        setIsLoading(false);
        return;
    }

    let cleanupVideoEvents: (() => void) | undefined;

    if (hlsRef.current) {
      console.log("VideoPlayer: Destruindo instância HLS anterior para o novo item:", currentItemTitleForLogs);
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    videoElement.pause();
    videoElement.removeAttribute('src');
    videoElement.load(); 

    const lowerStreamUrl = streamUrlToPlay.toLowerCase();
    const isHlsFormat = lowerStreamUrl.includes('.m3u8') || 
                        lowerStreamUrl.includes('/manifest') || 
                        lowerStreamUrl.includes('.isml/manifest');

    // Determine player type based on itemType and URL format
    let useHlsPlayer = false;
    if (itemType === 'channel' && isHlsFormat) {
        useHlsPlayer = true;
    } else if (itemType === 'channel' && !isHlsFormat) { // Direct .ts or other for channel
        useHlsPlayer = false; 
        console.log(`VideoPlayer: Item é CANAL, mas URL não é HLS. Usando player HTML5 padrão para: "${streamUrlToPlay}"`);
    } else if (itemType === 'movie' || itemType === 'series') {
        useHlsPlayer = false; // Movies and series are typically direct files like .mp4
        console.log(`VideoPlayer: Item é FILME/SÉRIE. Usando player HTML5 padrão para: "${streamUrlToPlay}"`);
    } else {
        // Fallback: if itemType is not specified, try to autodetect HLS format
        useHlsPlayer = isHlsFormat;
        console.warn(`VideoPlayer: itemType não especificado ou desconhecido ('${itemType}'). Tentando autodetectar formato. Usando HLS: ${useHlsPlayer} para: "${streamUrlToPlay}"`);
    }


    if (useHlsPlayer) {
      console.log(`VideoPlayer: Configurando player HLS para stream: "${streamUrlToPlay}"`);
      if (Hls.isSupported()) {
        console.log("VideoPlayer: HLS.js é suportado.");
        const hls = new Hls({ debug: false }); // Set debug to true for verbose HLS logs
        hlsRef.current = hls;
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log("VideoPlayer HLS.js: Manifesto parseado para", streamUrlToPlay);
          // tryPlay is called from onLoadedMetadata or this event
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS.js error event:', event, data, 'for URL:', streamUrlToPlay);
          let userFriendlyHlsError = "Erro ao carregar o stream de vídeo (HLS).";
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                userFriendlyHlsError = `Erro de rede HLS: ${data.details}.`;
                if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR || data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT) {
                    userFriendlyHlsError = "Não foi possível carregar o manifesto HLS. A fonte pode estar offline/inacessível ou ter problemas de CORS."
                } else if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR || data.details === Hls.ErrorDetails.FRAG_LOAD_TIMEOUT) {
                     userFriendlyHlsError = "Erro ao carregar segmento do vídeo HLS. Conexão instável ou stream incompleto."
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                userFriendlyHlsError = `Erro de mídia HLS: ${data.details}.`;
                if (data.details === Hls.ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR) {
                     userFriendlyHlsError = "Codecs de vídeo/áudio no stream HLS incompatíveis com seu navegador."
                } else if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
                    userFriendlyHlsError = "Reprodução parada devido a problema no buffer do HLS."
                }
                break;
              default:
                userFriendlyHlsError = `Erro HLS: ${data.details || 'Desconhecido'}.`;
                break;
            }
          } else {
             userFriendlyHlsError = `Problema no stream HLS: ${data.details || 'Não fatal'}.`;
          }
          setPlayerError(userFriendlyHlsError);
          setIsLoading(false);
        });
        
        hls.loadSource(streamUrlToPlay);
        hls.attachMedia(videoElement);
        cleanupVideoEvents = setupVideoEventListeners(videoElement, 'HLS'); 

      } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        console.log("VideoPlayer: HLS Nativo é suportado. Definindo src:", streamUrlToPlay);
        videoElement.src = streamUrlToPlay;
        cleanupVideoEvents = setupVideoEventListeners(videoElement, 'HLS (Nativo)');
      } else {
        const unsupportedMessage = "Seu navegador não suporta HLS para este stream.";
        console.warn("VideoPlayer: HLS.js não é suportado e HLS nativo não disponível:", streamUrlToPlay);
        setPlayerError(unsupportedMessage);
        setIsLoading(false);
      }
    } else { // Not using HLS player (e.g., for MP4, or channel with direct non-HLS stream)
      console.log(`VideoPlayer: Configurando player HTML5 padrão para: "${streamUrlToPlay}" (Item: "${currentItemTitleForLogs}", Tipo: ${itemType})`);
      videoElement.src = streamUrlToPlay;
      cleanupVideoEvents = setupVideoEventListeners(videoElement, `Default (${itemType || 'Desconhecido'})`);
    }

    return () => {
      console.log("VideoPlayer: Limpando para stream:", streamUrlToPlay, "(Item:", currentItemTitleForLogs, ")");
      if (cleanupVideoEvents) {
        cleanupVideoEvents();
      }
      if (hlsRef.current) {
        console.log("VideoPlayer: Destruindo instância HLS na limpeza para:", currentItemTitleForLogs);
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoElement) {
        videoElement.pause();
        videoElement.removeAttribute('src'); 
        videoElement.load(); 
      }
    };
  }, [streamUrlToPlay, itemId, itemType, currentItemTitleForLogs, setupVideoEventListeners, logMediaError, setIsLoading, setPlayerError, tryPlay, propStreamUrl]);


  if (!streamUrlToPlay && !playerError && !isLoading) {
    return (
      <div className="w-full aspect-video flex flex-col items-center justify-center bg-muted rounded-lg text-muted-foreground">
        <WifiOff className="h-16 w-16 mb-4" />
        <p className="text-lg">Nenhuma fonte de vídeo selecionada.</p>
        <p className="text-sm">Escolha uma fonte ou verifique a URL.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      <div className="p-2 bg-card border rounded-md shadow-sm">
        <Label htmlFor="debug-stream-select" className="text-xs font-medium text-muted-foreground">Debug: Selecionar Stream de Teste</Label>
        <Select value={currentTestStream} onValueChange={setCurrentTestStream}>
          <SelectTrigger id="debug-stream-select" className="w-full h-9 text-xs mt-1">
            <SelectValue placeholder="Selecionar stream" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TEST_STREAMS.NONE} className="text-xs">Usar Stream da Playlist (Original)</SelectItem>
            <SelectItem value={TEST_STREAMS.HLS_BIG_BUCK_BUNNY} className="text-xs">Teste HLS (Big Buck Bunny)</SelectItem>
            <SelectItem value={TEST_STREAMS.MP4_BIG_BUCK_BUNNY} className="text-xs">Teste MP4 (Big Buck Bunny)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1 truncate" title={streamUrlToPlay || "Nenhum stream selecionado"}>
          URL atual: {streamUrlToPlay || "Nenhum"}
        </p>
      </div>

      <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl relative">
        {isLoading && !playerError && (
           <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/60">
             <p className="text-primary-foreground text-lg font-semibold">Carregando vídeo...</p>
           </div>
        )}
        <video
          ref={videoRef}
          controls
          className="w-full h-full"
          playsInline 
          poster={posterUrl}
          preload="auto"
          crossOrigin="anonymous" 
        >
          Seu navegador não suporta a tag de vídeo ou o formato do vídeo.
        </video>
        {playerError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-destructive/90 p-4 z-10 text-destructive-foreground">
            <AlertTriangle className="h-10 w-10 md:h-12 md:w-12 mb-2 md:mb-3" />
            <p className="text-md md:text-lg font-semibold mb-1">Erro ao Carregar Vídeo</p>
            <p className="text-xs md:text-sm max-w-md">{playerError}</p>
          </div>
        )}
      </div>
    </div>
  );
}

