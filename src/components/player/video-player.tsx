
"use client";

import type { FC } from 'react';
import React, { useRef, useEffect, useState } from 'react';
import { WifiOff, AlertTriangle } from 'lucide-react'; // For no-source and error states

interface VideoPlayerProps {
  src: string | null;
  title?: string; // Kept for consistency, but not used in this diagnostic version's UI
}

const VideoPlayer: FC<VideoPlayerProps> = ({ src, title = "Video" }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Add loading state

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Reset states when src changes
    setError(null);
    setIsLoading(true);
    video.removeAttribute('src'); // Ensure previous source is cleared
    try {
      video.load(); // Reset media element
    } catch (e) {
      console.warn("[Diagnostic Player] Error calling video.load() on src change:", e);
    }


    if (src) {
      console.log(`[Diagnostic Player] Setting src: ${src}`);
      video.src = src;

      const handleError = () => {
        const videoError = video.error;
        let message = `Erro ao carregar o vídeo. Código: ${videoError?.code || 'desconhecido'}.`;
        if (videoError) {
          switch (videoError.code) {
            case MediaError.MEDIA_ERR_ABORTED: message = "Reprodução abortada."; break;
            case MediaError.MEDIA_ERR_NETWORK: message = "Erro de rede. Verifique a conexão."; break;
            case MediaError.MEDIA_ERR_DECODE: message = "Erro de decodificação. Arquivo corrompido ou formato não suportado."; break;
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
              message = "Formato não suportado ou fonte inválida. Verifique o console do navegador para detalhes de CORS.";
              break;
          }
        }
        console.error(`[Diagnostic Player] Video Error: `, videoError, `for src: ${src}`);
        setError(message);
        setIsLoading(false);
      };

      const handleCanPlay = () => {
        console.log(`[Diagnostic Player] Video can play: ${src}`);
        setError(null); // Clear error if it can play
        setIsLoading(false);
        // Optional: try to play if allowed by browser
        // video.play().catch(e => console.warn("[Diagnostic Player] Autoplay after canplay was prevented:", e));
      };

      const handleLoadedMetadata = () => {
        console.log(`[Diagnostic Player] Video metadata loaded: ${src}`);
        setIsLoading(false);
      };
      
      const handleWaiting = () => {
        console.log(`[Diagnostic Player] Video waiting (buffering): ${src}`);
        if (!error) setIsLoading(true); // Show loading only if no prior error
      };

      const handlePlaying = () => {
        console.log(`[Diagnostic Player] Video playing: ${src}`);
        setIsLoading(false);
        setError(null);
      };


      video.addEventListener('error', handleError);
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('waiting', handleWaiting);
      video.addEventListener('playing', handlePlaying);


      // Attempt to load the new source
      try {
        video.load(); // This might be redundant if setting src already triggers load, but can be explicit.
      } catch (e) {
         console.warn("[Diagnostic Player] Error calling video.load() after setting src:", e);
      }


      return () => {
        console.log(`[Diagnostic Player] Cleaning up for src: ${src}`);
        video.removeEventListener('error', handleError);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('waiting', handleWaiting);
        video.removeEventListener('playing', handlePlaying);
        // Stop video and clear src to prevent playing in background on component unmount/src change
        if (!video.paused) video.pause();
        video.removeAttribute('src');
        try {
          video.load(); // This is a common way to reset the video element fully
        } catch (e) {
           console.warn("[Diagnostic Player] Error calling video.load() in cleanup:", e);
        }

      };
    } else {
      // Handle case where src is null or empty
      setIsLoading(false);
      setError(null); // No error, just no source
    }
  }, [src]);

  if (!src) {
    return (
      <div className="w-full aspect-video bg-black text-muted-foreground flex flex-col items-center justify-center rounded-lg">
        <WifiOff className="w-16 h-16 mb-4" />
        <p>Nenhuma fonte de vídeo selecionada.</p>
      </div>
    );
  }

  return (
    <div className="w-full aspect-video bg-black rounded-lg shadow-2xl relative group/player overflow-hidden">
      <video
        ref={videoRef}
        // src is set in useEffect to allow for cleanup and re-initialization
        controls // Use browser's default controls for this test
        className="w-full h-full"
        playsInline
        // crossOrigin="anonymous" // Removed for this test to be as vanilla as possible
      >
        Seu navegador não suporta a tag de vídeo.
      </video>
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10 pointer-events-none">
           <div className="w-12 h-12 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
           <p className="text-primary-foreground ml-3">Carregando vídeo...</p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-destructive/90 p-4 z-20 text-destructive-foreground text-center">
            <AlertTriangle className="h-12 w-12 mb-3" />
            <p className="text-lg font-semibold mb-1">Erro ao Carregar Vídeo</p>
            <p className="text-sm max-w-md">{error}</p>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
