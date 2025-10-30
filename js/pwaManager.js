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
      console.log('beforeinstallprompt event fired');
      
      // Prevent Chrome 76 and later from showing the mini-infobar
      e.preventDefault();
      
      // Stash the event so it can be triggered later
      this.deferredPrompt = e;
      
      // Update UI to notify the user they can install the PWA
      this.showInstallPromotion();
      
      // Optional: Log analytics event
      console.log('PWA install prompt available');
    });

    window.addEventListener('appinstalled', (evt) => {
      console.log('PWA was installed successfully');
      
      // Clear the deferredPrompt so it can be garbage collected
      this.deferredPrompt = null;
      this.isInstalled = true;
      
      // Hide the install promotion
      this.hideInstallPromotion();
      
      // Optional: Log analytics event
      console.log('PWA installed successfully');
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
        // Register from root location
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        console.log('ServiceWorker registered successfully:', registration);

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('New service worker found...');
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('New service worker installed, update available');
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
    // Only show prompt if not already installed and user is engaged
    if (this.isInstalled) {
      console.log('PWA already installed, skipping promotion');
      return;
    }

    // Show custom install prompt after a delay to ensure user engagement
    setTimeout(() => {
      const prompt = document.getElementById('pwaPrompt');
      if (prompt && this.deferredPrompt) {
        console.log('Showing PWA install promotion');
        prompt.style.display = 'block';
        
        // Auto-hide after 15 seconds if not interacted with
        setTimeout(() => {
          if (prompt.style.display === 'block') {
            this.hideInstallPromotion();
          }
        }, 15000);
      }
    }, 3000); // Show after 3 seconds

    // Also show in-app notification
    if (window.casaLink) {
      setTimeout(() => {
        window.casaLink.showNotification(
          'Install CasaLink for a better experience! Click the install button in the bottom left.',
          'info'
        );
      }, 5000);
    }
  }

  static hideInstallPromotion() {
    const prompt = document.getElementById('pwaPrompt');
    if (prompt) {
      prompt.style.display = 'none';
      console.log('PWA install promotion hidden');
    }
  }

  static async installPWA() {
    if (!this.deferredPrompt) {
      console.log('No install prompt available');
      
      // Show message to user
      if (window.casaLink) {
        window.casaLink.showNotification(
          'Installation not available. Try using your browser\'s menu to install.',
          'info'
        );
      }
      return;
    }

    try {
      console.log('Showing install prompt to user');
      
      // Show the install prompt
      this.deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      const { outcome } = await this.deferredPrompt.userChoice;
      
      console.log(`User response to install prompt: ${outcome}`);
      
      if (outcome === 'accepted') {
        console.log('User accepted the PWA installation');
        
        // Show success message
        if (window.casaLink) {
          window.casaLink.showNotification('CasaLink is being installed...', 'success');
        }
      } else {
        console.log('User dismissed the PWA install prompt');
        
        // Show message that they can install later
        if (window.casaLink) {
          window.casaLink.showNotification(
            'You can install CasaLink anytime from your browser menu.',
            'info'
          );
        }
      }
      
      // Clear the deferredPrompt for garbage collection
      this.deferredPrompt = null;
      
      // Hide our custom promotion
      this.hideInstallPromotion();
      
    } catch (error) {
      console.error('Error during PWA installation:', error);
      
      if (window.casaLink) {
        window.casaLink.showNotification('Installation failed. Please try again.', 'error');
      }
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

    // Show notification only when going offline (not on initial load)
    if (!online && window.casaLink) {
      window.casaLink.showNotification(
        'You are currently offline. Some features may be limited.',
        'warning'
      );
    }
  }

  static async syncOfflineData() {
    console.log('Syncing offline data...');
    
    // This would sync pending maintenance requests, payments, etc.
    const pendingActions = JSON.parse(localStorage.getItem('pendingActions') || '[]');
    
    if (pendingActions.length > 0) {
      console.log(`Syncing ${pendingActions.length} pending actions`);
      
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
      
      if (window.casaLink) {
        window.casaLink.showNotification('Offline data synced successfully!', 'success');
      }
    }
  }

  static processPendingAction(action) {
    // This would process different types of pending actions
    console.log('Processing pending action:', action);
    // Implementation would depend on your specific offline actions
    return Promise.resolve();
  }

  static storeOfflineAction(action) {
    const pendingActions = JSON.parse(localStorage.getItem('pendingActions') || '[]');
    pendingActions.push({
      ...action,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('pendingActions', JSON.stringify(pendingActions));
    
    console.log('Stored offline action, total pending:', pendingActions.length);
  }

  static checkPWAStatus() {
    // Check if app is running in standalone mode
    this.isInstalled = window.matchMedia('(display-mode: standalone)').matches || 
                      window.navigator.standalone ||
                      document.referrer.includes('android-app://');
    
    console.log('PWA installation status:', this.isInstalled ? 'Installed' : 'Not installed');
    
    if (this.isInstalled) {
      this.hideInstallPromotion();
    }
  }

  static showUpdateNotification() {
    if (window.casaLink) {
      const updateNotification = `
        <div style="text-align: center; padding: 20px;">
          <h3 style="margin-bottom: 10px;">Update Available</h3>
          <p style="margin-bottom: 15px;">A new version of CasaLink is available with the latest features and improvements.</p>
          <button class="btn btn-primary" onclick="location.reload()" style="margin-right: 10px;">Update Now</button>
          <button class="btn btn-secondary" onclick="PWAManager.hideUpdateNotification()">Later</button>
        </div>
      `;
      
      // Create update notification element
      let updateElement = document.getElementById('pwaUpdateNotification');
      if (!updateElement) {
        updateElement = document.createElement('div');
        updateElement.id = 'pwaUpdateNotification';
        updateElement.className = 'pwa-install-prompt';
        updateElement.style.display = 'block';
        updateElement.innerHTML = updateNotification;
        document.body.appendChild(updateElement);
      }
      
      window.casaLink.showNotification('Update available - new features are ready!', 'info');
    }
  }

  static hideUpdateNotification() {
    const updateElement = document.getElementById('pwaUpdateNotification');
    if (updateElement) {
      updateElement.style.display = 'none';
    }
  }
}

// Make available globally
window.PWAManager = PWAManager;
console.log('PWAManager loaded');