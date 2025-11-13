// config/firebase.js
console.log('🔄 Loading Firebase config...');

const firebaseConfig = {
  apiKey: "AIzaSyC-FvYHTes2lAU3AkMJ6kGIEk4HjioP_HQ",
  authDomain: "casalink-246fd.firebaseapp.com",
  projectId: "casalink-246fd",
  storageBucket: "casalink-246fd.firebasestorage.app",
  messagingSenderId: "1089375490593",
  appId: "1:1089375490593:web:a26cc91e15877b04bb0960",
  measurementId: "G-XMPBG41M2D"
};

// Check if firebase is available
if (typeof firebase === 'undefined') {
  console.error('❌ Firebase SDK not loaded');
} else {
  // Initialize Firebase
  try {
    // Check if Firebase is already initialized
    if (!firebase.apps.length) {
      const app = firebase.initializeApp(firebaseConfig);
      console.log('✅ Firebase app initialized');
    } else {
      console.log('✅ Firebase app already initialized');
    }
    
    const auth = firebase.auth();
    const db = firebase.firestore();
    
    // Set persistence to LOCAL to maintain session across refreshes
    // Use .then() instead of await since we're not in an async function
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .then(() => {
        console.log('✅ Firebase auth persistence set to LOCAL');
      })
      .catch((error) => {
        console.warn('⚠️ Failed to set auth persistence:', error);
      });
    
    // Test Firestore connection
    db.collection('test').doc('connection').get()
      .then(() => console.log('✅ Firestore connection successful'))
      .catch(err => console.warn('⚠️ Firestore connection test failed:', err));
    
    console.log('✅ Firebase services initialized successfully');
    
    // Make available globally
    window.firebaseApp = firebase.app();
    window.firebaseAuth = auth;
    window.firebaseDb = db;
    
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
  }
}