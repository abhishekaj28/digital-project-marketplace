from flask_mail import Mail

# Only Flask-Mail is used. Flask-Login and Flask-WTF have been
# replaced by custom JWT authentication (see app/security.py).
mail_ext = Mail()
