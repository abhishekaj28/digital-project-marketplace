from flask import Blueprint, request, jsonify, g
from bson import ObjectId

from ..db import get_db, now_utc
from ..security import jwt_required
from ..models import oid
from .projects import serialize_project

bp = Blueprint("wishlist", __name__)

@bp.post("/add")
@jwt_required
def add_to_wishlist():
    db = get_db()
    data = request.get_json(force=True, silent=True) or {}
    project_id_str = data.get("projectId")

    pid = oid(project_id_str)
    if not pid:
        return jsonify({"error": "Invalid project ID."}), 400

    uid = g.current_user["_id"]
    
    # Check if already wishes
    existing = db["wishlist"].find_one({"user_id": uid, "project_id": pid})
    if not existing:
        db["wishlist"].insert_one({
            "user_id": uid,
            "project_id": pid,
            "created_at": now_utc()
        })

    return jsonify({"message": "Added to wishlist."}), 200

@bp.delete("/remove/<project_id>")
@jwt_required
def remove_from_wishlist(project_id):
    db = get_db()
    pid = oid(project_id)
    if not pid:
        return jsonify({"error": "Invalid project ID."}), 400

    uid = g.current_user["_id"]
    db["wishlist"].delete_one({"user_id": uid, "project_id": pid})

    return jsonify({"message": "Removed from wishlist."}), 200

@bp.get("")
@jwt_required
def get_wishlist():
    db = get_db()
    uid = g.current_user["_id"]
    cursor = db["wishlist"].find({"user_id": uid})
    
    project_ids = [w["project_id"] for w in cursor]
    if not project_ids:
        return jsonify([]), 200

    projects_cursor = db["projects"].find({"_id": {"$in": project_ids}})
    projs = [serialize_project(p, db) for p in projects_cursor]
    return jsonify(projs), 200
