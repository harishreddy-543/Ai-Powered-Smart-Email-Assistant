from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
import datetime
from app.db.session import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True) # Now nullable because Google auth users won't have a password
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Real Email Integration Fields
    imap_server = Column(String, nullable=True)
    imap_username = Column(String, nullable=True)
    imap_password_encrypted = Column(String, nullable=True)
    
    # Google OAuth Fields
    google_access_token = Column(String, nullable=True)
    google_refresh_token = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    emails = relationship("Email", back_populates="user", cascade="all, delete-orphan")
    preferences = relationship("Preferences", back_populates="user", uselist=False, cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="user", cascade="all, delete-orphan")


class Email(Base):
    __tablename__ = "emails"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    thread_id = Column(String, index=True, nullable=True)
    message_id = Column(String, unique=True, index=True, nullable=True)
    sender = Column(String, nullable=False)
    recipient = Column(String, nullable=False)
    subject = Column(String, nullable=True)
    body = Column(Text, nullable=True)
    received_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_read = Column(Boolean, default=False)
    
    # AI Classification Results
    category = Column(String, default="Unclassified")  # Work, Personal, Promotional, etc.
    priority = Column(String, default="Medium")        # Low, Medium, High, Critical
    sentiment = Column(String, default="Neutral")      # Positive, Neutral, Negative
    spam_score = Column(Float, default=0.0)
    phishing_score = Column(Float, default=0.0)
    
    # Security Engine Signals
    spf_status = Column(String, nullable=True)         # Pass, Fail, SoftFail, None
    dkim_status = Column(String, nullable=True)        # Pass, Fail, None
    dmarc_status = Column(String, nullable=True)       # Pass, Fail, None
    domain_impersonation = Column(Boolean, default=False)
    phishing_reasons = Column(Text, nullable=True)     # JSON encoded list of reasons
    trust_score = Column(Float, default=0.0)           # 0 to 1 scale
    final_verdict = Column(String, default="Safe")     # Safe, Suspicious, Phishing
    
    # Metadata
    is_simulated = Column(Boolean, default=False)
    is_spam = Column(Boolean, default=False)
    is_phishing = Column(Boolean, default=False)
    is_starred = Column(Boolean, default=False)
    system_label = Column(String, default="INBOX")
    
    # Intelligence & Cleaning Pipeline
    clean_body = Column(Text, nullable=True)
    key_points = Column(Text, nullable=True)     # JSON encoded list of key points
    intent = Column(String, nullable=True)
    reply_required = Column(Boolean, default=False)
    reply_reason = Column(String, nullable=True)
    recommended_action = Column(String, nullable=True)
    summary = Column(Text, nullable=True)
    action_items = Column(Text, nullable=True) # JSON encoded list
    deadlines = Column(Text, nullable=True) # JSON encoded list
    why_it_matters = Column(Text, nullable=True)
    needs_alert = Column(Boolean, default=False)
    
    # Relationships
    user = relationship("User", back_populates="emails")
    entities = relationship("Entity", back_populates="email", cascade="all, delete-orphan")
    replies = relationship("Reply", back_populates="email", cascade="all, delete-orphan")
    feedback = relationship("Feedback", back_populates="email", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="email", cascade="all, delete-orphan")


class Alert(Base):
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    email_id = Column(Integer, ForeignKey("emails.id"), nullable=False)
    alert_type = Column(String, nullable=False) # e.g. Phishing, Job, Education, Watchlist
    severity = Column(String, default="Medium") # Low, Medium, High, Critical
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    trigger_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_read = Column(Boolean, default=False)
    delivery_status = Column(String, default="In-App") # In-App, Push, Email
    
    # Relationships
    user = relationship("User", back_populates="alerts")
    email = relationship("Email", back_populates="alerts")


class Entity(Base):
    __tablename__ = "entities"

    id = Column(Integer, primary_key=True, index=True)
    email_id = Column(Integer, ForeignKey("emails.id"), nullable=False)
    entity_type = Column(String, nullable=False)  # ORG, PERSON, DATE, MONEY, etc.
    entity_value = Column(String, nullable=False)

    # Relationships
    email = relationship("Email", back_populates="entities")


class Reply(Base):
    __tablename__ = "replies"
    
    id = Column(Integer, primary_key=True, index=True)
    email_id = Column(Integer, ForeignKey("emails.id"), nullable=False)
    generated_body = Column(Text, nullable=False)
    status = Column(String, default="Suggested") # Suggested, Sent, Rejected, Edited
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Advanced Smart Reply Tracking
    tone = Column(String, nullable=True)
    length_preference = Column(String, nullable=True)
    is_reply_recommended = Column(Boolean, default=True)
    recommendation_reason = Column(String, nullable=True)
    edited_text = Column(Text, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    provider_message_id = Column(String, nullable=True)
    model_version = Column(String, nullable=True)
    ai_explanation = Column(Text, nullable=True)
    
    # Relationship
    email = relationship("Email", back_populates="replies")


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    email_id = Column(Integer, ForeignKey("emails.id"), nullable=False)
    feedback_type = Column(String, nullable=False)  # category_correction, spam_correction, response_rating
    corrected_value = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    email = relationship("Email", back_populates="feedback")


class Preferences(Base):
    __tablename__ = "preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    writing_style = Column(String, default="Professional")  # Professional, Friendly, Direct
    auto_reply_enabled = Column(Boolean, default=False)
    summary_bullet_count = Column(Integer, default=5)
    
    # Alert Preferences (Stored as JSON strings)
    alert_keywords = Column(Text, nullable=True) # Legacy
    alert_categories = Column(Text, nullable=True) # Legacy
    
    # Advanced AI Preferences
    career_interests = Column(Text, nullable=True) # e.g. '["Data Analyst", "AI Engineer"]'
    favorite_companies = Column(Text, nullable=True) # e.g. '["Google", "TCS"]'
    always_notify = Column(Text, nullable=True) # e.g. '["Interviews", "Security Alerts"]'
    notification_methods = Column(Text, nullable=True) # e.g. '["Desktop", "Browser"]'
    reminder_timing = Column(Text, nullable=True) # e.g. '["1 Day Before", "3 Hours Before"]'
    ai_learning_enabled = Column(Boolean, default=True)
    
    digest_enabled = Column(Boolean, default=True)
    fcm_token = Column(String, nullable=True)

    # Relationships
    user = relationship("User", back_populates="preferences")


class ScheduledEmail(Base):
    __tablename__ = 'scheduled_emails'
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    to = Column(String, nullable=False)
    cc = Column(String, nullable=True)
    bcc = Column(String, nullable=True)
    subject = Column(String, default='')
    body = Column(Text, default='')
    scheduled_at = Column(DateTime, nullable=False)
    status = Column(String, default='pending')  # pending, sent, cancelled
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    user = relationship('User')


class LinkedAccount(Base):
    __tablename__ = 'linked_accounts'
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    email = Column(String, nullable=False)
    google_access_token = Column(String, nullable=True)
    google_refresh_token = Column(String, nullable=True)
    is_active = Column(Boolean, default=False)
    display_name = Column(String, nullable=True)
    last_synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    user = relationship('User')


class DeletedEmail(Base):
    __tablename__ = 'deleted_emails'
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    message_id = Column(String, index=True, nullable=False)
    deleted_at = Column(DateTime, default=datetime.datetime.utcnow)
