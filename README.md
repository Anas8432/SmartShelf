# SmartShelf

A simple web app that helps small neighborhood shops manage **customer credit (udhaar)** and **stock**. Shopkeepers can record credit and payments, see every customer's balance at a glance, send WhatsApp payment reminders, and get low-stock alerts.

**Live demo:** https://smartshelf-eye9.onrender.com
**Source code:** 

> The demo runs on a free hosting plan. It may take about a minute to wake up on the first visit, and data can reset when the server restarts.

## Why this project

Many small shops still keep credit in a paper notebook. Entries get lost, totals are wrong, and finding an old balance is slow. SmartShelf replaces the notebook with a fast, simple interface that works on a phone browser.

## Features

- **Customer ledger:** add customers, record credit given and payments received, and see a running history per customer.
- **Automatic balances:** each balance is calculated from the entries, so it can never drift out of sync.
- **Pending total:** the home screen shows the total credit still to be collected.
- **WhatsApp reminders:** one tap opens WhatsApp with a ready-made reminder message (no paid API needed).
- **Stock tracking:** add items, adjust quantities with + / − buttons, and see a "Low stock" warning when an item runs low.
- **Mobile friendly:** responsive layout that works on small screens.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, vanilla JavaScript |
| Backend | Python, Flask (REST API) |
| Database | SQLite (local file) |
| Hosting | Render |

## How it works

```
Browser (HTML + CSS + JS)
        |  fetch() with JSON
        v
Flask server (main.py)
        |  SQL
        v
SQLite database (smartshelf.db)
```

Flask serves the files in `static/` and exposes a JSON API under `/api`. Everything runs from a single server, so there is no separate frontend deployment and no CORS setup.

## Project structure

```
smartshelf/
├── main.py            # Flask app, API routes, SQLite setup
├── requirements.txt   # Python dependencies
├── README.md
└── static/
    ├── index.html     # Page structure
    ├── style.css      # Styling
    └── app.js         # Frontend logic
```

## Database

- **customers**: `id`, `name`, `phone`
- **entries**: `id`, `customer_id`, `type` (`credit` or `payment`), `amount`, `note`, `created_at`
- **items**: `id`, `name`, `qty`, `min_qty`

A customer's balance is `sum(credits) - sum(payments)`, computed with SQL. Deleting a customer also deletes their entries (`ON DELETE CASCADE`).

## API

| Action | Method and route |
|---|---|
| List customers with balances | `GET /api/customers` |
| Add a customer | `POST /api/customers` |
| Delete a customer | `DELETE /api/customers/<id>` |
| List a customer's entries | `GET /api/customers/<id>/entries` |
| Add a credit or payment | `POST /api/customers/<id>/entries` |
| List stock items | `GET /api/items` |
| Add an item | `POST /api/items` |
| Change stock quantity | `PATCH /api/items/<id>` with `{"delta": 1}` |
| Delete an item | `DELETE /api/items/<id>` |

The backend validates input and returns a `400` error for empty names, invalid amounts, or invalid entry types.

## Run locally

Requirements: Python 3.9 or newer.

```bash
git clone https://github.com/YOURUSERNAME/smartshelf.git
cd smartshelf
pip install -r requirements.txt
python main.py
```

Open http://127.0.0.1:5000 in your browser. The database file `smartshelf.db` is created automatically on first run.

To test on your phone, make sure it is on the same Wi-Fi, run the app with `host="0.0.0.0"`, and open `http://<your-computer-ip>:5000`.

## Deploy on Render

1. Push the project to GitHub.
2. On Render, create a **New Web Service** and select the repository.
3. Use these settings:
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `gunicorn main:app`
   - **Instance type:** Free

Free instances use temporary storage, so the SQLite file is reset on restart. This is fine for a demo. For permanent data, move to a hosted database such as Postgres.

## Security notes

- List items are rendered with `textContent`, not HTML strings, to prevent XSS.
- Database queries use parameters, which prevents SQL injection.
- There is no login yet, so do not store real customer data on a public deployment.

## Limitations

- No user authentication
- Entries cannot be edited or deleted individually
- Single shop only
- Requires an internet connection (no offline mode)

## Future improvements

- Login and per-shop accounts
- Edit and delete entries, plus customer search
- Daily and weekly sales and dues reports
- Offline support with a PWA and background sync
- Automated tests for the API

## License

MIT
