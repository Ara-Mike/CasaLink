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
            
            // Get user profile from Firestore
            const userDoc = await firebaseDb.collection('users').doc(user.uid).get();
            
            if (userDoc.exists) {
                const userData = { 
                    id: userDoc.id,
                    ...userDoc.data(), 
                    uid: user.uid 
                };
                console.log('User profile found:', userData);
                
                // STRICT ROLE VERIFICATION
                if (userData.role !== role) {
                    console.log(`❌ Role mismatch: User is ${userData.role}, but ${role} was selected`);
                    await firebaseAuth.signOut();
                    throw new Error(`This account is registered as a ${userData.role}. Please select "${userData.role}" when logging in.`);
                }
                
                // Check if this is tenant's first login
                if (userData.role === 'tenant' && userData.hasTemporaryPassword) {
                    console.log('Tenant has temporary password, requiring password change');
                    userData.requiresPasswordChange = true;
                    userData.temporaryPassword = password;
                }
                
                return userData;
            } else {
                console.log('User profile not found in Firestore');
                await firebaseAuth.signOut();
                throw new Error('User account not found. Please contact your landlord.');
            }
        } catch (error) {
            console.error('Login error details:', error);
            // Always sign out on error
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
                        callback(userData);
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

    static disableAuthListener() {
        this.authListenerEnabled = false;
        console.log('Auth listener disabled');
    }

    static enableAuthListener() {
        this.authListenerEnabled = true;
        console.log('Auth listener enabled');
    }

    static async forceSignOut() {
        try {
            if (window.firebaseAuth) {
                await firebaseAuth.signOut();
            }
            this.loginInProgress = false;
            this.authListenerEnabled = true;
        } catch (error) {
            console.error('Force sign out error:', error);
        }
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
            
            await firebaseDb.collection('users').doc(user.uid).update({
                hasTemporaryPassword: false,
                passwordChangedAt: new Date().toISOString(),
                lastLogin: new Date().toISOString()
            });
            
            console.log('User record updated in Firestore');
            return true;
            
        } catch (error) {
            console.error('Password change error:', error);
            throw new Error(this.getAuthErrorMessage(error.code) || 'Failed to change password');
        }
    }

    static async createTenantAccount(tenantData, temporaryPassword) {
        try {
            if (!window.firebaseAuth) {
                throw new Error('Firebase Auth not initialized');
            }

            console.log('Creating tenant account (temporary solution):', tenantData.email);

            // Store the current user before creating new account
            const currentUser = firebaseAuth.currentUser;
            const currentUserIdToken = await currentUser.getIdToken();
            
            if (!currentUser) {
                throw new Error('User must be logged in to create tenants');
            }

            // Create the new tenant account (this will sign out current user temporarily)
            const userCredential = await firebaseAuth.createUserWithEmailAndPassword(
                tenantData.email, 
                temporaryPassword
            );
            const newUser = userCredential.user;

            console.log('New tenant auth account created:', newUser.uid);

            // Create user profile in Firestore
            const userProfile = {
                email: tenantData.email,
                name: tenantData.name,
                role: 'tenant',
                createdAt: new Date().toISOString(),
                isActive: true,
                hasTemporaryPassword: true,
                landlordId: tenantData.landlordId,
                unitId: tenantData.unitId || null,
                phone: tenantData.phone || '',
                emergencyContact: tenantData.emergencyContact || {}
            };

            await firebaseDb.collection('users').doc(newUser.uid).set(userProfile);
            console.log('Tenant profile created in Firestore');

            // CRITICAL: Sign out the new tenant immediately
            await firebaseAuth.signOut();
            console.log('Signed out new tenant');

            // Re-authenticate as the original landlord using the stored token
            // This is a workaround - in production, use Cloud Functions
            try {
                // Method 1: Try to use the stored token (may not work in all cases)
                console.log('Attempting to restore landlord session...');
                
                // For now, we'll show a message and redirect to login
                // The landlord will need to log in again, but at least the tenant is created
                console.log('Tenant created successfully. Landlord needs to log in again.');
                
                return { 
                    ...userProfile, 
                    uid: newUser.uid,
                    temporaryPassword: temporaryPassword,
                    note: 'Tenant created successfully. Please log in again as landlord.'
                };
                
            } catch (reauthError) {
                console.error('Could not automatically re-authenticate landlord:', reauthError);
                
                // Still return success, but inform user they need to log in again
                return { 
                    ...userProfile, 
                    uid: newUser.uid,
                    temporaryPassword: temporaryPassword,
                    note: 'Tenant created. Please log in again as landlord.'
                };
            }

        } catch (error) {
            console.error('Create tenant account error:', error);
            
            // Try to re-authenticate as original user if possible
            try {
                await firebaseAuth.signOut();
            } catch (signOutError) {
                console.log('Sign out during error cleanup:', signOutError);
            }
            
            throw new Error(this.getAuthErrorMessage(error.code) || 'Failed to create tenant account');
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