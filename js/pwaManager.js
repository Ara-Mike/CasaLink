// js/pwaManager.js - FIXED VERSION
class PWAManager {
    static deferredPrompt = null;
    static isInstalled = false;

    static init() {
        console.log('🚀 PWA Manager initializing...');
        
        this.setupInstallPrompt();
        this.setupOfflineDetection();
        this.setupUserEngagement(); 
        this.registerServiceWorker();
        this.checkPWAStatus();
        
        // Show install prompt after a short delay if conditions are met
        setTimeout(() => {
            this.showInstallPromptIfEligible();
        }, 3000);
    }

    static setupInstallPrompt() {
      console.log('🔧 Setting up install prompt listeners...');
      
      window.addEventListener('beforeinstallprompt', (e) => {
          console.log('🎯 beforeinstallprompt EVENT FIRED!', {
              platforms: e.platforms,
              canInstall: true
          });

          
          // Stash the event so it can be triggered later
          this.deferredPrompt = e;
          window.deferredPrompt = e; // Global reference for testing
          
          console.log('✅ PWA install prompt is now available');
          
          // Update UI to show install button
          this.updateInstallUI(true);
          
          // Store in session storage for page refreshes
          sessionStorage.setItem('pwa_install_available', 'true');
          
          // Auto-show prompt after user engagement
          setTimeout(() => {
              if (this.deferredPrompt && !this.isInstalled && !this.userDismissedPrompt()) {
                  console.log('🔄 Auto-showing install prompt');
                  this.showPersistentInstallPromotion();
              }
          }, 3000);
      });

      window.addEventListener('appinstalled', (e) => {
          console.log('🎉 PWA was installed successfully');
          this.handleSuccessfulInstallation();
          sessionStorage.removeItem('pwa_install_available');
      });
      
      // Check if we already have install capability from previous page load
      if (sessionStorage.getItem('pwa_install_available') === 'true') {
          console.log('🔄 Install capability persisted from previous page load');
          this.updateInstallUI(true);
      }
  }

    static async showInstallPromptIfEligible() {
        if (this.deferredPrompt && !this.isInstalled && !this.userDismissedPrompt()) {
            console.log('🎯 Showing install prompt automatically');
            this.showPersistentInstallPromotion();
        }
    }

    static async installPWA() {
      console.log('🔄 Install PWA method called');
      
      if (this.deferredPrompt) {
          try {
              console.log('🎯 Showing browser install prompt...');
              
              // 🆕 THIS IS THE CRITICAL LINE THAT WAS MISSING
              await this.deferredPrompt.prompt();
              
              const choiceResult = await this.deferredPrompt.userChoice;
              console.log(`✅ User response: ${choiceResult.outcome}`);
              
              if (choiceResult.outcome === 'accepted') {
                  console.log('🎉 User accepted PWA installation');
                  this.handleSuccessfulInstallation();
              } else {
                  console.log('❌ User dismissed PWA installation');
                  this.setPromptDismissed();
              }
              
              this.deferredPrompt = null;
              
          } catch (error) {
              console.error('❌ Error showing install prompt:', error);
              this.showManualInstallInstructions();
          }
      } else {
          console.log('📋 No install prompt available');
          this.showManualInstallInstructions();
      }
  }

    static handleSuccessfulInstallation() {
        this.deferredPrompt = null;
        this.isInstalled = true;
        this.hideInstallPromotion();
        this.setInstallationStatus(true);
        
        if (window.casaLink) {
            window.casaLink.showNotification('CasaLink installed successfully!', 'success');
        }
    }

    static showPersistentInstallPromotion() {
        if (this.isInstalled || this.userDismissedPrompt() || !this.deferredPrompt) {
            return;
        }

        console.log('🎪 Showing install promotion');
        const prompt = document.getElementById('pwaPrompt');
        if (prompt) {
            prompt.style.display = 'block';
        }
    }

    static hideInstallPromotion() {
        const prompt = document.getElementById('pwaPrompt');
        if (prompt) {
            prompt.style.display = 'none';
        }
    }

    static handleNotNowClick() {
        console.log('🙅 User clicked "Not Now"');
        this.setPromptDismissed();
        this.hideInstallPromotion();
    }

    static userDismissedPrompt() {
        return localStorage.getItem('casalink_prompt_dismissed') === 'true';
    }

    static setPromptDismissed() {
        localStorage.setItem('casalink_prompt_dismissed', 'true');
    }

    static setInstallationStatus(installed) {
        if (installed) {
            localStorage.setItem('casalink_pwa_installed', 'true');
        } else {
            localStorage.removeItem('casalink_pwa_installed');
        }
    }

    static getInstallationStatus() {
        return localStorage.getItem('casalink_pwa_installed') === 'true';
    }

    static checkPWAStatus() {
        const isInstalled = 
            window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone ||
            this.getInstallationStatus();
        
        this.isInstalled = isInstalled;
        console.log('📱 PWA installation status:', this.isInstalled ? 'Installed' : 'Not installed');
        
        if (this.isInstalled) {
            this.hideInstallPromotion();
        }
    }

    static setupUserEngagement() {
      let userEngaged = false;
      
      const engagementEvents = ['click', 'keydown', 'scroll', 'mousemove'];
      
      engagementEvents.forEach(eventType => {
          document.addEventListener(eventType, () => {
              if (!userEngaged) {
                  userEngaged = true;
                  console.log('✅ User engagement detected');
                  // Now we can show install prompt
                  setTimeout(() => {
                      this.showInstallPromptIfEligible();
                  }, 1000);
              }
          }, { once: false, passive: true });
      });
  }

    static async registerServiceWorker() {
      if ('serviceWorker' in navigator) {
          try {
              console.log('🔄 Registering Service Worker...');
              
              // First, unregister any existing service workers
              const registrations = await navigator.serviceWorker.getRegistrations();
              for (let registration of registrations) {
                  await registration.unregister();
                  console.log('🗑️ Unregistered old service worker:', registration.scope);
              }
              
              // Clear all caches
              const cacheNames = await caches.keys();
              for (let cacheName of cacheNames) {
                  await caches.delete(cacheName);
                  console.log('🗑️ Deleted cache:', cacheName);
              }
              
              // Wait for cleanup
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Register with proper scope and immediate activation
              const registration = await navigator.serviceWorker.register('/sw.js', {
                  scope: '/',
                  updateViaCache: 'none'
              });
              
              console.log('✅ ServiceWorker registered:', registration.scope);
              
              // Force immediate activation
              if (registration.installing) {
                  console.log('⚡ Service Worker installing...');
                  
                  // Wait for installation to complete
                  await new Promise((resolve, reject) => {
                      const worker = registration.installing;
                      
                      worker.addEventListener('statechange', () => {
                          console.log('🔄 Service Worker state:', worker.state);
                          
                          if (worker.state === 'activated') {
                              console.log('🎯 Service Worker activated!');
                              resolve();
                          } else if (worker.state === 'redundant') {
                              reject(new Error('Service Worker became redundant'));
                          }
                      });
                  });
              }
              
              // Force the service worker to take control immediately
              if (registration.active) {
                  console.log('🚀 Forcing Service Worker to take control...');
                  await registration.update();
              }
              
              // Send a message to skip waiting and activate
              if (registration.waiting) {
                  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
              }
              
              console.log('✅ Service Worker registration complete');
              return registration;
              
          } catch (error) {
              console.error('❌ ServiceWorker registration failed:', error);
              return null;
          }
      }
      console.warn('⚠️ Service workers not supported');
      return null;
  }

    static setupOfflineDetection() {
        window.addEventListener('online', () => {
            this.updateOnlineStatus(true);
        });

        window.addEventListener('offline', () => {
            this.updateOnlineStatus(false);
        });

        this.updateOnlineStatus(navigator.onLine);
    }

    static updateOnlineStatus(online) {
        const indicator = document.getElementById('offlineIndicator');
        if (indicator) {
            indicator.style.display = online ? 'none' : 'block';
        }
    }

    static updateInstallUI(show) {
        const prompt = document.getElementById('pwaPrompt');
        if (prompt) {
            prompt.style.display = show ? 'block' : 'none';
        }
    }

    static showManualInstallInstructions() {
        const modalContent = `
            <div style="text-align: center; padding: 20px;">
                <i class="fas fa-download" style="font-size: 3rem; color: var(--primary-blue); margin-bottom: 15px;"></i>
                <h3 style="margin-bottom: 15px;">Install CasaLink</h3>
                <p style="margin-bottom: 20px;">To install CasaLink as an app:</p>
                
                <div style="text-align: left; background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <strong>Chrome/Edge:</strong><br>
                    • Look for the <strong>install icon (⎙)</strong> in the address bar<br>
                    • Or click <strong>⋮ menu → "Install CasaLink"</strong><br><br>
                    
                    <strong>Firefox:</strong><br>
                    • Look for the <strong>install icon</strong> in the address bar<br>
                    • Or check the <strong>menu → "Install"</strong>
                </div>
                
                <button class="btn btn-primary" onclick="location.reload()">
                    <i class="fas fa-redo"></i> Refresh & Retry
                </button>
            </div>
        `;
        
        ModalManager.openModal(modalContent, {
            title: 'Install CasaLink App',
            submitText: 'Close',
            showFooter: true
        });
    }

    // Debug methods
    static debugInstallPrompt() {
        console.log('🐛 PWA Debug Info:', {
            deferredPrompt: !!this.deferredPrompt,
            isInstalled: this.isInstalled,
            userDismissed: this.userDismissedPrompt(),
            serviceWorker: !!navigator.serviceWorker?.controller,
            manifest: !!document.querySelector('link[rel="manifest"]'),
            displayMode: this.getDisplayMode()
        });
    }

    static getDisplayMode() {
        if (window.matchMedia('(display-mode: standalone)').matches) return 'standalone';
        if (window.navigator.standalone) return 'standalone';
        return 'browser';
    }
}

window.PWAManager = PWAManager;