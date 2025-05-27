
import { DB_NAME, DB_VERSION, PLAYLIST_METADATA_STORE, PLAYLIST_ITEMS_STORE } from '@/lib/constants';
import type { PlaylistItem, PlaylistMetadata } from '@/lib/constants'; 

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        console.warn("IndexedDB accessed in a non-browser environment.");
        return reject(new Error("IndexedDB not available."));
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION); 

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;
        
        // Playlist Metadata Store
        if (!db.objectStoreNames.contains(PLAYLIST_METADATA_STORE)) {
          db.createObjectStore(PLAYLIST_METADATA_STORE, { keyPath: 'id' });
        }

        // Playlist Items Store
        let itemStore: IDBObjectStore;
        if (!db.objectStoreNames.contains(PLAYLIST_ITEMS_STORE)) {
          itemStore = db.createObjectStore(PLAYLIST_ITEMS_STORE, { autoIncrement: true, keyPath: 'id' });
        } else {
          itemStore = (event.target as IDBOpenDBRequest).transaction!.objectStore(PLAYLIST_ITEMS_STORE);
        }
        
        // Create indices if they don't exist or if upgrading from an older version
        // where they might not have existed.
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
        if (!itemStore.indexNames.contains('year_idx')) { // New index for year
            itemStore.createIndex('year_idx', 'year', { unique: false });
        }
        
        // Compound indices
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
        if (!itemStore.indexNames.contains('playlist_itemType_genre_idx')) { // For querying by type and genre
            itemStore.createIndex('playlist_itemType_genre_idx', ['playlistDbId', 'itemType', 'genre'], { unique: false });
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
    metadata.seriesCount = seriesTitles.size; 
    metadata.status = 'completed'; 
    metadata.lastUpdatedAt = Date.now();
    metadata.lastSuccessfulUpdateAt = Date.now();
    
    const metaRequest = metadataStore.put(metadata);
    metaRequest.onerror = () => reject(transaction.error || new Error("Failed to add playlist metadata."));

    for (const item of items) {
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
    const indexName = itemType ? 'playlist_itemType_idx' : 'playlistDbId_idx';
    const index = store.index(indexName);
    const range = itemType ? IDBKeyRange.only([playlistDbId, itemType]) : IDBKeyRange.only(playlistDbId);
    
    const items: PlaylistItem[] = [];
    let advanced = false; 

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

export async function getPlaylistItemsByGroup(
  playlistDbId: string,
  groupTitle: string, 
  limit?: number,
  offset?: number,
  itemType?: PlaylistItem['itemType'] 
): Promise<PlaylistItem[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PLAYLIST_ITEMS_STORE, 'readonly');
    const store = transaction.objectStore(PLAYLIST_ITEMS_STORE);
    // Index for [playlistDbId, groupTitle] or more specific [playlistDbId, itemType, genre]
    // For now, using playlist_groupTitle_idx and filtering itemType client-side if provided
    // Ideally, a compound index like ['playlistDbId', 'itemType', 'groupTitle'] would be best if this is a common query.
    // Let's use 'playlist_itemType_genre_idx' if itemType and groupTitle (as genre) are provided.
    
    let index: IDBIndex;
    let range: IDBKeyRange;

    if (itemType) {
        index = store.index('playlist_itemType_genre_idx');
        range = IDBKeyRange.only([playlistDbId, itemType, groupTitle]);
    } else {
        // Fallback if itemType is not specified, might be less efficient or require different handling
        index = store.index('playlist_groupTitle_idx');
        range = IDBKeyRange.only([playlistDbId, groupTitle]);
    }

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
        // If itemType was not part of the index query, filter it here
        if (!itemType && item.groupTitle !== groupTitle) { // Ensure groupTitle matches if itemType wasn't in index key
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

export async function getAllUniqueGroupTitlesForPlaylist(playlistDbId: string, itemType: PlaylistItem['itemType']): Promise<string[]> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PLAYLIST_ITEMS_STORE, 'readonly');
        const store = transaction.objectStore(PLAYLIST_ITEMS_STORE);
        const index = store.index('playlist_itemType_idx'); 
        const range = IDBKeyRange.only([playlistDbId, itemType]);
        
        const groupTitles = new Set<string>();
        const request = index.openCursor(range);

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                const item = cursor.value as PlaylistItem;
                if (item.groupTitle) { 
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

export async function getAllGenresForPlaylist(playlistDbId: string, itemType: 'movie' | 'series_episode'): Promise<string[]> {
    return getAllUniqueGroupTitlesForPlaylist(playlistDbId, itemType);
}
