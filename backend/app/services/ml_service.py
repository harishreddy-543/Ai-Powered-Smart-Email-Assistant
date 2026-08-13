import os
import re
import joblib
import numpy as np
from typing import List, Dict, Tuple, Any

# Paths to ML models
ML_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "ml", "models")

# Load models and vectorizers with defensive fallback checking
def load_model_file(name: str):
    path = os.path.join(ML_DIR, name)
    if os.path.exists(path):
        try:
            return joblib.load(path)
        except Exception as e:
            print(f"Error loading model {name}: {e}")
    return None

models_cache = {
    "spam_model": load_model_file("spam_model.joblib"),
    "spam_vec": load_model_file("spam_vectorizer.joblib"),
    "category_model": load_model_file("category_model.joblib"),
    "category_vec": load_model_file("category_vectorizer.joblib"),
    "category_encoder": load_model_file("category_encoder.joblib"),
    "phishing_model": load_model_file("phishing_model.joblib"),
    "phishing_vec": load_model_file("phishing_vectorizer.joblib"),
    "priority_model": load_model_file("priority_model.joblib"),
    "priority_vec": load_model_file("priority_vectorizer.joblib"),
    "priority_encoder": load_model_file("priority_encoder.joblib"),
}

# --- Defensive Rule-Based Fallbacks for Cold Starts ---

def fallback_is_spam(text: str) -> Tuple[bool, float]:
    text_lower = text.lower()
    if any(w in text_lower for w in ["linkedin", "placement", "job"]):
        return False, 0.0
    spam_words = ["free iphone", "lottery winner", "earn money fast", "get rich quick", "cheap pharmacy", "prince from nigeria", "bitcoin returns", "miracle weight loss", "buy generic"]
    hits = sum(1 for w in spam_words if w in text_lower)
    score = min(0.95, hits * 0.3)
    return score > 0.4, score

def fallback_category(text: str) -> str:
    text_lower = text.lower()
    if any(w in text_lower for w in ["linkedin", "placement", "job", "course", "assignment", "interview", "resume", "webinar"]):
        return "Education & Career"
    if any(w in text_lower for w in ["invoice", "payment", "bank statement", "tax document", "credit card", "transaction", "salary", "expense"]):
        return "Finance & Payments"
    if any(w in text_lower for w in ["order", "shipped", "delivery", "purchase", "cart", "refund", "receipt"]):
        return "Orders & Shopping"
    if any(w in text_lower for w in ["flight", "hotel", "train ticket", "rental", "itinerary", "airbnb", "booking"]):
        return "Travel & Bookings"
    if any(w in text_lower for w in ["password", "login", "verify", "two-factor", "security alert", "unusual activity", "locked"]):
        return "Security & Account"
    if any(w in text_lower for w in ["action required", "nda", "attention is needed", "verify your identity", "pending approval"]):
        return "Action Required"
    if any(w in text_lower for w in ["github", "maintenance", "version", "newsletter", "update on", "status has been updated", "new features"]):
        return "Updates & Notifications"
    if any(w in text_lower for w in ["exclusive offer", "sale", "discount", "buy one get one", "flash sale", "premium", "limited time"]):
        return "Promotions & Marketing"
    if any(w in text_lower for w in ["dinner saturday", "mom", "birthday", "catch up over coffee", "movie", "anniversary", "checking in"]):
        return "Personal"
    return "Work & Projects"

def fallback_is_phishing(text: str) -> Tuple[bool, float]:
    text_lower = text.lower()
    if any(w in text_lower for w in ["linkedin", "placement", "job"]):
        return False, 0.0
    urgent_keywords = ["urgent", "action", "verify", "reset", "billing", "unauthorized", "suspend", "alert"]
    link_keywords = ["click", "link", "http"]
    
    urgent_hits = sum(1 for w in urgent_keywords if w in text_lower)
    link_hits = sum(1 for w in link_keywords if w in text_lower)
    
    score = (urgent_hits * 0.15) + (link_hits * 0.2)
    if "netflix" in text_lower or "paypal" in text_lower or "amazon" in text_lower or "microsoft" in text_lower or "bank" in text_lower:
        if urgent_hits > 0 and link_hits > 0:
            score += 0.4
            
    score = min(0.99, score)
    return score > 0.5, score

def fallback_priority(text: str) -> str:
    text_lower = text.lower()
    if any(w in text_lower for w in ["urgent", "immediate", "critical", "action required", "expires in 24"]):
        return "Critical"
    if any(w in text_lower for w in ["tomorrow at", "deadline", "sprint review", "by Friday EOD"]):
        return "High"
    if any(w in text_lower for w in ["newsletter", "clearance event", "super sale", "catch up over"]):
        return "Low"
    return "Medium"


# --- Main Service Class ---

class MLService:
    @staticmethod
    def classify_spam(text: str) -> Dict[str, Any]:
        model = models_cache["spam_model"]
        vec = models_cache["spam_vec"]
        
        if not model or not vec:
            is_spam, score = fallback_is_spam(text)
            return {"is_spam": is_spam, "spam_score": score}
            
        try:
            vec_text = vec.transform([text])
            score = float(model.predict_proba(vec_text)[0][1])
            is_spam = bool(score > 0.5)
            return {"is_spam": is_spam, "spam_score": score}
        except Exception:
            is_spam, score = fallback_is_spam(text)
            return {"is_spam": is_spam, "spam_score": score}

    @staticmethod
    def classify_category(text: str) -> str:
        model = models_cache["category_model"]
        vec = models_cache["category_vec"]
        encoder = models_cache["category_encoder"]
        
        if not model or not vec or not encoder:
            return fallback_category(text)
            
        try:
            vec_text = vec.transform([text])
            pred_idx = model.predict(vec_text)[0]
            return str(encoder.inverse_transform([pred_idx])[0])
        except Exception:
            return fallback_category(text)

    @staticmethod
    def classify_phishing(text: str) -> Dict[str, Any]:
        model = models_cache["phishing_model"]
        vec = models_cache["phishing_vec"]
        
        if not model or not vec:
            is_phish, score = fallback_is_phishing(text)
            return {"is_phishing": is_phish, "phishing_score": score}
            
        try:
            text_lower = text.lower()
            urgent_words = sum([1 for w in ["urgent", "action", "verify", "reset", "billing", "unauthorized", "suspend", "alert"] if w in text_lower])
            has_links = 1 if "click" in text_lower or "link" in text_lower or "http" in text_lower else 0
            
            vec_text = vec.transform([text]).toarray()
            features = np.array([[urgent_words, has_links]])
            combined = np.hstack((vec_text, features))
            
            score = float(model.predict_proba(combined)[0][1])
            is_phish = bool(score > 0.5)
            return {"is_phishing": is_phish, "phishing_score": score}
        except Exception:
            is_phish, score = fallback_is_phishing(text)
            return {"is_phishing": is_phish, "phishing_score": score}

    @staticmethod
    def predict_priority(text: str) -> str:
        model = models_cache["priority_model"]
        vec = models_cache["priority_vec"]
        encoder = models_cache["priority_encoder"]
        
        if not model or not vec or not encoder:
            return fallback_priority(text)
            
        try:
            vec_text = vec.transform([text])
            pred_idx = model.predict(vec_text)[0]
            return str(encoder.inverse_transform([pred_idx])[0])
        except Exception:
            return fallback_priority(text)

    @staticmethod
    def analyze_sentiment(text: str) -> str:
        text_lower = text.lower()
        # Word lists
        positive_words = ["love", "great", "excellent", "good", "happy", "thanks", "thank you", "perfect", "success", "appreciate", "helpful", "amazing", "skills", "learn", "grow", "certificate", "course", "opportunity", "invite", "enroll", "offer", "reward", "welcome"]
        negative_words = ["error", "fail", "failed", "bad", "wrong", "broken", "unauthorized", "suspend", "threat", "phishing", "malware", "virus", "compromised", "fraud", "scam", "breach"]
        
        pos_hits = sum(1 for w in positive_words if w in text_lower)
        neg_hits = sum(1 for w in negative_words if w in text_lower)
        
        if pos_hits > neg_hits:
            return "Positive"
        elif neg_hits > pos_hits:
            return "Negative"
        return "Neutral"

    @staticmethod
    def extract_entities(text: str) -> List[Dict[str, str]]:
        entities = []
        
        # 1. Attempt with spaCy
        try:
            import spacy
            # Try to load lightweight model, if fails catch exception and run fallback regex
            nlp = spacy.load("en_core_web_sm")
            doc = nlp(text)
            allowed_labels = {"ORG", "PERSON", "DATE", "MONEY", "GPE", "TIME"}
            for ent in doc.ents:
                if ent.label_ in allowed_labels:
                    entities.append({
                        "entity_type": ent.label_,
                        "entity_value": ent.text
                    })
            if len(entities) > 0:
                return entities
        except Exception:
            pass
            
        # 2. Robust Regex-based Fallback NER (Runs if spaCy is missing or fails)
        # Matches typical dates: tomorrow, Monday, Friday, July 2026, 10/12/2026
        date_pattern = r"\b(?:tomorrow|today|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b"
        # Matches money: $100, $2,500.50, 450.00 USD
        money_pattern = r"\$\d+(?:\,\d{3})*(?:\.\d{2})?|\b\d+(?:\.\d{2})?\s?(?:USD|EUR|GBP)\b"
        # Matches standard emails
        email_pattern = r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
        # Matches potential companies: Inc., LLC, Corp, GitHub, Google, Amazon, Microsoft, PayPal, Netflix
        org_pattern = r"\b[A-Z][a-zA-Z0-9]+(?:\s[A-Z][a-zA-Z0-9]+)*(?:\s(?:LLC|Inc|Corp|Group|Systems|Technologies))?\b"
        
        text_words = set(text.split())
        known_orgs = {"Google", "Amazon", "Netflix", "PayPal", "Microsoft", "GitHub", "Twitter", "Facebook", "LinkedIn", "Jira", "AWS", "Office 365"}
        for org in known_orgs:
            if org in text:
                entities.append({"entity_type": "ORG", "entity_value": org})

        # Match dates
        dates = re.findall(date_pattern, text, re.IGNORECASE)
        for d in set(dates):
            entities.append({"entity_type": "DATE", "entity_value": d})
            
        # Match money
        amounts = re.findall(money_pattern, text)
        for amt in set(amounts):
            entities.append({"entity_type": "MONEY", "entity_value": amt})
            
        # Match email links
        emails = re.findall(email_pattern, text)
        for em in set(emails):
            entities.append({"entity_type": "PERSON", "entity_value": em})

        # Filter out short or junk entries
        entities = [e for e in entities if len(e["entity_value"]) > 2]
        return entities

    @classmethod
    def reload_models(cls):
        """Used to reload models after online/offline training is triggered"""
        global models_cache
        models_cache = {
            "spam_model": load_model_file("spam_model.joblib"),
            "spam_vec": load_model_file("spam_vectorizer.joblib"),
            "category_model": load_model_file("category_model.joblib"),
            "category_vec": load_model_file("category_vectorizer.joblib"),
            "category_encoder": load_model_file("category_encoder.joblib"),
            "phishing_model": load_model_file("phishing_model.joblib"),
            "phishing_vec": load_model_file("phishing_vectorizer.joblib"),
            "priority_model": load_model_file("priority_model.joblib"),
            "priority_vec": load_model_file("priority_vectorizer.joblib"),
            "priority_encoder": load_model_file("priority_encoder.joblib"),
        }
        print("Models successfully reloaded in cache.")
