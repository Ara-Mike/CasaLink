class PWAManager {
    static deferredPrompt = null;
    static isInstalled = false;
    static installPromptShown = false;
    static promptAvailable = false;
    static aggressiveMode = true;

    static init() {
        console.log('🚀 PWA Manager initializing...');
        
        this.setupInstallPrompt();
        this.setupOfflineDetection();
        this.registerServiceWorker();
        this.checkPWAStatus();
        
        // Only show prompt if not installed AND user hasn't clicked "Not Now"
        if (!this.isInstalled && !this.userDismissedPrompt()) {
            setTimeout(() => {
                this.showPersistentInstallPromotion();
            }, 2000);
        } else {
            console.log('ℹ️ PWA prompt conditions not met:', {
                installed: this.isInstalled,
                userDismissed: this.userDismissedPrompt()
            });
        }
    }

    static setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('🎯 beforeinstallprompt event fired!');
            
            e.preventDefault();
            this.deferredPrompt = e;
            this.promptAvailable = true;
            
            console.log('✅ PWA install prompt is now available');
            
            // Only show if not installed AND user hasn't dismissed
            if (this.aggressiveMode && !this.isInstalled && !this.userDismissedPrompt()) {
                this.showPersistentInstallPromotion();
            }
        });

        window.addEventListener('appinstalled', (evt) => {
            console.log('🎉 PWA was installed successfully');
            this.handleSuccessfulInstallation();
        });
    }

    static handleSuccessfulInstallation() {
        this.deferredPrompt = null;
        this.promptAvailable = false;
        this.isInstalled = true;
        this.hideInstallPromotion();
        this.setInstallationStatus(true);
        
        if (window.casaLink) {
            window.casaLink.showNotification('CasaLink installed successfully!', 'success');
        }
        
        console.log('✅ PWA installation status updated: Installed');
    }

    static checkPWAStatus() {
        const detectionMethods = [
            () => window.matchMedia('(display-mode: standalone)').matches,
            () => window.navigator.standalone === true,
            () => document.referrer.includes('android-app://'),
            () => this.getInstallationStatus()
        ];

        const results = detectionMethods.map(method => {
            try {
                return method();
            } catch (error) {
                return false;
            }
        });

        this.isInstalled = results.some(result => result === true);
        
        console.log('📱 PWA installation status:', this.isInstalled ? 'Installed' : 'Not installed');
        
        if (this.isInstalled) {
            this.hideInstallPromotion();
        }
    }

    static showPersistentInstallPromotion() {
        // Don't show if already installed
        if (this.isInstalled) {
            console.log('✅ App already installed, skipping prompt');
            return;
        }

        // Don't show if user clicked "Not Now"
        if (this.userDismissedPrompt()) {
            console.log('🙅 User dismissed prompt, not showing again');
            return;
        }

        // Don't show if already visible
        if (this.installPromptShown) {
            console.log('ℹ️ Install prompt already visible');
            return;
        }

        console.log('🎪 Showing persistent install promotion');
        
        const prompt = document.getElementById('pwaPrompt');
        if (prompt) {
            prompt.style.display = 'block';
            this.installPromptShown = true;
            
            // NO auto-hide timeout - prompt stays until user action
            
        } else {
            console.warn('❌ PWA prompt element not found');
        }

        // Show in-app notification
        if (window.casaLink) {
            setTimeout(() => {
                window.casaLink.showNotification(
                    'Install CasaLink for a better experience!',
                    'info'
                );
            }, 500);
        }
    }

    static userDismissedPrompt() {
        try {
            return localStorage.getItem('casalink_prompt_dismissed') === 'true';
        } catch (error) {
            return false;
        }
    }

    static setPromptDismissed() {
        try {
            localStorage.setItem('casalink_prompt_dismissed', 'true');
            console.log('🙅 User dismissed PWA prompt - will not show again');
        } catch (error) {
            console.warn('⚠️ Could not set prompt dismissal:', error);
        }
    }

    static setInstallationStatus(installed) {
        try {
            if (installed) {
                localStorage.setItem('casalink_pwa_installed', 'true');
            } else {
                localStorage.removeItem('casalink_pwa_installed');
            }
        } catch (error) {
            console.warn('⚠️ Could not set installation status:', error);
        }
    }

    static getInstallationStatus() {
        try {
            return localStorage.getItem('casalink_pwa_installed') === 'true';
        } catch (error) {
            return false;
        }
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

    static async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/'
                });
                console.log('✅ ServiceWorker registered successfully');

            } catch (error) {
                console.error('❌ ServiceWorker registration failed:', error);
            }
        }
    }

    static hideInstallPromotion() {
        const prompt = document.getElementById('pwaPrompt');
        if (prompt) {
            prompt.style.display = 'none';
            console.log('🎪 PWA install promotion hidden');
        }
    }

    // Handle "Not Now" button click
    static handleNotNowClick() {
        console.log('🙅 User clicked "Not Now" - dismissing prompt');
        this.setPromptDismissed();
        this.hideInstallPromotion();
        
        if (window.casaLink) {
            window.casaLink.showNotification(
                'You can install CasaLink anytime from the browser menu.',
                'info'
            );
        }
    }

    static async installPWA() {
        if (!this.deferredPrompt) {
            console.log('❌ No install prompt available');
            this.showManualInstallInstructions();
            return;
        }

        try {
            console.log('🎯 Showing install prompt to user');
            
            this.deferredPrompt.prompt();
            
            const { outcome } = await this.deferredPrompt.userChoice;
            
            console.log(`✅ User response to install prompt: ${outcome}`);
            
            if (outcome === 'accepted') {
                console.log('🎉 User accepted the PWA installation');
                this.handleSuccessfulInstallation();
                
                if (window.casaLink) {
                    window.casaLink.showNotification('CasaLink is being installed...', 'success');
                }
            } else {
                console.log('❌ User dismissed the browser install prompt');
                // Note: This is different from our "Not Now" button
                // We'll treat browser dismissal as "Not Now"
                this.setPromptDismissed();
            }
            
            this.deferredPrompt = null;
            this.promptAvailable = false;
            this.hideInstallPromotion();
            
        } catch (error) {
            console.error('❌ Error during PWA installation:', error);
            
            if (window.casaLink) {
                window.casaLink.showNotification('Installation failed. Please try again.', 'error');
            }
        }
    }

    static showManualInstallInstructions() {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        
        let instructions = '';
        
        if (isIOS) {
            instructions = 'Tap the Share button 📤 and then "Add to Home Screen"';
        } else if (isAndroid) {
            instructions = 'Tap the menu (⋮) and then "Install App" or "Add to Home Screen"';
        } else {
            instructions = 'Click the install icon in your browser address bar or use the browser menu';
        }
        
        if (window.casaLink) {
            window.casaLink.showNotification(`To install: ${instructions}`, 'info');
        }
    }

    static updateOnlineStatus(online) {
        const indicator = document.getElementById('offlineIndicator');
        if (indicator) {
            indicator.style.display = online ? 'none' : 'block';
        }

        if (window.casaLink) {
            window.casaLink.isOnline = online;
        }
    }

    // Reset for testing purposes
    static resetPrompt() {
        try {
            localStorage.removeItem('casalink_prompt_dismissed');
            localStorage.removeItem('casalink_pwa_installed');
            this.isInstalled = false;
            this.installPromptShown = false;
            console.log('🔄 PWA prompt reset for testing');
        } catch (error) {
            console.warn('⚠️ Could not reset prompt:', error);
        }
    }

    // Manual trigger for testing
    static simulateInstallPrompt() {
        console.log('🧪 Simulating install prompt for testing');
        if (!this.isInstalled && !this.userDismissedPrompt()) {
            this.showPersistentInstallPromotion();
        } else {
            console.log('✅ Conditions not met for prompt:', {
                installed: this.isInstalled,
                dismissed: this.userDismissedPrompt()
            });
        }
    }

    // Debug method
    static debugStatus() {
        console.log('🐛 PWA Debug Info:', {
            isInstalled: this.isInstalled,
            userDismissed: this.userDismissedPrompt(),
            installPromptShown: this.installPromptShown,
            promptAvailable: this.promptAvailable
        });
    }

    static resetForNewSession() {
        console.log('🔄 Reset for new session (compatibility method)');
        // This is now handled automatically in the init method
        // No need to manually reset anymore
    }
}

// Make available globally
window.PWAManager = PWAManager;
console.log('✅ PWAManager loaded');