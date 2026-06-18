import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';

const API = "http://127.0.0.1:8000";

const EMOTION_EMOJIS = {
  'happy': '😊',
  'sad': '😢',
  'angry': '😠',
  'fear': '😨',
  'surprise': '😲',
  'neutral': '😐',
  'disgust': '🤢'
};

const EMOTION_COLORS = {
  'happy': '#10b981',
  'sad': '#3b82f6',
  'angry': '#ef4444',
  'fear': '#8b5cf6',
  'surprise': '#f59e0b',
  'neutral': '#6b7280',
  'disgust': '#a855f7'
};

const CameraAnalyzer = ({ onAnalysisComplete }) => {
  const webcamRef = useRef(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState(null);
  const [emotionHistory, setEmotionHistory] = useState([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const liveInterval = useRef(null);

  const captureAndAnalyze = async () => {
    if (!webcamRef.current) return;
    
    setIsAnalyzing(true);
    const imageSrc = webcamRef.current.getScreenshot();
    
    const blob = await fetch(imageSrc).then(res => res.blob());
    const formData = new FormData();
    formData.append('file', blob, 'face.jpg');
    
    try {
      const response = await fetch(`${API}/analyze/face`, {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      setCurrentEmotion(data);
      
      const historyEntry = {
        ...data,
        timestamp: new Date().toLocaleTimeString()
      };
      setEmotionHistory(prev => [historyEntry, ...prev].slice(0, 10));
      
      if (onAnalysisComplete) {
        onAnalysisComplete(data);
      }
      
    } catch (error) {
      console.error('Analysis failed:', error);
      setCurrentEmotion({ error: true, message: 'Could not analyze face' });
    }
    
    setIsAnalyzing(false);
  };

  const startCountdown = () => {
    setCountdown(3);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          captureAndAnalyze();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (isLiveMode) {
      liveInterval.current = setInterval(() => {
        if (!isAnalyzing && webcamRef.current) {
          captureAndAnalyze();
        }
      }, 3000);
    } else {
      if (liveInterval.current) {
        clearInterval(liveInterval.current);
      }
    }
    
    return () => {
      if (liveInterval.current) {
        clearInterval(liveInterval.current);
      }
    };
  }, [isLiveMode]);

  const videoConstraints = {
    width: 480,
    height: 360,
    facingMode: "user"
  };

  return (
    <div className="camera-analyzer">
      <div className="camera-header">
        <h3>📸 Live Mood Analyzer</h3>
        <p>Point your camera at your face to detect emotions in real-time</p>
      </div>

      <div className="camera-container">
        <div className="webcam-wrapper">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            onUserMedia={() => setCameraReady(true)}
            className="webcam-feed"
          />
          
          {countdown !== null && (
            <div className="countdown-overlay">
              <div className="countdown-number">{countdown}</div>
            </div>
          )}
          
          {isAnalyzing && (
            <div className="analyzing-overlay">
              <div className="spinner"></div>
              <p>Analyzing your mood...</p>
            </div>
          )}
          
          {cameraReady && !isAnalyzing && countdown === null && (
            <div className="camera-ready">
              <span>✅ Camera Ready</span>
            </div>
          )}
        </div>

        <div className="camera-controls">
          <button 
            className="btn-primary" 
            onClick={startCountdown}
            disabled={isAnalyzing || !cameraReady}
          >
            📸 Capture & Analyze
          </button>
          
          <button 
            className={`btn-live ${isLiveMode ? 'active' : ''}`}
            onClick={() => setIsLiveMode(!isLiveMode)}
            disabled={!cameraReady}
          >
            {isLiveMode ? '🔴 Live Mode ON' : '⚪ Start Live Mode'}
          </button>
        </div>

        {currentEmotion && !currentEmotion.error && (
          <div className="emotion-result-card" style={{
            borderTop: `4px solid ${EMOTION_COLORS[currentEmotion.dominant_emotion] || '#3b82f6'}`
          }}>
            <div className="emotion-header">
              <span className="emotion-emoji-large">
                {EMOTION_EMOJIS[currentEmotion.dominant_emotion] || '😐'}
              </span>
              <div className="emotion-text">
                <h2 className="emotion-name">
                  {currentEmotion.dominant_emotion?.toUpperCase()}
                </h2>
                <p className="emotion-confidence">
                  Confidence: {(currentEmotion.confidence * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="emotion-breakdown">
              <h4>Emotion Breakdown</h4>
              <div className="emotion-bars">
                {Object.entries(currentEmotion.all_emotions || {}).map(([emotion, score]) => (
                  <div key={emotion} className="emotion-bar-item">
                    <div className="emotion-bar-label">
                      <span>{EMOTION_EMOJIS[emotion] || '😐'}</span>
                      <span>{emotion}</span>
                    </div>
                    <div className="emotion-bar-track">
                      <div 
                        className="emotion-bar-fill"
                        style={{ 
                          width: `${score * 100}%`,
                          backgroundColor: EMOTION_COLORS[emotion] || '#3b82f6'
                        }}
                      />
                    </div>
                    <span className="emotion-bar-value">{(score * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="face-sentiment">
              <h4>Sentiment Analysis</h4>
              <div className={`sentiment-badge-large ${currentEmotion.sentiment?.toLowerCase() || 'neutral'}`}>
                {currentEmotion.sentiment === 'POSITIVE' ? '😊 Positive Mood' :
                 currentEmotion.sentiment === 'NEGATIVE' ? '😞 Negative Mood' : '😐 Neutral Mood'}
              </div>
              <p className="emotion-insight">
                {currentEmotion.dominant_emotion === 'happy' && "You seem to be in a great mood! 😊"}
                {currentEmotion.dominant_emotion === 'sad' && "You look a bit down. Remember, it's okay to feel this way. 💙"}
                {currentEmotion.dominant_emotion === 'angry' && "You seem frustrated. Take a deep breath! 🧘"}
                {currentEmotion.dominant_emotion === 'surprise' && "Something surprising caught your attention! 🤯"}
                {currentEmotion.dominant_emotion === 'neutral' && "You seem calm and collected. 😌"}
              </p>
            </div>
          </div>
        )}

        {currentEmotion?.error && (
          <div className="error-card">
            <span>⚠️</span>
            <p>{currentEmotion.message || 'Could not detect face. Make sure your face is clearly visible and well-lit.'}</p>
          </div>
        )}

        {emotionHistory.length > 0 && (
          <div className="emotion-history">
            <h4>📊 Recent Mood History</h4>
            <div className="history-timeline">
              {emotionHistory.map((item, index) => (
                <div key={index} className="history-item">
                  <span className="history-emoji">{EMOTION_EMOJIS[item.dominant_emotion] || '😐'}</span>
                  <span className="history-time">{item.timestamp}</span>
                  <span className={`history-emotion ${item.dominant_emotion}`}>
                    {item.dominant_emotion}
                  </span>
                  <span className="history-confidence">
                    {(item.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .camera-analyzer {
          padding: 20px;
          max-width: 700px;
          margin: 0 auto;
        }
        .camera-header {
          text-align: center;
          margin-bottom: 24px;
        }
        .camera-header h3 {
          font-size: 24px;
          margin-bottom: 8px;
        }
        .camera-header p {
          color: var(--text-3);
        }
        .webcam-wrapper {
          position: relative;
          border-radius: 16px;
          overflow: hidden;
          background: #000;
          width: 100%;
          max-width: 480px;
          margin: 0 auto;
        }
        .webcam-feed {
          width: 100%;
          height: auto;
          display: block;
        }
        .countdown-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .countdown-number {
          font-size: 80px;
          font-weight: bold;
          color: white;
          animation: pulse 1s ease;
        }
        .analyzing-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .camera-ready {
          position: absolute;
          bottom: 10px;
          right: 10px;
          background: rgba(16,185,129,0.9);
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          color: white;
        }
        .camera-controls {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin-top: 16px;
        }
        .btn-live {
          padding: 10px 20px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--bg-surface);
          color: var(--text-2);
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-live.active {
          background: #ef4444;
          color: white;
          border-color: #ef4444;
        }
        .emotion-result-card {
          background: var(--bg-surface);
          border-radius: 16px;
          padding: 20px;
          margin-top: 20px;
        }
        .emotion-header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--border);
        }
        .emotion-emoji-large {
          font-size: 64px;
        }
        .emotion-name {
          font-size: 28px;
          font-weight: bold;
          margin: 0;
        }
        .emotion-breakdown {
          margin-bottom: 20px;
        }
        .emotion-bars {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .emotion-bar-item {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .emotion-bar-label {
          width: 80px;
          display: flex;
          gap: 5px;
          font-size: 13px;
        }
        .emotion-bar-track {
          flex: 1;
          height: 8px;
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
          overflow: hidden;
        }
        .emotion-bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.5s ease;
        }
        .emotion-bar-value {
          width: 40px;
          font-size: 12px;
          text-align: right;
        }
        .face-sentiment {
          background: var(--bg-card);
          border-radius: 12px;
          padding: 15px;
        }
        .sentiment-badge-large {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 99px;
          font-weight: bold;
          margin: 10px 0;
        }
        .sentiment-badge-large.positive {
          background: var(--pos-bg);
          color: var(--pos);
        }
        .sentiment-badge-large.negative {
          background: var(--neg-bg);
          color: var(--neg);
        }
        .sentiment-badge-large.neutral {
          background: var(--neu-bg);
          color: var(--neu);
        }
        .emotion-insight {
          font-size: 13px;
          color: var(--text-3);
          margin-top: 10px;
        }
        .emotion-history {
          margin-top: 20px;
        }
        .history-timeline {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 200px;
          overflow-y: auto;
        }
        .history-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background: var(--bg-card);
          border-radius: 8px;
          font-size: 13px;
        }
        .history-emoji {
          font-size: 20px;
        }
        .history-time {
          color: var(--text-3);
          font-size: 11px;
          width: 80px;
        }
        .history-emotion {
          flex: 1;
          text-transform: capitalize;
        }
        .history-emotion.happy { color: var(--pos); }
        .history-emotion.sad { color: #3b82f6; }
        .history-emotion.angry { color: var(--neg); }
        .history-confidence {
          font-weight: bold;
          color: var(--accent);
        }
        .spinner {
          width: 30px;
          height: 30px;
          border: 3px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.5); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default CameraAnalyzer;