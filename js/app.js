class CasaLink {
    constructor() {
        console.log('🏠 CasaLink constructor starting...');
        
        this.currentUser = null;
        this.currentRole = null;
        this.isOnline = navigator.onLine;
        this.pendingActions = [];
        this.loginInProgress = false;
        this.authListenerEnabled = false; // Start with auth listener disabled
        this.showingLogin = false;
        this.showingDashboard = false;
        this.creatingTenant = false;
        this.currentPage = this.getStoredPage() || 'dashboard';
        this.appInitialized = false; // Track if app is fully initialized
        
        // Bind methods
        this.boundLoginClickHandler = this.loginClickHandler.bind(this);
        this.boundLoginKeypressHandler = this.loginKeypressHandler.bind(this);
        this.boundHandleLogin = this.handleLogin.bind(this);
        
        console.log('🔄 Initializing CasaLink...');
        this.init();
    }

    // Store current page in localStorage
    storeCurrentPage(page) {
        // Only store non-dashboard pages
        if (page && page !== 'dashboard') {
            localStorage.setItem('casalink_current_page', page);
            console.log('💾 Stored current page:', page);
        } else {
            // If it's dashboard, remove any stored page
            localStorage.removeItem('casalink_current_page');
            console.log('💾 Cleared stored page (dashboard is default)');
        }
    }

    // Get stored page from localStorage with validation
    getStoredPage() {
        const storedPage = localStorage.getItem('casalink_current_page');
        
        // If no page stored, return null (will default to dashboard)
        if (!storedPage) {
            console.log('📖 No stored page found');
            return null;
        }
        
        // Validate that the stored page is appropriate for the current user role
        const isValidPage = this.isValidPageForRole(storedPage);
        
        if (isValidPage) {
            console.log('📖 Retrieved valid stored page:', storedPage);
            return storedPage;
        } else {
            console.log('📖 Stored page is invalid for current role, clearing:', storedPage);
            this.clearStoredPage();
            return null;
        }
    }

    // Validate if a page is appropriate for the current user role
    isValidPageForRole(page) {
        const landlordPages = ['dashboard', 'billing', 'maintenance', 'tenants', 'reports'];
        const tenantPages = ['dashboard', 'tenantBilling', 'tenantMaintenance', 'tenantProfile'];
        
        if (this.currentRole === 'landlord') {
            return landlordPages.includes(page);
        } else if (this.currentRole === 'tenant') {
            return tenantPages.includes(page);
        }
        
        return false; // Invalid role
    }

    // Clear stored page (on logout)
    clearStoredPage() {
        localStorage.removeItem('casalink_current_page');
        console.log('🗑️ Cleared stored page');
    }


    checkAndClearInvalidAuth() {
        // Only clear auth if there's a specific flag or error condition
        const shouldClearAuth = localStorage.getItem('force_logout') === 'true';
        if (shouldClearAuth) {
            console.log('🔄 Force logout detected, clearing auth...');
            this.clearStoredAuth();
            localStorage.removeItem('force_logout');
        }
    }

    
    clearStoredAuth() {
        // Clear all localStorage items that might contain user data
        localStorage.removeItem('casalink_user');
        localStorage.removeItem('pendingOperations');
        localStorage.removeItem('casalink_pending_actions');
        
        // Also clear sessionStorage
        sessionStorage.clear();
        
        console.log('Cleared stored authentication data');
    }

    async clearAuthentication() {
        console.log('🔒 Clearing authentication data...');
        
        // Clear app state
        this.currentUser = null;
        this.currentRole = null;
        
        // Clear local storage
        localStorage.removeItem('casalink_user');
        localStorage.removeItem('casalink_pending_actions');
        sessionStorage.removeItem('casalink_user');
        
        // Clear any pending operations
        localStorage.removeItem('pendingOperations');
        
        // Sign out from Firebase
        try {
            await AuthManager.logout();
        } catch (error) {
            console.log('No user to log out or logout failed:', error);
        }
        
        console.log('Authentication data cleared');
    }

    clearStoredUser() {
        // Remove any stored user data to force login
        localStorage.removeItem('casalink_user');
        sessionStorage.removeItem('casalink_user');
    }

    async init() {
        console.log('🔄 CasaLink init() called');
        
        try {
            // Show loading spinner
            const spinner = document.getElementById('loadingSpinner');
            if (spinner) {
                spinner.classList.remove('hidden');
            }
            
            // Wait for Firebase to be available
            await this.waitForFirebase();
            
            // Setup features that don't require auth
            this.setupPWAFeatures();
            this.setupOfflineHandling();
            this.setupNavigationEvents();
            
            // Mark app as initialized
            this.appInitialized = true;
            
            // NOW enable auth listener
            this.authListenerEnabled = true;
            this.setupAuthListener();
            
            // If no auth state is detected within 3 seconds, show login
            setTimeout(() => {
                const spinner = document.getElementById('loadingSpinner');
                if (spinner && !spinner.classList.contains('hidden') && !this.currentUser) {
                    console.log('🕒 Auth timeout, showing login page');
                    spinner.classList.add('hidden');
                    this.showLogin();
                }
            }, 3000);
            
        } catch (error) {
            console.error('❌ CasaLink initialization failed:', error);
            this.showNotification('Application failed to start. Please refresh the page.', 'error');
            this.showLogin(); // Fallback to login page
        }
    }

    async waitForFirebase() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds total
            
            const checkFirebase = () => {
                attempts++;
                
                // Check if Firebase services are available AND initialized
                if (window.firebaseAuth && window.firebaseDb && window.firebaseApp) {
                    console.log('✅ Firebase is ready and initialized');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    console.warn('⚠️ Firebase timeout - continuing without full initialization');
                    resolve(); // Resolve anyway to prevent hanging
                } else {
                    // Check if Firebase SDK is loaded but services aren't initialized yet
                    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
                        console.log('🔄 Firebase SDK loaded, initializing services...');
                        try {
                            // Force initialize if needed
                            if (!window.firebaseAuth) {
                                window.firebaseAuth = firebase.auth();
                            }
                            if (!window.firebaseDb) {
                                window.firebaseDb = firebase.firestore();
                            }
                            if (!window.firebaseApp) {
                                window.firebaseApp = firebase.app();
                            }
                        } catch (error) {
                            console.warn('⚠️ Error initializing Firebase services:', error);
                        }
                    }
                    
                    setTimeout(checkFirebase, 100);
                }
            };
            
            console.log('🔄 Waiting for Firebase...');
            checkFirebase();
        });
    }

    async showPage(page) {
        console.log('🔄 Attempting to show page:', page);
        
        // Store the page before showing it
        this.storeCurrentPage(page);
        this.currentPage = page;
        this.updateUrlHash(page);

        if (page !== 'dashboard') {
            this.updateUrlHash(page);
        } else {
            this.updateUrlHash(''); // Clear hash for dashboard
        }
        
        // Ensure we have the main app container
        let appElement = document.getElementById('app');
        if (!appElement) {
            console.error('❌ App element not found');
            return;
        }
        
        // Check if we need to render the main app layout first
        const contentArea = document.getElementById('contentArea');
        if (!contentArea) {
            console.log('📋 Content area not found, rendering full app layout first...');
            
            // Render the complete app layout
            appElement.innerHTML = this.getDashboardHTML();
            
            // Small delay to ensure DOM is updated
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Now try to get content area again
            const newContentArea = document.getElementById('contentArea');
            if (!newContentArea) {
                console.error('❌ Content area still not found after rendering layout');
                return;
            }
        }
        
        // Now we can safely show the page content
        const finalContentArea = document.getElementById('contentArea');
        console.log('✅ Content area found, loading page content...');
        
        // Show loading state
        finalContentArea.innerHTML = `
            <div class="data-loading">
                <i class="fas fa-spinner fa-spin"></i> Loading ${page}...
            </div>
        `;

        try {
            let pageContent;
            
            console.log('📝 Getting page content for:', page);
            
            switch (page) {
                case 'dashboard':
                    // Use the new method that handles both landlord and tenant dashboards
                    pageContent = this.getDashboardContentHTML();
                    break;
                case 'billing':
                    pageContent = this.currentRole === 'landlord'
                        ? await this.getBillingPage()
                        : await this.getTenantBillingPage();
                    break;
                case 'maintenance':
                    pageContent = this.currentRole === 'landlord'
                        ? await this.getMaintenancePage()
                        : await this.getTenantMaintenancePage();
                    break;
                case 'tenants':
                    pageContent = await this.getTenantsPage();
                    break;
                case 'reports':
                    pageContent = await this.getReportsPage();
                    break;
                case 'tenantBilling':
                    pageContent = await this.getTenantBillingPage();
                    break;
                case 'tenantMaintenance':
                    pageContent = await this.getTenantMaintenancePage();
                    break;
                case 'tenantProfile':
                    pageContent = await this.getTenantProfilePage();
                    break;
                default:
                    pageContent = `<div class="page-content"><h1>${page} Page</h1><p>This page is under construction.</p></div>`;
            }

            // Handle Promise if returned
            if (pageContent instanceof Promise) {
                console.log('⚠️ Page content is a Promise, awaiting...');
                pageContent = await pageContent;
            }
            
            // Ensure we have a string
            if (typeof pageContent === 'string') {
                finalContentArea.innerHTML = pageContent;
                console.log('✅ Page content loaded successfully');
            } else {
                console.error('❌ Page content is not a string:', typeof pageContent, pageContent);
                throw new Error('Invalid page content');
            }
            
            // Setup page-specific events
            this.setupPageEvents(page);
            
            // Update active navigation state
            this.updateActiveNavState(page);
            
            // SPECIAL CASE: If dashboard, load fresh data immediately
            if (page === 'dashboard') {
                console.log('📊 Force refreshing dashboard data...');
                setTimeout(() => {
                    this.loadDashboardData();
                }, 100);
            }
            
        } catch (error) {
            console.error('❌ Error loading page:', error);
            finalContentArea.innerHTML = `
                <div class="page-content">
                    <h1>Error Loading Page</h1>
                    <p>There was an error loading the ${page} page. Please try again.</p>
                    <button class="btn btn-primary" onclick="casaLink.showPage('${page}')">Retry</button>
                </div>
            `;
        }
    }


    async getReportsPage() {
        return `
        <div class="page-content">
            <div class="page-header">
                <h1 class="page-title">Reports</h1>
            </div>
            <div style="text-align: center; padding: 40px;">
                <h3>Reports & Analytics</h3>
                <p>View detailed reports and analytics for your properties.</p>
                <p><em>Reports feature coming soon!</em></p>
            </div>
        </div>
        `;
    }

    async getTenantProfilePage() {
        return `
        <div class="page-content">
            <div class="page-header">
                <h1 class="page-title">My Profile</h1>
            </div>
            <div style="text-align: center; padding: 40px;">
                <h3>Tenant Profile</h3>
                <p>Manage your personal information and account settings.</p>
                <p><em>Profile management coming soon!</em></p>
            </div>
        </div>
        `;
    }

    // Add this method - returns just the dashboard content, not the full layout
    getDashboardContentHTML() {
        const isLandlord = this.currentRole === 'landlord';
        
        if (isLandlord) {
            return this.getLandlordDashboardHTML();
        } else {
            return this.getTenantDashboardHTML();
        }
    }

    getLandlordDashboardHTML() {
        return `
            <div class="page-content">
                <div class="page-header">
                    <h1 class="page-title">Welcome to Your Dashboard</h1>
                    <div>
                        <button class="btn btn-secondary"><i class="fas fa-download"></i> Export Report</button>
                        <button class="btn btn-primary" id="addPropertyBtn"><i class="fas fa-plus"></i> Add Property</button>
                    </div>
                </div>

                <!-- PROPERTY OVERVIEW SECTION -->
                <div class="card-group-title">Property Overview</div>
                <div class="card-group">
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Occupancy Rate</div>
                            <div class="card-icon occupied"><i class="fas fa-home"></i></div>
                        </div>
                        <div class="card-value" id="occupancyRate">0%</div>
                        <div class="card-subtitle" id="occupancyDetails">0/22 units</div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Vacant Units</div>
                            <div class="card-icon vacant"><i class="fas fa-door-open"></i></div>
                        </div>
                        <div class="card-value" id="vacantUnits">0</div>
                        <div class="card-subtitle">22 total capacity</div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Total Tenants</div>
                            <div class="card-icon tenants"><i class="fas fa-users"></i></div>
                        </div>
                        <div class="card-value" id="totalTenants">0</div>
                        <div class="card-subtitle">Active & verified</div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Avg Monthly Rent</div>
                            <div class="card-icon revenue"><i class="fas fa-money-bill-wave"></i></div>
                        </div>
                        <div class="card-value" id="averageRent">₱0</div>
                        <div class="card-subtitle">Per unit</div>
                    </div>
                </div>

                <!-- FINANCIAL OVERVIEW SECTION -->
                <div class="card-group-title">Financial Overview</div>
                <div class="card-group">
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Rent Collection</div>
                            <div class="card-icon collection"><i class="fas fa-chart-line"></i></div>
                        </div>
                        <div class="card-value" id="collectionRate">0%</div>
                        <div class="card-subtitle">This month</div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Monthly Revenue</div>
                            <div class="card-icon revenue"><i class="fas fa-cash-register"></i></div>
                        </div>
                        <div class="card-value" id="monthlyRevenue">₱0</div>
                        <div class="card-subtitle">Current month</div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Late Payments</div>
                            <div class="card-icon late"><i class="fas fa-clock"></i></div>
                        </div>
                        <div class="card-value" id="latePayments">0</div>
                        <div class="card-subtitle">Overdue rent</div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Unpaid Bills</div>
                            <div class="card-icon unpaid"><i class="fas fa-money-bill-wave"></i></div>
                        </div>
                        <div class="card-value" id="unpaidBills">0</div>
                        <div class="card-subtitle">Pending payments</div>
                    </div>
                </div>

                <!-- OPERATIONS SECTION -->
                <div class="card-group-title">Operations</div>
                <div class="card-group">
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Lease Renewals</div>
                            <div class="card-icon renewals"><i class="fas fa-calendar-alt"></i></div>
                        </div>
                        <div class="card-value" id="upcomingRenewals">0</div>
                        <div class="card-subtitle">Next 30 days</div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Open Maintenance</div>
                            <div class="card-icon maintenance"><i class="fas fa-tools"></i></div>
                        </div>
                        <div class="card-value" id="openMaintenance">0</div>
                        <div class="card-subtitle">New requests</div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Maintenance Backlog</div>
                            <div class="card-icon backlog"><i class="fas fa-list-alt"></i></div>
                        </div>
                        <div class="card-value" id="maintenanceBacklog">0</div>
                        <div class="card-subtitle">Pending work</div>
                    </div>
                </div>

                <!-- QUICK ACTIONS SECTION -->
                <div class="card-group-title">Quick Actions</div>
                <div class="card-group">
                    <div class="card quick-action-card" onclick="casaLink.showPage('tenants')">
                        <div class="card-header">
                            <div class="card-title">Manage Tenants</div>
                            <div class="card-icon tenants"><i class="fas fa-users"></i></div>
                        </div>
                        <p>View and manage all your tenants</p>
                        <div class="quick-action-link">
                            Go to Tenants <i class="fas fa-arrow-right"></i>
                        </div>
                    </div>
                    
                    <div class="card quick-action-card" onclick="casaLink.showPage('billing')">
                        <div class="card-header">
                            <div class="card-title">Billing & Payments</div>
                            <div class="card-icon revenue"><i class="fas fa-file-invoice-dollar"></i></div>
                        </div>
                        <p>Generate bills and track payments</p>
                        <div class="quick-action-link">
                            Go to Billing <i class="fas fa-arrow-right"></i>
                        </div>
                    </div>
                    
                    <div class="card quick-action-card" onclick="casaLink.showPage('maintenance')">
                        <div class="card-header">
                            <div class="card-title">Maintenance</div>
                            <div class="card-icon maintenance"><i class="fas fa-tools"></i></div>
                        </div>
                        <p>Handle maintenance requests</p>
                        <div class="quick-action-link">
                            Go to Maintenance <i class="fas fa-arrow-right"></i>
                        </div>
                    </div>

                    <div class="card quick-action-card" onclick="casaLink.showAddTenantForm()">
                        <div class="card-header">
                            <div class="card-title">Add New Tenant</div>
                            <div class="card-icon tenants"><i class="fas fa-user-plus"></i></div>
                        </div>
                        <p>Create a new tenant account</p>
                        <div class="quick-action-link">
                            Add Tenant <i class="fas fa-arrow-right"></i>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getTenantDashboardHTML() {
        return `
            <div class="page-content">
                <div class="page-header">
                    <h1 class="page-title">Welcome to Your Dashboard</h1>
                    <div>
                        <button class="btn btn-primary" id="payRentBtn" onclick="casaLink.showPaymentModal()">
                            <i class="fas fa-credit-card"></i> Pay Rent
                        </button>
                    </div>
                </div>

                <!-- ACCOUNT OVERVIEW SECTION -->
                <div class="card-group-title">Account Overview</div>
                <div class="card-group">
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Current Balance</div>
                            <div class="card-icon revenue"><i class="fas fa-wallet"></i></div>
                        </div>
                        <div class="card-value" id="currentBalance">₱0</div>
                        <div class="card-subtitle" id="balanceDueDate">Due in 0 days</div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Payment Status</div>
                            <div class="card-icon collection"><i class="fas fa-check-circle"></i></div>
                        </div>
                        <div class="card-value" id="paymentStatus">Current</div>
                        <div class="card-subtitle" id="paymentStatusDetails">Up to date</div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Room Number</div>
                            <div class="card-icon occupied"><i class="fas fa-home"></i></div>
                        </div>
                        <div class="card-value" id="roomNumber">N/A</div>
                        <div class="card-subtitle">Your unit</div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Monthly Rent</div>
                            <div class="card-icon revenue"><i class="fas fa-money-bill-wave"></i></div>
                        </div>
                        <div class="card-value" id="monthlyRent">₱0</div>
                        <div class="card-subtitle">Monthly payment</div>
                    </div>
                </div>

                <!-- BILLING & PAYMENTS SECTION -->
                <div class="card-group-title">Billing & Payments</div>
                <div class="card-group">
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Pending Bills</div>
                            <div class="card-icon unpaid"><i class="fas fa-file-invoice"></i></div>
                        </div>
                        <div class="card-value" id="pendingBills">0</div>
                        <div class="card-subtitle">Unpaid invoices</div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Next Due Date</div>
                            <div class="card-icon late"><i class="fas fa-calendar-day"></i></div>
                        </div>
                        <div class="card-value" id="nextDueDate">N/A</div>
                        <div class="card-subtitle">Upcoming payment</div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Last Payment</div>
                            <div class="card-icon success"><i class="fas fa-receipt"></i></div>
                        </div>
                        <div class="card-value" id="lastPaymentAmount">₱0</div>
                        <div class="card-subtitle" id="lastPaymentDate">No payments</div>
                    </div>
                </div>

                <!-- MAINTENANCE SECTION -->
                <div class="card-group-title">Maintenance</div>
                <div class="card-group">
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Open Requests</div>
                            <div class="card-icon maintenance"><i class="fas fa-tools"></i></div>
                        </div>
                        <div class="card-value" id="openRequests">0</div>
                        <div class="card-subtitle">Active maintenance</div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Recent Updates</div>
                            <div class="card-icon renewals"><i class="fas fa-bell"></i></div>
                        </div>
                        <div class="card-value" id="recentUpdates">0</div>
                        <div class="card-subtitle">New notifications</div>
                    </div>
                </div>

                <!-- QUICK ACTIONS SECTION -->
                <div class="card-group-title">Quick Actions</div>
                <div class="card-group">
                    <div class="card quick-action-card" onclick="casaLink.showPage('tenantBilling')">
                        <div class="card-header">
                            <div class="card-title">View Bills</div>
                            <div class="card-icon revenue"><i class="fas fa-file-invoice-dollar"></i></div>
                        </div>
                        <p>Check your billing history and invoices</p>
                        <div class="quick-action-link">
                            View Bills <i class="fas fa-arrow-right"></i>
                        </div>
                    </div>
                    
                    <div class="card quick-action-card" onclick="casaLink.showPaymentModal()">
                        <div class="card-header">
                            <div class="card-title">Make Payment</div>
                            <div class="card-icon success"><i class="fas fa-credit-card"></i></div>
                        </div>
                        <p>Pay your rent or outstanding balance</p>
                        <div class="quick-action-link">
                            Pay Now <i class="fas fa-arrow-right"></i>
                        </div>
                    </div>
                    
                    <div class="card quick-action-card" onclick="casaLink.showPage('tenantMaintenance')">
                        <div class="card-header">
                            <div class="card-title">Maintenance</div>
                            <div class="card-icon maintenance"><i class="fas fa-tools"></i></div>
                        </div>
                        <p>Submit or track maintenance requests</p>
                        <div class="quick-action-link">
                            View Requests <i class="fas fa-arrow-right"></i>
                        </div>
                    </div>

                    <div class="card quick-action-card" onclick="casaLink.showMaintenanceRequestForm()">
                        <div class="card-header">
                            <div class="card-title">New Request</div>
                            <div class="card-icon backlog"><i class="fas fa-plus-circle"></i></div>
                        </div>
                        <p>Submit a new maintenance request</p>
                        <div class="quick-action-link">
                            Submit Request <i class="fas fa-arrow-right"></i>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    setupPageEvents(page) {
        switch (page) {
            case 'dashboard':
                this.setupDashboardEvents();
                break;
            case 'billing':
                this.setupBillingPage();
                break;
            case 'tenants':
                this.setupTenantsPage();
                break;
            case 'maintenance':
                this.setupMaintenancePage();
                break;
        }
    }

    async setupTenantsPage() {
        // Add tenant button
        document.getElementById('addTenantBtn')?.addEventListener('click', () => {
            this.showAddTenantForm();
        });

        // Search functionality
        document.getElementById('tenantSearch')?.addEventListener('input', (e) => {
            this.filterTenants(e.target.value);
        });

        // Load tenants data
        await this.loadTenantsData();
    }

    async loadTenantsData() {
        try {
            console.log('Loading tenants data...');
            const tenantsList = document.getElementById('tenantsList');
            
            if (!tenantsList) {
                console.error('Tenants list element not found');
                return;
            }

            // Show loading state
            tenantsList.innerHTML = `
                <div class="data-loading">
                    <i class="fas fa-spinner fa-spin"></i> Loading tenants...
                </div>
            `;

            // Fetch tenants from Firestore where role is 'tenant' and landlordId matches current user
            const tenants = await DataManager.getTenants(this.currentUser.uid);
            
            console.log('Raw tenants data:', tenants);
            
            // Fetch lease data for each tenant to get room numbers
            const tenantsWithLeaseData = await Promise.all(
                tenants.map(async (tenant) => {
                    console.log(`Processing tenant: ${tenant.name}, Lease ID: ${tenant.leaseId}`);
                    
                    let roomNumber = 'N/A';
                    let rentalAddress = 'N/A';
                    
                    // Try to get room number from lease document
                    if (tenant.leaseId) {
                        try {
                            const leaseDoc = await firebaseDb.collection('leases').doc(tenant.leaseId).get();
                            if (leaseDoc.exists) {
                                const leaseData = leaseDoc.data();
                                roomNumber = leaseData.roomNumber || 'N/A';
                                rentalAddress = leaseData.rentalAddress || 'N/A';
                                console.log(`Found lease data for ${tenant.name}:`, { roomNumber, rentalAddress });
                            } else {
                                console.log(`Lease document ${tenant.leaseId} not found for tenant ${tenant.name}`);
                            }
                        } catch (error) {
                            console.error(`Error fetching lease for tenant ${tenant.id}:`, error);
                        }
                    } else {
                        console.log(`No leaseId found for tenant ${tenant.name}`);
                        
                        // Alternative: Try to find lease by tenantId
                        try {
                            const leaseQuery = await firebaseDb.collection('leases')
                                .where('tenantId', '==', tenant.id)
                                .where('isActive', '==', true)
                                .limit(1)
                                .get();
                                
                            if (!leaseQuery.empty) {
                                const leaseData = leaseQuery.docs[0].data();
                                roomNumber = leaseData.roomNumber || 'N/A';
                                rentalAddress = leaseData.rentalAddress || 'N/A';
                                console.log(`Found lease by tenantId for ${tenant.name}:`, { roomNumber, rentalAddress });
                                
                                // Update user document with leaseId for future reference
                                await firebaseDb.collection('users').doc(tenant.id).update({
                                    leaseId: leaseQuery.docs[0].id
                                });
                            }
                        } catch (queryError) {
                            console.error(`Error querying lease by tenantId for ${tenant.id}:`, queryError);
                        }
                    }
                    
                    return {
                        ...tenant,
                        roomNumber: roomNumber,
                        rentalAddress: rentalAddress
                    };
                })
            );
            
            console.log('Tenants fetched with lease data:', tenantsWithLeaseData);
            
            if (tenantsWithLeaseData.length === 0) {
                tenantsList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <h3>No Tenants Found</h3>
                        <p>You haven't added any tenants yet. Click "Add Tenant" to get started.</p>
                    </div>
                `;
            } else {
                tenantsList.innerHTML = this.renderTenantsTable(tenantsWithLeaseData);
            }

        } catch (error) {
            console.error('Error loading tenants:', error);
            const tenantsList = document.getElementById('tenantsList');
            if (tenantsList) {
                tenantsList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Error Loading Tenants</h3>
                        <p>There was an error loading your tenants. Please try again.</p>
                        <button class="btn btn-primary" onclick="casaLink.loadTenantsData()">Retry</button>
                    </div>
                `;
            }
        }
    }

    renderTenantsTable(tenants) {
        return `
            <div class="table-container">
                <table class="tenants-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Room/Unit</th>
                            <th>Address</th>
                            <th>Account Status</th>
                            <th>Verification Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tenants.map(tenant => `
                            <tr>
                                <td>
                                    <div class="tenant-info">
                                        <div class="tenant-avatar">${tenant.name.charAt(0).toUpperCase()}</div>
                                        <div class="tenant-details">
                                            <div class="tenant-name">${tenant.name}</div>
                                            <div class="tenant-occupation" style="font-size: 0.8rem; color: var(--dark-gray);">
                                                ${tenant.occupation || 'No occupation specified'}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td>${tenant.email}</td>
                                <td>${tenant.phone || 'N/A'}</td>
                                <td>
                                    <strong>${tenant.roomNumber}</strong>
                                </td>
                                <td>
                                    <small style="color: var(--dark-gray);">${tenant.rentalAddress}</small>
                                </td>
                                <td>
                                    <span class="status-badge ${tenant.isActive ? 'active' : 'inactive'}">
                                        ${tenant.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                    ${tenant.hasTemporaryPassword ? '<span class="status-badge warning" title="Needs password change">Password Reset</span>' : ''}
                                </td>
                                <td>
                                    <span class="status-badge ${tenant.status === 'verified' ? 'active' : 'warning'}">
                                        ${tenant.status === 'verified' ? 'Verified' : 'Unverified'}
                                    </span>
                                </td>
                                <td>
                                    <div class="action-buttons">
                                        <button class="btn btn-sm btn-secondary" onclick="casaLink.editTenant('${tenant.id}')">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="btn btn-sm btn-secondary" onclick="casaLink.sendMessage('${tenant.id}')">
                                            <i class="fas fa-envelope"></i>
                                        </button>
                                        <button class="btn btn-sm btn-danger" onclick="casaLink.deleteTenant('${tenant.id}')">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    setupMaintenancePage() {
        // Assign staff button
        document.getElementById('assignStaffBtn')?.addEventListener('click', () => {
            this.showAssignStaffForm();
        });
    }

    filterTenants(searchTerm) {
        const rows = document.querySelectorAll('.tenants-table tbody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm.toLowerCase()) ? '' : 'none';
        });
    }

    setupBillingPage() {
        // Generate bill button
        document.getElementById('generateBillBtn')?.addEventListener('click', () => {
            this.showGenerateBillForm();
        });

        // Search functionality
        document.getElementById('billSearch')?.addEventListener('input', (e) => {
            this.filterBills(e.target.value);
        });

        // Real-time bills listener
        this.setupBillsListener();
    }

    setupDashboardEvents() {
        console.log('🔄 Setting up dashboard events with fresh data...');
        
        // Add Property Button
        document.getElementById('addPropertyBtn')?.addEventListener('click', () => {
            this.showAddPropertyForm();
        });

        // ALWAYS setup real-time stats when dashboard is shown
        this.setupRealTimeStats();
        
        // Update navigation to show dashboard as active
        this.updateActiveNavState('dashboard');
        
        // Force load dashboard data immediately
        this.loadDashboardData();
    }

    setupNavigationEvents() {
        // This will handle navigation between pages
        document.addEventListener('click', (e) => {
            // Handle navigation links
            if (e.target.matches('[data-page]') || e.target.closest('[data-page]')) {
                e.preventDefault();
                const page = e.target.getAttribute('data-page') || 
                        e.target.closest('[data-page]').getAttribute('data-page');
                console.log('🧭 Navigation to:', page);
                
                // If navigating to dashboard, it will clear the stored page
                this.showPage(page);
            }

            // Handle logout
            if (e.target.matches('#logoutBtn') || e.target.closest('#logoutBtn')) {
                e.preventDefault();
                this.handleLogout();
            }
        });
    }

    updateActiveNavState(activePage) {
        // Update header nav
        const headerNavLinks = document.querySelectorAll('.nav-links a');
        headerNavLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-page') === activePage) {
                link.classList.add('active');
            }
        });

        // Update sidebar nav
        const sidebarLinks = document.querySelectorAll('.sidebar-menu a');
        sidebarLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-page') === activePage) {
                link.classList.add('active');
            }
        });
    }

    // Update URL hash with current page
    updateUrlHash(page) {
        if (page && page !== 'dashboard') {
            window.location.hash = page;
            console.log('🔗 Updated URL hash:', page);
        } else {
            // Clear hash for dashboard
            if (window.location.hash) {
                window.location.hash = '';
                console.log('🔗 Cleared URL hash (dashboard)');
            }
        }
    }

    // Read page from URL hash
    getPageFromHash() {
        const hash = window.location.hash.replace('#', '');
        if (hash && hash !== 'dashboard') {
            // Validate the page from hash
            const isValidPage = this.isValidPageForRole(hash);
            if (isValidPage) {
                console.log('🔗 Retrieved valid page from URL hash:', hash);
                return hash;
            } else {
                console.log('🔗 Invalid page in URL hash, ignoring:', hash);
                return null;
            }
        }
        console.log('🔗 No valid page in URL hash');
        return null;
    }

    async handleLogout() {
        try {
            console.log('🚪 Starting manual logout...');
            
            // Set flag to ignore auth changes during logout
            this.manualLogoutInProgress = true;
            
            // Set force logout flag for next page load
            localStorage.setItem('force_logout', 'true');
            
            // Remove event listeners
            this.removeLoginEvents();
            
            // Clear all stored data
            this.clearStoredPage();
            localStorage.removeItem('casalink_user');
            localStorage.removeItem('casalink_pending_actions');
            
            // Sign out from Firebase
            await AuthManager.logout();
            
            // Reset app state
            this.currentUser = null;
            this.currentRole = null;
            this.currentPage = 'dashboard';
            
            console.log('✅ User logged out successfully');
            
            // MANUALLY show login page
            this.showLogin();
            
            // Re-enable auth listener after a short delay
            setTimeout(() => {
                this.manualLogoutInProgress = false;
                console.log('🔓 Auth listener re-enabled after logout');
            }, 2000);
            
        } catch (error) {
            console.error('❌ Logout error:', error);
            this.manualLogoutInProgress = false;
            this.currentUser = null;
            this.currentRole = null;
            this.currentPage = 'dashboard';
            this.showLogin();
        }
    }

    preventAutoRedirect() {
        // Only prevent auto-redirects in specific cases, not on every page load
        const hasForceLogout = localStorage.getItem('force_logout') === 'true';
        const hasLoginError = sessionStorage.getItem('login_error') === 'true';
        
        if (hasForceLogout || hasLoginError) {
            console.log('🛑 Safety check: Preventing auto-redirect due to error condition');
            this.clearStoredAuth();
            sessionStorage.removeItem('login_error');
        }
        
        // Ensure we're showing the appropriate page
        const appElement = document.getElementById('app');
        if (appElement && !appElement.innerHTML.includes('login-container') && 
            !appElement.innerHTML.includes('app-container')) {
            console.log('🔄 Ensuring appropriate page is displayed');
            // Don't force login page - let auth listener handle it
        }
    }

    setupPWAFeatures() {
        // Initialize notification manager
        if (window.NotificationManager) {
            NotificationManager.init();
        }

        // Setup periodic tasks
        this.setupPeriodicTasks();
    }

    async syncOfflineData() {
        // Sync any pending actions
        const pendingActions = JSON.parse(localStorage.getItem('casalink_pending_actions') || '[]');
        
        for (const action of pendingActions) {
            try {
                await this.processPendingAction(action);
                // Remove successful action
                this.removePendingAction(action);
            } catch (error) {
                console.error('Failed to sync action:', action, error);
            }
        }
    }

    storePendingAction(action) {
        const pendingActions = JSON.parse(localStorage.getItem('casalink_pending_actions') || '[]');
        pendingActions.push({
            ...action,
            id: Date.now().toString(),
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('casalink_pending_actions', JSON.stringify(pendingActions));
        
        // Update UI
        this.updateSyncIndicator();
    }

    removePendingAction(action) {
        const pendingActions = JSON.parse(localStorage.getItem('casalink_pending_actions') || '[]');
        const index = pendingActions.findIndex(a => a.id === action.id);
        if (index > -1) {
            pendingActions.splice(index, 1);
            localStorage.setItem('casalink_pending_actions', JSON.stringify(pendingActions));
        }
        this.updateSyncIndicator();
    }

    updateSyncIndicator() {
        const pendingActions = JSON.parse(localStorage.getItem('casalink_pending_actions') || '[]');
        const syncIndicator = document.getElementById('syncStatus');
        
        if (syncIndicator) {
            if (pendingActions.length > 0) {
                syncIndicator.innerHTML = `<i class="fas fa-sync-alt"></i> ${pendingActions.length}`;
                syncIndicator.style.display = 'flex';
            } else {
                syncIndicator.style.display = 'none';
            }
        }
    }

    setupPeriodicTasks() {
        // Check for due bills daily
        setInterval(() => {
            this.checkDueBills();
        }, 24 * 60 * 60 * 1000); // 24 hours

        // Check for maintenance updates hourly
        setInterval(() => {
            this.checkMaintenanceUpdates();
        }, 60 * 60 * 1000); // 1 hour
    }

    async checkDueBills() {
        if (this.currentRole === 'tenant') {
            const bills = await DataManager.getTenantBills(this.currentUser.tenantId || this.currentUser.uid);
            const dueBills = bills.filter(bill => 
                bill.status === 'pending' && 
                new Date(bill.dueDate) <= new Date()
            );

            if (dueBills.length > 0 && window.NotificationManager) {
                dueBills.forEach(bill => {
                    NotificationManager.notifyRentDue(bill);
                });
            }
        }
    }

    async checkMaintenanceUpdates() {
        if (this.currentRole === 'tenant') {
            const requests = await DataManager.getTenantMaintenanceRequests(this.currentUser.tenantId || this.currentUser.uid);
            const updatedRequests = requests.filter(req => 
                new Date(req.updatedAt) > new Date(Date.now() - 60 * 60 * 1000)
            );

            if (updatedRequests.length > 0 && window.NotificationManager) {
                updatedRequests.forEach(request => {
                    this.showNotification(`Update on your ${request.type} request`, 'info');
                });
            }
        }
    }

    setupOfflineHandling() {
        // Listen for online/offline events
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showNotification('Back online! Syncing data...', 'success');
            this.syncOfflineData();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showNotification('You are offline. Some features may be limited.', 'warning');
        });

        // Store pending actions when offline
        this.originalDataManagerMethods = {
            addTenant: DataManager.addTenant,
            createBill: DataManager.createBill,
            submitMaintenanceRequest: DataManager.submitMaintenanceRequest,
            recordPayment: DataManager.recordPayment
        };
    }

    setupAuthListener() {
        console.log('🔐 Setting up auth state listener...');
        
        this.authUnsubscribe = AuthManager.onAuthChange(async (user) => {
            // Skip if auth listener is disabled OR during tenant creation OR app not initialized
            if (!this.authListenerEnabled || this.creatingTenant || !this.appInitialized) {
                console.log('🔒 Auth listener conditions not met:', {
                    authListenerEnabled: this.authListenerEnabled,
                    creatingTenant: this.creatingTenant,
                    appInitialized: this.appInitialized
                });
                return;
            }
            
            console.log('🔄 Auth state changed:', user ? `User found: ${user.email}` : 'No user');
            
            // Hide loading spinner
            const spinner = document.getElementById('loadingSpinner');
            if (spinner) {
                spinner.style.display = 'none';
            }
            
            if (user) {
                console.log('✅ Authenticated user detected:', user.email);
                console.log('📊 User status:', {
                    role: user.role,
                    requiresPasswordChange: user.requiresPasswordChange,
                    hasTemporaryPassword: user.hasTemporaryPassword,
                    passwordChanged: user.passwordChanged,
                    status: user.status
                });
                
                // Validate user data
                if (!user.role || !user.email || !user.id) {
                    console.error('❌ Invalid user data');
                    this.showNotification('Session invalid. Please log in again.', 'error');
                    AuthManager.logout();
                    return;
                }
                
                this.currentUser = user;
                this.currentRole = user.role;
                
                console.log('🔄 Restoring session for:', user.email);
                
                // Handle user based on their status
                if (user.requiresPasswordChange && user.hasTemporaryPassword) {
                    console.log('🔐 Password change required - showing modal');
                    setTimeout(() => {
                        this.showPasswordChangeModal();
                    }, 1000);
                } else if (user.role === 'tenant' && user.passwordChanged && user.status === 'unverified') {
                    console.log('📝 Password changed but not verified - showing lease agreement');
                    setTimeout(() => {
                        this.showLeaseAgreementVerification();
                    }, 1000);
                } else {
                    console.log('🏠 No special requirements - showing stored page');
                    
                    // Get the page from URL hash first, then localStorage, then default to dashboard
                    const hashPage = this.getPageFromHash();
                    const storedPage = this.getStoredPage();
                    
                    // Default to dashboard if no valid page is found
                    const targetPage = hashPage || storedPage || 'dashboard';
                    
                    console.log('🎯 Page selection:', {
                        hashPage: hashPage,
                        storedPage: storedPage,
                        targetPage: targetPage
                    });
                    
                    // Small delay to ensure DOM is ready
                    setTimeout(() => {
                        this.showPage(targetPage);
                    }, 300);
                }
            } else {
                console.log('👤 No user detected - showing login page');
                this.currentUser = null;
                this.currentRole = null;
                this.clearStoredPage(); // Clear page storage on logout
                
                // Small delay to ensure DOM is ready
                setTimeout(() => {
                    this.showLogin();
                }, 300);
            }
        });
    }

    async loadDashboardData() {
        try {
            console.log('🔄 Loading FRESH dashboard data...');
            const stats = await DataManager.getDashboardStats(this.currentUser.uid, this.currentRole);
            console.log('📊 Fresh dashboard stats:', stats);
            this.updateDashboardWithRealData(stats);
        } catch (error) {
            console.log('❌ Dashboard data loading failed:', error);
            // Show error state in the cards
            this.showDashboardErrorState();
        }
    }

    showDashboardErrorState() {
        const cards = document.querySelectorAll('.dashboard-cards .card');
        cards.forEach(card => {
            const changeElement = card.querySelector('.card-change');
            if (changeElement) {
                changeElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <span>Failed to load</span>';
                changeElement.className = 'card-change negative';
            }
        });
    }

    async updateBillsTable(bills) {
        const tenants = await DataManager.getTenants(this.currentUser.uid);
        const tableElement = document.getElementById('billsTable');
    
        if (tableElement) {
            tableElement.innerHTML = this.renderBillsTable(bills, tenants);
        }
    }

    setupBillingPage() {
        // Generate bill button
        document.getElementById('generateBillBtn')?.addEventListener('click', () => {
            this.showGenerateBillForm();
        });

        // Search functionality
        document.getElementById('billSearch')?.addEventListener('input', (e) => {
            this.filterBills(e.target.value);
        });

        // Real-time bills listener
        this.setupBillsListener();
    }

    async setupBillsListener() {
        this.billsUnsubscribe = DataManager.listenToBills(
            this.currentUser.uid,
            (bills) => this.updateBillsTable(bills)
        );
    }

    filterBills(searchTerm) {
        const rows = document.querySelectorAll('#billsTable tbody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm.toLowerCase()) ? '' : 'none';
        });
    }

    showLogin() {
        // Prevent multiple simultaneous calls
        if (this.showingLogin) {
            console.log('🛑 Login page already being shown, skipping...');
            return;
        }
        
        this.showingLogin = true;
        console.log('🔄 Showing login page...');
        
        const appElement = document.getElementById('app');
        if (appElement) {
            // Prevent duplicate login page rendering
            if (appElement.innerHTML.includes('login-container')) {
                console.log('✅ Login page already displayed, skipping render');
                this.showingLogin = false;
                return;
            }
            
            appElement.innerHTML = this.getLoginHTML();
            
            // Small delay to ensure DOM is ready
            setTimeout(() => {
                try {
                    this.setupLoginEvents();
                    console.log('✅ Login events setup complete');
                } catch (error) {
                    console.error('❌ Error setting up login events:', error);
                } finally {
                    this.showingLogin = false;
                }
            }, 50);
        } else {
            this.showingLogin = false;
        }
    }

    showDashboard() {
        // Prevent multiple simultaneous dashboard renders
        if (this.showingDashboard) {
            console.log('🛑 Dashboard already being shown, skipping...');
            return;
        }
        
        this.showingDashboard = true;
        console.log('🔄 showDashboard() called for:', this.currentUser?.email);
        
        const appElement = document.getElementById('app');
        if (appElement) {
            try {
                console.log('🏠 Rendering COMPLETE dashboard with content');
                
                // RENDER THE DASHBOARD DIRECTLY - NO ASYNC CALLS
                appElement.innerHTML = this.getDashboardHTML();
                
                // Setup dashboard events
                this.setupDashboardEvents();
                console.log('✅ Dashboard rendered successfully with content');
                
                // Load real data in background
                setTimeout(() => {
                    this.loadDashboardData();
                }, 100);
                
            } catch (error) {
                console.error('❌ Error in showDashboard:', error);
                // Ultimate fallback - show basic interface
                this.showBasicInterface();
            } finally {
                this.showingDashboard = false;
            }
        } else {
            this.showingDashboard = false;
        }
    }

    // ADD THIS METHOD - Direct HTML without any async operations
    getDashboardHTML() {
        const isLandlord = this.currentRole === 'landlord';
        const userName = this.currentUser?.name || 'User';
        const userAvatar = this.currentUser?.avatar || 'U';
        
        return `
        <div class="app-container">
            <header>
                <div class="container">
                    <div class="header-content">
                        <div class="logo">
                            <i class="fas fa-home"></i>
                            <span>CasaLink</span>
                        </div>
                        
                        <nav class="nav-links ${isLandlord ? 'landlord-nav' : 'tenant-nav'}">
                            ${isLandlord ? `
                                <a href="#" class="active" data-page="dashboard">Dashboard</a>
                                <a href="#" data-page="billing">Billing & Payments</a>
                                <a href="#" data-page="maintenance">Maintenance</a>
                                <a href="#" data-page="tenants">Tenant Management</a>
                                <a href="#" data-page="reports">Reports</a>
                            ` : `
                                <a href="#" class="active" data-page="dashboard">Dashboard</a>
                                <a href="#" data-page="tenantBilling">Billing & Payments</a>
                                <a href="#" data-page="tenantMaintenance">Maintenance</a>
                                <a href="#" data-page="tenantProfile">My Profile</a>
                            `}
                        </nav>
                        
                        <div class="header-actions">
                            <div class="user-profile" id="userProfile">
                                <div class="avatar">${userAvatar}</div>
                                <div>
                                    <div style="font-weight: 500;">${userName}</div>
                                    <div style="font-size: 0.8rem; color: var(--dark-gray);">
                                        ${isLandlord ? 'Landlord' : 'Tenant'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div class="main-content">
                <aside class="sidebar">
                    <ul class="sidebar-menu ${isLandlord ? 'landlord-nav' : 'tenant-nav'}">
                        ${isLandlord ? `
                            <li><a href="#" class="active" data-page="dashboard"><i class="fas fa-th-large"></i> <span>Dashboard</span></a></li>
                            <li><a href="#" data-page="billing"><i class="fas fa-file-invoice-dollar"></i> <span>Billing & Payments</span></a></li>
                            <li><a href="#" data-page="maintenance"><i class="fas fa-tools"></i> <span>Maintenance</span></a></li>
                            <li><a href="#" data-page="tenants"><i class="fas fa-users"></i> <span>Tenant Management</span></a></li>
                            <li><a href="#" data-page="reports"><i class="fas fa-chart-pie"></i> <span>Reports</span></a></li>
                            <li><a href="#" id="logoutBtn"><i class="fas fa-sign-out-alt"></i> <span>Logout</span></a></li>
                        ` : `
                            <li><a href="#" class="active" data-page="dashboard"><i class="fas fa-th-large"></i> <span>Dashboard</span></a></li>
                            <li><a href="#" data-page="tenantBilling"><i class="fas fa-file-invoice-dollar"></i> <span>Billing & Payments</span></a></li>
                            <li><a href="#" data-page="tenantMaintenance"><i class="fas fa-tools"></i> <span>Maintenance</span></a></li>
                            <li><a href="#" data-page="tenantProfile"><i class="fas fa-user"></i> <span>My Profile</span></a></li>
                            <li><a href="#" id="logoutBtn"><i class="fas fa-sign-out-alt"></i> <span>Logout</span></a></li>
                        `}
                    </ul>
                </aside>

                <main class="content-area" id="contentArea">
                    ${this.getDashboardContentHTML()}
                </main>
            </div>
        </div>
        `;
    }


    testDashboardNavigation() {
        console.log('🧪 Testing dashboard navigation...');
        console.log('Current role:', this.currentRole);
        console.log('Current page:', this.currentPage);
        
        // Force refresh the dashboard
        this.showPage('dashboard');
    }

    // Add this emergency fallback method
    showBasicInterface() {
        const appElement = document.getElementById('app');
        if (appElement) {
            appElement.innerHTML = `
                <div style="min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; text-align: center;">
                    <div class="logo" style="margin-bottom: 30px;">
                        <i class="fas fa-home" style="font-size: 3rem; color: #1A73E8;"></i>
                        <h1 style="font-size: 2rem; color: #1A73E8; margin-top: 10px;">CasaLink</h1>
                    </div>
                    
                    <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; width: 100%;">
                        <h2 style="margin-bottom: 20px;">Welcome back!</h2>
                        <p style="margin-bottom: 30px; color: #5F6368;">You are successfully logged in as ${this.currentUser?.name || 'User'}</p>
                        
                        <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                            <button class="btn btn-primary" onclick="casaLink.showPage('dashboard')" style="min-width: 150px;">
                                <i class="fas fa-th-large"></i> Go to Dashboard
                            </button>
                            <button class="btn btn-secondary" onclick="casaLink.handleLogout()" style="min-width: 150px;">
                                <i class="fas fa-sign-out-alt"></i> Logout
                            </button>
                        </div>
                    </div>
                    
                    <div style="margin-top: 30px; color: #5F6368; font-size: 0.9rem;">
                        <p>If the dashboard doesn't load, please refresh the page or contact support.</p>
                    </div>
                </div>
            `;
        }
    }

    // Login and registration methods
    getLoginHTML() {
        return `
        <div class="login-container">
            <div class="login-left">
                <div class="login-content">
                    <div class="login-logo">
                        <i class="fas fa-home"></i>
                        <span>CasaLink</span>
                    </div>
                    <h1 class="login-title">Smart Living, Simplified</h1>
                    <p class="login-subtitle">Manage your properties and tenant relationships with our modern platform</p>
                    <ul class="login-features">
                        <li><i class="fas fa-check-circle"></i> Automated billing & payments</li>
                        <li><i class="fas fa-check-circle"></i> Maintenance request tracking</li>
                        <li><i class="fas fa-check-circle"></i> Real-time communication</li>
                        <li><i class="fas fa-check-circle"></i> Secure tenant portal</li>
                    </ul>
                </div>
            </div>
            <div class="login-right">
                <div class="login-form" id="loginForm">
                    <h2 class="form-title">Welcome Back</h2>
                    <p class="form-subtitle">Sign in to your account</p>
                    
                    <!-- Role Selection -->
                    <div class="form-group">
                        <label class="form-label">I am a:</label>
                        <div class="role-selection">
                            <div class="role-option active" data-role="tenant">
                                <i class="fas fa-user role-icon"></i>
                                <div>Tenant</div>
                            </div>
                            <div class="role-option" data-role="landlord">
                                <i class="fas fa-building role-icon"></i>
                                <div>Landlord</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="email">Email</label>
                        <input type="email" id="email" class="form-input" placeholder="your.email@example.com">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="password">Password</label>
                        <input type="password" id="password" class="form-input" placeholder="Enter your password">
                    </div>
                    
                    <div class="form-group">
                        <button class="btn btn-primary" id="loginBtn" style="width: 100%;">
                            <i class="fas fa-sign-in-alt"></i> Sign In
                        </button>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px; color: var(--dark-gray);">
                        <small>Don't have an account? Contact your landlord for credentials.</small>
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    setupLoginEvents() {
        console.log('Setting up login events...');
        
        // Remove any existing event listeners first
        this.removeLoginEvents();
        
        // Use event delegation with proper once handling
        document.addEventListener('click', this.boundLoginClickHandler);
        document.addEventListener('keypress', this.boundLoginKeypressHandler);
        
        console.log('Login events setup complete');
    }

    removeLoginEvents() {
        // Remove event listeners by replacing the handlers
        document.removeEventListener('click', this.boundLoginClickHandler);
        document.removeEventListener('keypress', this.boundLoginKeypressHandler);
        
        console.log('Previous login events removed');
    }

    loginClickHandler(e) {
        // Handle role selection
        if (e.target.closest('.role-option')) {
            const roleOption = e.target.closest('.role-option');
            const allOptions = document.querySelectorAll('.role-option');
            
            // Remove active class from all options
            allOptions.forEach(option => option.classList.remove('active'));
            
            // Add active class to clicked option
            roleOption.classList.add('active');
            return;
        }

        // Handle login button - prevent multiple simultaneous clicks
        if (e.target.id === 'loginBtn' || e.target.closest('#loginBtn')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation(); // Prevent other listeners
            
            console.log('🖱️ Login button clicked');
            this.boundHandleLogin();
        }
    }

    loginKeypressHandler(e) {
        if ((e.target.id === 'password' || e.target.id === 'email') && e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            console.log('⌨️ Enter key pressed for login');
            this.boundHandleLogin();
        }
    }

    async handleLogin() {
        // Prevent multiple simultaneous login attempts with proper debouncing
        if (this.loginInProgress) {
            console.log('🛑 Login already in progress, ignoring duplicate request');
            return;
        }
        
        this.loginInProgress = true;
        console.log('🔐 Starting login process...');
        
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        
        const email = emailInput?.value;
        const password = passwordInput?.value;
        
        const activeRoleOption = document.querySelector('.role-option.active');
        const role = activeRoleOption ? activeRoleOption.getAttribute('data-role') : 'tenant';

        console.log('🔐 Login attempt:', { email, role });

        if (!email || !password) {
            this.showNotification('Please enter both email and password', 'error');
            this.loginInProgress = false;
            return;
        }

        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            const originalText = loginBtn.innerHTML;
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
            loginBtn.disabled = true;

            try {
                // Clear any previous authentication state
                await this.clearAuthentication();

                console.log('🛡️ Starting authentication...');
                
                // TEMPORARILY DISABLE auth listener to prevent duplicate dashboard
                this.authListenerEnabled = false;
                
                const user = await AuthManager.login(email, password, role);
                console.log('✅ Login successful, user:', user.email);
                console.log('📊 Login stats after login:', { 
                    loginCount: user.loginCount, 
                    hasTemporaryPassword: user.hasTemporaryPassword,
                    passwordChanged: user.passwordChanged,
                    requiresPasswordChange: user.requiresPasswordChange 
                });
                
                // MANUAL STATE MANAGEMENT - don't rely on auth listener
                this.currentUser = user;
                this.currentRole = user.role;
                
                // Re-enable auth listener after successful login
                setTimeout(() => {
                    this.authListenerEnabled = true;
                    console.log('🔓 Auth listener re-enabled after login');
                }, 2000);
                
                // SIMPLIFIED: Check if password change is required
                if (user.requiresPasswordChange) {
                    console.log('🔐 Password change required - showing modal');
                    setTimeout(() => {
                        this.showPasswordChangeModal();
                    }, 500);
                } else {
                    console.log('🔄 No password change required - showing dashboard');
                    setTimeout(() => {
                        this.showDashboard();
                    }, 500);
                }
                
            } catch (error) {
                console.error('❌ Login failed:', error);
                
                // Re-enable auth listener on error
                this.authListenerEnabled = true;
                
                // Clear state and show error
                await this.clearAuthentication();
                this.currentUser = null;
                this.currentRole = null;
                
                // Show error message
                let errorMessage = error.message;
                if (error.code && error.code.startsWith('auth/')) {
                    errorMessage = AuthManager.getAuthErrorMessage(error.code);
                }
                
                this.showNotification(errorMessage, 'error');
                
                // Reset form and button
                loginBtn.innerHTML = originalText;
                loginBtn.disabled = false;
                if (passwordInput) passwordInput.value = '';
                
            } finally {
                this.loginInProgress = false;
            }
        } else {
            this.loginInProgress = false;
        }
    }

    ensureLoginPage() {
        const appElement = document.getElementById('app');
        if (appElement && !appElement.innerHTML.includes('login-container')) {
            console.log('🛑 Ensuring login page is displayed after failed login');
            this.showLogin();
        }
    }

    // ===== STUB METHODS FOR UNIMPLEMENTED FEATURES =====
    viewBillDetails(billId) {
        this.showNotification('Bill details feature coming soon!', 'info');
    }

    viewTenantMaintenanceRequest(requestId) {
        this.showNotification('Maintenance request details feature coming soon!', 'info');
    }

    updateMaintenanceRequest(requestId) {
        this.showNotification('Update maintenance request feature coming soon!', 'info');
    }

    showAssignStaffForm() {
        this.showNotification('Assign staff feature coming soon!', 'info');
    }

    editTenant(tenantId) {
        this.showNotification('Edit tenant feature coming soon!', 'info');
    }

    sendMessage(tenantId) {
        this.showNotification('Send message feature coming soon!', 'info');
    }

    deleteTenant(tenantId) {
        this.showNotification('Delete tenant feature coming soon!', 'info');
    }

    viewBill(billId) {
        this.showNotification('View bill feature coming soon!', 'info');
    }

    assignMaintenance(requestId) {
        this.showNotification('Assign maintenance feature coming soon!', 'info');
    }

    showGenerateBillForm() {
        this.showNotification('Bill generation feature coming soon!', 'info');
    }

    showPaymentModal(billId = null) {
        this.showNotification('Payment processing feature coming soon!', 'info');
    }

    showMaintenanceRequestForm() {
        this.showNotification('Maintenance request feature coming soon!', 'info');
    }

    showAddPropertyForm() {
        this.showNotification('Add property feature coming soon!', 'info');
    }

    // ===== DASHBOARD DATA METHODS =====
    async setupRealTimeStats() {
        // This would setup real-time data listeners
        console.log('Setting up real-time dashboard stats...');
    }


    updateDashboardWithRealData(stats) {
        if (!stats) {
            console.log('No stats data available');
            return;
        }
        
        console.log('Updating dashboard with stats for role:', this.currentRole);
        
        if (this.currentRole === 'landlord') {
            this.updateLandlordDashboard(stats);
        } else {
            this.updateTenantDashboard(stats);
        }
    }

    // Helper methods for tenant dashboard
    getDueDateText(dueDate) {
        if (!dueDate) return 'No due date';
        
        const today = new Date();
        const due = new Date(dueDate);
        const diffTime = due - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Due today';
        if (diffDays === 1) return 'Due tomorrow';
        if (diffDays > 1) return `Due in ${diffDays} days`;
        return `Overdue by ${Math.abs(diffDays)} days`;
    }

    getPaymentStatus(status) {
        const statusMap = {
            'current': 'Current',
            'pending': 'Pending',
            'overdue': 'Overdue',
            'paid': 'Paid'
        };
        return statusMap[status] || 'Unknown';
    }


    getPaymentStatusDetails(status) {
        const detailsMap = {
            'current': 'Payment up to date',
            'pending': 'Payment processing',
            'overdue': 'Payment overdue',
            'paid': 'Fully paid'
        };
        return detailsMap[status] || 'Status unknown';
    }

    updateCard(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        } else {
            console.warn(`Element not found: ${elementId}`);
        }
    }

    updateLoadingStates() {
        // Remove loading states from all cards
        const loadingElements = document.querySelectorAll('.card-change.loading');
        loadingElements.forEach(element => {
            element.innerHTML = '<i class="fas fa-check"></i> <span>Updated</span>';
            element.className = 'card-change positive';
        });
    }

    updateTenantDashboard(stats) {
        // ACCOUNT OVERVIEW
        this.updateCard('currentBalance', `₱${(stats.totalDue || 0).toLocaleString()}`);
        this.updateCard('balanceDueDate', this.getDueDateText(stats.nextDueDate));
        this.updateCard('paymentStatus', this.getPaymentStatus(stats.paymentStatus));
        this.updateCard('paymentStatusDetails', this.getPaymentStatusDetails(stats.paymentStatus));
        this.updateCard('roomNumber', stats.roomNumber || 'N/A');
        this.updateCard('monthlyRent', `₱${(stats.monthlyRent || 0).toLocaleString()}`);
        
        // BILLING & PAYMENTS
        this.updateCard('pendingBills', stats.unpaidBills || 0);
        this.updateCard('nextDueDate', stats.nextDueDate ? new Date(stats.nextDueDate).toLocaleDateString() : 'N/A');
        this.updateCard('lastPaymentAmount', `₱${(stats.lastPaymentAmount || 0).toLocaleString()}`);
        this.updateCard('lastPaymentDate', stats.lastPaymentDate ? `Paid on ${new Date(stats.lastPaymentDate).toLocaleDateString()}` : 'No payments');
        
        // MAINTENANCE
        this.updateCard('openRequests', stats.openMaintenance || 0);
        this.updateCard('recentUpdates', stats.recentUpdates || 0);
        
        this.updateLoadingStates();
    }

    updateLandlordDashboard(stats) {
        // PROPERTY OVERVIEW
        this.updateCard('occupancyRate', `${stats.occupancyRate}%`);
        this.updateCard('vacantUnits', stats.vacantUnits);
        this.updateCard('occupancyDetails', `${stats.occupiedUnits}/${stats.totalUnits} units`);
        this.updateCard('totalTenants', stats.totalTenants);
        this.updateCard('averageRent', `₱${Math.round(stats.averageRent || 0).toLocaleString()}`);
        
        // FINANCIAL OVERVIEW
        this.updateCard('collectionRate', `${stats.collectionRate}%`);
        this.updateCard('monthlyRevenue', `₱${(stats.totalRevenue || 0).toLocaleString()}`);
        this.updateCard('latePayments', stats.latePayments);
        this.updateCard('unpaidBills', stats.unpaidBills);
        
        // OPERATIONS
        this.updateCard('upcomingRenewals', stats.upcomingRenewals);
        this.updateCard('openMaintenance', stats.openMaintenance);
        this.updateCard('maintenanceBacklog', stats.maintenanceBacklog);
        
        this.updateLoadingStates();
    }

    updateCard(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        } else {
            console.warn(`Element not found: ${elementId}`);
        }
    }

    updateLoadingStates() {
        // Remove loading states from all cards
        const loadingElements = document.querySelectorAll('.card-change.loading');
        loadingElements.forEach(element => {
            element.innerHTML = '<i class="fas fa-check"></i> <span>Updated</span>';
            element.className = 'card-change positive';
        });
    }

    updateCard(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) element.textContent = value;
    }

    updateCard(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) element.textContent = value;
    }

    // ===== PAGE CONTENT METHODS =====
    async getBillingPage() {
        return `
        <div class="page-content">
            <div class="page-header">
                <h1 class="page-title">Billing & Payments</h1>
                <button class="btn btn-primary" onclick="casaLink.showGenerateBillForm()">
                    <i class="fas fa-plus"></i> Generate Bill
                </button>
            </div>
            <div style="text-align: center; padding: 40px;">
                <h3>Billing Management</h3>
                <p>Generate bills, track payments, and manage tenant billing.</p>
                <button class="btn btn-primary" onclick="casaLink.showGenerateBillForm()">
                    Create Your First Bill
                </button>
            </div>
        </div>
        `;
    }

    async getMaintenancePage() {
        return `
        <div class="page-content">
            <div class="page-header">
                <h1 class="page-title">Maintenance</h1>
                <button class="btn btn-primary" onclick="casaLink.showMaintenanceRequestForm()">
                    <i class="fas fa-plus"></i> New Request
                </button>
            </div>
            <div style="text-align: center; padding: 40px;">
                <h3>Maintenance Management</h3>
                <p>Track and manage maintenance requests from tenants.</p>
                <button class="btn btn-primary" onclick="casaLink.showMaintenanceRequestForm()">
                    Create Maintenance Request
                </button>
            </div>
        </div>
        `;
    }

    async getTenantsPage() {
        return `
        <div class="page-content">
            <div class="page-header">
                <h1 class="page-title">Tenant Management</h1>
                <button class="btn btn-primary" onclick="casaLink.showAddTenantForm()">
                    <i class="fas fa-plus"></i> Add Tenant
                </button>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h3>Your Tenants</h3>
                    <div class="search-box">
                        <input type="text" id="tenantSearch" class="form-input" placeholder="Search tenants...">
                    </div>
                </div>
                <div id="tenantsList">
                    <div class="data-loading">
                        <i class="fas fa-spinner fa-spin"></i> Loading tenants...
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    // Landlord creates tenant accounts
    async showAddTenantForm() {
        const modalContent = `
            <div class="add-tenant-form">
                <h4 style="margin-bottom: 20px; color: var(--primary-blue);">Tenant Information</h4>
                
                <div class="form-group">
                    <label class="form-label">Full Name *</label>
                    <input type="text" id="tenantName" class="form-input" placeholder="John Doe" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Occupation *</label>
                    <input type="text" id="tenantOccupation" class="form-input" placeholder="Software Engineer" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Age *</label>
                    <input type="number" id="tenantAge" class="form-input" placeholder="25" min="18" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Phone Number *</label>
                    <input type="tel" id="tenantPhone" class="form-input" placeholder="+63 912 345 6789" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Email Address *</label>
                    <input type="email" id="tenantEmail" class="form-input" placeholder="john.doe@example.com" required>
                </div>

                <hr style="margin: 25px 0; border: none; border-top: 1px solid #eee;">
                
                <h4 style="margin-bottom: 20px; color: var(--primary-blue);">Rental Agreement</h4>
                
                <div class="form-group">
                    <label class="form-label">Room Number / Unit *</label>
                    <input type="text" id="roomNumber" class="form-input" placeholder="Unit 101 or Room 5" required>
                    <small style="color: var(--dark-gray);">Specific room or unit being rented</small>
                </div>
                
                <div class="form-group">
                    <label class="form-label">House Rental Address</label>
                    <input type="text" id="rentalAddress" class="form-input" 
                        value="Lot 22 Zarate Compound Purok 4, Bakakent Norte, Baguio City" readonly>
                    <small style="color: var(--dark-gray);">Fixed address as per agreement</small>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Monthly Rental Amount (₱) *</label>
                    <input type="number" id="rentalAmount" class="form-input" placeholder="5000" min="0" step="0.01" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Security Deposit (₱) *</label>
                    <input type="number" id="securityDeposit" class="form-input" placeholder="5000" min="0" step="0.01" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Payment Method</label>
                    <select id="paymentMethod" class="form-input">
                        <option value="Cash">Cash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="GCash">GCash</option>
                        <option value="Maya">Maya</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Date of Entry *</label>
                    <input type="date" id="dateOfEntry" class="form-input" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Date of 1st Payment *</label>
                    <input type="date" id="firstPaymentDate" class="form-input" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Day of Payment *</label>
                    <select id="paymentDay" class="form-input" required>
                        <option value="">Select payment day</option>
                        <option value="5">5th of the month</option>
                        <option value="10">10th of the month</option>
                        <option value="15">15th of the month</option>
                        <option value="20">20th of the month</option>
                        <option value="25">25th of the month</option>
                        <option value="30">30th of the month</option>
                    </select>
                </div>
                
                <div class="security-info">
                    <i class="fas fa-info-circle"></i>
                    <small>You'll review the lease agreement and confirm with your password in the next steps.</small>
                </div>
                
                <div id="tenantCreationResult" style="display: none; margin-top: 15px; padding: 10px; border-radius: 8px;"></div>
            </div>
        `;

        const modal = ModalManager.openModal(modalContent, {
            title: 'Add New Tenant - Step 1 of 3',
            submitText: 'Next: Review Agreement',
            onSubmit: () => this.validateTenantForm()
        });

        // Set default dates
        setTimeout(() => {
            const today = new Date().toISOString().split('T')[0];
            const firstPayment = new Date();
            firstPayment.setDate(firstPayment.getDate() + 5); // 5 days from now
            
            document.getElementById('dateOfEntry').value = today;
            document.getElementById('firstPaymentDate').value = firstPayment.toISOString().split('T')[0];
        }, 100);

        this.addTenantModal = modal;
    }


    validateTenantForm() {
        const name = document.getElementById('tenantName')?.value;
        const email = document.getElementById('tenantEmail')?.value;
        const phone = document.getElementById('tenantPhone')?.value;
        const occupation = document.getElementById('tenantOccupation')?.value;
        const age = document.getElementById('tenantAge')?.value;
        const roomNumber = document.getElementById('roomNumber')?.value;
        const rentalAmount = document.getElementById('rentalAmount')?.value;
        const securityDeposit = document.getElementById('securityDeposit')?.value;
        const dateOfEntry = document.getElementById('dateOfEntry')?.value;
        const firstPaymentDate = document.getElementById('firstPaymentDate')?.value;
        const paymentDay = document.getElementById('paymentDay')?.value;

        // Validate required fields
        if (!name || !email || !occupation || !age || !phone || !roomNumber ||
            !rentalAmount || !securityDeposit || !dateOfEntry || !firstPaymentDate || !paymentDay) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        // Store the form data temporarily
        this.pendingTenantData = {
            name: name,
            email: email,
            phone: phone,
            occupation: occupation,
            age: parseInt(age),
            roomNumber: roomNumber,
            rentalAddress: document.getElementById('rentalAddress')?.value || 'Lot 22 Zarate Compound Purok 4, Bakakent Norte, Baguio City',
            rentalAmount: rentalAmount ? parseFloat(rentalAmount) : 0,
            securityDeposit: securityDeposit ? parseFloat(securityDeposit) : 0,
            paymentMethod: document.getElementById('paymentMethod')?.value || 'Cash',
            dateOfEntry: dateOfEntry,
            firstPaymentDate: firstPaymentDate,
            paymentDay: paymentDay
        };

        // Close the first modal and show lease agreement
        ModalManager.closeModal(this.addTenantModal);
        this.showLeaseAgreementModal(null, this.pendingTenantData);
    }

    showLeaseAgreementModal(tenantId, tenantData) {
        // Use either provided tenantData or pendingTenantData
        const data = tenantData || this.pendingTenantData;
        if (!data) {
            this.showNotification('No tenant data found. Please start over.', 'error');
            return;
        }

        // Calculate lease end date (1 year from date of entry)
        const dateOfEntry = new Date(data.dateOfEntry);
        const leaseEnd = new Date(dateOfEntry);
        leaseEnd.setFullYear(leaseEnd.getFullYear() + 1);
        
        const formattedDateOfEntry = dateOfEntry.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        const formattedLeaseEnd = leaseEnd.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        const modalContent = `
            <div class="lease-agreement-modal" style="max-height: 70vh; overflow-y: auto;">
                <div style="text-align: center; margin-bottom: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                    <h3 style="color: var(--primary-blue); margin-bottom: 10px;">LEASE AGREEMENT</h3>
                    <p style="color: var(--dark-gray);">Please review the lease agreement below</p>
                </div>
                
                <div style="line-height: 1.6; font-size: 0.95rem;">
                    <p><strong>This agreement is made by and between:</strong></p>
                    <p style="margin-left: 20px;">
                        <strong>Landlady/Lessor:</strong> Nelly Virtucio<br>
                        <strong>Tenant/Lessee:</strong> ${data.name}
                    </p>
                    
                    <p>This landlady hereby agrees to lessee the unit <strong>${data.roomNumber}</strong> of her house located at <strong>${data.rentalAddress}</strong>. 
                    The lesse period shall be for 1 year beginning <strong>${formattedDateOfEntry}</strong> and shall end and may be renewable one (1) year thereafter.</p>
                    
                    <p>In case of failure to stay for the period of one (1) year the landlady won't refund the security deposit of <strong>₱${data.securityDeposit.toLocaleString()}</strong> 
                    but if tenant stayed for a year or more the security deposit is refundable or consumable.</p>
                    
                    <p>Limit of occupants be four (4) persons regardless of age, additional pay for excess of two thousand pesos (2,000) per person.</p>
                    
                    <p>Increase of monthly rental at any time of the year.</p>
                    
                    <h4 style="margin: 20px 0 10px 0; color: var(--primary-blue);">Terms and Conditions:</h4>
                    
                    <ol style="margin-left: 20px; padding-left: 0;">
                        <li><strong>Garbage/Trash</strong> - tenant is responsible for disposing his/her trash and garbage on proper place. Dispose every Thursday afternoon at Purok 6 or Jeepney Terminal near Barangay Hall.</li>
                        <li><strong>Smoking</strong> - No tenant shall smoke, nor permit anyone to smoke withing the leased area.</li>
                        <li><strong>Noise</strong> - All radios, television set, speakers or any appliances or items which may cause noise, etc. must be turned down to a level of sound that does not annoy or interfere with other lessee.</li>
                        <li><strong>Visitor & Guest</strong> - Maximum of 10 visitors allowed to enter the unit and should leave before 10pm.</li>
                        <li><strong>Locks</strong> - Tenants are to provide their own padlock for their unit. Upon termination of contract tenant must remove their own padlock.</li>
                        <li><strong>Interior and Exterior</strong> - No nails or any kind (thumbtacks, pin, etc). If in case there are some make use of it but don't add still. Never hand, leave valuable things on hallways. Shoes/slippers are exceptions, always keep clear and clean.</li>
                        <li><strong>Payment</strong> - Electric and water bills must be paid on or before due date to avoid cut offs or penalties.</li>
                        <li><strong>Light Bulbs</strong> - Tenant at tenant expense shall be reponsible for replacement of all interior light bulb. All light bulbs must be operational all the time until the tenant vacate the unit.</li>
                        <li><strong>Damage</strong> - Tenants will be held responsible for any damage to their units or to the common areas caused by themselves or their guest, especially damaged pipe, clogging of bowl, sink, electrical plug/switches and bulb.</li>
                        <li><strong>Security</strong> - The safety and welfare of the tenant's property is responsibility of the tenants. Use good common sense and think about safety.</li>
                        <li><strong>Upon termination of the lease</strong>, tenant shall be responsible for cleaning the premises. Additional of Php 2,000 if failed to do so.</li>
                    </ol>
                    
                    <p><strong>12. Acknowledgement</strong> - The parties hereby acknowledge & understand the terms herein set forth in the agreement signed on this day of <strong>${formattedDateOfEntry}</strong></p>
                    
                    <div style="display: flex; justify-content: space-between; margin-top: 30px;">
                        <div>
                            <p><strong>Nelly D. Virtucio</strong><br>Landlady/Lessor</p>
                        </div>
                        <div>
                            <p><strong>${data.name}</strong><br>Tenant/Lessee</p>
                        </div>
                    </div>
                    
                    <div style="background: rgba(26, 115, 232, 0.1); padding: 15px; border-radius: 8px; margin-top: 20px;">
                        <p style="margin: 0; font-size: 0.9rem; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-info-circle" style="color: var(--primary-blue);"></i>
                            The tenant account will be created with "unverified" status. Status will change to "verified" once the tenant changes their temporary password and agrees to these terms.
                        </p>
                    </div>
                </div>
            </div>
        `;

        const agreementModal = ModalManager.openModal(modalContent, {
            title: 'Lease Agreement - Step 2 of 3',
            submitText: 'Next: Confirm Creation',
            onSubmit: () => this.showPasswordConfirmation(data, formattedLeaseEnd)
        });

        this.leaseAgreementModal = agreementModal;
    }

    showPasswordConfirmation(tenantData, leaseEndDate) {
        const modalContent = `
            <div class="password-confirm-modal">
                <div style="text-align: center; margin-bottom: 20px;">
                    <i class="fas fa-shield-alt" style="font-size: 3rem; color: var(--primary-blue); margin-bottom: 15px;"></i>
                    <h3 style="margin-bottom: 10px;">Security Verification</h3>
                    <p>Please confirm your password to create the tenant account.</p>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Your Email</label>
                    <input type="email" id="landlordEmailConfirm" class="form-input" value="${this.currentUser.email}" readonly disabled>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Your Password *</label>
                    <input type="password" id="landlordPassword" class="form-input" placeholder="Enter your password" autocomplete="current-password">
                </div>
                
                <div id="passwordConfirmError" style="color: var(--danger); margin-bottom: 15px; display: none;"></div>
                
                <div class="security-info">
                    <i class="fas fa-info-circle"></i>
                    <small>Your password is required to securely create the tenant account.</small>
                </div>
            </div>
        `;

        // Close the lease agreement modal
        ModalManager.closeModal(this.leaseAgreementModal);

        // Open password confirmation modal
        const passwordModal = ModalManager.openModal(modalContent, {
            title: 'Confirm Your Identity - Step 3 of 3',
            submitText: 'Create Tenant Account',
            onSubmit: () => this.createTenantAccountWithPassword(tenantData, leaseEndDate)
        });

        this.passwordConfirmationModal = passwordModal;
    }

    async createTenantAccountWithPassword(tenantData, leaseEndDate) {
        const password = document.getElementById('landlordPassword')?.value;
        const errorElement = document.getElementById('passwordConfirmError');

        if (!password) {
            this.showPasswordError('Please enter your password');
            return;
        }

        try {
            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
                submitBtn.disabled = true;
            }

            // SET THE FLAG: Prevent auth listener from redirecting
            this.creatingTenant = true;
            
            const temporaryPassword = this.generateTemporaryPassword(8);
            
            console.log('🔄 Creating tenant account with provided password...');
            
            // Create tenant account with the password (only asked once now)
            const result = await AuthManager.createTenantAccount(tenantData, temporaryPassword, password);

            if (result.success) {
                console.log('✅ Tenant account created successfully');
                console.log('🔄 Attempting to send welcome email...');
                
                try {
                    const emailResult = await SendPulseService.sendTenantWelcomeEmail(
                        tenantData, 
                        temporaryPassword, 
                        this.currentUser.email
                    );
                    
                    if (emailResult.success) {
                        console.log('✅ Welcome email sent successfully to:', tenantData.email);
                    } else {
                        console.warn('⚠️ Tenant created but email failed:', emailResult.error);
                        this.showNotification('Tenant created but email failed to send', 'warning');
                    }
                } catch (emailError) {
                    console.warn('⚠️ Email sending failed, but tenant was created:', emailError);
                }
                
                // Create lease document
                await this.createLeaseDocument(result.tenantId, tenantData, leaseEndDate);
                
                // Close modal and show success
                ModalManager.closeModal(this.passwordConfirmationModal);
                this.showNotification('Tenant account and lease created successfully!', 'success');

                // Reload tenants list
                setTimeout(() => {
                    this.loadTenantsData();
                }, 1000);
            }

        } catch (error) {
            console.error('Tenant creation error:', error);
            
            // Show appropriate error message
            if (error.code === 'auth/wrong-password') {
                this.showPasswordError('Incorrect password. Please try again.');
            } else {
                this.showNotification(`Failed to create tenant: ${error.message}`, 'error');
            }
            
            // Reset button
            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = 'Create Tenant Account';
                submitBtn.disabled = false;
            }
        } finally {
            // RESET THE FLAG: Allow auth listener to work normally again
            setTimeout(() => {
                this.creatingTenant = false;
                console.log('🔓 Tenant creation completed, auth listener re-enabled');
            }, 2000);
        }
    }

    showPasswordError(message) {
        const errorElement = document.getElementById('passwordConfirmError');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
        
        // Also reset the submit button
        const submitBtn = document.querySelector('#modalSubmit');
        if (submitBtn) {
            submitBtn.innerHTML = 'Create Tenant Account';
            submitBtn.disabled = false;
        }
    }


    async createTenantAccount() {
        const name = document.getElementById('tenantName')?.value;
        const email = document.getElementById('tenantEmail')?.value;
        const phone = document.getElementById('tenantPhone')?.value;
        const occupation = document.getElementById('tenantOccupation')?.value;
        const age = document.getElementById('tenantAge')?.value;
        
        // Rental Agreement Fields
        const roomNumber = document.getElementById('roomNumber')?.value;
        const rentalAddress = document.getElementById('rentalAddress')?.value;
        const rentalAmount = document.getElementById('rentalAmount')?.value;
        const securityDeposit = document.getElementById('securityDeposit')?.value;
        const paymentMethod = document.getElementById('paymentMethod')?.value;
        const dateOfEntry = document.getElementById('dateOfEntry')?.value;
        const firstPaymentDate = document.getElementById('firstPaymentDate')?.value;
        const paymentDay = document.getElementById('paymentDay')?.value;

        const resultElement = document.getElementById('tenantCreationResult');

        // Validate required fields (including room number)
        if (!name || !email || !occupation || !age || !phone || !roomNumber ||
            !rentalAmount || !securityDeposit || !dateOfEntry || !firstPaymentDate || !paymentDay) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        try {
            // SET THE FLAG: Prevent auth listener from redirecting
            this.creatingTenant = true;
            
            const temporaryPassword = this.generateTemporaryPassword(8);
            
            const tenantData = {
                // Basic Information
                name: name,
                email: email,
                phone: phone,
                occupation: occupation,
                age: parseInt(age),
                
                // Rental Agreement Information
                roomNumber: roomNumber,
                rentalAddress: rentalAddress || 'Lot 22 Zarate Compound Purok 4, Bakakent Norte, Baguio City',
                rentalAmount: rentalAmount ? parseFloat(rentalAmount) : 0,
                securityDeposit: securityDeposit ? parseFloat(securityDeposit) : 0,
                paymentMethod: paymentMethod || 'Cash',
                dateOfEntry: dateOfEntry,
                firstPaymentDate: firstPaymentDate,
                paymentDay: paymentDay,
                
                // Remove or provide default for propertyId
                // propertyId: '', // Remove this line or provide a default value
                
                landlordId: this.currentUser.uid,
                status: 'unverified'
            };

            // Show loading in the main modal
            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing...';
                submitBtn.disabled = true;
            }

            // Create tenant account - this will show the password confirmation modal
            const result = await AuthManager.createTenantAccount(tenantData, temporaryPassword);

            if (result.success) {
                console.log('🔄 Attempting to send welcome email...');
                
                try {
                    const emailResult = await SendPulseService.sendTenantWelcomeEmail(
                        tenantData, 
                        temporaryPassword, 
                        this.currentUser.email
                    );
                    
                    if (emailResult.success) {
                        console.log('✅ Welcome email sent successfully to:', tenantData.email);
                    } else {
                        console.warn('⚠️ Tenant created but email failed:', emailResult.error);
                        this.showNotification('Tenant created but email failed to send', 'warning');
                    }
                } catch (emailError) {
                    console.warn('⚠️ Email sending failed, but tenant was created:', emailError);
                }
                
                // SHOW LEASE AGREEMENT MODAL (instead of automatically creating lease)
                this.showLeaseAgreementModal(result.tenantId, tenantData);
            }

        } catch (error) {
            console.error('Tenant creation error:', error);
            
            if (error.message !== 'Tenant creation cancelled') {
                this.showNotification(`Failed to create tenant: ${error.message}`, 'error');
            }
            
            // Reset button
            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = 'Create Tenant Account';
                submitBtn.disabled = false;
            }
        } finally {
            // RESET THE FLAG: Allow auth listener to work normally again
            setTimeout(() => {
                this.creatingTenant = false;
                console.log('🔓 Tenant creation completed, auth listener re-enabled');
            }, 2000);
        }
    }

    async finalizeTenantCreation(tenantId, tenantData, leaseEndDate) {
        try {
            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
                submitBtn.disabled = true;
            }

            // Create SINGLE lease document
            await this.createLeaseDocument(tenantId, tenantData, leaseEndDate);
            
            // Show success message
            ModalManager.closeModal(this.leaseAgreementModal);
            
            this.showNotification('Tenant account and lease created successfully!', 'success');

            // Reload tenants list
            setTimeout(() => {
                this.loadTenantsData();
            }, 1000);

        } catch (error) {
            console.error('Error finalizing tenant creation:', error);
            this.showNotification(`Failed to create lease: ${error.message}`, 'error');
            
            // Reset button
            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = 'Confirm & Create Tenant';
                submitBtn.disabled = false;
            }
        }
    }

    async createLeaseDocument(tenantId, tenantData, leaseEndDate) {
        try {
            console.log('📝 Creating SINGLE lease document for tenant:', tenantId);
            
            // First, check if lease already exists for this tenant
            const existingLeaseQuery = await firebaseDb.collection('leases')
                .where('tenantId', '==', tenantId)
                .where('isActive', '==', true)
                .limit(1)
                .get();
                
            if (!existingLeaseQuery.empty) {
                console.log('⚠️ Active lease already exists for this tenant, updating instead');
                const existingLeaseId = existingLeaseQuery.docs[0].id;
                
                await firebaseDb.collection('leases').doc(existingLeaseId).update({
                    // Update with new data
                    tenantName: tenantData.name,
                    tenantEmail: tenantData.email,
                    tenantPhone: tenantData.phone,
                    tenantOccupation: tenantData.occupation,
                    tenantAge: tenantData.age,
                    
                    roomNumber: tenantData.roomNumber,
                    rentalAddress: tenantData.rentalAddress,
                    monthlyRent: tenantData.rentalAmount,
                    securityDeposit: tenantData.securityDeposit,
                    paymentMethod: tenantData.paymentMethod,
                    leaseStart: tenantData.dateOfEntry,
                    leaseEnd: leaseEndDate,
                    paymentDueDay: parseInt(tenantData.paymentDay),
                    firstPaymentDate: tenantData.firstPaymentDate,
                    
                    updatedAt: new Date().toISOString()
                });
                
                console.log('✅ Existing lease updated:', existingLeaseId);
                return existingLeaseId;
            }
            
            // Create new lease document if none exists
            const leaseData = {
                // Tenant Information
                tenantId: tenantId,
                tenantName: tenantData.name,
                tenantEmail: tenantData.email,
                tenantPhone: tenantData.phone,
                tenantOccupation: tenantData.occupation,
                tenantAge: tenantData.age,
                
                // Landlord Information
                landlordId: this.currentUser.uid,
                landlordName: 'Nelly D. Virtucio',
                
                // Property Information
                roomNumber: tenantData.roomNumber,
                rentalAddress: tenantData.rentalAddress,
                
                // Lease Terms
                monthlyRent: tenantData.rentalAmount,
                securityDeposit: tenantData.securityDeposit,
                paymentMethod: tenantData.paymentMethod,
                leaseStart: tenantData.dateOfEntry,
                leaseEnd: leaseEndDate,
                leaseDuration: 12, // 1 year in months
                paymentDueDay: parseInt(tenantData.paymentDay),
                firstPaymentDate: tenantData.firstPaymentDate,
                
                // Lease Status
                status: 'active',
                isActive: true,
                securityDepositPaid: false,
                
                // Agreement Details
                agreementType: 'standard',
                maxOccupants: 4,
                additionalOccupantFee: 2000,
                
                // Dates
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                
                // Utilities
                includesWater: false,
                includesElectricity: false,
                includesInternet: false,
                
                // Agreement Tracking
                agreementViewed: false,
                agreementAccepted: false,
                agreementAcceptedDate: null
            };

            // Create the lease document in Firestore
            const leaseRef = await firebaseDb.collection('leases').add(leaseData);
            console.log('✅ New lease document created with ID:', leaseRef.id);
            
            // Update the tenant's user document with lease reference
            await firebaseDb.collection('users').doc(tenantId).update({
                leaseId: leaseRef.id,
                currentLease: leaseRef.id,
                roomNumber: tenantData.roomNumber, // Also store room number in user document
                status: 'unverified', // Will change to verified after password change and agreement
                updatedAt: new Date().toISOString()
            });
            
            return leaseRef.id;
            
        } catch (error) {
            console.error('❌ Error creating/updating lease document:', error);
            throw new Error('Failed to create lease document: ' + error.message);
        }
    }

    // Helper method to calculate lease duration
    calculateLeaseDuration(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        return months;
    }

    generateTemporaryPassword(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let password = '';
        for (let i = 0; i < length; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }


    async getTenantBillingPage() {
        return `
        <div class="page-content">
            <div class="page-header">
                <h1 class="page-title">My Bills & Payments</h1>
                <button class="btn btn-primary" onclick="casaLink.showPaymentModal()">
                    <i class="fas fa-credit-card"></i> Make Payment
                </button>
            </div>
            <div style="text-align: center; padding: 40px;">
                <h3>Billing History</h3>
                <p>View your payment history and upcoming bills.</p>
                <button class="btn btn-primary" onclick="casaLink.showPaymentModal()">
                    Make a Payment
                </button>
            </div>
        </div>
        `;
    }

    async getTenantMaintenancePage() {
        return `
        <div class="page-content">
            <div class="page-header">
                <h1 class="page-title">Maintenance Requests</h1>
                <button class="btn btn-primary" onclick="casaLink.showMaintenanceRequestForm()">
                    <i class="fas fa-plus"></i> New Request
                </button>
            </div>
            <div style="text-align: center; padding: 40px;">
                <h3>Maintenance Requests</h3>
                <p>Submit and track maintenance requests for your unit.</p>
                <button class="btn btn-primary" onclick="casaLink.showMaintenanceRequestForm()">
                    Submit a Request
                </button>
            </div>
        </div>
        `;
    }

    // Password Change for Tenants
    showPasswordChangeModal() {
        const modalContent = `
            <div class="password-change-modal">
                <div style="text-align: center; margin-bottom: 20px;">
                    <i class="fas fa-shield-alt" style="font-size: 3rem; color: var(--primary-blue); margin-bottom: 15px;"></i>
                    <h3 style="margin-bottom: 10px;">Security First!</h3>
                    <p>Welcome to CasaLink! For your security, please change your temporary password to a permanent one.</p>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Current Temporary Password</label>
                    <input type="password" id="currentTempPassword" class="form-input" 
                        placeholder="Enter the temporary password provided by your landlord">
                    <small style="color: var(--dark-gray); display: block; margin-top: 5px;">
                        This is the temporary password you just used to login
                    </small>
                </div>
                
                <div class="form-group">
                    <label class="form-label">New Permanent Password</label>
                    <input type="password" id="newPassword" class="form-input" 
                        placeholder="Choose a secure password (min. 6 characters)">
                    <small style="color: var(--dark-gray); display: block; margin-top: 5px;">
                        Must be at least 6 characters long
                    </small>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Confirm New Password</label>
                    <input type="password" id="confirmNewPassword" class="form-input" 
                        placeholder="Re-enter your new password">
                </div>
                
                <div id="passwordChangeError" style="color: var(--danger); margin-bottom: 15px; display: none;"></div>
            </div>
        `;

        const modal = ModalManager.openModal(modalContent, {
            title: 'Change Your Password',
            submitText: 'Update Password & Continue',
            showFooter: true,
            onSubmit: () => this.handleTenantPasswordChange()
        });

        // Wait for modal to be fully rendered before accessing elements
        setTimeout(() => {
            const overlay = modal?.querySelector('.modal-overlay');
            const closeBtn = modal?.querySelector('.modal-close');
            const cancelBtn = modal?.querySelector('#modalCancel');
            
            // Make modal non-closable (user must change password)
            if (closeBtn) closeBtn.style.display = 'none';
            if (cancelBtn) cancelBtn.style.display = 'none';
            
            if (overlay) {
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                });
            }
        }, 100);

        this.passwordChangeModal = modal;
    }

    async handleTenantPasswordChange() {
        const currentPassword = document.getElementById('currentTempPassword')?.value;
        const newPassword = document.getElementById('newPassword')?.value;
        const confirmPassword = document.getElementById('confirmNewPassword')?.value;
        const errorElement = document.getElementById('passwordChangeError');

        // Reset error
        if (errorElement) {
            errorElement.style.display = 'none';
            errorElement.textContent = '';
        }

        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showPasswordChangeError('Please fill in all fields');
            return;
        }

        if (newPassword.length < 6) {
            this.showPasswordChangeError('New password must be at least 6 characters long');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showPasswordChangeError('New passwords do not match');
            return;
        }

        // Check if new password is same as temporary password
        if (newPassword === currentPassword) {
            this.showPasswordChangeError('New password cannot be the same as temporary password');
            return;
        }

        try {
            // Show loading state
            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
                submitBtn.disabled = true;
            }

            await AuthManager.changePassword(currentPassword, newPassword);
            
            // CRITICAL: Update user document with password change but keep status as unverified
            await firebaseDb.collection('users').doc(this.currentUser.uid).update({
                hasTemporaryPassword: false,
                passwordChanged: true,
                passwordChangedAt: new Date().toISOString(),
                currentPassword: newPassword,
                temporaryPassword: null,
                // DO NOT set requiresPasswordChange to false here
                // DO NOT set status to verified here
                updatedAt: new Date().toISOString()
            });
            
            // Close password change modal
            ModalManager.closeModal(this.passwordChangeModal);
            
            // Show success message
            this.showNotification('Password changed successfully! Please review your lease agreement.', 'success');
            
            // Update current user data locally
            this.currentUser.hasTemporaryPassword = false;
            this.currentUser.passwordChanged = true;
            this.currentUser.currentPassword = newPassword;
            // Keep requiresPasswordChange as true for now
            
            console.log('🔄 Password change complete, showing lease agreement verification');
            
            // Immediately show lease agreement verification
            this.showLeaseAgreementVerification();
            
        } catch (error) {
            console.error('Password change error:', error);
            this.showPasswordChangeError(error.message);
            
            // Reset button
            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = 'Update Password & Continue';
                submitBtn.disabled = false;
            }
        }
    }

    showPasswordChangeError(message) {
        const errorElement = document.getElementById('passwordChangeError');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    async showLeaseAgreementVerification() {
        // Get the tenant's lease data
        const lease = await DataManager.getTenantLease(this.currentUser.uid);
        
        if (!lease) {
            this.showNotification('No lease agreement found. Please contact your landlord.', 'error');
            this.showDashboard();
            return;
        }

        const modalContent = `
            <div class="lease-verification-modal" style="max-height: 80vh; overflow-y: auto;">
                <div style="text-align: center; margin-bottom: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                    <i class="fas fa-file-contract" style="font-size: 3rem; color: var(--primary-blue); margin-bottom: 15px;"></i>
                    <h3 style="color: var(--primary-blue); margin-bottom: 10px;">Lease Agreement Verification</h3>
                    <p style="color: var(--dark-gray);">Please review and agree to your lease agreement</p>
                </div>
                
                <div style="line-height: 1.6; font-size: 0.95rem; margin-bottom: 25px; max-height: 400px; overflow-y: auto; padding: 15px; border: 1px solid #eee; border-radius: 8px;">
                    <p><strong>This agreement is made by and between:</strong></p>
                    <p style="margin-left: 20px;">
                        <strong>Landlady/Lessor:</strong> Nelly Virtucio<br>
                        <strong>Tenant/Lessee:</strong> ${this.currentUser.name || 'Tenant'}
                    </p>
                    
                    <p>This landlady hereby agrees to lessee the unit <strong>${lease.roomNumber || 'N/A'}</strong> of her house located at <strong>${lease.rentalAddress || 'N/A'}</strong>. 
                    The lesse period shall be for 1 year beginning <strong>${lease.leaseStart ? new Date(lease.leaseStart).toLocaleDateString() : 'N/A'}</strong>.</p>
                    
                    <p>In case of failure to stay for the period of one (1) year the landlady won't refund the security deposit of <strong>₱${lease.securityDeposit ? lease.securityDeposit.toLocaleString() : '0'}</strong> 
                    but if tenant stayed for a year or more the security deposit is refundable or consumable.</p>
                    
                    <h4 style="margin: 20px 0 10px 0; color: var(--primary-blue);">Key Terms and Conditions:</h4>
                    
                    <ol style="margin-left: 20px; padding-left: 0;">
                        <li><strong>Garbage/Trash</strong> - Tenant is responsible for disposing his/her trash and garbage on proper place. Dispose every Thursday afternoon at Purok 6 or Jeepney Terminal near Barangay Hall.</li>
                        
                        <li><strong>Smoking</strong> - No tenant shall smoke, nor permit anyone to smoke within the leased area.</li>
                        
                        <li><strong>Noise</strong> - All radios, television sets, speakers or any appliances or items which may cause noise, etc. must be turned down to a level of sound that does not annoy or interfere with other lessee.</li>
                        
                        <li><strong>Visitor & Guest</strong> - Maximum of 10 visitors allowed to enter the unit and should leave before 10pm.</li>
                        
                        <li><strong>Locks</strong> - Tenants are to provide their own padlock for their unit. Upon termination of contract tenant must remove their own padlock.</li>
                        
                        <li><strong>Interior and Exterior</strong> - No nails or any kind (thumbtacks, pin, etc). If in case there are some make use of it but don't add still. Never hand, leave valuable things on hallways. Shoes/slippers are exceptions, always keep clear and clean.</li>
                        
                        <li><strong>Payment</strong> - Electric and water bills must be paid on or before due date to avoid cut offs or penalties.</li>
                        
                        <li><strong>Light Bulbs</strong> - Tenant at tenant expense shall be responsible for replacement of all interior light bulbs. All light bulbs must be operational all the time until the tenant vacate the unit.</li>
                        
                        <li><strong>Damage</strong> - Tenants will be held responsible for any damage to their units or to the common areas caused by themselves or their guest, especially damaged pipe, clogging of bowl, sink, electrical plug/switches and bulb.</li>
                        
                        <li><strong>Security</strong> - The safety and welfare of the tenant's property is responsibility of the tenants. Use good common sense and think about safety.</li>
                        
                        <li><strong>Cleaning Upon Termination</strong> - Upon termination of the lease, tenant shall be responsible for cleaning the premises. Additional charge of Php 2,000 if failed to do so.</li>
                        
                        <li><strong>Occupancy Limit</strong> - Limit of occupants be four (4) persons regardless of age, additional pay for excess of two thousand pesos (2,000) per person.</li>
                        
                        <li><strong>Rent Increase</strong> - Increase of monthly rental may occur at any time of the year as determined by the landlady.</li>
                    </ol>

                    <p style="margin-top: 20px; padding: 15px; background: rgba(26, 115, 232, 0.1); border-radius: 8px;">
                        <strong>12. Acknowledgement</strong> - The parties hereby acknowledge & understand the terms herein set forth in the agreement signed on this day of 
                        <strong>${lease.leaseStart ? new Date(lease.leaseStart).toLocaleDateString() : 'N/A'}</strong>
                    </p>

                    <div style="display: flex; justify-content: space-between; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;">
                        <div>
                            <p><strong>Nelly D. Virtucio</strong><br>Landlady/Lessor</p>
                        </div>
                        <div>
                            <p><strong>${this.currentUser.name || 'Tenant'}</strong><br>Tenant/Lessee</p>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Upload Scanned ID *</label>
                    <input type="file" id="idUpload" class="form-input" accept=".jpg,.jpeg,.png,.pdf" required>
                    <small style="color: var(--dark-gray);">Upload a scanned copy of your valid ID (Driver's License, Passport, National ID, etc.)</small>
                </div>

                <div class="form-group">
                    <label style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer;">
                        <input type="checkbox" id="agreeTerms" style="margin-top: 3px;">
                        <span>I have read, understood, and agree to all the terms and conditions of this lease agreement. I acknowledge that violating any of these terms may result in termination of my lease and forfeiture of my security deposit.</span>
                    </label>
                </div>

                <div id="verificationError" style="color: var(--danger); margin-bottom: 15px; display: none;"></div>
                
                <div class="security-info">
                    <i class="fas fa-info-circle"></i>
                    <small>Your account will be verified and you'll gain full access to the tenant dashboard after completing this step. Your ID will be kept confidential and used for verification purposes only.</small>
                </div>
            </div>
        `;

        const modal = ModalManager.openModal(modalContent, {
            title: 'Lease Agreement & Verification - Final Step',
            submitText: 'Agree & Submit Verification',
            onSubmit: () => this.submitLeaseVerification(lease.id)
        });

        this.leaseVerificationModal = modal;
    }

    async submitLeaseVerification(leaseId) {
        const idUpload = document.getElementById('idUpload');
        const agreeTerms = document.getElementById('agreeTerms');
        const errorElement = document.getElementById('verificationError');

        // Reset error
        if (errorElement) {
            errorElement.style.display = 'none';
            errorElement.textContent = '';
        }

        // Validation
        if (!idUpload.files || idUpload.files.length === 0) {
            this.showVerificationError('Please upload a scanned copy of your ID');
            return;
        }

        if (!agreeTerms.checked) {
            this.showVerificationError('You must agree to the terms and conditions');
            return;
        }

        try {
            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
                submitBtn.disabled = true;
            }

            // Upload ID file to Firebase Storage
            const idFile = idUpload.files[0];
            const idUploadUrl = await this.uploadIdFile(idFile, this.currentUser.uid);

            // Update lease agreement with acceptance
            await firebaseDb.collection('leases').doc(leaseId).update({
                agreementViewed: true,
                agreementAccepted: true,
                agreementAcceptedDate: new Date().toISOString(),
                idUploadUrl: idUploadUrl,
                idVerified: false // Landlord can later verify the ID
            });

            // CRITICAL: Update user status to verified and mark onboarding complete
            await firebaseDb.collection('users').doc(this.currentUser.uid).update({
                status: 'verified',
                idUploadUrl: idUploadUrl,
                verificationCompletedAt: new Date().toISOString(),
                requiresPasswordChange: false, // NOW we set this to false
                updatedAt: new Date().toISOString()
            });

            // Update current user data
            this.currentUser.status = 'verified';
            this.currentUser.requiresPasswordChange = false;

            // Close modal
            ModalManager.closeModal(this.leaseVerificationModal);
            
            // Show success message
            this.showNotification('Verification submitted successfully! Welcome to CasaLink!', 'success');
            
            // Show dashboard
            setTimeout(() => {
                this.showDashboard();
            }, 1500);

        } catch (error) {
            console.error('Verification error:', error);
            this.showVerificationError('Failed to submit verification: ' + error.message);
            
            // Reset button
            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = 'Agree & Submit Verification';
                submitBtn.disabled = false;
            }
        }
    }

    showVerificationError(message) {
        const errorElement = document.getElementById('verificationError');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    async uploadIdFile(file, userId) {
        // This is a simplified version - you'll need to implement Firebase Storage
        // For now, we'll return a placeholder URL
        console.log('Uploading ID file for user:', userId);
        
        // TODO: Implement actual Firebase Storage upload
        // const storageRef = firebase.storage().ref();
        // const fileRef = storageRef.child(`tenant_ids/${userId}/${file.name}`);
        // await fileRef.put(file);
        // return await fileRef.getDownloadURL();
        
        return `https://example.com/placeholder-id-upload/${userId}`;
    }

    // ===== UTILITY METHODS =====
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            ${message}
        `;

        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    getErrorDashboard(page, error) {
        console.error(`Error loading ${page}:`, error);
        return `
        <div class="page-content">
            <div style="text-align: center; padding: 40px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--warning); margin-bottom: 20px;"></i>
                <h2>Unable to Load ${page.charAt(0).toUpperCase() + page.slice(1)}</h2>
                <p style="margin-bottom: 20px; color: var(--dark-gray);">
                    There was an error loading the page data. Please check your connection and try again.
                </p>
                <button class="btn btn-primary" onclick="casaLink.showPage('${page}')">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
        </div>
        `;
    }

    getDaysUntilDue(dueDate) {
        const today = new Date();
        const due = new Date(dueDate);
        const diffTime = due - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Due today';
        if (diffDays === 1) return 'Due tomorrow';
        if (diffDays > 1) return `${diffDays} days remaining`;
        if (diffDays === -1) return 'Overdue by 1 day';
        return `Overdue by ${Math.abs(diffDays)} days`;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🏠 DOM Content Loaded - Initializing CasaLink...');
    if (typeof CasaLink !== 'undefined') {
        window.casaLink = new CasaLink();
        console.log('✅ CasaLink initialized via DOMContentLoaded');
    } else {
        console.error('❌ CasaLink class not available');
    }
});