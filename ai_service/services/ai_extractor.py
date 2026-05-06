import json
import os
from pathlib import Path
from dotenv import load_dotenv
import requests

try:
    import google.generativeai as genai
except Exception:
    genai = None

# =========================
# 🔹 ENV
# =========================
_dotenv_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=_dotenv_path)

GEMINI_MODEL = os.getenv("GEMINI_MODEL") or "models/gemini-2.0-flash"
OLLAMA_HOST = os.getenv("OLLAMA_HOST") or "http://localhost:11434"
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL") or "qwen2.5:7b-instruct"

_model = None
_configured_api_key = None


# =========================
# 🔹 GEMINI
# =========================
def _get_gemini_model():
    global _model, _configured_api_key

    if genai is None:
        raise RuntimeError("Gemini not installed")

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    if not api_key:
        load_dotenv(dotenv_path=_dotenv_path, override=True)
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    if not api_key:
        raise RuntimeError("Missing Gemini API key")

    if _model is None or _configured_api_key != api_key:
        genai.configure(api_key=api_key)
        _model = genai.GenerativeModel(GEMINI_MODEL)
        _configured_api_key = api_key

    return _model


# =========================
# 🔹 OLLAMA
# =========================
def _generate_with_ollama(prompt: str):
    url = f"{OLLAMA_HOST.rstrip('/')}/api/generate"

    resp = requests.post(
        url,
        json={
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.2},
        },
        timeout=300,
    )

    resp.raise_for_status()
    return (resp.json().get("response") or "").strip()


# =========================
# 🔥 NORMALIZATION (NO HARDCODING)
# =========================
def normalize_output(data: dict) -> dict:

    def ensure_list(val):
        if val is None:
            return None
        if isinstance(val, list):
            return val
        return [val]

    def ensure_string(val):
        if isinstance(val, list):
            return " ".join(map(str, val))
        return val

    # Structure only (no value invention)
    data["key_directions"] = ensure_list(data.get("key_directions"))
    data["responsible_departments"] = ensure_list(data.get("responsible_departments"))

    data["case_number"] = ensure_string(data.get("case_number"))
    data["case_title"] = ensure_string(data.get("case_title"))
    data["date_of_order"] = ensure_string(data.get("date_of_order"))

    # Fix confidence_scores structure ONLY
    scores = data.get("confidence_scores")

    if isinstance(scores, list):
        new_scores = {}
        for item in scores:
            if isinstance(item, dict):
                key = item.get("source") or item.get("field")
                val = item.get("score")
                if key and isinstance(val, (int, float)):
                    new_scores[key] = float(val)
        data["confidence_scores"] = new_scores

    elif not isinstance(scores, dict):
        data["confidence_scores"] = {}

    return data


# =========================
# 🔥 ANALYSIS-BASED SCORING (NO HARDCODING)
# =========================
def compute_confidence_scores(extracted: dict, full_text: str) -> dict:

    text = full_text.lower()

    def score_string(value):
        if not value:
            return 0.0
        val = value.lower().strip()
        if val in text:
            return 0.9
        return 0.6

    def score_list(values):
        if not values:
            return 0.0
        matches = 0
        for v in values:
            if isinstance(v, str) and v.lower() in text:
                matches += 1
        return matches / len(values) if values else 0.0

    scores = {}

    scores["case_number"] = score_string(extracted.get("case_number"))
    scores["case_title"] = score_string(extracted.get("case_title"))
    scores["date_of_order"] = score_string(extracted.get("date_of_order"))

    scores["key_directions"] = score_list(extracted.get("key_directions"))
    scores["responsible_departments"] = score_list(extracted.get("responsible_departments"))

    # timelines handling
    timelines = extracted.get("timelines")
    if isinstance(timelines, list):
        scores["timelines"] = score_list([str(t) for t in timelines])
    else:
        scores["timelines"] = 0.0

    return scores


# =========================
# 🔹 PROMPT
# =========================
EXTRACTION_PROMPT = """
Extract structured legal data from this judgment.

Return ONLY valid JSON.

Fields:
- case_number
- case_title
- date_of_order
- key_directions
- timelines
- responsible_departments

Text:
{judgment_text}
"""


# =========================
# 🔥 MAIN FUNCTION
# =========================
def extract_from_judgment(full_text: str) -> dict:

    load_dotenv(dotenv_path=_dotenv_path, override=True)

    text = full_text[:8000]
    prompt = EXTRACTION_PROMPT.replace("{judgment_text}", text)

    provider = (os.getenv("LLM_PROVIDER") or "").lower()

    if provider == "ollama":
        print("Using Ollama...")
        response_text = _generate_with_ollama(prompt)
    else:
        print("Using Gemini...")
        model = _get_gemini_model()
        response = model.generate_content(prompt)
        response_text = response.text.strip()

    # Clean markdown
    if "```" in response_text:
        parts = response_text.split("```")
        if len(parts) >= 2:
            response_text = parts[1].replace("json", "").strip()

    # Safe JSON parsing
    try:
        data = json.loads(response_text)
    except:
        start = response_text.find("{")
        end = response_text.rfind("}")
        if start != -1 and end != -1:
            data = json.loads(response_text[start:end + 1])
        else:
            raise Exception("Invalid JSON from LLM")

    # Normalize structure
    data = normalize_output(data)

    # 🔥 Compute REAL scores (NO HARDCODING)
    data["confidence_scores"] = compute_confidence_scores(data, full_text)

    return data


# =========================
# 🔹 OPTIONAL UI COLORS
# =========================
def add_confidence_colors(data: dict) -> dict:

    scores = data.get("confidence_scores", {})
    colored = {}

    for field, score in scores.items():
        if isinstance(score, (int, float)):
            if score >= 0.85:
                color = "green"
            elif score >= 0.60:
                color = "yellow"
            else:
                color = "red"

            colored[field] = {
                "score": score,
                "color": color,
                "percentage": f"{int(score * 100)}%"
            }

    data["confidence_display"] = colored
    return data