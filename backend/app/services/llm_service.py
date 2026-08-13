import httpx
from typing import List, Dict, Optional, Any
from sqlalchemy.orm import Session
import json
import re
import email.utils as email_utils

from app.core.config import settings
from app.models import models
from app.services.vector_service import vector_service
from app.services.ml_service import MLService

# Initialize Gemini Client
from google import genai
from google.genai import types

class LLMService:
    @staticmethod
    def _call_gemini(prompt: str, system_prompt: str, is_json: bool = False) -> Optional[str]:
        if not settings.GEMINI_API_KEY:
            return None
            
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        models_to_try = [
            'gemini-1.5-flash',
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-2.0-flash-lite',
            'gemini-2.5-flash-lite',
            'gemini-flash-latest',
            'gemini-3.6-flash'
        ]
        
        config_dict = {
            "system_instruction": system_prompt,
            "temperature": 0.2,
        }
        if is_json:
            config_dict["response_mime_type"] = "application/json"
            
        for model_name in models_to_try:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(**config_dict)
                )
                if response and response.text:
                    return response.text.strip()
            except Exception as e:
                continue
        return None

    @classmethod
    def classify_email(cls, sender: str, email_subject: str, email_body: str, received_at_iso: str, user_prefs_str: str = "") -> Optional[Dict[str, Any]]:
        """
        Uses Gemini LLM to perform complete structured email intelligence classification:
        category, priority, sentiment, intent, summary, key_points, action_required, action_items, deadlines, reply_required, reply_reason, recommended_action, why_it_matters.
        """
        system_prompt = (
            "You are an expert Enterprise AI Email Classifier and Assistant. Analyze the provided email and return a strict JSON object with NO markdown code blocks or formatting:\n"
            "{\n"
            "  \"category\": \"One of: Education & Career, Shopping, Payments, Updates & Notifications, Security & Account, Work & Projects, Personal, Promotions & Marketing, Travel & Bookings\",\n"
            "  \"priority\": \"One of: Critical, High, Medium, Low\",\n"
            "  \"sentiment\": \"One of: Positive, Neutral, Negative\",\n"
            "  \"intent\": \"Specific intent (e.g. 'Interview Invitation', 'Security Alert', 'Payment Receipt', 'Family Profile Promo', 'Course Recommendation')\",\n"
            "  \"summary\": \"A short 1-2 sentence executive AI brief summarizing the core message.\",\n"
            "  \"key_points\": [\n"
            "    \"Key point 1 detailing important information\",\n"
            "    \"Key point 2 detailing important information\"\n"
            "  ],\n"
            "  \"action_required\": \"Short text stating action required or 'None'\",\n"
            "  \"action_items\": [\"List of specific actionable tasks for the user\"],\n"
            "  \"deadlines\": [\n"
            "    {\n"
            "      \"title\": \"Title of date (e.g. BrandQuest Contest, TCS Interview, Registration Deadline)\",\n"
            "      \"datetime\": \"ISO format datetime relative to email date\",\n"
            "      \"type\": \"One of: Interview Date, Event / Contest Date, Application Deadline, Registration Deadline, Payment Due Date\",\n"
            "      \"confidence\": 0.9\n"
            "    }\n"
            "  ],\n"
            "  \"reply_required\": false,\n"
            "  \"reply_reason\": \"Explanation of why reply is or is not required (e.g., 'Automated security notification; sender is not requesting a response.')\",\n"
            "  \"recommended_action\": \"Clear next step for the user (e.g., 'Review Google Account activity' or 'Confirm interview availability')\",\n"
            "  \"why_it_matters\": \"A concise 1-sentence explanation of why this email matters.\"\n"
            "}\n"
            "Reply Required Decision Rules:\n"
            "- Set reply_required = false for automated security alerts, OTPs, newsletters, promotions, e-commerce order updates, Google security notifications, Uber offers/receipts, automated system notifications.\n"
            "- Set reply_required = true ONLY for direct human messages, job interview scheduling, recruiter invitations, work requests, or explicit questions needing a response.\n"
            f"Note: Resolve relative dates relative to received date: {received_at_iso}.\n"
            f"USER PREFERENCES (CRITICAL - ALWAYS RESPECT THESE): {user_prefs_str}\n"
            "If the email matches the user's career interests, favorite companies, or always_notify topics, ALWAYS set priority to 'High' or 'Critical'."
        )
        prompt = f"Sender: {sender}\nSubject: {email_subject}\nBody:\n{email_body[:2500]}"
        
        result_text = cls._call_gemini(prompt, system_prompt, is_json=True)
        if result_text:
            try:
                text = result_text.strip()
                if text.startswith("```json"):
                    text = text[7:]
                if text.endswith("```"):
                    text = text[:-3]
                return json.loads(text.strip())
            except Exception as e:
                print(f"Failed to parse Gemini classification JSON: {e}")
        return None

    @classmethod
    def extract_actionable_insights(cls, email_subject: str, email_body: str, received_at_iso: str) -> Optional[Dict[str, Any]]:
        """
        Extracts summary, action items, deadlines, and why it matters in a single JSON-structured pass.
        """
        system_prompt = (
            "You are an AI Email Assistant. You must analyze the provided email and return a strict JSON object with NO markdown formatting, NO markdown code blocks, just raw JSON.\n"
            "Format:\n"
            "{\n"
            "  \"summary\": \"A short 1-2 sentence summary of the email.\",\n"
            "  \"action_items\": [\"List of specific tasks the user needs to do\"],\n"
            "  \"deadlines\": [\n"
            "    {\"title\": \"Event name\", \"datetime\": \"ISO format datetime resolved relative to the email's received date\", \"confidence\": 0.9, \"source_text\": \"exact text\"}\n"
            "  ],\n"
            "  \"why_it_matters\": \"A short 1-sentence explanation of why this email is important to the user (e.g. 'Placement opportunity', 'Registration required').\"\n"
            "}\n"
            f"Note: Resolve any relative dates (like 'tomorrow', 'next week') relative to this email's received date: {received_at_iso}.\n"
            "If no action items or deadlines exist, return empty arrays."
        )
        
        prompt = f"Subject: {email_subject}\nBody:\n{email_body}"
        
        if not settings.GEMINI_API_KEY:
            return {
                "summary": "No API key configured for summary.",
                "action_items": [],
                "deadlines": [],
                "why_it_matters": "Action extraction requires LLM API key."
            }
            
        try:
            result_text = cls._call_gemini(prompt, system_prompt, is_json=True)
            if result_text:
                result_text = result_text.strip()
                if result_text.startswith("```json"):
                    result_text = result_text[7:]
                if result_text.endswith("```"):
                    result_text = result_text[:-3]
                return json.loads(result_text.strip())
        except Exception as e:
            print(f"Failed to parse Gemini extraction: {e}")
            
        # Fallback Local Heuristics
        pool = []
        sentences = re.split(r"[.!?\n]\s+", email_body)
        for sent in sentences:
            sent_clean = sent.strip()
            if len(sent_clean) < 15 or len(sent_clean) > 250:
                continue
            if "http" in sent_clean.lower() or "{" in sent_clean or "px" in sent_clean.lower() or "ttf" in sent_clean.lower():
                continue
            final_sent = sent_clean[0].upper() + sent_clean[1:]
            pool.append(final_sent)
            if len(pool) >= 2:
                break
        
        fallback_summary = " ".join(pool) if pool else "No text content detected."
        
        return {
            "summary": fallback_summary,
            "action_items": [],
            "deadlines": [],
            "why_it_matters": "Heuristic fallback used due to LLM timeout."
        }

    @classmethod
    def generate_daily_digest(cls, stats: Dict[str, Any]) -> str:
        """
        Generate a readable markdown digest from structured statistics.
        """
        system_prompt = (
            "You are an Executive AI Email Assistant. "
            "You will be given JSON lists of important emails from the last 24 hours categorized by urgency. "
            "Your job is to generate a highly professional, beautifully structured executive summary in strictly JSON format. "
            "The JSON must have this exact structure:\n"
            "{\n"
            '  "executive_summary": "A 2-3 sentence conversational overarching executive summary of the inbox. Example: \'Today your inbox received 12 emails... The most urgent task is...\'",\n'
            '  "top_priority": {\n'
            '    "title": "Email Subject",\n'
            '    "deadline": "Time or Date (if any)",\n'
            '    "reason": "Why this is the most critical email",\n'
            '    "action": "E.g. Register immediately, Reply ASAP"\n'
            '  },\n'
            '  "recommendations": [\n'
            '    "✔ Actionable, opinionated bullet point (e.g. \'Review Google Security Alert immediately.\')"\n'
            '  ],\n'
            '  "categories": [\n'
            '    {\n'
            '      "name": "Security (must be one of: Security, Placements & Jobs, Interviews, Upcoming Deadlines, Reply Required)",\n'
            '      "color": "red (red, blue, purple, orange, yellow)",\n'
            '      "emails": [\n'
            '        {"time": "10:30 AM", "subject": "...", "sender": "...", "context": "Brief 1-sentence AI context on why this matters"}\n'
            '      ]\n'
            '    }\n'
            '  ]\n'
            "}\n"
            "Set top_priority to null if there are no urgent emails. Only include categories that have emails in the stats.\n"
            "Return ONLY valid JSON without any markdown code blocks."
        )
        
        prompt = f"Here are the email statistics for the last 24 hours:\n{json.dumps(stats, indent=2)}\n\nPlease generate the JSON digest."
        
        result = cls._call_gemini(prompt, system_prompt, is_json=True)
        if result:
            return result
            
        # Fallback deterministic digest if LLM fails (e.g. 503 Overloaded)
        total_emails = sum(len(emails) for emails in stats.values())
        fallback = {
            "executive_summary": f"Your inbox has processed new emails, with {total_emails} important updates requiring your attention. The AI summarization models are currently experiencing high demand, so this is a structured auto-digest.",
            "top_priority": None,
            "recommendations": ["Review the categorized emails below for pending actions."],
            "categories": []
        }
        
        color_map = {
            "security": ("Security Alerts", "red"),
            "placements": ("Placements & Jobs", "blue"),
            "interviews": ("Interviews", "purple"),
            "deadlines": ("Upcoming Deadlines", "orange"),
            "replies_needed": ("Reply Required", "yellow")
        }
        
        for key, (name, color) in color_map.items():
            if stats.get(key):
                cat_emails = []
                for e in stats[key]:
                    cat_emails.append({
                        "time": "",
                        "subject": e.get("subject", "No Subject"),
                        "sender": e.get("sender", "Unknown"),
                        "context": "Auto-categorized by local pipeline."
                    })
                fallback["categories"].append({
                    "name": name,
                    "color": color,
                    "emails": cat_emails
                })
                
        if fallback["categories"] and fallback["categories"][0]["emails"]:
            first_cat = fallback["categories"][0]
            first_email = first_cat["emails"][0]
            fallback["top_priority"] = {
                "title": first_email["subject"],
                "deadline": "Action Required",
                "reason": f"Flagged under {first_cat['name']}",
                "action": "Review email details"
            }
            
        return json.dumps(fallback)

    @classmethod
    def parse_nlp_preferences(cls, user_text: str) -> Dict[str, Any]:
        """
        Parse user's natural language input into structured preferences.
        """
        system_prompt = (
            "You are an AI Email Assistant Settings Parser. "
            "A user will tell you what kinds of emails they care about. "
            "Extract their preferences into this exact JSON structure:\n"
            "{\n"
            '  "career_interests": ["Data Analyst", "Backend", "AI Engineer", etc],\n'
            '  "favorite_companies": ["Google", "TCS", "Amazon", etc],\n'
            '  "always_notify": ["Interviews", "Security Alerts", "Placements", "Job Offers", "Deadlines", etc]\n'
            "}\n"
            "If they don't specify one, return an empty array for that field. "
            "Return ONLY valid JSON without markdown code blocks."
        )
        result = cls._call_gemini(user_text, system_prompt, is_json=True)
        if result:
            try:
                import json
                return json.loads(result)
            except:
                return {}
        return {}

    @classmethod
    def generate_summary(cls, email_subject: str, email_body: str, entities: List[Dict[str, str]], priority: str, bullet_count: int = 5) -> str:
        """
        Generate an email summary based strictly on important content without a fixed point limit.
        """
        system_prompt = (
            "You are an AI Email Assistant. Summarize the email into a concise list of accurate, important, and relevant bullet points.\n"
            "Analyze the email content and generate as many points as necessary to capture the critical information, but DO NOT repeat information.\n"
            "DO NOT output unnecessary raw text, long URLs, or tracking links.\n"
            "When constructing your bullets, consider including (if present in the email):\n"
            "- The primary objective or subject of the email\n"
            "- Critical deadlines, dates, or financial amounts\n"
            "- Specific action items required by the recipient\n"
            "- Key organizations or people mentioned\n"
            "- The overall priority and sentiment context\n"
            "IMPORTANT: Do not number them yourself, just output plain text lines separated by newlines."
        )
        
        prompt = f"Subject: {email_subject}\nPriority: {priority}\nBody:\n{email_body}"
        
        gemini_result = cls._call_gemini(prompt, system_prompt)
        if gemini_result:
            return gemini_result
            
        # Fallback Local Heuristics
        pool = []
        pool.append(f"Objective: {email_subject or 'General Inquiry'}")
        
        sentences = re.split(r"[.!?\n]\s+", email_body)
        action_indicators = ["please", "need to", "must", "review", "schedule", "verify", "update", "send", "submit", "tomorrow", "deadline", "action"]
        
        scored_sentences = []
        for sent in sentences:
            sent_clean = sent.strip()
            if len(sent_clean) < 15 or len(sent_clean) > 250:
                continue
            if "http" in sent_clean.lower() or "{" in sent_clean or "px" in sent_clean.lower() or "ttf" in sent_clean.lower():
                continue
                
            score = 0
            if any(ind in sent_clean.lower() for ind in action_indicators):
                score += 3
            for e in entities:
                val = str(e.get("entity_value", ""))
                if len(val) > 3 and val.lower() in sent_clean.lower():
                    score += 2
                    
            if score > 0:
                scored_sentences.append((score, sent_clean))
                
        scored_sentences.sort(key=lambda x: x[0], reverse=True)
        
        added_sents = set()
        for score, sent in scored_sentences:
            if sent not in added_sents:
                final_sent = sent[0].upper() + sent[1:] if sent else sent
                pool.append(final_sent)
                added_sents.add(sent)
            if len(pool) >= 4:
                break
                
        if len(pool) == 1:
            pool.append("No critical action items or explicit details detected in the message body.")
            
        return "\n".join([f"• {item.replace(chr(10), ' ').replace(chr(13), '')}" for item in pool])

    @staticmethod
    def generate_smart_reply(db: Session, email, entities, pref, length_preference="Concise"):
        """
        Generate a contextual smart reply based on email content, thread, and user preferences.
        """
        style = pref.writing_style if pref else "Professional"
        
        # --- 1. Check if email requires a reply ---
        reply_req = getattr(email, "reply_required", None)
        reply_reason_db = getattr(email, "reply_reason", None)
        rec_action_db = getattr(email, "recommended_action", None)
        
        if email.is_phishing or getattr(email, "final_verdict", None) == "Phishing":
            is_reply_recommended = False
            recommendation_reason = "This email has been classified as High Risk / Phishing. Replying is disabled for safety."
            return {
                "is_reply_recommended": False,
                "recommendation_reason": recommendation_reason,
                "generated_body": "Replying is disabled because this message is classified as high-risk phishing.",
                "ai_explanation": json.dumps({"intent": "Phishing Security", "reply_required": False, "tone": style, "length": length_preference})
            }

        # Check automated notifications & newsletters (e.g. Emergent, Substack, Medium, Coursera, Uber, Google, etc.)
        sender_lower = (email.sender or "").lower()
        subj_lower = (email.subject or "").lower()
        email_cat = getattr(email, "category", "") or ""
        body_clean = (email.clean_body or email.body or "").strip()
        has_question = "?" in body_clean
        
        is_automated = (
            reply_req is False or
            email_cat in ["Security & Account", "Promotions & Marketing", "Updates & Notifications", "Spam", "Newsletters", "Shopping", "Payments"] or
            any(w in subj_lower for w in ["security alert", "newsletter", "digest", "weekly", "saved $", "announcement", "no-reply"]) or
            any(w in sender_lower for w in ["noreply", "no-reply", "newsletter", "info@", "updates@", "marketing@"])
        )
        
        # Exception: Payment or Security emails asking for explicit confirmation vs automated
        if has_question or "please confirm" in (email.body or "").lower() or "reply to this" in (email.body or "").lower():
            is_automated = False

        if is_automated and reply_req is not True:
            is_reply_recommended = False
            recommendation_reason = reply_reason_db or "Automated notification or newsletter; sender is not requesting a response."
            rec_action = rec_action_db or "No action needed; read or archive later."
            return {
                "is_reply_recommended": False,
                "recommendation_reason": recommendation_reason,
                "generated_body": f"Reply Recommended: NO\nReason: {recommendation_reason}\nRecommended Action: {rec_action}",
                "ai_explanation": json.dumps({"intent": "Automated Newsletter/Notification", "reply_required": False, "tone": style, "length": length_preference})
            }

        # --- 2. Build Thread History & RAG Context ---
        thread_context = ""
        try:
            if email.thread_id:
                thread_emails = db.query(models.Email).filter(
                    models.Email.thread_id == email.thread_id,
                    models.Email.id != email.id
                ).order_by(models.Email.received_at.asc()).all()
                if thread_emails:
                    thread_context = "\n--- Previous Email Thread History ---\n" + "\n".join([f"From: {e.sender}\nMessage: {e.clean_body or e.body}" for e in thread_emails])
        except Exception:
            pass

        similar_context = ""
        similar_emails = []
        try:
            similar_results = vector_service.search_similar(email.body or email.subject, limit=2)
            for email_id, score in similar_results:
                if email_id == email.id:
                    continue
                past_email = db.query(models.Email).filter(models.Email.id == email_id).first()
                if past_email and past_email.replies:
                    sent_replies = [r.generated_body for r in past_email.replies if r.status in ["Sent", "Suggested"]]
                    if sent_replies:
                        similar_emails.append(f"Past Email: {past_email.body[:150]}...\nOur Past Reply: {sent_replies[0]}")
            
            if similar_emails:
                similar_context = "\n--- Similar RAG Reference Conversations ---\n" + "\n\n".join(similar_emails)
        except Exception:
            pass

        extracted_info = ", ".join([f"{e['entity_type']}: {e['entity_value']}" for e in entities])
        
        ai_explanation = {
            "intent": getattr(email, "intent", "Direct Communication") or "Direct Communication",
            "questions_detected": 1 if has_question else 0,
            "context_used": len(similar_emails) + (1 if thread_context else 0),
            "tone": style,
            "length": length_preference
        }

        # Extract human sender name
        sender_raw = email.sender or ""
        parsed_name, parsed_addr = email_utils.parseaddr(sender_raw)
        clean_name = parsed_name.replace('"', '').replace("'", "").strip() if parsed_name else ""
        if not clean_name and parsed_addr:
            clean_name = parsed_addr.split("@")[0]
        
        # If clean_name contains digits or looks like a raw email prefix (e.g. hr3509367)
        if re.search(r'\d', clean_name) or "@" in clean_name or len(clean_name) < 2:
            sender_first_name = "there"
        else:
            sender_first_name = clean_name.split()[0].title()

        # Strict Tone Directives to guarantee 100% distinct outputs per tone:
        if style == "Friendly":
            tone_rules = (
                "TONE DIRECTIVE (FRIENDLY):\n"
                "- Greet warmly with 'Hi " + (sender_first_name if sender_first_name != 'there' else 'there') + "!' or 'Hey " + (sender_first_name if sender_first_name != 'there' else 'there') + "!'\n"
                "- Write in a warm, enthusiastic, conversational tone with friendly phrasing.\n"
                "- Express genuine interest or excitement about the topic.\n"
                "- Sign off with 'Best,\nHarish' or 'Cheers,\nHarish'\n"
            )
        elif style == "Formal":
            tone_rules = (
                "TONE DIRECTIVE (FORMAL):\n"
                "- Greet with 'Dear " + (sender_first_name if sender_first_name != 'there' else 'Team') + ",'\n"
                "- Write in an executive, highly polished, formal corporate tone.\n"
                "- Use sophisticated vocabulary and structured phrasing.\n"
                "- Sign off with 'Sincerely,\nHarish Reddy' or 'Respectfully,\nHarish Reddy'\n"
            )
        elif style == "Direct":
            tone_rules = (
                "TONE DIRECTIVE (DIRECT):\n"
                "- Greet with 'Hi " + (sender_first_name if sender_first_name != 'there' else 'there') + ",'\n"
                "- Be extremely concise, blunt, and straight to the point. Zero filler or pleasantries.\n"
                "- Maximum 1 to 2 short sentences total.\n"
                "- Sign off with 'Thanks,\nHarish'\n"
            )
        else:  # Professional
            tone_rules = (
                "TONE DIRECTIVE (PROFESSIONAL):\n"
                "- Greet with 'Hello " + (sender_first_name if sender_first_name != 'there' else 'there') + ",' or 'Hi " + (sender_first_name if sender_first_name != 'there' else 'there') + ",'\n"
                "- Write in a clear, polite, standard business tone.\n"
                "- Sign off with 'Best regards,\nHarish Reddy'\n"
            )

        if length_preference == "Concise":
            length_rules = "LENGTH DIRECTIVE: Keep the response under 35 words total (1-2 sentences max)."
        else:
            length_rules = "LENGTH DIRECTIVE: Provide a detailed, multi-paragraph response (3-4 paragraphs) expanding on context, key details, next action steps, and availability."

        # --- 3. Grounded Gemini Prompt with Real-World Human Tone ---
        gemini_reply = None
        if settings.GEMINI_API_KEY:
            prompt = (
                f"You are drafting a real-world, natural human email reply on behalf of Harish Reddy.\n"
                f"SENDER DISPLAY NAME: {clean_name or 'Team'}\n"
                f"SENDER FIRST NAME: {sender_first_name}\n"
                f"SUBJECT: {email.subject}\n"
                f"CLEAN ORIGINAL EMAIL:\n{email.clean_body or email.body}\n"
                f"{thread_context}\n"
                f"{similar_context}\n\n"
                f"{tone_rules}\n"
                f"{length_rules}\n\n"
                "REAL-WORLD EMAIL RULES:\n"
                "1. Follow the TONE DIRECTIVE and LENGTH DIRECTIVE strictly.\n"
                "2. Speak like a real human professional, NOT a corporate machine.\n"
                "3. NEVER use robospeak phrases like 'I have documented the information and shared it with the relevant stakeholders on our team.'\n"
                "4. Answer every question or request directly.\n"
                "5. Return ONLY the plain text email reply."
            )
            gemini_reply = LLMService._call_gemini(prompt, "You are a real-world executive AI email assistant.")
            if gemini_reply and "REPLY_NOT_REQUIRED" in gemini_reply:
                return {
                    "is_reply_recommended": False,
                    "recommendation_reason": "Gemini AI determined that no response is required for this email.",
                    "generated_body": f"Reply Recommended: NO\nReason: No response required.\nRecommended Action: {rec_action_db or 'Read or archive.'}",
                    "ai_explanation": json.dumps(ai_explanation)
                }

        if gemini_reply:
            return {
                "is_reply_recommended": True,
                "recommendation_reason": "Sender requested a response or confirmation.",
                "generated_body": gemini_reply.strip(),
                "ai_explanation": json.dumps(ai_explanation)
            }

        # High-Quality Real-World Fallback (No Robospeak & Distinct Tones)
        subject_topic = (email.subject or "your email").strip()
        salutation_target = sender_first_name if sender_first_name != "there" else "there"
        
        if style == "Friendly":
            salutation = f"Hi {salutation_target}!"
            signoff = "Best,\nHarish"
            core_msg = f"Thanks so much for sending over the update regarding {subject_topic}! Really glad to receive this."
            if length_preference == "Detailed":
                core_msg += " I've reviewed all the details in your message. Everything looks great from my side, and I'll keep you posted as we move forward!"
        elif style == "Direct":
            salutation = f"Hi {salutation_target},"
            signoff = "Thanks,\nHarish"
            core_msg = f"Got the update on {subject_topic}. Will review and get back to you if needed."
            if length_preference == "Detailed":
                core_msg += " Please share any additional specs or files whenever available."
        elif style == "Formal":
            salutation = f"Dear {salutation_target if salutation_target != 'there' else 'Team'},"
            signoff = "Sincerely,\nHarish Reddy"
            core_msg = f"Thank you for communicating the notification concerning {subject_topic}. We appreciate the comprehensive information provided."
            if length_preference == "Detailed":
                core_msg += " Our team will carefully review the specifications and reach out should any further inquiries or clarifications arise."
        else: # Professional
            salutation = f"Hello {salutation_target},"
            signoff = "Best regards,\nHarish Reddy"
            core_msg = f"Thank you for reaching out regarding {subject_topic}. I have reviewed the information provided."
            if length_preference == "Detailed":
                core_msg += " Everything is clear on my end. I will follow up with our team and update you if any questions arise."

        fallback_body = f"{salutation}\n\n{core_msg}\n\n{signoff}"

        return {
            "is_reply_recommended": True,
            "recommendation_reason": "Sender requested a response or action.",
            "generated_body": fallback_body,
            "ai_explanation": json.dumps(ai_explanation)
        }
