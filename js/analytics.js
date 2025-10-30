// js/analytics.js
class AnalyticsManager {
    static init() {
        console.log('Analytics Manager initialized');
        this.trackPageView('Home');
        return true;
    }

    static trackPageView(pageName) {
        console.log(`Page view: ${pageName}`);
    }

    static trackEvent(category, action, label = null) {
        console.log(`Event: ${category} - ${action}`, label ? `(${label})` : '');
    }
}


// Also make available globally
window.AnalyticsManager = AnalyticsManager;