export async function fetchProducts({ search, category, sort } = {}, signal) {
  const params = new URLSearchParams();
  if (search?.trim()) params.set("search", search.trim());
  if (category) params.set("category", category);
  if (sort) params.set("sort", sort);

  const response = await fetch(`/api/products?${params}`, { signal });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Unable to load products.");
  return body.products;
}

export async function fetchProduct(id) {
  const response = await fetch(`/api/products/${id}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Unable to load product.");
  return body.product;
}

async function wishlistRequest(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Wishlist request failed.");
  return body;
}

export async function fetchWishlist() {
  return wishlistRequest("/wishlist");
}

export async function addToWishlist(productId) {
  return wishlistRequest(`/wishlist/${productId}`, { method: "POST" });
}

export async function removeFromWishlist(productId) {
  return wishlistRequest(`/wishlist/${productId}`, { method: "DELETE" });
}

async function cartRequest(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Cart request failed.");
  return body;
}

export async function fetchCart() {
  return cartRequest("/cart");
}

export async function addCartProduct(productId) {
  return cartRequest(`/cart/${productId}`, { method: "POST" });
}

export async function updateCartQuantity(productId, quantity) {
  return cartRequest(`/cart/${productId}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
  });
}

export async function removeCartProduct(productId) {
  return cartRequest(`/cart/${productId}`, { method: "DELETE" });
}

async function orderRequest(path, options = {}) {
  const response = await fetch(`/api/orders${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Order request failed.");
  return body;
}

export function createPaymentOrder(shippingAddress) {
  return orderRequest("/create-payment-order", {
    method: "POST",
    body: JSON.stringify({ shippingAddress }),
  });
}

export function verifyPayment(details) {
  return orderRequest("/verify-payment", {
    method: "POST",
    body: JSON.stringify(details),
  });
}

export function fetchOrders() {
  return orderRequest("");
}

export function fetchOrder(id) {
  return orderRequest(`/${encodeURIComponent(id)}`);
}
