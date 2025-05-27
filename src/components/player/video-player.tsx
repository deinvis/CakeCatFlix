
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, Volume1, VolumeX, Maximize, Minimize, Rewind, FastForward, WifiOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface VideoPlayerProps {
  src: string | null;
  title?: string; // Optional title for the video
  // Add any other props your player might need, e.g., poster, onProgress, etc.
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

export default function VideoPlayer({ src: originalSrc, title: itemTitle }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0); // Percentage based
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [bufferProgress, setBufferProgress] = useState(0);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);


  const hideControls = useCallback(() => {
    if (isPlaying && !playerError && !isLoading) {
      setShowControls(false);
    }
  }, [isPlaying, playerError, isLoading]);

  const showAndAutoHideControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying && !isLoading) {
        controlsTimeoutRef.current = setTimeout(hideControls, 3000);
    }
  }, [hideControls, isPlaying, isLoading]);


  const handleError = useCallback(async (videoElement: HTMLVideoElement, sourceUrlForError: string | null) => {
      let message = "Ocorreu um erro desconhecido ao tentar reproduzir o vídeo.";
      let errorCode: number | string = "N/A";
      let errorMessageFromVideoElement: string | undefined = undefined;

      if (videoElement.error) {
        const error = videoElement.error;
        errorCode = error.code;
        errorMessageFromVideoElement = error.message;

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
            if (sourceUrlForError?.toLowerCase().endsWith('.mp4')) {
                 message += " Isso pode ser devido a restrições de CORS no servidor de vídeo ou o arquivo não está acessível. Tente abrir a URL do vídeo diretamente em outra aba do navegador para verificar se há erros de CORS no console.";
            }
            break;
          default:
            message = `Erro desconhecido no vídeo (Código: ${error.code || 'N/A'}). ${error.message || ''}`.trim();
        }
        // Override for suspected CORS on MP4 when error object is empty
        if (Object.keys(error).length === 0 && (!error.message || error.message.trim() === '') && sourceUrlForError?.toLowerCase().endsWith('.mp4')) {
            message = `Não foi possível carregar o vídeo MP4. Isso pode ser devido a restrições de CORS no servidor de vídeo ou o arquivo pode não estar acessível. Tente abrir a URL do vídeo diretamente em outra aba do navegador para verificar se há erros de CORS no console.`;
            errorCode = "CORS_SUSPECTED";
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

      if (errorCode === "CORS_SUSPECTED") {
        console.warn("Video Player Suspected CORS Error (Debug Info):", logPayload);
      } else {
        console.error("Video Player Error (Debug Info):", logPayload);
      }

      setPlayerError(message);
      setIsLoading(false);
      setIsPlaying(false);
      setShowControls(true);
  }, []);


  useEffect(() => {
    const video = videoRef.current;
    const srcToLoad = originalSrc;

    console.log("VideoPlayer: useEffect triggered. srcToLoad:", srcToLoad, "Current video.src:", video?.src);

    if (!video) {
        console.log("VideoPlayer: videoRef is null, exiting effect.");
        return;
    }

    // Reset states for new src
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setBufferProgress(0);
    setPlayerError(null);
    setShowControls(true);
    setIsLoading(true); // Assume loading until 'canplay' or error

    if (!srcToLoad) {
      console.log("VideoPlayer: srcToLoad is null or empty, clearing video source.");
      video.removeAttribute('src');
      try { video.load(); } catch(e) { console.warn("VideoPlayer: Error calling video.load() after removing src:", e); }
      setIsLoading(false);
      return;
    }

    const onPlay = () => { console.log("VideoPlayer: Event 'play'", srcToLoad); setPlayerError(null); setIsLoading(false); setIsPlaying(true); showAndAutoHideControls(); };
    const onPause = () => { console.log("VideoPlayer: Event 'pause'", srcToLoad); setIsPlaying(false); setShowControls(true); if(controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); };
    const onPlaying = () => { console.log("VideoPlayer: Event 'playing'", srcToLoad); setPlayerError(null); setIsLoading(false); setIsPlaying(true); };
    const onVolumeChange = () => {
      if (video) {
        setVolume(video.volume);
        setIsMuted(video.muted);
      }
    };
    const onEnded = () => { console.log("VideoPlayer: Event 'ended'", srcToLoad); setIsPlaying(false); setShowControls(true); setProgress(100); };
    const onWaiting = () => { console.log("VideoPlayer: Event 'waiting'", srcToLoad); if(!playerError) setIsLoading(true); };
    const onCanPlay = () => { console.log("VideoPlayer: Event 'canplay'", srcToLoad); setIsLoading(false); if (video.paused && !playerError && !isPlaying && video.autoplay) { video.play().catch(e => console.warn("Autoplay after canplay failed", e));} };
    const onErrorEvent = () => handleError(video, srcToLoad);
    const onLoadedMetadata = () => {
      console.log("VideoPlayer: Event 'loadedmetadata'", srcToLoad);
      if (video && isFinite(video.duration)) {
        setDuration(video.duration);
        setIsLoading(false); // Metadata loaded, not necessarily playable yet but duration is known
      }
    };
    const onTimeUpdate = () => {
        if(video && video.duration > 0 && !video.seeking) {
            setProgress((video.currentTime / video.duration) * 100);
            setCurrentTime(video.currentTime);
            if (video.buffered.length > 0) {
                try {
                  const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                  setBufferProgress((bufferedEnd / video.duration) * 100);
                } catch (e) { setBufferProgress(0); }
            } else {
                setBufferProgress(0);
            }
        }
    };


    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('play', onPlay);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('ended', onEnded);
    video.addEventListener('progress', onTimeUpdate); // For buffer progress
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('error', onErrorEvent);

    if (video.src !== srcToLoad) {
        console.log("VideoPlayer: Setting video.src to:", srcToLoad);
        video.src = srcToLoad;
        video.load();
    } else if (video.readyState === 0 && srcToLoad) {
        console.log("VideoPlayer: video.src is same but readyState is 0, calling load() for:", srcToLoad);
        video.load();
    } else if (video.readyState > 0 && video.paused && !isPlaying) {
        // If src is the same, metadata might be loaded, but we are not playing.
        // This can happen if user navigates away and back quickly or src prop doesn't change instance.
        // No explicit action needed here, user interaction will trigger play.
        setIsLoading(false); // Assume not loading if we have some readyState
    }


    return () => {
      console.log("VideoPlayer: Cleaning up for src:", srcToLoad);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('progress', onTimeUpdate);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('error', onErrorEvent);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      // No need to pause or reset src here, as the effect will re-run if src prop changes
    };
  }, [originalSrc, handleError, showAndAutoHideControls]); // originalSrc is the actual prop

  useEffect(() => {
    const playerElement = playerContainerRef.current;
    if (playerElement) {
        const enterHandler = () => {
            if (isPlaying) showAndAutoHideControls(); else setShowControls(true);
        };
        const leaveHandler = () => {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            if (isPlaying && !isLoading && !playerError) controlsTimeoutRef.current = setTimeout(hideControls, 300);
        };

        playerElement.addEventListener('mouseenter', enterHandler);
        playerElement.addEventListener('mousemove', showAndAutoHideControls);
        playerElement.addEventListener('mouseleave', leaveHandler);

        return () => {
            if(playerElement){
                playerElement.removeEventListener('mouseenter', enterHandler);
                playerElement.removeEventListener('mousemove', showAndAutoHideControls);
                playerElement.removeEventListener('mouseleave', leaveHandler);
            }
        };
    }
  }, [isPlaying, showAndAutoHideControls, hideControls, isLoading, playerError]);


  const handlePlayPauseButtonClick = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    const video = videoRef.current;
    if (video) {
      if (video.paused || video.ended) {
        video.play().catch(err => {
          console.warn("VideoPlayer: Error on manual play():", err);
          handleError(video, originalSrc); // Pass originalSrc here
        });
      } else {
        video.pause();
      }
    }
  }, [originalSrc, handleError]);

  const handleVolumeSliderChange = (newVolume: number[]) => {
    if (videoRef.current) {
      const vol = newVolume[0];
      videoRef.current.volume = vol;
      // State updated by 'volumechange' event
    }
  };

  const handleMuteToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      const newMutedState = !videoRef.current.muted;
      videoRef.current.muted = newMutedState;
      if (!newMutedState && videoRef.current.volume === 0) {
        videoRef.current.volume = 0.5; // Restore to a default volume
      }
      // State updated by 'volumechange' event
    }
  };

  const handleProgressSliderChange = (newProgress: number[]) => {
    if (videoRef.current && duration > 0) {
      const newTime = (newProgress[0] / 100) * duration;
      videoRef.current.currentTime = newTime;
      // State updated by 'timeupdate' event
    }
  };

  const handleSeekAmountClick = (e: React.MouseEvent, amount: number) => {
    e.stopPropagation();
    if (videoRef.current && duration > 0) {
      const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + amount));
      videoRef.current.currentTime = newTime;
      // State updated by 'timeupdate' event
    }
  };

  const handleFullscreenToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const player = playerContainerRef.current;
    if (!player) return;
    if (!document.fullscreenElement) {
      player.requestFullscreen().catch(err => {
        console.warn(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => console.warn("Error exiting fullscreen:", err));
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume > 0.5 ? Volume2 : Volume1;

  if (!originalSrc && !isLoading && !playerError) {
    return (
      <div ref={playerContainerRef} className="w-full aspect-video relative bg-black rounded-lg shadow-2xl group/player flex flex-col items-center justify-center text-muted-foreground p-4">
        <WifiOff className="w-16 h-16 mb-4" />
        <p className="text-lg">Nenhuma fonte de vídeo selecionada.</p>
      </div>
    );
  }

  return (
    <div
      ref={playerContainerRef}
      className="w-full aspect-video relative group/player bg-black rounded-lg shadow-2xl overflow-hidden"
      onClick={(e) => {
        // Only toggle play/pause if click is directly on container or video, not on controls
        if (e.target === playerContainerRef.current || e.target === videoRef.current) {
            handlePlayPauseButtonClick();
        }
      }}
    >
      <video ref={videoRef} className="w-full h-full object-contain" playsInline />

      {isLoading && !playerError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 pointer-events-none">
          <div className="w-12 h-12 border-4 border-background border-t-accent rounded-full animate-spin" title="Carregando..."></div>
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
            onMouseEnter={() => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); setShowControls(true); }}
            onMouseLeave={() => { if (isPlaying && !isLoading) showAndAutoHideControls(); }}
          >
            <div className="relative mb-2 px-1">
                <Slider
                  value={[progress]}
                  onValueChange={handleProgressSliderChange}
                  max={100}
                  step={0.1}
                  disabled={isLoading || duration === 0}
                  className="w-full h-2 [&>span:first-child]:h-2 [&_[role=slider]]:w-3.5 [&_[role=slider]]:h-3.5 [&_[role=slider]]:border-2"
                  aria-label="Progresso do vídeo"
                  onClick={(e) => e.stopPropagation()}
                />
                <div
                  className="absolute top-0 left-0 h-full bg-muted/40 rounded-full pointer-events-none"
                  style={{ width: `${bufferProgress}%` }}
                />
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
                <Button variant="ghost" size="icon" onClick={handleMuteToggleClick} className="text-primary-foreground hover:bg-white/10 hover:text-accent">
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
                <Button variant="ghost" size="icon" onClick={handleFullscreenToggleClick} className="text-primary-foreground hover:bg-white/10 hover:text-accent">
                  {isFullscreen ? <Minimize className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />}
                </Button>
              </div>
            </div>
          </div>
        )
      }
    </div>
  );
}
