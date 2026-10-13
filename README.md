# ShopKart — Customer Authentication Service

Backend authentication service for the ShopKart engineering lab.

Run locally:

1. Create `backend/.env` from `backend/.env.example` and set `MONGO_URI` and `JWT_SECRET`.

	For MongoDB Atlas, create a database user, add your current IP under
	**Network Access**, and replace `<db_username>` and `<db_password>` in the
	Atlas URI with those credentials. Do not commit `.env` or share the URI.
	The password previously shared in chat should be rotated in Atlas.

2. Install dependencies:

```bash
cd backend
npm install
```

3. Start server:

```bash
npm run dev
```

API Endpoints:

- `POST /customers/register` — register
- `POST /customers/login` — login (sets HttpOnly cookie `token`)
- `GET /customers/me` — get profile (protected)
- `POST /customers/logout` — logout (clears cookie)
- `PATCH /customers/change-password` — change password (protected)

Product discovery endpoints:

- `POST /products` — create a product (open endpoint for this lab)
- `GET /products` — list products; supports `search`, `category`, and `sort`
- `GET /products/:id` — get one product

Run the frontend separately during development:

```bash
cd frontend
npm install
npm run dev
```

The backend runs on port `5001`, and the Vite development server proxies
`/api/*` requests to it. Open the frontend URL printed by Vite (normally
`http://localhost:5173/`). Browser pages such as `/cart` and `/products`
remain available on refresh. The original API paths (including `/cart`) are
also available directly on the backend for Lab 05 API clients.

## Checkout and orders (Lab 06)

Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to `backend/.env` using keys
generated while **Test Mode** is enabled in Razorpay Dashboard. Keep the secret
on the backend only. Restart the backend after adding the keys. Checkout uses
Razorpay Standard Checkout; no real payment credentials are needed for test
payments.

The checkout flow starts at `/cart` → `/checkout`. After a verified test payment,
the app clears the cart, shows the order confirmation at `/orders/:id`, and lists
history at `/orders`. The protected API endpoints are:

- `POST /orders/create-payment-order`
- `POST /orders/verify-payment`
- `GET /orders`
- `GET /orders/:id`

The frontend uses the equivalent `/api/orders/*` paths so page URLs remain
available on refresh. Order amounts and item snapshots are calculated from the
latest product records on the backend. The cart is cleared only after the
payment signature is verified.
