import re, math, os
from werkzeug.utils import secure_filename
from flask import current_app

def slugify(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "item"

def allowed_ext(filename: str, allowed: set[str]) -> bool:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return ext in allowed

def validate_uploaded_file(file_storage, is_thumbnail=False) -> str | None:
    if not file_storage or not file_storage.filename:
        return "No file uploaded"
        
    filename = file_storage.filename
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    
    # Calculate size safely
    try:
        pos = file_storage.stream.tell()
        file_storage.stream.seek(0, os.SEEK_END)
        size_bytes = file_storage.stream.tell()
        file_storage.stream.seek(pos, os.SEEK_SET)
    except Exception:
        size_bytes = 0

    if is_thumbnail:
        allowed = {"png", "jpg", "jpeg", "webp"}
        if ext not in allowed:
            return "Invalid image type. Allowed: PNG, JPG, JPEG, WEBP"
        if size_bytes > 5 * 1024 * 1024:
            return "Thumbnail size exceeds limit of 5MB."
    else:
        allowed_docs = {"pdf", "ppt", "pptx", "doc", "docx"}
        if ext == "zip":
            if size_bytes > 500 * 1024 * 1024:
                return "File size exceeds limit of 500MB for ZIP files."
        elif ext in allowed_docs:
            if size_bytes > 100 * 1024 * 1024:
                return "File size exceeds limit of 100MB for document files."
        else:
            return "Invalid file type. Allowed: ZIP, PDF, PPT, PPTX, DOC, DOCX"
            
    return None

def safe_filesize_ok(file_storage) -> bool:
    # Basic size guard (in-memory). For large files, use streaming checks.
    max_bytes = int(current_app.config.get("MAX_UPLOAD_MB", 25)) * 1024 * 1024
    try:
        pos = file_storage.stream.tell()
        file_storage.stream.seek(0, os.SEEK_END)
        size = file_storage.stream.tell()
        file_storage.stream.seek(pos, os.SEEK_SET)
        return size <= max_bytes
    except Exception:
        return True

class Pagination:
    def __init__(self, page: int, per_page: int, total: int, url_builder):
        self.page = max(1, int(page))
        self.per_page = max(1, int(per_page))
        self.total = max(0, int(total))
        self.total_pages = max(1, math.ceil(self.total / self.per_page)) if self.total else 1
        self._url_builder = url_builder

    def url_for_page(self, p: int):
        p = max(1, min(self.total_pages, int(p)))
        return self._url_builder(p)

    @property
    def pages(self):
        if self.total_pages <= 7:
            return list(range(1, self.total_pages + 1))
        w = 2
        start = max(1, self.page - w)
        end = min(self.total_pages, self.page + w)
        pages = set([1, self.total_pages])
        pages.update(range(start, end + 1))
        return sorted(pages)
