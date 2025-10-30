// js/performance.js
class PerformanceOptimizer {
    static init() {
        console.log('Performance Optimizer initialized');
        this.setupLazyLoading();
        return true;
    }

    static setupLazyLoading() {
        console.log('Lazy loading setup');
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}


// Also make available globally
window.PerformanceOptimizer = PerformanceOptimizer;