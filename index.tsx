import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Service Worker Registration Handler - FORCIBLY UNREGISTER TO CLEAR CACHE
const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
      console.log('SW: Unregistered old worker');
    }
  });

  // Also clear all caches to ensure fresh load
  if ('caches' in window) {
    caches.keys().then((names) => {
      for (const name of names) {
        caches.delete(name);
        console.log('Cache: Deleted', name);
      }
    });
  }
};

registerServiceWorker();

// @ts-ignore
window.APP_VERSION = "V12.17";

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
