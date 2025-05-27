
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
      // Don't set an error here if streamUrl is null initially,
      // it might just mean no source is selected yet.
      // The UI handles the "Nenhuma fonte de vídeo selecionada" message.
    }
  }, [streamUrl]);

  const handleReady = () => setIsLoading(false);

  const handleError = (e: any, data?: any, hlsInstance?: any, hlsGlobal?: any) => {
    setIsLoading(false);
    let errorMessage = "Ocorreu um erro ao carregar o vídeo."; // Default

    if (typeof e === 'string') {
        errorMessage = e;
    } else if (data && data.type === 'networkError') {
        errorMessage = "Erro de rede. Verifique sua conexão e se a URL do stream está acessível.";
    } else if (e && e.message) {
        errorMessage = e.message;
    } else if (data && typeof data === 'object') {
        // Try to get more info from data if e was not informative
        if (data.details && typeof data.details === 'string') {
            errorMessage = `Detalhes do erro: ${data.details}`;
        } else if (data.type && typeof data.type === 'string') {
             errorMessage = `Erro do player: ${data.type}`;
        }
    } else if (typeof e === 'object' && e !== null && Object.keys(e).length > 0) {
        // Fallback for other error objects
        try {
            const eString = JSON.stringify(e);
            errorMessage = `Erro do player: ${eString}`;
        } catch (stringifyError) {
            if (e.toString && e.toString() !== '[object Object]') {
                errorMessage = e.toString();
            }
            // If all fails, stick to the default message
        }
    }

    // Refined console logging
    if (e && typeof e === 'object' && Object.keys(e).length === 0 && data === undefined) {
        console.warn("VideoPlayer: Recebeu um erro genérico do player sem detalhes específicos.", "Raw error object:", e, "Data:", data);
    } else {
        console.error("VideoPlayer Error (Raw Details):", { errorObj: e, dataObj: data, hlsInstanceObj: hlsInstance, hlsGlobalObj: hlsGlobal });
    }
    
    setError(errorMessage);
    if (onError) onError(e); // Propagate original error if a handler is passed as prop
  };

  const handleBuffer = () => setIsLoading(true);
  const handleBufferEnd = () => setIsLoading(false);

  if (!isClient) {
    return <Skeleton className="w-full aspect-video rounded-lg bg-muted" />;
  }

  if (!streamUrl && !error) { // Show placeholder if no stream and no error yet
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
      {isLoading && !error && ( // Show loading skeleton only if no error
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Skeleton className="w-full h-full" />
           <div className="absolute text-primary-foreground text-lg">Carregando...</div>
        </div>
      )}
      {error && ( // Display error message prominently
        <div className="absolute inset-0 flex flex-col items-center justify-center text-destructive-foreground bg-destructive/80 p-4 z-10">
          <AlertTriangle className="h-12 w-12 mb-2" />
          <p className="font-semibold">Erro ao Carregar Vídeo</p>
          <p className="text-sm text-center">{error}</p>
        </div>
      )}
      {streamUrl && ( // Only attempt to render ReactPlayer if streamUrl is present
         <ReactPlayer
            key={streamUrl} // Re-initialize player if URL changes
            url={streamUrl}
            playing={playing && !error && !isLoading} // Play only if no error and not initial loading after URL change
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
                    crossOrigin: 'anonymous' 
                }
              },
            }}
          />
      )}
    </div>
  );
}
