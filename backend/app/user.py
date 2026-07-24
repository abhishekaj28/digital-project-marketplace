from flask_login import UserMixin
from bson import ObjectId
from .db import get_db
from .extensions import login_manager

class User(UserMixin):
    def __init__(self, doc):
        self.doc = doc or {}
        self.id = str(self.doc.get("_id"))
        self.email = self.doc.get("email","")
        self.is_admin = bool(self.doc.get("is_admin", False))
        self.is_verified = bool(self.doc.get("is_verified", False))
        self.is_suspended = bool(self.doc.get("is_suspended", False))

    @property
    def is_active(self):
        # Suspended users are considered inactive in Flask-Login
        return not self.is_suspended

    @staticmethod
    def get(user_id: str):
        try:
            doc = get_db()["users"].find_one({"_id": ObjectId(user_id)})
            return User(doc) if doc else None
        except Exception:
            return None

@login_manager.user_loader
def load_user(user_id):
    return User.get(user_id)
