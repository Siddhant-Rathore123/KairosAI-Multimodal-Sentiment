# image_sentiment.py
import torch
from PIL import Image
from transformers import CLIPProcessor, CLIPModel

device = "cpu"

clip_model = CLIPModel.from_pretrained(
    "openai/clip-vit-base-patch32"
).to(device)

clip_processor = CLIPProcessor.from_pretrained(
    "openai/clip-vit-base-patch32"
)

IMAGE_SENTIMENT_LABELS = [
    "a happy joyful image",
    "a sad depressing image",
    "an angry aggressive image",
    "a neutral image"
]

LABEL_MAP = {
    0: "POSITIVE",
    1: "NEGATIVE",
    2: "NEGATIVE",
    3: "NEUTRAL"
}

def analyze_image_sentiment(image: Image.Image):
    inputs = clip_processor(
        text=IMAGE_SENTIMENT_LABELS,
        images=image,
        return_tensors="pt",
        padding=True
    ).to(device)

    with torch.no_grad():
        outputs = clip_model(**inputs)
        probs = outputs.logits_per_image.softmax(dim=1)[0]

    best_idx = torch.argmax(probs).item()

    return {
        "sentiment": LABEL_MAP[best_idx],
        "confidence": round(probs[best_idx].item(), 4)
    }
