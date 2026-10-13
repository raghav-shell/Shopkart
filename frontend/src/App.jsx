import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Password from "./pages/Password";
import ProductDetails from "./pages/ProductDetails";
import Products from "./pages/Products";
import Register from "./pages/Register";
import Wishlist from "./pages/Wishlist";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Orders from "./pages/Orders";
import OrderDetails from "./pages/OrderDetails";
import { CartProvider } from "./context/CartContext";

const emptyRegister = { fullName: "", email: "", phone: "", password: "" };
const emptyPassword = { oldPassword: "", newPassword: "", confirmPassword: "" };

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, { credentials: "include", ...options });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const page = getPage(location.pathname);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState({ message: "", success: false });
  const [login, setLogin] = useState({ email: "", password: "" });
  const [register, setRegister] = useState(emptyRegister);
  const [passwords, setPasswords] = useState(emptyPassword);
  const [submitting, setSubmitting] = useState(false);

  const message = (text, success = false) =>
    setNotice({ message: text, success });
  const noticeElement = notice.message ? (
    <p
      className={`notice ${notice.success ? "success" : ""}`}
      aria-live="polite"
    >
      {notice.message}
    </p>
  ) : null;

  const authenticate = async (destination = "home", shouldNavigate = true) => {
    const { response, body } = await api("/customers/me");
    if (response.ok) {
      setUser(body);
      if (shouldNavigate) navigate(`/${destination}`);
    } else {
      setUser(null);
      if (shouldNavigate) navigate("/login");
    }
    return response.ok;
  };

  useEffect(() => {
    authenticate(getPage(location.pathname), false)
      .then((authenticated) => {
        if (location.pathname === "/" || (!authenticated && !["/login", "/register"].includes(location.pathname))) {
          navigate(authenticated ? "/home" : "/login", { replace: true });
        } else if (authenticated && ["/login", "/register"].includes(location.pathname)) {
          navigate("/home", { replace: true });
        }
      })
      .catch(() => {
        setUser(null);
        message("Unable to connect to ShopKart. Please try again.");
        navigate("/login", { replace: true });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const names = {
      login: "Sign in",
      register: "Create account",
      password: "Change password",
      home: "Everyday shopping",
      products: "Products",
      wishlist: "Wishlist",
      cart: "Cart",
      checkout: "Checkout",
      orders: "My Orders",
    };
    document.title = `ShopKart | ${names[page] || "Shop"}`;
  }, [page]);

  const go = async (destination) => {
    message("");
    if (destination === "home" || destination === "password")
      await authenticate(destination);
    else {
      navigate(`/${destination}`);
    }
  };

  const update = (setter) => (event) =>
    setter((values) => ({
      ...values,
      [event.target.name]: event.target.value,
    }));

  const registerSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    message("");
    try {
      const { response, body } = await api("/customers/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(register),
      });
      if (!response.ok)
        throw new Error(body.message || "Unable to create your account.");
      setLogin({ email: register.email, password: "" });
      setRegister(emptyRegister);
      navigate("/login");
      message("Account created. Please sign in to continue.", true);
    } catch (error) {
      message(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const loginSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    message("");
    try {
      const { response, body } = await api("/customers/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(login),
      });
      if (!response.ok) throw new Error(body.message || "Unable to sign in.");
      await authenticate();
    } catch (error) {
      message(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const passwordSubmit = async (event) => {
    event.preventDefault();
    message("");
    if (passwords.newPassword !== passwords.confirmPassword) {
      message("New passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const { response, body } = await api("/customers/change-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldPassword: passwords.oldPassword,
          newPassword: passwords.newPassword,
        }),
      });
      if (!response.ok)
        throw new Error(body.message || "Unable to update password.");
      setPasswords(emptyPassword);
      message("Password updated successfully.", true);
    } catch (error) {
      message(error.message);
      if (error.message === "Unauthorized") authenticate();
    } finally {
      setSubmitting(false);
    }
  };

  const logout = async () => {
    setSubmitting(true);
    try {
      const { response, body } = await api("/customers/logout", { method: "POST" });
      if (!response.ok && response.status !== 401) {
        throw new Error(body.message || "Unable to log out.");
      }
      setUser(null);
      setLogin({ email: "", password: "" });
      navigate("/login");
      message("You have been logged out.", true);
    } catch (error) {
      message(error.message || "Unable to log out.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading">Loading ShopKart...</div>;
  if (page === "register")
    return (
      <Register
        register={register}
        onChange={update(setRegister)}
        onSubmit={registerSubmit}
        submitting={submitting}
        message={noticeElement}
        onLogin={() => go("login")}
      />
    );
  if (!user && page !== "register")
    return (
      <Login
        login={login}
        onChange={update(setLogin)}
        onSubmit={loginSubmit}
        submitting={submitting}
        message={noticeElement}
        onRegister={() => go("register")}
      />
    );
  if (page === "password")
    return (
      <Password
        passwords={passwords}
        onChange={update(setPasswords)}
        onSubmit={passwordSubmit}
        submitting={submitting}
        message={noticeElement}
        onHome={() => go("home")}
      />
    );
  return (
    <CartProvider key={user._id}>
      <AuthenticatedPages
        pathname={location.pathname}
        user={user}
        onHome={() => go("home")}
        onPassword={() => go("password")}
        onLogout={logout}
        onProducts={() => go("products")}
        submitting={submitting}
      />
    </CartProvider>
  );
}

function AuthenticatedPages({
  pathname,
  user,
  onHome,
  onPassword,
  onLogout,
  onProducts,
  submitting,
}) {
  if (pathname.startsWith("/products/")) {
    return (
      <ProductDetails
        user={user}
        onHome={onHome}
        onPassword={onPassword}
        onProducts={onProducts}
        onLogout={onLogout}
        submitting={submitting}
      />
    );
  }
  if (pathname.startsWith("/orders/")) {
    return <OrderDetails user={user} onHome={onHome} onPassword={onPassword} onLogout={onLogout} submitting={submitting} />;
  }
  if (pathname === "/orders") {
    return <Orders user={user} onHome={onHome} onPassword={onPassword} onLogout={onLogout} submitting={submitting} />;
  }
  if (pathname === "/checkout") {
    return <Checkout user={user} onHome={onHome} onPassword={onPassword} onLogout={onLogout} submitting={submitting} />;
  }
  if (pathname === "/wishlist") {
    return (
      <Wishlist
        user={user}
        onHome={onHome}
        onPassword={onPassword}
        onLogout={onLogout}
        submitting={submitting}
      />
    );
  }
  if (pathname === "/cart") {
    return (
      <Cart
        user={user}
        onHome={onHome}
        onPassword={onPassword}
        onLogout={onLogout}
        submitting={submitting}
      />
    );
  }
  if (pathname === "/products") {
    return (
      <Products
        user={user}
        onHome={onHome}
        onPassword={onPassword}
        onLogout={onLogout}
        submitting={submitting}
      />
    );
  }
  return (
    <Home
      user={user}
      onPassword={onPassword}
      onLogout={onLogout}
      submitting={submitting}
    />
  );
}

function getPage(pathname) {
  if (pathname === "/password") return "password";
  if (pathname.startsWith("/products")) return "products";
  if (pathname === "/wishlist") return "wishlist";
  if (pathname === "/cart") return "cart";
  if (pathname === "/checkout") return "checkout";
  if (pathname.startsWith("/orders")) return "orders";
  if (pathname === "/home") return "home";
  if (pathname === "/register") return "register";
  return "login";
}
