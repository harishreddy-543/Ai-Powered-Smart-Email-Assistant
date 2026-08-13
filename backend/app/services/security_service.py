import re
import difflib
import json
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models import models

class SecurityEngine:
    KNOWN_BRANDS = ["google", "microsoft", "amazon", "apple", "facebook", "linkedin", "paypal", "netflix", "stripe"]
    
    @staticmethod
    def analyze_authentication(headers: List[Dict[str, str]]) -> Dict[str, str]:
        """Parse Authentication-Results header to extract SPF, DKIM, DMARC status."""
        auth_results = {}
        for header in headers:
            if header.get("name", "").lower() == "authentication-results":
                val = header.get("value", "").lower()
                # Extremely naive extraction for demonstration
                if "spf=pass" in val: auth_results['spf_status'] = "Pass"
                elif "spf=fail" in val: auth_results['spf_status'] = "Fail"
                
                if "dkim=pass" in val: auth_results['dkim_status'] = "Pass"
                elif "dkim=fail" in val: auth_results['dkim_status'] = "Fail"
                
                if "dmarc=pass" in val: auth_results['dmarc_status'] = "Pass"
                elif "dmarc=fail" in val: auth_results['dmarc_status'] = "Fail"
        return auth_results

    @staticmethod
    def analyze_domain(sender: str) -> bool:
        """Check for domain impersonation using typosquatting and Levenshtein distance."""
        match = re.search(r"@([^>]+)", sender)
        if not match:
            return False
        domain_full = match.group(1).lower()
        domain = domain_full.split('.')[0]
        
        # Leetspeak normalization (g00gle -> google)
        norm_domain = domain.replace('0', 'o').replace('1', 'l').replace('3', 'e').replace('4', 'a').replace('5', 's')
        
        for brand in SecurityEngine.KNOWN_BRANDS:
            if domain == brand or norm_domain == brand:
                return False # Exact match
            if brand in norm_domain or brand in domain:
                return True # Typosquatting (e.g. g00gle-account.xyz or google-login.com)
            if difflib.SequenceMatcher(None, domain, brand).ratio() > 0.7 or difflib.SequenceMatcher(None, norm_domain, brand).ratio() > 0.7:
                return True # Impersonation!
        return False

    @staticmethod
    def analyze_urls(body: str) -> Dict[str, Any]:
        """Extract URLs and perform basic risk checks."""
        urls = re.findall(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', body)
        suspicious_keywords = ["login", "verify", "secure", "update", "account"]
        
        suspicious_count = 0
        for url in urls:
            url_lower = url.lower()
            if any(k in url_lower for k in suspicious_keywords):
                suspicious_count += 1
                
        return {
            "url_count": len(urls),
            "suspicious_url_count": suspicious_count,
            "has_suspicious_urls": suspicious_count > 0
        }

    @staticmethod
    def get_sender_trust(db: Session, user_id: int, sender: str) -> float:
        """Calculate a trust score based on previous interactions with this sender."""
        try:
            match = re.search(r"<([^>]+)>", sender)
            email_addr = match.group(1) if match else sender
            
            count = db.query(models.Email).filter(
                models.Email.user_id == user_id,
                models.Email.sender.ilike(f"%{email_addr}%")
            ).count()
            
            return min(1.0, count / 10.0)
        except Exception:
            return 0.5

    @staticmethod
    def compute_risk(nlp_phishing_score: float, nlp_spam_score: float, 
                     auth: Dict, impersonation: bool, urls: Dict, 
                     trust_score: float) -> Dict[str, Any]:
        """
        Feature Fusion Engine (Heuristic simulation of XGBoost).
        Combines deterministic signals with ML probability.
        """
        reasons = []
        risk = nlp_phishing_score
        
        # Feature penalties/bonuses
        if impersonation:
            risk = max(risk, 0.85)
            reasons.append("⚠ Domain resembles a known brand (Impersonation)")
            
        if urls["has_suspicious_urls"]:
            risk += 0.2
            reasons.append(f"⚠ Found {urls['suspicious_url_count']} suspicious credential-request URLs")
            
        if auth.get("spf_status") == "Fail" or auth.get("dkim_status") == "Fail":
            risk += 0.3
            reasons.append("⚠ Email authentication failed (Spoofing risk)")
        elif auth.get("spf_status") == "Pass" and auth.get("dkim_status") == "Pass":
            risk -= 0.1 # Small bonus for passing
            
        if trust_score == 0.0:
            reasons.append("⚠ First time receiving email from this sender")
            if risk > 0.4:
                risk += 0.1
        else:
            risk -= (trust_score * 0.2) # High trust reduces risk
            
        risk = min(1.0, max(0.0, risk)) # Clamp between 0 and 1
        
        # Decide Verdict
        if risk > 0.65:
            verdict = "Phishing"
        elif risk > 0.3 or (nlp_spam_score > 0.6):
            verdict = "Suspicious"
        else:
            verdict = "Safe"
            
        return {
            "final_risk_score": risk,
            "final_verdict": verdict,
            "reasons": json.dumps(reasons)
        }
