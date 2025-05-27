
"use client";

import type { FC } from 'react';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, Volume1, VolumeX, Maximize, Minimize, Rewind, FastForward, AlertTriangle, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface VideoPlayerProps {
  src: string | null; // Renamed from originalSrc for consistency with HTML, can be null
  title?: string;
}

const VideoPlayer: FC<VideoPlayerProps> = ({ src: originalSrc, title = "Video" }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

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

  let controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // THIS IS THE CORRECTED PART: We will use originalSrc directly
  // const proxiedSrc = originalSrc ? `/api/proxy?targetUrl=${encodeURIComponent(originalSrc)}` : null; // REMOVED

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
          case MediaError.MEDIA_ERR_ABORTED: message = "A reprodução foi abortada."; break;
          case MediaError.MEDIA_ERR_NETWORK: message = "Erro de rede ao carregar o vídeo. Verifique a conexão."; break;
          case MediaError.MEDIA_ERR_DECODE: message = "Erro ao decodificar o vídeo. O arquivo pode estar corrompido ou em formato não suportado."; break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            message = `Formato de vídeo não suportado ou fonte inválida.`;
            if (sourceUrlForError && sourceUrlForError.toLowerCase().endsWith('.mp4')) {
                message += " Para MP4, isso pode ser devido a restrições de CORS no servidor ou o arquivo não está acessível. Verifique o console do navegador.";
            }
            // Attempt to fetch headers from the original source to see if it returns an error
            // This might still be blocked by CORS itself for the HEAD request, but worth a try for diagnostics
            if (sourceUrlForError) {
                try {
                    const headResponse = await fetch(sourceUrlForError, { method: 'HEAD', mode: 'cors' });
                    if (!headResponse.ok) {
                        message += ` (O servidor da fonte original respondeu com erro: ${headResponse.status} ${headResponse.statusText}).`;
                    }
                } catch (fetchError: any) {
                    // console.warn("VideoPlayer: Error fetching HEAD from source during error handling:", fetchError);
                    message += ` (Tentativa de verificar a fonte original também falhou: ${fetchError.message}).`;
                }
            }
            break;
          default: message = `Erro desconhecido no vídeo (Código: ${error.code || 'N/A'}).`;
        }
      } else if (!sourceUrlForError) {
          message = "Nenhuma fonte de vídeo fornecida."
      }

      console.error("Video Player Error (Debug Info):", {
        errorDetails: videoElement.error, // The MediaError object
        errorCode: errorCode,
        errorMessageFromVideoElement: errorMessageFromVideoElement,
        sourceUrl: sourceUrlForError,
        // proxiedUrlUsed: "N/A since proxy is removed from player"
      });
      setPlayerError(message);
      setIsLoading(false);
      setIsPlaying(false);
      setShowControls(true);
  }, []);


  useEffect(() => {
    const video = videoRef.current;
    // Use originalSrc directly, which is the `src` prop
    const srcToLoad = originalSrc;

    console.log("VideoPlayer: useEffect triggered. srcToLoad:", srcToLoad, "Current video src:", video?.src);


    if (!video) return;

    // Reset states when srcToLoad changes or becomes null
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setBufferProgress(0);
    setPlayerError(null);
    setShowControls(true); // Show controls when src changes

    if (!srcToLoad) {
      console.log("VideoPlayer: srcToLoad is null or empty, clearing video source.");
      video.removeAttribute('src');
      try { video.load(); } catch(e) { /* ignore */ }
      setIsLoading(false);
      return;
    }

    console.log("VideoPlayer: Setting up for new src:", srcToLoad);
    setIsLoading(true);


    const updateVideoProgress = () => {
      if (video.duration > 0 && !video.seeking) {
        setProgress((video.currentTime / video.duration) * 100);
        if (video.buffered.length > 0) {
          try {
            const bufferedEnd = video.buffered.end(video.buffered.length - 1);
            setBufferProgress((bufferedEnd / video.duration) * 100);
          } catch (e) {
             // console.warn("Error accessing video.buffered.end:", e);
             setBufferProgress(0); // Reset if error
          }
        } else {
            setBufferProgress(0);
        }
      }
      setCurrentTime(video.currentTime);
    };

    const setVideoDuration = () => {
        if (isFinite(video.duration)) {
            setDuration(video.duration);
            // Don't set isLoading false here yet, wait for 'canplay' or 'playing'
        } else {
            // Duration might be Infinity for live streams, or NaN if not loaded
            // Keep isLoading true or handle as live stream if needed
        }
    };
    const onPlay = () => { console.log("VideoPlayer: Event 'play'"); setIsLoading(false); setIsPlaying(true); setPlayerError(null); showAndAutoHideControls(); };
    const onPause = () => { console.log("VideoPlayer: Event 'pause'"); setIsPlaying(false); setShowControls(true); if(controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); };
    const onPlaying = () => { console.log("VideoPlayer: Event 'playing'"); setIsLoading(false); setIsPlaying(true); setPlayerError(null); };
    const onVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };
    const onEnded = () => { console.log("VideoPlayer: Event 'ended'"); setIsPlaying(false); setShowControls(true); setProgress(100); };
    const onWaiting = () => { console.log("VideoPlayer: Event 'waiting'"); if(!playerError) setIsLoading(true); };
    const onCanPlay = () => { console.log("VideoPlayer: Event 'canplay'"); setIsLoading(false); if (video.paused && !playerError && !isPlaying) { /* consider auto-play logic if desired */ }};
    const onErrorEvent = () => handleError(video, srcToLoad);


    video.addEventListener('timeupdate', updateVideoProgress);
    video.addEventListener('loadedmetadata', setVideoDuration);
    video.addEventListener('durationchange', setVideoDuration);
    video.addEventListener('play', onPlay);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('ended', onEnded);
    video.addEventListener('progress', updateVideoProgress);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('error', onErrorEvent);

    if (video.src !== srcToLoad) {
        console.log("VideoPlayer: Setting video.src to:", srcToLoad);
        video.src = srcToLoad;
        video.load(); // Call load() after changing src
    } else if (video.readyState === 0 && srcToLoad) { // If src is same but not loaded
        console.log("VideoPlayer: video.src is same but readyState is 0, calling load() for:", srcToLoad);
        video.load();
    }


    return () => {
      console.log("VideoPlayer: Cleaning up for src:", srcToLoad);
      video.removeEventListener('timeupdate', updateVideoProgress);
      video.removeEventListener('loadedmetadata', setVideoDuration);
      video.removeEventListener('durationchange', setVideoDuration);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('progress', updateVideoProgress);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('error', onErrorEvent);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      // Don't pause or reset src here if component is just re-rendering with same src.
      // Only reset src if srcToLoad becomes null, handled at top of effect.
    };
  }, [originalSrc, handleError, showAndAutoHideControls]); // Depend on originalSrc (the prop)

  useEffect(() => {
    const playerElement = playerContainerRef.current;
    if (playerElement) {
        const enterHandler = () => {
            if (isPlaying) showAndAutoHideControls(); else setShowControls(true);
        };
        const leaveHandler = () => {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            if (isPlaying && !isLoading) controlsTimeoutRef.current = setTimeout(hideControls, 300);
        };

        playerElement.addEventListener('mouseenter', enterHandler);
        playerElement.addEventListener('mousemove', showAndAutoHideControls);
        playerElement.addEventListener('mouseleave', leaveHandler);

        return () => {
            playerElement.removeEventListener('mouseenter', enterHandler);
            playerElement.removeEventListener('mousemove', showAndAutoHideControls);
            playerElement.removeEventListener('mouseleave', leaveHandler);
        };
    }
  }, [isPlaying, showAndAutoHideControls, hideControls, isLoading]);

  const handlePlayPauseButtonClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (video) {
      if (video.paused || video.ended) {
        video.play().catch(err => {
          console.error("VideoPlayer Error on manual play:", err);
          handleError(video, originalSrc);
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
      // videoRef.current.muted = vol === 0; // State updated by event
    }
  };

  const handleMuteToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      const newMutedState = !videoRef.current.muted;
      videoRef.current.muted = newMutedState;
      if (!newMutedState && videoRef.current.volume === 0) {
        videoRef.current.volume = 0.5;
      }
    }
  };

  const handleProgressSliderChange = (newProgress: number[]) => {
    if (videoRef.current && duration > 0) {
      const newTime = (newProgress[0] / 100) * duration;
      videoRef.current.currentTime = newTime;
    }
  };

  const handleSeekAmountClick = (e: React.MouseEvent, amount: number) => {
    e.stopPropagation();
    if (videoRef.current && duration > 0) {
      const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + amount));
      videoRef.current.currentTime = newTime;
    }
  };

  const handleFullscreenToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const player = playerContainerRef.current;
    if (!player) return;
    if (!document.fullscreenElement) {
      player.requestFullscreen().catch(err => {
        console.warn(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        // setPlayerError(`Não foi possível ativar tela cheia: ${err.message}`); // Avoid setting player error for this
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
      onClick={handlePlayPauseButtonClick}
    >
      <video ref={videoRef} className="w-full h-full object-contain" playsInline />

      {isLoading && !playerError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 pointer-events-none">
          <div className="w-12 h-12 border-4 border-background border-t-accent rounded-full animate-spin" title="Carregando..."></div>
        </div>
      )}

      {playerError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-destructive/90 p-4 z-30 text-destructive-foreground">
          <AlertTriangle className="h-10 w-10 md:h-12 md:w-12 mb-2 md:mb-3" />
          <p className="text-md md:text-lg font-semibold mb-1">Erro ao Reproduzir</p>
          <p className="text-xs md:text-sm max-w-md">{playerError}</p>
        </div>
      )}

      { originalSrc && !playerError && (
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ease-in-out z-20",
              (showControls || !isPlaying || isLoading) ? "opacity-100" : "opacity-0 group-hover/player:opacity-100 pointer-events-none group-hover/player:pointer-events-auto"
            )}
            onMouseEnter={() => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); setShowControls(true); }}
            onMouseLeave={() => { if (isPlaying) showAndAutoHideControls(); }}
          >
            <div className="relative mb-2 px-1">
                <Slider
                  value={[progress]}
                  onValueChange={handleProgressSliderChange}
                  max={100}
                  step={0.1}
                  disabled={isLoading || duration === 0 || playerError !== null}
                  className="w-full h-2 [&>span:first-child]:h-2 [&_[role=slider]]:w-3.5 [&_[role=slider]]:h-3.5 [&_[role=slider]]:border-2"
                  aria-label="Progresso do vídeo"
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
                <span className="text-xs sm:text-sm font-semibold truncate max-w-[80px] sm:max-w-[150px] hidden md:block select-none" title={title}>{title}</span>
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
};

export default VideoPlayer;
