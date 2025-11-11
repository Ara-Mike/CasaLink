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
        
        // Simple auth state listener - only for page refreshes
        return firebaseAuth.onAuthStateChanged(async (user) => {
            console.log('🔄 Auth state changed (page refresh/session):', user ? `User found: ${user.uid}` : 'No user');
            
            if (user) {
                try {
                    const userDoc = await firebaseDb.collection('users').doc(user.uid).get();
                    
                    if (userDoc.exists) {
                        const userData = { 
                            id: userDoc.id,
                            ...userDoc.data(), 
                            uid: user.uid 
                        };
                        
                        console.log('Existing session user data:', userData);
                        console.log('📊 Login stats on auth change:', { 
                            loginCount: userData.loginCount, 
                            hasTemporaryPassword: userData.hasTemporaryPassword,
                            passwordChanged: userData.passwordChanged 
                        });
                        
                        // CHECK FOR PASSWORD CHANGE REQUIREMENT
                        let requiresPasswordChange = false;
                        if (userData.role === 'tenant' && userData.hasTemporaryPassword && !userData.passwordChanged) {
                            // Check if this is the FIRST real login (loginCount = 0)
                            if (userData.loginCount === 0) {
                                requiresPasswordChange = true;
                                console.log('🔐 FIRST real tenant login via auth listener - password change REQUIRED');
                            }
                        }
                        
                        callback({
                            ...userData,
                            requiresPasswordChange: requiresPasswordChange
                        });
                    } else {
                        console.log('User document not found in existing session');
                        await this.logout();
                        callback(null);
                    }
                } catch (error) {
                    console.error('Error fetching user data in existing session:', error);
                    callback(null);
                }
            } else {
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

    static async createTenantAccount(tenantData, temporaryPassword) {
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

                // Show password confirmation modal
                const modalContent = `
                    <div class="password-confirm-modal">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <i class="fas fa-shield-alt" style="font-size: 3rem; color: var(--primary-blue); margin-bottom: 15px;"></i>
                            <h3 style="margin-bottom: 10px;">Security Verification</h3>
                            <p>Please confirm your password to create the tenant account.</p>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Your Email</label>
                            <input type="email" id="landlordEmailConfirm" class="form-input" value="${landlordEmail}" readonly disabled>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Your Password *</label>
                            <input type="password" id="landlordPassword" class="form-input" placeholder="Enter your password" autocomplete="current-password">
                        </div>
                        
                        <div id="passwordConfirmError" style="color: var(--danger); margin-bottom: 15px; display: none;"></div>
                        
                        <div class="security-info">
                            <i class="fas fa-info-circle"></i>
                            <small>Your password is required to securely create the tenant account. The temporary password will be stored in the database for reference.</small>
                        </div>
                    </div>
                `;

                // Create modal
                const modal = ModalManager.openModal(modalContent, {
                    title: 'Confirm Your Identity',
                    submitText: 'Create Tenant Account',
                    showFooter: true,
                    onSubmit: async () => {
                        await this.processTenantCreation(tenantData, temporaryPassword, landlordEmail, landlordId, modal, resolve, reject);
                    },
                    onCancel: () => {
                        reject(new Error('Tenant creation cancelled'));
                        ModalManager.closeModal(modal);
                    }
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    static async processTenantCreation(tenantData, temporaryPassword, landlordEmail, landlordId, modal, resolve, reject) {
        try {
            const passwordInput = document.getElementById('landlordPassword');
            const errorElement = document.getElementById('passwordConfirmError');
            const submitBtn = document.querySelector('#modalSubmit');

            const landlordPassword = passwordInput?.value;

            if (!landlordPassword) {
                this.showPasswordError('Please enter your password');
                return;
            }

            // Show loading state
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
                submitBtn.disabled = true;
            }

            // Verify landlord password by trying to re-authenticate
            const credential = firebase.auth.EmailAuthProvider.credential(landlordEmail, landlordPassword);
            await firebaseAuth.currentUser.reauthenticateWithCredential(credential);
            
            console.log('✅ Landlord password verified');

            // Step 1: Create tenant account (this will log out landlord)
            const tenantCredential = await firebaseAuth.createUserWithEmailAndPassword(
                tenantData.email, 
                temporaryPassword
            );
            const tenantUser = tenantCredential.user;
            
            console.log('✅ Tenant Firebase Auth account created:', tenantUser.uid);

            // Step 2: Create tenant document in Firestore WITH temporaryPassword AND LOGIN TRACKING
            const userProfile = {
                email: tenantData.email,
                name: tenantData.name,
                role: 'tenant',
                createdAt: new Date().toISOString(),
                isActive: true,
                hasTemporaryPassword: true,
                temporaryPassword: temporaryPassword, // Store the temporary password
                landlordId: landlordId,
                unitId: tenantData.unitId || '',
                phone: tenantData.phone || '',
                createdBy: landlordEmail,
                passwordCreatedAt: new Date().toISOString(),
                // ADD LOGIN TRACKING FIELDS
                loginCount: 0, // Start at 0 (landlord creation doesn't count as tenant login)
                passwordChanged: false, // Track if password was changed
                lastLogin: null
            };

            await firebaseDb.collection('users').doc(tenantUser.uid).set(userProfile);
            console.log('✅ Tenant profile created in Firestore with loginCount: 0');

            // Step 3: Immediately restore landlord session
            console.log('🔄 Restoring landlord session...');
            await firebaseAuth.signOut();
            
            // Re-login as landlord
            await firebaseAuth.signInWithEmailAndPassword(landlordEmail, landlordPassword);
            
            console.log('✅ Landlord session restored successfully');

            // Close modal and return success
            ModalManager.closeModal(modal);
            
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
                ModalManager.closeModal(modal);
                reject(new Error('Email already in use'));
            } else {
                this.showPasswordError('Failed to create account: ' + error.message);
                
                // Try to restore landlord session on other errors
                try {
                    await firebaseAuth.signOut();
                    await firebaseAuth.signInWithEmailAndPassword(landlordEmail, document.getElementById('landlordPassword')?.value);
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