class PerformanceService {
  constructor() {
    this.cache = new Map();
    this.imageCache = new Map();
    this.debounceTimers = new Map();
    this.intersectionObservers = new Map();
  }

  // Debounce function calls
  debounce(key, func, delay = 300) {
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
    }
    
    const timer = setTimeout(() => {
      func();
      this.debounceTimers.delete(key);
    }, delay);
    
    this.debounceTimers.set(key, timer);
  }

  // Cache data with expiration
  setCache(key, data, expirationMinutes = 5) {
    const expiration = Date.now() + (expirationMinutes * 60 * 1000);
    this.cache.set(key, {
      data,
      expiration
    });
  }

  getCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() > cached.expiration) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  clearCache() {
    this.cache.clear();
  }

  // Image preloading
  preloadImage(src) {
    if (this.imageCache.has(src)) {
      return Promise.resolve(this.imageCache.get(src));
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.imageCache.set(src, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  // Lazy loading for images
  setupLazyLoading(selector = 'img[data-src]') {
    const images = document.querySelectorAll(selector);
    
    if (!images.length) return;

    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.remove('lazy');
          observer.unobserve(img);
        }
      });
    }, {
      rootMargin: '50px 0px',
      threshold: 0.01
    });

    images.forEach(img => imageObserver.observe(img));
    
    return imageObserver;
  }

  // Virtual scrolling for large lists
  createVirtualScroller(container, items, itemHeight, buffer = 5) {
    const visibleItems = Math.ceil(container.clientHeight / itemHeight);
    const totalHeight = items.length * itemHeight;
    
    let scrollTop = 0;
    let startIndex = 0;
    let endIndex = Math.min(startIndex + visibleItems + buffer, items.length);

    const updateVisibleItems = () => {
      const newStartIndex = Math.floor(scrollTop / itemHeight);
      const newEndIndex = Math.min(newStartIndex + visibleItems + buffer, items.length);
      
      if (newStartIndex !== startIndex || newEndIndex !== endIndex) {
        startIndex = newStartIndex;
        endIndex = newEndIndex;
        
        // Update container content
        container.innerHTML = '';
        const fragment = document.createDocumentFragment();
        
        for (let i = startIndex; i < endIndex; i++) {
          const item = items[i];
          const itemElement = document.createElement('div');
          itemElement.style.position = 'absolute';
          itemElement.style.top = `${i * itemHeight}px`;
          itemElement.style.height = `${itemHeight}px`;
          itemElement.style.width = '100%';
          itemElement.textContent = item;
          fragment.appendChild(itemElement);
        }
        
        container.appendChild(fragment);
      }
    };

    container.style.position = 'relative';
    container.style.height = `${totalHeight}px`;
    container.style.overflow = 'auto';
    
    container.addEventListener('scroll', () => {
      scrollTop = container.scrollTop;
      this.debounce('virtual-scroll', updateVisibleItems, 16);
    });

    updateVisibleItems();
  }

  // Memory management
  cleanup() {
    // Clear all timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    
    // Clear intersection observers
    this.intersectionObservers.forEach(observer => observer.disconnect());
    this.intersectionObservers.clear();
    
    // Clear cache
    this.clearCache();
    
    // Clear image cache
    this.imageCache.clear();
  }

  // Performance monitoring
  measurePerformance(name, fn) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    
    console.log(`Performance [${name}]: ${(end - start).toFixed(2)}ms`);
    return result;
  }

  async measureAsyncPerformance(name, fn) {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    
    console.log(`Performance [${name}]: ${(end - start).toFixed(2)}ms`);
    return result;
  }

  // Bundle size optimization helpers
  createChunkLoader(chunkName) {
    return () => import(/* webpackChunkName: "[request]" */ `../pages/${chunkName}`);
  }

  // Service Worker registration for caching
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', registration);
        return registration;
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  // Offline support
  setupOfflineSupport() {
    window.addEventListener('online', () => {
      console.log('Application is online');
      // Sync any pending data
      this.syncPendingData();
    });

    window.addEventListener('offline', () => {
      console.log('Application is offline');
      // Store data locally for later sync
    });
  }

  async syncPendingData() {
    // Implement data synchronization logic here
    const pendingData = localStorage.getItem('pendingData');
    if (pendingData) {
      try {
        const data = JSON.parse(pendingData);
        // Sync with server
        console.log('Syncing pending data:', data);
        localStorage.removeItem('pendingData');
      } catch (error) {
        console.error('Error syncing pending data:', error);
      }
    }
  }

  // Resource hints for faster loading
  addResourceHints() {
    const links = [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true },
      { rel: 'dns-prefetch', href: 'https://firebaseapp.com' },
      { rel: 'dns-prefetch', href: 'https://firestore.googleapis.com' }
    ];

    links.forEach(link => {
      const linkElement = document.createElement('link');
      Object.entries(link).forEach(([key, value]) => {
        linkElement.setAttribute(key, value);
      });
      document.head.appendChild(linkElement);
    });
  }

  // Critical CSS inlining
  inlineCriticalCSS() {
    const criticalCSS = `
      /* Add critical CSS here for above-the-fold content */
      .loading-spinner { display: flex; align-items: center; justify-content: center; }
      .error-boundary { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    `;
    
    const style = document.createElement('style');
    style.textContent = criticalCSS;
    document.head.appendChild(style);
  }

  // Initialize performance optimizations
  init() {
    this.addResourceHints();
    this.inlineCriticalCSS();
    this.setupOfflineSupport();
    this.registerServiceWorker();
    
    // Setup intersection observer for lazy loading
    if ('IntersectionObserver' in window) {
      this.setupLazyLoading();
    }
    
    console.log('PerformanceService initialized');
  }
}

// Create singleton instance
const performanceService = new PerformanceService();

export default performanceService; 