// Authentication Logic - Firebase (Updated)
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { auth } from "./firebase-config.js";
import { dataStore } from "./dataStore.js";
import { showToast } from "./app.js";

// ============ Login ============

export async function handleLogin(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const user = userCredential.user;

    // After login, we wait for dataStore to sync the session role from Firestore
    await dataStore.waitInit();
    const currentUser = dataStore.getCurrentUser();

    console.log(currentUser);

    if (currentUser) {
      if (currentUser.role === "vendor" && !currentUser.approved) {
        showToast("Your vendor account is pending admin approval.", "info");
      }
      showToast("Login successful!", "success");
      setTimeout(() => {
        window.location.href = "/index.html";
      }, 500);
    } else {
      showToast("User profile not found. Please contact support.", "error");
    }
  } catch (error) {
    console.error("Login error:", error);
    showToast(getAuthErrorMessage(error.code), "error");
  }
}

// ============ Register ============

export async function handleRegister(name, email, password, role) {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const user = userCredential.user;

    // Create user profile in Firestore via dataStore
    const userData = {
      uid: user.uid,
      name,
      email,
      role,
      approved: role === "customer", // Vendors need approval
      createdAt: new Date().toISOString(),
    };

    await dataStore.saveUser(userData);

    // Wait for the auth listener in dataStore to fire and update session
    await dataStore.waitInit();

    showToast("Account created successfully!", "success");

    if (role === "vendor") {
      showToast("Your vendor account is pending admin approval.", "info");
    }

    setTimeout(() => {
      window.location.href = "/index.html";
    }, 800);
  } catch (error) {
    console.error("Registration error:", error);
    showToast(getAuthErrorMessage(error.code), "error");
  }
}

// ============ Auth Error Messages ============

export function getAuthErrorMessage(code) {
  switch (code) {
    case "auth/email-already-in-use":
      return "This email is already registered.";
    case "auth/invalid-email":
      return "The email address is not valid.";
    case "auth/operation-not-allowed":
      return "Registration is currently disabled.";
    case "auth/weak-password":
      return "The password is too weak. Use at least 6 characters.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Invalid email or password.";
    default:
      return "An authentication error occurred. Please try again.";
  }
}

// ============ Redirect if already logged in ============

export async function redirectIfLoggedIn() {
  await dataStore.waitInit();
  const user = dataStore.getCurrentUser();
  if (user) {
    window.location.href = "/index.html";
  }
}
