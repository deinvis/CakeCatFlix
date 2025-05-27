
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
  PlaylistItem,
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
        console.log(`DB: Upgrading DB from version ${oldVersion} to ${DB_VERSION}`);

        if (!db.objectStoreNames.contains(PLAYLIST_METADATA_STORE)) {
          console.log(`DB: Creating store ${PLAYLIST_METADATA_STORE}`);
          db.createObjectStore(PLAYLIST_METADATA_STORE, { keyPath: 'id' });
        }

        if (oldVersion < 4 && db.objectStoreNames.contains(LEGACY_PLAYLIST_ITEMS_STORE)) {
          console.log(`DB: Deleting old store ${LEGACY_PLAYLIST_ITEMS_STORE}`);
          db.deleteObjectStore(LEGACY_PLAYLIST_ITEMS_STORE);
        }

        const ensureStoreAndIndices = (storeName: string, keyPath: string | undefined, indices: { name: string, keyPath: string | string[], options?: IDBIndexParameters }[]) => {
          let store: IDBObjectStore;
          if (!db.objectStoreNames.contains(storeName)) {
            console.log(`DB: Creating store ${storeName}`);
            store = db.createObjectStore(storeName, { autoIncrement: true, keyPath: keyPath });
          } else {
            const transaction = (event.target as IDBOpenDBRequest).transaction;
            if (!transaction) {
                console.error(`DB: Transaction not available for upgrading ${storeName}`);
                return;
            }
            store = transaction.objectStore(storeName);
          }
          indices.forEach(indexInfo => {
            if (!store.indexNames.contains(indexInfo.name)) {
              console.log(`DB: Creating index ${indexInfo.name} on ${storeName}`);
              store.createIndex(indexInfo.name, indexInfo.keyPath, indexInfo.options);
            }
          });
        };
        
        ensureStoreAndIndices(CHANNELS_STORE, 'id', [
          { name: 'playlistDbId_idx', keyPath: 'playlistDbId' },
          { name: 'baseChannelName_idx', keyPath: 'baseChannelName' },
          { name: 'playlist_baseChannelName_idx', keyPath: ['playlistDbId', 'baseChannelName'] },
          { name: 'groupTitle_idx', keyPath: 'groupTitle' },
          { name: 'playlist_groupTitle_idx', keyPath: ['playlistDbId', 'groupTitle'] },
        ]);

        ensureStoreAndIndices(MOVIES_STORE, 'id', [
          { name: 'playlistDbId_idx', keyPath: 'playlistDbId' },
          { name: 'genre_idx', keyPath: 'genre' },
          { name: 'year_idx', keyPath: 'year' },
          { name: 'title_idx', keyPath: 'title'},
          { name: 'playlist_genre_idx', keyPath: ['playlistDbId', 'genre'] },
          { name: 'playlist_title_year_idx', keyPath: ['playlistDbId', 'title', 'year'] },
        ]);
        
        ensureStoreAndIndices(SERIES_STORE, 'id', [
          { name: 'playlistDbId_idx', keyPath: 'playlistDbId' },
          { name: 'title_idx', keyPath: 'title' },
          { name: 'genre_idx', keyPath: 'genre' },
          { name: 'playlist_title_idx', keyPath: ['playlistDbId', 'title'], options: { unique: true } },
          { name: 'playlist_genre_idx', keyPath: ['playlistDbId', 'genre'] },
        ]);

        ensureStoreAndIndices(EPISODES_STORE, 'id', [
          { name: 'playlistDbId_idx', keyPath: 'playlistDbId' },
          { name: 'seriesDbId_idx', keyPath: 'seriesDbId' },
          { name: 'title_idx', keyPath: 'title'},
          { name: 'playlist_series_season_episode_idx', keyPath: ['playlistDbId', 'seriesDbId', 'seasonNumber', 'episodeNumber'] },
          { name: 'seriesDbId_season_episode_idx', keyPath: ['seriesDbId', 'seasonNumber', 'episodeNumber'] },
        ]);
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
      resolve();
    };
    
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
                uniqueSeriesInPlaylist.set(item.seriesTitle, { item: seriesEntry });
            } else {
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
        if (transaction.error === null && transaction.idbRequest && transaction.idbRequest.readyState !== 'done') transaction.abort();
        reject(error);
        return;
    }

    const itemAddOperations: Promise<void>[] = items.map(item => new Promise<void>((resItem, rejItem) => {
        item.playlistDbId = metadata.id;
        let request: IDBRequest;

        if (item.itemType === 'channel') {
            const channel: ChannelItem = { 
                playlistDbId: item.playlistDbId,
                title: item.title, streamUrl: item.streamUrl, logoUrl: item.logoUrl,
                groupTitle: item.groupTitle, originalGroupTitle: item.originalGroupTitle,
                tvgId: item.tvgId, tvgName: item.tvgName,
                baseChannelName: item.baseChannelName, quality: item.quality,
            };
            request = channelStore.add(channel);
            request.onsuccess = () => { channelCount++; resItem(); };
        } else if (item.itemType === 'movie') {
            const movie: MovieItem = {
                playlistDbId: item.playlistDbId,
                title: item.title, streamUrl: item.streamUrl, logoUrl: item.logoUrl,
                groupTitle: item.groupTitle, originalGroupTitle: item.originalGroupTitle,
                tvgId: item.tvgId, tvgName: item.tvgName,
                genre: item.genre, year: item.year,
            };
            request = movieStore.add(movie);
            request.onsuccess = () => { movieCount++; resItem(); };
        } else if (item.itemType === 'series_episode') {
            if (!item.seriesTitle) { console.warn("Series episode missing seriesTitle, skipping:", item); resItem(); return; }
            const seriesData = uniqueSeriesInPlaylist.get(item.seriesTitle);
            if (!seriesData || seriesData.id === undefined) {
                console.error(`Series ID not found for "${item.seriesTitle}", skipping episode.`);
                resItem(); return;
            }
            const episode: EpisodeItem = {
                playlistDbId: item.playlistDbId,
                seriesDbId: seriesData.id,
                title: item.title, streamUrl: item.streamUrl, logoUrl: item.logoUrl,
                seasonNumber: item.seasonNumber, episodeNumber: item.episodeNumber,
                tvgId: item.tvgId,
            };
            request = episodeStore.add(episode);
            request.onsuccess = () => { episodeCount++; resItem(); };
        } else {
            resItem(); 
            return;
        }
        request.onerror = () => rejItem(request.error);
    }));
    
    try {
      await Promise.all(itemAddOperations);
      
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
          console.error("Error updating playlist metadata after items processed:", metaRequest.error);
      };

    } catch (error) {
        console.error("Error batch adding channel/movie/episode items:", error);
        if (transaction.error === null && transaction.idbRequest && transaction.idbRequest.readyState !== 'done') transaction.abort();
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
  itemType: 'channel' | 'movie' | 'series' | 'episode',
  limit?: number,
  offset: number = 0
): Promise<any[]> { 
  const db = await getDb();
  let storeName: string;

  switch(itemType) {
    case 'channel': storeName = CHANNELS_STORE; break;
    case 'movie': storeName = MOVIES_STORE; break;
    case 'series': storeName = SERIES_STORE; break; 
    case 'episode': storeName = EPISODES_STORE; break; 
    default:
      console.warn(`getPlaylistItems called with invalid itemType: ${itemType}. Returning empty array.`);
      return Promise.resolve([]);
  }

  return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index('playlistDbId_idx'); 
      const range = IDBKeyRange.only(playlistDbId);

      const items: any[] = [];
      let advancedCount = 0; 
      let itemsAdded = 0;
      
      const cursorRequest = index.openCursor(range);

      cursorRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
              if (offset > 0 && advancedCount < offset) {
                  advancedCount++;
                  cursor.continue();
                  return;
              }

              if (limit && itemsAdded >= limit) {
                  resolve(items);
                  return;
              }
              items.push(cursor.value);
              itemsAdded++;
              cursor.continue();
          } else {
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
            indexName = 'playlist_groupTitle_idx'; 
            break;
        default:
            // Should not happen if itemType is enforced by TypeScript
            return Promise.reject(new Error("Invalid itemType for getPlaylistItemsByGroup."));
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);

        const items: any[] = [];
        let advancedCount = 0;
        let itemsAdded = 0;

        const cursorRequest = index.openCursor(keyRangeValue);
        cursorRequest.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                if (offset > 0 && advancedCount < offset) {
                  advancedCount++;
                  cursor.continue();
                  return;
                }
                if (limit && itemsAdded >= limit) {
                    resolve(items);
                    return;
                }
                items.push(cursor.value);
                itemsAdded++;
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
      fieldToCollect = 'genre'; 
      break;
    case 'series':
      storeName = SERIES_STORE;
      fieldToCollect = 'genre'; 
      break;
    case 'channel':
      storeName = CHANNELS_STORE;
      fieldToCollect = 'groupTitle'; 
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
            resolve(Array.from(uniqueValues).sort((a, b) => a.localeCompare(b, undefined, {sensitivity: 'base'})));
        }
    };
    request.onerror = () => {
        console.error(`Error fetching genres/groups for ${itemType} from playlist ${playlistDbId}:`, request.error);
        reject(request.error);
    };
  });
}

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

export async function getMovieItemsByTitleYearAcrossPlaylists(
    title: string,
    year: number | undefined,
    activePlaylistIds: string[]
): Promise<MovieItem[]> {
    if (activePlaylistIds.length === 0) return [];
    const db = await getDb();
    const transaction = db.transaction(MOVIES_STORE, 'readonly');
    const store = transaction.objectStore(MOVIES_STORE);
    const index = store.index('playlist_title_year_idx');

    const allMatchingMovies: MovieItem[] = [];

    const promises = activePlaylistIds.map(playlistDbId => {
        return new Promise<void>((resolvePlaylist, rejectPlaylist) => {
            // If year is undefined, we might need a different query or to iterate more.
            // For simplicity now, this query assumes year is part of the index effectively.
            // A more robust query might involve fetching by title and then client-side filtering by year if year isn't always present or reliably indexed.
            const keyRange = year
                ? IDBKeyRange.only([playlistDbId, title, year])
                : IDBKeyRange.bound([playlistDbId, title, -Infinity], [playlistDbId, title, Infinity]); // Attempt to get all years for title

            const request = index.getAll(keyRange); // Using getAll for potentially multiple matches (though index should be unique per playlist)
            
            request.onsuccess = (event) => {
                const moviesInPlaylist = (event.target as IDBRequest).result as MovieItem[];
                moviesInPlaylist.forEach(movie => {
                     // Double check title and year client-side if year was originally undefined for query
                    if (movie.title === title && (year === undefined || movie.year === year)) {
                         allMatchingMovies.push(movie);
                    }
                });
                resolvePlaylist();
            };
            request.onerror = () => {
                console.error(`Error fetching movies for title "${title}" in playlist ${playlistDbId}:`, request.error);
                rejectPlaylist(request.error);
            };
        });
    });

    await Promise.all(promises);
    return allMatchingMovies;
}


export async function getSeriesItemById(id: string | number): Promise<SeriesItem | undefined> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(SERIES_STORE, 'readonly');
        const store = transaction.objectStore(SERIES_STORE);
        const key = typeof id === 'string' ? parseInt(id, 10) : id;
        if (isNaN(key)) {
            return reject(new Error("Invalid series ID format for DB lookup."));
        }
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result as SeriesItem | undefined);
        request.onerror = () => reject(request.error);
    });
}

export async function getEpisodesForSeries(playlistDbId: string, seriesDbId: number): Promise<EpisodeItem[]> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(EPISODES_STORE, 'readonly');
        const store = transaction.objectStore(EPISODES_STORE);
        const index = store.index('playlist_series_season_episode_idx');
        const lowerBound = [playlistDbId, seriesDbId];
        const upperBound = [playlistDbId, seriesDbId, '\uffff', '\uffff']; 

        const range = IDBKeyRange.bound(lowerBound, upperBound, false, false);

        const episodes: EpisodeItem[] = [];
        const cursorRequest = index.openCursor(range);

        cursorRequest.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                episodes.push(cursor.value as EpisodeItem);
                cursor.continue();
            } else {
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


export async function getEpisodesForSeriesAcrossPlaylists(
  seriesDbId: number, // This is the SeriesItem.id
  activePlaylistIds: string[]
): Promise<EpisodeItem[]> {
  if (activePlaylistIds.length === 0) return [];
  const db = await getDb();
  const transaction = db.transaction(EPISODES_STORE, 'readonly');
  const store = transaction.objectStore(EPISODES_STORE);
  // We need an index on seriesDbId that we can iterate through
  // and then filter by playlistDbId client-side, or a compound index.
  // Let's assume 'seriesDbId_season_episode_idx' can be used, or just 'seriesDbId_idx'
  const index = store.index('seriesDbId_idx'); 

  const allMatchingEpisodes: EpisodeItem[] = [];

  return new Promise((resolve, reject) => {
    const request = index.openCursor(IDBKeyRange.only(seriesDbId));
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const episode = cursor.value as EpisodeItem;
        // Filter by active playlists
        if (activePlaylistIds.includes(episode.playlistDbId)) {
          allMatchingEpisodes.push(episode);
        }
        cursor.continue();
      } else {
        // Sort episodes once all are collected
        allMatchingEpisodes.sort((a, b) => {
          const seasonCompare = (a.seasonNumber ?? Infinity) - (b.seasonNumber ?? Infinity);
          if (seasonCompare !== 0) return seasonCompare;
          return (a.episodeNumber ?? Infinity) - (b.episodeNumber ?? Infinity);
        });
        resolve(allMatchingEpisodes);
      }
    };
    request.onerror = () => {
      console.error(`Error fetching episodes for seriesDbId ${seriesDbId}:`, request.error);
      reject(request.error);
    };
  });
}


export async function getChannelItemsByBaseNameAcrossPlaylists(
  baseChannelName: string,
  activePlaylistIds: string[]
): Promise<ChannelItem[]> {
  if (activePlaylistIds.length === 0) return [];
  const db = await getDb();
  const transaction = db.transaction(CHANNELS_STORE, 'readonly');
  const store = transaction.objectStore(CHANNELS_STORE);
  const index = store.index('playlist_baseChannelName_idx'); 

  const allMatchingChannels: ChannelItem[] = [];

  const promises = activePlaylistIds.map(playlistDbId => {
    return new Promise<void>((resolvePlaylist, rejectPlaylist) => {
      const keyRange = IDBKeyRange.only([playlistDbId, baseChannelName]);
      const request = index.openCursor(keyRange);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          allMatchingChannels.push(cursor.value as ChannelItem);
          cursor.continue();
        } else {
          resolvePlaylist(); 
        }
      };
      request.onerror = () => {
        console.error(`Error fetching channels for ${baseChannelName} in playlist ${playlistDbId}:`, request.error);
        rejectPlaylist(request.error);
      };
    });
  });

  await Promise.all(promises);
  return allMatchingChannels;
}
