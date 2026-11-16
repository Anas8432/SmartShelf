const $ = (id) => document.getElementById(id);
const money = (n) => "₹" + Number(n).toLocaleString("en-IN");
let currentCustomer = null;

// Small helper for talking to the Python backend
async function api(url, method = "GET", body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Something went wrong");
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

function showError(msg) {
  $("error").textContent = msg;
  $("error").hidden = !msg;
}

// Build a list row safely (textContent, no HTML injection)
function row(title, sub, right, onClick) {
  const li = document.createElement("li");
  const left = document.createElement("div");
  left.textContent = title;
  if (sub) {
    const s = document.createElement("small");
    s.textContent = sub;
    left.append(s);
  }
  li.append(left, right);
  if (onClick) { li.classList.add("click"); li.onclick = onClick; }
  return li;
}

function emptyRow(text) {
  const li = document.createElement("li");
  li.className = "empty";
  li.textContent = text;
  return li;
}

function span(text, cls) {
  const s = document.createElement("span");
  s.textContent = text;
  if (cls) s.className = cls;
  return s;
}

// ---------- Views ----------
function show(view) {
  for (const v of ["customers", "ledger", "stock"]) $("view-" + v).hidden = v !== view;
  $("tab-customers").classList.toggle("active", view !== "stock");
  $("tab-stock").classList.toggle("active", view === "stock");
  showError("");
}

async function loadCustomers() {
  const customers = await api("/api/customers");
  $("total").textContent = money(customers.reduce((a, c) => a + Math.max(0, c.balance), 0));
  const list = $("customer-list");
  list.replaceChildren();
  if (!customers.length) list.append(emptyRow("No customers yet. Add one below."));
  customers.forEach((c) => {
    list.append(row(c.name, c.phone, span(money(c.balance), c.balance > 0 ? "due" : "paid"),
      () => openLedger(c)));
  });
}

async function openLedger(c) {
  currentCustomer = c;
  show("ledger");
  $("l-name").textContent = c.name;
  const entries = await api(`/api/customers/${c.id}/entries`);
  const balance = entries.reduce((a, e) => a + (e.type === "credit" ? e.amount : -e.amount), 0);
  currentCustomer.balance = balance;
  $("l-balance").textContent = money(balance);
  $("l-balance").className = balance > 0 ? "due" : "paid";
  const list = $("entry-list");
  list.replaceChildren();
  if (!entries.length) list.append(emptyRow("No entries yet."));
  entries.forEach((e) => {
    const label = (e.type === "credit" ? "Credit" : "Payment") + (e.note ? ": " + e.note : "");
    const sign = e.type === "credit" ? "+" : "−";
    list.append(row(label, e.created_at.slice(0, 10),
      span(sign + money(e.amount), e.type === "credit" ? "due" : "paid")));
  });
}

async function loadItems() {
  const items = await api("/api/items");
  const list = $("item-list");
  list.replaceChildren();
  if (!items.length) list.append(emptyRow("No items yet. Add one below."));
  items.forEach((i) => {
    const low = i.qty <= i.min_qty;
    const controls = document.createElement("div");
    controls.className = "stock-controls";
    const minus = Object.assign(document.createElement("button"), { textContent: "−" });
    const plus = Object.assign(document.createElement("button"), { textContent: "+" });
    minus.setAttribute("aria-label", "Decrease " + i.name);
    plus.setAttribute("aria-label", "Increase " + i.name);
    minus.onclick = () => change(i.id, -1);
    plus.onclick = () => change(i.id, 1);
    controls.append(minus, span(i.qty), plus);
    list.append(row(i.name, low ? "Low stock" : "", controls));
    if (low) list.lastChild.querySelector("small").className = "low";
  });
}

async function change(id, delta) {
  await api(`/api/items/${id}`, "PATCH", { delta });
  loadItems();
}

// ---------- Events ----------
const guard = (fn) => async (e) => {
  e.preventDefault();
  try { await fn(e); } catch (err) { showError(err.message); }
};

$("tab-customers").onclick = () => { show("customers"); loadCustomers(); };
$("tab-stock").onclick = () => { show("stock"); loadItems(); };
$("back").onclick = () => { show("customers"); loadCustomers(); };

$("customer-form").onsubmit = guard(async (e) => {
  await api("/api/customers", "POST", { name: $("c-name").value, phone: $("c-phone").value });
  e.target.reset();
  loadCustomers();
});

$("item-form").onsubmit = guard(async (e) => {
  await api("/api/items", "POST", {
    name: $("i-name").value, qty: $("i-qty").value, min_qty: $("i-min").value,
  });
  e.target.reset();
  loadItems();
});

$("entry-form").onsubmit = guard(async (e) => {
  const type = e.submitter.dataset.type;
  await api(`/api/customers/${currentCustomer.id}/entries`, "POST", {
    type, amount: $("e-amount").value, note: $("e-note").value,
  });
  e.target.reset();
  openLedger(currentCustomer);
});

$("remind").onclick = () => {
  const c = currentCustomer;
  const phone = (c.phone || "").replace(/\D/g, "");
  if (!phone) return showError("Add a phone number for this customer first.");
  const msg = `Hello ${c.name}, your pending balance at our shop is ${money(c.balance)}. Please pay when you can. Thank you!`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
};

$("delete-customer").onclick = async () => {
  if (!confirm("Delete this customer and all their entries?")) return;
  await api(`/api/customers/${currentCustomer.id}`, "DELETE");
  show("customers");
  loadCustomers();
};

loadCustomers().catch((err) => showError(err.message));
