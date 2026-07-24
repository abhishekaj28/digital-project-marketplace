from bson import ObjectId
from ..db import get_db, now_utc

def oid(s: str):
    try:
        return ObjectId(s)
    except Exception:
        return None

def get_user_by_email(email: str):
    return get_db()["users"].find_one({"email": email})

def create_user(email: str, password_hash: str):
    doc = {
        "email": email,
        "password_hash": password_hash,
        "is_verified": False,
        "is_admin": False,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    get_db()["users"].insert_one(doc)
    return get_db()["users"].find_one({"email": email})

def mark_verified(email: str):
    get_db()["users"].update_one({"email": email}, {"$set":{"is_verified": True, "updated_at": now_utc()}})

def is_purchase_completed(user_id, project_id):
    from bson import ObjectId
    try:
        uid = ObjectId(user_id) if isinstance(user_id, str) else user_id
    except Exception:
        uid = user_id
    try:
        pid = ObjectId(project_id) if isinstance(project_id, str) else project_id
    except Exception:
        pid = project_id
    return get_db()["purchases"].find_one({"user_id": uid, "project_id": pid, "status":"completed"}) is not None
