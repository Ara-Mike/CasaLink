// js/auth.js - COMPAT VERSION (NO MODULES)
class AuthManager {
    static async login(email, password, role) {
        try {
            
            if (!window.firebaseAuth) {
                throw new Error('Firebase Auth not initialized');
            }
            
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
                
                // Verify role matches
                if (userData.role && userData.role !== role) {
                    await firebaseAuth.signOut();
                    throw new Error(`This account is registered as a ${userData.role}, not a ${role}`);
                }
                
                return userData;
            } else {
                console.log('User profile not found in Firestore, creating default profile');
                // Create default user profile
                const defaultUserData = {
                    email: user.email,
                    name: user.email.split('@')[0],
                    role: role,
                    avatar: user.email.charAt(0).toUpperCase(),
                    createdAt: new Date().toISOString(),
                    isActive: true
                };
                
                await firebaseDb.collection('users').doc(user.uid).set(defaultUserData);
                
                return { ...defaultUserData, uid: user.uid };
            }
        } catch (error) {
            console.error('Login error details:', {
                code: error.code,
                message: error.message,
                fullError: error
            });
            
            const friendlyMessage = this.getAuthErrorMessage(error.code);
            throw new Error(friendlyMessage);
        }
    }

    static async register(email, password, userData) {
        try {
            if (!window.firebaseAuth) {
                throw new Error('Firebase Auth not initialized');
            }
            
            const userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Create user profile in Firestore
            const userProfile = {
                email: email,
                name: userData.name,
                role: userData.role,
                avatar: userData.avatar,
                createdAt: new Date().toISOString(),
                isActive: true
            };
            
            await firebaseDb.collection('users').doc(user.uid).set(userProfile);
            
            console.log('User registered successfully:', user.uid);
            return { ...userProfile, uid: user.uid };
            
        } catch (error) {
            console.error('Registration error:', error);
            throw new Error(this.getAuthErrorMessage(error.code));
        }
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

    static onAuthChange(callback) {
        if (!window.firebaseAuth) {
            console.error('Firebase Auth not available for auth state listener');
            return () => {}; // Return empty unsubscribe function
        }
        
        return firebaseAuth.onAuthStateChanged(async (user) => {
            console.log('Auth state changed:', user ? `User signed in: ${user.uid}` : 'User signed out');
            
            if (user) {
                try {
                    // User is signed in - get user profile from Firestore
                    const userDoc = await firebaseDb.collection('users').doc(user.uid).get();
                    
                    if (userDoc.exists) {
                        const userData = { 
                            id: userDoc.id,
                            ...userDoc.data(), 
                            uid: user.uid 
                        };
                        console.log('User data loaded:', userData);
                        callback(userData);
                    } else {
                        console.log('User document not found in Firestore for uid:', user.uid);
                        // Create a basic user profile if doesn't exist
                        const basicUserData = {
                            uid: user.uid,
                            email: user.email,
                            name: user.email.split('@')[0], // Default name from email
                            role: 'tenant', // Default role
                            avatar: user.email.charAt(0).toUpperCase(),
                            createdAt: new Date().toISOString()
                        };
                        console.log('Creating basic user profile:', basicUserData);
                        callback(basicUserData);
                    }
                } catch (error) {
                    console.error('Error fetching user data:', error);
                    // Fallback to basic user info from auth
                    const fallbackUserData = {
                        uid: user.uid,
                        email: user.email,
                        name: user.email.split('@')[0],
                        role: 'tenant',
                        avatar: user.email.charAt(0).toUpperCase()
                    };
                    console.log('Using fallback user data:', fallbackUserData);
                    callback(fallbackUserData);
                }
            } else {
                // User is signed out
                callback(null);
            }
        });
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
            'auth/operation-not-allowed': 'Email/password accounts are not enabled'
        };
        
        return errorMessages[errorCode] || 'Authentication failed. Please try again.';
    }
}

// Make available globally
window.AuthManager = AuthManager;
console.log('AuthManager loaded');