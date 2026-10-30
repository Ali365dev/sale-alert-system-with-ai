"""
Manual provider test script.
Run from the project root:
    python test_providers.py

Tests Ollama, Gemini, and Groq independently.
Prints the raw response or the full error for each.
"""
import sys
import json
import traceback
from pathlib import Path

# Make sure project imports work when running from project root
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

import requests


TEST_PROMPT = """
You are an AI assistant that extracts retail sales and promotional offers.

Task:
- Search your knowledge for active or recently announced offers for the provided brands.
- If an offer is found, return it in the required JSON format.
- If no offer is found, do not invent information.
- Only include offers that are reasonably reliable.
- Return ONLY valid JSON.
- Do not include explanations, markdown, or additional text.

Brands:
Bata shoes

Return this JSON:

{
  "offers": [
    {
      "brand": "",
      "company": "",
      "category": "",
      "subcategory": "",
      "offer_type": "",
      "discount_percentage": null,
      "offer_value": "",
      "coupon_code": "",
      "expiry_date": null,
      "summary": "",
      "key_highlights": [
        ""
      ],
      "is_active": true,
      "source": "ai",
      "verification_status": "unverified",
      "verification_reason": "Generated from AI knowledge.",
      "verification_confidence": 0.75
    }
  ]
}

Rules:
- Return {"offers": []} if no offers are found.
- discount_percentage must be a number or null.
- expiry_date must be YYYY-MM-DD or null.
- key_highlights must be an array of strings.
- source must always be "ai".
- Do not fabricate coupon codes.
- Output ONLY valid JSON.
"""


SEP = "-" * 60


# ── Ollama ─────────────────────────────────────────────────────────────────────

def test_ollama(model: str = "qwen2.5:3b", base_url: str = "http://localhost:11434"):
    print(f"\n{SEP}")
    print(f"OLLAMA  model={model}  url={base_url}")
    print(SEP)

    url = f"{base_url.rstrip('/')}/api/generate"
    payload = {
        "model": model,
        "prompt": TEST_PROMPT,
        "stream": False,
    }

    print(f"POST {url}")
    print(f"Payload: {json.dumps(payload, indent=2)}\n")

    try:
        resp = requests.post(url, json=payload, timeout=60)
        print(f"Status : {resp.status_code}")
        print(f"Headers: {dict(resp.headers)}\n")

        try:
            body = resp.json()
            print("Response JSON:")
            print(json.dumps(body, indent=2))
            print(f"\nModel response text:\n{body.get('response', '<empty>')}")
        except Exception:
            print("Response body (raw):")
            print(resp.text)

        resp.raise_for_status()
        print("\n✓ Ollama OK")

    except requests.exceptions.ConnectionError as exc:
        print(f"\n✗ Connection error — is Ollama running?\n  {exc}")
    except requests.exceptions.HTTPError as exc:
        print(f"\n✗ HTTP error: {exc}")
    except Exception as exc:
        print(f"\n✗ Unexpected error: {exc}")
        traceback.print_exc()


# ── Gemini ─────────────────────────────────────────────────────────────────────

def test_gemini():
    print(f"\n{SEP}")
    print("GEMINI")
    print(SEP)

    try:
        from config import GEMINI_API_KEY, GEMINI_MODEL
        if not GEMINI_API_KEY:
            print("✗ GEMINI_API_KEY not set in .env — skipping")
            return

        print(f"Model: {GEMINI_MODEL}")
        print(f"Prompt: {TEST_PROMPT}\n")

        from google import genai
        from google.genai import types

        client = genai.Client(api_key=GEMINI_API_KEY)
        resp = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=TEST_PROMPT,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )

        print(f"Response text:\n{resp.text}")
        print("\n✓ Gemini OK")

    except Exception as exc:
        print(f"\n✗ Error: {exc}")
        traceback.print_exc()


# ── Groq ───────────────────────────────────────────────────────────────────────

def test_groq():
    print(f"\n{SEP}")
    print("GROQ")
    print(SEP)

    try:
        from config import GROQ_API_KEY, GROQ_MODEL
        if not GROQ_API_KEY:
            print("✗ GROQ_API_KEY not set in .env — skipping")
            return

        print(f"Model: {GROQ_MODEL}")
        print(f"Prompt: {TEST_PROMPT}\n")

        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": TEST_PROMPT}],
            temperature=0.2,
        )

        text = completion.choices[0].message.content
        print(f"Response text:\n{text}")
        print(f"\nUsage: {completion.usage}")
        print("\n✓ Groq OK")

    except Exception as exc:
        print(f"\n✗ Error: {exc}")
        traceback.print_exc()


# ── Ollama model list ──────────────────────────────────────────────────────────

def list_ollama_models(base_url: str = "http://localhost:11434"):
    print(f"\n{SEP}")
    print(f"OLLAMA AVAILABLE MODELS  ({base_url})")
    print(SEP)
    try:
        resp = requests.get(f"{base_url.rstrip('/')}/api/tags", timeout=10)
        resp.raise_for_status()
        models = resp.json().get("models", [])
        if not models:
            print("No models found — have you pulled any? e.g.  ollama pull qwen2.5:3b")
        for m in models:
            print(f"  {m['name']}  (size: {m.get('size', '?')} bytes)")
    except requests.exceptions.ConnectionError:
        print("✗ Cannot connect — Ollama is not running")
    except Exception as exc:
        print(f"✗ {exc}")


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Test AI providers")
    parser.add_argument(
        "--provider", choices=["ollama", "gemini", "groq", "all"], default="all",
        help="Which provider to test (default: all)",
    )
    parser.add_argument("--model", default="qwen2.5:3b", help="Ollama model name")
    parser.add_argument("--url", default="http://localhost:11434", help="Ollama base URL")
    args = parser.parse_args()

    list_ollama_models(args.url)

    if args.provider in ("ollama", "all"):
        test_ollama(model=args.model, base_url=args.url)

    if args.provider in ("gemini", "all"):
        test_gemini()

    if args.provider in ("groq", "all"):
        test_groq()

    print(f"\n{SEP}")
    print("Done.")
    print(SEP)
