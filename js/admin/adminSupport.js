// js/admin/adminSupport.js - Support Tickets Management
class AdminSupport {
    constructor() {
        this.tickets = [];
        this.filteredTickets = [];
        this.filters = {
            search: '',
            status: 'all',
            priority: 'all',
            category: 'all'
        };
        this.init();
    }

    async init() {
        console.log('🛟 AdminSupport initializing...');
        
        // Wait for adminAuth
        if (!window.adminAuthInstance) {
            setTimeout(() => this.init(), 1000);
            return;
        }
        
        // Check session
        if (!this.checkSession()) {
            return;
        }
        
        // Load tickets
        await this.loadTickets();
    }
    
    checkSession() {
        const session = localStorage.getItem('admin_session');
        if (!session) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    }

    async loadTickets() {
        try {
            console.log('Loading support tickets...');
            
            // In a real app, you would fetch from Firestore
            // For demo, we'll use sample data
            await this.loadDemoTickets();
            
            console.log(`Loaded ${this.tickets.length} tickets`);
            
        } catch (error) {
            console.error('Error loading tickets:', error);
            this.showError('Failed to load tickets');
        }
    }

    async loadDemoTickets() {
        // Sample ticket data
        this.tickets = [
            {
                id: 'TKT-2024-001',
                subject: 'Payment not processing',
                category: 'billing',
                priority: 'high',
                status: 'open',
                description: 'Payment processing issue.',
                user: { name: 'John Tenant', email: 'john@example.com' },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                assignedTo: null
            },
            {
                id: 'TKT-2024-002',
                subject: 'Maintenance request feature not working',
                category: 'technical',
                priority: 'medium',
                status: 'in-progress',
                description: 'Cannot submit maintenance requests.',
                user: { name: 'Maria Landlord', email: 'maria@example.com' },
                createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
                updatedAt: new Date().toISOString(),
                assignedTo: 'Admin User'
            }
        ];
        
        this.filteredTickets = [...this.tickets];
    }

    showError(message) {
        console.error('Support Error:', message);
        alert(`Error: ${message}`);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing AdminSupport...');
    window.adminSupport = new AdminSupport();
});