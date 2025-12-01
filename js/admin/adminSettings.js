// js/admin/adminSettings.js - System Settings
class AdminSettings {
    constructor() {
        this.settings = {};
        this.init();
    }

    async init() {
        console.log('⚙️ AdminSettings initializing...');
        
        // Wait for adminAuth
        if (!window.adminAuthInstance) {
            setTimeout(() => this.init(), 1000);
            return;
        }
        
        // Check session
        if (!this.checkSession()) {
            return;
        }
        
        // Load settings
        await this.loadSettings();
    }
    
    checkSession() {
        const session = localStorage.getItem('admin_session');
        if (!session) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    }

    async loadSettings() {
        try {
            console.log('Loading settings...');
            
            // In a real app, you would fetch from Firestore
            // For demo, we'll use default settings
            
            this.settings = {
                siteName: 'CasaLink',
                siteUrl: 'https://casalink.example.com',
                supportEmail: 'support@casalink.example.com',
                defaultCurrency: 'PHP',
                timezone: 'Asia/Manila',
                allowRegistration: true,
                maintenanceMode: false,
                autoApproveLandlords: true
            };
            
            console.log('Settings loaded:', this.settings);
            
        } catch (error) {
            console.error('Error loading settings:', error);
            this.showError('Failed to load settings');
        }
    }

    async saveSettings() {
        try {
            console.log('Saving settings...');
            
            // In a real app, you would save to Firestore
            // For demo, just update local object
            
            // Collect all settings from form
            this.collectFormSettings();
            
            console.log('Settings saved:', this.settings);
            this.showSuccess('Settings saved successfully');
            
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showError('Failed to save settings');
        }
    }

    collectFormSettings() {
        // Collect settings from all forms
        // This is a simplified version
        this.settings = {
            siteName: document.getElementById('siteName')?.value || 'CasaLink',
            siteUrl: document.getElementById('siteUrl')?.value || '',
            supportEmail: document.getElementById('supportEmail')?.value || '',
            defaultCurrency: document.getElementById('defaultCurrency')?.value || 'PHP',
            timezone: document.getElementById('timezone')?.value || 'Asia/Manila',
            allowRegistration: document.getElementById('allowRegistration')?.checked || true,
            maintenanceMode: document.getElementById('maintenanceMode')?.checked || false,
            autoApproveLandlords: document.getElementById('autoApproveLandlords')?.checked || true
        };
    }

    showError(message) {
        console.error('Settings Error:', message);
        alert(`Error: ${message}`);
    }

    showSuccess(message) {
        console.log('Settings Success:', message);
        alert(`Success: ${message}`);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing AdminSettings...');
    window.adminSettings = new AdminSettings();
});