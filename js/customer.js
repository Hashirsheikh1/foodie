// Customer Dashboard - High Performance
import { dataStore } from "./dataStore.js";
import { checkAuth } from "./auth-guard.js";
import {
  renderNavbar,
  showToast,
  formatCurrency,
  formatDate,
  SAMPLE_CATEGORIES,
  escapeHtml,
  debounce,
  chunkRender,
  getCachedElement,
  updateCartBadge
} from "./app.js";

let currentUser = null;
let allFoods = [];
let activeCategory = "All";

export async function initCustomerDashboard() {
  try {
    const { user, userData } = await checkAuth("customer");
    currentUser = user;
    renderNavbar(userData);
    updateCartBadge();

    // Initial Setup
    setupCategories();
    setupSearch();
    setupTabs();
    setupGridListeners();

    // Data Load
    allFoods = dataStore.getFoods();
    renderFoodGrid();
    
    // Subscribe to changes
    dataStore.subscribe((event) => {
      if (event === "foods_change") {
        allFoods = dataStore.getFoods();
        renderFoodGrid();
      }
      if (event === "cart_change") {
        updateCartBadge();
      }
    });

    getCachedElement("loading-overlay")?.classList.add("hidden");
  } catch (e) {
    console.error("Init error:", e);
  }
}

// ============ Rendering ============

function renderFoodGrid() {
  const grid = getCachedElement("food-grid");
  const empty = getCachedElement("empty-foods");
  if (!grid) return;

  const searchTerm = getCachedElement("search-input")?.value.toLowerCase() || "";

  const filtered = allFoods.filter(f => {
    const matchesCat = activeCategory === "All" || f.category === activeCategory;
    const matchesQuery = !searchTerm || f.name.toLowerCase().includes(searchTerm) || f.description.toLowerCase().includes(searchTerm);
    return matchesCat && matchesQuery;
  });

  if (filtered.length === 0) {
    grid.innerHTML = "";
    empty?.classList.remove("hidden");
    return;
  }

  empty?.classList.add("hidden");
  
  chunkRender(grid, filtered, (food) => {
    const icons = { "Pizza": "&#127829;", "Burgers": "&#127828;", "Sushi": "&#127843;", "Chinese": "&#129379;", "Indian": "&#127835;", "Desserts": "&#127856;", "Drinks": "&#129380;", "Healthy": "&#129367;" };
    const icon = icons[food.category] || "&#127860;";

    return `
      <div class="card" data-food-id="${food.id}">
        <div class="card-img" style="display:flex;align-items:center;justify-content:center;font-size:3rem;" loading="lazy">
          ${icon}
        </div>
        <div class="card-body">
          <div class="card-title">${escapeHtml(food.name)}</div>
          <div class="card-subtitle">${escapeHtml(food.vendorName || "Restaurant")}</div>
          <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:10px;">${escapeHtml(food.description)}</p>
          <div class="card-footer">
            <span class="card-price">${formatCurrency(food.price)}</span>
            <span class="card-rating">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              ${food.rating || "4.0"}
            </span>
          </div>
          <button class="btn btn-primary btn-sm" style="width:100%; margin-top:12px;" data-add-cart="${food.id}">
            Add to Cart
          </button>
        </div>
      </div>
    `;
  });
}

// ============ Event Listeners ============

function setupCategories() {
  const container = getCachedElement("categories");
  if (!container) return;

  const cats = ["All", ...SAMPLE_CATEGORIES];
  container.innerHTML = cats.map(cat =>
    `<button class="category-pill ${cat === activeCategory ? 'active' : ''}" data-category="${cat}">${cat}</button>`
  ).join("");

  container.addEventListener("click", (e) => {
    const pill = e.target.closest(".category-pill");
    if (!pill) return;
    activeCategory = pill.dataset.category;
    container.querySelectorAll(".category-pill").forEach(p => p.classList.toggle("active", p === pill));
    renderFoodGrid();
  });
}

function setupSearch() {
  const input = getCachedElement("search-input");
  if (input) {
    input.oninput = debounce(() => renderFoodGrid(), 300);
  }
}

function setupGridListeners() {
  const grid = getCachedElement("food-grid");
  if (!grid) return;

  grid.onclick = (e) => {
    const btn = e.target.closest("[data-add-cart]");
    if (btn) {
      const foodId = btn.dataset.addCart;
      const food = allFoods.find(f => f.id === foodId);
      if (food) {
        addToCart(food, btn);
      }
    }
  };
}

function addToCart(food, btn) {
  btn.style.transform = "scale(0.95)";
  setTimeout(() => btn.style.transform = "", 100);

  try {
    dataStore.addToCart(currentUser.uid, food);
    showToast("Added to cart!", "success");
  } catch (e) {
    showToast("Failed to add to cart.", "error");
  }
}

// ============ Tabs & Orders ============

async function loadOrders() {
  const container = getCachedElement("orders-list");
  if (!container) return;

  container.innerHTML = `<div class="text-center" style="padding:40px;"><div class="spinner"></div></div>`;
  
  try {
    const orders = dataStore.getOrders().filter(o => o.customerId === currentUser.uid).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    if (orders.length === 0) {
      container.innerHTML = `<div class="empty-state"><h3>No orders yet</h3></div>`;
      return;
    }

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
  } catch (e) {
    container.innerHTML = `<div class="alert alert-error">Failed to load orders.</div>`;
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

    if (btn.dataset.tab === "orders-tab") loadOrders();
  };
}

document.addEventListener("DOMContentLoaded", initCustomerDashboard);

