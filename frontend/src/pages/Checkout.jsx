import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useCart } from "../context/CartContext";
import { createPaymentOrder, verifyPayment } from "../services/api";

const fields = [
  ["fullName", "Full name"],
  ["phone", "Phone number"],
  ["addressLine1", "Address line"],
  ["city", "City"],
  ["state", "State"],
  ["pincode", "Pincode"],
];

function validate(address) {
  const errors = {};
  for (const [key, label] of fields) {
    if (!address[key].trim()) errors[key] = `${label} is required.`;
  }
  if (address.phone.trim() && !/^[0-9]{10}$/.test(address.phone.trim())) {
    errors.phone = "Phone number must contain 10 digits.";
  }
  if (address.pincode.trim() && !/^[0-9]{6}$/.test(address.pincode.trim())) {
    errors.pincode = "Pincode must contain 6 digits.";
  }
  return errors;
}

let razorpayScriptPromise;

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.dataset.razorpayCheckout = "true";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => window.Razorpay ? resolve() : reject(new Error("Payment checkout did not load."));
      script.onerror = () => reject(new Error("Unable to load Razorpay Checkout. Please try again."));
      document.body.appendChild(script);
    }).catch((error) => {
      document.querySelector('script[data-razorpay-checkout]')?.remove();
      razorpayScriptPromise = null;
      throw error;
    });
  }
  return razorpayScriptPromise;
}

export default function Checkout({ user, onHome, onPassword, onLogout, submitting }) {
  const navigate = useNavigate();
  const { cartItems, itemCount, loading, error: cartError, refreshCart, clearCart } = useCart();
  const [address, setAddress] = useState({
    fullName: user.fullName || "", phone: user.phone || "", addressLine1: "", city: "", state: "", pincode: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(null);
  const subtotal = cartItems.reduce((total, item) => total + item.product.price * item.quantity, 0);
  const hasUnavailable = cartItems.some((item) => item.unavailable);

  const finishPayment = async (details) => {
    setBusy(true);
    setError("");
    try {
      const { order } = await verifyPayment(details);
      setPendingVerification(null);
      clearCart();
      navigate(`/orders/${order._id}`, { state: { justPlaced: true } });
    } catch (requestError) {
      setPendingVerification(details);
      setError(`${requestError.message || "Unable to verify payment."} Your cart is intact. Retry verification below.`);
      setBusy(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const errors = validate(address);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    if (hasUnavailable) {
      setError("Remove unavailable products from your cart before checkout.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await loadRazorpay();
      const data = await createPaymentOrder(address);
      const checkout = new window.Razorpay({
        key: data.key,
        amount: data.amount,
        currency: data.currency,
        name: "ShopKart",
        description: "ShopKart order",
        order_id: data.razorpayOrderId,
        prefill: { name: address.fullName.trim(), contact: address.phone.trim() },
        handler: (response) => finishPayment({
          shopKartOrderId: data.shopKartOrderId,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        }),
        modal: { ondismiss: () => setBusy(false) },
      });
      checkout.on("payment.failed", (response) => {
        const reason = response.error?.description?.trim();
        setError(`${reason || "Payment failed."} Your cart is intact. Retry in Razorpay Checkout or close it to try again.`);
      });
      checkout.open();
    } catch (requestError) {
      setError(requestError.message || "Unable to start checkout.");
      setBusy(false);
    }
  };

  return (
    <main className="shop-page">
      <Navbar user={user} onHome={onHome} onPassword={onPassword} onLogout={onLogout} submitting={submitting} />
      <section className="page-intro">
        <span className="eyebrow">Almost there</span>
        <h1>Checkout</h1>
        <p>Confirm your delivery details and review your order before test payment.</p>
      </section>
      {loading && <div className="state">Loading your cart...</div>}
      {!loading && cartError && (
        <div className="state error-state">
          <p>Unable to load your cart.</p>
          <button className="outline" onClick={() => refreshCart().catch(() => {})}>Try again</button>
        </div>
      )}
      {!loading && !cartError && cartItems.length === 0 && (
        <div className="empty-wishlist">
          <div className="empty-heart">🛒</div>
          <h2>Your cart is empty</h2>
          <Link className="primary empty-action" to="/products">Browse Products</Link>
        </div>
      )}
      {!loading && !cartError && cartItems.length > 0 && (
        <div className="checkout-layout">
          <form id="checkout-form" className="checkout-form" onSubmit={submit} noValidate>
            <h2>Shipping details</h2>
            <div className="checkout-fields">
              {fields.map(([key, label]) => (
                <label key={key} className={key === "addressLine1" ? "checkout-wide" : ""}>
                  <span>{label}</span>
                  <input
                    name={key}
                    value={address[key]}
                    onChange={(event) => {
                      setAddress((current) => ({ ...current, [key]: event.target.value }));
                      setFieldErrors((current) => ({ ...current, [key]: "" }));
                    }}
                    autoComplete={{ fullName: "name", phone: "tel", addressLine1: "address-line1", city: "address-level2", state: "address-level1", pincode: "postal-code" }[key]}
                    inputMode={key === "phone" || key === "pincode" ? "numeric" : undefined}
                    aria-invalid={Boolean(fieldErrors[key])}
                    aria-describedby={fieldErrors[key] ? `${key}-error` : undefined}
                    disabled={busy}
                  />
                  {fieldErrors[key] && <small id={`${key}-error`} className="checkout-field-error">{fieldErrors[key]}</small>}
                </label>
              ))}
            </div>
          </form>
          <aside className="order-summary checkout-summary">
            <h2>Order summary</h2>
            {cartItems.map((item) => (
              <div key={item.product._id}>
                <span>{item.product.name} × {item.quantity}</span>
                <strong>₹{(item.product.price * item.quantity).toLocaleString("en-IN")}</strong>
              </div>
            ))}
            <div><span>Items</span><strong>{itemCount}</strong></div>
            <div className="summary-total"><span>Estimated total</span><strong>₹{subtotal.toLocaleString("en-IN")}</strong></div>
            <p className="checkout-note">The final amount uses current prices and stock verified by the server.</p>
            {hasUnavailable && <p className="wishlist-error">Remove unavailable products from your cart before checkout.</p>}
            {error && <p className="wishlist-error" role="alert">{error}</p>}
            {pendingVerification ? (
              <button className="primary checkout-button" type="button" onClick={() => finishPayment(pendingVerification)} disabled={busy}>
                {busy ? "Verifying payment..." : "Retry payment verification"}
              </button>
            ) : (
              <button className="primary checkout-button" type="submit" form="checkout-form" disabled={busy || hasUnavailable}>
                {busy ? "Preparing payment..." : "Pay with Razorpay Test Mode"}
              </button>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
