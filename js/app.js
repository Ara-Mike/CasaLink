class CasaLink {
    constructor() {
        this.currentUser = null;
        this.currentRole = null;
        this.isOnline = navigator.onLine;
        this.pendingActions = [];
        this.loginInProgress = false;
        this.authListenerEnabled = true;
        this.showingLogin = false;
        this.showingDashboard = false;
        
        // Bind methods ONCE in constructor
        this.boundLoginClickHandler = this.loginClickHandler.bind(this);
        this.boundLoginKeypressHandler = this.loginKeypressHandler.bind(this);
        this.boundHandleLogin = this.handleLogin.bind(this);
        
        // Clear any stored authentication immediately
        this.clearStoredAuth();
        
        console.log('🚀 CasaLink constructor starting...');
        this.init();
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
        console.log('Initializing CasaLink...');
        
        // Safety first: prevent any auto-redirects
        this.preventAutoRedirect();
        
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
        
        // Setup auth listener for PAGE REFRESHES only
        this.setupAuthListener();
        
        // If no auth state is detected within 3 seconds, show login
        setTimeout(() => {
            const spinner = document.getElementById('loadingSpinner');
            if (spinner && !spinner.classList.contains('hidden') && !this.currentUser) {
                console.log('🕒 Auth timeout, ensuring login page');
                spinner.classList.add('hidden');
                this.showLogin();
            }
        }, 3000);
    }

    async waitForFirebase() {
        return new Promise((resolve) => {
            const checkFirebase = () => {
                if (window.firebaseAuth && window.firebaseDb) {
                    console.log('Firebase is ready');
                    resolve();
                } else {
                    console.log('Waiting for Firebase...');
                    setTimeout(checkFirebase, 100);
                }
            };
            checkFirebase();
        });
    }

    async showPage(page) {
        const contentArea = document.getElementById('contentArea');
        if (!contentArea) {
            console.error('Content area not found');
            return;
        }

        console.log('🔄 Loading page:', page);
        
        // Show loading state
        contentArea.innerHTML = `
            <div class="data-loading">
                <i class="fas fa-spinner fa-spin"></i> Loading ${page}...
            </div>
        `;

        try {
            let pageContent;
            
            console.log('📝 Getting page content for:', page);
            
            switch (page) {
                case 'dashboard':
                    // For dashboard, use direct HTML method instead of async calls
                    if (this.currentRole === 'landlord') {
                        console.log('🏠 Getting landlord dashboard...');
                        pageContent = this.getDashboardContentHTML();
                    } else {
                        console.log('👤 Getting tenant dashboard...');
                        pageContent = await this.getTenantDashboard();
                    }
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
                default:
                    pageContent = `<div class="page-content"><h1>${page} Page</h1><p>This page is under construction.</p></div>`;
            }

            console.log('✅ Page content type:', typeof pageContent);
            
            // Handle Promise if returned
            if (pageContent instanceof Promise) {
                console.log('⚠️ Page content is a Promise, awaiting...');
                pageContent = await pageContent;
            }
            
            // Ensure we have a string
            if (typeof pageContent === 'string') {
                contentArea.innerHTML = pageContent;
            } else {
                console.error('❌ Page content is not a string:', typeof pageContent, pageContent);
                throw new Error('Invalid page content');
            }
            
            // Setup page-specific events
            this.setupPageEvents(page);
            
            // Update active navigation state
            this.updateActiveNavState(page);
            
        } catch (error) {
            console.error('❌ Error loading page:', error);
            contentArea.innerHTML = `
                <div class="page-content">
                    <h1>Error Loading Page</h1>
                    <p>There was an error loading the ${page} page. Please try again.</p>
                    <button class="btn btn-primary" onclick="casaLink.showPage('${page}')">Retry</button>
                </div>
            `;
        }
    }

    // Add this method - returns just the dashboard content, not the full layout
    getDashboardContentHTML() {
        const isLandlord = this.currentRole === 'landlord';
        
        return `
        <div class="page-content">
            <div class="page-header">
                <h1 class="page-title">Welcome to Your Dashboard</h1>
                <div>
                    ${isLandlord ? `
                        <button class="btn btn-secondary"><i class="fas fa-download"></i> Export Report</button>
                        <button class="btn btn-primary" id="addPropertyBtn"><i class="fas fa-plus"></i> Add Property</button>
                    ` : `
                        <button class="btn btn-primary" id="payRentBtn"><i class="fas fa-credit-card"></i> Pay Rent</button>
                    `}
                </div>
            </div>

            <div class="dashboard-cards">
                ${isLandlord ? `
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Total Tenants</div>
                            <div class="card-icon tenants">
                                <i class="fas fa-users"></i>
                            </div>
                        </div>
                        <div class="card-value">0</div>
                        <div class="card-change positive">
                            <i class="fas fa-sync fa-spin"></i>
                            <span>Loading...</span>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Unpaid Bills</div>
                            <div class="card-icon unpaid">
                                <i class="fas fa-money-bill-wave"></i>
                            </div>
                        </div>
                        <div class="card-value">0</div>
                        <div class="card-change negative">
                            <i class="fas fa-sync fa-spin"></i>
                            <span>Loading...</span>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Open Maintenance</div>
                            <div class="card-icon complaints">
                                <i class="fas fa-tools"></i>
                            </div>
                        </div>
                        <div class="card-value">0</div>
                        <div class="card-change negative">
                            <i class="fas fa-sync fa-spin"></i>
                            <span>Loading...</span>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Monthly Revenue</div>
                            <div class="card-icon tenants">
                                <i class="fas fa-chart-line"></i>
                            </div>
                        </div>
                        <div class="card-value">₱0</div>
                        <div class="card-change positive">
                            <i class="fas fa-sync fa-spin"></i>
                            <span>Loading...</span>
                        </div>
                    </div>
                ` : `
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Next Payment</div>
                            <div class="card-icon tenants">
                                <i class="fas fa-calendar-alt"></i>
                            </div>
                        </div>
                        <div class="card-value">--</div>
                        <div class="card-change neutral">
                            <span>Loading...</span>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Maintenance Requests</div>
                            <div class="card-icon occupied">
                                <i class="fas fa-tools"></i>
                            </div>
                        </div>
                        <div class="card-value">0</div>
                        <div class="card-change positive">
                            <i class="fas fa-sync fa-spin"></i>
                            <span>Loading...</span>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Your Unit</div>
                            <div class="card-icon complaints">
                                <i class="fas fa-home"></i>
                            </div>
                        </div>
                        <div class="card-value">N/A</div>
                        <div class="card-change positive">
                            <span>Loading...</span>
                        </div>
                    </div>
                `}
            </div>
            
            ${isLandlord ? `
            <!-- Quick Actions for Landlord -->
            <div class="dashboard-cards">
                <div class="card" onclick="casaLink.showPage('tenants')" style="cursor: pointer;">
                    <div class="card-header">
                        <div class="card-title">Manage Tenants</div>
                        <div class="card-icon tenants">
                            <i class="fas fa-users"></i>
                        </div>
                    </div>
                    <p>View and manage all your tenants</p>
                    <div style="color: var(--primary-blue); font-weight: 500; margin-top: 10px;">
                        Go to Tenants <i class="fas fa-arrow-right"></i>
                    </div>
                </div>
                
                <div class="card" onclick="casaLink.showPage('billing')" style="cursor: pointer;">
                    <div class="card-header">
                        <div class="card-title">Billing & Payments</div>
                        <div class="card-icon unpaid">
                            <i class="fas fa-file-invoice-dollar"></i>
                        </div>
                    </div>
                    <p>Generate bills and track payments</p>
                    <div style="color: var(--primary-blue); font-weight: 500; margin-top: 10px;">
                        Go to Billing <i class="fas fa-arrow-right"></i>
                    </div>
                </div>
                
                <div class="card" onclick="casaLink.showPage('maintenance')" style="cursor: pointer;">
                    <div class="card-header">
                        <div class="card-title">Maintenance</div>
                        <div class="card-icon complaints">
                            <i class="fas fa-tools"></i>
                        </div>
                    </div>
                    <p>Handle maintenance requests</p>
                    <div style="color: var(--primary-blue); font-weight: 500; margin-top: 10px;">
                        Go to Maintenance <i class="fas fa-arrow-right"></i>
                    </div>
                </div>
            </div>
            ` : `
            <!-- Quick Actions for Tenant -->
            <div class="welcome-card">
                <div class="welcome-header">
                    <h1 class="welcome-title">Welcome back, ${this.currentUser?.name || 'Tenant'}!</h1>
                </div>
                <p class="welcome-subtitle">Here's your current apartment status and quick actions</p>
                
                <div class="balance-info">
                    <div class="balance-amount" style="font-size: 1.5rem;">Loading...</div>
                    <div class="balance-due">Your account information is being loaded</div>
                </div>
                
                <div class="quick-actions">
                    <div class="quick-action" onclick="casaLink.showPage('tenantBilling')">
                        <i class="fas fa-file-invoice-dollar"></i>
                        <div>View Bills</div>
                    </div>
                    <div class="quick-action" onclick="casaLink.showPaymentModal()">
                        <i class="fas fa-credit-card"></i>
                        <div>Pay Now</div>
                    </div>
                    <div class="quick-action" onclick="casaLink.showPage('tenantMaintenance')">
                        <i class="fas fa-tools"></i>
                        <div>Request Maintenance</div>
                    </div>
                    <div class="quick-action" onclick="casaLink.showMaintenanceRequestForm()">
                        <i class="fas fa-comment-alt"></i>
                        <div>File Complaint</div>
                    </div>
                </div>
            </div>
            `}
            
            <div style="text-align: center; margin-top: 40px; padding: 20px; background: white; border-radius: 12px;">
                <h3>🎉 Welcome to CasaLink!</h3>
                <p>Your ${isLandlord ? 'property management' : 'tenant'} dashboard is loading real-time data...</p>
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
            
            console.log('Tenants fetched:', tenants);
            
            if (tenants.length === 0) {
                tenantsList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <h3>No Tenants Found</h3>
                        <p>You haven't added any tenants yet. Click "Add Tenant" to get started.</p>
                    </div>
                `;
            } else {
                tenantsList.innerHTML = this.renderTenantsTable(tenants);
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
                            <th>Unit</th>
                            <th>Status</th>
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
                                        </div>
                                    </div>
                                </td>
                                <td>${tenant.email}</td>
                                <td>${tenant.phone || 'N/A'}</td>
                                <td>${tenant.unitId || 'N/A'}</td>
                                <td>
                                    <span class="status-badge ${tenant.isActive ? 'active' : 'inactive'}">
                                        ${tenant.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                    ${tenant.hasTemporaryPassword ? '<span class="status-badge warning" title="Needs password change">New</span>' : ''}
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
        // Add Property Button
        document.getElementById('addPropertyBtn')?.addEventListener('click', () => {
            this.showAddPropertyForm();
        });

        // Setup real-time dashboard stats
        this.setupRealTimeStats();
        
        // Update navigation to show dashboard as active
        this.updateActiveNavState('dashboard');
    }

    setupNavigationEvents() {
        // This will handle navigation between pages
        document.addEventListener('click', (e) => {
            // Handle navigation links
            if (e.target.matches('[data-page]') || e.target.closest('[data-page]')) {
                e.preventDefault();
                const page = e.target.getAttribute('data-page') || 
                        e.target.closest('[data-page]').getAttribute('data-page');
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

    async handleLogout() {
        try {
            console.log('🚪 Starting manual logout...');
            
            // Set flag to ignore auth changes during logout
            this.manualLogoutInProgress = true;
            
            // Remove event listeners
            this.removeLoginEvents();
            
            // Clear local storage
            localStorage.removeItem('casalink_user');
            localStorage.removeItem('casalink_pending_actions');
            
            // Sign out from Firebase
            await AuthManager.logout();
            
            // Reset app state
            this.currentUser = null;
            this.currentRole = null;
            
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
            this.showLogin();
        }
    }

    preventAutoRedirect() {
        // Clear any existing authentication immediately
        this.clearAuthentication();
        
        // Ensure we're showing the login page
        const appElement = document.getElementById('app');
        const loginHTML = this.getLoginHTML();
        
        if (appElement && !appElement.innerHTML.includes('login-container')) {
            console.log('🛑 Safety check: Ensuring login page is displayed');
            this.showLogin();
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
        console.log('Setting up auth state listener...');
        
        this.authUnsubscribe = AuthManager.onAuthChange((user) => {
            // Skip if auth listener is disabled (e.g., during login)
            if (!this.authListenerEnabled) {
                console.log('🔒 Auth listener disabled, ignoring change');
                return;
            }
            
            if (!user) {
                console.log('👤 No user detected');
                return;
            }
            
            // Skip if this is the same user that just logged in manually
            if (this.currentUser && this.currentUser.uid === user.uid) {
                console.log('✅ User already logged in manually, ignoring auth listener');
                return;
            }
            
            console.log('🔄 Authenticated user detected via auth listener (page refresh):', user.email);
            
            // Hide loading spinner
            const spinner = document.getElementById('loadingSpinner');
            if (spinner) {
                spinner.style.display = 'none';
            }
            
            // Validate user data
            if (!user.role || !user.email || !user.id) {
                console.error('❌ Invalid user data');
                this.showNotification('Session invalid. Please log in again.', 'error');
                AuthManager.logout();
                return;
            }
            
            this.currentUser = user;
            this.currentRole = user.role;
            
            console.log('🔄 Restoring session via auth listener for:', user.email);
            
            // Handle tenant password change or show dashboard
            if (user.role === 'tenant' && user.hasTemporaryPassword) {
                console.log('Tenant requires password change on first login');
                setTimeout(() => {
                    this.showPasswordChangeModal();
                }, 1000);
            } else {
                console.log('🔄 Restoring dashboard from auth listener (page refresh)');
                setTimeout(() => {
                    this.showDashboard();
                }, 100);
            }
        });
    }

    async loadDashboardData() {
        try {
            console.log('Loading dashboard data in background...');
            const stats = await DataManager.getDashboardStats(this.currentUser.uid, this.currentRole);
            this.updateDashboardWithRealData(stats);
        } catch (error) {
            console.log('Dashboard data loading failed, using placeholder data:', error);
        }
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
                
                // MANUAL STATE MANAGEMENT - don't rely on auth listener
                this.currentUser = user;
                this.currentRole = user.role;
                
                // Re-enable auth listener after successful login
                setTimeout(() => {
                    this.authListenerEnabled = true;
                    console.log('🔓 Auth listener re-enabled after login');
                }, 2000);
                
                // Handle post-login flow manually
                if (user.role === 'tenant' && user.hasTemporaryPassword) {
                    console.log('🔄 Tenant requires password change on first login');
                    setTimeout(() => {
                        this.showPasswordChangeModal();
                    }, 500);
                } else {
                    console.log('🔄 Proceeding to dashboard after successful login');
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
        if (!stats) return;
        
        const isLandlord = this.currentRole === 'landlord';
        const cards = document.querySelectorAll('.dashboard-cards .card');
        
        if (isLandlord) {
            // Update landlord dashboard cards
            if (cards.length >= 4) {
                cards[0].querySelector('.card-value').textContent = stats.totalTenants || 0;
                cards[1].querySelector('.card-value').textContent = stats.unpaidBills || 0;
                cards[2].querySelector('.card-value').textContent = stats.openMaintenance || 0;
                cards[3].querySelector('.card-value').textContent = `₱${(stats.totalRevenue || 0).toLocaleString()}`;
                
                // Update loading states
                cards.forEach(card => {
                    const changeElement = card.querySelector('.card-change');
                    if (changeElement) {
                        changeElement.innerHTML = '<i class="fas fa-check"></i> <span>Updated</span>';
                        changeElement.className = 'card-change positive';
                    }
                });
            }
        } else {
            // Update tenant dashboard cards
            if (cards.length >= 3) {
                cards[0].querySelector('.card-value').textContent = 
                    stats.nextPaymentDue ? new Date(stats.nextPaymentDue).toLocaleDateString() : 'No bills';
                cards[1].querySelector('.card-value').textContent = stats.openMaintenance || 0;
                cards[2].querySelector('.card-value').textContent = stats.unpaidBills || 0;
                
                // Update loading states
                cards.forEach(card => {
                    const changeElement = card.querySelector('.card-change');
                    if (changeElement) {
                        changeElement.innerHTML = '<i class="fas fa-check"></i> <span>Updated</span>';
                        changeElement.className = 'card-change positive';
                    }
                });
            }
        }
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
                <div class="form-group">
                    <label class="form-label">Tenant Full Name *</label>
                    <input type="text" id="tenantName" class="form-input" placeholder="John Doe" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Email Address *</label>
                    <input type="email" id="tenantEmail" class="form-input" placeholder="john.doe@example.com" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Phone Number</label>
                    <input type="tel" id="tenantPhone" class="form-input" placeholder="+1 (555) 123-4567">
                </div>
                
                <div class="form-group">
                    <label class="form-label">Assigned Unit</label>
                    <input type="text" id="tenantUnit" class="form-input" placeholder="Unit 101">
                </div>
                
                <div class="security-info">
                    <i class="fas fa-info-circle"></i>
                    <small>The tenant will receive a temporary password and will be required to change it on first login.</small>
                </div>
                
                <div id="tenantCreationResult" style="display: none; margin-top: 15px; padding: 10px; border-radius: 8px;"></div>
            </div>
        `;

        const modal = ModalManager.openModal(modalContent, {
            title: 'Add New Tenant',
            submitText: 'Create Tenant Account',
            onSubmit: () => this.createTenantAccount()
        });

        this.addTenantModal = modal;
    }

    async createTenantAccount() {
        const name = document.getElementById('tenantName')?.value;
        const email = document.getElementById('tenantEmail')?.value;
        const phone = document.getElementById('tenantPhone')?.value;
        const unit = document.getElementById('tenantUnit')?.value;
        const resultElement = document.getElementById('tenantCreationResult');

        if (!name || !email) {
            this.showNotification('Please fill in required fields (Name and Email)', 'error');
            return;
        }

        try {
            const temporaryPassword = this.generateTemporaryPassword(8);
            
            const tenantData = {
                name: name,
                email: email,
                phone: phone || '',
                unitId: unit || '',
                landlordId: this.currentUser.uid
            };

            // Show loading in the main modal
            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing...';
                submitBtn.disabled = true;
            }

            // This will show the password confirmation modal
            const result = await AuthManager.createTenantAccount(tenantData, temporaryPassword);

            // Show success in the main modal
            if (resultElement) {
                resultElement.innerHTML = `
                    <div style="background: var(--success); color: white; padding: 15px; border-radius: 8px;">
                        <h4 style="margin: 0 0 10px 0;">✅ Tenant Account Created!</h4>
                        <p style="margin: 5px 0;"><strong>Email:</strong> ${result.email}</p>
                        <p style="margin: 5px 0;"><strong>Temporary Password:</strong> 
                            <code style="background: rgba(255,255,255,0.3); padding: 4px 8px; border-radius: 4px; font-size: 1.1em;">
                                ${result.temporaryPassword}
                            </code>
                        </p>
                        <div style="margin: 10px 0; padding: 8px; background: rgba(255,255,255,0.2); border-radius: 4px;">
                            <i class="fas fa-database"></i> 
                            <small>Temporary password stored in database for reference</small>
                        </div>
                        <p style="margin: 15px 0 0 0; font-size: 0.9em;">
                            <i class="fas fa-envelope"></i> 
                            You can now email these credentials to the tenant.
                        </p>
                    </div>
                `;
                resultElement.style.display = 'block';
            }

            this.showNotification('Tenant account created successfully!', 'success');

            // Clear form
            setTimeout(() => {
                const nameField = document.getElementById('tenantName');
                const emailField = document.getElementById('tenantEmail');
                const phoneField = document.getElementById('tenantPhone');
                const unitField = document.getElementById('tenantUnit');
                
                if (nameField) nameField.value = '';
                if (emailField) emailField.value = '';
                if (phoneField) phoneField.value = '';
                if (unitField) unitField.value = '';

                // Reset button
                if (submitBtn) {
                    submitBtn.innerHTML = 'Create Another Tenant';
                    submitBtn.disabled = false;
                }
            }, 500);

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
        }
    }

    generateTemporaryPassword(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let password = '';
        for (let i = 0; i < length; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    async getTenantDashboard() {
        return `
        <div class="page-content">
            <div class="page-header">
                <h1 class="page-title">Tenant Dashboard</h1>
                <button class="btn btn-primary" onclick="casaLink.showPaymentModal()">
                    <i class="fas fa-credit-card"></i> Pay Rent
                </button>
            </div>
            <div style="text-align: center; padding: 40px;">
                <h3>Welcome, Tenant!</h3>
                <p>View your bills, submit maintenance requests, and manage your rental account.</p>
                <div class="dashboard-cards">
                    <div class="card" onclick="casaLink.showPage('tenantBilling')" style="cursor: pointer;">
                        <div class="card-header">
                            <div class="card-title">My Bills</div>
                            <div class="card-icon tenants">
                                <i class="fas fa-file-invoice-dollar"></i>
                            </div>
                        </div>
                        <p>View and pay your bills</p>
                    </div>
                    <div class="card" onclick="casaLink.showPage('tenantMaintenance')" style="cursor: pointer;">
                        <div class="card-header">
                            <div class="card-title">Maintenance</div>
                            <div class="card-icon complaints">
                                <i class="fas fa-tools"></i>
                            </div>
                        </div>
                        <p>Submit maintenance requests</p>
                    </div>
                </div>
            </div>
        </div>
        `;
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
            
            // Close modal
            ModalManager.closeModal(this.passwordChangeModal);
            
            // Show success message
            this.showNotification('Password changed successfully! Welcome to CasaLink!', 'success');
            
            // Update current user data
            this.currentUser.requiresPasswordChange = false;
            this.currentUser.hasTemporaryPassword = false;
            
            // Now show the dashboard
            setTimeout(() => {
                this.showDashboard();
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
    window.casaLink = new CasaLink();
});