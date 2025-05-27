
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, Volume1, VolumeX, Maximize, Minimize, Rewind, FastForward, WifiOff, AlertTriangle, Loader2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


interface VideoPlayerProps {
  src: string | null;
  title?: string;
  onEnded?: () => void; // Optional callback for when video ends
}

const formatTime = (timeInSeconds: number): string => {
  if (isNaN(timeInSeconds) || timeInSeconds === Infinity || timeInSeconds < 0) {
    return '00:00';
  }
  const hours = Math.floor(timeInSeconds / 3600);
  const minutes = Math.floor((timeInSeconds % 3600) / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  const pad = (num: number) => num.toString().padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
};

export default function VideoPlayer({ src: originalSrc, title: itemTitle, onEnded: onEndedCallback }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerWrapperRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const handleError = useCallback((videoElement: HTMLVideoElement, sourceUrlForError: string | null) => {
    let message = "Ocorreu um erro desconhecido ao tentar reproduzir o vídeo.";
    let errorCode: number | string = "N/A";
    let errorMessageFromVideoElement: string | undefined = undefined;

    if (videoElement.error) {
      const error = videoElement.error;
      errorCode = error.code;
      errorMessageFromVideoElement = error.message;

      // Check for the generic empty error object case, often related to CORS
      if (Object.keys(error).length === 0 && (!error.message || error.message.trim() === '') && sourceUrlForError?.toLowerCase().endsWith('.mp4')) {
          message = `Não foi possível carregar o vídeo MP4. Isso pode ser devido a restrições de CORS no servidor de vídeo ou o arquivo pode não estar acessível. Tente abrir a URL do vídeo diretamente em outra aba do navegador para verificar se há erros de CORS no console.`;
          errorCode = "CORS_SUSPECTED"; // Custom code for our logging
      } else {
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            message = "A reprodução foi abortada pelo usuário.";
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            message = "Erro de rede ao tentar carregar o vídeo. Verifique sua conexão.";
            break;
          case MediaError.MEDIA_ERR_DECODE:
            message = "Erro ao decodificar o vídeo. O arquivo pode estar corrompido ou em um formato não suportado.";
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            message = `Formato de vídeo não suportado ou fonte inválida.`;
            if (sourceUrlForError) {
                 message += ` (URL: ${sourceUrlForError}). Verifique o console do navegador para mais detalhes (especialmente erros de CORS ou rede).`;
            }
            break;
          default:
            message = `Erro desconhecido no vídeo (Código: ${error.code || 'N/A'}). ${error.message || ''}`.trim();
        }
      }
    } else if (!sourceUrlForError) {
        message = "Nenhuma fonte de vídeo fornecida."
    }

    const logPayload = {
      errorDetails: videoElement.error, // The MediaError object
      errorCode: errorCode,
      errorMessageFromVideoElement: errorMessageFromVideoElement,
      sourceUrl: sourceUrlForError,
    };

    // If the core MediaError object is empty and there's no message, it's highly indicative of CORS or similar opaque errors.
    const isOpaqueError = videoElement.error && 
                          typeof videoElement.error === 'object' && 
                          videoElement.error !== null && // Ensure error object is not null
                          Object.keys(videoElement.error).length === 0 && 
                          (!videoElement.error.message || videoElement.error.message.trim() === '');


    if (isOpaqueError) {
      // Use console.warn for opaque errors that are likely external (e.g., CORS)
      console.warn("Video Player - Likely Opaque Error (e.g., CORS) - Debug Info:", logPayload);
    } else {
      console.error("Video Player Error (Debug Info):", logPayload);
    }

    setPlayerError(message);
    setIsLoading(false); // Stop loading indicator on error
    setIsPlaying(false); // Ensure play state is false on error
    setShowControls(true); // Show controls so user can see error/interact if needed
  }, []);


  const hideControls = useCallback(() => {
    if (videoRef.current && !videoRef.current.paused && !isLoading && !playerError) {
      setShowControls(false);
    }
  }, [isLoading, playerError]);

  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (videoRef.current && !videoRef.current.paused && !isLoading && !playerError) {
         controlsTimeoutRef.current = setTimeout(hideControls, 3000);
    }
  }, [hideControls, isLoading, playerError]);
  

  useEffect(() => {
    const video = videoRef.current;
    const srcToLoad = originalSrc;
    console.log("VideoPlayer: useEffect triggered. srcToLoad:", srcToLoad);

    if (!video) {
      console.log("VideoPlayer: videoRef is null.");
      setIsLoading(false);
      return;
    }
    
    // Reset states for new src
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlayerError(null);
    setShowControls(true);
    
    if (!srcToLoad) {
      console.log("VideoPlayer: srcToLoad is null or empty, clearing video source.");
      video.removeAttribute('src');
      try { video.load(); } catch(e) { console.warn("VideoPlayer: Error calling video.load() after removing src:", e); }
      setIsLoading(false);
      return;
    }

    setIsLoading(true); // Assume loading until 'canplay' or error

    const onPlay = () => { console.log("VideoPlayer: Event 'play'", srcToLoad); setPlayerError(null); setIsLoading(false); setIsPlaying(true); resetControlsTimeout(); };
    const onPlaying = () => { console.log("VideoPlayer: Event 'playing'", srcToLoad); setPlayerError(null); setIsLoading(false); setIsPlaying(true); };
    const onPause = () => { console.log("VideoPlayer: Event 'pause'", srcToLoad); setIsPlaying(false); setShowControls(true); if(controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); };
    const onEnded = () => { console.log("VideoPlayer: Event 'ended'", srcToLoad); setIsPlaying(false); setShowControls(true); if (onEndedCallback) onEndedCallback(); };
    const onTimeUpdate = () => { if (video && !video.seeking) setCurrentTime(video.currentTime);};
    const onLoadedMetadata = () => {
      console.log("VideoPlayer: Event 'loadedmetadata'", srcToLoad);
      if (video && isFinite(video.duration)) {
        setDuration(video.duration);
      }
      setVolume(video?.volume ?? 1); // Ensure volume is set from video element
      setIsMuted(video?.muted ?? false); // Ensure muted state is set
      setIsLoading(false); 
      setPlayerError(null); // Clear error if metadata loads
      // Attempt to play if not already playing and no error.
      // Browsers might block autoplay, but this is a common pattern.
      if(video.paused && !playerError) {
          video.play().catch(e => {
            console.warn("VideoPlayer: Autoplay after loadedmetadata was prevented or failed:", e.name, e.message);
            // Don't set playerError here for autoplay, user can click play.
          });
      }
    };
    const onVolumeChange = () => {
      if (video) {
        setVolume(video.volume);
        setIsMuted(video.muted);
      }
    };
    const onErrorEvent = () => handleError(video, srcToLoad);
    const onWaiting = () => { console.log("VideoPlayer: Event 'waiting'", srcToLoad); if(!playerError) setIsLoading(true); };
    const onCanPlay = () => { console.log("VideoPlayer: Event 'canplay'", srcToLoad); setIsLoading(false); if (video.paused && !playerError && !isPlaying) { video.play().catch(e => console.warn("Autoplay after canplay failed", e));}};


    video.addEventListener('play', onPlay);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('error', onErrorEvent);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);
    
    if (video.src !== srcToLoad) {
        console.log("VideoPlayer: Setting video.src to:", srcToLoad);
        video.src = srcToLoad;
        video.load(); // Explicitly call load for new src
    } else if (video.readyState === 0 && srcToLoad) { // If src is same but video not initialized
        console.log("VideoPlayer: video.src is same but readyState is 0, calling load() for:", srcToLoad);
        video.load();
    } else if (video.readyState >= 1 && video.paused && !isPlaying && !playerError) {
        // If metadata is loaded, and we are supposed to be playing but aren't, try to play.
        // This covers cases where src prop might not change instance but content should play.
        // video.play().catch(e => console.warn("VideoPlayer: Retry play in useEffect failed", e));
    } else if (video.readyState >=1) {
        setIsLoading(false); // If metadata loaded, not loading.
    }


    return () => {
      console.log("VideoPlayer: Cleaning up event listeners for src:", srcToLoad);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('error', onErrorEvent);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      // Do not pause or reset src here, as it might be handled by parent or new effect run.
    };
  }, [originalSrc, handleError, resetControlsTimeout, onEndedCallback]); // Added onEndedCallback to dependencies

  useEffect(() => {
    const playerElement = playerWrapperRef.current;
    if (playerElement) {
      const handleMouseMove = () => resetControlsTimeout();
      const handleMouseLeave = () => {
         if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
         // Only set timeout to hide if actually playing and not loading/error
         if (isPlaying && !isLoading && !playerError) {
             controlsTimeoutRef.current = setTimeout(hideControls, 500);
         }
      };
      playerElement.addEventListener('mousemove', handleMouseMove);
      playerElement.addEventListener('mouseleave', handleMouseLeave);
      resetControlsTimeout(); // Initial call to show controls
      return () => {
        if (playerElement) {
          playerElement.removeEventListener('mousemove', handleMouseMove);
          playerElement.removeEventListener('mouseleave', handleMouseLeave);
        }
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      };
    }
  }, [resetControlsTimeout, hideControls, isPlaying, isLoading, playerError]); // Dependencies for controls visibility logic


  const handlePlayPauseButtonClick = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent click from bubbling to wrapper if controls are clicked
    const video = videoRef.current;
    if (video) {
      if (video.paused || video.ended) {
        video.play().catch(err => {
          console.warn("VideoPlayer: Error on manual play():", err);
          handleError(video, originalSrc);
        });
      } else {
        video.pause();
      }
    }
  }, [originalSrc, handleError]);

  const handleSeekSliderChange = (newTimeArray: number[]) => {
    const newTime = newTimeArray[0];
    if (videoRef.current && duration > 0 && !isNaN(newTime)) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime); // Optimistically update UI
    }
  };
  
  const handleSeekAmountClick = (e: React.MouseEvent, amount: number) => {
    e.stopPropagation();
    if (videoRef.current && duration > 0) {
      const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + amount));
      videoRef.current.currentTime = newTime;
    }
  };

  const handleVolumeSliderChange = (newVolumeArray: number[]) => {
    const newVolume = newVolumeArray[0];
    if (videoRef.current && !isNaN(newVolume)) {
      videoRef.current.volume = newVolume;
      // Volume state is updated by the 'volumechange' event listener
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      const newMutedState = !videoRef.current.muted;
      videoRef.current.muted = newMutedState;
      if (!newMutedState && videoRef.current.volume === 0) {
        videoRef.current.volume = 0.5; // Restore to a default volume
      }
      // Muted and volume state is updated by the 'volumechange' event listener
    }
  };

  const toggleFullScreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const player = playerWrapperRef.current;
    if (!player) return;

    if (!document.fullscreenElement) {
      player.requestFullscreen().catch(err => {
        console.warn(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        setPlayerError(`Não foi possível ativar tela cheia: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => console.warn("Error exiting fullscreen:", err));
      }
    }
  };
  
  useEffect(() => {
    const handleFsChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);


  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume > 0.5 ? Volume2 : Volume1;

  if (!originalSrc && !isLoading && !playerError) {
    return (
      <div ref={playerWrapperRef} className="w-full aspect-video relative bg-black rounded-lg shadow-2xl group/player flex flex-col items-center justify-center text-muted-foreground p-4">
        <WifiOff className="w-16 h-16 mb-4" />
        <p className="text-lg">Nenhuma fonte de vídeo selecionada.</p>
      </div>
    );
  }


  return (
    <div
      ref={playerWrapperRef}
      className="w-full aspect-video relative group/player bg-black rounded-lg shadow-2xl overflow-hidden"
      onClick={(e) => {
        // Only toggle play/pause if click is directly on container or video, not on controls
        if (e.target === playerWrapperRef.current || e.target === videoRef.current) {
            handlePlayPauseButtonClick();
        }
      }}
      onDoubleClick={(e) => {
        if (e.target === playerWrapperRef.current || e.target === videoRef.current) {
           if(e.type === 'dblclick') toggleFullScreen(e as any); // Cast needed as onDoubleClick is not strictly on div
        }
      }}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        // crossOrigin="anonymous" // Removed as per previous discussions on CORS
        // No src attribute here, it's set in useEffect
      />

      {isLoading && !playerError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 pointer-events-none">
          <Loader2 className="w-12 h-12 text-primary-foreground animate-spin" title="Carregando..." />
        </div>
      )}

      {playerError && (
         <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-destructive/90 p-4 z-30 text-destructive-foreground">
            <AlertTriangle className="h-10 w-10 md:h-12 md:w-12 mb-2 md:mb-3 text-destructive-foreground" />
            <p className="text-md md:text-lg font-semibold mb-1">Erro ao Reproduzir</p>
            <p className="text-xs md:text-sm max-w-md">{playerError}</p>
        </div>
      )}

      { originalSrc && !playerError && (
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/80 to-transparent transition-all duration-300 ease-in-out z-20",
              (showControls || !isPlaying || isLoading) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-full group-hover/player:opacity-100 group-hover/player:translate-y-0 pointer-events-none group-hover/player:pointer-events-auto"
            )}
            onMouseEnter={(e) => { e.stopPropagation(); if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); setShowControls(true); }}
            onMouseLeave={(e) => { e.stopPropagation(); if (isPlaying && !isLoading) resetControlsTimeout(); }}
          >
            <div className="relative mb-2 px-1">
                <Slider
                  value={[currentTime]} // Use currentTime for the slider value
                  max={duration || 0} // Ensure max is 0 if duration not loaded
                  step={0.1}
                  onValueChange={handleSeekSliderChange} // Use specific handler for slider change
                  disabled={isLoading || duration === 0}
                  className="w-full h-2 [&>span:first-child]:h-2 [&_[role=slider]]:w-3.5 [&_[role=slider]]:h-3.5 [&_[role=slider]]:border-2"
                  aria-label="Progresso do vídeo"
                  onClick={(e) => e.stopPropagation()}
                />
                {/* Buffer progress might be more complex with direct video element, 
                    can be added later if needed or rely on browser's default */}
            </div>

            <div className="flex items-center justify-between text-primary-foreground">
              <div className="flex items-center gap-1 sm:gap-2">
                <Button variant="ghost" size="icon" onClick={(e) => handleSeekAmountClick(e, -10)} className="text-primary-foreground hover:bg-white/10 hover:text-accent">
                  <Rewind className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handlePlayPauseButtonClick} className="text-primary-foreground hover:bg-white/10 hover:text-accent">
                  {isPlaying ? <Pause className="w-5 h-5 sm:w-7 sm:h-7" /> : <Play className="w-5 h-5 sm:w-7 sm:h-7" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={(e) => handleSeekAmountClick(e, 10)} className="text-primary-foreground hover:bg-white/10 hover:text-accent">
                  <FastForward className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={toggleMute} className="text-primary-foreground hover:bg-white/10 hover:text-accent">
                  <VolumeIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  onValueChange={handleVolumeSliderChange}
                  max={1}
                  step={0.01}
                  className="w-16 sm:w-20 h-2 [&>span:first-child]:h-2 [&_[role=slider]]:w-3 [&_[role=slider]]:h-3 [&_[role=slider]]:border-2"
                  aria-label="Controle de Volume"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-xs font-mono select-none">{formatTime(currentTime)} / {formatTime(duration)}</span>
                {itemTitle && <span className="text-xs sm:text-sm font-semibold truncate max-w-[80px] sm:max-w-[150px] hidden md:block select-none" title={itemTitle}>{itemTitle}</span>}
                <Button variant="ghost" size="icon" onClick={toggleFullScreen} className="text-primary-foreground hover:bg-white/10 hover:text-accent">
                  {isFullScreen ? <Minimize className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />}
                </Button>
              </div>
            </div>
          </div>
        )
      }
    </div>
  );
}
