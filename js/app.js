import AuthManager from './auth.js';
import { ModalManager } from './modalManager.js';
import {NotificationManager} from './notificationManager.js';
import DataManager from './dataManager.js';


class CasaLink {
    constructor() {
        this.currentUser = null;
        this.currentRole = null;
        this.isOnline = navigator.onLine;
        this.pendingActions = [];
        
        // Clear any stored authentication immediately
        this.clearStoredAuth();
        
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

    clearAuthentication() {
        // Clear any stored user data
        localStorage.removeItem('casalink_user');
        sessionStorage.removeItem('casalink_user');
        
        // Also try to sign out from Firebase
        if (typeof AuthManager !== 'undefined') {
            AuthManager.logout().catch(error => {
                console.log('No user to log out');
            });
        }
    }

    clearStoredUser() {
    // Remove any stored user data to force login
    localStorage.removeItem('casalink_user');
    sessionStorage.removeItem('casalink_user');
}

    async init() {
        console.log('Initializing CasaLink...');
        
        // Show loading spinner
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.classList.remove('hidden');
        }
        
        // Setup features that don't require auth
        this.setupPWAFeatures();
        this.setupOfflineHandling();
        this.setupNavigationEvents();
        
        // Setup auth listener
        this.setupAuthListener();
        
        // If no auth state is detected within 2 seconds, show login
        setTimeout(() => {
            if (!this.currentUser) {
                console.log('No auth detected, showing login page');
                this.showLogin();
                document.getElementById('loadingSpinner')?.classList.add('hidden');
            }
        }, 2000);
    }

    async showPage(page) {
        const contentArea = document.getElementById('contentArea');
        if (!contentArea) return;

        // Show loading state
        contentArea.innerHTML = `
            <div class="data-loading">
                <i class="fas fa-spinner fa-spin"></i> Loading ${page}...
            </div>
        `;

        try {
            let pageContent = '';
            
            switch (page) {
                case 'dashboard':
                    pageContent = this.currentRole === 'landlord' 
                        ? await this.getLandlordDashboard()
                        : await this.getTenantDashboard();
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
                case 'tenantBilling':
                    pageContent = await this.getTenantBillingPage();
                    break;
                case 'tenantMaintenance':
                    pageContent = await this.getTenantMaintenancePage();
                    break;
                case 'tenantProfile':
                    pageContent = '<div class="page-content"><h1>My Profile</h1><p>Profile page coming soon...</p></div>';
                    break;
                case 'tenants':
                    if (this.currentRole === 'landlord') {
                        pageContent = await this.getTenantsPage();
                    }
                    break;
                case 'reports':
                    if (this.currentRole === 'landlord') {
                        pageContent = '<div class="page-content"><h1>Reports</h1><p>Reports page coming soon...</p></div>';
                    }
                    break;
                case 'settings':
                    pageContent = '<div class="page-content"><h1>Settings</h1><p>Settings page coming soon...</p></div>';
                    break;
                default:
                    pageContent = '<div class="page-content"><h1>Page Not Found</h1></div>';
            }

            contentArea.innerHTML = pageContent;
            
            // Setup page-specific events
            this.setupPageEvents(page);
            
        } catch (error) {
            console.error('Error loading page:', error);
            contentArea.innerHTML = `
                <div class="page-content">
                    <h1>Error Loading Page</h1>
                    <p>There was an error loading the ${page} page. Please try again.</p>
                    <button class="btn btn-primary" onclick="casaLink.showPage('${page}')">Retry</button>
                </div>
            `;
        }
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

    setupTenantsPage() {
        // Add tenant button
        document.getElementById('addTenantBtn')?.addEventListener('click', () => {
            this.showAddTenantForm();
        });

        // Search functionality
        document.getElementById('tenantSearch')?.addEventListener('input', (e) => {
            this.filterTenants(e.target.value);
        });
    }

    setupMaintenancePage() {
        // Assign staff button
        document.getElementById('assignStaffBtn')?.addEventListener('click', () => {
            this.showAssignStaffForm();
        });
    }

    filterTenants(searchTerm) {
        const rows = document.querySelectorAll('#tenantsTable tbody tr');
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

    async handleLogout() {
    try {
        // Clear local storage
        localStorage.removeItem('casalink_user');
        localStorage.removeItem('casalink_pending_actions');
        
        // Sign out from Firebase
        await AuthManager.logout();
        
        // Reset app state
        this.currentUser = null;
        this.currentRole = null;
        
        console.log('User logged out successfully');
        this.showLogin();
    } catch (error) {
        console.error('Logout error:', error);
        // Still show login page even if logout fails
        this.currentUser = null;
        this.currentRole = null;
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
        
        AuthManager.onAuthChange((user) => {
            console.log('Auth state changed:', user ? `User found: ${user.email}` : 'No user');
            
            // Hide loading spinner
            document.getElementById('loadingSpinner')?.classList.add('hidden');
            
            if (user) {
                this.currentUser = user;
                this.currentRole = user.role;
                console.log('User authenticated, showing dashboard');
                this.showDashboard();
            } else {
                console.log('No user authenticated, showing login');
                this.showLogin();
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

    checkAuthStatus() {
        // Show loading initially
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.classList.remove('hidden');
        }

        // Listen for auth changes
        window.addEventListener('authStateChange', (event) => {
            const user = event.detail;
            
            // Hide loading spinner
            document.getElementById('loadingSpinner')?.classList.add('hidden');
            
            if (user) {
                console.log('User is logged in:', user.email);
                this.currentUser = user;
                this.currentRole = user.role;
                this.showDashboard();
            } else {
                console.log('No user logged in, showing login page');
                this.showLogin();
            }
        });

        // If no auth event fires within 2 seconds, force show login
        setTimeout(() => {
            const spinner = document.getElementById('loadingSpinner');
            if (spinner && !spinner.classList.contains('hidden')) {
                console.log('Auth check timeout, showing login');
                spinner.classList.add('hidden');
                this.showLogin();
            }
        }, 2000);
    }

    showLogin() {
        console.log('Showing login page...');
        const appElement = document.getElementById('app');
        if (appElement) {
            appElement.innerHTML = this.getLoginHTML();
            
            // Small delay to ensure DOM is ready
            setTimeout(() => {
                try {
                    this.setupLoginEvents();
                    console.log('Login events setup complete');
                } catch (error) {
                    console.error('Error setting up login events:', error);
                }
            }, 50);
        }
    }

    showDashboard() {
        console.log('Showing dashboard for:', this.currentUser?.email);
        const appElement = document.getElementById('app');
        if (appElement) {
            try {
                appElement.innerHTML = this.getDashboardHTML();
                this.setupDashboardEvents();
            } catch (error) {
                console.error('Error showing dashboard:', error);
                // Fallback to login if dashboard fails
                this.showLogin();
            }
        }
    }

        // In app.js - Add getLoginHTML method
    // Update login screen HTML to include registration
    getLoginHTML() {
        return `
        <div class="login-container">
            <!-- ... existing login left side ... -->
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
                        <button class="btn btn-primary" id="loginBtn" style="width: 100%;">Sign In</button>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px;">
                        <a href="#" id="showRegister" style="color: var(--primary-blue); text-decoration: none;">
                            Don't have an account? Sign up
                        </a>
                    </div>
                </div>

                <div class="login-form hidden" id="registerForm">
                    <h2 class="form-title">Create Account</h2>
                    <p class="form-subtitle">Join CasaLink today</p>
                    
                    <!-- Registration form fields -->
                    <div class="form-group">
                        <label class="form-label" for="regName">Full Name</label>
                        <input type="text" id="regName" class="form-input" placeholder="John Doe">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="regEmail">Email</label>
                        <input type="email" id="regEmail" class="form-input" placeholder="your.email@example.com">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="regPassword">Password</label>
                        <input type="password" id="regPassword" class="form-input" placeholder="At least 6 characters">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="regConfirmPassword">Confirm Password</label>
                        <input type="password" id="regConfirmPassword" class="form-input" placeholder="Confirm your password">
                    </div>
                    
                    <div class="form-group">
                        <button class="btn btn-primary" id="registerBtn" style="width: 100%;">Create Account</button>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px;">
                        <a href="#" id="showLogin" style="color: var(--primary-blue); text-decoration: none;">
                            Already have an account? Sign in
                        </a>
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    showRegisterForm() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        if (loginForm && registerForm) {
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
        }
    }   

    showLoginForm() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        if (loginForm && registerForm) {
            registerForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
        }
    }

    // In app.js - Add setupLoginEvents method
    setupLoginEvents() {
        // Use event delegation instead of direct element references
        document.addEventListener('click', (e) => {
            // Handle role selection
            if (e.target.closest('.role-option')) {
                const roleOption = e.target.closest('.role-option');
                const allOptions = document.querySelectorAll('.role-option');
                
                // Remove active class from all options
                allOptions.forEach(option => option.classList.remove('active'));
                
                // Add active class to clicked option
                roleOption.classList.add('active');
            }

            // Handle login/register form switching
            if (e.target.id === 'showRegister' || e.target.closest('#showRegister')) {
                e.preventDefault();
                this.showRegisterForm();
            }

            if (e.target.id === 'showLogin' || e.target.closest('#showLogin')) {
                e.preventDefault();
                this.showLoginForm();
            }

            // Handle login button
            if (e.target.id === 'loginBtn' || e.target.closest('#loginBtn')) {
                e.preventDefault();
                this.handleLogin();
            }

            // Handle register button
            if (e.target.id === 'registerBtn' || e.target.closest('#registerBtn')) {
                e.preventDefault();
                this.handleRegister();
            }
        });

        // Handle enter key in form fields
        document.addEventListener('keypress', (e) => {
            if ((e.target.id === 'password' || e.target.id === 'email') && e.key === 'Enter') {
                this.handleLogin();
            }
            if ((e.target.id === 'regPassword' || e.target.id === 'regConfirmPassword') && e.key === 'Enter') {
                this.handleRegister();
            }
        });
    }

    handleRegister() {
    const nameInput = document.getElementById('regName');
    const emailInput = document.getElementById('regEmail');
    const passwordInput = document.getElementById('regPassword');
    const confirmPasswordInput = document.getElementById('regConfirmPassword');
    
    const name = nameInput?.value;
    const email = emailInput?.value;
    const password = passwordInput?.value;
    const confirmPassword = confirmPasswordInput?.value;
    
    // Get selected role from active role option
    const activeRoleOption = document.querySelector('.role-option.active');
    const role = activeRoleOption ? activeRoleOption.getAttribute('data-role') : 'tenant';

    if (!name || !email || !password || !confirmPassword) {
        this.showNotification('Please fill in all fields', 'error');
        return;
    }

    if (password !== confirmPassword) {
        this.showNotification('Passwords do not match', 'error');
        return;
    }

    if (password.length < 6) {
        this.showNotification('Password should be at least 6 characters', 'error');
        return;
    }

    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
        const originalText = registerBtn.innerHTML;
        registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
        registerBtn.disabled = true;

        const userData = {
            name: name,
            role: role,
            avatar: name.charAt(0).toUpperCase()
        };

        AuthManager.register(email, password, userData)
            .then(user => {
                this.currentUser = user;
                this.currentRole = user.role;
                this.showDashboard();
            })
            .catch(error => {
                this.showNotification(error.message, 'error');
                registerBtn.innerHTML = originalText;
                registerBtn.disabled = false;
            });
    }
}



    handleLogin() {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    const email = emailInput?.value;
    const password = passwordInput?.value;
    
    // Get selected role from active role option
    const activeRoleOption = document.querySelector('.role-option.active');
    const role = activeRoleOption ? activeRoleOption.getAttribute('data-role') : 'tenant';

    console.log('Login attempt:', { email, role });

    if (!email || !password) {
        this.showNotification('Please enter both email and password', 'error');
        return;
    }

    // Show loading state
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        const originalText = loginBtn.innerHTML;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
        loginBtn.disabled = true;

        AuthManager.login(email, password, role)
            .then(user => {
                this.currentUser = user;
                this.currentRole = user.role;
                this.showDashboard();
            })
            .catch(error => {
                this.showNotification(error.message, 'error');
                loginBtn.innerHTML = originalText;
                loginBtn.disabled = false;
            });
    }
}

    // In app.js - Add getDashboardHTML method
    getDashboardHTML() {
        const isLandlord = this.currentRole === 'landlord';
        
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
                            ${isLandlord ? this.getLandlordNav() : this.getTenantNav()}
                        </nav>
                        
                        <div class="header-actions">
                            <div class="notification-bell">
                                <i class="far fa-bell"></i>
                                <span class="notification-badge">3</span>
                            </div>
                            
                            <div class="user-profile" id="userProfile">
                                <div class="avatar">${this.currentUser.avatar}</div>
                                <div>
                                    <div style="font-weight: 500;">${this.currentUser.name}</div>
                                    <div style="font-size: 0.8rem; color: var(--dark-gray);">${this.currentUser.role.charAt(0).toUpperCase() + this.currentUser.role.slice(1)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div class="main-content">
                <aside class="sidebar">
                    <ul class="sidebar-menu ${isLandlord ? 'landlord-nav' : 'tenant-nav'}">
                        ${isLandlord ? this.getLandlordSidebar() : this.getTenantSidebar()}
                    </ul>
                </aside>

                <main class="content-area" id="contentArea">
                    ${isLandlord ? this.getLandlordDashboard() : this.getTenantDashboard()}
                </main>
            </div>
        </div>
        `;
    }

    // In app.js - Add landlord-specific methods
    getLandlordNav() {
        return `
            <a href="#" class="active" data-page="dashboard">Dashboard</a>
            <a href="#" data-page="billing">Billing & Payments</a>
            <a href="#" data-page="maintenance">Maintenance</a>
            <a href="#" data-page="tenants">Tenant Management</a>
            <a href="#" data-page="reports">Reports</a>
        `;
    }

    getLandlordSidebar() {
        return `
            <li><a href="#" class="active" data-page="dashboard"><i class="fas fa-th-large"></i> <span>Dashboard</span></a></li>
            <li><a href="#" data-page="billing"><i class="fas fa-file-invoice-dollar"></i> <span>Billing & Payments</span></a></li>
            <li><a href="#" data-page="maintenance"><i class="fas fa-tools"></i> <span>Maintenance</span></a></li>
            <li><a href="#" data-page="tenants"><i class="fas fa-users"></i> <span>Tenant Management</span></a></li>
            <li><a href="#" data-page="reports"><i class="fas fa-chart-pie"></i> <span>Reports</span></a></li>
            <li><a href="#" data-page="settings"><i class="fas fa-cog"></i> <span>Settings</span></a></li>
            <li><a href="#" id="logoutBtn"><i class="fas fa-sign-out-alt"></i> <span>Logout</span></a></li>
        `;
    }


    getTenantNav() {
        return `
            <a href="#" class="active" data-page="dashboard">Dashboard</a>
            <a href="#" data-page="tenantBilling">Billing & Payments</a>
            <a href="#" data-page="tenantMaintenance">Maintenance</a>
            <a href="#" data-page="tenantProfile">My Profile</a>
        `;
    }

    getTenantSidebar() {
        return `
            <li><a href="#" class="active" data-page="dashboard"><i class="fas fa-th-large"></i> <span>Dashboard</span></a></li>
            <li><a href="#" data-page="tenantBilling"><i class="fas fa-file-invoice-dollar"></i> <span>Billing & Payments</span></a></li>
            <li><a href="#" data-page="tenantMaintenance"><i class="fas fa-tools"></i> <span>Maintenance</span></a></li>
            <li><a href="#" data-page="tenantProfile"><i class="fas fa-user"></i> <span>My Profile</span></a></li>
            <li><a href="#" data-page="settings"><i class="fas fa-cog"></i> <span>Settings</span></a></li>
            <li><a href="#" id="logoutBtn"><i class="fas fa-sign-out-alt"></i> <span>Logout</span></a></li>
        `;
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



    // In app.js - Update getLandlordDashboard method
    async getLandlordDashboard() {
        // Fetch real data from Firestore
        const tenants = await DataManager.getTenants(this.currentUser.uid);
        const bills = await DataManager.getBills(this.currentUser.uid);
        const maintenance = await DataManager.getMaintenanceRequests(this.currentUser.uid);
        
        const unpaidBills = bills.filter(bill => bill.status === 'pending');
        const openMaintenance = maintenance.filter(req => req.status === 'open');
        
        return `
        <div class="page-content" id="dashboardPage">
            <div class="page-header">
                <h1 class="page-title">Dashboard</h1>
                <div>
                    <button class="btn btn-secondary"><i class="fas fa-download"></i> Export Report</button>
                    <button class="btn btn-primary" id="addPropertyBtn"><i class="fas fa-plus"></i> Add Property</button>
                </div>
            </div>

            <div id="dashboardStats">
            <div class="data-loading">
                <i class="fas fa-spinner fa-spin"></i> Loading dashboard data...
            </div>
            </div>
            
            <div class="dashboard-cards">
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">Total Tenants</div>
                        <div class="card-icon tenants">
                            <i class="fas fa-users"></i>
                        </div>
                    </div>
                    <div class="card-value">${tenants.length}</div>
                    <div class="card-change positive">
                        <i class="fas fa-arrow-up"></i>
                        <span>Active tenants</span>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">Unpaid Bills</div>
                        <div class="card-icon unpaid">
                            <i class="fas fa-money-bill-wave"></i>
                        </div>
                    </div>
                    <div class="card-value">${unpaidBills.length}</div>
                    <div class="card-change negative">
                        <i class="fas fa-exclamation-circle"></i>
                        <span>Requires attention</span>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">Open Maintenance</div>
                        <div class="card-icon complaints">
                            <i class="fas fa-tools"></i>
                        </div>
                    </div>
                    <div class="card-value">${openMaintenance.length}</div>
                    <div class="card-change negative">
                        <i class="fas fa-arrow-up"></i>
                        <span>Needs action</span>
                    </div>
                </div>
            </div>
            
            <!-- Rest of dashboard content -->
        </div>
        `;
    }

        setupDashboardEvents() {
        // Add Property Button
        document.getElementById('addPropertyBtn')?.addEventListener('click', () => {
            this.showAddPropertyForm();
        });

        // Setup real-time dashboard stats
        this.setupRealTimeStats();
    }

    async setupRealTimeStats() {
        const statsElement = document.getElementById('dashboardStats');
        if (!statsElement) return;

        // Real-time stats listener
        this.statsUnsubscribe = DataManager.listenToDashboardStats(
            this.currentUser.uid,
            (stats) => this.updateDashboardStats(stats)
        );
    }

    updateDashboardStats(stats) {
        const statsElement = document.getElementById('dashboardStats');
        if (!statsElement) return;

        statsElement.innerHTML = `
            <div class="dashboard-cards">
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">Total Properties</div>
                        <div class="card-icon tenants">
                            <i class="fas fa-building"></i>
                        </div>
                    </div>
                    <div class="card-value">${stats.totalProperties}</div>
                    <div class="card-change positive">
                        <i class="fas fa-home"></i>
                        <span>Managed properties</span>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">Active Tenants</div>
                        <div class="card-icon occupied">
                            <i class="fas fa-users"></i>
                        </div>
                    </div>
                    <div class="card-value">${stats.totalTenants}</div>
                    <div class="card-change positive">
                        <i class="fas fa-check-circle"></i>
                        <span>${stats.occupiedUnits}/${stats.totalProperties} units occupied</span>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">Monthly Revenue</div>
                        <div class="card-icon paid">
                            <i class="fas fa-money-bill-wave"></i>
                        </div>
                    </div>
                    <div class="card-value">₱${stats.totalRevenue.toLocaleString()}</div>
                    <div class="card-change positive">
                        <i class="fas fa-arrow-up"></i>
                        <span>Current month</span>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">Pending Issues</div>
                        <div class="card-icon unpaid">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                    </div>
                    <div class="card-value">${stats.unpaidBills + stats.openMaintenance}</div>
                    <div class="card-change negative">
                        <i class="fas fa-arrow-up"></i>
                        <span>${stats.unpaidBills} unpaid, ${stats.openMaintenance} maintenance</span>
                    </div>
                </div>
            </div>
        `;
    }

    // In app.js - Add property form methods
showAddPropertyForm() {
    const formHTML = `
        <div class="form-group">
            <label class="form-label" for="propertyName">Property Name</label>
            <input type="text" id="propertyName" class="form-input" placeholder="e.g., Riverside Apartments" required>
        </div>
        
        <div class="form-group">
            <label class="form-label" for="propertyAddress">Address</label>
            <textarea id="propertyAddress" class="form-input" placeholder="Full address" rows="3" required></textarea>
        </div>
        
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="totalUnits">Total Units</label>
                <input type="number" id="totalUnits" class="form-input" min="1" value="1" required>
            </div>
            
            <div class="form-group">
                <label class="form-label" for="propertyType">Property Type</label>
                <select id="propertyType" class="form-input" required>
                    <option value="apartment">Apartment Building</option>
                    <option value="condo">Condominium</option>
                    <option value="house">Single Family Home</option>
                    <option value="duplex">Duplex</option>
                    <option value="commercial">Commercial</option>
                </select>
            </div>
        </div>
        
        <div class="form-group">
            <label class="form-label" for="propertyRent">Base Rent (₱)</label>
            <input type="number" id="propertyRent" class="form-input" placeholder="15000" min="0" required>
        </div>
        
        <div class="form-group">
            <label class="form-label" for="propertyDescription">Description</label>
            <textarea id="propertyDescription" class="form-input" placeholder="Additional details about the property" rows="2"></textarea>
        </div>
    `;

        ModalManager.openModal(formHTML, {
            title: 'Add New Property',
            submitText: 'Add Property',
            onSubmit: () => this.handleAddProperty()
        });
    }

    async handleAddProperty() {
        const propertyData = {
            name: document.getElementById('propertyName').value,
            address: document.getElementById('propertyAddress').value,
            totalUnits: parseInt(document.getElementById('totalUnits').value),
            propertyType: document.getElementById('propertyType').value,
            baseRent: parseFloat(document.getElementById('propertyRent').value),
            description: document.getElementById('propertyDescription').value,
            landlordId: this.currentUser.uid,
            availableUnits: parseInt(document.getElementById('totalUnits').value)
        };

        try {
            await DataManager.addProperty(propertyData);
            this.showNotification('Property added successfully!', 'success');
        } catch (error) {
            this.showNotification('Error adding property: ' + error.message, 'error');
        }
    }

    // In app.js - Add billing page methods
    async getBillingPage() {
        const bills = await DataManager.getBills(this.currentUser.uid);
        const tenants = await DataManager.getTenants(this.currentUser.uid);

        return `
        <div class="page-content" id="billingPage">
            <div class="page-header">
                <h1 class="page-title">Billing & Payments</h1>
                <div>
                    <button class="btn btn-secondary"><i class="fas fa-download"></i> Export</button>
                    <button class="btn btn-primary" id="generateBillBtn"><i class="fas fa-plus"></i> Generate New Bill</button>
                </div>
            </div>
            
            <div class="table-container">
                <div class="table-header">
                    <h2 class="table-title">Current Bills</h2>
                    <div>
                        <input type="text" id="billSearch" class="form-input" placeholder="Search bills..." style="width: 200px; margin-right: 10px;">
                        <button class="btn btn-secondary" id="filterBillsBtn">Filter</button>
                    </div>
                </div>
                
                <div id="billsTable">
                    ${this.renderBillsTable(bills, tenants)}
                </div>
            </div>
        </div>
        `;
    }

    renderBillsTable(bills, tenants) {
        if (bills.length === 0) {
            return '<div class="empty-state">No bills found. Generate your first bill to get started.</div>';
        }

        return `
            <table>
                <thead>
                    <tr>
                        <th>Tenant</th>
                        <th>Unit</th>
                        <th>Amount</th>
                        <th>Due Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${bills.map(bill => {
                        const tenant = tenants.find(t => t.id === bill.tenantId);
                        return `
                        <tr>
                            <td>${tenant ? tenant.name : 'N/A'}</td>
                            <td>${tenant ? tenant.unit : 'N/A'}</td>
                            <td>₱${bill.totalAmount?.toLocaleString() || '0'}</td>
                            <td>${new Date(bill.dueDate).toLocaleDateString()}</td>
                            <td><span class="status ${bill.status}">${bill.status}</span></td>
                            <td class="action-buttons">
                                <button class="action-btn" onclick="casaLink.editBill('${bill.id}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="action-btn" onclick="casaLink.viewBill('${bill.id}')">
                                    <i class="fas fa-file-invoice"></i>
                                </button>
                                ${bill.status === 'pending' ? `
                                <button class="action-btn" onclick="casaLink.markBillPaid('${bill.id}')">
                                    <i class="fas fa-check"></i>
                                </button>
                                ` : ''}
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    // In app.js - Add bill generation methods
    showGenerateBillForm() {
        // This would fetch tenants and show a form to generate bills
        const formHTML = `
            <div class="form-group">
                <label class="form-label" for="billTenant">Select Tenant</label>
                <select id="billTenant" class="form-input" required>
                    <option value="">Choose a tenant...</option>
                    <!-- Options will be populated dynamically -->
                </select>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="billAmount">Amount (₱)</label>
                    <input type="number" id="billAmount" class="form-input" placeholder="15000" min="0" step="0.01" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="billDueDate">Due Date</label>
                    <input type="date" id="billDueDate" class="form-input" required>
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label" for="billDescription">Description</label>
                <input type="text" id="billDescription" class="form-input" placeholder="Monthly Rent - October 2023" required>
            </div>
            
            <div class="form-group">
                <label class="form-label">Additional Charges</label>
                <div id="additionalCharges">
                    <!-- Dynamic charges will be added here -->
                </div>
                <button type="button" class="btn btn-secondary" onclick="casaLink.addChargeField()" style="margin-top: 10px;">
                    <i class="fas fa-plus"></i> Add Charge
                </button>
            </div>
        `;

        ModalManager.openModal(formHTML, {
            title: 'Generate New Bill',
            submitText: 'Create Bill',
            onSubmit: () => this.handleGenerateBill(),
            onOpen: () => this.populateBillForm()
        });
    }

    async populateBillForm() {
        const tenants = await DataManager.getTenants(this.currentUser.uid);
        const tenantSelect = document.getElementById('billTenant');
        
        tenantSelect.innerHTML = '<option value="">Choose a tenant...</option>' +
            tenants.map(tenant => 
                `<option value="${tenant.id}" data-rent="${tenant.rent}">${tenant.name} - ${tenant.unit}</option>`
            ).join('');

        // Set default due date to 1st of next month
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        nextMonth.setDate(1);
        document.getElementById('billDueDate').value = nextMonth.toISOString().split('T')[0];

        // Auto-fill amount when tenant is selected
        tenantSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const rentAmount = selectedOption.getAttribute('data-rent');
            if (rentAmount) {
                document.getElementById('billAmount').value = rentAmount;
            }
        });
    }

    addChargeField() {
        const chargesContainer = document.getElementById('additionalCharges');
        const chargeId = 'charge_' + Date.now();
        
        const chargeHTML = `
            <div class="charge-item" id="${chargeId}">
                <div class="form-row">
                    <div class="form-group" style="flex: 2;">
                        <input type="text" class="form-input" placeholder="Description (e.g., Utilities, Late Fee)" required>
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <input type="number" class="form-input" placeholder="Amount" min="0" step="0.01" required>
                    </div>
                    <div class="form-group" style="flex: 0;">
                        <button type="button" class="btn btn-danger" onclick="document.getElementById('${chargeId}').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        chargesContainer.insertAdjacentHTML('beforeend', chargeHTML);
    }

    // In app.js - Add notification method
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
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

    // In app.js - Add complete bill handling
    async handleGenerateBill() {
        const tenantId = document.getElementById('billTenant').value;
        const amount = parseFloat(document.getElementById('billAmount').value);
        const dueDate = document.getElementById('billDueDate').value;
        const description = document.getElementById('billDescription').value;
        
        // Calculate additional charges
        const additionalCharges = [];
        let totalAdditional = 0;
        
        document.querySelectorAll('.charge-item').forEach(item => {
            const desc = item.querySelector('input[type="text"]').value;
            const chargeAmount = parseFloat(item.querySelector('input[type="number"]').value);
            if (desc && chargeAmount) {
                additionalCharges.push({ description: desc, amount: chargeAmount });
                totalAdditional += chargeAmount;
            }
        });

        const billData = {
            tenantId: tenantId,
            landlordId: this.currentUser.uid,
            baseAmount: amount,
            additionalCharges: additionalCharges,
            totalAmount: amount + totalAdditional,
            dueDate: dueDate,
            description: description,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        try {
            await DataManager.createBill(billData);
            this.showNotification('Bill generated successfully!', 'success');
            
            // Refresh the billing page if we're on it
            if (document.getElementById('billingPage')) {
                this.showPage('billing');
            }
        } catch (error) {
            this.showNotification('Error generating bill: ' + error.message, 'error');
        }
    }

    // Bill actions
    async markBillPaid(billId) {
        try {
            await DataManager.updateBill(billId, { 
                status: 'paid',
                paidDate: new Date().toISOString()
            });
            this.showNotification('Bill marked as paid!', 'success');
        } catch (error) {
            this.showNotification('Error updating bill: ' + error.message, 'error');
        }
    }

    async editBill(billId) {
        const bills = await DataManager.getBills(this.currentUser.uid);
        const bill = bills.find(b => b.id === billId);
        
        if (!bill) return;

        const formHTML = `
            <div class="form-group">
                <label class="form-label" for="editAmount">Amount (₱)</label>
                <input type="number" id="editAmount" class="form-input" value="${bill.totalAmount}" required>
            </div>
            
            <div class="form-group">
                <label class="form-label" for="editDueDate">Due Date</label>
                <input type="date" id="editDueDate" class="form-input" value="${bill.dueDate}" required>
            </div>
            
            <div class="form-group">
                <label class="form-label" for="editDescription">Description</label>
                <input type="text" id="editDescription" class="form-input" value="${bill.description}" required>
            </div>
            
            <div class="form-group">
                <label class="form-label" for="editStatus">Status</label>
                <select id="editStatus" class="form-input" required>
                    <option value="pending" ${bill.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="paid" ${bill.status === 'paid' ? 'selected' : ''}>Paid</option>
                    <option value="overdue" ${bill.status === 'overdue' ? 'selected' : ''}>Overdue</option>
                </select>
            </div>
        `;

        ModalManager.openModal(formHTML, {
            title: 'Edit Bill',
            submitText: 'Update Bill',
            onSubmit: () => this.handleEditBill(billId)
        });
    }

    async handleEditBill(billId) {
        const updates = {
            totalAmount: parseFloat(document.getElementById('editAmount').value),
            dueDate: document.getElementById('editDueDate').value,
            description: document.getElementById('editDescription').value,
            status: document.getElementById('editStatus').value
        };

        try {
            await DataManager.updateBill(billId, updates);
            this.showNotification('Bill updated successfully!', 'success');
            
            // Refresh billing page
            if (document.getElementById('billingPage')) {
                this.showPage('billing');
            }
        } catch (error) {
            this.showNotification('Error updating bill: ' + error.message, 'error');
        }
    }

    // In app.js - Add tenant management methods
    async getTenantsPage() {
        const tenants = await DataManager.getTenants(this.currentUser.uid);
        const properties = await DataManager.getProperties(this.currentUser.uid);

        return `
        <div class="page-content" id="tenantsPage">
            <div class="page-header">
                <h1 class="page-title">Tenant Management</h1>
                <div>
                    <button class="btn btn-secondary"><i class="fas fa-download"></i> Export</button>
                    <button class="btn btn-primary" id="addTenantBtn"><i class="fas fa-plus"></i> Add Tenant</button>
                </div>
            </div>
            
            <div class="table-container">
                <div class="table-header">
                    <h2 class="table-title">All Tenants</h2>
                    <div>
                        <input type="text" id="tenantSearch" class="form-input" placeholder="Search tenants..." style="width: 200px; margin-right: 10px;">
                        <select id="statusFilter" class="form-input" style="width: 150px;">
                            <option value="">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                </div>
                
                <div id="tenantsTable">
                    ${this.renderTenantsTable(tenants, properties)}
                </div>
            </div>
        </div>
        `;
    }

    renderTenantsTable(tenants, properties) {
        if (tenants.length === 0) {
            return '<div class="empty-state">No tenants found. Add your first tenant to get started.</div>';
        }

        return `
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Contact</th>
                        <th>Property</th>
                        <th>Unit</th>
                        <th>Rent</th>
                        <th>Lease End</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${tenants.map(tenant => {
                        const property = properties.find(p => p.id === tenant.propertyId);
                        return `
                        <tr>
                            <td>
                                <div style="font-weight: 500;">${tenant.name}</div>
                                <div style="font-size: 0.8rem; color: var(--dark-gray);">ID: ${tenant.id.slice(-6)}</div>
                            </td>
                            <td>
                                <div>${tenant.email}</div>
                                <div style="font-size: 0.8rem; color: var(--dark-gray);">${tenant.phone || 'No phone'}</div>
                            </td>
                            <td>${property ? property.name : 'N/A'}</td>
                            <td>${tenant.unit}</td>
                            <td>₱${tenant.rent?.toLocaleString() || '0'}</td>
                            <td>${tenant.leaseEnd ? new Date(tenant.leaseEnd).toLocaleDateString() : 'N/A'}</td>
                            <td><span class="status ${tenant.status}">${tenant.status}</span></td>
                            <td class="action-buttons">
                                <button class="action-btn" onclick="casaLink.editTenant('${tenant.id}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="action-btn" onclick="casaLink.sendMessage('${tenant.id}')">
                                    <i class="fas fa-envelope"></i>
                                </button>
                                <button class="action-btn" onclick="casaLink.deleteTenant('${tenant.id}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    // In app.js - Add tenant form methods
    async showAddTenantForm() {
        const properties = await DataManager.getProperties(this.currentUser.uid);
        
        const formHTML = `
            <div class="form-group">
                <label class="form-label" for="tenantName">Full Name</label>
                <input type="text" id="tenantName" class="form-input" placeholder="John Doe" required>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="tenantEmail">Email</label>
                    <input type="email" id="tenantEmail" class="form-input" placeholder="john@example.com" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="tenantPhone">Phone</label>
                    <input type="tel" id="tenantPhone" class="form-input" placeholder="+63 912 345 6789">
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="tenantProperty">Property</label>
                    <select id="tenantProperty" class="form-input" required>
                        <option value="">Select Property</option>
                        ${properties.map(prop => 
                            `<option value="${prop.id}">${prop.name} (${prop.availableUnits} units available)</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="tenantUnit">Unit Number</label>
                    <input type="text" id="tenantUnit" class="form-input" placeholder="4B" required>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="tenantRent">Monthly Rent (₱)</label>
                    <input type="number" id="tenantRent" class="form-input" placeholder="15000" min="0" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="tenantLeaseEnd">Lease End Date</label>
                    <input type="date" id="tenantLeaseEnd" class="form-input" required>
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label" for="tenantNotes">Notes</label>
                <textarea id="tenantNotes" class="form-input" placeholder="Additional information about the tenant" rows="3"></textarea>
            </div>
        `;

        ModalManager.openModal(formHTML, {
            title: 'Add New Tenant',
            submitText: 'Add Tenant',
            onSubmit: () => this.handleAddTenant()
        });
    }

    async handleAddTenant() {
        const tenantData = {
            name: document.getElementById('tenantName').value,
            email: document.getElementById('tenantEmail').value,
            phone: document.getElementById('tenantPhone').value,
            propertyId: document.getElementById('tenantProperty').value,
            unit: document.getElementById('tenantUnit').value,
            rent: parseFloat(document.getElementById('tenantRent').value),
            leaseEnd: document.getElementById('tenantLeaseEnd').value,
            notes: document.getElementById('tenantNotes').value,
            landlordId: this.currentUser.uid,
            status: 'active',
            moveInDate: new Date().toISOString()
        };

        try {
            await DataManager.addTenant(tenantData);
            
            // Update property available units
            const properties = await DataManager.getProperties(this.currentUser.uid);
            const selectedProperty = properties.find(p => p.id === tenantData.propertyId);
            if (selectedProperty) {
                await DataManager.updateProperty(selectedProperty.id, {
                    availableUnits: selectedProperty.availableUnits - 1
                });
            }
            
            this.showNotification('Tenant added successfully!', 'success');
        } catch (error) {
            this.showNotification('Error adding tenant: ' + error.message, 'error');
        }
    }

    // In app.js - Add maintenance methods
    async getMaintenancePage() {
        const maintenanceRequests = await DataManager.getMaintenanceRequests(this.currentUser.uid);
        const tenants = await DataManager.getTenants(this.currentUser.uid);

        return `
        <div class="page-content" id="maintenancePage">
            <div class="page-header">
                <h1 class="page-title">Maintenance & Complaints</h1>
                <button class="btn btn-primary" id="assignStaffBtn"><i class="fas fa-user-plus"></i> Assign Staff</button>
            </div>
            
            <div class="dashboard-cards">
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">Open Tickets</div>
                        <div class="card-icon tenants">
                            <i class="fas fa-ticket-alt"></i>
                        </div>
                    </div>
                    <div class="card-value">${maintenanceRequests.filter(req => req.status === 'open').length}</div>
                    <div class="card-change positive">
                        <i class="fas fa-list"></i>
                        <span>Total open requests</span>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">High Priority</div>
                        <div class="card-icon unpaid">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                    </div>
                    <div class="card-value">${maintenanceRequests.filter(req => req.priority === 'high').length}</div>
                    <div class="card-change negative">
                        <i class="fas fa-arrow-up"></i>
                        <span>Urgent attention needed</span>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">In Progress</div>
                        <div class="card-icon complaints">
                            <i class="fas fa-tools"></i>
                        </div>
                    </div>
                    <div class="card-value">${maintenanceRequests.filter(req => req.status === 'in-progress').length}</div>
                    <div class="card-change positive">
                        <i class="fas fa-clock"></i>
                        <span>Being worked on</span>
                    </div>
                </div>
            </div>
            
            <div class="table-container">
                <div class="table-header">
                    <h2 class="table-title">Recent Maintenance Requests</h2>
                    <div>
                        <select id="maintenanceFilter" class="form-input" style="width: 150px; margin-right: 10px;">
                            <option value="">All Status</option>
                            <option value="open">Open</option>
                            <option value="in-progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                        </select>
                        <button class="btn btn-secondary">Filter</button>
                    </div>
                </div>
                
                <div id="maintenanceTable">
                    ${this.renderMaintenanceTable(maintenanceRequests, tenants)}
                </div>
            </div>
        </div>
        `;
    }

    renderMaintenanceTable(requests, tenants) {
        if (requests.length === 0) {
            return '<div class="empty-state">No maintenance requests found.</div>';
        }

        return `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Type</th>
                        <th>Description</th>
                        <th>Tenant</th>
                        <th>Unit</th>
                        <th>Reported</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${requests.map(request => {
                        const tenant = tenants.find(t => t.id === request.tenantId);
                        return `
                        <tr>
                            <td>#${request.id.slice(-6)}</td>
                            <td>
                                <div style="font-weight: 500;">${request.type}</div>
                                <div style="font-size: 0.8rem; color: var(--dark-gray);">${request.category || 'General'}</div>
                            </td>
                            <td>
                                <div>${request.description}</div>
                                ${request.images ? `<div style="font-size: 0.8rem; color: var(--primary-blue);"><i class="fas fa-image"></i> Has images</div>` : ''}
                            </td>
                            <td>${tenant ? tenant.name : 'N/A'}</td>
                            <td>${tenant ? tenant.unit : 'N/A'}</td>
                            <td>${new Date(request.createdAt).toLocaleDateString()}</td>
                            <td><span class="priority ${request.priority}">${request.priority}</span></td>
                            <td><span class="status ${request.status}">${request.status}</span></td>
                            <td class="action-buttons">
                                <button class="action-btn" onclick="casaLink.viewMaintenanceRequest('${request.id}')">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="action-btn" onclick="casaLink.updateMaintenanceStatus('${request.id}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                                ${request.status !== 'resolved' ? `
                                <button class="action-btn" onclick="casaLink.assignMaintenance('${request.id}')">
                                    <i class="fas fa-user-check"></i>
                                </button>
                                ` : ''}
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    // In app.js - Add maintenance detail methods
    async viewMaintenanceRequest(requestId) {
        const requests = await DataManager.getMaintenanceRequests(this.currentUser.uid);
        const request = requests.find(r => r.id === requestId);
        const tenants = await DataManager.getTenants(this.currentUser.uid);
        const tenant = tenants.find(t => t.id === request.tenantId);

        if (!request) return;

        const formHTML = `
            <div class="request-header">
                <div class="request-meta">
                    <div><strong>Request ID:</strong> #${request.id.slice(-6)}</div>
                    <div><strong>Reported by:</strong> ${tenant ? tenant.name : 'N/A'}</div>
                    <div><strong>Unit:</strong> ${tenant ? tenant.unit : 'N/A'}</div>
                    <div><strong>Date:</strong> ${new Date(request.createdAt).toLocaleString()}</div>
                </div>
                <div class="request-status">
                    <span class="status ${request.status}">${request.status}</span>
                    <span class="priority ${request.priority}">${request.priority} priority</span>
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label"><strong>Issue Type</strong></label>
                <div class="form-input" style="background: var(--light-gray);">${request.type}</div>
            </div>
            
            <div class="form-group">
                <label class="form-label"><strong>Description</strong></label>
                <div class="form-input" style="background: var(--light-gray); min-height: 80px;">${request.description}</div>
            </div>
            
            ${request.images ? `
            <div class="form-group">
                <label class="form-label"><strong>Attached Images</strong></label>
                <div class="image-gallery">
                    <!-- Images would be displayed here -->
                    <div class="image-placeholder">
                        <i class="fas fa-image"></i>
                        <span>${request.images.length} image(s) attached</span>
                    </div>
                </div>
            </div>
            ` : ''}
            
            ${request.assignedTo ? `
            <div class="form-group">
                <label class="form-label"><strong>Assigned To</strong></label>
                <div class="form-input" style="background: var(--light-gray);">${request.assignedTo}</div>
            </div>
            ` : ''}
            
            ${request.notes ? `
            <div class="form-group">
                <label class="form-label"><strong>Staff Notes</strong></label>
                <div class="form-input" style="background: var(--light-gray); min-height: 60px;">${request.notes}</div>
            </div>
            ` : ''}
        `;

        ModalManager.openModal(formHTML, {
            title: 'Maintenance Request Details',
            submitText: 'Close',
            showFooter: true
        });
    }

    async updateMaintenanceStatus(requestId) {
        const requests = await DataManager.getMaintenanceRequests(this.currentUser.uid);
        const request = requests.find(r => r.id === requestId);

        const formHTML = `
            <div class="form-group">
                <label class="form-label" for="maintenanceStatus">Status</label>
                <select id="maintenanceStatus" class="form-input" required>
                    <option value="open" ${request.status === 'open' ? 'selected' : ''}>Open</option>
                    <option value="in-progress" ${request.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                    <option value="resolved" ${request.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                    <option value="cancelled" ${request.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label" for="maintenancePriority">Priority</label>
                <select id="maintenancePriority" class="form-input" required>
                    <option value="low" ${request.priority === 'low' ? 'selected' : ''}>Low</option>
                    <option value="medium" ${request.priority === 'medium' ? 'selected' : ''}>Medium</option>
                    <option value="high" ${request.priority === 'high' ? 'selected' : ''}>High</option>
                    <option value="urgent" ${request.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label" for="staffNotes">Staff Notes</label>
                <textarea id="staffNotes" class="form-input" placeholder="Add updates or notes about this request..." rows="4">${request.notes || ''}</textarea>
            </div>
            
            <div class="form-group">
                <label class="form-label" for="assignedTo">Assign To</label>
                <input type="text" id="assignedTo" class="form-input" placeholder="Staff member name" value="${request.assignedTo || ''}">
            </div>
        `;

        ModalManager.openModal(formHTML, {
            title: 'Update Maintenance Request',
            submitText: 'Update',
            onSubmit: () => this.handleUpdateMaintenance(requestId)
        });
    }

    async handleUpdateMaintenance(requestId) {
        const updates = {
            status: document.getElementById('maintenanceStatus').value,
            priority: document.getElementById('maintenancePriority').value,
            notes: document.getElementById('staffNotes').value,
            assignedTo: document.getElementById('assignedTo').value,
            updatedAt: new Date().toISOString()
        };

        try {
            await DataManager.updateMaintenance(requestId, updates);
            this.showNotification('Maintenance request updated!', 'success');
            
            // Refresh maintenance page
            if (document.getElementById('maintenancePage')) {
                this.showPage('maintenance');
            }
        } catch (error) {
            this.showNotification('Error updating request: ' + error.message, 'error');
        }
    }

    // In app.js - Add tenant dashboard methods
    async getTenantDashboard() {
    try {
        // Get tenant-specific data
        const tenantProfile = await DataManager.getTenantProfile(this.currentUser.uid);
        const bills = await DataManager.getTenantBills(this.currentUser.uid);
        const maintenance = await DataManager.getTenantMaintenanceRequests(this.currentUser.uid);

        // Handle case where tenant profile doesn't exist yet
        if (!tenantProfile) {
            return `
            <div class="page-content" id="tenantDashboardPage">
                <div class="welcome-card">
                    <div class="welcome-header">
                        <h1 class="welcome-title">Welcome to CasaLink!</h1>
                    </div>
                    <p class="welcome-subtitle">Your account has been created successfully.</p>
                    <div class="balance-info">
                        <div class="balance-amount" style="font-size: 1.5rem;">Setup Required</div>
                        <div class="balance-due">Please contact your landlord to complete your tenant profile setup.</div>
                    </div>
                </div>
                <div class="dashboard-cards">
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Account Status</div>
                            <div class="card-icon tenants">
                                <i class="fas fa-user"></i>
                            </div>
                        </div>
                        <div class="card-value">Pending</div>
                        <div class="card-change neutral">
                            <span>Profile setup needed</span>
                        </div>
                    </div>
                </div>
            </div>
            `;
        }

        const currentBill = bills.find(bill => bill.status === 'pending');
        const openMaintenance = maintenance.filter(req => req.status !== 'resolved');

        // ... rest of your existing tenant dashboard code
        return `
        <div class="page-content" id="tenantDashboardPage">
            <div class="welcome-card">
                <div class="welcome-header">
                    <h1 class="welcome-title">Welcome back, ${tenantProfile?.name || 'Tenant'}!</h1>
                    <div class="notification-bell">
                        <i class="far fa-bell" style="color: white; font-size: 1.5rem;"></i>
                        <span class="notification-badge">${bills.filter(b => b.status === 'pending').length}</span>
                    </div>
                </div>
                <p class="welcome-subtitle">Here's your current apartment status and quick actions</p>
                
                ${currentBill ? `
                <div class="balance-info">
                    <div class="balance-amount">₱${currentBill.totalAmount?.toLocaleString() || '0'}</div>
                    <div class="balance-due">Due by ${new Date(currentBill.dueDate).toLocaleDateString()}</div>
                </div>
                ` : `
                <div class="balance-info">
                    <div class="balance-amount" style="font-size: 1.5rem;">All caught up! 🎉</div>
                    <div class="balance-due">No pending bills at the moment</div>
                </div>
                `}
                
                <div class="quick-actions">
                    <div class="quick-action" onclick="casaLink.showPage('tenantBilling')">
                        <i class="fas fa-file-invoice-dollar"></i>
                        <div>View Bills</div>
                    </div>
                    <div class="quick-action" onclick="casaLink.showPaymentModal('${currentBill?.id}')">
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
            
            <div class="dashboard-cards">
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">Next Payment</div>
                        <div class="card-icon tenants">
                            <i class="fas fa-calendar-alt"></i>
                        </div>
                    </div>
                    <div class="card-value">${currentBill ? new Date(currentBill.dueDate).getDate() : '--'}</div>
                    <div class="card-change ${currentBill ? 'positive' : 'neutral'}">
                        <span>${currentBill ? this.getDaysUntilDue(currentBill.dueDate) : 'No pending bills'}</span>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">Maintenance Requests</div>
                        <div class="card-icon occupied">
                            <i class="fas fa-tools"></i>
                        </div>
                    </div>
                    <div class="card-value">${openMaintenance.length}</div>
                    <div class="card-change ${openMaintenance.length > 0 ? 'negative' : 'positive'}">
                        <span>${openMaintenance.length > 0 ? `${openMaintenance.filter(r => r.status === 'in-progress').length} in progress` : 'All resolved'}</span>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">Your Unit</div>
                        <div class="card-icon complaints">
                            <i class="fas fa-home"></i>
                        </div>
                    </div>
                    <div class="card-value">${tenantProfile?.unit || 'N/A'}</div>
                    <div class="card-change positive">
                        <span>${tenantProfile?.propertyName || 'Your apartment'}</span>
                    </div>
                </div>
            </div>
        </div>
        `;
    } catch (error) {
        console.error('Error loading tenant dashboard:', error);
        return this.getErrorDashboard('dashboard', error);
    }
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

    // In app.js - Add tenant billing methods
    async getTenantBillingPage() {
        const bills = await DataManager.getTenantBills(this.currentUser.tenantId || this.currentUser.uid);

        return `
        <div class="page-content" id="tenantBillingPage">
            <div class="page-header">
                <h1 class="page-title">My Bills & Payments</h1>
                <button class="btn btn-primary" id="payAllBillsBtn" ${bills.filter(b => b.status === 'pending').length === 0 ? 'disabled' : ''}>
                    <i class="fas fa-credit-card"></i> Pay All Pending
                </button>
            </div>
            
            <div class="billing-summary">
                <div class="summary-card">
                    <div class="summary-title">Pending Balance</div>
                    <div class="summary-amount">
                        ₱${bills.filter(b => b.status === 'pending').reduce((sum, bill) => sum + (bill.totalAmount || 0), 0).toLocaleString()}
                    </div>
                </div>
                <div class="summary-card">
                    <div class="summary-title">Paid This Month</div>
                    <div class="summary-amount">
                        ₱${bills.filter(b => b.status === 'paid' && new Date(b.paidDate).getMonth() === new Date().getMonth()).reduce((sum, bill) => sum + (bill.totalAmount || 0), 0).toLocaleString()}
                    </div>
                </div>
            </div>
            
            <div class="table-container">
                <div class="table-header">
                    <h2 class="table-title">Billing History</h2>
                    <button class="btn btn-secondary"><i class="fas fa-download"></i> Export</button>
                </div>
                
                <div id="tenantBillsTable">
                    ${this.renderTenantBillsTable(bills)}
                </div>
            </div>
        </div>
        `;
    }

    renderTenantBillsTable(bills) {
        if (bills.length === 0) {
            return '<div class="empty-state">No bills found. Your billing history will appear here.</div>';
        }

        return `
            <table>
                <thead>
                    <tr>
                        <th>Month</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Due Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${bills.map(bill => `
                    <tr>
                        <td>${new Date(bill.dueDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</td>
                        <td>
                            <div style="font-weight: 500;">${bill.description || 'Monthly Rent'}</div>
                            ${bill.additionalCharges && bill.additionalCharges.length > 0 ? 
                                `<div style="font-size: 0.8rem; color: var(--dark-gray);">+ ${bill.additionalCharges.length} additional charges</div>` : ''}
                        </td>
                        <td>₱${bill.totalAmount?.toLocaleString() || '0'}</td>
                        <td>${new Date(bill.dueDate).toLocaleDateString()}</td>
                        <td><span class="status ${bill.status}">${bill.status}</span></td>
                        <td class="action-buttons">
                            ${bill.status === 'pending' ? `
                            <button class="btn btn-sm btn-primary" onclick="casaLink.showPaymentModal('${bill.id}')">
                                Pay Now
                            </button>
                            ` : ''}
                            <button class="action-btn" onclick="casaLink.viewBillDetails('${bill.id}')">
                                <i class="fas fa-receipt"></i>
                            </button>
                        </td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    // In app.js - Add payment methods
    showPaymentModal(billId = null) {
        const formHTML = `
            <div class="payment-header">
                <div class="payment-amount" id="paymentAmountDisplay">Calculating...</div>
                <div class="payment-description" id="paymentDescription"></div>
            </div>
            
            <div class="form-group">
                <label class="form-label">Payment Method</label>
                <div class="payment-methods">
                    <label class="payment-method">
                        <input type="radio" name="paymentMethod" value="gcash" checked>
                        <div class="method-content">
                            <i class="fas fa-mobile-alt" style="color: #0d62d4;"></i>
                            <span>GCash</span>
                        </div>
                    </label>
                    <label class="payment-method">
                        <input type="radio" name="paymentMethod" value="paymaya">
                        <div class="method-content">
                            <i class="fas fa-credit-card" style="color: #00a2e8;"></i>
                            <span>PayMaya</span>
                        </div>
                    </label>
                    <label class="payment-method">
                        <input type="radio" name="paymentMethod" value="bank">
                        <div class="method-content">
                            <i class="fas fa-university" style="color: #34A853;"></i>
                            <span>Bank Transfer</span>
                        </div>
                    </label>
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label" for="paymentAmount">Amount (₱)</label>
                <input type="number" id="paymentAmount" class="form-input" placeholder="0.00" step="0.01" required>
            </div>
            
            <div class="form-group">
                <label class="form-label" for="paymentReference">Reference Number</label>
                <input type="text" id="paymentReference" class="form-input" placeholder="Enter transaction reference" required>
            </div>
            
            <div class="form-group">
                <label class="form-label" for="paymentNotes">Notes (Optional)</label>
                <textarea id="paymentNotes" class="form-input" placeholder="Add any payment notes..." rows="2"></textarea>
            </div>
            
            <div class="payment-terms">
                <i class="fas fa-shield-alt"></i>
                <span>Your payment is secure and encrypted</span>
            </div>
        `;

        const modal = ModalManager.openModal(formHTML, {
            title: 'Make Payment',
            submitText: 'Confirm Payment',
            onSubmit: () => this.processPayment(billId),
            onOpen: () => this.initializePaymentModal(billId)
        });

        return modal;
    }

    async initializePaymentModal(billId) {
        if (billId) {
            const bills = await DataManager.getTenantBills(this.currentUser.tenantId || this.currentUser.uid);
            const bill = bills.find(b => b.id === billId);
            
            if (bill) {
                document.getElementById('paymentAmount').value = bill.totalAmount;
                document.getElementById('paymentAmountDisplay').textContent = `₱${bill.totalAmount?.toLocaleString()}`;
                document.getElementById('paymentDescription').textContent = bill.description || 'Monthly Rent Payment';
            }
        }

        // Real-time amount calculation
        document.getElementById('paymentAmount').addEventListener('input', function() {
            const amount = parseFloat(this.value) || 0;
            document.getElementById('paymentAmountDisplay').textContent = `₱${amount.toLocaleString()}`;
        });
    }

    async processPayment(billId) {
        const amount = parseFloat(document.getElementById('paymentAmount').value);
        const method = document.querySelector('input[name="paymentMethod"]:checked').value;
        const reference = document.getElementById('paymentReference').value;
        const notes = document.getElementById('paymentNotes').value;

        if (!amount || amount <= 0) {
            this.showNotification('Please enter a valid payment amount', 'error');
            return;
        }

        if (!reference) {
            this.showNotification('Please enter a reference number', 'error');
            return;
        }

        const paymentData = {
            tenantId: this.currentUser.tenantId || this.currentUser.uid,
            amount: amount,
            method: method,
            reference: reference,
            notes: notes,
            billId: billId || null,
            landlordId: this.currentUser.landlordId // This would be set during tenant registration
        };

        try {
            // Show processing state
            const submitBtn = document.querySelector('#modalSubmit');
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            submitBtn.disabled = true;

            await DataManager.recordPayment(paymentData);
            
            this.showNotification('Payment processed successfully!', 'success');
            
            // Refresh billing page
            if (document.getElementById('tenantBillingPage')) {
                this.showPage('tenantBilling');
            }
        } catch (error) {
            this.showNotification('Error processing payment: ' + error.message, 'error');
        }
    }

    // In app.js - Add tenant maintenance methods
    async getTenantMaintenancePage() {
        const maintenanceRequests = await DataManager.getTenantMaintenanceRequests(this.currentUser.tenantId || this.currentUser.uid);

        return `
        <div class="page-content" id="tenantMaintenancePage">
            <div class="page-header">
                <h1 class="page-title">Maintenance Requests</h1>
                <button class="btn btn-primary" id="newMaintenanceRequestBtn">
                    <i class="fas fa-plus"></i> New Request
                </button>
            </div>
            
            <div class="maintenance-stats">
                <div class="stat-card">
                    <div class="stat-value">${maintenanceRequests.filter(r => r.status === 'open').length}</div>
                    <div class="stat-label">Open</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${maintenanceRequests.filter(r => r.status === 'in-progress').length}</div>
                    <div class="stat-label">In Progress</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${maintenanceRequests.filter(r => r.status === 'resolved').length}</div>
                    <div class="stat-label">Resolved</div>
                </div>
            </div>
            
            <div class="table-container">
                <div class="table-header">
                    <h2 class="table-title">My Maintenance Requests</h2>
                    <button class="btn btn-secondary">Filter</button>
                </div>
                
                <div id="tenantMaintenanceTable">
                    ${this.renderTenantMaintenanceTable(maintenanceRequests)}
                </div>
            </div>
        </div>
        `;
    }

    renderTenantMaintenanceTable(requests) {
        if (requests.length === 0) {
            return `
            <div class="empty-state">
                <i class="fas fa-tools" style="font-size: 3rem; margin-bottom: 20px; color: var(--dark-gray);"></i>
                <h3>No maintenance requests</h3>
                <p>You haven't submitted any maintenance requests yet.</p>
                <button class="btn btn-primary" onclick="casaLink.showMaintenanceRequestForm()">
                    <i class="fas fa-plus"></i> Submit Your First Request
                </button>
            </div>
            `;
        }

        return `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Type</th>
                        <th>Description</th>
                        <th>Date Reported</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${requests.map(request => `
                    <tr>
                        <td>#${request.id.slice(-6)}</td>
                        <td>
                            <div style="font-weight: 500;">${request.type}</div>
                            <div style="font-size: 0.8rem; color: var(--dark-gray);">${request.category || 'General'}</div>
                        </td>
                        <td>
                            <div class="request-description">${request.description}</div>
                            ${request.images ? `<div style="font-size: 0.8rem; color: var(--primary-blue);"><i class="fas fa-image"></i> Has images</div>` : ''}
                        </td>
                        <td>${new Date(request.createdAt).toLocaleDateString()}</td>
                        <td><span class="priority ${request.priority}">${request.priority}</span></td>
                        <td><span class="status ${request.status}">${request.status}</span></td>
                        <td class="action-buttons">
                            <button class="action-btn" onclick="casaLink.viewTenantMaintenanceRequest('${request.id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${request.status === 'open' ? `
                            <button class="action-btn" onclick="casaLink.updateMaintenanceRequest('${request.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            ` : ''}
                        </td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    // In app.js - Add maintenance request form
    showMaintenanceRequestForm() {
        const formHTML = `
            <div class="form-group">
                <label class="form-label" for="maintenanceType">Issue Type</label>
                <select id="maintenanceType" class="form-input" required>
                    <option value="">Select issue type</option>
                    <option value="plumbing">Plumbing</option>
                    <option value="electrical">Electrical</option>
                    <option value="hvac">HVAC</option>
                    <option value="appliance">Appliance</option>
                    <option value="structural">Structural</option>
                    <option value="pest">Pest Control</option>
                    <option value="other">Other</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label" for="maintenanceCategory">Category</label>
                <select id="maintenanceCategory" class="form-input" required>
                    <option value="repair">Repair Needed</option>
                    <option value="maintenance">Routine Maintenance</option>
                    <option value="safety">Safety Concern</option>
                    <option value="complaint">Complaint</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label" for="maintenancePriority">Priority</label>
                <select id="maintenancePriority" class="form-input" required>
                    <option value="low">Low - Not urgent</option>
                    <option value="medium" selected>Medium - Normal priority</option>
                    <option value="high">High - Needs attention soon</option>
                    <option value="urgent">Urgent - Immediate attention needed</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label" for="maintenanceDescription">Description</label>
                <textarea id="maintenanceDescription" class="form-input" placeholder="Please describe the issue in detail..." rows="4" required></textarea>
            </div>
            
            <div class="form-group">
                <label class="form-label">Upload Photos (Optional)</label>
                <div class="file-upload" id="imageUploadArea">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <p>Drag & drop images here or click to browse</p>
                    <input type="file" id="maintenanceImages" multiple accept="image/*" style="display: none;">
                </div>
                <div id="imagePreview" class="image-preview"></div>
            </div>
            
            <div class="form-group">
                <label class="form-label" for="contactPreference">Contact Preference</label>
                <select id="contactPreference" class="form-input">
                    <option value="any">Any time</option>
                    <option value="morning">Morning (8AM-12PM)</option>
                    <option value="afternoon">Afternoon (1PM-5PM)</option>
                    <option value="evening">Evening (6PM-9PM)</option>
                </select>
            </div>
            
            <div class="form-group">
                <div class="checkbox-group">
                    <input type="checkbox" id="emergencyAccess" class="checkbox-input">
                    <label for="emergencyAccess" class="checkbox-label">
                        Grant emergency access if needed
                    </label>
                </div>
            </div>
        `;

        ModalManager.openModal(formHTML, {
            title: 'Submit Maintenance Request',
            submitText: 'Submit Request',
            onSubmit: () => this.handleMaintenanceRequest(),
            onOpen: () => this.setupImageUpload()
        });
    }

    setupImageUpload() {
        const uploadArea = document.getElementById('imageUploadArea');
        const fileInput = document.getElementById('maintenanceImages');
        const preview = document.getElementById('imagePreview');

        uploadArea.addEventListener('click', () => fileInput.click());
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--primary-blue)';
            uploadArea.style.backgroundColor = 'rgba(26, 115, 232, 0.05)';
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = '#ddd';
            uploadArea.style.backgroundColor = 'transparent';
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#ddd';
            uploadArea.style.backgroundColor = 'transparent';
            
            if (e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                this.previewImages(e.dataTransfer.files);
            }
        });
        
        fileInput.addEventListener('change', (e) => {
            this.previewImages(e.target.files);
        });
    }

    previewImages(files) {
        const preview = document.getElementById('imagePreview');
        preview.innerHTML = '';
        
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = document.createElement('div');
                    img.className = 'preview-image';
                    img.innerHTML = `
                        <img src="${e.target.result}" alt="Preview">
                        <button type="button" class="remove-image">&times;</button>
                    `;
                    preview.appendChild(img);
                    
                    img.querySelector('.remove-image').addEventListener('click', () => {
                        img.remove();
                    });
                };
                reader.readAsDataURL(file);
            }
        });
    }

    async handleMaintenanceRequest() {
        const requestData = {
            tenantId: this.currentUser.tenantId || this.currentUser.uid,
            landlordId: this.currentUser.landlordId, // This would be set during tenant registration
            type: document.getElementById('maintenanceType').value,
            category: document.getElementById('maintenanceCategory').value,
            priority: document.getElementById('maintenancePriority').value,
            description: document.getElementById('maintenanceDescription').value,
            contactPreference: document.getElementById('contactPreference').value,
            emergencyAccess: document.getElementById('emergencyAccess').checked,
            // In a real app, you would upload images to Firebase Storage here
            images: [] // This would be array of image URLs after upload
        };

        try {
            await DataManager.submitMaintenanceRequest(requestData);
            this.showNotification('Maintenance request submitted successfully!', 'success');
            
            // Refresh maintenance page
            if (document.getElementById('tenantMaintenancePage')) {
                this.showPage('tenantMaintenance');
            }
        } catch (error) {
            this.showNotification('Error submitting request: ' + error.message, 'error');
        }
    }

    

    // More methods will be added in subsequent steps...
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.casaLink = new CasaLink();
});