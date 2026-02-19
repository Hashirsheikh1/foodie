// Cart Page - High Performance Reactive Logic (Fixed)
import { dataStore } from "./dataStore.js";
import { checkAuth } from "./auth-guard.js";
import {
  renderNavbar,
  showToast,
  formatCurrency,
  escapeHtml,
  chunkRender,
  getCachedElement,
  updateCartBadge
} from "./app.js";

let currentUser = null;

export async function initCart() {
  try {
    const authData = await checkAuth("customer");
    currentUser = authData.user;
    renderNavbar(currentUser);

    // Subscribe to changes for reactive UI
    dataStore.subscribe((event) => {
      if (event === "cart_change") {
        renderCartUI();
        updateCartBadge();
      }
    });

    setupCartListeners();
    renderCartUI();

    getCachedElement("loading-overlay")?.classList.add("hidden");
  } catch (e) {
    console.error("Cart init error:", e);
    if (e.message !== "Not authenticated") {
      showToast("Error loading cart.", "error");
    }
  }
}

// ============ Rendering ============

function renderCartUI() {
  const container = getCachedElement("cart-items");
  const summaryEl = getCachedElement("cart-summary");
  const emptyEl = getCachedElement("empty-cart");
  const checkoutBtn = getCachedElement("checkout-btn");

  if (!container) return;

  const items = dataStore.getCart(currentUser.uid);

  if (items.length === 0) {
    container.innerHTML = "";
    summaryEl?.classList.add("hidden");
    emptyEl?.classList.remove("hidden");
    checkoutBtn?.classList.add("hidden");
    return;
  }

  emptyEl?.classList.add("hidden");
  summaryEl?.classList.remove("hidden");
  checkoutBtn?.classList.remove("hidden");

  // High Performance Card List
  chunkRender(container, items, (item) => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${escapeHtml(item.name)}</div>
        <div class="cart-item-vendor">${escapeHtml(item.vendorName)}</div>
      </div>
      <div class="cart-qty">
        <button class="qty-btn" data-qty-dec="${item.foodId}" aria-label="Decrease quantity">-</button>
        <span class="qty-display">${item.quantity}</span>
        <button class="qty-btn" data-qty-inc="${item.foodId}" aria-label="Increase quantity">+</button>
      </div>
      <div class="cart-item-price">${formatCurrency(item.price * item.quantity)}</div>
      <button class="btn btn-danger btn-sm" data-remove="${item.foodId}" aria-label="Remove item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
  `);

  updateSummary(items);
}

function updateSummary(items) {
  const subtotal = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const deliveryFee = 2.99;
  
  const subEl = getCachedElement("subtotal");
  const totalEl = getCachedElement("total");
  
  if (subEl) subEl.textContent = formatCurrency(subtotal);
  if (totalEl) totalEl.textContent = formatCurrency(subtotal + deliveryFee);
}

// ============ Handlers ============

function setupCartListeners() {
  const container = getCachedElement("cart-items");
  const checkoutBtn = getCachedElement("checkout-btn");

  if (container) {
    container.onclick = (e) => {
      const dec = e.target.closest("[data-qty-dec]");
      const inc = e.target.closest("[data-qty-inc]");
      const rem = e.target.closest("[data-remove]");

      if (dec) dataStore.updateCartQuantity(currentUser.uid, dec.dataset.qtyDec, -1);
      if (inc) dataStore.updateCartQuantity(currentUser.uid, inc.dataset.qtyInc, 1);
      if (rem) dataStore.removeFromCart(currentUser.uid, rem.dataset.remove);
    };
  }

  if (checkoutBtn) {
    checkoutBtn.onclick = () => placeOrder(checkoutBtn);
  }
}

async function placeOrder(btn) {
  const items = dataStore.getCart(currentUser.uid);
  if (items.length === 0) return;

  btn.disabled = true;
  btn.textContent = "Placing order...";

  try {
    // Group items by vendor (Standard for real backends with per-vendor order management)
    const itemsByVendor = items.reduce((acc, item) => {
      const vid = item.vendorId || "unknown";
      if (!acc[vid]) acc[vid] = [];
      acc[vid].push(item);
      return acc;
    }, {});

    // Create an order for each vendor
    for (const vendorId in itemsByVendor) {
      const vendorItems = itemsByVendor[vendorId];
      const subtotal = vendorItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      
      await dataStore.createOrder({
        customerId: currentUser.uid,
        customerName: currentUser.name,
        vendorId: vendorId,
        items: vendorItems,
        total: subtotal + 2.99 
      });
    }

    showToast("Order placed successfully!", "success");
    setTimeout(() => window.location.href = "/orders.html", 1500);
  } catch (e) {
    console.error("Order error:", e);
    showToast("Order failed. Please try again.", "error");
    btn.disabled = false;
    btn.textContent = "Place Order";
  }
}

document.addEventListener("DOMContentLoaded", initCart);


