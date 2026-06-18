# backend/sarcasm_detection.py
import re

# Comprehensive sarcasm patterns
SARCASTIC_PHRASES = {
    "high": [
        r"(?i)oh great.*another",
        r"(?i)just what i needed",
        r"(?i)exactly what i wanted",
        r"(?i)love how.*always",
        r"(?i)love when.*always",
        r"(?i)perfect.*(?:timing|just)",
        r"(?i)brilliant.*(?:idea|solution)",
        r"(?i)thanks a lot.*for",
        r"(?i)so excited.*(?:cancelled|delayed)",
        r"(?i)oh wonderful",
        r"(?i)oh fantastic",
        r"(?i)how lovely",
    ],
    "medium": [
        r"(?i)how (?:lovely|wonderful|fantastic)",
        r"(?i)best.*(?:day|ever|idea)",
        r"(?i)great.*(?:job|work|as always)",
        r"(?i)wonderful.*(?:news|surprise)",
        r"(?i)fantastic.*(?:service|product)",
        r"(?i)awesome.*(?:another|again)",
        r"(?i)amazing.*(?:how|that|you)",
    ],
    "low": [
        r"(?i)totally (?:makes sense|fair)",
        r"(?i)oh sure",
        r"(?i)right.*because",
        r"(?i)of course.*(?:you|they|it)",
        r"(?i)yeah.*right",
        r"(?i)sure.*whatever",
    ]
}

# Positive and negative word lists for contradiction detection
POSITIVE_WORDS = {
    "love", "great", "wonderful", "fantastic", "amazing", "perfect", 
    "brilliant", "awesome", "excellent", "superb", "outstanding",
    "beautiful", "gorgeous", "incredible", "fabulous", "terrific",
    "best", "beautiful", "happy", "joy", "excited"
}

NEGATIVE_WORDS = {
    "hate", "terrible", "awful", "horrible", "worst", "disaster", 
    "waste", "broken", "crash", "late", "cancel", "damage",
    "sucks", "stupid", "useless", "pathetic", "annoying", "frustrating"
}

SARCASM_SCORES = {
    "high": 0.85,
    "medium": 0.65,
    "low": 0.45
}

def detect_sarcasm_patterns(text):
    """Detect sarcasm using pattern matching"""
    text_lower = text.lower()
    max_score = 0
    detected_type = None
    
    for level, patterns in SARCASTIC_PHRASES.items():
        for pattern in patterns:
            if re.search(pattern, text_lower):
                score = SARCASM_SCORES[level]
                if score > max_score:
                    max_score = score
                    detected_type = level
    
    return max_score, detected_type

def detect_contradiction(text):
    """Detect contradiction between positive and negative words"""
    words = set(text.lower().split())
    
    positive_found = words & POSITIVE_WORDS
    negative_found = words & NEGATIVE_WORDS
    
    if positive_found and negative_found:
        # More positive words = higher chance of sarcasm
        pos_count = len(positive_found)
        neg_count = len(negative_found)
        base_score = 0.35
        bonus = min((pos_count + neg_count) * 0.05, 0.3)
        return min(base_score + bonus, 0.8)
    return 0

def detect_exaggeration(text):
    """Detect exaggerated language patterns"""
    text_lower = text.lower()
    score = 0
    
    # Multiple exclamation marks
    if text.count('!') >= 2:
        score += 0.2
    if text.count('!') >= 3:
        score += 0.1
    
    # All caps words
    words = text.split()
    caps_count = sum(1 for w in words if w.isupper() and len(w) > 2)
    if caps_count > 0:
        score += min(caps_count * 0.1, 0.2)
    
    # Exaggeration words
    exaggeration_words = ['literally', 'absolutely', 'totally', 'completely', 'seriously']
    for word in exaggeration_words:
        if word in text_lower:
            score += 0.08
    
    # Extreme adjectives
    extreme_words = ['worst', 'best', 'greatest', 'terrible', 'never', 'always', 'everyone']
    for word in extreme_words:
        if word in text_lower:
            score += 0.05
    
    return min(score, 0.5)

def detect_question_exclamation(text):
    """Detect rhetorical questions and exclamation combos"""
    score = 0
    
    # Question mark with exclamation
    if '?!!' in text or '!?' in text:
        score += 0.3
    elif '?' in text and '!' in text:
        score += 0.2
    
    # Rhetorical question patterns
    rhetorical = ['?', 'is it', 'are you', 'do you really', 'did you really']
    for pattern in rhetorical:
        if pattern in text.lower():
            score += 0.1
    
    return min(score, 0.4)

def get_sarcasm_confidence(text):
    """
    Enhanced sarcasm detection combining multiple methods.
    Returns confidence score and whether text is sarcastic.
    """
    if not text or len(text.strip()) < 15:
        return {"is_sarcastic": False, "confidence": 0.0, "details": {}}
    
    # Calculate individual scores
    pattern_score, pattern_type = detect_sarcasm_patterns(text)
    contradiction_score = detect_contradiction(text)
    exaggeration_score = detect_exaggeration(text)
    question_score = detect_question_exclamation(text)
    
    # Weighted combination (optimized weights)
    total_score = (
        pattern_score * 0.45 +
        contradiction_score * 0.25 +
        exaggeration_score * 0.15 +
        question_score * 0.15
    )
    
    # Boost score if multiple indicators present
    indicators_present = sum([
        pattern_score > 0,
        contradiction_score > 0,
        exaggeration_score > 0.15,
        question_score > 0.1
    ])
    
    if indicators_present >= 2:
        total_score = min(total_score + 0.1, 0.95)
    if indicators_present >= 3:
        total_score = min(total_score + 0.05, 0.95)
    
    is_sarcastic = total_score > 0.45
    
    return {
        "is_sarcastic": is_sarcastic,
        "confidence": round(total_score, 3),
        "pattern_confidence": round(pattern_score, 3),
        "contradiction_confidence": round(contradiction_score, 3),
        "exaggeration_confidence": round(exaggeration_score, 3),
        "pattern_type": pattern_type
    }

# Pre-compiled patterns for faster execution
_COMPILED_PATTERNS = {
    "positive": re.compile(r'\b(?:' + '|'.join(POSITIVE_WORDS) + r')\b', re.IGNORECASE),
    "negative": re.compile(r'\b(?:' + '|'.join(NEGATIVE_WORDS) + r')\b', re.IGNORECASE),
}

def quick_sarcasm_check(text):
    """Fast check for sarcasm (for real-time use)"""
    # Quick pattern check first
    for level, patterns in SARCASTIC_PHRASES.items():
        for pattern in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return True
    
    # Quick contradiction check
    has_positive = bool(_COMPILED_PATTERNS["positive"].search(text))
    has_negative = bool(_COMPILED_PATTERNS["negative"].search(text))
    
    return has_positive and has_negative