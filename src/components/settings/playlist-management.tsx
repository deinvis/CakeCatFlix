"use client";

import { useState, useEffect, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MOCK_PLAYLISTS as initialMockPlaylists, LOCALSTORAGE_PLAYLISTS_KEY, LOCALSTORAGE_STARTUP_PAGE_KEY, LOCALSTORAGE_THEME_KEY, LOCALSTORAGE_PARENTAL_CONTROL_KEY } from '@/lib/constants';
import { Trash2, Edit, PlusCircle, ListChecks, UploadCloud, Link2, ListVideo } from 'lucide-react';
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

interface Playlist {
  id: string;
  name: string;
  // url?: string; // Future use
  // type?: 'file' | 'url' | 'xtream'; // To differentiate playlist types
}

export function PlaylistManagement() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(null);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  
  // States for Add New Playlist Dialog (common for all types for simplicity now)
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistFile, setNewPlaylistFile] = useState<File | null>(null);
  const [newPlaylistUrl, setNewPlaylistUrl] = useState('');
  const [xtreamHost, setXtreamHost] = useState('');
  const [xtreamUser, setXtreamUser] = useState('');
  const [xtreamPassword, setXtreamPassword] = useState('');

  // State for Edit Playlist Dialog
  const [editPlaylistName, setEditPlaylistName] = useState('');

  const [showClearDataDialog, setShowClearDataDialog] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    const storedPlaylists = localStorage.getItem(LOCALSTORAGE_PLAYLISTS_KEY);
    if (storedPlaylists) {
      setPlaylists(JSON.parse(storedPlaylists));
    } else {
      setPlaylists(initialMockPlaylists); 
    }
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem(LOCALSTORAGE_PLAYLISTS_KEY, JSON.stringify(playlists));
    }
  }, [playlists, isMounted]);

  const resetAddPlaylistForms = () => {
    setNewPlaylistName('');
    setNewPlaylistFile(null);
    setNewPlaylistUrl('');
    setXtreamHost('');
    setXtreamUser('');
    setXtreamPassword('');
  };

  const handleAddNewPlaylist = (type: 'file' | 'url' | 'xtream') => {
    let nameToAdd = newPlaylistName.trim();
    if (!nameToAdd) {
      // Auto-generate name based on type if not provided
      if (type === 'file' && newPlaylistFile) nameToAdd = newPlaylistFile.name;
      else if (type === 'url' && newPlaylistUrl) nameToAdd = `URL Playlist ${new Date().toLocaleTimeString()}`;
      else if (type === 'xtream' && xtreamHost) nameToAdd = `Xtream: ${xtreamHost.split('//')[1]?.split(':')[0] || xtreamHost}`;
      else {
        toast({ title: "Erro", description: "O nome da playlist é obrigatório ou não foi possível gerar.", variant: "destructive" });
        return;
      }
    }
    
    // Basic validation for each type
    if (type === 'file' && !newPlaylistFile) {
      toast({ title: "Erro", description: "Selecione um arquivo M3U/M3U8.", variant: "destructive" });
      return;
    }
    if (type === 'url' && !newPlaylistUrl) {
      toast({ title: "Erro", description: "Insira a URL da playlist.", variant: "destructive" });
      return;
    }
    if (type === 'xtream' && (!xtreamHost || !xtreamUser || !xtreamPassword)) {
       toast({ title: "Erro", description: "Preencha todos os campos do Xtream Codes.", variant: "destructive" });
      return;
    }


    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name: nameToAdd,
    };
    setPlaylists(prev => [...prev, newPlaylist]);
    toast({
      title: "Playlist Adicionada",
      description: `"${newPlaylist.name}" (${type}) foi adicionada. O processamento real do conteúdo não está implementado neste protótipo.`,
    });
    resetAddPlaylistForms();
    // Dialog will be closed by DialogClose if this function is called from within it.
  };


  const openDeleteDialog = (playlist: Playlist) => {
    setPlaylistToDelete(playlist);
  };

  const confirmDeletePlaylist = () => {
    if (playlistToDelete) {
      setPlaylists(prev => prev.filter(p => p.id !== playlistToDelete.id));
      toast({
        title: "Playlist Apagada",
        description: `"${playlistToDelete.name}" foi removida.`,
      });
      setPlaylistToDelete(null);
    }
  };

  const openEditDialog = (playlist: Playlist) => {
    setEditingPlaylist(playlist);
    setEditPlaylistName(playlist.name);
  };

  const handleSaveEditPlaylist = () => {
    if (editingPlaylist && editPlaylistName.trim()) {
      setPlaylists(prev => prev.map(p => p.id === editingPlaylist.id ? { ...p, name: editPlaylistName.trim() } : p));
      toast({
        title: "Playlist Atualizada",
        description: `"${editPlaylistName.trim()}" foi atualizada.`,
      });
      setEditingPlaylist(null); 
    } else {
      toast({ title: "Erro", description: "O nome da playlist não pode estar vazio.", variant: "destructive" });
    }
  };

  const handleClearAllData = () => {
    const appStorageKeys = [
      LOCALSTORAGE_PLAYLISTS_KEY,
      LOCALSTORAGE_STARTUP_PAGE_KEY,
      LOCALSTORAGE_THEME_KEY,
      LOCALSTORAGE_PARENTAL_CONTROL_KEY,
    ];
    appStorageKeys.forEach(key => localStorage.removeItem(key));
    
    setPlaylists([]); // Clear playlists in state
    
    toast({
      title: "Dados da Aplicação Apagados",
      description: "Todas as suas playlists e preferências foram redefinidas. Recarregue a página para aplicar todas as mudanças.",
      duration: 5000,
    });
    setShowClearDataDialog(false);
    // Consider window.location.reload() if needed for full reset, or manage state more granularly.
  };
  

  if (!isMounted) {
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
        <CardDescription>Adicione, edite ou apague suas playlists de conteúdo. As mudanças são salvas localmente.</CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog onOpenChange={(open) => !open && resetAddPlaylistForms()}>
          <DialogTrigger asChild>
            <Button className="mb-6 bg-primary hover:bg-primary/90 text-primary-foreground">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Nova Playlist
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Adicionar Nova Playlist</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="file" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="file"><UploadCloud className="mr-1 h-4 w-4 inline-block"/> Arquivo</TabsTrigger>
                <TabsTrigger value="url"><Link2 className="mr-1 h-4 w-4 inline-block"/> URL</TabsTrigger>
                <TabsTrigger value="xtream"><ListVideo className="mr-1 h-4 w-4 inline-block"/> Xtream</TabsTrigger>
              </TabsList>
              <div className="grid gap-4 py-4">
                <Label htmlFor="new-playlist-name">Nome da Playlist (Opcional)</Label>
                <Input 
                  id="new-playlist-name" 
                  value={newPlaylistName} 
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="Ex: Meus Canais Favoritos" 
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
                  />
                  <p className="text-xs text-muted-foreground">Serão processados os primeiros 2000 itens do arquivo.</p>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                  <DialogClose asChild>
                    <Button type="button" onClick={() => handleAddNewPlaylist('file')} disabled={!newPlaylistFile && !newPlaylistName.trim()}>Adicionar do Arquivo</Button>
                  </DialogClose>
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
                  />
                </div>
                 <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                  <DialogClose asChild>
                    <Button type="button" onClick={() => handleAddNewPlaylist('url')} disabled={!newPlaylistUrl.trim() && !newPlaylistName.trim()}>Adicionar da URL</Button>
                  </DialogClose>
                </DialogFooter>
              </TabsContent>
              <TabsContent value="xtream">
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="xtream-host">Host (com porta)</Label>
                    <Input id="xtream-host" value={xtreamHost} onChange={e => setXtreamHost(e.target.value)} placeholder="http://servidor.xtream:porta" />
                  </div>
                  <div>
                    <Label htmlFor="xtream-user">Usuário</Label>
                    <Input id="xtream-user" value={xtreamUser} onChange={e => setXtreamUser(e.target.value)} placeholder="seu_usuario" />
                  </div>
                  <div>
                    <Label htmlFor="xtream-pass">Senha</Label>
                    <Input id="xtream-pass" type="password" value={xtreamPassword} onChange={e => setXtreamPassword(e.target.value)} placeholder="sua_senha" />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                  <DialogClose asChild>
                    <Button type="button" onClick={() => handleAddNewPlaylist('xtream')} disabled={(!xtreamHost.trim() || !xtreamUser.trim() || !xtreamPassword.trim()) && !newPlaylistName.trim()}>Adicionar Xtream</Button>
                  </DialogClose>
                </DialogFooter>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {playlists.length > 0 ? (
          <ul className="space-y-3">
            {playlists.map((playlist) => (
              <li key={playlist.id} className="flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors duration-150">
                <span className="font-medium text-foreground truncate flex-1 mr-2">{playlist.name}</span>
                <div className="space-x-1 flex-shrink-0">
                  <Dialog onOpenChange={(open) => { if(!open) setEditingPlaylist(null); }}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(playlist)} aria-label={`Editar ${playlist.name}`}>
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
                          />
                        </div>
                        <DialogFooter>
                          <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                          <Button type="button" onClick={handleSaveEditPlaylist} disabled={!editPlaylistName.trim()}>Salvar Mudanças</Button>
                        </DialogFooter>
                      </DialogContent>
                    )}
                  </Dialog>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(playlist)} aria-label={`Apagar ${playlist.name}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    {playlistToDelete && playlistToDelete.id === playlist.id && (
                       <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Isso apagará permanentemente a playlist "{playlistToDelete?.name}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setPlaylistToDelete(null)}>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={confirmDeletePlaylist} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
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
        ) : (
          <p className="text-muted-foreground text-center py-4">Nenhuma playlist adicionada ainda. Clique em "Adicionar Nova Playlist" para começar.</p>
        )}
        
        <Separator className="my-8" />
        
        <div>
          <h3 className="text-lg font-semibold mb-2 text-destructive">Zona de Perigo</h3>
           <AlertDialog open={showClearDataDialog} onOpenChange={setShowClearDataDialog}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full sm:w-auto">
                <Trash2 className="mr-2 h-4 w-4" /> Limpar Todos os Dados do Aplicativo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação é irreversível e apagará TODAS as playlists, itens e preferências do usuário armazenados localmente. 
                  Não será possível recuperar esses dados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearAllData}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                  Sim, apagar tudo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <p className="text-xs text-muted-foreground mt-2">
            Isso removerá todas as playlists e configurações salvas no seu navegador.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
