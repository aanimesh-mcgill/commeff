class AnalyticsService {
  constructor() {
    this.events = [];
    this.sessionId = this.generateSessionId();
    this.userId = null;
    this.isInitialized = false;
    this.batchSize = 10;
    this.flushInterval = 30000; // 30 seconds
    this.flushTimer = null;
  }

  // Initialize analytics
  init(userId = null) {
    this.userId = userId;
    this.isInitialized = true;
    this.startFlushTimer();
    this.trackEvent('session_start', { sessionId: this.sessionId });
    
    // Track page load performance
    this.trackPerformance();
    
    console.log('AnalyticsService initialized');
  }

  // Generate unique session ID
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Track custom events
  trackEvent(eventName, properties = {}) {
    if (!this.isInitialized) {
      console.warn('Analytics not initialized');
      return;
    }

    const event = {
      eventName,
      properties,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.userId,
      userAgent: navigator.userAgent,
      url: window.location.href,
      referrer: document.referrer
    };

    this.events.push(event);
    console.log('Analytics Event:', event);

    // Flush if batch size reached
    if (this.events.length >= this.batchSize) {
      this.flush();
    }
  }

  // Track page views
  trackPageView(pageName, properties = {}) {
    this.trackEvent('page_view', {
      pageName,
      ...properties
    });
  }

  // Track user interactions
  trackInteraction(elementType, elementId, action, properties = {}) {
    this.trackEvent('user_interaction', {
      elementType,
      elementId,
      action,
      ...properties
    });
  }

  // Track errors
  trackError(error, context = {}) {
    this.trackEvent('error', {
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.name,
      context
    });
  }

  // Track performance metrics
  trackPerformance() {
    if ('performance' in window) {
      const navigation = performance.getEntriesByType('navigation')[0];
      if (navigation) {
        this.trackEvent('performance', {
          loadTime: navigation.loadEventEnd - navigation.loadEventStart,
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          firstPaint: this.getFirstPaint(),
          firstContentfulPaint: this.getFirstContentfulPaint()
        });
      }
    }
  }

  // Get First Paint time
  getFirstPaint() {
    const paintEntries = performance.getEntriesByType('paint');
    const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
    return firstPaint ? firstPaint.startTime : null;
  }

  // Get First Contentful Paint time
  getFirstContentfulPaint() {
    const paintEntries = performance.getEntriesByType('paint');
    const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    return firstContentfulPaint ? firstContentfulPaint.startTime : null;
  }

  // Track presentation events
  trackPresentationEvent(action, properties = {}) {
    this.trackEvent('presentation', {
      action,
      ...properties
    });
  }

  // Track poll events
  trackPollEvent(action, pollId, properties = {}) {
    this.trackEvent('poll', {
      action,
      pollId,
      ...properties
    });
  }

  // Track collaboration events
  trackCollaborationEvent(action, properties = {}) {
    this.trackEvent('collaboration', {
      action,
      ...properties
    });
  }

  // Track course events
  trackCourseEvent(action, courseId, properties = {}) {
    this.trackEvent('course', {
      action,
      courseId,
      ...properties
    });
  }

  // Track user engagement
  trackEngagement(metric, value, properties = {}) {
    this.trackEvent('engagement', {
      metric,
      value,
      ...properties
    });
  }

  // Track feature usage
  trackFeatureUsage(featureName, properties = {}) {
    this.trackEvent('feature_usage', {
      featureName,
      ...properties
    });
  }

  // Flush events to server
  async flush() {
    if (this.events.length === 0) return;

    const eventsToSend = [...this.events];
    this.events = [];

    try {
      // Send to Firebase Analytics or custom endpoint
      await this.sendToServer(eventsToSend);
      console.log(`Analytics flushed ${eventsToSend.length} events`);
    } catch (error) {
      console.error('Failed to flush analytics:', error);
      // Re-add events to queue for retry
      this.events.unshift(...eventsToSend);
    }
  }

  // Send events to server
  async sendToServer(events) {
    // For now, we'll store in localStorage and could send to Firebase
    const analyticsData = {
      events,
      timestamp: new Date().toISOString()
    };

    // Store in localStorage for now
    const existingData = localStorage.getItem('analytics_data') || '[]';
    const allData = JSON.parse(existingData);
    allData.push(analyticsData);
    
    // Keep only last 100 entries to prevent localStorage overflow
    if (allData.length > 100) {
      allData.splice(0, allData.length - 100);
    }
    
    localStorage.setItem('analytics_data', JSON.stringify(allData));

    // TODO: Send to Firebase Analytics or custom endpoint
    // await addDoc(collection(db, 'analytics'), analyticsData);
  }

  // Start periodic flush timer
  startFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  // Stop flush timer
  stopFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  // Get analytics data
  getAnalyticsData() {
    const data = localStorage.getItem('analytics_data');
    return data ? JSON.parse(data) : [];
  }

  // Clear analytics data
  clearAnalyticsData() {
    localStorage.removeItem('analytics_data');
    this.events = [];
  }

  // Generate analytics report
  generateReport() {
    const data = this.getAnalyticsData();
    const report = {
      totalEvents: 0,
      uniqueUsers: new Set(),
      pageViews: {},
      errors: [],
      performance: [],
      featureUsage: {},
      sessionDuration: 0
    };

    data.forEach(batch => {
      batch.events.forEach(event => {
        report.totalEvents++;
        
        if (event.userId) {
          report.uniqueUsers.add(event.userId);
        }

        switch (event.eventName) {
          case 'page_view':
            const pageName = event.properties.pageName;
            report.pageViews[pageName] = (report.pageViews[pageName] || 0) + 1;
            break;
          
          case 'error':
            report.errors.push(event);
            break;
          
          case 'performance':
            report.performance.push(event);
            break;
          
          case 'feature_usage':
            const featureName = event.properties.featureName;
            report.featureUsage[featureName] = (report.featureUsage[featureName] || 0) + 1;
            break;
        }
      });
    });

    report.uniqueUsers = report.uniqueUsers.size;
    
    return report;
  }

  // Track session duration
  trackSessionDuration() {
    const startTime = sessionStorage.getItem('sessionStartTime');
    if (startTime) {
      const duration = Date.now() - parseInt(startTime);
      this.trackEngagement('session_duration', duration);
    }
  }

  // Initialize session tracking
  initSessionTracking() {
    if (!sessionStorage.getItem('sessionStartTime')) {
      sessionStorage.setItem('sessionStartTime', Date.now().toString());
    }

    // Track session end on page unload
    window.addEventListener('beforeunload', () => {
      this.trackSessionDuration();
      this.flush();
    });
  }

  // Track user journey
  trackUserJourney(step, properties = {}) {
    this.trackEvent('user_journey', {
      step,
      stepNumber: this.getJourneyStepNumber(step),
      ...properties
    });
  }

  // Get journey step number
  getJourneyStepNumber(step) {
    const journeySteps = {
      'landing': 1,
      'registration': 2,
      'login': 3,
      'course_browse': 4,
      'course_select': 5,
      'presentation_create': 6,
      'presentation_edit': 7,
      'presentation_deliver': 8,
      'student_join': 9,
      'interaction': 10
    };
    return journeySteps[step] || 0;
  }

  // Track conversion events
  trackConversion(conversionType, value = 1, properties = {}) {
    this.trackEvent('conversion', {
      conversionType,
      value,
      ...properties
    });
  }

  // Cleanup
  cleanup() {
    this.stopFlushTimer();
    this.flush();
  }
}

// Create singleton instance
const analyticsService = new AnalyticsService();

export default analyticsService; 