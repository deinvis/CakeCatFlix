

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
        console.log(`Upgrading DB from version ${oldVersion} to ${DB_VERSION}`);

        if (!db.objectStoreNames.contains(PLAYLIST_METADATA_STORE)) {
          console.log(`Creating store ${PLAYLIST_METADATA_STORE}`);
          db.createObjectStore(PLAYLIST_METADATA_STORE, { keyPath: 'id' });
        }

        if (oldVersion < 4 && db.objectStoreNames.contains(LEGACY_PLAYLIST_ITEMS_STORE)) {
          console.log(`Upgrading DB: Deleting old store ${LEGACY_PLAYLIST_ITEMS_STORE}`);
          db.deleteObjectStore(LEGACY_PLAYLIST_ITEMS_STORE);
        }

        if (!db.objectStoreNames.contains(CHANNELS_STORE)) {
          console.log(`Creating store ${CHANNELS_STORE}`);
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
          console.log(`Creating store ${MOVIES_STORE}`);
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
        } else if (oldVersion < 4) { // For version 4, we might add playlist_genre_idx if not present
             const transaction = (event.target as IDBOpenDBRequest).transaction;
             if (transaction) {
                const movieStore = transaction.objectStore(MOVIES_STORE);
                if (!movieStore.indexNames.contains('playlist_genre_idx')) {
                     console.log(`Upgrading DB: Adding index playlist_genre_idx to ${MOVIES_STORE}`);
                     movieStore.createIndex('playlist_genre_idx', ['playlistDbId', 'genre'], { unique: false });
                }
             }
        }


        if (!db.objectStoreNames.contains(SERIES_STORE)) {
          console.log(`Creating store ${SERIES_STORE}`);
          const seriesStore = db.createObjectStore(SERIES_STORE, { autoIncrement: true, keyPath: 'id' });
          seriesStore.createIndex('playlistDbId_idx', 'playlistDbId', { unique: false });
          seriesStore.createIndex('title_idx', 'title', { unique: false });
          seriesStore.createIndex('genre_idx', 'genre', { unique: false });
          seriesStore.createIndex('playlist_title_idx', ['playlistDbId', 'title'], { unique: true });
          seriesStore.createIndex('playlist_genre_idx', ['playlistDbId', 'genre'], { unique: false });
        } else if (oldVersion < 4) {
            const transaction = (event.target as IDBOpenDBRequest).transaction;
            if (transaction) {
                const seriesStore = transaction.objectStore(SERIES_STORE);
                 if (!seriesStore.indexNames.contains('playlist_genre_idx')) {
                     console.log(`Upgrading DB: Adding index playlist_genre_idx to ${SERIES_STORE}`);
                     seriesStore.createIndex('playlist_genre_idx', ['playlistDbId', 'genre'], { unique: false });
                 }
            }
        }

        if (!db.objectStoreNames.contains(EPISODES_STORE)) {
          console.log(`Creating store ${EPISODES_STORE}`);
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
  const uniqueSeriesInPlaylist = new Map<string, { id?: number, item: SeriesItem }>();


  return new Promise(async (resolve, reject) => {
    transaction.onabort = () => {
        console.error("Transaction aborted in addPlaylistWithItems:", transaction.error);
        reject(transaction.error || new Error("Transaction aborted."));
    };
    transaction.onerror = () => {
        console.error("Transaction error in addPlaylistWithItems:", transaction.error);
        reject(transaction.error || new Error("Transaction failed."));
    };
    transaction.oncomplete = () => {
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
            // This error won't be caught by transaction.onerror if transaction already completed.
            console.error("Error updating playlist metadata after items processed:", metaRequest.error);
             // Attempt to reject the main promise, though transaction is complete.
            reject(metaRequest.error || new Error("Failed to update playlist metadata."));
        };
        // If metaRequest succeeds, it implies overall success for this phase.
        metaRequest.onsuccess = () => resolve();
    };

    // Pre-process to identify all unique series and prepare them for batch addition
    for (const item of items) {
        if (item.itemType === 'series_episode' && item.seriesTitle) {
            if (!uniqueSeriesInPlaylist.has(item.seriesTitle)) {
                const seriesEntry: SeriesItem = {
                    playlistDbId: metadata.id,
                    title: item.seriesTitle,
                    logoUrl: item.logoUrl,
                    groupTitle: item.groupTitle,
                    originalGroupTitle: item.originalGroupTitle,
                    tvgId: item.tvgId, // This might be episode's tvgId, consider if series-level tvgId exists
                    genre: item.genre,
                    year: item.year,
                };
                uniqueSeriesInPlaylist.set(item.seriesTitle, { item: seriesEntry });
            } else {
                // Update existing series entry if new info is better (e.g., logo from S01E01)
                const existingSeriesData = uniqueSeriesInPlaylist.get(item.seriesTitle)!;
                if (item.logoUrl && (!existingSeriesData.item.logoUrl || (item.seasonNumber === 1 && item.episodeNumber === 1))) {
                    existingSeriesData.item.logoUrl = item.logoUrl;
                }
                if (item.genre && !existingSeriesData.item.genre) existingSeriesData.item.genre = item.genre;
                if (item.year && !existingSeriesData.item.year) existingSeriesData.item.year = item.year;
                if (item.groupTitle && !existingSeriesData.item.groupTitle) existingSeriesData.item.groupTitle = item.groupTitle;

            }
        }
    }

    // Batch add series items and get their IDs
    const seriesAddPromises = Array.from(uniqueSeriesInPlaylist.values()).map(seriesData =>
        new Promise<void>((res, rej) => {
            const addSeriesRequest = seriesStore.add(seriesData.item);
            addSeriesRequest.onsuccess = (event) => {
                seriesData.id = (event.target as IDBRequest).result as number;
                res();
            };
            addSeriesRequest.onerror = () => rej(addSeriesRequest.error);
        })
    );

    try {
        await Promise.all(seriesAddPromises);
    } catch (error) {
        console.error("Error batch adding series items:", error);
        if (transaction.error === null) transaction.abort(); // Abort if not already
        reject(error);
        return;
    }

    // Now add individual items
    const itemAddPromises = items.map(item => new Promise<void>((res, rej) => {
        item.playlistDbId = metadata.id;
        let request: IDBRequest;

        if (item.itemType === 'channel') {
            const channel: ChannelItem = { /* ... map item to ChannelItem ... */
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
            request = channelStore.add(channel);
            request.onsuccess = () => { channelCount++; res(); };
        } else if (item.itemType === 'movie') {
            const movie: MovieItem = { /* ... map item to MovieItem ... */
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
            request = movieStore.add(movie);
            request.onsuccess = () => { movieCount++; res(); };
        } else if (item.itemType === 'series_episode') {
            if (!item.seriesTitle) { console.warn("Series episode missing seriesTitle, skipping:", item); res(); return; }
            const seriesData = uniqueSeriesInPlaylist.get(item.seriesTitle);
            if (!seriesData || seriesData.id === undefined) {
                console.error(`Series ID not found for "${item.seriesTitle}", skipping episode.`);
                res(); return;
            }
            const episode: EpisodeItem = { /* ... map item to EpisodeItem ... */
                playlistDbId: item.playlistDbId,
                seriesDbId: seriesData.id,
                title: item.title,
                streamUrl: item.streamUrl,
                logoUrl: item.logoUrl,
                seasonNumber: item.seasonNumber,
                episodeNumber: item.episodeNumber,
                tvgId: item.tvgId,
            };
            request = episodeStore.add(episode);
            request.onsuccess = () => { episodeCount++; res(); };
        } else {
            res(); // Unknown item type
            return;
        }
        request.onerror = () => rej(request.error);
    }));

    try {
        await Promise.all(itemAddPromises);
        // Transaction will complete via oncomplete handler
    } catch (error) {
        console.error("Error batch adding channel/movie/episode items:", error);
         if (transaction.error === null) transaction.abort();
        reject(error);
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
  itemType?: 'channel' | 'movie' | 'series' | 'episode', // Added 'series' and 'episode'
  limit?: number,
  offset: number = 0
): Promise<any[]> { // Return type is any[] as it can be ChannelItem[], MovieItem[], etc.
  const db = await getDb();
  let storeName: string;

  switch(itemType) {
    case 'channel': storeName = CHANNELS_STORE; break;
    case 'movie': storeName = MOVIES_STORE; break;
    case 'series': storeName = SERIES_STORE; break; // To fetch unique series items
    case 'episode': storeName = EPISODES_STORE; break; // To fetch episodes, likely filtered by seriesDbId later
    default:
      console.warn(`getPlaylistItems called with invalid or no itemType: ${itemType}. Returning empty array.`);
      return Promise.resolve([]);
  }

  return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index('playlistDbId_idx'); // Assumes all stores have this index
      const range = IDBKeyRange.only(playlistDbId);

      const items: any[] = [];
      let advancedOnce = false; // To ensure advance is called only once.
      let count = 0;

      const cursorRequest = index.openCursor(range);

      cursorRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
              if (offset > 0 && !advancedOnce) {
                  advancedOnce = true;
                  try {
                      cursor.advance(offset);
                  } catch (e) {
                      console.warn("Failed to advance cursor by offset (offset might be too large):", e);
                      resolve(items); // Resolve with items collected so far, or empty if none before error.
                      return;
                  }
                  // After calling advance, we must wait for the next 'onsuccess' to get the new cursor position.
                  // So, we simply return here.
                  return;
              }

              if (limit && items.length >= limit) {
                  resolve(items);
                  return;
              }
              items.push(cursor.value);
              cursor.continue();
          } else {
              // Cursor is null, meaning no more items or advance went past the end.
              resolve(items);
          }
      };
      cursorRequest.onerror = () => {
          console.error(`Error fetching items from ${storeName} for playlist ${playlistDbId}:`, cursorRequest.error);
          reject(cursorRequest.error);
      };
  });
}

export async function getPlaylistItemsByGroup(
  playlistDbId: string,
  groupTitle: string,
  itemType: 'movie' | 'series' | 'channel', // itemType is now mandatory
  limit?: number,
  offset: number = 0
): Promise<any[]> {
    const db = await getDb();
    let storeName: string;
    let indexName: string;
    // The key for the index will be a compound key [playlistDbId, groupTitle/genre]
    let keyRangeValue: IDBValidKey | IDBKeyRange = IDBKeyRange.only([playlistDbId, groupTitle]);

    switch(itemType) {
        case 'movie':
            storeName = MOVIES_STORE;
            indexName = 'playlist_genre_idx'; // Assumes 'genre' field in MovieItem stores the groupTitle
            break;
        case 'series':
            storeName = SERIES_STORE;
            indexName = 'playlist_genre_idx'; // Assumes 'genre' field in SeriesItem stores the groupTitle
            break;
        case 'channel':
            storeName = CHANNELS_STORE;
            indexName = 'playlist_groupTitle_idx'; // Uses 'groupTitle' field in ChannelItem
            break;
        default:
            return Promise.reject(new Error("Invalid itemType for getPlaylistItemsByGroup. Must be 'movie', 'series', or 'channel'."));
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);

        const items: any[] = [];
        let advancedOnce = false;

        const cursorRequest = index.openCursor(keyRangeValue);
        cursorRequest.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                if (offset > 0 && !advancedOnce) {
                    advancedOnce = true;
                    try {
                        cursor.advance(offset);
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
        cursorRequest.onerror = () => {
            console.error(`Error fetching items by group "${groupTitle}" from ${storeName}:`, cursorRequest.error);
            reject(cursorRequest.error);
        };
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
    itemType: 'movie' | 'series' | 'channel'
): Promise<string[]> {
  const db = await getDb();
  let storeName: string;
  let fieldToCollect: 'genre' | 'groupTitle';

  switch(itemType) {
    case 'movie':
      storeName = MOVIES_STORE;
      fieldToCollect = 'genre'; // MovieItem has a 'genre' field
      break;
    case 'series':
      storeName = SERIES_STORE;
      fieldToCollect = 'genre'; // SeriesItem has a 'genre' field
      break;
    case 'channel':
      storeName = CHANNELS_STORE;
      fieldToCollect = 'groupTitle'; // ChannelItem uses 'groupTitle' as its category
      break;
    default:
      return Promise.resolve([]);
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index('playlistDbId_idx');
    const range = IDBKeyRange.only(playlistDbId);

    const uniqueValues = new Set<string>();
    const request = index.openCursor(range);

    request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
            const item = cursor.value as MovieItem | SeriesItem | ChannelItem;
            const value = item[fieldToCollect as keyof typeof item] as string | undefined;
            if (value) {
                uniqueValues.add(value);
            }
            cursor.continue();
        } else {
            resolve(Array.from(uniqueValues).sort());
        }
    };
    request.onerror = () => {
        console.error(`Error fetching genres/groups for ${itemType} from playlist ${playlistDbId}:`, request.error);
        reject(request.error);
    };
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
export async function getSeriesItemById(id: number | string): Promise<SeriesItem | undefined> {
    // The ID for series might be its auto-incremented primary key (number) or its tvgId/title (string) if used as a key
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(SERIES_STORE, 'readonly');
        const store = transaction.objectStore(SERIES_STORE);
        // If id is a string, it might be a tvgId or title, requiring an index lookup.
        // For now, assuming id is the primary key (number)
        const request = store.get(typeof id === 'string' ? parseInt(id) : id);
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
        const index = store.index('playlist_series_season_episode_idx');
        // Query for [playlistDbId, seriesDbId] - lower bound
        // And [playlistDbId, seriesDbId, highest_possible_season, highest_possible_episode] - upper bound
        // A simpler approach for now if the index is exactly ['playlistDbId', 'seriesDbId', ...]
        // is to use a range that covers all episodes for that series in that playlist.
        // For an index on ['playlistDbId', 'seriesDbId', 'seasonNumber', 'episodeNumber'],
        // we can use IDBKeyRange.bound([playlistDbId, seriesDbId], [playlistDbId, seriesDbId, [], []], false, false)
        // The [] acts as "positive infinity" for season/episode numbers in this context.
        const lowerBound = [playlistDbId, seriesDbId];
        const upperBound = [playlistDbId, seriesDbId, [], []]; // [] is like +Infinity for IndexedDB compound keys

        const range = IDBKeyRange.bound(lowerBound, upperBound, false, false);

        const episodes: EpisodeItem[] = [];
        const cursorRequest = index.openCursor(range);

        cursorRequest.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                episodes.push(cursor.value as EpisodeItem);
                cursor.continue();
            } else {
                // Sort episodes by season and then episode number (client-side sorting after fetch)
                episodes.sort((a, b) => {
                    if ((a.seasonNumber ?? Infinity) === (b.seasonNumber ?? Infinity)) {
                        return (a.episodeNumber ?? Infinity) - (b.episodeNumber ?? Infinity);
                    }
                    return (a.seasonNumber ?? Infinity) - (b.seasonNumber ?? Infinity);
                });
                resolve(episodes);
            }
        };
        cursorRequest.onerror = () => {
            console.error(`Error fetching episodes for series ${seriesDbId} in playlist ${playlistDbId}:`, cursorRequest.error);
            reject(cursorRequest.error);
        };
    });
}

