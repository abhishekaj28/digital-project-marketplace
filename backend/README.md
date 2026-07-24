# Tech Project Marketplace (v10 - Clean Regeneration)

A Flask + MongoDB marketplace to sell downloadable student technology projects, with:
- Categories & projects (images, short + long descriptions)
- Admin upload of project artifacts (zip/pdf/csv/sql/etc.)
- Razorpay Checkout (order creation) + webhook verification
- Secure downloads: purchases tracked in MongoDB, downloads require **completed** purchase
- User registration + email verification (demo mode)
- Flask-Login session management
- My Purchases page + purchased badge on project detail
- Admin:
  - dashboard
  - categories CRUD
  - projects CRUD (cover, gallery, artifacts)
  - purchases list + filters + CSV export
  - webhook events viewer
  - analytics (tables + charts via Chart.js)
  - audit logs (30-day TTL)
  - reconcile tool (demo helpers)
  - user list + toggle admin role

> Note: Email sending is demo by default (verification link printed to console). Plug in SMTP/SendGrid later.

## Quick Start

### 1) Setup
```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

### 2) Run MongoDB
Use local MongoDB or Atlas. Ensure `MONGO_URI` is set.

### 3) Run the app
```bash
python run.py
```

Open: http://127.0.0.1:5000

### 4) Admin login
On first run, seed creates:
- admin: `raghuraj@projecthub.com`
- password: `Admin@123`

Change it immediately in production.

## Razorpay Notes
- Configure `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`
- Setup webhook in Razorpay dashboard:
  - URL: `{APP_BASE_URL}/webhook/razorpay`
  - Secret: `RAZORPAY_WEBHOOK_SECRET`
- Events: payment.captured (recommended), order.paid

## Folder Structure
- `app/` Flask package
- `app/uploads/` local storage for uploaded artifacts/images (demo)
- `scripts/` helpers

## Production Security Checklist
- Use HTTPS
- Store secrets in environment
- Validate uploads (content-type scanning)
- Use persistent rate limiting (Redis) + WAF
- Use webhook confirmation as the source of truth


## Deploy to Heroku (simple)
1. Create a Heroku app
2. Add MongoDB (Atlas) and set `MONGO_URI`
3. Set config vars:
   - SECRET_KEY
   - RAZORPAY_KEY_ID
   - RAZORPAY_KEY_SECRET
   - RAZORPAY_WEBHOOK_SECRET
   - APP_BASE_URL (your Heroku URL)
4. Push code. Heroku uses `Procfile` + `requirements.txt`

> For uploads on Heroku, use S3 (Heroku filesystem is ephemeral). Local storage is demo-only.
