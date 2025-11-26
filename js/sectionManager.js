class SectionManager {
    constructor() {
        this.currentSection = 'dashboardSection';
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Navigation links in header and sidebar
        document.querySelectorAll('.nav-links a, .sidebar-menu a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.target.getAttribute('data-section');
                if (section && section !== 'logout') {
                    this.showSection(section);
                }
            });
        });

        // Logout buttons
        document.getElementById('logoutBtn')?.addEventListener('click', this.handleLogout);
        document.getElementById('sidebarLogoutBtn')?.addEventListener('click', this.handleLogout);

        // Demo buttons for functionality
        document.getElementById('createFirstRequest')?.addEventListener('click', () => {
            this.showSection('maintenanceSection');
        });

        document.getElementById('payBalanceBtn')?.addEventListener('click', () => {
            this.showPayModal();
        });

        document.getElementById('newRequestBtn')?.addEventListener('click', () => {
            this.showMaintenanceModal();
        });
    }

    showSection(sectionId) {
        console.log('Switching to section:', sectionId);
        
        // Hide all sections
        document.querySelectorAll('.dashboard-section').forEach(section => {
            section.classList.remove('active');
        });

        // Show target section
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
            
            // Initialize charts if showing reports section
            if (sectionId === 'reportsSection' && window.chartsManager) {
                console.log('Initializing charts for reports section...');
                setTimeout(() => {
                    window.chartsManager.initializeAllCharts();
                }, 100);
            }
        }

        // Update active nav links
        document.querySelectorAll('.nav-links a, .sidebar-menu a').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-section') === sectionId) {
                link.classList.add('active');
            }
        });

        this.currentSection = sectionId;
        
        // Update page title
        this.updatePageTitle(sectionId);
    }

    updatePageTitle(sectionId) {
        const titles = {
            'dashboardSection': 'Dashboard',
            'billingSection': 'Billing & Payments', 
            'maintenanceSection': 'Maintenance',
            'reportsSection': 'Reports & Analytics',
            'profileSection': 'My Profile'
        };
        
        const title = titles[sectionId] || 'CasaLink';
        document.title = `${title} - CasaLink`;
    }

    handleLogout(e) {
        e.preventDefault();
        if (confirm('Are you sure you want to logout?')) {
            // Show loading spinner
            document.getElementById('loadingSpinner').style.display = 'flex';
            document.getElementById('mainApp').style.display = 'none';
            
            // Simulate logout process
            setTimeout(() => {
                alert('Logged out successfully!');
                // In real app, this would redirect to login page
                // For demo, just show login screen again
                document.getElementById('loadingSpinner').style.display = 'none';
                document.getElementById('mainApp').style.display = 'block';
                window.sectionManager.showSection('dashboardSection');
            }, 1000);
        }
    }

    showPayModal() {
        alert('Payment modal would open here. This is a demo feature.');
    }

    showMaintenanceModal() {
        alert('Maintenance request modal would open here. This is a demo feature.');
    }

    // Method to refresh current section
    refreshCurrentSection() {
        this.showSection(this.currentSection);
    }
}