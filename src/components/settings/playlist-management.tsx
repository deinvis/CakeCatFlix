
"use client";

import { useState, useEffect, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  LOCALSTORAGE_STARTUP_PAGE_KEY, 
  LOCALSTORAGE_THEME_KEY, 
  LOCALSTORAGE_PARENTAL_CONTROL_KEY,
  FILE_PLAYLIST_ITEM_LIMIT
} from '@/lib/constants';
import { Trash2, Edit, PlusCircle, ListChecks, UploadCloud, Link2, ListVideo, Tv2, Film, Clapperboard } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from '@/components/ui/separator';
import { parseM3U } from '@/lib/m3u-parser';
import { fetchXtreamPlaylistItems } from '@/lib/xtream-parser'; 
import { 
  addPlaylistWithItems, 
  getAllPlaylistsMetadata, 
  updatePlaylistMetadata, 
  deletePlaylistAndItems,
  clearAllAppData,
  type PlaylistMetadata,
  type PlaylistItemCore
} from '@/lib/db';

export function PlaylistManagement() {
  const [playlists, setPlaylists] = useState<PlaylistMetadata[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState<PlaylistMetadata | null>(null);
  const [editingPlaylist, setEditingPlaylist] = useState<PlaylistMetadata | null>(null);
  
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistFile, setNewPlaylistFile] = useState<File | null>(null);
  const [newPlaylistUrl, setNewPlaylistUrl] = useState('');
  const [xtreamHost, setXtreamHost] = useState('');
  const [xtreamUser, setXtreamUser] = useState('');
  const [xtreamPassword, setXtreamPassword] = useState('');

  const [editPlaylistName, setEditPlaylistName] = useState('');
  const [showClearDataDialog, setShowClearDataDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processando sua solicitação...');


  const { toast } = useToast();

  const fetchPlaylists = async () => {
    try {
      setIsLoading(true);
      setLoadingMessage('Carregando playlists...');
      const storedPlaylists = await getAllPlaylistsMetadata();
      setPlaylists(storedPlaylists.sort((a, b) => a.createdAt - b.createdAt));
    } catch (error) {
      console.error("Failed to fetch playlists:", error);
      toast({ title: "Erro", description: "Não foi possível carregar as playlists do banco de dados.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchPlaylists();
  }, []);


  const resetAddPlaylistForms = () => {
    setNewPlaylistName('');
    setNewPlaylistFile(null);
    const fileInput = document.getElementById('playlist-file') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
    
    setNewPlaylistUrl('');
    setXtreamHost('');
    setXtreamUser('');
    setXtreamPassword('');
  };

  const handleAddNewPlaylist = async (type: 'file' | 'url' | 'xtream') => {
    setIsLoading(true);
    let nameToAdd = newPlaylistName.trim();
    let playlistId = Date.now().toString(); // Unique ID for the playlist
    let sourceValue = '';
    let itemsToAdd: PlaylistItemCore[] = [];
    
    const metadataBase: Omit<PlaylistMetadata, 'sourceValue' | 'itemCount' | 'channelCount' | 'movieCount' | 'seriesCount'> = {
      id: playlistId,
      name: '', // Will be set below
      sourceType: type,
      createdAt: Date.now(),
    };

    try {
      if (type === 'file') {
        setLoadingMessage('Processando arquivo M3U...');
        if (!newPlaylistFile) {
          toast({ title: "Erro", description: "Selecione um arquivo M3U/M3U8.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        nameToAdd = nameToAdd || newPlaylistFile.name;
        sourceValue = newPlaylistFile.name; // Store filename as sourceValue
        metadataBase.name = nameToAdd;
        
        const fileContent = await newPlaylistFile.text();
        itemsToAdd = parseM3U(fileContent, playlistId, FILE_PLAYLIST_ITEM_LIMIT);
        
        await addPlaylistWithItems({ ...metadataBase, sourceValue }, itemsToAdd);
        toast({
          title: "Playlist Adicionada",
          description: `"${nameToAdd}" (${type}) foi adicionada com ${itemsToAdd.length} itens.`,
        });

      } else if (type === 'url') {
        setLoadingMessage('Buscando e processando URL M3U...');
        if (!newPlaylistUrl.trim()) {
          toast({ title: "Erro", description: "Insira a URL da playlist.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        sourceValue = newPlaylistUrl.trim();
        nameToAdd = nameToAdd || `URL: ${sourceValue.substring(0,30)}${sourceValue.length > 30 ? '...' : ''}`;
        metadataBase.name = nameToAdd;
        
        const response = await fetch(sourceValue);
        if (!response.ok) {
          throw new Error(`Falha ao buscar URL: ${response.status} ${response.statusText}. Verifique a URL e as permissões CORS.`);
        }
        const urlContent = await response.text();
        itemsToAdd = parseM3U(urlContent, playlistId, FILE_PLAYLIST_ITEM_LIMIT);
        
        await addPlaylistWithItems({ ...metadataBase, sourceValue }, itemsToAdd);
        toast({
          title: "Playlist Adicionada (URL)",
          description: `"${nameToAdd}" foi adicionada com ${itemsToAdd.length} itens.`,
        });

      } else if (type === 'xtream') {
        setLoadingMessage('Conectando e buscando itens do Xtream Codes...');
        if (!xtreamHost || !xtreamUser || !xtreamPassword) {
           toast({ title: "Erro", description: "Preencha todos os campos do Xtream Codes.", variant: "destructive" });
           setIsLoading(false);
          return;
        }
        const hostDomain = xtreamHost.split('//')[1]?.split(':')[0] || xtreamHost.split(':')[0] || 'Xtream Source';
        nameToAdd = nameToAdd || `Xtream: ${hostDomain}`;
        sourceValue = xtreamHost; // Store host as sourceValue
        metadataBase.name = nameToAdd;
        metadataBase.xtreamUsername = xtreamUser;
        metadataBase.xtreamPassword = xtreamPassword; 
        
        itemsToAdd = await fetchXtreamPlaylistItems(playlistId, xtreamHost, xtreamUser, xtreamPassword);
        
        await addPlaylistWithItems({ 
          ...metadataBase, 
          sourceValue, 
          xtreamUsername: xtreamUser, 
          xtreamPassword: xtreamPassword 
        }, itemsToAdd);

        toast({
          title: "Playlist Xtream Adicionada",
          description: `"${nameToAdd}" foi adicionada com ${itemsToAdd.length} itens.`,
        });
      }

      await fetchPlaylists(); // Refresh list
      resetAddPlaylistForms();
      // Consider closing dialog only on success. This requires not using DialogClose asChild unconditionally.
      // For now, we assume it closes. If an error occurs, the toast shows, dialog might still close.
      // To prevent closing on error, DialogClose would need to be triggered manually.
      const closeButton = document.querySelector('[data-radix-dialog-close="true"]') as HTMLElement | null;
      if (closeButton) { // Ensure a more specific selector for the close button if needed
          closeButton.click();
      }


    } catch (error: any) {
        console.error(`Error adding ${type} playlist:`, error);
        toast({ 
            title: `Erro ao Adicionar Playlist ${type.toUpperCase()}`, 
            description: error.message || "Ocorreu um erro desconhecido.", 
            variant: "destructive",
            duration: 7000 
        });
    } finally {
        setIsLoading(false);
    }
  };


  const openDeleteDialog = (playlist: PlaylistMetadata) => {
    setPlaylistToDelete(playlist);
  };

  const confirmDeletePlaylist = async () => {
    if (playlistToDelete) {
      setIsLoading(true);
      setLoadingMessage('Apagando playlist...');
      try {
        await deletePlaylistAndItems(playlistToDelete.id);
        toast({
          title: "Playlist Apagada",
          description: `"${playlistToDelete.name}" foi removida.`,
        });
        setPlaylistToDelete(null);
        await fetchPlaylists(); 
      } catch (error: any) {
        console.error("Error deleting playlist:", error);
        toast({ title: "Erro ao Apagar", description: error.message, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const openEditDialog = (playlist: PlaylistMetadata) => {
    setEditingPlaylist(playlist);
    setEditPlaylistName(playlist.name);
  };

  const handleSaveEditPlaylist = async () => {
    if (editingPlaylist && editPlaylistName.trim()) {
      setIsLoading(true);
      setLoadingMessage('Atualizando playlist...');
      try {
        const updatedPlaylistData = { 
            ...editingPlaylist, 
            name: editPlaylistName.trim(),
        };
        await updatePlaylistMetadata(updatedPlaylistData); 
        toast({
          title: "Playlist Atualizada",
          description: `"${updatedPlaylistData.name}" foi atualizada.`,
        });
        setEditingPlaylist(null); 
        await fetchPlaylists(); 
      } catch (error: any) {
        console.error("Error updating playlist:", error);
        toast({ title: "Erro ao Atualizar", description: error.message, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    } else {
      toast({ title: "Erro", description: "O nome da playlist não pode estar vazio.", variant: "destructive" });
    }
  };

  const handleClearAllData = async () => {
    setIsLoading(true);
    setLoadingMessage('Limpando todos os dados...');
    try {
      await clearAllAppData();
      const appStorageKeys = [
        LOCALSTORAGE_STARTUP_PAGE_KEY,
        LOCALSTORAGE_THEME_KEY,
        LOCALSTORAGE_PARENTAL_CONTROL_KEY,
      ];
      appStorageKeys.forEach(key => localStorage.removeItem(key));
      
      setPlaylists([]);
      
      toast({
        title: "Dados da Aplicação Apagados",
        description: "Todas as suas playlists e preferências foram redefinidas. Recarregue a página para aplicar todas as mudanças.",
        duration: 5000,
      });
      setShowClearDataDialog(false);
    } catch (error: any) {
      console.error("Error clearing all data:", error);
      toast({ title: "Erro ao Limpar Dados", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!isMounted || (isLoading && !playlists.length && loadingMessage === 'Carregando playlists...')) {
    return (
      <Card className="shadow-lg border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ListChecks className="h-6 w-6 text-primary" /> Gerenciamento de Playlists</CardTitle>
          <CardDescription>Carregando playlists...</CardDescription>
        </CardHeader>
        <CardContent className="h-40 animate-pulse bg-muted/50 rounded-md"></CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-primary" /> Gerenciamento de Playlists
        </CardTitle>
        <CardDescription>Adicione, edite ou apague suas playlists. Playlists e seus itens são salvos no banco de dados local do navegador.</CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog onOpenChange={(open) => { if(!open && !isLoading) resetAddPlaylistForms(); }}>
          <DialogTrigger asChild>
            <Button className="mb-6 bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Nova Playlist
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Adicionar Nova Playlist</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="file" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="file" disabled={isLoading}><UploadCloud className="mr-1 h-4 w-4 inline-block"/> Arquivo</TabsTrigger>
                <TabsTrigger value="url" disabled={isLoading}><Link2 className="mr-1 h-4 w-4 inline-block"/> URL</TabsTrigger>
                <TabsTrigger value="xtream" disabled={isLoading}><ListVideo className="mr-1 h-4 w-4 inline-block"/> Xtream</TabsTrigger>
              </TabsList>
              <div className="grid gap-4 py-4">
                <Label htmlFor="new-playlist-name">Nome da Playlist (Opcional)</Label>
                <Input 
                  id="new-playlist-name" 
                  value={newPlaylistName} 
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="Ex: Meus Canais Favoritos" 
                  disabled={isLoading}
                />
              </div>
              <TabsContent value="file">
                <div className="grid gap-4 py-4">
                  <Label htmlFor="playlist-file">Arquivo M3U/M3U8</Label>
                  <Input 
                    id="playlist-file" 
                    type="file" 
                    accept=".m3u,.m3u8"
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNewPlaylistFile(e.target.files ? e.target.files[0] : null)} 
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">Serão processados os primeiros {FILE_PLAYLIST_ITEM_LIMIT} itens do arquivo.</p>
                </div>
                <DialogFooter>
                  <DialogClose asChild data-radix-dialog-close="true"><Button type="button" variant="outline" disabled={isLoading}>Cancelar</Button></DialogClose>
                  <Button type="button" onClick={() => handleAddNewPlaylist('file')} disabled={isLoading || !newPlaylistFile}>Adicionar do Arquivo</Button>
                </DialogFooter>
              </TabsContent>
              <TabsContent value="url">
                <div className="grid gap-4 py-4">
                  <Label htmlFor="playlist-url">URL da Playlist M3U</Label>
                  <Input 
                    id="playlist-url" 
                    type="url"
                    value={newPlaylistUrl}
                    onChange={(e) => setNewPlaylistUrl(e.target.value)}
                    placeholder="https://exemplo.com/playlist.m3u" 
                    disabled={isLoading}
                  />
                   <p className="text-xs text-muted-foreground">Serão processados os primeiros {FILE_PLAYLIST_ITEM_LIMIT} itens da URL. A URL deve permitir acesso direto (CORS habilitado).</p>
                </div>
                 <DialogFooter>
                  <DialogClose asChild data-radix-dialog-close="true"><Button type="button" variant="outline" disabled={isLoading}>Cancelar</Button></DialogClose>
                  <Button type="button" onClick={() => handleAddNewPlaylist('url')} disabled={isLoading || !newPlaylistUrl.trim()}>Adicionar da URL</Button>
                </DialogFooter>
              </TabsContent>
              <TabsContent value="xtream">
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="xtream-host">Host (Ex: http://servidor.com:porta)</Label>
                    <Input id="xtream-host" value={xtreamHost} onChange={e => setXtreamHost(e.target.value)} placeholder="http://servidor.xtream:porta" disabled={isLoading} />
                  </div>
                  <div>
                    <Label htmlFor="xtream-user">Usuário</Label>
                    <Input id="xtream-user" value={xtreamUser} onChange={e => setXtreamUser(e.target.value)} placeholder="seu_usuario" disabled={isLoading} />
                  </div>
                  <div>
                    <Label htmlFor="xtream-pass">Senha</Label>
                    <Input id="xtream-pass" type="password" value={xtreamPassword} onChange={e => setXtreamPassword(e.target.value)} placeholder="sua_senha" disabled={isLoading} />
                  </div>
                   <p className="text-xs text-muted-foreground">Busca canais, filmes e séries. Limite de {FILE_PLAYLIST_ITEM_LIMIT} itens no total.</p>
                </div>
                <DialogFooter>
                  <DialogClose asChild data-radix-dialog-close="true"><Button type="button" variant="outline" disabled={isLoading}>Cancelar</Button></DialogClose>
                  <Button type="button" onClick={() => handleAddNewPlaylist('xtream')} disabled={isLoading || !xtreamHost.trim() || !xtreamUser.trim() || !xtreamPassword.trim()}>Adicionar Xtream</Button>
                </DialogFooter>
              </TabsContent>
            </Tabs>
            {/* Note: DialogClose is now part of each tab's footer. 
                If an error occurs during handleAddNewPlaylist, the dialog might close.
                For more robust error handling where dialog stays open, would need to manage open state manually.
            */}
          </DialogContent>
        </Dialog>

        {isLoading && !loadingMessage.startsWith('Carregando playlists...') && (
          <div className="flex items-center justify-center text-primary my-4 py-2">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-sm">{loadingMessage}</p>
          </div>
        )}

        {!isLoading && (
          <>
            {playlists.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nenhuma playlist adicionada ainda. Clique em "Adicionar Nova Playlist" para começar.</p>
            ) : (
              <ul className="space-y-3">
                {playlists.map((playlist) => (
                  <li key={playlist.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors duration-150">
                    <div className="flex-1 mb-2 sm:mb-0 mr-2">
                      <span className="font-medium text-foreground truncate block" title={playlist.name}>
                        {playlist.name}
                        <span className="text-xs text-muted-foreground ml-2">({playlist.sourceType}{playlist.sourceType === 'xtream' && playlist.xtreamUsername ? ` - ${playlist.xtreamUsername}` : ''})</span>
                      </span>
                      <div className="text-xs text-muted-foreground flex items-center flex-wrap gap-x-2 gap-y-1 mt-1">
                        <span>Total: {playlist.itemCount ?? 0}</span>
                        <Separator orientation="vertical" className="h-3 bg-border hidden sm:inline-block"/>
                        <span className="flex items-center"><Tv2 className="h-3 w-3 mr-1 text-sky-500"/> {playlist.channelCount ?? 0}</span>
                        <Separator orientation="vertical" className="h-3 bg-border hidden sm:inline-block"/>
                        <span className="flex items-center"><Film className="h-3 w-3 mr-1 text-orange-500"/> {playlist.movieCount ?? 0}</span>
                        <Separator orientation="vertical" className="h-3 bg-border hidden sm:inline-block"/>
                        <span className="flex items-center"><Clapperboard className="h-3 w-3 mr-1 text-teal-500"/> {playlist.seriesCount ?? 0}</span>
                      </div>
                    </div>
                    <div className="space-x-1 flex-shrink-0">
                      <Dialog onOpenChange={(open) => { if(!open && !isLoading) setEditingPlaylist(null); }}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(playlist)} aria-label={`Editar ${playlist.name}`} disabled={isLoading}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        {editingPlaylist && editingPlaylist.id === playlist.id && (
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Editar Playlist: {editingPlaylist.name}</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <Label htmlFor="edit-playlist-name">Novo Nome da Playlist</Label>
                              <Input 
                                id="edit-playlist-name" 
                                value={editPlaylistName} 
                                onChange={(e) => setEditPlaylistName(e.target.value)} 
                                placeholder="Insira o novo nome"
                                disabled={isLoading}
                              />
                            </div>
                            <DialogFooter>
                              <DialogClose asChild data-radix-dialog-close="true"><Button type="button" variant="outline" disabled={isLoading}>Cancelar</Button></DialogClose>
                              <Button type="button" onClick={handleSaveEditPlaylist} disabled={isLoading || !editPlaylistName.trim()}>Salvar Mudanças</Button>
                            </DialogFooter>
                          </DialogContent>
                        )}
                      </Dialog>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(playlist)} aria-label={`Apagar ${playlist.name}`} disabled={isLoading}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        {playlistToDelete && playlistToDelete.id === playlist.id && (
                           <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. Isso apagará permanentemente a playlist "{playlistToDelete?.name}" e todos os seus {playlistToDelete?.itemCount ?? 0} itens.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setPlaylistToDelete(null)} disabled={isLoading}>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={confirmDeletePlaylist} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" disabled={isLoading}>
                                Apagar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        )}
                      </AlertDialog>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        
        <Separator className="my-8" />
        
        <div>
          <h3 className="text-lg font-semibold mb-2 text-destructive">Zona de Perigo</h3>
           <AlertDialog open={showClearDataDialog} onOpenChange={setShowClearDataDialog}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full sm:w-auto" disabled={isLoading}>
                <Trash2 className="mr-2 h-4 w-4" /> Limpar Todos os Dados do Aplicativo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação é irreversível e apagará TODAS as playlists, itens e preferências do usuário armazenados localmente no navegador (incluindo dados do IndexedDB e localStorage). 
                  Não será possível recuperar esses dados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearAllData}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  disabled={isLoading}
                >
                  Sim, apagar tudo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <p className="text-xs text-muted-foreground mt-2">
            Isso removerá todas as playlists, seus itens e configurações salvas no seu navegador.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

    