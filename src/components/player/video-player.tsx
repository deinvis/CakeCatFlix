
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
      setError(null); 
    }
  }, [streamUrl]);

  const handleReady = () => {
    console.log("VideoPlayer: Ready");
    setIsLoading(false);
    setError(null);
  };

  const handleError = (e: any, data?: any, hlsInstance?: any, hlsGlobal?: any) => {
    setIsLoading(false);
    let errorMessage = "Ocorreu um erro ao carregar o vídeo."; 

    // Check for CORS-like empty error objects
    const suspectedCorsIssue = typeof e === 'object' && e !== null && Object.keys(e).length === 0 && !data;

    console.error(
      "VideoPlayer Error (Raw Details):",
      {
        errorObj: e,
        dataObj: typeof data === 'object' ? data : { value: data, type: typeof data }, // Refined logging for data
        hlsInstanceObj: hlsInstance,
        hlsGlobalObj: hlsGlobal,
        streamUrl: streamUrl,
      },
      suspectedCorsIssue ? "This pattern (empty error object without additional data) often indicates a CORS issue with the video server. Check the network tab for blocked requests." : ""
    );

    if (streamUrl?.toLowerCase().endsWith('.mp4')) {
      if (suspectedCorsIssue) {
        errorMessage = "Não foi possível carregar o vídeo MP4. Isso pode ser devido a restrições de CORS no servidor de vídeo ou o arquivo pode não estar acessível. Verifique se a URL do vídeo abre diretamente no navegador e observe o console para erros de CORS.";
      } else if (e?.type === 'error' && (data?.type === 'networkError' || data?.details?.includes('manifestLoadError') || data?.details?.includes('fragLoadError'))) {
        errorMessage = "Falha ao carregar o vídeo MP4. Verifique sua conexão com a internet ou se o arquivo está acessível e não corrompido.";
      } else if (e?.message) {
        errorMessage = `Erro no player: ${e.message}`;
      } else if (typeof data === 'object' && data?.type) {
        errorMessage = `Erro do player: ${data.type}${data.details ? ` (${data.details})` : ''}`;
      }
    } else if (e?.message) {
      errorMessage = `Erro no player: ${e.message}`;
    } else if (typeof data === 'object' && data?.type) {
      errorMessage = `Erro do player: ${data.type}${data.details ? ` (${data.details})` : ''}`;
    }
    
    setError(errorMessage);
    if (onError) onError(e, data);
  };

  const handleBuffer = () => {
    console.log("VideoPlayer: Buffering...");
    if (!error) setIsLoading(true); 
  }
  const handleBufferEnd = () => {
    console.log("VideoPlayer: BufferEnd");
    if (!error) setIsLoading(false);
  }
  const handlePlay = () => {
    console.log("VideoPlayer: Play");
    if (!error) setIsLoading(false); 
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
        <div className="absolute inset-0 flex flex-col items-center justify-center text-destructive-foreground bg-destructive/80 p-4 z-10 text-center">
          <AlertTriangle className="h-12 w-12 mb-2" />
          <p className="font-semibold">Erro ao Carregar Vídeo</p>
          <p className="text-sm">{error}</p>
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
                },
              },
            }}
          />
      )}
    </div>
  );
}
