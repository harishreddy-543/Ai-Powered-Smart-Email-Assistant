import json
import datetime
from sqlalchemy.orm import Session
from typing import Dict, List, Any

from app.models import models
from app.services.ml_service import MLService
from app.services.vector_service import vector_service
from app.services.llm_service import LLMService
from app.services.security_service import SecurityEngine

# A global list to capture recent agent activities for the terminal dashboard
AGENT_LOGS: List[Dict[str, Any]] = []
SYNC_HEARTBEATS: Dict[int, float] = {}
SYNC_ACTIVE: set = set()

def log_agent_activity(action: str, detail: str, email_subject: str = ""):
    log_entry = {
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "action": action,
        "detail": detail,
        "subject": email_subject
    }
    AGENT_LOGS.append(log_entry)
    # Cap log size to 100 entries
    if len(AGENT_LOGS) > 100:
        AGENT_LOGS.pop(0)
    try:
        print(f"[AGENT LOG] {action} | {detail}")
    except UnicodeEncodeError:
        print(f"[AGENT LOG] {action} | {detail.encode('ascii', 'ignore').decode('ascii')}")

def classify_category_smart(sender: str, subject: str, body: str) -> str:
    subj_lower = (subject or "").lower()
    sender_lower = (sender or "").lower()
    body_lower = (body or "").lower()[:2000]
    
    # 1. Security & Account
    if any(k in subj_lower or k in body_lower for k in ["security alert", "password", "sign-in", "login", "otp", "verification", "auth", "suspicious activity", "access granted"]):
        return "Security & Account"
        
    # 2. Education & Career
    if any(k in sender_lower for k in ["linkedin", "unstop", "codegnan", "coursera", "naukri", "udemy", "edx", "scaler", "simplilearn", "geeksforgeeks", "hackerrank", "leetcode", "college.edu", "university.edu", "placements"]) or \
       any(k in subj_lower or k in body_lower for k in ["interview", "job", "vacancy", "assessment", "placement", "recruitment", "exam", "test", "hiring", "application", "resume", "campus"]):
        return "Education & Career"

    # 3. Payments & Receipts
    if any(k in sender_lower for k in ["paytm", "razorpay", "bank", "stripe", "paypal", "phonepe", "gpay", "cred", "hdfc", "icici", "sbi", "axis"]) or \
       any(k in subj_lower for k in ["invoice", "payment", "transaction", "debited", "credited", "receipt", "billed", "paid", "rs.", "₹"]):
        return "Payments"

    # 4. Shopping & E-Commerce
    if any(k in sender_lower for k in ["croma", "amazon", "flipkart", "myntra", "meesho", "ajio", "zara", "nykaa"]) or \
       any(k in subj_lower for k in ["order", "shipped", "delivery", "out for delivery", "package"]):
        return "Shopping"

    # 5. Work & Projects
    if any(k in subj_lower for k in ["project", "meeting", "deadline", "task", "review", "report", "client", "team", "jira", "github"]):
        return "Work & Projects"

    # 6. Promotions & Marketing
    if any(k in subj_lower for k in ["%", "discount", "sale", "special offer", "cashback", "coupon", "limited time"]):
        return "Promotions & Marketing"

    # 7. Travel & Bookings
    if any(k in sender_lower for k in ["uber", "ola", "rapido", "lyft", "redbus", "abhibus", "irctc", "makemytrip", "goibibo", "yatra"]) or \
       any(k in subj_lower for k in ["booking", "ticket", "flight", "hotel"]):
        return "Travel & Bookings"

    return "Updates & Notifications"

def generate_executive_summary(subject: str, clean_body: str) -> str:
    subj = (subject or "").strip()
    body = (clean_body or "").strip()
    
    sentences = [s.strip() for s in body.replace('\n', ' ').split('.') if len(s.strip()) > 15]
    if sentences:
        core_sentences = ". ".join(sentences[:2])
        if not core_sentences.endswith('.'):
            core_sentences += '.'
        return f"{subj}: {core_sentences}" if subj and not core_sentences.lower().startswith(subj.lower()) else core_sentences
    elif subj:
        return f"Executive notification regarding: {subj}."
    else:
        return "Executive AI email brief summarizing message content and required context."

class AgentService:
    @staticmethod
    def get_logs() -> List[Dict[str, Any]]:
        return AGENT_LOGS

    @staticmethod
    def process_new_email(
        db: Session, 
        user_id: int, 
        sender: str, 
        recipient: str, 
        subject: str, 
        body: str,
        message_id: str = None,
        thread_id: str = None,
        received_at: datetime.datetime = None,
        raw_headers: List[Dict[str, str]] = None,
        is_read: bool = False,
        existing_email_id: int = None,
        is_simulated: bool = False
    ) -> models.Email:
        """
        Runs the complete email processing workflow.
        """
        subj_log = subject or "No Subject"
        log_agent_activity("EMAIL_RECEIVED", f"New email from {sender}", subj_log)
        
        # 1. Spam Classification
        log_agent_activity("CLASSIFYING_SPAM", "Checking against spam heuristics and text vector classification", subj_log)
        spam_res = MLService.classify_spam(body)
        is_spam = spam_res["is_spam"]
        spam_score = spam_res["spam_score"]
        
        # Multi-Signal Security Engine (Feature Fusion)
        log_agent_activity("CLASSIFYING_SECURITY", "Analyzing authentication, domain, URLs, trust, and text for phishing signatures", subj_log)
        nlp_phishing_score = MLService.classify_phishing(body)["phishing_score"]
        
        auth_signals = SecurityEngine.analyze_authentication(raw_headers or [])
        domain_impersonation = SecurityEngine.analyze_domain(sender)
        url_signals = SecurityEngine.analyze_urls(body)
        trust_score = SecurityEngine.get_sender_trust(db, user_id, sender)
        
        security_verdict = SecurityEngine.compute_risk(
            nlp_phishing_score=nlp_phishing_score,
            nlp_spam_score=spam_score,
            auth=auth_signals,
            impersonation=domain_impersonation,
            urls=url_signals,
            trust_score=trust_score
        )
        
        is_phishing = security_verdict["final_verdict"] == "Phishing"
        phishing_score = security_verdict["final_risk_score"]
        
        # 2. General Categorization & Gemini LLM Classification
        log_agent_activity("CLASSIFYING_CATEGORY", "Evaluating email using Gemini Intelligence and ML Fallbacks", subj_log)
        iso_time = (received_at or datetime.datetime.utcnow()).isoformat()
        
        # Fetch user preferences to guide LLM and enforce strict matching rules
        prefs = db.query(models.Preferences).filter(models.Preferences.user_id == user_id).first()
        user_prefs_str = ""
        
        career_interests_lower = []
        favorite_companies_lower = []
        always_notify_lower = []
        if prefs:
            user_prefs_str = f"Career Interests: {prefs.career_interests}. Favorite Companies: {prefs.favorite_companies}. Always Notify: {prefs.always_notify}."
            try:
                career_interests_lower = [x.lower() for x in json.loads(prefs.career_interests) if x]
                favorite_companies_lower = [x.lower() for x in json.loads(prefs.favorite_companies) if x]
                always_notify_lower = [x.lower() for x in json.loads(prefs.always_notify) if x]
            except Exception:
                pass
                
        # Determine exact preference matches upfront
        body_subj_lower = (subject + " " + body).lower()
        sender_lower = (sender or "").lower()
        matches_company = any(c in sender_lower or c in body_subj_lower for c in favorite_companies_lower if c)
        matches_interest = any(i in body_subj_lower for i in career_interests_lower if i)
        
        gemini_res = LLMService.classify_email(sender, subject, body, iso_time, user_prefs_str)
        
        category = None
        priority = None
        sentiment = None
        gemini_summary = None
        gemini_action_items = None
        gemini_deadlines = None
        gemini_why_it_matters = None
        
        if gemini_res:
            category = gemini_res.get("category")
            priority = gemini_res.get("priority")
            sentiment = gemini_res.get("sentiment")
            gemini_summary = gemini_res.get("summary")
            gemini_action_items = gemini_res.get("action_items")
            gemini_deadlines = gemini_res.get("deadlines")
            gemini_why_it_matters = gemini_res.get("why_it_matters")
            
        smart_cat = classify_category_smart(sender, subject, body)
        
        # Enforce exact matches (overriding LLM if it failed to pick them up)
        if matches_company or matches_interest or ("placements" in always_notify_lower and "placement" in body_subj_lower) or ("interviews" in always_notify_lower and "interview" in body_subj_lower):
            priority = "Critical"
            if matches_interest or "placement" in body_subj_lower or "interview" in body_subj_lower:
                category = "Education & Career"
                
        # If it was marked high priority (either by Gemini or our exact match enforcement), don't let basic spam filters override it
        gemini_high_priority = priority in ["High", "Critical"]
        
        if (is_spam or is_phishing) and not gemini_high_priority:
            category = "Spam"
        elif smart_cat and smart_cat != "Updates & Notifications" and not category:
            category = smart_cat
        elif not category or category in ["Unclassified", "General", "None"]:
            category = smart_cat or "General"
            
        # 3. Priority and Sentiment Prediction
        log_agent_activity("PREDICTING_PRIORITY", "Calculating business priority and urgency indicators", subj_log)
        if is_phishing and not gemini_high_priority:
            priority = "Critical"
        elif is_spam and not gemini_high_priority:
            priority = "Low"
        elif not priority:
            priority = MLService.predict_priority(body)
            
        if not sentiment:
            sentiment = MLService.analyze_sentiment(body)
        
        from app.services.email_cleaner import UniversalEmailReader
        clean_body = UniversalEmailReader.generate_reader_view(body)
        exec_summary = gemini_summary or generate_executive_summary(subject, clean_body)
        
        # 4. Create Email Record with FULL Summary & Classification Insights
        db_email_args = {
            "user_id": user_id,
            "sender": sender,
            "recipient": recipient,
            "subject": subject,
            "body": body,
            "clean_body": clean_body,
            "summary": exec_summary,
            "action_items": json.dumps(gemini_action_items or []),
            "deadlines": json.dumps(gemini_deadlines or []),
            "why_it_matters": gemini_why_it_matters or "",
            "key_points": json.dumps(gemini_res.get("key_points", [])) if gemini_res else None,
            "intent": gemini_res.get("intent") if gemini_res else None,
            "reply_required": gemini_res.get("reply_required", False) if gemini_res else False,
            "reply_reason": gemini_res.get("reply_reason") if gemini_res else None,
            "recommended_action": gemini_res.get("recommended_action") if gemini_res else None,
            "message_id": message_id or f"msg_{int(datetime.datetime.utcnow().timestamp())}",
            "thread_id": thread_id or f"thread_{int(datetime.datetime.utcnow().timestamp())}",
            "is_read": is_read,
            "is_simulated": is_simulated,
            "category": category,
            "priority": priority,
            "sentiment": sentiment,
            "spam_score": spam_score,
            "phishing_score": phishing_score,
            "is_spam": is_spam,
            "is_phishing": is_phishing,
            "spf_status": auth_signals.get("spf_status"),
            "dkim_status": auth_signals.get("dkim_status"),
            "dmarc_status": auth_signals.get("dmarc_status"),
            "domain_impersonation": domain_impersonation,
            "phishing_reasons": security_verdict["reasons"],
            "trust_score": trust_score,
            "final_verdict": security_verdict["final_verdict"]
        }
        if received_at:
            db_email_args["received_at"] = received_at
            
        db_email = None
        if existing_email_id:
            db_email = db.query(models.Email).filter(models.Email.id == existing_email_id).first()
            if db_email:
                for k, v in db_email_args.items():
                    setattr(db_email, k, v)
                    
        if not db_email:
            db_email = models.Email(**db_email_args)
            db.add(db_email)
            
        db.commit()
        db.refresh(db_email)
        
        # 5. Extract NER Entities
        log_agent_activity("EXTRACTING_ENTITIES", "Running spaCy pipeline to extract named entities and dates", subj_log)
        entities_list = MLService.extract_entities(body)
        db_entities = []
        for ent in entities_list:
            db_ent = models.Entity(
                email_id=db_email.id,
                entity_type=ent["entity_type"],
                entity_value=ent["entity_value"]
            )
            db_entities.append(db_ent)
        db.add_all(db_entities)
        db.commit()
        
        # 6. Index into Vector Store
        log_agent_activity("VECTOR_INDEXING", "Generating embeddings and indexing into FAISS vector db", subj_log)
        try:
            from app.services.rag_service import RAGService
            RAGService.index_email(
                email_id=db_email.id,
                subject=subject,
                sender=sender,
                body=body,
                user_id=user_id
            )
        except Exception as e:
            log_agent_activity("INDEXING_ERROR", f"Failed vector storage sync: {str(e)}", subj_log)
            
        # 7. Fetch user preferences to guide LLM summarization and smart replies
        pref = db.query(models.Preferences).filter(models.Preferences.user_id == user_id).first()
        if not pref:
            pref = models.Preferences(user_id=user_id)
            db.add(pref)
            db.commit()
            db.refresh(pref)
            
        # 8. Run Extraction & Summarization Fallback Check
        log_agent_activity("LLM_EXTRACTION", "Extracting actionable insights, deadlines, and summary", subj_log)
        if not db_email.summary or db_email.summary == "Summary generation pending...":
            insights = LLMService.extract_actionable_insights(subject, body, iso_time)
            if insights and insights.get("summary"):
                db_email.summary = insights.get("summary")
                db_email.action_items = json.dumps(insights.get("action_items", []))
                db_email.deadlines = json.dumps(insights.get("deadlines", []))
                db_email.why_it_matters = insights.get("why_it_matters", "")
            else:
                db_email.summary = generate_executive_summary(subject, clean_body)
            db.commit()
        
        # 8b. Personalized Alert Decision Engine
        log_agent_activity("ALERT_DECISION", "Evaluating if email requires mobile notification", subj_log)
        needs_alert = False
        alert_reason = ""
        alert_type = "Watchlist"
        severity = "Medium"
        
        # Determine Alert Need (New Intelligent Categories)
        has_deadline = bool(db_email.deadlines and db_email.deadlines != '[]' and db_email.deadlines != 'null')
        has_action = bool(db_email.action_items and db_email.action_items != '[]' and db_email.action_items != 'null')
        action_text = (db_email.action_items or "").lower()
        
        if is_phishing and not gemini_high_priority:
            needs_alert = True
            alert_type = "Security Alert"
            alert_reason = "Possible phishing link detected. Avoid clicking any unexpected links."
            severity = "Critical"
        elif (is_spam and not gemini_high_priority) or category == "Promotions":
            needs_alert = False  # Spam/Promos go to spam folder, no alert
        elif "delivery status notification (failure)" in body_subj_lower or "undelivered mail returned" in body_subj_lower:
            needs_alert = True
            alert_type = "Delivery Failed"
            alert_reason = "Your email couldn't be delivered to the recipient."
            severity = "High"
        elif "interview" in body_subj_lower or "interview" in action_text or "interviews" in always_notify_lower:
            needs_alert = True
            alert_type = "Interview Alert"
            alert_reason = "An interview has been scheduled or requested."
            severity = "High"
        elif has_deadline or "deadlines" in always_notify_lower or any(k in body_subj_lower for k in ["deadline", "due date", "due by", "submit before", "expires"]):
            needs_alert = True
            alert_type = "Deadline Alert"
            alert_reason = "An important deadline is approaching soon."
            severity = "High"
        elif category == "Education & Career" or "placements" in always_notify_lower or matches_interest or matches_company:
            needs_alert = True
            alert_type = "Placement Alert"
            alert_reason = "Academic, career, or placement opportunity detected."
            severity = "High"
        elif (category == "Payments" and has_action) or "payments" in always_notify_lower:
            needs_alert = True
            alert_type = "Payment Reminder"
            alert_reason = "A payment or bill requires your attention."
            severity = "Medium"
        elif has_action or "reply required" in always_notify_lower:
            needs_alert = True
            alert_type = "Action Required"
            alert_reason = "A reply or specific action is needed from you."
            severity = "Medium"
        elif matches_company:
            needs_alert = True
            alert_type = "Company Update"
            alert_reason = "Email from a favorite company on your watchlist."
            severity = "Low"
        
        db_email.needs_alert = needs_alert
        if needs_alert:
            db_alert = models.Alert(
                user_id=user_id,
                email_id=db_email.id,
                alert_type=alert_type,
                severity=severity,
                title=subject[:50] + ("..." if len(subject) > 50 else ""),
                message=db_email.summary or subject,
                trigger_reason=alert_reason
            )
            db.add(db_alert)
        db.commit()
        
        # 9. Generate suggested Smart Reply
        log_agent_activity("LLM_REPLY_GENERATION", f"Applying RAG context with style={pref.writing_style} to draft reply suggestion", subj_log)
        entities_dict = [{"entity_type": e.entity_type, "entity_value": e.entity_value} for e in db_entities]
        reply_dict = LLMService.generate_smart_reply(db, db_email, entities_dict, pref)
        db_reply = models.Reply(
            email_id=db_email.id,
            generated_body=reply_dict.get("generated_body", ""),
            status="Suggested",
            tone=pref.writing_style if pref else "Professional",
            is_reply_recommended=reply_dict.get("is_reply_recommended", True),
            recommendation_reason=reply_dict.get("recommendation_reason"),
            ai_explanation=reply_dict.get("ai_explanation")
        )
        db.add(db_reply)
        db.commit()
        
        log_agent_activity("AGENT_COMPLETE", f"Processing complete. Email classified as {category} with {priority} priority.", subj_log)
        
        db.refresh(db_email)
        return db_email
