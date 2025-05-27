
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
        
        if (!db.objectStoreNames.contains(PLAYLIST_METADATA_STORE)) {
          db.createObjectStore(PLAYLIST_METADATA_STORE, { keyPath: 'id' });
        }

        if (oldVersion < 4 && db.objectStoreNames.contains(LEGACY_PLAYLIST_ITEMS_STORE)) {
          console.log(`Upgrading DB: Deleting old store ${LEGACY_PLAYLIST_ITEMS_STORE}`);
          db.deleteObjectStore(LEGACY_PLAYLIST_ITEMS_STORE);
        }
        
        if (!db.objectStoreNames.contains(CHANNELS_STORE)) {
          console.log(`Upgrading DB: Creating store ${CHANNELS_STORE}`);
          const channelStore = db.createObjectStore(CHANNELS_STORE, { autoIncrement: true, keyPath: 'id' });
          channelStore.createIndex('playlistDbId_idx', 'playlistDbId', { unique: false });
          channelStore.createIndex('baseChannelName_idx', 'baseChannelName', { unique: false });
          channelStore.createIndex('playlist_baseChannelName_idx', ['playlistDbId', 'baseChannelName'], { unique: false });
          channelStore.createIndex('groupTitle_idx', 'groupTitle', { unique: false });
          channelStore.createIndex('playlist_groupTitle_idx', ['playlistDbId', 'groupTitle'], { unique: false });
        } else if (oldVersion < 4) {
            const transaction = (event.target as IDBOpenDBRequest).transaction;
            if (transaction) {
                const channelStore = transaction.objectStore(CHANNELS_STORE);
                if (!channelStore.indexNames.contains('playlist_groupTitle_idx')) {
                    console.log(`Upgrading DB: Adding index playlist_groupTitle_idx to ${CHANNELS_STORE}`);
                    channelStore.createIndex('playlist_groupTitle_idx', ['playlistDbId', 'groupTitle'], { unique: false });
                }
            }
        }


        if (!db.objectStoreNames.contains(MOVIES_STORE)) {
          console.log(`Upgrading DB: Creating store ${MOVIES_STORE}`);
          const movieStore = db.createObjectStore(MOVIES_STORE, { autoIncrement: true, keyPath: 'id' });
          movieStore.createIndex('playlistDbId_idx', 'playlistDbId', { unique: false });
          movieStore.createIndex('genre_idx', 'genre', { unique: false });
          movieStore.createIndex('year_idx', 'year', { unique: false });
          movieStore.createIndex('playlist_genre_idx', ['playlistDbId', 'genre'], { unique: false });
          movieStore.createIndex('title_idx', 'title', {unique: false});
        } else if (oldVersion < 3) { 
            const transaction = (event.target as IDBOpenDBRequest).transaction;
            if (transaction) {
                const movieStore = transaction.objectStore(MOVIES_STORE);
                if (!movieStore.indexNames.contains('year_idx')) {
                    console.log(`Upgrading DB: Adding index year_idx to ${MOVIES_STORE}`);
                    movieStore.createIndex('year_idx', 'year', { unique: false });
                }
            }
        }


        if (!db.objectStoreNames.contains(SERIES_STORE)) {
          console.log(`Upgrading DB: Creating store ${SERIES_STORE}`);
          const seriesStore = db.createObjectStore(SERIES_STORE, { autoIncrement: true, keyPath: 'id' });
          seriesStore.createIndex('playlistDbId_idx', 'playlistDbId', { unique: false });
          seriesStore.createIndex('title_idx', 'title', { unique: false }); 
          seriesStore.createIndex('genre_idx', 'genre', { unique: false });
          seriesStore.createIndex('playlist_title_idx', ['playlistDbId', 'title'], { unique: true }); 
          seriesStore.createIndex('playlist_genre_idx', ['playlistDbId', 'genre'], { unique: false });
        }

        if (!db.objectStoreNames.contains(EPISODES_STORE)) {
          console.log(`Upgrading DB: Creating store ${EPISODES_STORE}`);
          const episodeStore = db.createObjectStore(EPISODES_STORE, { autoIncrement: true, keyPath: 'id' });
          episodeStore.createIndex('playlistDbId_idx', 'playlistDbId', { unique: false });
          episodeStore.createIndex('seriesDbId_idx', 'seriesDbId', { unique: false }); 
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
    const uniqueSeriesInPlaylist = new Map<string, { id: number | undefined, item: SeriesItem }>(); 

    const seriesAddPromises: Promise<void>[] = [];

    for (const item of items) {
        if (item.itemType === 'series_episode' && item.seriesTitle) {
            if (!uniqueSeriesInPlaylist.has(item.seriesTitle)) {
                const seriesEntry: SeriesItem = {
                    playlistDbId: metadata.id,
                    title: item.seriesTitle,
                    logoUrl: item.logoUrl, 
                    groupTitle: item.groupTitle,
                    originalGroupTitle: item.originalGroupTitle,
                    tvgId: item.tvgId,
                    genre: item.genre,
                    year: item.year,
                };
                const seriesData = { id: undefined, item: seriesEntry };
                uniqueSeriesInPlaylist.set(item.seriesTitle, seriesData);
                
                seriesAddPromises.push(
                    new Promise<void>((resolveAdd, rejectAdd) => {
                        const addSeriesRequest = seriesStore.add(seriesData.item);
                        addSeriesRequest.onsuccess = (event) => {
                            seriesData.id = (event.target as IDBRequest).result as number;
                            resolveAdd();
                        };
                        addSeriesRequest.onerror = () => rejectAdd(addSeriesRequest.error);
                    })
                );
            } else {
                const existingSeries = uniqueSeriesInPlaylist.get(item.seriesTitle)!;
                if (item.logoUrl && (!existingSeries.item.logoUrl || (item.seasonNumber === 1 && item.episodeNumber === 1))) {
                    existingSeries.item.logoUrl = item.logoUrl;
                }
                 if (item.genre && !existingSeries.item.genre) existingSeries.item.genre = item.genre;
                 if (item.year && !existingSeries.item.year) existingSeries.item.year = item.year;

            }
        }
    }

    try {
        await Promise.all(seriesAddPromises);
        // After all series are added and IDs are set, update any series items that had their details changed
        const seriesUpdatePromises: Promise<void>[] = [];
        uniqueSeriesInPlaylist.forEach(seriesData => {
            if (seriesData.id !== undefined) { // Ensure ID is set
                 seriesUpdatePromises.push(
                    new Promise<void>((resolveUpdate, rejectUpdate) => {
                        const updateReq = seriesStore.put(seriesData.item); // seriesData.item has ID from autoIncrement
                        updateReq.onsuccess = () => resolveUpdate();
                        updateReq.onerror = () => rejectUpdate(updateReq.error);
                    })
                );
            }
        });
        await Promise.all(seriesUpdatePromises);

    } catch (error) {
        console.error("Error adding or updating series items:", error);
        transaction.abort();
        reject(error);
        return;
    }
    
    const itemAddPromises: Promise<void>[] = [];
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
        itemAddPromises.push(new Promise((res, rej) => {
            const req = channelStore.add(channel);
            req.onsuccess = () => { channelCount++; res(); };
            req.onerror = () => rej(req.error);
        }));
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
        itemAddPromises.push(new Promise((res, rej) => {
            const req = movieStore.add(movie);
            req.onsuccess = () => { movieCount++; res(); };
            req.onerror = () => rej(req.error);
        }));
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
        itemAddPromises.push(new Promise((res, rej) => {
            const req = episodeStore.add(episode);
            req.onsuccess = () => { episodeCount++; res(); };
            req.onerror = () => rej(req.error);
        }));
      }
    }

    try {
        await Promise.all(itemAddPromises);
    } catch (error) {
        console.error("Error adding channel/movie/episode items:", error);
        transaction.abort();
        reject(error);
        return;
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
        transaction.abort(); 
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
  offset: number = 0
): Promise<any[]> { 
  const db = await getDb();
  let storeName: string;
  let targetItemType: PlaylistItemType | 'series' = itemType || 'channel'; // Default to channel if not specified

  switch(targetItemType) {
    case 'channel': storeName = CHANNELS_STORE; break;
    case 'movie': storeName = MOVIES_STORE; break;
    case 'series': storeName = SERIES_STORE; break; 
    case 'episode': storeName = EPISODES_STORE; break;
    default: 
      console.warn(`getPlaylistItems called with invalid itemType: ${targetItemType}. Returning empty array.`);
      return Promise.resolve([]);
  }

  return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index('playlistDbId_idx');
      const range = IDBKeyRange.only(playlistDbId);
      
      const items: any[] = [];
      let advanced = false;

      const cursorRequest = index.openCursor(range);

      cursorRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
              if (offset > 0 && !advanced) {
                  try {
                      cursor.advance(offset);
                      advanced = true;
                  } catch (e) {
                      // Advance might fail if offset is too large, just resolve with what we have or empty
                      console.warn("Failed to advance cursor by offset:", e);
                      resolve(items);
                      return;
                  }
                  // Important: after advance, we need to wait for the next 'onsuccess' event
                  // which will have the cursor at the new position or null if offset was too large.
                  // So, we just return here and let the next onsuccess handle it.
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
  itemType?: 'movie' | 'series' | 'channel', 
  limit?: number,
  offset: number = 0
): Promise<any[]> {
    const db = await getDb();
    let storeName: string;
    let indexName: string;
    // The key for the index will depend on whether itemType is specified
    let keyRangeValue: IDBValidKey | IDBKeyRange = IDBKeyRange.only([playlistDbId, groupTitle]);

    switch(itemType) {
        case 'movie': 
            storeName = MOVIES_STORE; 
            indexName = 'playlist_genre_idx'; 
            break;
        case 'series': 
            storeName = SERIES_STORE;
            indexName = 'playlist_genre_idx';
            break;
        case 'channel':
            storeName = CHANNELS_STORE;
            indexName = 'playlist_groupTitle_idx'; // Use the specific index for channels by group title
            break;
        default:
            // If itemType is not specified, this function's behavior is ambiguous.
            // For now, let's assume it implies movies if not specified, or reject.
            console.warn("getPlaylistItemsByGroup called without a specific itemType. Defaulting to movies or consider rejecting.");
            // storeName = MOVIES_STORE; 
            // indexName = 'playlist_genre_idx';
            return Promise.reject("Invalid or unspecified itemType for getPlaylistItemsByGroup");
    }
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        
        const items: any[] = [];
        let advanced = false;

        const cursorRequest = index.openCursor(keyRangeValue);
        cursorRequest.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                if (offset > 0 && !advanced) {
                   try {
                        cursor.advance(offset);
                        advanced = true;
                    } catch (e) {
                        console.warn("Failed to advance cursor by offset:", e);
                        resolve(items);
                        return;
                    }
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
  let genreField: 'genre' | 'groupTitle' = 'genre'; // Default to 'genre'

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
    // Use the playlistDbId_idx to iterate through all items of the playlist
    const index = store.index('playlistDbId_idx'); 
    const range = IDBKeyRange.only(playlistDbId);
    
    const genres = new Set<string>();
    const request = index.openCursor(range);

    request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
            // The type of item can be inferred from the storeName, or we can be more explicit
            const item = cursor.value as MovieItem | SeriesItem; 
            
            // For movies and series, 'genre' is the primary field for genre.
            // 'groupTitle' can be a fallback or secondary source if 'genre' is empty.
            if (item.genre) { 
                genres.add(item.genre);
            } else if (item.groupTitle && (itemType === 'movie' || itemType === 'series')) {
                // Only use groupTitle as a fallback if item.genre is not present for movies/series
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

// Fetches a single ChannelItem by its database ID
export async function getChannelItemById(id: number): Promise<ChannelItem | undefined> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(CHANNELS_STORE, 'readonly');
        const store = transaction.objectStore(CHANNELS_STORE);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result as ChannelItem | undefined);
        request.onerror = () => reject(request.error);
    });
}

// Fetches a single MovieItem by its database ID
export async function getMovieItemById(id: number): Promise<MovieItem | undefined> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(MOVIES_STORE, 'readonly');
        const store = transaction.objectStore(MOVIES_STORE);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result as MovieItem | undefined);
        request.onerror = () => reject(request.error);
    });
}

// Fetches a single SeriesItem by its database ID
export async function getSeriesItemById(id: number): Promise<SeriesItem | undefined> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(SERIES_STORE, 'readonly');
        const store = transaction.objectStore(SERIES_STORE);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result as SeriesItem | undefined);
        request.onerror = () => reject(request.error);
    });
}

// Fetches all EpisodeItems for a given seriesDbId from a specific playlist
export async function getEpisodesForSeries(playlistDbId: string, seriesDbId: number): Promise<EpisodeItem[]> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(EPISODES_STORE, 'readonly');
        const store = transaction.objectStore(EPISODES_STORE);
        // Use the index that includes playlistDbId and seriesDbId
        const index = store.index('playlist_series_season_episode_idx'); // This index also works for just playlist + series
        // To query by [playlistDbId, seriesDbId], we can create a range.
        // However, the index is ['playlistDbId', 'seriesDbId', 'seasonNumber', 'episodeNumber']
        // A simpler way might be to iterate over 'seriesDbId_idx' and filter by playlistDbId,
        // or ensure 'playlist_seriesDbId_idx' exists. Let's use seriesDbId_idx and filter.
        
        const seriesIndex = store.index('seriesDbId_idx');
        const range = IDBKeyRange.only(seriesDbId);
        
        const episodes: EpisodeItem[] = [];
        const cursorRequest = seriesIndex.openCursor(range);

        cursorRequest.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                const episode = cursor.value as EpisodeItem;
                // Filter by playlistDbId because seriesDbId_idx only looks at seriesDbId
                if (episode.playlistDbId === playlistDbId) {
                    episodes.push(episode);
                }
                cursor.continue();
            } else {
                // Sort episodes by season and then episode number
                episodes.sort((a, b) => {
                    if ((a.seasonNumber ?? 0) === (b.seasonNumber ?? 0)) {
                        return (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0);
                    }
                    return (a.seasonNumber ?? 0) - (b.seasonNumber ?? 0);
                });
                resolve(episodes);
            }
        };
        cursorRequest.onerror = () => reject(cursorRequest.error);
    });
}
