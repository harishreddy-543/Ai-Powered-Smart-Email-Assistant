import firebase_admin
from firebase_admin import credentials, messaging
from sqlalchemy.orm import Session
from app.models.models import Email, Preferences
import json
from app.services.agent_service import log_agent_activity

# Initialize Firebase app if not already initialized
try:
    if not firebase_admin._apps:
        import os
        key_path = os.path.join(os.path.dirname(__file__), '..', 'serviceAccountkey.json')
        if os.path.exists(key_path):
            cred = credentials.Certificate(key_path)
            firebase_admin.initialize_app(cred)
            print("Firebase Admin initialized successfully.")
        else:
            print(f"Service account key not found at {key_path}")
except Exception as e:
    print(f"Firebase Init Error: {e}")

class NotificationService:
    @staticmethod
    def send_push_notification(fcm_token: str, title: str, body: str, data: dict = None):
        """
        Send a real FCM push notification.
        """
        if not firebase_admin._apps:
            log_agent_activity("FCM_SKIP", f"Firebase not initialized. Skipped notification: {title}")
            return False
            
        try:
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                data=data or {},
                token=fcm_token,
            )
            response = messaging.send(message)
            log_agent_activity("FCM_SUCCESS", f"Sent FCM notification: {response}")
            return True
        except Exception as e:
            log_agent_activity("FCM_ERROR", f"Failed to send FCM notification: {e}")
            return False

    @staticmethod
    def process_email_for_notification(db: Session, email_id: int):
        """
        Process a newly classified email to see if it requires a push notification.
        Rule 1: Never modify email data.
        Rule 2: Respect user preferences.
        """
        email = db.query(Email).filter(Email.id == email_id).first()
        if not email:
            return
            
        pref = db.query(Preferences).filter(Preferences.user_id == email.user_id).first()
        if not pref or not pref.fcm_token:
            return
            
        title = None
        body = email.subject or "New important email"
        
        if email.is_phishing or email.final_verdict == "Phishing":
            title = "🔒 Security Alert"
        elif email.category == "Interview" or "interview" in (email.action_items or "").lower():
            title = "🔔 Interview Scheduled"
        elif email.category == "Job Offer":
            title = "🎉 Offer Received"
        elif email.deadlines and len(json.loads(email.deadlines)) > 0:
            title = "⏰ Deadline Alert"
            
        if title:
            log_agent_activity("NOTIFICATION_DISPATCH", f"Triggered push notification logic for '{title}'")
            NotificationService.send_push_notification(pref.fcm_token, title, body, {"email_id": str(email.id)})
