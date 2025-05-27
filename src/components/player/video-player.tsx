
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, Volume1, VolumeX, Maximize, Minimize, AlertTriangle, WifiOff } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VideoPlayerProps {
  src: string | null; // Modified to accept null
  // posterUrl?: string; // Optional: if you want to use a poster
}

const formatTime = (timeInSeconds: number): string => {
  if (isNaN(timeInSeconds) || timeInSeconds === Infinity || timeInSeconds < 0) {
    return '00:00';
  }
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export function VideoPlayer({ src }: VideoPlayerProps) {
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


  const hideControls = useCallback(() => {
    if (videoRef.current && !videoRef.current.paused) {
      setShowControls(false);
    }
  }, []);

  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (videoRef.current && !videoRef.current.paused) {
         controlsTimeoutRef.current = setTimeout(hideControls, 3000);
    }
  }, [hideControls]);
  
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) { // Do nothing if no video element or no src
      setIsLoading(false);
      if (!src) setPlayerError("Nenhuma fonte de vídeo fornecida.");
      return;
    }
    
    setIsLoading(true);
    setPlayerError(null);
    // When src changes, reset states
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);


    const handlePlay = () => {
      setIsPlaying(true);
      setIsLoading(false); // Stop loading once play starts
      setPlayerError(null); // Clear any previous error
    };
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setVolume(video.volume);
      setIsMuted(video.muted);
      setIsLoading(false);
    };
    const handleVolumeChange = () => {
      if (video){ // Ensure video still exists
        setVolume(video.volume);
        setIsMuted(video.muted);
      }
    };
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleError = (e: Event) => {
        setIsLoading(false);
        const videoElement = e.target as HTMLVideoElement;
        let message = "Ocorreu um erro ao tentar reproduzir o vídeo.";
        if (videoElement.error) {
            switch (videoElement.error.code) {
                case MediaError.MEDIA_ERR_ABORTED:
                    message = "A reprodução do vídeo foi abortada.";
                    break;
                case MediaError.MEDIA_ERR_NETWORK:
                    message = "Erro de rede ao carregar o vídeo. Verifique sua conexão.";
                    break;
                case MediaError.MEDIA_ERR_DECODE:
                    message = "Erro ao decodificar o vídeo. O arquivo pode estar corrompido ou em formato não suportado.";
                    break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    message = "Formato de vídeo não suportado ou fonte inválida. Verifique o console do navegador para erros de CORS ou rede.";
                    break;
                default:
                    message = `Erro desconhecido no vídeo (código: ${videoElement.error.code}).`;
            }
        } else if (!src) {
            message = "Nenhuma fonte de vídeo fornecida."
        }
        console.error("Video Player Error:", videoElement.error, "Source URL:", src);
        setPlayerError(message);
    };


    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);
    
    if (video.readyState >= 1) { // HAVE_METADATA
        handleLoadedMetadata();
    }
    // Attempt to play if src is valid and not already trying to play
    // Autoplay might be blocked by browser policy, user might need to click
    // video.play().catch(() => {
    //   console.warn("Autoplay foi bloqueado ou falhou.");
    // });

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [src]); // Re-run effect if src changes

  useEffect(() => {
    const playerElement = playerWrapperRef.current;
    if (playerElement) {
      playerElement.addEventListener('mousemove', resetControlsTimeout);
      playerElement.addEventListener('mouseleave', () => {
         if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
         controlsTimeoutRef.current = setTimeout(hideControls, 500);
      });
      resetControlsTimeout();
    }
    return () => {
      if (playerElement) {
        playerElement.removeEventListener('mousemove', resetControlsTimeout);
        playerElement.removeEventListener('mouseleave', () => { /* cleanup */ });
      }
    };
  }, [resetControlsTimeout, hideControls]);

  useEffect(() => {
    if (isPlaying) {
      resetControlsTimeout();
    } else {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
  }, [isPlaying, resetControlsTimeout]);

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused || videoRef.current.ended) {
        videoRef.current.play().catch(err => {
            console.error("Erro ao tentar play manual:", err);
            setPlayerError("Não foi possível iniciar a reprodução.");
            setIsLoading(false);
        });
      } else {
        videoRef.current.pause();
      }
    }
  };

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeSliderChange = (value: number[]) => {
    if (videoRef.current) {
      const newVolume = value[0];
      videoRef.current.volume = newVolume;
      // setVolume(newVolume); // volume state is updated by 'volumechange' event
      videoRef.current.muted = newVolume === 0;
      // setIsMuted(newVolume === 0); // muted state is updated by 'volumechange' event
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      // setIsMuted(!isMuted); // state updated by 'volumechange'
      if (videoRef.current.muted && videoRef.current.volume === 0) { 
        // If muting and volume is 0, it's already effectively muted.
        // If unmuting and volume is 0, set to a default
        // This case is tricky, handled better by 'volumechange' event
      } else if (!videoRef.current.muted && videoRef.current.volume === 0) {
         videoRef.current.volume = 0.5; // if unmuting and vol is 0, set to 0.5
      }
    }
  };

  const toggleFullScreen = () => {
    const player = playerWrapperRef.current;
    if (!player) return;

    if (!document.fullscreenElement) {
      player.requestFullscreen().catch(err => {
        // alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        console.warn(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };
  
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);


  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume > 0.5 ? Volume2 : Volume1;
  
  if (!src && !isLoading && !playerError) {
    return (
      <div ref={playerWrapperRef} className="w-full max-w-5xl mx-auto aspect-video relative rounded-lg overflow-hidden shadow-2xl bg-black group flex items-center justify-center text-muted-foreground">
        <WifiOff className="w-12 h-12 mb-2" />
        <span>Nenhuma fonte de vídeo.</span>
      </div>
    );
  }


  return (
    <div ref={playerWrapperRef} className="w-full max-w-5xl mx-auto aspect-video relative rounded-lg overflow-hidden shadow-2xl bg-black group">
      <video
        ref={videoRef}
        src={src || undefined} // Pass undefined if src is null to avoid <video src="null">
        className="w-full h-full object-contain"
        onClick={togglePlayPause}
        onDoubleClick={toggleFullScreen}
        playsInline
        // poster={posterUrl} // Add if you re-introduce posterUrl prop
        crossOrigin="anonymous" // Good practice for CORS, though server must still allow
      />
      {(isLoading && !playerError) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
          <div className="w-12 h-12 border-4 border-background border-t-accent rounded-full animate-spin" title="Carregando..."></div>
        </div>
      )}
      {playerError && (
         <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-destructive/90 p-4 z-10 text-destructive-foreground">
          <AlertTriangle className="h-10 w-10 md:h-12 md:w-12 mb-2 md:mb-3" />
          <p className="text-md md:text-lg font-semibold mb-1">Erro ao Carregar Vídeo</p>
          <p className="text-xs md:text-sm max-w-md">{playerError}</p>
        </div>
      )}
      {src && !playerError && ( // Only show controls if there's a src and no error
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 p-3 md:p-4 bg-gradient-to-t from-black/80 to-transparent transition-all duration-300 ease-in-out z-20", // Ensure controls are above video for clicks
            (showControls || !isPlaying || isLoading) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-full",
            "group-hover:opacity-100 group-hover:translate-y-0" // Ensure hover on wrapper shows controls
          )}
          // onClick={(e) => e.stopPropagation()} // Prevent clicks on controls from toggling play/pause on video
        >
          <div className="mb-2 px-1">
            <Slider
              value={[currentTime]}
              max={duration || 0}
              step={0.1}
              onValueChange={handleSeek}
              disabled={isLoading || duration === 0}
              aria-label="Progresso do vídeo"
            />
          </div>
          <div className="flex items-center justify-between text-white"> {/* Changed to text-white for better visibility on gradient */}
            <div className="flex items-center gap-2 md:gap-3">
              <Button variant="ghost" size="icon" onClick={togglePlayPause} className="text-white hover:bg-white/20 focus-visible:ring-white" aria-label={isPlaying ? "Pausar" : "Reproduzir"}>
                {isPlaying ? <Pause className="w-5 h-5 md:w-6 md:h-6" /> : <Play className="w-5 h-5 md:w-6 md:h-6" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white hover:bg-white/20 focus-visible:ring-white" aria-label={isMuted ? "Ativar som" : "Desativar som"}>
                <VolumeIcon className="w-5 h-5 md:w-6 md:h-6" />
              </Button>
              <div className="w-16 md:w-24">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.01}
                  onValueChange={handleVolumeSliderChange}
                  aria-label="Volume"
                  className="[&>span:first-child>span]:bg-white [&>span:last-child]:bg-white/50 [&>span:last-child]:border-white" // Style slider thumb and track for dark bg
                />
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <span className="text-xs md:text-sm font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <Button variant="ghost" size="icon" onClick={toggleFullScreen} className="text-white hover:bg-white/20 focus-visible:ring-white" aria-label={isFullScreen ? "Sair da tela cheia" : "Entrar em tela cheia"}>
                {isFullScreen ? <Minimize className="w-5 h-5 md:w-6 md:h-6" /> : <Maximize className="w-5 h-5 md:w-6 md:h-6" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
