"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MOCK_PLAYLISTS as initialMockPlaylists } from '@/lib/constants';
import { Trash2, Edit, PlusCircle, ListChecks } from 'lucide-react';
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

interface Playlist {
  id: string;
  name: string;
  // url?: string; // Future use
}

export function PlaylistManagement() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(null);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [editPlaylistName, setEditPlaylistName] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    // Load playlists from localStorage or use mocks on client-side
    const storedPlaylists = localStorage.getItem('catcakestream_playlists');
    if (storedPlaylists) {
      setPlaylists(JSON.parse(storedPlaylists));
    } else {
      setPlaylists(initialMockPlaylists); // Initialize with mocks if nothing in localStorage
    }
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('catcakestream_playlists', JSON.stringify(playlists));
    }
  }, [playlists, isMounted]);

  const openDeleteDialog = (playlist: Playlist) => {
    setPlaylistToDelete(playlist);
  };

  const confirmDeletePlaylist = () => {
    if (playlistToDelete) {
      setPlaylists(prev => prev.filter(p => p.id !== playlistToDelete.id));
      toast({
        title: "Playlist Deleted",
        description: `"${playlistToDelete.name}" has been removed.`,
      });
      setPlaylistToDelete(null); // Close dialog
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
        title: "Playlist Updated",
        description: `"${editPlaylistName.trim()}" has been updated.`,
      });
      setEditingPlaylist(null); // Close dialog
    } else {
      toast({ title: "Error", description: "Playlist name cannot be empty.", variant: "destructive" });
    }
  };
  
  const handleAddNewPlaylist = () => {
    if (newPlaylistName.trim()) {
      const newPlaylist: Playlist = {
        id: Date.now().toString(), // Simple unique ID
        name: newPlaylistName.trim(),
      };
      setPlaylists(prev => [...prev, newPlaylist]);
      toast({
        title: "Playlist Added",
        description: `"${newPlaylist.name}" has been added.`,
      });
      setNewPlaylistName(''); // Clear input and close dialog (implicitly via DialogClose)
      // Find the button that opens this dialog and click it to close, if Dialog primitive supports it
      // For now, user clicks close or hits Esc.
    } else {
       toast({ title: "Error", description: "Playlist name cannot be empty.", variant: "destructive" });
    }
  };

  if (!isMounted) {
    // Render a loading state or null until client-side hydration is complete
    return (
      <Card className="shadow-lg border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ListChecks className="h-6 w-6 text-primary" /> Playlist Management</CardTitle>
          <CardDescription>Loading playlists...</CardDescription>
        </CardHeader>
        <CardContent className="h-20 animate-pulse bg-muted/50 rounded-md"></CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-primary" /> Playlist Management
        </CardTitle>
        <CardDescription>Add, edit, or delete your content playlists. Changes are saved locally.</CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="mb-6 bg-primary hover:bg-primary/90 text-primary-foreground">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Playlist
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Playlist</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Label htmlFor="new-playlist-name">Playlist Name</Label>
              <Input 
                id="new-playlist-name" 
                value={newPlaylistName} 
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="e.g., My Favorite Channels" 
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <DialogClose asChild>
                 {/* DialogClose needed here to close on successful add */}
                <Button type="button" onClick={handleAddNewPlaylist} disabled={!newPlaylistName.trim()}>Add Playlist</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {playlists.length > 0 ? (
          <ul className="space-y-3">
            {playlists.map((playlist) => (
              <li key={playlist.id} className="flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors duration-150">
                <span className="font-medium text-foreground truncate flex-1 mr-2">{playlist.name}</span>
                <div className="space-x-1 flex-shrink-0">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(playlist)} aria-label={`Edit ${playlist.name}`}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    {editingPlaylist && editingPlaylist.id === playlist.id && (
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Playlist: {editingPlaylist.name}</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <Label htmlFor="edit-playlist-name">New Playlist Name</Label>
                          <Input 
                            id="edit-playlist-name" 
                            value={editPlaylistName} 
                            onChange={(e) => setEditPlaylistName(e.target.value)} 
                            placeholder="Enter new name"
                          />
                        </div>
                        <DialogFooter>
                          <DialogClose asChild><Button type="button" variant="outline" onClick={() => setEditingPlaylist(null)}>Cancel</Button></DialogClose>
                          <Button type="button" onClick={handleSaveEditPlaylist} disabled={!editPlaylistName.trim()}>Save Changes</Button>
                        </DialogFooter>
                      </DialogContent>
                    )}
                  </Dialog>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(playlist)} aria-label={`Delete ${playlist.name}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    {playlistToDelete && playlistToDelete.id === playlist.id && (
                       <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the playlist "{playlistToDelete?.name}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setPlaylistToDelete(null)}>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={confirmDeletePlaylist} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                            Delete
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
          <p className="text-muted-foreground text-center py-4">No playlists added yet. Click "Add New Playlist" to start.</p>
        )}
      </CardContent>
    </Card>
  );
}
