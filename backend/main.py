import os
import torch
import torch.nn.functional as F
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer
from transformers import CLIPProcessor, CLIPModel
from PIL import Image
import io
import cv2
import tempfile
import re
import numpy as np

from model import MambaSentiment

# Try to import FER for face analysis
try:
    from fer.fer import FER
    FER_AVAILABLE = True
    print("✅ FER available for face analysis")
except ImportError:
    FER_AVAILABLE = False
    print("⚠️ FER not available. Install with: pip install fer")

# ---------------- App ----------------
app = FastAPI(title="KairosAI Multimodal Sentiment")

# ---------------- CORS ----------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- Config ----------------
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
LABELS = ["NEGATIVE", "NEUTRAL", "POSITIVE"]

# ---------------- Paths ----------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "mamba_finetune", "mamba_sentiment.pt")
MODEL_NAME = "state-spaces/mamba-130m-hf"

# ---------------- Load Tokenizer ----------------
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

# ---------------- Load Text Model ----------------
model = MambaSentiment(num_labels=3).to(DEVICE)
model_loaded = False

def load_checkpoint_safely(model, path):
    state = torch.load(path, map_location=DEVICE)
    if any(k.startswith("_orig_mod.") for k in state.keys()):
        state = {k.replace("_orig_mod.", ""): v for k, v in state.items()}
    model.load_state_dict(state, strict=True)

if os.path.exists(MODEL_PATH):
    load_checkpoint_safely(model, MODEL_PATH)
    model.eval()
    model_loaded = True
    print("✅ Text model loaded")
else:
    print(f"⚠️ Model not found at {MODEL_PATH}")

# =====================================================
# 🔥 CLIP MODEL FOR IMAGES/VIDEOS
# =====================================================
CLIP_MODEL_NAME = "openai/clip-vit-large-patch14"

clip_model = CLIPModel.from_pretrained(CLIP_MODEL_NAME).to(DEVICE)
clip_processor = CLIPProcessor.from_pretrained(CLIP_MODEL_NAME)
clip_model.eval()

print("✅ CLIP Large model loaded")

CLIP_PROMPTS = {
    0: ["a disturbing image", "a tragic scene", "a depressing image", "a dark and scary image"],
    1: ["a normal everyday scene", "an emotionally neutral image", "a regular environment"],
    2: ["a joyful and happy image", "a beautiful scene", "an uplifting image", "a heartwarming moment"]
}

def get_clip_sentiment_probs(image):
    all_prompts = []
    label_map = []
    for label_idx, prompts in CLIP_PROMPTS.items():
        for p in prompts:
            all_prompts.append(p)
            label_map.append(label_idx)
    
    inputs = clip_processor(text=all_prompts, images=image, return_tensors="pt", padding=True).to(DEVICE)
    with torch.no_grad():
        outputs = clip_model(**inputs)
        logits = outputs.logits_per_image.softmax(dim=1)[0]
    
    sentiment_probs = torch.zeros(3).to(DEVICE)
    for i, label_idx in enumerate(label_map):
        sentiment_probs[label_idx] += logits[i]
    sentiment_probs = sentiment_probs / sentiment_probs.sum()
    return sentiment_probs

# =====================================================
# 🔥 INITIALIZE FER FOR FACE ANALYSIS
# =====================================================
emotion_detector = None
if FER_AVAILABLE:
    try:
        emotion_detector = FER(mtcnn=False)
        print("✅ FER emotion detector loaded successfully!")
    except Exception as e:
        print(f"⚠️ Error loading FER: {e}")

# =====================================================
# 🔥 TEXT PREPROCESSING
# =====================================================

def preprocess_text_advanced(text):
    """Advanced text preprocessing for better sentiment detection"""
    if not text:
        return text
    
    text = text.lower()
    text = re.sub(r'http\S+|www\S+|https\S+', '', text, flags=re.MULTILINE)
    text = re.sub(r'@\w+', '', text)
    text = re.sub(r'#(\w+)', r'\1', text)
    text = re.sub(r'[^\w\s!?.,;:]', ' ', text)
    text = re.sub(r'(.)\1{3,}', r'\1\1', text)
    
    contractions = {
        "don't": "do not", "can't": "cannot", "won't": "will not",
        "i'm": "i am", "you're": "you are", "he's": "he is",
        "she's": "she is", "it's": "it is", "we're": "we are",
        "they're": "they are", "isn't": "is not", "aren't": "are not",
        "wasn't": "was not", "weren't": "were not", "hasn't": "has not",
        "haven't": "have not", "hadn't": "had not", "doesn't": "does not",
        "didn't": "did not", "wouldn't": "would not", "shouldn't": "should not",
        "couldn't": "could not"
    }
    for contraction, expansion in contractions.items():
        text = text.replace(contraction, expansion)
    
    text = re.sub(r'\bnot\s+(\w+)', r'not_\1', text)
    text = re.sub(r"\bn't\s+(\w+)", r'not_\1', text)
    text = ' '.join(text.split())
    
    return text

def augment_with_emojis(text):
    """Convert emojis to sentiment tokens"""
    emoji_map = {
        '😊': ' happy ', '😀': ' happy ', '😂': ' funny ', '😍': ' love ',
        '🥰': ' love ', '😁': ' happy ', '😎': ' cool ', '🤗': ' hug ',
        '😢': ' sad ', '😭': ' very_sad ', '😞': ' disappointed ', '😔': ' sad ',
        '😡': ' angry ', '😠': ' angry ', '🤬': ' angry ', '😤': ' frustrated ',
        '👍': ' good ', '👎': ' bad ', '❤️': ' love ', '💔': ' heartbroken ',
        '🎉': ' celebration ', '🥳': ' party ', '🤔': ' thinking ', '😐': ' neutral '
    }
    for emoji, meaning in emoji_map.items():
        if emoji in text:
            text = text.replace(emoji, meaning)
    return text

def handle_slang(text):
    """Convert common slang to standard words"""
    slang_map = {
        'u': 'you', 'r': 'are', 'ur': 'your', 'ppl': 'people',
        'btw': 'by the way', 'lol': 'laughing', 'lmao': 'laughing',
        'rofl': 'laughing', 'omg': 'oh my god', 'wtf': 'what the',
        'idk': 'i do not know', 'ikr': 'i know right', 'tbh': 'to be honest',
        'imo': 'in my opinion', 'imho': 'in my humble opinion',
        'fyi': 'for your information', 'asap': 'as soon as possible',
        'afaik': 'as far as i know', 'irl': 'in real life',
        'jk': 'just kidding', 'np': 'no problem', 'ty': 'thank you',
        'yw': 'you are welcome', 'pls': 'please', 'plz': 'please',
        'thx': 'thanks', 'thnx': 'thanks'
    }
    words = text.split()
    words = [slang_map.get(word, word) for word in words]
    return ' '.join(words)

def extract_sentiment_features(text):
    """Extract additional features to boost accuracy"""
    features = {}
    text_lower = text.lower()
    
    features['excitement'] = min(text.count('!') / 3, 1.0)
    features['uncertainty'] = min(text.count('?') / 2, 1.0)
    
    words = text.split()
    caps_words = sum(1 for w in words if w.isupper() and len(w) > 2)
    features['emphasis'] = min(caps_words / 5, 1.0) if words else 0
    
    negation_words = ['not', 'no', 'never', 'neither', 'nor', 'none', "n't", 'not_']
    features['has_negation'] = any(neg in text_lower for neg in negation_words)
    
    intensifiers = ['very', 'really', 'extremely', 'absolutely', 'totally', 'completely', 'so']
    features['intensity'] = min(sum(1 for word in intensifiers if word in text_lower) / 5, 1.0)
    
    strong_positive = ['love', 'amazing', 'perfect', 'excellent', 'wonderful', 'fantastic']
    strong_negative = ['hate', 'terrible', 'awful', 'horrible', 'disaster', 'worst']
    
    features['strong_positive'] = any(word in text_lower for word in strong_positive)
    features['strong_negative'] = any(word in text_lower for word in strong_negative)
    features['text_length'] = len(text)
    
    return features

# =====================================================
# 🔥 ENHANCED TOKENIZATION FOR MAMBA
# =====================================================

def tokenize_text_enhanced(text, max_len=256):
    """Enhanced tokenization with better handling for Mamba"""
    original_text = text
    text = preprocess_text_advanced(text)
    text = augment_with_emojis(text)
    text = handle_slang(text)
    features = extract_sentiment_features(original_text)
    
    if features['has_negation']:
        text = "[NEG] " + text
    if features['excitement'] > 0.5:
        text = "[EXC] " + text
    if features['uncertainty'] > 0.5:
        text = "[UNC] " + text
    if features['strong_positive']:
        text = "[STRONG_POS] " + text
    if features['strong_negative']:
        text = "[STRONG_NEG] " + text
    
    encoded = tokenizer(
        text,
        truncation=True,
        padding="max_length",
        max_length=max_len,
        return_tensors="pt",
        return_attention_mask=True
    )
    
    return encoded["input_ids"].to(DEVICE), encoded["attention_mask"].to(DEVICE), features

# =====================================================
# 🔥 RULE-BASED CORRECTION
# =====================================================

def apply_sentiment_rules(text, sentiment, confidence, features):
    """Apply linguistic rules to correct sentiment"""
    text_lower = text.lower()
    
    negation_patterns = [
        r'not\s+(good|great|happy|love|like|nice|fine)',
        r"n't\s+(?:like|love|want|care)",
        r'no\s+(?:good|happy|pleased|satisfied)',
        r'not_\w+',
    ]
    
    for pattern in negation_patterns:
        if re.search(pattern, text_lower):
            if sentiment == "POSITIVE":
                sentiment = "NEGATIVE"
                confidence = confidence * 0.85
            elif sentiment == "NEGATIVE":
                sentiment = "POSITIVE"
                confidence = confidence * 0.85
            break
    
    sarcasm_indicators = [
        'oh great', 'just what i needed', 'love how', 'love when',
        'perfect timing', 'brilliant', 'thanks a lot', 'oh wonderful',
        'how lovely', 'fantastic', 'awesome'
    ]
    
    for indicator in sarcasm_indicators:
        if indicator in text_lower:
            if sentiment == "POSITIVE":
                sentiment = "NEGATIVE"
                confidence = confidence * 0.65
            break
    
    if features['strong_positive'] and sentiment == "POSITIVE":
        confidence = min(confidence * 1.2, 0.95)
    elif features['strong_positive'] and sentiment != "POSITIVE":
        if confidence < 0.6:
            sentiment = "POSITIVE"
            confidence = confidence * 0.7
    
    if features['strong_negative'] and sentiment == "NEGATIVE":
        confidence = min(confidence * 1.2, 0.95)
    
    if features['intensity'] > 0.3 and sentiment != "NEUTRAL":
        confidence = min(confidence * 1.15, 0.95)
    
    if features['uncertainty'] > 0.5:
        confidence = confidence * 0.75
        if confidence < 0.4 and sentiment != "NEUTRAL":
            sentiment = "NEUTRAL"
    
    if features['excitement'] > 0.5 and sentiment != "NEUTRAL":
        confidence = min(confidence * 1.1, 0.95)
    
    if features['text_length'] < 20:
        confidence = confidence * 0.7
        if confidence < 0.45:
            sentiment = "NEUTRAL"
    
    return sentiment, confidence

# =====================================================
# 🔥 CONFIDENCE CALIBRATION
# =====================================================

def calibrate_mamba_confidence(logits, features):
    """Calibrate confidence based on various factors"""
    probs = F.softmax(logits, dim=-1)[0]
    raw_confidence = torch.max(probs).item()
    
    if features['text_length'] < 20:
        raw_confidence *= 0.6
    elif features['text_length'] < 50:
        raw_confidence *= 0.8
    elif features['text_length'] > 200:
        raw_confidence = min(raw_confidence * 1.05, 0.95)
    
    if features['excitement'] > 0.5:
        raw_confidence = min(raw_confidence * 1.1, 0.95)
    
    if features['uncertainty'] > 0.5:
        raw_confidence *= 0.8
    
    if features['has_negation']:
        raw_confidence *= 0.9
    
    if features['intensity'] > 0.3:
        raw_confidence = min(raw_confidence * 1.05, 0.95)
    
    return max(0.30, min(raw_confidence, 0.92))

# =====================================================
# 🔥 SARCASM DETECTION
# =====================================================

SARCASTIC_PHRASES = [
    r'oh great', r'just what i needed', r'love how', r'love when',
    r'perfect timing', r'brilliant', r'thanks a lot', r'oh wonderful',
    r'how lovely', r'fantastic', r'awesome', r'so excited'
]

def get_sarcasm_confidence(text):
    """Detect sarcasm using pattern matching"""
    text_lower = text.lower()
    max_score = 0
    
    for pattern in SARCASTIC_PHRASES:
        if re.search(pattern, text_lower):
            score = 0.7
            if 'love' in text_lower or 'great' in text_lower:
                score += 0.15
            if text.count('!') > 1:
                score += 0.1
            if score > max_score:
                max_score = min(score, 0.9)
    
    positive_words = ['love', 'great', 'wonderful', 'amazing', 'perfect', 'excellent']
    negative_words = ['hate', 'terrible', 'awful', 'horrible', 'disaster', 'broken']
    
    has_positive = any(word in text_lower for word in positive_words)
    has_negative = any(word in text_lower for word in negative_words)
    
    if has_positive and has_negative:
        max_score = max(max_score, 0.65)
    
    is_sarcastic = max_score > 0.55
    
    return {
        "is_sarcastic": is_sarcastic,
        "confidence": round(max_score, 3)
    }

# =====================================================
# 🔹 TEXT ANALYSIS ENDPOINT
# =====================================================

class TextInput(BaseModel):
    text: str

@app.post("/analyze/text")
def analyze_text(data: TextInput):
    text = data.text.strip()
    
    if not text or not model_loaded:
        return {"sentiment": "NEUTRAL", "confidence": 0.0, "is_sarcastic": False}
    
    features = extract_sentiment_features(text)
    input_ids, attention_mask, token_features = tokenize_text_enhanced(text)
    
    with torch.no_grad():
        logits = model(input_ids, attention_mask)
        probs = F.softmax(logits, dim=-1)[0]
        raw_idx = torch.argmax(probs).item()
        raw_sentiment = LABELS[raw_idx]
        raw_confidence = probs[raw_idx].item()
    
    calibrated_confidence = calibrate_mamba_confidence(logits, features)
    adjusted_sentiment, adjusted_confidence = apply_sentiment_rules(
        text, raw_sentiment, calibrated_confidence, features
    )
    
    sarcasm = get_sarcasm_confidence(text)
    
    final_sentiment = adjusted_sentiment
    final_confidence = adjusted_confidence
    
    if sarcasm["is_sarcastic"] and sarcasm["confidence"] > 0.55:
        if final_sentiment == "POSITIVE":
            final_sentiment = "NEGATIVE"
            final_confidence = final_confidence * (1 - sarcasm["confidence"]) + 0.15
        elif final_sentiment == "NEGATIVE" and final_confidence < 0.45:
            final_sentiment = "NEUTRAL"
            final_confidence = 0.5
        final_confidence = min(final_confidence, 0.82)
    
    final_confidence = max(0.30, min(final_confidence, 0.95))
    
    score_details = {
        "POSITIVE": round(probs[2].item(), 3),
        "NEUTRAL": round(probs[1].item(), 3),
        "NEGATIVE": round(probs[0].item(), 3)
    }
    
    return {
        "sentiment": final_sentiment,
        "confidence": round(final_confidence, 4),
        "raw_sentiment": raw_sentiment,
        "raw_confidence": round(raw_confidence, 4),
        "is_sarcastic": sarcasm["is_sarcastic"],
        "sarcasm_confidence": sarcasm["confidence"],
        "scores": score_details,
        "features": {
            "text_length": features['text_length'],
            "has_negation": features['has_negation'],
            "intensity": features['intensity'],
            "excitement": features['excitement'],
            "uncertainty": features['uncertainty']
        }
    }

# =====================================================
# 🔹 IMAGE API
# =====================================================
@app.post("/analyze/image")
async def analyze_image(file: UploadFile = File(...)):
    contents = await file.read()
    try:
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except:
        return {"error": "Invalid image file"}
    
    image_probs = get_clip_sentiment_probs(image)
    final_idx = torch.argmax(image_probs).item()
    final_conf = image_probs[final_idx].item()
    
    return {
        "sentiment": LABELS[final_idx],
        "confidence": round(float(final_conf), 4),
        "is_sarcastic": False
    }

# =====================================================
# 🔹 VIDEO API
# =====================================================
@app.post("/analyze/video")
async def analyze_video(file: UploadFile = File(...)):
    contents = await file.read()
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        tmp.write(contents)
        temp_path = tmp.name
    
    cap = cv2.VideoCapture(temp_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
    
    if fps == 0 or total_frames == 0:
        cap.release()
        os.remove(temp_path)
        return {"error": "Invalid video file"}
    
    duration = total_frames / fps
    if duration > 30:
        cap.release()
        os.remove(temp_path)
        return {"error": "Video too long (max 30 seconds allowed)"}
    
    target_frames = 12
    frame_interval = max(1, int(total_frames // target_frames))
    sentiments = []
    confidences = []
    frame_count = 0
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_count % frame_interval == 0:
            try:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(rgb)
                probs = get_clip_sentiment_probs(pil_image)
                idx = torch.argmax(probs).item()
                sentiments.append(idx)
                confidences.append(probs[idx].item())
            except:
                pass
        frame_count += 1
    
    cap.release()
    os.remove(temp_path)
    
    if not sentiments:
        return {"error": "No frames extracted"}
    
    final_idx = max(set(sentiments), key=sentiments.count)
    final_conf = sum(confidences) / len(confidences)
    
    return {
        "sentiment": LABELS[final_idx],
        "confidence": round(float(final_conf), 4),
        "is_sarcastic": False
    }

# =====================================================
# 🔹 MULTIMODAL API
# =====================================================
@app.post("/analyze/multimodal")
async def analyze_multimodal(
    text: str = Form(...),
    file: UploadFile = File(...)
):
    if model_loaded and text.strip():
        input_ids, attention_mask, _ = tokenize_text_enhanced(text)
        with torch.no_grad():
            logits = model(input_ids, attention_mask)
            text_probs = F.softmax(logits, dim=-1)[0]
    else:
        text_probs = torch.tensor([0.33, 0.34, 0.33]).to(DEVICE)
    
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        image_probs = get_clip_sentiment_probs(image)
    except:
        image_probs = torch.tensor([0.33, 0.34, 0.33]).to(DEVICE)
    
    alpha = 0.55
    beta = 0.45
    fused_probs = alpha * text_probs + beta * image_probs
    
    final_idx = torch.argmax(fused_probs).item()
    final_conf = fused_probs[final_idx].item()
    
    return {
        "sentiment": LABELS[final_idx],
        "confidence": round(float(final_conf), 4),
        "is_sarcastic": False,
        "text_probs": {
            "POSITIVE": round(text_probs[2].item(), 3),
            "NEUTRAL": round(text_probs[1].item(), 3),
            "NEGATIVE": round(text_probs[0].item(), 3)
        },
        "image_probs": {
            "POSITIVE": round(image_probs[2].item(), 3),
            "NEUTRAL": round(image_probs[1].item(), 3),
            "NEGATIVE": round(image_probs[0].item(), 3)
        }
    }

# =====================================================
# 🔹 CAMERA/FACE API (Using FER)
# =====================================================

@app.post("/analyze/face")
async def analyze_face(file: UploadFile = File(...)):
    """Analyze facial expressions using FER (Facial Expression Recognition)"""
    
    if emotion_detector is None:
        # Fallback to CLIP if FER not available
        try:
            contents = await file.read()
            image = Image.open(io.BytesIO(contents)).convert("RGB")
            probs = get_clip_sentiment_probs(image)
            final_idx = torch.argmax(probs).item()
            sentiment = LABELS[final_idx]
            confidence = probs[final_idx].item()
            
            if sentiment == "POSITIVE":
                dominant = "happy"
            elif sentiment == "NEGATIVE":
                dominant = "sad"
            else:
                dominant = "neutral"
            
            return {
                "dominant_emotion": dominant,
                "confidence": round(confidence, 3),
                "all_emotions": {
                    "happy": round(confidence if sentiment == "POSITIVE" else 0.1, 3),
                    "neutral": round(0.5, 3),
                    "sad": round(confidence if sentiment == "NEGATIVE" else 0.1, 3),
                    "angry": 0,
                    "surprise": 0,
                    "fear": 0,
                    "disgust": 0
                },
                "sentiment": sentiment,
                "success": True,
                "note": "Using CLIP fallback (install fer for better accuracy)"
            }
        except Exception as e:
            return {"error": True, "message": f"Analysis failed: {str(e)}"}
    
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return {"error": True, "message": "Could not read image"}
        
        # Convert BGR to RGB for FER
        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Detect emotions
        result = emotion_detector.detect_emotions(rgb_img)
        
        if not result or len(result) == 0:
            return {"error": True, "message": "No face detected. Please ensure your face is clearly visible and well-lit."}
        
        # Get first face's emotions
        emotions = result[0]['emotions']
        
        # Find dominant emotion
        dominant_emotion = max(emotions, key=emotions.get)
        confidence = emotions[dominant_emotion] / 100
        
        # Map emotion to sentiment
        emotion_to_sentiment = {
            'happy': 'POSITIVE',
            'surprise': 'POSITIVE',
            'neutral': 'NEUTRAL',
            'sad': 'NEGATIVE',
            'angry': 'NEGATIVE',
            'fear': 'NEGATIVE',
            'disgust': 'NEGATIVE'
        }
        
        sentiment = emotion_to_sentiment.get(dominant_emotion, 'NEUTRAL')
        
        # Prepare all emotions with percentages
        all_emotions = {k: round(v/100, 3) for k, v in emotions.items()}
        
        return {
            "dominant_emotion": dominant_emotion,
            "confidence": round(confidence, 3),
            "all_emotions": all_emotions,
            "sentiment": sentiment,
            "success": True
        }
        
    except Exception as e:
        return {"error": True, "message": f"Analysis failed: {str(e)}"}

# =====================================================
# 🔹 HEALTH CHECK
# =====================================================
@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "device": str(DEVICE),
        "model_loaded": model_loaded,
        "fer_available": FER_AVAILABLE,
        "emotion_detector_ready": emotion_detector is not None,
        "sarcasm_detection": "enabled"
    }