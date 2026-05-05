import json
import os
from pathlib import Path
from dotenv import load_dotenv
import requests

try:
  import google.generativeai as genai
except Exception:  # pragma: no cover
  genai = None

_dotenv_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=_dotenv_path)

_model = None
_configured_api_key: str | None = None

DEFAULT_GEMINI_MODEL = os.getenv("GEMINI_MODEL") or "models/gemini-2.0-flash"
DEFAULT_OLLAMA_HOST = os.getenv("OLLAMA_HOST") or "http://localhost:11434"
DEFAULT_OLLAMA_MODEL = os.getenv("OLLAMA_MODEL") or "gemma3:4b"

ACTION_PLAN_PROMPT = """
You are a government legal compliance expert.
Based on this extracted court judgment data, generate a structured action plan.
Return ONLY a JSON object, no explanation, no markdown.

Extracted judgment data:
{extracted_data}

Generate this exact JSON structure:

{{
  "primary_action": "COMPLY or APPEAL or COMPLY_AND_APPEAL or NO_ACTION",
  "action_summary": "one clear sentence what government must do",
  "compliance_actions": [
    {{
      "action": "specific action to take",
      "responsible_authority": "who must do it",
      "deadline": "by when",
      "priority": "HIGH or MEDIUM or LOW"
    }}
  ],
  "appeal_recommendation": {{
    "should_appeal": true or false,
    "reason": "why appeal or why not",
    "limitation_period": "days available to file appeal",
    "appeal_deadline": "calculated date if possible"
  }},
  "risk_assessment": {{
    "risk_level": "HIGH or MEDIUM or LOW",
    "consequence_of_inaction": "what happens if nothing is done",
    "immediate_attention_required": true or false
  }},
  "key_deadlines": [
    {{
      "event": "what deadline",
      "date": "date or duration",
      "is_critical": true or false
    }}
  ],
  "departments_to_notify": [
    "department name"
  ],
  "action_plan_confidence": 0.85
}}

Rules:
- Be specific and actionable
- If no timeline in judgment infer standard government compliance period of 4 weeks
- Mark immediate_attention_required true if deadline is within 30 days
- Keep action_summary under 50 words
"""

def generate_action_plan(extracted_data: dict) -> dict:
    # Reload env on every request so switching providers/models works without restarts.
    load_dotenv(dotenv_path=_dotenv_path, override=True)

    prompt = ACTION_PLAN_PROMPT.replace(
        "{extracted_data}",
        json.dumps(extracted_data, indent=2),
    )

    provider = (os.getenv("LLM_PROVIDER") or "").strip().lower()
    ollama_host = os.getenv("OLLAMA_HOST") or DEFAULT_OLLAMA_HOST
    ollama_model = os.getenv("OLLAMA_MODEL") or DEFAULT_OLLAMA_MODEL
    gemini_model = os.getenv("GEMINI_MODEL") or DEFAULT_GEMINI_MODEL

    if provider == "ollama":
        print(f"Generating action plan with Ollama... model={ollama_model}")
        url = f"{ollama_host.rstrip('/')}/api/generate"
        resp = requests.post(
            url,
            json={
                "model": ollama_model,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.2},
            },
            timeout=300,
        )
        resp.raise_for_status()
        response_text = (resp.json().get("response") or "").strip()
    else:
        if genai is None:
            raise RuntimeError(
                "Gemini provider is unavailable: google-generativeai is not installed"
            )

        global _model, _configured_api_key
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise RuntimeError(
                "Missing Gemini API key. Set GEMINI_API_KEY (preferred) or GOOGLE_API_KEY. "
                "You can also place it in an .env file in ai_service/."
            )

        if _model is None or _configured_api_key != api_key:
            genai.configure(api_key=api_key)
            _model = genai.GenerativeModel(gemini_model)
            _configured_api_key = api_key

        print(f"Generating action plan with Gemini... model={gemini_model}")
        response = _model.generate_content(prompt)
        response_text = response.text.strip()

    print("Action plan generated. Parsing...")

    if "```json" in response_text:
        response_text = response_text.split("```json")[1].split("```")[0].strip()
    elif "```" in response_text:
        response_text = response_text.split("```")[1].split("```")[0].strip()

    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        start = response_text.find("{")
        end = response_text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(response_text[start : end + 1])
        raise