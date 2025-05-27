
"use client";

import React, { useState, useEffect } from 'react';
import ReactPlayer from 'react-player/lazy'; // Lazy loading for better performance
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, WifiOff } from 'lucide-react';

interface VideoPlayerProps {
  streamUrl: string | null;
  onEnded?: () => void;
  onError?: (error: any, data?: any) => void;
  playing?: boolean;
}

export function VideoPlayer({ streamUrl, onEnded, onError, playing = true }: VideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true); // Ensures ReactPlayer only renders on the client
  }, []);

  useEffect(() => {
    if (streamUrl) {
      console.log("VideoPlayer: New streamUrl received:", streamUrl);
      setIsLoading(true);
      setError(null);
    } else {
      setIsLoading(false);
      setError(null); // Clear error if streamUrl becomes null (e.g. source deselected)
    }
  }, [streamUrl]);

  const handleReady = () => {
    console.log("VideoPlayer: Ready");
    setIsLoading(false);
    setError(null); // Clear any previous error on ready
  };

  const handleError = (e: any, data?: any, hlsInstance?: any, hlsGlobal?: any) => {
    setIsLoading(false);
    let errorMessage = "Ocorreu um erro ao carregar o vídeo."; // Default

    let suspectedCorsIssue = false;
    // Check if 'e' is an empty object and 'data' is not providing more details
    if (typeof e === 'object' && e !== null && Object.keys(e).length === 0 && !data) {
        suspectedCorsIssue = true;
    }

    console.error(
      "VideoPlayer Error (Raw Details):",
      {
        errorObj: e,
        dataObj: data,
        hlsInstanceObj: hlsInstance,
        hlsGlobalObj: hlsGlobal,
        streamUrl: streamUrl,
      },
      suspectedCorsIssue ? "This pattern (empty error object without additional data) often indicates a CORS issue with the video server." : ""
    );

    if (streamUrl?.toLowerCase().endsWith('.mp4')) {
        if (suspectedCorsIssue) {
            errorMessage = "Não foi possível carregar o vídeo MP4. Isso pode ser devido a restrições de CORS no servidor de vídeo ou o arquivo pode não estar acessível. Tente abrir a URL do vídeo diretamente em outra aba do navegador.";
        } else if (e?.type === 'error' && (data?.type === 'networkError' || data?.details?.includes('manifestLoadError'))) {
            errorMessage = "Falha ao carregar o vídeo MP4. Verifique sua conexão com a internet ou se o arquivo está acessível.";
        } else if (e?.message) {
            errorMessage = e.message;
        } else if (data?.type) {
            errorMessage = `Erro do player: ${data.type}`;
        }
    } else if (e?.message) { // For non-MP4 or if MP4-specific checks didn't catch it
        errorMessage = e.message;
    } else if (data?.type) {
        errorMessage = `Erro do player: ${data.type}`;
    }
    
    setError(errorMessage);
    if (onError) onError(e, data); // Propagate original error if a handler is passed as prop
  };

  const handleBuffer = () => {
    console.log("VideoPlayer: Buffering...");
    setIsLoading(true);
  }
  const handleBufferEnd = () => {
    console.log("VideoPlayer: BufferEnd");
    setIsLoading(false);
  }
  const handlePlay = () => {
    console.log("VideoPlayer: Play");
    setIsLoading(false); // Should not be loading if play starts
    setError(null);
  }

  if (!isClient) {
    return <Skeleton className="w-full aspect-video rounded-lg bg-muted" />;
  }

  if (!streamUrl && !error) {
    return (
      <div className="w-full aspect-video flex flex-col items-center justify-center bg-muted rounded-lg text-muted-foreground">
        <WifiOff className="h-16 w-16 mb-4" />
        <p className="text-lg">Nenhuma fonte de vídeo selecionada.</p>
        <p className="text-sm">Escolha uma fonte para iniciar a reprodução.</p>
      </div>
    );
  }
  
  return (
    <div className="w-full aspect-video relative bg-black rounded-lg overflow-hidden shadow-2xl">
      {(isLoading && streamUrl && !error) && ( 
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/50">
          <Skeleton className="w-full h-full opacity-50" />
           <div className="absolute text-primary-foreground text-lg">Carregando...</div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-destructive-foreground bg-destructive/80 p-4 z-10">
          <AlertTriangle className="h-12 w-12 mb-2" />
          <p className="font-semibold">Erro ao Carregar Vídeo</p>
          <p className="text-sm text-center">{error}</p>
        </div>
      )}
      {streamUrl && ( 
         <ReactPlayer
            key={streamUrl} 
            url={streamUrl}
            playing={playing && !error && !isLoading} 
            controls
            width="100%"
            height="100%"
            onReady={handleReady}
            onPlay={handlePlay}
            onBuffer={handleBuffer}
            onBufferEnd={handleBufferEnd}
            onError={handleError}
            onEnded={onEnded}
            className="absolute top-0 left-0"
            config={{
              file: {
                attributes: {
                    crossOrigin: 'anonymous', 
                }
              },
            }}
          />
      )}
    </div>
  );
}
