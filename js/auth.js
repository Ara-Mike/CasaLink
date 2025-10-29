// js/auth.js
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { auth, db } from '../config/firebase.js';

class AuthManager {
    constructor() {
        this.init();
    }

    async init() {
        await this.setupAuthListener();
        // rest of your initialization
    }


    static async login(email, password, role) {
    try {
        console.log('Attempting login with:', { email, role });
        
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        console.log('Firebase auth success, user:', user.uid);
        
        // Get user profile from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (userDoc.exists()) {
            const userData = { ...userDoc.data(), uid: user.uid };
            console.log('User profile found:', userData);
            
            // Verify role matches
            if (userData.role !== role) {
                await signOut(auth);
                throw new Error(`This account is registered as a ${userData.role}, not a ${role}`);
            }
            
            return userData;
        } else {
            console.log('User profile not found in Firestore');
            throw new Error('User profile not found. Please contact support.');
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

    setupAuthListener() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    window.dispatchEvent(new CustomEvent('authStateChange', {
                        detail: { ...userDoc.data(), uid: user.uid }
                    }));
                } else {
                    // User document doesn't exist
                    window.dispatchEvent(new CustomEvent('authStateChange', {
                        detail: null
                    }));
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
                window.dispatchEvent(new CustomEvent('authStateChange', {
                    detail: null
                }));
            }
        } else {
            // User is signed out
            window.dispatchEvent(new CustomEvent('authStateChange', {
                detail: null
            }));
        }
    });
}

    static async register(email, password, userData) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Create user profile in Firestore
            await setDoc(doc(db, 'users', user.uid), {
                email: email,
                name: userData.name,
                role: userData.role,
                avatar: userData.avatar,
                createdAt: new Date().toISOString(),
                isActive: true
            });
            
            return { ...userData, uid: user.uid };
        } catch (error) {
            throw new Error(this.getAuthErrorMessage(error.code));
        }
    }

    static async logout() {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    static onAuthChange(callback) {
        return onAuthStateChanged(auth, async (user) => {
            if (user) {
                // User is signed in
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    callback({ ...userDoc.data(), uid: user.uid });
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

export default AuthManager;
window.AuthManager = AuthManager;