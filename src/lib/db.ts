import { DB_NAME, DB_VERSION, PLAYLIST_METADATA_STORE, PLAYLIST_ITEMS_STORE } from '@/lib/constants';
import type { PlaylistItemCore } from '@/lib/constants';

export interface PlaylistMetadata {
  id: string; // Unique ID for the playlist (e.g., timestamp or UUID)
  name: string;
  sourceType: 'file' | 'url' | 'xtream';
  sourceValue: string; // filename, URL, or Xtream host
  itemCount?: number;
  channelCount?: number;
  movieCount?: number;
  seriesCount?: number;
  createdAt: number; // Timestamp
  // For Xtream
  xtreamUsername?: string;
  xtreamPassword?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        // Should not happen in client-side components that use this
        console.warn("IndexedDB accessed in a non-browser environment.");
        return reject(new Error("IndexedDB not available."));
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(PLAYLIST_METADATA_STORE)) {
          db.createObjectStore(PLAYLIST_METADATA_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(PLAYLIST_ITEMS_STORE)) {
          const itemStore = db.createObjectStore(PLAYLIST_ITEMS_STORE, { autoIncrement: true, keyPath: 'id' });
          itemStore.createIndex('playlistDbId', 'playlistDbId', { unique: false });
          itemStore.createIndex('groupTitle', 'groupTitle', { unique: false });
          itemStore.createIndex('itemType', 'itemType', { unique: false });
          itemStore.createIndex('playlist_group', ['playlistDbId', 'groupTitle'], { unique: false });
          itemStore.createIndex('playlist_type', ['playlistDbId', 'itemType'], { unique: false });
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event) => {
        console.error("IndexedDB error:", (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }
  return dbPromise;
}

export async function addPlaylistWithItems(metadata: PlaylistMetadata, items: PlaylistItemCore[]): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PLAYLIST_METADATA_STORE, PLAYLIST_ITEMS_STORE], 'readwrite');
    const metadataStore = transaction.objectStore(PLAYLIST_METADATA_STORE);
    const itemsStore = transaction.objectStore(PLAYLIST_ITEMS_STORE);

    // Calculate counts by type
    let channelCount = 0;
    let movieCount = 0;
    let seriesCount = 0;

    items.forEach(item => {
      switch (item.itemType) {
        case 'channel':
          channelCount++;
          break;
        case 'movie':
          movieCount++;
          break;
        case 'series':
          seriesCount++;
          break;
      }
    });

    metadata.itemCount = items.length;
    metadata.channelCount = channelCount;
    metadata.movieCount = movieCount;
    metadata.seriesCount = seriesCount;
    
    const metaRequest = metadataStore.put(metadata);

    metaRequest.onerror = () => reject(transaction.error || new Error("Failed to add playlist metadata."));

    for (const item of items) {
      // Ensure item has playlistDbId, critical for linking
      if (!item.playlistDbId) {
        item.playlistDbId = metadata.id;
      }
      const itemRequest = itemsStore.add(item);
      itemRequest.onerror = () => reject(transaction.error || new Error("Failed to add playlist item."));
    }
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Transaction failed for adding playlist with items."));
  });
}

export async function getAllPlaylistsMetadata(): Promise<PlaylistMetadata[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PLAYLIST_METADATA_STORE, 'readonly');
    const store = transaction.objectStore(PLAYLIST_METADATA_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as PlaylistMetadata[]);
    request.onerror = () => reject(request.error);
  });
}

export async function getPlaylistMetadata(id: string): Promise<PlaylistMetadata | undefined> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PLAYLIST_METADATA_STORE, 'readonly');
    const store = transaction.objectStore(PLAYLIST_METADATA_STORE);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result as PlaylistMetadata | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function updatePlaylistMetadata(metadata: PlaylistMetadata): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PLAYLIST_METADATA_STORE, 'readwrite');
    const store = transaction.objectStore(PLAYLIST_METADATA_STORE);
    const request = store.put(metadata);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deletePlaylistAndItems(playlistId: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PLAYLIST_METADATA_STORE, PLAYLIST_ITEMS_STORE], 'readwrite');
    const metadataStore = transaction.objectStore(PLAYLIST_METADATA_STORE);
    const itemsStore = transaction.objectStore(PLAYLIST_ITEMS_STORE);

    // Delete metadata
    const metaDeleteRequest = metadataStore.delete(playlistId);
    metaDeleteRequest.onerror = () => reject(transaction.error || "Failed to delete playlist metadata.");

    // Delete items
    const itemsIndex = itemsStore.index('playlistDbId');
    const itemsCursorRequest = itemsIndex.openCursor(IDBKeyRange.only(playlistId));
    
    itemsCursorRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        itemsStore.delete(cursor.primaryKey);
        cursor.continue();
      }
    };
    itemsCursorRequest.onerror = () => reject(transaction.error || "Failed to iterate or delete playlist items.");

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || "Transaction failed for deleting playlist and items.");
  });
}

export async function getPlaylistItems(
  playlistDbId: string, 
  itemType?: PlaylistItemCore['itemType'],
  limit?: number, 
  offset?: number
): Promise<PlaylistItemCore[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PLAYLIST_ITEMS_STORE, 'readonly');
    const store = transaction.objectStore(PLAYLIST_ITEMS_STORE);
    const indexName = itemType ? 'playlist_type' : 'playlistDbId';
    const index = store.index(indexName);
    const range = itemType ? IDBKeyRange.only([playlistDbId, itemType]) : IDBKeyRange.only(playlistDbId);
    
    const items: PlaylistItemCore[] = [];
    let count = 0;
    let advanced = false;

    const request = index.openCursor(range);

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        if (offset && !advanced && count < offset) {
          cursor.advance(offset);
          advanced = true;
          count = offset; // effectively count becomes offset
          // After advancing, the next onsuccess will get the item at offset
          return; 
        }
        if (limit && items.length >= limit) {
          resolve(items);
          return;
        }
        items.push(cursor.value as PlaylistItemCore);
        cursor.continue();
      } else {
        resolve(items);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getPlaylistItemsByGroup(
  playlistDbId: string,
  groupTitle: string,
  limit?: number,
  offset?: number
): Promise<PlaylistItemCore[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PLAYLIST_ITEMS_STORE, 'readonly');
    const store = transaction.objectStore(PLAYLIST_ITEMS_STORE);
    const index = store.index('playlist_group'); // ['playlistDbId', 'groupTitle']
    const range = IDBKeyRange.only([playlistDbId, groupTitle]);

    const items: PlaylistItemCore[] = [];
    let count = 0;
    let advanced = false;

    const request = index.openCursor(range);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        if (offset && !advanced && count < offset) {
          cursor.advance(offset);
          advanced = true;
          count = offset;
          return;
        }
        if (limit && items.length >= limit) {
          resolve(items);
          return;
        }
        items.push(cursor.value as PlaylistItemCore);
        cursor.continue();
      } else {
        resolve(items);
      }
    };
    request.onerror = () => reject(request.error);
  });
}


export async function clearAllAppData(): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PLAYLIST_METADATA_STORE, PLAYLIST_ITEMS_STORE], 'readwrite');
    const metadataStore = transaction.objectStore(PLAYLIST_METADATA_STORE);
    const itemsStore = transaction.objectStore(PLAYLIST_ITEMS_STORE);

    const metaClearRequest = metadataStore.clear();
    metaClearRequest.onerror = () => reject(transaction.error || "Failed to clear playlist metadata.");

    const itemsClearRequest = itemsStore.clear();
    itemsClearRequest.onerror = () => reject(transaction.error || "Failed to clear playlist items.");
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || "Transaction failed for clearing all app data.");
  });
}


export async function countPlaylistItems(playlistDbId: string, itemType?: PlaylistItemCore['itemType']): Promise<number> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PLAYLIST_ITEMS_STORE, 'readonly');
    const store = transaction.objectStore(PLAYLIST_ITEMS_STORE);
    const indexName = itemType ? 'playlist_type' : 'playlistDbId';
    const index = store.index(indexName);
    const range = itemType ? IDBKeyRange.only([playlistDbId, itemType]) : IDBKeyRange.only(playlistDbId);
    const request = index.count(range);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllGenresForPlaylist(playlistDbId: string, itemType: 'movie' | 'series'): Promise<string[]> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PLAYLIST_ITEMS_STORE, 'readonly');
        const store = transaction.objectStore(PLAYLIST_ITEMS_STORE);
        const index = store.index('playlist_type'); // ['playlistDbId', 'itemType']
        const range = IDBKeyRange.only([playlistDbId, itemType]);
        
        const genres = new Set<string>();
        const request = index.openCursor(range);

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                const item = cursor.value as PlaylistItemCore;
                if (item.groupTitle) {
                    genres.add(item.groupTitle);
                }
                cursor.continue();
            } else {
                resolve(Array.from(genres).sort());
            }
        };
        request.onerror = () => reject(request.error);
    });
}
