# Deploy ShopKart on Vercel

This guide deploys the React frontend and Express API as **one Vercel project**, with MongoDB Atlas as the database. Browser requests stay on the same HTTPS origin, so the current cookie authentication works without introducing a separate API domain or CORS configuration.

## Current deployment — 15 October 2026

**[Open ShopKart](https://shopkart-mu-lime.vercel.app)** · [API health](https://shopkart-mu-lime.vercel.app/api/health)

The application is deployed to the `shopkart` project in the `raghav-shell` Vercel account. The frontend and API share one HTTPS origin; credentials are configured as server-side environment variables.

| Verification | Result |
| --- | --- |
| Preview and production builds | Passed |
| Frontend routes and static assets | Passed |
| Hosted Atlas connectivity and catalog | Passed |
| Registration, login, secure cookies, and logout | Passed |
| Product search and details | Passed |
| Wishlist and cart persistence | Passed |
| Checkout and order history | Passed |
| Completed Razorpay test payment | Order confirmed as `PAID` / `PLACED`; cart cleared |
| Inspected browser console and runtime error logs | No errors observed during verification |

These checks used a dedicated test customer. Payments remain in **Test Mode**.

The release was deployed through Vercel CLI. Automatic deployment on GitHub pushes requires connecting the repository through Vercel's Git integration; the CLI deployment does not enable that integration by itself.

## Database diagnosis — 15 October 2026

The existing Atlas database was checked without changing its application data:

| Check | Result |
| --- | --- |
| Normal SRV lookup from the local environment | Failed with timeout / bad DNS response |
| SRV lookup through Google and Cloudflare DNS over HTTPS | Both returned the cluster's three nodes |
| Existing credentials with the standard, TLS-enabled Atlas URI | Connected successfully |
| Database ping | Successful |
| Database name | `shopkart` |
| Replica set / checkout transaction topology | Supported |

**Finding:** the reproduced failure was in SRV DNS resolution from the local environment. The successful authenticated connection establishes that the database and current credentials work from this machine through the standard connection format. It does not prove that Vercel's outbound addresses are allowed in Atlas.

The ignored `backend/.env` on the development machine was updated to the standard connection URI after a successful ping. The credentials, target database, and TLS requirement were preserved. No cluster settings or application records were changed. This private local edit is not part of GitHub and will not automatically appear on Vercel.

The previous `.env.example` also contained a different cluster hostname. It now uses a neutral placeholder. Always copy the connection string from your own Atlas cluster or the verified private local configuration.

MongoDB documents both SRV DNS failures and the standard connection-string workaround in its [connection troubleshooting guide](https://www.mongodb.com/docs/atlas/troubleshoot-connection/). Prefer a freshly copied Atlas URI if your cluster topology changes; do not invent node hostnames or remove TLS to bypass an error.

## 1. Understand the deployment layout

```text
https://your-project.vercel.app
├── /assets/*       → Vite's compiled static assets
├── /login          → React application
├── /products       → React application
├── /cart           → React application
├── /checkout       → React application
├── /orders/*       → React application
└── /api/*          → api/index.js → Express → MongoDB Atlas
```

The root `vercel.json` defines the frontend build and output, sends `/api/*` to the function, and falls back to `index.html` for browser navigation. The API handler exports Express without opening a port. The shared database helper reuses connections inside a warm function instance and limits its pool to ten connections. Separate function instances still have separate pools.

Vercel's Express support runs the application as a function; its [Express documentation](https://vercel.com/docs/frameworks/backend/express) also explains why static files should use the platform's static delivery. This configuration serves `frontend/dist` through Vercel rather than depending on `express.static()` for hosted assets.

## 2. Verify the source before importing

The deployment preparation must be present in the GitHub branch you import. From the repository root:

```bash
npm ci --prefix backend
npm ci --prefix frontend
npm test
npm run build
npm run db:check
```

Use Node.js **24 LTS**, matching the root `package.json`. The database diagnostic should print:

```json
{
  "connected": true,
  "database": "shopkart",
  "ping": "ok",
  "transactionsSupported": true
}
```

This is a read-only connectivity and topology check. The automated tests mock database calls; they do not exercise a real payment or replace the hosted checks below.

Before pushing, inspect `git status` and ensure `backend/.env` is ignored:

```bash
git check-ignore backend/.env
```

Push the reviewed deployment files to your GitHub branch. Never add `.env` with `git add -f`.

```bash
git add README.md .vercelignore api backend frontend/package-lock.json docs/DEPLOYMENT.md package.json package-lock.json vercel.json
git commit -m "Prepare ShopKart for Vercel deployment"
git push origin main
```

The deployment preparation also updates compatible backend and frontend dependencies to clear the reported advisories. Local backend reloads now use Node's built-in `--watch` mode instead of the vulnerable development watcher dependency chain.

## 3. Prepare MongoDB Atlas

### Confirm the cluster and database user

1. Sign in to [MongoDB Atlas](https://cloud.mongodb.com/).
2. Select the project that contains your existing cluster.
3. Open **Database / Clusters** and confirm the intended cluster is available.
4. Open **Database Access** and identify the database user used by the application. This is separate from your Atlas website login.
5. For a new deployment-specific user, give it `readWrite` access to the `shopkart` database. Avoid granting project-wide administrative privileges.
6. In the cluster's **Connect → Drivers** dialog, copy the connection string for Node.js.
7. Include the intended database name `/shopkart`, supply the database-user credentials, and URL-encode special characters in those credentials.

Atlas distinguishes database users from account users and supports scoped roles; see [Configure Database Users](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/).

You can use the standard URI already verified in your private local `.env`. For a new URI, retain all node addresses, `replicaSet`, `authSource`, and TLS options provided by Atlas. A successful local test should come before deployment.

### Configure Network Access for Vercel

Atlas allows connections only from permitted source addresses. Allowing your laptop's IP is enough for local development but does not allow Vercel's function traffic. See [Atlas connectivity requirements](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/).

Choose the approach that matches your deployment:

| Approach | Atlas Network Access setting | Tradeoff |
| --- | --- | --- |
| Restricted deployment | Enable Vercel Static IPs / Secure Compute if available for your plan, then allow the assigned outbound IPs | Keeps network access limited; availability and costs depend on your Vercel plan |
| Public lab demo | Explicitly allow `0.0.0.0/0` in Atlas if you accept the broader exposure | Allows connection attempts from anywhere; database authentication and TLS still apply |

Vercel uses dynamic outbound addresses by default, so a deployment's domain IP is not a reliable database allowlist entry. Its [outbound IP guide](https://vercel.com/kb/guide/how-to-allowlist-deployment-ip-address) explains the static-IP options.

For the public demo option, use a strong password and a user restricted to this database. Do not remove database authentication. No Atlas access-list changes were made as part of this repository preparation.

## 4. Import the GitHub repository into Vercel

1. Sign in to [Vercel](https://vercel.com/) with the GitHub account that can access `raghav-shell/Shopkart`.
2. Select **Add New → Project**.
3. Import **raghav-shell/Shopkart**.
4. Choose a project name, for example `shopkart` if it is available.
5. Keep **Root Directory** at the repository root (`.`). Do not select `frontend` or `backend`; the project needs both directories and the root `api` handler.
6. Use the settings below. The checked-in `vercel.json` supplies the install, build, and output values.

| Setting | Value |
| --- | --- |
| Framework preset | **Other** |
| Root directory | Repository root (`.`) |
| Node.js version | **24.x** |
| Install command | `npm ci --prefix backend && npm ci --prefix frontend` |
| Build command | `npm run build --prefix frontend` |
| Output directory | `frontend/dist` |
| Production branch | `main`, unless you intentionally choose another branch |
| API runtime | Node.js function; not Edge |

There is no hosted `npm start` step and no persistent port to configure. `PORT` is for local development. Vercel invokes `api/index.js` for API requests.

If function-region selection is available in your project, choose a region near the Atlas cluster to reduce database latency. Use the cluster's actual region rather than choosing solely from your browser's location. See [Vercel function regions](https://vercel.com/docs/functions/configuring-functions/region).

## 5. Add server environment variables

Before deploying, expand **Environment Variables** in the import screen, or add these under **Project → Settings → Environment Variables**.

| Variable | Value | Needed for |
| --- | --- | --- |
| `MONGO_URI` | Your complete verified Atlas connection URI | All database-backed functionality |
| `JWT_SECRET` | A long random secret, unique to this deployment | Login token signing and verification |
| `NODE_ENV` | `production` | Secure HTTPS cookies and production behavior |
| `RAZORPAY_KEY_ID` | Your `rzp_test_...` key ID | Test checkout |
| `RAZORPAY_KEY_SECRET` | The matching Razorpay test secret | Payment order creation and signature verification |
| `PRODUCT_WRITE_KEY` | Optional independent random secret | Creating products through the hosted API |

Generate separate values for `JWT_SECRET` and `PRODUCT_WRITE_KEY` by running this command twice:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Enter environment values without wrapping quotes. Keep credentials server-side: do not prefix any of these values with `VITE_`. No frontend API URL variable is needed because the app already calls relative `/api` paths.

Apply the variables to **Production**. If you will use preview deployments, configure their variables too; use a separate database and secrets when previews should not share production data. Preview environments run the built application with production behavior as well, so product creation remains protected.

Vercel applies variable changes to new deployments. After editing a variable, redeploy; an existing deployment will not receive it automatically. See [Vercel environment variables](https://vercel.com/docs/environment-variables).

## 6. Deploy and verify the API first

1. Select **Deploy**.
2. Inspect the build log: both dependency installs should succeed, Vite should finish, and the API function should be packaged.
3. Open the assigned HTTPS URL.
4. Before testing the UI, visit:

```text
https://YOUR-PROJECT.vercel.app/api/health
```

Expected response:

```json
{"success":true,"database":"connected"}
```

Then check:

```text
https://YOUR-PROJECT.vercel.app/api/products
```

It should return JSON containing `products`. An empty array means the selected database has no products; it does not mean connectivity failed.

A request to `/api/customers/me` without signing in should return **401 Unauthorized**. This is expected authentication behavior. An unknown API URL should return a JSON **404**, while browser pages should load the React app.

If an endpoint returns HTML instead of JSON, first check that the repository root and the committed `vercel.json` are in use. If health returns **503**, check function logs, `MONGO_URI`, `JWT_SECRET`, and Atlas Network Access. Do not repeatedly change database passwords in response to a DNS or timeout error.

## 7. Populate or confirm the catalog

If the existing `shopkart` database already contains products, they should appear without importing anything. The screenshots in the README were made from a separate local demo database; those sample records were never copied into Atlas automatically.

If you need to add a product after deployment, configure `PRODUCT_WRITE_KEY` and redeploy. From a trusted terminal, use a secure interactive prompt so the key is not written literally into shell history:

```bash
read -r -s PRODUCT_WRITE_KEY
export PRODUCT_WRITE_KEY
```

Paste the key when the terminal waits for input and press Enter. Set your deployment URL:

```bash
export SHOPKART_URL='https://YOUR-PROJECT.vercel.app'
```

Then send a product request without putting the secret into the command line:

```bash
node <<'NODE'
(async () => {
  const response = await fetch(`${process.env.SHOPKART_URL}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Product-Key': process.env.PRODUCT_WRITE_KEY,
    },
    body: JSON.stringify({
      name: 'Everyday Canvas Backpack',
      description: 'A practical everyday carry with a clean, minimal design.',
      price: 1899,
      category: 'Accessories',
      image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=85',
      stock: 24,
    }),
  });
  console.log(response.status, await response.json());
})();
NODE
```

Remove the temporary key from the terminal environment afterward:

```bash
unset PRODUCT_WRITE_KEY
```

This step writes one product each time it is run. No web admin interface is included. A **403** response means the write key is missing, incorrect, or absent from the deployed environment. Leave the key unset if you do not want product creation available at all.

## 8. Verify the complete shopping flow

Perform these checks on the deployed HTTPS origin:

1. Register a new test customer and sign in.
2. Refresh the page. The customer should remain authenticated.
3. Open `/products` directly and refresh it. React should load instead of a hosting 404.
4. Search, filter, and sort products.
5. Save a product to the wishlist, refresh, and confirm it remains there.
6. Add an item to the cart, change its quantity, and refresh to verify persistence.
7. Open checkout and provide fictional test shipping details.
8. Use **Razorpay Test Mode** and complete a test payment.
9. Confirm that order details open, the cart clears, and the order appears in **My Orders**.
10. Sign out and confirm protected data is no longer accessible.

Keep tests on one deployment hostname: cookies set on a preview URL do not authenticate a different production URL. The production cookie is `HttpOnly`, `Secure`, and `SameSite=Lax`; use HTTPS.

The current checkout deliberately accepts only Razorpay test key IDs. Do not switch to live keys and expect live payments to work. Inventory is checked during payment-order creation but is not decremented after payment. This remains a lab/demo checkout, not a complete production commerce system.

## 9. Troubleshoot by symptom

| Symptom | Likely cause / next step |
| --- | --- |
| `querySrv` errors | DNS SRV resolution problem; copy Atlas's standard TLS connection string or correct the resolver environment |
| Health returns 503 | Missing configuration, inaccessible database, invalid credentials, or Atlas access-list restriction; inspect function logs and run the local database check |
| Authentication failed when checking directly | Wrong database-user credentials, incorrectly encoded password, or incorrect `authSource` |
| Local connection works; Vercel connection times out | Atlas may allow the laptop but not Vercel's outbound traffic |
| UI loads but API returns 404 or HTML | Wrong project root, missing API files, or wrong rewrite configuration |
| Build reports missing dependencies | Confirm the install command installs both `backend` and `frontend` |
| API bundle cannot find a backend module | Confirm deployment includes `backend/`, the root is `.`, and no ignore rule excludes source files |
| Login appears successful but does not persist | Inspect the HTTPS `Set-Cookie` response; stay on the same hostname and use `NODE_ENV=production` |
| Empty catalog | Confirm the URI selects `/shopkart`; then check whether that database has products |
| Product creation returns 403 | Expected without a valid `X-Product-Key` in production |
| Razorpay checkout fails | Confirm both keys are matching Test Mode credentials and the deployment was rebuilt after setting them |
| Payment confirmation fails | Check the order verification response and function logs; confirm transaction support with `npm run db:check` |
| Changes to environment variables have no effect | Create a new deployment |

## 10. Future releases and an optional domain

Once GitHub is connected, commits to the configured production branch create production deployments; other branches can create previews. Check the build and API health before sharing a new release. Keep environment variables out of Git.

For a custom domain, open **Project → Settings → Domains**, add the hostname, and apply the DNS records Vercel provides for that specific project. Wait for DNS verification and HTTPS provisioning, then repeat the login and checkout checks on the new hostname. Users will sign in again because the hostname has changed.

## What has and has not been verified

- The existing Atlas credentials and standard TLS URI successfully connected and returned a ping.
- Atlas reported replica-set topology compatible with the checkout transaction requirement.
- The frontend production build passed locally.
- Backend and frontend dependency audits reported zero known vulnerabilities after the updates.
- Regression tests passed for connection sharing, failure retry, health responses, API errors, authentication rejection, and production product-write restrictions.
- Credentials remain in the ignored private local file; they are not in this document.
- Vercel hosted builds and outbound Atlas access passed. Production registration, authentication, wishlist/cart persistence, and a user-completed Razorpay Test Mode payment were verified, including the paid order and cleared cart. Live payments remain intentionally unsupported by the current Test Mode implementation.
