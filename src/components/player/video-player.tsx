
"use client";

import React, { useEffect, useRef, useCallback, useState } from 'react';
import Hls from 'hls.js';
import type { MediaItemForPlayer } from '@/lib/constants'; // Usando a nova interface
// import { usePlaylistStore } from '@/store/playlistStore'; // Comentado por enquanto
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, WifiOff } from 'lucide-react';

interface VideoPlayerProps {
  item: MediaItemForPlayer | null; // Recebe um único objeto item ou null
}

export function VideoPlayer({ item }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Adicionado para feedback de carregamento

  // const { updatePlaybackProgress, getPlaybackProgress } = usePlaylistStore(); // Comentado

  const logMediaError = useCallback((context: string, error: MediaError | null, streamUrl?: string) => {
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
          userFriendlyMessage = `Formato de vídeo não suportado ou fonte inválida. Verifique o console do navegador (F12) para possíveis erros de CORS ou rede. URL: ${streamUrl ? streamUrl.slice(0,70)+'...' : 'N/A'}`;
          if (streamUrl && streamUrl.toLowerCase().endsWith('.ts')) {
            userFriendlyMessage += " Streams .ts podem ter compatibilidade limitada no navegador.";
          }
          if (streamUrl && streamUrl.toLowerCase().endsWith('.mp4')) {
            userFriendlyMessage += " Para arquivos MP4, isso frequentemente ocorre devido a restrições de CORS no servidor do vídeo ou problemas de rede. Tente abrir a URL do vídeo diretamente em outra aba do navegador.";
          }
          break;
        default:
          details += ` (Código de erro desconhecido: ${error.code}).`;
          userFriendlyMessage = `Ocorreu um erro ao carregar o vídeo (${streamUrl ? streamUrl.slice(0,70)+'...' : 'N/A'}). Verifique a URL, sua conexão e o console do navegador para detalhes. (Código: ${error.code || 'N/A'})`;
      }
      consoleLogFn(`${context}: ${details}`, error, "URL:", streamUrl);
    } else {
      const suspectedCorsMessage = streamUrl?.toLowerCase().endsWith('.mp4') ? " Isso frequentemente ocorre devido a restrições de CORS no servidor do vídeo." : "";
      userFriendlyMessage = `Ocorreu um erro ao carregar o vídeo (${streamUrl ? streamUrl.slice(0,70)+'...' : 'N/A'}). Verifique a URL, sua conexão e o console do navegador (F12) para detalhes (CORS, rede).${suspectedCorsMessage}`;
      consoleLogFn(`${context}: Erro não especificado ou video.error nulo. URL: ${streamUrl}`);
    }
    setPlayerError(userFriendlyMessage);
    setIsLoading(false);
  }, [setPlayerError, setIsLoading]);

  const tryPlay = useCallback((element: HTMLVideoElement, sourceDescription: string) => {
    console.log(`VideoPlayer: Tentando reproduzir: ${sourceDescription} para URL: ${element.src || item?.streamUrl}`);
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
          logMediaError(`VideoPlayer Erro no play() para ${item?.title || 'N/A'} (${item?.streamUrl})`, playError as any, item?.streamUrl);
        }
         setIsLoading(false);
      });
  }, [item, logMediaError, setIsLoading, setPlayerError]); // Adicionado item às dependências

  // const handleTimeUpdate = useCallback(() => { // Comentado por enquanto
  //   const videoElement = videoRef.current;
  //   if (videoElement && item && (item.type === 'movie' || item.type === 'series_episode')) {
  //     if (videoElement.duration && videoElement.currentTime) {
  //        updatePlaybackProgress(item.id, videoElement.currentTime, videoElement.duration);
  //     }
  //   }
  // }, [item, updatePlaybackProgress]);

  const setupVideoEventListeners = useCallback((videoElement: HTMLVideoElement, playerType: 'HLS' | 'Default') => {
    const currentItemTitle = item?.title || 'N/A';
    const currentStreamUrl = item?.streamUrl || 'N/A';

    const onLoadedMetadata = () => {
      console.log(`VideoPlayer (${playerType}): Metadados carregados para`, currentStreamUrl);
      setPlayerError(null); 
      // if (item && (item.type === 'movie' || item.type === 'series_episode')) { // Comentado
      //   const savedProgress = getPlaybackProgress(item.id);
      //   if (savedProgress && videoElement.duration > 0 && videoElement.currentTime < savedProgress.currentTime && savedProgress.currentTime < videoElement.duration -1 ) { 
      //     console.log(`VideoPlayer (${playerType}): Retomando VOD item "${item.title}" de ${savedProgress.currentTime}s`);
      //     videoElement.currentTime = savedProgress.currentTime;
      //   }
      // }
      tryPlay(videoElement, `${playerType} stream (loadedmetadata event): ${currentStreamUrl}`);
    };

    const onError = () => {
      logMediaError(`VideoPlayer (${playerType}) Erro para ${currentItemTitle} (${currentStreamUrl})`, videoElement.error, currentStreamUrl);
    };
    
    const onPlaying = () => {
      console.log(`VideoPlayer (${playerType}): Reprodução iniciada para ${currentStreamUrl}`);
      setIsLoading(false);
      setPlayerError(null);
    };
    
    const onWaiting = () => {
      console.log(`VideoPlayer (${playerType}): Aguardando dados (buffering) para ${currentStreamUrl}`);
      if (!playerError) setIsLoading(true); 
    };

    const onCanPlay = () => {
      console.log(`VideoPlayer (${playerType}): Pode reproduzir para ${currentStreamUrl}`);
       if (!playerError && videoElement.paused) { 
            // setIsLoading(false); 
       } else if (!playerError) {
            setIsLoading(false);
       }
    };
    
    videoElement.addEventListener('loadedmetadata', onLoadedMetadata);
    videoElement.addEventListener('error', onError);
    videoElement.addEventListener('playing', onPlaying);
    videoElement.addEventListener('waiting', onWaiting);
    videoElement.addEventListener('canplay', onCanPlay);
    // if (item && (item.type === 'movie' || item.type === 'series_episode')) { // Comentado
    //   videoElement.addEventListener('timeupdate', handleTimeUpdate);
    // }

    return () => {
      videoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
      videoElement.removeEventListener('error', onError);
      videoElement.removeEventListener('playing', onPlaying);
      videoElement.removeEventListener('waiting', onWaiting);
      videoElement.removeEventListener('canplay', onCanPlay);
      // if (item && (item.type === 'movie' || item.type === 'series_episode')) { // Comentado
      //   videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      // }
    };
  }, [item, tryPlay, logMediaError, setIsLoading, setPlayerError]); // getPlaybackProgress, handleTimeUpdate removidos das deps


  useEffect(() => {
    const currentItemTitleForLogs = item?.title || "N/A";
    const currentStreamUrl = item?.streamUrl;
    const currentItemType = item?.type || "Desconhecido";
    const currentItemId = item?.id || "N/A";
    
    console.log(`VideoPlayer: Configurando para item: "${currentItemTitleForLogs}", URL: "${currentStreamUrl || 'Nenhuma'}", Tipo: ${currentItemType}, ID: ${currentItemId}`);
    
    setPlayerError(null);

    if (!currentStreamUrl || currentStreamUrl.trim() === "") {
      console.log("VideoPlayer: streamUrl é nulo ou vazio.");
      setIsLoading(false);
      setPlayerError(currentStreamUrl === null ? "Nenhuma fonte de vídeo selecionada." : "URL do vídeo inválida.");
      return;
    }
    setIsLoading(true); 
    
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

    const lowerStreamUrl = currentStreamUrl.toLowerCase();
    const isHlsFormat = lowerStreamUrl.includes('.m3u8') || 
                        lowerStreamUrl.includes('/manifest') || 
                        lowerStreamUrl.includes('.isml/manifest');

    let useHlsPlayer = false;
    if (currentItemType === 'channel' && isHlsFormat) {
        useHlsPlayer = true;
    } else if (currentItemType === 'channel' && !isHlsFormat) { 
        useHlsPlayer = false; 
        console.log(`VideoPlayer: Item é CANAL, mas URL não é HLS. Usando player HTML5 padrão para: "${currentStreamUrl}"`);
    } else if (currentItemType === 'movie' || currentItemType === 'series_episode') {
        useHlsPlayer = false; 
        console.log(`VideoPlayer: Item é FILME/SÉRIE. Usando player HTML5 padrão para: "${currentStreamUrl}"`);
    } else {
        useHlsPlayer = isHlsFormat; // Fallback para autodetecção se o tipo for desconhecido
        console.warn(`VideoPlayer: itemType não especificado ou desconhecido ('${currentItemType}'). Tentando autodetectar formato. Usando HLS: ${useHlsPlayer} para: "${currentStreamUrl}"`);
    }


    if (useHlsPlayer) {
      console.log(`VideoPlayer: Configurando player HLS para stream: "${currentStreamUrl}"`);
      if (Hls.isSupported()) {
        console.log("VideoPlayer: HLS.js é suportado.");
        const hls = new Hls({ debug: false }); 
        hlsRef.current = hls;
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log("VideoPlayer HLS.js: Manifesto parseado para", currentStreamUrl);
          tryPlay(videoElement, `HLS stream (manifest parsed event): ${currentStreamUrl}`);
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS.js error event:', event, data, 'for URL:', currentStreamUrl);
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
                if (hlsRef.current && data.networkDetails?.status !== 403 && data.networkDetails?.status !== 404 ) { // Não tentar recuperar se for erro de acesso/não encontrado
                  hlsRef.current.startLoad(); // Tentativa de recuperação de erro de rede do seu exemplo
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                userFriendlyHlsError = `Erro de mídia HLS: ${data.details}.`;
                if (data.details === Hls.ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR) {
                     userFriendlyHlsError = "Codecs de vídeo/áudio no stream HLS incompatíveis com seu navegador."
                } else if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
                    userFriendlyHlsError = "Reprodução parada devido a problema no buffer do HLS."
                }
                 if (hlsRef.current) {
                  hlsRef.current.recoverMediaError(); // Tentativa de recuperação de erro de mídia do seu exemplo
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
        
        hls.loadSource(currentStreamUrl);
        hls.attachMedia(videoElement);
        cleanupVideoEvents = setupVideoEventListeners(videoElement, 'HLS'); 

      } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        console.log("VideoPlayer: HLS Nativo é suportado. Definindo src:", currentStreamUrl);
        videoElement.src = currentStreamUrl;
        cleanupVideoEvents = setupVideoEventListeners(videoElement, 'HLS'); // Contexto HLS pois é mpegurl
      } else {
        const unsupportedMessage = "Seu navegador não suporta HLS para este stream.";
        console.warn("VideoPlayer: HLS.js não é suportado e HLS nativo não disponível:", currentStreamUrl);
        setPlayerError(unsupportedMessage);
        setIsLoading(false);
      }
    } else { 
      console.log(`VideoPlayer: Configurando player HTML5 padrão para: "${currentStreamUrl}" (Item: "${currentItemTitleForLogs}", Tipo: ${currentItemType})`);
      videoElement.src = currentStreamUrl;
      cleanupVideoEvents = setupVideoEventListeners(videoElement, 'Default');
    }

    return () => {
      console.log("VideoPlayer: Limpando para stream:", currentStreamUrl, "(Item:", currentItemTitleForLogs, ")");
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
  }, [item, setupVideoEventListeners, logMediaError, tryPlay, setIsLoading, setPlayerError]);


  if (!item || !item.streamUrl) { // Condição para quando não há item válido
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
        poster={item.posterUrl}
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
  );
}

    