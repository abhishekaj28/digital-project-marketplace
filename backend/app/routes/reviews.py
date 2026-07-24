from flask import Blueprint, request, jsonify, g
from bson import ObjectId

from ..db import get_db, now_utc
from ..security import jwt_required
from ..models import oid

bp = Blueprint("reviews", __name__)

@bp.post("")
@jwt_required
def create_review():
    db = get_db()
    data = request.get_json(force=True, silent=True) or {}
    project_id_str = data.get("projectId")
    rating = data.get("rating")
    comment = (data.get("comment") or "").strip()

    pid = oid(project_id_str)
    if not pid:
        return jsonify({"error": "Invalid project ID."}), 400

    try:
        rating = int(rating)
        if rating < 1 or rating > 5:
            raise ValueError()
    except Exception:
        return jsonify({"error": "Rating must be an integer between 1 and 5."}), 400

    if not comment:
        return jsonify({"error": "Comment is required."}), 400

    user = g.current_user
    uid = user["_id"]

    # Verify if user has purchased the project
    purchase = db["purchases"].find_one({
        "user_id": uid,
        "project_id": pid,
        "status": "completed"
    })
    if not purchase:
        return jsonify({"error": "You must purchase this project before leaving a review."}), 403

    # Check if review already exists
    existing = db["reviews"].find_one({"user_id": uid, "project_id": pid})
    if existing:
        return jsonify({"error": "You have already reviewed this project."}), 400

    # Insert Review
    review_doc = {
        "user_id": uid,
        "user_name": user.get("name", user["email"].split("@")[0]),
        "project_id": pid,
        "rating": rating,
        "comment": comment,
        "created_at": now_utc()
    }
    db["reviews"].insert_one(review_doc)

    # Recalculate average rating and reviews count for the project
    pipeline = [
        {"$match": {"project_id": pid}},
        {"$group": {"_id": None, "avg_rating": {"$avg": "$rating"}, "count": {"$sum": 1}}}
    ]
    stats = list(db["reviews"].aggregate(pipeline))
    if stats:
        avg_rating = round(stats[0]["avg_rating"], 1)
        count = stats[0]["count"]
    else:
        avg_rating = 5.0
        count = 0

    db["projects"].update_one(
        {"_id": pid},
        {"$set": {"rating": avg_rating, "reviewsCount": count}}
    )

    return jsonify({"message": "Review submitted successfully."}), 201

@bp.get("/<project_id>")
def get_reviews(project_id):
    db = get_db()
    pid = oid(project_id)
    if not pid:
        return jsonify([]), 200

    cursor = db["reviews"].find({"project_id": pid}).sort("created_at", -1)
    reviews = []
    for r in cursor:
        reviews.append({
            "id": str(r["_id"]),
            "projectId": str(r["project_id"]),
            "user": r.get("user_name", "Anonymous"),
            "rating": r.get("rating", 5),
            "comment": r.get("comment", ""),
            "date": r["created_at"].isoformat() if hasattr(r["created_at"], "isoformat") else str(r["created_at"])
        })

    return jsonify(reviews), 200
