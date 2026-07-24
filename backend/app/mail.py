from flask import current_app
from flask_mail import Message
from .extensions import mail_ext
import traceback

def send_verification_email(to_email: str, verify_url: str):
    """
    Sends email verification token link. Falls back to terminal printing.
    """
    server = current_app.config.get("MAIL_SERVER")
    username = current_app.config.get("MAIL_USERNAME")
    
    if server == "localhost" or not username:
        print("="*60)
        print("EMAIL VERIFICATION (DEMO CONSOLE BYPASS)")
        print(f"To: {to_email}")
        print(f"From: {current_app.config.get('MAIL_SENDER')}")
        print(f"Verify: {verify_url}")
        print("="*60)
        return True

    try:
        html_body = f"""
        <h3>Welcome to Tech Project Marketplace</h3>
        <p>Please verify your email address to activate your account:</p>
        <p><a href="{verify_url}" style="display: inline-block; background: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Email Address</a></p>
        <p>Or paste this URL in your browser: <br>{verify_url}</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin-top: 30px;" />
        <p style="font-size: 12px; color: #666;">
          Need help? Contact Mr. Raghuraj at +91 9849258028 or email <a href="mailto:raghuraj@hotmail.com">raghuraj@hotmail.com</a>
        </p>
        """
        msg = Message(
            subject="Verify your Email Address",
            recipients=[to_email],
            html=html_body
        )
        mail_ext.send(msg)
        return True
    except Exception as e:
        print(f"Error sending email to {to_email}: {e}")
        traceback.print_exc()
        return False

def send_purchase_confirmation_email(to_email: str, user_name: str, project_title: str, price: float, download_url: str):
    """
    Sends payment invoice receipts. Falls back to terminal printing.
    """
    server = current_app.config.get("MAIL_SERVER")
    username = current_app.config.get("MAIL_USERNAME")
    
    if server == "localhost" or not username:
        print("="*60)
        print("PURCHASE CONFIRMATION (DEMO CONSOLE BYPASS)")
        print(f"To: {to_email}")
        print(f"Buyer Name: {user_name}")
        print(f"Project Purchased: {project_title}")
        print(f"Amount Paid: INR {price}")
        print(f"Secure Download: {download_url}")
        print("="*60)
        return True

    try:
        html_body = f"""
        <h3>Purchase Confirmation</h3>
        <p>Dear {user_name},</p>
        <p>Thank you for purchasing <strong>{project_title}</strong> (INR {price}).</p>
        <p>Your payment has been successfully processed. Access your secure deliverables using the link below:</p>
        <p><a href="{download_url}" style="display: inline-block; background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Download Files</a></p>
        <p>Secure link: {download_url}</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin-top: 30px;" />
        <p style="font-size: 12px; color: #666;">
          If you have any questions or require assistance, please contact Mr. Raghuraj at +91 9849258028 or <a href="mailto:raghuraj@hotmail.com">raghuraj@hotmail.com</a>.
        </p>
        """
        msg = Message(
            subject=f"Purchase Confirmation - {project_title}",
            recipients=[to_email],
            html=html_body
        )
        mail_ext.send(msg)
        return True
    except Exception as e:
        print(f"Error sending purchase invoice email to {to_email}: {e}")
        traceback.print_exc()
        return False
