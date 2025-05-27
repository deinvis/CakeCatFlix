
import { DB_NAME, DB_VERSION, PLAYLIST_METADATA_STORE, PLAYLIST_ITEMS_STORE } from '@/lib/constants';
import type { PlaylistItem, PlaylistMetadata } from '@/lib/constants'; // Updated types
import { parseM3U } from './m3u-parser'; // Assuming m3u-parser handles the new detailed parsing

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        console.warn("IndexedDB accessed in a non-browser environment.");
        return reject(new Error("IndexedDB not available."));
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION); // DB_VERSION might need incrementing

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Playlist Metadata Store
        if (!db.objectStoreNames.contains(PLAYLIST_METADATA_STORE)) {
          db.createObjectStore(PLAYLIST_METADATA_STORE, { keyPath: 'id' });
        } else {
          // If store exists, can add new indices or clear and recreate if schema changes drastically
          // For simplicity, if major changes, typically version bump handles this.
          // Minor changes like adding optional fields to PlaylistMetadata don't require store recreation.
        }

        // Playlist Items Store
        if (!db.objectStoreNames.contains(PLAYLIST_ITEMS_STORE)) {
          const itemStore = db.createObjectStore(PLAYLIST_ITEMS_STORE, { autoIncrement: true, keyPath: 'id' });
          // Indices based on new PlaylistItem structure and query needs
          itemStore.createIndex('playlistDbId_idx', 'playlistDbId', { unique: false }); // Foreign key
          itemStore.createIndex('itemType_idx', 'itemType', { unique: false });
          itemStore.createIndex('title_idx', 'title', { unique: false }); // For searching/sorting by original title
          itemStore.createIndex('groupTitle_idx', 'groupTitle', { unique: false }); // For normalized group/genre
          itemStore.createIndex('seriesTitle_idx', 'seriesTitle', { unique: false }); // For series aggregation
          itemStore.createIndex('baseChannelName_idx', 'baseChannelName', { unique: false }); // For channel aggregation
          
          // Compound indices for common queries
          itemStore.createIndex('playlist_itemType_idx', ['playlistDbId', 'itemType'], { unique: false });
          itemStore.createIndex('playlist_groupTitle_idx', ['playlistDbId', 'groupTitle'], { unique: false });
          itemStore.createIndex('playlist_seriesTitle_idx', ['playlistDbId', 'seriesTitle', 'seasonNumber', 'episodeNumber'], { unique: false });
          itemStore.createIndex('playlist_baseChannelName_idx', ['playlistDbId', 'baseChannelName'], { unique: false });

        } else {
           // If store exists, handle potential index additions or modifications
           // This is crucial when DB_VERSION is incremented.
           const transaction = (event.target as IDBOpenDBRequest).transaction;
           if (transaction) {
                const itemStore = transaction.objectStore(PLAYLIST_ITEMS_STORE);
                if (!itemStore.indexNames.contains('playlistDbId_idx')) {
                    itemStore.createIndex('playlistDbId_idx', 'playlistDbId', { unique: false });
                }
                if (!itemStore.indexNames.contains('itemType_idx')) {
                    itemStore.createIndex('itemType_idx', 'itemType', { unique: false });
                }
                if (!itemStore.indexNames.contains('title_idx')) {
                     itemStore.createIndex('title_idx', 'title', { unique: false });
                }
                if (!itemStore.indexNames.contains('groupTitle_idx')) {
                    itemStore.createIndex('groupTitle_idx', 'groupTitle', { unique: false });
                }
                if (!itemStore.indexNames.contains('seriesTitle_idx')) {
                    itemStore.createIndex('seriesTitle_idx', 'seriesTitle', { unique: false });
                }
                if (!itemStore.indexNames.contains('baseChannelName_idx')) {
                    itemStore.createIndex('baseChannelName_idx', 'baseChannelName', { unique: false });
                }
                if (!itemStore.indexNames.contains('playlist_itemType_idx')) {
                    itemStore.createIndex('playlist_itemType_idx', ['playlistDbId', 'itemType'], { unique: false });
                }
                if (!itemStore.indexNames.contains('playlist_groupTitle_idx')) {
                    itemStore.createIndex('playlist_groupTitle_idx', ['playlistDbId', 'groupTitle'], { unique: false });
                }
                if (!itemStore.indexNames.contains('playlist_seriesTitle_idx')) {
                     itemStore.createIndex('playlist_seriesTitle_idx', ['playlistDbId', 'seriesTitle', 'seasonNumber', 'episodeNumber'], { unique: false });
                }
                if (!itemStore.indexNames.contains('playlist_baseChannelName_idx')) {
                     itemStore.createIndex('playlist_baseChannelName_idx', ['playlistDbId', 'baseChannelName'], { unique: false });
                }
           }
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event) => {
        console.error("IndexedDB error:", (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
        dbPromise = null; // Reset promise on error
      };
    });
  }
  return dbPromise;
}

export async function addPlaylistWithItems(metadata: PlaylistMetadata, items: PlaylistItem[]): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PLAYLIST_METADATA_STORE, PLAYLIST_ITEMS_STORE], 'readwrite');
    const metadataStore = transaction.objectStore(PLAYLIST_METADATA_STORE);
    const itemsStore = transaction.objectStore(PLAYLIST_ITEMS_STORE);

    let channelCount = 0;
    let movieCount = 0;
    let seriesEpisodeCount = 0;
    const seriesTitles = new Set<string>();

    items.forEach(item => {
      switch (item.itemType) {
        case 'channel':
          channelCount++;
          break;
        case 'movie':
          movieCount++;
          break;
        case 'series_episode':
          seriesEpisodeCount++;
          if (item.seriesTitle) {
            seriesTitles.add(item.seriesTitle);
          }
          break;
      }
    });

    metadata.itemCount = items.length;
    metadata.channelCount = channelCount;
    metadata.movieCount = movieCount;
    metadata.seriesEpisodeCount = seriesEpisodeCount;
    metadata.seriesCount = seriesTitles.size; // Count of unique series titles
    metadata.status = 'completed'; // Assuming processing happens before this call or is synchronous
    metadata.lastUpdatedAt = Date.now();
    metadata.lastSuccessfulUpdateAt = Date.now();
    
    const metaRequest = metadataStore.put(metadata);
    metaRequest.onerror = () => reject(transaction.error || new Error("Failed to add playlist metadata."));

    for (const item of items) {
      if (!item.playlistDbId) { // Ensure link to playlist
        item.playlistDbId = metadata.id;
      }
      const itemRequest = itemsStore.add(item); // `add` is fine for new items
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
    const updatedMetadata = { ...metadata, lastUpdatedAt: Date.now() };
    const request = store.put(updatedMetadata);
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

    const metaDeleteRequest = metadataStore.delete(playlistId);
    metaDeleteRequest.onerror = () => reject(transaction.error || "Failed to delete playlist metadata.");

    const itemsIndex = itemsStore.index('playlistDbId_idx');
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

// Renamed from PlaylistItemCore to PlaylistItem
export async function getPlaylistItems(
  playlistDbId: string, 
  itemType?: PlaylistItem['itemType'],
  limit?: number, 
  offset?: number
): Promise<PlaylistItem[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PLAYLIST_ITEMS_STORE, 'readonly');
    const store = transaction.objectStore(PLAYLIST_ITEMS_STORE);
    // Use the compound index if itemType is provided
    const indexName = itemType ? 'playlist_itemType_idx' : 'playlistDbId_idx';
    const index = store.index(indexName);
    const range = itemType ? IDBKeyRange.only([playlistDbId, itemType]) : IDBKeyRange.only(playlistDbId);
    
    const items: PlaylistItem[] = [];
    let advanced = false; // To ensure advance is only called once

    const request = index.openCursor(range);
    let currentIndex = 0;

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        if (offset && !advanced && currentIndex < offset) {
          advanced = true;
          cursor.advance(offset);
          currentIndex = offset; 
          return; 
        }
        if (limit && items.length >= limit) {
          resolve(items);
          return;
        }
        items.push(cursor.value as PlaylistItem);
        currentIndex++;
        cursor.continue();
      } else {
        resolve(items);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Renamed from PlaylistItemCore to PlaylistItem
export async function getPlaylistItemsByGroup(
  playlistDbId: string,
  groupTitle: string, // This should be the normalized groupTitle
  limit?: number,
  offset?: number,
  itemType?: PlaylistItem['itemType'] // Optional: to further filter by item type within a group
): Promise<PlaylistItem[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PLAYLIST_ITEMS_STORE, 'readonly');
    const store = transaction.objectStore(PLAYLIST_ITEMS_STORE);
    // Use the compound index for playlist and groupTitle
    const index = store.index('playlist_groupTitle_idx'); 
    const range = IDBKeyRange.only([playlistDbId, groupTitle]);

    const items: PlaylistItem[] = [];
    let advanced = false;
    let currentIndex = 0;

    const request = index.openCursor(range);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        if (offset && !advanced && currentIndex < offset) {
          advanced = true;
          cursor.advance(offset);
          currentIndex = offset;
          return;
        }
        
        const item = cursor.value as PlaylistItem;
        // If itemType is specified, perform an additional client-side filter
        // This is because the index is only on [playlistDbId, groupTitle]
        if (itemType && item.itemType !== itemType) {
          cursor.continue();
          return;
        }

        if (limit && items.length >= limit) {
          resolve(items);
          return;
        }
        items.push(item);
        currentIndex++;
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

// Renamed from PlaylistItemCore to PlaylistItem
export async function countPlaylistItems(playlistDbId: string, itemType?: PlaylistItem['itemType']): Promise<number> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PLAYLIST_ITEMS_STORE, 'readonly');
    const store = transaction.objectStore(PLAYLIST_ITEMS_STORE);
    const indexName = itemType ? 'playlist_itemType_idx' : 'playlistDbId_idx';
    const index = store.index(indexName);
    const range = itemType ? IDBKeyRange.only([playlistDbId, itemType]) : IDBKeyRange.only(playlistDbId);
    const request = index.count(range);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Renamed from PlaylistItemCore to PlaylistItem
export async function getAllUniqueGroupTitlesForPlaylist(playlistDbId: string, itemType: PlaylistItem['itemType']): Promise<string[]> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PLAYLIST_ITEMS_STORE, 'readonly');
        const store = transaction.objectStore(PLAYLIST_ITEMS_STORE);
        // Use the compound index for playlist and itemType
        const index = store.index('playlist_itemType_idx'); 
        const range = IDBKeyRange.only([playlistDbId, itemType]);
        
        const groupTitles = new Set<string>();
        const request = index.openCursor(range);

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                const item = cursor.value as PlaylistItem;
                if (item.groupTitle) { // Use the normalized groupTitle
                    groupTitles.add(item.groupTitle);
                }
                cursor.continue();
            } else {
                resolve(Array.from(groupTitles).sort());
            }
        };
        request.onerror = () => reject(request.error);
    });
}

// Renamed from getAllGenresForPlaylist
// Renamed from PlaylistItemCore to PlaylistItem
export async function getAllGenresForPlaylist(playlistDbId: string, itemType: 'movie' | 'series_episode'): Promise<string[]> {
    return getAllUniqueGroupTitlesForPlaylist(playlistDbId, itemType);
}
