// js/auth.js - FIXED VERSION
class AuthManager {
    static currentAuthUnsubscribe = null;
    

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
                
                return {
                    id: user.uid,
                    ...newUserData,
                    uid: user.uid,
                    requiresPasswordChange: true // Require password change on first login
                };
            }
            
        } catch (error) {
            console.error('Login error details:', error);
            await firebaseAuth.signOut();
            throw error;
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
                        
                        callback(enhancedUserData);
                    } else {
                        console.error('❌ User document not found in Firestore');
                        await this.logout();
                        callback(null);
                    }
                } catch (error) {
                    console.error('❌ Error fetching user data in auth listener:', error);
                    callback(null);
                }
            } else {
                console.log('👤 No Firebase user - calling callback with null');
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
            if (window.firebaseAuth) {
                await firebaseAuth.signOut();
            }
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
}

window.AuthManager = AuthManager;