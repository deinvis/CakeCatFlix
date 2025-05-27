"use client";

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { LOCALSTORAGE_PARENTAL_CONTROL_KEY } from '@/lib/constants';

export function ParentalControl() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const storedValue = localStorage.getItem(LOCALSTORAGE_PARENTAL_CONTROL_KEY);
    if (storedValue) {
      setIsEnabled(storedValue === 'true');
    }
    setIsMounted(true);
  }, []);

  const toggleControl = (checked: boolean) => {
    setIsEnabled(checked);
    localStorage.setItem(LOCALSTORAGE_PARENTAL_CONTROL_KEY, checked.toString());
    toast({
      title: "Controle Parental Atualizado",
      description: `Filtro de conteúdo adulto agora está ${checked ? 'ativado' : 'desativado'}.`,
    });
  };
  
  if (!isMounted) {
    return (
      <Card className="shadow-lg border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-6 w-6 text-primary" /> Controle Parental</CardTitle>
          <CardDescription>Carregando configurações de controle parental...</CardDescription>
        </CardHeader>
        <CardContent className="h-20 animate-pulse bg-muted/50 rounded-md"></CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-primary" /> Controle Parental
        </CardTitle>
        <CardDescription>
          Ative para filtrar conteúdo que possa ser inadequado para crianças (ex: títulos ou grupos contendo "XXX", "ADULTOS").
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          <Switch
            id="parental-control-switch"
            checked={isEnabled}
            onCheckedChange={toggleControl}
            aria-label="Alternar controle parental"
          />
          <Label htmlFor="parental-control-switch" className="text-base">
            {isEnabled ? 'Filtro Ativado' : 'Filtro Desativado'}
          </Label>
        </div>
        {isEnabled && (
            <p className="mt-4 text-sm text-muted-foreground">
                O filtro tentará ocultar canais, filmes ou séries se o título ou grupo contiver explicitamente palavras-chave como "XXX" ou "ADULTOS". A eficácia pode variar dependendo dos dados da playlist.
            </p>
        )}
      </CardContent>
    </Card>
  );
}
