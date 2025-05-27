
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, Volume1, VolumeX, Maximize, Minimize, AlertTriangle, WifiOff } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


interface VideoPlayerProps {
  src: string | null;
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
    // Only hide controls if video is playing and not loading/errored
    if (videoRef.current && !videoRef.current.paused && !isLoading && !playerError) {
         controlsTimeoutRef.current = setTimeout(hideControls, 3000);
    }
  }, [hideControls, isLoading, playerError]);
  
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) {
      setIsLoading(false);
      setPlayerError(src ? null : "Nenhuma fonte de vídeo fornecida.");
      // If src is null, ensure video element is reset
      if (video && !src) {
          video.removeAttribute('src');
          try { video.load(); } catch(e) { /* ignore */ } // Resets the media element
          setCurrentTime(0);
          setDuration(0);
          setIsPlaying(false);
      }
      return;
    }
    
    console.log("VideoPlayer: Setting up for new src:", src);
    setIsLoading(true);
    setPlayerError(null);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false); 

    const handlePlay = () => {
      console.log("VideoPlayer: Event 'play' for", src);
      setIsPlaying(true);
      setIsLoading(false); // Stop loading once play starts
      setPlayerError(null);
    };
    const handlePause = () => {
      console.log("VideoPlayer: Event 'pause' for", src);
      setIsPlaying(false);
    };
    const handleEnded = () => {
      console.log("VideoPlayer: Event 'ended' for", src);
      setIsPlaying(false);
    };
    const handleTimeUpdate = () => {
      if (video) setCurrentTime(video.currentTime);
    };
    const handleLoadedMetadata = () => {
      console.log("VideoPlayer: Event 'loadedmetadata' for", src);
      if(video) {
        setDuration(video.duration);
        setVolume(video.volume);
        setIsMuted(video.muted);
      }
      setIsLoading(false);
      setPlayerError(null); // Clear error if metadata loads successfully
    };
    const handleVolumeChangeHandler = () => { // Renamed to avoid conflict with outer scope handleVolumeChange
      if(video) {
        setVolume(video.volume);
        setIsMuted(video.muted);
      }
    };
    const handleWaiting = () => {
      console.log("VideoPlayer: Event 'waiting' (buffering) for", src);
      if (!playerError) setIsLoading(true); // Only show loading if no error
    };
    const handlePlaying = () => { // Added handler for 'playing' event
      console.log("VideoPlayer: Event 'playing' (resumed after buffer/seek) for", src);
      setIsLoading(false);
      setIsPlaying(true); // Ensure playing state is true
      setPlayerError(null); // Clear error if playing starts/resumes
    };
    const handleCanPlay = () => {
      console.log("VideoPlayer: Event 'canplay' for", src);
      setIsLoading(false); // Ready to play, hide spinner
    };

    const handleError = (e: Event) => {
        setIsLoading(false);
        setIsPlaying(false); // Stop trying to play on error
        const videoElement = e.target as HTMLVideoElement;
        let message = "Ocorreu um erro ao tentar reproduzir o vídeo.";

        if (videoElement.error) {
            const error = videoElement.error;
            // Check for empty error object, common with CORS issues for MP4
            if (typeof error === 'object' && error !== null && Object.keys(error).length === 0 && !error.code && src && src.toLowerCase().endsWith('.mp4')) {
                message = "Não foi possível carregar o vídeo MP4. Isso pode ser devido a restrições de CORS no servidor de vídeo ou o arquivo pode não estar acessível. Verifique o console do navegador (Ctrl+Shift+J ou Cmd+Opt+J) para mais detalhes e tente abrir a URL do vídeo diretamente em outra aba.";
            } else {
                switch (error.code) {
                    case MediaError.MEDIA_ERR_ABORTED: // Code 1
                        message = "A reprodução do vídeo foi abortada pelo usuário.";
                        break;
                    case MediaError.MEDIA_ERR_NETWORK: // Code 2
                        message = "Erro de rede ao carregar o vídeo. Verifique sua conexão à internet.";
                        break;
                    case MediaError.MEDIA_ERR_DECODE: // Code 3
                        message = "Erro ao decodificar o vídeo. O arquivo pode estar corrompido ou em um formato não suportado pelo seu navegador.";
                        break;
                    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: // Code 4
                        message = `Formato de vídeo não suportado ou fonte inválida. Isso pode ser um problema de CORS se a URL for externa. Verifique o console do navegador. (Código: ${error.code})`;
                        break;
                    default:
                        message = `Ocorreu um erro desconhecido no vídeo (Código: ${error.code || 'não especificado'}). Tente novamente ou verifique a URL.`;
                }
            }
        } else if (!src) { 
            message = "Nenhuma fonte de vídeo fornecida.";
        }
        
        console.error("Video Player Error (Debug Info):", { 
            errorDetails: videoElement.error, 
            errorCode: videoElement.error?.code,
            errorMessageFromVideoElement: videoElement.error?.message,
            sourceUrl: src 
        });
        setPlayerError(message);
    };
    

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('volumechange', handleVolumeChangeHandler);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying); // Added playing event
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);
    
    if (video.readyState >= 1 && video.duration) { // HAVE_METADATA and duration is known
        handleLoadedMetadata();
    }

    video.src = src;
    try { video.load(); } catch(e) { console.warn("Video load() call failed:", e); } // Recommended after setting src

    return () => {
      console.log("VideoPlayer: Cleaning up listeners for src:", src);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('volumechange', handleVolumeChangeHandler);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      // Stop video and reset src to prevent playing in background on component unmount or src change
      if (video && !video.paused) {
          video.pause();
      }
      // Do not reset src here if the component might be re-rendered with the same src
      // It's better handled at the start of the effect if src is truly different or null
    };
  }, [src]); // Re-run effect if src changes

  useEffect(() => {
    const playerElement = playerWrapperRef.current;
    if (playerElement) {
      playerElement.addEventListener('mousemove', resetControlsTimeout);
      playerElement.addEventListener('mouseleave', () => {
         if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
         controlsTimeoutRef.current = setTimeout(hideControls, 500); // Hide faster on mouse leave
      });
      resetControlsTimeout(); // Initial call to show controls
    }
    return () => {
      if (playerElement) {
        playerElement.removeEventListener('mousemove', resetControlsTimeout);
        playerElement.removeEventListener('mouseleave', () => { /* cleanup */ });
      }
       if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [resetControlsTimeout, hideControls]);

  // Effect to manage controls visibility based on playing state
  useEffect(() => {
    if (isPlaying && !playerError) {
      resetControlsTimeout(); // Start timer to hide controls
    } else {
      setShowControls(true); // Keep controls visible if paused, ended, or error
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
  }, [isPlaying, playerError, resetControlsTimeout]);

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused || videoRef.current.ended) {
        videoRef.current.play().catch(err => {
            console.error("Error on manual play().catch:", err);
            // setPlayerError might be set by the 'error' event already
        });
      } else {
        videoRef.current.pause();
      }
    }
  };

  const handleSeek = (value: number[]) => {
    if (videoRef.current && videoRef.current.duration) { // Ensure duration is available
      const newTime = value[0];
      if (isFinite(newTime)) { // Check if newTime is a finite number
          videoRef.current.currentTime = newTime;
          setCurrentTime(newTime);
      }
    }
  };

  const handleVolumeSliderChange = (value: number[]) => { // Renamed from handleVolumeChange to avoid conflict
    if (videoRef.current) {
      const newVolume = value[0];
      videoRef.current.volume = newVolume;
      // setVolume(newVolume); // state updated by 'volumechange' event
      videoRef.current.muted = newVolume === 0;
      // setIsMuted(newVolume === 0); // state updated by 'volumechange' event
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const currentMutedState = videoRef.current.muted;
      videoRef.current.muted = !currentMutedState;
      // setIsMuted(!currentMutedState); // state updated by 'volumechange' event
      if (!videoRef.current.muted && videoRef.current.volume === 0) { 
        videoRef.current.volume = 0.5; // if unmuting and vol is 0, set to 0.5
        // setVolume(0.5); // state updated by 'volumechange' event
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
  
  if (!src && !isLoading && !playerError) { // This condition is when src is null initially
    return (
      <div ref={playerWrapperRef} className="w-full max-w-5xl mx-auto aspect-video relative rounded-lg overflow-hidden shadow-2xl bg-black group flex flex-col items-center justify-center text-muted-foreground p-4">
        <WifiOff className="w-12 h-12 mb-2" />
        <span>Nenhuma fonte de vídeo.</span>
        <span className="text-xs mt-1">Selecione uma fonte para reproduzir.</span>
      </div>
    );
  }


  return (
    <div ref={playerWrapperRef} className="w-full max-w-5xl mx-auto aspect-video relative rounded-lg overflow-hidden shadow-2xl bg-black group">
      <video
        ref={videoRef}
        // src is set in useEffect
        className="w-full h-full object-contain"
        onClick={togglePlayPause}
        onDoubleClick={toggleFullScreen}
        playsInline
        controls={false} // Use custom controls
        crossOrigin="anonymous" // Good practice for CORS, though server must still allow
      />
      {isLoading && !playerError && ( // Show loading spinner only if no error
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
      {/* Controls div (conditionally shown) */}
      {src && !playerError && ( /* Only show controls if src is valid and no error and not initial loading without duration */
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 p-3 md:p-4 bg-gradient-to-t from-black/80 to-transparent transition-all duration-300 ease-in-out z-20",
            (showControls || !isPlaying || isLoading) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-full",
            "group-hover:opacity-100 group-hover:translate-y-0" 
          )}
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
          <div className="flex items-center justify-between text-white">
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
                  className="[&>span:first-child>span]:bg-white [&>span:last-child]:bg-white/50 [&>span:last-child]:border-white"
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

