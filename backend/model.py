import torch
import torch.nn as nn
from transformers import AutoModel

class MambaSentiment(nn.Module):
    def __init__(self, num_labels=3, model_name="state-spaces/mamba-130m-hf"):
        super().__init__()

        # 🔹 Load Mamba backbone (NO LM head)
        self.backbone = AutoModel.from_pretrained(
            model_name,
            trust_remote_code=True
        )

        hidden_size = self.backbone.config.hidden_size

        # 🔹 Classification head
        self.classifier = nn.Linear(hidden_size, num_labels)

    def forward(self, input_ids, attention_mask=None):
        # 🚀 No hidden states, no causal head, no waste
        outputs = self.backbone(
            input_ids=input_ids,
            attention_mask=attention_mask
        )

        # 🔹 Mean pooling (better for sentiment)
        last_hidden = outputs.last_hidden_state

        if attention_mask is not None:
            mask = attention_mask.unsqueeze(-1)
            pooled = (last_hidden * mask).sum(dim=1) / mask.sum(dim=1)
        else:
            pooled = last_hidden.mean(dim=1)

        logits = self.classifier(pooled)
        return logits

