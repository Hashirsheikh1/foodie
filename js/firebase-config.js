import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Your web app's Firebase configuration
// REPLACE THE PLACEHOLDERS BELOW WITH YOUR ACTUAL FIREBASE PROJECT CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDZwOfddmBA6F9vuQrt9TU4Bt1MkYGiSo0",
  authDomain: "food-store-76d5d.firebaseapp.com",
  projectId: "food-store-76d5d",
  storageBucket: "food-store-76d5d.firebasestorage.app",
  messagingSenderId: "418838960462",
  appId: "1:418838960462:web:d1f9951b7ba940429ba61f",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

console.log("Firebase initialized");
