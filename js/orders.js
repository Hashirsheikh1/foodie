// Orders Page Logic - High Performance (Fixed)
import { dataStore } from "./dataStore.js";
import { checkAuth } from "./auth-guard.js";
import {
  renderNavbar,
  formatCurrency,
  formatDate,
  escapeHtml,
  chunkRender,
  getCachedElement,
  updateCartBadge
} from "./app.js";

export async function initOrders() {
  try {
    const { user } = await checkAuth("customer");
    renderNavbar(user);
    updateCartBadge();

    const container = getCachedElement("orders-list");
    if (!container) return;

    container.innerHTML = `<div class="text-center" style="padding:40px;"><div class="spinner"></div></div>`;
    
    // Data load from dataStore
    const orders = dataStore.getOrders()
      .filter(o => o.customerId === user.uid)
      .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (orders.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/></svg>
          <h3>No orders yet</h3>
          <p>Place your first order from the menu!</p>
          <a href="/index.html" class="btn btn-primary">Browse Foods</a>
        </div>
      `;
    } else {
      chunkRender(container, orders, (order) => {
        const statusClass = { 
          "Pending": "badge-pending", 
          "Preparing": "badge-preparing", 
          "On the Way": "badge-onway", 
          "Delivered": "badge-delivered",
          "Cancelled": "badge-danger"
        }[order.status] || "badge-pending";
        
        return `
          <div class="order-card">
            <div class="order-card-header">
              <strong>Order #${order.id.slice(-8).toUpperCase()}</strong>
              <span class="badge ${statusClass}">${order.status}</span>
            </div>
            <div class="order-card-items">
              ${order.items.map(i => `${escapeHtml(i.name)} x${i.quantity}`).join(", ")}
            </div>
            <div class="flex-between">
              <span class="order-card-total">${formatCurrency(order.total)}</span>
              <span style="font-size:0.85rem;color:var(--text-secondary)">${formatDate(order.createdAt)}</span>
            </div>
          </div>
        `;
      });
    }

    getCachedElement("loading-overlay")?.classList.add("hidden");
  } catch (e) {
    console.error("Orders list error:", e);
  }
}

document.addEventListener("DOMContentLoaded", initOrders);


