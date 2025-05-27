
"use client";

import React, { useState, useEffect } from 'react';
import ReactPlayer from 'react-player/lazy'; // Lazy loading for better performance
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, WifiOff } from 'lucide-react';

interface VideoPlayerProps {
  streamUrl: string | null;
  onEnded?: () => void;
  onError?: (error: any) => void;
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
      setIsLoading(true);
      setError(null);
    } else {
      setIsLoading(false);
      setError("Nenhuma URL de stream fornecida.");
    }
  }, [streamUrl]);

  const handleReady = () => setIsLoading(false);
  const handleError = (e: any, data?: any, hlsInstance?: any, hlsGlobal?: any) => {
    setIsLoading(false);
    let errorMessage = "Ocorreu um erro ao carregar o vídeo.";
    if (typeof e === 'string') {
        errorMessage = e;
    } else if (data && data.type === 'networkError') {
        errorMessage = "Erro de rede. Verifique sua conexão.";
    } else if (e && e.message) {
        errorMessage = e.message;
    }
    console.error("VideoPlayer Error:", e, data);
    setError(errorMessage);
    if (onError) onError(e);
  };
  const handleBuffer = () => setIsLoading(true);
  const handleBufferEnd = () => setIsLoading(false);

  if (!isClient) {
    return <Skeleton className="w-full aspect-video rounded-lg bg-muted" />;
  }

  if (!streamUrl && !isLoading && !error) {
    return (
      <div className="w-full aspect-video flex flex-col items-center justify-center bg-muted rounded-lg text-muted-foreground">
        <WifiOff className="h-16 w-16 mb-4" />
        <p className="text-lg">Nenhuma fonte de vídeo selecionada.</p>
        <p className="text-sm">Escolha uma fonte e qualidade para iniciar.</p>
      </div>
    );
  }
  
  return (
    <div className="w-full aspect-video relative bg-black rounded-lg overflow-hidden shadow-2xl">
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Skeleton className="w-full h-full" />
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
            key={streamUrl} // Re-initialize player if URL changes
            url={streamUrl}
            playing={playing && !error} // Only play if no error
            controls
            width="100%"
            height="100%"
            onReady={handleReady}
            onBuffer={handleBuffer}
            onBufferEnd={handleBufferEnd}
            onError={handleError}
            onEnded={onEnded}
            className="absolute top-0 left-0"
            config={{
              file: {
                forceHLS: streamUrl.includes('.m3u8'),
                attributes: {
                    crossOrigin: 'anonymous' // May help with some CORS issues for subtitles/thumbnails
                }
              },
            }}
          />
      )}
    </div>
  );
}
