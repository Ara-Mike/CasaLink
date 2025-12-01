// js/admin/adminAuth.js - IMPROVED VERSION
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
            this.dbInitialized = false;
            this.authStateUnsubscribe = null;
            this.redirectTimeout = null;
            
            // Initialize immediately
            this.safeInit();
        }

        async safeInit() {
            try {
                await this.init();
            } catch (error) {
                console.error('Safe init failed:', error);
                // Setup login form anyway
                this.setupLoginForm();
            }
        }

        async init() {
            if (this.isInitialized) return;
            
            console.log('🔐 AdminAuth initializing...');
            
            // Check for logout/cleanup parameters
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('logout') || urlParams.has('cleanup')) {
                console.log('Logout detected, doing cleanup but still initializing');
                // Clear storage but continue with init
                localStorage.removeItem('admin_session');
                sessionStorage.clear();
            }
            
            try {
                // Wait for Firebase to load
                if (typeof firebase === 'undefined') {
                    console.error('Firebase not loaded yet');
                    setTimeout(() => this.init(), 1000);
                    return;
                }
                
                // Get config
                const config = this.getFirebaseConfig();
                
                // Use a consistent app name
                const appName = 'CasaLinkAdminApp';
                
                try {
                    // Check if app already exists
                    const existingApps = firebase.apps;
                    let existingApp = null;
                    
                    for (const app of existingApps) {
                        if (app.name === appName || app.name.includes('AdminApp')) {
                            existingApp = app;
                            break;
                        }
                    }
                    
                    if (existingApp) {
                        // Reuse existing app
                        this.adminApp = existingApp;
                        console.log('✅ Reusing existing Firebase Admin app:', existingApp.name);
                    } else {
                        // Initialize new app
                        this.adminApp = firebase.initializeApp(config, appName);
                        console.log('✅ Created new Firebase Admin app:', appName);
                    }
                    
                    // Get auth instance
                    this.adminAuth = firebase.auth(this.adminApp);
                    
                    // Initialize Firestore (but don't wait for it)
                    this.initFirestore();
                    
                    this.isInitialized = true;
                    
                    // Setup login form
                    this.setupLoginForm();
                    
                    // Setup auth state listener (but only if not on login page with logout param)
                    if (!urlParams.has('logout')) {
                        this.setupAuthStateListener();
                    }
                    
                    // Check for existing session
                    this.checkExistingSession();
                    
                } catch (firebaseError) {
                    console.error('Firebase initialization error:', firebaseError);
                    
                    // Try alternative initialization
                    await this.alternativeInit(config);
                }
                
            } catch (error) {
                console.error('Failed to initialize AdminAuth:', error);
                throw error;
            }
        }

        getFirebaseConfig() {
            // Use global config if available
            if (window.firebaseConfig) {
                return window.firebaseConfig;
            }
            
            // Default config
            return {
                apiKey: "AIzaSyC-FvYHTes2lAU3AkMJ6kGIEk4HjioP_HQ",
                authDomain: "casalink-246fd.firebaseapp.com",
                projectId: "casalink-246fd",
                storageBucket: "casalink-246fd.firebasestorage.app",
                messagingSenderId: "1089375490593",
                appId: "1:1089375490593:web:a26cc91e15877b04bb0960"
            };
        }

        async initFirestore() {
            try {
                if (!this.adminDb && this.adminApp) {
                    this.adminDb = firebase.firestore(this.adminApp);
                    
                    // Try to enable persistence (optional)
                    try {
                        await this.adminDb.enablePersistence({
                            synchronizeTabs: true
                        });
                        console.log('✅ Firestore persistence enabled');
                    } catch (persistenceError) {
                        console.warn('Firestore persistence not available:', persistenceError.message);
                    }
                    
                    this.dbInitialized = true;
                    console.log('✅ Firestore initialized');
                }
            } catch (error) {
                console.error('Failed to initialize Firestore:', error);
                // Continue without Firestore for now
            }
        }

        async alternativeInit(config) {
            console.log('Trying alternative initialization...');
            
            try {
                // Try default app
                this.adminApp = firebase.app();
                this.adminAuth = firebase.auth();
                
                if (!this.adminAuth) {
                    throw new Error('Default auth not available');
                }
                
                console.log('✅ Using default Firebase app');
                
                // Initialize Firestore
                this.initFirestore();
                
                this.isInitialized = true;
                this.setupLoginForm();
                
            } catch (defaultError) {
                console.error('Default app failed:', defaultError);
                
                // Last resort: try initialize without app name
                try {
                    this.adminApp = firebase.initializeApp(config);
                    this.adminAuth = firebase.auth(this.adminApp);
                    console.log('✅ Initialized without app name');
                    
                    this.initFirestore();
                    this.isInitialized = true;
                    this.setupLoginForm();
                    
                } catch (finalError) {
                    console.error('Final initialization attempt failed:', finalError);
                    throw finalError;
                }
            }
        }

        setupLoginForm() {
            const loginForm = document.getElementById('adminLoginForm');
            if (loginForm && !loginForm.dataset.listenerAdded) {
                loginForm.dataset.listenerAdded = 'true';
                
                // Remove any existing submit handlers
                const newForm = loginForm.cloneNode(true);
                loginForm.parentNode.replaceChild(newForm, loginForm);
                
                newForm.addEventListener('submit', (e) => this.handleLogin(e));
                console.log('✅ Login form setup complete');
            }
        }

        async handleLogin(e) {
            e.preventDefault();
            
            const email = document.getElementById('adminEmail').value.trim();
            const password = document.getElementById('adminPassword').value;
            const adminKey = document.getElementById('adminKey')?.value || '';
            
            const errorElement = document.getElementById('adminLoginError');
            const submitBtn = document.querySelector('button[type="submit"]');
            
            // Validate inputs
            if (!email || !password) {
                this.showError(errorElement, 'Please enter both email and password');
                return;
            }
            
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
                
                // Ensure Firebase auth is available
                if (!this.adminAuth) {
                    console.log('Reinitializing Firebase auth...');
                    await this.reinitializeFirebase();
                    
                    if (!this.adminAuth) {
                        throw new Error('Authentication system not ready. Please refresh the page.');
                    }
                }
                
                // Sign in with Firebase
                const userCredential = await this.adminAuth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                console.log('✅ Firebase auth successful:', user.uid);
                
                // Verify admin status
                await this.verifyAdminStatus(user, adminKey);
                
                // Store session
                this.createAdminSession(user);
                
                // Clear login form
                e.target.reset();
                
                // Redirect to dashboard
                console.log('✅ Login successful, redirecting...');
                window.location.href = 'dashboard.html';
                
            } catch (error) {
                console.error('❌ Admin login error:', error);
                
                // Handle specific Firebase errors
                if (error.code === 'auth/network-request-failed') {
                    // Try to reinitialize
                    this.isInitialized = false;
                    await this.reinitializeFirebase();
                    this.showError(errorElement, 'Network error. Please try again.');
                } else {
                    this.showError(errorElement, this.getErrorMessage(error));
                }
                
            } finally {
                // Reset button
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        }

        async verifyAdminStatus(user, adminKey) {
            // Ensure Firestore is ready
            if (!this.adminDb) {
                await this.initFirestore();
            }
            
            // Check if user is in admin collection
            const adminDoc = await this.adminDb.collection('admin_users').doc(user.uid).get();
            
            if (!adminDoc.exists) {
                await this.adminAuth.signOut();
                throw new Error('Access denied. Not an administrator.');
            }
            
            const adminData = adminDoc.data();
            
            // Check if admin account is active
            if (adminData.is_active === false) {
                await this.adminAuth.signOut();
                throw new Error('Admin account is deactivated.');
            }
            
            // Check admin key (if provided)
            if (adminKey && adminData.admin_key && adminData.admin_key !== adminKey) {
                await this.adminAuth.signOut();
                throw new Error('Invalid admin key.');
            }
            
            // Update last login
            try {
                await this.adminDb.collection('admin_users').doc(user.uid).update({
                    last_login: new Date().toISOString(),
                    login_count: (adminData.login_count || 0) + 1
                });
            } catch (updateError) {
                console.warn('Could not update last login:', updateError);
            }
            
            // Store admin data
            this.currentAdmin = {
                uid: user.uid,
                email: user.email,
                ...adminData
            };
            this.isAdmin = true;
        }

        createAdminSession(user) {
            const sessionData = {
                uid: user.uid,
                email: user.email,
                timestamp: Date.now(),
                source: 'login'
            };
            
            localStorage.setItem('admin_session', JSON.stringify(sessionData));
            sessionStorage.setItem('admin_logged_in', 'true');
            
            console.log('✅ Admin session created');
        }

        async reinitializeFirebase() {
            console.log('Reinitializing Firebase...');
            
            // Clear current instances
            this.isInitialized = false;
            this.adminAuth = null;
            this.adminDb = null;
            this.dbInitialized = false;
            
            // Remove auth listener
            if (this.authStateUnsubscribe) {
                this.authStateUnsubscribe();
                this.authStateUnsubscribe = null;
            }
            
            // Reinitialize
            try {
                const config = this.getFirebaseConfig();
                const appName = 'CasaLinkAdminApp_Reinit_' + Date.now();
                
                // Delete any existing apps with similar names
                if (firebase.apps) {
                    firebase.apps.forEach(app => {
                        if (app.name.includes('AdminApp')) {
                            try {
                                app.delete();
                            } catch (e) {
                                console.log('Could not delete app:', app.name);
                            }
                        }
                    });
                }
                
                // Create new app
                this.adminApp = firebase.initializeApp(config, appName);
                this.adminAuth = firebase.auth(this.adminApp);
                
                // Initialize Firestore
                await this.initFirestore();
                
                this.isInitialized = true;
                console.log('✅ Firebase reinitialized successfully');
                
            } catch (error) {
                console.error('Failed to reinitialize Firebase:', error);
                throw error;
            }
        }

        checkExistingSession() {
            // Check if we have a valid session in localStorage
            const session = localStorage.getItem('admin_session');
            if (!session) return;
            
            try {
                const sessionData = JSON.parse(session);
                
                // Check if session is recent (less than 24 hours)
                const isRecent = Date.now() - sessionData.timestamp < (24 * 60 * 60 * 1000);
                
                if (isRecent && this.adminAuth) {
                    // Check if we're on login page
                    const isLoginPage = window.location.pathname.includes('index.html');
                    const hasLogoutParam = window.location.search.includes('logout');
                    
                    // If on login page and not logging out, auto-redirect
                    if (isLoginPage && !hasLogoutParam) {
                        console.log('Existing session found, checking auth state...');
                        
                        // Listen for auth state to confirm
                        this.adminAuth.onAuthStateChanged((user) => {
                            if (user && this.isInitialized) {
                                console.log('User already authenticated, redirecting...');
                                setTimeout(() => {
                                    window.location.href = 'dashboard.html';
                                }, 500);
                            }
                        });
                    }
                } else if (!isRecent) {
                    // Session expired
                    localStorage.removeItem('admin_session');
                }
                
            } catch (error) {
                console.error('Error checking session:', error);
                localStorage.removeItem('admin_session');
            }
        }

        setupAuthStateListener() {
            if (!this.adminAuth) return;
            
            this.authStateUnsubscribe = this.adminAuth.onAuthStateChanged(async (user) => {
                console.log('Auth state changed:', user ? 'User present' : 'No user');
                
                if (user) {
                    // User is signed in
                    await this.handleAuthenticatedUser(user);
                } else {
                    // User is signed out
                    this.handleSignedOutUser();
                }
            });
        }

        async handleAuthenticatedUser(user) {
            try {
                // Check if user is admin
                if (this.adminDb) {
                    const adminDoc = await this.adminDb.collection('admin_users').doc(user.uid).get();
                    
                    if (adminDoc.exists) {
                        const adminData = adminDoc.data();
                        this.currentAdmin = {
                            uid: user.uid,
                            email: user.email,
                            ...adminData
                        };
                        this.isAdmin = true;
                        
                        console.log('✅ Admin auto-authenticated:', this.currentAdmin.email);
                        
                        // If on login page, redirect to dashboard
                        const isLoginPage = window.location.pathname.includes('index.html');
                        const hasLogoutParam = window.location.search.includes('logout');
                        
                        if (isLoginPage && !hasLogoutParam) {
                            console.log('Redirecting from login page to dashboard...');
                            setTimeout(() => {
                                window.location.href = 'dashboard.html';
                            }, 1000);
                        }
                    } else {
                        // Not an admin, sign out
                        console.log('User is not an admin, signing out...');
                        await this.adminAuth.signOut();
                        localStorage.removeItem('admin_session');
                    }
                }
            } catch (error) {
                console.error('Error handling authenticated user:', error);
            }
        }

        handleSignedOutUser() {
            this.currentAdmin = null;
            this.isAdmin = false;
            
            // Check if we're on a protected page
            const protectedPages = ['dashboard.html', 'users.html', 'analytics.html', 'support.html', 'settings.html'];
            const currentPage = window.location.pathname.split('/').pop();
            const isProtectedPage = protectedPages.includes(currentPage);
            
            if (isProtectedPage) {
                console.log('User signed out on protected page, redirecting...');
                localStorage.removeItem('admin_session');
                
                setTimeout(() => {
                    window.location.href = 'index.html?session_expired=true';
                }, 500);
            }
        }

        getErrorMessage(error) {
            const errorMessages = {
                'auth/invalid-email': 'Invalid email address',
                'auth/user-disabled': 'Account disabled',
                'auth/user-not-found': 'No admin account found',
                'auth/wrong-password': 'Incorrect password',
                'auth/too-many-requests': 'Too many attempts. Try again later',
                'auth/network-request-failed': 'Network error. Please refresh the page and try again.',
                'auth/unauthorized-domain': 'This domain is not authorized.',
                'auth/app-deleted': 'Please refresh the page and try again.',
                'auth/invalid-api-key': 'Configuration error. Please contact support.',
                'auth/operation-not-allowed': 'Email/password sign-in is disabled.'
            };
            
            // Handle common error patterns
            if (error.message && error.message.includes('Cannot read properties of null')) {
                return 'Authentication system error. Please refresh the page.';
            }
            
            if (error.message && error.message.includes('FirebaseError')) {
                return 'Firebase error. Please check your connection.';
            }
            
            return errorMessages[error.code] || error.message || 'Login failed. Please try again.';
        }

        showError(errorElement, message) {
            if (errorElement) {
                errorElement.textContent = message;
                errorElement.classList.remove('hidden');
                errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                alert('Error: ' + message);
            }
        }

        async logout() {
            try {
                console.log('🔄 Starting logout process...');
                
                // Set logout flag
                sessionStorage.setItem('admin_logout', 'true');
                
                // Clear storage first
                localStorage.removeItem('admin_session');
                
                // Sign out from Firebase if available
                if (this.adminAuth) {
                    await this.adminAuth.signOut();
                    console.log('✅ Firebase signout successful');
                }
                
                // Clear instance data
                this.currentAdmin = null;
                this.isAdmin = false;
                
                // Don't delete the Firebase app - just clear the reference
                // This prevents issues when logging back in
                
                console.log('✅ Logout complete');
                
                // Redirect to login page with logout parameter
                window.location.href = 'index.html?logout=true&t=' + Date.now();
                
            } catch (error) {
                console.error('Logout error:', error);
                // Still redirect even on error
                localStorage.removeItem('admin_session');
                window.location.href = 'index.html?logout=error';
            }
        }

        getCurrentAdmin() {
            return this.currentAdmin;
        }

        isAuthenticated() {
            return this.isAdmin;
        }
        
        getStatus() {
            return {
                initialized: this.isInitialized,
                hasAuth: !!this.adminAuth,
                hasDb: !!this.adminDb,
                currentAdmin: this.currentAdmin ? this.currentAdmin.email : 'None'
            };
        }
    };

    // Create and expose instance
    window.adminAuthInstance = new window.AdminAuthClass();
    console.log('✅ AdminAuth instance created');
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.AdminAuthClass;
}