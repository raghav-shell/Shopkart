import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { fetchOrders } from "../services/api";

export default function Orders({ user, onHome, onPassword, onLogout, submitting }) {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("loading");

  const load = async () => {
    setStatus("loading");
    try {
      const result = await fetchOrders();
      setOrders(result.orders || []);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <main className="shop-page">
      <Navbar user={user} onHome={onHome} onPassword={onPassword} onLogout={onLogout} submitting={submitting} />
      <section className="page-intro">
        <span className="eyebrow">Your history</span>
        <h1>My Orders</h1>
      </section>
      {status === "loading" && <div className="state">Loading your orders...</div>}
      {status === "error" && <div className="state error-state"><p>Unable to load your orders.</p><button className="outline" onClick={load}>Try again</button></div>}
      {status === "ready" && orders.length === 0 && (
        <div className="empty-wishlist">
          <h2>You have not placed any orders yet.</h2>
          <Link className="primary empty-action" to="/products">Start Shopping</Link>
        </div>
      )}
      {status === "ready" && orders.length > 0 && (
        <div className="orders-list">
          {orders.map((order) => (
            <article className="order-card" key={order._id}>
              <div className="order-card-header">
                <div>
                  <span className="eyebrow">Order #{order._id.slice(-8).toUpperCase()}</span>
                  <h2>{new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</h2>
                </div>
                <span className="order-status">{order.status.replaceAll("_", " ")}</span>
              </div>
              <ul>{order.items.map((item) => <li key={item.product}>{item.name} × {item.quantity}</li>)}</ul>
              <div className="order-card-footer">
                <strong>₹{order.totalAmount.toLocaleString("en-IN")}</strong>
                <Link className="outline" to={`/orders/${order._id}`}>View Details</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
