import { auth, db } from "./firebase-config.js";
import { 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  addDoc,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

/**
 * Central Data Store (Firebase Implementation)
 */
class DataStore {
  constructor() {
    this.state = {
      users: [],
      foods: [],
      orders: [],
      carts: {}, // Local cache of current user's cart items
      session: null,
      isInitialized: false
    };

    this.listeners = [];
    this.unsubscribers = {
      users: null,
      foods: null,
      orders: null,
      cart: null
    };

    // Firebase Initialization Promise
    this.initPromise = this._init();
  }

  async _init() {
    return new Promise((resolve) => {
      // 1. Listen for Auth State
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          // Fetch user details from Firestore
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            this.state.session = { uid: user.uid, ...userDoc.data() };
            // Start listening for this user's cart
            this._setupCartListener(user.uid);
          } else {
            console.error("User document not found in Firestore");
            this.state.session = null;
          }
        } else {
          this.state.session = null;
          this._cleanupCartListener();
        }
        
        this.state.isInitialized = true;
        this._notify("session_change");
        resolve();
      });

      // 2. Setup Global Shared Listeners (Real-time snapshots)
      this._setupGlobalListeners();
    });
  }

  _setupGlobalListeners() {
    // Listen for Foods (Everyone sees all foods)
    this.unsubscribers.foods = onSnapshot(collection(db, "foods"), (snapshot) => {
      this.state.foods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this._notify("foods_change");
    });

    // Listen for Users (Everyone sees basic user info for display purposes)
    this.unsubscribers.users = onSnapshot(collection(db, "users"), (snapshot) => {
      this.state.users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      this._notify("users_change");
    });
  }

  _setupCartListener(userId) {
    this._cleanupCartListener();
    this.unsubscribers.cart = onSnapshot(doc(db, "carts", userId), (doc) => {
      if (doc.exists()) {
        const cartData = doc.data();
        this.state.carts[userId] = cartData.items || [];
      } else {
        this.state.carts[userId] = [];
      }
      this._notify("cart_change");
    });

    // Also setup role-specific order listeners
    this._setupOrderListener(userId);
  }

  _setupOrderListener(userId) {
    if (this.unsubscribers.orders) this.unsubscribers.orders();

    const role = this.state.session?.role;
    let ordersQuery;

    if (role === "admin") {
      // Admin sees all
      ordersQuery = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    } else if (role === "vendor") {
      // Vendor sees orders where they are the vendor
      ordersQuery = query(collection(db, "orders"), where("vendorId", "==", userId), orderBy("createdAt", "desc"));
    } else {
      // Customer sees their own orders
      ordersQuery = query(collection(db, "orders"), where("customerId", "==", userId), orderBy("createdAt", "desc"));
    }

    this.unsubscribers.orders = onSnapshot(ordersQuery, (snapshot) => {
      this.state.orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this._notify("orders_change");
    });
  }

  _cleanupCartListener() {
    if (this.unsubscribers.cart) {
      this.unsubscribers.cart();
      this.unsubscribers.cart = null;
    }
    if (this.unsubscribers.orders) {
      this.unsubscribers.orders();
      this.unsubscribers.orders = null;
    }
  }

  _notify(event) {
    this.listeners.forEach(callback => callback(event, this.state));
  }

  // ============ Public API ============

  async waitInit() {
    return this.initPromise;
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  // Session Management
  getCurrentUser() {
    return this.state.session;
  }

  async logout() {
    await signOut(auth);
  }

  // User Management
  getUsers() {
    return this.state.users;
  }

  async saveUser(userData) {
    const { uid, ...data } = userData;
    await setDoc(doc(db, "users", uid), {
        ...data,
        updatedAt: serverTimestamp()
    }, { merge: true });
    return userData;
  }

  // Food Management
  getFoods() {
    return this.state.foods;
  }

  async saveFood(foodData) {
    const { id, ...data } = foodData;
    if (id) {
      await updateDoc(doc(db, "foods", id), data);
      return foodData;
    } else {
      const docRef = await addDoc(collection(db, "foods"), {
        ...data,
        createdAt: serverTimestamp()
      });
      return { id: docRef.id, ...data };
    }
  }

  async deleteFood(id) {
    await deleteDoc(doc(db, "foods", id));
  }

  // Cart Management
  getCart(userId) {
    if (!userId) return [];
    return this.state.carts[userId] || [];
  }

  async addToCart(userId, food) {
    if (!userId) return;
    const currentCart = this.getCart(userId);
    const existingIndex = currentCart.findIndex(item => item.foodId === food.id);
    
    let newItems;
    if (existingIndex !== -1) {
      newItems = [...currentCart];
      newItems[existingIndex].quantity += 1;
    } else {
      newItems = [...currentCart, {
        foodId: food.id,
        name: food.name,
        price: food.price,
        quantity: 1,
        vendorId: food.vendorId,
        vendorName: food.vendorName || "Restaurant"
      }];
    }

    await setDoc(doc(db, "carts", userId), { items: newItems });
  }

  async updateCartQuantity(userId, foodId, delta) {
    if (!userId) return;
    const currentCart = this.getCart(userId);
    const newItems = currentCart.map(item => {
      if (item.foodId === foodId) {
        return { ...item, quantity: Math.max(0, item.quantity + delta) };
      }
      return item;
    }).filter(item => item.quantity > 0);

    await setDoc(doc(db, "carts", userId), { items: newItems });
  }

  async removeFromCart(userId, foodId) {
    if (!userId) return;
    const currentCart = this.getCart(userId);
    const newItems = currentCart.filter(item => item.foodId !== foodId);
    await setDoc(doc(db, "carts", userId), { items: newItems });
  }

  async clearCart(userId) {
    if (!userId) return;
    await setDoc(doc(db, "carts", userId), { items: [] });
  }

  // Order Management
  getOrders() {
    return this.state.orders;
  }

  async createOrder(orderData) {
    const docRef = await addDoc(collection(db, "orders"), {
      ...orderData,
      status: "Pending",
      createdAt: serverTimestamp()
    });
    
    // Auto-clear cart
    if (orderData.customerId) {
        await this.clearCart(orderData.customerId);
    }

    return { id: docRef.id, ...orderData };
  }

  async updateOrderStatus(orderId, status) {
    await updateDoc(doc(db, "orders", orderId), { status });
    return true;
  }

  async deleteOrder(orderId) {
    await deleteDoc(doc(db, "orders", orderId));
  }
}

// Singleton pattern
export const dataStore = new DataStore();
export default dataStore;

