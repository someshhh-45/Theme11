from flask import Flask, request, jsonify
from services.pdf_parser import extract_text
from groq import Groq
import os
import json
from dotenv import load_dotenv
from werkzeug.utils import secure_filename
from typing import Any, Dict
import re

# =========================
# 🔹 LOAD ENV
# =========================
load_dotenv()

api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    raise Exception("GROQ_API_KEY not found in .env")

client = Groq(api_key=api_key)

# =========================
# 🔹 APP INIT
# =========================
app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# =========================
# ✅ HEALTH CHECK
# =========================
@app.route("/")
def home():
    return "AI Service Running 🚀"


# =========================
# 🔥 PROMPT
# =========================
PROMPT = """
Extract structured legal data from this court judgment.

Rules:
- If a field is missing → return null
- DO NOT return empty string ""
- Try to infer from context
- Do NOT leave all fields empty
- Return ONLY valid JSON
- Use ONLY snake_case keys exactly as listed

Fields:
- case_number
- case_title
- date_of_order
- parties_involved
- key_directions
- compliance_requirements
- appeal_consideration
- timelines
- responsible_departments

Text:
"""

EXPECTED_FIELDS = [
    "case_number",
    "case_title",
    "date_of_order",
    "parties_involved",
    "key_directions",
    "compliance_requirements",
    "appeal_consideration",
    "timelines",
    "responsible_departments",
]


# =========================
# 🔥 NORMALIZE OUTPUT
# =========================
def _normalize_extraction(payload: Any) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        return {k: None for k in EXPECTED_FIELDS}

    normalized = {}
    for key in EXPECTED_FIELDS:
        val = payload.get(key)
        if isinstance(val, str):
            cleaned = val.strip()
            if cleaned.lower() in {"", "null", "none", "n/a"}:
                val = None
            else:
                val = cleaned
        normalized[key] = val

    return normalized


# =========================
# 🔥 CONFIDENCE SYSTEM (ADDED)
# =========================
def compute_field_confidence(result_json: dict, text: str, text_conf: float):
    scores = {}

    def score(value, pattern=None):
        if not value:
            return 0.0

        regex_score = 1.0 if pattern and re.search(pattern, text, re.IGNORECASE) else 0.5
        presence_score = 1.0 if str(value).lower() in text.lower() else 0.5
        length_score = 1.0 if len(str(value)) > 10 else 0.6

        final = (
            0.4 * regex_score +
            0.3 * presence_score +
            0.2 * length_score +
            0.1 * text_conf
        )

        return round(final, 2)

    scores["case_number"] = score(result_json.get("case_number"), r"(CC\s*No\.?\s*\d+\/\d+)")
    scores["case_title"] = score(result_json.get("case_title"))
    scores["date_of_order"] = score(result_json.get("date_of_order"), r"\d{2}[./-]\d{2}[./-]\d{4}")
    scores["parties_involved"] = score(result_json.get("parties_involved"))
    scores["key_directions"] = score(result_json.get("key_directions"))
    scores["compliance_requirements"] = score(result_json.get("compliance_requirements"))
    scores["appeal_consideration"] = score(result_json.get("appeal_consideration"))
    scores["timelines"] = score(result_json.get("timelines"))
    scores["responsible_departments"] = score(result_json.get("responsible_departments"))

    valid = [v for v in scores.values() if v > 0]
    overall = round(sum(valid) / len(valid), 2) if valid else 0.0

    return scores, overall


# =========================
# 🔥 MAIN API
# =========================
@app.route("/extract", methods=["POST"])
def extract():
    try:
        files = request.files.getlist("file")

        if not files:
            return jsonify({"error": "No files uploaded"}), 400

        results = []

        for file in files:

            if file.filename == "":
                continue

            filename = secure_filename(file.filename)
            filepath = os.path.join(UPLOAD_DIR, filename)
            file.save(filepath)

            print(f"📁 Saved file: {filepath}")

            # 🔹 EXTRACT TEXT (UPDATED RETURN)
            parsed = extract_text(filepath)
            text = parsed["text"]
            text_conf = parsed["text_confidence"]

            print("\n========= OCR TEXT =========\n")
            print(text[:500])
            print("\n============================\n")

            if not text:
                results.append({"file": filename, "error": "No text extracted"})
                continue

            if len(text) > 15000:
                text = text[:6000] + "\n" + text[-4000:]

            try:
                response = client.chat.completions.create(
                    model="openai/gpt-oss-120b",
                    messages=[
                        {"role": "system", "content": "Return only valid JSON"},
                        {"role": "user", "content": PROMPT + text}
                    ],
                    temperature=0.1
                )

                result_text = response.choices[0].message.content.strip()

                if "```" in result_text:
                    result_text = result_text.split("```")[1].strip()

                result_json = json.loads(result_text)
                result_json = _normalize_extraction(result_json)

                # 🔥 ADD CONFIDENCE
                scores, overall = compute_field_confidence(result_json, text, text_conf)
                result_json["confidence_scores"] = scores
                result_json["confidence_overall"] = overall
                result_json["text_confidence"] = text_conf

                results.append({
                    "file": filename,
                    "data": result_json
                })

            except Exception as e:
                results.append({
                    "file": filename,
                    "error": str(e)
                })

        return jsonify({
            "total_files": len(results),
            "results": results
        })

    except Exception as e:
        return jsonify({
            "error": "Extraction failed",
            "detail": str(e)
        }), 500


# =========================
# 🚀 RUN SERVER
# =========================
if __name__ == "__main__":
    app.run(port=5000, debug=True)