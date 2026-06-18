# mamba_sentiment.py
import re
import torch
import torch.nn as nn
from transformers import (
    AutoTokenizer,
    AutoModel,
    pipeline
)

# ---------------- Emotion model (fast & sharp) ----------------
emotion_pipeline = pipeline(
    "text-classification",
    model="j-hartmann/emotion-english-distilroberta-base",
    return_all_scores=True
)

EMOTION_TO_SENTIMENT = {
    "joy": "POSITIVE",
    "surprise": "POSITIVE",

    "sadness": "NEGATIVE",
    "anger": "NEGATIVE",
    "fear": "NEGATIVE",
    "disgust": "NEGATIVE",

    "neutral": "NEUTRAL"
}

# ---------------- Mamba ----------------
MODEL_NAME = "state-spaces/mamba-130m-hf"
DEVICE = "cpu"

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
mamba = AutoModel.from_pretrained(MODEL_NAME).to(DEVICE)
mamba.eval()

class SentimentHead(nn.Module):
    def __init__(self, hidden_size=768):
        super().__init__()
        self.fc = nn.Linear(hidden_size, 3)

    def forward(self, x):
        return self.fc(x)

classifier = SentimentHead().to(DEVICE)
classifier.eval()

LABELS = ["NEGATIVE", "NEUTRAL", "POSITIVE"]

# ---------------- Safety ----------------
SUICIDAL_PATTERNS = [
    r"i want to die",
    r"kill myself",
    r"end my life",
    r"no reason to live",
    r"want to disappear",
    r"i am done with life",
]

# ---------------- Analyzer ----------------
def analyze_sentiment(text: str):
    if not text or not text.strip():
        return {"sentiment": "NEUTRAL", "confidence": 0.0}

    text_lower = text.lower()

    # 1️⃣ Safety override
    for p in SUICIDAL_PATTERNS:
        if re.search(p, text_lower):
            return {"sentiment": "NEGATIVE", "confidence": 0.97}

    # 2️⃣ Emotion detector (strong signal)
    emotions = emotion_pipeline(text)[0]
    top_emotion = max(emotions, key=lambda x: x["score"])

    emotion_label = top_emotion["label"].lower()
    emotion_score = top_emotion["score"]

    # If emotion is confident → trust it
    if emotion_score > 0.65:
        return {
            "sentiment": EMOTION_TO_SENTIMENT.get(emotion_label, "NEUTRAL"),
            "confidence": round(min(max(emotion_score, 0.6), 0.95), 3)
        }

    # 3️⃣ Otherwise → use Mamba for context
    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=256
    ).to(DEVICE)

    with torch.no_grad():
        outputs = mamba(**inputs)
        pooled = outputs.last_hidden_state.mean(dim=1)
        logits = classifier(pooled)
        probs = torch.softmax(logits, dim=-1)[0]

    idx = torch.argmax(probs).item()
    confidence = probs[idx].item()

    return {
        "sentiment": LABELS[idx],
        "confidence": round(min(max(confidence, 0.55), 0.85), 3)
    }
