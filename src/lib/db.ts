
import { 
  DB_NAME, 
  DB_VERSION, 
  PLAYLIST_METADATA_STORE,
  CHANNELS_STORE,
  MOVIES_STORE,
  SERIES_STORE,
  EPISODES_STORE,
  LEGACY_PLAYLIST_ITEMS_STORE
} from '@/lib/constants';
import type { 
  PlaylistItem, // Generic item from parser
  PlaylistMetadata,
  ChannelItem,
  MovieItem,
  SeriesItem,
  EpisodeItem
} from '@/lib/constants'; 

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
        
        // Playlist Metadata Store (remains the same)
        if (!db.objectStoreNames.contains(PLAYLIST_METADATA_STORE)) {
          db.createObjectStore(PLAYLIST_METADATA_STORE, { keyPath: 'id' });
        }

        // Remove old playlistItems store if it exists
        if (oldVersion < 4 && db.objectStoreNames.contains(LEGACY_PLAYLIST_ITEMS_STORE)) {
          db.deleteObjectStore(LEGACY_PLAYLIST_ITEMS_STORE);
        }
        
        // Create new normalized stores
        if (!db.objectStoreNames.contains(CHANNELS_STORE)) {
          const channelStore = db.createObjectStore(CHANNELS_STORE, { autoIncrement: true, keyPath: 'id' });
          channelStore.createIndex('playlistDbId_idx', 'playlistDbId', { unique: false });
          channelStore.createIndex('baseChannelName_idx', 'baseChannelName', { unique: false });
          channelStore.createIndex('playlist_baseChannelName_idx', ['playlistDbId', 'baseChannelName'], { unique: false });
          channelStore.createIndex('groupTitle_idx', 'groupTitle', { unique: false });
        }

        if (!db.objectStoreNames.contains(MOVIES_STORE)) {
          const movieStore = db.createObjectStore(MOVIES_STORE, { autoIncrement: true, keyPath: 'id' });
          movieStore.createIndex('playlistDbId_idx', 'playlistDbId', { unique: false });
          movieStore.createIndex('genre_idx', 'genre', { unique: false });
          if (oldVersion < 3) { // only create if it doesn't exist from a previous schema
            movieStore.createIndex('year_idx', 'year', { unique: false });
          }
          movieStore.createIndex('playlist_genre_idx', ['playlistDbId', 'genre'], { unique: false });
          movieStore.createIndex('title_idx', 'title', {unique: false});
        } else if (oldVersion < 3) { // Store exists, but we need to add year_idx
            const transaction = (event.target as IDBOpenDBRequest).transaction;
            if (transaction) {
                const movieStore = transaction.objectStore(MOVIES_STORE);
                if (!movieStore.indexNames.contains('year_idx')) {
                    movieStore.createIndex('year_idx', 'year', { unique: false });
                }
            }
        }


        if (!db.objectStoreNames.contains(SERIES_STORE)) {
          const seriesStore = db.createObjectStore(SERIES_STORE, { autoIncrement: true, keyPath: 'id' });
          seriesStore.createIndex('playlistDbId_idx', 'playlistDbId', { unique: false });
          seriesStore.createIndex('title_idx', 'title', { unique: false }); // For finding series by title within a playlist
          seriesStore.createIndex('genre_idx', 'genre', { unique: false });
          seriesStore.createIndex('playlist_title_idx', ['playlistDbId', 'title'], { unique: true }); // Ensure unique series per playlist
          seriesStore.createIndex('playlist_genre_idx', ['playlistDbId', 'genre'], { unique: false });
        }

        if (!db.objectStoreNames.contains(EPISODES_STORE)) {
          const episodeStore = db.createObjectStore(EPISODES_STORE, { autoIncrement: true, keyPath: 'id' });
          episodeStore.createIndex('playlistDbId_idx', 'playlistDbId', { unique: false });
          episodeStore.createIndex('seriesDbId_idx', 'seriesDbId', { unique: false }); // To fetch all episodes for a series
          episodeStore.createIndex('playlist_series_season_episode_idx', ['playlistDbId', 'seriesDbId', 'seasonNumber', 'episodeNumber'], { unique: false });
          episodeStore.createIndex('title_idx', 'title', {unique: false});
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event) => {
        console.error("IndexedDB error:", (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
        dbPromise = null; 
      };
    });
  }
  return dbPromise;
}

export async function addPlaylistWithItems(metadata: PlaylistMetadata, items: PlaylistItem[]): Promise<void> {
  const db = await getDb();
  return new Promise(async (resolve, reject) => {
    const transaction = db.transaction([
        PLAYLIST_METADATA_STORE, 
        CHANNELS_STORE, 
        MOVIES_STORE, 
        SERIES_STORE, 
        EPISODES_STORE
    ], 'readwrite');
    
    const metadataStore = transaction.objectStore(PLAYLIST_METADATA_STORE);
    const channelStore = transaction.objectStore(CHANNELS_STORE);
    const movieStore = transaction.objectStore(MOVIES_STORE);
    const seriesStore = transaction.objectStore(SERIES_STORE);
    const episodeStore = transaction.objectStore(EPISODES_STORE);

    let channelCount = 0;
    let movieCount = 0;
    let episodeCount = 0;
    const uniqueSeriesInPlaylist = new Map<string, { id: number | undefined, item: SeriesItem }>(); // Key: seriesTitle, Value: {id: seriesDbId, item: SeriesItem}

    // First pass: Add all unique SeriesItems and collect their generated IDs
    const seriesToAddPromises: Promise<void>[] = [];
    for (const item of items) {
        if (item.itemType === 'series_episode' && item.seriesTitle) {
            if (!uniqueSeriesInPlaylist.has(item.seriesTitle)) {
                const seriesEntry: SeriesItem = {
                    playlistDbId: metadata.id,
                    title: item.seriesTitle,
                    logoUrl: item.logoUrl, 
                    groupTitle: item.groupTitle,
                    originalGroupTitle: item.originalGroupTitle,
                    tvgId: item.tvgId, // Episode's tvgId for now, might be overwritten by series specific one
                    genre: item.genre,
                    year: item.year,
                };
                uniqueSeriesInPlaylist.set(item.seriesTitle, { id: undefined, item: seriesEntry });
            } else {
                // Potentially update series logo if this episode has a better one (e.g. S01E01)
                const existingSeries = uniqueSeriesInPlaylist.get(item.seriesTitle)!;
                if (item.logoUrl && (!existingSeries.item.logoUrl || (item.seasonNumber === 1 && item.episodeNumber === 1))) {
                    existingSeries.item.logoUrl = item.logoUrl;
                }
            }
        }
    }

    uniqueSeriesInPlaylist.forEach(seriesData => {
        seriesToAddPromises.push(
            new Promise<void>((resolveAdd, rejectAdd) => {
                const addSeriesRequest = seriesStore.add(seriesData.item);
                addSeriesRequest.onsuccess = (event) => {
                    seriesData.id = (event.target as IDBRequest).result as number;
                    resolveAdd();
                };
                addSeriesRequest.onerror = () => rejectAdd(addSeriesRequest.error);
            })
        );
    });

    try {
        await Promise.all(seriesToAddPromises);
    } catch (error) {
        console.error("Error adding series items:", error);
        transaction.abort(); // Abort transaction if adding series fails
        reject(error);
        return;
    }
    
    // Second pass: Add channels, movies, and episodes (now with seriesDbId)
    for (const item of items) {
      item.playlistDbId = metadata.id; 

      if (item.itemType === 'channel') {
        const channel: ChannelItem = {
          playlistDbId: item.playlistDbId,
          title: item.title,
          streamUrl: item.streamUrl,
          logoUrl: item.logoUrl,
          groupTitle: item.groupTitle,
          originalGroupTitle: item.originalGroupTitle,
          tvgId: item.tvgId,
          tvgName: item.tvgName,
          baseChannelName: item.baseChannelName,
          quality: item.quality,
        };
        channelStore.add(channel);
        channelCount++;
      } else if (item.itemType === 'movie') {
        const movie: MovieItem = {
          playlistDbId: item.playlistDbId,
          title: item.title,
          streamUrl: item.streamUrl,
          logoUrl: item.logoUrl,
          groupTitle: item.groupTitle,
          originalGroupTitle: item.originalGroupTitle,
          tvgId: item.tvgId,
          tvgName: item.tvgName,
          genre: item.genre,
          year: item.year,
        };
        movieStore.add(movie);
        movieCount++;
      } else if (item.itemType === 'series_episode') {
        if (!item.seriesTitle) {
          console.warn("Series episode found without a seriesTitle, skipping:", item);
          continue;
        }
        
        const seriesData = uniqueSeriesInPlaylist.get(item.seriesTitle);
        if (!seriesData || seriesData.id === undefined) {
            console.error(`Could not find or get ID for series: ${item.seriesTitle}. Skipping episode.`);
            continue;
        }

        const episode: EpisodeItem = {
          playlistDbId: item.playlistDbId,
          seriesDbId: seriesData.id, 
          title: item.title, 
          streamUrl: item.streamUrl,
          logoUrl: item.logoUrl,
          seasonNumber: item.seasonNumber,
          episodeNumber: item.episodeNumber,
          tvgId: item.tvgId,
        };
        episodeStore.add(episode);
        episodeCount++;
      }
    }
    
    metadata.itemCount = items.length; 
    metadata.channelCount = channelCount;
    metadata.movieCount = movieCount;
    metadata.seriesCount = uniqueSeriesInPlaylist.size; 
    metadata.episodeCount = episodeCount;
    metadata.status = 'completed'; 
    metadata.lastUpdatedAt = Date.now();
    metadata.lastSuccessfulUpdateAt = Date.now();
    
    const metaRequest = metadataStore.put(metadata);
    metaRequest.onerror = () => {
        console.error("Error updating playlist metadata:", metaRequest.error);
        transaction.abort(); // Ensure transaction is aborted if metadata update fails
        reject(metaRequest.error || new Error("Failed to update playlist metadata."));
    }
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
        console.error("Transaction error in addPlaylistWithItems:", transaction.error);
        reject(transaction.error || new Error("Transaction failed for adding playlist with items."));
    }
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
    const transaction = db.transaction([
        PLAYLIST_METADATA_STORE, 
        CHANNELS_STORE, 
        MOVIES_STORE, 
        SERIES_STORE, 
        EPISODES_STORE
    ], 'readwrite');
    
    const metadataStore = transaction.objectStore(PLAYLIST_METADATA_STORE);
    const channelStore = transaction.objectStore(CHANNELS_STORE);
    const movieStore = transaction.objectStore(MOVIES_STORE);
    const seriesStore = transaction.objectStore(SERIES_STORE);
    const episodeStore = transaction.objectStore(EPISODES_STORE);

    metadataStore.delete(playlistId).onerror = (event) => {
        console.error("Failed to delete playlist metadata:", (event.target as IDBRequest).error);
        // Don't reject immediately, try to delete items anyway
    };

    const storesToDeleteFrom = [
        { store: channelStore, name: CHANNELS_STORE }, 
        { store: movieStore, name: MOVIES_STORE }, 
        { store: seriesStore, name: SERIES_STORE }, 
        { store: episodeStore, name: EPISODES_STORE }
    ];

    storesToDeleteFrom.forEach(obj => {
        const index = obj.store.index('playlistDbId_idx');
        const cursorRequest = index.openCursor(IDBKeyRange.only(playlistId));
        cursorRequest.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                obj.store.delete(cursor.primaryKey).onerror = (e) => {
                    console.error(`Failed to delete item ${cursor.primaryKey} from ${obj.name}:`, (e.target as IDBRequest).error);
                };
                cursor.continue();
            }
        };
        cursorRequest.onerror = (event) => {
            console.error(`Error opening cursor for ${obj.name} to delete items:`, (event.target as IDBRequest).error);
            // Don't reject immediately, try other stores
        };
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
        console.error("Transaction error for deleting playlist and items:", transaction.error);
        reject(transaction.error || "Transaction failed for deleting playlist and items.");
    }
  });
}


export async function getPlaylistItems(
  playlistDbId: string, 
  itemType?: 'channel' | 'movie' | 'series' | 'episode', 
  limit?: number, 
  offset: number = 0 // Default offset to 0
): Promise<any[]> { 
  const db = await getDb();
  let storeName: string;

  switch(itemType) {
    case 'channel': storeName = CHANNELS_STORE; break;
    case 'movie': storeName = MOVIES_STORE; break;
    case 'series': storeName = SERIES_STORE; break; 
    case 'episode': storeName = EPISODES_STORE; break;
    default: 
      console.warn(`getPlaylistItems called with invalid itemType or no itemType: ${itemType}. Returning empty array.`);
      return Promise.resolve([]);
  }

  return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index('playlistDbId_idx');
      const range = IDBKeyRange.only(playlistDbId);
      
      const items: any[] = [];
      let advanced = false;
      let count = 0;

      const cursorRequest = index.openCursor(range);

      cursorRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
              if (offset > 0 && !advanced) {
                  cursor.advance(offset);
                  advanced = true;
                  return; 
              }
              if (limit && items.length >= limit) {
                  resolve(items);
                  return;
              }
              items.push(cursor.value);
              cursor.continue();
          } else {
              resolve(items);
          }
      };
      cursorRequest.onerror = () => reject(cursorRequest.error);
  });
}

export async function getPlaylistItemsByGroup(
  playlistDbId: string,
  groupTitle: string, 
  itemType: 'movie' | 'series_episode' | 'channel', // Extended to support channel as well
  limit?: number,
  offset: number = 0 // Default offset to 0
): Promise<any[]> {
    const db = await getDb();
    let storeName: string;
    let indexName: string;

    switch(itemType) {
        case 'movie': 
            storeName = MOVIES_STORE; 
            indexName = 'playlist_genre_idx'; // Assuming groupTitle is genre for movies
            break;
        case 'series_episode': 
            // For series, groupTitle typically comes from the SeriesItem.
            // This query might be complex if we need to filter episodes by the series' groupTitle.
            // For now, let's assume we are querying SeriesItems themselves by their groupTitle/genre.
            // If we need episodes of series in a genre, it's a multi-step query.
            // Let's simplify: query Series store by genre.
            storeName = SERIES_STORE; // Querying Series, not episodes directly by genre
            indexName = 'playlist_genre_idx';
            break;
        case 'channel':
            storeName = CHANNELS_STORE;
            indexName = 'playlist_baseChannelName_idx'; // Or 'groupTitle_idx' if channels are grouped that way
            // For channels, 'groupTitle' might be used directly. If using baseChannelName, the 'groupTitle' param is the baseChannelName
            // Let's assume 'groupTitle_idx' if filtering by channel group
            // indexName = 'groupTitle_idx'; // This would need to be 'playlist_groupTitle_idx'
            // For now, let's use baseChannelName if groupTitle means the channel's name aggregation
            // If 'groupTitle' means category for channels, then it should be:
            // indexName = 'playlist_groupTitle_idx' - this index is missing in schema. Add it.
            // For now, this example assumes groupTitle IS the baseChannelName for channels for simplicity if not using category
            // This logic needs clarification based on how channels are grouped/filtered.
            // Let's assume for now groupTitle for channels refers to their category
            // We need an index like ['playlistDbId', 'groupTitle'] on CHANNELS_STORE.
            // Since it's not there, this specific case might not work as intended.
            // Let's make it filter by `baseChannelName` if itemType is channel and groupTitle is passed for that purpose
            if (storeName === CHANNELS_STORE) indexName = 'playlist_baseChannelName_idx';
            else { // Defaulting to genre for others.
                // This part is tricky for channels and needs a decision on how they are grouped.
                // For now, if itemType is channel and using groupTitle, we expect groupTitle to be baseChannelName.
                console.warn("getPlaylistItemsByGroup for channels is currently matching groupTitle against baseChannelName.");
            }
            break;
        default:
            return Promise.reject("Invalid itemType for getPlaylistItemsByGroup");
    }
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        // Range depends on index. playlist_genre_idx is ['playlistDbId', 'genre']
        const range = IDBKeyRange.only([playlistDbId, groupTitle]); 
        
        const items: any[] = [];
        let advanced = false;

        const cursorRequest = index.openCursor(range);
        cursorRequest.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                if (offset > 0 && !advanced) {
                    cursor.advance(offset);
                    advanced = true;
                    return;
                }
                if (limit && items.length >= limit) {
                    resolve(items); // Resolve once limit is reached
                    return;
                }
                items.push(cursor.value);
                cursor.continue();
            } else {
                resolve(items); // Resolve when cursor is done
            }
        };
        cursorRequest.onerror = () => reject(cursorRequest.error);
    });
}


export async function clearAllAppData(): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([
        PLAYLIST_METADATA_STORE, 
        CHANNELS_STORE, 
        MOVIES_STORE, 
        SERIES_STORE, 
        EPISODES_STORE
    ], 'readwrite');
    
    const storesToClear = [
        transaction.objectStore(PLAYLIST_METADATA_STORE),
        transaction.objectStore(CHANNELS_STORE),
        transaction.objectStore(MOVIES_STORE),
        transaction.objectStore(SERIES_STORE),
        transaction.objectStore(EPISODES_STORE),
    ];

    let completedClears = 0;
    const totalStores = storesToClear.length;

    storesToClear.forEach(store => {
        const request = store.clear();
        request.onsuccess = () => {
            completedClears++;
            if (completedClears === totalStores) {
                // All clear operations succeeded
            }
        };
        request.onerror = () => {
            console.error(`Failed to clear ${store.name}:`, request.error);
            // Don't reject immediately, try to clear other stores.
            // The transaction will either complete or error out as a whole.
        };
    });
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
        console.error("Transaction error for clearing all app data:", transaction.error);
        reject(transaction.error || "Transaction failed for clearing all app data.");
    }
  });
}

export async function countPlaylistItems(
    playlistDbId: string, 
    itemType: 'channel' | 'movie' | 'series' | 'episode' 
): Promise<number> {
  const db = await getDb();
  let storeName: string;
  switch(itemType) {
      case 'channel': storeName = CHANNELS_STORE; break;
      case 'movie': storeName = MOVIES_STORE; break;
      case 'series': storeName = SERIES_STORE; break; 
      case 'episode': storeName = EPISODES_STORE; break;
      default: return Promise.reject("Invalid itemType for count");
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index('playlistDbId_idx');
    const request = index.count(IDBKeyRange.only(playlistDbId));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllGenresForPlaylist(
    playlistDbId: string, 
    itemType: 'movie' | 'series' 
): Promise<string[]> {
  const db = await getDb();
  let storeName: string;

  if (itemType === 'movie') {
    storeName = MOVIES_STORE;
  } else if (itemType === 'series') {
    storeName = SERIES_STORE;
  } else {
    return Promise.resolve([]); 
  }
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index('playlistDbId_idx'); 
    const range = IDBKeyRange.only(playlistDbId);
    
    const genres = new Set<string>();
    const request = index.openCursor(range);

    request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
            const item = cursor.value as MovieItem | SeriesItem; 
            if (item.genre) { 
                genres.add(item.genre);
            } else if (item.groupTitle) { 
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
