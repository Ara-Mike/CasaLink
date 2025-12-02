class CasaLink {
    constructor() {
        console.log('🏠 CasaLink constructor starting...');
        
        this.appVersion = '1.0.3';
        this.currentUser = null;
        this.currentRole = null;
        this.isOnline = navigator.onLine;
        this.pendingActions = [];
        this.loginInProgress = false;
        this.authListenerEnabled = false;
        this.showingLogin = false;
        this.showingDashboard = false;
        this.creatingTenant = false;
        this.currentPage = this.getStoredPage() || 'dashboard';
        this.appInitialized = false;
        this.billsCurrentPage = 1;
        this.billsItemsPerPage = 10;
        this.billsTotalPages = 1;
        this.billsAllData = [];
        this.billsFilteredData = [];
        this.paymentsCurrentPage = 1;
        this.paymentsItemsPerPage = 10;
        this.paymentsTotalPages = 1;
        this.paymentsAllData = [];
        this.paymentsFilteredData = [];
        this.tenantsCurrentPage = 1;
        this.tenantsItemsPerPage = 10;
        this.tenantsTotalPages = 1;
        this.tenantsAllData = [];
        this.tenantsFilteredData = [];
        this.setupCacheBusting();

        this.activitiesCurrentPage = 1;
        this.activitiesItemsPerPage = 10;
        this.activitiesTotalPages = 1;
        this.activitiesAllData = [];
        this.activitiesFilteredData = [];
        
        // 🔥 ADD BILLING VIEW TRACKING
        this.currentBillingView = 'bills'; // Default to Bills Management
        
        this.setupBillingAutomation();
        
        // Bind methods
        this.boundLoginClickHandler = this.loginClickHandler.bind(this);
        this.boundLoginKeypressHandler = this.loginKeypressHandler.bind(this);
        this.boundHandleLogin = this.handleLogin.bind(this);
        
        // Set up global event listeners
        this.setupGlobalEventListeners();
        
        console.log('🔄 Initializing CasaLink...');
        this.init();
    }

    onLoginSuccess(user) {
        // Remove login-page class from body
        document.body.classList.remove('login-page');
        document.body.classList.add('logged-in');
        
        // Hide admin portal link
        const adminLink = document.querySelector('.admin-portal-link');
        if (adminLink) {
            adminLink.style.display = 'none';
        }
    }

    onLogout() {
        // Add login-page class back to body
        document.body.classList.add('login-page');
        document.body.classList.remove('logged-in');
        
        // Show admin portal link
        const adminLink = document.querySelector('.admin-portal-link');
        if (adminLink) {
            adminLink.style.display = 'block';
        }
    }

    setupCacheBusting() {
        // Clear cache on new version
        const storedVersion = localStorage.getItem('casalink_app_version');
        if (storedVersion !== this.appVersion) {
            console.log('🔄 New version detected, clearing cache...');
            
            // Clear all caches
            if ('caches' in window) {
                caches.keys().then(names => {
                    names.forEach(name => caches.delete(name));
                });
            }
            
            // Clear specific problematic items
            localStorage.removeItem('casalink_layout_cache');
            sessionStorage.clear();
            
            // Store new version
            localStorage.setItem('casalink_app_version', this.appVersion);
            
            // Reload to apply fresh files
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
    }

    

    addDebugTools() {
        // Only add in development or if there are issues
        if (window.location.hostname === 'localhost' || window.location.hostname.includes('firebaseapp.com')) {
            const debugButton = document.createElement('button');
            debugButton.innerHTML = '🔄 Fix Layout';
            debugButton.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 10000;
                background: var(--royal-blue);
                color: white;
                border: none;
                padding: 10px 15px;
                border-radius: 20px;
                cursor: pointer;
                font-size: 12px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                font-family: inherit;
            `;
            debugButton.onclick = () => {
                console.log('🔄 Manual cache clear triggered...');
                localStorage.removeItem('casalink_app_version');
                if ('caches' in window) {
                    caches.keys().then(names => names.forEach(name => caches.delete(name)));
                }
                window.location.reload(true);
            };
            document.body.appendChild(debugButton);
            
            console.log('🐛 Debug tools added - Click the blue button if layout breaks');
        }
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

    async checkBillingTasks() {
        try {
            // Check for auto bill generation
            await DataManager.checkAndGenerateMonthlyBills();
            
            // Check for late fees (we'll implement this later)
            // await this.applyLateFees();
            
        } catch (error) {
            console.error('Error in billing tasks:', error);
        }
    }

    async initializeBillingSystem() {
        try {
            console.log('💰 Initializing billing system...');
            await DataManager.initializeBillingSystem();
            
            // Set up daily check for billing tasks
            this.billingInterval = setInterval(() => {
                this.checkBillingTasks();
            }, 24 * 60 * 60 * 1000); // Check daily
            
            console.log('✅ Billing system initialized');
        } catch (error) {
            console.error('❌ Billing system initialization failed:', error);
        }
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
            
            // Initialize billing system
            if (this.currentUser?.role === 'landlord') {
                setTimeout(() => {
                    this.initializeBillingSystem();
                }, 3000); // Wait a bit after app loads
            }
            
            // Mark app as initialized
            this.appInitialized = true;
            
            // NOW enable auth listener
            this.authListenerEnabled = true;
            this.setupAuthListener();
            this.addDebugTools();
            
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

    cleanupPageListeners(page) {
        console.log('🧹 Cleaning up listeners for page:', page);

        // Clean up bill row observers
        if (this.billRowObserver) {
            this.billRowObserver.disconnect();
            this.billRowObserver = null;
        }

        // Remove event listeners from all bill rows
        const billRows = document.querySelectorAll('.bill-row');
        billRows.forEach(row => {
            if (row._mouseEnterHandler) {
                row.removeEventListener('mouseenter', row._mouseEnterHandler);
                row._mouseEnterHandler = null;
            }
            if (row._mouseLeaveHandler) {
                row.removeEventListener('mouseleave', row._mouseLeaveHandler);
                row._mouseLeaveHandler = null;
            }
        });

        // Always clean up dashboard listeners when leaving dashboard
        if (this.currentPage === 'dashboard') {
            this.cleanupDashboardListeners();
        }

        // Clean up tenant management listeners
        if (this.currentPage === 'tenants') {
            this.removeTenantRowClickHandlers();
        }

        // Add cleanup for other pages as needed
        switch (this.currentPage) {
            case 'billing':
                // Any additional billing cleanup can go here
                break;
            case 'maintenance':
                // Any additional maintenance cleanup can go here
                break;
        }
    }

    async showPage(page) {
        console.log('🔄 Attempting to show page:', page);
        
        // Clean up previous page listeners (UPDATED)
        this.cleanupPageListeners(page);
        
        // Store the page before showing it
        this.storeCurrentPage(page);
        this.currentPage = page;
        this.updateUrlHash(page);

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
            
            // Delay to ensure DOM updates
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Try again
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

            // FULL PAGE SWITCH (KEPT FROM FIRST VERSION)
            switch (page) {
                case 'dashboard':
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

                case 'lease-management':  
                    this.setupLeaseManagementPage?.();
                    pageContent = await this.getLeaseManagementPage();              
            
                    break;

                default:
                    pageContent = `
                        <div class="page-content">
                            <h1>${page} Page</h1>
                            <p>This page is under construction.</p>
                        </div>
                    `;
            }

            // If Promise returned
            if (pageContent instanceof Promise) {
                console.log('⚠️ Page content is a Promise, awaiting...');
                pageContent = await pageContent;
            }

            // Ensure content is a string
            if (typeof pageContent === 'string') {
                finalContentArea.innerHTML = pageContent;
                console.log('✅ Page content loaded successfully');
            } else {
                console.error('❌ Page content is not a string:', typeof pageContent, pageContent);
                throw new Error('Invalid page content');
            }

            // Setup page-specific events
            this.setupPageEvents(page);

            // Update nav state
            this.updateActiveNavState(page);

            // SPECIAL CASE: DASHBOARD (MERGED FROM BOTH VERSIONS)
            if (page === 'dashboard') {
                console.log('📊 Force refreshing dashboard data and setting up listeners...');
                setTimeout(() => {
                    this.loadDashboardData();
                    this.setupRealTimeStats();
                    // Recent activities handled internally
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
        console.log('📊 Loading reports page content...');
        
        return `
            <div class="reports-dashboard">
                <div class="page-header">
                    <div class="page-title">Reports & Analytics</div>
                    <div class="header-actions">
                        <button class="btn btn-secondary" id="exportReportBtn">
                            <i class="fas fa-download"></i> Export Report
                        </button>
                        <button class="btn btn-primary" id="refreshReportsBtn">
                            <i class="fas fa-sync-alt"></i> Refresh Data
                        </button>
                    </div>
                </div>

                <!-- Quick Stats Overview -->
                <div class="quick-stats-row">
                    <div class="quick-stat-card">
                        <div class="quick-stat-value">₱84,500</div>
                        <div class="quick-stat-label">Monthly Revenue</div>
                    </div>
                    <div class="quick-stat-card">
                        <div class="quick-stat-value">94%</div>
                        <div class="quick-stat-label">Occupancy Rate</div>
                    </div>
                    <div class="quick-stat-card">
                        <div class="quick-stat-value">97%</div>
                        <div class="quick-stat-label">Collection Rate</div>
                    </div>
                    <div class="quick-stat-card">
                        <div class="quick-stat-value">₱2,150</div>
                        <div class="quick-stat-label">Avg. Maintenance/Month</div>
                    </div>
                </div>

                <!-- Charts Grid -->
                <div class="charts-grid">
                    <!-- Row 1 -->
                    <div class="chart-card large">
                        <div class="chart-header">
                            <h3>Monthly Revenue Trend</h3>
                            <div class="chart-actions">
                                <select class="filter-select" id="revenuePeriod">
                                    <option>Last 6 Months</option>
                                    <option>Last 12 Months</option>
                                    <option>Year to Date</option>
                                </select>
                            </div>
                        </div>
                        <div class="chart-container">
                            <canvas id="revenueTrendChart"></canvas>
                        </div>
                    </div>

                    <div class="chart-card">
                        <div class="chart-header">
                            <h3>Payment Methods</h3>
                        </div>
                        <div class="chart-container">
                            <canvas id="paymentMethodsChart"></canvas>
                        </div>
                    </div>

                    <!-- Row 2 -->
                    <div class="chart-card">
                        <div class="chart-header">
                            <h3>Revenue per Unit</h3>
                        </div>
                        <div class="chart-container">
                            <canvas id="revenuePerUnitChart"></canvas>
                        </div>
                    </div>

                    <div class="chart-card">
                        <div class="chart-header">
                            <h3>Occupancy Status</h3>
                        </div>
                        <div class="chart-container">
                            <canvas id="occupancyChart"></canvas>
                        </div>
                    </div>

                    <div class="chart-card">
                        <div class="chart-header">
                            <h3>Late Payments</h3>
                        </div>
                        <div class="chart-container">
                            <canvas id="latePaymentsChart"></canvas>
                        </div>
                    </div>

                    <!-- Row 3 - Additional Metrics -->
                    <div class="chart-card">
                        <div class="chart-header">
                            <h3>Maintenance Costs</h3>
                        </div>
                        <div class="chart-container">
                            <canvas id="maintenanceCostsChart"></canvas>
                        </div>
                    </div>

                    <div class="chart-card">
                        <div class="chart-header">
                            <h3>Tenant Retention</h3>
                        </div>
                        <div class="chart-container">
                            <canvas id="retentionChart"></canvas>
                        </div>
                    </div>

                    <div class="chart-card">
                        <div class="chart-header">
                            <h3>Rent vs Market</h3>
                        </div>
                        <div class="chart-container">
                            <canvas id="rentComparisonChart"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Key Metrics Summary -->
                <div class="metrics-summary">
                    <div class="section-title">Key Performance Indicators</div>
                    <div class="metrics-grid">
                        <div class="metric-item">
                            <div class="metric-icon success">
                                <i class="fas fa-trend-up"></i>
                            </div>
                            <div class="metric-content">
                                <div class="metric-value">+12.5%</div>
                                <div class="metric-label">Revenue Growth</div>
                            </div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-icon warning">
                                <i class="fas fa-clock"></i>
                            </div>
                            <div class="metric-content">
                                <div class="metric-value">4.2%</div>
                                <div class="metric-label">Late Payment Rate</div>
                            </div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-icon info">
                                <i class="fas fa-home"></i>
                            </div>
                            <div class="metric-content">
                                <div class="metric-value">18/20</div>
                                <div class="metric-label">Units Occupied</div>
                            </div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-icon primary">
                                <i class="fas fa-sync-alt"></i>
                            </div>
                            <div class="metric-content">
                                <div class="metric-value">78%</div>
                                <div class="metric-label">Lease Renewal Rate</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async showEditProfileModal() {
        console.log('📝 Opening edit profile modal...');
        
        try {
            const tenantData = await DataManager.getTenantProfile(this.currentUser.id);
            
            if (!tenantData) {
                this.showNotification('Unable to load profile data', 'error');
                return;
            }

            const modalContent = `
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    <div class="form-group">
                        <label class="form-label">Full Name</label>
                        <input type="text" class="form-input" id="editName" value="${tenantData.name}" placeholder="Enter your full name">
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="form-group">
                            <label class="form-label">Phone Number</label>
                            <input type="tel" class="form-input" id="editPhone" value="${tenantData.phone || ''}" placeholder="09XXXXXXXXX">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Age</label>
                            <input type="number" class="form-input" id="editAge" value="${tenantData.age || ''}" placeholder="Your age" min="18" max="120">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Occupation</label>
                        <input type="text" class="form-input" id="editOccupation" value="${tenantData.occupation || ''}" placeholder="Your occupation">
                    </div>

                    <div id="editProfileError" style="display: none; padding: 15px; background: #ffebee; border-radius: 8px; color: var(--danger); border-left: 4px solid var(--danger);">
                        <i class="fas fa-exclamation-circle" style="margin-right: 8px;"></i>
                        <span id="editProfileErrorText"></span>
                    </div>
                </div>
            `;

            ModalManager.openModal(modalContent, {
                title: 'Edit Profile',
                submitText: 'Save Changes',
                cancelText: 'Cancel',
                showFooter: true,
                width: '500px',
                onSubmit: () => this.saveProfileChanges(tenantData)
            });

        } catch (error) {
            console.error('Error opening edit profile modal:', error);
            this.showNotification('Failed to load profile editor', 'error');
        }
    }

    // Save Profile Changes
    async saveProfileChanges(originalData) {
        console.log('💾 Saving profile changes...');
        
        try {
            // Get form values
            const name = document.getElementById('editName')?.value || '';
            const phone = document.getElementById('editPhone')?.value || '';
            const age = document.getElementById('editAge')?.value || '';
            const occupation = document.getElementById('editOccupation')?.value || '';

            // Validate
            if (!name.trim()) {
                this.showEditProfileError('Please enter your full name');
                return;
            }

            if (phone && !/^[0-9\s\-+()]+$/.test(phone)) {
                this.showEditProfileError('Please enter a valid phone number');
                return;
            }

            if (age && (age < 18 || age > 120)) {
                this.showEditProfileError('Age must be between 18 and 120');
                return;
            }

            // Prepare updates
            const updates = {
                name: name.trim(),
                phone: phone.trim(),
                age: age ? parseInt(age) : 0,
                occupation: occupation.trim(),
                updatedAt: new Date().toISOString()
            };

            // Update in Firestore
            await firebaseDb.collection('users').doc(this.currentUser.id).update(updates);

            // Update local user data
            this.currentUser = {
                ...this.currentUser,
                ...updates
            };

            console.log('✅ Profile updated successfully');
            this.showNotification('Profile updated successfully!', 'success');

            // Close modal and reload page
            setTimeout(() => {
                this.showPage('tenantProfile');
            }, 1500);

        } catch (error) {
            console.error('Error saving profile:', error);
            this.showEditProfileError(error.message || 'Failed to save changes');
        }
    }

    showEditProfileError(message) {
        const errorElement = document.getElementById('editProfileError');
        const errorText = document.getElementById('editProfileErrorText');
        
        if (errorElement && errorText) {
            errorText.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    async getTenantProfilePage() {
        console.log('📋 Loading tenant profile page...');
        
        if (!this.currentUser) {
            return this.getErrorDashboard('tenantProfile', 'User not authenticated');
        }

        try {
            // Fetch tenant data
            const tenantData = await DataManager.getTenantProfile(this.currentUser.id);
            const lease = await DataManager.getTenantLease(this.currentUser.id);
            
            if (!tenantData) {
                return `
                    <div class="page-content">
                        <div class="page-header">
                            <h1 class="page-title">My Profile</h1>
                        </div>
                        <div class="error-state">
                            <i class="fas fa-exclamation-triangle"></i>
                            <h3>Profile Not Found</h3>
                            <p>Unable to load your profile information.</p>
                        </div>
                    </div>
                `;
            }

            const profileHTML = `
                <div class="page-content">
                    <div class="page-header">
                        <div>
                            <h1 class="page-title">My Profile</h1>
                            <p style="color: var(--dark-gray); margin-top: 5px;">Manage your personal information and account settings</p>
                        </div>
                        <button class="btn btn-primary" onclick="casaLink.showEditProfileModal()">
                            <i class="fas fa-edit"></i> Edit Profile
                        </button>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 25px; max-width: 1200px;">
                        <!-- Left Column: Profile Card -->
                        <div style="display: flex; flex-direction: column; gap: 20px;">
                            <!-- Profile Card -->
                            <div class="card" style="text-align: center;">
                                <div class="avatar" style="width: 80px; height: 80px; margin: 0 auto 15px; font-size: 2rem;">
                                    ${tenantData.name.charAt(0).toUpperCase()}
                                </div>
                                <h2 style="margin: 0 0 5px 0; color: var(--text-dark);">${tenantData.name}</h2>
                                <p style="color: var(--dark-gray); margin: 0 0 15px 0;">${tenantData.email}</p>
                                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                                    <span class="status-badge active">
                                        <i class="fas fa-check-circle"></i> Active Tenant
                                    </span>
                                </div>
                            </div>

                            <!-- Quick Stats -->
                            <div class="card">
                                <h3 style="margin: 0 0 15px 0; color: var(--text-dark);">Quick Stats</h3>
                                <div style="display: flex; flex-direction: column; gap: 12px;">
                                    <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8f9fa; border-radius: 6px;">
                                        <span style="color: var(--dark-gray);">Room Number</span>
                                        <strong>${tenantData.roomNumber || 'N/A'}</strong>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8f9fa; border-radius: 6px;">
                                        <span style="color: var(--dark-gray);">Account Status</span>
                                        <strong style="color: var(--success);">Verified</strong>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8f9fa; border-radius: 6px;">
                                        <span style="color: var(--dark-gray);">Member Since</span>
                                        <strong>${this.formatDate(tenantData.createdAt)}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Right Column: Profile Details -->
                        <div style="display: flex; flex-direction: column; gap: 20px;">
                            <!-- Personal Information -->
                            <div class="card">
                                <h3 style="margin: 0 0 20px 0; color: var(--text-dark); border-bottom: 2px solid var(--royal-blue); padding-bottom: 10px;">
                                    <i class="fas fa-user" style="color: var(--royal-blue); margin-right: 10px;"></i>
                                    Personal Information
                                </h3>
                                
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                                    <div>
                                        <label style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500; display: block; margin-bottom: 5px;">Full Name</label>
                                        <p style="margin: 0; color: var(--text-dark); font-weight: 500;">${tenantData.name}</p>
                                    </div>
                                    <div>
                                        <label style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500; display: block; margin-bottom: 5px;">Email Address</label>
                                        <p style="margin: 0; color: var(--text-dark); font-weight: 500; word-break: break-all;">${tenantData.email}</p>
                                    </div>
                                    <div>
                                        <label style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500; display: block; margin-bottom: 5px;">Phone Number</label>
                                        <p style="margin: 0; color: var(--text-dark); font-weight: 500;">${tenantData.phone || 'Not provided'}</p>
                                    </div>
                                    <div>
                                        <label style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500; display: block; margin-bottom: 5px;">Age</label>
                                        <p style="margin: 0; color: var(--text-dark); font-weight: 500;">${tenantData.age || 'Not provided'}</p>
                                    </div>
                                </div>

                                <div style="margin-top: 20px;">
                                    <label style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500; display: block; margin-bottom: 5px;">Occupation</label>
                                    <p style="margin: 0; color: var(--text-dark); font-weight: 500;">${tenantData.occupation || 'Not provided'}</p>
                                </div>
                            </div>

                            <!-- Property Information -->
                            <div class="card">
                                <h3 style="margin: 0 0 20px 0; color: var(--text-dark); border-bottom: 2px solid var(--success); padding-bottom: 10px;">
                                    <i class="fas fa-home" style="color: var(--success); margin-right: 10px;"></i>
                                    Property Information
                                </h3>

                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                                    <div>
                                        <label style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500; display: block; margin-bottom: 5px;">Room Number</label>
                                        <p style="margin: 0; color: var(--text-dark); font-weight: 500; font-size: 1.2rem;">${tenantData.roomNumber || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500; display: block; margin-bottom: 5px;">Monthly Rent</label>
                                        <p style="margin: 0; color: var(--text-dark); font-weight: 500; font-size: 1.2rem;">₱${lease?.monthlyRent ? parseFloat(lease.monthlyRent).toLocaleString() : '0'}</p>
                                    </div>
                                </div>

                                <div style="margin-top: 20px;">
                                    <label style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500; display: block; margin-bottom: 5px;">Rental Address</label>
                                    <p style="margin: 0; color: var(--text-dark); font-weight: 500;">${tenantData.rentalAddress || 'Not provided'}</p>
                                </div>

                                ${lease ? `
                                    <div style="margin-top: 20px; padding: 15px; background: #f0f7ff; border-radius: 8px; border-left: 4px solid var(--info);">
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                            <div>
                                                <label style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500; display: block; margin-bottom: 5px;">Lease Start Date</label>
                                                <p style="margin: 0; color: var(--text-dark); font-weight: 500;">${this.formatDate(lease.leaseStart)}</p>
                                            </div>
                                            <div>
                                                <label style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500; display: block; margin-bottom: 5px;">Lease End Date</label>
                                                <p style="margin: 0; color: var(--text-dark); font-weight: 500;">${this.formatDate(lease.leaseEnd)}</p>
                                            </div>
                                        </div>
                                        <div style="margin-top: 10px; text-align: center;">
                                            <small style="color: var(--dark-gray);">Days Remaining: <strong>${this.getDaysRemaining(lease.leaseEnd)}</strong></small>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>

                            <!-- Account Security -->
                            <div class="card">
                                <h3 style="margin: 0 0 20px 0; color: var(--text-dark); border-bottom: 2px solid var(--warning); padding-bottom: 10px;">
                                    <i class="fas fa-lock" style="color: var(--warning); margin-right: 10px;"></i>
                                    Account Security
                                </h3>

                                <div style="display: flex; flex-direction: column; gap: 15px;">
                                    <div style="padding: 15px; background: #fffbf0; border-radius: 8px; border-left: 4px solid var(--warning);">
                                        <label style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500; display: block; margin-bottom: 5px;">Password</label>
                                        <p style="margin: 0 0 10px 0; color: var(--text-dark);">••••••••</p>
                                        <button class="btn btn-warning btn-sm" onclick="casaLink.showPasswordChangeModal()">
                                            <i class="fas fa-key"></i> Change Password
                                        </button>
                                    </div>

                                    <div style="padding: 15px; background: #f0fff4; border-radius: 8px;">
                                        <label style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500; display: block; margin-bottom: 10px;">
                                            <i class="fas fa-check-circle" style="color: var(--success); margin-right: 8px;"></i>
                                            Two-Factor Authentication
                                        </label>
                                        <p style="margin: 0; color: var(--dark-gray); font-size: 0.9rem;">Enhance your account security with 2FA (Coming soon)</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            return profileHTML;

        } catch (error) {
            console.error('❌ Error loading tenant profile:', error);
            return this.getErrorDashboard('tenantProfile', error.message);
        }
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

    setupGlobalEventListeners() {

        document.addEventListener('click', (e) => {
            if (this.currentPage !== 'dashboard') return;

            const clickableCard = e.target.closest('[data-clickable]');
            if (!clickableCard) return;

            e.preventDefault();
            e.stopPropagation();

            const cardType = clickableCard.getAttribute('data-clickable');
            console.log(`🏠 ${cardType} card clicked`);

            // Debounce to prevent double-trigger
            if (this.lastCardClick && Date.now() - this.lastCardClick < 1000) {
                console.log('⏳ Ignoring rapid click');
                return false;
            }
            this.lastCardClick = Date.now();

            // 🌟 Dashboard > Property Overview Cards
            if (cardType === 'occupancy') {
                this.showUnitOccupancyModal();
            } else if (cardType === 'vacant') {
                this.showVacantUnitsModal();
            } else if (cardType === 'tenants') {
                this.showTenantDetailsModal();
            }

            // 🌟 Dashboard > Financial Overview Cards
            else if (cardType === 'collection') {
                this.showRentCollectionModal();
            } else if (cardType === 'revenue') {
                this.showRevenueDetailsModal();
            } else if (cardType === 'late') {
                this.showLatePaymentsModal();
            } else if (cardType === 'unpaid') {
                this.showUnpaidBillsModal();
            }

            // 🌟 Dashboard > Operations Cards
            else if (cardType === 'renewals') {
                this.showLeaseRenewalsModal();
            } else if (cardType === 'open-maintenance') {
                this.showOpenMaintenanceModal();
            } else if (cardType === 'backlog') {
                this.showMaintenanceBacklogModal();
            }

            // 🌟 Billing Page Cards
            else if (cardType === 'pending-bills') {
                this.filterBills('pending');
            } else if (cardType === 'overdue-bills') {
                this.filterBills('overdue');
            } else if (cardType === 'all-bills') {
                this.filterBills('all');
            }

            return false;
        });
    }

    async loadRecentActivities() {
        console.log('🔍 STEP 1: Starting loadRecentActivities');
        
        // Check if user is available
        if (!this.currentUser) {
            console.error('❌ STEP 1 FAILED: No current user');
            this.showActivityError('User not authenticated');
            return;
        }
        
        console.log('✅ STEP 1 PASSED: User found:', this.currentUser.email);
        
        try {
            // Show loading state immediately
            const activityList = document.getElementById('recentActivityList');
            if (activityList) {
                activityList.innerHTML = `
                    <div class="activity-loading">
                        <i class="fas fa-spinner fa-spin"></i> Loading recent activity...
                    </div>
                `;
            }
            
            console.log('🔍 STEP 2: Calling fetchRecentActivities');
            const activities = await this.fetchRecentActivities();
            console.log('🔍 STEP 3: Received activities:', activities?.length || 0);
            
            this.displayRecentActivities(activities);
            console.log('✅ STEP 3 COMPLETE: Activities displayed');
        } catch (error) {
            console.error('❌ STEP 2 FAILED: Error in loadRecentActivities:', error);
            this.showActivityError();
        }
    }

    async debugActivityCounts() {
        console.log('🐛 DEBUG: Activity Counts by Type');
        
        const now = new Date();
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(now.getDate() - 60);
        
        try {
            const collections = ['users', 'payments', 'bills', 'maintenance'];
            const counts = {};
            
            for (const collection of collections) {
                const snapshot = await firebaseDb.collection(collection)
                    .where('landlordId', '==', this.currentUser.uid)
                    .where('createdAt', '>=', sixtyDaysAgo)
                    .where('createdAt', '<=', now)
                    .get();
                
                counts[collection] = snapshot.size;
                console.log(`📊 ${collection}: ${snapshot.size} documents`);
            }
            
            console.log('📈 Total potential activities:', Object.values(counts).reduce((a, b) => a + b, 0));
            return counts;
            
        } catch (error) {
            console.error('Debug error:', error);
        }
    }

    getSampleActivities() {
        console.log('🔍 Creating sample activities for demonstration');
        
        const now = new Date();
        const sampleActivities = [
            {
                type: 'payment_received',
                title: 'Payment Received',
                description: '₱12,000 from Maria Santos - Room 2A',
                timestamp: new Date(now.getFullYear(), now.getMonth(), 15).toISOString(),
                icon: 'fas fa-credit-card',
                color: 'var(--success)',
                data: { amount: 12000, tenantName: 'Maria Santos' }
            },
            {
                type: 'maintenance_request',
                title: 'Maintenance Request',
                description: 'Plumbing issue in Room 3B - High Priority',
                timestamp: new Date(now.getFullYear(), now.getMonth(), 12).toISOString(),
                icon: 'fas fa-tools',
                color: 'var(--warning)',
                data: { type: 'plumbing', tenantName: 'John Rivera' }
            },
            {
                type: 'new_tenant',
                title: 'New Tenant Registered',
                description: 'Carlos Reyes - Room 1C',
                timestamp: new Date(now.getFullYear(), now.getMonth(), 8).toISOString(),
                icon: 'fas fa-user-plus',
                color: 'var(--info)',
                data: { name: 'Carlos Reyes', roomNumber: '1C' }
            },
            {
                type: 'bill_generated',
                title: 'Auto-Generated Bill',
                description: '₱10,500 monthly rent for Ana Lopez',
                timestamp: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
                icon: 'fas fa-file-invoice',
                color: 'var(--warning)',
                data: { totalAmount: 10500, tenantName: 'Ana Lopez' }
            },
            // ADD MORE SAMPLE ACTIVITIES
            {
                type: 'payment_received',
                title: 'Payment Received',
                description: '₱15,000 from Roberto Cruz - Room 4A',
                timestamp: new Date(now.getFullYear(), now.getMonth() - 1, 20).toISOString(),
                icon: 'fas fa-credit-card',
                color: 'var(--success)',
                data: { amount: 15000, tenantName: 'Roberto Cruz' }
            },
            {
                type: 'maintenance_request',
                title: 'Maintenance Request',
                description: 'Electrical issue in Room 2B - Medium Priority',
                timestamp: new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString(),
                icon: 'fas fa-tools',
                color: 'var(--warning)',
                data: { type: 'electrical', tenantName: 'Lisa Mendoza' }
            }
        ];
        
        return sampleActivities;
    }

    debugRecentActivities() {
        console.log('🐛 DEBUG: Recent Activities');
        console.log('Current User:', this.currentUser);
        
        const activityList = document.getElementById('recentActivityList');
        console.log('Activity List Element:', activityList);
        
        // Manually trigger activities load
        this.loadRecentActivities();
    }

    removeDuplicateActivities(activities) {
        const seen = new Set();
        return activities.filter(activity => {
            // Create a unique key based on timestamp and description
            const key = `${activity.timestamp}_${activity.description}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    async debugFirestoreCollections() {
        console.log('🐛 DEBUG: Checking Firestore collections...');
        
        const collections = ['users', 'payments', 'bills', 'maintenance'];
        
        for (const collection of collections) {
            try {
                const snapshot = await firebaseDb.collection(collection)
                    .where('landlordId', '==', this.currentUser.uid)
                    .limit(5)
                    .get();
                
                console.log(`📊 ${collection}: ${snapshot.size} documents found`);
                
                snapshot.forEach(doc => {
                    console.log(`   📄 ${doc.id}:`, doc.data());
                });
            } catch (error) {
                console.error(`❌ Error fetching ${collection}:`, error);
            }
        }
    }

    debugRecentActivitiesData() {
        console.log('🐛 DEBUG: Recent Activities Data Flow');
        this.debugFirestoreCollections();
        this.loadRecentActivities();
    }

    debugActivityQueries() {
        console.log('🐛 DEBUG: Activity Query Results - ENHANCED');
        
        const now = new Date();
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(now.getDate() - 60);
        
        console.log('📅 Date range:', {
            from: sixtyDaysAgo.toISOString(),
            to: now.toISOString(),
            user: this.currentUser.uid
        });

        // Test each query individually with better error handling
        const testQueries = [
            {
                name: 'users',
                query: firebaseDb.collection('users')
                    .where('landlordId', '==', this.currentUser.uid)
                    .where('role', '==', 'tenant')
            },
            {
                name: 'payments', 
                query: firebaseDb.collection('payments')
                    .where('landlordId', '==', this.currentUser.uid)
            },
            {
                name: 'bills',
                query: firebaseDb.collection('bills')
                    .where('landlordId', '==', this.currentUser.uid)
            },
            {
                name: 'maintenance',
                query: firebaseDb.collection('maintenance')
                    .where('landlordId', '==', this.currentUser.uid)
            }
        ];
        
        // Test without date filters first
        console.log('🔍 TEST 1: Without date filters');
        testQueries.forEach(async (test) => {
            try {
                const simpleQuery = firebaseDb.collection(test.name)
                    .where('landlordId', '==', this.currentUser.uid)
                    .limit(10);
                    
                const snapshot = await simpleQuery.get();
                console.log(`📊 ${test.name} (no date filter): ${snapshot.size} documents`);
                
                if (snapshot.size > 0) {
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        console.log(`   📄 ${doc.id}:`, {
                            createdAt: data.createdAt,
                            landlordId: data.landlordId,
                            // Show relevant fields for each collection
                            ...(test.name === 'users' && { name: data.name, email: data.email }),
                            ...(test.name === 'payments' && { amount: data.amount, paymentDate: data.paymentDate }),
                            ...(test.name === 'bills' && { totalAmount: data.totalAmount, dueDate: data.dueDate }),
                            ...(test.name === 'maintenance' && { title: data.title, status: data.status })
                        });
                    });
                }
            } catch (error) {
                console.error(`❌ Error in ${test.name} simple query:`, error);
            }
        });

        // Test with date filters
        setTimeout(async () => {
            console.log('\n🔍 TEST 2: With date filters');
            for (const test of testQueries) {
                try {
                    let dateField = 'createdAt';
                    if (test.name === 'payments') dateField = 'paymentDate';
                    
                    const dateQuery = firebaseDb.collection(test.name)
                        .where('landlordId', '==', this.currentUser.uid)
                        .where(dateField, '>=', sixtyDaysAgo)
                        .where(dateField, '<=', now)
                        .limit(10);
                        
                    const snapshot = await dateQuery.get();
                    console.log(`📊 ${test.name} (with date filter): ${snapshot.size} documents`);
                    
                    if (snapshot.size > 0) {
                        snapshot.forEach(doc => {
                            const data = doc.data();
                            console.log(`   📄 ${doc.id}:`, {
                                [dateField]: data[dateField],
                                // Show relevant fields
                                ...(test.name === 'users' && { name: data.name }),
                                ...(test.name === 'payments' && { amount: data.amount }),
                                ...(test.name === 'bills' && { totalAmount: data.totalAmount }),
                                ...(test.name === 'maintenance' && { title: data.title })
                            });
                        });
                    } else {
                        console.log(`   ℹ️  No documents found with date range for ${test.name}`);
                        
                        // Check what dates actually exist in documents
                        const anyDoc = await firebaseDb.collection(test.name)
                            .where('landlordId', '==', this.currentUser.uid)
                            .limit(1)
                            .get();
                            
                        if (!anyDoc.empty) {
                            const docData = anyDoc.docs[0].data();
                            const dateValue = docData[dateField] || docData.createdAt;
                            console.log(`   📅 Sample date in ${test.name}:`, dateValue);
                        }
                    }
                } catch (error) {
                    console.error(`❌ Error in ${test.name} date query:`, error);
                }
            }
        }, 1000);
    }

    async debugFirestoreStructure() {
        console.log('🏗️ DEBUG: Firestore Structure Analysis');
        
        const collections = ['users', 'payments', 'bills', 'maintenance'];
        
        for (const collection of collections) {
            try {
                console.log(`\n📁 Checking ${collection} collection structure...`);
                
                // Get first document to see structure
                const snapshot = await firebaseDb.collection(collection)
                    .where('landlordId', '==', this.currentUser.uid)
                    .limit(1)
                    .get();
                    
                if (snapshot.empty) {
                    console.log(`   ❌ No documents found in ${collection} for current user`);
                    continue;
                }
                
                const doc = snapshot.docs[0];
                const data = doc.data();
                
                console.log(`   ✅ Document structure for ${collection}:`);
                console.log('   Fields:', Object.keys(data));
                
                // Check for date fields
                const dateFields = Object.keys(data).filter(key => 
                    typeof data[key] === 'string' && 
                    data[key].match(/\d{4}-\d{2}-\d{2}/) &&
                    !isNaN(new Date(data[key]).getTime())
                );
                
                if (dateFields.length > 0) {
                    console.log(`   📅 Date fields: ${dateFields.join(', ')}`);
                    dateFields.forEach(field => {
                        console.log(`      ${field}: ${data[field]}`);
                    });
                } else {
                    console.log('   ⚠️ No recognizable date fields found');
                }
                
            } catch (error) {
                console.error(`❌ Error analyzing ${collection}:`, error);
            }
        }
    }

    async fetchRecentActivities() {
        console.log('🔍 STEP 2.1: Starting fetchRecentActivities - IMPROVED');
        
        const activities = [];
        const now = new Date();
        
        // Use last 90 days for better coverage
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(now.getDate() - 90);
        
        console.log('📅 Date range for queries:', {
            from: ninetyDaysAgo.toISOString(),
            to: now.toISOString(),
            user: this.currentUser.uid
        });

        try {
            const fetchPromises = [];
            
            // 1. Fetch Recent Tenants - SIMPLIFIED
            console.log('🔍 Fetching recent tenants...');
            fetchPromises.push(
                firebaseDb.collection('users')
                    .where('landlordId', '==', this.currentUser.uid)
                    .where('role', '==', 'tenant')
                    .orderBy('createdAt', 'desc')
                    .limit(20)
                    .get().then(snapshot => {
                        console.log(`✅ Found ${snapshot.size} tenants total`);
                        snapshot.forEach(doc => {
                            const tenant = doc.data();
                            // Check if tenant is within date range
                            const tenantDate = new Date(tenant.createdAt);
                            if (tenantDate >= ninetyDaysAgo && tenantDate <= now) {
                                activities.push({
                                    type: 'new_tenant',
                                    title: 'New Tenant Registered',
                                    description: `${tenant.name} - ${tenant.roomNumber || 'No room'}`,
                                    timestamp: tenant.createdAt,
                                    icon: 'fas fa-user-plus',
                                    color: 'var(--success)',
                                    data: { ...tenant, id: doc.id }
                                });
                            }
                        });
                    }).catch(error => {
                        console.error('❌ Error fetching tenants:', error);
                    })
            );

            // 2. Fetch Recent Payments - SIMPLIFIED
            console.log('🔍 Fetching recent payments...');
            fetchPromises.push(
                firebaseDb.collection('payments')
                    .where('landlordId', '==', this.currentUser.uid)
                    .orderBy('paymentDate', 'desc')
                    .limit(20)
                    .get().then(snapshot => {
                        console.log(`✅ Found ${snapshot.size} payments total`);
                        snapshot.forEach(doc => {
                            const payment = doc.data();
                            const paymentDate = new Date(payment.paymentDate || payment.createdAt);
                            if (paymentDate >= ninetyDaysAgo && paymentDate <= now) {
                                activities.push({
                                    type: 'payment_received',
                                    title: 'Payment Received',
                                    description: `₱${payment.amount?.toLocaleString()} from ${payment.tenantName || 'Tenant'}`,
                                    timestamp: payment.paymentDate || payment.createdAt,
                                    icon: 'fas fa-credit-card',
                                    color: 'var(--success)',
                                    data: { ...payment, id: doc.id }
                                });
                            }
                        });
                    }).catch(error => {
                        console.error('❌ Error fetching payments:', error);
                    })
            );

            // 3. Fetch Recent Bills - SIMPLIFIED
            console.log('🔍 Fetching recent bills...');
            fetchPromises.push(
                firebaseDb.collection('bills')
                    .where('landlordId', '==', this.currentUser.uid)
                    .orderBy('createdAt', 'desc')
                    .limit(20)
                    .get().then(snapshot => {
                        console.log(`✅ Found ${snapshot.size} bills total`);
                        snapshot.forEach(doc => {
                            const bill = doc.data();
                            const billDate = new Date(bill.createdAt);
                            if (billDate >= ninetyDaysAgo && billDate <= now) {
                                activities.push({
                                    type: 'bill_generated',
                                    title: bill.isAutoGenerated ? 'Auto-Generated Bill' : 'Manual Bill Created',
                                    description: `₱${bill.totalAmount?.toLocaleString()} for ${bill.tenantName || 'Tenant'}`,
                                    timestamp: bill.createdAt,
                                    icon: 'fas fa-file-invoice',
                                    color: bill.isAutoGenerated ? 'var(--warning)' : 'var(--info)',
                                    data: { ...bill, id: doc.id }
                                });
                            }
                        });
                    }).catch(error => {
                        console.error('❌ Error fetching bills:', error);
                    })
            );

            // 4. Fetch Maintenance Requests - SIMPLIFIED
            console.log('🔍 Fetching maintenance requests...');
            fetchPromises.push(
                firebaseDb.collection('maintenance')
                    .where('landlordId', '==', this.currentUser.uid)
                    .orderBy('createdAt', 'desc')
                    .limit(20)
                    .get().then(snapshot => {
                        console.log(`✅ Found ${snapshot.size} maintenance requests total`);
                        snapshot.forEach(doc => {
                            const request = doc.data();
                            const requestDate = new Date(request.createdAt);
                            if (requestDate >= ninetyDaysAgo && requestDate <= now) {
                                activities.push({
                                    type: 'maintenance_request',
                                    title: 'Maintenance Request',
                                    description: `${request.type || 'General'} issue from ${request.tenantName || 'Tenant'}`,
                                    timestamp: request.createdAt,
                                    icon: 'fas fa-tools',
                                    color: 'var(--info)',
                                    data: { ...request, id: doc.id }
                                });
                            }
                        });
                    }).catch(error => {
                        console.error('❌ Error fetching maintenance:', error);
                    })
            );

            // Wait for all queries
            await Promise.allSettled(fetchPromises);
            
            console.log(`📊 Total activities collected: ${activities.length}`);
            
            // DEBUG: Log what we found
            const activityCounts = {
                tenants: activities.filter(a => a.type === 'new_tenant').length,
                payments: activities.filter(a => a.type === 'payment_received').length,
                bills: activities.filter(a => a.type === 'bill_generated').length,
                maintenance: activities.filter(a => a.type === 'maintenance_request').length
            };
            
            console.log('🔍 Activities found by type:', activityCounts);

            // If no activities found, check why
            if (activities.length === 0) {
                console.log('❌ No activities found. Possible issues:');
                console.log('   1. Date range too restrictive');
                console.log('   2. Field names mismatch (createdAt vs timestamp)');
                console.log('   3. No data in the collections');
                console.log('   4. landlordId mismatch');
                
                // Provide sample data for demo
                console.log('📝 Providing sample data for demonstration');
                const sampleActivities = this.getSampleActivities();
                return sampleActivities;
            }

            // Sort by timestamp (newest first)
            const sortedActivities = activities.sort((a, b) => 
                new Date(b.timestamp) - new Date(a.timestamp)
            );
            
            const uniqueActivities = this.removeDuplicateActivities(sortedActivities);
            
            console.log('✅ Activities processed:', {
                total: activities.length,
                unique: uniqueActivities.length,
                sorted: sortedActivities.length
            });
            
            return uniqueActivities;

        } catch (error) {
            console.error('❌ Error in fetchRecentActivities:', error);
            console.log('🔄 Providing sample data due to error');
            return this.getSampleActivities();
        }
    }

    testActivitiesPagination() {
        console.log('🧪 Testing activities pagination...');
        console.log('Pagination State:', {
            currentPage: this.activitiesCurrentPage,
            totalPages: this.activitiesTotalPages,
            itemsPerPage: this.activitiesItemsPerPage,
            totalItems: this.activitiesFilteredData.length,
            allData: this.activitiesAllData.length
        });
        
        const paginationContainer = document.getElementById('activitiesPagination');
        console.log('Pagination Container:', paginationContainer ? 'Found' : 'Not Found');
        
        const pageNumbers = document.getElementById('activitiesPageNumbers');
        console.log('Page Numbers:', pageNumbers ? 'Found' : 'Not Found');
        
        // Force refresh the pagination
        this.setupActivitiesPagination();
    }

    updateActivitiesPaginationControls() {
        const pageNumbers = document.getElementById('activitiesPageNumbers');
        if (!pageNumbers) {
            console.error('❌ Activities page numbers container not found');
            return;
        }
        
        pageNumbers.innerHTML = '';
        
        console.log(`🔄 Updating pagination controls for page ${this.activitiesCurrentPage} of ${this.activitiesTotalPages}`);
        
        // Show page numbers (max 5 pages)
        const startPage = Math.max(1, this.activitiesCurrentPage - 2);
        const endPage = Math.min(this.activitiesTotalPages, startPage + 4);
        
        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.className = `btn btn-sm ${i === this.activitiesCurrentPage ? 'btn-primary' : 'btn-secondary'}`;
            pageButton.textContent = i;
            pageButton.onclick = () => {
                console.log(`🔢 Page ${i} clicked`);
                this.activitiesCurrentPage = i;
                this.updateActivitiesList(this.getCurrentActivitiesPage());
                this.updateActivitiesPaginationControls();
            };
            pageNumbers.appendChild(pageButton);
        }
        
        // Update button states
        const prevButton = document.getElementById('activitiesPrevPage');
        const nextButton = document.getElementById('activitiesNextPage');
        
        if (prevButton) {
            prevButton.disabled = this.activitiesCurrentPage === 1;
            prevButton.title = this.activitiesCurrentPage === 1 ? 'You are on the first page' : 'Go to previous page';
        }
        
        if (nextButton) {
            nextButton.disabled = this.activitiesCurrentPage === this.activitiesTotalPages;
            nextButton.title = this.activitiesCurrentPage === this.activitiesTotalPages ? 'You are on the last page' : 'Go to next page';
        }
        
        // Update pagination info
        this.updateActivitiesPaginationInfo();
        
        console.log('✅ Pagination controls updated');
    }

    setupActivitiesPagination() {
        const paginationContainer = document.getElementById('activitiesPagination');
        if (!paginationContainer) {
            console.error('❌ Activities pagination container not found');
            return;
        }
        
        console.log(`🔧 Setting up pagination controls - ${this.activitiesTotalPages} pages available`);
        
        // Show pagination if we have multiple pages
        if (this.activitiesTotalPages > 1) {
            paginationContainer.style.display = 'flex';
            this.updateActivitiesPaginationControls();
            console.log('✅ Pagination controls shown');
        } else {
            paginationContainer.style.display = 'none';
            console.log('⏭️ Pagination hidden (only one page)');
        }
        
        // Setup event listeners
        this.setupActivitiesPaginationEventListeners();
    }

    setupActivitiesPaginationEventListeners() {
        const prevButton = document.getElementById('activitiesPrevPage');
        const nextButton = document.getElementById('activitiesNextPage');
        
        if (prevButton) {
            // Remove existing event listeners to avoid duplicates
            prevButton.replaceWith(prevButton.cloneNode(true));
            const newPrevButton = document.getElementById('activitiesPrevPage');
            
            newPrevButton.onclick = () => {
                console.log('⬅️ Previous page clicked');
                if (this.activitiesCurrentPage > 1) {
                    this.activitiesCurrentPage--;
                    this.updateActivitiesList(this.getCurrentActivitiesPage());
                    this.updateActivitiesPaginationControls();
                    console.log(`📄 Now on page ${this.activitiesCurrentPage}`);
                }
            };
        }
        
        if (nextButton) {
            // Remove existing event listeners to avoid duplicates
            nextButton.replaceWith(nextButton.cloneNode(true));
            const newNextButton = document.getElementById('activitiesNextPage');
            
            newNextButton.onclick = () => {
                console.log('➡️ Next page clicked');
                if (this.activitiesCurrentPage < this.activitiesTotalPages) {
                    this.activitiesCurrentPage++;
                    this.updateActivitiesList(this.getCurrentActivitiesPage());
                    this.updateActivitiesPaginationControls();
                    console.log(`📄 Now on page ${this.activitiesCurrentPage}`);
                }
            };
        }
    }

    updateActivitiesPaginationInfo() {
        const infoElement = document.getElementById('activitiesPaginationInfo');
        if (infoElement) {
            const startItem = (this.activitiesCurrentPage - 1) * this.activitiesItemsPerPage + 1;
            const endItem = Math.min(this.activitiesCurrentPage * this.activitiesItemsPerPage, this.activitiesFilteredData.length);
            const totalItems = this.activitiesFilteredData.length;
            
            infoElement.textContent = `Showing ${startItem}-${endItem} of ${totalItems} activities`;
            
            console.log(`📊 Pagination info: ${startItem}-${endItem} of ${totalItems}`);
        }
    }

    renderActivitiesList(activities) {
        console.log(`🎨 Rendering ${activities.length} activity items`);
        
        return activities.map((activity, index) => `
            <div class="activity-item" 
                data-activity-type="${activity.type}" 
                data-activity-id="${activity.data?.id || ''}"
                onclick="casaLink.viewActivityDetails('${activity.type}', '${activity.data?.id || ''}')">
                <div class="activity-icon" style="background: ${activity.color}20; color: ${activity.color};">
                    <i class="${activity.icon}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-description">${activity.description}</div>
                    <div class="activity-time">${this.formatActivityTime(activity.timestamp)}</div>
                </div>
                <div class="activity-actions">
                    <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); casaLink.viewActivityDetails('${activity.type}', '${activity.data?.id || ''}')">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Empty state for activities
    getEmptyActivitiesState() {
        return `
            <div class="activity-empty">
                <i class="fas fa-inbox"></i>
                <h4>No Recent Activity</h4>
                <p>No activities found in the last 30 days</p>
                <button class="btn btn-primary btn-sm" onclick="casaLink.loadRecentActivities()">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
        `;
    }

    updateActivitiesList(activities) {
        const activityList = document.getElementById('recentActivityList');
        if (!activityList) {
            console.error('❌ Activity list element not found for update');
            return;
        }
        
        console.log(`🔄 Updating activities list with ${activities.length} items`);
        
        if (activities.length === 0) {
            activityList.innerHTML = this.getEmptyActivitiesState();
            return;
        }
        
        activityList.innerHTML = this.renderActivitiesList(activities);
        this.updateActivitiesPaginationInfo();
    }


    getCurrentActivitiesPage() {
        const startIndex = (this.activitiesCurrentPage - 1) * this.activitiesItemsPerPage;
        const endIndex = startIndex + this.activitiesItemsPerPage;
        const currentPageData = this.activitiesFilteredData.slice(startIndex, endIndex);
        
        console.log(`📄 Getting page ${this.activitiesCurrentPage}: ${startIndex}-${endIndex} of ${this.activitiesFilteredData.length} items`);
        
        return currentPageData;
    }

    hideActivitiesPagination() {
        const paginationContainer = document.getElementById('activitiesPagination');
        if (paginationContainer) {
            paginationContainer.style.display = 'none';
        }
        
        const paginationInfo = document.getElementById('activitiesPaginationInfo');
        if (paginationInfo) {
            paginationInfo.textContent = 'No activities to display';
        }
    }

    displayRecentActivities(activities) {
        console.log('🔍 STEP 3: Starting displayRecentActivities with pagination');
        
        const activityList = document.getElementById('recentActivityList');
        if (!activityList) {
            console.error('❌ STEP 3 FAILED: recentActivityList element not found');
            return;
        }

        console.log('✅ STEP 3.1: Activity list element found');

        try {
            if (!activities || activities.length === 0) {
                console.log('📭 STEP 3.2: No activities to display');
                activityList.innerHTML = this.getEmptyActivitiesState();
                this.hideActivitiesPagination();
                return;
            }

            console.log(`📊 Total activities received: ${activities.length}`);
            
            // Set up pagination data
            this.activitiesAllData = activities;
            this.activitiesFilteredData = [...activities];
            this.activitiesCurrentPage = 1;
            this.activitiesTotalPages = Math.ceil(activities.length / this.activitiesItemsPerPage);
            
            console.log(`🎨 STEP 3.3: Setting up pagination - ${this.activitiesTotalPages} pages total`);
            
            // Display current page of activities
            this.updateActivitiesList(this.getCurrentActivitiesPage());
            this.setupActivitiesPagination();
            
            console.log('✅ STEP 3 COMPLETE: Activities displayed successfully with pagination');

        } catch (error) {
            console.error('❌ STEP 3 FAILED: Error displaying activities:', error);
            this.showActivityError('Failed to display activities');
        }
    }

    formatActivityTime(timestamp) {
        const now = new Date();
        const activityTime = new Date(timestamp);
        const diffMs = now - activityTime;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return activityTime.toLocaleDateString();
    }

    showActivityError(message = 'Unable to load activities') {
        const activityList = document.getElementById('recentActivityList');
        if (activityList) {
            activityList.innerHTML = `
                <div class="activity-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h4>Unable to Load Activities</h4>
                    <p>${message}</p>
                    <button class="btn btn-primary btn-sm" onclick="casaLink.loadRecentActivities()">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            `;
        }
    }

    async showBillDetailsModalFromActivity(billId) {
        try {
            console.log('📄 Loading bill details for activity:', billId);
            
            const billDoc = await firebaseDb.collection('bills').doc(billId).get();
            if (!billDoc.exists) {
                this.showNotification('Bill not found', 'error');
                return;
            }

            const bill = { id: billDoc.id, ...billDoc.data() };
            const dueDate = new Date(bill.dueDate);
            const createdDate = new Date(bill.createdAt);
            const isOverdue = bill.status === 'pending' && dueDate < new Date();

            const modalContent = `
                <div class="activity-details-modal">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <i class="fas fa-file-invoice" style="font-size: 3rem; color: var(--warning); margin-bottom: 15px;"></i>
                        <h3 style="margin-bottom: 10px;">${bill.isAutoGenerated ? 'Auto-Generated Bill' : 'Manual Bill'}</h3>
                        <p>Details for bill generation activity</p>
                    </div>

                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h4 style="color: var(--royal-blue); margin-bottom: 15px;">Bill Information</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div>
                                <strong>Tenant:</strong><br>
                                ${bill.tenantName || 'N/A'}
                            </div>
                            <div>
                                <strong>Room:</strong><br>
                                ${bill.roomNumber || 'N/A'}
                            </div>
                            <div>
                                <strong>Amount:</strong><br>
                                <span style="font-weight: 600; color: var(--royal-blue);">
                                    ₱${(bill.totalAmount || 0).toLocaleString()}
                                </span>
                            </div>
                            <div>
                                <strong>Type:</strong><br>
                                ${(bill.type || 'rent').charAt(0).toUpperCase() + (bill.type || 'rent').slice(1)}
                            </div>
                            <div>
                                <strong>Due Date:</strong><br>
                                ${dueDate.toLocaleDateString()}
                                ${isOverdue ? '<br><small style="color: var(--danger);">Overdue</small>' : ''}
                            </div>
                            <div>
                                <strong>Status:</strong><br>
                                ${this.getBillStatusBadge(bill)}
                            </div>
                            <div>
                                <strong>Description:</strong><br>
                                ${bill.description || 'Monthly Rent'}
                            </div>
                            <div>
                                <strong>Created:</strong><br>
                                ${createdDate.toLocaleDateString()}
                            </div>
                        </div>
                    </div>

                    ${bill.isAutoGenerated ? `
                        <div style="background: rgba(251, 188, 4, 0.1); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <p style="margin: 0;">
                                <i class="fas fa-robot"></i> 
                                <strong>Auto-Generated:</strong> This bill was automatically generated by the system
                            </p>
                        </div>
                    ` : ''}

                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="casaLink.switchBillingView('bills')">
                            <i class="fas fa-file-invoice-dollar"></i> View All Bills
                        </button>
                        ${bill.status !== 'paid' ? `
                            <button class="btn btn-success" onclick="casaLink.recordPaymentModal('${bill.id}')">
                                <i class="fas fa-credit-card"></i> Record Payment
                            </button>
                        ` : ''}
                        <button class="btn btn-secondary" onclick="ModalManager.closeModal(this.closest('.modal-overlay'))">
                            Close
                        </button>
                    </div>
                </div>
            `;

            ModalManager.openModal(modalContent, {
                title: 'Bill Details',
                showFooter: false
            });

        } catch (error) {
            console.error('❌ Error loading bill details:', error);
            this.showNotification('Failed to load bill details', 'error');
        }
    }

    async showMaintenanceRequestDetailsModalFromActivity(requestId) {
        try {
            console.log('🔧 Loading maintenance details for activity:', requestId);
            
            const request = await DataManager.getMaintenanceRequest(requestId);
            if (!request) {
                this.showNotification('Maintenance request not found', 'error');
                return;
            }

            const createdDate = new Date(request.createdAt);
            const priorityColors = {
                'high': 'var(--danger)',
                'medium': 'var(--warning)', 
                'low': 'var(--success)'
            };
            const priorityColor = priorityColors[request.priority] || 'var(--dark-gray)';

            const modalContent = `
                <div class="activity-details-modal">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <i class="fas fa-tools" style="font-size: 3rem; color: var(--info); margin-bottom: 15px;"></i>
                        <h3 style="margin-bottom: 10px;">Maintenance Request</h3>
                        <p>Details for maintenance request activity</p>
                    </div>

                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h4 style="color: var(--royal-blue); margin-bottom: 15px;">Request Information</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div>
                                <strong>Tenant:</strong><br>
                                ${request.tenantName || 'N/A'}
                            </div>
                            <div>
                                <strong>Room:</strong><br>
                                ${request.roomNumber || 'N/A'}
                            </div>
                            <div>
                                <strong>Type:</strong><br>
                                ${(request.type || 'general').replace('_', ' ')}
                            </div>
                            <div>
                                <strong>Priority:</strong><br>
                                <span style="color: ${priorityColor}; font-weight: 600;">
                                    ${(request.priority || 'medium').charAt(0).toUpperCase() + (request.priority || 'medium').slice(1)}
                                </span>
                            </div>
                            <div>
                                <strong>Status:</strong><br>
                                ${this.getStatusBadge(request.status)}
                            </div>
                            <div>
                                <strong>Submitted:</strong><br>
                                ${createdDate.toLocaleDateString()}
                            </div>
                        </div>
                    </div>

                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h4 style="color: var(--royal-blue); margin-bottom: 15px;">Issue Details</h4>
                        <div>
                            <strong>Title:</strong><br>
                            <p style="margin: 10px 0; font-weight: 500;">${request.title || 'No title'}</p>
                        </div>
                        <div>
                            <strong>Description:</strong><br>
                            <p style="margin: 10px 0; line-height: 1.6; background: white; padding: 15px; border-radius: 6px;">
                                ${request.description || 'No description provided'}
                            </p>
                        </div>
                    </div>

                    ${request.assignedName ? `
                        <div style="background: rgba(26, 115, 232, 0.1); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <p style="margin: 0;">
                                <i class="fas fa-user-check"></i> 
                                <strong>Assigned To:</strong> ${request.assignedName}
                            </p>
                        </div>
                    ` : ''}

                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="casaLink.showPage('maintenance')">
                            <i class="fas fa-tools"></i> View All Maintenance
                        </button>
                        ${request.status !== 'completed' ? `
                            <button class="btn btn-warning" onclick="casaLink.updateMaintenanceRequest('${request.id}')">
                                <i class="fas fa-edit"></i> Update Status
                            </button>
                        ` : ''}
                        <button class="btn btn-secondary" onclick="ModalManager.closeModal(this.closest('.modal-overlay'))">
                            Close
                        </button>
                    </div>
                </div>
            `;

            ModalManager.openModal(modalContent, {
                title: 'Maintenance Request Details',
                showFooter: false
            });

        } catch (error) {
            console.error('❌ Error loading maintenance details:', error);
            this.showNotification('Failed to load maintenance details', 'error');
        }
    }

    async getLease(leaseId) {
        if (!this.user) throw new Error('User not authenticated');
        
        try {
            const doc = await this.db.collection('leases').doc(leaseId).get();
            if (!doc.exists) {
                throw new Error('Lease not found');
            }
            return doc.data();
        } catch (error) {
            console.error('Error getting lease:', error);
            throw error;
        }
    }

    async showLeaseDetailsModalFromActivity(leaseId) {
        try {
            console.log('📑 Loading lease details for activity:', leaseId);
            
            const leaseDoc = await firebaseDb.collection('leases').doc(leaseId).get();
            if (!leaseDoc.exists) {
                this.showNotification('Lease not found', 'error');
                return;
            }

            const lease = { id: leaseDoc.id, ...leaseDoc.data() };
            const leaseStart = lease.leaseStart ? new Date(lease.leaseStart) : null;
            const leaseEnd = lease.leaseEnd ? new Date(lease.leaseEnd) : null;

            const modalContent = `
                <div class="activity-details-modal">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <i class="fas fa-file-contract" style="font-size: 3rem; color: var(--primary-blue); margin-bottom: 15px;"></i>
                        <h3 style="margin-bottom: 10px;">Lease Agreement</h3>
                        <p>Details for lease activity</p>
                    </div>

                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h4 style="color: var(--royal-blue); margin-bottom: 15px;">Lease Information</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div>
                                <strong>Tenant:</strong><br>
                                ${lease.tenantName || 'N/A'}
                            </div>
                            <div>
                                <strong>Room:</strong><br>
                                ${lease.roomNumber || 'N/A'}
                            </div>
                            <div>
                                <strong>Monthly Rent:</strong><br>
                                ₱${(lease.monthlyRent || 0).toLocaleString()}
                            </div>
                            <div>
                                <strong>Security Deposit:</strong><br>
                                ₱${(lease.securityDeposit || 0).toLocaleString()}
                            </div>
                            <div>
                                <strong>Lease Period:</strong><br>
                                ${leaseStart ? leaseStart.toLocaleDateString() : 'N/A'} to ${leaseEnd ? leaseEnd.toLocaleDateString() : 'N/A'}
                            </div>
                            <div>
                                <strong>Status:</strong><br>
                                <span class="status-badge ${lease.isActive ? 'active' : 'inactive'}">
                                    ${lease.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>
                    </div>

                    ${lease.occupants && lease.occupants.length > 0 ? `
                        <div style="background: rgba(52, 168, 83, 0.1); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <h5 style="margin: 0 0 10px 0; color: var(--success);">Occupants</h5>
                            <ul style="margin: 0;">
                                ${lease.occupants.map(occupant => `<li>${occupant}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}

                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="casaLink.showPage('tenants')">
                            <i class="fas fa-users"></i> View Tenant Details
                        </button>
                        <button class="btn btn-secondary" onclick="ModalManager.closeModal(this.closest('.modal-overlay'))">
                            Close
                        </button>
                    </div>
                </div>
            `;

            ModalManager.openModal(modalContent, {
                title: 'Lease Agreement Details',
                showFooter: false
            });

        } catch (error) {
            console.error('❌ Error loading lease details:', error);
            this.showNotification('Failed to load lease details', 'error');
        }
    }

    async showTenantDetailsModalFromActivity(tenantId) {
        try {
            console.log('👤 Loading tenant details for activity:', tenantId);
            
            const tenantDoc = await firebaseDb.collection('users').doc(tenantId).get();
            if (!tenantDoc.exists) {
                this.showNotification('Tenant not found', 'error');
                return;
            }

            const tenant = { id: tenantDoc.id, ...tenantDoc.data() };
            
            // Get lease information
            const leaseQuery = await firebaseDb.collection('leases')
                .where('tenantId', '==', tenantId)
                .where('isActive', '==', true)
                .limit(1)
                .get();
                
            const lease = leaseQuery.empty ? null : { id: leaseQuery.docs[0].id, ...leaseQuery.docs[0].data() };

            const modalContent = `
                <div class="activity-details-modal">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <i class="fas fa-user-plus" style="font-size: 3rem; color: var(--success); margin-bottom: 15px;"></i>
                        <h3 style="margin-bottom: 10px;">New Tenant Registration</h3>
                        <p>Details for tenant registration activity</p>
                    </div>

                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h4 style="color: var(--royal-blue); margin-bottom: 15px;">Tenant Information</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div>
                                <strong>Name:</strong><br>
                                ${tenant.name || 'N/A'}
                            </div>
                            <div>
                                <strong>Email:</strong><br>
                                ${tenant.email || 'N/A'}
                            </div>
                            <div>
                                <strong>Phone:</strong><br>
                                ${tenant.phone || 'N/A'}
                            </div>
                            <div>
                                <strong>Occupation:</strong><br>
                                ${tenant.occupation || 'N/A'}
                            </div>
                            <div>
                                <strong>Status:</strong><br>
                                <span class="status-badge ${tenant.status === 'verified' ? 'active' : 'warning'}">
                                    ${tenant.status || 'unverified'}
                                </span>
                            </div>
                            <div>
                                <strong>Registered:</strong><br>
                                ${tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : 'N/A'}
                            </div>
                        </div>
                    </div>

                    ${lease ? `
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            <h4 style="color: var(--royal-blue); margin-bottom: 15px;">Lease Information</h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                <div>
                                    <strong>Room Number:</strong><br>
                                    ${lease.roomNumber || 'N/A'}
                                </div>
                                <div>
                                    <strong>Monthly Rent:</strong><br>
                                    ₱${(lease.monthlyRent || 0).toLocaleString()}
                                </div>
                                <div>
                                    <strong>Lease Start:</strong><br>
                                    ${lease.leaseStart ? new Date(lease.leaseStart).toLocaleDateString() : 'N/A'}
                                </div>
                                <div>
                                    <strong>Lease Status:</strong><br>
                                    <span class="status-badge ${lease.isActive ? 'active' : 'inactive'}">
                                        ${lease.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="casaLink.showPage('tenants')">
                            <i class="fas fa-users"></i> Go to Tenant Management
                        </button>
                        <button class="btn btn-secondary" onclick="ModalManager.closeModal(this.closest('.modal-overlay'))">
                            Close
                        </button>
                    </div>
                </div>
            `;

            ModalManager.openModal(modalContent, {
                title: 'Tenant Registration Details',
                showFooter: false
            });

        } catch (error) {
            console.error('❌ Error loading tenant details:', error);
            this.showNotification('Failed to load tenant details', 'error');
        }
    }

    async showPaymentDetailsModalFromActivity(paymentId) {
        try {
            console.log('💰 Loading payment details for activity:', paymentId);
            
            const paymentDoc = await firebaseDb.collection('payments').doc(paymentId).get();
            if (!paymentDoc.exists) {
                this.showNotification('Payment not found', 'error');
                return;
            }

            const payment = { id: paymentDoc.id, ...paymentDoc.data() };
            const paymentDate = new Date(payment.paymentDate || payment.createdAt);

            const modalContent = `
                <div class="activity-details-modal">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <i class="fas fa-credit-card" style="font-size: 3rem; color: var(--success); margin-bottom: 15px;"></i>
                        <h3 style="margin-bottom: 10px;">Payment Received</h3>
                        <p>Details for payment activity</p>
                    </div>

                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h4 style="color: var(--royal-blue); margin-bottom: 15px;">Payment Information</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div>
                                <strong>Tenant:</strong><br>
                                ${payment.tenantName || 'N/A'}
                            </div>
                            <div>
                                <strong>Room:</strong><br>
                                ${payment.roomNumber || 'N/A'}
                            </div>
                            <div>
                                <strong>Amount:</strong><br>
                                <span style="font-weight: 600; color: var(--success);">
                                    ₱${(payment.amount || 0).toLocaleString()}
                                </span>
                            </div>
                            <div>
                                <strong>Payment Method:</strong><br>
                                ${this.formatPaymentMethod(payment.paymentMethod)}
                            </div>
                            <div>
                                <strong>Payment Date:</strong><br>
                                ${paymentDate.toLocaleDateString()}
                            </div>
                            <div>
                                <strong>Reference:</strong><br>
                                ${payment.referenceNumber || 'N/A'}
                            </div>
                        </div>
                    </div>

                    ${payment.billId ? `
                        <div style="background: rgba(52, 168, 83, 0.1); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <p style="margin: 0;">
                                <i class="fas fa-receipt"></i> 
                                <strong>Bill Paid:</strong> This payment was applied to bill ${payment.billId.substring(0, 8)}
                            </p>
                        </div>
                    ` : ''}

                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="casaLink.switchBillingView('payments')">
                            <i class="fas fa-money-check"></i> View All Payments
                        </button>
                        <button class="btn btn-secondary" onclick="ModalManager.closeModal(this.closest('.modal-overlay'))">
                            Close
                        </button>
                    </div>
                </div>
            `;

            ModalManager.openModal(modalContent, {
                title: 'Payment Details',
                showFooter: false
            });

        } catch (error) {
            console.error('❌ Error loading payment details:', error);
            this.showNotification('Failed to load payment details', 'error');
        }
    }

    async viewActivityDetails(activityType, activityId) {
        console.log('🔍 Viewing activity details:', { activityType, activityId });
        
        try {
            switch (activityType) {
                case 'new_tenant':
                    await this.showTenantDetailsModalFromActivity(activityId);
                    break;
                case 'payment_received':
                    await this.showPaymentDetailsModalFromActivity(activityId);
                    break;
                case 'bill_generated':
                    await this.showBillDetailsModalFromActivity(activityId);
                    break;
                case 'maintenance_request':
                    await this.showMaintenanceRequestDetailsModalFromActivity(activityId);
                    break;
                case 'new_lease':
                    await this.showLeaseDetailsModalFromActivity(activityId);
                    break;
                default:
                    console.log('Unknown activity type:', activityType);
                    this.showNotification('Activity details not available for this type', 'info');
            }
        } catch (error) {
            console.error('❌ Error viewing activity details:', error);
            this.showNotification('Failed to load activity details', 'error');
        }
    }

    async loadMoreActivities() {
        try {
            console.log('📅 Loading more activities...');
            
            // Show loading state
            const activityList = document.getElementById('recentActivityList');
            const loadMoreBtn = activityList?.querySelector('.load-more-btn');
            
            if (loadMoreBtn) {
                loadMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
                loadMoreBtn.disabled = true;
            }

            // You can implement logic here to load activities from previous months
            // For now, we'll just show a notification
            this.showNotification('Loading more activities...', 'info');
            
            // Reset button after a delay
            setTimeout(() => {
                if (loadMoreBtn) {
                    loadMoreBtn.innerHTML = '<i class="fas fa-history"></i> Load More';
                    loadMoreBtn.disabled = false;
                }
            }, 2000);
            
        } catch (error) {
            console.error('Error loading more activities:', error);
            this.showNotification('Failed to load more activities', 'error');
        }
    }

    async markAllAsRead() {
        // This would typically update a 'read' status in your database
        this.showNotification('All activities marked as read', 'success');
    }

    setupDashboardEvents() {
        console.log('🔄 Setting up dashboard events with fresh data...');
        
        // Add Property Button
        document.getElementById('addPropertyBtn')?.addEventListener('click', () => {
            this.showAddPropertyForm();
        });
        
        // Load recent activities when dashboard is shown 
        setTimeout(() => {
            this.loadRecentActivities();
        }, 500);
        
        // Setup real-time stats when dashboard is shown
        this.updateActiveNavState('dashboard');
        
        console.log('✅ All dashboard events setup complete');
    }



    getLandlordDashboardHTML() {
        const isLandlord = this.currentRole === 'landlord';
        
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
                    <div class="card" data-clickable="occupancy" style="cursor: pointer;" title="Click to view unit occupancy">
                        <div class="card-header">
                            <div class="card-title">Occupancy Rate</div>
                            <div class="card-icon occupied"><i class="fas fa-home"></i></div>
                        </div>
                        <div class="card-value" id="occupancyRate">0%</div>
                        <div class="card-subtitle" id="occupancyDetails">0/22 units</div>
                    </div>

                    <div class="card" data-clickable="vacant" style="cursor: pointer;" title="Click to view vacant units">
                        <div class="card-header">
                            <div class="card-title">Vacant Units</div>
                            <div class="card-icon vacant"><i class="fas fa-door-open"></i></div>
                        </div>
                        <div class="card-value" id="vacantUnits">0</div>
                        <div class="card-subtitle">22 total capacity</div>
                    </div>

                    <div class="card" data-clickable="tenants" style="cursor: pointer;" title="Click to view occupant details">
                        <div class="card-header">
                            <div class="card-title">Total Occupants</div>
                            <div class="card-icon tenants"><i class="fas fa-users"></i></div>
                        </div>
                        <div class="card-value" id="totalTenants">0</div>
                        <div class="card-subtitle">All registered occupants</div>
                    </div>
                </div>

                <!-- FINANCIAL OVERVIEW SECTION -->
                <div class="card-group-title">Financial Overview</div>
                <div class="card-group">
                    <div class="card" data-clickable="collection" style="cursor: pointer;" title="Click to view collection details">
                        <div class="card-header">
                            <div class="card-title">Rent Collection</div>
                            <div class="card-icon collection"><i class="fas fa-chart-line"></i></div>
                        </div>
                        <div class="card-value" id="collectionRate">0%</div>
                        <div class="card-subtitle">This month</div>
                    </div>

                    <div class="card" data-clickable="revenue" style="cursor: pointer;" title="Click to view revenue details">
                        <div class="card-header">
                            <div class="card-title">Monthly Revenue</div>
                            <div class="card-icon revenue"><i class="fas fa-cash-register"></i></div>
                        </div>
                        <div class="card-value" id="monthlyRevenue">₱0</div>
                        <div class="card-subtitle">Current month</div>
                    </div>

                    <div class="card" data-clickable="late" style="cursor: pointer;" title="Click to view late payments">
                        <div class="card-header">
                            <div class="card-title">Late Payments</div>
                            <div class="card-icon late"><i class="fas fa-clock"></i></div>
                        </div>
                        <div class="card-value" id="latePayments">0</div>
                        <div class="card-subtitle">Overdue rent</div>
                    </div>

                    <div class="card" data-clickable="unpaid" style="cursor: pointer;" title="Click to view unpaid bills">
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
                    <div class="card" data-clickable="renewals" style="cursor: pointer;" title="Click to view lease renewals">
                        <div class="card-header">
                            <div class="card-title">Lease Renewals</div>
                            <div class="card-icon renewals"><i class="fas fa-calendar-alt"></i></div>
                        </div>
                        <div class="card-value" id="upcomingRenewals">0</div>
                        <div class="card-subtitle">Next 30 days</div>
                    </div>

                    <div class="card" data-clickable="open-maintenance" style="cursor: pointer;" title="Click to view open maintenance requests">
                        <div class="card-header">
                            <div class="card-title">Open Maintenance</div>
                            <div class="card-icon maintenance"><i class="fas fa-tools"></i></div>
                        </div>
                        <div class="card-value" id="openMaintenance">0</div>
                        <div class="card-subtitle">New requests</div>
                    </div>

                    <div class="card" data-clickable="backlog" style="cursor: pointer;" title="Click to view maintenance backlog">
                        <div class="card-header">
                            <div class="card-title">Maintenance Backlog</div>
                            <div class="card-icon backlog"><i class="fas fa-list-alt"></i></div>
                        </div>
                        <div class="card-value" id="maintenanceBacklog">0</div>
                        <div class="card-subtitle">Pending work</div>
                    </div>
                </div>

                <!-- RECENT ACTIVITY SECTION WITH PAGINATION -->
                <div class="card-group-title">Recent Activity</div>
                <div class="recent-activity-container">
                    
                    <div class="recent-activity-header">
                        <h3>Recent Activities</h3>
                        <div class="activities-pagination-info" id="activitiesPaginationInfo">
                            Showing 0–0 of 0 activities
                        </div>
                    </div>

                    <div id="recentActivityList" class="recent-activity-list">
                        <div class="activity-loading">
                            <i class="fas fa-spinner fa-spin"></i> Loading recent activity...
                        </div>
                    </div>

                    <!-- Pagination Controls -->
                    <div class="pagination-container" id="activitiesPagination" style="display: none; margin-top: 20px;">
                        <div class="pagination-controls">
                            <button class="btn btn-sm btn-secondary" id="activitiesPrevPage">
                                <i class="fas fa-chevron-left"></i> Previous
                            </button>
                            <div class="pagination-numbers" id="activitiesPageNumbers"></div>
                            <button class="btn btn-sm btn-secondary" id="activitiesNextPage">
                                Next <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    </div>

                    <div class="recent-activity-footer">
                        <button class="btn btn-secondary btn-sm" onclick="casaLink.loadMoreActivities()">
                            <i class="fas fa-history"></i> Load Older Activities
                        </button>
                        <button class="btn btn-primary btn-sm" onclick="casaLink.markAllAsRead()">
                            <i class="fas fa-check-double"></i> Mark All as Read
                        </button>
                    </div>
                </div>
            </div>
        `;
    }






    switchBillingTab(tabName) {
        console.log('🔄 Switching to tab:', tabName);
        
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active');
            if (button.getAttribute('data-tab') === tabName) {
                button.classList.add('active');
            }
        });
        
        // Update tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
            if (content.id === tabName + 'Tab') {
                content.classList.add('active');
            }
        });
        
        this.currentBillingTab = tabName;
        
        // Load data for the selected tab
        this.loadTabData(tabName);
    }

    loadTabData(tabName) {
        switch (tabName) {
            case 'bills':
                this.loadBillsData();
                this.loadBillingStats();
                break;
            case 'payments':
                this.loadPaymentsData();
                this.loadPaymentStats();
                break;
        }
    }

    async loadPaymentStats() {
        try {
            const stats = await DataManager.getPaymentStats(this.currentUser.uid);
            
            this.updateCard('totalCollected', `₱${stats.totalCollected.toLocaleString()}`);
            this.updateCard('monthlyCollected', `₱${stats.monthlyCollected.toLocaleString()}`);
            this.updateCard('totalTransactions', stats.totalTransactions);
            this.updateCard('averagePayment', `₱${Math.round(stats.averagePayment).toLocaleString()}`);
            
        } catch (error) {
            console.error('Error loading payment stats:', error);
        }
    }



    async showLeaseAgreement() {
        try {
            console.log('📄 Fetching lease agreement for tenant:', this.currentUser.uid);
            
            // Show loading state
            const submitBtn = document.querySelector('#viewLeaseBtn');
            if (submitBtn) {
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
                submitBtn.disabled = true;
            }

            // Fetch FRESH lease data from Firestore
            const lease = await DataManager.getTenantLease(this.currentUser.uid);
            
            if (!lease) {
                this.showNotification('No lease agreement found. Please contact your landlord.', 'error');
                return;
            }

            console.log('🔍 Lease data for dashboard view:', {
                roomNumber: lease.roomNumber,
                occupants: lease.occupants,
                totalOccupants: lease.totalOccupants,
                maxOccupants: lease.maxOccupants
            });

            // Reset button state
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-file-contract"></i> View Lease Agreement';
                submitBtn.disabled = false;
            }

            // Display the lease agreement modal with updated data
            this.displayLeaseAgreementModal(lease);

        } catch (error) {
            console.error('Error fetching lease agreement:', error);
            this.showNotification('Failed to load lease agreement. Please try again.', 'error');
            
            // Reset button state
            const submitBtn = document.querySelector('#viewLeaseBtn');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-file-contract"></i> View Lease Agreement';
                submitBtn.disabled = false;
            }
        }
    }

    // Method to display the lease agreement in a modal
    displayLeaseAgreementModal(lease) {
        // Get member information with proper fallbacks
        const occupants = lease.occupants || [this.currentUser.name];
        const primaryTenant = occupants[0];
        const additionalMembers = occupants.slice(1);
        const totalOccupants = lease.totalOccupants || occupants.length;
        const maxOccupants = lease.maxOccupants || 1;

        console.log('👥 Displaying lease with occupants:', {
            allOccupants: occupants,
            totalOccupants,
            maxOccupants,
            additionalMembersCount: additionalMembers.length
        });

        // Format dates
        const leaseStart = lease.leaseStart
            ? new Date(lease.leaseStart).toLocaleDateString('en-US', { year: "numeric", month: "long", day: "numeric" })
            : 'Not specified';

        const leaseEnd = lease.leaseEnd
            ? new Date(lease.leaseEnd).toLocaleDateString('en-US', { year: "numeric", month: "long", day: "numeric" })
            : 'Not specified';

        // Payment Schedule
        const paymentDay = lease.paymentDueDay || 'Not specified';
        const paymentSchedule = this.getPaymentScheduleText(paymentDay);

        const modalContent = `
            <div class="lease-agreement-view-modal" style="max-height: 80vh; overflow-y: auto;">

                <!-- HEADER -->
                <div style="text-align: center; margin-bottom: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                    <i class="fas fa-file-contract" style="font-size: 3rem; color: var(--primary-blue); margin-bottom: 15px;"></i>
                    <h3 style="color: var(--primary-blue); margin-bottom: 10px;">Your Lease Agreement</h3>
                    <p style="color: var(--dark-gray);">Review your current lease terms and conditions</p>
                </div>

                <!-- LEASE SUMMARY -->
                <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid var(--primary-blue);">
                    <h4 style="color: var(--primary-blue); margin-bottom: 15px;">Lease Summary</h4>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                        <div><strong>Room/Unit:</strong><br>${lease.roomNumber || 'N/A'}</div>
                        <div><strong>Primary Tenant:</strong><br>${primaryTenant}</div>
                        <div><strong>Total Occupants:</strong><br>${totalOccupants} of ${maxOccupants}</div>
                        <div><strong>Monthly Rent:</strong><br>₱${lease.monthlyRent ? lease.monthlyRent.toLocaleString() : '0'}</div>
                        <div><strong>Lease Period:</strong><br>${leaseStart} to ${leaseEnd}</div>
                        <div><strong>Security Deposit:</strong><br>₱${lease.securityDeposit ? lease.securityDeposit.toLocaleString() : '0'}</div>
                        <div><strong>Payment Method:</strong><br>${lease.paymentMethod || 'Cash'}</div>
                        <div><strong>Agreed Payment Schedule:</strong><br>${paymentSchedule}</div>
                    </div>

                    <!-- Additional Occupants -->
                    ${additionalMembers.length > 0 ? `
                        <div style="margin-top: 15px; padding: 15px; background: rgba(52,168,83,0.1); border-radius: 6px;">
                            <strong>Additional Occupants:</strong><br>
                            ${additionalMembers.map(m => `• ${m}`).join('<br>')}
                        </div>
                    ` : ''}

                    <!-- Payment instructions -->
                    <div style="margin-top: 15px; padding: 15px; background: rgba(26,115,232,0.05); border-radius: 6px; border-left: 3px solid var(--primary-blue);">
                        <strong style="color: var(--primary-blue);">📅 Payment Instructions:</strong><br>
                        <small style="color: var(--dark-gray);">
                            Rent is due on the <strong>${paymentDay}${this.getOrdinalSuffix(parseInt(paymentDay))}</strong> 
                            of each month.
                        </small>
                    </div>
                </div>

                <!-- FULL LEASE AGREEMENT -->
                <div style="line-height: 1.6; font-size: 0.95rem; margin-bottom: 25px; max-height: 400px; overflow-y: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; background: #fafafa;">
                    
                    <p><strong>This agreement is made by and between:</strong></p>
                    <p style="margin-left: 20px;">
                        <strong>Landlady/Lessor:</strong> Nelly Virtucio<br>
                        <strong>Tenant/Lessee:</strong> ${primaryTenant}
                    </p>

                    <p>
                        This landlady hereby agrees to lease the unit <strong>${lease.roomNumber || 'N/A'}</strong> located at
                        <strong>${lease.rentalAddress || 'N/A'}</strong>. The lease period shall be for 1 year beginning 
                        <strong>${leaseStart}</strong> and ending <strong>${leaseEnd}</strong>.
                    </p>

                    <p>
                        In case of failure to stay for 1 year, the landlady will not refund the security deposit of 
                        <strong>₱${lease.securityDeposit ? lease.securityDeposit.toLocaleString() : '0'}</strong>.
                    </p>

                    <h4 style="margin: 20px 0 10px 0; color: var(--primary-blue);">Terms and Conditions:</h4>

                    <ol style="margin-left: 20px;">
                        <li><strong>Garbage:</strong> Dispose every Thursday at Purok 6.</li>
                        <li><strong>Smoking:</strong> Strictly prohibited inside the premises.</li>
                        <li><strong>Noise:</strong> Keep appliances and noise to a minimum.</li>
                        <li><strong>Visitors:</strong> Max 10; all must leave before 10 PM.</li>
                        <li><strong>Locks:</strong> Tenant provides padlocks and removes them when leaving.</li>
                        <li><strong>Walls/Hallways:</strong> No nails; keep hallways clean.</li>
                        <li><strong>Rent Due:</strong> Every <strong>${paymentDay}${this.getOrdinalSuffix(paymentDay)}</strong>.</li>
                        <li><strong>Utilities:</strong> Must be paid on time.</li>
                        <li><strong>Light Bulbs:</strong> Tenant replaces worn-out bulbs.</li>
                        <li><strong>Damage:</strong> Tenant covers damages from self or guests.</li>
                        <li><strong>Security:</strong> Responsible for personal belongings.</li>
                        <li><strong>Cleaning Fee:</strong> ₱2,000 if unit is not cleaned upon vacating.</li>
                        <li><strong>Occupancy Limit:</strong> Max ${maxOccupants} persons; ₱2,000 per extra member.</li>
                        <li><strong>Rent Increase:</strong> Landlady may increase rent anytime.</li>
                    </ol>

                    <p style="margin-top: 20px; padding: 15px; background: rgba(26,115,232,0.1); border-radius: 8px;">
                        <strong>15. Acknowledgement:</strong> Parties acknowledge the terms on <strong>${leaseStart}</strong>.
                    </p>

                    <div style="display: flex; justify-content: space-between; margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px;">
                        <div><strong>Nelly D. Virtucio</strong><br>Landlady/Lessor</div>
                        <div><strong>${primaryTenant}</strong><br>Tenant/Lessee</div>
                    </div>
                </div>

                <!-- AGREEMENT STATUS -->
                <div style="background: ${lease.agreementAccepted ? 'rgba(52,168,83,0.1)' : 'rgba(251,188,4,0.1)'}; padding: 15px; border-radius: 8px; border-left: 4px solid ${
                    lease.agreementAccepted ? 'var(--success)' : 'var(--warning)'
                };">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fas ${lease.agreementAccepted ? 'fa-check-circle' : 'fa-exclamation-circle'}" 
                            style="color: ${lease.agreementAccepted ? 'var(--success)' : 'var(--warning)'};">
                        </i>
                        <div>
                            <strong>Agreement Status:</strong> ${lease.agreementAccepted ? 'Accepted and Verified' : 'Pending Acceptance'}
                            ${lease.agreementAcceptedDate ? `<br><small>Accepted on: ${new Date(lease.agreementAcceptedDate).toLocaleDateString()}</small>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        const modal = ModalManager.openModal(modalContent, {
            title: 'Lease Agreement & Terms',
            submitText: 'Close',
            showFooter: true,
            onSubmit: () => ModalManager.closeModal(modal),
            extraButtons: [
                {
                    text: '<i class="fas fa-print"></i> Print',
                    className: 'btn btn-secondary',
                    onClick: () => this.printLeaseAgreement()
                }
            ]
        });

        this.leaseViewModal = modal;
    }



    getPaymentScheduleText(paymentDay) {
        if (!paymentDay || paymentDay === 'Not specified') return 'Not specified';
        
        const day = parseInt(paymentDay);
        if (isNaN(day)) return paymentDay;
        
        return `Every ${day}${this.getOrdinalSuffix(day)} of the month`;
    }

    getOrdinalSuffix(day) {
        if (!day || typeof day !== 'number') return '';
        
        if (day >= 11 && day <= 13) return 'th';
        
        const lastDigit = day % 10;
        switch (lastDigit) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    }

    printLeaseAgreement() {
        window.print();
    }

    getTenantDashboardHTML() {
        return `
            <div class="page-content">
                <div class="page-header">
                    <h1 class="page-title">Welcome to Your Dashboard</h1>
                    <div>
                        <button class="btn btn-secondary" id="viewLeaseBtn" onclick="casaLink.showLeaseAgreement()">
                            <i class="fas fa-file-contract"></i> View Lease Agreement
                        </button>
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

    static async initializeBillingSystem() {
        console.log('💰 Initializing billing system...');
        
        // Create billing settings if they don't exist
        const settings = await this.getBillingSettings();
        if (!settings) {
            await this.createDefaultBillingSettings();
        }
        
        // Check and generate monthly bills
        await this.checkAndGenerateMonthlyBills();
    }

    static async getBillingSettings() {
        try {
            const settingsDoc = await firebaseDb.collection('billingSettings').doc('default').get();
            return settingsDoc.exists ? settingsDoc.data() : null;
        } catch (error) {
            console.error('Error getting billing settings:', error);
            return null;
        }
    }

    static async createDefaultBillingSettings() {
        const defaultSettings = {
            autoBillingEnabled: true,
            defaultPaymentDay: 5,
            lateFeeAmount: 500,
            gracePeriodDays: 3,
            autoLateFees: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        await firebaseDb.collection('billingSettings').doc('default').set(defaultSettings);
        console.log('✅ Created default billing settings');
        return defaultSettings;
    }

    static async updateBillingSettings(updates) {
        try {
            updates.updatedAt = new Date().toISOString();
            await firebaseDb.collection('billingSettings').doc('default').update(updates);
            console.log('✅ Billing settings updated');
            return true;
        } catch (error) {
            console.error('Error updating billing settings:', error);
            throw error;
        }
    }

    static async checkAndGenerateMonthlyBills() {
        try {
            const settings = await this.getBillingSettings();
            if (!settings?.autoBillingEnabled) {
                console.log('⏸️ Auto-billing is disabled');
                return;
            }

            const today = new Date();
            const isFirstOfMonth = today.getDate() === 1;
            
            if (!isFirstOfMonth) return;

            // Check if bills already generated this month
            const billsGeneratedThisMonth = localStorage.getItem(`bills_generated_${today.getFullYear()}_${today.getMonth()}`);
            
            if (!billsGeneratedThisMonth) {
                console.log('🔄 Auto-generating monthly bills...');
                const result = await this.generateMonthlyBills();
                
                // Mark as generated for this month
                localStorage.setItem(`bills_generated_${today.getFullYear()}_${today.getMonth()}`, 'true');
                
                console.log(`✅ Monthly bills auto-generated: ${result.generated} new, ${result.skipped} existing`);
                
                return result;
            }
        } catch (error) {
            console.error('❌ Auto bill generation failed:', error);
            throw error;
        }
    }

    static async generateMonthlyBills() {
        try {
            console.log('💰 Generating monthly bills for all active leases...');
            
            const leases = await this.getActiveLeases();
            const today = new Date();
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            const settings = await this.getBillingSettings();
            
            let generatedCount = 0;
            let skippedCount = 0;
            
            const billPromises = leases.map(async (lease) => {
                // Enhanced validation
                if (!lease.isActive) {
                    skippedCount++;
                    return;
                }
                
                if (!lease.monthlyRent || lease.monthlyRent <= 0) {
                    console.warn(`⚠️ Skipping ${lease.tenantName}: Invalid rent amount`);
                    skippedCount++;
                    return;
                }
                
                // Check for existing bill this month
                const existingBill = await firebaseDb.collection('bills')
                    .where('tenantId', '==', lease.tenantId)
                    .where('dueDate', '>=', new Date(currentYear, currentMonth, 1).toISOString())
                    .where('dueDate', '<=', new Date(currentYear, currentMonth + 1, 0).toISOString())
                    .limit(1)
                    .get();
                    
                if (existingBill.empty) {
                    const paymentDay = lease.paymentDueDay || settings?.defaultPaymentDay || 5;
                    const dueDate = new Date(currentYear, currentMonth, paymentDay);
                    
                    const billData = {
                        tenantId: lease.tenantId,
                        landlordId: lease.landlordId,
                        tenantName: lease.tenantName,
                        roomNumber: lease.roomNumber,
                        type: 'rent',
                        description: `Monthly Rent - ${today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
                        totalAmount: lease.monthlyRent,
                        dueDate: dueDate.toISOString(),
                        status: 'pending',
                        createdAt: new Date().toISOString(),
                        isAutoGenerated: true,
                        items: [
                            {
                                description: 'Monthly Rent',
                                amount: lease.monthlyRent,
                                type: 'rent'
                            }
                        ]
                    };
                    
                    await firebaseDb.collection('bills').add(billData);
                    generatedCount++;
                    console.log(`✅ Generated bill for ${lease.tenantName} (Due: ${paymentDay}${this.getOrdinalSuffix(paymentDay)})`);
                } else {
                    skippedCount++;
                }
            });
            
            await Promise.all(billPromises);
            
            console.log(`✅ Monthly bills generation completed: ${generatedCount} generated, ${skippedCount} skipped`);
            return {
                generated: generatedCount,
                skipped: skippedCount,
                total: leases.length
            };
            
        } catch (error) {
            console.error('❌ Error generating monthly bills:', error);
            throw error;
        }
    }

    static getOrdinalSuffix(day) {
        if (day >= 11 && day <= 13) return 'th';
        const lastDigit = day % 10;
        switch (lastDigit) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    }

    static async getActiveLeases() {
        try {
            const querySnapshot = await firebaseDb.collection('leases')
                .where('isActive', '==', true)
                .get();
                
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting active leases:', error);
            return [];
        }
    }

    static async recordPayment(paymentData) {
        try {
            console.log('💳 Recording payment:', paymentData);
            
            const paymentRef = await firebaseDb.collection('payments').add({
                ...paymentData,
                processedAt: new Date().toISOString(),
                status: 'completed'
            });

            // Update bill status
            if (paymentData.billId) {
                await firebaseDb.collection('bills').doc(paymentData.billId).update({
                    status: 'paid',
                    paidDate: new Date().toISOString(),
                    paymentMethod: paymentData.paymentMethod,
                    paymentReference: paymentData.referenceNumber
                });
            }

            console.log('✅ Payment recorded successfully');
            return paymentRef.id;
            
        } catch (error) {
            console.error('❌ Error recording payment:', error);
            throw error;
        }
    }

    static async getPaymentMethods() {
        return [
            { id: 'cash', name: 'Cash', icon: 'fas fa-money-bill' },
            { id: 'gcash', name: 'GCash', icon: 'fas fa-mobile-alt' },
            { id: 'maya', name: 'Maya', icon: 'fas fa-wallet' },
            { id: 'bank_transfer', name: 'Bank Transfer', icon: 'fas fa-university' },
            { id: 'check', name: 'Check', icon: 'fas fa-money-check' }
        ];
    }

    static async getBillsWithTenants(landlordId) {
        try {
            const billsSnapshot = await firebaseDb.collection('bills')
                .where('landlordId', '==', landlordId)
                .orderBy('dueDate', 'desc')
                .get();
                
            return billsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting bills:', error);
            return [];
        }
    }

    async generateMonthlyBills() {
        try {
            const result = await DataManager.generateMonthlyBills();
            this.showNotification('Monthly bills generated successfully!', 'success');
            
            // Refresh bills data
            setTimeout(() => {
                this.loadBillsData();
            }, 1000);
            
        } catch (error) {
            console.error('Error generating bills:', error);
            this.showNotification('Failed to generate bills: ' + error.message, 'error');
        }
    }

    setupReportsEvents() {
        console.log('📊 Setting up reports page events...');
        
        // Refresh reports button
        const refreshBtn = document.getElementById('refreshReportsBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshReportsData();
            });
        }
        
        // Export report button
        const exportBtn = document.getElementById('exportReportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportReports();
            });
        }
        
        // Period filter
        const periodFilter = document.getElementById('revenuePeriod');
        if (periodFilter) {
            periodFilter.addEventListener('change', (e) => {
                this.filterReportsByPeriod(e.target.value);
            });
        }
        
        // Initialize charts
        this.initializeReportsCharts();
    }

    initializeReportsCharts() {
        console.log('🎨 Initializing reports charts...');
        
        // Wait a bit for DOM to be fully ready
        setTimeout(() => {
            if (window.chartsManager) {
                // Destroy any existing charts first
                window.chartsManager.destroyAllCharts();
                // Create new charts
                window.chartsManager.initializeAllCharts();
                console.log('✅ Reports charts initialized successfully');
            } else {
                console.error('❌ Charts manager not available');
            }
        }, 200);
    }

    refreshReportsData() {
        console.log('🔄 Refreshing reports data...');
        
        // Show loading state
        const refreshBtn = document.getElementById('refreshReportsBtn');
        if (refreshBtn) {
            const originalText = refreshBtn.innerHTML;
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
            refreshBtn.disabled = true;
            
            // Simulate data refresh
            setTimeout(() => {
                // Re-initialize charts with "new" data
                this.initializeReportsCharts();
                
                // Restore button
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Data';
                refreshBtn.disabled = false;
                
                // Show success message
                this.showNotification('Reports data refreshed successfully!', 'success');
            }, 1500);
        }
    }

    exportReports() {
        console.log('📤 Exporting reports...');
        this.showNotification('Export feature coming soon!', 'info');
    }

    filterReportsByPeriod(period) {
        console.log('📅 Filtering reports by period:', period);
        // In a real app, this would reload data based on the period
        this.showNotification(`Showing data for: ${period}`, 'info');
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
            case 'lease-management':                
                this.setupLeaseManagementPage?.();
                break;
            case 'payments':
                console.log('🔄 Redirecting from payments page to billing tab...');
                this.showPage('billing');
                setTimeout(() => {
                    this.switchBillingTab('payments');
                }, 300);
                break;
            case 'reports':
                this.setupReportsEvents();
                break;
        }
    }

    setupTenantsPage() {
        // Add tenant button
        document.getElementById('addTenantBtn')?.addEventListener('click', () => {
            this.showAddTenantForm();
        });

        // Search functionality
        document.getElementById('tenantSearch')?.addEventListener('input', (e) => {
            this.filterTenants(e.target.value);
        });

        // Setup row click handlers
        this.setupTenantRowClickHandlers();

        // Load tenants data with pagination
        this.loadTenantsData();
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

            // Fetch tenants from Firestore
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
            
            // Set up pagination data
            this.tenantsAllData = tenantsWithLeaseData;
            this.tenantsFilteredData = [...tenantsWithLeaseData];
            this.tenantsCurrentPage = 1;
            this.tenantsTotalPages = Math.ceil(tenantsWithLeaseData.length / this.tenantsItemsPerPage);
            
            this.updateTenantsTable(this.getCurrentTenantsPage());
            this.setupTenantsPagination();
            
            console.log('✅ Tenants data loaded with pagination:', tenantsWithLeaseData.length, 'tenants');

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

    getCurrentTenantsPage() {
        const startIndex = (this.tenantsCurrentPage - 1) * this.tenantsItemsPerPage;
        const endIndex = startIndex + this.tenantsItemsPerPage;
        return this.tenantsFilteredData.slice(startIndex, endIndex);
    }

    updateTenantsPaginationInfo() {
        const infoElement = document.getElementById('tenantsPaginationInfo');
        if (infoElement) {
            const startItem = (this.tenantsCurrentPage - 1) * this.tenantsItemsPerPage + 1;
            const endItem = Math.min(this.tenantsCurrentPage * this.tenantsItemsPerPage, this.tenantsFilteredData.length);
            infoElement.textContent = `Showing ${startItem}-${endItem} of ${this.tenantsFilteredData.length} tenants`;
        }
    }

    getEmptyTenantsState() {
        return `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h3>No Tenants Found</h3>
                <p>You haven't added any tenants yet. Click "Add Tenant" to get started.</p>
            </div>
        `;
    }

    updateTenantsTable(tenants) {
        const tenantsList = document.getElementById('tenantsList');
        if (!tenantsList) return;
        
        if (tenants.length === 0) {
            tenantsList.innerHTML = this.getEmptyTenantsState();
            const paginationContainer = document.getElementById('tenantsPagination');
            if (paginationContainer) paginationContainer.style.display = 'none';
            return;
        }
        
        tenantsList.innerHTML = this.renderTenantsTable(tenants);
        this.updateTenantsPaginationInfo();
    }

    setupTenantsPagination() {
        const paginationContainer = document.getElementById('tenantsPagination');
        if (!paginationContainer) return;
        
        // Show pagination if we have multiple pages
        if (this.tenantsTotalPages > 1) {
            paginationContainer.style.display = 'flex';
            this.updateTenantsPaginationControls();
        } else {
            paginationContainer.style.display = 'none';
        }
        
        // Event listeners for pagination buttons
        const prevButton = document.getElementById('tenantsPrevPage');
        const nextButton = document.getElementById('tenantsNextPage');
        
        if (prevButton) {
            prevButton.onclick = () => {
                if (this.tenantsCurrentPage > 1) {
                    this.tenantsCurrentPage--;
                    this.updateTenantsTable(this.getCurrentTenantsPage());
                    this.updateTenantsPaginationControls();
                }
            };
        }
        
        if (nextButton) {
            nextButton.onclick = () => {
                if (this.tenantsCurrentPage < this.tenantsTotalPages) {
                    this.tenantsCurrentPage++;
                    this.updateTenantsTable(this.getCurrentTenantsPage());
                    this.updateTenantsPaginationControls();
                }
            };
        }
    }

    updateTenantsPaginationControls() {
        const pageNumbers = document.getElementById('tenantsPageNumbers');
        if (!pageNumbers) return;
        
        pageNumbers.innerHTML = '';
        
        // Show page numbers (max 5 pages)
        const startPage = Math.max(1, this.tenantsCurrentPage - 2);
        const endPage = Math.min(this.tenantsTotalPages, startPage + 4);
        
        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.className = `btn btn-sm ${i === this.tenantsCurrentPage ? 'btn-primary' : 'btn-secondary'}`;
            pageButton.textContent = i;
            pageButton.onclick = () => {
                this.tenantsCurrentPage = i;
                this.updateTenantsTable(this.getCurrentTenantsPage());
                this.updateTenantsPaginationControls();
            };
            pageNumbers.appendChild(pageButton);
        }
        
        // Update button states
        const prevButton = document.getElementById('tenantsPrevPage');
        const nextButton = document.getElementById('tenantsNextPage');
        
        if (prevButton) prevButton.disabled = this.tenantsCurrentPage === 1;
        if (nextButton) nextButton.disabled = this.tenantsCurrentPage === this.tenantsTotalPages;
    }


    generateLeaseInformationContent(tenant, lease) {
        if (!lease) {
            return `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-file-contract" style="font-size: 3rem; color: var(--dark-gray); margin-bottom: 15px; opacity: 0.5;"></i>
                    <h3 style="color: var(--dark-gray); margin-bottom: 10px;">No Active Lease Found</h3>
                    <p style="color: var(--dark-gray);">This tenant does not have an active lease agreement.</p>
                </div>
            `;
        }

        // Format dates
        const formatDate = (dateString) => {
            if (!dateString) return 'Not specified';
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        };

        const leaseStart = formatDate(lease.leaseStart);
        const leaseEnd = formatDate(lease.leaseEnd);
        const createdAt = formatDate(lease.createdAt);

        // Get occupant information
        const occupants = lease.occupants || [tenant.name];
        const primaryTenant = occupants[0];
        const additionalMembers = occupants.slice(1);
        const totalOccupants = lease.totalOccupants || occupants.length;
        const maxOccupants = lease.maxOccupants || 1;

        return `
            <div class="lease-information-modal" style="max-height: 70vh; overflow-y: auto;">
                <!-- Tenant Header -->
                <div style="background: linear-gradient(135deg, var(--royal-blue), #101b4a); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div class="tenant-avatar" style="width: 60px; height: 60px; font-size: 1.5rem;">${tenant.name.charAt(0).toUpperCase()}</div>
                        <div>
                            <h3 style="margin: 0 0 5px 0;">${tenant.name}</h3>
                            <p style="margin: 0; opacity: 0.9;">${tenant.email} • ${tenant.phone || 'No phone'}</p>
                            <p style="margin: 5px 0 0 0; opacity: 0.8;">${tenant.occupation || 'No occupation specified'}</p>
                        </div>
                    </div>
                </div>

                <!-- Lease Summary -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-bottom: 25px;">
                    <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid var(--success);">
                        <div style="font-size: 0.9rem; color: var(--dark-gray); margin-bottom: 5px;">Room Number</div>
                        <div style="font-size: 1.3rem; font-weight: 600; color: var(--success);">${lease.roomNumber || 'N/A'}</div>
                    </div>
                    <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid var(--royal-blue);">
                        <div style="font-size: 0.9rem; color: var(--dark-gray); margin-bottom: 5px;">Monthly Rent</div>
                        <div style="font-size: 1.3rem; font-weight: 600; color: var(--royal-blue);">₱${(lease.monthlyRent || 0).toLocaleString()}</div>
                    </div>
                    <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid var(--warning);">
                        <div style="font-size: 0.9rem; color: var(--dark-gray); margin-bottom: 5px;">Security Deposit</div>
                        <div style="font-size: 1.3rem; font-weight: 600; color: var(--warning);">₱${(lease.securityDeposit || 0).toLocaleString()}</div>
                    </div>
                    <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid var(--info);">
                        <div style="font-size: 0.9rem; color: var(--dark-gray); margin-bottom: 5px;">Occupants</div>
                        <div style="font-size: 1.3rem; font-weight: 600; color: var(--info);">${totalOccupants}/${maxOccupants}</div>
                    </div>
                </div>

                <!-- Lease Details -->
                <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: var(--royal-blue); margin-bottom: 15px; border-bottom: 2px solid var(--royal-blue); padding-bottom: 8px;">
                        <i class="fas fa-file-contract"></i> Lease Details
                    </h4>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <strong>Lease Period:</strong><br>
                            ${leaseStart} to ${leaseEnd}
                        </div>
                        <div>
                            <strong>Payment Method:</strong><br>
                            ${lease.paymentMethod || 'Cash'}
                        </div>
                        <div>
                            <strong>Payment Due Day:</strong><br>
                            ${lease.paymentDueDay ? `${lease.paymentDueDay}${this.getOrdinalSuffix(lease.paymentDueDay)} of month` : 'Not specified'}
                        </div>
                        <div>
                            <strong>Lease Status:</strong><br>
                            <span class="status-badge ${lease.isActive ? 'active' : 'inactive'}">
                                ${lease.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Occupant Information -->
                <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: var(--royal-blue); margin-bottom: 15px; border-bottom: 2px solid var(--royal-blue); padding-bottom: 8px;">
                        <i class="fas fa-users"></i> Occupant Information
                    </h4>
                    
                    <div style="margin-bottom: 15px;">
                        <strong>Primary Tenant:</strong><br>
                        ${primaryTenant}
                    </div>
                    
                    ${additionalMembers.length > 0 ? `
                        <div style="margin-bottom: 15px;">
                            <strong>Additional Occupants (${additionalMembers.length}):</strong><br>
                            ${additionalMembers.map(member => `• ${member}`).join('<br>')}
                        </div>
                    ` : `
                        <div style="color: var(--dark-gray); font-style: italic;">
                            No additional occupants registered.
                        </div>
                    `}
                    
                    <div style="background: rgba(52, 168, 83, 0.1); padding: 12px; border-radius: 6px; margin-top: 15px;">
                        <strong>Occupancy:</strong> ${totalOccupants} of ${maxOccupants} maximum occupants
                        ${totalOccupants > maxOccupants ? 
                            '<span style="color: var(--danger); margin-left: 10px;"><i class="fas fa-exclamation-triangle"></i> Over capacity!</span>' : 
                            '<span style="color: var(--success); margin-left: 10px;"><i class="fas fa-check-circle"></i> Within limit</span>'
                        }
                    </div>
                </div>

                <!-- Agreement Status -->
                <div style="background: white; padding: 20px; border-radius: 8px;">
                    <h4 style="color: var(--royal-blue); margin-bottom: 15px; border-bottom: 2px solid var(--royal-blue); padding-bottom: 8px;">
                        <i class="fas fa-check-circle"></i> Agreement Status
                    </h4>
                    
                    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                        <div style="flex: 1;">
                            <strong>Agreement Viewed:</strong><br>
                            <span class="status-badge ${lease.agreementViewed ? 'active' : 'warning'}">
                                ${lease.agreementViewed ? 'Yes' : 'No'}
                            </span>
                        </div>
                        <div style="flex: 1;">
                            <strong>Agreement Accepted:</strong><br>
                            <span class="status-badge ${lease.agreementAccepted ? 'active' : 'warning'}">
                                ${lease.agreementAccepted ? 'Yes' : 'No'}
                            </span>
                        </div>
                    </div>
                    
                    ${lease.agreementAcceptedDate ? `
                        <div>
                            <strong>Accepted Date:</strong><br>
                            ${formatDate(lease.agreementAcceptedDate)}
                        </div>
                    ` : ''}
                </div>

                <!-- Additional Information -->
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 20px; font-size: 0.9rem; color: var(--dark-gray);">
                    <strong><i class="fas fa-info-circle"></i> Additional Information:</strong><br>
                    • Lease Created: ${createdAt}<br>
                    • Additional Occupant Fee: ₱${(lease.additionalOccupantFee || 2000).toLocaleString()} per person<br>
                    • Lease ID: ${lease.id}
                </div>
            </div>
        `;
    }

    async showTenantLeaseModal(tenantId) {
        try {
            console.log('📄 Loading lease information for tenant:', tenantId);
            
            // Show loading state
            const modalContent = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--royal-blue);"></i>
                    <p>Loading lease information...</p>
                </div>
            `;

            const modal = ModalManager.openModal(modalContent, {
                title: 'Loading Lease Information',
                showFooter: false
            });

            // Fetch tenant and lease data
            const [tenantDoc, leaseQuery] = await Promise.all([
                firebaseDb.collection('users').doc(tenantId).get(),
                firebaseDb.collection('leases')
                    .where('tenantId', '==', tenantId)
                    .where('isActive', '==', true)
                    .limit(1)
                    .get()
            ]);

            if (!tenantDoc.exists) {
                ModalManager.closeModal(modal);
                this.showNotification('Tenant not found', 'error');
                return;
            }

            const tenant = { id: tenantDoc.id, ...tenantDoc.data() };
            
            let lease = null;
            if (!leaseQuery.empty) {
                lease = { id: leaseQuery.docs[0].id, ...leaseQuery.docs[0].data() };
            }

            // Generate lease information content
            const leaseContent = this.generateLeaseInformationContent(tenant, lease);
            
            // Update modal content
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = leaseContent;
            }

            // Add footer with close button
            const modalFooter = modal.querySelector('.modal-footer');
            if (!modalFooter) {
                const footer = document.createElement('div');
                footer.className = 'modal-footer';
                footer.innerHTML = `
                    <button class="btn btn-primary" onclick="ModalManager.closeModal(this.closest('.modal-overlay'))">
                        Close
                    </button>
                `;
                modal.querySelector('.modal-content').appendChild(footer);
            }

        } catch (error) {
            console.error('❌ Error loading tenant lease information:', error);
            this.showNotification('Failed to load lease information', 'error');
        }
    }

    removeTenantRowClickHandlers() {
        if (this.tenantRowClickHandler) {
            document.removeEventListener('click', this.tenantRowClickHandler);
            this.tenantRowClickHandler = null;
        }
    }

    setupTenantRowClickHandlers() {
        this.removeTenantRowClickHandlers();
        
        this.tenantRowClickHandler = (e) => {
            const tenantRow = e.target.closest('.tenant-row');
            if (tenantRow) {
                const tenantId = tenantRow.getAttribute('data-tenant-id');
                if (tenantId) {
                    this.showTenantLeaseModal(tenantId);
                }
            }
        };
        document.addEventListener('click', this.tenantRowClickHandler);
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

        // Setup row click handlers
        this.setupTenantRowClickHandlers();

        // Load tenants data
        await this.loadTenantsData();
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
                            <tr class="tenant-row" data-tenant-id="${tenant.id}" style="cursor: pointer;">
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
                                        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); casaLink.editTenant('${tenant.id}')">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); casaLink.sendMessage('${tenant.id}')">
                                            <i class="fas fa-envelope"></i>
                                        </button>
                                        <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); casaLink.deleteTenant('${tenant.id}')">
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

    showTenantMaintenanceRequestForm() {
        // Get current tenant user data
        const tenant = this.currentUser || {};
        const tenantId = tenant.id || tenant.uid || (firebaseAuth && firebaseAuth.currentUser && firebaseAuth.currentUser.uid);
        const tenantName = tenant.name || tenant.email || (firebaseAuth && firebaseAuth.currentUser && firebaseAuth.currentUser.email) || 'Tenant';
        const roomNumber = tenant.roomNumber || '';

        // Build the landlord-style form for tenants
        const content = `
            <div style="max-width:700px;">
                <div class="form-group">
                    <label class="form-label">Tenant *</label>
                    <input class="form-input" value="${this.escapeHtml(tenantName)}${roomNumber ? ` - Room ${roomNumber}` : ''}" readonly />
                    <small class="text-muted">Your information is automatically filled</small>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Request Type *</label>
                    <select id="maintType" class="form-input" required>
                        <option value="">Select type</option>
                        <option value="plumbing">Plumbing</option>
                        <option value="electrical">Electrical</option>
                        <option value="hvac">HVAC</option>
                        <option value="appliance">Appliance</option>
                        <option value="structural">Structural</option>
                        <option value="pest_control">Pest Control</option>
                        <option value="general">General</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Priority *</label>
                    <select id="maintPriority" class="form-input" required>
                        <option value="">Select priority</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="emergency">Emergency</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Title *</label>
                    <input id="maintTitle" class="form-input" placeholder="Brief description of the issue" required />
                </div>
                
                <div class="form-group">
                    <label class="form-label">Detailed Description *</label>
                    <textarea id="maintDescription" class="form-input" rows="6" placeholder="Please provide detailed information about the maintenance issue..." required></textarea>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Preferred Date</label>
                        <input id="maintPreferredDate" type="date" class="form-input" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Estimated Cost (₱)</label>
                        <input id="maintEstimatedCost" type="number" min="0" step="0.01" class="form-input" placeholder="0" />
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Upload Photos (Optional)</label>
                    <input id="maintImages" type="file" accept="image/*" multiple class="form-input" />
                    <small class="text-muted">You can upload multiple photos</small>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Special Instructions</label>
                    <textarea id="maintInstructions" class="form-input" rows="3" placeholder="Any special instructions for maintenance staff..."></textarea>
                </div>
                
                <div id="maintFormError" class="text-muted" style="display:none;color:var(--danger);margin-top:8px;"></div>
            </div>
        `;

        const modal = ModalManager.openModal(content, {
            title: 'Create Maintenance Request',
            submitText: 'Create Request',
            cancelText: 'Cancel',
            showFooter: true,
            onSubmit: async () => {
                const title = document.getElementById('maintTitle')?.value.trim();
                const description = document.getElementById('maintDescription')?.value.trim();
                const type = document.getElementById('maintType')?.value;
                const priority = document.getElementById('maintPriority')?.value;
                const preferredDate = document.getElementById('maintPreferredDate')?.value;
                const estimatedCost = document.getElementById('maintEstimatedCost')?.value;
                const specialInstructions = document.getElementById('maintInstructions')?.value.trim();
                const filesInput = document.getElementById('maintImages');
                const errorEl = document.getElementById('maintFormError');

                // Validation
                if (!title) {
                    if (errorEl) { errorEl.textContent = 'Please enter a title for the request.'; errorEl.style.display = 'block'; }
                    return;
                }
                if (!type) {
                    if (errorEl) { errorEl.textContent = 'Please select a request type.'; errorEl.style.display = 'block'; }
                    return;
                }
                if (!priority) {
                    if (errorEl) { errorEl.textContent = 'Please select a priority level.'; errorEl.style.display = 'block'; }
                    return;
                }
                if (!description) {
                    if (errorEl) { errorEl.textContent = 'Please provide a detailed description.'; errorEl.style.display = 'block'; }
                    return;
                }

                // Prepare request payload
                const requestData = {
                    title,
                    description,
                    type,
                    priority,
                    tenantId,
                    tenantName,
                    landlordId: tenant.landlordId || tenant.landlord || null,
                    roomNumber: roomNumber,
                    status: 'open',
                    images: [],
                    estimatedCost: estimatedCost ? parseFloat(estimatedCost) : 0,
                    preferredDate: preferredDate || null,
                    specialInstructions: specialInstructions || '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                // Show loading state
                const submitBtn = document.getElementById('modalSubmit');
                const originalText = submitBtn ? submitBtn.innerHTML : null;
                if (submitBtn) {
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Request...';
                    submitBtn.disabled = true;
                }

                try {
                    // Upload images if provided
                    if (filesInput && filesInput.files && filesInput.files.length > 0 && window.firebase && firebase.storage) {
                        const storageRef = firebase.storage().ref();
                        const uploadPromises = Array.from(filesInput.files).map(async (file) => {
                            const filePath = `maintenance_images/${tenantId || 'unknown'}/${Date.now()}_${file.name}`;
                            const ref = storageRef.child(filePath);
                            const snapshot = await ref.put(file);
                            const url = await snapshot.ref.getDownloadURL();
                            return url;
                        });

                        try {
                            const urls = await Promise.all(uploadPromises);
                            requestData.images = urls;
                        } catch (uploadErr) {
                            console.warn('Image upload failed (continuing without images):', uploadErr);
                        }
                    }

                    // Persist request via DataManager
                    if (!window.DataManager || typeof DataManager.createMaintenanceRequest !== 'function') {
                        throw new Error('DataManager.createMaintenanceRequest not available');
                    }

                    const createdId = await DataManager.createMaintenanceRequest(requestData);

                    // Close modal and refresh
                    ModalManager.closeModal(modal);
                    await this.loadTenantMaintenanceData();

                    // Show success notification
                    if (window.NotificationManager && typeof NotificationManager.showNotification === 'function') {
                        NotificationManager.showNotification('Maintenance request submitted', { 
                            body: 'Your request has been sent to your landlord.' 
                        });
                    } else {
                        this.showNotification('Maintenance request submitted successfully!', 'success');
                    }

                } catch (err) {
                    console.error('Error submitting maintenance request:', err);
                    if (errorEl) { 
                        errorEl.textContent = 'Failed to submit request. Please try again.'; 
                        errorEl.style.display = 'block'; 
                    }
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        if (originalText) submitBtn.innerHTML = originalText;
                    }
                }
            }
        });
    }

    // Add helper method for HTML escaping
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    async loadTenantMaintenanceData() {
        try {
            const tenant = this.currentUser || {};
            const tenantId = tenant.id || tenant.uid || (firebaseAuth && firebaseAuth.currentUser && firebaseAuth.currentUser.uid);

            const container = document.getElementById('tenantMaintenanceList');
            if (!container) return;

            container.innerHTML = `<div class="data-loading"><i class="fas fa-spinner fa-spin"></i> Loading maintenance requests...</div>`;

            if (!tenantId) {
                container.innerHTML = `<div class="empty-state"><h3>Not signed in</h3><p>Please sign in to view your maintenance requests.</p></div>`;
                return;
            }

            if (!window.DataManager || typeof DataManager.getTenantMaintenanceRequests !== 'function') {
                container.innerHTML = `<div class="error-state"><h3>Error</h3><p>Data manager not available.</p></div>`;
                return;
            }

            const requests = await DataManager.getTenantMaintenanceRequests(tenantId);

            if (!requests || requests.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-wrench" style="font-size:40px;"></i>
                        <h3>No maintenance requests</h3>
                        <p>You have not submitted any maintenance requests yet.</p>
                        <button class="btn btn-primary" onclick="casaLink.showTenantMaintenanceRequestForm()">Create a request</button>
                    </div>
                `;
                return;
            }

            // Sort newest first
            requests.sort((a,b) => (new Date(b.createdAt || 0)) - (new Date(a.createdAt || 0)));

            const html = requests.map(r => {
                const created = r.createdAt ? new Date(r.createdAt).toLocaleString() : '–';
                const priorityClass = r.priority === 'high' || r.priority === 'emergency' ? 'priority-high' : (r.priority === 'medium' ? 'priority-medium' : 'priority-low');
                const status = (r.status || 'open');
                return `
                    <div class="maintenance-row lease-card" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
                        <div style="flex:1;">
                            <div style="display:flex;gap:12px;align-items:center;">
                                <div>
                                    <div style="font-weight:700;">${r.title || 'Untitled request'}</div>
                                    <div class="text-muted" style="font-size:0.9rem;">${r.type || 'general'} • ${created}</div>
                                </div>
                            </div>
                            <div style="margin-top:10px;color:var(--dark-gray);">${(r.description || '').substring(0,300)}</div>
                            ${r.images && r.images.length ? `<div style="margin-top:10px;"><img src="${r.images[0]}" style="max-width:120px;border-radius:8px;border:1px solid #eee;" /></div>` : ''}
                        </div>
                        <div style="min-width:160px;text-align:right;">
                            <div style="margin-bottom:8px;"><span class="lease-status ${status}">${status}</span></div>
                            <div style="margin-bottom:8px;"><span class="${priorityClass}">${r.priority || 'medium'}</span></div>
                            <div>
                                <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); casaLink.viewTenantMaintenanceRequest('${r.id || r.documentId || r._id || r.requestId || ''}')">
                                    <i class="fas fa-eye"></i> View
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            container.innerHTML = `<div class="maintenance-list">${html}</div>`;

        } catch (error) {
            console.error('Failed loading tenant maintenance data:', error);
            const container = document.getElementById('tenantMaintenanceList');
            if (container) container.innerHTML = `<div class="error-state"><h3>Error</h3><p>Unable to load maintenance requests. Try refreshing.</p></div>`;
        }
    }

    async submitTenantMaintenanceRequest() {
        try {
            const requestData = {
                tenantId: this.currentUser.uid,
                tenantName: this.currentUser.name,
                roomNumber: this.currentUser.roomNumber,
                landlordId: this.currentUser.landlordId,
                type: document.getElementById('tenantIssueType').value,
                priority: document.getElementById('tenantUrgency').value,
                title: `Maintenance Request - ${this.currentUser.roomNumber}`,
                description: document.getElementById('tenantIssueDescription').value,
                accessInstructions: document.getElementById('tenantAccessTime').value,
                contactPreference: document.getElementById('tenantContactPref').value,
                status: 'open',
                createdBy: this.currentUser.uid,
                createdByName: this.currentUser.name
            };

            // Validation
            if (!requestData.type || !requestData.priority || !requestData.description) {
                this.showTenantMaintenanceError('Please fill in all required fields');
                return;
            }

            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
                submitBtn.disabled = true;
            }

            await DataManager.createMaintenanceRequest(requestData);
            
            ModalManager.closeModal(document.querySelector('.modal-overlay'));
            this.showNotification('Maintenance request submitted successfully!', 'success');

            // Refresh tenant maintenance page if open
            if (this.currentPage === 'tenantMaintenance') {
                setTimeout(() => {
                    this.showPage('tenantMaintenance');
                }, 1000);
            }

        } catch (error) {
            console.error('Error submitting tenant maintenance request:', error);
            this.showTenantMaintenanceError('Failed to submit request: ' + error.message);
            
            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = 'Submit Request';
                submitBtn.disabled = false;
            }
        }
    }

    setupMaintenanceRealTimeListeners() {
        if (this.maintenanceListener) {
            this.maintenanceListener(); // Remove existing listener
        }
        
        this.maintenanceListener = firebaseDb.collection('maintenance')
            .where('landlordId', '==', this.currentUser.uid)
            .onSnapshot((snapshot) => {
                console.log('🔄 Real-time maintenance update received');
                this.loadMaintenanceData();
                this.loadMaintenanceStats();
            }, (error) => {
                console.error('❌ Maintenance real-time listener error:', error);
            });
    }

    async setupMaintenancePage() {
        try {
            console.log('🔄 Setting up maintenance page with enhanced features...');
            
            // Load initial data
            await this.loadMaintenanceData();
            await this.loadMaintenanceStats();
            
            // Setup event listeners
            this.setupMaintenanceEventListeners();
            
            // Setup real-time listeners
            this.setupMaintenanceRealTimeListeners();
            
            // ADD THIS: Setup row click handlers
            this.setupMaintenanceRowClickHandlers();
            
            console.log('✅ Maintenance page setup complete with real-time updates');
        } catch (error) {
            console.error('Error setting up maintenance page:', error);
            this.showNotification('Failed to load maintenance data', 'error');
        }
    }

    updateMaintenanceStats(stats) {
        this.updateCard('openMaintenanceCount', stats.open || 0);
        this.updateCard('highPriorityCount', stats.highPriority || 0);
        this.updateCard('inProgressCount', stats.inProgress || 0);
        this.updateCard('completedCount', stats.completed || 0);
    }

    async loadMaintenanceStats() {
        try {
            console.log('📊 Loading maintenance stats...');
            const stats = await DataManager.getMaintenanceStats(this.currentUser.uid);
            this.updateMaintenanceStats(stats);
            
            console.log('✅ Maintenance stats loaded:', stats);
        } catch (error) {
            console.error('Error loading maintenance stats:', error);
        }
    }

    async loadMaintenanceData() {
        try {
            console.log('🔄 Loading maintenance data...');
            const requests = await DataManager.getMaintenanceRequests(this.currentUser.uid);
            this.currentMaintenanceRequests = requests;
            this.updateMaintenanceTable(requests);
            
            console.log('✅ Maintenance data loaded:', requests.length, 'requests');
        } catch (error) {
            console.error('Error loading maintenance data:', error);
            this.showNotification('Failed to load maintenance requests', 'error');
        }
    }

    updateMaintenanceTable(requests) {
        const maintenanceList = document.getElementById('maintenanceList');
        if (!maintenanceList) return;
        
        if (requests.length === 0) {
            maintenanceList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-tools"></i>
                    <h3>No Maintenance Requests</h3>
                    <p>No maintenance requests found. Create your first request to get started.</p>
                    <button class="btn btn-primary" onclick="casaLink.showCreateMaintenanceForm()">
                        <i class="fas fa-plus"></i> Create First Request
                    </button>
                </div>
            `;
            return;
        }
        
        maintenanceList.innerHTML = this.renderMaintenanceTable(requests);
        
        // ADD THIS LINE to setup hover effects:
        setTimeout(() => this.setupMaintenanceRowStyles(), 100);
    }

    getPriorityBadge(priority) {
        const priorityConfig = {
            low: { class: 'active', text: 'Low' },
            medium: { class: 'warning', text: 'Medium' },
            high: { class: 'danger', text: 'High' },
            emergency: { class: 'danger', text: 'Emergency' }
        };
        
        const config = priorityConfig[priority] || priorityConfig.medium;
        return `<span class="status-badge ${config.class}">${config.text}</span>`;
    }

    getStatusBadge(status) {
        const statusConfig = {
            open: { class: 'warning', text: 'Open' },
            'in-progress': { class: 'info', text: 'In Progress' },
            pending_parts: { class: 'warning', text: 'Pending Parts' },
            completed: { class: 'active', text: 'Completed' },
            cancelled: { class: 'inactive', text: 'Cancelled' }
        };
        
        const config = statusConfig[status] || statusConfig.open;
        return `<span class="status-badge ${config.class}">${config.text}</span>`;
    }

    setupMaintenanceEventListeners() {
        // Search functionality
        document.getElementById('maintenanceSearch')?.addEventListener('input', (e) => {
            this.searchMaintenance(e.target.value);
        });
        
        // Filter functionality
        document.getElementById('statusFilter')?.addEventListener('change', (e) => {
            this.filterMaintenanceByStatus(e.target.value);
        });
        
        document.getElementById('priorityFilter')?.addEventListener('change', (e) => {
            this.filterMaintenanceByPriority(e.target.value);
        });
        
        document.getElementById('typeFilter')?.addEventListener('change', (e) => {
            this.filterMaintenanceByType(e.target.value);
        });
        
        // Row click handlers
        this.setupMaintenanceRowClickHandlers();
    }

    async showCreateMaintenanceForm() {
        try {
            const tenants = await DataManager.getTenants(this.currentUser.uid);
            const maintenanceTypes = await DataManager.getMaintenanceTypes();
            const priorities = await DataManager.getMaintenancePriorities();

            const tenantOptions = tenants.map(tenant => `
                <option value="${tenant.id}" data-room="${tenant.roomNumber}">
                    ${tenant.name} - ${tenant.roomNumber}
                </option>
            `).join('');

            const typeOptions = maintenanceTypes.map(type => `
                <option value="${type.id}">${type.name}</option>
            `).join('');

            const priorityOptions = priorities.map(priority => `
                <option value="${priority.id}">${priority.name}</option>
            `).join('');

            const modalContent = `
                <div class="create-maintenance-modal">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <i class="fas fa-tools" style="font-size: 3rem; color: var(--royal-blue); margin-bottom: 15px;"></i>
                        <h3 style="margin-bottom: 10px;">Create Maintenance Request</h3>
                        <p>Submit a new maintenance request for a tenant</p>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Tenant *</label>
                        <select id="maintenanceTenant" class="form-input" required>
                            <option value="">Select a tenant</option>
                            ${tenantOptions}
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Request Type *</label>
                        <select id="maintenanceType" class="form-input" required>
                            <option value="">Select type</option>
                            ${typeOptions}
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Priority *</label>
                        <select id="maintenancePriority" class="form-input" required>
                            <option value="">Select priority</option>
                            ${priorityOptions}
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Title *</label>
                        <input type="text" id="maintenanceTitle" class="form-input" 
                            placeholder="Brief description of the issue" required>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Detailed Description *</label>
                        <textarea id="maintenanceDescription" class="form-input" 
                            placeholder="Please provide detailed information about the maintenance issue..."
                            rows="4" required></textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Estimated Cost (₱)</label>
                        <input type="number" id="maintenanceCost" class="form-input" 
                            placeholder="0" min="0" step="0.01">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Preferred Date</label>
                        <input type="date" id="maintenancePreferredDate" class="form-input">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Upload Photos (Optional)</label>
                        <input type="file" id="maintenancePhotos" class="form-input" 
                            accept="image/*" multiple>
                        <small style="color: var(--dark-gray);">You can upload multiple photos</small>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Special Instructions</label>
                        <textarea id="maintenanceInstructions" class="form-input" 
                            placeholder="Any special instructions for maintenance staff..."
                            rows="3"></textarea>
                    </div>

                    <div id="maintenanceCreateError" style="color: var(--danger); display: none; margin-bottom: 15px;"></div>
                </div>
            `;

            const modal = ModalManager.openModal(modalContent, {
                title: 'Create Maintenance Request',
                submitText: 'Create Request',
                onSubmit: () => this.createMaintenanceRequest()
            });

            this.createMaintenanceModal = modal;

        } catch (error) {
            console.error('Error showing maintenance form:', error);
            this.showNotification('Failed to load maintenance form', 'error');
        }
    }

    async updateMaintenanceRequest(requestId) {
        try {
            const request = await DataManager.getMaintenanceRequest(requestId);
            if (!request) {
                this.showNotification('Maintenance request not found', 'error');
                return;
            }

            const statuses = [
                { id: 'open', name: 'Open' },
                { id: 'in-progress', name: 'In Progress' },
                { id: 'pending_parts', name: 'Pending Parts' },
                { id: 'completed', name: 'Completed' },
                { id: 'cancelled', name: 'Cancelled' }
            ];

            const priorities = await DataManager.getMaintenancePriorities();

            const statusOptions = statuses.map(status => `
                <option value="${status.id}" ${request.status === status.id ? 'selected' : ''}>
                    ${status.name}
                </option>
            `).join('');

            const priorityOptions = priorities.map(priority => `
                <option value="${priority.id}" ${request.priority === priority.id ? 'selected' : ''}>
                    ${priority.name}
                </option>
            `).join('');

            const modalContent = `
                <div class="update-maintenance-modal">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <i class="fas fa-edit" style="font-size: 3rem; color: var(--warning); margin-bottom: 15px;"></i>
                        <h3 style="margin-bottom: 10px;">Update Maintenance Request</h3>
                        <p>Update the status and details of this maintenance request</p>
                    </div>

                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: var(--royal-blue);">Request Details</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.9rem;">
                            <div><strong>Tenant:</strong> ${request.tenantName}</div>
                            <div><strong>Room:</strong> ${request.roomNumber}</div>
                            <div><strong>Type:</strong> ${request.type.replace('_', ' ')}</div>
                            <div><strong>Title:</strong> ${request.title}</div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Status *</label>
                        <select id="updateStatus" class="form-input" required>
                            ${statusOptions}
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Priority *</label>
                        <select id="updatePriority" class="form-input" required>
                            ${priorityOptions}
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Actual Cost (₱)</label>
                        <input type="number" id="actualCost" class="form-input" 
                            value="${request.actualCost || ''}" min="0" step="0.01">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Completion Date</label>
                        <input type="date" id="completionDate" class="form-input"
                            value="${request.completedDate ? new Date(request.completedDate).toISOString().split('T')[0] : ''}">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Staff Notes</label>
                        <textarea id="staffNotes" class="form-input" 
                            placeholder="Add notes about the work performed..."
                            rows="4">${request.staffNotes || ''}</textarea>
                    </div>

                    <div id="updateMaintenanceError" style="color: var(--danger); display: none; margin-bottom: 15px;"></div>
                </div>
            `;

            const modal = ModalManager.openModal(modalContent, {
                title: 'Update Maintenance Request',
                submitText: 'Update Request',
                onSubmit: () => this.processMaintenanceUpdate(requestId)
            });

            this.updateMaintenanceModal = modal;

        } catch (error) {
            console.error('Error updating maintenance request:', error);
            this.showNotification('Failed to load update form', 'error');
        }
    }

    async loadBulkAssignmentRequests() {
        try {
            const maintenanceRequests = await DataManager.getMaintenanceRequests(this.currentUser.uid);
            const openRequests = maintenanceRequests.filter(req => 
                req.status === 'open' && !req.assignedTo
            );

            const requestsList = document.getElementById('bulkRequestsList');
            
            if (openRequests.length === 0) {
                requestsList.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: var(--dark-gray);">
                        <i class="fas fa-check-circle"></i>
                        <p>No open requests available for assignment.</p>
                    </div>
                `;
                return;
            }

            requestsList.innerHTML = openRequests.map(request => `
                <div style="display: flex; align-items: center; gap: 10px; padding: 8px; border-bottom: 1px solid #eee;">
                    <input type="checkbox" id="req-${request.id}" value="${request.id}">
                    <label for="req-${request.id}" style="flex: 1; cursor: pointer;">
                        <div style="font-weight: 500;">${request.tenantName} - ${request.roomNumber}</div>
                        <div style="font-size: 0.8rem; color: var(--dark-gray);">${request.title}</div>
                    </label>
                    <span class="status-badge ${this.getPriorityBadge(request.priority).split('"')[1]}">
                        ${request.priority}
                    </span>
                </div>
            `).join('');

        } catch (error) {
            console.error('Error loading bulk assignment requests:', error);
            const requestsList = document.getElementById('bulkRequestsList');
            requestsList.innerHTML = `
                <div style="color: var(--danger); text-align: center;">
                    Failed to load requests
                </div>
            `;
        }
    }

    async showAssignStaffForm() {
        const modalContent = `
            <div class="assign-staff-modal">
                <div style="text-align: center; margin-bottom: 20px;">
                    <i class="fas fa-users" style="font-size: 3rem; color: var(--success); margin-bottom: 15px;"></i>
                    <h3 style="margin-bottom: 10px;">Bulk Staff Assignment</h3>
                    <p>Assign multiple maintenance requests to staff members</p>
                </div>

                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0; color: var(--dark-gray);">
                        <i class="fas fa-info-circle"></i> 
                        This feature allows you to assign multiple open maintenance requests to staff members at once.
                    </p>
                </div>

                <div class="form-group">
                    <label class="form-label">Select Staff Member *</label>
                    <select id="bulkStaff" class="form-input" required>
                        <option value="">Select staff member</option>
                        <option value="staff1">Juan Dela Cruz - Maintenance Technician</option>
                        <option value="staff2">Maria Santos - Plumbing Specialist</option>
                        <option value="staff3">Roberto Garcia - Electrician</option>
                        <option value="staff4">Anna Reyes - General Maintenance</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Select Requests to Assign</label>
                    <div id="bulkRequestsList" style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; border-radius: 8px; padding: 10px;">
                        <div class="data-loading">
                            <i class="fas fa-spinner fa-spin"></i> Loading open requests...
                        </div>
                    </div>
                </div>

                <div id="bulkAssignError" style="color: var(--danger); display: none; margin-bottom: 15px;"></div>
            </div>
        `;

        const modal = ModalManager.openModal(modalContent, {
            title: 'Bulk Staff Assignment',
            submitText: 'Assign Selected',
            onSubmit: () => this.processBulkAssignment()
        });

        // Load open requests
        setTimeout(async () => {
            await this.loadBulkAssignmentRequests();
        }, 100);

        this.bulkAssignModal = modal;
    }

    async saveMaintenanceSettings() {
        try {
            // In a real app, you'd save these to Firestore
            const settings = {
                autoAssign: document.getElementById('autoAssign').checked,
                emailNotifications: document.getElementById('emailNotifications').checked,
                responseTime: parseInt(document.getElementById('responseTime').value),
                emergencyContact: document.getElementById('emergencyContact').value
            };

            // For now, just show a success message
            ModalManager.closeModal(this.maintenanceSettingsModal);
            this.showNotification('Maintenance settings saved successfully!', 'success');

        } catch (error) {
            console.error('Error saving maintenance settings:', error);
            this.showNotification('Failed to save maintenance settings', 'error');
        }
    }


    async showMaintenanceSettings() {
        const modalContent = `
            <div class="maintenance-settings-modal">
                <div style="text-align: center; margin-bottom: 20px;">
                    <i class="fas fa-cog" style="font-size: 3rem; color: var(--royal-blue); margin-bottom: 15px;"></i>
                    <h3 style="margin-bottom: 10px;">Maintenance Settings</h3>
                    <p>Configure maintenance preferences and notifications</p>
                </div>

                <div class="form-group">
                    <label class="form-label" style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" id="autoAssign" checked>
                        <span>Enable Auto-Assignment</span>
                    </label>
                    <small style="color: var(--dark-gray);">
                        Automatically assign maintenance requests based on type and availability
                    </small>
                </div>

                <div class="form-group">
                    <label class="form-label" style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" id="emailNotifications" checked>
                        <span>Email Notifications</span>
                    </label>
                    <small style="color: var(--dark-gray);">
                        Send email notifications for new maintenance requests and status updates
                    </small>
                </div>

                <div class="form-group">
                    <label class="form-label">Default Response Time (Hours)</label>
                    <input type="number" id="responseTime" class="form-input" value="24" min="1" max="168">
                    <small style="color: var(--dark-gray);">
                        Target time to respond to maintenance requests
                    </small>
                </div>

                <div class="form-group">
                    <label class="form-label">Emergency Contact</label>
                    <input type="text" id="emergencyContact" class="form-input" 
                        placeholder="Emergency contact number">
                </div>

                <div class="security-info">
                    <i class="fas fa-info-circle"></i>
                    <small>Changes will take effect immediately for new requests</small>
                </div>
            </div>
        `;

        const modal = ModalManager.openModal(modalContent, {
            title: 'Maintenance Settings',
            submitText: 'Save Settings',
            onSubmit: () => this.saveMaintenanceSettings()
        });

        this.maintenanceSettingsModal = modal;
    }

    async exportMaintenance() {
        try {
            const maintenanceRequests = await DataManager.getMaintenanceRequests(this.currentUser.uid);
            
            // Create CSV content
            let csvContent = "Maintenance Report\n\n";
            csvContent += "ID,Tenant,Room,Type,Priority,Status,Title,Estimated Cost,Actual Cost,Created Date,Completed Date,Assigned To\n";
            
            maintenanceRequests.forEach(request => {
                const row = [
                    request.id.substring(0, 8),
                    `"${request.tenantName}"`,
                    request.roomNumber,
                    request.type,
                    request.priority,
                    request.status,
                    `"${request.title}"`,
                    request.estimatedCost || 0,
                    request.actualCost || 0,
                    new Date(request.createdAt).toLocaleDateString(),
                    request.completedDate ? new Date(request.completedDate).toLocaleDateString() : 'N/A',
                    request.assignedName || 'N/A'
                ].join(',');
                
                csvContent += row + '\n';
            });

            // Create and download file
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `maintenance-report-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            this.showNotification('Maintenance report exported successfully!', 'success');

        } catch (error) {
            console.error('Error exporting maintenance:', error);
            this.showNotification('Failed to export maintenance report', 'error');
        }
    }

    async showMaintenanceSchedule() {
        try {
            const maintenanceRequests = await DataManager.getMaintenanceRequests(this.currentUser.uid);
            
            const scheduledRequests = maintenanceRequests.filter(req => 
                req.preferredDate || req.estimatedCompletion
            ).sort((a, b) => {
                const dateA = new Date(a.preferredDate || a.estimatedCompletion || a.createdAt);
                const dateB = new Date(b.preferredDate || b.estimatedCompletion || b.createdAt);
                return dateA - dateB;
            });

            let scheduleContent = '';

            if (scheduledRequests.length === 0) {
                scheduleContent = `
                    <div style="text-align: center; padding: 40px; color: var(--dark-gray);">
                        <i class="fas fa-calendar-times" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                        <h3>No Scheduled Maintenance</h3>
                        <p>No maintenance requests have scheduled dates yet.</p>
                    </div>
                `;
            } else {
                scheduleContent = `
                    <div style="max-height: 500px; overflow-y: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                            <thead>
                                <tr style="background-color: #f8f9fa;">
                                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Date</th>
                                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Tenant/Room</th>
                                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Issue</th>
                                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Type</th>
                                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Assigned To</th>
                                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${scheduledRequests.map(request => {
                                    const scheduleDate = new Date(request.preferredDate || request.estimatedCompletion);
                                    const today = new Date();
                                    const isToday = scheduleDate.toDateString() === today.toDateString();
                                    const isPast = scheduleDate < today && !isToday;
                                    
                                    return `
                                        <tr style="border-bottom: 1px solid #e9ecef; ${isPast ? 'background: rgba(234, 67, 53, 0.05);' : ''}">
                                            <td style="padding: 12px;">
                                                <div style="font-weight: 600; ${isToday ? 'color: var(--warning);' : isPast ? 'color: var(--danger);' : ''}">
                                                    ${scheduleDate.toLocaleDateString()}
                                                </div>
                                                ${isToday ? '<small style="color: var(--warning);">Today</small>' : ''}
                                                ${isPast ? '<small style="color: var(--danger);">Overdue</small>' : ''}
                                            </td>
                                            <td style="padding: 12px;">
                                                <div>${request.tenantName}</div>
                                                <small style="color: var(--dark-gray);">${request.roomNumber}</small>
                                            </td>
                                            <td style="padding: 12px;">
                                                <strong>${request.title}</strong>
                                            </td>
                                            <td style="padding: 12px; text-transform: capitalize;">
                                                ${request.type.replace('_', ' ')}
                                            </td>
                                            <td style="padding: 12px;">
                                                ${request.assignedName || 'Not assigned'}
                                            </td>
                                            <td style="padding: 12px;">
                                                ${this.getStatusBadge(request.status)}
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }

            const modalContent = `
                <div class="maintenance-schedule-modal">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <i class="fas fa-calendar-alt" style="font-size: 3rem; color: var(--info); margin-bottom: 15px;"></i>
                        <h3 style="margin-bottom: 10px;">Maintenance Schedule</h3>
                        <p>View all scheduled maintenance activities</p>
                    </div>
                    ${scheduleContent}
                </div>
            `;

            const modal = ModalManager.openModal(modalContent, {
                title: 'Maintenance Schedule',
                submitText: 'Close',
                onSubmit: () => ModalManager.closeModal(modal)
            });

        } catch (error) {
            console.error('Error showing maintenance schedule:', error);
            this.showNotification('Failed to load maintenance schedule', 'error');
        }
    }

    showAssignMaintenanceError(message) {
        const errorElement = document.getElementById('assignMaintenanceError');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    async processStaffAssignment(requestId) {
        try {
            const staffId = document.getElementById('assignStaff').value;
            const assignmentNotes = document.getElementById('assignmentNotes').value;
            const estimatedCompletion = document.getElementById('estimatedCompletion').value;

            if (!staffId) {
                this.showAssignMaintenanceError('Please select a staff member');
                return;
            }

            // Get staff name from the selected option
            const staffSelect = document.getElementById('assignStaff');
            const selectedStaff = staffSelect.options[staffSelect.selectedIndex].text.split(' - ')[0];

            const updates = {
                assignedTo: staffId,
                assignedName: selectedStaff,
                assignmentNotes: assignmentNotes,
                estimatedCompletion: estimatedCompletion,
                status: 'in-progress',
                assignedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Assigning...';
                submitBtn.disabled = true;
            }

            await DataManager.updateMaintenanceRequest(requestId, updates);
            
            ModalManager.closeModal(this.assignMaintenanceModal);
            this.showNotification('Maintenance request assigned successfully!', 'success');

            // Refresh maintenance data
            setTimeout(() => {
                this.loadMaintenanceData();
                this.loadMaintenanceStats();
            }, 1000);

        } catch (error) {
            console.error('Error assigning maintenance:', error);
            this.showAssignMaintenanceError('Failed to assign staff: ' + error.message);
            
            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = 'Assign Staff';
                submitBtn.disabled = false;
            }
        }
    }

    async assignMaintenance(requestId) {
        try {
            const request = await DataManager.getMaintenanceRequest(requestId);
            if (!request) {
                this.showNotification('Maintenance request not found', 'error');
                return;
            }

            // In a real app, you'd fetch staff members from your database
            const staffMembers = [
                { id: 'staff1', name: 'Juan Dela Cruz', role: 'Maintenance Technician' },
                { id: 'staff2', name: 'Maria Santos', role: 'Plumbing Specialist' },
                { id: 'staff3', name: 'Roberto Garcia', role: 'Electrician' },
                { id: 'staff4', name: 'Anna Reyes', role: 'General Maintenance' }
            ];

            const staffOptions = staffMembers.map(staff => `
                <option value="${staff.id}">${staff.name} - ${staff.role}</option>
            `).join('');

            const modalContent = `
                <div class="assign-maintenance-modal">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <i class="fas fa-user-check" style="font-size: 3rem; color: var(--success); margin-bottom: 15px;"></i>
                        <h3 style="margin-bottom: 10px;">Assign Maintenance Staff</h3>
                        <p>Assign this maintenance request to a staff member</p>
                    </div>

                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: var(--royal-blue);">Request Details</h4>
                        <div style="font-size: 0.9rem;">
                            <div><strong>Tenant:</strong> ${request.tenantName} (${request.roomNumber})</div>
                            <div><strong>Issue:</strong> ${request.title}</div>
                            <div><strong>Priority:</strong> <span class="status-badge ${this.getPriorityBadge(request.priority).split('"')[1]}">${request.priority}</span></div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Assign To *</label>
                        <select id="assignStaff" class="form-input" required>
                            <option value="">Select staff member</option>
                            ${staffOptions}
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Assignment Notes</label>
                        <textarea id="assignmentNotes" class="form-input" 
                            placeholder="Add any specific instructions for the assigned staff..."
                            rows="3"></textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Estimated Completion Date</label>
                        <input type="date" id="estimatedCompletion" class="form-input"
                            min="${new Date().toISOString().split('T')[0]}">
                    </div>

                    <div id="assignMaintenanceError" style="color: var(--danger); display: none; margin-bottom: 15px;"></div>
                </div>
            `;

            const modal = ModalManager.openModal(modalContent, {
                title: 'Assign Maintenance Staff',
                submitText: 'Assign Staff',
                onSubmit: () => this.processStaffAssignment(requestId)
            });

            this.assignMaintenanceModal = modal;

        } catch (error) {
            console.error('Error assigning maintenance:', error);
            this.showNotification('Failed to load assignment form', 'error');
        }
    }

    showMaintenanceUpdateError(message) {
        const errorElement = document.getElementById('updateMaintenanceError');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }


    async processMaintenanceUpdate(requestId) {
        try {
            const updates = {
                status: document.getElementById('updateStatus').value,
                priority: document.getElementById('updatePriority').value,
                actualCost: parseFloat(document.getElementById('actualCost').value) || 0,
                staffNotes: document.getElementById('staffNotes').value,
                updatedAt: new Date().toISOString()
            };

            // Set completion date if status is completed
            if (updates.status === 'completed') {
                const completionDate = document.getElementById('completionDate').value;
                updates.completedDate = completionDate || new Date().toISOString();
            }

            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
                submitBtn.disabled = true;
            }

            await DataManager.updateMaintenanceRequest(requestId, updates);
            
            ModalManager.closeModal(this.updateMaintenanceModal);
            this.showNotification('Maintenance request updated successfully!', 'success');

            // Refresh maintenance data
            setTimeout(() => {
                this.loadMaintenanceData();
                this.loadMaintenanceStats();
            }, 1000);

        } catch (error) {
            console.error('Error updating maintenance request:', error);
            this.showMaintenanceUpdateError('Failed to update request: ' + error.message);
            
            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = 'Update Request';
                submitBtn.disabled = false;
            }
        }
    }

    setupMaintenanceRowStyles() {
        const maintenanceRows = document.querySelectorAll('.maintenance-row');
        maintenanceRows.forEach(row => {
            // Add hover effects
            row.style.cursor = 'pointer';
            row.style.transition = 'all 0.3s ease';
            
            row.addEventListener('mouseenter', () => {
                row.style.backgroundColor = 'rgba(22, 38, 96, 0.08)';
                row.style.transform = 'translateY(-1px)';
                row.style.boxShadow = '0 2px 8px rgba(22, 38, 96, 0.15)';
            });
            
            row.addEventListener('mouseleave', () => {
                row.style.backgroundColor = '';
                row.style.transform = '';
                row.style.boxShadow = '';
            });
        });
    }

    generateMaintenanceRequestDetails(request) {
        const createdDate = new Date(request.createdAt);
        const updatedDate = new Date(request.updatedAt);
        const preferredDate = request.preferredDate ? new Date(request.preferredDate) : null;
        const completedDate = request.completedDate ? new Date(request.completedDate) : null;
        const assignedDate = request.assignedAt ? new Date(request.assignedAt) : null;

        // Calculate days open
        const today = new Date();
        const daysOpen = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24));
        
        // Priority configuration
        const priorityConfig = {
            low: { class: 'active', text: 'Low', color: 'var(--success)' },
            medium: { class: 'warning', text: 'Medium', color: 'var(--warning)' },
            high: { class: 'danger', text: 'High', color: 'var(--danger)' },
            emergency: { class: 'danger', text: 'Emergency', color: 'var(--danger)' }
        };

        // Status configuration
        const statusConfig = {
            open: { class: 'warning', text: 'Open', color: 'var(--warning)' },
            'in-progress': { class: 'info', text: 'In Progress', color: 'var(--info)' },
            pending_parts: { class: 'warning', text: 'Pending Parts', color: 'var(--warning)' },
            completed: { class: 'active', text: 'Completed', color: 'var(--success)' },
            cancelled: { class: 'inactive', text: 'Cancelled', color: 'var(--dark-gray)' }
        };

        const priority = priorityConfig[request.priority] || priorityConfig.medium;
        const status = statusConfig[request.status] || statusConfig.open;

        return `
            <div class="maintenance-details-modal" style="max-height: 70vh; overflow-y: auto;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, var(--royal-blue), #101b4a); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h3 style="margin: 0 0 5px 0;">${request.title}</h3>
                            <p style="margin: 0; opacity: 0.9;">Request #${request.id.substring(0, 8)} • ${request.type.replace('_', ' ')}</p>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 1.8rem; font-weight: 700;">
                                ${request.estimatedCost > 0 ? `₱${request.estimatedCost.toLocaleString()}` : 'No cost estimate'}
                            </div>
                            <div style="opacity: 0.9;">Estimated Cost</div>
                        </div>
                    </div>
                </div>

                <!-- Quick Info Grid -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid ${status.color};">
                        <div style="font-size: 0.9rem; color: var(--dark-gray); margin-bottom: 5px;">Status</div>
                        <div style="font-size: 1.1rem; font-weight: 600; color: ${status.color};">
                            <span class="status-badge ${status.class}">${status.text}</span>
                        </div>
                    </div>
                    
                    <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid ${priority.color};">
                        <div style="font-size: 0.9rem; color: var(--dark-gray); margin-bottom: 5px;">Priority</div>
                        <div style="font-size: 1.1rem; font-weight: 600; color: ${priority.color};">
                            <span class="status-badge ${priority.class}">${priority.text}</span>
                        </div>
                    </div>
                    
                    <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid var(--info);">
                        <div style="font-size: 0.9rem; color: var(--dark-gray); margin-bottom: 5px;">Days Open</div>
                        <div style="font-size: 1.1rem; font-weight: 600; color: var(--info);">
                            ${daysOpen} days
                        </div>
                    </div>
                    
                    ${request.actualCost > 0 ? `
                        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid var(--success);">
                            <div style="font-size: 0.9rem; color: var(--dark-gray); margin-bottom: 5px;">Actual Cost</div>
                            <div style="font-size: 1.1rem; font-weight: 600; color: var(--success);">
                                ₱${request.actualCost.toLocaleString()}
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- Tenant Information -->
                <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: var(--royal-blue); margin-bottom: 15px; border-bottom: 2px solid var(--royal-blue); padding-bottom: 8px;">
                        <i class="fas fa-user"></i> Tenant Information
                    </h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <strong>Tenant Name:</strong><br>
                            ${request.tenantName || 'N/A'}
                        </div>
                        <div>
                            <strong>Room Number:</strong><br>
                            ${request.roomNumber || 'N/A'}
                        </div>
                        ${request.contactPreference ? `
                            <div>
                                <strong>Contact Preference:</strong><br>
                                ${request.contactPreference}
                            </div>
                        ` : ''}
                        ${request.accessInstructions ? `
                            <div>
                                <strong>Access Instructions:</strong><br>
                                ${request.accessInstructions}
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Issue Details -->
                <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: var(--royal-blue); margin-bottom: 15px; border-bottom: 2px solid var(--royal-blue); padding-bottom: 8px;">
                        <i class="fas fa-clipboard-list"></i> Issue Details
                    </h4>
                    <div style="margin-bottom: 15px;">
                        <strong>Description:</strong><br>
                        <p style="margin: 10px 0; line-height: 1.6; background: #f8f9fa; padding: 15px; border-radius: 8px;">${request.description}</p>
                    </div>
                    
                    ${request.specialInstructions ? `
                        <div style="margin-bottom: 15px;">
                            <strong>Special Instructions:</strong><br>
                            <p style="margin: 10px 0; line-height: 1.6; background: rgba(251, 188, 4, 0.1); padding: 15px; border-radius: 8px;">${request.specialInstructions}</p>
                        </div>
                    ` : ''}
                </div>

                <!-- Assignment & Scheduling -->
                <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: var(--royal-blue); margin-bottom: 15px; border-bottom: 2px solid var(--royal-blue); padding-bottom: 8px;">
                        <i class="fas fa-calendar-alt"></i> Assignment & Scheduling
                    </h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        ${request.assignedName ? `
                            <div>
                                <strong>Assigned To:</strong><br>
                                ${request.assignedName}
                                ${assignedDate ? `<br><small style="color: var(--dark-gray);">Assigned on ${assignedDate.toLocaleDateString()}</small>` : ''}
                            </div>
                        ` : ''}
                        
                        ${preferredDate ? `
                            <div>
                                <strong>Preferred Date:</strong><br>
                                ${preferredDate.toLocaleDateString()}
                            </div>
                        ` : ''}
                        
                        ${request.estimatedCompletion ? `
                            <div>
                                <strong>Estimated Completion:</strong><br>
                                ${new Date(request.estimatedCompletion).toLocaleDateString()}
                            </div>
                        ` : ''}
                        
                        ${completedDate ? `
                            <div>
                                <strong>Completed Date:</strong><br>
                                ${completedDate.toLocaleDateString()}
                            </div>
                        ` : ''}
                    </div>
                    
                    ${request.assignmentNotes ? `
                        <div style="margin-top: 15px;">
                            <strong>Assignment Notes:</strong><br>
                            <p style="margin: 10px 0; line-height: 1.6; background: #f8f9fa; padding: 10px; border-radius: 6px;">${request.assignmentNotes}</p>
                        </div>
                    ` : ''}
                </div>

                <!-- Cost Information -->
                ${request.estimatedCost > 0 || request.actualCost > 0 ? `
                    <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h4 style="color: var(--royal-blue); margin-bottom: 15px; border-bottom: 2px solid var(--royal-blue); padding-bottom: 8px;">
                            <i class="fas fa-money-bill-wave"></i> Cost Information
                        </h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            ${request.estimatedCost > 0 ? `
                                <div>
                                    <strong>Estimated Cost:</strong><br>
                                    <span style="font-weight: 600; color: var(--warning);">₱${request.estimatedCost.toLocaleString()}</span>
                                </div>
                            ` : ''}
                            
                            ${request.actualCost > 0 ? `
                                <div>
                                    <strong>Actual Cost:</strong><br>
                                    <span style="font-weight: 600; color: var(--success);">₱${request.actualCost.toLocaleString()}</span>
                                </div>
                            ` : ''}
                        </div>
                        
                        ${request.staffNotes ? `
                            <div style="margin-top: 15px;">
                                <strong>Staff Notes:</strong><br>
                                <p style="margin: 10px 0; line-height: 1.6; background: #f8f9fa; padding: 10px; border-radius: 6px;">${request.staffNotes}</p>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                <!-- Timeline -->
                <div style="background: white; padding: 20px; border-radius: 8px;">
                    <h4 style="color: var(--royal-blue); margin-bottom: 15px; border-bottom: 2px solid var(--royal-blue); padding-bottom: 8px;">
                        <i class="fas fa-history"></i> Request Timeline
                    </h4>
                    <div style="display: grid; gap: 10px;">
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <div><i class="fas fa-plus-circle" style="color: var(--success);"></i> Created</div>
                            <div style="font-weight: 600;">${createdDate.toLocaleDateString()} at ${createdDate.toLocaleTimeString()}</div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <div><i class="fas fa-sync-alt" style="color: var(--info);"></i> Last Updated</div>
                            <div style="font-weight: 600;">${updatedDate.toLocaleDateString()} at ${updatedDate.toLocaleTimeString()}</div>
                        </div>
                        
                        ${assignedDate ? `
                            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
                                <div><i class="fas fa-user-check" style="color: var(--info);"></i> Assigned</div>
                                <div style="font-weight: 600;">${assignedDate.toLocaleDateString()}</div>
                            </div>
                        ` : ''}
                        
                        ${completedDate ? `
                            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
                                <div><i class="fas fa-check-circle" style="color: var(--success);"></i> Completed</div>
                                <div style="font-weight: 600;">${completedDate.toLocaleDateString()}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Photos Section -->
                ${request.photosAttached ? `
                    <div style="background: white; padding: 20px; border-radius: 8px; margin-top: 20px;">
                        <h4 style="color: var(--royal-blue); margin-bottom: 15px; border-bottom: 2px solid var(--royal-blue); padding-bottom: 8px;">
                            <i class="fas fa-images"></i> Attached Photos
                        </h4>
                        <p style="color: var(--dark-gray); font-style: italic;">
                            Photos are attached to this request. (Photo viewing functionality coming soon)
                        </p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    async viewMaintenanceRequest(requestId) {
        try {
            console.log('🔧 Loading maintenance request:', requestId);
            
            // Show loading state
            const modalContent = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--royal-blue);"></i>
                    <p>Loading maintenance request details...</p>
                </div>
            `;

            const modal = ModalManager.openModal(modalContent, {
                title: 'Maintenance Request Details',
                showFooter: false
            });

            // Fetch maintenance request data
            const request = await DataManager.getMaintenanceRequest(requestId);
            
            if (!request) {
                ModalManager.closeModal(modal);
                this.showNotification('Maintenance request not found', 'error');
                return;
            }

            // Generate maintenance request details content
            const requestDetailsContent = this.generateMaintenanceRequestDetails(request);
            
            // Update modal content
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = requestDetailsContent;
            }

            // Add footer with action buttons
            const modalFooter = modal.querySelector('.modal-footer');
            if (!modalFooter) {
                const footer = document.createElement('div');
                footer.className = 'modal-footer';
                footer.innerHTML = `
                    <button class="btn btn-primary" onclick="ModalManager.closeModal(this.closest('.modal-overlay'))">
                        Close
                    </button>
                    ${request.status !== 'completed' ? `
                        <button class="btn btn-warning" onclick="casaLink.updateMaintenanceRequest('${request.id}')">
                            <i class="fas fa-edit"></i> Update
                        </button>
                        <button class="btn btn-success" onclick="casaLink.assignMaintenance('${request.id}')">
                            <i class="fas fa-user-check"></i> Assign Staff
                        </button>
                    ` : ''}
                `;
                modal.querySelector('.modal-content').appendChild(footer);
            }

        } catch (error) {
            console.error('❌ Error loading maintenance request:', error);
            this.showNotification('Failed to load maintenance request details', 'error');
        }
    }

    showMaintenanceError(message) {
        const errorElement = document.getElementById('maintenanceCreateError');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    async createMaintenanceRequest() {
        try {
            const tenantSelect = document.getElementById('maintenanceTenant');
            const selectedOption = tenantSelect.options[tenantSelect.selectedIndex];
            
            const requestData = {
                tenantId: tenantSelect.value,
                tenantName: selectedOption.text.split(' - ')[0],
                roomNumber: selectedOption.getAttribute('data-room'),
                landlordId: this.currentUser.uid,
                type: document.getElementById('maintenanceType').value,
                priority: document.getElementById('maintenancePriority').value,
                title: document.getElementById('maintenanceTitle').value,
                description: document.getElementById('maintenanceDescription').value,
                estimatedCost: parseFloat(document.getElementById('maintenanceCost').value) || 0,
                preferredDate: document.getElementById('maintenancePreferredDate').value,
                specialInstructions: document.getElementById('maintenanceInstructions').value,
                status: 'open',
                createdBy: this.currentUser.uid,
                createdByName: this.currentUser.name
            };

            // Validation
            if (!requestData.tenantId) {
                this.showMaintenanceError('Please select a tenant');
                return;
            }

            if (!requestData.title || !requestData.description) {
                this.showMaintenanceError('Please fill in title and description');
                return;
            }

            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
                submitBtn.disabled = true;
            }

            // Handle file uploads if any
            const photoFiles = document.getElementById('maintenancePhotos').files;
            if (photoFiles.length > 0) {
                // You can implement file upload to Firebase Storage here
                console.log('Photos to upload:', photoFiles.length);
                // For now, we'll just note that photos were attached
                requestData.photosAttached = true;
            }

            await DataManager.createMaintenanceRequest(requestData);
            
            ModalManager.closeModal(this.createMaintenanceModal);
            this.showNotification('Maintenance request created successfully!', 'success');

            // Refresh maintenance data
            setTimeout(() => {
                this.loadMaintenanceData();
                this.loadMaintenanceStats();
            }, 1000);

        } catch (error) {
            console.error('Error creating maintenance request:', error);
            this.showMaintenanceError('Failed to create request: ' + error.message);
            
            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = 'Create Request';
                submitBtn.disabled = false;
            }
        }
    }


    showMaintenanceSettings() {
        this.showNotification('Maintenance settings coming soon!', 'info');
    }


    updateMaintenanceRequest(requestId) {
        this.showNotification('Update maintenance request coming soon!', 'info');
    }

    assignMaintenance(requestId) {
        this.showNotification('Assign maintenance coming soon!', 'info');
    }

    showAssignStaffForm() {
        this.showNotification('Assign staff form coming soon!', 'info');
    }

    exportMaintenance() {
        this.showNotification('Export maintenance reports coming soon!', 'info');
    }

    showMaintenanceSchedule() {
        this.showNotification('Maintenance schedule coming soon!', 'info');
    }

    searchMaintenance(searchTerm) {
        const rows = document.querySelectorAll('.maintenance-row');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm.toLowerCase()) ? '' : 'none';
        });
    }

    filterMaintenance(filter) {
        // Implement quick filters
        console.log('Filtering maintenance by:', filter);
    }

    filterMaintenanceByStatus(status) {
        const rows = document.querySelectorAll('.maintenance-row');
        rows.forEach(row => {
            if (status === 'all') {
                row.style.display = '';
                return;
            }
            
            const statusBadge = row.querySelector('.status-badge');
            if (statusBadge && statusBadge.textContent.toLowerCase().includes(status.toLowerCase())) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    filterMaintenanceByPriority(priority) {
        const rows = document.querySelectorAll('.maintenance-row');
        rows.forEach(row => {
            if (priority === 'all') {
                row.style.display = '';
                return;
            }
            
            const priorityBadge = row.querySelector('.status-badge');
            if (priorityBadge && priorityBadge.textContent.toLowerCase().includes(priority.toLowerCase())) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    filterMaintenanceByType(type) {
        const rows = document.querySelectorAll('.maintenance-row');
        rows.forEach(row => {
            if (type === 'all') {
                row.style.display = '';
                return;
            }
            
            const typeCell = row.querySelector('td:nth-child(4)'); // Type column
            if (typeCell && typeCell.textContent.toLowerCase().includes(type.toLowerCase())) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    setupMaintenanceRowClickHandlers() {
        // Remove existing handlers first
        this.removeMaintenanceRowClickHandlers();
        
        this.maintenanceRowClickHandler = (e) => {
            const maintenanceRow = e.target.closest('.maintenance-row');
            if (maintenanceRow) {
                const requestId = maintenanceRow.getAttribute('data-request-id');
                if (requestId) {
                    this.viewMaintenanceRequest(requestId);
                }
            }
        };
        
        document.addEventListener('click', this.maintenanceRowClickHandler);
    }

    removeMaintenanceRowClickHandlers() {
        if (this.maintenanceRowClickHandler) {
            document.removeEventListener('click', this.maintenanceRowClickHandler);
            this.maintenanceRowClickHandler = null;
        }
    }

    renderMaintenanceTable(requests) {
        return `
            <div class="table-container">
                <table class="tenants-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Title</th>
                            <th>Tenant/Room</th>
                            <th>Type</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th>Assigned To</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${requests.map(request => {
                            const createdDate = new Date(request.createdAt);
                            const isUrgent = request.priority === 'high' || request.priority === 'emergency';
                            const isOverdue = request.status === 'open' && 
                                            (new Date() - createdDate) > (7 * 24 * 60 * 60 * 1000); // 7 days
                            
                            return `
                                <tr class="maintenance-row" data-request-id="${request.id}" style="cursor: pointer; ${isUrgent ? 'background: rgba(234, 67, 53, 0.05);' : ''}">
                                    <td>
                                        <small style="color: var(--dark-gray);">#${request.id.substring(0, 8)}</small>
                                    </td>
                                    <td>
                                        <div style="font-weight: 500;">${request.title}</div>
                                        <small style="color: var(--dark-gray);">${request.description.substring(0, 50)}${request.description.length > 50 ? '...' : ''}</small>
                                    </td>
                                    <td>
                                        <div>${request.tenantName || 'N/A'}</div>
                                        <small style="color: var(--dark-gray);">${request.roomNumber || 'No room'}</small>
                                    </td>
                                    <td>
                                        <span style="text-transform: capitalize;">${request.type.replace('_', ' ')}</span>
                                    </td>
                                    <td>
                                        ${this.getPriorityBadge(request.priority)}
                                    </td>
                                    <td>
                                        ${this.getStatusBadge(request.status)}
                                        ${isOverdue ? '<br><small style="color: var(--danger);">Overdue</small>' : ''}
                                    </td>
                                    <td>
                                        <div>${createdDate.toLocaleDateString()}</div>
                                        <small style="color: var(--dark-gray);">${createdDate.toLocaleTimeString()}</small>
                                    </td>
                                    <td>
                                        ${request.assignedName ? `
                                            <div>${request.assignedName}</div>
                                            <small style="color: var(--dark-gray);">Assigned</small>
                                        ` : '<span style="color: var(--dark-gray);">Not assigned</span>'}
                                    </td>
                                    <td>
                                        <div class="action-buttons">
                                            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); casaLink.viewMaintenanceRequest('${request.id}')">
                                                <i class="fas fa-eye"></i>
                                            </button>
                                            <button class="btn btn-sm btn-warning" onclick="event.stopPropagation(); casaLink.updateMaintenanceRequest('${request.id}')">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            ${request.status !== 'completed' ? `
                                                <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); casaLink.assignMaintenance('${request.id}')">
                                                    <i class="fas fa-user-check"></i>
                                                </button>
                                            ` : ''}
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }



    filterTenants(searchTerm) {
        if (!searchTerm) {
            this.tenantsFilteredData = [...this.tenantsAllData];
        } else {
            const searchLower = searchTerm.toLowerCase();
            this.tenantsFilteredData = this.tenantsAllData.filter(tenant => 
                tenant.name?.toLowerCase().includes(searchLower) ||
                tenant.email?.toLowerCase().includes(searchLower) ||
                tenant.phone?.toLowerCase().includes(searchLower) ||
                tenant.roomNumber?.toLowerCase().includes(searchLower) ||
                tenant.occupation?.toLowerCase().includes(searchLower)
            );
        }
        
        this.tenantsCurrentPage = 1;
        this.tenantsTotalPages = Math.ceil(this.tenantsFilteredData.length / this.tenantsItemsPerPage);
        this.updateTenantsTable(this.getCurrentTenantsPage());
        this.setupTenantsPagination();
    }

    async debugDashboardData() {
        console.log('🐛 DEBUG: Dashboard Data Sources');
        
        try {
            const userId = this.currentUser.uid;
            
            const [tenants, leases, bills, maintenance] = await Promise.all([
                DataManager.getTenants(userId),
                DataManager.getLandlordLeases(userId),
                DataManager.getBills(userId),
                DataManager.getMaintenanceRequests(userId)
            ]);
            
            console.log('📊 RAW DATA COUNTS:', {
                tenants: tenants.length,
                leases: leases.length,
                bills: bills.length,
                maintenance: maintenance.length
            });
            
            console.log('👥 TENANTS:', tenants);
            console.log('📄 LEASES:', leases);
            console.log('💰 BILLS:', bills);
            console.log('🔧 MAINTENANCE:', maintenance);
            
            const stats = await DataManager.getDashboardStats(userId, 'landlord');
            console.log('📈 CALCULATED STATS:', stats);
            
        } catch (error) {
            console.error('❌ Debug error:', error);
        }
    }

    exportOccupancyReport() {
        this.showNotification('Export feature coming soon!', 'info');
    }

    getExpiringLeasesCount(roomLeaseMap) {
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);
        
        let expiringCount = 0;
        
        roomLeaseMap.forEach(lease => {
            if (lease.leaseEnd) {
                const leaseEnd = new Date(lease.leaseEnd);
                if (leaseEnd >= today && leaseEnd <= thirtyDaysFromNow) {
                    expiringCount++;
                }
            }
        });
        
        return expiringCount;
    }

    getNewLeasesCount(roomLeaseMap) {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        let newLeasesCount = 0;
        
        roomLeaseMap.forEach(lease => {
            if (lease.leaseStart) {
                const leaseStart = new Date(lease.leaseStart);
                if (leaseStart >= firstDayOfMonth) {
                    newLeasesCount++;
                }
            }
        });
        
        return newLeasesCount;
    }

    generateOccupancyTable(tenants, leases, rooms) {
        console.log('📊 Generating occupancy table...');
        
        // Create a map for quick lookup: roomNumber -> lease info
        const roomLeaseMap = new Map();
        
        // Process leases to find occupied rooms
        leases.forEach(lease => {
            if (lease.isActive && lease.roomNumber) {
                // Find tenant info for this lease
                const tenant = tenants.find(t => t.id === lease.tenantId);
                roomLeaseMap.set(lease.roomNumber, {
                    tenantName: tenant?.name || lease.tenantName || 'Unknown Tenant',
                    tenantEmail: tenant?.email || lease.tenantEmail || 'No email',
                    leaseStart: lease.leaseStart,
                    leaseEnd: lease.leaseEnd,
                    status: tenant?.status || 'unknown',
                    leaseId: lease.id
                });
            }
        });

        // Sort rooms by floor and room number
        const sortedRooms = rooms.sort((a, b) => {
            const floorA = parseInt(a.roomNumber.charAt(0));
            const floorB = parseInt(b.roomNumber.charAt(0));
            if (floorA !== floorB) return floorA - floorB;
            return a.roomNumber.localeCompare(b.roomNumber);
        });

        // Calculate stats for the header
        const expiringLeases = this.getExpiringLeasesCount(roomLeaseMap);
        const newLeases = this.getNewLeasesCount(roomLeaseMap);
        const occupancyRate = Math.round((roomLeaseMap.size / sortedRooms.length) * 100);

        let tableHTML = `
            <!-- HEADER STATS SECTION -->
            <div style="margin-bottom: 25px;">
                <!-- Quick Stats and Export Row -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 20px;">
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 12px 0; color: var(--royal-blue); font-size: 1.1rem;">
                            <i class="fas fa-chart-line"></i> Quick Stats
                        </h4>
                        <div style="display: flex; gap: 25px; font-size: 0.95rem; color: var(--dark-gray);">
                            <div>
                                <span style="font-weight: 600; color: var(--royal-blue);">${expiringLeases}</span> leases expiring soon
                            </div>
                            <div>
                                <span style="font-weight: 600; color: var(--royal-blue);">${newLeases}</span> new leases this month
                            </div>
                        </div>
                    </div>
                    <div>
                        <button class="btn btn-primary" onclick="casaLink.exportOccupancyReport()" style="padding: 10px 20px; white-space: nowrap;">
                            <i class="fas fa-download"></i> Export Report
                        </button>
                    </div>
                </div>

                <!-- Status Legend -->
                <div style="padding: 15px; background: white; border-radius: 8px; border: 1px solid #e9ecef; margin-bottom: 15px;">
                    <h5 style="margin: 0 0 12px 0; color: var(--royal-blue); font-size: 0.9rem;">
                        <i class="fas fa-info-circle"></i> Status Legend
                    </h5>
                    <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 12px; height: 12px; background: var(--success); border-radius: 2px;"></div>
                            <span style="font-size: 0.85rem;">Occupied - Currently rented</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 12px; height: 12px; background: var(--danger); border-radius: 2px;"></div>
                            <span style="font-size: 0.85rem;">Vacant - Available for rent</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 12px; height: 12px; background: var(--warning); border-radius: 2px;"></div>
                            <span style="font-size: 0.85rem;">Unavailable - Under maintenance</span>
                        </div>
                    </div>
                </div>

                <!-- Summary Cards -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div style="text-align: center; padding: 20px; background: white; border-radius: 10px; border-left: 4px solid var(--success); box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="font-size: 2.2rem; font-weight: 700; color: var(--success);">${roomLeaseMap.size}</div>
                        <div style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500;">Occupied Units</div>
                    </div>
                    <div style="text-align: center; padding: 20px; background: white; border-radius: 10px; border-left: 4px solid var(--danger); box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="font-size: 2.2rem; font-weight: 700; color: var(--danger);">${sortedRooms.length - roomLeaseMap.size}</div>
                        <div style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500;">Vacant Units</div>
                    </div>
                    <div style="text-align: center; padding: 20px; background: white; border-radius: 10px; border-left: 4px solid var(--royal-blue); box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="font-size: 2.2rem; font-weight: 700; color: var(--royal-blue);">${sortedRooms.length}</div>
                        <div style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500;">Total Units</div>
                    </div>
                    <div style="text-align: center; padding: 20px; background: white; border-radius: 10px; border-left: 4px solid var(--warning); box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="font-size: 2.2rem; font-weight: 700; color: var(--warning);">${occupancyRate}%</div>
                        <div style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500;">Occupancy Rate</div>
                    </div>
                </div>
            </div>

            <!-- MAIN TABLE -->
            <div style="max-height: 500px; overflow-y: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; min-width: 1000px;">
                    <thead>
                        <tr style="background-color: #f8f9fa; position: sticky; top: 0;">
                            <th style="padding: 15px; text-align: left; border-bottom: 2px solid #e9ecef; min-width: 80px;">Unit</th>
                            <th style="padding: 15px; text-align: left; border-bottom: 2px solid #e9ecef; min-width: 100px;">Status</th>
                            <th style="padding: 15px; text-align: left; border-bottom: 2px solid #e9ecef; min-width: 150px;">Occupant</th>
                            <th style="padding: 15px; text-align: left; border-bottom: 2px solid #e9ecef; min-width: 200px;">Email</th>
                            <th style="padding: 15px; text-align: left; border-bottom: 2px solid #e9ecef; min-width: 120px;">Lease Start</th>
                            <th style="padding: 15px; text-align: left; border-bottom: 2px solid #e9ecef; min-width: 120px;">Lease End</th>
                            <th style="padding: 15px; text-align: left; border-bottom: 2px solid #e9ecef; min-width: 100px;">Days Remaining</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        sortedRooms.forEach(room => {
            const leaseInfo = roomLeaseMap.get(room.roomNumber);
            const isOccupied = !!leaseInfo;
            const isAvailable = room.isAvailable !== false;
            
            let status = 'Vacant';
            let statusColor = 'var(--danger)';
            let occupantName = '-';
            let occupantEmail = '-';
            let leaseStart = '-';
            let leaseEnd = '-';
            let daysRemaining = '-';
            
            if (isOccupied) {
                status = 'Occupied';
                statusColor = 'var(--success)';
                occupantName = leaseInfo.tenantName;
                occupantEmail = leaseInfo.tenantEmail;
                
                // Format lease dates
                if (leaseInfo.leaseStart) {
                    leaseStart = new Date(leaseInfo.leaseStart).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                }
                
                if (leaseInfo.leaseEnd) {
                    leaseEnd = new Date(leaseInfo.leaseEnd).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                    
                    // Calculate days remaining
                    const today = new Date();
                    const endDate = new Date(leaseInfo.leaseEnd);
                    const timeDiff = endDate - today;
                    const daysRemainingCount = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
                    
                    if (daysRemainingCount > 0) {
                        daysRemaining = `<span style="color: var(--success); font-weight: 600;">${daysRemainingCount} days</span>`;
                    } else if (daysRemainingCount === 0) {
                        daysRemaining = `<span style="color: var(--warning); font-weight: 600;">Ends today</span>`;
                    } else {
                        daysRemaining = `<span style="color: var(--danger); font-weight: 600;">${Math.abs(daysRemainingCount)} days overdue</span>`;
                    }
                }
            } else if (!isAvailable) {
                status = 'Unavailable';
                statusColor = 'var(--warning)';
            }

            tableHTML += `
                <tr style="border-bottom: 1px solid #e9ecef;">
                    <td style="padding: 15px; font-weight: 600;">
                        <span style="font-size: 1.1rem;">${room.roomNumber}</span>
                    </td>
                    <td style="padding: 15px;">
                        <span style="color: ${statusColor}; font-weight: 600; padding: 6px 12px; border-radius: 20px; background: ${statusColor}15; border: 1px solid ${statusColor}30;">
                            ${status}
                        </span>
                    </td>
                    <td style="padding: 15px;">
                        <div style="font-weight: 500;">${occupantName}</div>
                        ${isOccupied ? `<small style="color: var(--dark-gray); font-size: 0.8rem;">${leaseInfo.status || 'No status'}</small>` : ''}
                    </td>
                    <td style="padding: 15px;">
                        <div style="color: var(--dark-gray); font-size: 0.85rem; word-break: break-word;">${occupantEmail}</div>
                    </td>
                    <td style="padding: 15px;">
                        <div style="font-size: 0.85rem; color: var(--royal-blue); font-weight: 500;">${leaseStart}</div>
                    </td>
                    <td style="padding: 15px;">
                        <div style="font-size: 0.85rem; color: var(--royal-blue); font-weight: 500;">${leaseEnd}</div>
                    </td>
                    <td style="padding: 15px;">
                        <div style="font-size: 0.85rem; font-weight: 500;">${daysRemaining}</div>
                    </td>
                </tr>
            `;
        });

        tableHTML += `
                    </tbody>
                </table>
            </div>
        `;

        return tableHTML;
    }

    async getAllRooms() {
        try {
            console.log('🔄 Fetching all rooms...');
            
            const roomsSnapshot = await firebaseDb.collection('rooms').get();
            
            if (roomsSnapshot.empty) {
                console.log('📦 No rooms found, creating default rooms...');
                return await this.createDefaultRooms();
            }
            
            const rooms = roomsSnapshot.docs.map(doc => ({
                id: doc.id,
                roomNumber: doc.id,
                ...doc.data()
            }));
            
            console.log(`✅ Found ${rooms.length} rooms`);
            return rooms;
            
        } catch (error) {
            console.error('❌ Error fetching rooms:', error);
            return await this.createDefaultRooms();
        }
    }

    async showUnitOccupancyModal() {
        if (!this.debounceModalOpen(() => this.showUnitOccupancyModal())) return;
        
        try {
            console.log('🏠 Loading unit occupancy data...');
            
            // Show loading state
            const modalContent = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--royal-blue);"></i>
                    <p>Loading unit occupancy data...</p>
                </div>
            `;

            const modal = ModalManager.openModal(modalContent, {
                title: 'Unit Occupancy Overview',
                showFooter: false,
                width: '95%',
                maxWidth: '1400px'
            });

            // Apply custom width to the modal content
            const modalContentElement = modal.querySelector('.modal-content');
            if (modalContentElement) {
                modalContentElement.style.maxWidth = '1400px';
                modalContentElement.style.width = '95%';
            }

            // Fetch all necessary data
            const [tenants, leases, rooms] = await Promise.all([
                DataManager.getTenants(this.currentUser.uid),
                DataManager.getLandlordLeases(this.currentUser.uid),
                this.getAllRooms()
            ]);

            console.log('📊 Occupancy data loaded:', {
                tenants: tenants.length,
                leases: leases.length,
                rooms: rooms.length
            });

            // Generate the occupancy table
            const occupancyTable = this.generateOccupancyTable(tenants, leases, rooms);
            
            // Update modal content with the table
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = occupancyTable;
            }

            // Add footer with close button
            const modalFooter = modal.querySelector('.modal-footer');
            if (!modalFooter) {
                const footer = document.createElement('div');
                footer.className = 'modal-footer';
                footer.innerHTML = `
                    <button class="btn btn-primary" onclick="ModalManager.closeModal(this.closest('.modal-overlay'))">
                        Close
                    </button>
                `;
                modal.querySelector('.modal-content').appendChild(footer);
            }

        } catch (error) {
            console.error('❌ Error loading unit occupancy data:', error);
            this.showNotification('Failed to load unit occupancy data', 'error');
        }
    }

    switchBillingView(view) {
        console.log('🔄 Switching billing view to:', view);
        
        // Update view buttons
        document.querySelectorAll('.view-switch-button').forEach(button => {
            button.classList.remove('active');
            if (button.getAttribute('data-view') === view) {
                button.classList.add('active');
            }
        });
        
        // Update view contents
        document.querySelectorAll('.billing-view-content').forEach(content => {
            content.classList.remove('active');
            if (content.id === view + 'View') {
                content.classList.add('active');
            }
        });
        
        this.currentBillingView = view;
        
        // Load data for the selected view with pagination
        this.loadBillingViewData(view);
    }

    loadBillingViewData(view) {
        console.log('📊 Loading data for view:', view);
        
        switch (view) {
            case 'bills':
                this.loadBillsData();
                this.loadBillingStats();
                break;
            case 'payments':
                this.loadPaymentsData();
                this.loadPaymentStats();
                break;
        }
    }

    updateViewBadges(bills, payments) {
        const billsViewCount = document.getElementById('billsViewCount');
        const paymentsViewCount = document.getElementById('paymentsViewCount');
        
        if (billsViewCount) {
            billsViewCount.textContent = bills.length.toString();
        }
        
        if (paymentsViewCount) {
            paymentsViewCount.textContent = payments.length.toString();
        }
        
        console.log('📊 View badges updated:', {
            bills: bills.length,
            payments: payments.length
        });
    }

    


    setupBillingPage() {
        try {
            console.log('🔄 Setting up billing page with view:', this.currentBillingView);
            
            // Set default view if not set
            if (!this.currentBillingView) {
                this.currentBillingView = 'bills';
            }
            
            // Load initial view data
            this.loadBillingViewData(this.currentBillingView);
            
            // Setup bills search and filters
            document.getElementById('billSearch')?.addEventListener('input', (e) => {
                this.searchBills(e.target.value);
            });
            
            document.getElementById('billStatusFilter')?.addEventListener('change', (e) => {
                this.filterBills(e.target.value);
            });
            
            // Setup payments search and filters
            document.getElementById('paymentSearch')?.addEventListener('input', (e) => {
                this.searchPayments(e.target.value);
            });
            
            document.getElementById('paymentMethodFilter')?.addEventListener('change', (e) => {
                this.filterPaymentsByMethod(e.target.value);
            });
            
            document.getElementById('paymentDateFilter')?.addEventListener('change', (e) => {
                this.filterPaymentsByDate(e.target.value);
            });
            
            // Setup row click handlers
            this.setupBillRowClickHandlers();
            this.setupPaymentRowClickHandlers();  // ← newly added
            
            console.log('✅ Billing page setup complete with pagination');
            
        } catch (error) {
            console.error('❌ Error setting up billing page:', error);
            this.showNotification('Failed to load billing data', 'error');
        }
    }

    getNotificationIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

     showNotification(message, type = 'info', duration = 5000) {
        // Check if NotificationManager exists
        if (window.NotificationManager && typeof NotificationManager.show === 'function') {
            NotificationManager.show(message, type, duration);
            return;
        }
        
        // Fallback notification system
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${getNotificationIcon(type)}"></i>
                <span>${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Add styles if they don't exist
        if (!document.querySelector('#notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: white;
                    border-radius: 8px;
                    padding: 15px 20px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    border-left: 4px solid #3498db;
                    z-index: 10000;
                    max-width: 400px;
                    animation: slideInRight 0.3s ease;
                }
                
                .notification-success { border-left-color: #27ae60; }
                .notification-error { border-left-color: #e74c3c; }
                .notification-warning { border-left-color: #f39c12; }
                .notification-info { border-left-color: #3498db; }
                
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .notification-close {
                    background: none;
                    border: none;
                    color: #7f8c8d;
                    cursor: pointer;
                    padding: 5px;
                    margin-left: auto;
                }
                
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(notification);
        
        // Auto remove after duration
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, duration);
    }



    showRefundModal() {
        this.showNotification('Refund processing feature coming soon!', 'info');
    }

    exportPayments() {
        this.showNotification('Export payments feature coming soon!', 'info');
    }

    getEmptyPaymentsState() {
        return `
            <div class="empty-state">
                <i class="fas fa-money-check"></i>
                <h3>No Payments Found</h3>
                <p>No payment records found yet.</p>
            </div>
        `;
    }

    updatePaymentsTable(payments) {
        const paymentsList = document.getElementById('paymentsList');
        if (!paymentsList) return;
        
        if (payments.length === 0) {
            paymentsList.innerHTML = this.getEmptyPaymentsState();
            document.getElementById('paymentsPagination').style.display = 'none';
            return;
        }
        
        paymentsList.innerHTML = this.renderPaymentsTable(payments);
        this.updatePaymentsPaginationInfo();
        
        setTimeout(() => this.setupPaymentRowStyles(), 100);
    }

    updatePaymentsPaginationInfo() {
        const infoElement = document.getElementById('paymentsPaginationInfo');
        if (infoElement) {
            const startItem = (this.paymentsCurrentPage - 1) * this.paymentsItemsPerPage + 1;
            const endItem = Math.min(this.paymentsCurrentPage * this.paymentsItemsPerPage, this.paymentsFilteredData.length);
            infoElement.textContent = `Showing ${startItem}-${endItem} of ${this.paymentsFilteredData.length} payments`;
        }
    }

    renderPaymentsTable(payments) {
        return `
            <div class="table-container">
                <table class="tenants-table">
                    <thead>
                        <tr>
                            <th>Tenant</th>
                            <th>Room</th>
                            <th>Amount</th>
                            <th>Method</th>
                            <th>Date</th>
                            <th>Reference</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${payments.map(payment => {
                            const paymentDate = new Date(payment.paymentDate || payment.createdAt);
                            return `
                                <tr class="payment-row" data-payment-id="${payment.id}" style="cursor: pointer;">
                                    <td>
                                        <div class="tenant-info">
                                            <div class="tenant-avatar">${payment.tenantName?.charAt(0)?.toUpperCase() || 'T'}</div>
                                            <div class="tenant-name">${payment.tenantName || 'N/A'}</div>
                                        </div>
                                    </td>
                                    <td>${payment.roomNumber || 'N/A'}</td>
                                    <td style="font-weight: 600; color: var(--success);">
                                        ₱${(payment.amount || 0).toLocaleString()}
                                    </td>
                                    <td class="payment-method">
                                        <span style="text-transform: capitalize;">${payment.paymentMethod || 'cash'}</span>
                                    </td>
                                    <td>${paymentDate.toLocaleDateString()}</td>
                                    <td>
                                        <small style="color: var(--dark-gray);">${payment.referenceNumber || 'N/A'}</small>
                                    </td>
                                    <td>
                                        <span class="status-badge active">Completed</span>
                                    </td>
                                    <td>
                                        <div class="action-buttons">
                                            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); casaLink.showPaymentDetailsModal('${payment.id}')">
                                                <i class="fas fa-eye"></i>
                                            </button>
                                            <button class="btn btn-sm btn-warning" onclick="event.stopPropagation(); casaLink.showRefundModal('${payment.id}')">
                                                <i class="fas fa-undo"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    filterPayments(timeRange) {
        const rows = document.querySelectorAll('#paymentsList tbody tr');
        const today = new Date();
        
        rows.forEach(row => {
            const dateCell = row.querySelector('td:nth-child(5)');
            if (!dateCell) {
                row.style.display = 'none';
                return;
            }
            
            const paymentDate = new Date(dateCell.textContent);
            
            switch(timeRange) {
                case 'today':
                    row.style.display = paymentDate.toDateString() === today.toDateString() ? '' : 'none';
                    break;
                case 'week':
                    const weekAgo = new Date(today);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    row.style.display = paymentDate >= weekAgo ? '' : 'none';
                    break;
                case 'month':
                    const monthAgo = new Date(today);
                    monthAgo.setMonth(monthAgo.getMonth() - 1);
                    row.style.display = paymentDate >= monthAgo ? '' : 'none';
                    break;
                default:
                    row.style.display = '';
            }
        });
    }

    filterPaymentsByDate(dateFilter) {
        if (!dateFilter) {
            this.paymentsFilteredData = [...this.paymentsAllData];
        } else {
            const [year, month] = dateFilter.split('-');
            this.paymentsFilteredData = this.paymentsAllData.filter(payment => {
                const paymentDate = new Date(payment.paymentDate || payment.createdAt);
                return paymentDate.getFullYear() == year && 
                    (paymentDate.getMonth() + 1) == month;
            });
        }
        
        this.paymentsCurrentPage = 1;
        this.paymentsTotalPages = Math.ceil(this.paymentsFilteredData.length / this.paymentsItemsPerPage);
        this.updatePaymentsTable(this.getCurrentPaymentsPage());
        this.setupPaymentsPagination();
    }

    filterPaymentsByStatus(status) {
        const rows = document.querySelectorAll('#paymentsList tbody tr');
        rows.forEach(row => {
            if (status === 'all') {
                row.style.display = '';
                return;
            }
            
            const statusBadge = row.querySelector('.status-badge');
            if (statusBadge) {
                const paymentStatus = statusBadge.textContent.toLowerCase();
                if (paymentStatus.includes(status.toLowerCase())) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            }
        });
    }

    filterPaymentsByMethod(method) {
        if (method === 'all') {
            this.paymentsFilteredData = [...this.paymentsAllData];
        } else {
            this.paymentsFilteredData = this.paymentsAllData.filter(payment => 
                payment.paymentMethod?.toLowerCase().includes(method.toLowerCase())
            );
        }
        
        this.paymentsCurrentPage = 1;
        this.paymentsTotalPages = Math.ceil(this.paymentsFilteredData.length / this.paymentsItemsPerPage);
        this.updatePaymentsTable(this.getCurrentPaymentsPage());
        this.setupPaymentsPagination();
    }

    searchPayments(searchTerm) {
        if (!searchTerm) {
            this.paymentsFilteredData = [...this.paymentsAllData];
        } else {
            const searchLower = searchTerm.toLowerCase();
            this.paymentsFilteredData = this.paymentsAllData.filter(payment => 
                payment.tenantName?.toLowerCase().includes(searchLower) ||
                payment.roomNumber?.toLowerCase().includes(searchLower) ||
                payment.paymentMethod?.toLowerCase().includes(searchLower) ||
                payment.referenceNumber?.toLowerCase().includes(searchLower)
            );
        }
        
        this.paymentsCurrentPage = 1;
        this.paymentsTotalPages = Math.ceil(this.paymentsFilteredData.length / this.paymentsItemsPerPage);
        this.updatePaymentsTable(this.getCurrentPaymentsPage());
        this.setupPaymentsPagination();
    }

    async showPaymentDetailsModal(paymentId) {
        try {
            console.log('💰 Loading payment details for:', paymentId);
            
            // Show loading state
            const modalContent = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--royal-blue);"></i>
                    <p>Loading payment details...</p>
                </div>
            `;

            const modal = ModalManager.openModal(modalContent, {
                title: 'Payment Details',
                showFooter: false
            });

            // Fetch payment data
            const paymentDoc = await firebaseDb.collection('payments').doc(paymentId).get();
            
            if (!paymentDoc.exists) {
                ModalManager.closeModal(modal);
                this.showNotification('Payment not found', 'error');
                return;
            }

            const payment = { id: paymentDoc.id, ...paymentDoc.data() };
            
            // Generate payment details content
            const paymentDetailsContent = this.generatePaymentDetailsContent(payment);
            
            // Update modal content
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = paymentDetailsContent;
            }

            // Add footer with close button
            const modalFooter = modal.querySelector('.modal-footer');
            if (!modalFooter) {
                const footer = document.createElement('div');
                footer.className = 'modal-footer';
                footer.innerHTML = `
                    <button class="btn btn-primary" onclick="ModalManager.closeModal(this.closest('.modal-overlay'))">
                        Close
                    </button>
                    <button class="btn btn-warning" onclick="casaLink.showRefundModal('${payment.id}')">
                        <i class="fas fa-undo"></i> Process Refund
                    </button>
                `;
                modal.querySelector('.modal-content').appendChild(footer);
            }

        } catch (error) {
            console.error('❌ Error loading payment details:', error);
            this.showNotification('Failed to load payment details', 'error');
        }
    }

    setupPaymentRowStyles() {
        const paymentRows = document.querySelectorAll('.payment-row');
        paymentRows.forEach(row => {
            // Add hover effects
            row.style.cursor = 'pointer';
            row.style.transition = 'all 0.3s ease';
            
            row.addEventListener('mouseenter', () => {
                row.style.backgroundColor = 'rgba(52, 168, 83, 0.08)';
                row.style.transform = 'translateY(-1px)';
            });
            
            row.addEventListener('mouseleave', () => {
                row.style.backgroundColor = '';
                row.style.transform = '';
            });
        });
    }

    formatPaymentMethod(method) {
        const methodMap = {
            'cash': 'Cash',
            'gcash': 'GCash',
            'maya': 'Maya',
            'bank_transfer': 'Bank Transfer',
            'check': 'Check'
        };
        return methodMap[method] || method.charAt(0).toUpperCase() + method.slice(1);
    }

    generatePaymentDetailsContent(payment) {
        const paymentDate = new Date(payment.paymentDate || payment.createdAt);
        const processedDate = new Date(payment.processedAt || payment.createdAt);
        
        // Get associated bill details if available
        const billAmount = payment.billAmount || payment.amount;
        const amountPaid = payment.amount;
        const change = amountPaid - billAmount;
        
        // Format payment method with icon
        const paymentMethodIcons = {
            'cash': 'fas fa-money-bill',
            'gcash': 'fas fa-mobile-alt',
            'maya': 'fas fa-wallet',
            'bank_transfer': 'fas fa-university',
            'check': 'fas fa-money-check'
        };
        
        const paymentIcon = paymentMethodIcons[payment.paymentMethod] || 'fas fa-credit-card';

        return `
            <div class="payment-details-modal" style="max-height: 70vh; overflow-y: auto;">
                <!-- Payment Header -->
                <div style="background: linear-gradient(135deg, var(--success), #2ecc71); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h3 style="margin: 0 0 5px 0;">Payment Received</h3>
                            <p style="margin: 0; opacity: 0.9;">Transaction #${payment.id.substring(0, 8)}</p>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 1.8rem; font-weight: 700;">₱${(payment.amount || 0).toLocaleString()}</div>
                            <div style="opacity: 0.9;">Amount Paid</div>
                        </div>
                    </div>
                </div>

                <!-- Payment Information Grid -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid var(--success);">
                        <div style="font-size: 0.9rem; color: var(--dark-gray); margin-bottom: 5px;">Status</div>
                        <div style="font-size: 1.1rem; font-weight: 600; color: var(--success);">
                            <span class="status-badge active">Completed</span>
                        </div>
                    </div>
                    
                    <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid var(--info);">
                        <div style="font-size: 0.9rem; color: var(--dark-gray); margin-bottom: 5px;">Payment Method</div>
                        <div style="font-size: 1.1rem; font-weight: 600; color: var(--info);">
                            <i class="${paymentIcon}"></i> ${this.formatPaymentMethod(payment.paymentMethod)}
                        </div>
                    </div>
                    
                    <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid var(--warning);">
                        <div style="font-size: 0.9rem; color: var(--dark-gray); margin-bottom: 5px;">Payment Date</div>
                        <div style="font-size: 1.1rem; font-weight: 600; color: var(--warning);">
                            ${paymentDate.toLocaleDateString()}
                        </div>
                        <div style="font-size: 0.8rem; margin-top: 5px;">${paymentDate.toLocaleTimeString()}</div>
                    </div>
                </div>

                <!-- Tenant Information -->
                <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: var(--royal-blue); margin-bottom: 15px; border-bottom: 2px solid var(--royal-blue); padding-bottom: 8px;">
                        <i class="fas fa-user"></i> Tenant Information
                    </h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <strong>Tenant Name:</strong><br>
                            ${payment.tenantName || 'N/A'}
                        </div>
                        <div>
                            <strong>Room Number:</strong><br>
                            ${payment.roomNumber || 'N/A'}
                        </div>
                    </div>
                </div>

                <!-- Payment Breakdown -->
                <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: var(--royal-blue); margin-bottom: 15px; border-bottom: 2px solid var(--royal-blue); padding-bottom: 8px;">
                        <i class="fas fa-receipt"></i> Payment Breakdown
                    </h4>
                    
                    <div style="display: grid; gap: 10px;">
                        ${payment.billAmount ? `
                            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
                                <div>Bill Amount:</div>
                                <div style="font-weight: 600;">₱${(payment.billAmount || 0).toLocaleString()}</div>
                            </div>
                        ` : ''}
                        
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <div>Amount Paid:</div>
                            <div style="font-weight: 600; color: var(--success);">₱${(payment.amount || 0).toLocaleString()}</div>
                        </div>
                        
                        ${change > 0 ? `
                            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
                                <div>Change:</div>
                                <div style="font-weight: 600; color: var(--warning);">₱${change.toLocaleString()}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Transaction Details -->
                <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: var(--royal-blue); margin-bottom: 15px; border-bottom: 2px solid var(--royal-blue); padding-bottom: 8px;">
                        <i class="fas fa-info-circle"></i> Transaction Details
                    </h4>
                    <div style="display: grid; gap: 10px;">
                        ${payment.referenceNumber ? `
                            <div style="display: flex; justify-content: space-between;">
                                <div><strong>Reference Number:</strong></div>
                                <div>${payment.referenceNumber}</div>
                            </div>
                        ` : ''}
                        
                        <div style="display: flex; justify-content: space-between;">
                            <div><strong>Processed Date:</strong></div>
                            <div>${processedDate.toLocaleDateString()} at ${processedDate.toLocaleTimeString()}</div>
                        </div>
                        
                        ${payment.billId ? `
                            <div style="display: flex; justify-content: space-between;">
                                <div><strong>Bill ID:</strong></div>
                                <div>${payment.billId.substring(0, 8)}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Notes Section -->
                ${payment.notes ? `
                    <div style="background: rgba(251, 188, 4, 0.1); padding: 20px; border-radius: 8px; border-left: 4px solid var(--warning);">
                        <h4 style="color: var(--warning); margin-bottom: 10px;">
                            <i class="fas fa-sticky-note"></i> Payment Notes
                        </h4>
                        <p style="margin: 0; line-height: 1.6;">${payment.notes}</p>
                    </div>
                ` : ''}

                <!-- Payment Metadata -->
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; font-size: 0.9rem; color: var(--dark-gray);">
                    <strong>Payment Metadata:</strong><br>
                    • Payment ID: ${payment.id}<br>
                    • Recorded by: ${payment.recordedBy || 'System'}<br>
                    • ${payment.processedAt ? 'Automatically processed' : 'Manually recorded'}
                </div>
            </div>
        `;
    }


    removePaymentRowClickHandlers() {
        if (this.paymentRowClickHandler) {
            document.removeEventListener('click', this.paymentRowClickHandler);
            this.paymentRowClickHandler = null;
        }
    }


    setupPaymentRowClickHandlers() {
        // Remove existing handlers first
        this.removePaymentRowClickHandlers();
        
        this.paymentRowClickHandler = (e) => {
            const paymentRow = e.target.closest('.payment-row');
            if (paymentRow) {
                const paymentId = paymentRow.getAttribute('data-payment-id');
                if (paymentId) {
                    this.showPaymentDetailsModal(paymentId);
                }
            }
        };
        
        document.addEventListener('click', this.paymentRowClickHandler);
    }


    debugEventPropagation() {
        const contentArea = document.getElementById('contentArea');
        if (contentArea) {
            contentArea.addEventListener('click', (e) => {
                console.log('🔍 Click event path:', e.composedPath());
                console.log('🔍 Click target:', e.target);
                console.log('🔍 Current page:', this.currentPage);
            }, true); // Use capture phase to see all events
        }
    }

    getDefaultBedrooms(roomNumber) {
        if (!roomNumber) return 1;
        
        if (roomNumber.startsWith('1')) return 1;
        if (roomNumber.startsWith('2')) return roomNumber.includes('A') || roomNumber.includes('B') ? 1 : 2;
        if (roomNumber.startsWith('3') || roomNumber.startsWith('4')) return roomNumber.includes('A') || roomNumber.includes('B') ? 2 : 3;
        if (roomNumber.startsWith('5')) return 3;
        
        return 1; // Default fallback
    }

    getDefaultBathrooms(roomNumber) {
        if (!roomNumber) return 1;
        
        if (roomNumber.startsWith('1')) return 1;
        if (roomNumber.startsWith('2')) return 1;
        if (roomNumber.startsWith('3') || roomNumber.startsWith('4')) return roomNumber.includes('A') || roomNumber.includes('B') ? 1 : 2;
        if (roomNumber.startsWith('5')) return 2;
        
        return 1; // Default fallback
    }

    generateVacantUnitsTable(tenants, leases, rooms) {
        console.log('📊 Generating vacant units table...');
        
        // Create a map for quick lookup: roomNumber -> isOccupied
        const occupiedRooms = new Set();
        
        // Process leases to find occupied rooms
        leases.forEach(lease => {
            if (lease.isActive && lease.roomNumber) {
                occupiedRooms.add(lease.roomNumber);
            }
        });

        // Filter vacant and available rooms
        const vacantRooms = rooms.filter(room => 
            !occupiedRooms.has(room.roomNumber) && 
            room.isAvailable !== false
        );

        // Sort vacant rooms by floor and room number
        const sortedVacantRooms = vacantRooms.sort((a, b) => {
            const floorA = parseInt(a.roomNumber.charAt(0));
            const floorB = parseInt(b.roomNumber.charAt(0));
            if (floorA !== floorB) return floorA - floorB;
            return a.roomNumber.localeCompare(b.roomNumber);
        });

        if (sortedVacantRooms.length === 0) {
            return `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-door-closed" style="font-size: 3rem; color: var(--dark-gray); margin-bottom: 20px;"></i>
                    <h3>No Vacant Units</h3>
                    <p>All units are currently occupied. Great job!</p>
                </div>
            `;
        }

        let tableHTML = `
            <!-- HEADER INFO SECTION AT THE TOP -->
            <div style="margin-bottom: 25px;">
                <!-- Vacant Units Info -->
                <div style="padding: 20px; background: rgba(52, 168, 83, 0.1); border-radius: 12px; border-left: 4px solid var(--success); margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4 style="margin: 0 0 8px 0; color: var(--success); font-size: 1.2rem;">
                                <i class="fas fa-home"></i> ${sortedVacantRooms.length} Vacant Units Available
                            </h4>
                            <p style="margin: 0; color: var(--dark-gray); font-size: 0.95rem;">
                                Ready for new tenants - Click below to add a tenant to any available unit
                            </p>
                        </div>
                        <button class="btn btn-primary" onclick="casaLink.showAddTenantForm()" style="padding: 12px 20px; font-weight: 600;">
                            <i class="fas fa-user-plus"></i> Add New Tenant
                        </button>
                    </div>
                </div>
                
                <!-- Security Deposit Note -->
                <div style="padding: 15px; background: #f8f9fa; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e9ecef;">
                    <div style="display: flex; align-items: flex-start; gap: 10px;">
                        <i class="fas fa-info-circle" style="color: var(--royal-blue); margin-top: 2px;"></i>
                        <div style="font-size: 0.9rem; color: var(--dark-gray);">
                            <strong>Note:</strong> Security deposit is typically equal to one month's rent and is refundable after the lease term, provided the unit is returned in good condition.
                        </div>
                    </div>
                </div>
                
                <!-- Room Type Guide -->
                <div style="padding: 20px; background: linear-gradient(135deg, var(--powder-blue) 0%, #e3f2fd 100%); border-radius: 12px; border: 2px solid var(--royal-blue);">
                    <h4 style="margin: 0 0 15px 0; color: var(--royal-blue); font-size: 1rem; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-home"></i> Room Type Guide
                    </h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; font-size: 0.9rem;">
                        <div><strong>1-Bedroom:</strong> Compact units, ideal for singles</div>
                        <div><strong>2-Bedroom:</strong> Perfect for couples or roommates</div>
                        <div><strong>3-Bedroom:</strong> Family-sized units</div>
                        <div><strong>1-Bathroom:</strong> Standard configuration</div>
                        <div><strong>2-Bathroom:</strong> Master bedroom with ensuite</div>
                    </div>
                </div>
            </div>

            <!-- MAIN TABLE -->
            <div style="max-height: 500px; overflow-y: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; min-width: 800px;">
                    <thead>
                        <tr style="background-color: #f8f9fa; position: sticky; top: 0;">
                            <th style="padding: 15px; text-align: left; border-bottom: 2px solid #e9ecef; min-width: 80px;">Unit</th>
                            <th style="padding: 15px; text-align: left; border-bottom: 2px solid #e9ecef; min-width: 80px;">Floor</th>
                            <th style="padding: 15px; text-align: left; border-bottom: 2px solid #e9ecef; min-width: 120px;">Monthly Rent</th>
                            <th style="padding: 15px; text-align: left; border-bottom: 2px solid #e9ecef; min-width: 130px;">Security Deposit</th>
                            <th style="padding: 15px; text-align: center; border-bottom: 2px solid #e9ecef; min-width: 100px;">Bedrooms</th>
                            <th style="padding: 15px; text-align: center; border-bottom: 2px solid #e9ecef; min-width: 100px;">Bathrooms</th>
                            <th style="padding: 15px; text-align: center; border-bottom: 2px solid #e9ecef; min-width: 120px;">Max Members</th>
                            <th style="padding: 15px; text-align: center; border-bottom: 2px solid #e9ecef; min-width: 100px;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        sortedVacantRooms.forEach(room => {
            const monthlyRent = room.monthlyRent || 0;
            const securityDeposit = room.securityDeposit || monthlyRent;
            const maxMembers = room.maxMembers || 1;
            const floor = room.floor || room.roomNumber.charAt(0);
            
            // Get bedroom and bathroom counts with fallbacks
            const bedrooms = room.numberOfBedrooms || this.getDefaultBedrooms(room.roomNumber);
            const bathrooms = room.numberOfBathrooms || this.getDefaultBathrooms(room.roomNumber);
            
            tableHTML += `
                <tr style="border-bottom: 1px solid #e9ecef;">
                    <td style="padding: 15px; font-weight: 500;">
                        <strong style="font-size: 1.1rem;">${room.roomNumber}</strong>
                    </td>
                    <td style="padding: 15px;">
                        <span style="background: var(--light-gray); padding: 6px 12px; border-radius: 6px; font-weight: 500;">
                            Floor ${floor}
                        </span>
                    </td>
                    <td style="padding: 15px; font-weight: 600; color: var(--success);">
                        ₱${monthlyRent.toLocaleString()}
                    </td>
                    <td style="padding: 15px; color: var(--warning); font-weight: 500;">
                        ₱${securityDeposit.toLocaleString()}
                    </td>
                    <td style="padding: 15px; text-align: center;">
                        <span style="background: var(--powder-blue); color: var(--royal-blue); padding: 8px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; border: 2px solid var(--royal-blue); display: inline-block; min-width: 80px;">
                            <i class="fas fa-bed" style="margin-right: 5px;"></i>
                            ${bedrooms} ${bedrooms === 1 ? 'Bedroom' : 'Bedrooms'}
                        </span>
                    </td>
                    <td style="padding: 15px; text-align: center;">
                        <span style="background: var(--warm-beige); color: #8B4513; padding: 8px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; border: 2px solid #8B4513; display: inline-block; min-width: 80px;">
                            <i class="fas fa-bath" style="margin-right: 5px;"></i>
                            ${bathrooms} ${bathrooms === 1 ? 'Bathroom' : 'Bathrooms'}
                        </span>
                    </td>
                    <td style="padding: 15px; text-align: center;">
                        <span style="background: rgba(52, 168, 83, 0.1); color: var(--success); padding: 8px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; border: 2px solid var(--success); display: inline-block; min-width: 90px;">
                            <i class="fas fa-users" style="margin-right: 5px;"></i>
                            ${maxMembers} ${maxMembers === 1 ? 'person' : 'people'}
                        </span>
                    </td>
                    <td style="padding: 15px; text-align: center;">
                        <span style="color: var(--success); font-weight: 600; font-size: 0.9rem;">
                            <i class="fas fa-check-circle" style="margin-right: 5px;"></i> Available
                        </span>
                    </td>
                </tr>
            `;
        });

        tableHTML += `
                    </tbody>
                </table>
            </div>
        `;

        return tableHTML;
    }

    async showVacantUnitsModal() {
        if (!this.debounceModalOpen(() => this.showVacantUnitsModal())) return;
        
        try {
            console.log('🚪 Loading vacant units data...');
            
            // Show loading state
            const modalContent = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--royal-blue);"></i>
                    <p>Loading vacant units...</p>
                </div>
            `;

            const modal = ModalManager.openModal(modalContent, {
                title: 'Vacant Units Available',
                showFooter: false,
                width: '90%',
                maxWidth: '1200px'
            });

            // Apply custom width to the modal content
            const modalContentElement = modal.querySelector('.modal-content');
            if (modalContentElement) {
                modalContentElement.style.maxWidth = '1200px';
                modalContentElement.style.width = '90%';
            }

            // Fetch all necessary data
            const [tenants, leases, rooms] = await Promise.all([
                DataManager.getTenants(this.currentUser.uid),
                DataManager.getLandlordLeases(this.currentUser.uid),
                this.getAllRooms()
            ]);

            // Generate the vacant units table
            const vacantUnitsTable = this.generateVacantUnitsTable(tenants, leases, rooms);
            
            // Update modal content with the table
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = vacantUnitsTable;
            }

            // Add footer with close button
            const modalFooter = modal.querySelector('.modal-footer');
            if (!modalFooter) {
                const footer = document.createElement('div');
                footer.className = 'modal-footer';
                footer.innerHTML = `
                    <button class="btn btn-primary" onclick="ModalManager.closeModal(this.closest('.modal-overlay'))">
                        Close
                    </button>
                `;
                modal.querySelector('.modal-content').appendChild(footer);
            }

        } catch (error) {
            console.error('❌ Error loading vacant units data:', error);
            this.showNotification('Failed to load vacant units data', 'error');
        }
    }


    generateTenantDetailsTable(tenants, leases, rooms) {
        console.log('📊 Generating tenant details table...');
        
        // Create a map of roomNumber to lease info with occupants
        const roomLeaseMap = new Map();
        
        // Process leases to group by room and get occupant information
        leases.forEach(lease => {
            if (lease.isActive && lease.roomNumber && lease.occupants && lease.occupants.length > 0) {
                const primaryTenant = lease.occupants[0];
                const otherOccupants = lease.occupants.slice(1);
                const totalOccupants = lease.totalOccupants || lease.occupants.length;
                
                // Find tenant info for email
                const tenant = tenants.find(t => t.id === lease.tenantId);
                
                roomLeaseMap.set(lease.roomNumber, {
                    roomNumber: lease.roomNumber,
                    primaryTenant: primaryTenant,
                    email: tenant?.email || lease.tenantEmail || 'No email',
                    otherOccupants: otherOccupants,
                    totalOccupants: totalOccupants,
                    leaseId: lease.id
                });
            }
        });

        // Convert map to array and sort by room number
        const occupiedRooms = Array.from(roomLeaseMap.values()).sort((a, b) => {
            const roomA = a.roomNumber;
            const roomB = b.roomNumber;
            const floorA = parseInt(roomA.charAt(0));
            const floorB = parseInt(roomB.charAt(0));
            if (floorA !== floorB) return floorA - floorB;
            return roomA.localeCompare(roomB);
        });

        if (occupiedRooms.length === 0) {
            return `
                <div style="text-align: center; padding: 60px;">
                    <i class="fas fa-users" style="font-size: 4rem; color: var(--dark-gray); margin-bottom: 20px; opacity: 0.5;"></i>
                    <h3 style="color: var(--dark-gray); margin-bottom: 15px;">No Occupants Found</h3>
                    <p style="color: var(--dark-gray); margin-bottom: 25px;">There are currently no occupied units with registered occupants.</p>
                    <button class="btn btn-primary" onclick="casaLink.showAddTenantForm()">
                        <i class="fas fa-user-plus"></i> Add Your First Tenant
                    </button>
                </div>
            `;
        }

        // Calculate total statistics
        const totalOccupants = occupiedRooms.reduce((sum, room) => sum + room.totalOccupants, 0);
        const totalRooms = occupiedRooms.length;

        let tableHTML = `
            <!-- NOTES SECTION AT THE TOP -->
            <div style="margin-bottom: 25px; padding: 20px; background: #f8f9fa; border-radius: 12px; border: 1px solid #e9ecef;">
                <h4 style="margin: 0 0 15px 0; color: var(--royal-blue); font-size: 1rem; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-info-circle"></i> Note:
                </h4>
                <div style="font-size: 0.9rem; color: var(--dark-gray); line-height: 1.6;">
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Primary Tenant</strong> is the main registered tenant for the unit</li>
                        <li><strong>Other Occupants</strong> are additional people living in the unit</li>
                        <li><strong>Total Occupants</strong> includes all people living in the unit</li>
                        <li>Only active leases with registered occupants are shown in this table</li>
                    </ul>
                </div>
            </div>

            <!-- HEADER STATS SECTION -->
            <div style="margin-bottom: 25px;">
                <!-- Summary Cards -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div style="text-align: center; padding: 20px; background: white; border-radius: 10px; border-left: 4px solid var(--royal-blue); box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="font-size: 2.2rem; font-weight: 700; color: var(--royal-blue);">${totalRooms}</div>
                        <div style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500;">Occupied Units</div>
                    </div>
                    <div style="text-align: center; padding: 20px; background: white; border-radius: 10px; border-left: 4px solid var(--warning); box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="font-size: 2.2rem; font-weight: 700; color: var(--warning);">${totalOccupants}</div>
                        <div style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500;">Total Occupants</div>
                    </div>
                    <div style="text-align: center; padding: 20px; background: white; border-radius: 10px; border-left: 4px solid var(--info); box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="font-size: 2.2rem; font-weight: 700; color: var(--info);">${(totalOccupants / totalRooms).toFixed(1)}</div>
                        <div style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500;">Avg. per Unit</div>
                    </div>
                </div>
            </div>

            <!-- MAIN TABLE -->
            <div style="max-height: 600px; overflow-y: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; min-width: 1000px;">
                    <thead>
                        <tr style="background-color: #f8f9fa; position: sticky; top: 0;">
                            <th style="padding: 15px; text-align: left; border-bottom: 2px solid #e9ecef; min-width: 100px;">Room Number</th>
                            <th style="padding: 15px; text-align: left; border-bottom: 2px solid #e9ecef; min-width: 150px;">Primary Tenant</th>
                            <th style="padding: 15px; text-align: left; border-bottom: 2px solid #e9ecef; min-width: 200px;">Email</th>
                            <th style="padding: 15px; text-align: left; border-bottom: 2px solid #e9ecef; min-width: 200px;">Other Occupants</th>
                            <th style="padding: 15px; text-align: center; border-bottom: 2px solid #e9ecef; min-width: 120px;">Total Occupants</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        occupiedRooms.forEach(room => {
            const otherOccupantsText = room.otherOccupants.length > 0 
                ? room.otherOccupants.map(occupant => `• ${occupant}`).join('<br>')
                : '<em style="color: var(--dark-gray);">No other occupants</em>';

            tableHTML += `
                <tr style="border-bottom: 1px solid #e9ecef;">
                    <td style="padding: 15px; font-weight: 600;">
                        <span style="font-size: 1.1rem; background: var(--royal-blue); color: white; padding: 8px 12px; border-radius: 6px; display: inline-block;">
                            ${room.roomNumber}
                        </span>
                    </td>
                    <td style="padding: 15px;">
                        <div style="font-weight: 600; color: var(--royal-blue);">${room.primaryTenant}</div>
                        <small style="color: var(--dark-gray); font-size: 0.8rem;">Primary Tenant</small>
                    </td>
                    <td style="padding: 15px;">
                        <div style="color: var(--dark-gray); font-size: 0.85rem; word-break: break-word;">
                            <i class="fas fa-envelope" style="margin-right: 5px; color: var(--royal-blue);"></i>
                            ${room.email}
                        </div>
                    </td>
                    <td style="padding: 15px;">
                        <div style="font-size: 0.85rem; line-height: 1.4;">${otherOccupantsText}</div>
                    </td>
                    <td style="padding: 15px; text-align: center;">
                        <span style="background: rgba(251, 188, 4, 0.1); color: var(--warning); padding: 8px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; border: 2px solid var(--warning); display: inline-block; min-width: 60px;">
                            ${room.totalOccupants}
                        </span>
                    </td>
                </tr>
            `;
        });

        tableHTML += `
                    </tbody>
                </table>
            </div>
        `;

        return tableHTML;
    }

    async showTenantDetailsModal() {
        if (!this.debounceModalOpen(() => this.showTenantDetailsModal())) return;

        try {
            console.log('👥 Loading tenant details data...');
            
            // Show loading state
            const modalContent = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--royal-blue);"></i>
                    <p>Loading tenant details...</p>
                </div>
            `;

            const modal = ModalManager.openModal(modalContent, {
                title: 'Occupant Details - All Units',
                showFooter: false,
                width: '95%',
                maxWidth: '1400px'
            });

            // Apply custom width to the modal content
            const modalContentElement = modal.querySelector('.modal-content');
            if (modalContentElement) {
                modalContentElement.style.maxWidth = '1400px';
                modalContentElement.style.width = '95%';
            }

            // Fetch all necessary data
            const [tenants, leases, rooms] = await Promise.all([
                DataManager.getTenants(this.currentUser.uid),
                DataManager.getLandlordLeases(this.currentUser.uid),
                this.getAllRooms()
            ]);

            console.log('📊 Tenant details data loaded:', {
                tenants: tenants.length,
                leases: leases.length,
                rooms: rooms.length
            });

            // Generate the tenant details table
            const tenantDetailsTable = this.generateTenantDetailsTable(tenants, leases, rooms);
            
            // Update modal content with the table
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = tenantDetailsTable;
            }

            // Add footer with close button
            const modalFooter = modal.querySelector('.modal-footer');
            if (!modalFooter) {
                const footer = document.createElement('div');
                footer.className = 'modal-footer';
                footer.innerHTML = `
                    <button class="btn btn-primary" onclick="ModalManager.closeModal(this.closest('.modal-overlay'))">
                        Close
                    </button>
                `;
                modal.querySelector('.modal-content').appendChild(footer);
            }

        } catch (error) {
            console.error('❌ Error loading tenant details:', error);
            this.showNotification('Failed to load tenant details', 'error');
        }
    }

    generateLatePaymentsTable(latePayments) {
        return `
            <div style="margin-bottom: 25px;">
                <!-- Summary -->
                <div style="text-align: center; padding: 20px; background: white; border-radius: 10px; border-left: 4px solid var(--danger); box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px;">
                    <div style="font-size: 2.2rem; font-weight: 700; color: var(--danger);">${latePayments.length}</div>
                    <div style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500;">Total Late Payments</div>
                </div>

                <!-- Late Payments List -->
                <div style="background: white; padding: 20px; border-radius: 8px;">
                    <h4 style="margin: 0 0 15px 0; color: var(--royal-blue);">Late Payment Details</h4>
                    ${latePayments.length > 0 ? `
                        <div style="max-height: 400px; overflow-y: auto;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                                <thead>
                                    <tr style="background-color: #f8f9fa;">
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Tenant</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Room</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Amount</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Due Date</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Days Overdue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${latePayments.map(bill => {
                                        const dueDate = new Date(bill.dueDate);
                                        const today = new Date();
                                        const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
                                        
                                        return `
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="padding: 12px;">${bill.tenantName || 'N/A'}</td>
                                                <td style="padding: 12px;">${bill.roomNumber || 'N/A'}</td>
                                                <td style="padding: 12px; font-weight: 600; color: var(--danger);">₱${(bill.totalAmount || 0).toLocaleString()}</td>
                                                <td style="padding: 12px;">${dueDate.toLocaleDateString()}</td>
                                                <td style="padding: 12px;">
                                                    <span style="color: var(--danger); font-weight: 600;">${daysOverdue} days</span>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 40px; color: var(--dark-gray);">
                            <i class="fas fa-check-circle" style="font-size: 3rem; color: var(--success); margin-bottom: 15px; opacity: 0.5;"></i>
                            <h3>No Late Payments</h3>
                            <p>All payments are up to date!</p>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    generateUnpaidBillsTable(unpaidBills) {
        return `
            <div style="margin-bottom: 25px;">
                <!-- Summary -->
                <div style="text-align: center; padding: 20px; background: white; border-radius: 10px; border-left: 4px solid var(--warning); box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px;">
                    <div style="font-size: 2.2rem; font-weight: 700; color: var(--warning);">${unpaidBills.length}</div>
                    <div style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500;">Total Unpaid Bills</div>
                </div>

                <!-- Unpaid Bills List -->
                <div style="background: white; padding: 20px; border-radius: 8px;">
                    <h4 style="margin: 0 0 15px 0; color: var(--royal-blue);">Unpaid Bills Details</h4>
                    ${unpaidBills.length > 0 ? `
                        <div style="max-height: 400px; overflow-y: auto;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                                <thead>
                                    <tr style="background-color: #f8f9fa;">
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Tenant</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Room</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Type</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Amount</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Due Date</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${unpaidBills.map(bill => {
                                        const dueDate = new Date(bill.dueDate);
                                        const today = new Date();
                                        const isOverdue = dueDate < today;
                                        
                                        return `
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="padding: 12px;">${bill.tenantName || 'N/A'}</td>
                                                <td style="padding: 12px;">${bill.roomNumber || 'N/A'}</td>
                                                <td style="padding: 12px; text-transform: capitalize;">${bill.type || 'rent'}</td>
                                                <td style="padding: 12px; font-weight: 600; color: var(--warning);">₱${(bill.totalAmount || 0).toLocaleString()}</td>
                                                <td style="padding: 12px;">${dueDate.toLocaleDateString()}</td>
                                                <td style="padding: 12px;">
                                                    <span style="color: ${isOverdue ? 'var(--danger)' : 'var(--warning)'}; font-weight: 600;">
                                                        ${isOverdue ? 'Overdue' : 'Pending'}
                                                    </span>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 40px; color: var(--dark-gray);">
                            <i class="fas fa-check-circle" style="font-size: 3rem; color: var(--success); margin-bottom: 15px; opacity: 0.5;"></i>
                            <h3>No Unpaid Bills</h3>
                            <p>All bills have been paid!</p>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    // Helper method to add modal footer
    addModalFooter(modal) {
        const modalFooter = modal.querySelector('.modal-footer');
        if (!modalFooter) {
            const footer = document.createElement('div');
            footer.className = 'modal-footer';
            footer.innerHTML = `
                <button class="btn btn-primary" onclick="ModalManager.closeModal(this.closest('.modal-overlay'))">
                    Close
                </button>
            `;
            modal.querySelector('.modal-content').appendChild(footer);
        }
    }

    generateRevenueTable(revenueData) {
        return `
            <div style="margin-bottom: 25px;">
                <!-- Revenue Summary -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div style="text-align: center; padding: 20px; background: white; border-radius: 10px; border-left: 4px solid var(--royal-blue); box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="font-size: 2.2rem; font-weight: 700; color: var(--royal-blue);">₱${revenueData.monthlyRevenue.toLocaleString()}</div>
                        <div style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500;">Total Revenue</div>
                    </div>
                    <div style="text-align: center; padding: 20px; background: white; border-radius: 10px; border-left: 4px solid var(--success); box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="font-size: 2.2rem; font-weight: 700; color: var(--success);">${revenueData.totalTransactions}</div>
                        <div style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500;">Transactions</div>
                    </div>
                </div>

                <!-- Revenue by Type -->
                <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 15px 0; color: var(--royal-blue);">Revenue by Type</h4>
                    <div style="display: grid; gap: 10px;">
                        ${Object.entries(revenueData.revenueByType).map(([type, amount]) => `
                            <div style="display: flex; justify-content: between; align-items: center; padding: 10px; background: #f8f9fa; border-radius: 6px;">
                                <div style="font-weight: 500; text-transform: capitalize;">${type}</div>
                                <div style="font-weight: 600; color: var(--success);">₱${amount.toLocaleString()}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Revenue Trend -->
                <div style="background: white; padding: 20px; border-radius: 8px;">
                    <h4 style="margin: 0 0 15px 0; color: var(--royal-blue);">Revenue Trend (Last 3 Months)</h4>
                    <div style="display: grid; gap: 10px;">
                        ${revenueData.monthlyTrend.map(month => `
                            <div style="display: flex; justify-content: between; align-items: center; padding: 12px; background: #f8f9fa; border-radius: 6px;">
                                <div style="font-weight: 500;">${month.month}</div>
                                <div style="font-weight: 600; color: var(--royal-blue);">₱${month.revenue.toLocaleString()}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }



    getLatePayments(bills) {
        const today = new Date();
        return bills.filter(bill => 
            bill.status === 'pending' && 
            new Date(bill.dueDate) < today
        );
    }

    getUnpaidBills(bills) {
        return bills.filter(bill => bill.status === 'pending');
    }

    // Table generation methods
    generateRentCollectionTable(stats, bills) {
        const today = new Date();
        const currentMonth = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        // ✅ Use only current month paid bills for the table
        const recentPayments = stats.currentMonthPaidBills || 
                            bills.filter(bill => bill.status === 'paid').slice(0, 10);
        
        return `
            <div style="margin-bottom: 25px;">
                <!-- Summary Cards -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div style="text-align: center; padding: 20px; background: white; border-radius: 10px; border-left: 4px solid var(--success); box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="font-size: 2.2rem; font-weight: 700; color: var(--success);">${stats.collectionRate}%</div>
                        <div style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500;">Collection Rate</div>
                    </div>
                    <div style="text-align: center; padding: 20px; background: white; border-radius: 10px; border-left: 4px solid var(--royal-blue); box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="font-size: 2.2rem; font-weight: 700; color: var(--royal-blue);">₱${stats.collectedRent.toLocaleString()}</div>
                        <div style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500;">Collected</div>
                    </div>
                    <div style="text-align: center; padding: 20px; background: white; border-radius: 10px; border-left: 4px solid var(--warning); box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="font-size: 2.2rem; font-weight: 700; color: var(--warning);">₱${stats.pendingRent.toLocaleString()}</div>
                        <div style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500;">Pending</div>
                    </div>
                    <div style="text-align: center; padding: 20px; background: white; border-radius: 10px; border-left: 4px solid var(--info); box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="font-size: 2.2rem; font-weight: 700; color: var(--info);">₱${stats.expectedRent.toLocaleString()}</div>
                        <div style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500;">Expected</div>
                    </div>
                </div>

                <!-- Progress Bar -->
                <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 15px 0; color: var(--royal-blue);">Collection Progress - ${currentMonth}</h4>
                    <div style="background: #e9ecef; border-radius: 10px; height: 20px; overflow: hidden;">
                        <div style="background: linear-gradient(90deg, var(--success), #2ecc71); height: 100%; width: ${stats.collectionRate}%; border-radius: 10px; transition: width 0.5s ease;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 0.9rem; color: var(--dark-gray);">
                        <span>₱0</span>
                        <span>₱${stats.expectedRent.toLocaleString()}</span>
                    </div>
                </div>

                <!-- Recent Payments (CURRENT MONTH ONLY) -->
                <div style="background: white; padding: 20px; border-radius: 8px;">
                    <h4 style="margin: 0 0 15px 0; color: var(--royal-blue);">
                        Recent Payments - ${currentMonth}
                        ${recentPayments.length > 0 ? `<span style="font-size: 0.9rem; color: var(--dark-gray);">(${recentPayments.length} rent payments this month)</span>` : ''}
                    </h4>
                    ${recentPayments.length > 0 ? `
                        <div style="max-height: 300px; overflow-y: auto;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                                <thead>
                                    <tr style="background-color: #f8f9fa;">
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Tenant</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Room</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Amount</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Paid Date</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${recentPayments.map(bill => `
                                        <tr style="border-bottom: 1px solid #e9ecef;">
                                            <td style="padding: 12px;">${bill.tenantName || 'N/A'}</td>
                                            <td style="padding: 12px;">${bill.roomNumber || 'N/A'}</td>
                                            <td style="padding: 12px; font-weight: 600; color: var(--success);">₱${(bill.totalAmount || 0).toLocaleString()}</td>
                                            <td style="padding: 12px;">${new Date(bill.paidDate).toLocaleDateString()}</td>
                                            <td style="padding: 12px;">
                                                <span style="color: var(--success); font-weight: 600;">Paid</span>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 20px; color: var(--dark-gray);">
                            <i class="fas fa-receipt" style="font-size: 2rem; opacity: 0.5; margin-bottom: 10px;"></i>
                            <p>No payments received this month yet.</p>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    calculateRevenueBreakdown(bills, leases) {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
        // Monthly revenue
        const monthlyRevenue = bills
            .filter(bill => {
                if (bill.status !== 'paid') return false;
                const billDate = new Date(bill.paidDate || bill.dueDate);
                return billDate.getMonth() === currentMonth && 
                    billDate.getFullYear() === currentYear;
            })
            .reduce((total, bill) => total + (bill.totalAmount || 0), 0);
        
        // Revenue by type
        const revenueByType = {};
        bills.forEach(bill => {
            if (bill.status === 'paid') {
                const billDate = new Date(bill.paidDate || bill.dueDate);
                if (billDate.getMonth() === currentMonth && billDate.getFullYear() === currentYear) {
                    const type = bill.type || 'rent';
                    revenueByType[type] = (revenueByType[type] || 0) + (bill.totalAmount || 0);
                }
            }
        });
        
        // Revenue trend (last 3 months)
        const monthlyTrend = [];
        for (let i = 2; i >= 0; i--) {
            const date = new Date(currentYear, currentMonth - i, 1);
            const monthBills = bills.filter(bill => {
                if (bill.status !== 'paid') return false;
                const billDate = new Date(bill.paidDate || bill.dueDate);
                return billDate.getMonth() === date.getMonth() && 
                    billDate.getFullYear() === date.getFullYear();
            });
            
            const monthlyTotal = monthBills.reduce((sum, bill) => sum + (bill.totalAmount || 0), 0);
            monthlyTrend.push({
                month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                revenue: monthlyTotal
            });
        }
        
        return {
            monthlyRevenue,
            revenueByType,
            monthlyTrend,
            totalTransactions: bills.filter(bill => bill.status === 'paid').length
        };
    }

    calculateRentCollectionStats(tenants, leases, bills) {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
        const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
        const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
        
        console.log('🔍 DEBUG: Date Range for filtering:', {
            firstDay: firstDayOfMonth.toISOString().split('T')[0],
            lastDay: lastDayOfMonth.toISOString().split('T')[0],
            currentMonth: currentMonth,
            currentYear: currentYear
        });
        
        // Active leases with rent
        const activeLeases = leases.filter(lease => 
            lease.isActive && lease.monthlyRent && lease.monthlyRent > 0
        );
        
        const expectedRent = activeLeases.reduce((sum, lease) => sum + (lease.monthlyRent || 0), 0);
        
        console.log('🔍 DEBUG: Expected Rent from active leases:', expectedRent);
        
        // ✅ STRICT FILTER: Only get RENT payments from CURRENT MONTH
        const rentPayments = bills.filter(bill => {
            // Must be paid
            if (bill.status !== 'paid') return false;
            
            // ✅ STRICTER DATE FILTERING
            const billDate = new Date(bill.paidDate || bill.dueDate);
            const billMonth = billDate.getMonth();
            const billYear = billDate.getFullYear();
            
            // Check if bill is from current month AND year
            if (billMonth !== currentMonth || billYear !== currentYear) {
                console.log(`❌ EXCLUDED: ${bill.tenantName} - ${bill.description} (Date: ${billDate.toISOString().split('T')[0]})`);
                return false;
            }
            
            // ✅ ONLY include rent payments
            const isRentPayment = 
                bill.type === 'rent' || 
                (bill.description && (
                    bill.description.toLowerCase().includes('rent') ||
                    bill.description.toLowerCase().includes('monthly rent') ||
                    bill.description.toLowerCase().includes('lease payment')
                ));
            
            if (isRentPayment) {
                console.log(`✅ INCLUDED: ${bill.tenantName} - ${bill.description} (Date: ${billDate.toISOString().split('T')[0]})`);
            }
            
            return isRentPayment;
        });
        
        console.log('🔍 DEBUG: Rent payments found:', rentPayments.length);
        console.log('🔍 DEBUG: All rent payment details:');
        rentPayments.forEach(payment => {
            const paymentDate = new Date(payment.paidDate || payment.dueDate);
            console.log(`  - ${payment.tenantName}: ₱${payment.totalAmount} - ${payment.description} (${paymentDate.toISOString().split('T')[0]})`);
        });
        
        // ✅ Calculate collected rent ONLY from rent payments
        const collectedRent = rentPayments.reduce((sum, bill) => sum + (bill.totalAmount || 0), 0);
        
        console.log('🔍 DEBUG: Total collected rent:', collectedRent);
        
        const collectionRate = expectedRent > 0 ? Math.round((collectedRent / expectedRent) * 100) : 0;
        
        // Group by tenant for display
        const tenantRentPaymentsMap = new Map();
        rentPayments.forEach(bill => {
            const tenantId = bill.tenantId;
            if (!tenantRentPaymentsMap.has(tenantId)) {
                tenantRentPaymentsMap.set(tenantId, bill);
            }
        });
        
        const uniqueRentPayments = Array.from(tenantRentPaymentsMap.values());
        
        return {
            expectedRent,
            collectedRent,
            collectionRate,
            pendingRent: expectedRent - collectedRent,
            paidBillsCount: uniqueRentPayments.length,
            totalExpectedBills: activeLeases.length,
            currentMonthPaidBills: uniqueRentPayments
        };
    }
    async showUnpaidBillsModal() {
        if (!this.debounceModalOpen(() => this.showUnpaidBillsModal())) return;
        
        try {
            console.log('📄 Loading unpaid bills...');
            
            const modalContent = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--royal-blue);"></i>
                    <p>Loading unpaid bills...</p>
                </div>
            `;

            const modal = ModalManager.openModal(modalContent, {
                title: 'Unpaid Bills & Invoices',
                showFooter: false,
                width: '95%',
                maxWidth: '1200px'
            });

            const bills = await DataManager.getBills(this.currentUser.uid);
            const unpaidBills = this.getUnpaidBills(bills);
            const unpaidBillsTable = this.generateUnpaidBillsTable(unpaidBills);
            
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = unpaidBillsTable;
            }

            this.addModalFooter(modal);

        } catch (error) {
            console.error('❌ Error loading unpaid bills:', error);
            this.showNotification('Failed to load unpaid bills', 'error');
        }
    }

    async showLatePaymentsModal() {
        if (!this.debounceModalOpen(() => this.showLatePaymentsModal())) return;
        
        try {
            console.log('⏰ Loading late payments...');
            
            const modalContent = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--royal-blue);"></i>
                    <p>Loading late payments...</p>
                </div>
            `;

            const modal = ModalManager.openModal(modalContent, {
                title: 'Late Payments Overview',
                showFooter: false,
                width: '95%',
                maxWidth: '1200px'
            });

            const bills = await DataManager.getBills(this.currentUser.uid);
            const latePayments = this.getLatePayments(bills);
            const latePaymentsTable = this.generateLatePaymentsTable(latePayments);
            
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = latePaymentsTable;
            }

            this.addModalFooter(modal);

        } catch (error) {
            console.error('❌ Error loading late payments:', error);
            this.showNotification('Failed to load late payments', 'error');
        }
    }



    async showRevenueDetailsModal() {
        if (!this.debounceModalOpen(() => this.showRevenueDetailsModal())) return;
        
        try {
            console.log('💰 Loading revenue details...');
            
            const modalContent = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--royal-blue);"></i>
                    <p>Loading revenue details...</p>
                </div>
            `;

            const modal = ModalManager.openModal(modalContent, {
                title: 'Monthly Revenue Breakdown',
                showFooter: false,
                width: '95%',
                maxWidth: '1200px'
            });

            const [bills, leases] = await Promise.all([
                DataManager.getBills(this.currentUser.uid),
                DataManager.getLandlordLeases(this.currentUser.uid)
            ]);

            const revenueData = this.calculateRevenueBreakdown(bills, leases);
            const revenueTable = this.generateRevenueTable(revenueData);
            
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = revenueTable;
            }

            this.addModalFooter(modal);

        } catch (error) {
            console.error('❌ Error loading revenue details:', error);
            this.showNotification('Failed to load revenue details', 'error');
        }
    }

    async showRentCollectionModal() {
        if (!this.debounceModalOpen(() => this.showRentCollectionModal())) return;
        
        try {
            console.log('💰 Loading rent collection details...');
            
            // Show loading state
            const modalContent = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--royal-blue);"></i>
                    <p>Loading rent collection details...</p>
                </div>
            `;

            const modal = ModalManager.openModal(modalContent, {
                title: 'Rent Collection Details',
                showFooter: false,
                width: '95%',
                maxWidth: '1200px'
            });

            // Fetch data
            const [tenants, leases, bills] = await Promise.all([
                DataManager.getTenants(this.currentUser.uid),
                DataManager.getLandlordLeases(this.currentUser.uid),
                DataManager.getBills(this.currentUser.uid)
            ]);

            // Calculate collection statistics
            const stats = this.calculateRentCollectionStats(tenants, leases, bills);
            const collectionTable = this.generateRentCollectionTable(stats, bills);
            
            // Update modal content
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = collectionTable;
            }

            // Add footer
            this.addModalFooter(modal);

        } catch (error) {
            console.error('❌ Error loading rent collection details:', error);
            this.showNotification('Failed to load rent collection details', 'error');
        }
    }

    generateOpenMaintenanceTable(openRequests) {
        return `
            <div style="margin-bottom: 25px;">
                <!-- Summary -->
                <div style="text-align: center; padding: 20px; background: white; border-radius: 10px; border-left: 4px solid var(--info); box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px;">
                    <div style="font-size: 2.2rem; font-weight: 700; color: var(--info);">${openRequests.length}</div>
                    <div style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500;">New Maintenance Requests</div>
                </div>

                <!-- Open Requests List -->
                <div style="background: white; padding: 20px; border-radius: 8px;">
                    <h4 style="margin: 0 0 15px 0; color: var(--royal-blue);">Open Maintenance Requests</h4>
                    ${openRequests.length > 0 ? `
                        <div style="max-height: 400px; overflow-y: auto;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                                <thead>
                                    <tr style="background-color: #f8f9fa;">
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Tenant</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Room</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Type</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Title</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Priority</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${openRequests.map(request => {
                                        const priorityColors = {
                                            'high': 'var(--danger)',
                                            'medium': 'var(--warning)',
                                            'low': 'var(--success)'
                                        };
                                        const priorityColor = priorityColors[request.priority] || 'var(--dark-gray)';
                                        
                                        return `
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="padding: 12px;">${request.tenantName || 'N/A'}</td>
                                                <td style="padding: 12px;">${request.roomNumber || 'N/A'}</td>
                                                <td style="padding: 12px; text-transform: capitalize;">${request.type || 'General'}</td>
                                                <td style="padding: 12px;">
                                                    <strong>${request.title || 'No Title'}</strong>
                                                    ${request.description ? `<br><small style="color: var(--dark-gray);">${request.description.substring(0, 50)}...</small>` : ''}
                                                </td>
                                                <td style="padding: 12px;">
                                                    <span style="color: ${priorityColor}; font-weight: 600; text-transform: capitalize;">
                                                        ${request.priority || 'medium'}
                                                    </span>
                                                </td>
                                                <td style="padding: 12px;">
                                                    ${new Date(request.createdAt).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 40px; color: var(--dark-gray);">
                            <i class="fas fa-check-circle" style="font-size: 3rem; color: var(--success); margin-bottom: 15px; opacity: 0.5;"></i>
                            <h3>No Open Maintenance Requests</h3>
                            <p>All maintenance requests have been addressed.</p>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    generateMaintenanceBacklogTable(backlogData) {
        const groupedByStatus = {
            'open': backlogData.filter(req => req.status === 'open' || !req.status),
            'in-progress': backlogData.filter(req => req.status === 'in-progress'),
            'pending': backlogData.filter(req => req.status === 'pending')
        };

        return `
            <div style="margin-bottom: 25px;">
                <!-- Summary -->
                <div style="text-align: center; padding: 20px; background: white; border-radius: 10px; border-left: 4px solid var(--primary); box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px;">
                    <div style="font-size: 2.2rem; font-weight: 700; color: var(--primary);">${backlogData.length}</div>
                    <div style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500;">Total Pending Maintenance</div>
                </div>

                <!-- Status Breakdown -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div style="text-align: center; padding: 15px; background: white; border-radius: 8px; border-left: 4px solid var(--warning);">
                        <div style="font-size: 1.8rem; font-weight: 700; color: var(--warning);">${groupedByStatus.open.length}</div>
                        <div style="color: var(--dark-gray); font-size: 0.8rem;">Open</div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: white; border-radius: 8px; border-left: 4px solid var(--info);">
                        <div style="font-size: 1.8rem; font-weight: 700; color: var(--info);">${groupedByStatus['in-progress'].length}</div>
                        <div style="color: var(--dark-gray); font-size: 0.8rem;">In Progress</div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: white; border-radius: 8px; border-left: 4px solid var(--dark-gray);">
                        <div style="font-size: 1.8rem; font-weight: 700; color: var(--dark-gray);">${groupedByStatus.pending.length}</div>
                        <div style="color: var(--dark-gray); font-size: 0.8rem;">Pending</div>
                    </div>
                </div>

                <!-- Backlog List -->
                <div style="background: white; padding: 20px; border-radius: 8px;">
                    <h4 style="margin: 0 0 15px 0; color: var(--royal-blue);">Maintenance Backlog Details</h4>
                    ${backlogData.length > 0 ? `
                        <div style="max-height: 400px; overflow-y: auto;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                                <thead>
                                    <tr style="background-color: #f8f9fa;">
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Tenant</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Room</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Issue</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Priority</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Status</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Created</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${backlogData.map(request => {
                                        const statusColors = {
                                            'open': 'var(--warning)',
                                            'in-progress': 'var(--info)',
                                            'pending': 'var(--dark-gray)'
                                        };
                                        const statusColor = statusColors[request.status] || 'var(--dark-gray)';
                                        const priorityColors = {
                                            'high': 'var(--danger)',
                                            'medium': 'var(--warning)',
                                            'low': 'var(--success)'
                                        };
                                        const priorityColor = priorityColors[request.priority] || 'var(--dark-gray)';
                                        
                                        return `
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="padding: 12px;">${request.tenantName || 'N/A'}</td>
                                                <td style="padding: 12px;">${request.roomNumber || 'N/A'}</td>
                                                <td style="padding: 12px;">
                                                    <strong>${request.title || 'No Title'}</strong>
                                                </td>
                                                <td style="padding: 12px;">
                                                    <span style="color: ${priorityColor}; font-weight: 600; text-transform: capitalize;">
                                                        ${request.priority || 'medium'}
                                                    </span>
                                                </td>
                                                <td style="padding: 12px;">
                                                    <span style="color: ${statusColor}; font-weight: 600; text-transform: capitalize;">
                                                        ${request.status || 'open'}
                                                    </span>
                                                </td>
                                                <td style="padding: 12px;">
                                                    ${new Date(request.createdAt).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 40px; color: var(--dark-gray);">
                            <i class="fas fa-check-circle" style="font-size: 3rem; color: var(--success); margin-bottom: 15px; opacity: 0.5;"></i>
                            <h3>No Maintenance Backlog</h3>
                            <p>All maintenance work is completed!</p>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    getMaintenanceBacklog(maintenanceRequests) {
        return maintenanceRequests.filter(request => 
            ['open', 'in-progress', 'pending'].includes(request.status) || !request.status
        ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }

    // Table generation methods for operations
    generateLeaseRenewalsTable(renewals) {
        return `
            <div style="margin-bottom: 25px;">
                <!-- Summary -->
                <div style="text-align: center; padding: 20px; background: white; border-radius: 10px; border-left: 4px solid var(--warning); box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px;">
                    <div style="font-size: 2.2rem; font-weight: 700; color: var(--warning);">${renewals.length}</div>
                    <div style="color: var(--dark-gray); font-size: 0.9rem; font-weight: 500;">Leases Expiring in Next 30 Days</div>
                </div>

                <!-- Renewals List -->
                <div style="background: white; padding: 20px; border-radius: 8px;">
                    <h4 style="margin: 0 0 15px 0; color: var(--royal-blue);">Upcoming Lease Renewals</h4>
                    ${renewals.length > 0 ? `
                        <div style="max-height: 400px; overflow-y: auto;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                                <thead>
                                    <tr style="background-color: #f8f9fa;">
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Tenant</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Room</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Lease End</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Days Left</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Monthly Rent</th>
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef;">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${renewals.map(lease => `
                                        <tr style="border-bottom: 1px solid #e9ecef;">
                                            <td style="padding: 12px;">
                                                <strong>${lease.tenantName || 'N/A'}</strong>
                                            </td>
                                            <td style="padding: 12px;">${lease.roomNumber || 'N/A'}</td>
                                            <td style="padding: 12px;">${lease.renewalDate}</td>
                                            <td style="padding: 12px;">
                                                <span style="color: ${lease.daysUntilRenewal <= 7 ? 'var(--danger)' : 'var(--warning)'}; font-weight: 600;">
                                                    ${lease.daysUntilRenewal} days
                                                </span>
                                            </td>
                                            <td style="padding: 12px; font-weight: 600; color: var(--royal-blue);">
                                                ₱${(lease.monthlyRent || 0).toLocaleString()}
                                            </td>
                                            <td style="padding: 12px;">
                                                <span style="color: var(--warning); font-weight: 600;">Expiring Soon</span>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 40px; color: var(--dark-gray);">
                            <i class="fas fa-check-circle" style="font-size: 3rem; color: var(--success); margin-bottom: 15px; opacity: 0.5;"></i>
                            <h3>No Upcoming Renewals</h3>
                            <p>No leases are expiring in the next 30 days.</p>
                        </div>
                    `}
                </div>

                <!-- Action Buttons -->
                ${renewals.length > 0 ? `
                    <div style="background: rgba(251, 188, 4, 0.1); padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 4px solid var(--warning);">
                        <h5 style="margin: 0 0 10px 0; color: var(--warning);">Recommended Actions</h5>
                        <p style="margin: 0; font-size: 0.9rem;">
                            • Contact tenants to discuss lease renewal options<br>
                            • Prepare renewal documents 2 weeks before expiration<br>
                            • Schedule property inspections if needed
                        </p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    getUpcomingRenewals(leases) {
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        
        return leases.filter(lease => {
            if (!lease.leaseEnd || !lease.isActive) return false;
            
            const leaseEnd = new Date(lease.leaseEnd);
            return leaseEnd >= today && leaseEnd <= thirtyDaysFromNow;
        }).map(lease => {
            const leaseEnd = new Date(lease.leaseEnd);
            const daysUntilRenewal = Math.ceil((leaseEnd - today) / (1000 * 60 * 60 * 24));
            
            return {
                ...lease,
                daysUntilRenewal,
                renewalDate: leaseEnd.toLocaleDateString()
            };
        }).sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);
    }

    getOpenMaintenanceRequests(maintenanceRequests) {
        return maintenanceRequests.filter(request => 
            request.status === 'open' || !request.status
        ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    async showMaintenanceBacklogModal() {
        if (!this.debounceModalOpen(() => this.showMaintenanceBacklogModal())) return;
        
        try {
            console.log('📋 Loading maintenance backlog...');
            
            const modalContent = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--royal-blue);"></i>
                    <p>Loading maintenance backlog...</p>
                </div>
            `;

            const modal = ModalManager.openModal(modalContent, {
                title: 'Maintenance Backlog',
                showFooter: false,
                width: '95%',
                maxWidth: '1200px'
            });

            const maintenanceRequests = await DataManager.getMaintenanceRequests(this.currentUser.uid);
            const backlogData = this.getMaintenanceBacklog(maintenanceRequests);
            const backlogTable = this.generateMaintenanceBacklogTable(backlogData);
            
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = backlogTable;
            }

            this.addModalFooter(modal);

        } catch (error) {
            console.error('❌ Error loading maintenance backlog:', error);
            this.showNotification('Failed to load maintenance backlog', 'error');
        }
    }

    async showOpenMaintenanceModal() {
        if (!this.debounceModalOpen(() => this.showOpenMaintenanceModal())) return;
        
        try {
            console.log('🔧 Loading open maintenance requests...');
            
            const modalContent = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--royal-blue);"></i>
                    <p>Loading open maintenance requests...</p>
                </div>
            `;

            const modal = ModalManager.openModal(modalContent, {
                title: 'Open Maintenance Requests',
                showFooter: false,
                width: '95%',
                maxWidth: '1200px'
            });

            const maintenanceRequests = await DataManager.getMaintenanceRequests(this.currentUser.uid);
            const openRequests = this.getOpenMaintenanceRequests(maintenanceRequests);
            const openRequestsTable = this.generateOpenMaintenanceTable(openRequests);
            
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = openRequestsTable;
            }

            this.addModalFooter(modal);

        } catch (error) {
            console.error('❌ Error loading open maintenance requests:', error);
            this.showNotification('Failed to load maintenance requests', 'error');
        }
    }

    async showLeaseRenewalsModal() {
        if (!this.debounceModalOpen(() => this.showLeaseRenewalsModal())) return;
        
        try {
            console.log('📅 Loading lease renewals...');
            
            const modalContent = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--royal-blue);"></i>
                    <p>Loading lease renewals...</p>
                </div>
            `;

            const modal = ModalManager.openModal(modalContent, {
                title: 'Lease Renewals - Next 30 Days',
                showFooter: false,
                width: '95%',
                maxWidth: '1200px'
            });

            const leases = await DataManager.getLandlordLeases(this.currentUser.uid);
            const renewalsData = this.getUpcomingRenewals(leases);
            const renewalsTable = this.generateLeaseRenewalsTable(renewalsData);
            
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = renewalsTable;
            }

            this.addModalFooter(modal);

        } catch (error) {
            console.error('❌ Error loading lease renewals:', error);
            this.showNotification('Failed to load lease renewals', 'error');
        }
    }


    debounceModalOpen(modalFunction) {
        const now = Date.now();
        if (this.lastModalOpen && now - this.lastModalOpen < 500) {
            console.log('⏳ Modal opening debounced');
            return false;
        }
        this.lastModalOpen = now;
        modalFunction.call(this);
        return true;
    }


    setupDashboardEvents() {
        console.log('🔄 Setting up dashboard events with fresh data...');
        
        // Add Property Button
        document.getElementById('addPropertyBtn')?.addEventListener('click', () => {
            this.showAddPropertyForm();
        });
        
        this.loadRecentActivities();
        
        // Setup real-time stats when dashboard is shown
        this.updateActiveNavState('dashboard');
        
        console.log('✅ All dashboard events setup complete');
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

    async forceMemberCollection() {
        console.log('🔧 FORCING member collection...');
        
        const user = this.currentUser;
        if (!user) {
            console.log('❌ No user logged in');
            return;
        }
        
        const lease = await DataManager.getTenantLease(user.uid);
        if (!lease) {
            console.log('❌ No lease found');
            return;
        }
        
        // Clear occupants to force member collection
        await firebaseDb.collection('leases').doc(lease.id).update({
            occupants: [],
            totalOccupants: 0,
            updatedAt: new Date().toISOString()
        });
        
        console.log('✅ Cleared occupants, should trigger member collection on next check');
        this.showMemberInformationCollection();
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
                    console.log('🎯 TRIGGER: Tenant needs verification - checking member info');
                    
                    setTimeout(async () => {
                        try {
                            const lease = await DataManager.getTenantLease(user.uid);
                            
                            if (!lease) {
                                console.log('❌ No lease found');
                                this.showLeaseAgreementVerification();
                                return;
                            }

                            const room = await this.getRoomByNumber(lease.roomNumber);
                            const maxMembers = room?.maxMembers || 1;
                            
                            // FIXED: Handle 1-member units properly
                            const hasOccupants = Array.isArray(lease.occupants) && lease.occupants.length > 0;
                            const isSingleOccupantUnit = maxMembers === 1;
                            
                            console.log('🔍 Decision factors:', {
                                maxMembers: maxMembers,
                                hasOccupants: hasOccupants,
                                isSingleOccupantUnit: isSingleOccupantUnit,
                                shouldShowMemberForm: (!isSingleOccupantUnit && !hasOccupants),
                                shouldShowLeaseAgreement: (isSingleOccupantUnit || hasOccupants)
                            });
                            
                            // If it's NOT a single occupant unit AND we don't have occupants, show member collection
                            if (!isSingleOccupantUnit && !hasOccupants) {
                                console.log('👥 Showing member collection for multi-occupant unit');
                                this.showMemberInformationCollection();
                            } else {
                                console.log('📄 Showing lease agreement directly');
                                // For single occupant units or units with existing occupants, go straight to lease agreement
                                this.showLeaseAgreementVerification();
                            }
                            
                        } catch (error) {
                            console.error('❌ Error:', error);
                            this.showLeaseAgreementVerification();
                        }
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


    searchBills(searchTerm) {
        if (!searchTerm) {
            this.billsFilteredData = [...this.billsAllData];
        } else {
            const searchLower = searchTerm.toLowerCase();
            this.billsFilteredData = this.billsAllData.filter(bill => 
                bill.tenantName?.toLowerCase().includes(searchLower) ||
                bill.roomNumber?.toLowerCase().includes(searchLower) ||
                bill.description?.toLowerCase().includes(searchLower) ||
                bill.type?.toLowerCase().includes(searchLower)
            );
        }
        
        this.billsCurrentPage = 1;
        this.billsTotalPages = Math.ceil(this.billsFilteredData.length / this.billsItemsPerPage);
        this.updateBillsTable(this.getCurrentBillsPage());
        this.setupBillsPagination();
    }

    filterBills(status) {
        if (status === 'all') {
            this.billsFilteredData = [...this.billsAllData];
        } else {
            this.billsFilteredData = this.billsAllData.filter(bill => {
                const isOverdue = bill.status === 'pending' && new Date(bill.dueDate) < new Date();
                
                if (status === 'overdue' && isOverdue) return true;
                if (status === 'pending' && bill.status === 'pending' && !isOverdue) return true;
                if (status === 'paid' && bill.status === 'paid') return true;
                return false;
            });
        }
        
        this.billsCurrentPage = 1;
        this.billsTotalPages = Math.ceil(this.billsFilteredData.length / this.billsItemsPerPage);
        this.updateBillsTable(this.getCurrentBillsPage());
        this.setupBillsPagination();
    }

    async showBillingSettings() {
        try {
            const settings = await DataManager.getBillingSettings();
            
            const modalContent = `
                <div class="billing-settings-modal">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <i class="fas fa-cog" style="font-size: 3rem; color: var(--royal-blue); margin-bottom: 15px;"></i>
                        <h3 style="margin-bottom: 10px;">Billing Settings</h3>
                        <p>Configure automatic billing and payment preferences</p>
                    </div>

                    <div class="form-group">
                        <label class="form-label" style="display: flex; align-items: center; gap: 10px;">
                            <input type="checkbox" id="autoBillingEnabled" ${settings.autoBillingEnabled ? 'checked' : ''}>
                            <span>Enable Automatic Monthly Billing</span>
                        </label>
                        <small style="color: var(--dark-gray);">
                            Bills will be automatically generated on the 1st of each month
                        </small>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Default Payment Due Day</label>
                        <select id="defaultPaymentDay" class="form-input">
                            ${Array.from({length: 28}, (_, i) => i + 1).map(day => `
                                <option value="${day}" ${day === settings.defaultPaymentDay ? 'selected' : ''}>
                                    ${day}${DataManager.getOrdinalSuffix(day)} of the month
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label" style="display: flex; align-items: center; gap: 10px;">
                            <input type="checkbox" id="autoLateFees" ${settings.autoLateFees ? 'checked' : ''}>
                            <span>Enable Automatic Late Fees</span>
                        </label>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Late Fee Amount (₱)</label>
                        <input type="number" id="lateFeeAmount" class="form-input" 
                            value="${settings.lateFeeAmount}" min="0" step="50">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Apply Late Fee After (Days)</label>
                        <input type="number" id="lateFeeAfterDays" class="form-input" 
                            value="${settings.lateFeeAfterDays || 5}" min="1" max="30">
                        <small style="color: var(--dark-gray);">
                            Number of days after due date before applying late fee
                        </small>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Grace Period (Days)</label>
                        <input type="number" id="gracePeriodDays" class="form-input" 
                            value="${settings.gracePeriodDays}" min="0" max="15">
                        <small style="color: var(--dark-gray);">
                            Days after due date before marking as overdue
                        </small>
                    </div>

                    <div id="billingSettingsError" style="color: var(--danger); display: none; margin-bottom: 15px;"></div>

                    <div class="security-info">
                        <i class="fas fa-info-circle"></i>
                        <small>Changes will take effect immediately for new bills</small>
                    </div>
                </div>
            `;

            const modal = ModalManager.openModal(modalContent, {
                title: 'Billing Settings',
                submitText: 'Save Settings',
                onSubmit: () => this.saveBillingSettings()
            });

            this.billingSettingsModal = modal;

        } catch (error) {
            console.error('Error loading billing settings:', error);
            this.showNotification('Failed to load billing settings', 'error');
        }
    }

    async saveBillingSettings() {
        try {
            const settings = {
                autoBillingEnabled: document.getElementById('autoBillingEnabled').checked,
                defaultPaymentDay: parseInt(document.getElementById('defaultPaymentDay').value),
                autoLateFees: document.getElementById('autoLateFees').checked,
                lateFeeAmount: parseFloat(document.getElementById('lateFeeAmount').value),
                lateFeeAfterDays: parseInt(document.getElementById('lateFeeAfterDays').value),
                gracePeriodDays: parseInt(document.getElementById('gracePeriodDays').value)
            };

            // Validation
            if (settings.lateFeeAmount < 0) {
                this.showSettingsError('Late fee amount cannot be negative');
                return;
            }

            if (settings.lateFeeAfterDays < 1) {
                this.showSettingsError('Late fee days must be at least 1');
                return;
            }

            await DataManager.updateBillingSettings(settings);
            ModalManager.closeModal(this.billingSettingsModal);
            this.showNotification('Billing settings saved successfully!', 'success');

            // Reload billing status
            setTimeout(() => {
                this.loadBillingStatus();
            }, 1000);

        } catch (error) {
            console.error('Error saving billing settings:', error);
            this.showSettingsError('Failed to save settings: ' + error.message);
        }
    }

    showSettingsError(message) {
        const errorElement = document.getElementById('billingSettingsError');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    async showCreateBillForm() {
        try {
            // Get tenants and available rooms
            const [tenants, settings] = await Promise.all([
                DataManager.getTenants(this.currentUser.uid),
                DataManager.getBillingSettings()
            ]);

            const tenantOptions = tenants.map(tenant => `
                <option value="${tenant.id}" data-room="${tenant.roomNumber}">
                    ${tenant.name} - ${tenant.roomNumber}
                </option>
            `).join('');

            // NEW: Smart autofill for description (Rent - Month Year)
            const today = new Date();
            const defaultDescription = `Rent - ${today.toLocaleDateString('en-US', { 
                month: 'long', 
                year: 'numeric' 
            })}`;

            const modalContent = `
                <div class="create-bill-modal">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <i class="fas fa-file-invoice-dollar" style="font-size: 3rem; color: var(--success); margin-bottom: 15px;"></i>
                        <h3 style="margin-bottom: 10px;">Create Custom Bill</h3>
                        <p>Generate a one-time bill for a tenant</p>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Tenant *</label>
                        <select id="billTenant" class="form-input" required>
                            <option value="">Select a tenant</option>
                            ${tenantOptions}
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Bill Type *</label>
                        <select id="billType" class="form-input" required>
                            <option value="rent">Monthly Rent</option>
                            <option value="utility">Utility Bill</option>
                            <option value="maintenance">Maintenance Fee</option>
                            <option value="penalty">Penalty Fee</option>
                            <option value="other">Other</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Description *</label>
                        <input type="text" id="billDescription" class="form-input" 
                            value="${defaultDescription}" 
                            placeholder="e.g., Rent - November 2024" required>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Amount (₱) *</label>
                        <input type="number" id="billAmount" class="form-input" 
                            placeholder="0.00" min="0" step="0.01" required>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Due Date *</label>
                        <input type="date" id="billDueDate" class="form-input" required>
                    </div>

                    <!-- Bill Items Section -->
                    <div class="form-group">
                        <label class="form-label">Bill Items</label>
                        <div id="billItemsContainer">
                            <div class="bill-item" style="display: flex; gap: 10px; margin-bottom: 10px;">
                                <input type="text" class="form-input item-description" placeholder="Item description" style="flex: 2;">
                                <input type="number" class="form-input item-amount" placeholder="Amount" min="0" step="0.01" style="flex: 1;">
                                <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove(); casaLink.calculateBillTotal();">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="casaLink.addBillItem()">
                            <i class="fas fa-plus"></i> Add Item
                        </button>
                        <div style="margin-top: 10px;">
                            <strong>Total: ₱<span id="billTotal">0.00</span></strong>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Notes (Optional)</label>
                        <textarea id="billNotes" class="form-input" placeholder="Additional notes about this bill" rows="3"></textarea>
                    </div>

                    <div id="createBillError" style="color: var(--danger); display: none; margin-bottom: 15px;"></div>
                </div>
            `;

            const modal = ModalManager.openModal(modalContent, {
                title: 'Create Custom Bill',
                submitText: 'Create Bill',
                onSubmit: () => this.createCustomBill()
            });

            // Set default due date (payment day of current month)
            const dueDate = new Date(today.getFullYear(), today.getMonth(), settings.defaultPaymentDay);
            document.getElementById('billDueDate').value = dueDate.toISOString().split('T')[0];

            this.createBillModal = modal;

        } catch (error) {
            console.error('Error showing create bill form:', error);
            this.showNotification('Failed to load bill creation form', 'error');
        }
    }


    async autoApplyLateFees() {
        try {
            const settings = await DataManager.getBillingSettings();
            if (settings.autoLateFees) {
                const result = await DataManager.applyLateFees();
                if (result.applied > 0) {
                    console.log(`🤖 Auto-applied late fees to ${result.applied} bills`);
                }
            }
        } catch (error) {
            console.error('Error in auto late fee application:', error);
        }
    }

    setupBillingAutomation() {
        // Check for due bills daily
        setInterval(() => {
            this.checkDueBills();
        }, 24 * 60 * 60 * 1000);

        // Apply late fees weekly
        setInterval(() => {
            this.autoApplyLateFees();
        }, 7 * 24 * 60 * 60 * 1000);
    }

    async applyLateFeesManually() {
        try {
            const confirmed = confirm('Apply late fees to all overdue bills? This will add late fees to bills that are past their due date.');
            
            if (!confirmed) return;

            const result = await DataManager.applyLateFees();
            
            if (result.applied > 0) {
                this.showNotification(`Applied late fees to ${result.applied} bills`, 'success');
                // Refresh bills data
                setTimeout(() => {
                    this.loadBillsData();
                }, 1000);
            } else {
                this.showNotification('No bills eligible for late fees', 'info');
            }

        } catch (error) {
            console.error('Error applying late fees:', error);
            this.showNotification('Failed to apply late fees', 'error');
        }
    }

    showCreateBillError(message) {
        const errorElement = document.getElementById('createBillError');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    async createCustomBill() {
        try {
            const tenantSelect = document.getElementById('billTenant');
            const selectedOption = tenantSelect.options[tenantSelect.selectedIndex];
            
            const billData = {
                tenantId: tenantSelect.value,
                tenantName: selectedOption.text.split(' - ')[0],
                roomNumber: selectedOption.getAttribute('data-room'),
                landlordId: this.currentUser.uid,
                type: document.getElementById('billType').value,
                description: document.getElementById('billDescription').value,
                totalAmount: parseFloat(document.getElementById('billTotal').textContent),
                dueDate: document.getElementById('billDueDate').value,
                notes: document.getElementById('billNotes').value,
                status: 'pending',
                isAutoGenerated: false
            };

            // Collect bill items
            const items = [];
            const mainAmount = parseFloat(document.getElementById('billAmount').value) || 0;
            if (mainAmount > 0) {
                items.push({
                    description: billData.description,
                    amount: mainAmount,
                    type: billData.type
                });
            }

            // Add additional items
            const itemElements = document.querySelectorAll('.bill-item');
            itemElements.forEach(item => {
                const description = item.querySelector('.item-description').value;
                const amount = parseFloat(item.querySelector('.item-amount').value) || 0;
                if (description && amount > 0) {
                    items.push({
                        description: description,
                        amount: amount,
                        type: 'additional'
                    });
                }
            });

            billData.items = items;

            // Validation
            if (!billData.tenantId) {
                this.showCreateBillError('Please select a tenant');
                return;
            }

            if (billData.totalAmount <= 0) {
                this.showCreateBillError('Bill amount must be greater than 0');
                return;
            }

            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
                submitBtn.disabled = true;
            }

            await DataManager.createCustomBill(billData);
            
            ModalManager.closeModal(this.createBillModal);
            this.showNotification('Custom bill created successfully!', 'success');

            // Refresh bills list
            setTimeout(() => {
                this.loadBillsData();
            }, 1000);

        } catch (error) {
            console.error('Error creating custom bill:', error);
            this.showCreateBillError('Failed to create bill: ' + error.message);
            
            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = 'Create Bill';
                submitBtn.disabled = false;
            }
        }
    }


    calculateBillTotal() {
        const amountInputs = document.querySelectorAll('.item-amount');
        let total = parseFloat(document.getElementById('billAmount').value) || 0;
        
        amountInputs.forEach(input => {
            total += parseFloat(input.value) || 0;
        });
        
        document.getElementById('billTotal').textContent = total.toFixed(2);
    }

    addBillItem() {
        const container = document.getElementById('billItemsContainer');
        const itemDiv = document.createElement('div');
        itemDiv.className = 'bill-item';
        itemDiv.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px;';
        itemDiv.innerHTML = `
            <input type="text" class="form-input item-description" placeholder="Item description" style="flex: 2;">
            <input type="number" class="form-input item-amount" placeholder="Amount" min="0" step="0.01" style="flex: 1;">
            <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove(); casaLink.calculateBillTotal();">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(itemDiv);

        // Add event listeners to new amount inputs
        itemDiv.querySelector('.item-amount').addEventListener('input', () => this.calculateBillTotal());
    }

    async exportBills() {
        this.showNotification('Export bills feature coming soon!', 'info');
    }

    editBill(billId) {
        this.showNotification('Edit bill feature coming soon!', 'info');
    }

    deleteBill(billId) {
        this.showNotification('Delete bill feature coming soon!', 'info');
    }

    async loadBillingStatus() {
        try {
            console.log('🔄 Loading billing status...');
            const settings = await DataManager.getBillingSettings();
            const statusElement = document.getElementById('autoBillingStatus');
            
            if (!statusElement) {
                console.warn('⚠️ Billing status element not found');
                return;
            }

            console.log('📊 Billing settings loaded:', settings);
            
            if (settings?.autoBillingEnabled) {
                statusElement.innerHTML = `
                    <div class="card" style="background: rgba(52, 168, 83, 0.1); border-left: 4px solid var(--success); margin-bottom: 20px;">
                        <div class="card-header">
                            <h4 style="color: var(--success); margin: 0;">
                                <i class="fas fa-robot"></i> Automatic Billing Active
                            </h4>
                        </div>
                        <div class="card-body">
                            <p style="margin: 0; color: var(--dark-gray);">
                                <strong>Rental Bills</strong> are automatically generated on the <strong>1st</strong> of each month. <br>
                                If app is <strong>not opened</strong> on the <strong>1st</strong> of the month, <strong>Manually Click</strong> the <strong>"Generate Monthly Bills"</strong> and <strong>"Apply Late Fees"</strong> button to create bills for the month.
                                ${settings.autoLateFees ? `<br><strong>Auto late fees: ₱${settings.lateFeeAmount} ${settings.lateFeeAfterDays}</strong> days after due date` : ''}
                            </p>
                        </div>
                    </div>
                `;
            } else {
                statusElement.innerHTML = `
                    <div class="card" style="background: rgba(251, 188, 4, 0.1); border-left: 4px solid var(--warning); margin-bottom: 20px;">
                        <div class="card-header">
                            <h4 style="color: var(--warning); margin: 0;">
                                <i class="fas fa-robot"></i> Automatic Billing Disabled
                            </h4>
                        </div>
                        <div class="card-body">
                            <p style="margin: 0; color: var(--dark-gray);">
                                Automatic bill generation is turned off. Bills must be generated manually.
                            </p>
                        </div>
                    </div>
                `;
            }
            
            console.log('✅ Billing status loaded successfully');
        } catch (error) {
            console.error('❌ Error loading billing status:', error);
            const statusElement = document.getElementById('autoBillingStatus');
            if (statusElement) {
                statusElement.innerHTML = `
                    <div class="card" style="background: rgba(234, 67, 53, 0.1); border-left: 4px solid var(--danger); margin-bottom: 20px;">
                        <div class="card-header">
                            <h4 style="color: var(--danger); margin: 0;">
                                <i class="fas fa-exclamation-triangle"></i> Billing Settings Error
                            </h4>
                        </div>
                        <div class="card-body">
                            <p style="margin: 0; color: var(--dark-gray);">
                                Failed to load billing settings. Please check your connection.
                            </p>
                        </div>
                    </div>
                `;
            }
        }
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
                                <a href="#" data-page="lease-management">Lease Management</a> 
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
                            <li><a href="#" data-page="lease-management"><i class="fas fa-file-contract"></i> <span>Lease Management</span></a></li>
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
            <div style="position: fixed; top: 20px; right: 20px; z-index: 1000;">
                <button class="btn btn-secondary" onclick="PWAManager.forceInstallPrompt()" 
                        style="padding: 8px 12px; font-size: 0.8rem;">
                    <i class="fas fa-download"></i> Install App
                </button>
            </div>
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

                    <div class="admin-login-link" style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
                        <a href="/admin" style="color: #666; text-decoration: none; font-size: 14px; display: inline-flex; align-items: center; gap: 8px;">
                            <i class="fas fa-user-shield"></i>
                            Access Admin Portal
                        </a>
                        <p style="font-size: 12px; color: #999; margin-top: 5px;">
                            For system administrators only
                        </p>
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

    async viewTenantMaintenanceRequest(requestId) {
        if (!requestId) return;

        try {
            // try to fetch document directly
            let docData = null;
            try {
                const doc = await firebaseDb.collection('maintenance').doc(requestId).get();
                if (doc.exists) docData = { id: doc.id, ...doc.data() };
            } catch (err) {
                console.warn('Could not fetch maintenance doc directly:', err);
            }

            // fallback: search in recently loaded list
            if (!docData && window.DataManager && typeof DataManager.getMaintenanceRequest === 'function') {
                try {
                    docData = await DataManager.getMaintenanceRequest(requestId);
                } catch (e) {
                    console.warn('DataManager.getMaintenanceRequest failed:', e);
                }
            }

            if (!docData) {
                // minimal modal if we can't fetch details
                ModalManager.openModal(`<div style="padding:20px;"><p>Unable to load request details.</p></div>`, { title: 'Request Details', submitText: 'Close' });
                return;
            }

            const imagesHtml = docData.images && docData.images.length ? docData.images.map(url => `<img src="${url}" style="max-width:140px;border-radius:8px;margin-right:8px;border:1px solid #eee;" />`).join('') : '';

            const content = `
                <div style="max-width:800px;">
                    <h3 style="margin-bottom:8px;">${docData.title}</h3>
                    <div class="text-muted" style="margin-bottom:12px;">${docData.type || 'general'} • ${docData.priority || 'medium'} • ${docData.status || 'open'}</div>
                    <div style="margin-bottom:12px;">${docData.description || ''}</div>
                    ${imagesHtml ? `<div style="margin-bottom:12px;">${imagesHtml}</div>` : ''}
                    <div class="text-muted" style="font-size:0.9rem;">Submitted: ${docData.createdAt ? new Date(docData.createdAt).toLocaleString() : '–'}</div>
                    <div style="margin-top:12px;">${docData.notes ? `<strong>Landlord notes:</strong><div style="margin-top:6px;">${docData.notes}</div>` : ''}</div>
                </div>
            `;

            ModalManager.openModal(content, { title: 'Request Details', submitText: 'Close', showFooter: true });

        } catch (error) {
            console.error('Error viewing maintenance request:', error);
            ModalManager.openModal(`<div style="padding:20px;"><p>Unable to show request details.</p></div>`, { title: 'Request Details', submitText: 'Close' });
        }
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
        if (!dueDate) return 'No due date set';
        
        const today = new Date();
        const due = new Date(dueDate);
        const diffTime = due - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Due today';
        if (diffDays === 1) return 'Due tomorrow';
        if (diffDays > 1) return `Due in ${diffDays} days`;
        if (diffDays === -1) return 'Overdue by 1 day';
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

    debugBillingCards() {
        const cardIds = ['pendingBillsCount', 'overdueBillsCount', 'monthlyRevenue', 'totalBillsCount'];
        cardIds.forEach(id => {
            const element = document.getElementById(id);
            console.log(`🔍 ${id}:`, element ? 'FOUND' : 'NOT FOUND');
        });
    }

    updateCard(elementId, value) {
        try {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = value;
                console.log(`✅ Updated ${elementId}: ${value}`);
            } else {
                console.warn(`⚠️ Element not found: ${elementId}`);
            }
        } catch (error) {
            console.error(`❌ Error updating card ${elementId}:`, error);
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
        
        // Format the next due date properly
        if (stats.nextDueDate) {
            const dueDate = new Date(stats.nextDueDate);
            this.updateCard('nextDueDate', dueDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
            }));
        } else {
            this.updateCard('nextDueDate', 'Not set');
        }
        
        this.updateCard('lastPaymentAmount', `₱${(stats.lastPaymentAmount || 0).toLocaleString()}`);
        
        // Format last payment date
        if (stats.lastPaymentDate) {
            const paymentDate = new Date(stats.lastPaymentDate);
            this.updateCard('lastPaymentDate', `Paid on ${paymentDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
            })}`);
        } else {
            this.updateCard('lastPaymentDate', 'No payments yet');
        }
        
        // MAINTENANCE
        this.updateCard('openRequests', stats.openMaintenance || 0);
        this.updateCard('recentUpdates', stats.recentUpdates || 0);
        
        this.updateLoadingStates();
    }

   updateLandlordDashboard(stats) {
        if (!stats) {
            console.log('❌ No stats data available for dashboard');
            this.showDashboardErrorState();
            return;
        }
        
        console.log('🔄 Updating landlord dashboard with stats:', stats);
        
        try {
            // PROPERTY OVERVIEW
            this.updateCard('occupancyRate', `${stats.occupancyRate}%`);
            this.updateCard('vacantUnits', stats.vacantUnits);
            this.updateCard('occupancyDetails', `${stats.occupiedUnits}/${stats.totalUnits} units`);
            this.updateCard('totalTenants', stats.totalOccupants || stats.totalTenants); // UPDATED LINE
            this.updateCard('averageRent', `₱${stats.averageRent.toLocaleString()}`);
            
            // FINANCIAL OVERVIEW
            this.updateCard('collectionRate', `${stats.collectionRate}%`);
            this.updateCard('monthlyRevenue', `₱${stats.totalRevenue.toLocaleString()}`);
            this.updateCard('latePayments', stats.latePayments);
            this.updateCard('unpaidBills', stats.unpaidBills);
            
            // OPERATIONS
            this.updateCard('upcomingRenewals', stats.upcomingRenewals);
            this.updateCard('openMaintenance', stats.openMaintenance);
            this.updateCard('maintenanceBacklog', stats.maintenanceBacklog);
            
            this.updateLoadingStates();
            console.log('✅ Dashboard updated successfully');
            
        } catch (error) {
            console.error('❌ Error updating dashboard:', error);
            this.showDashboardErrorState();
        }
    }


    setupRealTimeStats() {
        console.log('🔄 Setting up real-time dashboard stats...');
        
        // Refresh data every 30 seconds when on dashboard
        this.dashboardInterval = setInterval(() => {
            if (this.currentRole === 'landlord' && this.currentPage === 'dashboard') {
                console.log('🔄 Auto-refreshing dashboard data...');
                this.loadDashboardData();
            }
        }, 30000); // 30 seconds
        
        // Set up Firestore listeners for real-time updates
        this.setupFirestoreListeners();
    }

    cleanupDashboardListeners() {
        console.log('🧹 Cleaning up dashboard listeners...');
        
        // Remove tenant row click handlers (if using the container-specific approach)
        this.removeTenantRowClickHandlers();
        
        // Remove Firestore listeners
        if (this.tenantsListener) {
            this.tenantsListener();
            this.tenantsListener = null;
        }
        if (this.leasesListener) {
            this.leasesListener();
            this.leasesListener = null;
        }
        if (this.billsListener) {
            this.billsListener();
            this.billsListener = null;
        }
        if (this.maintenanceListener) {
            this.maintenanceListener();
            this.maintenanceListener = null;
        }
        if (this.dashboardInterval) {
            clearInterval(this.dashboardInterval);
            this.dashboardInterval = null;
        }
        
        console.log('✅ Dashboard listeners cleaned up');
    }

    setupFirestoreListeners() {
        if (this.currentRole !== 'landlord') return;
        
        console.log('👂 Setting up Firestore listeners for real-time updates...');
        
        try {
            // Listen for tenant changes
            this.tenantsListener = firebaseDb.collection('users')
                .where('landlordId', '==', this.currentUser.uid)
                .where('role', '==', 'tenant')
                .onSnapshot((snapshot) => {
                    console.log('👥 Tenants data changed, refreshing dashboard...');
                    if (this.currentPage === 'dashboard') {
                        this.loadDashboardData();
                    }
                }, (error) => {
                    console.error('❌ Tenants listener error:', error);
                });
            
            // Listen for lease changes
            this.leasesListener = firebaseDb.collection('leases')
                .where('landlordId', '==', this.currentUser.uid)
                .onSnapshot((snapshot) => {
                    console.log('📄 Leases data changed, refreshing dashboard...');
                    if (this.currentPage === 'dashboard') {
                        this.loadDashboardData();
                    }
                }, (error) => {
                    console.error('❌ Leases listener error:', error);
                });
            
            // Listen for bill changes
            this.billsListener = firebaseDb.collection('bills')
                .where('landlordId', '==', this.currentUser.uid)
                .onSnapshot((snapshot) => {
                    console.log('💰 Bills data changed, refreshing dashboard...');
                    if (this.currentPage === 'dashboard') {
                        this.loadDashboardData();
                    }
                }, (error) => {
                    console.error('❌ Bills listener error:', error);
                });
                
            // Listen for maintenance changes
            this.maintenanceListener = firebaseDb.collection('maintenance')
                .where('landlordId', '==', this.currentUser.uid)
                .onSnapshot((snapshot) => {
                    console.log('🔧 Maintenance data changed, refreshing dashboard...');
                    if (this.currentPage === 'dashboard') {
                        this.loadDashboardData();
                    }
                }, (error) => {
                    console.error('❌ Maintenance listener error:', error);
                });
                
            console.log('✅ All Firestore listeners set up successfully');
            
        } catch (error) {
            console.error('❌ Error setting up Firestore listeners:', error);
        }
    }

    updateCard(elementId, value) {
        try {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = value;
                console.log(`✅ Updated ${elementId}: ${value}`);
            } else {
                console.warn(`⚠️ Element not found: ${elementId}`);
            }
        } catch (error) {
            console.error(`❌ Error updating card ${elementId}:`, error);
        }
    }

    showPaymentError(message) {
        const errorElement = document.getElementById('paymentError');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    async processPayment(billId, bill) {
        const paymentMethod = document.querySelector('.payment-method-option.selected')?.getAttribute('data-method');
        const referenceNumber = document.getElementById('paymentReference')?.value;
        const paymentDate = document.getElementById('paymentDate')?.value;
        const paymentAmount = parseFloat(document.getElementById('paymentAmount')?.value);
        const notes = document.getElementById('paymentNotes')?.value;
        const errorElement = document.getElementById('paymentError');
        
        // Reset error
        if (errorElement) {
            errorElement.style.display = 'none';
            errorElement.textContent = '';
        }
        
        // Validation
        if (!paymentMethod) {
            this.showPaymentError('Please select a payment method');
            return;
        }
        
        if (!paymentDate) {
            this.showPaymentError('Please select payment date');
            return;
        }
        
        if (!paymentAmount || paymentAmount <= 0) {
            this.showPaymentError('Please enter a valid payment amount');
            return;
        }
        
        try {
            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
                submitBtn.disabled = true;
            }
            
            const paymentData = {
                billId: billId,
                tenantId: bill.tenantId,
                landlordId: this.currentUser.uid,
                tenantName: bill.tenantName,
                roomNumber: bill.roomNumber,
                amount: paymentAmount,
                paymentMethod: paymentMethod,
                referenceNumber: referenceNumber,
                paymentDate: paymentDate,
                notes: notes,
                billAmount: bill.totalAmount,
                createdAt: new Date().toISOString()
            };
            
            // Save payment
            await DataManager.recordPayment(paymentData);
            
            // Close modal and notify user
            ModalManager.closeModal(document.querySelector('.modal-overlay'));
            this.showNotification('Payment recorded successfully!', 'success');
            
            // Refresh both bills & payments + stats
            setTimeout(() => {
                if (this.currentBillingTab === 'bills') {
                    this.loadBillsData();
                } else {
                    this.loadPaymentsData();
                }

                // Update the metrics for both tabs
                this.loadBillingStats();
                this.loadPaymentStats();
            }, 1000);

        } catch (error) {
            console.error('Error processing payment:', error);
            this.showPaymentError('Failed to record payment: ' + error.message);
            
            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = 'Record Payment';
                submitBtn.disabled = false;
            }
        }
    }

    switchBillingTab(tabName) {
        console.log('🔄 Switching to tab:', tabName);
        
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active');
            if (button.getAttribute('data-tab') === tabName) {
                button.classList.add('active');
            }
        });
        
        // Update tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
            if (content.id === tabName + 'Tab') {
                content.classList.add('active');
            }
        });
        
        this.currentBillingTab = tabName;
        
        // Load data for the selected tab
        this.loadTabData(tabName);
    }

    // Load data for specific tab
    loadTabData(tabName) {
        switch (tabName) {
            case 'bills':
                this.loadBillsData();
                this.loadBillingStats();
                break;
            case 'payments':
                this.loadPaymentsData();
                this.loadPaymentStats();
                break;
        }
    }

    // Update payment statistics
    async loadPaymentStats() {
        try {
            const payments = await DataManager.getPayments(this.currentUser.uid);
            
            const totalCollected = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
            
            // Calculate monthly collected (current month)
            const today = new Date();
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            
            const monthlyCollected = payments
                .filter(payment => {
                    const paymentDate = new Date(payment.paymentDate || payment.createdAt);
                    return paymentDate.getMonth() === currentMonth && 
                        paymentDate.getFullYear() === currentYear;
                })
                .reduce((sum, payment) => sum + (payment.amount || 0), 0);
            
            const totalTransactions = payments.length;
            const averagePayment = totalTransactions > 0 ? totalCollected / totalTransactions : 0;
            
            // Update the payment stats cards
            this.updateCard('totalCollected', `₱${totalCollected.toLocaleString()}`);
            this.updateCard('monthlyCollected', `₱${monthlyCollected.toLocaleString()}`);
            this.updateCard('totalTransactions', totalTransactions.toString());
            this.updateCard('averagePayment', `₱${Math.round(averagePayment).toLocaleString()}`);
            
        } catch (error) {
            console.error('Error loading payment stats:', error);
        }
    }

    // Update tab badges with counts
    updateTabBadges(bills, payments) {
        const billsTabCount = document.getElementById('billsTabCount');
        const paymentsTabCount = document.getElementById('paymentsTabCount');
        
        if (billsTabCount) {
            billsTabCount.textContent = bills.length.toString();
        }
        
        if (paymentsTabCount) {
            paymentsTabCount.textContent = payments.length.toString();
        }
    }

    getCurrentPaymentsPage() {
        const startIndex = (this.paymentsCurrentPage - 1) * this.paymentsItemsPerPage;
        const endIndex = startIndex + this.paymentsItemsPerPage;
        return this.paymentsFilteredData.slice(startIndex, endIndex);
    }

    updatePaymentsPaginationControls() {
        const pageNumbers = document.getElementById('paymentsPageNumbers');
        if (!pageNumbers) return;
        
        pageNumbers.innerHTML = '';
        
        // Show page numbers (max 5 pages)
        const startPage = Math.max(1, this.paymentsCurrentPage - 2);
        const endPage = Math.min(this.paymentsTotalPages, startPage + 4);
        
        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.className = `btn btn-sm ${i === this.paymentsCurrentPage ? 'btn-primary' : 'btn-secondary'}`;
            pageButton.textContent = i;
            pageButton.onclick = () => {
                this.paymentsCurrentPage = i;
                this.updatePaymentsTable(this.getCurrentPaymentsPage());
                this.updatePaymentsPaginationControls();
            };
            pageNumbers.appendChild(pageButton);
        }
        
        // Update button states
        const prevButton = document.getElementById('paymentsPrevPage');
        const nextButton = document.getElementById('paymentsNextPage');
        
        if (prevButton) prevButton.disabled = this.paymentsCurrentPage === 1;
        if (nextButton) nextButton.disabled = this.paymentsCurrentPage === this.paymentsTotalPages;
    }


    setupPaymentsPagination() {
        const paginationContainer = document.getElementById('paymentsPagination');
        if (!paginationContainer) return;
        
        // Show pagination if we have multiple pages
        if (this.paymentsTotalPages > 1) {
            paginationContainer.style.display = 'flex';
            this.updatePaymentsPaginationControls();
        } else {
            paginationContainer.style.display = 'none';
        }
        
        // Event listeners for pagination buttons
        const prevButton = document.getElementById('paymentsPrevPage');
        const nextButton = document.getElementById('paymentsNextPage');
        
        if (prevButton) {
            prevButton.onclick = () => {
                if (this.paymentsCurrentPage > 1) {
                    this.paymentsCurrentPage--;
                    this.updatePaymentsTable(this.getCurrentPaymentsPage());
                    this.updatePaymentsPaginationControls();
                }
            };
        }
        
        if (nextButton) {
            nextButton.onclick = () => {
                if (this.paymentsCurrentPage < this.paymentsTotalPages) {
                    this.paymentsCurrentPage++;
                    this.updatePaymentsTable(this.getCurrentPaymentsPage());
                    this.updatePaymentsPaginationControls();
                }
            };
        }
    }

    async loadPaymentsData() {
        try {
            console.log('🔄 Loading payments data...');
            const payments = await DataManager.getPayments(this.currentUser.uid);
            this.paymentsAllData = payments;
            this.paymentsFilteredData = [...payments];
            this.paymentsCurrentPage = 1;
            this.paymentsTotalPages = Math.ceil(payments.length / this.paymentsItemsPerPage);
            
            this.updatePaymentsTable(this.getCurrentPaymentsPage());
            this.updatePaymentStats(payments);
            this.setupPaymentsPagination();
            
            console.log('✅ Payments data loaded and pagination set up');
        } catch (error) {
            console.error('Error loading payments:', error);
            this.showNotification('Failed to load payments', 'error');
        }
    }

    updateTabBadges(bills, payments) {
        const billsTabCount = document.getElementById('billsTabCount');
        const paymentsTabCount = document.getElementById('paymentsTabCount');
        
        if (billsTabCount) {
            billsTabCount.textContent = bills.length.toString();
        }
        
        if (paymentsTabCount) {
            paymentsTabCount.textContent = payments.length.toString();
        }
        
        console.log('📊 Tab badges updated:', {
            bills: bills.length,
            payments: payments.length
        });
    }

    updatePaymentStats(payments) {
        try {
            console.log('💰 Updating payment stats with:', payments.length, 'payments');
            
            const totalCollected = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
            
            // Calculate monthly collected (current month)
            const today = new Date();
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            
            const monthlyCollected = payments
                .filter(payment => {
                    const paymentDate = new Date(payment.paymentDate || payment.createdAt);
                    return paymentDate.getMonth() === currentMonth && 
                        paymentDate.getFullYear() === currentYear;
                })
                .reduce((sum, payment) => sum + (payment.amount || 0), 0);
            
            const totalTransactions = payments.length;
            const averagePayment = totalTransactions > 0 ? totalCollected / totalTransactions : 0;
            
            // Update the payment stats cards
            this.updateCard('totalCollected', `₱${totalCollected.toLocaleString()}`);
            this.updateCard('monthlyCollected', `₱${monthlyCollected.toLocaleString()}`);
            this.updateCard('totalTransactions', totalTransactions.toString());
            this.updateCard('averagePayment', `₱${Math.round(averagePayment).toLocaleString()}`);
            
            console.log('✅ Payment stats updated successfully');
            
        } catch (error) {
            console.error('❌ Error updating payment stats:', error);
        }
    }

    async loadBillingStats() {
    try {
        console.log('📊 Loading billing stats...');
        const bills = await DataManager.getBillsWithTenants(this.currentUser.uid);
        const payments = await DataManager.getPayments(this.currentUser.uid);
        
        this.updateBillingStats(bills);
        
        // Update payment stats
        if (payments && Array.isArray(payments)) {
            this.updatePaymentStats(payments);
        }
        
        // 🔥 UPDATE THE VIEW BADGES
        this.updateViewBadges(bills, payments || []);
        
        console.log('✅ Billing stats loaded successfully');
    } catch (error) {
        console.error('❌ Error loading billing stats:', error);
    }
}


    setupPaymentMethodSelection() {
        const methodOptions = document.querySelectorAll('.payment-method-option');
        let selectedMethod = null;
        
        methodOptions.forEach(option => {
            option.addEventListener('click', () => {
                methodOptions.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                selectedMethod = option.getAttribute('data-method');
            });
        });
    }

    async recordPaymentModal(billId) {
        try {
            const billDoc = await firebaseDb.collection('bills').doc(billId).get();
            if (!billDoc.exists) {
                this.showNotification('Bill not found', 'error');
                return;
            }
            
            const bill = { id: billDoc.id, ...billDoc.data() };
            const paymentMethods = await DataManager.getPaymentMethods();
            
            const paymentMethodsHTML = paymentMethods.map(method => `
                <div class="payment-method-option" data-method="${method.id}">
                    <i class="${method.icon}"></i>
                    <span>${method.name}</span>
                </div>
            `).join('');
            
            const modalContent = `
                <div class="payment-modal">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <i class="fas fa-credit-card" style="font-size: 3rem; color: var(--success); margin-bottom: 15px;"></i>
                        <h3 style="margin-bottom: 10px;">Record Payment</h3>
                        <p>Record payment for <strong>${bill.tenantName}</strong></p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: var(--royal-blue);">Bill Details</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div><strong>Amount:</strong> ₱${(bill.totalAmount || 0).toLocaleString()}</div>
                            <div><strong>Due Date:</strong> ${new Date(bill.dueDate).toLocaleDateString()}</div>
                            <div><strong>Room:</strong> ${bill.roomNumber || 'N/A'}</div>
                            <div><strong>Description:</strong> ${bill.description || 'Monthly Rent'}</div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Payment Method *</label>
                        <div class="payment-methods-grid">
                            ${paymentMethodsHTML}
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Reference Number</label>
                        <input type="text" id="paymentReference" class="form-input" placeholder="Transaction ID, receipt number, etc.">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Payment Date *</label>
                        <input type="date" id="paymentDate" class="form-input" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Amount Paid *</label>
                        <input type="number" id="paymentAmount" class="form-input" value="${bill.totalAmount || 0}" step="0.01" min="0">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Notes (Optional)</label>
                        <textarea id="paymentNotes" class="form-input" placeholder="Additional notes about this payment" rows="3"></textarea>
                    </div>
                    
                    <div id="paymentError" style="color: var(--danger); display: none; margin-bottom: 15px;"></div>
                </div>
            `;
            
            const modal = ModalManager.openModal(modalContent, {
                title: 'Record Payment',
                submitText: 'Record Payment',
                onSubmit: () => this.processPayment(billId, bill)
            });
            
            this.setupPaymentMethodSelection();
            
        } catch (error) {
            console.error('Error showing payment modal:', error);
            this.showNotification('Failed to load payment form', 'error');
        }
    }

    async updateBillsTable(bills) {
        const billsList = document.getElementById('billsList');
        if (!billsList) return;
        
        if (bills.length === 0) {
            billsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-invoice-dollar"></i>
                    <h3>No Bills Found</h3>
                    <p>No bills have been created yet. Generate monthly bills or create a custom bill.</p>
                    <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                        <button class="btn btn-primary" onclick="casaLink.forceGenerateBills()">
                            Generate Monthly Bills
                        </button>
                        <button class="btn btn-secondary" onclick="casaLink.showCreateBillForm()">
                            Create Custom Bill
                        </button>
                    </div>
                </div>
            `;
            return;
        }
        
        // Fetch tenant occupations for all bills
        const billsWithOccupations = await this.enrichBillsWithOccupations(bills);
        billsList.innerHTML = this.renderBillsTable(billsWithOccupations);
    }

    async enrichBillsWithOccupations(bills) {
        try {
            const enrichedBills = await Promise.all(
                bills.map(async (bill) => {
                    try {
                        // Try to get tenant data to fetch occupation
                        if (bill.tenantId) {
                            const tenantDoc = await firebaseDb.collection('users').doc(bill.tenantId).get();
                            if (tenantDoc.exists) {
                                const tenantData = tenantDoc.data();
                                return {
                                    ...bill,
                                    tenantOccupation: tenantData.occupation || 'No occupation specified'
                                };
                            }
                        }
                    } catch (error) {
                        console.warn(`Could not fetch occupation for tenant ${bill.tenantId}:`, error);
                    }
                    
                    // Fallback: use existing data or placeholder
                    return {
                        ...bill,
                        tenantOccupation: bill.tenantOccupation || bill.occupation || 'No occupation specified'
                    };
                })
            );
            
            return enrichedBills;
        } catch (error) {
            console.error('Error enriching bills with occupations:', error);
            return bills.map(bill => ({
                ...bill,
                tenantOccupation: bill.tenantOccupation || bill.occupation || 'No occupation specified'
            }));
        }
    }

    async showBillDetailsModal(billId) {
        try {
            console.log('📄 Loading bill details for:', billId);
            
            // Show loading state
            const modalContent = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--royal-blue);"></i>
                    <p>Loading bill details...</p>
                </div>
            `;

            const modal = ModalManager.openModal(modalContent, {
                title: 'Bill Details',
                showFooter: false
            });

            // Fetch bill data
            const billDoc = await firebaseDb.collection('bills').doc(billId).get();
            
            if (!billDoc.exists) {
                ModalManager.closeModal(modal);
                this.showNotification('Bill not found', 'error');
                return;
            }

            const bill = { id: billDoc.id, ...billDoc.data() };
            
            // Generate bill details content
            const billDetailsContent = this.generateBillDetailsContent(bill);
            
            // Update modal content
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = billDetailsContent;
            }

            // Add footer with close button
            const modalFooter = modal.querySelector('.modal-footer');
            if (!modalFooter) {
                const footer = document.createElement('div');
                footer.className = 'modal-footer';
                footer.innerHTML = `
                    <button class="btn btn-primary" onclick="ModalManager.closeModal(this.closest('.modal-overlay'))">
                        Close
                    </button>
                    ${bill.status !== 'paid' ? `
                        <button class="btn btn-success" onclick="casaLink.recordPaymentModal('${bill.id}')">
                            <i class="fas fa-credit-card"></i> Record Payment
                        </button>
                    ` : ''}
                `;
                modal.querySelector('.modal-content').appendChild(footer);
            }

        } catch (error) {
            console.error('❌ Error loading bill details:', error);
            this.showNotification('Failed to load bill details', 'error');
        }
    }

    generateBillDetailsContent(bill) {
        const dueDate = new Date(bill.dueDate);
        const createdDate = new Date(bill.createdAt);
        const paidDate = bill.paidDate ? new Date(bill.paidDate) : null;
        
        // Fix bill type display
        const billType = bill.type || 'rent';
        const typeDisplay = billType.charAt(0).toUpperCase() + billType.slice(1).replace('_', ' ');
        
        // Calculate days status
        const today = new Date();
        const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
        const daysUntilDue = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));
        
        let dueStatus = '';
        if (bill.status === 'paid') {
            dueStatus = `<span style="color: var(--success);">Paid on ${paidDate.toLocaleDateString()}</span>`;
        } else if (daysOverdue > 0) {
            dueStatus = `<span style="color: var(--danger);">Overdue by ${daysOverdue} days</span>`;
        } else if (daysUntilDue === 0) {
            dueStatus = `<span style="color: var(--warning);">Due today</span>`;
        } else {
            dueStatus = `<span style="color: var(--royal-blue);">Due in ${daysUntilDue} days</span>`;
        }

        // Generate bill items HTML
        const billItemsHTML = bill.items && bill.items.length > 0 ? 
            bill.items.map(item => `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
                    <div>${item.description}</div>
                    <div style="font-weight: 600;">₱${(item.amount || 0).toLocaleString()}</div>
                </div>
            `).join('') : `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
                    <div>${bill.description || 'Monthly Rent'}</div>
                    <div style="font-weight: 600;">₱${(bill.totalAmount || 0).toLocaleString()}</div>
                </div>
            `;

        return `
            <div class="bill-details-modal" style="max-height: 70vh; overflow-y: auto;">
                <!-- Bill Header -->
                <div style="background: linear-gradient(135deg, var(--royal-blue), #101b4a); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h3 style="margin: 0 0 5px 0;">${bill.description || 'Monthly Rent'}</h3>
                            <p style="margin: 0; opacity: 0.9;">Bill #${bill.id.substring(0, 8)}</p>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 1.8rem; font-weight: 700;">₱${(bill.totalAmount || 0).toLocaleString()}</div>
                            <div style="opacity: 0.9;">Total Amount</div>
                        </div>
                    </div>
                </div>

                <!-- Bill Information Grid -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid var(--royal-blue);">
                        <div style="font-size: 0.9rem; color: var(--dark-gray); margin-bottom: 5px;">Status</div>
                        <div style="font-size: 1.1rem; font-weight: 600; color: var(--royal-blue);">
                            ${this.getBillStatusBadge(bill).replace('status-badge', 'status-badge-large')}
                        </div>
                    </div>
                    
                    <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid var(--warning);">
                        <div style="font-size: 0.9rem; color: var(--dark-gray); margin-bottom: 5px;">Due Date</div>
                        <div style="font-size: 1.1rem; font-weight: 600; color: var(--warning);">
                            ${dueDate.toLocaleDateString()}
                        </div>
                        <div style="font-size: 0.8rem; margin-top: 5px;">${dueStatus}</div>
                    </div>
                    
                    <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid var(--info);">
                        <div style="font-size: 0.9rem; color: var(--dark-gray); margin-bottom: 5px;">Bill Type</div>
                        <div style="font-size: 1.1rem; font-weight: 600; color: var(--info);">
                            ${typeDisplay}
                        </div>
                        <div style="font-size: 0.8rem; margin-top: 5px;">
                            ${bill.isAutoGenerated ? 'Auto-generated' : 'Manual'}
                        </div>
                    </div>
                </div>

                <!-- Tenant Information -->
                <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: var(--royal-blue); margin-bottom: 15px; border-bottom: 2px solid var(--royal-blue); padding-bottom: 8px;">
                        <i class="fas fa-user"></i> Tenant Information
                    </h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <strong>Tenant Name:</strong><br>
                            ${bill.tenantName || 'N/A'}
                        </div>
                        <div>
                            <strong>Room Number:</strong><br>
                            ${bill.roomNumber || 'N/A'}
                        </div>
                    </div>
                </div>

                <!-- Bill Items -->
                <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: var(--royal-blue); margin-bottom: 15px; border-bottom: 2px solid var(--royal-blue); padding-bottom: 8px;">
                        <i class="fas fa-receipt"></i> Bill Items
                    </h4>
                    ${billItemsHTML}
                    <div style="display: flex; justify-content: space-between; padding: 12px 0; border-top: 2px solid var(--royal-blue); margin-top: 10px; font-weight: 700; font-size: 1.1rem;">
                        <div>Total Amount:</div>
                        <div>₱${(bill.totalAmount || 0).toLocaleString()}</div>
                    </div>
                </div>

                <!-- Payment Information (if paid) -->
                ${bill.status === 'paid' ? `
                    <div style="background: rgba(52, 168, 83, 0.1); padding: 20px; border-radius: 8px; border-left: 4px solid var(--success);">
                        <h4 style="color: var(--success); margin-bottom: 15px;">
                            <i class="fas fa-check-circle"></i> Payment Information
                        </h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div>
                                <strong>Paid Date:</strong><br>
                                ${paidDate.toLocaleDateString()}
                            </div>
                            <div>
                                <strong>Payment Method:</strong><br>
                                ${bill.paymentMethod || 'Not specified'}
                            </div>
                            ${bill.paymentReference ? `
                                <div>
                                    <strong>Reference Number:</strong><br>
                                    ${bill.paymentReference}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}

                <!-- Bill Metadata -->
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; font-size: 0.9rem; color: var(--dark-gray);">
                    <strong>Bill Metadata:</strong><br>
                    • Created: ${createdDate.toLocaleDateString()} at ${createdDate.toLocaleTimeString()}<br>
                    • Bill ID: ${bill.id}<br>
                    • ${bill.isAutoGenerated ? 'Automatically generated by system' : 'Manually created by landlord'}
                </div>
            </div>
        `;
    }

    // Helper method for larger status badges
    getBillStatusBadge(bill) {
        const today = new Date();
        const dueDate = new Date(bill.dueDate);
        
        if (bill.status === 'paid') {
            return '<span class="status-badge active">Paid</span>';
        } else if (dueDate < today) {
            return '<span class="status-badge warning">Overdue</span>';
        } else {
            return '<span class="status-badge inactive">Pending</span>';
        }
    }

    setupBillRowClickHandlers() {
        // Remove existing handlers first
        this.removeBillRowClickHandlers();
        
        this.billRowClickHandler = (e) => {
            const billRow = e.target.closest('.bill-row');
            if (billRow) {
                const billId = billRow.getAttribute('data-bill-id');
                if (billId) {
                    this.showBillDetailsModal(billId);
                }
            }
        };
        
        document.addEventListener('click', this.billRowClickHandler);
    }

    removeBillRowClickHandlers() {
        if (this.billRowClickHandler) {
            document.removeEventListener('click', this.billRowClickHandler);
            this.billRowClickHandler = null;
        }
    }

    renderBillsTable(bills) {
        return `
            <div class="table-container">
                <table class="tenants-table">
                    <thead>
                        <tr>
                            <th>Tenant</th>
                            <th>Room</th>
                            <th>Description</th>
                            <th>Amount</th>
                            <th>Due Date</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bills.map(bill => {
                            const isOverdue = bill.status === 'pending' && new Date(bill.dueDate) < new Date();
                            const statusBadge = this.getBillStatusBadge(bill);
                            
                            // Fix the description display
                            const billType = bill.type || 'rent';
                            const typeDisplay = billType.charAt(0).toUpperCase() + billType.slice(1).replace('_', ' ');
                            const isAutoGenerated = bill.isAutoGenerated;
                            
                            return `
                                <tr class="bill-row" data-bill-id="${bill.id}" style="cursor: pointer;">
                                    <td>
                                        <div class="tenant-info">
                                            <div class="tenant-avatar">${bill.tenantName?.charAt(0)?.toUpperCase() || 'T'}</div>
                                            <div class="tenant-details">
                                                <div class="tenant-name">${bill.tenantName || 'N/A'}</div>
                                                <small style="color: var(--dark-gray); font-size: 0.8rem;">
                                                    ${bill.roomNumber || 'No room assigned'}
                                                </small>
                                            </div>
                                        </div>
                                    </td>
                                    <td>${bill.roomNumber || 'N/A'}</td>
                                    <td>
                                        <div style="font-weight: 500;">${bill.description || 'Monthly Rent'}</div>
                                        <small style="color: var(--dark-gray);">
                                            ${typeDisplay} ${isAutoGenerated ? '(Auto-generated)' : '(Manual)'}
                                        </small>
                                    </td>
                                    <td style="font-weight: 600; color: var(--royal-blue);">
                                        ₱${(bill.totalAmount || 0).toLocaleString()}
                                    </td>
                                    <td>
                                        <div>${new Date(bill.dueDate).toLocaleDateString()}</div>
                                        ${isOverdue ? `
                                            <small style="color: var(--danger); font-weight: 500;">
                                                ${this.getDaysOverdue(bill.dueDate)} days overdue
                                            </small>
                                        ` : ''}
                                    </td>
                                    <td>
                                        ${statusBadge}
                                    </td>
                                    <td>
                                        <div class="action-buttons">
                                            ${bill.status !== 'paid' ? `
                                                <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); casaLink.recordPaymentModal('${bill.id}')">
                                                    <i class="fas fa-credit-card"></i> Pay
                                                </button>
                                            ` : ''}
                                            ${bill.status !== 'paid' ? `
                                                <button class="btn btn-sm btn-warning" onclick="event.stopPropagation(); casaLink.editBill('${bill.id}')">
                                                    <i class="fas fa-edit"></i>
                                                </button>
                                            ` : ''}
                                            <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); casaLink.deleteBill('${bill.id}')">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    getBillStatusBadge(bill) {
        const today = new Date();
        const dueDate = new Date(bill.dueDate);
        
        if (bill.status === 'paid') {
            return '<span class="status-badge active">Paid</span>';
        } else if (dueDate < today) {
            return '<span class="status-badge warning">Overdue</span>';
        } else {
            return '<span class="status-badge inactive">Pending</span>';
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

    async notifyLandlordOfPayment(paymentData) {
        try {
            const notification = {
                type: 'payment_submitted',
                title: 'New Payment Submitted',
                message: `${paymentData.tenantName} from Room ${paymentData.roomNumber} submitted a payment of ₱${paymentData.amount.toLocaleString()}`,
                paymentId: paymentData.id,
                billId: paymentData.billId,
                tenantId: paymentData.tenantId,
                landlordId: paymentData.landlordId,
                read: false,
                createdAt: new Date().toISOString(),
                actionRequired: true
            };
            
            await firebaseDb.collection('notifications').add(notification);
            
            // You can also integrate with sendpulseService here if needed
            if (typeof sendpulseService !== 'undefined' && sendpulseService.notifyLandlord) {
                await sendpulseService.notifyLandlord(paymentData.landlordId, {
                    subject: 'New Payment Submission - Verification Required',
                    message: `Tenant ${paymentData.tenantName} has submitted a payment for verification. Please review the payment details in your CasaLink dashboard.`
                });
            }
            
        } catch (error) {
            console.error('Error notifying landlord:', error);
            // Don't throw error here as it shouldn't block the payment process
        }
    }

    showPaymentError(message) {
        const errorElement = document.getElementById('paymentError');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            
            // Scroll to error message
            errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            // Fallback if error element doesn't exist
            this.showNotification(message, 'error');
        }
    }

    async forceGenerateBills() {
        try {
            console.log('🔄 Force generating monthly bills...');
            
            // Clear the generation flag to force creation
            const today = new Date();
            localStorage.removeItem(`bills_generated_${today.getFullYear()}_${today.getMonth()}`);
            
            const result = await DataManager.generateMonthlyBills();
            
            if (!result) {
                throw new Error('Bill generation returned no result');
            }
            
            console.log('📊 Bill generation result:', result);
            
            if (result.generated === 0 && result.skipped > 0) {
                this.showNotification(
                    `All bills already generated for this month (${result.skipped} bills)`, 
                    'info'
                );
            } else if (result.generated > 0) {
                this.showNotification(
                    `Generated ${result.generated} new bills, ${result.skipped} already existed`, 
                    'success'
                );
            } else {
                this.showNotification(
                    `No bills generated. ${result.skipped} existing, ${result.errors} errors`,
                    'warning'
                );
            }
            
            // Refresh bills data
            setTimeout(() => {
                this.loadBillsData();
            }, 1000);
            
        } catch (error) {
            console.error('❌ Failed to generate bills:', error);
            this.showNotification('Failed to generate bills: ' + error.message, 'error');
        }
    }

    async processPayment(billId, bill) {
        const paymentMethod = document.getElementById('selectedPaymentMethod')?.value;
        const referenceNumber = document.getElementById('paymentReference')?.value;
        const paymentDate = document.getElementById('paymentDate')?.value;
        const paymentAmount = parseFloat(document.getElementById('paymentAmount')?.value);
        const notes = document.getElementById('paymentNotes')?.value;
        const errorElement = document.getElementById('paymentError');
        
        // Reset error
        if (errorElement) {
            errorElement.style.display = 'none';
            errorElement.textContent = '';
        }
        
        // Validation
        if (!paymentMethod) {
            this.showPaymentError('Please select a payment method');
            return;
        }
        
        if (!paymentDate) {
            this.showPaymentError('Please select payment date');
            return;
        }
        
        if (!paymentAmount || paymentAmount <= 0) {
            this.showPaymentError('Please enter a valid payment amount');
            return;
        }
        
        // Validate reference number for digital payment methods
        const digitalMethods = ['gcash', 'maya', 'bank_transfer'];
        if (digitalMethods.includes(paymentMethod) && (!referenceNumber || referenceNumber.trim() === '')) {
            this.showPaymentError('Reference number is required for ' + paymentMethod.toUpperCase() + ' payments');
            return;
        }
        
        try {
            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
                submitBtn.disabled = true;
            }
            
            // Check if user is tenant or landlord
            const isTenant = this.currentUser.userType === 'tenant';
            
            const paymentData = {
                billId: billId,
                tenantId: bill.tenantId,
                landlordId: bill.landlordId || this.currentUser.uid,
                tenantName: bill.tenantName,
                roomNumber: bill.roomNumber,
                amount: paymentAmount,
                paymentMethod: paymentMethod,
                referenceNumber: referenceNumber?.trim() || '',
                paymentDate: paymentDate,
                notes: notes?.trim() || '',
                billAmount: bill.totalAmount,
                createdAt: new Date().toISOString(),
                // Add new fields for tenant payment workflow
                status: isTenant ? 'pending_verification' : 'completed',
                submittedBy: this.currentUser.uid,
                userType: this.currentUser.userType,
                // Store the original bill details for reference
                billDetails: {
                    description: bill.description,
                    dueDate: bill.dueDate,
                    period: bill.period
                }
            };
            
            // Save payment
            await DataManager.recordPayment(paymentData);
            
            // Update bill status based on who is making the payment
            if (isTenant) {
                // For tenant payments, set bill status to pending verification
                await firebaseDb.collection('bills').doc(billId).update({
                    status: 'payment_pending',
                    lastUpdated: new Date().toISOString(),
                    pendingPaymentAmount: paymentAmount,
                    pendingPaymentDate: paymentDate
                });
                
                // Send notification to landlord
                await this.notifyLandlordOfPayment(paymentData);
            } else {
                // For landlord payments, mark as paid immediately
                await firebaseDb.collection('bills').doc(billId).update({
                    status: 'paid',
                    lastUpdated: new Date().toISOString(),
                    paidAmount: paymentAmount,
                    paidDate: paymentDate
                });
            }
            
            // Close modal and notify user
            ModalManager.closeModal(document.querySelector('.modal-overlay'));
            
            // Show appropriate success message
            if (isTenant) {
                this.showNotification('Payment submitted successfully! Your landlord will verify it shortly.', 'success');
            } else {
                this.showNotification('Payment recorded successfully!', 'success');
            }
            
            // Refresh data based on user type and current view
            setTimeout(() => {
                if (isTenant) {
                    // Refresh tenant bills view
                    if (typeof this.loadTenantBills === 'function') {
                        this.loadTenantBills();
                    }
                } else {
                    // Refresh landlord views
                    if (this.currentBillingTab === 'bills') {
                        this.loadBillsData();
                    } else {
                        this.loadPaymentsData();
                    }
                    
                    // Update the metrics for both tabs
                    this.loadBillingStats();
                    this.loadPaymentStats();
                }
            }, 1000);

        } catch (error) {
            console.error('Error processing payment:', error);
            this.showPaymentError('Failed to record payment: ' + error.message);
            
            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = 'Record Payment';
                submitBtn.disabled = false;
            }
        }
    }

    setupPaymentMethodSelection() {
        const paymentOptions = document.querySelectorAll('.payment-method-option');
        const hiddenInput = document.getElementById('selectedPaymentMethod');
        
        paymentOptions.forEach(option => {
            option.addEventListener('click', function() {
                // Remove selected class from all options
                paymentOptions.forEach(opt => opt.classList.remove('selected'));
                
                // Add selected class to clicked option
                this.classList.add('selected');
                
                // Set hidden input value
                if (hiddenInput) {
                    hiddenInput.value = this.getAttribute('data-method');
                }
                
                // Toggle reference number field
                if (typeof this.toggleReferenceNumberField === 'function') {
                    this.toggleReferenceNumberField(this.getAttribute('data-method'));
                }
            });
        });
        
        // Select first option by default if none selected
        if (paymentOptions.length > 0 && (!hiddenInput || !hiddenInput.value)) {
            paymentOptions[0].click();
        }
    }

    async recordPaymentModal(billId) {
        try {
            const billDoc = await firebaseDb.collection('bills').doc(billId).get();
            if (!billDoc.exists) {
                this.showNotification('Bill not found', 'error');
                return;
            }
            
            const bill = { id: billDoc.id, ...billDoc.data() };
            const paymentMethods = await DataManager.getPaymentMethods();
            
            const paymentMethodsHTML = paymentMethods.map(method => `
                <div class="payment-method-option" data-method="${method.id}">
                    <i class="${method.icon}"></i>
                    <span>${method.name}</span>
                </div>
            `).join('');
            
            const modalContent = `
                <div class="payment-modal">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <i class="fas fa-credit-card" style="font-size: 3rem; color: var(--success); margin-bottom: 15px;"></i>
                        <h3 style="margin-bottom: 10px;">Record Payment</h3>
                        <p>Record payment for <strong>${bill.tenantName}</strong></p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: var(--royal-blue);">Bill Details</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.9rem;">
                            <div><strong>Amount Due:</strong> ₱${(bill.totalAmount || 0).toLocaleString()}</div>
                            <div><strong>Due Date:</strong> ${new Date(bill.dueDate).toLocaleDateString()}</div>
                            <div><strong>Room:</strong> ${bill.roomNumber || 'N/A'}</div>
                            <div><strong>Description:</strong> ${bill.description || 'Monthly Rent'}</div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Payment Method *</label>
                        <div class="payment-methods-grid">
                            ${paymentMethodsHTML}
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Reference Number</label>
                        <input type="text" id="paymentReference" class="form-input" placeholder="Transaction ID, receipt number, etc.">
                        <small style="color: var(--dark-gray);">Required for GCash, Maya, and Bank Transfer</small>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Payment Date *</label>
                        <input type="date" id="paymentDate" class="form-input" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Amount Paid *</label>
                        <input type="number" id="paymentAmount" class="form-input" value="${bill.totalAmount || 0}" step="0.01" min="0">
                        <small style="color: var(--dark-gray);">Enter the actual amount received</small>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Notes (Optional)</label>
                        <textarea id="paymentNotes" class="form-input" placeholder="Additional notes about this payment" rows="3"></textarea>
                    </div>
                    
                    <div id="paymentError" style="color: var(--danger); display: none; margin-bottom: 15px;"></div>
                </div>
            `;
            
            const modal = ModalManager.openModal(modalContent, {
                title: 'Record Payment',
                submitText: 'Record Payment',
                onSubmit: () => this.processPayment(billId, bill)
            });
            
            this.setupPaymentMethodSelection();
            
        } catch (error) {
            console.error('Error showing payment modal:', error);
            this.showNotification('Failed to load payment form', 'error');
        }
    }

    setupBillRowStyles() {
        // Use MutationObserver to watch for bill rows being added to the DOM
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // Element node
                            const billRows = node.querySelectorAll ? node.querySelectorAll('.bill-row') : [];
                            billRows.forEach(row => this.applyBillRowStyles(row));
                            
                            // Also check if the node itself is a bill row
                            if (node.classList && node.classList.contains('bill-row')) {
                                this.applyBillRowStyles(node);
                            }
                        }
                    });
                }
            });
        });

        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Apply to existing bill rows
        const existingBillRows = document.querySelectorAll('.bill-row');
        existingBillRows.forEach(row => this.applyBillRowStyles(row));
    }

    applyBillRowStyles(row) {
        // Apply inline styles that will definitely work
        row.style.cursor = 'pointer';
        row.style.transition = 'all 0.3s ease';
        
        // Remove any existing event listeners to avoid duplicates
        row.removeEventListener('mouseenter', row._mouseEnterHandler);
        row.removeEventListener('mouseleave', row._mouseLeaveHandler);
        
        // Add hover effects
        row._mouseEnterHandler = () => {
            row.style.backgroundColor = 'rgba(22, 38, 96, 0.08)';
            row.style.transform = 'translateY(-1px)';
            row.style.boxShadow = '0 2px 8px rgba(22, 38, 96, 0.15)';
        };
        
        row._mouseLeaveHandler = () => {
            row.style.backgroundColor = '';
            row.style.transform = '';
            row.style.boxShadow = '';
        };
        
        row.addEventListener('mouseenter', row._mouseEnterHandler);
        row.addEventListener('mouseleave', row._mouseLeaveHandler);
    }


    getDaysOverdue(dueDate) {
        const today = new Date();
        const due = new Date(dueDate);
        const diffTime = today - due;
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    getBillStatusBadge(bill) {
        const today = new Date();
        const dueDate = new Date(bill.dueDate);
        
        if (bill.status === 'paid') {
            return '<span class="status-badge active">Paid</span>';
        } else if (dueDate < today) {
            return '<span class="status-badge warning">Overdue</span>';
        } else {
            return '<span class="status-badge inactive">Pending</span>';
        }
    }

    renderBillsTable(bills) {
        return `
            <div class="table-container">
                <table class="tenants-table">
                    <thead>
                        <tr>
                            <th>Tenant</th>
                            <th>Room</th>
                            <th>Description</th>
                            <th>Amount</th>
                            <th>Due Date</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bills.map(bill => {
                            const isOverdue = bill.status === 'pending' && new Date(bill.dueDate) < new Date();
                            const statusBadge = this.getBillStatusBadge(bill);
                            
                            return `
                                <tr class="bill-row" data-bill-id="${bill.id}">
                                    <td>
                                        <div class="tenant-info">
                                            <div class="tenant-avatar">${bill.tenantName?.charAt(0)?.toUpperCase() || 'T'}</div>
                                            <div class="tenant-details">
                                                <div class="tenant-name">${bill.tenantName || 'N/A'}</div>
                                                <small style="color: var(--dark-gray); font-size: 0.8rem;">
                                                    ${bill.roomNumber || 'No room assigned'}
                                                </small>
                                            </div>
                                        </div>
                                    </td>
                                    <td>${bill.roomNumber || 'N/A'}</td>
                                    <td>
                                        <div style="font-weight: 500;">${bill.description || 'Monthly Rent'}</div>
                                        <small style="color: var(--dark-gray); text-transform: capitalize;">
                                            ${bill.type || 'rent'} ${bill.isAutoGenerated ? '(Auto-generated)' : '(Manual)'}
                                        </small>
                                    </td>
                                    <td style="font-weight: 600; color: var(--royal-blue);">
                                        ₱${(bill.totalAmount || 0).toLocaleString()}
                                    </td>
                                    <td>
                                        <div>${new Date(bill.dueDate).toLocaleDateString()}</div>
                                        ${isOverdue ? `
                                            <small style="color: var(--danger); font-weight: 500;">
                                                ${this.getDaysOverdue(bill.dueDate)} days overdue
                                            </small>
                                        ` : ''}
                                    </td>
                                    <td>
                                        ${statusBadge}
                                    </td>
                                    <td>
                                        <div class="action-buttons">
                                            ${bill.status !== 'paid' ? `
                                                <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); casaLink.recordPaymentModal('${bill.id}')">
                                                    <i class="fas fa-credit-card"></i> Pay
                                                </button>
                                            ` : ''}
                                            ${bill.status !== 'paid' ? `
                                                <button class="btn btn-sm btn-warning" onclick="event.stopPropagation(); casaLink.editBill('${bill.id}')">
                                                    <i class="fas fa-edit"></i>
                                                </button>
                                            ` : ''}
                                            <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); casaLink.deleteBill('${bill.id}')">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    updateBillsPaginationControls() {
        const pageNumbers = document.getElementById('billsPageNumbers');
        if (!pageNumbers) return;
        
        pageNumbers.innerHTML = '';
        
        // Show page numbers (max 5 pages)
        const startPage = Math.max(1, this.billsCurrentPage - 2);
        const endPage = Math.min(this.billsTotalPages, startPage + 4);
        
        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.className = `btn btn-sm ${i === this.billsCurrentPage ? 'btn-primary' : 'btn-secondary'}`;
            pageButton.textContent = i;
            pageButton.onclick = () => {
                this.billsCurrentPage = i;
                this.updateBillsTable(this.getCurrentBillsPage());
                this.updateBillsPaginationControls();
            };
            pageNumbers.appendChild(pageButton);
        }
        
        // Update button states
        document.getElementById('billsPrevPage').disabled = this.billsCurrentPage === 1;
        document.getElementById('billsNextPage').disabled = this.billsCurrentPage === this.billsTotalPages;
    }

    setupBillsPagination() {
        const paginationContainer = document.getElementById('billsPagination');
        if (!paginationContainer) return;
        
        // Show pagination if we have multiple pages
        if (this.billsTotalPages > 1) {
            paginationContainer.style.display = 'flex';
            this.updateBillsPaginationControls();
        } else {
            paginationContainer.style.display = 'none';
        }
        
        // Event listeners for pagination buttons
        document.getElementById('billsPrevPage')?.addEventListener('click', () => {
            if (this.billsCurrentPage > 1) {
                this.billsCurrentPage--;
                this.updateBillsTable(this.getCurrentBillsPage());
                this.updateBillsPaginationControls();
            }
        });
        
        document.getElementById('billsNextPage')?.addEventListener('click', () => {
            if (this.billsCurrentPage < this.billsTotalPages) {
                this.billsCurrentPage++;
                this.updateBillsTable(this.getCurrentBillsPage());
                this.updateBillsPaginationControls();
            }
        });
    }

    getEmptyBillsState() {
        return `
            <div class="empty-state">
                <i class="fas fa-file-invoice-dollar"></i>
                <h3>No Bills Found</h3>
                <p>No bills have been created yet. Generate monthly bills or create a custom bill.</p>
                <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                    <button class="btn btn-primary" onclick="casaLink.forceGenerateBills()">
                        Generate Monthly Bills
                    </button>
                    <button class="btn btn-secondary" onclick="casaLink.showCreateBillForm()">
                        Create Custom Bill
                    </button>
                </div>
            </div>
        `;
    }

    updateBillsTable(bills) {
        const billsList = document.getElementById('billsList');
        if (!billsList) return;
        
        if (bills.length === 0) {
            billsList.innerHTML = this.getEmptyBillsState();
            document.getElementById('billsPagination').style.display = 'none';
            return;
        }
        
        billsList.innerHTML = this.renderBillsTable(bills);
        this.updateBillsPaginationInfo();
    }

    updateBillsPaginationInfo() {
        const infoElement = document.getElementById('billsPaginationInfo');
        if (infoElement) {
            const startItem = (this.billsCurrentPage - 1) * this.billsItemsPerPage + 1;
            const endItem = Math.min(this.billsCurrentPage * this.billsItemsPerPage, this.billsFilteredData.length);
            infoElement.textContent = `Showing ${startItem}-${endItem} of ${this.billsFilteredData.length} bills`;
        }
    }


    getCurrentBillsPage() {
        const startIndex = (this.billsCurrentPage - 1) * this.billsItemsPerPage;
        const endIndex = startIndex + this.billsItemsPerPage;
        return this.billsFilteredData.slice(startIndex, endIndex);
    }

    async loadBillsData() {
        try {
            console.log('🔄 Loading bills data...');
            const bills = await DataManager.getBillsWithTenants(this.currentUser.uid);
            this.billsAllData = bills;
            this.billsFilteredData = [...bills];
            this.billsCurrentPage = 1;
            this.billsTotalPages = Math.ceil(bills.length / this.billsItemsPerPage);
            
            this.updateBillsTable(this.getCurrentBillsPage());
            this.updateBillingStats(bills);
            this.setupBillsPagination();
            
            console.log('✅ Bills data loaded and pagination set up');
        } catch (error) {
            console.error('Error loading bills:', error);
            this.showNotification('Failed to load bills', 'error');
        }
    }

    updateBillingStats(bills) {
        console.log('📊 Updating billing stats with:', bills.length, 'bills');
        
        const pendingBills = bills.filter(bill => bill.status === 'pending');
        const overdueBills = bills.filter(bill => 
            bill.status === 'pending' && new Date(bill.dueDate) < new Date()
        );
        const paidThisMonth = bills.filter(bill => {
            if (bill.status !== 'paid') return false;
            const paidDate = new Date(bill.paidDate || bill.createdAt);
            const today = new Date();
            return paidDate.getMonth() === today.getMonth() && 
                paidDate.getFullYear() === today.getFullYear();
        });
        
        const monthlyRevenue = paidThisMonth.reduce((sum, bill) => sum + (bill.totalAmount || 0), 0);
        
        // Update all the card values
        this.updateCard('pendingBillsCount', pendingBills.length);
        this.updateCard('overdueBillsCount', overdueBills.length);
        this.updateCard('monthlyRevenue', `₱${monthlyRevenue.toLocaleString()}`);
        this.updateCard('totalBillsCount', bills.length);
        
        console.log('✅ Billing stats updated:', {
            pending: pendingBills.length,
            overdue: overdueBills.length,
            revenue: monthlyRevenue,
            total: bills.length
        });
    }

    async getBillingPage() {
        // Restore the missing delayed load of billing status + stats
        setTimeout(() => {
            if (window.casaLink) {
                window.casaLink.loadBillingStatus();
                window.casaLink.loadBillingStats();
            }
        }, 100);

        return `
        <div class="page-content">
            <div class="page-header">
                <h1 class="page-title">Billing & Payments</h1>
                <div>
                    <button class="btn btn-secondary" onclick="casaLink.showBillingSettings()">
                        <i class="fas fa-cog"></i> Billing Settings
                    </button>
                    <button class="btn btn-primary" onclick="casaLink.showCreateBillForm()">
                        <i class="fas fa-plus"></i> Create Bill
                    </button>
                </div>
            </div>
            
            <!-- Auto-billing status -->
            <div id="autoBillingStatus">
                <div class="data-loading">
                    <i class="fas fa-spinner fa-spin"></i> Loading billing status...
                </div>
            </div>

            <!-- Single Billing Container -->
            <div class="billing-container">
                <!-- View Switcher -->
                <div class="billing-view-switcher">
                    <button class="view-switch-button active" data-view="bills" onclick="casaLink.switchBillingView('bills')">
                        <i class="fas fa-file-invoice-dollar"></i> 
                        <span>Bills Management</span>
                        <span class="view-switch-badge" id="billsViewCount">0</span>
                    </button>
                    <button class="view-switch-button" data-view="payments" onclick="casaLink.switchBillingView('payments')">
                        <i class="fas fa-money-check"></i> 
                        <span>Payment History</span>
                        <span class="view-switch-badge" id="paymentsViewCount">0</span>
                    </button>
                </div>

                <!-- Bills Management View -->
                <div id="billsView" class="billing-view-content active">
                    <div class="billing-stats-grid">
                        <div class="card" data-clickable="pending-bills" style="cursor: pointer;" title="Click to view pending bills">
                            <div class="card-header">
                                <div class="card-title">Pending Bills</div>
                                <div class="card-icon unpaid"><i class="fas fa-file-invoice"></i></div>
                            </div>
                            <div class="card-value" id="pendingBillsCount">0</div>
                            <div class="card-subtitle">Awaiting payment</div>
                        </div>
                        
                        <div class="card" data-clickable="overdue-bills" style="cursor: pointer;" title="Click to view overdue bills">
                            <div class="card-header">
                                <div class="card-title">Overdue</div>
                                <div class="card-icon late"><i class="fas fa-clock"></i></div>
                            </div>
                            <div class="card-value" id="overdueBillsCount">0</div>
                            <div class="card-subtitle">Past due date</div>
                        </div>
                        
                        <div class="card" data-clickable="revenue" style="cursor: pointer;" title="Click to view revenue details">
                            <div class="card-header">
                                <div class="card-title">This Month</div>
                                <div class="card-icon revenue"><i class="fas fa-cash-register"></i></div>
                            </div>
                            <div class="card-value" id="monthlyRevenue">₱0</div>
                            <div class="card-subtitle">Collected revenue</div>
                        </div>
                        
                        <div class="card" data-clickable="all-bills" style="cursor: pointer;" title="Click to view all bills">
                            <div class="card-header">
                                <div class="card-title">Total Bills</div>
                                <div class="card-icon collection"><i class="fas fa-receipt"></i></div>
                            </div>
                            <div class="card-value" id="totalBillsCount">0</div>
                            <div class="card-subtitle">All time</div>
                        </div>
                    </div>

                    <div class="quick-actions-bar">
                        <button class="btn btn-primary" onclick="casaLink.showCreateBillForm()">
                            <i class="fas fa-plus"></i> Create Custom Bill
                        </button>
                        <button class="btn btn-secondary" onclick="casaLink.forceGenerateBills()">
                            <i class="fas fa-sync"></i> Generate Monthly Bills
                        </button>
                        <button class="btn btn-warning" onclick="casaLink.applyLateFeesManually()">
                            <i class="fas fa-clock"></i> Apply Late Fees
                        </button>
                        <button class="btn btn-secondary" onclick="casaLink.exportBills()">
                            <i class="fas fa-download"></i> Export Bills
                        </button>
                    </div>

                    <div class="search-filters-container">
                        <div class="search-box">
                            <input type="text" id="billSearch" class="form-input" placeholder="Search bills...">
                        </div>
                        <div class="filter-controls">
                            <select id="billStatusFilter" class="form-input">
                                <option value="all">All Status</option>
                                <option value="pending">Pending</option>
                                <option value="overdue">Overdue</option>
                                <option value="paid">Paid</option>
                            </select>
                        </div>
                    </div>

                    <div class="quick-filter-buttons">
                        <button class="btn btn-sm btn-secondary" onclick="casaLink.filterBills('all')">All Bills</button>
                        <button class="btn btn-sm btn-secondary" onclick="casaLink.filterBills('pending')">Pending</button>
                        <button class="btn btn-sm btn-secondary" onclick="casaLink.filterBills('overdue')">Overdue</button>
                        <button class="btn btn-sm btn-secondary" onclick="casaLink.filterBills('paid')">Paid</button>
                    </div>

                    <div class="table-section">
                        <div id="billsList">
                            <div class="data-loading">
                                <i class="fas fa-spinner fa-spin"></i> Loading bills...
                            </div>
                        </div>
                        <!-- Pagination Controls for Bills -->
                        <div class="pagination-container" id="billsPagination" style="display: none;">
                            <div class="pagination-info" id="billsPaginationInfo"></div>
                            <div class="pagination-controls">
                                <button class="btn btn-sm btn-secondary" id="billsPrevPage">
                                    <i class="fas fa-chevron-left"></i> Previous
                                </button>
                                <div class="pagination-numbers" id="billsPageNumbers"></div>
                                <button class="btn btn-sm btn-secondary" id="billsNextPage">
                                    Next <i class="fas fa-chevron-right"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Payment History View -->
                <div id="paymentsView" class="billing-view-content">
                    <div class="billing-stats-grid">
                        <div class="card">
                            <div class="card-header">
                                <div class="card-title">Total Collected</div>
                                <div class="card-icon revenue"><i class="fas fa-money-bill-wave"></i></div>
                            </div>
                            <div class="card-value" id="totalCollected">₱0</div>
                            <div class="card-subtitle">All time revenue</div>
                        </div>
                        
                        <div class="card">
                            <div class="card-header">
                                <div class="card-title">This Month</div>
                                <div class="card-icon success"><i class="fas fa-calendar-check"></i></div>
                            </div>
                            <div class="card-value" id="monthlyCollected">₱0</div>
                            <div class="card-subtitle">Current month</div>
                        </div>
                        
                        <div class="card">
                            <div class="card-header">
                                <div class="card-title">Transactions</div>
                                <div class="card-icon collection"><i class="fas fa-receipt"></i></div>
                            </div>
                            <div class="card-value" id="totalTransactions">0</div>
                            <div class="card-subtitle">Total payments</div>
                        </div>
                        
                        <div class="card">
                            <div class="card-header">
                                <div class="card-title">Avg. Payment</div>
                                <div class="card-icon tenants"><i class="fas fa-calculator"></i></div>
                            </div>
                            <div class="card-value" id="averagePayment">₱0</div>
                            <div class="card-subtitle">Per transaction</div>
                        </div>
                    </div>

                    <div class="quick-actions-bar">
                        <button class="btn btn-warning" onclick="casaLink.showRefundModal()">
                            <i class="fas fa-undo"></i> Process Refund
                        </button>
                        <button class="btn btn-secondary" onclick="casaLink.exportPayments()">
                            <i class="fas fa-download"></i> Export Payments
                        </button>
                    </div>

                    <div class="search-filters-container">
                        <div class="search-box">
                            <input type="text" id="paymentSearch" class="form-input" placeholder="Search payments...">
                        </div>
                        <div class="filter-controls">
                            <select id="paymentMethodFilter" class="form-input">
                                <option value="all">All Methods</option>
                                <option value="cash">Cash</option>
                                <option value="gcash">GCash</option>
                                <option value="maya">Maya</option>
                                <option value="bank_transfer">Bank Transfer</option>
                                <option value="check">Check</option>
                            </select>
                            <input type="month" id="paymentDateFilter" class="form-input">
                        </div>
                    </div>

                    <div class="quick-filter-buttons">
                        <button class="btn btn-sm btn-secondary" onclick="casaLink.filterPayments('all')">All Payments</button>
                        <button class="btn btn-sm btn-secondary" onclick="casaLink.filterPayments('today')">Today</button>
                        <button class="btn btn-sm btn-secondary" onclick="casaLink.filterPayments('week')">This Week</button>
                        <button class="btn btn-sm btn-secondary" onclick="casaLink.filterPayments('month')">This Month</button>
                    </div>

                    <div class="table-section">
                        <div id="paymentsList">
                            <div class="data-loading">
                                <i class="fas fa-spinner fa-spin"></i> Loading payments...
                            </div>
                        </div>
                        <!-- Pagination Controls for Payments -->
                        <div class="pagination-container" id="paymentsPagination" style="display: none;">
                            <div class="pagination-info" id="paymentsPaginationInfo"></div>
                            <div class="pagination-controls">
                                <button class="btn btn-sm btn-secondary" id="paymentsPrevPage">
                                    <i class="fas fa-chevron-left"></i> Previous
                                </button>
                                <div class="pagination-numbers" id="paymentsPageNumbers"></div>
                                <button class="btn btn-sm btn-secondary" id="paymentsNextPage">
                                    Next <i class="fas fa-chevron-right"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    }


    async getBillingContent() {
        // This ensures the billing status loads after the page renders
        setTimeout(() => {
            if (window.casaLink) {
                window.casaLink.loadBillingStatus();
            }
        }, 100);
        
        return `
            <!-- Billing Statistics -->
            <div class="card-group">
                <div class="card" data-clickable="pending-bills" style="cursor: pointer;" title="Click to view pending bills">
                    <div class="card-header">
                        <div class="card-title">Pending Bills</div>
                        <div class="card-icon unpaid"><i class="fas fa-file-invoice"></i></div>
                    </div>
                    <div class="card-value" id="pendingBillsCount">0</div>
                    <div class="card-subtitle">Unpaid invoices</div>
                </div>
                
                <div class="card" data-clickable="overdue-bills" style="cursor: pointer;" title="Click to view overdue bills">
                    <div class="card-header">
                        <div class="card-title">Overdue</div>
                        <div class="card-icon late"><i class="fas fa-clock"></i></div>
                    </div>
                    <div class="card-value" id="overdueBillsCount">0</div>
                    <div class="card-subtitle">Past due date</div>
                </div>
                
                <div class="card" data-clickable="revenue" style="cursor: pointer;" title="Click to view revenue details">
                    <div class="card-header">
                        <div class="card-title">This Month</div>
                        <div class="card-icon revenue"><i class="fas fa-cash-register"></i></div>
                    </div>
                    <div class="card-value" id="monthlyRevenue">₱0</div>
                    <div class="card-subtitle">Collected revenue</div>
                </div>
                
                <div class="card" data-clickable="all-bills" style="cursor: pointer;" title="Click to view all bills">
                    <div class="card-header">
                        <div class="card-title">Total Bills</div>
                        <div class="card-icon collection"><i class="fas fa-receipt"></i></div>
                    </div>
                    <div class="card-value" id="totalBillsCount">0</div>
                    <div class="card-subtitle">All time</div>
                </div>
            </div>

            <!-- Billing Controls -->
            <div class="card" style="margin-top: 20px;">
                <div class="card-header">
                    <h3>Bills Management</h3>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <div class="search-box">
                            <input type="text" id="billSearch" class="form-input" placeholder="Search bills...">
                        </div>
                        <select id="billStatusFilter" class="form-input" style="width: auto;">
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="overdue">Overdue</option>
                            <option value="paid">Paid</option>
                        </select>
                    </div>
                </div>
                <div class="card-body">
                    <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
                        <button class="btn btn-secondary" onclick="casaLink.filterBills('all')">
                            All Bills
                        </button>
                        <button class="btn btn-secondary" onclick="casaLink.filterBills('pending')">
                            Pending
                        </button>
                        <button class="btn btn-secondary" onclick="casaLink.filterBills('overdue')">
                            Overdue
                        </button>
                        <button class="btn btn-secondary" onclick="casaLink.filterBills('paid')">
                            Paid
                        </button>
                        <button class="btn btn-warning" onclick="casaLink.applyLateFeesManually()">
                            <i class="fas fa-clock"></i> Apply Late Fees
                        </button>
                        <button class="btn btn-secondary" onclick="casaLink.exportBills()">
                            <i class="fas fa-download"></i> Export
                        </button>
                    </div>
                    <div id="billsList">
                        <div class="data-loading">
                            <i class="fas fa-spinner fa-spin"></i> Loading bills...
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getStatusText(status) {
        const statusMap = {
            'active': 'Active',
            'expiring': 'Expiring Soon',
            'expired': 'Expired',
            'pending': 'Pending'
        };
        return statusMap[status] || status;
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    getDaysRemaining(endDate) {
        const end = new Date(endDate);
        const today = new Date();
        const diffTime = end - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    getTenantName(tenantId, tenants) {
        const tenant = tenants.find(t => t.id === tenantId);
        return tenant ? `${tenant.firstName} ${tenant.lastName}` : 'Unknown Tenant';
    }

    getPropertyName(propertyId, properties) {
        const property = properties.find(p => p.id === propertyId);
        return property ? property.name : 'Unknown Property';
    }

    async renderLeaseManagement() {
        try {
            const leases = await DataManager.getLeases();
            const properties = await DataManager.getProperties();
            const tenants = await DataManager.getTenants();
            
            return `
                <div class="lease-section">
                    <div class="section-header">
                        <div class="header-content">
                            <h2>Lease Management</h2>
                            <p>Manage rental agreements, track lease terms, and handle renewals</p>
                        </div>
                        <div class="header-actions">
                            <button class="btn btn-secondary" onclick="exportLeases()">
                                <i class="fas fa-download"></i> Export
                            </button>
                            <button class="btn btn-primary" onclick="showNewLeaseModal()">
                                <i class="fas fa-plus"></i> New Lease
                            </button>
                        </div>
                    </div>
                    
                    <!-- Quick Stats -->
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon active">
                                <i class="fas fa-file-contract"></i>
                            </div>
                            <div class="stat-content">
                                <h3>${leases.filter(l => l.status === 'active').length}</h3>
                                <p>Active Leases</p>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon expired">
                                <i class="fas fa-clock"></i>
                            </div>
                            <div class="stat-content">
                                <h3>${leases.filter(l => l.status === 'expiring').length}</h3>
                                <p>Expiring Soon</p>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon pending">
                                <i class="fas fa-hourglass-half"></i>
                            </div>
                            <div class="stat-content">
                                <h3>${leases.filter(l => l.status === 'pending').length}</h3>
                                <p>Pending</p>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon total">
                                <i class="fas fa-list"></i>
                            </div>
                            <div class="stat-content">
                                <h3>${leases.length}</h3>
                                <p>Total Leases</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Leases Table -->
                    <div class="content-card">
                        <div class="card-header">
                            <h3>All Leases</h3>
                            <div class="search-filter">
                                <input type="text" id="leaseSearch" placeholder="Search leases..." class="search-input">
                                <select id="leaseFilter" class="filter-select">
                                    <option value="all">All Status</option>
                                    <option value="active">Active</option>
                                    <option value="expiring">Expiring Soon</option>
                                    <option value="expired">Expired</option>
                                    <option value="pending">Pending</option>
                                </select>
                            </div>
                        </div>
                        
                        ${leases.length > 0 ? `
                            <div class="table-container">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Property</th>
                                            <th>Tenant</th>
                                            <th>Lease Term</th>
                                            <th>Monthly Rent</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${leases.map(lease => `
                                            <tr>
                                                <td>
                                                    <div class="property-info">
                                                        <strong>${getPropertyName(lease.propertyId, properties)}</strong>
                                                    </div>
                                                </td>
                                                <td>${getTenantName(lease.tenantId, tenants)}</td>
                                                <td>
                                                    <div>${formatDate(lease.startDate)}</div>
                                                    <div class="text-muted">to ${formatDate(lease.endDate)}</div>
                                                </td>
                                                <td>$${lease.monthlyRent?.toLocaleString() || '0'}</td>
                                                <td>
                                                    <span class="lease-status ${lease.status}">
                                                        ${getStatusText(lease.status)}
                                                        ${lease.status === 'expiring' ? ` (${getDaysRemaining(lease.endDate)} days)` : ''}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div class="action-buttons">
                                                        <button class="btn-icon" onclick="viewLeaseDetails('${lease.id}')" title="View Details">
                                                            <i class="fas fa-eye"></i>
                                                        </button>
                                                        <button class="btn-icon" onclick="editLease('${lease.id}')" title="Edit Lease">
                                                            <i class="fas fa-edit"></i>
                                                        </button>
                                                        <button class="btn-icon" onclick="downloadLeasePDF('${lease.id}')" title="Download PDF">
                                                            <i class="fas fa-download"></i>
                                                        </button>
                                                        <button class="btn-icon danger" onclick="deleteLease('${lease.id}')" title="Delete Lease">
                                                            <i class="fas fa-trash"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `
                            <div class="empty-state">
                                <i class="fas fa-file-contract fa-4x"></i>
                                <h3>No Leases Found</h3>
                                <p>Create your first lease agreement to get started with property management.</p>
                                <button class="btn btn-primary" onclick="showNewLeaseModal()">
                                    <i class="fas fa-plus"></i> Create First Lease
                                </button>
                            </div>
                        `}
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error rendering lease management:', error);
            return `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle fa-3x"></i>
                    <h3>Error Loading Leases</h3>
                    <p>Failed to load lease data. Please try again.</p>
                    <button class="btn btn-primary" onclick="showSection('lease-management')">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            `;
        }
    }

    async showNewLeaseModal() {
        try {
            const properties = await DataManager.getProperties();
            const tenants = await DataManager.getTenants();
            
            const modalContent = `
                <div class="modal-header">
                    <h3>Create New Lease Agreement</h3>
                    <button class="modal-close" onclick="ModalManager.closeModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="newLeaseForm" class="lease-form">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="leaseProperty">Property *</label>
                                <select id="leaseProperty" required>
                                    <option value="">Select Property</option>
                                    ${properties.map(prop => `
                                        <option value="${prop.id}">${prop.name} - ${prop.address}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="leaseTenant">Tenant *</label>
                                <select id="leaseTenant" required>
                                    <option value="">Select Tenant</option>
                                    ${tenants.map(tenant => `
                                        <option value="${tenant.id}">${tenant.firstName} ${tenant.lastName}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="leaseStart">Start Date *</label>
                                <input type="date" id="leaseStart" required>
                            </div>
                            <div class="form-group">
                                <label for="leaseEnd">End Date *</label>
                                <input type="date" id="leaseEnd" required>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="leaseRent">Monthly Rent ($) *</label>
                                <input type="number" id="leaseRent" placeholder="0.00" step="0.01" min="0" required>
                            </div>
                            <div class="form-group">
                                <label for="leaseDeposit">Security Deposit ($) *</label>
                                <input type="number" id="leaseDeposit" placeholder="0.00" step="0.01" min="0" required>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="leaseTerms">Additional Terms</label>
                            <textarea id="leaseTerms" placeholder="Enter any additional lease terms or conditions..." rows="3"></textarea>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="ModalManager.closeModal()">Cancel</button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save"></i> Create Lease
                            </button>
                        </div>
                    </form>
                </div>
            `;
            
            ModalManager.showModal(modalContent);
            
            // Set default dates
            const today = new Date();
            const oneYearLater = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
            
            document.getElementById('leaseStart').value = today.toISOString().split('T')[0];
            document.getElementById('leaseEnd').value = oneYearLater.toISOString().split('T')[0];
            
            // Add form submission handler
            document.getElementById('newLeaseForm').addEventListener('submit', function(e) {
                e.preventDefault();
                createNewLease();
            });
            
        } catch (error) {
            console.error('Error showing lease modal:', error);
            showNotification('Error loading form data', 'error');
        }
    }

    downloadLeasePDF(leaseId) {
        showNotification('PDF download feature coming soon!', 'info');
    }

    exportLeases() {
        showNotification('Export feature coming soon!', 'info');
    }

    async deleteLease(leaseId) {
        if (!confirm('Are you sure you want to delete this lease? This action cannot be undone.')) {
            return;
        }
        
        try {
            await DataManager.deleteLease(leaseId);
            showNotification('Lease deleted successfully', 'success');
            showSection('lease-management'); // Refresh the view
        } catch (error) {
            console.error('Error deleting lease:', error);
            showNotification('Error deleting lease', 'error');
        }
    }

    async viewLeaseDetails(leaseId) {
        try {
            console.log('🔎 Loading lease details:', leaseId);

            // Resolve DataManager method (handle class vs instance)
            let lease;
            try {
                if (typeof DataManager.getLease === 'function') {
                    lease = await DataManager.getLease(leaseId);
                } else if (typeof DataManager.prototype?.getLease === 'function') {
                    // DataManager is a class exported; create temp instance
                    const dm = new DataManager();
                    if (typeof dm.init === 'function') await dm.init();
                    lease = await dm.getLease(leaseId);
                } else if (window.DataManager && typeof window.DataManager.getLease === 'function') {
                    // already an instance assigned to window
                    lease = await window.DataManager.getLease(leaseId);
                } else {
                    throw new Error('No DataManager.getLease available');
                }
            } catch (err) {
                console.error('Error resolving DataManager.getLease:', err);
                this.showNotification('Failed to load lease: DataManager method missing', 'error');
                return;
            }

            if (!lease) {
                this.showNotification('Lease not found', 'warning');
                return;
            }

            // Build and show modal (reuse your existing modal generator)
            const leaseModalContent = this.generateLeaseInformationContent({ name: lease.tenantName || lease.primaryTenant }, lease);
            ModalManager.openModal(leaseModalContent, { title: 'Lease Details', showFooter: true });

        } catch (error) {
            console.error('Error viewing lease:', error);
            // Use instance method so it resolves correctly
            this.showNotification('Failed to view lease details', 'error');
        }
    }

    async createNewLease() {
        const submitBtn = document.querySelector('#newLeaseForm button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        try {
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
            submitBtn.disabled = true;
            
            const leaseData = {
                propertyId: document.getElementById('leaseProperty').value,
                tenantId: document.getElementById('leaseTenant').value,
                startDate: document.getElementById('leaseStart').value,
                endDate: document.getElementById('leaseEnd').value,
                monthlyRent: parseFloat(document.getElementById('leaseRent').value),
                securityDeposit: parseFloat(document.getElementById('leaseDeposit').value),
                additionalTerms: document.getElementById('leaseTerms').value,
                status: 'active',
                createdAt: new Date().toISOString()
            };
            
            // Validate dates
            const startDate = new Date(leaseData.startDate);
            const endDate = new Date(leaseData.endDate);
            
            if (endDate <= startDate) {
                throw new Error('End date must be after start date');
            }
            
            await DataManager.createLease(leaseData);
            ModalManager.closeModal();
            showNotification('Lease created successfully!', 'success');
            
            // Refresh the leases display
            showSection('lease-management');
            
        } catch (error) {
            console.error('Error creating lease:', error);
            showNotification(error.message || 'Failed to create lease', 'error');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }


    removeLeaseRowClickHandlers() {
        const el = document.getElementById('leasesList');
        if (el && this.leaseListClickHandler) {
            el.removeEventListener('click', this.leaseListClickHandler);
            this.leaseListClickHandler = null;
        }
    }

    renderLeasesList(leases) {
        const el = document.getElementById('leasesList');
        if (!el) return;
        if (!leases || leases.length === 0) {
            el.innerHTML = `<div class="empty-state"><i class="fas fa-file-contract"></i><h3>No leases found</h3></div>`;
            return;
        }

        el.innerHTML = `
            <div class="table-container">
                <table class="tenants-table">
                    <thead>
                        <tr><th>Lease ID</th><th>Tenant</th><th>Room</th><th>Rent</th><th>Start</th><th>End</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        ${leases.map(lease => `
                            <tr class="lease-row" data-lease-id="${lease.id}">
                                <td>#${(lease.id || '').substring(0,8)}</td>
                                <td>${lease.tenantName || lease.primaryTenant || 'N/A'}</td>
                                <td>${lease.roomNumber || 'N/A'}</td>
                                <td>₱${(lease.monthlyRent || 0).toLocaleString()}</td>
                                <td>${lease.leaseStart ? new Date(lease.leaseStart).toLocaleDateString() : 'N/A'}</td>
                                <td>${lease.leaseEnd ? new Date(lease.leaseEnd).toLocaleDateString() : 'N/A'}</td>
                                <td>${lease.isActive ? 'Active' : 'Inactive'}</td>
                                <td>
                                    <button class="btn btn-sm btn-secondary" data-lease-action="view" data-lease-id="${lease.id}">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Remove previous delegated listener (if any) and add a single delegated listener on the container
        this.removeLeaseRowClickHandlers?.();

        this.leaseListClickHandler = (e) => {
            // prefer button action then row click
            const actionBtn = e.target.closest('[data-lease-action="view"]');
            const row = actionBtn ? actionBtn : e.target.closest('.lease-row');
            if (!row) return;
            const id = row.getAttribute('data-lease-id');
            if (!id) return;

            // Debug trace
            console.log('Lease row clicked, id=', id);

            // Call existing method (try known names)
            if (typeof this.viewLeaseDetails === 'function') {
                this.viewLeaseDetails(id);
                return;
            }
            if (typeof this.showLeaseDetailsModal === 'function') {
                this.showLeaseDetailsModal(id);
                return;
            }
            if (typeof this.showLeaseDetailsModalFromActivity === 'function') {
                this.showLeaseDetailsModalFromActivity(id);
                return;
            }

            // Fallback: attempt global casaLink view
            if (window.casaLink && typeof window.casaLink.viewLeaseDetails === 'function') {
                window.casaLink.viewLeaseDetails(id);
                return;
            }

            console.warn('No lease details handler found (expected viewLeaseDetails or showLeaseDetailsModal)', id);
        };

        // Attach to the specific container to avoid many document listeners
        el.addEventListener('click', this.leaseListClickHandler);
    }

    

    async loadLeaseManagementData() {
        try {
            const landlordId = this.currentUser?.uid;
            const leases = (window.DataManager && typeof DataManager.getLandlordLeases === 'function')
                ? await DataManager.getLandlordLeases(landlordId)
                : await DataManager.getActiveLeases();
            this.leasesAllData = leases || [];
            this.leasesFilteredData = [...this.leasesAllData];
            this.renderLeasesList(this.leasesFilteredData);
        } catch (err) {
            console.error('Error loading leases:', err);
            const el = document.getElementById('leasesList');
            if (el) el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i> Failed to load leases</div>`;
        }
    }

    async setupLeaseManagementPage() {
        // Wire search/filter events, row handlers, etc.
        document.getElementById('leaseSearch')?.addEventListener('input', (e) => {
            const q = e.target.value.trim().toLowerCase();
            if (!q) {
                this.leasesFilteredData = [...(this.leasesAllData || [])];
            } else {
                this.leasesFilteredData = (this.leasesAllData || []).filter(l =>
                    (l.tenantName || '').toLowerCase().includes(q) ||
                    (l.roomNumber || '').toLowerCase().includes(q) ||
                    (l.id || '').toLowerCase().includes(q)
                );
            }
            this.renderLeasesList(this.leasesFilteredData);
        });

        // Load initial data
        await this.loadLeaseManagementData();
    }

    async getLeaseManagementPage() {
    // Simple page scaffold — extend with tables/filters as needed
    // Data loading should be done in setupLeaseManagementPage()
    setTimeout(() => {
        if (window.casaLink) {
            // trigger background load of lease data
            window.casaLink.loadLeaseManagementData?.();
        }
    }, 100);

    return `
        <div class="page-content">
            <div class="page-header">
                <h1 class="page-title">Lease Management</h1>
                <div>
                    <button class="btn btn-secondary" onclick="casaLink.showLeaseSettings?.()">
                        <i class="fas fa-cog"></i> Settings
                    </button>
                    <button class="btn btn-primary" onclick="casaLink.createLease?.()">
                        <i class="fas fa-plus"></i> Create Lease
                    </button>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3>Active Leases</h3>
                    <div class="search-box">
                        <input type="text" id="leaseSearch" class="form-input" placeholder="Search leases...">
                    </div>
                </div>
                <div id="leasesList">
                    <div class="data-loading">
                        <i class="fas fa-spinner fa-spin"></i> Loading leases...
                    </div>
                </div>
            </div>
        </div>
    `;
}


    async getMaintenancePage() {
        return `
        <div class="page-content">
            <div class="page-header">
                <h1 class="page-title">Maintenance Management</h1>
                <div>
                    <button class="btn btn-secondary" onclick="casaLink.showMaintenanceSettings()">
                        <i class="fas fa-cog"></i> Settings
                    </button>
                    <button class="btn btn-primary" onclick="casaLink.showCreateMaintenanceForm()">
                        <i class="fas fa-plus"></i> Create Request
                    </button>
                </div>
            </div>

            <!-- Maintenance Stats -->
            <div class="card-group">
                <div class="card" data-clickable="open-maintenance" style="cursor: pointer;" title="Click to view open requests">
                    <div class="card-header">
                        <div class="card-title">Open Requests</div>
                        <div class="card-icon maintenance"><i class="fas fa-tools"></i></div>
                    </div>
                    <div class="card-value" id="openMaintenanceCount">0</div>
                    <div class="card-subtitle">Requiring attention</div>
                </div>
                
                <div class="card" data-clickable="high-priority" style="cursor: pointer;" title="Click to view high priority requests">
                    <div class="card-header">
                        <div class="card-title">High Priority</div>
                        <div class="card-icon late"><i class="fas fa-exclamation-triangle"></i></div>
                    </div>
                    <div class="card-value" id="highPriorityCount">0</div>
                    <div class="card-subtitle">Urgent issues</div>
                </div>
                
                <div class="card" data-clickable="in-progress" style="cursor: pointer;" title="Click to view in-progress requests">
                    <div class="card-header">
                        <div class="card-title">In Progress</div>
                        <div class="card-icon renewals"><i class="fas fa-clock"></i></div>
                    </div>
                    <div class="card-value" id="inProgressCount">0</div>
                    <div class="card-subtitle">Being worked on</div>
                </div>
                
                <div class="card" data-clickable="completed" style="cursor: pointer;" title="Click to view completed requests">
                    <div class="card-header">
                        <div class="card-title">Completed</div>
                        <div class="card-icon success"><i class="fas fa-check-circle"></i></div>
                    </div>
                    <div class="card-value" id="completedCount">0</div>
                    <div class="card-subtitle">This month</div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="quick-actions-bar">
                <button class="btn btn-primary" onclick="casaLink.showCreateMaintenanceForm()">
                    <i class="fas fa-plus"></i> Create New Request
                </button>
                <button class="btn btn-secondary" onclick="casaLink.showAssignStaffForm()">
                    <i class="fas fa-user-plus"></i> Assign Staff
                </button>
                <button class="btn btn-secondary" onclick="casaLink.exportMaintenance()">
                    <i class="fas fa-download"></i> Export Reports
                </button>
                <button class="btn btn-warning" onclick="casaLink.showMaintenanceSchedule()">
                    <i class="fas fa-calendar"></i> View Schedule
                </button>
            </div>

            <!-- Filters and Search -->
            <div class="search-filters-container">
                <div class="search-box">
                    <input type="text" id="maintenanceSearch" class="form-input" placeholder="Search maintenance requests...">
                </div>
                <div class="filter-controls">
                    <select id="statusFilter" class="form-input">
                        <option value="all">All Status</option>
                        <option value="open">Open</option>
                        <option value="in-progress">In Progress</option>
                        <option value="pending_parts">Pending Parts</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    <select id="priorityFilter" class="form-input">
                        <option value="all">All Priorities</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="emergency">Emergency</option>
                    </select>
                    <select id="typeFilter" class="form-input">
                        <option value="all">All Types</option>
                        <option value="general">General</option>
                        <option value="plumbing">Plumbing</option>
                        <option value="electrical">Electrical</option>
                        <option value="hvac">HVAC</option>
                        <option value="appliance">Appliance</option>
                        <option value="structural">Structural</option>
                        <option value="pest_control">Pest Control</option>
                        <option value="other">Other</option>
                    </select>
                </div>
            </div>

            <!-- Quick Filter Buttons -->
            <div class="quick-filter-buttons">
                <button class="btn btn-sm btn-secondary" onclick="casaLink.filterMaintenance('all')">All Requests</button>
                <button class="btn btn-sm btn-secondary" onclick="casaLink.filterMaintenance('open')">Open</button>
                <button class="btn btn-sm btn-secondary" onclick="casaLink.filterMaintenance('high')">High Priority</button>
                <button class="btn btn-sm btn-secondary" onclick="casaLink.filterMaintenance('today')">Today</button>
                <button class="btn btn-sm btn-secondary" onclick="casaLink.filterMaintenance('week')">This Week</button>
            </div>

            <!-- Maintenance Requests Table -->
            <div class="table-section">
                <div id="maintenanceList">
                    <div class="data-loading">
                        <i class="fas fa-spinner fa-spin"></i> Loading maintenance requests...
                    </div>
                </div>
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
                <!-- Pagination Controls for Tenants -->
                <div class="pagination-container" id="tenantsPagination" style="display: none;">
                    <div class="pagination-info" id="tenantsPaginationInfo"></div>
                    <div class="pagination-controls">
                        <button class="btn btn-sm btn-secondary" id="tenantsPrevPage">
                            <i class="fas fa-chevron-left"></i> Previous
                        </button>
                        <div class="pagination-numbers" id="tenantsPageNumbers"></div>
                        <button class="btn btn-sm btn-secondary" id="tenantsNextPage">
                            Next <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    async getAvailableRooms() {
        try {
            console.log('🔄 Fetching available rooms...');
            
            const roomsSnapshot = await firebaseDb.collection('rooms')
                .where('isAvailable', '==', true)
                .get();
            
            if (roomsSnapshot.empty) {
                console.log('📦 No available rooms found, creating default rooms collection...');
                return await this.createDefaultRooms();
            }
            
            const rooms = roomsSnapshot.docs.map(doc => ({
                id: doc.id, // This will now be the room number (e.g., "1A", "2B")
                roomNumber: doc.id, // Use document ID as room number
                ...doc.data()
            }));
            
            console.log(`✅ Found ${rooms.length} available rooms:`, rooms.map(r => r.roomNumber));
            return rooms;
            
        } catch (error) {
            console.error('❌ Error fetching available rooms:', error);
            // Fallback to creating default rooms
            return await this.createDefaultRooms();
        }
    }

    async createDefaultRooms() {
        try {
            console.log('🏗️ Creating default rooms collection with member limits...');
            
            const defaultRooms = [
                // 1st floor: 1A-1E - 10,000 PHP - MAX 1 MEMBER
                { roomNumber: '1A', floor: '1', monthlyRent: 10000, securityDeposit: 10000, maxMembers: 1, isAvailable: true, occupiedBy: null },
                { roomNumber: '1B', floor: '1', monthlyRent: 10000, securityDeposit: 10000, maxMembers: 1, isAvailable: true, occupiedBy: null },
                { roomNumber: '1C', floor: '1', monthlyRent: 10000, securityDeposit: 10000, maxMembers: 1, isAvailable: true, occupiedBy: null },
                { roomNumber: '1D', floor: '1', monthlyRent: 10000, securityDeposit: 10000, maxMembers: 1, isAvailable: true, occupiedBy: null },
                { roomNumber: '1E', floor: '1', monthlyRent: 10000, securityDeposit: 10000, maxMembers: 1, isAvailable: true, occupiedBy: null },
                
                // 1st floor: 2A-2E - 12,000 PHP - MAX 2 MEMBERS
                { roomNumber: '2A', floor: '1', monthlyRent: 12000, securityDeposit: 12000, maxMembers: 2, isAvailable: true, occupiedBy: null },
                { roomNumber: '2B', floor: '1', monthlyRent: 12000, securityDeposit: 12000, maxMembers: 2, isAvailable: true, occupiedBy: null },
                { roomNumber: '2C', floor: '1', monthlyRent: 12000, securityDeposit: 12000, maxMembers: 2, isAvailable: true, occupiedBy: null },
                { roomNumber: '2D', floor: '1', monthlyRent: 12000, securityDeposit: 12000, maxMembers: 2, isAvailable: true, occupiedBy: null },
                { roomNumber: '2E', floor: '1', monthlyRent: 12000, securityDeposit: 12000, maxMembers: 2, isAvailable: true, occupiedBy: null },
                
                // 1st floor: 3A-3E - 14,000 PHP - MAX 4 MEMBERS
                { roomNumber: '3A', floor: '1', monthlyRent: 14000, securityDeposit: 14000, maxMembers: 4, isAvailable: true, occupiedBy: null },
                { roomNumber: '3B', floor: '1', monthlyRent: 14000, securityDeposit: 14000, maxMembers: 4, isAvailable: true, occupiedBy: null },
                { roomNumber: '3C', floor: '1', monthlyRent: 14000, securityDeposit: 14000, maxMembers: 4, isAvailable: true, occupiedBy: null },
                { roomNumber: '3D', floor: '1', monthlyRent: 14000, securityDeposit: 14000, maxMembers: 4, isAvailable: true, occupiedBy: null },
                { roomNumber: '3E', floor: '1', monthlyRent: 14000, securityDeposit: 14000, maxMembers: 4, isAvailable: true, occupiedBy: null },
                
                // 1st floor: 4A-4E - 15,000 PHP - MAX 4 MEMBERS
                { roomNumber: '4A', floor: '1', monthlyRent: 15000, securityDeposit: 15000, maxMembers: 4, isAvailable: true, occupiedBy: null },
                { roomNumber: '4B', floor: '1', monthlyRent: 15000, securityDeposit: 15000, maxMembers: 4, isAvailable: true, occupiedBy: null },
                { roomNumber: '4C', floor: '1', monthlyRent: 15000, securityDeposit: 15000, maxMembers: 4, isAvailable: true, occupiedBy: null },
                { roomNumber: '4D', floor: '1', monthlyRent: 15000, securityDeposit: 15000, maxMembers: 4, isAvailable: true, occupiedBy: null },
                { roomNumber: '4E', floor: '1', monthlyRent: 15000, securityDeposit: 15000, maxMembers: 4, isAvailable: true, occupiedBy: null },
                
                // 1st floor: 5A-5B - 15,500 PHP - MAX 5 MEMBERS
                { roomNumber: '5A', floor: '1', monthlyRent: 15500, securityDeposit: 15500, maxMembers: 5, isAvailable: true, occupiedBy: null },
                { roomNumber: '5B', floor: '1', monthlyRent: 15500, securityDeposit: 15500, maxMembers: 5, isAvailable: true, occupiedBy: null }
            ];
            
            const batch = firebaseDb.batch();
            const createdRooms = [];
            
            defaultRooms.forEach(room => {
                const roomRef = firebaseDb.collection('rooms').doc(room.roomNumber);
                batch.set(roomRef, {
                    floor: room.floor,
                    monthlyRent: room.monthlyRent,
                    securityDeposit: room.securityDeposit,
                    maxMembers: room.maxMembers,
                    isAvailable: room.isAvailable,
                    occupiedBy: room.occupiedBy,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                createdRooms.push({
                    id: room.roomNumber,
                    roomNumber: room.roomNumber,
                    floor: room.floor,
                    monthlyRent: room.monthlyRent,
                    securityDeposit: room.securityDeposit,
                    maxMembers: room.maxMembers,
                    isAvailable: room.isAvailable,
                    occupiedBy: room.occupiedBy
                });
            });
            
            await batch.commit();
            console.log('✅ Created default rooms collection with member limits');
            
            return createdRooms;
            
        } catch (error) {
            console.error('❌ Error creating default rooms:', error);
            return this.getHardcodedRooms();
        }
    }

    getHardcodedRooms() {
        // Fallback hardcoded rooms in case Firestore fails
        return [
            { id: '1A', roomNumber: '1A', monthlyRent: 10000, securityDeposit: 10000, isAvailable: true },
            { id: '1B', roomNumber: '1B', monthlyRent: 10000, securityDeposit: 10000, isAvailable: true },
            { id: '1C', roomNumber: '1C', monthlyRent: 10000, securityDeposit: 10000, isAvailable: true },
            { id: '1D', roomNumber: '1D', monthlyRent: 10000, securityDeposit: 10000, isAvailable: true },
            { id: '1E', roomNumber: '1E', monthlyRent: 10000, securityDeposit: 10000, isAvailable: true },
            { id: '2A', roomNumber: '2A', monthlyRent: 12000, securityDeposit: 12000, isAvailable: true },
            { id: '2B', roomNumber: '2B', monthlyRent: 12000, securityDeposit: 12000, isAvailable: true },
            { id: '2C', roomNumber: '2C', monthlyRent: 12000, securityDeposit: 12000, isAvailable: true },
            { id: '2D', roomNumber: '2D', monthlyRent: 12000, securityDeposit: 12000, isAvailable: true },
            { id: '2E', roomNumber: '2E', monthlyRent: 12000, securityDeposit: 12000, isAvailable: true },
            { id: '3A', roomNumber: '3A', monthlyRent: 14000, securityDeposit: 14000, isAvailable: true },
            { id: '3B', roomNumber: '3B', monthlyRent: 14000, securityDeposit: 14000, isAvailable: true },
            { id: '3C', roomNumber: '3C', monthlyRent: 14000, securityDeposit: 14000, isAvailable: true },
            { id: '3D', roomNumber: '3D', monthlyRent: 14000, securityDeposit: 14000, isAvailable: true },
            { id: '3E', roomNumber: '3E', monthlyRent: 14000, securityDeposit: 14000, isAvailable: true },
            { id: '4A', roomNumber: '4A', monthlyRent: 15000, securityDeposit: 15000, isAvailable: true },
            { id: '4B', roomNumber: '4B', monthlyRent: 15000, securityDeposit: 15000, isAvailable: true },
            { id: '4C', roomNumber: '4C', monthlyRent: 15000, securityDeposit: 15000, isAvailable: true },
            { id: '4D', roomNumber: '4D', monthlyRent: 15000, securityDeposit: 15000, isAvailable: true },
            { id: '4E', roomNumber: '4E', monthlyRent: 15000, securityDeposit: 15000, isAvailable: true },
            { id: '5A', roomNumber: '5A', monthlyRent: 15500, securityDeposit: 15500, isAvailable: true },
            { id: '5B', roomNumber: '5B', monthlyRent: 15500, securityDeposit: 15500, isAvailable: true }
        ];
    }

    setupRoomSelection() {
        const roomSelect = document.getElementById('roomNumber');
        const rentalAmountInput = document.getElementById('rentalAmount');
        const securityDepositInput = document.getElementById('securityDeposit');
        
        if (roomSelect) {
            roomSelect.addEventListener('change', (e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                if (selectedOption.value) {
                    const rent = selectedOption.getAttribute('data-rent');
                    const deposit = selectedOption.getAttribute('data-deposit');
                    
                    rentalAmountInput.value = rent || '';
                    securityDepositInput.value = deposit || '';
                } else {
                    rentalAmountInput.value = '';
                    securityDepositInput.value = '';
                }
            });
        }
    }

    async debugRoomAvailability() {
        try {
            const allRoomsSnapshot = await firebaseDb.collection('rooms').get();
            const availableRoomsSnapshot = await firebaseDb.collection('rooms')
                .where('isAvailable', '==', true)
                .get();
            
            console.log('🐛 Room Availability Debug:', {
                totalRooms: allRoomsSnapshot.size,
                availableRooms: availableRoomsSnapshot.size,
                occupiedRooms: allRoomsSnapshot.size - availableRoomsSnapshot.size,
                availableRoomNumbers: availableRoomsSnapshot.docs.map(doc => doc.data().roomNumber)
            });
            
            return {
                total: allRoomsSnapshot.size,
                available: availableRoomsSnapshot.size,
                occupied: allRoomsSnapshot.size - availableRoomsSnapshot.size
            };
        } catch (error) {
            console.error('Debug error:', error);
            return null;
        }
    }

    getMemberLimitText(maxMembers) {
        // Handle undefined, null, or missing values
        if (maxMembers === undefined || maxMembers === null || isNaN(maxMembers)) {
            return 'Max 1 Member'; // Default fallback
        }
        
        const memberCount = parseInt(maxMembers);
        switch(memberCount) {
            case 1: return 'Max 1 Member';
            case 2: return 'Max 2 Members';
            case 4: return 'Max 4 Members';
            case 5: return 'Max 5 Members';
            default: return `Max ${memberCount} Members`;
        }
    }

    getMemberLimitTextFallback(maxMembers) {
        const memberCount = parseInt(maxMembers) || 1;
        if (memberCount === 1) return 'Max 1 Member';
        if (memberCount === 2) return 'Max 2 Members';
        if (memberCount === 4) return 'Max 4 Members';
        if (memberCount === 5) return 'Max 5 Members';
        return `Max ${memberCount} Members`;
    }

    // Landlord creates tenant accounts
    async showAddTenantForm() {
        // Fetch available rooms from Firestore
        const availableRooms = await this.getAvailableRooms();
        
        let roomOptions = '';
        let availabilityMessage = '';
        
        if (availableRooms.length === 0) {
            roomOptions = '<option value="">No available rooms</option>';
            availabilityMessage = '<div style="color: var(--danger); margin-top: 10px; padding: 10px; background: rgba(234, 67, 53, 0.1); border-radius: 6px;"><i class="fas fa-exclamation-triangle"></i> No available rooms. All units are currently occupied.</div>';
        } else {
            roomOptions = availableRooms.map(room => {
            // Use room.maxMembers with fallback to determine from room number
            let maxMembers = room.maxMembers;
            
            // If maxMembers is undefined, determine from room number
            if (maxMembers === undefined || maxMembers === null) {
                if (room.roomNumber && room.roomNumber.startsWith('1')) {
                    maxMembers = 1;
                } else if (room.roomNumber && room.roomNumber.startsWith('2')) {
                    maxMembers = 2;
                } else if (room.roomNumber && (room.roomNumber.startsWith('3') || room.roomNumber.startsWith('4'))) {
                    maxMembers = 4;
                } else if (room.roomNumber && room.roomNumber.startsWith('5')) {
                    maxMembers = 5;
                } else {
                    maxMembers = 1; // Default fallback
                }
            }
            
            // Use the helper function directly instead of this.getMemberLimitText
            const memberText = this.getMemberLimitText ? 
                this.getMemberLimitText(maxMembers) : 
                this.getMemberLimitTextFallback(maxMembers);
            
            return `<option value="${room.roomNumber}" data-rent="${room.monthlyRent}" data-deposit="${room.securityDeposit}" data-max-members="${maxMembers}">${room.roomNumber} - ₱${room.monthlyRent.toLocaleString()} (${memberText})</option>`;
        }).join('');
            
            availabilityMessage = `<small style="color: var(--dark-gray);">${availableRooms.length} available room(s) found</small>`;
        }

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
                    <select id="roomNumber" class="form-input" required ${availableRooms.length === 0 ? 'disabled' : ''}>
                        <option value="">Select a room/unit</option>
                        ${roomOptions}
                    </select>
                    ${availabilityMessage}
                    <div id="memberLimitInfo" style="margin-top: 8px; padding: 8px; background: rgba(26, 115, 232, 0.1); border-radius: 4px; display: none;">
                        <small style="color: var(--primary-blue);"><i class="fas fa-info-circle"></i> <span id="memberLimitText">Member limit information</span></small>
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">House Rental Address</label>
                    <input type="text" id="rentalAddress" class="form-input" 
                        value="Lot 22 Zarate Compound Purok 4, Bakakent Norte, Baguio City" readonly>
                    <small style="color: var(--dark-gray);">Fixed address as per agreement</small>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Monthly Rental Amount (₱) *</label>
                    <input type="number" id="rentalAmount" class="form-input" placeholder="0" min="0" step="0.01" required readonly>
                    <small style="color: var(--dark-gray);">Auto-filled based on selected room</small>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Security Deposit (₱) *</label>
                    <input type="number" id="securityDeposit" class="form-input" placeholder="0" min="0" step="0.01" required readonly>
                    <small style="color: var(--dark-gray);">Auto-filled based on selected room</small>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Payment Method</label>
                    <select id="paymentMethod" class="form-input" ${availableRooms.length === 0 ? 'disabled' : ''}>
                        <option value="Cash">Cash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="GCash">GCash</option>
                        <option value="Maya">Maya</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Date of Entry *</label>
                    <input type="date" id="dateOfEntry" class="form-input" required ${availableRooms.length === 0 ? 'disabled' : ''}>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Date of 1st Payment *</label>
                    <input type="date" id="firstPaymentDate" class="form-input" required ${availableRooms.length === 0 ? 'disabled' : ''}>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Day of Payment *</label>
                    <select id="paymentDay" class="form-input" required ${availableRooms.length === 0 ? 'disabled' : ''}>
                        <option value="">Select payment day</option>
                        <option value="5">5th of the month</option>
                        <option value="10">10th of the month</option>
                        <option value="15">15th of the month</option>
                        <option value="20">20th of the month</option>
                        <option value="25">25th of the month</option>
                        <option value="30">30th of the month</option>
                    </select>
                </div>
                
                <div id="tenantCreationResult" style="display: none; margin-top: 15px; padding: 10px; border-radius: 8px;"></div>
            </div>
        `;

        const modal = ModalManager.openModal(modalContent, {
            title: 'Add New Tenant - Step 1 of 3',
            submitText: availableRooms.length === 0 ? 'No Available Rooms' : 'Next: Review Agreement',
            onSubmit: availableRooms.length === 0 ? () => {} : () => this.validateTenantForm()
        });

        // Only set up dates and event listeners if there are available rooms
        if (availableRooms.length > 0) {
            setTimeout(() => {
                const today = new Date().toISOString().split('T')[0];
                const firstPayment = new Date();
                firstPayment.setDate(firstPayment.getDate() + 5);
                
                document.getElementById('dateOfEntry').value = today;
                document.getElementById('firstPaymentDate').value = firstPayment.toISOString().split('T')[0];
                
                // Add event listener for room selection
                this.setupRoomSelectionWithMemberInfo();
            }, 100);
        }

        this.addTenantModal = modal;
    }

    setupRoomSelectionWithMemberInfo() {
        const roomSelect = document.getElementById('roomNumber');
        const rentalAmountInput = document.getElementById('rentalAmount');
        const securityDepositInput = document.getElementById('securityDeposit');
        const memberLimitInfo = document.getElementById('memberLimitInfo');
        const memberLimitText = document.getElementById('memberLimitText');
        
        if (roomSelect) {
            roomSelect.addEventListener('change', (e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                if (selectedOption.value) {
                    const rent = selectedOption.getAttribute('data-rent');
                    const deposit = selectedOption.getAttribute('data-deposit');
                    const maxMembers = selectedOption.getAttribute('data-max-members');
                    
                    rentalAmountInput.value = rent || '';
                    securityDepositInput.value = deposit || '';
                    
                    // Show member limit information with fallback
                    if (memberLimitInfo && memberLimitText) {
                        const memberLimit = maxMembers ? parseInt(maxMembers) : 1;
                        memberLimitText.textContent = `This unit allows maximum ${memberLimit} member(s)`;
                        memberLimitInfo.style.display = 'block';
                        
                        // Store max members for later use
                        this.selectedRoomMaxMembers = memberLimit;
                    }
                } else {
                    rentalAmountInput.value = '';
                    securityDepositInput.value = '';
                    if (memberLimitInfo) {
                        memberLimitInfo.style.display = 'none';
                    }
                    this.selectedRoomMaxMembers = null;
                }
            });
        }
    }

    async getRoomByNumber(roomNumber) {
        try {
            if (!roomNumber) {
                console.warn('⚠️ No room number provided');
                return null;
            }
            
            const roomDoc = await firebaseDb.collection('rooms').doc(roomNumber).get();
            if (roomDoc.exists) {
                const roomData = roomDoc.data();
                
                // Ensure maxMembers is set based on room number if missing
                let maxMembers = roomData.maxMembers;
                if (maxMembers === undefined || maxMembers === null) {
                    if (roomNumber.startsWith('1')) {
                        maxMembers = 1;
                    } else if (roomNumber.startsWith('2')) {
                        maxMembers = 2;
                    } else if (roomNumber.startsWith('3') || roomNumber.startsWith('4')) {
                        maxMembers = 4;
                    } else if (roomNumber.startsWith('5')) {
                        maxMembers = 5;
                    } else {
                        maxMembers = 1;
                    }
                    
                    // Update the room document with the calculated maxMembers
                    await firebaseDb.collection('rooms').doc(roomNumber).update({
                        maxMembers: maxMembers,
                        updatedAt: new Date().toISOString()
                    });
                    
                    console.log(`📝 Auto-updated ${roomNumber} with maxMembers: ${maxMembers}`);
                }
                
                console.log('✅ Room found:', { roomNumber, maxMembers });
                return { 
                    id: roomDoc.id, 
                    ...roomData,
                    maxMembers: maxMembers // Ensure we return the calculated value
                };
            } else {
                console.warn('⚠️ Room not found:', roomNumber);
                return null;
            }
        } catch (error) {
            console.error('❌ Error fetching room:', error);
            return null;
        }
    }

    async debugLeaseData() {
        console.log('🔍 DEBUG: Checking current lease data in Firestore...');
        
        const user = this.currentUser;
        if (!user) {
            console.log('❌ No user logged in');
            return;
        }
        
        const lease = await DataManager.getTenantLease(user.uid);
        console.log('📄 CURRENT LEASE DATA:', {
            id: lease?.id,
            roomNumber: lease?.roomNumber,
            occupants: lease?.occupants,
            totalOccupants: lease?.totalOccupants,
            maxOccupants: lease?.maxOccupants
        });
        
        if (lease?.occupants) {
            console.log('👥 OCCUPANTS DETAILS:', {
                count: lease.occupants.length,
                list: lease.occupants,
                primary: lease.occupants[0],
                additional: lease.occupants.slice(1)
            });
        }
    }

    async fixSingleOccupantLeases() {
        const user = casaLink.currentUser;
        if (!user) {
            console.log('❌ No user logged in');
            return;
        }
        
        const lease = await DataManager.getTenantLease(user.uid);
        if (!lease) {
            console.log('❌ No lease found');
            return;
        }
        
        const room = await casaLink.getRoomByNumber(lease.roomNumber);
        const maxMembers = room?.maxMembers || 1;
        
        if (maxMembers === 1) {
            // Fix the occupants array for single occupant units
            await firebaseDb.collection('leases').doc(lease.id).update({
                occupants: [user.name],
                totalOccupants: 1,
                updatedAt: new Date().toISOString()
            });
            
            console.log('✅ Fixed single occupant lease for:', user.name);
            casaLink.showNotification('Lease data updated successfully!', 'success');
            
            // Refresh the lease agreement view
            setTimeout(() => {
                casaLink.showLeaseAgreementVerification();
            }, 1000);
        }
    }

    async saveMemberInformation(lease, maxMembers, currentOccupants = [], skipValidation = false) {
        try {
            console.log('💾 Saving member information...');
            
            // Always start with the current user as primary tenant
            let members = [this.currentUser.name];
            
            // Add any existing occupants (except duplicates of current user)
            if (Array.isArray(currentOccupants)) {
                currentOccupants.forEach(occupant => {
                    if (occupant !== this.currentUser.name && !members.includes(occupant)) {
                        members.push(occupant);
                    }
                });
            }

            // Collect additional member names from the form
            const additionalMembersAllowed = maxMembers - members.length;
            for (let i = 1; i <= additionalMembersAllowed; i++) {
                const memberName = document.getElementById(`memberName${i}`)?.value?.trim();
                if (memberName && !members.includes(memberName)) {
                    console.log(`✅ Adding member ${i}:`, memberName);
                    members.push(memberName);
                }
            }

            console.log('👥 Final member list:', members);

            // Update Firestore
            await firebaseDb.collection('leases').doc(lease.id).update({
                occupants: members,
                totalOccupants: members.length,
                updatedAt: new Date().toISOString()
            });

            await firebaseDb.collection('users').doc(this.currentUser.uid).update({
                roomMembers: members,
                totalRoomMembers: members.length,
                updatedAt: new Date().toISOString()
            });

            console.log('✅ Member information saved');

            // Close modal and proceed
            if (this.memberInfoModal) {
                ModalManager.closeModal(this.memberInfoModal);
            }
            
            // Add delay for Firestore commit
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.showLeaseAgreementVerification();

        } catch (error) {
            console.error('❌ Error saving member information:', error);
            this.showNotification('Failed to save member information.', 'error');
        }
    }

    async saveMemberInformation(lease, maxMembers, skipValidation = false) {
        try {
            console.log('💾 Saving member information...');
            
            const additionalMembers = maxMembers - 1;
            const members = [this.currentUser.name]; // Primary tenant is always first
            
            // Collect additional member names
            for (let i = 1; i <= additionalMembers; i++) {
                const memberName = document.getElementById(`memberName${i}`)?.value?.trim();
                if (memberName) {
                    console.log(`✅ Adding member ${i}:`, memberName);
                    members.push(memberName);
                } else {
                    console.log(`⏭️ Skipping empty member ${i}`);
                }
            }

            console.log('👥 Final member list:', members);

            // Update lease document with member information
            await firebaseDb.collection('leases').doc(lease.id).update({
                occupants: members,
                totalOccupants: members.length,
                updatedAt: new Date().toISOString()
            });

            // Update user document
            await firebaseDb.collection('users').doc(this.currentUser.uid).update({
                roomMembers: members,
                totalRoomMembers: members.length,
                updatedAt: new Date().toISOString()
            });

            console.log('✅ Member information saved successfully');
            
            // Close modal if it exists
            if (this.memberInfoModal) {
                ModalManager.closeModal(this.memberInfoModal);
            }
            
            // Show success message
            if (members.length > 1) {
                this.showNotification(`Member information saved! ${members.length - 1} additional member(s) added.`, 'success');
            } else {
                this.showNotification('Proceeding with primary tenant only.', 'info');
            }
            
            // Small delay before showing lease agreement
            setTimeout(() => {
                this.showLeaseAgreementVerification();
            }, 1000);

        } catch (error) {
            console.error('❌ Error saving member information:', error);
            
            const errorElement = document.getElementById('memberInfoError');
            if (errorElement) {
                errorElement.textContent = 'Failed to save member information. Please try again.';
                errorElement.style.display = 'block';
            } else {
                this.showNotification('Failed to save member information.', 'error');
            }
        }
    }

    async showMemberInformationCollection() {
        try {
            console.log('👥 Starting member information collection...');
            
            const lease = await DataManager.getTenantLease(this.currentUser.uid);
            if (!lease) {
                this.showNotification('No lease information found.', 'error');
                this.showLeaseAgreementVerification(); // Fallback to lease agreement
                return;
            }

            const room = await this.getRoomByNumber(lease.roomNumber);
            const maxMembers = room?.maxMembers || 1;
            
            console.log('🏠 Member collection for:', {
                roomNumber: lease.roomNumber,
                maxMembers: maxMembers,
                currentUser: this.currentUser.name
            });
            
            // If max members is 1, skip this step and go directly to lease agreement
            if (maxMembers <= 1) {
                console.log('⏭️ Skipping member collection - max members is 1');
                this.showLeaseAgreementVerification();
                return;
            }

            let memberFields = '';
            const additionalMembers = maxMembers - 1; // Primary tenant is already counted
            
            console.log(`📝 Generating fields for ${additionalMembers} additional members`);

            for (let i = 1; i <= additionalMembers; i++) {
                memberFields += `
                    <div class="form-group">
                        <label class="form-label">Additional Member ${i} - Full Name</label>
                        <input type="text" id="memberName${i}" class="form-input" placeholder="Enter full name">
                        <small style="color: var(--dark-gray);">Optional - enter if this member will be staying with you</small>
                    </div>
                `;
            }

            const modalContent = `
                <div class="member-info-modal">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <i class="fas fa-users" style="font-size: 3rem; color: var(--primary-blue); margin-bottom: 15px;"></i>
                        <h3 style="margin-bottom: 10px;">Additional Member Information</h3>
                        <p>Your unit <strong>${lease.roomNumber}</strong> allows up to <strong>${maxMembers} members</strong>.</p>
                        <p>Please provide information for additional members staying with you.</p>
                    </div>
                    
                    <div style="background: rgba(26, 115, 232, 0.1); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <p style="margin: 0; font-size: 0.9rem;">
                            <i class="fas fa-info-circle" style="color: var(--primary-blue);"></i>
                            <strong>Primary Tenant:</strong> ${this.currentUser.name}<br>
                            <strong>Room:</strong> ${lease.roomNumber}<br>
                            <strong>Maximum occupants:</strong> ${maxMembers}<br>
                            <strong>Additional members allowed:</strong> ${additionalMembers}
                        </p>
                    </div>
                    
                    ${memberFields}
                    
                    <div id="memberInfoError" style="color: var(--danger); margin-bottom: 15px; display: none;"></div>
                    
                    <div class="security-info">
                        <i class="fas fa-info-circle"></i>
                        <small>This information will be included in your lease agreement. You can skip optional members if they won't be staying with you.</small>
                    </div>
                </div>
            `;

            const modal = ModalManager.openModal(modalContent, {
                title: 'Member Information - Step 3 of 5',
                submitText: 'Next: Review Lease Agreement',
                onSubmit: () => this.saveMemberInformation(lease, maxMembers),
                onCancel: () => {
                    // If user cancels, still proceed to lease agreement but with only primary tenant
                    this.saveMemberInformation(lease, maxMembers, true);
                }
            });

            this.memberInfoModal = modal;

        } catch (error) {
            console.error('❌ Error showing member information collection:', error);
            this.showNotification('Error loading member information form.', 'error');
            // Fallback to lease agreement
            this.showLeaseAgreementVerification();
        }
    }



    validateTenantForm() {
        const name = document.getElementById('tenantName')?.value;
        const email = document.getElementById('tenantEmail')?.value;
        const phone = document.getElementById('tenantPhone')?.value;
        const occupation = document.getElementById('tenantOccupation')?.value;
        const age = document.getElementById('tenantAge')?.value;
        const roomSelect = document.getElementById('roomNumber');
        const selectedRoom = roomSelect?.options[roomSelect.selectedIndex];
        const rentalAmount = document.getElementById('rentalAmount')?.value;
        const securityDeposit = document.getElementById('securityDeposit')?.value;
        const dateOfEntry = document.getElementById('dateOfEntry')?.value;
        const firstPaymentDate = document.getElementById('firstPaymentDate')?.value;
        const paymentDay = document.getElementById('paymentDay')?.value;

        // Check if room select is disabled (no available rooms)
        if (roomSelect && roomSelect.disabled) {
            this.showNotification('No available rooms to assign. All units are occupied.', 'error');
            return;
        }

        // Validate required fields
        if (!name || !email || !occupation || !age || !phone || !selectedRoom?.value ||
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
            roomNumber: selectedRoom.value, // Now this is the actual room number (e.g., "1A")
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

    getOrdinalSuffix(day) {
        if (!day || typeof day !== 'number') return '';
        
        if (day >= 11 && day <= 13) return 'th';
        
        const lastDigit = day % 10;
        switch (lastDigit) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    }

    showLeaseAgreementModal(tenantId, tenantData) {
        const data = tenantData || this.pendingTenantData;
        if (!data) {
            this.showNotification('No tenant data found. Please start over.', 'error');
            return;
        }

        // Calculate lease end date
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

        // Get max members for the room
        const maxMembers = this.selectedRoomMaxMembers || 1;
        const additionalFee = 2000;

        // Format tenant section (this will show primary tenant only since members haven't been added yet)
        const tenantLesseeSection = `
            <p style="margin-left: 20px;">
                <strong>Landlady/Lessor:</strong> Nelly Virtucio<br>
                <strong>Tenant/Lessee:</strong> ${data.name}<br>
                <em>Additional occupants can be added by the tenant during account setup</em>
            </p>
        `;

        const modalContent = `
            <div class="lease-agreement-modal" style="max-height: 70vh; overflow-y: auto;">
                <div style="text-align: center; margin-bottom: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                    <h3 style="color: var(--primary-blue); margin-bottom: 10px;">LEASE AGREEMENT</h3>
                    <p style="color: var(--dark-gray);">Please review the lease agreement below</p>
                </div>
                
                <div style="line-height: 1.6; font-size: 0.95rem;">
                    <p><strong>This agreement is made by and between:</strong></p>
                    ${tenantLesseeSection}
                    
                    <p>This landlady hereby agrees to lessee the unit <strong>${data.roomNumber}</strong> of her house located at <strong>${data.rentalAddress}</strong>. 
                    The lesse period shall be for 1 year beginning <strong>${formattedDateOfEntry}</strong> and shall end and may be renewable one (1) year thereafter.</p>
                    
                    <p>In case of failure to stay for the period of one (1) year the landlady won't refund the security deposit of <strong>₱${data.securityDeposit.toLocaleString()}</strong> 
                    but if tenant stayed for a year or more the security deposit is refundable or consumable.</p>
                    
                    <p><strong>Limit of occupants be ${maxMembers} ${maxMembers === 1 ? 'person' : 'persons'} regardless of age</strong>, additional pay for excess of two thousand pesos (${additionalFee.toLocaleString()}) per person.</p>
                    
                    <p><strong>Increase of monthly rental may occur at any time of the year as determined by the landlady.</strong></p>
                    
                    <!-- Occupancy Information -->
                    <div style="background: rgba(52, 168, 83, 0.1); padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid var(--success);">
                        <h5 style="margin: 0 0 10px 0; color: var(--success);"><i class="fas fa-home"></i> Room Information Summary</h5>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 0.9rem;">
                            <div><strong>Room Number:</strong> ${data.roomNumber}</div>
                            <div><strong>Monthly Rent:</strong> ₱${data.rentalAmount.toLocaleString()}</div>
                            <div><strong>Security Deposit:</strong> ₱${data.securityDeposit.toLocaleString()}</div>
                            <div><strong>Maximum Occupants:</strong> ${maxMembers} ${maxMembers === 1 ? 'person' : 'persons'}</div>
                            <div><strong>Primary Tenant:</strong> ${data.name}</div>
                            <div><strong>Additional Members Allowed:</strong> ${maxMembers - 1}</div>
                        </div>
                    </div>
                    
                    <!-- Rest of the agreement content remains the same -->
                    <h4 style="margin: 20px 0 10px 0; color: var(--primary-blue);">Terms and Conditions:</h4>
                    
                    <ol style="margin-left: 20px; padding-left: 0;">
                        <li><strong>Garbage/Trash</strong> - tenant is responsible for disposing his/her trash and garbage on proper place. Dispose every Thursday afternoon at Purok 6 or Jeepney Terminal near Barangay Hall.</li>
                        <li><strong>Smoking</strong> - No tenant shall smoke, nor permit anyone to smoke within the leased area.</li>
                        <li><strong>Noise</strong> - All radios, television set, speakers or any appliances or items which may cause noise, etc. must be turned down to a level of sound that does not annoy or interfere with other lessee.</li>
                        <li><strong>Visitor & Guest</strong> - Maximum of 10 visitors allowed to enter the unit and should leave before 10pm.</li>
                        <li><strong>Locks</strong> - Tenants are to provide their own padlock for their unit. Upon termination of contract tenant must remove their own padlock.</li>
                        <li><strong>Interior and Exterior</strong> - No nails or any kind (thumbtacks, pin, etc). If in case there are some make use of it but don't add still. Never hand, leave valuable things on hallways. Shoes/slippers are exceptions, always keep clear and clean.</li>
                        <li><strong>Payment Schedule</strong> - Monthly rental payment of <strong>₱${data.rentalAmount.toLocaleString()}</strong> is due on the <strong>${data.paymentDay}${this.getOrdinalSuffix(parseInt(data.paymentDay))}</strong> day of each month. Late payments will incur penalties as specified in this agreement.</li>
                        <li><strong>Utilities Payment</strong> - Electric and water bills must be paid on or before due date to avoid cut offs or penalties.</li>
                        <li><strong>Light Bulbs</strong> - Tenant at tenant expense shall be responsible for replacement of all interior light bulbs. All light bulbs must be operational all the time until the tenant vacate the unit.</li>
                        <li><strong>Damage</strong> - Tenants will be held responsible for any damage to their units or to the common areas caused by themselves or their guest, especially damaged pipe, clogging of bowl, sink, electrical plug/switches and bulb.</li>
                        <li><strong>Security</strong> - The safety and welfare of the tenant's property is responsibility of the tenants. Use good common sense and think about safety.</li>
                        <li><strong>Cleaning Upon Termination</strong> - Upon termination of the lease, tenant shall be responsible for cleaning the premises. Additional charge of Php 2,000 if failed to do so.</li>
                    </ol>
                    
                    <p><strong>13. Acknowledgement</strong> - The parties hereby acknowledge & understand the terms herein set forth in the agreement signed on this day of <strong>${formattedDateOfEntry}</strong></p>
                    
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
                            The tenant account will be created with "unverified" status. Status will change to "verified" once the tenant changes their temporary password, provides additional occupant information, and agrees to these terms.
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

    async migrateRoomsToUseRoomNumbers() {
        try {
            console.log('🔄 Migrating rooms to use room numbers as document IDs...');
            
            const roomsSnapshot = await firebaseDb.collection('rooms').get();
            
            if (roomsSnapshot.empty) {
                console.log('No rooms to migrate');
                return;
            }
            
            const batch = firebaseDb.batch();
            let migratedCount = 0;
            
            // Delete old rooms and create new ones with proper IDs
            for (const doc of roomsSnapshot.docs) {
                const roomData = doc.data();
                const roomNumber = roomData.roomNumber;
                
                if (roomNumber) {
                    // Create new document with room number as ID
                    const newRoomRef = firebaseDb.collection('rooms').doc(roomNumber);
                    batch.set(newRoomRef, {
                        ...roomData,
                        updatedAt: new Date().toISOString()
                    });
                    
                    // Delete old document
                    batch.delete(doc.ref);
                    migratedCount++;
                }
            }
            
            await batch.commit();
            console.log(`✅ Migrated ${migratedCount} rooms to use room numbers as document IDs`);
            
        } catch (error) {
            console.error('❌ Error migrating rooms:', error);
        }
    }

    async updateRoomMemberLimits() {
        try {
            console.log('🔄 Updating room member limits...');
            
            const roomsSnapshot = await firebaseDb.collection('rooms').get();
            const batch = firebaseDb.batch();
            let updatedCount = 0;

            roomsSnapshot.forEach(doc => {
                const roomData = doc.data();
                const roomNumber = roomData.roomNumber || doc.id;
                
                // Determine maxMembers based on room number
                let maxMembers = 1; // Default
                
                if (roomNumber.startsWith('1')) {
                    maxMembers = 1;
                } else if (roomNumber.startsWith('2')) {
                    maxMembers = 2;
                } else if (roomNumber.startsWith('3') || roomNumber.startsWith('4')) {
                    maxMembers = 4;
                } else if (roomNumber.startsWith('5')) {
                    maxMembers = 5;
                }

                // Only update if maxMembers is different or doesn't exist
                if (roomData.maxMembers !== maxMembers) {
                    batch.update(doc.ref, { maxMembers: maxMembers });
                    updatedCount++;
                    console.log(`📝 Updating ${roomNumber}: maxMembers = ${maxMembers}`);
                }
            });

            if (updatedCount > 0) {
                await batch.commit();
                console.log(`✅ Updated ${updatedCount} rooms with member limits`);
            } else {
                console.log('✅ All rooms already have correct member limits');
            }
            
        } catch (error) {
            console.error('❌ Error updating room member limits:', error);
        }
    }

    async debugOnboardingFlow() {
            console.log('🐛 DEBUG: Tenant Onboarding Flow');
            
            const user = this.currentUser;
            if (!user) {
                console.log('❌ No current user');
                return;
            }
            
            console.log('👤 Current User:', {
                id: user.id,
                email: user.email,
                role: user.role,
                passwordChanged: user.passwordChanged,
                status: user.status
            });
            
            const lease = await DataManager.getTenantLease(user.uid);
            console.log('📄 Lease Data:', lease);
            
            if (lease) {
                const room = await this.getRoomByNumber(lease.roomNumber);
                console.log('🏠 Room Data:', room);
            }
            
            console.log('🔚 End Debug');
        }

        async debugOnboardingFlow() {
        console.log('🐛 DEBUG: Starting onboarding flow analysis...');
        
        const user = this.currentUser;
        if (!user) {
            console.log('❌ No current user');
            return;
        }
        
        console.log('👤 Current User:', {
            id: user.id,
            email: user.email,
            role: user.role,
            passwordChanged: user.passwordChanged,
            status: user.status,
            requiresPasswordChange: user.requiresPasswordChange
        });
        
        const lease = await DataManager.getTenantLease(user.uid);
        console.log('📄 Lease Data:', {
            exists: !!lease,
            id: lease?.id,
            roomNumber: lease?.roomNumber,
            maxOccupants: lease?.maxOccupants,
            occupants: lease?.occupants,
            totalOccupants: lease?.totalOccupants
        });
        
        if (lease?.roomNumber) {
            const room = await this.getRoomByNumber(lease.roomNumber);
            console.log('🏠 Room Data:', {
                exists: !!room,
                roomNumber: room?.roomNumber,
                maxMembers: room?.maxMembers
            });
        }
        
        console.log('🔚 End Debug');
    }

    async createLeaseDocument(tenantId, tenantData, leaseEndDate) {
        try {
            console.log('📝 Creating SINGLE lease document for tenant:', tenantId);

            // 🔹 Get room info
            const room = await this.getRoomByNumber(tenantData.roomNumber);
            const maxMembers = room?.maxMembers || 1;

            // NEW LOGIC: Auto-set occupants for 1-member units
            const autoOccupants = maxMembers === 1 ? [tenantData.name] : [];
            const autoTotal = maxMembers === 1 ? 1 : 0;

            console.log("🏠 Auto occupants check:", {
                maxMembers,
                autoOccupants,
                autoTotal
            });

            // 🔍 Check if active lease already exists
            const existingLeaseQuery = await firebaseDb.collection('leases')
                .where('tenantId', '==', tenantId)
                .where('isActive', '==', true)
                .limit(1)
                .get();

            // Mark room as occupied
            if (tenantData.roomNumber) {
                await firebaseDb.collection('rooms').doc(tenantData.roomNumber).update({
                    isAvailable: false,
                    occupiedBy: tenantId,
                    occupiedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                console.log('✅ Room marked as occupied:', tenantData.roomNumber);
            }

            // 🔄 If lease exists → UPDATE instead of creating
            if (!existingLeaseQuery.empty) {
                console.log('⚠️ Active lease exists, updating instead...');
                const existingLeaseId = existingLeaseQuery.docs[0].id;

                await firebaseDb.collection('leases').doc(existingLeaseId).update({
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

                    // 🔹 UPDATED OCCUPANCY LOGIC
                    maxOccupants: maxMembers,
                    occupants: autoOccupants,
                    totalOccupants: autoTotal,

                    updatedAt: new Date().toISOString()
                });

                console.log('🏠 UPDATED lease occupant info:', {
                    maxOccupants: maxMembers,
                    occupants: autoOccupants,
                    totalOccupants: autoTotal
                });

                return existingLeaseId;
            }

            // 🆕 Create NEW lease document
            const leaseData = {
                tenantId: tenantId,
                tenantName: tenantData.name,
                tenantEmail: tenantData.email,
                tenantPhone: tenantData.phone,
                tenantOccupation: tenantData.occupation,
                tenantAge: tenantData.age,

                landlordId: this.currentUser.uid,
                landlordName: 'Nelly D. Virtucio',

                roomNumber: tenantData.roomNumber,
                rentalAddress: tenantData.rentalAddress,

                monthlyRent: tenantData.rentalAmount,
                securityDeposit: tenantData.securityDeposit,
                paymentMethod: tenantData.paymentMethod,
                leaseStart: tenantData.dateOfEntry,
                leaseEnd: leaseEndDate,
                leaseDuration: 12,
                paymentDueDay: parseInt(tenantData.paymentDay),
                firstPaymentDate: tenantData.firstPaymentDate,

                // 🔹 NEW OCCUPANCY LOGIC
                maxOccupants: maxMembers,
                occupants: autoOccupants,  // Auto add for single rooms
                totalOccupants: autoTotal,

                status: 'active',
                isActive: true,
                securityDepositPaid: false,

                agreementType: 'standard',
                additionalOccupantFee: 2000,

                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),

                includesWater: false,
                includesElectricity: false,
                includesInternet: false,

                agreementViewed: false,
                agreementAccepted: false,
                agreementAcceptedDate: null
            };

            console.log('🚨 LEASE CREATION - Occupants FINAL:', {
                maxOccupants: maxMembers,
                occupants: autoOccupants,
                totalOccupants: autoTotal,
                isSingleOccupant: maxMembers === 1
            });

            // Save lease
            const leaseRef = await firebaseDb.collection('leases').add(leaseData);
            console.log('✅ New lease created with ID:', leaseRef.id);

            // Update tenant's user record
            await firebaseDb.collection('users').doc(tenantId).update({
                leaseId: leaseRef.id,
                currentLease: leaseRef.id,
                roomNumber: tenantData.roomNumber,
                status: 'unverified',
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

    calculateTenantBillingStats(bills) {
        const today = new Date();
        
        const unpaidBills = bills.filter(b => b.status === 'pending');
        const paidBills = bills.filter(b => b.status === 'paid');
        const overdueBills = unpaidBills.filter(b => new Date(b.dueDate) < today);
        
        const totalDue = unpaidBills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        const totalPaid = paidBills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        
        // Find next due date
        const nextUnpaid = unpaidBills.sort((a, b) => 
            new Date(a.dueDate) - new Date(b.dueDate)
        )[0];
        
        let nextDueDate = 'N/A';
        let daysUntilDue = 0;
        
        if (nextUnpaid) {
            const dueDate = new Date(nextUnpaid.dueDate);
            nextDueDate = dueDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });
            daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        }
        
        return {
            totalDue: totalDue,
            totalPaid: totalPaid,
            unpaidCount: unpaidBills.length,
            paidCount: paidBills.length,
            overdueCount: overdueBills.length,
            nextDueDate: nextDueDate,
            daysUntilDue: Math.max(0, daysUntilDue)
        };
    }

    switchTenantBillingTab(tabName) {
        console.log('🔄 Switching tenant billing tab to:', tabName);
        
        // Hide all tabs
        const tabs = document.querySelectorAll('#billsAllTab, #billsPendingTab, #billsPaidTab, #billsOverdueTab');
        tabs.forEach(tab => tab.classList.remove('active'));
        
        // Remove active from all buttons
        const buttons = document.querySelectorAll('.billing-tabs .tab-button');
        buttons.forEach(btn => btn.classList.remove('active'));
        
        // Show selected tab
        document.getElementById(`bills${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`)?.classList.add('active');
        
        // Mark button as active
        event.target.closest('.tab-button')?.classList.add('active');
    }


    async getTenantBillingPage() {
        console.log('📋 Loading tenant billing page...');
        
        if (!this.currentUser) {
            return this.getErrorDashboard('tenantBilling', 'User not authenticated');
        }

        try {
            // Fetch tenant's bills and payments
            const bills = await DataManager.getTenantBills(this.currentUser.id);
            const payments = await DataManager.getTenantPayments(this.currentUser.id);
            
            console.log('✅ Fetched tenant bills:', bills.length);
            console.log('✅ Fetched tenant payments:', payments.length);

            // Calculate billing stats
            const stats = this.calculateTenantBillingStats(bills);

            return `
                <div class="page-content">
                    <div class="page-header">
                        <h1 class="page-title">My Billing</h1>
                        <p style="color: var(--dark-gray); margin: 5px 0 0 0;">View and pay your bills</p>
                    </div>

                    <!-- Billing Stats -->
                    <div class="card-group">
                        <div class="card">
                            <div class="card-header">
                                <span class="card-title">Current Balance</span>
                                <div class="card-icon success">
                                    <i class="fas fa-wallet"></i>
                                </div>
                            </div>
                            <div class="card-value">₱${stats.totalDue.toLocaleString()}</div>
                            <div class="card-subtitle">${stats.unpaidCount} unpaid bill(s)</div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <span class="card-title">Next Due Date</span>
                                <div class="card-icon info">
                                    <i class="fas fa-calendar-alt"></i>
                                </div>
                            </div>
                            <div class="card-value">${stats.nextDueDate}</div>
                            <div class="card-subtitle">${stats.daysUntilDue} days remaining</div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <span class="card-title">Total Paid</span>
                                <div class="card-icon success">
                                    <i class="fas fa-check-circle"></i>
                                </div>
                            </div>
                            <div class="card-value">₱${stats.totalPaid.toLocaleString()}</div>
                            <div class="card-subtitle">${stats.paidCount} paid bill(s)</div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <span class="card-title">Late Payments</span>
                                <div class="card-icon ${stats.overdueCount > 0 ? 'danger' : 'success'}">
                                    <i class="fas fa-exclamation-circle"></i>
                                </div>
                            </div>
                            <div class="card-value" style="color: ${stats.overdueCount > 0 ? 'var(--danger)' : 'var(--success)'}">
                                ${stats.overdueCount}
                            </div>
                            <div class="card-subtitle">overdue bills</div>
                        </div>
                    </div>

                    <!-- Bills Section -->
                    <div style="margin-bottom: 30px;">
                        <div style="background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08); overflow: hidden;">
                            <div style="padding: 20px; background: #f8f9fa; border-bottom: 1px solid #e9ecef;">
                                <h3 style="margin: 0; color: var(--text-dark); font-size: 1.2rem;">Outstanding Bills</h3>
                                <p style="margin: 5px 0 0 0; color: var(--dark-gray); font-size: 0.9rem;">Bills waiting for payment</p>
                            </div>
                            ${this.renderTenantBillsTable(bills.filter(b => b.status === 'pending'), 'outstanding')}
                        </div>
                    </div>

                    <!-- All Payments Section -->
                    <div>
                        <div style="background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08); overflow: hidden;">
                            <div style="padding: 20px; background: #f8f9fa; border-bottom: 1px solid #e9ecef;">
                                <h3 style="margin: 0; color: var(--text-dark); font-size: 1.2rem;">All Payments</h3>
                                <p style="margin: 5px 0 0 0; color: var(--dark-gray); font-size: 0.9rem;">Your complete payment history</p>
                            </div>
                            ${this.renderTenantPaymentsHistory(payments)}
                        </div>
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('❌ Error loading tenant billing page:', error);
            return this.getErrorDashboard('tenantBilling', error.message);
        }
    }

    getPaymentMethodBadge(method) {
        const methods = {
            'cash': { name: 'Cash', icon: 'fas fa-money-bill', color: '#34A853' },
            'gcash': { name: 'GCash', icon: 'fas fa-mobile-alt', color: '#0099CC' },
            'maya': { name: 'Maya', icon: 'fas fa-wallet', color: '#6933CC' },
            'bank_transfer': { name: 'Bank Transfer', icon: 'fas fa-university', color: '#FBBC04' },
            'check': { name: 'Check', icon: 'fas fa-money-check', color: '#EA4335' }
        };
        
        const methodData = methods[method] || { name: method, icon: 'fas fa-credit-card', color: '#5F6368' };
        
        return `
            <span style="
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 6px 10px;
                border-radius: 6px;
                font-size: 0.85rem;
                background: ${methodData.color}20;
                color: ${methodData.color};
                font-weight: 500;
            ">
                <i class="${methodData.icon}" style="font-size: 0.9rem;"></i>
                ${methodData.name}
            </span>
        `;
    }

    getPaymentMethodLabel(method) {
        const methods = {
            'cash': 'Cash Payment',
            'gcash': 'GCash',
            'maya': 'Maya',
            'bank_transfer': 'Bank Transfer',
            'check': 'Check Payment'
        };
        
        return methods[method] || method;
    }

    async showTenantPaymentDetailsModal(paymentId) {
        console.log('💳 Opening tenant payment details for:', paymentId);
        
        try {
            const payment = await firebaseDb.collection('payments').doc(paymentId).get();
            
            if (!payment.exists) {
                throw new Error('Payment record not found');
            }
            
            const paymentData = { id: payment.id, ...payment.data() };
            const paymentDate = new Date(paymentData.paymentDate || paymentData.createdAt);
            
            const statusColor = paymentData.status === 'completed' ? 'var(--success)' : 
                            paymentData.status === 'pending_verification' ? 'var(--warning)' :
                            'var(--danger)';
            
            const statusLabel = paymentData.status === 'completed' ? 'Payment Completed' :
                            paymentData.status === 'pending_verification' ? 'Pending Verification' :
                            'Payment Failed';

            const modalContent = `
                <div style="max-width: 600px;">
                    <!-- Payment Summary -->
                    <div style="background: ${statusColor}15; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid ${statusColor};">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <div>
                                <div style="color: var(--dark-gray); font-size: 0.9rem;">Payment Amount</div>
                                <div style="font-size: 2rem; font-weight: 700; color: ${statusColor};">
                                    ₱${(paymentData.amount || 0).toLocaleString()}
                                </div>
                            </div>
                            <i class="fas fa-check-circle" style="font-size: 2rem; color: ${statusColor}; opacity: 0.5;"></i>
                        </div>
                        <div style="color: var(--dark-gray); font-size: 0.85rem;">
                            Status: <strong style="color: ${statusColor};">${statusLabel}</strong>
                        </div>
                    </div>

                    <!-- Payment Details -->
                    <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef;">
                        <h4 style="margin: 0 0 15px 0; color: var(--text-dark);">Payment Details</h4>
                        
                        <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e9ecef;">
                            <span style="color: var(--dark-gray);">Payment Date:</span>
                            <strong>${paymentDate.toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}</strong>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e9ecef;">
                            <span style="color: var(--dark-gray);">Payment Method:</span>
                            <strong>${this.getPaymentMethodLabel(paymentData.paymentMethod)}</strong>
                        </div>

                        ${paymentData.reference ? `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e9ecef;">
                                <span style="color: var(--dark-gray);">Reference Number:</span>
                                <strong>${paymentData.reference}</strong>
                            </div>
                        ` : ''}

                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--dark-gray);">Transaction ID:</span>
                            <strong style="font-family: monospace; font-size: 0.9rem;">${paymentData.id}</strong>
                        </div>
                    </div>

                    ${paymentData.notes ? `
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 3px solid var(--royal-blue);">
                            <h5 style="margin: 0 0 10px 0; color: var(--text-dark); font-size: 0.9rem;">Notes</h5>
                            <p style="margin: 0; color: var(--dark-gray); font-size: 0.9rem; line-height: 1.5;">
                                ${paymentData.notes}
                            </p>
                        </div>
                    ` : ''}

                    ${paymentData.status === 'pending_verification' ? `
                        <div style="background: rgba(251, 188, 4, 0.1); border: 1px solid rgba(251, 188, 4, 0.3); padding: 15px; border-radius: 8px; margin-top: 20px;">
                            <div style="color: var(--warning); font-weight: 600; margin-bottom: 8px;">
                                <i class="fas fa-info-circle"></i> Payment Pending Verification
                            </div>
                            <p style="margin: 0; color: var(--dark-gray); font-size: 0.9rem;">
                                Your payment has been submitted and is awaiting verification from your landlord. This usually takes 1-2 business days.
                            </p>
                        </div>
                    ` : ''}

                    ${paymentData.status === 'completed' ? `
                        <div style="background: rgba(52, 168, 83, 0.1); border: 1px solid rgba(52, 168, 83, 0.3); padding: 15px; border-radius: 8px; margin-top: 20px;">
                            <div style="color: var(--success); font-weight: 600; margin-bottom: 8px;">
                                <i class="fas fa-check-circle"></i> Payment Confirmed
                            </div>
                            <p style="margin: 0; color: var(--dark-gray); font-size: 0.9rem;">
                                Your payment has been verified and processed successfully.
                            </p>
                        </div>
                    ` : ''}
                </div>
            `;
            
            const modal = ModalManager.openModal(modalContent, {
                title: 'Payment Details',
                showFooter: true,
                submitText: 'Close',
                cancelText: null,
                onSubmit: () => {
                    ModalManager.closeModal(modal);
                }
            });
            
        } catch (error) {
            console.error('❌ Error loading payment details:', error);
            this.showNotification('Failed to load payment details', 'error');
        }
    }

    renderTenantPaymentsHistory(payments) {
        if (payments.length === 0) {
            return `
                <div class="empty-state" style="padding: 40px;">
                    <i class="fas fa-history" style="font-size: 2.5rem; color: var(--dark-gray); opacity: 0.5; margin-bottom: 15px;"></i>
                    <h4>No Payment History</h4>
                    <p style="color: var(--dark-gray);">You haven't made any payments yet</p>
                </div>
            `;
        }

        // Sort payments by date (newest first)
        const sortedPayments = [...payments].sort((a, b) => 
            new Date(b.paymentDate || b.createdAt) - new Date(a.paymentDate || a.createdAt)
        );

        const rows = sortedPayments.map(payment => {
            const paymentDate = new Date(payment.paymentDate || payment.createdAt);
            const billDate = payment.billId ? new Date(payment.dueDate || payment.createdAt) : null;
            
            const statusColor = payment.status === 'completed' ? 'var(--success)' : 
                            payment.status === 'pending_verification' ? 'var(--warning)' :
                            'var(--danger)';
            
            const statusLabel = payment.status === 'completed' ? 'Completed' :
                            payment.status === 'pending_verification' ? 'Pending Verification' :
                            'Failed';
            
            return `
                <tr class="payment-row" onclick="casaLink.showTenantPaymentDetailsModal('${payment.id}')">
                    <td>
                        <strong style="color: var(--text-dark);">${payment.type === 'rent' ? 'Monthly Rent' : payment.description || 'Payment'}</strong>
                    </td>
                    <td>
                        ${paymentDate.toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                        })}
                    </td>
                    <td>
                        <strong style="font-size: 1.1rem; color: var(--text-dark);">
                            ₱${(payment.amount || 0).toLocaleString()}
                        </strong>
                    </td>
                    <td>
                        ${this.getPaymentMethodBadge(payment.paymentMethod)}
                    </td>
                    <td>
                        <span style="
                            padding: 6px 12px; 
                            border-radius: 20px; 
                            font-size: 0.85rem;
                            font-weight: 600;
                            background: ${statusColor === 'var(--success)' ? 'rgba(52, 168, 83, 0.1)' : 
                                    statusColor === 'var(--warning)' ? 'rgba(251, 188, 4, 0.1)' :
                                    'rgba(234, 67, 53, 0.1)'};
                            color: ${statusColor};
                        ">
                            ${statusLabel}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); casaLink.showTenantPaymentDetailsModal('${payment.id}')">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div class="table-container">
                <table class="data-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f8f9fa;">
                            <th style="padding: 15px; text-align: left; font-weight: 600; color: var(--dark-gray);">Description</th>
                            <th style="padding: 15px; text-align: left; font-weight: 600; color: var(--dark-gray);">Payment Date</th>
                            <th style="padding: 15px; text-align: left; font-weight: 600; color: var(--dark-gray);">Amount</th>
                            <th style="padding: 15px; text-align: left; font-weight: 600; color: var(--dark-gray);">Method</th>
                            <th style="padding: 15px; text-align: left; font-weight: 600; color: var(--dark-gray);">Status</th>
                            <th style="padding: 15px; text-align: left; font-weight: 600; color: var(--dark-gray);">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }

    getOverdueBills(bills) {
        const today = new Date();
        return bills.filter(b => new Date(b.dueDate) < today && b.status === 'pending');
    }

    renderTenantBillsTable(bills, filterType) {
        if (bills.length === 0) {
            return `
                <div class="empty-state" style="padding: 40px;">
                    <i class="fas fa-file-invoice-dollar" style="font-size: 2.5rem; color: var(--dark-gray); opacity: 0.5; margin-bottom: 15px;"></i>
                    <h4>No ${filterType} bills</h4>
                    <p style="color: var(--dark-gray);">
                        ${filterType === 'paid' ? 'You haven\'t paid any bills yet' : 'No bills found'}
                    </p>
                </div>
            `;
        }

        const rows = bills.map(bill => {
            const dueDate = new Date(bill.dueDate);
            const today = new Date();
            const isOverdue = dueDate < today && bill.status === 'pending';
            const daysRemaining = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
            
            return `
                <tr class="bill-row" onclick="casaLink.showTenantBillDetailsModal('${bill.id}')">
                    <td>
                        <strong>${bill.type === 'rent' ? 'Monthly Rent' : bill.description || 'Bill'}</strong>
                    </td>
                    <td>
                        ${dueDate.toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                        })}
                    </td>
                    <td>
                        <strong style="font-size: 1.1rem; color: var(--text-dark);">
                            ₱${(bill.totalAmount || 0).toLocaleString()}
                        </strong>
                    </td>
                    <td>
                        ${bill.status === 'paid' 
                            ? `<span class="status-badge" style="background: rgba(52, 168, 83, 0.1); color: var(--success); padding: 6px 12px; border-radius: 20px; font-size: 0.85rem;">Paid</span>`
                            : isOverdue
                            ? `<span class="status-badge" style="background: rgba(234, 67, 53, 0.1); color: var(--danger); padding: 6px 12px; border-radius: 20px; font-size: 0.85rem;">Overdue</span>`
                            : `<span class="status-badge" style="background: rgba(251, 188, 4, 0.1); color: var(--warning); padding: 6px 12px; border-radius: 20px; font-size: 0.85rem;">Due in ${daysRemaining} days</span>`
                        }
                    </td>
                    <td>
                        ${bill.status === 'pending' 
                            ? `<button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); casaLink.showTenantPaymentModal('${bill.id}')">
                                <i class="fas fa-credit-card"></i> Pay Now
                            </button>`
                            : `<button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); casaLink.showTenantBillDetailsModal('${bill.id}')">
                                <i class="fas fa-eye"></i> View
                            </button>`
                        }
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div class="table-container">
                <table class="data-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f8f9fa;">
                            <th style="padding: 15px; text-align: left; font-weight: 600; color: var(--dark-gray);">Description</th>
                            <th style="padding: 15px; text-align: left; font-weight: 600; color: var(--dark-gray);">Due Date</th>
                            <th style="padding: 15px; text-align: left; font-weight: 600; color: var(--dark-gray);">Amount</th>
                            <th style="padding: 15px; text-align: left; font-weight: 600; color: var(--dark-gray);">Status</th>
                            <th style="padding: 15px; text-align: left; font-weight: 600; color: var(--dark-gray);">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }

    async showTenantBillDetailsModal(billId) {
        console.log('📋 Opening tenant bill details for:', billId);
        
        try {
            const bill = await firebaseDb.collection('bills').doc(billId).get();
            
            if (!bill.exists) {
                throw new Error('Bill not found');
            }
            
            const billData = { id: bill.id, ...bill.data() };
            const dueDate = new Date(billData.dueDate);
            const today = new Date();
            const isOverdue = dueDate < today && billData.status === 'pending';
            
            const modalContent = `
                <div style="max-width: 500px;">
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <h3 style="margin: 0; color: var(--text-dark);">
                                ${billData.type === 'rent' ? 'Monthly Rent' : billData.description || 'Bill'}
                            </h3>
                            <span style="
                                padding: 6px 12px; 
                                border-radius: 20px; 
                                font-size: 0.85rem; 
                                font-weight: 600;
                                background: ${billData.status === 'paid' 
                                    ? 'rgba(52, 168, 83, 0.1)' 
                                    : isOverdue 
                                    ? 'rgba(234, 67, 53, 0.1)' 
                                    : 'rgba(251, 188, 4, 0.1)'};
                                color: ${billData.status === 'paid' 
                                    ? 'var(--success)' 
                                    : isOverdue 
                                    ? 'var(--danger)' 
                                    : 'var(--warning)'};
                            ">
                                ${billData.status === 'paid' ? 'Paid' : isOverdue ? 'Overdue' : 'Pending'}
                            </span>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div>
                                <div style="color: var(--dark-gray); font-size: 0.9rem; margin-bottom: 5px;">Due Date</div>
                                <div style="font-size: 1.2rem; font-weight: 600; color: var(--text-dark);">
                                    ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </div>
                            </div>
                            <div>
                                <div style="color: var(--dark-gray); font-size: 0.9rem; margin-bottom: 5px;">Amount</div>
                                <div style="font-size: 1.2rem; font-weight: 600; color: var(--text-dark);">
                                    ₱${(billData.totalAmount || 0).toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef;">
                        <h4 style="margin: 0 0 15px 0; color: var(--text-dark);">Bill Details</h4>
                        
                        <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e9ecef;">
                            <span style="color: var(--dark-gray);">Description:</span>
                            <strong>${billData.description || 'Monthly Rent'}</strong>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e9ecef;">
                            <span style="color: var(--dark-gray);">Billing Period:</span>
                            <strong>${new Date(billData.billingPeriodStart || billData.createdAt).toLocaleDateString()} - ${new Date(billData.billingPeriodEnd || billData.dueDate).toLocaleDateString()}</strong>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e9ecef;">
                            <span style="color: var(--dark-gray);">Status:</span>
                            <strong style="color: ${billData.status === 'paid' ? 'var(--success)' : isOverdue ? 'var(--danger)' : 'var(--warning)'};">
                                ${billData.status === 'paid' ? 'Paid' : isOverdue ? 'Overdue' : 'Pending'}
                            </strong>
                        </div>

                        ${billData.status === 'paid' && billData.paidDate 
                            ? `<div style="display: flex; justify-content: space-between;">
                                <span style="color: var(--dark-gray);">Paid Date:</span>
                                <strong>${new Date(billData.paidDate).toLocaleDateString()}</strong>
                            </div>`
                            : ''
                        }
                    </div>

                    ${billData.status === 'pending' 
                        ? `<div style="background: rgba(251, 188, 4, 0.1); border: 1px solid rgba(251, 188, 4, 0.3); padding: 15px; border-radius: 8px; margin-top: 20px;">
                            <div style="color: var(--warning); font-weight: 600; margin-bottom: 8px;">
                                <i class="fas fa-info-circle"></i> Payment Required
                            </div>
                            <p style="margin: 0; color: var(--dark-gray); font-size: 0.9rem;">
                                Please make payment by the due date to avoid late fees.
                            </p>
                        </div>`
                        : ''
                    }
                </div>
            `;
            
            const modal = ModalManager.openModal(modalContent, {
                title: 'Bill Details',
                showFooter: true,
                submitText: billData.status === 'pending' ? 'Pay Now' : 'Close',
                cancelText: 'Back',
                onSubmit: () => {
                    if (billData.status === 'pending') {
                        ModalManager.closeModal(modal);
                        this.showTenantPaymentModal(billId);
                    } else {
                        ModalManager.closeModal(modal);
                    }
                }
            });
            
        } catch (error) {
            console.error('❌ Error loading bill details:', error);
            this.showNotification('Failed to load bill details', 'error');
        }
    }

    toggleReferenceNumberField(paymentMethod) {
        const referenceNumberGroup = document.getElementById('referenceNumberGroup');
        const referenceNumberInput = document.getElementById('paymentReference');
        
        if (!referenceNumberGroup || !referenceNumberInput) return;
        
        // Show reference number field for digital payment methods
        if (['gcash', 'maya', 'bank_transfer'].includes(paymentMethod)) {
            referenceNumberGroup.style.display = 'block';
            referenceNumberInput.required = true;
        } else {
            referenceNumberGroup.style.display = 'none';
            referenceNumberInput.required = false;
        }
    }

    async showTenantPaymentModal(billId) {
            try {
            const billDoc = await firebaseDb.collection('bills').doc(billId).get();
            if (!billDoc.exists) {
                this.showNotification('Bill not found', 'error');
                return;
            }
            
            const bill = { id: billDoc.id, ...billDoc.data() };
            const paymentMethods = await DataManager.getPaymentMethods();
            
            const paymentMethodsHTML = paymentMethods.map(method => `
                <div class="payment-method-option" data-method="${method.id}">
                    <i class="${method.icon}"></i>
                    <span>${method.name}</span>
                </div>
            `).join('');
            
            const modalContent = `
                <div class="payment-modal">
                    <div class="payment-header" style="text-align: center; margin-bottom: 20px;">
                        <i class="fas fa-credit-card" style="font-size: 3rem; color: var(--success); margin-bottom: 15px;"></i>
                        <h3 style="margin-bottom: 10px;">Record Payment</h3>
                        <p>Record payment for <strong>${bill.tenantName}</strong></p>
                    </div>
                    
                    <!-- Bill Details Section -->
                    <div class="bill-details-section" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: var(--royal-blue);">Bill Details</h4>
                        <div class="bill-details-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div class="bill-detail-item">
                                <span class="label"><strong>Amount Due:</strong></span>
                                <span class="value">₱${(bill.totalAmount || 0).toLocaleString()}</span>
                            </div>
                            <div class="bill-detail-item">
                                <span class="label"><strong>Due Date:</strong></span>
                                <span class="value">${new Date(bill.dueDate).toLocaleDateString()}</span>
                            </div>
                            <div class="bill-detail-item">
                                <span class="label"><strong>Room:</strong></span>
                                <span class="value">${bill.roomNumber || 'N/A'}</span>
                            </div>
                            <div class="bill-detail-item">
                                <span class="label"><strong>Description:</strong></span>
                                <span class="value">${bill.description || 'Monthly Rent'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Payment Form -->
                    <form id="paymentForm">
                        <!-- Payment Method -->
                        <div class="form-group">
                            <label class="form-label">Payment Method *</label>
                            <div class="payment-methods-grid">
                                ${paymentMethodsHTML}
                            </div>
                            <input type="hidden" id="selectedPaymentMethod" required>
                        </div>
                        
                        <!-- Reference Number (Conditional) -->
                        <div class="form-group" id="referenceNumberGroup" style="display: none;">
                            <label class="form-label">Reference Number *</label>
                            <input type="text" id="paymentReference" class="form-input" 
                                placeholder="Transaction ID, receipt number, etc.">
                            <small class="field-note" style="color: #6c757d; font-size: 0.875rem;">
                                Required for GCash, Maya, and Bank Transfer
                            </small>
                        </div>
                        
                        <!-- Payment Date -->
                        <div class="form-group">
                            <label class="form-label">Payment Date *</label>
                            <input type="date" id="paymentDate" class="form-input" 
                                value="${new Date().toISOString().split('T')[0]}" required>
                        </div>
                        
                        <!-- Amount Paid -->
                        <div class="form-group">
                            <label class="form-label">Amount Paid *</label>
                            <div style="position: relative;">
                                <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #666;">₱</span>
                                <input type="number" id="paymentAmount" class="form-input" 
                                    style="padding-left: 30px;"
                                    value="${bill.totalAmount || 0}" 
                                    step="0.01" min="0" required>
                            </div>
                            <small class="field-note" style="color: #6c757d; font-size: 0.875rem;">
                                Enter the actual amount received
                            </small>
                        </div>
                        
                        <!-- Notes -->
                        <div class="form-group">
                            <label class="form-label">Notes (Optional)</label>
                            <textarea id="paymentNotes" class="form-input" 
                                    placeholder="Additional notes about this payment" 
                                    rows="3"></textarea>
                        </div>
                        
                        <!-- Payment Instructions -->
                        <div class="payment-instructions" style="background: #e7f3ff; border-left: 4px solid #007bff; padding: 12px; border-radius: 4px; margin: 20px 0;">
                            <p style="margin: 0 0 8px 0; font-weight: 600; color: #495057;">Payment Instructions:</p>
                            <p style="margin: 0; font-size: 0.9rem; color: #495057;">
                                Please note that payment submission is recorded. Your landlord will verify the payment and update the status accordingly.
                            </p>
                        </div>
                    </form>
                    
                    <div id="paymentError" style="color: var(--danger); display: none; margin-bottom: 15px; padding: 10px; background: #f8d7da; border-radius: 4px;"></div>
                </div>
            `;
            
            const modal = ModalManager.openModal(modalContent, {
                title: 'Record Payment',
                submitText: 'Record Payment',
                onSubmit: () => this.processPayment(billId, bill)
            });
            
            this.setupPaymentMethodSelection();
            
            // Add event listener for payment method changes
            const paymentMethodOptions = modal.querySelectorAll('.payment-method-option');
            paymentMethodOptions.forEach(option => {
                option.addEventListener('click', () => {
                    this.toggleReferenceNumberField(option.dataset.method);
                });
            });
            
            // Initialize reference number field state
            const selectedMethod = modal.querySelector('.payment-method-option.selected');
            if (selectedMethod) {
                this.toggleReferenceNumberField(selectedMethod.dataset.method);
            }
            
        } catch (error) {
            console.error('Error showing payment modal:', error);
            this.showNotification('Failed to load payment form', 'error');
        }
    }

    async processTenantPayment(billId, modal) {
        console.log('💳 Processing tenant payment for bill:', billId);
        
        try {
            const method = document.getElementById('paymentMethod').value;
            const amount = parseFloat(document.getElementById('paymentAmount').value);
            const reference = document.getElementById('paymentReference').value;
            const notes = document.getElementById('paymentNotes').value;
            
            if (!method) {
                alert('Please select a payment method');
                return;
            }
            
            if (!amount || amount <= 0) {
                alert('Invalid payment amount');
                return;
            }
            
            // Get bill details
            const billDoc = await firebaseDb.collection('bills').doc(billId).get();
            if (!billDoc.exists) {
                throw new Error('Bill not found');
            }
            
            const billData = billDoc.data();
            
            // Create payment record
            const paymentData = {
                billId: billId,
                tenantId: this.currentUser.id,
                tenantName: this.currentUser.name,
                landlordId: billData.landlordId,
                roomNumber: billData.roomNumber || 'N/A',
                paymentMethod: method,
                amount: amount,
                reference: reference || null,
                notes: notes || null,
                paymentDate: new Date().toISOString(),
                status: 'pending_verification',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            // Save payment record
            const paymentRef = await firebaseDb.collection('payments').add(paymentData);
            console.log('✅ Payment record created:', paymentRef.id);
            
            // Update bill status to pending_payment (waiting for landlord verification)
            await firebaseDb.collection('bills').doc(billId).update({
                status: 'pending_verification',
                paymentSubmittedAt: new Date().toISOString(),
                paymentSubmittedBy: this.currentUser.id,
                updatedAt: new Date().toISOString()
            });
            
            console.log('✅ Bill status updated to pending_verification');
            
            // Close modal
            ModalManager.closeModal(modal);
            
            // Show success message
            this.showNotification('Payment submitted successfully! Your landlord will verify it shortly.', 'success');
            
            // Refresh billing page
            setTimeout(() => {
                this.showPage('tenantBilling');
            }, 1500);
            
        } catch (error) {
            console.error('❌ Error processing payment:', error);
            this.showNotification('Failed to submit payment: ' + error.message, 'error');
        }
    }

    async getTenantMaintenancePage() {
        console.log('📋 Loading tenant maintenance page...');
        
        if (!this.currentUser) {
            return this.getErrorDashboard('tenantMaintenance', 'User not authenticated');
        }

        try {
            // Fetch maintenance requests for this tenant
            const maintenanceSnapshot = await firebaseDb.collection('maintenance')
                .where('tenantId', '==', this.currentUser.uid)
                .orderBy('createdAt', 'desc')
                .get();

            const maintenanceRequests = maintenanceSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log('✅ Fetched maintenance requests:', maintenanceRequests.length);

            // Build the page HTML
            let pageHTML = `
                <div class="page-content">
                    <div class="page-header">
                        <h1 class="page-title">Maintenance Requests</h1>
                        <button class="btn btn-primary" onclick="casaLink.showTenantMaintenanceRequestForm()">
                            <i class="fas fa-plus"></i> New Request
                        </button>
                    </div>

                    <div class="maintenance-container">
                        <div class="maintenance-stats">
                            <div class="stat-card">
                                <div class="stat-icon">
                                    <i class="fas fa-wrench"></i>
                                </div>
                                <div class="stat-content">
                                    <h3>${maintenanceRequests.length}</h3>
                                    <p>Total Requests</p>
                                </div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-icon">
                                    <i class="fas fa-hourglass-start"></i>
                                </div>
                                <div class="stat-content">
                                    <h3>${maintenanceRequests.filter(r => r.status === 'open' || r.status === 'in-progress').length}</h3>
                                    <p>In Progress</p>
                                </div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-icon">
                                    <i class="fas fa-check-circle"></i>
                                </div>
                                <div class="stat-content">
                                    <h3>${maintenanceRequests.filter(r => r.status === 'completed').length}</h3>
                                    <p>Completed</p>
                                </div>
                            </div>
                        </div>

                        <div class="content-card">
                            <div class="card-header">
                                <h3>Your Maintenance Requests</h3>
                            </div>
                            <div id="maintenanceTableContainer">
            `;

            // Check if there are any maintenance requests
            if (maintenanceRequests.length === 0) {
                // Show empty state message
                pageHTML += `
                                <div class="empty-state" style="padding: 60px 20px;">
                                    <i class="fas fa-tools" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                                    <h3 style="color: #2c3e50; margin-bottom: 10px;">No Existing Maintenance Requests</h3>
                                    <p style="color: #7f8c8d; margin-bottom: 20px;">You haven't submitted any maintenance requests yet.</p>
                                    <button class="btn btn-primary" onclick="casaLink.showTenantMaintenanceRequestForm()">
                                        <i class="fas fa-plus"></i> Submit Your First Request
                                    </button>
                                </div>
                `;
            } else {
                // Build the maintenance table with requests
                pageHTML += `
                                <div class="table-container">
                                    <table class="data-table">
                                        <thead>
                                            <tr>
                                                <th>Type</th>
                                                <th>Title</th>
                                                <th>Priority</th>
                                                <th>Status</th>
                                                <th>Created</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                `;

                maintenanceRequests.forEach(request => {
                    const priorityBadge = this.getPriorityBadge(request.priority);
                    const statusBadge = this.getStatusBadge(request.status);
                    const createdDate = request.createdAt 
                        ? new Date(request.createdAt).toLocaleDateString() 
                        : 'N/A';

                    pageHTML += `
                                            <tr class="maintenance-row" data-request-id="${request.id}">
                                                <td>
                                                    <strong>${request.type || 'N/A'}</strong>
                                                </td>
                                                <td>${request.title || request.description || 'No title'}</td>
                                                <td>${priorityBadge}</td>
                                                <td>${statusBadge}</td>
                                                <td>${createdDate}</td>
                                                <td>
                                                    <button class="btn btn-sm btn-secondary" 
                                                        onclick="casaLink.viewTenantMaintenanceRequest('${request.id}')">
                                                        <i class="fas fa-eye"></i> View
                                                    </button>
                                                </td>
                                            </tr>
                    `;
                });

                pageHTML += `
                                        </tbody>
                                    </table>
                                </div>
                `;
            }

            pageHTML += `
                            </div>
                        </div>
                    </div>
                </div>
            `;

            return pageHTML;

        } catch (error) {
            console.error('❌ Error loading tenant maintenance page:', error);
            return this.getErrorDashboard('tenantMaintenance', 'Failed to load maintenance requests: ' + error.message);
        }
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

        try {
            // Show loading state
            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
                submitBtn.disabled = true;
            }

            await AuthManager.changePassword(currentPassword, newPassword);
            
            // Update user document
            await firebaseDb.collection('users').doc(this.currentUser.uid).update({
                hasTemporaryPassword: false,
                passwordChanged: true,
                passwordChangedAt: new Date().toISOString(),
                currentPassword: newPassword,
                temporaryPassword: null,
                updatedAt: new Date().toISOString()
            });
            
            // Close password change modal
            ModalManager.closeModal(this.passwordChangeModal);
            
            // Update current user data
            this.currentUser.hasTemporaryPassword = false;
            this.currentUser.passwordChanged = true;
            
            console.log('✅ Password changed! Directly checking for member collection...');
            
            // DIRECT APPROACH - This should work immediately
            setTimeout(async () => {
                const lease = await DataManager.getTenantLease(this.currentUser.uid);
                const room = await this.getRoomByNumber(lease.roomNumber);
                const maxMembers = room?.maxMembers || 1;
                const hasOccupants = Array.isArray(lease.occupants) && lease.occupants.length > 0;
                
                console.log('🔍 Direct check after password change:', {
                    maxMembers: maxMembers,
                    hasOccupants: hasOccupants,
                    occupants: lease.occupants
                });
                
                if (maxMembers > 1 && !hasOccupants) {
                    console.log('🚀 Showing member collection form');
                    this.showMemberInformationCollection();
                } else {
                    console.log('🚀 Showing lease agreement');
                    this.showLeaseAgreementVerification();
                }
            }, 1000);
            
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

    // In app.js - UPDATED showLeaseAgreementVerification method (FULL + MERGED)
    async showLeaseAgreementVerification() {
        try {
            console.log('📄 Loading lease agreement verification with FRESH data...');

            // Get FRESH lease data
            const lease = await DataManager.getTenantLease(this.currentUser.uid);

            if (!lease) {
                this.showNotification('No lease agreement found. Please contact your landlord.', 'error');
                this.showDashboard();
                return;
            }

            console.log('🔍 Fresh lease data:', {
                roomNumber: lease.roomNumber,
                occupants: lease.occupants,
                totalOccupants: lease.totalOccupants,
                maxOccupants: lease.maxOccupants
            });

            // Get room info
            const room = await this.getRoomByNumber(lease.roomNumber);
            const maxMembers = room?.maxMembers || 1;
            const additionalFee = 2000;

            // ----------------------------
            // ⭐ FIXED OCCUPANT FALLBACKS
            // ----------------------------
            let occupants = lease.occupants;

            if (!Array.isArray(occupants) || occupants.length === 0) {
                occupants = [this.currentUser.name];  // fallback
                console.log('🔄 Using current user as primary tenant:', this.currentUser.name);
            }

            const primaryTenant = occupants[0] || this.currentUser.name;
            const additionalMembers = occupants.slice(1);
            const totalOccupants = lease.totalOccupants || occupants.length;

            console.log('👥 Final occupant data:', {
                primaryTenant,
                additionalMembers,
                totalOccupants
            });

            // ----------------------------
            // TENANT-LESSEE SECTION
            // ----------------------------
            let tenantLesseeSection = '';

            if (additionalMembers.length > 0) {
                tenantLesseeSection = `
                    <p style="margin-left: 20px;">
                        <strong>Landlady/Lessor:</strong> Nelly Virtucio<br>
                        <strong>Tenant/Lessee:</strong> ${primaryTenant}<br>
                        ${additionalMembers.map((member, index) =>
                    `<strong>Additional Occupant ${index + 1}:</strong> ${member}<br>`
                ).join('')}
                    </p>
                `;
            } else {
                tenantLesseeSection = `
                    <p style="margin-left: 20px;">
                        <strong>Landlady/Lessor:</strong> Nelly Virtucio<br>
                        <strong>Tenant/Lessee:</strong> ${primaryTenant}
                    </p>
                `;
            }

            // Format dates
            const leaseStart = lease.leaseStart ? new Date(lease.leaseStart).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }) : 'N/A';

            // Additional Occupants list
            let additionalOccupantsHTML = '';

            if (additionalMembers.length > 0) {
                additionalOccupantsHTML = `
                    <p style="margin: 5px 0;"><strong>Additional Occupants:</strong></p>
                    <ul style="margin: 5px 0 0 20px;">
                        ${additionalMembers.map(member => `<li>${member}</li>`).join('')}
                    </ul>
                `;
            } else {
                additionalOccupantsHTML = `
                    <p style="margin: 0;"><em>No additional occupants registered.</em></p>
                `;
            }

            // ----------------------------
            // FULL MODAL CONTENT
            // ----------------------------
            const modalContent = `
                <div class="lease-verification-modal" style="max-height: 80vh; overflow-y: auto;">
                    <div style="text-align: center; margin-bottom: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                        <i class="fas fa-file-contract" style="font-size: 3rem; color: var(--primary-blue); margin-bottom: 15px;"></i>
                        <h3 style="color: var(--primary-blue); margin-bottom: 10px;">Lease Agreement Verification</h3>
                        <p style="color: var(--dark-gray);">Please review and agree to your lease agreement</p>
                    </div>
                    
                    <div style="line-height: 1.6; font-size: 0.95rem; margin-bottom: 25px; max-height: 400px; overflow-y: auto; padding: 15px; border: 1px solid #eee; border-radius: 8px;">
                        <p><strong>This agreement is made by and between:</strong></p>
                        ${tenantLesseeSection}

                        <p>This landlady hereby agrees to lessee the unit <strong>${lease.roomNumber}</strong> 
                        located at <strong>${lease.rentalAddress}</strong>. 
                        The lease period begins <strong>${leaseStart}</strong>.</p>

                        <p><strong>Limit of occupants:</strong> ${maxMembers} ${maxMembers === 1 ? "person" : "persons"} regardless of age.  
                        Additional fee: <strong>₱${additionalFee.toLocaleString()}</strong> per excess person.</p>

                        <!-- OCCUPANT SUMMARY CARD -->
                        <div style="background: rgba(26, 115, 232, 0.1); padding: 15px; border-radius: 8px; margin: 15px 0;">
                            <h5 style="margin: 0 0 10px; color: var(--primary-blue);">
                                <i class="fas fa-users"></i> Registered Occupants
                            </h5>

                            <p style="margin: 0 0 5px;"><strong>Primary Tenant:</strong> ${primaryTenant}</p>
                            ${additionalOccupantsHTML}

                            <p style="margin: 10px 0 0; font-size: 0.9rem;">
                                <strong>Total Occupants:</strong> ${occupants.length} of ${maxMembers} allowed
                            </p>
                        </div>

                        <h4 style="margin: 20px 0 10px; color: var(--primary-blue);">Key Terms and Conditions:</h4>
                        <!-- (KEEPING ALL YOUR RULES) -->
                        <ol style="margin-left: 20px;">
                            <li><strong>Garbage/Trash</strong> - Tenant is responsible for proper disposal...</li>
                            <li><strong>Smoking</strong> - No smoking anywhere in the leased area.</li>
                            <li><strong>Noise</strong> - Keep noise at a respectful level.</li>
                            <li><strong>Visitors</strong> - Max of 10 visitors; must leave before 10 PM.</li>
                            <li><strong>Locks</strong> - Tenant provides their own padlock.</li>
                            <li><strong>Interior</strong> - No nails/pins unless already present.</li>
                            <li><strong>Payment Schedule</strong> - Monthly rent: ₱${lease.monthlyRent?.toLocaleString() || "0"}.</li>
                            <li><strong>Utilities</strong> - Pay bills on time.</li>
                            <li><strong>Light Bulbs</strong> - Tenant replaces interior bulbs.</li>
                            <li><strong>Damage</strong> - Tenant responsible for any damages.</li>
                            <li><strong>Security</strong> - Tenant responsible for their belongings.</li>
                            <li><strong>Cleaning Upon Termination</strong> - Failure to clean results in ₱2,000 fee.</li>
                        </ol>

                        <p style="margin-top: 20px; padding: 15px; background: rgba(26, 115, 232, 0.1); border-radius: 8px;">
                            <strong>13. Acknowledgement</strong> - The parties acknowledge and understand the terms as of <strong>${leaseStart}</strong>.
                        </p>

                        <div style="display: flex; justify-content: space-between; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;">
                            <div>
                                <p><strong>Nelly D. Virtucio</strong><br>Landlady/Lessor</p>
                            </div>
                            <div>
                                <p><strong>${primaryTenant}</strong><br>Tenant/Lessee</p>
                                ${additionalMembers.length > 0 ?
                    additionalMembers.map(member =>
                        `<p><strong>${member}</strong><br>Additional Occupant</p>`
                    ).join('')
                    : ''
                }
                            </div>
                        </div>
                    </div>

                    <!-- UPLOAD & AGREEMENT -->
                    <div class="form-group">
                        <label class="form-label">Upload Scanned ID *</label>
                        <input type="file" id="idUpload" class="form-input" accept=".jpg,.jpeg,.png,.pdf" required>
                    </div>

                    <div class="form-group">
                        <label style="display: flex; align-items: flex-start; gap: 10px;">
                            <input type="checkbox" id="agreeTerms">
                            <span>I have read and agree to all terms and conditions.</span>
                        </label>
                    </div>

                    <div id="verificationError" style="color: var(--danger); display: none;"></div>
                </div>
            `;

            // Open modal
            const modal = ModalManager.openModal(modalContent, {
                title: 'Lease Agreement & Verification - Final Step',
                submitText: 'Agree & Submit Verification',
                onSubmit: () => this.submitLeaseVerification(lease.id)
            });

            this.leaseVerificationModal = modal;

        } catch (error) {
            console.error('❌ Error loading lease agreement verification:', error);
            this.showNotification('Error loading lease agreement. Please try again.', 'error');
        }
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
        console.log(`📢 ${type.toUpperCase()}: ${message}`);
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            <span>${message}</span>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
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
        try {
            window.casaLink = new CasaLink();
            console.log('✅ CasaLink app initialized');
            
            // Initialize Charts Manager
            window.chartsManager = new ChartsManager();
            console.log('✅ Charts Manager initialized');
            
            // Initialize Section Manager
            window.sectionManager = new SectionManager();
            console.log('✅ Section Manager initialized');
            
        } catch (appError) {
            console.error('❌ CasaLink initialization failed:', appError);
            showAppError();
        }
    }
});