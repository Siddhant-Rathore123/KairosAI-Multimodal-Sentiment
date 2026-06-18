def fuse_sentiments(text_result, image_result):
    t_sent = text_result["sentiment"]
    t_conf = text_result["confidence"]
    emotion = text_result.get("emotion", "")

    i_sent = image_result["sentiment"]
    i_conf = image_result["confidence"]

    # 1️⃣ Severe emotions override image
    if emotion in ["sadness", "anger", "fear"] and t_conf > 0.85:
        final_sentiment = "NEGATIVE"

        # Image reduces certainty slightly
        confidence = round(
            min(0.98, t_conf - (0.1 if i_sent == "POSITIVE" else 0.0)),
            3
        )

        return {
            "final_sentiment": final_sentiment,
            "confidence": confidence
        }

    # 2️⃣ Same sentiment → reinforce
    if t_sent == i_sent:
        confidence = round((t_conf + i_conf) / 2, 3)
        return {
            "final_sentiment": t_sent,
            "confidence": confidence
        }

    # 3️⃣ Conflict → weighted vote
    if t_conf >= i_conf:
        final_sentiment = t_sent
        confidence = round((t_conf * 0.65 + i_conf * 0.35), 3)
    else:
        final_sentiment = i_sent
        confidence = round((i_conf * 0.6 + t_conf * 0.4), 3)

    return {
        "final_sentiment": final_sentiment,
        "confidence": confidence
    }
