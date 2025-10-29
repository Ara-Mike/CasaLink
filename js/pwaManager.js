// js/pwaManager.js
class PWAManager {
  static deferredPrompt = null;
  static isInstalled = false;

  static init() {
    this.setupInstallPrompt();
    this.setupOfflineDetection();
    this.registerServiceWorker();
    this.checkPWAStatus();
  }

  static setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      this.deferredPrompt = e;
      // Update UI to notify the user they can install the PWA
      this.showInstallPromotion();
    });

    window.addEventListener('appinstalled', () => {
      // Clear the deferredPrompt so it can be garbage collected
      this.deferredPrompt = null;
      this.isInstalled = true;
      this.hideInstallPromotion();
      console.log('PWA was installed');
    });
  }

  static setupOfflineDetection() {
    window.addEventListener('online', () => {
      this.updateOnlineStatus(true);
      this.syncOfflineData();
    });

    window.addEventListener('offline', () => {
      this.updateOnlineStatus(false);
    });

    // Initial status check
    this.updateOnlineStatus(navigator.onLine);
  }

  static async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('ServiceWorker registered successfully:', registration);

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('New service worker found...');
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              this.showUpdateNotification();
            }
          });
        });

      } catch (error) {
        console.error('ServiceWorker registration failed:', error);
      }
    }
  }

  static showInstallPromotion() {
    // Show custom install prompt
    const prompt = document.getElementById('pwaPrompt');
    if (prompt) {
      prompt.style.display = 'block';
    }

    // Also show in-app notification
    if (window.casaLink) {
      window.casaLink.showNotification(
        'Install CasaLink for a better experience!',
        'info'
      );
    }
  }

  static hideInstallPromotion() {
    const prompt = document.getElementById('pwaPrompt');
    if (prompt) {
      prompt.style.display = 'none';
    }
  }

  static async installPWA() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      
      this.deferredPrompt = null;
    }
  }

  static updateOnlineStatus(online) {
    const indicator = document.getElementById('offlineIndicator');
    if (indicator) {
      indicator.style.display = online ? 'none' : 'block';
    }

    // Update app state
    if (window.casaLink) {
      window.casaLink.isOnline = online;
    }

    // Show notification
    if (!online && window.casaLink) {
      window.casaLink.showNotification(
        'You are currently offline. Some features may be limited.',
        'warning'
      );
    }
  }

  static async syncOfflineData() {
    // Sync any data that was stored locally while offline
    console.log('Syncing offline data...');
    
    // This would sync pending maintenance requests, payments, etc.
    const pendingActions = JSON.parse(localStorage.getItem('pendingActions') || '[]');
    
    for (const action of pendingActions) {
      try {
        // Process each pending action
        await this.processPendingAction(action);
      } catch (error) {
        console.error('Failed to sync action:', action, error);
      }
    }
    
    // Clear processed actions
    localStorage.setItem('pendingActions', '[]');
  }

  static storeOfflineAction(action) {
    const pendingActions = JSON.parse(localStorage.getItem('pendingActions') || '[]');
    pendingActions.push({
      ...action,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('pendingActions', JSON.stringify(pendingActions));
  }

  static checkPWAStatus() {
    // Check if app is running in standalone mode
    this.isInstalled = window.matchMedia('(display-mode: standalone)').matches || 
                      window.navigator.standalone ||
                      document.referrer.includes('android-app://');
  }

  static showUpdateNotification() {
    if (window.casaLink) {
      const updateNotification = `
        <div style="text-align: center;">
          <h3>Update Available</h3>
          <p>A new version of CasaLink is available.</p>
          <button class="btn btn-primary" onclick="location.reload()">Update Now</button>
        </div>
      `;
      
      // You could show this in a modal or notification
      window.casaLink.showNotification('Update available - refresh to get the latest features', 'info');
    }
  }
}