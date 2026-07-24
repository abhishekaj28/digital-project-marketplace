from flask import Blueprint, request, jsonify, abort, current_app
from bson import ObjectId
import re

from ..db import get_db, now_utc
from ..models import oid

bp = Blueprint("projects", __name__)

def get_artifact_size_bytes(art):
    if "size_bytes" in art and isinstance(art["size_bytes"], (int, float)):
        return int(art["size_bytes"])
    
    filename = art.get("filename")
    if filename:
        try:
            import os
            base_folder = current_app.config.get("UPLOAD_FOLDER", "app/uploads")
            file_path = os.path.join(base_folder, filename)
            if not os.path.exists(file_path):
                file_path = os.path.join("app/uploads", filename)
            if os.path.exists(file_path):
                return os.path.getsize(file_path)
        except Exception:
            pass
            
    return 0

def format_bytes(bytes_val):
    if bytes_val <= 0:
        return "0 B"
    sizes = ["B", "KB", "MB", "GB"]
    import math
    i = int(math.floor(math.log(bytes_val) / math.log(1024)))
    p = math.pow(1024, i)
    s = round(bytes_val / p, 2)
    return f"{s} {sizes[i]}"

def serialize_project(proj, db):
    domain_id = proj.get("domainId")
    domain_name = ""
    if domain_id:
        domain = db["domains"].find_one({"_id": domain_id})
        if domain:
            domain_name = domain.get("name", "")

    # Handle file list / artifacts from files collection
    files = list(db["files"].find({"projectId": proj["_id"]}))
    total_size = proj.get("totalFileSize", 0)
    
    # Standardize files list
    serialized_files = []
    for idx, f in enumerate(files):
        size_bytes = f.get("size_bytes", 0)
        size_str = f.get("fileSize", f.get("size", "Unknown"))
        fn = f.get("fileUrl", f.get("filename", ""))
        file_url = fn if fn.startswith("http") else f"/api/payments/download/{proj['_id']}/{fn}"
        
        serialized_files.append({
            "id": str(f["_id"]),
            "name": f.get("fileName", "File"),
            "fileKey": fn,
            "size": size_str,
            "type": f.get("fileType", fn.split(".")[-1].upper() if "." in fn else "FILE"),
            "fileName": f.get("fileName", "File"),
            "fileType": f.get("fileType", fn.split(".")[-1].upper() if "." in fn else "FILE"),
            "fileSize": size_str,
            "fileUrl": file_url,
            "uploadedAt": proj.get("updatedAt", proj.get("createdAt", now_utc())).isoformat() if hasattr(proj.get("updatedAt", ""), "isoformat") else str(proj.get("updatedAt", ""))
        })

    # Thumbnail URL normalization
    thumbnail_url = proj.get("thumbnailUrl", "")
    if thumbnail_url and not thumbnail_url.startswith("http"):
        base_url = current_app.config.get("APP_BASE_URL", "http://localhost:5000").rstrip("/")
        thumbnail_url = f"{base_url}/api/uploads/{thumbnail_url}"

    # Standardize description / longDescription
    desc = proj.get("description", proj.get("short_desc", ""))
    
    return {
        "id": str(proj["_id"]),
        "domainId": str(domain_id) if domain_id else "",
        "domainName": domain_name,
        "category": domain_name, # Map to category for frontend filtering
        "projectName": proj.get("projectName", proj.get("title", "")),
        "title": proj.get("projectName", proj.get("title", "")),
        "description": desc,
        "longDescription": proj.get("longDescription", proj.get("long_desc", desc)),
        "technologies": proj.get("technologies", []),
        "difficulty": proj.get("difficulty", "Medium"),
        "difficultyLevel": proj.get("difficulty", "Medium"),
        "price": proj.get("price", proj.get("price_inr", 0)),
        "thumbnailUrl": thumbnail_url,
        "thumbnail": thumbnail_url,
        "resourcesIncluded": proj.get("resourcesIncluded", []),
        "files": serialized_files,
        "filesList": serialized_files,
        "totalFiles": len(serialized_files),
        "totalSize": format_bytes(total_size) if total_size else "0 MB",
        "downloads": proj.get("downloadCount", proj.get("sales_count", 0)),
        "rating": proj.get("rating", 5.0),
        "createdAt": proj.get("createdAt").isoformat() if hasattr(proj.get("createdAt"), "isoformat") else str(proj.get("createdAt", "")),
        "updatedAt": proj.get("updatedAt").isoformat() if hasattr(proj.get("updatedAt"), "isoformat") else str(proj.get("updatedAt", ""))
    }

@bp.get("")
def list_projects():
    db = get_db()
    domain_id_raw = request.args.get("category") or request.args.get("domainId")
    price_filter = request.args.get("price")
    status = request.args.get("status")
    q = request.args.get("q")
    sort = request.args.get("sort")

    mongo_q = {}
    
    # Category / Domain filter
    if domain_id_raw:
        did = oid(domain_id_raw)
        if did:
            mongo_q["domainId"] = did
        else:
            # Match by domain name or slug
            import re as _re
            domain = db["domains"].find_one({
                "$or": [
                    {"name": {"$regex": f"^{_re.escape(domain_id_raw)}$", "$options": "i"}},
                    {"_id": domain_id_raw}
                ]
            })
            if domain:
                mongo_q["domainId"] = domain["_id"]
            else:
                return jsonify([]), 200

    # Price filter
    if price_filter:
        if price_filter == "under500":
            mongo_q["price"] = {"$lt": 500}
        elif price_filter == "500to1000":
            mongo_q["price"] = {"$gte": 500, "$lte": 1000}
        elif price_filter == "over1000":
            mongo_q["price"] = {"$gt": 1000}

    # Search filter
    if q:
        regex = re.compile(re.escape(q), re.IGNORECASE)
        mongo_q["$or"] = [
            {"projectName": {"$regex": regex}},
            {"title": {"$regex": regex}},
            {"description": {"$regex": regex}},
            {"technologies": {"$regex": regex}}
        ]

    # Sorting
    cursor = db["projects"].find(mongo_q)
    if sort == "priceAsc":
        cursor = cursor.sort("price", 1)
    elif sort == "priceDesc":
        cursor = cursor.sort("price", -1)
    elif sort == "rating":
        cursor = cursor.sort("rating", -1)
    elif sort == "newest":
        cursor = cursor.sort("createdAt", -1)
    elif sort == "popularity":
        cursor = cursor.sort("downloadCount", -1)
    else:
        cursor = cursor.sort("createdAt", -1)

    projs = [serialize_project(p, db) for p in cursor]
    return jsonify(projs), 200

@bp.get("/<project_id>")
def get_project_details(project_id):
    db = get_db()
    pid = oid(project_id)
    
    if pid:
        proj = db["projects"].find_one({"_id": pid})
    else:
        proj = db["projects"].find_one({"projectName": project_id})

    if not proj:
        return jsonify({"error": "Project not found"}), 404

    return jsonify(serialize_project(proj, db)), 200

@bp.get("/search")
def search_projects():
    db = get_db()
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify([]), 200

    regex = re.compile(re.escape(q), re.IGNORECASE)
    cursor = db["projects"].find({
        "$or": [
            {"projectName": {"$regex": regex}},
            {"title": {"$regex": regex}},
            {"description": {"$regex": regex}},
            {"technologies": {"$regex": regex}}
        ]
    }).sort("createdAt", -1)

    projs = [serialize_project(p, db) for p in cursor]
    return jsonify(projs), 200
