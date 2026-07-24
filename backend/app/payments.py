import razorpay
from flask import current_app

class RazorpayConfigError(RuntimeError):
    pass

def client():
    key_id = (current_app.config.get("RAZORPAY_KEY_ID") or "").strip()
    key_secret = (current_app.config.get("RAZORPAY_KEY_SECRET") or "").strip()
    if not key_id or not key_secret:
        raise RazorpayConfigError("Razorpay keys are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env")
    return razorpay.Client(auth=(key_id, key_secret))

def inr_to_paise(inr: int) -> int:
    return int(inr) * 100
