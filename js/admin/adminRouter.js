// js/admin/adminRouter.js - Admin Navigation Router
class AdminRouter {
    constructor() {
        this.currentPage = 'dashboard';
        this.init();
    }

    init() {
        console.log('🚦 AdminRouter initialized');
        
        // Setup navigation click handlers
        this.setupNavigation();
        
        // Handle browser back/forward
        window.addEventListener('popstate', () => {
            this.loadPage(window.location.hash);
        });
        
        // Load initial page
        this.loadPage(window.location.hash || '#dashboard');
    }

    setupNavigation() {
        // Setup nav menu click handlers
        document.addEventListener('click', (e) => {
            const navLink = e.target.closest('.nav-menu a');
            if (navLink && navLink.href) {
                e.preventDefault();
                const page = navLink.getAttribute('href').replace('.html', '');
                this.navigateTo(page);
            }
        });
    }

    navigateTo(page) {
        console.log('Navigating to:', page);
        
        // Update URL without reload
        window.history.pushState({}, '', `#${page}`);
        
        // Load the page
        this.loadPage(page);
    }

    async loadPage(page) {
        // Remove hash if present
        page = page.replace('#', '');
        
        // Update active nav item
        this.updateActiveNav(page);
        
        // Store current page
        this.currentPage = page;
        
        // Load page content
        await this.loadPageContent(page);
    }

    updateActiveNav(page) {
        // Remove active class from all nav items
        document.querySelectorAll('.nav-menu li').forEach(li => {
            li.classList.remove('active');
        });
        
        // Add active class to current page
        const activeLink = document.querySelector(`.nav-menu a[href="${page}.html"]`);
        if (activeLink) {
            activeLink.closest('li').classList.add('active');
        }
    }

    async loadPageContent(page) {
        try {
            console.log('Loading page:', page);
            
            // Show loading state
            this.showLoading(true);
            
            // For now, just show the page (they're separate HTML files)
            // In the future, you could load content dynamically
            
            // Hide all sections, show current
            this.showPageSection(page);
            
        } catch (error) {
            console.error('Error loading page:', error);
            this.showError('Failed to load page');
        } finally {
            this.showLoading(false);
        }
    }

    showPageSection(page) {
        // For SPA implementation, you would show/hide sections
        console.log('Showing page:', page);
        
        // Update page title
        const pageTitles = {
            'dashboard': 'Dashboard',
            'users': 'User Management',
            'analytics': 'Analytics',
            'support': 'Support Tickets',
            'settings': 'Settings'
        };
        
        document.title = `CasaLink Admin - ${pageTitles[page] || 'Admin'}`;
    }

    showLoading(show) {
        // Implement loading indicator if needed
        if (show) {
            console.log('Loading...');
        }
    }

    showError(message) {
        alert(`Admin Error: ${message}`);
    }
}

// Initialize router
window.addEventListener('DOMContentLoaded', () => {
    window.adminRouter = new AdminRouter();
});