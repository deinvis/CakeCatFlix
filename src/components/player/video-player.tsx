
"use client";

import React, { useEffect, useRef, useState } from 'react';
import { WifiOff } from 'lucide-react'; // For no video source

interface VideoPlayerProps {
  src: string | null;
  title?: string; 
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, title }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    setVideoError(null);
    setIsLoading(true); // Assume loading initially when src changes

    console.log(`[Diagnostic Player] Attempting to load src: ${src}`);

    const handleError = () => {
      const error = videoElement.error;
      let message = "Unknown video error.";
      let isSuspectedCorsOrNetworkIssue = false;

      if (error) {
        message = `Error Code: ${error.code}, Message: ${error.message || 'No specific message.'}`;
        if (error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
          message += " (Format not supported or source error. Check console for CORS issues if it's an MP4 from another domain.)";
        }
        // Check if the error object is empty (common for CORS)
        if (typeof error === 'object' && error !== null && Object.keys(error).length === 0 && error.constructor === Object) {
          isSuspectedCorsOrNetworkIssue = true;
          message = "Video could not be loaded. This might be a CORS issue on the video server or a network problem. Please check the browser console for more details.";
        }
      } else if (!src) {
        // This case should ideally be handled before trying to set src
        message = "No video source was provided to the player.";
      } else {
        // Generic error if video.error is null but an error event still fired
        isSuspectedCorsOrNetworkIssue = true; // Treat as suspect if error object is missing but event fired
        message = "An unexpected error occurred while trying to load the video. It might be a network issue or a problem with the video source (e.g. CORS).";
      }
      
      setVideoError(message);
      if (isSuspectedCorsOrNetworkIssue) {
        console.warn(`[Diagnostic Player] Suspected CORS/Network Video Error: `, error, `for src: ${src}`);
      } else {
        console.error(`[Diagnostic Player] Video Error: `, error, `for src: ${src}`);
      }
      setIsLoading(false);
    };

    const handleCanPlay = () => {
      console.log(`[Diagnostic Player] Can play src: ${src}`);
      setIsLoading(false);
      setVideoError(null); // Clear any previous error
      videoElement.play().catch(e => {
        console.warn("[Diagnostic Player] Autoplay prevented:", e);
        // User might need to click to play
      });
    };

    const handleWaiting = () => {
      console.log(`[Diagnostic Player] Waiting (buffering) for src: ${src}`);
      if (!videoError) { // Don't show loading if there's already an error
        setIsLoading(true);
      }
    };
    
    const handlePlaying = () => {
      console.log(`[Diagnostic Player] Playing src: ${src}`);
      setIsLoading(false);
      setVideoError(null); // Clear error when playback starts/resumes
    };

    const handleLoadedMetadata = () => {
      console.log(`[Diagnostic Player] Metadata loaded for src: ${src}`);
      // Duration is now available: videoElement.duration
      // We could set isLoading to false here if not already playing
      if (!videoElement.paused) { // If it's already playing due to autoplay or previous canplay
        setIsLoading(false);
      }
    };


    videoElement.addEventListener('error', handleError);
    videoElement.addEventListener('canplay', handleCanPlay);
    videoElement.addEventListener('waiting', handleWaiting);
    videoElement.addEventListener('playing', handlePlaying);
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);


    // Set src and load
    if (src && src.trim() !== "") {
      videoElement.src = src;
      videoElement.load(); // Explicitly call load
    } else {
      setIsLoading(false);
      setVideoError("No video source provided.");
      console.warn("[Diagnostic Player] No valid src provided.");
      videoElement.removeAttribute('src'); // Ensure no old src is lingering
      try { videoElement.load(); } catch(e) {/*ignore*/}
    }

    return () => {
      videoElement.removeEventListener('error', handleError);
      videoElement.removeEventListener('canplay', handleCanPlay);
      videoElement.removeEventListener('waiting', handleWaiting);
      videoElement.removeEventListener('playing', handlePlaying);
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      
      if (!videoElement.paused) {
        videoElement.pause();
      }
      videoElement.removeAttribute('src');
      try {
        // This helps reset the video element, especially if it's in an error state.
        videoElement.load(); 
      } catch (e) { /* ignore potential errors on load in cleanup */ }
      console.log(`[Diagnostic Player] Cleaned up for src: ${src}`);
    };
  }, [src]);

  if (!src || src.trim() === "") {
    return (
      <div className="aspect-video bg-black flex flex-col items-center justify-center text-muted-foreground rounded-lg p-4 text-center">
        <WifiOff className="w-12 h-12 mb-2" />
        <p>Nenhuma fonte de vídeo selecionada.</p>
      </div>
    );
  }

  return (
    <div className="aspect-video bg-black relative rounded-lg">
      <video
        ref={videoRef}
        controls // Use browser default controls for this diagnostic version
        className="w-full h-full"
        playsInline
        // crossOrigin="anonymous" // Best to omit unless specifically needed and server supports it
      >
        Seu navegador não suporta a tag de vídeo.
      </video>
      {isLoading && !videoError && ( // Only show loading if no error
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
          <div className="w-10 h-10 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
          <p className="text-white ml-3">Carregando vídeo...</p>
        </div>
      )}
      {videoError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-destructive/90 text-destructive-foreground p-4 text-center rounded-lg">
          <p className="font-semibold text-lg mb-1">Erro ao Carregar Vídeo</p>
          <p className="text-sm max-w-md">{videoError}</p>
          <p className="text-xs mt-3 opacity-80">URL: {src}</p>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
