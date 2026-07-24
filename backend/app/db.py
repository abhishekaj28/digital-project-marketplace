from pymongo import MongoClient
from flask import current_app
from datetime import datetime, timedelta

# Mock Database & Collection for fallback demo mode
class MockCollection:
    def __init__(self, name, db_ref):
        self.name = name
        self.db = db_ref
        self._data = []

    def create_index(self, *args, **kwargs):
        pass

    def count_documents(self, filter, **kwargs):
        return len(list(self.find(filter)))

    def insert_one(self, doc):
        from bson import ObjectId
        if "_id" not in doc:
            doc["_id"] = ObjectId()
        self._data.append(doc)
        class InsertResult:
            def __init__(self, inserted_id):
                self.inserted_id = inserted_id
        return InsertResult(doc["_id"])

    def find_one(self, filter, *args, **kwargs):
        res = list(self.find(filter))
        return res[0] if res else None

    def find(self, filter=None, *args, **kwargs):
        filter = filter or {}
        results = []
        for doc in self._data:
            match = True
            for k, v in filter.items():
                if isinstance(v, dict) and "$exists" in v:
                    exists = v["$exists"]
                    has_key = k in doc
                    if exists != has_key:
                        match = False
                        break
                elif isinstance(v, dict) and "$regex" in v:
                    import re
                    pattern = v["$regex"]
                    options = v.get("$options", "")
                    flags = 0
                    if "i" in options:
                        flags |= re.IGNORECASE
                    if not re.search(pattern, str(doc.get(k, "")), flags):
                        match = False
                        break
                else:
                    if doc.get(k) != v:
                        match = False
                        break
            if match:
                results.append(doc)
        
        class MockCursor:
            def __init__(self, data):
                self.data = data
            def sort(self, *args, **kwargs):
                return self
            def __iter__(self):
                return iter(self.data)
            def __getitem__(self, index):
                return self.data[index]
        return MockCursor(results)

    def delete_one(self, filter):
        doc = self.find_one(filter)
        if doc in self._data:
            self._data.remove(doc)

    def _apply_update(self, doc, update):
        if "$set" in update:
            for k, v in update["$set"].items():
                doc[k] = v
        if "$inc" in update:
            for k, v in update["$inc"].items():
                doc[k] = doc.get(k, 0) + v

    def update_one(self, filter, update, **kwargs):
        doc = self.find_one(filter)
        if doc:
            self._apply_update(doc, update)
        class UpdateResult:
            def __init__(self, matched_count, modified_count):
                self.matched_count = matched_count
                self.modified_count = modified_count
        return UpdateResult(1 if doc else 0, 1 if doc else 0)

    def update_many(self, filter, update, **kwargs):
        docs = list(self.find(filter))
        modified_count = 0
        for doc in docs:
            self._apply_update(doc, update)
            modified_count += 1
        class UpdateResult:
            def __init__(self, matched_count, modified_count):
                self.matched_count = matched_count
                self.modified_count = modified_count
        return UpdateResult(len(docs), modified_count)

    def drop(self):
        self._data = []

class MockDatabase:
    def __init__(self):
        self._collections = {}
        self.name = "mock_database"

    def __getitem__(self, name):
        if name not in self._collections:
            self._collections[name] = MockCollection(name, self)
        return self._collections[name]

client = None
db = None

def init_db(app):
    global client, db
    try:
        client = MongoClient(app.config["MONGO_URI"], serverSelectionTimeoutMS=2000)
        # Test connection immediately to trigger timeout/auth exceptions early
        client.server_info()
        
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
        print(f"Database initialization warning: {e}. Falling back to in-memory mock database.")
        db = MockDatabase()
        seed_if_empty()

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
            seed_database(db)
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
