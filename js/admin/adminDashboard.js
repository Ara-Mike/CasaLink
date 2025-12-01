// js/admin/adminDashboard.js - UPDATED VERSION
console.log('AdminDashboard loading...');

class AdminDashboard {
    constructor() {
        this.charts = {}; // Store chart instances
        this.init();
    }

    async init() {
        console.log('📊 AdminDashboard initializing...');
        
        // Wait for adminAuth to load
        if (!window.adminAuthInstance) {
            console.log('Waiting for adminAuth...');
            setTimeout(() => this.init(), 1000);
            return;
        }
        
        // Check if we have a valid session first
        if (!this.checkSession()) {
            console.log('No valid session, waiting for auth check...');
            return;
        }
        
        // Display admin name
        this.displayAdminInfo();
        
        // Load dashboard data
        await this.loadDashboardData();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Update date
        this.updateCurrentDate();
    }
    
    checkSession() {
        // First check localStorage session
        const session = localStorage.getItem('admin_session');
        if (!session) {
            console.log('No session in localStorage');
            return false;
        }
        
        // Check if session is valid
        try {
            const sessionData = JSON.parse(session);
            const isRecent = Date.now() - sessionData.timestamp < (24 * 60 * 60 * 1000);
            
            if (!isRecent) {
                console.log('Session expired');
                localStorage.removeItem('admin_session');
                return false;
            }
            
            return true;
        } catch (e) {
            console.log('Invalid session data');
            return false;
        }
    }

    displayAdminInfo() {
        // Try to get admin from localStorage first
        const session = localStorage.getItem('admin_session');
        if (session) {
            try {
                const sessionData = JSON.parse(session);
                document.getElementById('adminName').textContent = 
                    sessionData.email.split('@')[0];
            } catch (e) {
                console.error('Error parsing session:', e);
            }
        }
        
        // Also try to get from adminAuth instance
        if (window.adminAuthInstance && adminAuthInstance.getCurrentAdmin()) {
            const admin = adminAuthInstance.getCurrentAdmin();
            document.getElementById('adminName').textContent = 
                admin.name || admin.email.split('@')[0];
        }
        
        // Logout button
        const logoutBtn = document.getElementById('adminLogout');
        if (logoutBtn) {
            // Remove existing event listeners
            const newLogoutBtn = logoutBtn.cloneNode(true);
            logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
            
            newLogoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // Clean up charts before logout
                this.destroyAllCharts();
                
                if (window.adminAuthInstance) {
                    adminAuthInstance.logout();
                } else {
                    localStorage.removeItem('admin_session');
                    window.location.href = 'index.html';
                }
            });
        }
    }

    async loadDashboardData() {
        console.log('Loading dashboard data...');
        
        // Show loading state
        this.showLoading(true);
        
        // Destroy any existing charts first
        this.destroyAllCharts();
        
        // Load demo data for now
        setTimeout(() => {
            this.showDemoData();
            this.showLoading(false);
        }, 1000);
    }
    
    showLoading(show) {
        const loadingElements = document.querySelectorAll('.loading-text, .no-data');
        loadingElements.forEach(el => {
            if (show) {
                el.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            }
        });
    }

    showDemoData() {
        console.log('Showing demo data');
        
        // Demo stats
        const stats = {
            totalLandlords: '18',
            totalProperties: '42',
            monthlyRevenue: '₱378,500',
            openTickets: '3'
        };
        
        // Update stats
        Object.keys(stats).forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = stats[id];
        });
        
        // Demo trends
        document.getElementById('landlordTrend').textContent = '+12%';
        document.getElementById('propertyTrend').textContent = '+8%';
        document.getElementById('revenueTrend').textContent = '+15%';
        document.getElementById('ticketTrend').textContent = '-25%';
        
        // Demo recent signups
        const recentSignups = [
            { name: 'John Smith', email: 'john@example.com', date: '2024-01-15', properties: 3 },
            { name: 'Maria Garcia', email: 'maria@example.com', date: '2024-01-14', properties: 2 },
            { name: 'Robert Chen', email: 'robert@example.com', date: '2024-01-13', properties: 1 }
        ];
        
        this.updateRecentSignups(recentSignups);
        
        // Demo recent tickets
        const recentTickets = [
            { id: 'TKT-001', subject: 'Login issue', status: 'open', priority: 'high' },
            { id: 'TKT-002', subject: 'Payment problem', status: 'in_progress', priority: 'medium' },
            { id: 'TKT-003', subject: 'Feature request', status: 'resolved', priority: 'low' }
        ];
        
        this.updateRecentTickets(recentTickets);
        
        // Initialize charts
        this.initCharts();
    }

    updateRecentSignups(signups) {
        const container = document.getElementById('recentSignups');
        if (!container) return;
        
        if (signups.length === 0) {
            container.innerHTML = '<p class="no-data">No recent sign-ups</p>';
            return;
        }
        
        let html = '<table class="data-table"><thead><tr>';
        html += '<th>Name</th><th>Email</th><th>Date</th><th>Properties</th>';
        html += '</tr></thead><tbody>';
        
        signups.forEach(signup => {
            html += `<tr>
                <td>${signup.name}</td>
                <td>${signup.email}</td>
                <td>${signup.date}</td>
                <td>${signup.properties}</td>
            </tr>`;
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
    }

    updateRecentTickets(tickets) {
        const container = document.getElementById('recentTickets');
        if (!container) return;
        
        if (tickets.length === 0) {
            container.innerHTML = '<p class="no-data">No recent tickets</p>';
            return;
        }
        
        let html = '<table class="data-table"><thead><tr>';
        html += '<th>Ticket ID</th><th>Subject</th><th>Status</th><th>Priority</th>';
        html += '</tr></thead><tbody>';
        
        tickets.forEach(ticket => {
            const priorityClass = `priority-${ticket.priority}`;
            const statusClass = `status-${ticket.status.replace('_', '-')}`;
            
            html += `<tr>
                <td>${ticket.id}</td>
                <td>${ticket.subject}</td>
                <td><span class="status-badge ${statusClass}">${ticket.status}</span></td>
                <td><span class="priority-badge ${priorityClass}">${ticket.priority}</span></td>
            </tr>`;
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
    }

    initCharts() {
        // Destroy existing charts first
        this.destroyChart('userGrowthChart');
        this.destroyChart('activityChart');
        
        // User Growth Chart
        const userGrowthCtx = document.getElementById('userGrowthChart')?.getContext('2d');
        if (userGrowthCtx) {
            this.charts.userGrowthChart = new Chart(userGrowthCtx, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                    datasets: [{
                        label: 'Landlords',
                        data: [12, 19, 15, 25, 22, 30],
                        borderColor: '#1A73E8',
                        backgroundColor: 'rgba(26, 115, 232, 0.1)',
                        tension: 0.4,
                        fill: true
                    }, {
                        label: 'Tenants',
                        data: [40, 50, 45, 60, 55, 70],
                        borderColor: '#34A853',
                        backgroundColor: 'rgba(52, 168, 83, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { position: 'top' }
                    }
                }
            });
        }

        // Activity Chart
        const activityCtx = document.getElementById('activityChart')?.getContext('2d');
        if (activityCtx) {
            this.charts.activityChart = new Chart(activityCtx, {
                type: 'bar',
                data: {
                    labels: ['Logins', 'Payments', 'Requests', 'Messages'],
                    datasets: [{
                        label: 'Daily Activity',
                        data: [65, 59, 80, 81],
                        backgroundColor: [
                            'rgba(75, 192, 192, 0.6)',
                            'rgba(54, 162, 235, 0.6)',
                            'rgba(255, 206, 86, 0.6)',
                            'rgba(153, 102, 255, 0.6)'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }
    }
    
    destroyChart(chartId) {
        if (this.charts[chartId]) {
            try {
                this.charts[chartId].destroy();
                console.log(`Destroyed chart: ${chartId}`);
            } catch (error) {
                console.warn(`Error destroying chart ${chartId}:`, error);
            }
            delete this.charts[chartId];
        }
        
        // Also check Chart.js registry
        if (Chart && Chart.registry && Chart.registry.items) {
            const chart = Chart.registry.getItem(chartId);
            if (chart) {
                try {
                    chart.destroy();
                } catch (error) {
                    console.warn(`Error destroying chart from registry:`, error);
                }
            }
        }
    }
    
    destroyAllCharts() {
        console.log('Destroying all charts...');
        
        // Destroy stored charts
        Object.keys(this.charts).forEach(chartId => {
            this.destroyChart(chartId);
        });
        
        // Also destroy any charts in Chart.js registry
        if (Chart && Chart.registry && Chart.registry.items) {
            Chart.registry.items.forEach(chart => {
                try {
                    chart.destroy();
                } catch (error) {
                    console.warn('Error destroying chart from registry:', error);
                }
            });
        }
    }

    setupEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('refreshData');
        if (refreshBtn) {
            // Remove existing listeners
            const newRefreshBtn = refreshBtn.cloneNode(true);
            refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);
            
            newRefreshBtn.addEventListener('click', () => {
                this.loadDashboardData();
            });
        }
    }

    updateCurrentDate() {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        const dateElement = document.getElementById('currentDate');
        if (dateElement) {
            dateElement.textContent = now.toLocaleDateString('en-US', options);
        }
    }
    
    // Clean up when navigating away
    cleanup() {
        this.destroyAllCharts();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing AdminDashboard...');
    window.adminDashboard = new AdminDashboard();
    
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        if (window.adminDashboard && window.adminDashboard.cleanup) {
            window.adminDashboard.cleanup();
        }
    });
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            // Page is hidden, could be navigating away
            if (window.adminDashboard && window.adminDashboard.cleanup) {
                window.adminDashboard.cleanup();
            }
        }
    });
});

// Add global chart cleanup function
window.cleanupAllCharts = function() {
    if (window.adminDashboard && window.adminDashboard.destroyAllCharts) {
        window.adminDashboard.destroyAllCharts();
    }
};