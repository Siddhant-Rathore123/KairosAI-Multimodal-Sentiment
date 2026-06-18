import os
import sys
import torch
from torch.utils.data import DataLoader
from transformers import AutoTokenizer
from torch.cuda.amp import autocast, GradScaler

# ---------------- Path Fix ----------------
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dataset import load_goemotions
from model import MambaSentiment

# ---------------- Device ----------------
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MODEL_NAME = "state-spaces/mamba-130m-hf"
NUM_LABELS = 3
BATCH_SIZE = 8
EPOCHS = 3
NUM_WORKERS = min(8, os.cpu_count())

torch.backends.cuda.matmul.allow_tf32 = True
torch.backends.cudnn.allow_tf32 = True

# ---------------- Tokenizer ----------------
print("🔹 Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

# ---------------- Dataset ----------------
print("🔹 Loading dataset...")
dataset = load_goemotions()

def tokenize(batch):
    return tokenizer(
        batch["text"],
        truncation=True,
        padding="max_length",
        max_length=128
    )

dataset = dataset.map(tokenize, batched=True, num_proc=NUM_WORKERS)
dataset.set_format(
    type="torch",
    columns=["input_ids", "attention_mask", "label"]
)

loader = DataLoader(
    dataset,
    batch_size=BATCH_SIZE,
    shuffle=True,
    num_workers=NUM_WORKERS,
    pin_memory=True,
    persistent_workers=True
)

# ---------------- Model ----------------
print("🔹 Initializing Mamba model...")
model = MambaSentiment(num_labels=NUM_LABELS).to(DEVICE)

# 🔥 Compile model (PyTorch 2.x)
model = torch.compile(model)

optimizer = torch.optim.AdamW(model.parameters(), lr=2e-5)
loss_fn = torch.nn.CrossEntropyLoss()

scaler = GradScaler()

# ---------------- Training ----------------
print("🚀 Starting optimized training...")
model.train()

for epoch in range(EPOCHS):
    total_loss = 0.0

    for step, batch in enumerate(loader, start=1):
        optimizer.zero_grad(set_to_none=True)

        input_ids = batch["input_ids"].to(DEVICE, non_blocking=True)
        attention_mask = batch["attention_mask"].to(DEVICE, non_blocking=True)
        labels = batch["label"].to(DEVICE, non_blocking=True)

        with autocast(dtype=torch.float16):
            logits = model(input_ids, attention_mask)
            loss = loss_fn(logits, labels)

        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()

        total_loss += loss.item()

        if step % 10 == 0 or step == 1:
            print(
                f"Epoch [{epoch+1}/{EPOCHS}] "
                f"Batch [{step}/{len(loader)}] "
                f"Loss: {loss.item():.4f}",
                end="\r",
                flush=True
            )

    avg_loss = total_loss / len(loader)
    print(f"\n✅ Epoch {epoch+1} finished | Avg Loss: {avg_loss:.4f}\n")

# ---------------- Save Model ----------------
SAVE_PATH = os.path.join(os.path.dirname(__file__), "mamba_sentiment.pt")
torch.save(model.state_dict(), SAVE_PATH)

print(f"💾 Model saved at: {SAVE_PATH}")

