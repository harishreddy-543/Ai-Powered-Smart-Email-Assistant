# AI-Powered Email Assistant - Authentication Module
from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
import imaplib
import os
import json

import google_auth_oauthlib.flow
from googleapiclient.discovery import build

from app.core import security
from app.core.config import settings
from app.db.session import get_db
from app.models import models
from app.schemas import schemas
from app.api import deps

router = APIRouter()

def guess_imap_server(email_address: str) -> str:
    domain = email_address.split('@')[-1].lower()
    if domain in ['gmail.com', 'googlemail.com']:
        return 'imap.gmail.com'
    elif domain in ['outlook.com', 'hotmail.com', 'live.com']:
        return 'outlook.office365.com'
    elif domain in ['yahoo.com', 'ymail.com']:
        return 'imap.mail.yahoo.com'
    elif domain in ['icloud.com', 'me.com', 'mac.com']:
        return 'imap.mail.me.com'
    return f'imap.{domain}'

@router.post("/login", response_model=schemas.Token)
def login(
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, using REAL IMAP verification.
    """
    email_address = form_data.username.lower()
    password = form_data.password
    imap_server = guess_imap_server(email_address)
    
    # 1. Verify IMAP connection
    try:
        mail = imaplib.IMAP4_SSL(imap_server, timeout=10)
        mail.login(email_address, password)
        mail.logout()
    except imaplib.IMAP4.error as e:
        raise HTTPException(
            status_code=400, detail=f"IMAP Auth Failed. If using Gmail, you MUST use a 16-character 'App Password', not your normal password."
        )
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Could not connect to {imap_server}. Error: {str(e)}"
        )
        
    # 2. Connection successful, find or create user
    user = db.query(models.User).filter(models.User.email == email_address).first()
    
    encrypted_pwd = security.encrypt_imap_password(password)
    
    if not user:
        # Create new user
        user = models.User(
            email=email_address,
            full_name=email_address.split('@')[0],
            imap_server=imap_server,
            imap_username=email_address,
            imap_password_encrypted=encrypted_pwd
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Create default preferences
        db_pref = models.Preferences(
            user_id=user.id,
            writing_style="Professional",
            auto_reply_enabled=False,
            summary_bullet_count=5
        )
        db.add(db_pref)
        db.commit()
    else:
        # Update existing user's IMAP credentials in case they changed
        user.imap_server = imap_server
        user.imap_username = email_address
        user.imap_password_encrypted = encrypted_pwd
        db.commit()
        
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.email, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }

# ---------------------------------------------------------
# GOOGLE OAUTH FLOW
# ---------------------------------------------------------
from dotenv import load_dotenv
load_dotenv()

CLIENT_SECRETS_FILE = os.getenv("GOOGLE_CLIENT_SECRET_FILE", "client_secret.json")
# Using a hardcoded client ID/secret from ENV is easier for demo purposes:
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://mail.google.com/',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid'
]

# In-memory store for PKCE verifiers to avoid cross-origin cookie issues
OAUTH_SESSIONS = {}

@router.get("/google/login")
def google_login(request: Request):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=500, 
            detail="Google OAuth is not configured on the server. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables or create a client_secret.json file."
        )
        
    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost:8000/api/v1/auth/google/callback"]
        }
    }
    
    flow = google_auth_oauthlib.flow.Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri="http://localhost:8000/api/v1/auth/google/callback"
    )
    
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent'
    )
    
    if hasattr(flow, 'code_verifier'):
        OAUTH_SESSIONS[state] = flow.code_verifier
    
    from fastapi.responses import JSONResponse
    response = JSONResponse(content={"url": authorization_url})
        
    return response

@router.get("/google/callback")
def google_callback(request: Request, state: str = None, code: str = None):
    if not code:
        return RedirectResponse(url="http://localhost:5173/?error=missing_code")
        
    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost:8000/api/v1/auth/google/callback"]
        }
    }
    
    flow = google_auth_oauthlib.flow.Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri="http://localhost:8000/api/v1/auth/google/callback"
    )
    
    # Retrieve the PKCE code_verifier from memory
    code_verifier = OAUTH_SESSIONS.pop(state, None)
    if code_verifier:
        flow.code_verifier = code_verifier
        
    try:
        flow.fetch_token(code=code)
    except Exception as e:
        print(f"Error fetching token: {e}")
        return RedirectResponse(url="http://localhost:5173/?error=oauth_failed")
        
    credentials = flow.credentials
    
    # Get user info
    try:
        service = build('oauth2', 'v2', credentials=credentials)
        user_info = service.userinfo().get().execute()
        email_address = user_info.get('email')
        full_name = user_info.get('name')
    except Exception as e:
        print(f"Error fetching user info: {e}")
        return RedirectResponse(url="http://localhost:5173/?error=oauth_failed")
        
    if not email_address:
        return RedirectResponse(url="http://localhost:5173/?error=missing_email")
        
    db = next(get_db())
    user = db.query(models.User).filter(models.User.email == email_address).first()
    
    if not user:
        user = models.User(
            email=email_address,
            full_name=full_name,
            google_access_token=credentials.token,
            google_refresh_token=credentials.refresh_token
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        db_pref = models.Preferences(
            user_id=user.id,
            writing_style="Professional",
            auto_reply_enabled=False,
            summary_bullet_count=5
        )
        db.add(db_pref)
        db.commit()
    else:
        user.google_access_token = credentials.token
        if credentials.refresh_token:
            user.google_refresh_token = credentials.refresh_token
        db.commit()
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    jwt_token = security.create_access_token(
        user.email, expires_delta=access_token_expires
    )
    
    # Redirect to frontend with JWT
    return RedirectResponse(url=f"http://localhost:5173/?token={jwt_token}")

@router.get("/me", response_model=schemas.UserResponse)
def read_user_me(
    current_user: models.User = Depends(deps.get_current_user)
) -> Any:
    """
    Get current user.
    """
    return current_user
