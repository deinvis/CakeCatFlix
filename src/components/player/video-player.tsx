
"use client";

import React, { useEffect, useRef, useCallback, useState } from 'react';
import Hls from 'hls.js';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, WifiOff } from 'lucide-react'; // Added WifiOff for no stream

interface VideoPlayerProps {
  streamUrl: string | null;
  itemId?: string | number; // For potential future use (e.g., saving progress)
  itemType?: 'movie' | 'series' | 'channel'; // For potential future use
  itemTitle?: string; // For logging and context
  posterUrl?: string;
}

export function VideoPlayer({ streamUrl, itemId, itemType, itemTitle, posterUrl }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // To manage loading state

  const logMediaError = useCallback((context: string, error: MediaError | null, currentStreamUrl?: string) => {
    let userFriendlyMessage = "Ocorreu um erro desconhecido ao tentar reproduzir o vídeo.";
    const consoleLogFn = error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED ? console.warn : console.error;

    if (error) {
      let details = `Error Code: ${error.code}`;
      if (error.message) {
        details += `, Message: ${error.message}`;
      }
      switch (error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          details += ' (A busca pelo recurso de mídia foi abortada pelo usuário.)';
          userFriendlyMessage = "A reprodução foi interrompida.";
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          details += ' (Ocorreu um erro de rede ao buscar o recurso de mídia.)';
          userFriendlyMessage = "Erro de rede ao carregar o vídeo. Verifique sua conexão com a internet.";
          break;
        case MediaError.MEDIA_ERR_DECODE:
          details += ' (Ocorreu um erro ao decodificar o recurso de mídia.)';
          userFriendlyMessage = "Erro ao decodificar o vídeo. O arquivo pode estar corrompido ou em um formato não suportado.";
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          details += ' (O recurso de mídia especificado não era adequado ou o formato não é suportado.)';
          userFriendlyMessage = "Formato de vídeo não suportado ou fonte inválida. Verifique se a URL está correta e se o servidor permite acesso (CORS).";
          if (currentStreamUrl && currentStreamUrl.toLowerCase().endsWith('.ts')) {
            userFriendlyMessage += " Streams .ts podem ter compatibilidade limitada. Procure por uma versão .m3u8 (HLS) se disponível.";
          }
          break;
        default:
          details += ` (Código de erro desconhecido: ${error.code}).`;
          userFriendlyMessage = `Ocorreu um erro ao carregar o vídeo. Verifique a URL, sua conexão, e se o servidor permite acesso (CORS). (Código: ${error.code || 'N/A'})`;
      }
      consoleLogFn(`${context}: ${details}`, error, "URL:", currentStreamUrl);
    } else {
      userFriendlyMessage = "Ocorreu um erro ao carregar o vídeo. Isso pode ser devido a restrições de CORS, problemas de rede, ou formato inválido.";
      consoleLogFn(`${context}: Erro não especificado ou video.error nulo. URL: ${currentStreamUrl}`);
    }
    setPlayerError(userFriendlyMessage);
    setIsLoading(false);
  }, [setPlayerError, setIsLoading]);

  const tryPlay = useCallback((element: HTMLVideoElement, sourceDescription: string) => {
    console.log(`VideoPlayer: Tentando reproduzir: ${sourceDescription} (URL: ${element.src || streamUrl})`);
    setIsLoading(true); // Assume loading until play starts or fails
    element.play()
      .then(() => {
        console.log(`VideoPlayer: Play promise resolvido para ${sourceDescription}`);
        setPlayerError(null);
        setIsLoading(false);
      })
      .catch(playError => {
        if (playError.name === 'NotAllowedError' || playError.name === 'NotSupportedError') {
          console.warn(`VideoPlayer: Play promise rejeitado (autoplay bloqueado ou não suportado) para ${sourceDescription}:`, playError.name, playError.message);
          setIsLoading(false); 
          setPlayerError("A reprodução automática foi bloqueada. Clique no play para iniciar.");
        } else {
          console.error(`VideoPlayer: Play promise rejeitado com erro inesperado para ${sourceDescription}:`, playError);
          logMediaError(`VideoPlayer Erro no play() para ${itemTitle || 'Vídeo'} (${streamUrl})`, playError as any, streamUrl);
        }
      });
  }, [streamUrl, itemTitle, logMediaError, setIsLoading, setPlayerError]);


  const setupVideoEventListeners = useCallback((videoElement: HTMLVideoElement, playerType: 'HLS' | 'Default') => {
    const onLoadedMetadata = () => {
      console.log(`VideoPlayer (${playerType}): Metadados carregados para`, streamUrl);
      setPlayerError(null); 
      setIsLoading(false); 
      // TODO: Re-implement progress saving/resuming logic if usePlaylistStore is added
      // if (itemType === 'movie' || itemType === 'series') {
      //   const savedProgress = getPlaybackProgress(itemId);
      //   if (savedProgress && videoElement.duration > 0 && videoElement.currentTime < savedProgress.currentTime && savedProgress.currentTime < videoElement.duration -1 ) { 
      //     console.log(`VideoPlayer (${playerType}): Retomando VOD item "${itemTitle}" de ${savedProgress.currentTime}s`);
      //     videoElement.currentTime = savedProgress.currentTime;
      //   }
      // }
      tryPlay(videoElement, `${playerType} stream (onloadedmetadata)`);
    };

    const onError = () => {
      logMediaError(`VideoPlayer (${playerType}) Erro no elemento <video> para ${itemTitle || 'Vídeo'} (${streamUrl})`, videoElement.error, streamUrl);
    };

    const onPlaying = () => {
      console.log(`VideoPlayer (${playerType}): Reprodução iniciada para ${streamUrl}`);
      setIsLoading(false);
      setPlayerError(null);
    };
    
    const onWaiting = () => {
      console.log(`VideoPlayer (${playerType}): Aguardando dados (buffering) para ${streamUrl}`);
      if (!playerError) setIsLoading(true); 
    };

    const onCanPlay = () => {
      console.log(`VideoPlayer (${playerType}): Pode reproduzir para ${streamUrl}`);
       if (!playerError) setIsLoading(false);
    };
    
    // const onTimeUpdate = () => { // Placeholder for progress saving
    //   if (videoElement && (itemType === 'movie' || itemType === 'series')) {
    //     if (videoElement.duration && videoElement.currentTime) {
    //       // updatePlaybackProgress(itemId, videoElement.currentTime, videoElement.duration);
    //     }
    //   }
    // };

    videoElement.addEventListener('loadedmetadata', onLoadedMetadata);
    videoElement.addEventListener('error', onError);
    videoElement.addEventListener('playing', onPlaying);
    videoElement.addEventListener('waiting', onWaiting);
    videoElement.addEventListener('canplay', onCanPlay);
    // if (itemType === 'movie' || itemType === 'series') {
    //   videoElement.addEventListener('timeupdate', onTimeUpdate);
    // }

    return () => {
      videoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
      videoElement.removeEventListener('error', onError);
      videoElement.removeEventListener('playing', onPlaying);
      videoElement.removeEventListener('waiting', onWaiting);
      videoElement.removeEventListener('canplay', onCanPlay);
      // if (itemType === 'movie' || itemType === 'series') {
      //   videoElement.removeEventListener('timeupdate', onTimeUpdate);
      // }
    };
  }, [streamUrl, itemTitle, itemType, itemId, tryPlay, logMediaError, setIsLoading, setPlayerError /*, getPlaybackProgress, updatePlaybackProgress */]);


  useEffect(() => {
    console.log(`VideoPlayer: Configurando para item: "${itemTitle || 'Vídeo'}", URL: "${streamUrl}", ID: ${itemId}`);
    setPlayerError(null);
    setIsLoading(true); 

    if (!streamUrl || streamUrl.trim() === "") {
      console.log("VideoPlayer: streamUrl é nulo ou vazio.");
      setIsLoading(false);
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
      console.log("VideoPlayer: Destruindo instância HLS anterior para o novo item:", itemTitle);
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    videoElement.pause();
    videoElement.removeAttribute('src');
    videoElement.load(); 

    const lowerStreamUrl = streamUrl.toLowerCase();
    const isHlsStream = lowerStreamUrl.includes('.m3u8') || 
                        lowerStreamUrl.includes('/manifest') || 
                        lowerStreamUrl.includes('.isml/manifest');

    if (isHlsStream) {
      console.log(`VideoPlayer: Configurando player HLS para: "${streamUrl}"`);
      if (Hls.isSupported()) {
        console.log("VideoPlayer: HLS.js é suportado.");
        const hls = new Hls({
            // debug: true, 
        });
        hlsRef.current = hls;
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log("VideoPlayer HLS.js: Manifesto parseado para", streamUrl);
          // tryPlay is called from onLoadedMetadata or this event
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS.js error event:', event, data, 'for URL:', streamUrl);
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
        
        hls.loadSource(streamUrl);
        hls.attachMedia(videoElement);
        cleanupVideoEvents = setupVideoEventListeners(videoElement, 'HLS'); 

      } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        console.log("VideoPlayer: HLS Nativo é suportado. Definindo src:", streamUrl);
        videoElement.src = streamUrl;
        cleanupVideoEvents = setupVideoEventListeners(videoElement, 'HLS');
      } else {
        const unsupportedMessage = "Seu navegador não suporta HLS para este stream.";
        console.warn("VideoPlayer: HLS.js não é suportado e HLS nativo não disponível:", streamUrl);
        setPlayerError(unsupportedMessage);
        setIsLoading(false);
      }
    } else {
      console.log(`VideoPlayer: Configurando player HTML5 padrão para não-HLS: "${streamUrl}" (Item: "${itemTitle}")`);
      videoElement.src = streamUrl;
      cleanupVideoEvents = setupVideoEventListeners(videoElement, 'Default');
    }

    return () => {
      console.log("VideoPlayer: Limpando para stream:", streamUrl, "(Item:", itemTitle, ")");
      if (cleanupVideoEvents) {
        cleanupVideoEvents();
      }
      if (hlsRef.current) {
        console.log("VideoPlayer: Destruindo instância HLS na limpeza para:", itemTitle);
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoElement) {
        videoElement.pause();
        videoElement.removeAttribute('src'); 
        videoElement.load(); 
      }
    };
  }, [streamUrl, itemId, itemType, itemTitle, setupVideoEventListeners, logMediaError, setIsLoading, setPlayerError, tryPlay]);

  if (!streamUrl && !playerError) {
    return (
      <div className="w-full aspect-video flex flex-col items-center justify-center bg-muted rounded-lg text-muted-foreground">
        <WifiOff className="h-16 w-16 mb-4" />
        <p className="text-lg">Nenhuma fonte de vídeo selecionada.</p>
        <p className="text-sm">Escolha uma fonte ou verifique a URL.</p>
      </div>
    );
  }

  return (
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
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-destructive/80 p-4 z-10 text-destructive-foreground">
          <AlertTriangle className="h-12 w-12 mb-3" />
          <p className="text-lg font-semibold mb-1">Erro ao Carregar Vídeo</p>
          <p className="text-sm max-w-md">{playerError}</p>
        </div>
      )}
    </div>
  );
}
