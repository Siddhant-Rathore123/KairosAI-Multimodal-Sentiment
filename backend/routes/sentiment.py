from fastapi import APIRouter
from pydantic import BaseModel
from transformers import pipeline

router = APIRouter()

sentiment_pipeline = pipeline("sentiment-analysis")

class TextInput(BaseModel):
    text: str

@router.post("/analyze/text")
def analyze_text(data: TextInput):
    return sentiment_pipeline(data.text)
