from flask import g
from .db import get_db, now_utc
from bson import ObjectId

def log_admin_action(action: str, entity_id: str | None = None, meta: dict | None = None):
    """Log admin actions using JWT-based g.current_user instead of flask_login."""
    try:
        user = getattr(g, "current_user", None)
        if not user:
            return
        get_db()["audit_logs"].insert_one({
            "created_at": now_utc(),
            "actor_id": user["_id"],
            "actor_email": user.get("email", ""),
            "action": action,
            "entity_id": entity_id,
            "meta": meta or {},
        })
    except Exception:
        pass
