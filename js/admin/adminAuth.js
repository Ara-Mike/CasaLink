// js/admin/adminAuth.js - FIXED VERSION
console.log('AdminAuth loading...');

// Prevent duplicate loading
if (window.AdminAuthClass) {
    console.log('AdminAuth already loaded, skipping...');
} else {
    // Define the class
    window.AdminAuthClass = class AdminAuth {
        constructor() {
            this.currentAdmin = null;
            this.isAdmin = false;
            this.adminApp = null;
            this.adminAuth = null;
            this.adminDb = null;
            this.isInitialized = false;
            
            // Initialize after a short delay
            setTimeout(() => this.init(), 100);
        }

        async init() {
            if (this.isInitialized) return;
            
            console.log('🔐 AdminAuth initializing...');
            
            // Wait for Firebase to load
            if (typeof firebase === 'undefined') {
                console.error('Firebase not loaded yet');
                setTimeout(() => this.init(), 1000);
                return;
            }
            
            try {
                // Get config
                await this.loadFirebaseConfig();
                
                // Initialize Firebase - IMPORTANT: Use same app name as login
                this.adminApp = firebase.initializeApp(this.firebaseConfig, 'AdminApp');
                this.adminAuth = firebase.auth(this.adminApp);
                this.adminDb = firebase.firestore(this.adminApp);
                
                console.log('✅ Firebase Admin initialized');
                
                this.isInitialized = true;
                
                // Setup login form if on login page
                this.setupLoginForm();
                
                // Check auth state (but don't auto-logout on dashboard)
                this.checkAdminState();
                
            } catch (error) {
                console.error('Failed to initialize AdminAuth:', error);
            }
        }

        async loadFirebaseConfig() {
            // Try multiple sources for config
            if (window.firebaseConfig) {
                this.firebaseConfig = window.firebaseConfig;
                console.log('Using global firebaseConfig');
            } else {
                // Your actual Firebase config
                this.firebaseConfig = {
                    apiKey: "AIzaSyC-FvYHTes2lAU3AkMJ6kGIEk4HjioP_HQ",
                    authDomain: "casalink-246fd.firebaseapp.com",
                    projectId: "casalink-246fd",
                    storageBucket: "casalink-246fd.firebasestorage.app",
                    messagingSenderId: "1089375490593",
                    appId: "1:1089375490593:web:a26cc91e15877b04bb0960"
                };
                console.log('Using hardcoded Firebase config');
            }
        }

        setupLoginForm() {
            const loginForm = document.getElementById('adminLoginForm');
            if (loginForm) {
                loginForm.addEventListener('submit', (e) => this.handleLogin(e));
                console.log('✅ Login form setup complete');
            }
        }

        async handleLogin(e) {
            e.preventDefault();
            
            const email = document.getElementById('adminEmail').value;
            const password = document.getElementById('adminPassword').value;
            const adminKey = document.getElementById('adminKey')?.value || '';
            
            const errorElement = document.getElementById('adminLoginError');
            const submitBtn = document.querySelector('button[type="submit"]');
            
            // Show loading
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
            submitBtn.disabled = true;
            
            try {
                // Clear previous errors
                if (errorElement) {
                    errorElement.textContent = '';
                    errorElement.classList.add('hidden');
                }
                
                console.log('🔄 Attempting admin login:', email);
                
                // Sign in
                const userCredential = await this.adminAuth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                console.log('✅ Firebase auth successful:', user.uid);
                
                // Check admin status
                const adminDoc = await this.adminDb.collection('admin_users').doc(user.uid).get();
                
                if (!adminDoc.exists) {
                    await this.adminAuth.signOut();
                    throw new Error('Access denied. Not an administrator.');
                }
                
                const adminData = adminDoc.data();
                
                if (adminData.is_active === false) {
                    await this.adminAuth.signOut();
                    throw new Error('Admin account is deactivated.');
                }
                
                // Check admin key (optional)
                if (adminKey && adminData.admin_key !== adminKey) {
                    await this.adminAuth.signOut();
                    throw new Error('Invalid admin key.');
                }
                
                // Update last login
                await this.adminDb.collection('admin_users').doc(user.uid).update({
                    last_login: new Date().toISOString()
                });
                
                // Store admin data
                this.currentAdmin = {
                    uid: user.uid,
                    email: user.email,
                    ...adminData
                };
                this.isAdmin = true;
                
                console.log('✅ Admin login successful:', this.currentAdmin.email);
                
                // IMPORTANT: Store admin session in localStorage
                localStorage.setItem('admin_session', JSON.stringify({
                    uid: user.uid,
                    email: user.email,
                    timestamp: Date.now()
                }));
                
                // Redirect to dashboard
                window.location.href = 'dashboard.html';
                
            } catch (error) {
                console.error('❌ Admin login error:', error);
                
                if (errorElement) {
                    errorElement.textContent = this.getErrorMessage(error);
                    errorElement.classList.remove('hidden');
                } else {
                    alert('Login failed: ' + this.getErrorMessage(error));
                }
                
                // Reset button
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        }

        getErrorMessage(error) {
            const errorMessages = {
                'auth/invalid-email': 'Invalid email address',
                'auth/user-disabled': 'Account disabled',
                'auth/user-not-found': 'No admin account found',
                'auth/wrong-password': 'Incorrect password',
                'auth/too-many-requests': 'Too many attempts. Try again later',
                'auth/network-request-failed': 'Network error. Check connection'
            };
            
            return errorMessages[error.code] || error.message || 'Login failed';
        }

        async checkAdminState() {
            this.adminAuth.onAuthStateChanged(async (user) => {
                console.log('Auth state changed:', user ? 'User logged in' : 'No user');
                
                if (user) {
                    try {
                        // Check if user is admin
                        const adminDoc = await this.adminDb.collection('admin_users').doc(user.uid).get();
                        
                        if (adminDoc.exists) {
                            const adminData = adminDoc.data();
                            this.currentAdmin = {
                                uid: user.uid,
                                email: user.email,
                                ...adminData
                            };
                            this.isAdmin = true;
                            
                            console.log('✅ Admin verified:', this.currentAdmin.email);
                            
                            // If on login page, redirect to dashboard
                            if (window.location.pathname.includes('index.html')) {
                                console.log('On login page, redirecting to dashboard...');
                                window.location.href = 'dashboard.html';
                            }
                        } else {
                            console.log('User is not an admin');
                            // Only auto-logout if on dashboard page
                            if (window.location.pathname.includes('dashboard.html')) {
                                console.log('On dashboard but not admin, logging out...');
                                await this.logout();
                            }
                        }
                    } catch (error) {
                        console.error('Error checking admin status:', error);
                    }
                } else {
                    this.currentAdmin = null;
                    this.isAdmin = false;
                    
                    // Only redirect to login if on dashboard (not login page)
                    if (window.location.pathname.includes('dashboard.html')) {
                        console.log('No user on dashboard, redirecting to login...');
                        // Clear any stored session
                        localStorage.removeItem('admin_session');
                        window.location.href = 'index.html';
                    }
                }
            });
        }

        async logout() {
            try {
                await this.adminAuth.signOut();
                localStorage.removeItem('admin_session');
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Logout error:', error);
            }
        }

        getCurrentAdmin() {
            return this.currentAdmin;
        }

        isAuthenticated() {
            return this.isAdmin;
        }
        
        // New method: Check if user has valid session
        hasValidSession() {
            const session = localStorage.getItem('admin_session');
            if (!session) return false;
            
            try {
                const sessionData = JSON.parse(session);
                // Check if session is less than 24 hours old
                const isRecent = Date.now() - sessionData.timestamp < (24 * 60 * 60 * 1000);
                return isRecent;
            } catch (e) {
                return false;
            }
        }
    };

    // Create and expose instance
    window.adminAuthInstance = new window.AdminAuthClass();
    console.log('✅ AdminAuth instance created');
}

// Simple initialization for login page
if (document.getElementById('adminLoginForm')) {
    // Ensure instance exists
    if (!window.adminAuthInstance) {
        window.adminAuthInstance = new window.AdminAuthClass();
    }
}