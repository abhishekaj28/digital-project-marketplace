import os
from pathlib import Path
from werkzeug.utils import secure_filename
from flask import current_app
import secrets
import cloudinary
import cloudinary.uploader

class LocalStorage:
    def __init__(self, base_folder: str):
        self.base = Path(base_folder)
        self.base.mkdir(parents=True, exist_ok=True)

    def save(self, file_storage, filename: str) -> str:
        fn = secure_filename(filename)
        key = f"{secrets.token_hex(8)}_{fn}"
        path = self.base / key
        file_storage.save(path)
        return key

    def delete(self, key_or_url: str):
        if not key_or_url:
            return
        key = key_or_url.split("/")[-1] if "/" in key_or_url else key_or_url
        path = self.base / key
        if path.exists():
            path.unlink()

    def full_path(self, key: str) -> str:
        return str(self.base / key)

    def presigned_download_url(self, key: str, as_attachment=True, download_name=None):
        return None

class CloudinaryStorage:
    def __init__(self):
        cloudinary.config(
            cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
            api_key=os.getenv("CLOUDINARY_API_KEY"),
            api_secret=os.getenv("CLOUDINARY_API_SECRET"),
            secure=True
        )

    def save(self, file_storage, filename: str) -> str:
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        resource_type = "image" if ext in {"png", "jpg", "jpeg", "webp", "gif"} else "raw"
        
        # Upload to Cloudinary
        upload_result = cloudinary.uploader.upload(
            file_storage,
            resource_type=resource_type,
            folder="projecthub"
        )
        return upload_result.get("secure_url")

    def delete(self, url_or_key: str):
        if not url_or_key or not url_or_key.startswith("http"):
            return
        try:
            parts = url_or_key.split("/")
            filename = parts[-1]
            public_id = filename.rsplit(".", 1)[0]
            if "projecthub" in url_or_key:
                public_id = f"projecthub/{public_id}"
            
            ext = url_or_key.rsplit(".", 1)[-1].lower() if "." in url_or_key else ""
            resource_type = "image" if ext in {"png", "jpg", "jpeg", "webp", "gif"} else "raw"
            
            cloudinary.uploader.destroy(public_id, resource_type=resource_type)
        except Exception as e:
            if current_app:
                current_app.logger.warning(f"Failed to delete asset from Cloudinary: {e}")
            else:
                print(f"Failed to delete asset from Cloudinary: {e}")

    def presigned_download_url(self, key_or_url: str, as_attachment=True, download_name=None):
        return key_or_url

def get_storage():
    backend = (current_app.config.get("STORAGE_BACKEND") or "local").lower()
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
    if backend == "cloudinary" and cloud_name:
        return CloudinaryStorage()
    return LocalStorage(current_app.config["UPLOAD_FOLDER"])

def ensure_dummy_files():
    base = Path(current_app.config["UPLOAD_FOLDER"]) if current_app else Path("app/uploads")
    demo = base / "demo"
    demo.mkdir(parents=True, exist_ok=True)

    # create dummy images and files if not present
    for fname in ["ipl_cover.jpg","ipl_1.jpg","ipl_2.jpg","cyber_cover.jpg","cyber_1.jpg"]:
        p = demo / fname
        if not p.exists():
            p.write_bytes(b"")  # dummy placeholder

    for fname in ["ipl_source.zip","ipl_report.pdf","ipl_dataset.csv","cyber_source.zip","cyber_dataset.csv"]:
        p = demo / fname
        if not p.exists():
            p.write_text("DUMMY FILE", encoding="utf-8")
