"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STARTUP_PAGES, LOCALSTORAGE_STARTUP_PAGE_KEY } from '@/lib/constants';
import { useToast } from "@/hooks/use-toast";
import { Settings2 } from 'lucide-react';


export function StartupPageConfig() {
  const [selectedPage, setSelectedPage] = useState<string>(STARTUP_PAGES[0].value);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const storedPage = localStorage.getItem(LOCALSTORAGE_STARTUP_PAGE_KEY);
    if (storedPage && STARTUP_PAGES.some(p => p.value === storedPage)) {
      setSelectedPage(storedPage);
    }
    setIsMounted(true);
  }, []);

  const handleSaveSettings = () => {
    if (!isMounted) return;
    localStorage.setItem(LOCALSTORAGE_STARTUP_PAGE_KEY, selectedPage);
    toast({
      title: "Configurações Salvas",
      description: `Página inicial padrão definida para "${STARTUP_PAGES.find(p => p.value === selectedPage)?.label}".`,
    });
  };
  
  if (!isMounted) {
     return (
      <Card className="shadow-lg border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings2 className="h-6 w-6 text-primary" /> Configuração da Página Inicial</CardTitle>
          <CardDescription>Carregando preferências...</CardDescription>
        </CardHeader>
        <CardContent className="h-20 animate-pulse bg-muted/50 rounded-md"></CardContent>
      </Card>
    );
  }


  return (
    <Card className="shadow-lg border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-6 w-6 text-primary" /> Configuração da Página Inicial
        </CardTitle>
        <CardDescription>Escolha qual página será carregada por padrão ao abrir o aplicativo. Isso é salvo localmente no seu navegador.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="startup-page-select" className="mb-2 block font-medium">Página Inicial Padrão</Label>
          <Select value={selectedPage} onValueChange={setSelectedPage}>
            <SelectTrigger id="startup-page-select" className="w-full md:w-[280px] text-base py-2.5">
              <SelectValue placeholder="Selecione uma página" />
            </SelectTrigger>
            <SelectContent>
              {STARTUP_PAGES.map((page) => (
                <SelectItem key={page.value} value={page.value} className="text-base py-2.5">
                  {page.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSaveSettings} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            Salvar Preferências
        </Button>
      </CardContent>
    </Card>
  );
}
