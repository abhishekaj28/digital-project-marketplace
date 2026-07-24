from pymongo import MongoClient
from flask import current_app
from datetime import datetime, timedelta

client = None
db = None

def init_db(app):
    global client, db
    try:
        client = MongoClient(app.config["MONGO_URI"], serverSelectionTimeoutMS=5000)
        # Mongo URI includes DB name; if not, fallback
        try:
            _default_db = client.get_default_database()
        except Exception:
            _default_db = None
        db = _default_db if _default_db is not None else client["tech_marketplace"]

        # indexes + TTL
        db["users"].create_index("email", unique=True)
        db["categories"].create_index("name", unique=True)
        db["domains"].create_index("name", unique=True)
        db["projects"].create_index("domainId")
        db["files"].create_index("projectId")
        db["purchases"].create_index([("user_id", 1), ("project_id", 1), ("status", 1)])
        db["purchases"].create_index("razorpay_order_id")
        db["wishlist"].create_index([("user_id", 1), ("project_id", 1)], unique=True)
        db["reviews"].create_index("project_id")
        db["notifications"].create_index("user_id")
        db["webhook_events"].create_index("created_at", expireAfterSeconds=60*60*24*7)  # 7 days
        db["audit_logs"].create_index("created_at", expireAfterSeconds=60*60*24*30)     # 30 days
        db["audit_logs"].create_index("actor_email")

        # Run database migration automatically
        try:
            from migrate import run_migration
            run_migration()
        except Exception as e:
            print(f"Failed to auto-run migration: {e}")

        seed_if_empty()
    except Exception as e:
        print(f"Database initialization warning: {e}")

def now_utc():
    return datetime.utcnow()

def seed_if_empty():
    # If the database is empty of domains, invoke the comprehensive seeder
    if db["domains"].count_documents({}) == 0 or db["users"].count_documents({}) == 0:
        try:
            import sys
            import os
            # Ensure parent/current dir is in python path
            sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
            from seed_db import seed_database
            seed_database()
        except Exception as e:
            print(f"Failed to run comprehensive database seeder: {e}")
            # Fallback to simple admin seed if seeder fails
            if db["users"].count_documents({}) == 0:
                import os as _os
                from .security import hash_password
                _admin_email = _os.getenv("SUPER_ADMIN_EMAIL", "raghuraj@projecthub.com").strip().lower()
                db["users"].insert_one({
                    "email": _admin_email,
                    "name": "Super Admin",
                    "password_hash": hash_password("Admin@123"),
                    "is_admin": True,
                    "is_verified": True,
                    "role": "super_admin",
                    "is_suspended": False,
                    "created_at": now_utc(),
                    "updated_at": now_utc(),
                })

    # Ensure super admin user always exists in the database
    import os as _os
    _admin_email = _os.getenv("SUPER_ADMIN_EMAIL", "raghuraj@projecthub.com").strip().lower()
    if db["users"].count_documents({"email": _admin_email}) == 0:
        try:
            from .security import hash_password
            db["users"].insert_one({
                "email": _admin_email,
                "name": "Super Admin",
                "password_hash": hash_password("Admin@123"),
                "is_admin": True,
                "is_verified": True,
                "role": "super_admin",
                "is_suspended": False,
                "created_at": now_utc(),
                "updated_at": now_utc(),
            })
            print(f"Auto-seeded super admin user: {_admin_email}")
        except Exception as e:
            print(f"Failed to auto-seed super admin user: {e}")


    # Seed default book promotion if collection is empty
    if db["book_promotions"].count_documents({}) == 0:
        try:
            db["book_promotions"].insert_one({
                "title": "Exclusive Student Reward",
                "description": "Purchase any project bundle from ProjectHub and unlock a FREE physical book from our official publishing partner.",
                "publisherName": "Official Publishing Partner",
                "publisherWebsite": "https://example.com/books",
                "couponCode": "FREEBOOKSTUDENT",
                "popupImage": "",
                "publisherLogo": "",
                "bannerImage": "",
                "isEnabled": True,
                "validTill": (now_utc() + timedelta(days=30)).strftime("%Y-%m-%d"),
                "createdAt": now_utc(),
                "updatedAt": now_utc()
            })
        except Exception as e:
            print(f"Failed to seed default book promotion: {e}")


def get_db():
    """Return active MongoDB Database object. Re-initialize lazily if needed."""
    global db
    if db is None:
        # If called after module-level imports grabbed db=None, this ensures we still have a db.
        try:
            init_db(current_app._get_current_object())
        except Exception:
            # current_app may not be available (outside app context)
            return None
    return db
