// Shared Utilities - Optimized (Fixed)
import { dataStore } from "./dataStore.js";

// ============ DOM Cache ============
const domCache = new Map();

export function getCachedElement(id) {
  if (domCache.has(id)) return domCache.get(id);
  const el = document.getElementById(id);
  if (el) domCache.set(id, el);
  return el;
}

// ============ Navbar ============

export function renderNavbar(userData) {
  const nav = getCachedElement("navbar");
  if (!nav) return;

  const isLoggedIn = !!userData;
  const role = userData?.role;
  
  // Get cart count for the current user
  const cartItems = isLoggedIn ? dataStore.getCart(userData.uid) : [];
  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  
  const stateKey = `${isLoggedIn}-${role}-${cartCount}`;
  if (nav.dataset.state === stateKey) return;
  nav.dataset.state = stateKey;

  let links = `<a href="/index.html">Home</a>`;
  
  if (!isLoggedIn) {
    links += `
      <a href="/login.html" class="btn-primary-nav">Login</a>
      <a href="/register.html">Register</a>
    `;
  } else {
    if (role === "customer") {
      links += `
        <a href="/cart.html" class="nav-cart">
          Cart
          <span class="cart-badge" id="cart-badge">${cartCount}</span>
        </a>
        <a href="/orders.html">My Orders</a>
        <a href="/customer.html">Dashboard</a>
      `;
    } else if (role === "vendor") {
      links += `<a href="/vendor.html">Dashboard</a>`;
    } else if (role === "admin") {
      links += `<a href="/admin.html">Dashboard</a>`;
    }
    links += `<button id="logout-btn" class="nav-logout">Logout</button>`;
  }

  nav.innerHTML = `
    <div class="navbar-inner">
      <a href="/index.html" class="navbar-logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C6.48 2 2 6 2 10.5c0 2.5 1 4.5 3 6v5.5l3.5-2C9.63 20.5 10.8 21 12 21c5.52 0 10-4 10-8.5S17.52 2 12 2z"/><circle cx="8.5" cy="10.5" r="1"/><circle cx="12" cy="10.5" r="1"/><circle cx="15.5" cy="10.5" r="1"/></svg>
        QuickBite
      </a>
      <button class="navbar-hamburger" id="nav-toggle" aria-label="Toggle menu"><span></span><span></span><span></span></button>
      <div class="navbar-links" id="nav-links">${links}</div>
    </div>
  `;

  // Delegate click
  nav.onclick = (e) => {
    if (e.target.id === "logout-btn") window._logout();
    if (e.target.closest("#nav-toggle")) {
      const linksEl = getCachedElement("nav-links");
      if (linksEl) linksEl.classList.toggle("open");
    }
  };
}

export async function updateCartBadge() {
  const badge = document.getElementById("cart-badge");
  if (!badge) return;

  await dataStore.waitInit();
  const user = dataStore.getCurrentUser();
  if (!user) {
    badge.style.display = "none";
    return;
  }

  const items = dataStore.getCart(user.uid);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  badge.textContent = count;
  badge.style.display = count > 0 ? "flex" : "none";
}

window._logout = async function () {
  await dataStore.logout();
  window.location.href = "/index.html";
};

// ============ Toast ============

let toastContainer = null;
export function showToast(message, type = "info") {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("removing");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, 3000);
}

// ============ Rendering ============

export function chunkRender(container, items, templateFn, chunkSize = 15) {
  if (!container) return;
  container.innerHTML = "";
  if (!items || items.length === 0) return;

  let index = 0;
  function renderStep() {
    const fragment = document.createDocumentFragment();
    const end = Math.min(index + chunkSize, items.length);
    for (let i = index; i < end; i++) {
      const temp = document.createElement("div");
      temp.innerHTML = templateFn(items[i]).trim();
      fragment.appendChild(temp.firstElementChild);
    }
    container.appendChild(fragment);
    index = end;
    if (index < items.length) requestAnimationFrame(renderStep);
  }
  requestAnimationFrame(renderStep);
}

export function renderToContainer(container, html) {
  if (container) container.innerHTML = html;
}

// ============ Utils ============

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export function formatDate(dateString) {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function escapeHtml(text) {
  if (!text) return "";
  const chars = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(text).replace(/[&<>"']/g, m => chars[m]);
}

export function debounce(func, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export const SAMPLE_CATEGORIES = ["Pizza", "Burgers", "Sushi", "Chinese", "Indian", "Desserts", "Drinks", "Healthy"];


