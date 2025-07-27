import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import performanceService from './services/PerformanceService';
import analyticsService from './services/AnalyticsService';

// Initialize services
performanceService.init();
analyticsService.init();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 