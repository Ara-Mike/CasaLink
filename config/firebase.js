// config/firebase.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyC-FvYHTes2lAU3AkMJ6kGIEk4HjioP_HQ",
  authDomain: "casalink-246fd.firebaseapp.com",
  projectId: "casalink-246fd",
  storageBucket: "casalink-246fd.firebasestorage.app",
  messagingSenderId: "1089375490593",
  appId: "1:1089375490593:web:a26cc91e15877b04bb0960",
  measurementId: "G-XMPBG41M2D"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log('Firebase initialized successfully');

export { auth, db };