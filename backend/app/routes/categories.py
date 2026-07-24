from flask import Blueprint, jsonify, request
from ..db import get_db
from ..models import oid

bp = Blueprint("categories", __name__)

def serialize_domain(domain, db):
    count = db["projects"].count_documents({"domainId": domain["_id"]})
    thumbnail = domain.get("thumbnailUrl", domain.get("thumbnail", ""))
    if thumbnail and not thumbnail.startswith("http"):
        thumbnail = f"/api/uploads/{thumbnail}"
    return {
        "id": str(domain["_id"]),
        "name": domain.get("name", ""),
        "slug": str(domain["_id"]),  # Using ID as slug or slugified name
        "description": domain.get("description", ""),
        "count": count,
        "thumbnailUrl": thumbnail,
        "thumbnail": thumbnail,
        "status": "active",
        "category": domain.get("categoryName", domain.get("category", ""))
    }

@bp.get("")
def list_domains():
    db = get_db()
    
    # Category filter
    category_filter = request.args.get("category") or request.args.get("categoryName")
    query = {}
    if category_filter and category_filter != "All":
        import re as _re
        query["categoryName"] = {"$regex": f"^{_re.escape(category_filter)}$", "$options": "i"}

    cursor = db["domains"].find(query).sort("name", 1)
    domains = [serialize_domain(d, db) for d in cursor]
    return jsonify(domains), 200

@bp.get("/<domain_id>")
def get_domain_details(domain_id):
    db = get_db()
    did = oid(domain_id)
    domain = None
    if did:
        domain = db["domains"].find_one({"_id": did})
    else:
        # Fallback to name match (case-insensitive)
        import re as _re
        domain = db["domains"].find_one({"name": {"$regex": f"^{_re.escape(domain_id)}$", "$options": "i"}})
    
    if not domain:
        return jsonify({"error": "Domain not found"}), 404
    return jsonify(serialize_domain(domain, db)), 200

@bp.get("/<domain_id>/projects")
def list_domain_projects(domain_id):
    db = get_db()
    did = oid(domain_id)
    query = {}
    if did:
        query["domainId"] = did
    else:
        # Match domain by name
        import re as _re
        domain = db["domains"].find_one({"name": {"$regex": f"^{_re.escape(domain_id)}$", "$options": "i"}})
        if domain:
            query["domainId"] = domain["_id"]
        else:
            return jsonify([]), 200

    cursor = db["projects"].find(query).sort("createdAt", -1)
    from .projects import serialize_project
    projs = [serialize_project(p, db) for p in cursor]
    return jsonify(projs), 200
