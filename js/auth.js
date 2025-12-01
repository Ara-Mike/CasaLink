// js/auth.js - FIXED VERSION
class AuthManager {
    static currentAuthUnsubscribe = null;

    static adminEmails = [
        'admin@casalink.com',
        'superadmin@casalink.com'
        // Add more admin emails as needed
    ];
    

    static async login(email, password, role) {
        try {
            if (!window.firebaseAuth) {
                throw new Error('Firebase Auth not initialized');
            }
            
            console.log('🔄 Login process started...', { email, role });
            
            // Clear any existing session first
            await firebaseAuth.signOut();
            
            const userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            console.log('Firebase auth success, user:', user.uid);
            
            // Check if user exists in Firestore
            const userDoc = await firebaseDb.collection('users').doc(user.uid).get();
            
            if (userDoc.exists) {
                // Existing user - normal login
                const userData = { 
                    id: userDoc.id,
                    ...userDoc.data(), 
                    uid: user.uid 
                };
                
                console.log('📊 User login stats:', { 
                    loginCount: userData.loginCount, 
                    hasTemporaryPassword: userData.hasTemporaryPassword,
                    passwordChanged: userData.passwordChanged 
                });
                
                // Role verification
                if (userData.role !== role) {
                    await firebaseAuth.signOut();
                    throw new Error(`This account is registered as a ${userData.role}. Please select "${userData.role}" when logging in.`);
                }
                
                // CHECK FOR PASSWORD CHANGE REQUIREMENT BEFORE INCREMENTING
                let requiresPasswordChange = false;
                if (userData.role === 'tenant' && userData.hasTemporaryPassword && !userData.passwordChanged) {
                    // Check if this is the FIRST real login (loginCount = 0)
                    if (userData.loginCount === 0) {
                        requiresPasswordChange = true;
                        console.log('🔐 FIRST real tenant login - password change REQUIRED');
                    } else {
                        console.log('✅ Subsequent login - no password change required');
                    }
                }
                
                // UPDATE LOGIN COUNT (increment after checking)
                const newLoginCount = (userData.loginCount || 0) + 1;
                const updates = {
                    loginCount: newLoginCount,
                    lastLogin: new Date().toISOString()
                };
                
                console.log('🔄 Updated login count:', newLoginCount);
                
                // Update the user document with new login count
                await firebaseDb.collection('users').doc(user.uid).update(updates);
                
                // SYNC TO DATA MANAGER - ADD THIS LINE
                this.syncUserToDataManager({
                    ...userData,
                    requiresPasswordChange: requiresPasswordChange
                });
                
                // Return user data with password change requirement
                return {
                    ...userData,
                    requiresPasswordChange: requiresPasswordChange
                };
                
            } else {
                // NEW USER - Auto-create tenant account
                console.log('New user detected, auto-creating tenant account...');
                
                // For now, create a basic tenant profile
                const newUserData = {
                    email: email,
                    name: email.split('@')[0], // Default name from email
                    role: 'tenant',
                    createdAt: new Date().toISOString(),
                    isActive: true,
                    hasTemporaryPassword: true,
                    loginCount: 1, // First login
                    passwordChanged: false,
                    lastLogin: new Date().toISOString()
                };
                
                await firebaseDb.collection('users').doc(user.uid).set(newUserData);
                
                console.log('Auto-created tenant account with first login');
                
                const userResponse = {
                    id: user.uid,
                    ...newUserData,
                    uid: user.uid,
                    requiresPasswordChange: true // Require password change on first login
                };
                
                // SYNC TO DATA MANAGER - ADD THIS LINE
                this.syncUserToDataManager(userResponse);
                
                return userResponse;
            }
            
        } catch (error) {
            console.error('Login error details:', error);
            // SYNC NULL TO DATA MANAGER ON ERROR - ADD THIS LINE
            this.syncUserToDataManager(null);
            await firebaseAuth.signOut();
            throw error;
        }
    }

     static async checkAdminStatus(userId) {
        try {
            if (!userId) return false;
            
            console.log('🛡️ Checking admin status for user:', userId);
            
            // First check against hardcoded admin emails (for development)
            const currentUser = firebaseAuth.currentUser;
            if (currentUser && currentUser.email) {
                const userEmail = currentUser.email.toLowerCase();
                if (this.adminEmails.includes(userEmail)) {
                    console.log('✅ User is admin (email in admin list):', userEmail);
                    return true;
                }
            }
            
            // Then check Firestore admin_users collection
            try {
                const adminDoc = await firebaseDb
                    .collection('admin_users')
                    .doc(userId)
                    .get();
                
                if (adminDoc.exists) {
                    const adminData = adminDoc.data();
                    if (adminData.is_active !== false) {
                        console.log('✅ User is admin (Firestore record):', userId);
                        return true;
                    }
                }
            } catch (firestoreError) {
                console.warn('⚠️ Could not check Firestore admin status:', firestoreError);
                // Continue with email check only
            }
            
            console.log('❌ User is not admin:', userId);
            return false;
            
        } catch (error) {
            console.error('❌ Error checking admin status:', error);
            return false;
        }
    }

    static async getUserWithAdminStatus(firebaseUser) {
        try {
            if (!firebaseUser) return null;
            
            // First get the user document
            const userDoc = await firebaseDb
                .collection('users')
                .doc(firebaseUser.uid)
                .get();
            
            if (!userDoc.exists) {
                return null;
            }
            
            const userData = userDoc.data();
            
            // Check admin status
            const isAdmin = await this.checkAdminStatus(firebaseUser.uid);
            
            // Enhanced user data with admin status
            const enhancedUserData = {
                id: userDoc.id,
                uid: firebaseUser.uid,
                email: userData.email,
                name: userData.name || userData.email.split('@')[0],
                role: userData.role,
                isActive: userData.isActive !== false,
                hasTemporaryPassword: userData.hasTemporaryPassword || false,
                passwordChanged: userData.passwordChanged || false,
                requiresPasswordChange: userData.requiresPasswordChange || false,
                status: userData.status || 'active',
                loginCount: userData.loginCount || 0,
                lastLogin: userData.lastLogin,
                createdAt: userData.createdAt,
                updatedAt: userData.updatedAt,
                // Tenant specific fields
                landlordId: userData.landlordId,
                roomNumber: userData.roomNumber,
                // Landlord specific fields
                properties: userData.properties || [],
                // NEW: Admin status
                isAdmin: isAdmin,
                adminRole: isAdmin ? 'admin' : null
            };
            
            console.log('👤 User with admin status:', {
                email: enhancedUserData.email,
                role: enhancedUserData.role,
                isAdmin: enhancedUserData.isAdmin
            });
            
            return enhancedUserData;
            
        } catch (error) {
            console.error('❌ Error getting user with admin status:', error);
            return null;
        }
    }

     static toggleAdminLink(user) {
        const adminLink = document.getElementById('adminFloatingBtn');
        if (!adminLink) return;
        
        if (user && user.isAdmin) {
            console.log('🔓 Showing admin link for:', user.email);
            adminLink.style.display = 'block';
        } else {
            console.log('🔒 Hiding admin link');
            adminLink.style.display = 'none';
        }
    }

     static async getCurrentUserWithAdminStatus() {
        try {
            const currentUser = firebaseAuth.currentUser;
            if (!currentUser) return null;
            
            return await this.getUserWithAdminStatus(currentUser);
        } catch (error) {
            console.error('❌ Error getting current user with admin status:', error);
            return null;
        }
    }

     static onAuthChange(callback) {
        if (!window.firebaseAuth) {
            console.error('Firebase Auth not available for auth state listener');
            return () => {};
        }
        
        // Enhanced auth state listener with admin status
        return firebaseAuth.onAuthStateChanged(async (firebaseUser) => {
            console.log('🔄 Firebase auth state changed:', firebaseUser ? `User: ${firebaseUser.uid}` : 'No user');
            
            if (firebaseUser) {
                try {
                    // Use the new method that includes admin status
                    const userData = await this.getUserWithAdminStatus(firebaseUser);
                    
                    if (userData) {
                        console.log('✅ User data with admin status loaded:', {
                            email: userData.email,
                            role: userData.role,
                            isAdmin: userData.isAdmin
                        });
                        
                        // Sync to DataManager
                        this.syncUserToDataManager(userData);
                        
                        // Toggle admin link visibility
                        this.toggleAdminLink(userData);
                        
                        callback(userData);
                    } else {
                        console.error('❌ User document not found in Firestore');
                        this.syncUserToDataManager(null);
                        this.toggleAdminLink(null);
                        await this.logout();
                        callback(null);
                    }
                } catch (error) {
                    console.error('❌ Error fetching user data in auth listener:', error);
                    this.syncUserToDataManager(null);
                    this.toggleAdminLink(null);
                    callback(null);
                }
            } else {
                console.log('👤 No Firebase user');
                this.syncUserToDataManager(null);
                this.toggleAdminLink(null);
                callback(null);
            }
        });
    }

     static async login(email, password, role) {
        try {
            if (!window.firebaseAuth) {
                throw new Error('Firebase Auth not initialized');
            }
            
            console.log('🔄 Login process started...', { email, role });
            
            // Clear any existing session first
            await firebaseAuth.signOut();
            
            const userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            console.log('Firebase auth success, user:', user.uid);
            
            // Check if user exists in Firestore
            const userDoc = await firebaseDb.collection('users').doc(user.uid).get();
            
            if (userDoc.exists) {
                // Existing user - normal login
                const userData = userDoc.data();
                
                console.log('📊 User login stats:', { 
                    loginCount: userData.loginCount, 
                    hasTemporaryPassword: userData.hasTemporaryPassword,
                    passwordChanged: userData.passwordChanged 
                });
                
                // Role verification
                if (userData.role !== role) {
                    await firebaseAuth.signOut();
                    throw new Error(`This account is registered as a ${userData.role}. Please select "${userData.role}" when logging in.`);
                }
                
                // Check for password change requirement
                let requiresPasswordChange = false;
                if (userData.role === 'tenant' && userData.hasTemporaryPassword && !userData.passwordChanged) {
                    if (userData.loginCount === 0) {
                        requiresPasswordChange = true;
                        console.log('🔐 FIRST real tenant login - password change REQUIRED');
                    } else {
                        console.log('✅ Subsequent login - no password change required');
                    }
                }
                
                // Check admin status
                const isAdmin = await this.checkAdminStatus(user.uid);
                
                // Update login count
                const newLoginCount = (userData.loginCount || 0) + 1;
                const updates = {
                    loginCount: newLoginCount,
                    lastLogin: new Date().toISOString()
                };
                
                console.log('🔄 Updated login count:', newLoginCount);
                
                // Update the user document
                await firebaseDb.collection('users').doc(user.uid).update(updates);
                
                // Prepare response with admin status
                const responseData = {
                    id: userDoc.id,
                    ...userData,
                    uid: user.uid,
                    requiresPasswordChange: requiresPasswordChange,
                    isAdmin: isAdmin,
                    adminRole: isAdmin ? 'admin' : null
                };
                
                // Sync to DataManager
                this.syncUserToDataManager(responseData);
                
                // Toggle admin link visibility
                this.toggleAdminLink(responseData);
                
                return responseData;
                
            } else {
                // NEW USER - Auto-create tenant account
                console.log('New user detected, auto-creating tenant account...');
                
                // Check if this email is in admin list
                const isAdminEmail = this.adminEmails.includes(email.toLowerCase());
                
                // Create user data
                const newUserData = {
                    email: email,
                    name: email.split('@')[0],
                    role: isAdminEmail ? 'admin' : 'tenant', // Set role based on email
                    createdAt: new Date().toISOString(),
                    isActive: true,
                    hasTemporaryPassword: true,
                    loginCount: 1,
                    passwordChanged: false,
                    lastLogin: new Date().toISOString(),
                    isAdmin: isAdminEmail // Add admin flag
                };
                
                await firebaseDb.collection('users').doc(user.uid).set(newUserData);
                
                console.log('Auto-created account with first login, isAdmin:', isAdminEmail);
                
                const userResponse = {
                    id: user.uid,
                    ...newUserData,
                    uid: user.uid,
                    requiresPasswordChange: true,
                    isAdmin: isAdminEmail,
                    adminRole: isAdminEmail ? 'admin' : null
                };
                
                // Sync to DataManager
                this.syncUserToDataManager(userResponse);
                
                // Toggle admin link visibility
                this.toggleAdminLink(userResponse);
                
                return userResponse;
            }
            
        } catch (error) {
            console.error('Login error details:', error);
            this.syncUserToDataManager(null);
            this.toggleAdminLink(null);
            await firebaseAuth.signOut();
            throw error;
        }
    }

    setUser(user) {
        this.user = user;
        console.log('👤 DataManager user set:', user ? user.email : 'null');
        
        if (user) {
            // User is logged in - initialize Firestore
            this.db = firebase.firestore();
            console.log('✅ Firestore initialized for user:', user.email);
        } else {
            // User is logged out
            this.db = null;
            console.log('❌ Firestore disconnected - user logged out');
        }
    }

    static syncUserToDataManager(userData) {
        if (window.DataManager && typeof DataManager.setUser === 'function') {
            console.log('🔄 Syncing user to DataManager:', userData ? userData.email : 'null');
            DataManager.setUser(userData);
        } else {
            console.warn('⚠️ DataManager not available for user sync');
        }
    }

    static onAuthChange(callback) {
        if (!window.firebaseAuth) {
            console.error('Firebase Auth not available for auth state listener');
            return () => {};
    }
    
    // Enhanced auth state listener for page refreshes
    return firebaseAuth.onAuthStateChanged(async (firebaseUser) => {
            console.log('🔄 Firebase auth state changed:', firebaseUser ? `User: ${firebaseUser.uid}` : 'No user');
            
            if (firebaseUser) {
                try {
                    const userDoc = await firebaseDb.collection('users').doc(firebaseUser.uid).get();
                    
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        console.log('📊 User document found:', userData.email);
                        
                        // Enhanced user data with proper refresh handling
                        const enhancedUserData = {
                            id: userDoc.id,
                            uid: firebaseUser.uid,
                            email: userData.email,
                            name: userData.name || userData.email.split('@')[0],
                            role: userData.role,
                            isActive: userData.isActive !== false, // Default to true
                            hasTemporaryPassword: userData.hasTemporaryPassword || false,
                            passwordChanged: userData.passwordChanged || false,
                            requiresPasswordChange: userData.requiresPasswordChange || false,
                            status: userData.status || 'active',
                            loginCount: userData.loginCount || 0,
                            lastLogin: userData.lastLogin,
                            createdAt: userData.createdAt,
                            updatedAt: userData.updatedAt,
                            // Tenant specific fields
                            landlordId: userData.landlordId,
                            roomNumber: userData.roomNumber,
                            // Landlord specific fields
                            properties: userData.properties || []
                        };
                        
                        console.log('✅ Enhanced user data for session:', {
                            email: enhancedUserData.email,
                            role: enhancedUserData.role,
                            requiresPasswordChange: enhancedUserData.requiresPasswordChange
                        });
                        
                        // SYNC TO DATA MANAGER - ADD THIS LINE
                        this.syncUserToDataManager(enhancedUserData);
                        
                        callback(enhancedUserData);
                    } else {
                        console.error('❌ User document not found in Firestore');
                        // SYNC NULL TO DATA MANAGER - ADD THIS LINE
                        this.syncUserToDataManager(null);
                        await this.logout();
                        callback(null);
                    }
                } catch (error) {
                    console.error('❌ Error fetching user data in auth listener:', error);
                    // SYNC NULL TO DATA MANAGER - ADD THIS LINE
                    this.syncUserToDataManager(null);
                    callback(null);
                }
            } else {
                console.log('👤 No Firebase user - calling callback with null');
                // SYNC NULL TO DATA MANAGER - ADD THIS LINE
                this.syncUserToDataManager(null);
                callback(null);
            }
        });
    }


    static async changePassword(currentPassword, newPassword) {
        try {
            const user = firebaseAuth.currentUser;
            if (!user) {
                throw new Error('No user logged in');
            }

            console.log('Changing password for user:', user.email);

            const credential = firebase.auth.EmailAuthProvider.credential(
                user.email, 
                currentPassword
            );
            
            await user.reauthenticateWithCredential(credential);
            console.log('Re-authentication successful');
            
            await user.updatePassword(newPassword);
            console.log('Password updated successfully');
            
            // UPDATE: Store current password in Firestore
            await firebaseDb.collection('users').doc(user.uid).update({
                hasTemporaryPassword: false,
                passwordChanged: true,
                passwordChangedAt: new Date().toISOString(),
                currentPassword: newPassword, // Store the new current password
                lastLogin: new Date().toISOString()
            });
            
            console.log('User record updated in Firestore with current password');
            return true;
            
        } catch (error) {
            console.error('Password change error:', error);
            throw new Error(this.getAuthErrorMessage(error.code) || 'Failed to change password');
        }
    }

    static async createTenantAccount(tenantData, temporaryPassword, landlordPassword) {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('🔐 Creating tenant Firebase Auth account...', tenantData.email);

                const currentUser = firebaseAuth.currentUser;
                if (!currentUser) {
                    reject(new Error('Landlord must be logged in to create tenants'));
                    return;
                }

                // Store landlord info
                const landlordEmail = currentUser.email;
                const landlordId = currentUser.uid;

                // Use the provided landlordPassword directly (no modal needed)
                if (!landlordPassword) {
                    reject(new Error('Landlord password is required'));
                    return;
                }

                // Process tenant creation directly with the provided password
                await this.processTenantCreation(tenantData, temporaryPassword, landlordPassword, null, resolve, reject);

            } catch (error) {
                reject(error);
            }
        });
    }

    static async processTenantCreation(tenantData, temporaryPassword, landlordPassword, modal, resolve, reject) {
        try {
            const errorElement = document.getElementById('passwordConfirmError');
            const submitBtn = document.querySelector('#modalSubmit');

            if (!landlordPassword) {
                this.showPasswordError('Please enter your password');
                return;
            }

            // Show loading state
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
                submitBtn.disabled = true;
            }

            const currentUser = firebaseAuth.currentUser;
            if (!currentUser) {
                throw new Error('Landlord must be logged in to create tenants');
            }

            const landlordEmail = currentUser.email;
            const landlordId = currentUser.uid;

            // Verify landlord password by trying to re-authenticate
            const credential = firebase.auth.EmailAuthProvider.credential(landlordEmail, landlordPassword);
            await currentUser.reauthenticateWithCredential(credential);
            
            console.log('✅ Landlord password verified');

            // Step 1: Create tenant account (this will log out landlord)
            const tenantCredential = await firebaseAuth.createUserWithEmailAndPassword(
                tenantData.email, 
                temporaryPassword
            );
            const tenantUser = tenantCredential.user;
            
            console.log('✅ Tenant Firebase Auth account created:', tenantUser.uid);

            // Step 2: Create tenant document in Firestore - FIXED DATA STRUCTURE
            const userProfile = {
                // Basic Info
                email: tenantData.email,
                name: tenantData.name,
                role: 'tenant',
                
                // Contact Info
                phone: tenantData.phone || '',
                occupation: tenantData.occupation || '',
                age: tenantData.age || 0,
                
                // Landlord Relationship
                landlordId: landlordId,
                createdBy: landlordEmail,
                
                // Property Information
                roomNumber: tenantData.roomNumber || '',
                rentalAddress: tenantData.rentalAddress || 'Lot 22 Zarate Compound Purok 4, Bakakent Norte, Baguio City',
                
                // Authentication & Security
                hasTemporaryPassword: true,
                temporaryPassword: temporaryPassword,
                passwordCreatedAt: new Date().toISOString(),
                
                // Login Tracking
                loginCount: 0,
                passwordChanged: false,
                requiresPasswordChange: true,
                lastLogin: null,
                
                // Timestamps
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                
                // Status
                isActive: true,
                status: 'unverified'
            };

            console.log('📝 Creating tenant profile with data:', userProfile);

            // Remove any undefined fields to prevent Firestore errors
            Object.keys(userProfile).forEach(key => {
                if (userProfile[key] === undefined) {
                    console.log(`⚠️ Removing undefined field: ${key}`);
                    delete userProfile[key];
                }
            });

            await firebaseDb.collection('users').doc(tenantUser.uid).set(userProfile);
            console.log('✅ Tenant profile created in Firestore');

            // Step 3: Immediately restore landlord session
            console.log('🔄 Restoring landlord session...');
            await firebaseAuth.signOut();
            
            // Re-login as landlord - use the SAME password that was verified
            await firebaseAuth.signInWithEmailAndPassword(landlordEmail, landlordPassword);
            
            console.log('✅ Landlord session restored successfully');

            // Close modal and return success
            if (modal) {
                ModalManager.closeModal(modal);
            }
            
            resolve({
                success: true,
                email: tenantData.email,
                name: tenantData.name,
                temporaryPassword: temporaryPassword,
                tenantId: tenantUser.uid,
                note: 'Tenant account created successfully!'
            });

        } catch (error) {
            console.error('Error during tenant creation:', error);
            
            // Reset button
            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = 'Create Tenant Account';
                submitBtn.disabled = false;
            }

            if (error.code === 'auth/wrong-password') {
                this.showPasswordError('Incorrect password. Please try again.');
            } else if (error.code === 'auth/email-already-in-use') {
                this.showPasswordError('This email is already registered. Please use a different email.');
                if (modal) {
                    ModalManager.closeModal(modal);
                }
                reject(new Error('Email already in use'));
            } else {
                this.showPasswordError('Failed to create account: ' + error.message);
                
                // Try to restore landlord session on other errors
                try {
                    const currentUser = firebaseAuth.currentUser;
                    if (currentUser) {
                        await firebaseAuth.signOut();
                    }
                    // Use the original landlord email and the provided password
                    await firebaseAuth.signInWithEmailAndPassword(this.currentUser?.email || 'landlord@example.com', landlordPassword);
                    console.log('✅ Landlord session restored after error');
                } catch (restoreError) {
                    console.error('Failed to restore landlord session:', restoreError);
                }
                
                reject(error);
            }
        }
    }

    static showPasswordError(message) {
        const errorElement = document.getElementById('passwordConfirmError');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    static getAuthErrorMessage(errorCode) {
        const errorMessages = {
            'auth/invalid-email': 'Invalid email address format',
            'auth/user-disabled': 'This account has been disabled',
            'auth/user-not-found': 'No account found with this email',
            'auth/wrong-password': 'Incorrect password',
            'auth/invalid-credential': 'Invalid email or password',
            'auth/too-many-requests': 'Too many failed attempts. Please try again later',
            'auth/network-request-failed': 'Network error. Please check your connection',
            'auth/email-already-in-use': 'An account with this email already exists',
            'auth/weak-password': 'Password should be at least 6 characters',
            'auth/operation-not-allowed': 'Email/password accounts are not enabled',
            'auth/requires-recent-login': 'Please log in again to change your password'
        };
        
        return errorMessages[errorCode] || 'Authentication failed. Please try again.';
    }

    static async logout() {
        try {
            // Hide admin link
            this.toggleAdminLink(null);
            
            // Sync null to DataManager
            this.syncUserToDataManager(null);
            
            if (window.firebaseAuth) {
                await firebaseAuth.signOut();
            }
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

     static async createAdminAccount(adminData) {
        try {
            console.log('🛡️ Creating admin account...', adminData.email);
            
            // Create Firebase Auth account
            const userCredential = await firebaseAuth.createUserWithEmailAndPassword(
                adminData.email,
                adminData.password
            );
            
            const user = userCredential.user;
            
            // Create user document
            const userDoc = {
                email: adminData.email,
                name: adminData.name || 'System Administrator',
                role: 'admin',
                createdAt: new Date().toISOString(),
                isActive: true,
                hasTemporaryPassword: false,
                loginCount: 0,
                passwordChanged: true,
                lastLogin: null,
                isAdmin: true
            };
            
            await firebaseDb.collection('users').doc(user.uid).set(userDoc);
            
            // Create admin_users document
            const adminDoc = {
                email: adminData.email,
                name: adminData.name || 'System Administrator',
                role: 'super_admin',
                created_at: new Date().toISOString(),
                last_login: null,
                is_active: true
            };
            
            await firebaseDb.collection('admin_users').doc(user.uid).set(adminDoc);
            
            console.log('✅ Admin account created successfully:', adminData.email);
            
            // Sign out admin (since we're probably running as landlord)
            await firebaseAuth.signOut();
            
            return {
                success: true,
                email: adminData.email,
                userId: user.uid
            };
            
        } catch (error) {
            console.error('❌ Error creating admin account:', error);
            throw error;
        }
    }
}

window.AuthManager = AuthManager;