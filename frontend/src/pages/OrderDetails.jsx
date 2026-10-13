import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import { fetchOrder } from "../services/api";

export default function OrderDetails({ user, onHome, onPassword, onLogout, submitting }) {
  const { pathname } = useLocation();
  const id = pathname.split("/").pop();
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState("loading");

  const load = async () => {
    setStatus("loading");
    try {
      const result = await fetchOrder(id);
      setOrder(result.order);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    let active = true;
    setStatus("loading");
    fetchOrder(id)
      .then((result) => {
        if (!active) return;
        setOrder(result.order);
        setStatus("ready");
      })
      .catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [id]);

  return (
    <main className="shop-page">
      <Navbar user={user} onHome={onHome} onPassword={onPassword} onLogout={onLogout} submitting={submitting} />
      {status === "loading" && <div className="state">Loading order...</div>}
      {status === "error" && <div className="state error-state"><p>Unable to load this order.</p><button className="outline" onClick={load}>Try again</button><Link to="/orders">My Orders</Link></div>}
      {status === "ready" && order && (
        <>
          <section className="page-intro">
            <span className="eyebrow">Order #{order._id}</span>
            <h1>{order.paymentStatus === "PAID" ? "Order Placed Successfully" : "Payment Pending"}</h1>
            <p>{order.paymentStatus === "PAID" ? "Your order has been saved successfully." : "Your cart remains intact until payment is verified."}</p>
          </section>
          <div className="checkout-layout">
            <section className="order-detail-panel">
              <h2>Items</h2>
              {order.items.map((item) => (
                <div className="order-detail-item" key={item.product}>
                  {item.image && <img src={item.image} alt="" />}
                  <div><strong>{item.name}</strong><p>₹{item.price.toLocaleString("en-IN")} × {item.quantity}</p></div>
                  <strong>₹{(item.price * item.quantity).toLocaleString("en-IN")}</strong>
                </div>
              ))}
            </section>
            <aside className="order-summary">
              <h2>Order details</h2>
              <div><span>Order ID</span><strong className="order-id">{order._id}</strong></div>
              <div><span>Placed on</span><strong>{new Date(order.createdAt).toLocaleDateString("en-IN")}</strong></div>
              <div><span>Status</span><strong>{order.status.replaceAll("_", " ")}</strong></div>
              <div><span>Payment</span><strong>{order.paymentStatus}</strong></div>
              <div className="summary-total"><span>Total</span><strong>₹{order.totalAmount.toLocaleString("en-IN")}</strong></div>
              <h3>Shipping to</h3>
              <address>
                {order.shippingAddress.fullName}<br />
                {order.shippingAddress.addressLine1}<br />
                {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}<br />
                {order.shippingAddress.phone}
              </address>
              <div className="order-links"><Link className="primary" to="/orders">View My Orders</Link><Link className="outline" to="/products">Continue Shopping</Link></div>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
