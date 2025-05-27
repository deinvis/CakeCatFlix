

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
import { normalizeText } from '@/lib/utils'; // Import normalizeText
import { normalizeGroupTitle as m3uNormalizeGroupTitle } from '@/lib/m3u-parser';


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
          { name: 'groupTitle_idx', keyPath: 'groupTitle' }, // This stores the normalized group title
          { name: 'playlist_groupTitle_idx', keyPath: ['playlistDbId', 'groupTitle'] },
        ]);

        ensureStoreAndIndices(MOVIES_STORE, 'id', [
          { name: 'playlistDbId_idx', keyPath: 'playlistDbId' },
          { name: 'genre_idx', keyPath: 'genre' }, // This stores the normalized genre
          { name: 'year_idx', keyPath: 'year' },
          { name: 'title_idx', keyPath: 'title'},
          { name: 'playlist_genre_idx', keyPath: ['playlistDbId', 'genre'] },
          { name: 'playlist_title_year_idx', keyPath: ['playlistDbId', 'title', 'year'] },
        ]);
        
        ensureStoreAndIndices(SERIES_STORE, 'id', [
          { name: 'playlistDbId_idx', keyPath: 'playlistDbId' },
          { name: 'title_idx', keyPath: 'title' },
          { name: 'genre_idx', keyPath: 'genre' }, // This stores the normalized genre
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

         if (oldVersion < 5) { // Assuming current DB_VERSION is 5 or higher
            const moviesStoreTransaction = (event.target as IDBOpenDBRequest).transaction;
            if (moviesStoreTransaction) {
                const moviesStore = moviesStoreTransaction.objectStore(MOVIES_STORE);
                if (!moviesStore.indexNames.contains('year_idx')) {
                    console.log("DB: Creating index year_idx on movies");
                    moviesStore.createIndex('year_idx', 'year');
                }
                if (!moviesStore.indexNames.contains('playlist_title_year_idx')) {
                     console.log("DB: Creating index playlist_title_year_idx on movies");
                    moviesStore.createIndex('playlist_title_year_idx', ['playlistDbId', 'title', 'year']);
                }
            }
            const episodesStoreTransaction = (event.target as IDBOpenDBRequest).transaction;
            if (episodesStoreTransaction) {
                const episodesStore = episodesStoreTransaction.objectStore(EPISODES_STORE);
                 if (!episodesStore.indexNames.contains('seriesDbId_season_episode_idx')) {
                    console.log("DB: Creating index seriesDbId_season_episode_idx on episodes");
                    episodesStore.createIndex('seriesDbId_season_episode_idx', ['seriesDbId', 'seasonNumber', 'episodeNumber']);
                }
                 if (!episodesStore.indexNames.contains('seriesDbId_idx')) { // Ensure this basic index exists
                    console.log("DB: Creating index seriesDbId_idx on episodes");
                    episodesStore.createIndex('seriesDbId_idx', 'seriesDbId');
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
      console.log("DB: addPlaylistWithItems transaction completed.");
      resolve();
    };
    
    // First pass: identify and prepare unique series for addition
    for (const item of items) {
        if (item.itemType === 'series_episode' && item.seriesTitle) {
             // Normalize seriesTitle for consistent keying if needed, but here we use original from parser
            const seriesKey = item.seriesTitle; 
            if (!uniqueSeriesInPlaylist.has(seriesKey)) {
                const seriesEntry: SeriesItem = {
                    playlistDbId: metadata.id,
                    title: item.seriesTitle, // This is the clean series title from the parser
                    logoUrl: item.logoUrl,    // Use first episode's logo as potential series logo
                    groupTitle: item.groupTitle, // This is the normalized groupTitle from parser
                    originalGroupTitle: item.originalGroupTitle,
                    tvgId: item.tvgId, // If M3U item has a series-level tvg-id
                    genre: item.groupTitle,    // Genre for series is its normalized group title
                    year: item.year,          // Year for series if available
                };
                uniqueSeriesInPlaylist.set(seriesKey, { item: seriesEntry });
            } else {
                // Potentially update existing series entry if a "better" logo or more info is found
                const existingSeriesData = uniqueSeriesInPlaylist.get(seriesKey)!;
                if (item.logoUrl && (!existingSeriesData.item.logoUrl || (item.seasonNumber === 1 && item.episodeNumber === 1))) {
                    existingSeriesData.item.logoUrl = item.logoUrl;
                }
                if (item.groupTitle && !existingSeriesData.item.groupTitle) existingSeriesData.item.groupTitle = item.groupTitle;
                 if (item.year && !existingSeriesData.item.year) existingSeriesData.item.year = item.year;
            }
        }
    }

    // Add unique series to SERIES_STORE and get their DB IDs
    const seriesAddPromises = Array.from(uniqueSeriesInPlaylist.values()).map(seriesData =>
        new Promise<void>((res, rej) => {
            const addSeriesRequest = seriesStore.add(seriesData.item);
            addSeriesRequest.onsuccess = (event) => {
                seriesData.id = (event.target as IDBRequest).result as number; // Store the generated ID
                res();
            };
            addSeriesRequest.onerror = () => {
                console.error("DB Error adding series:", addSeriesRequest.error, "Item:", seriesData.item);
                rej(addSeriesRequest.error);
            };
        })
    );

    try {
        await Promise.all(seriesAddPromises);
        console.log("DB: All unique series processed and IDs obtained.");
    } catch (error) {
        console.error("DB Error batch adding series items:", error);
        if (transaction.error === null && transaction.idbRequest && transaction.idbRequest.readyState !== 'done') {
            console.log("DB: Aborting transaction due to series add error.");
            transaction.abort();
        }
        reject(error);
        return;
    }

    // Second pass: add channels, movies, and episodes (now with seriesDbId)
    const itemAddOperations: Promise<void>[] = items.map(item => new Promise<void>((resItem, rejItem) => {
        item.playlistDbId = metadata.id; // Ensure playlistDbId is set
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
                genre: item.groupTitle, year: item.year, // Movie genre is its normalized group title
            };
            request = movieStore.add(movie);
            request.onsuccess = () => { movieCount++; resItem(); };
        } else if (item.itemType === 'series_episode') {
            if (!item.seriesTitle) { 
                console.warn("DB: Series episode missing seriesTitle, skipping:", item); 
                resItem(); return; 
            }
            const seriesData = uniqueSeriesInPlaylist.get(item.seriesTitle);
            if (!seriesData || seriesData.id === undefined) {
                console.error(`DB: Series ID not found for "${item.seriesTitle}" in map, skipping episode.`);
                resItem(); return;
            }
            const episode: EpisodeItem = {
                playlistDbId: item.playlistDbId,
                seriesDbId: seriesData.id,
                title: item.title, // This is the episode-specific title from parser
                streamUrl: item.streamUrl, logoUrl: item.logoUrl,
                seasonNumber: item.seasonNumber, episodeNumber: item.episodeNumber,
                tvgId: item.tvgId, // Episode-specific tvg-id
            };
            request = episodeStore.add(episode);
            request.onsuccess = () => { episodeCount++; resItem(); };
        } else {
            console.warn("DB: Unknown item type in addPlaylistWithItems:", item.itemType, item);
            resItem(); 
            return;
        }
        request.onerror = (e) => {
            console.error("DB: Error adding item:", request.error, "Item:", item);
            rejItem(request.error);
        };
    }));
    
    try {
      await Promise.all(itemAddOperations);
      console.log("DB: All channel/movie/episode items processed.");
      
      metadata.itemCount = items.length; // This remains the total raw items processed
      metadata.channelCount = channelCount;
      metadata.movieCount = movieCount;
      metadata.seriesCount = uniqueSeriesInPlaylist.size; // Count of unique series
      metadata.episodeCount = episodeCount; // Count of individual episodes
      metadata.status = 'completed';
      metadata.lastUpdatedAt = Date.now();
      metadata.lastSuccessfulUpdateAt = Date.now();

      const metaRequest = metadataStore.put(metadata);
      metaRequest.onsuccess = () => {
        console.log("DB: Playlist metadata updated successfully.");
      }
      metaRequest.onerror = () => {
          console.error("DB: Error updating playlist metadata after items processed:", metaRequest.error);
          // Don't reject the main promise here, as items are already added. Log and proceed.
      };

    } catch (error) {
        console.error("DB: Error batch adding channel/movie/episode items:", error);
        if (transaction.error === null && transaction.idbRequest && transaction.idbRequest.readyState !== 'done') {
            console.log("DB: Aborting transaction due to item add error.");
            transaction.abort();
        }
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

    // Helper to delete items from a store by playlistDbId
    const deleteFromStore = (store: IDBObjectStore, storeName: string) => {
      const index = store.index('playlistDbId_idx');
      const cursorRequest = index.openCursor(IDBKeyRange.only(playlistId));
      cursorRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
              store.delete(cursor.primaryKey).onerror = (e) => {
                  console.error(`Failed to delete item ${cursor.primaryKey} from ${storeName}:`, (e.target as IDBRequest).error);
              };
              cursor.continue();
          }
      };
      cursorRequest.onerror = (event) => {
          console.error(`Error opening cursor for ${storeName} to delete items:`, (event.target as IDBRequest).error);
      };
    };
    
    // Delete series first, then episodes or vice-versa depending on FKs if they were enforced.
    // Here, it's simpler: just delete all items belonging to the playlistId.
    // However, for series, we might need to delete episodes linked to series from this playlist.
    // For simplicity now, just clearing by playlistDbId. A more thorough cleanup would involve cascading.
    const seriesIndex = seriesStore.index('playlistDbId_idx');
    const seriesCursorRequest = seriesIndex.openCursor(IDBKeyRange.only(playlistId));
    seriesCursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
            const seriesItem = cursor.value as SeriesItem;
            if (seriesItem.id !== undefined) {
                // Delete episodes linked to this series
                const episodeIndex = episodeStore.index('seriesDbId_idx');
                const episodeCursorRequest = episodeIndex.openCursor(IDBKeyRange.only(seriesItem.id));
                episodeCursorRequest.onsuccess = (epEvent) => {
                    const epCursor = (epEvent.target as IDBRequest<IDBCursorWithValue>).result;
                    if (epCursor) {
                        // Check if this episode also belongs to the playlist being deleted
                        if (epCursor.value.playlistDbId === playlistId) {
                           episodeStore.delete(epCursor.primaryKey);
                        }
                        epCursor.continue();
                    }
                };
            }
            seriesStore.delete(cursor.primaryKey); // Delete the series item itself
            cursor.continue();
        }
    };
    seriesCursorRequest.onerror = (event) => {
        console.error(`Error deleting series for playlist ${playlistId}:`, (event.target as IDBRequest).error);
    };


    deleteFromStore(channelStore, CHANNELS_STORE);
    deleteFromStore(movieStore, MOVIES_STORE);
    // Episodes related to series from this playlist were handled above.
    // We might still have episodes if a series was in multiple playlists and only one is deleted.
    // So, a final pass on episodes by playlistDbId is good.
    deleteFromStore(episodeStore, EPISODES_STORE);


    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
        console.error("Transaction error for deleting playlist and items:", transaction.error);
        reject(transaction.error || "Transaction failed for deleting playlist and items.");
    }
  });
}


export async function getPlaylistItems(
  playlistDbId: string,
  itemType: 'channel' | 'movie' | 'series' | 'episode', // Added 'episode'
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
      let advanced = false; // Flag to indicate if cursor.advance has been used
      let itemsAdded = 0;
      
      const cursorRequest = index.openCursor(range);

      cursorRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
              if (offset > 0 && !advanced) {
                  advanced = true; 
                  cursor.advance(offset);
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
  groupTitle: string, // This should be the NORMALIZED group title for querying
  itemType: 'movie' | 'series' | 'channel',
  limit?: number,
  offset: number = 0
): Promise<any[]> {
    const db = await getDb();
    let storeName: string;
    let indexName: string;
    let keyRangeValue: IDBKeyRange;


    switch(itemType) {
        case 'movie':
            storeName = MOVIES_STORE;
            indexName = 'playlist_genre_idx'; // Assumes genre in MovieItem is normalized
            keyRangeValue = IDBKeyRange.only([playlistDbId, groupTitle]);
            break;
        case 'series':
            storeName = SERIES_STORE;
            indexName = 'playlist_genre_idx'; // Assumes genre in SeriesItem is normalized
            keyRangeValue = IDBKeyRange.only([playlistDbId, groupTitle]);
            break;
        case 'channel':
            storeName = CHANNELS_STORE;
            indexName = 'playlist_groupTitle_idx'; // Assumes groupTitle in ChannelItem is normalized
            keyRangeValue = IDBKeyRange.only([playlistDbId, groupTitle]);
            break;
        default:
            console.error("Invalid itemType for getPlaylistItemsByGroup:", itemType);
            return Promise.reject(new Error("Invalid itemType for getPlaylistItemsByGroup."));
    }
    // console.log(`DB: getPlaylistItemsByGroup for ${itemType} in playlist ${playlistDbId}, group "${groupTitle}"`);

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);

        const items: any[] = [];
        let advanced = false;
        let itemsAdded = 0;

        const cursorRequest = index.openCursor(keyRangeValue);
        cursorRequest.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                if (offset > 0 && !advanced) {
                  advanced = true;
                  cursor.advance(offset);
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
                // console.log(`DB: Found ${items.length} items for group "${groupTitle}" in ${itemType}`);
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

// This function should return NORMALIZED group titles for linking and querying
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
      fieldToCollect = 'genre'; // genre in MovieItem is already normalized
      break;
    case 'series':
      storeName = SERIES_STORE;
      fieldToCollect = 'genre'; // genre in SeriesItem is already normalized
      break;
    case 'channel':
      storeName = CHANNELS_STORE;
      fieldToCollect = 'groupTitle'; // groupTitle in ChannelItem is already normalized
      break;
    default:
      return Promise.resolve([]);
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index('playlistDbId_idx'); // Query by playlist first
    const range = IDBKeyRange.only(playlistDbId);

    const uniqueNormalizedGroups = new Set<string>();
    const request = index.openCursor(range);

    request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
            const item = cursor.value as MovieItem | SeriesItem | ChannelItem;
            const groupValue = item[fieldToCollect as keyof typeof item] as string | undefined;
            if (groupValue) {
                // The value in the DB (genre for movies/series, groupTitle for channels)
                // is ALREADY normalized by the m3u-parser.
                uniqueNormalizedGroups.add(groupValue);
            }
            cursor.continue();
        } else {
            const sortedNormalizedGroups = Array.from(uniqueNormalizedGroups)
                                             .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
            resolve(sortedNormalizedGroups);
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
            // Query needs to be flexible: if year is undefined, query for any year.
            // This index expects [playlistDbId, title, year].
            // If year is part of the query, IDBKeyRange.only([playlistDbId, title, year]) is fine.
            // If year is not part of the query, we need to range over years for a given title.
            let keyRange;
            if (year !== undefined) {
                keyRange = IDBKeyRange.only([playlistDbId, title, year]);
            } else {
                // If year is not specified, get all movies with that title from the playlist
                keyRange = IDBKeyRange.bound([playlistDbId, title, -Infinity], [playlistDbId, title, Infinity]);
            }
            
            const request = index.getAll(keyRange); // getAll is simpler here than cursoring
            
            request.onsuccess = (event) => {
                const moviesInPlaylist = (event.target as IDBRequest).result as MovieItem[];
                // The index query should already handle title and year matching if year is provided.
                // If year was undefined, moviesInPlaylist contains all years for that title.
                allMatchingMovies.push(...moviesInPlaylist);
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
            console.warn("DB: Invalid series ID format for DB lookup (NaN):", id)
            return reject(new Error("Invalid series ID format for DB lookup."));
        }
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result as SeriesItem | undefined);
        request.onerror = () => reject(request.error);
    });
}


export async function getEpisodesForSeriesAcrossPlaylists(
  seriesDbId: number, 
  activePlaylistIds: string[]
): Promise<EpisodeItem[]> {
  if (activePlaylistIds.length === 0) return [];
  const db = await getDb();
  const transaction = db.transaction(EPISODES_STORE, 'readonly');
  const store = transaction.objectStore(EPISODES_STORE);
  // Using 'seriesDbId_season_episode_idx' will fetch sorted episodes for a given series.
  // We then filter by activePlaylistIds client-side.
  const index = store.index('seriesDbId_season_episode_idx'); 

  const allMatchingEpisodes: EpisodeItem[] = [];
  // Range to get all episodes for the seriesDbId, across all seasons/episodes
  const keyRange = IDBKeyRange.bound([seriesDbId, -Infinity, -Infinity], [seriesDbId, Infinity, Infinity]);


  return new Promise((resolve, reject) => {
    const request = index.openCursor(keyRange);
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
        // Episodes are already sorted by the index (season, then episode number)
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
  // We need to iterate over playlists and then query by baseChannelName
  // or iterate all channels and filter. The latter is simpler if baseChannelName is not part of a compound index with playlistId first.
  // The 'playlist_baseChannelName_idx' index is ['playlistDbId', 'baseChannelName'].
  
  const allMatchingChannels: ChannelItem[] = [];

  const promises = activePlaylistIds.map(playlistDbId => {
    return new Promise<void>((resolvePlaylist, rejectPlaylist) => {
      const index = store.index('playlist_baseChannelName_idx');
      const keyRange = IDBKeyRange.only([playlistDbId, baseChannelName]);
      const request = index.getAll(keyRange); // getAll is efficient for specific keys
      
      request.onsuccess = (event) => {
        const channelsInPlaylist = (event.target as IDBRequest).result as ChannelItem[];
        allMatchingChannels.push(...channelsInPlaylist);
        resolvePlaylist(); 
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
