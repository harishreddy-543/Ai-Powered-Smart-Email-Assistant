import re
import html
from urllib.parse import urlparse, parse_qs, urlunparse, urlencode
from bs4 import BeautifulSoup, Comment
from typing import Dict, Any, List

class UniversalEmailReader:
    @staticmethod
    def clean_url(url: str) -> str:
        """Strips tracking query parameters (utm_*, mc_eid, etc.) from URLs."""
        if not url:
            return ""
        try:
            parsed = urlparse(url)
            if not parsed.scheme or not parsed.netloc:
                return url
            qs = parse_qs(parsed.query)
            clean_qs = {k: v for k, v in qs.items() if k.lower() not in [
                'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
                'mc_eid', 'gclid', 'fbclid', 'ref_', 'tracking_id', 'ciaid'
            ] and not k.lower().startswith('utm_')}
            new_query = urlencode(clean_qs, doseq=True)
            clean = urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment))
            return clean
        except Exception:
            return url

    @staticmethod
    def generate_reader_view(raw_content: str) -> str:
        """
        Universal Email Reader Pipeline:
        Converts raw Gmail MIME / HTML / plain text into a faithful, structured, human-readable Reader View.
        Preserves headings, paragraphs, bullet lists, dates, times, amounts, instructions, and clean links.
        Removes CSS, JS, tracking pixels, hidden DOM elements, HTML entities, and email boilerplate footer noise.
        Never uses LLM to alter the text.
        """
        if not raw_content or not raw_content.strip():
            return "No content available in message body."

        text = raw_content

        # 1. Unescape HTML entities first
        text = html.unescape(text)

        # 2. Parse HTML DOM if HTML tags exist
        if "<" in text and ">" in text:
            try:
                soup = BeautifulSoup(text, "html.parser")

                # Remove invisible, meta, script, style, and tracking elements
                for element in soup(["script", "style", "head", "meta", "link", "title", "svg", "noscript"]):
                    element.decompose()

                # Remove HTML comments
                for comment in soup.find_all(text=lambda t: isinstance(t, Comment)):
                    comment.extract()

                # Remove elements explicitly hidden via CSS inline styles
                for hidden in soup.find_all(style=re.compile(r'display\s*:\s*none|visibility\s*:\s*hidden', re.I)):
                    hidden.decompose()

                # Transform links into clean clickable anchors or clean URL representations
                for a in soup.find_all("a", href=True):
                    href = a["href"].strip()
                    clean_href = UniversalEmailReader.clean_url(href)
                    link_text = a.get_text().strip()
                    if link_text and not link_text.startswith("http"):
                        a.replace_with(f" {link_text} ({clean_href}) ")
                    elif clean_href:
                        a.replace_with(f" {clean_href} ")

                # Format headings with Markdown spacing
                for h in soup.find_all(["h1", "h2", "h3", "h4"]):
                    h_text = h.get_text().strip()
                    if h_text:
                        h.replace_with(f"\n\n### {h_text}\n\n")

                # Format list items with bullet points
                for li in soup.find_all("li"):
                    li_text = li.get_text().strip()
                    if li_text:
                        li.replace_with(f"\n• {li_text}")

                # Format paragraphs and block containers with line breaks
                for block in soup.find_all(["p", "div", "tr", "section", "article"]):
                    block.insert_before("\n")
                    block.insert_after("\n")

                for br in soup.find_all("br"):
                    br.replace_with("\n")

                text = soup.get_text(separator="\n")
            except Exception:
                pass

        # 3. Clean CSS code leakage (e.g., body, table, td { font-family... }, @media, .class { ... })
        text = re.sub(r'(?i)body\s*,\s*table\s*,\s*td\s*,\s*th[^{]*\{[^}]*\}', '', text)
        text = re.sub(r'(?i)\.[\w-]+\s*\{[^}]*\}', '', text)
        text = re.sub(r'(?i)font-family\s*:\s*[^;\n]+;?', '', text)
        text = re.sub(r'(?i)@media[^{]*\{[\s\S]*?\}\s*\}', '', text)
        text = re.sub(r'[\w-]+\s*\{[^}]*!important[^}]*\}', '', text)

        # 4. Clean zero-width characters, tracking image markers, and leftover HTML entity artifacts
        text = re.sub(r'[\u200b\u200c\u200d\ufeff]', '', text)
        text = re.sub(r'&#\d+;?', '', text)
        text = re.sub(r'&[a-zA-Z]+;', '', text)
        text = re.sub(r'\[Image:[^\]]*\]', '', text, flags=re.IGNORECASE)

        # 5. Process line by line: trim lines, preserve structural paragraphs & bullet points, strip boilerplate footers
        lines = [line.strip() for line in text.splitlines()]
        cleaned_lines = []
        
        for line in lines:
            if not line:
                cleaned_lines.append("")
                continue
                
            line_lower = line.lower()

            # Skip pure boilerplate lines
            if any(line_lower.startswith(prefix) for prefix in [
                "unsubscribe", "view in browser", "click here to unsubscribe",
                "email preferences", "report a problem", "all rights reserved."
            ]):
                continue

            cleaned_lines.append(line)

        # 6. Rejoin lines and collapse 3+ consecutive newlines into 2 (preserving paragraph breaks)
        result = "\n".join(cleaned_lines)
        result = re.sub(r'\n{3,}', '\n\n', result)
        
        return result.strip()

# Backward compatibility alias
EmailCleaner = UniversalEmailReader
