// Vendor Dashboard Logic (Fixed)
import { dataStore } from "./dataStore.js";
import { checkAuth } from "./auth-guard.js";
import {
  renderNavbar,
  showToast,
  formatCurrency,
  formatDate,
  SAMPLE_CATEGORIES,
  escapeHtml,
  updateCartBadge
} from "./app.js";

let currentUser = null;
let myFoods = [];
let myOrders = [];

// ============ Init ============

export async function initVendorDashboard() {
  try {
    const { user } = await checkAuth("vendor");
    currentUser = user;
    renderNavbar(user);
    updateCartBadge();

    // Check approval status
    if (!user.approved) {
      showPendingState();
      return;
    }

    setupTabs();
    setupFoodForm();
    loadMyFoods();
    loadVendorOrders(); 
    renderStats();

    // Subscribe to changes
    dataStore.subscribe((event) => {
      if (event === "foods_change") loadMyFoods();
      if (event === "orders_change") loadVendorOrders();
    });

    const overlay = document.getElementById("loading-overlay");
    if (overlay) overlay.classList.add("hidden");
  } catch (e) {
    console.error("Vendor init error:", e);
  }
}

// ============ Pending State ============

function showPendingState() {
  const content = document.getElementById("vendor-content");
  if (!content) return;

  content.innerHTML = `
    <div class="pending-banner">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#92400E" stroke-width="2" style="margin:0 auto 12px;display:block;">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <h2>Account Pending Approval</h2>
      <p>Your vendor account is waiting for admin approval. You will be able to manage your foods and orders once approved.</p>
      <p style="margin-top:12px; font-size:0.85rem;">Please check back later or contact the administrator.</p>
    </div>
  `;
  const overlay = document.getElementById("loading-overlay");
  if (overlay) overlay.classList.add("hidden");
}

// ============ My Foods ============

function loadMyFoods() {
  try {
    const allFoods = dataStore.getFoods();
    myFoods = allFoods.filter(f => f.vendorId === currentUser.uid);
    renderMyFoods();
    renderStats();
  } catch (e) {
    console.error("Load foods error:", e);
    showToast("Failed to load your foods.", "error");
  }
}

function renderMyFoods() {
  const grid = document.getElementById("my-foods-grid");
  const empty = document.getElementById("empty-foods");
  if (!grid) return;

  if (myFoods.length === 0) {
    grid.innerHTML = "";
    if (empty) empty.classList.remove("hidden");
    return;
  }

  if (empty) empty.classList.add("hidden");

  grid.innerHTML = myFoods
    .map(
      (food) => `
    <div class="card">
      <div class="card-body">
        <div class="flex-between mb-8">
          <div class="card-title">${escapeHtml(food.name)}</div>
          <span class="badge badge-pending">${food.category}</span>
        </div>
        <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:8px;">${escapeHtml(food.description)}</p>
        <div class="card-price mb-16">${formatCurrency(food.price)}</div>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" data-edit="${food.id}">Edit</button>
          <button class="btn btn-danger btn-sm" data-delete="${food.id}">Delete</button>
        </div>
      </div>
    </div>
  `,
    )
    .join("");

  // Attach handlers
  grid.onclick = (e) => {
    const delBtn = e.target.closest("[data-delete]");
    const editBtn = e.target.closest("[data-edit]");
    if (delBtn) deleteFood(delBtn.dataset.delete);
    if (editBtn) editFood(editBtn.dataset.edit);
  };
}

// ============ Add/Edit Food ============

function setupFoodForm() {
  const form = document.getElementById("food-form");
  if (!form) return;

  const categorySelect = document.getElementById("food-category");
  if (categorySelect) {
    categorySelect.innerHTML = SAMPLE_CATEGORIES.map(
      (c) => `<option value="${c}">${c}</option>`,
    ).join("");
  }

  form.onsubmit = (e) => {
    e.preventDefault();

    const name = document.getElementById("food-name").value.trim();
    const description = document.getElementById("food-desc").value.trim();
    const price = parseFloat(document.getElementById("food-price").value);
    const category = document.getElementById("food-category").value;
    const editId = form.dataset.editId;

    if (!name || !description || isNaN(price) || price <= 0) {
      showToast("Please fill all fields with valid values.", "error");
      return;
    }

    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    submitBtn.textContent = editId ? "Updating..." : "Adding...";

    try {
      const foodData = {
        id: editId || undefined,
        vendorId: currentUser.uid,
        vendorName: currentUser.name,
        name,
        description,
        price,
        category,
        rating: editId ? undefined : (Math.random() * 1.5 + 3.5).toFixed(1)
      };

      dataStore.saveFood(foodData);
      showToast(editId ? "Food updated!" : "Food added!", "success");
      
      form.reset();
      form.dataset.editId = "";
      submitBtn.textContent = "Add Food";
    } catch (e) {
      console.error("Save food error:", e);
      showToast("Failed to save food.", "error");
    } finally {
      submitBtn.disabled = false;
    }
  };
}

function editFood(foodId) {
  const food = myFoods.find((f) => f.id === foodId);
  if (!food) return;

  document.getElementById("food-name").value = food.name;
  document.getElementById("food-desc").value = food.description;
  document.getElementById("food-price").value = food.price;
  document.getElementById("food-category").value = food.category;

  const form = document.getElementById("food-form");
  form.dataset.editId = foodId;

  const submitBtn = form.querySelector("button[type=submit]");
  submitBtn.textContent = "Update Food";

  // Switch to foods tab
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === "foods-tab"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.toggle("active", c.id === "foods-tab"));

  showToast("Editing food - update the form and click Update.", "info");
}

function deleteFood(foodId) {
  if (!confirm("Are you sure you want to delete this food item?")) return;
  try {
    dataStore.deleteFood(foodId);
    showToast("Food deleted.", "success");
  } catch (e) {
    showToast("Failed to delete food.", "error");
  }
}

// ============ Orders ============

function loadVendorOrders() {
  const container = document.getElementById("vendor-orders");
  if (!container) return;

  try {
    myOrders = dataStore.getOrders().filter(
      (order) => order.items && order.items.some((item) => item.vendorId === currentUser.uid)
    ).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (myOrders.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <h3>No orders yet</h3>
          <p>Orders containing your foods will appear here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Status</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${myOrders
              .map((order) => {
                const vendorItems = order.items.filter((i) => i.vendorId === currentUser.uid);
                const statusClass = {
                  Pending: "badge-pending",
                  Preparing: "badge-preparing",
                  "On the Way": "badge-onway",
                  Delivered: "badge-delivered",
                  Cancelled: "badge-danger"
                }[order.status] || "badge-pending";

                return `
                <tr>
                  <td><strong>#${order.id.slice(-8).toUpperCase()}</strong></td>
                  <td>${escapeHtml(order.customerName)}</td>
                  <td>${vendorItems.map((i) => `${escapeHtml(i.name)} x${i.quantity}`).join(", ")}</td>
                  <td><span class="badge ${statusClass}">${order.status}</span></td>
                  <td>${formatDate(order.createdAt)}</td>
                  <td>
                    <select class="form-select status-select" data-order-id="${order.id}">
                      <option value="Pending" ${order.status === "Pending" ? "selected" : ""}>Pending</option>
                      <option value="Preparing" ${order.status === "Preparing" ? "selected" : ""}>Preparing</option>
                      <option value="On the Way" ${order.status === "On the Way" ? "selected" : ""}>On the Way</option>
                      <option value="Delivered" ${order.status === "Delivered" ? "selected" : ""}>Delivered</option>
                      <option value="Cancelled" ${order.status === "Cancelled" ? "selected" : ""}>Cancelled</option>
                    </select>
                  </td>
                </tr>
              `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    // Attach status change handlers
    container.querySelectorAll(".status-select").forEach((select) => {
      select.onchange = () => {
        try {
          dataStore.updateOrderStatus(select.dataset.orderId, select.value);
          showToast("Order status updated.", "success");
        } catch (e) {
          showToast("Failed to update status.", "error");
        }
      };
    });
  } catch (e) {
    console.error("Load orders error:", e);
    container.innerHTML = '<div class="alert alert-error">Failed to load orders.</div>';
  }
}

// ============ Stats ============

function renderStats() {
  const foodsEl = document.getElementById("stat-foods");
  const ordersEl = document.getElementById("stat-orders");
  const revenueEl = document.getElementById("stat-revenue");
  
  if (foodsEl) foodsEl.textContent = myFoods.length;
  if (ordersEl) ordersEl.textContent = myOrders.length;

  const revenue = myOrders
    .filter((o) => o.status === "Delivered")
    .reduce((sum, o) => {
      const vendorTotal = o.items
        .filter(i => i.vendorId === currentUser.uid)
        .reduce((s, i) => s + (i.price * i.quantity), 0);
      return sum + vendorTotal;
    }, 0);
    
  if (revenueEl) revenueEl.textContent = formatCurrency(revenue);
}

// ============ Tabs ============

function setupTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach((btn) => {
    btn.onclick = () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add("active");

      if (btn.dataset.tab === "orders-tab") {
        loadVendorOrders();
      }
    };
  });
}

document.addEventListener("DOMContentLoaded", initVendorDashboard);


