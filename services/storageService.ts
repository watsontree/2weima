
/**
 * IndexedDB Service for persisting library items (images/dataUrls).
 */
const DB_NAME = 'MarketingGenDB';
const DB_VERSION = 1;
const STORE_NAME = 'AssetsStore';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const storageService = {
  saveAssets: async (libId: string, assets: any[]) => {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    assets.forEach(asset => store.put({ ...asset, libId }));
    return new Promise((resolve) => tx.oncomplete = resolve);
  },
  loadAssets: async (libId: string): Promise<any[]> => {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    return new Promise((resolve) => {
      request.onsuccess = () => {
        resolve(request.result.filter((item: any) => item.libId === libId));
      };
    });
  },
  deleteAsset: async (id: string) => {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    return new Promise((resolve) => tx.oncomplete = resolve);
  }
};
