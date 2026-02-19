// Auth Guard - Protects pages based on user role (Firebase Updated)
import { dataStore } from "./dataStore.js";

/**
 * Checks authentication and role authorization.
 * @param {string} requiredRole - "customer" | "vendor" | "admin" | null (any logged-in user)
 * @returns {Promise<{user: object, userData: object}>} - User and user data
 */
export async function checkAuth(requiredRole) {
  await dataStore.waitInit();
  const user = dataStore.getCurrentUser();

  if (!user) {
    if (window.location.pathname !== "/login.html") {
      window.location.href = "/login.html";
    }
    throw new Error("Not authenticated");
  }

  // Check role if required
  if (requiredRole && user.role !== requiredRole) {
    redirectByRole(user.role);
    throw new Error("Unauthorized role");
  }

  // Hide loading overlay
  const overlay = document.getElementById("loading-overlay");
  if (overlay) overlay.classList.add("hidden");

  return { user, userData: user };
}

/**
 * Checks if a user is logged in (for public pages like index.html).
 * @returns {Promise<{user: object|null, userData: object|null}>}
 */
export async function checkAuthOptional() {
  await dataStore.waitInit();
  const user = dataStore.getCurrentUser();
  if (!user) {
    return { user: null, userData: null };
  }
  return { user, userData: user };
}

export function redirectByRole(role) {
  const currentPath = window.location.pathname;
  let targetPath = "/index.html";

  switch (role) {
    case "admin":
      targetPath = "/admin.html";
      break;
    case "vendor":
      targetPath = "/vendor.html";
      break;
    case "customer":
      targetPath = "/customer.html";
      break;
    default:
      targetPath = "/index.html";
      break;
  }

  if (currentPath !== targetPath && !currentPath.endsWith(targetPath)) {
    window.location.href = targetPath;
  }
}


