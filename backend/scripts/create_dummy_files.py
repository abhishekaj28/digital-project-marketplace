from app import create_app
from app.storage import ensure_dummy_files

app = create_app()
with app.app_context():
    ensure_dummy_files()
    print("Dummy files ensured in uploads/demo/")
