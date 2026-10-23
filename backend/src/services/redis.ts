const cacheStore = new Map<string, { value: any; expiresAt: number }>();
const MAX_CACHE_CAPACITY = 5000;

let pruneInterval: NodeJS.Timeout | null = null;

export class RedisCacheService {
  /**
   * Proactively prunes all expired cache keys from memory
   */
  static pruneExpiredKeys(): number {
    const now = Date.now();
    let deletedCount = 0;
    for (const [key, item] of cacheStore.entries()) {
      if (item.expiresAt < now) {
        cacheStore.delete(key);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  static async getCache<T>(key: string): Promise<T | null> {
    const item = cacheStore.get(key);
    if (!item) return null;
    if (item.expiresAt < Date.now()) {
      cacheStore.delete(key);
      return null;
    }
    return item.value as T;
  }

  static async setCache(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    // Enforce maximum capacity bound to prevent heap memory exhaustion
    if (cacheStore.size >= MAX_CACHE_CAPACITY && !cacheStore.has(key)) {
      const oldestKey = cacheStore.keys().next().value;
      if (oldestKey) cacheStore.delete(oldestKey);
    }

    cacheStore.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });

    // Start background pruner if not already active (unref keeps it from blocking process exit)
    if (!pruneInterval) {
      pruneInterval = setInterval(() => {
        RedisCacheService.pruneExpiredKeys();
      }, 60000);
      pruneInterval.unref?.();
    }
  }

  static async invalidateCache(key: string): Promise<void> {
    cacheStore.delete(key);
  }

  static clear(): void {
    cacheStore.clear();
  }

  static size(): number {
    return cacheStore.size;
  }

  static stopPruning(): void {
    if (pruneInterval) {
      clearInterval(pruneInterval);
      pruneInterval = null;
    }
  }
}
