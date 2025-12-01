// js/admin/adminUsers.js - User Management
class AdminUsers {
    constructor() {
        this.users = [];
        this.filteredUsers = [];
        this.currentPage = 1;
        this.pageSize = 10;
        this.filters = {
            search: '',
            role: 'all',
            status: 'all',
            sortBy: 'newest'
        };
        
        // Track initialization state
        this.isInitialized = false;
        this.initAttempts = 0;
        this.maxInitAttempts = 10;
        
        this.init();
    }

    async init() {
        console.log('👥 AdminUsers initializing...');
        
        // Increment attempt counter
        this.initAttempts++;
        
        // Check session
        if (!this.checkSession()) {
            console.log('No valid session found');
            return;
        }
        
        // Wait for adminAuth to be fully initialized
        if (!window.adminAuthInstance || !adminAuthInstance.isInitialized) {
            console.log('Waiting for adminAuth initialization...');
            
            if (this.initAttempts < this.maxInitAttempts) {
                setTimeout(() => this.init(), 500);
            } else {
                console.error('Failed to initialize AdminUsers after multiple attempts');
                this.showError('Failed to initialize user management system');
                this.showDemoUsers();
            }
            return;
        }
        
        // Setup event listeners
        this.setupEventListeners();
        
        try {
            // Load initial data
            await this.loadUsers();
            
            // Load stats
            await this.loadUserStats();
            
            this.isInitialized = true;
            console.log('✅ AdminUsers initialized successfully');
            
        } catch (error) {
            console.error('Error during initialization:', error);
            this.showDemoUsers();
        }
    }
    
    checkSession() {
        const session = localStorage.getItem('admin_session');
        if (!session) {
            window.location.href = 'index.html';
            return false;
        }
        
        // Check if session is expired
        try {
            const sessionData = JSON.parse(session);
            const isRecent = Date.now() - sessionData.timestamp < (24 * 60 * 60 * 1000);
            
            if (!isRecent) {
                console.log('Session expired');
                localStorage.removeItem('admin_session');
                window.location.href = 'index.html';
                return false;
            }
            
            return true;
        } catch (e) {
            console.log('Invalid session data');
            localStorage.removeItem('admin_session');
            window.location.href = 'index.html';
            return false;
        }
    }

    setupEventListeners() {
        // Search input
        const searchInput = document.getElementById('searchUsers');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.search = e.target.value;
                this.applyFilters();
            });
        }
        
        // Filter selects
        ['filterRole', 'filterStatus', 'sortBy'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', (e) => {
                    this.filters[id.replace('filter', '').toLowerCase()] = e.target.value;
                    this.applyFilters();
                });
            }
        });
        
        // Action buttons
        document.getElementById('refreshUsers')?.addEventListener('click', () => {
            this.loadUsers();
            this.loadUserStats();
        });
        
        document.getElementById('exportUsers')?.addEventListener('click', () => {
            this.exportUsers();
        });
        
        document.getElementById('addUserBtn')?.addEventListener('click', () => {
            this.showAddUserForm();
        });
        
        document.getElementById('bulkActions')?.addEventListener('click', () => {
            this.showBulkActions();
        });
        
        // Select all checkbox
        document.getElementById('selectAll')?.addEventListener('change', (e) => {
            this.toggleSelectAll(e.target.checked);
        });
        
        // User form submission
        document.getElementById('userForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveUser();
        });
    }

    async loadUsers() {
        try {
            console.log('Loading users...');
            
            // Show loading
            this.showLoading(true);
            
            // Try multiple ways to get database connection
            let db = null;
            
            // First try: Use adminAuthInstance
            if (window.adminAuthInstance && adminAuthInstance.adminDb) {
                db = adminAuthInstance.adminDb;
                console.log('✅ Using adminAuthInstance database connection');
            } 
            // Second try: Try to get default Firebase app
            else if (window.firebase && firebase.firestore) {
                try {
                    const defaultApp = firebase.app();
                    db = firebase.firestore(defaultApp);
                    console.log('✅ Using default Firebase app database connection');
                } catch (e) {
                    console.log('No default Firebase app:', e.message);
                }
            }
            // Third try: Try to initialize new Firebase app
            else if (window.firebase && firebase.initializeApp) {
                try {
                    // Use the global config if available
                    const config = window.firebaseConfig || {
                        apiKey: "AIzaSyC-FvYHTes2lAU3AkMJ6kGIEk4HjioP_HQ",
                        authDomain: "casalink-246fd.firebaseapp.com",
                        projectId: "casalink-246fd",
                        storageBucket: "casalink-246fd.firebasestorage.app",
                        messagingSenderId: "1089375490593",
                        appId: "1:1089375490593:web:a26cc91e15877b04bb0960"
                    };
                    
                    const firebaseApp = firebase.initializeApp(config, 'AdminUsersApp');
                    db = firebase.firestore(firebaseApp);
                    console.log('✅ Created new Firebase app for database connection');
                } catch (e) {
                    console.log('Failed to create Firebase app:', e.message);
                }
            }
            
            // If no database connection found, use demo data
            if (!db) {
                console.warn('No database connection available, using demo data');
                this.showDemoUsers();
                this.showLoading(false);
                return;
            }
            
            // Fetch users from Firestore
            const usersSnapshot = await db.collection('users').get();
            this.users = [];
            
            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                this.users.push({
                    id: doc.id,
                    ...userData,
                    // Ensure all fields exist
                    name: userData.name || 'Unknown',
                    email: userData.email || 'No email',
                    role: userData.role || 'unknown',
                    status: userData.status || (userData.isActive ? 'active' : 'inactive'),
                    createdAt: userData.createdAt || new Date().toISOString(),
                    lastLogin: userData.lastLogin || 'Never',
                    properties: userData.properties || userData.property_count || 0
                });
            });
            
            console.log(`Loaded ${this.users.length} users from Firestore`);
            
            // Apply filters and render
            this.applyFilters();
            
        } catch (error) {
            console.error('Error loading users:', error);
            this.showError('Failed to load users. Using demo data.');
            // Show demo data as fallback
            this.showDemoUsers();
        } finally {
            this.showLoading(false);
        }
    }

    async fetchUsersFromFirestore(db) {
        try {
            // Get all users from Firestore
            const usersSnapshot = await db.collection('users').get();
            this.users = [];
            
            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                this.users.push({
                    id: doc.id,
                    name: userData.name || 'Unknown',
                    email: userData.email || 'No email',
                    role: userData.role || 'unknown',
                    status: this.getUserStatus(userData),
                    createdAt: userData.createdAt || new Date().toISOString(),
                    lastLogin: userData.lastLogin || 'Never',
                    properties: userData.properties || userData.property_count || 0,
                    // Additional fields
                    landlordId: userData.landlordId,
                    roomNumber: userData.roomNumber,
                    loginCount: userData.loginCount || 0
                });
            });
            
        } catch (error) {
            console.error('Error fetching from Firestore:', error);
            throw error;
        }
    }

    getUserStatus(userData) {
        if (userData.status) return userData.status;
        if (userData.isActive !== undefined) return userData.isActive ? 'active' : 'inactive';
        if (userData.is_active !== undefined) return userData.is_active ? 'active' : 'inactive';
        return 'active'; // Default
    }

    async loadUserStats() {
        try {
            // Calculate stats
            const stats = {
                totalUsers: this.users.length,
                landlordCount: this.users.filter(u => u.role === 'landlord').length,
                tenantCount: this.users.filter(u => u.role === 'tenant').length,
                adminCount: this.users.filter(u => u.role === 'admin').length,
                activeUsers: this.users.filter(u => u.status === 'active').length
            };
            
            // Update UI
            Object.keys(stats).forEach(statId => {
                const element = document.getElementById(statId);
                if (element) {
                    element.textContent = stats[statId];
                }
            });
            
        } catch (error) {
            console.error('Error loading stats:', error);
            // Set demo stats
            this.setDemoStats();
        }
    }

    applyFilters() {
        let filtered = [...this.users];
        
        // Apply search filter
        if (this.filters.search) {
            const searchTerm = this.filters.search.toLowerCase();
            filtered = filtered.filter(user => 
                user.name.toLowerCase().includes(searchTerm) ||
                user.email.toLowerCase().includes(searchTerm)
            );
        }
        
        // Apply role filter
        if (this.filters.role !== 'all') {
            filtered = filtered.filter(user => user.role === this.filters.role);
        }
        
        // Apply status filter
        if (this.filters.status !== 'all') {
            filtered = filtered.filter(user => user.status === this.filters.status);
        }
        
        // Apply sorting
        switch (this.filters.sortBy) {
            case 'oldest':
                filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                break;
            case 'name':
                filtered.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'newest':
            default:
                filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        
        this.filteredUsers = filtered;
        this.renderUsersTable();
        this.updatePagination();
    }

    renderUsersTable() {
        const tableBody = document.getElementById('usersTableBody');
        if (!tableBody) return;
        
        if (this.filteredUsers.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center">
                        <div class="no-data">
                            <i class="fas fa-users"></i>
                            <p>No users found</p>
                            <small>Try changing your filters</small>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        // Calculate pagination
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const pageUsers = this.filteredUsers.slice(startIndex, endIndex);
        
        let html = '';
        
        pageUsers.forEach(user => {
            const createdAt = user.createdAt ? 
                new Date(user.createdAt).toLocaleDateString() : 'N/A';
            
            const lastLogin = user.lastLogin && user.lastLogin !== 'Never' ? 
                new Date(user.lastLogin).toLocaleDateString() : user.lastLogin || 'Never';
            
            html += `
                <tr data-user-id="${user.id}">
                    <td>
                        <input type="checkbox" class="user-select" value="${user.id}">
                    </td>
                    <td>
                        <div class="user-name">${user.name}</div>
                    </td>
                    <td>${user.email}</td>
                    <td>
                        <span class="role-badge role-${user.role}">
                            ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </span>
                    </td>
                    <td>
                        <span class="status-badge status-${user.status}">
                            ${user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                        </span>
                    </td>
                    <td>${createdAt}</td>
                    <td>${user.properties || 0}</td>
                    <td>${lastLogin}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-icon btn-sm btn-outline view-user" 
                                    title="View Details" data-user-id="${user.id}">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-icon btn-sm btn-outline edit-user"
                                    title="Edit User" data-user-id="${user.id}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-icon btn-sm btn-outline delete-user"
                                    title="Delete User" data-user-id="${user.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        tableBody.innerHTML = html;
        
        // Add event listeners to action buttons
        this.setupTableActions();
    }

    setupTableActions() {
        // View user details
        document.querySelectorAll('.view-user').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.target.closest('button').dataset.userId;
                this.showUserDetails(userId);
            });
        });
        
        // Edit user
        document.querySelectorAll('.edit-user').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.target.closest('button').dataset.userId;
                this.editUser(userId);
            });
        });
        
        // Delete user
        document.querySelectorAll('.delete-user').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.target.closest('button').dataset.userId;
                this.deleteUser(userId);
            });
        });
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredUsers.length / this.pageSize);
        const pagination = document.getElementById('pagination');
        const pageInfo = document.querySelector('.page-info');
        const paginationInfo = document.getElementById('paginationInfo');
        
        if (!pagination || !pageInfo || !paginationInfo) return;
        
        // Update page info
        pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
        
        // Update pagination info
        const start = (this.currentPage - 1) * this.pageSize + 1;
        const end = Math.min(this.currentPage * this.pageSize, this.filteredUsers.length);
        paginationInfo.textContent = `Showing ${start}-${end} of ${this.filteredUsers.length} users`;
        
        // Update buttons
        const [prevBtn, nextBtn] = pagination.querySelectorAll('button');
        prevBtn.disabled = this.currentPage === 1;
        nextBtn.disabled = this.currentPage === totalPages;
        
        // Remove existing event listeners and add new ones
        prevBtn.onclick = () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderUsersTable();
                this.updatePagination();
            }
        };
        
        nextBtn.onclick = () => {
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.renderUsersTable();
                this.updatePagination();
            }
        };
    }

    toggleSelectAll(checked) {
        document.querySelectorAll('.user-select').forEach(checkbox => {
            checkbox.checked = checked;
        });
    }

    showAddUserForm() {
        document.getElementById('userFormTitle').textContent = 'Add New User';
        document.getElementById('userForm').reset();
        document.getElementById('userFormModal').style.display = 'block';
    }

    async showUserDetails(userId) {
        try {
            const user = this.users.find(u => u.id === userId);
            if (!user) {
                throw new Error('User not found');
            }
            
            const modalContent = document.getElementById('userDetailContent');
            modalContent.innerHTML = `
                <div class="user-detail-section">
                    <h4>Basic Information</h4>
                    <div class="detail-row">
                        <div class="detail-label">Full Name:</div>
                        <div class="detail-value">${user.name}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Email:</div>
                        <div class="detail-value">${user.email}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Role:</div>
                        <div class="detail-value">
                            <span class="role-badge role-${user.role}">
                                ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                            </span>
                        </div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Status:</div>
                        <div class="detail-value">
                            <span class="status-badge status-${user.status}">
                                ${user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="user-detail-section">
                    <h4>Account Information</h4>
                    <div class="detail-row">
                        <div class="detail-label">User ID:</div>
                        <div class="detail-value"><code>${user.id}</code></div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Created:</div>
                        <div class="detail-value">${new Date(user.createdAt).toLocaleString()}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Last Login:</div>
                        <div class="detail-value">${user.lastLogin === 'Never' ? 'Never' : new Date(user.lastLogin).toLocaleString()}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Login Count:</div>
                        <div class="detail-value">${user.loginCount || 0}</div>
                    </div>
                </div>
                
                ${user.role === 'tenant' ? `
                <div class="user-detail-section">
                    <h4>Tenant Information</h4>
                    <div class="detail-row">
                        <div class="detail-label">Landlord ID:</div>
                        <div class="detail-value">${user.landlordId || 'Not assigned'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Room/Unit:</div>
                        <div class="detail-value">${user.roomNumber || 'Not specified'}</div>
                    </div>
                </div>
                ` : ''}
                
                ${user.role === 'landlord' ? `
                <div class="user-detail-section">
                    <h4>Landlord Information</h4>
                    <div class="detail-row">
                        <div class="detail-label">Properties:</div>
                        <div class="detail-value">${user.properties || 0}</div>
                    </div>
                </div>
                ` : ''}
            `;
            
            document.getElementById('modalUserTitle').textContent = `User: ${user.name}`;
            document.getElementById('userDetailModal').style.display = 'block';
            
            // Setup edit button
            document.getElementById('editUserBtn').onclick = () => {
                this.editUser(userId);
            };
            
        } catch (error) {
            console.error('Error showing user details:', error);
            this.showError('Failed to load user details');
        }
    }

    editUser(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;
        
        document.getElementById('userFormTitle').textContent = 'Edit User';
        
        // Fill form with user data
        document.getElementById('userName').value = user.name;
        document.getElementById('userEmail').value = user.email;
        document.getElementById('userRole').value = user.role;
        document.getElementById('userStatus').value = user.status;
        
        // Show/hide role-specific fields
        document.getElementById('userRole').dispatchEvent(new Event('change'));
        
        // Set role-specific fields
        if (user.role === 'tenant') {
            document.getElementById('tenantLandlord').value = user.landlordId || '';
            document.getElementById('tenantProperty').value = user.roomNumber || '';
        } else if (user.role === 'landlord') {
            document.getElementById('landlordProperties').value = user.properties || 0;
        }
        
        // Store user ID for update
        document.getElementById('userForm').dataset.userId = userId;
        document.getElementById('userFormModal').style.display = 'block';
    }

    async saveUser() {
        try {
            const form = document.getElementById('userForm');
            const userId = form.dataset.userId;
            const isEdit = !!userId;
            
            const userData = {
                name: document.getElementById('userName').value,
                email: document.getElementById('userEmail').value,
                role: document.getElementById('userRole').value,
                status: document.getElementById('userStatus').value,
                updatedAt: new Date().toISOString()
            };
            
            // Add role-specific data
            if (userData.role === 'tenant') {
                userData.landlordId = document.getElementById('tenantLandlord').value;
                userData.roomNumber = document.getElementById('tenantProperty').value;
            } else if (userData.role === 'landlord') {
                userData.properties = parseInt(document.getElementById('landlordProperties').value) || 0;
            }
            
            // Get password if provided
            const password = document.getElementById('userPassword').value;
            
            if (isEdit) {
                // Update existing user
                await this.updateUser(userId, userData, password);
            } else {
                // Create new user
                await this.createUser(userData, password);
            }
            
            // Close modal and refresh
            document.getElementById('userFormModal').style.display = 'none';
            await this.loadUsers();
            await this.loadUserStats();
            
            this.showSuccess(isEdit ? 'User updated successfully' : 'User created successfully');
            
        } catch (error) {
            console.error('Error saving user:', error);
            this.showError(error.message || 'Failed to save user');
        }
    }

    async createUser(userData, password) {
        // In a real app, you would:
        // 1. Create Firebase Auth account
        // 2. Create Firestore user document
        // 3. Send welcome email
        
        console.log('Creating user:', userData.email);
        
        // For demo, just add to local array
        const newUser = {
            id: 'demo_' + Date.now(),
            ...userData,
            createdAt: new Date().toISOString(),
            lastLogin: 'Never',
            loginCount: 0
        };
        
        this.users.push(newUser);
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return newUser;
    }

    async updateUser(userId, userData, password) {
        console.log('Updating user:', userId);
        
        // Find and update user in local array
        const userIndex = this.users.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            this.users[userIndex] = {
                ...this.users[userIndex],
                ...userData
            };
        }
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user?\n\nThis action cannot be undone.')) {
            return;
        }
        
        try {
            console.log('Deleting user:', userId);
            
            // In a real app, you would:
            // 1. Delete from Firestore
            // 2. Delete from Firebase Auth
            
            // Remove from local array
            this.users = this.users.filter(u => u.id !== userId);
            
            // Update UI
            this.applyFilters();
            await this.loadUserStats();
            
            this.showSuccess('User deleted successfully');
            
        } catch (error) {
            console.error('Error deleting user:', error);
            this.showError('Failed to delete user');
        }
    }

    exportUsers() {
        const data = this.filteredUsers.map(user => ({
            Name: user.name,
            Email: user.email,
            Role: user.role,
            Status: user.status,
            'Joined Date': new Date(user.createdAt).toLocaleDateString(),
            Properties: user.properties || 0,
            'Last Login': user.lastLogin === 'Never' ? 'Never' : new Date(user.lastLogin).toLocaleDateString()
        }));
        
        // Convert to CSV
        const csv = this.convertToCSV(data);
        
        // Create download link
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `casalink-users-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        this.showSuccess('Export started successfully');
    }

    convertToCSV(data) {
        const headers = Object.keys(data[0]);
        const rows = data.map(row => 
            headers.map(header => 
                JSON.stringify(row[header] || '')
            ).join(',')
        );
        return [headers.join(','), ...rows].join('\n');
    }

    showBulkActions() {
        const selected = document.querySelectorAll('.user-select:checked');
        if (selected.length === 0) {
            alert('Please select at least one user');
            return;
        }
        
        const action = prompt(`You selected ${selected.length} users.\n\nAvailable actions:\n1. Activate\n2. Deactivate\n3. Send email\n\nEnter action number:`);
        
        if (action) {
            switch(action) {
                case '1':
                    this.bulkActivate(selected);
                    break;
                case '2':
                    this.bulkDeactivate(selected);
                    break;
                case '3':
                    this.bulkSendEmail(selected);
                    break;
                default:
                    alert('Invalid action');
            }
        }
    }

    bulkActivate(selected) {
        const userIds = Array.from(selected).map(cb => cb.value);
        console.log('Activating users:', userIds);
        alert(`Activated ${userIds.length} users (demo)`);
    }

    bulkDeactivate(selected) {
        const userIds = Array.from(selected).map(cb => cb.value);
        console.log('Deactivating users:', userIds);
        alert(`Deactivated ${userIds.length} users (demo)`);
    }

    bulkSendEmail(selected) {
        const userIds = Array.from(selected).map(cb => cb.value);
        console.log('Sending email to users:', userIds);
        alert(`Sent email to ${userIds.length} users (demo)`);
    }

    showDemoUsers() {
        // Demo data for testing
        this.users = [
            {
                id: '1',
                name: 'John Landlord',
                email: 'john@example.com',
                role: 'landlord',
                status: 'active',
                createdAt: '2024-01-01T10:00:00Z',
                lastLogin: '2024-01-15T14:30:00Z',
                properties: 5,
                loginCount: 12
            },
            {
                id: '2',
                name: 'Maria Tenant',
                email: 'maria@example.com',
                role: 'tenant',
                status: 'active',
                createdAt: '2024-01-05T09:15:00Z',
                lastLogin: '2024-01-15T09:00:00Z',
                properties: 1,
                loginCount: 8,
                landlordId: '1',
                roomNumber: 'Unit 101'
            },
            {
                id: '3',
                name: 'Admin User',
                email: 'admin@casalink.com',
                role: 'admin',
                status: 'active',
                createdAt: '2024-01-01T08:00:00Z',
                lastLogin: '2024-01-15T16:45:00Z',
                properties: 0,
                loginCount: 25
            }
        ];
        
        this.applyFilters();
    }

    setDemoStats() {
        const demoStats = {
            totalUsers: 3,
            landlordCount: 1,
            tenantCount: 1,
            adminCount: 1,
            activeUsers: 3
        };
        
        Object.keys(demoStats).forEach(statId => {
            const element = document.getElementById(statId);
            if (element) {
                element.textContent = demoStats[statId];
            }
        });
    }

    showLoading(show) {
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.innerHTML = show ? 
                '<i class="fas fa-spinner fa-spin"></i> Loading...' : 
                'No users found';
        }
    }

    showError(message) {
        alert(`Error: ${message}`);
    }

    showSuccess(message) {
        // Could use a toast notification library
        alert(`Success: ${message}`);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing AdminUsers...');
    window.adminUsers = new AdminUsers();
});