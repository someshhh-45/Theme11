import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import io
import os
import shutil
import logging
import sys
from pathlib import Path
import cv2
import numpy as np

# =========================
# 🔹 LOGGING
# =========================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# =========================
# 🔹 CONFIG
# =========================
MIN_TEXT_THRESHOLD = 80


def _configure_tesseract() -> None:
    env_cmd = os.getenv("TESSERACT_CMD")
    candidates: list[str] = []
    if env_cmd:
        candidates.append(env_cmd)

    which_cmd = shutil.which("tesseract")
    if which_cmd:
        candidates.append(which_cmd)

    prefix = Path(sys.prefix)
    candidates.extend([
        str(prefix / "Scripts" / "tesseract.exe"),
        str(prefix / "Library" / "bin" / "tesseract.exe"),
    ])

    if not os.getenv("TESSDATA_PREFIX"):
        tessdata_candidates = [
            prefix / "share" / "tessdata",
            prefix / "Library" / "share" / "tessdata",
            Path(r"C:\\Program Files\\Tesseract-OCR\\tessdata"),
            Path(r"C:\\Program Files (x86)\\Tesseract-OCR\\tessdata"),
        ]
        for tessdata_dir in tessdata_candidates:
            if tessdata_dir.exists():
                os.environ["TESSDATA_PREFIX"] = str(tessdata_dir)
                logger.info(f"Using TESSDATA_PREFIX: {tessdata_dir}")
                break

    candidates.extend([
        r"C:\\Program Files\\Tesseract-OCR\\tesseract.exe",
        r"C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe",
    ])

    for cmd in candidates:
        if cmd and Path(cmd).exists():
            pytesseract.pytesseract.tesseract_cmd = cmd
            logger.info(f"Using tesseract executable: {cmd}")
            return

    logger.warning(
        "Tesseract OCR binary not found. Install Tesseract and/or set TESSERACT_CMD."
    )


_configure_tesseract()


# =========================
# 🔹 SCANNED DETECTION
# =========================
def is_page_scanned(page):
    text = page.get_text().strip()
    return len(text.split()) < 10 or len(text) < MIN_TEXT_THRESHOLD


# =========================
# 🔥 IMAGE PREPROCESSING
# =========================
def preprocess_image(pil_image):
    img = np.array(pil_image)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    gray = cv2.medianBlur(gray, 3)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return thresh


# =========================
# 🔥 OCR
# =========================
def extract_text_from_image_page(page):
    try:
        mat = fitz.Matrix(2.5, 2.5)
        pix = page.get_pixmap(matrix=mat)

        img_bytes = pix.tobytes("png")
        image = Image.open(io.BytesIO(img_bytes))

        processed = preprocess_image(image)

        text = pytesseract.image_to_string(
            processed,
            lang='eng',
            config='--oem 3 --psm 6'
        )

        return text.strip()

    except Exception as e:
        logger.error(f"OCR failed: {e}")
        return ""


# =========================
# 🔹 DIGITAL TEXT
# =========================
def extract_text_from_digital_page(page):
    try:
        return page.get_text("text").strip()
    except Exception as e:
        logger.error(f"Digital extraction failed: {e}")
        return ""


# =========================
# 🔹 MAIN PARSER
# =========================
def parse_pdf(pdf_path: str) -> dict:
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF not found at: {pdf_path}")

    doc = fitz.open(pdf_path)

    full_text = ""
    scanned_pages = []
    digital_pages = []

    for i in range(len(doc)):
        page = doc[i]

        try:
            if is_page_scanned(page):
                logger.info(f"Page {i+1}: SCANNED → OCR")
                text = extract_text_from_image_page(page)

                if not text:
                    logger.warning(f"OCR failed, fallback to digital")
                    text = extract_text_from_digital_page(page)

                scanned_pages.append(i + 1)

            else:
                logger.info(f"Page {i+1}: DIGITAL → TEXT")
                text = extract_text_from_digital_page(page)
                digital_pages.append(i + 1)

        except Exception as e:
            logger.error(f"Page {i+1} failed: {e}")
            text = ""

        clean_text = text.strip()
        logger.info(f"Sample Page {i+1}: {clean_text[:150]}")

        full_text += f"\n--- PAGE {i+1} ---\n{clean_text}"

    doc.close()

    return {
        "full_text": full_text,
        "scanned_pages": scanned_pages,
        "digital_pages": digital_pages
    }


# =========================
# 🔥 CONFIDENCE SYSTEM (ADDED ONLY)
# =========================
def compute_text_confidence(parsed_data: dict) -> float:
    try:
        text = parsed_data.get("full_text", "")
        scanned_pages = parsed_data.get("scanned_pages", [])
        digital_pages = parsed_data.get("digital_pages", [])

        total_pages = len(scanned_pages) + len(digital_pages)
        if total_pages == 0:
            return 0.0

        digital_ratio = len(digital_pages) / total_pages
        ocr_ratio = len(scanned_pages) / total_pages

        avg_chars = len(text) / total_pages if total_pages else 0

        if avg_chars > 2000:
            density_score = 1.0
        elif avg_chars > 1000:
            density_score = 0.8
        elif avg_chars > 500:
            density_score = 0.6
        else:
            density_score = 0.3

        ocr_penalty = 0.8 if ocr_ratio > 0 else 1.0

        confidence = (
            0.5 * digital_ratio +
            0.3 * density_score +
            0.2 * ocr_penalty
        )

        return round(confidence, 2)

    except Exception as e:
        logger.error(f"Confidence computation failed: {e}")
        return 0.0


# =========================
# 🔥 FINAL TEXT FOR AI
# =========================
def extract_text(pdf_path: str) -> dict:
    data = parse_pdf(pdf_path)

    text = data["full_text"]

    if len(text) > 15000:
        text = text[:8000] + "\n" + text[-4000:]

    confidence = compute_text_confidence(data)

    return {
        "text": text,
        "text_confidence": confidence
    }