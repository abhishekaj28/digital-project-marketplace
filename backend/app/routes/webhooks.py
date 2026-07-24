from flask import Blueprint, request, current_app, jsonify
import hmac, hashlib, json

from ..db import get_db, now_utc

bp = Blueprint("webhooks", __name__)

@bp.post("/webhook/razorpay")
def razorpay_webhook():
    secret = current_app.config.get("RAZORPAY_WEBHOOK_SECRET","")
    body = request.get_data() or b""
    sig = request.headers.get("X-Razorpay-Signature","")

    ok = False
    if secret:
        expected = hmac.new(secret.encode("utf-8"), body, digestmod=hashlib.sha256).hexdigest()
        ok = hmac.compare_digest(expected, sig)

    payload = {}
    try:
        payload = json.loads(body.decode("utf-8"))
    except Exception:
        payload = {}

    event_id = payload.get("event") or payload.get("payload", {}).get("payment", {}).get("entity", {}).get("id") or ""
    event_type = payload.get("event","unknown")

    get_db()["webhook_events"].insert_one({
        "created_at": now_utc(),
        "event_id": event_id,
        "event_type": event_type,
        "signature_ok": ok,
        "payload": payload if not current_app.debug else {"note":"payload stored (debug)"},
    })

    # Update purchases based on webhook (source of truth)
    if ok:
        # Typical: payload.payment.entity.order_id
        order_id = payload.get("payload", {}).get("payment", {}).get("entity", {}).get("order_id")
        payment_id = payload.get("payload", {}).get("payment", {}).get("entity", {}).get("id")
        status = payload.get("payload", {}).get("payment", {}).get("entity", {}).get("status")  # captured/failed

        if order_id:
            if status == "captured":
                promo = get_db()["book_promotions"].find_one({"isEnabled": True})
                promo_data = {}
                if promo:
                    promo_data = {
                        "bookUnlocked": True,
                        "bookOfferUnlocked": True,
                        "couponCode": promo.get("couponCode", ""),
                        "publisherWebsite": promo.get("publisherWebsite", ""),
                        "publisherLink": promo.get("publisherWebsite", ""),
                        "publisherName": promo.get("publisherName", ""),
                        "publisherLogo": promo.get("publisherLogo", ""),
                        "purchaseDate": now_utc()
                    }
                else:
                    promo_data = {
                        "bookUnlocked": False,
                        "bookOfferUnlocked": False,
                        "couponCode": "",
                        "publisherWebsite": "",
                        "publisherLink": "",
                        "publisherName": "",
                        "publisherLogo": "",
                        "purchaseDate": None
                    }

                get_db()["purchases"].update_one(
                    {"razorpay_order_id": order_id},
                    {"$set":{
                        "status":"completed",
                        "razorpay_payment_id": payment_id or "",
                        "updated_at": now_utc(),
                        **promo_data
                    }}
                )
                get_db()["orders"].update_one(
                    {"razorpay_order_id": order_id},
                    {"$set":{
                        "status":"completed",
                        "razorpay_payment_id": payment_id or "",
                        **promo_data
                    }}
                )
            elif status in ("failed", "authorized"):
                get_db()["purchases"].update_one(
                    {"razorpay_order_id": order_id},
                    {"$set":{"status":"failed","razorpay_payment_id": payment_id or "", "updated_at": now_utc()}}
                )
                get_db()["orders"].update_one(
                    {"razorpay_order_id": order_id},
                    {"$set":{"status":"failed","razorpay_payment_id": payment_id or ""}}
                )

    return jsonify({"ok": True})
