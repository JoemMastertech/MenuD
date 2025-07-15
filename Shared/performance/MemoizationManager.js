// Memoization Manager - Performance Optimization Module

import { logError, logWarning } from '../utils/errorHandler.js';
import { DEBUG, PERFORMANCE } from '../config/constants.js';

class CacheNode {
  constructor(key, value, ttl = null) {
    this.key = key;
    this.value = value;
    this.timestamp = Date.now();
    this.ttl = ttl;
    this.accessCount = 1;
    this.prev = null;
    this.next = null;
  }

  isExpired() {
    if (!this.ttl) return false;
    return Date.now() - this.timestamp > this.ttl;
  }

  updateAccess() {
    this.accessCount++;
    this.timestamp = Date.now();
  }
}

class LRUCache {
  constructor(maxSize = 100, defaultTTL = null) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.cache = new Map();
    this.head = new CacheNode('head', null);
    this.tail = new CacheNode('tail', null);
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0
    };
  }

  get(key) {
    const node = this.cache.get(key);
    
    if (!node) {
      this.stats.misses++;
      return null;
    }
    
    if (node.isExpired()) {
      this.delete(key);
      this.stats.expirations++;
      this.stats.misses++;
      return null;
    }
    
    // Move to head (most recently used)
    this.moveToHead(node);
    node.updateAccess();
    this.stats.hits++;
    
    return node.value;
  }

  set(key, value, ttl = null) {
    const existingNode = this.cache.get(key);
    
    if (existingNode) {
      // Update existing node
      existingNode.value = value;
      existingNode.timestamp = Date.now();
      existingNode.ttl = ttl || this.defaultTTL;
      this.moveToHead(existingNode);
      return;
    }
    
    // Create new node
    const newNode = new CacheNode(key, value, ttl || this.defaultTTL);
    
    // Check capacity
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    
    // Add to cache
    this.cache.set(key, newNode);
    this.addToHead(newNode);
  }

  delete(key) {
    const node = this.cache.get(key);
    if (node) {
      this.cache.delete(key);
      this.removeNode(node);
      return true;
    }
    return false;
  }

  clear() {
    this.cache.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0
    };
  }

  size() {
    return this.cache.size;
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? (this.stats.hits / total * 100).toFixed(2) + '%' : '0%',
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }

  // Private methods
  moveToHead(node) {
    this.removeNode(node);
    this.addToHead(node);
  }

  addToHead(node) {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next.prev = node;
    this.head.next = node;
  }

  removeNode(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  evictLRU() {
    const lru = this.tail.prev;
    if (lru !== this.head) {
      this.cache.delete(lru.key);
      this.removeNode(lru);
      this.stats.evictions++;
    }
  }

  cleanupExpired() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, node] of this.cache) {
      if (node.isExpired()) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => {
      this.delete(key);
      this.stats.expirations++;
    });
    
    return expiredKeys.length;
  }
}

export class MemoizationManager {
  constructor(options = {}) {
    this.config = {
      defaultCacheSize: 100,
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      cleanupInterval: 60 * 1000, // 1 minute
      maxMemoryUsage: 50 * 1024 * 1024, // 50MB
      enableStats: true,
      ...options
    };
    
    this.caches = new Map();
    this.memoizedFunctions = new Map();
    this.globalStats = {
      totalCaches: 0,
      totalMemoryUsage: 0,
      totalOperations: 0
    };
    
    this.isDebugMode = DEBUG.ENABLE_CONSOLE_LOGS;
    this.cleanupTimer = null;
    
    this.startCleanupTimer();
  }

  memoize(key, fn, options = {}) {
    try {
      // Validate inputs
      if (typeof key !== 'string') {
        throw new Error('Cache key must be a string');
      }
      if (typeof fn !== 'function') {
        throw new Error('Second parameter must be a function');
      }
      
      const config = {
        key,
        maxSize: this.config.defaultCacheSize,
        ttl: this.config.defaultTTL,
        keyGenerator: this.defaultKeyGenerator,
        serializer: this.defaultSerializer,
        ...options
      };
      
      // Create cache for this function if it doesn't exist
      if (!this.caches.has(config.key)) {
        this.caches.set(config.key, new LRUCache(config.maxSize, config.ttl));
        this.globalStats.totalCaches++;
      }
      
      const cache = this.caches.get(config.key);
      
      // Create memoized function
      const memoizedFn = (...args) => {
        try {
          // Generate cache key
          const cacheKey = config.keyGenerator(args, config.serializer);
          
          // Try to get from cache
          const cachedResult = cache.get(cacheKey);
          if (cachedResult !== null) {
            if (this.isDebugMode) {
              console.log(`💾 Cache hit: ${config.key}/${cacheKey}`);
            }
            return cachedResult;
          }
          
          // Execute function and cache result
          const result = fn.apply(this, args);
          cache.set(cacheKey, result, config.ttl);
          
          this.globalStats.totalOperations++;
          
          if (this.isDebugMode) {
            console.log(`💾 Cache miss: ${config.key}/${cacheKey}`);
          }
          
          return result;
        } catch (error) {
          logError(`Error in memoized function "${config.key}"`, error);
          // Return original function result on error
          return fn.apply(this, args);
        }
      };
      
      // Add metadata to memoized function
      memoizedFn.cache = cache;
      memoizedFn.originalFunction = fn;
      memoizedFn.cacheKey = config.key;
      memoizedFn.clearCache = () => this.clearCache(config.key);
      memoizedFn.getStats = () => this.getCacheStats(config.key);
      
      // Register memoized function
      this.memoizedFunctions.set(config.key, memoizedFn);
      
      if (this.isDebugMode) {
        console.log(`💾 Function memoized: ${config.key}`);
      }
      
      return memoizedFn;
    } catch (error) {
      logError('Error creating memoized function', error);
      return fn; // Return original function on error
    }
  }

  cache(cacheKey, key, value, options = {}) {
    try {
      if (!this.caches.has(cacheKey)) {
        this.caches.set(cacheKey, new LRUCache(
          this.config.defaultCacheSize,
          this.config.defaultTTL
        ));
        this.globalStats.totalCaches++;
      }
      
      const cache = this.caches.get(cacheKey);
      cache.set(key, value, options.ttl);
      
      if (this.isDebugMode) {
        console.log(`💾 Value cached: ${cacheKey}/${key}`);
      }
      
      return true;
    } catch (error) {
      logError(`Error caching value: ${cacheKey}/${key}`, error);
      return false;
    }
  }

  get(cacheKey, key) {
    try {
      if (!this.caches.has(cacheKey)) {
        return null;
      }
      
      const cache = this.caches.get(cacheKey);
      return cache.get(key);
    } catch (error) {
      logError(`Error retrieving cached value: ${cacheKey}/${key}`, error);
      return null;
    }
  }

  remove(cacheKey, key) {
    try {
      if (!this.caches.has(cacheKey)) {
        return false;
      }
      
      const cache = this.caches.get(cacheKey);
      return cache.delete(key);
    } catch (error) {
      logError(`Error removing cached value: ${cacheKey}/${key}`, error);
      return false;
    }
  }

  clearCache(cacheKey) {
    try {
      if (!this.caches.has(cacheKey)) {
        return false;
      }
      
      const cache = this.caches.get(cacheKey);
      cache.clear();
      
      if (this.isDebugMode) {
        console.log(`💾 Cache cleared: ${cacheKey}`);
      }
      
      return true;
    } catch (error) {
      logError(`Error clearing cache: ${cacheKey}`, error);
      return false;
    }
  }

  clearAllCaches() {
    try {
      for (const [key, cache] of this.caches) {
        cache.clear();
      }
      
      this.globalStats = {
        totalCaches: this.caches.size,
        totalMemoryUsage: 0,
        totalOperations: 0
      };
      
      if (this.isDebugMode) {
        console.log('💾 All caches cleared');
      }
    } catch (error) {
      logError('Error clearing all caches', error);
    }
  }

  getCacheStats(cacheKey) {
    try {
      if (!this.caches.has(cacheKey)) {
        return null;
      }
      
      const cache = this.caches.get(cacheKey);
      return {
        cacheKey,
        ...cache.getStats(),
        memoryUsage: this.estimateMemoryUsage(cache)
      };
    } catch (error) {
      logError(`Error getting cache stats: ${cacheKey}`, error);
      return null;
    }
  }

  getGlobalStats() {
    try {
      const cacheStats = [];
      let totalHits = 0;
      let totalMisses = 0;
      let totalMemoryUsage = 0;
      
      for (const [key, cache] of this.caches) {
        const stats = cache.getStats();
        totalHits += stats.hits;
        totalMisses += stats.misses;
        totalMemoryUsage += this.estimateMemoryUsage(cache);
        
        cacheStats.push({
          cacheKey: key,
          ...stats
        });
      }
      
      const totalOperations = totalHits + totalMisses;
      
      return {
        ...this.globalStats,
        totalHits,
        totalMisses,
        totalOperations,
        globalHitRate: totalOperations > 0 ? 
          (totalHits / totalOperations * 100).toFixed(2) + '%' : '0%',
        totalMemoryUsage,
        caches: cacheStats
      };
    } catch (error) {
      logError('Error getting global stats', error);
      return this.globalStats;
    }
  }

  cleanup() {
    try {
      let totalExpired = 0;
      const cleanupResults = [];
      
      for (const [key, cache] of this.caches) {
        const expired = cache.cleanupExpired();
        totalExpired += expired;
        
        if (expired > 0) {
          cleanupResults.push({ cacheKey: key, expiredItems: expired });
        }
      }
      
      if (this.isDebugMode && totalExpired > 0) {
        console.log(`💾 Cleanup completed: ${totalExpired} expired items removed`);
      }
      
      return {
        totalExpired,
        caches: cleanupResults
      };
    } catch (error) {
      logError('Error during cleanup', error);
      return { totalExpired: 0, caches: [] };
    }
  }

  destroy() {
    try {
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }
      
      this.clearAllCaches();
      this.caches.clear();
      this.memoizedFunctions.clear();
      
      if (this.isDebugMode) {
        console.log('💾 Memoization manager destroyed');
      }
    } catch (error) {
      logError('Error destroying memoization manager', error);
    }
  }

  // Private methods

  defaultKeyGenerator(args, serializer) {
    try {
      return serializer(args);
    } catch (error) {
      // Fallback to simple string conversion
      return args.map(arg => String(arg)).join('|');
    }
  }

  defaultSerializer(args) {
    try {
      return JSON.stringify(args);
    } catch (error) {
      // Handle circular references and non-serializable objects
      return args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          try {
            return JSON.stringify(arg);
          } catch {
            return Object.prototype.toString.call(arg);
          }
        }
        return String(arg);
      }).join('|');
    }
  }

  estimateMemoryUsage(cache) {
    try {
      let size = 0;
      
      for (const [key, node] of cache.cache) {
        // Rough estimation
        size += key.length * 2; // UTF-16 characters
        size += this.estimateObjectSize(node.value);
        size += 100; // Node overhead
      }
      
      return size;
    } catch (error) {
      return 0;
    }
  }

  estimateObjectSize(obj) {
    try {
      if (obj === null || obj === undefined) return 0;
      
      if (typeof obj === 'string') {
        return obj.length * 2;
      }
      
      if (typeof obj === 'number') {
        return 8;
      }
      
      if (typeof obj === 'boolean') {
        return 4;
      }
      
      if (typeof obj === 'object') {
        return JSON.stringify(obj).length * 2;
      }
      
      return 0;
    } catch (error) {
      return 0;
    }
  }

  startCleanupTimer() {
    if (this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, this.config.cleanupInterval);
    }
  }
}

// Create global memoization manager instance
const globalMemoizationManager = new MemoizationManager();

// Export convenience functions
export const memoize = globalMemoizationManager.memoize.bind(globalMemoizationManager);
export const cache = globalMemoizationManager.cache.bind(globalMemoizationManager);
export const get = globalMemoizationManager.get.bind(globalMemoizationManager);
export const remove = globalMemoizationManager.remove.bind(globalMemoizationManager);
export const clearCache = globalMemoizationManager.clearCache.bind(globalMemoizationManager);
export const clearAllCaches = globalMemoizationManager.clearAllCaches.bind(globalMemoizationManager);
export const getCacheStats = globalMemoizationManager.getCacheStats.bind(globalMemoizationManager);
export const getGlobalStats = globalMemoizationManager.getGlobalStats.bind(globalMemoizationManager);
export const cleanup = globalMemoizationManager.cleanup.bind(globalMemoizationManager);

// Export the class and instance
export default globalMemoizationManager;