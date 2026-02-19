// Admin Dashboard - High Performance (Fixed)
import { dataStore } from "./dataStore.js";
import { checkAuth } from "./auth-guard.js";
import {
  renderNavbar,
  showToast,
  formatCurrency,
  formatDate,
  escapeHtml,
  chunkRender,
  getCachedElement,
  updateCartBadge
} from "./app.js";

let allUsers = [];
let allOrders = [];

export async function initAdminDashboard() {
  try {
    const { user } = await checkAuth("admin");
    renderNavbar(user);
    updateCartBadge();

    setupTabs();
    setupSeedButton();
    setupTableListeners();

    // Data Load
    loadData();

    // Subscribe to changes
    dataStore.subscribe((event) => {
       if (event.includes("_change")) {
          loadData();
       }
    });

    getCachedElement("loading-overlay")?.classList.add("hidden");
  } catch (e) {
    console.error("Admin init error:", e);
  }
}

function loadData() {
  allUsers = dataStore.getUsers();
  allOrders = dataStore.getOrders().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  renderUsersTable();
  renderStats();
}

// ============ Rendering ============

function renderUsersTable() {
  const tbody = getCachedElement("users-table-body");
  if (!tbody) return;

  chunkRender(tbody, allUsers, (user) => {
    const roleClass = { "admin": "badge-admin", "vendor": "badge-vendor", "customer": "badge-customer" }[user.role] || "badge-customer";
    const isVendor = user.role === "vendor";
    const approvalBadge = isVendor ? (user.approved ? '<span class="badge badge-approved">Approved</span>' : '<span class="badge badge-unapproved">Pending</span>') : 'N/A';
    const approvalBtn = isVendor ? (user.approved ? `<button class="btn btn-danger btn-sm" data-revoke="${user.uid}">Revoke</button>` : `<button class="btn btn-success btn-sm" data-approve="${user.uid}">Approve</button>`) : "";

    return `
      <tr>
        <td><strong>${escapeHtml(user.name)}</strong></td>
        <td>${escapeHtml(user.email)}</td>
        <td><span class="badge ${roleClass}">${user.role}</span></td>
        <td>${approvalBadge}</td>
        <td>${formatDate(user.createdAt)}</td>
        <td>${approvalBtn}</td>
      </tr>
    `;
  });
}

function renderOrdersTable() {
  const tbody = getCachedElement("orders-table-body");
  if (!tbody) return;

  chunkRender(tbody, allOrders, (order) => {
    const statusClass = { 
      "Pending": "badge-pending", 
      "Preparing": "badge-preparing", 
      "On the Way": "badge-onway", 
      "Delivered": "badge-delivered",
      "Cancelled": "badge-danger"
    }[order.status] || "badge-pending";
    
    return `
      <tr>
        <td><strong>#${order.id.slice(-8).toUpperCase()}</strong></td>
        <td>${escapeHtml(order.customerName)}</td>
        <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${order.items.map(i => `${escapeHtml(i.name)} x${i.quantity}`).join(", ")}</td>
        <td><strong>${formatCurrency(order.total)}</strong></td>
        <td><span class="badge ${statusClass}">${order.status}</span></td>
        <td>
          <select class="form-select status-select" data-order-id="${order.id}">
            <option value="Pending" ${order.status === "Pending" ? "selected" : ""}>Pending</option>
            <option value="Preparing" ${order.status === "Preparing" ? "selected" : ""}>Preparing</option>
            <option value="On the Way" ${order.status === "On the Way" ? "selected" : ""}>On the Way</option>
            <option value="Delivered" ${order.status === "Delivered" ? "selected" : ""}>Delivered</option>
            <option value="Cancelled" ${order.status === "Cancelled" ? "selected" : ""}>Cancelled</option>
          </select>
          <button class="btn btn-danger btn-sm delete-order-btn" data-delete-order="${order.id}" style="padding: 2px 6px; margin-left: 5px;">&times;</button>
        </td>
      </tr>
    `;
  });
}

function renderStats() {
  const usersEl = getCachedElement("stat-users");
  const vendorsEl = getCachedElement("stat-vendors");
  const ordersEl = getCachedElement("stat-orders");
  const revenueEl = getCachedElement("stat-revenue");

  if (usersEl) usersEl.textContent = allUsers.length;
  if (vendorsEl) vendorsEl.textContent = allUsers.filter(u => u.role === "vendor").length;
  if (ordersEl) ordersEl.textContent = allOrders.length;

  const revenue = allOrders.filter(o => o.status === "Delivered").reduce((sum, o) => sum + (o.total || 0), 0);
  if (revenueEl) revenueEl.textContent = formatCurrency(revenue);
}

// ============ Handlers ============

function setupTableListeners() {
  const usersBody = getCachedElement("users-table-body");
  const ordersBody = getCachedElement("orders-table-body");

  if (usersBody) {
    usersBody.onclick = (e) => {
      const approve = e.target.closest("[data-approve]");
      const revoke = e.target.closest("[data-revoke]");
      if (approve) toggleApproval(approve.dataset.approve, true);
      if (revoke) toggleApproval(revoke.dataset.revoke, false);
    };
  }

  if (ordersBody) {
    ordersBody.onchange = (e) => {
      const select = e.target.closest(".status-select");
      if (select) {
        try {
          dataStore.updateOrderStatus(select.dataset.orderId, select.value);
          showToast("Order status updated.", "success");
        } catch (e) {
          showToast("Update failed.", "error");
        }
      }
    };

    ordersBody.onclick = (e) => {
      const delBtn = e.target.closest("[data-delete-order]");
      if (delBtn) {
        if (confirm("Delete this order?")) {
           dataStore.deleteOrder(delBtn.dataset.deleteOrder);
           showToast("Order deleted.", "success");
        }
      }
    };
  }
}

function toggleApproval(uid, approved) {
  try {
    const user = allUsers.find(u => u.uid === uid);
    if (user) {
      dataStore.saveUser({ ...user, approved });
      showToast("Status updated!", "success");
    }
  } catch (e) {
    showToast("Error updating status.", "error");
  }
}

function setupSeedButton() {
  const btn = getCachedElement("seed-btn");
  if (btn) {
    btn.onclick = () => {
      btn.disabled = true;
      btn.textContent = "Seeding...";
      
      const sampleFoods = [
        { name: "Margherita Pizza", price: 12.99, category: "Pizza", description: "Classic tomato and mozzarella", vendorId: "v1", vendorName: "Pizza Hut", rating: "4.5" },
        { name: "Double Smash Burger", price: 10.50, category: "Burgers", description: "Two beef patties with secret sauce", vendorId: "v2", vendorName: "Burger King", rating: "4.8" },
        { name: "Salmon Sushi Roll", price: 15.00, category: "Sushi", description: "Fresh salmon and avocado", vendorId: "v3", vendorName: "Sushi Zen", rating: "4.7" },
        { name: "Kung Pao Chicken", price: 13.50, category: "Chinese", description: "Spicy chicken with peanuts", vendorId: "v4", vendorName: "China Express", rating: "4.4" }
      ];
      
      sampleFoods.forEach(f => dataStore.saveFood(f));
      
      showToast("Sample foods seeded!", "success");
      btn.disabled = false;
      btn.textContent = "Seed Sample Foods";
    };
  }
}

function setupTabs() {
  const tabs = document.querySelector(".tabs");
  if (!tabs) return;
  tabs.onclick = (e) => {
    const btn = e.target.closest(".tab-btn");
    if (!btn) return;
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.toggle("active", c.id === btn.dataset.tab));
    if (btn.dataset.tab === "orders-tab") renderOrdersTable();
    else renderUsersTable();
  };
}

document.addEventListener("DOMContentLoaded", initAdminDashboard);


