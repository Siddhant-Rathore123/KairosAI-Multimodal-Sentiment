from datasets import load_dataset

# ---------------- Label Maps ----------------

ID_TO_EMOTION = {
    0: "admiration",
    1: "amusement",
    2: "anger",
    3: "annoyance",
    4: "approval",
    5: "caring",
    6: "confusion",
    7: "curiosity",
    8: "desire",
    9: "disappointment",
    10: "disapproval",
    11: "disgust",
    12: "embarrassment",
    13: "excitement",
    14: "fear",
    15: "gratitude",
    16: "grief",
    17: "joy",
    18: "love",
    19: "nervousness",
    20: "optimism",
    21: "pride",
    22: "realization",
    23: "relief",
    24: "remorse",
    25: "sadness",
    26: "surprise",
    27: "neutral"
}

EMOTION_TO_SENTIMENT = {
    # Positive → 2
    "joy": 2,
    "excitement": 2,
    "relief": 2,
    "love": 2,
    "optimism": 2,
    "gratitude": 2,
    "admiration": 2,
    "approval": 2,
    "pride": 2,

    # Negative → 0
    "sadness": 0,
    "anger": 0,
    "fear": 0,
    "disgust": 0,
    "grief": 0,
    "remorse": 0,
    "disappointment": 0,
    "embarrassment": 0,
    "annoyance": 0,
    "disapproval": 0,

    # Neutral → 1
    "neutral": 1,
    "confusion": 1,
    "realization": 1,
    "surprise": 1,
    "curiosity": 1,
    "desire": 1,
    "nervousness": 1,
    "caring": 1
}

# ---------------- Dataset Loader ----------------

def load_goemotions():
    """
    Returns:
        HuggingFace Dataset with fields:
        - text (str)
        - label (int: 0=neg, 1=neutral, 2=positive)
    """

    ds = load_dataset(
        "go_emotions",
        "simplified",
        split="train"
    )

    def map_labels(batch):
        texts = []
        labels = []

        for text, label_ids in zip(batch["text"], batch["labels"]):
            sentiment_label = -1

            for lid in label_ids:
                emotion = ID_TO_EMOTION[lid]
                if emotion in EMOTION_TO_SENTIMENT:
                    sentiment_label = EMOTION_TO_SENTIMENT[emotion]
                    break

            if sentiment_label != -1:
                texts.append(text)
                labels.append(sentiment_label)

        return {
            "text": texts,
            "label": labels
        }

    ds = ds.map(
        map_labels,
        batched=True,
        remove_columns=ds.column_names,
        num_proc=8,
        desc="🔄 Mapping emotions → sentiment"
    )

    return ds

