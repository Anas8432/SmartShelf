import sqlite3
from flask import Flask, g, jsonify, request

app = Flask(__name__, static_folder="static", static_url_path="")
DB = "smartshelf.db"


def db():
    if "db" not in g:
        g.db = sqlite3.connect(DB)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(_):
    conn = g.pop("db", None)
    if conn:
        conn.close()


def init_db():
    with sqlite3.connect(DB) as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
            type TEXT NOT NULL CHECK (type IN ('credit', 'payment')),
            amount REAL NOT NULL CHECK (amount > 0),
            note TEXT DEFAULT '',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            qty INTEGER NOT NULL DEFAULT 0,
            min_qty INTEGER NOT NULL DEFAULT 2
        );
        """)


def rows(cur):
    return [dict(r) for r in cur.fetchall()]


@app.get("/")
def home():
    return app.send_static_file("index.html")


# ---------- Customers ----------
@app.get("/api/customers")
def list_customers():
    cur = db().execute("""
        SELECT c.id, c.name, c.phone,
               COALESCE(SUM(CASE WHEN e.type = 'credit' THEN e.amount ELSE -e.amount END), 0) AS balance
        FROM customers c LEFT JOIN entries e ON e.customer_id = c.id
        GROUP BY c.id ORDER BY balance DESC, c.name
    """)
    return jsonify(rows(cur))


@app.post("/api/customers")
def add_customer():
    d = request.get_json(force=True)
    name = (d.get("name") or "").strip()
    if not name:
        return jsonify(error="Name is required"), 400
    conn = db()
    cur = conn.execute("INSERT INTO customers (name, phone) VALUES (?, ?)",
                       (name, (d.get("phone") or "").strip()))
    conn.commit()
    return jsonify(id=cur.lastrowid), 201


@app.delete("/api/customers/<int:cid>")
def delete_customer(cid):
    conn = db()
    conn.execute("DELETE FROM customers WHERE id = ?", (cid,))
    conn.commit()
    return "", 204


# ---------- Ledger entries ----------
@app.get("/api/customers/<int:cid>/entries")
def list_entries(cid):
    cur = db().execute(
        "SELECT * FROM entries WHERE customer_id = ? ORDER BY id DESC", (cid,))
    return jsonify(rows(cur))


@app.post("/api/customers/<int:cid>/entries")
def add_entry(cid):
    d = request.get_json(force=True)
    try:
        amount = float(d.get("amount"))
    except (TypeError, ValueError):
        return jsonify(error="Enter a valid amount"), 400
    if d.get("type") not in ("credit", "payment") or amount <= 0:
        return jsonify(error="Invalid entry"), 400
    conn = db()
    conn.execute(
        "INSERT INTO entries (customer_id, type, amount, note) VALUES (?, ?, ?, ?)",
        (cid, d["type"], amount, (d.get("note") or "").strip()))
    conn.commit()
    return "", 201


# ---------- Stock ----------
@app.get("/api/items")
def list_items():
    return jsonify(rows(db().execute("SELECT * FROM items ORDER BY name")))


@app.post("/api/items")
def add_item():
    d = request.get_json(force=True)
    name = (d.get("name") or "").strip()
    if not name:
        return jsonify(error="Name is required"), 400
    conn = db()
    conn.execute("INSERT INTO items (name, qty, min_qty) VALUES (?, ?, ?)",
                 (name, int(d.get("qty") or 0), int(d.get("min_qty") or 2)))
    conn.commit()
    return "", 201


@app.patch("/api/items/<int:iid>")
def change_stock(iid):
    delta = int(request.get_json(force=True).get("delta", 0))
    conn = db()
    conn.execute("UPDATE items SET qty = MAX(0, qty + ?) WHERE id = ?", (delta, iid))
    conn.commit()
    return "", 204


@app.delete("/api/items/<int:iid>")
def delete_item(iid):
    conn = db()
    conn.execute("DELETE FROM items WHERE id = ?", (iid,))
    conn.commit()
    return "", 204


if __name__ == "__main__":
    init_db()
    app.run(debug=True)
