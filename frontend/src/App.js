import React, { useState, useRef, useEffect } from "react";
import "./App.css";
import { 
  getAllUsers, createUser, deleteUser, getUserPosts, 
  getUserAnalytics, addPost 
} from './services/userStorage';
import { 
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import ShareReport from './components/ShareReport';
import SentimentPrediction from './components/SentimentPrediction';
import ComparisonDashboard from './components/ComparisonDashboard';
import LanguageSelector from './components/LanguageSelector';
import CameraAnalyzer from './components/CameraAnalyzer';
import { detectLanguage, translateSentiment, getTextDirection, SUPPORTED_LANGUAGES } from './services/languageService';

const API = "http://127.0.0.1:8000";

const TABS = ["text", "image", "video", "fusion", "camera", "user", "prediction", "compare", "history"];

const TAB_ICONS = {
  text: "📝",
  image: "🖼️",
  video: "🎥",
  fusion: "🔀",
  camera: "📸",
  user: "👥",
  prediction: "🔮",
  compare: "⚖️",
  history: "🕓",
};

const TAB_LABELS = {
  text: "Text",
  image: "Image",
  video: "Video",
  fusion: "Fusion",
  camera: "Live Camera",
  user: "User Timeline",
  prediction: "Prediction",
  compare: "Compare",
  history: "History",
};

const SENTIMENT_CONFIG = {
  POSITIVE: { label: "Positive", color: "positive", dot: "dot-pos" },
  NEGATIVE: { label: "Negative", color: "negative", dot: "dot-neg" },
  NEUTRAL:  { label: "Neutral",  color: "neutral",  dot: "dot-neu" },
};

const SAMPLES = [
  { label: "Positive", text: "I absolutely love this product! Best purchase I've ever made. Highly recommend to everyone." },
  { label: "Negative", text: "This is a complete disaster. Terrible quality, rude support, never buying again." },
  { label: "Neutral",  text: "The package arrived yesterday. It was okay. Nothing special, nothing bad." },
  { label: "Sarcastic", text: "Oh great, another update. Because I absolutely LOVE when my phone changes everything overnight without asking. Thanks for that." },
];

const MODEL_CARDS = [
  { icon: "📝", label: "Text", model: "Mamba-130m", detail: "State-space architecture + emotion detector + sarcasm detection" },
  { icon: "🖼️", label: "Image", model: "CLIP ViT-L/14", detail: "Ensemble prompts (6 per class)" },
  { icon: "🎥", label: "Video", model: "Frame sampling", detail: "12 frames · weighted majority vote" },
  { icon: "🔀", label: "Fusion", model: "Weighted blend", detail: "Configurable text/image weights" },
  { icon: "📸", label: "Camera", model: "DeepFace", detail: "Real-time emotion detection" },
];

const COLORS = {
  POSITIVE: '#10b981',
  NEUTRAL: '#f59e0b',
  NEGATIVE: '#ef4444'
};

function SentimentDot({ sentiment }) {
  return <span className={`dot ${SENTIMENT_CONFIG[sentiment]?.dot ?? "dot-neu"}`} />;
}

function ConfidenceBar({ sentiment, confidence }) {
  const pct = Math.round((confidence ?? 0) * 100);
  return (
    <div className="conf-bar-track">
      <div
        className={`conf-bar-fill ${SENTIMENT_CONFIG[sentiment]?.color ?? "neutral"}`}
        style={{ width: pct + "%" }}
      />
    </div>
  );
}

function ResultCard({ result, extra, meta }) {
  if (!result || result.error) return null;
  const cfg = SENTIMENT_CONFIG[result.sentiment] ?? SENTIMENT_CONFIG.NEUTRAL;
  const pct = Math.round(result.confidence * 100);
  const displayLabel = result.displaySentiment || cfg.label;

  return (
    <div className={`result-card ${cfg.color}`}>
      <div className="result-header">
        <SentimentDot sentiment={result.sentiment} />
        <span className="result-label">{displayLabel}</span>
        <span className="result-pct">{pct}%</span>
      </div>
      
      {result.is_sarcastic && (
        <div className="sarcasm-warning">
          <span className="sarcasm-icon">🎭</span>
          <div className="sarcasm-text">
            <strong>Sarcasm Detected!</strong>
            <small>
              {result.original_sentiment === 'POSITIVE' 
                ? `Text appears positive but is likely sarcastic. Original sentiment was ${result.original_sentiment} with ${Math.round((result.original_confidence || 0) * 100)}% confidence.`
                : `Sarcastic tone detected with ${Math.round((result.sarcasm_confidence || 0) * 100)}% confidence.`}
            </small>
          </div>
        </div>
      )}
      
      <ConfidenceBar sentiment={result.sentiment} confidence={result.confidence} />
      {extra}
      {meta && <p className="result-meta">{meta}</p>}
    </div>
  );
}

function ScoreBreakdown({ scores }) {
  if (!scores) return null;
  const rows = [
    { key: "POSITIVE", label: "Positive", cls: "positive" },
    { key: "NEUTRAL",  label: "Neutral",  cls: "neutral"  },
    { key: "NEGATIVE", label: "Negative", cls: "negative" },
  ];
  return (
    <div className="score-breakdown">
      {rows.map(({ key, label, cls }) => (
        <div className="score-row" key={key}>
          <span className="score-label">{label}</span>
          <div className="score-track">
            <div
              className={`score-fill ${cls}`}
              style={{ width: Math.round((scores[key] ?? 0) * 100) + "%" }}
            />
          </div>
          <span className="score-val">{Math.round((scores[key] ?? 0) * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

function UploadZone({ accept, label, hint, onFile, preview, previewType }) {
  return (
    <div className="upload-zone">
      {!preview && (
        <>
          <span className="upload-icon">{previewType === "video" ? "🎥" : "🖼️"}</span>
          <p className="upload-label">{label}</p>
          <p className="upload-hint">{hint}</p>
        </>
      )}
      {preview && previewType === "image" && (
        <img src={preview} alt="preview" className="upload-preview-img" />
      )}
      {preview && previewType === "video" && (
        <video src={preview} controls className="upload-preview-video" />
      )}
      <input
        type="file"
        accept={accept}
        className="upload-input"
        onChange={(e) => onFile && onFile(e.target.files[0])}
      />
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("text");

  // Text
  const [text, setText]               = useState("");
  const [textResult, setTextResult]   = useState(null);
  const [textScores, setTextScores]   = useState(null);
  const [textLoading, setTextLoading] = useState(false);

  // Image
  const [imageFile, setImageFile]       = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageResult, setImageResult]   = useState(null);
  const [imageLoading, setImageLoading] = useState(false);

  // Video
  const [videoFile, setVideoFile]       = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [videoResult, setVideoResult]   = useState(null);
  const [videoLoading, setVideoLoading] = useState(false);

  // Fusion
  const [fusionText, setFusionText]       = useState("");
  const [fusionFile, setFusionFile]       = useState(null);
  const [fusionPreview, setFusionPreview] = useState(null);
  const [textWeight, setTextWeight]       = useState(55);
  const [fusionResult, setFusionResult]   = useState(null);
  const [fusionLoading, setFusionLoading] = useState(false);
  const [fusionTextResult, setFusionTextResult] = useState(null);
  const [fusionImageResult, setFusionImageResult] = useState(null);

  // History
  const [history, setHistory] = useState([]);

  // User Timeline State
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [userPosts, setUserPosts] = useState([]);
  const [userAnalytics, setUserAnalytics] = useState(null);
  const [timelineData, setTimelineData] = useState([]);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showShareReport, setShowShareReport] = useState(false);

  // Language Support
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    return localStorage.getItem('preferredLanguage') || 'en';
  });
  const [detectedLanguage, setDetectedLanguage] = useState('en');
  const [isRTL, setIsRTL] = useState(false);

  useEffect(() => {
    const direction = getTextDirection(currentLanguage);
    setIsRTL(direction === 'rtl');
    document.documentElement.setAttribute('dir', direction);
    document.documentElement.setAttribute('lang', currentLanguage);
  }, [currentLanguage]);

  useEffect(() => {
    const loadUsersAndData = async () => {
      setIsLoading(true);
      try {
        const allUsers = await getAllUsers();
        setUsers(allUsers || []);
        
        const lastSelectedUserId = localStorage.getItem('lastSelectedUserId');
        
        if (allUsers && allUsers.length > 0) {
          let userToSelect = null;
          if (lastSelectedUserId) {
            userToSelect = allUsers.find(u => u.userId === lastSelectedUserId);
          }
          if (!userToSelect) {
            userToSelect = allUsers[0];
          }
          setSelectedUser(userToSelect);
          await loadUserData(userToSelect.userId);
        } else {
          setSelectedUser(null);
          setUserPosts([]);
          setUserAnalytics(null);
          setTimelineData([]);
        }
      } catch (error) {
        console.error('Error loading users:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadUsersAndData();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      localStorage.setItem('lastSelectedUserId', selectedUser.userId);
    }
  }, [selectedUser]);

  const loadUsers = async () => {
    try {
      const allUsers = await getAllUsers();
      setUsers(allUsers || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadUserData = async (userId) => {
    try {
      const posts = await getUserPosts(userId);
      const analytics = await getUserAnalytics(userId);
      setUserPosts(posts || []);
      setUserAnalytics(analytics);
      
      const timelineMap = {};
      (posts || []).forEach(post => {
        const date = new Date(post.timestamp).toLocaleDateString();
        if (!timelineMap[date]) {
          timelineMap[date] = { date, POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 };
        }
        timelineMap[date][post.sentiment]++;
      });
      setTimelineData(Object.values(timelineMap));
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserName.trim()) return;
    try {
      const newUser = await createUser(newUserName);
      setUsers([newUser, ...users]);
      setSelectedUser(newUser);
      setShowCreateUser(false);
      setNewUserName('');
      await loadUserData(newUser.userId);
      setSaveSuccess(`✅ User "${newUserName}" created!`);
      setTimeout(() => setSaveSuccess(''), 3000);
    } catch (error) {
      console.error('Error creating user:', error);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Delete this user and all their data?')) {
      await deleteUser(userId);
      const remainingUsers = users.filter(u => u.userId !== userId);
      setUsers(remainingUsers);
      if (selectedUser?.userId === userId) {
        setSelectedUser(remainingUsers[0] || null);
        if (remainingUsers[0]) loadUserData(remainingUsers[0].userId);
      }
    }
  };

  const saveToUser = async (content, result, type) => {
    if (!selectedUser) {
      alert('Please select a user in the User Timeline tab first');
      return false;
    }
    if (!result || result.error) return false;
    
    await addPost(selectedUser.userId, content, result, type);
    await loadUserData(selectedUser.userId);
    setSaveSuccess(`✅ Saved to ${selectedUser.username}'s timeline!`);
    setTimeout(() => setSaveSuccess(''), 3000);
    return true;
  };

  const addHistory = (type, label, result) => {
    setHistory((h) => [
      { type, label, result, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
      ...h,
    ].slice(0, 50));
  };

  const analyzeText = async () => {
    if (!text.trim()) return;
    setTextLoading(true);
    setTextResult(null);
    setTextScores(null);
    
    const detected = detectLanguage(text);
    setDetectedLanguage(detected);
    
    setSaveSuccess(`🔍 Detected language: ${SUPPORTED_LANGUAGES[detected]?.name || 'English'}`);
    setTimeout(() => setSaveSuccess(''), 2000);
    
    try {
      const res = await fetch(`${API}/analyze/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: detected }),
      });
      const data = await res.json();
      
      if (data.sentiment) {
        data.displaySentiment = translateSentiment(data.sentiment, currentLanguage);
      }
      
      setTextResult(data);
      if (data.scores) setTextScores(data.scores);
      addHistory("text", text.slice(0, 60), data);
      await saveToUser(text, data, 'text');
    } catch {
      setTextResult({ error: true });
    }
    setTextLoading(false);
  };

  const handleImageFile = (file) => {
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setImageResult(null);
  };

  const analyzeImage = async () => {
    if (!imageFile) return;
    setImageLoading(true);
    setImageResult(null);
    try {
      const form = new FormData();
      form.append("file", imageFile);
      const res = await fetch(`${API}/analyze/image`, { method: "POST", body: form });
      const data = await res.json();
      if (data.sentiment) {
        data.displaySentiment = translateSentiment(data.sentiment, currentLanguage);
      }
      setImageResult(data);
      addHistory("image", imageFile.name, data);
      await saveToUser(imageFile.name, data, 'image');
    } catch {
      setImageResult({ error: true });
    }
    setImageLoading(false);
  };

  const handleVideoFile = (file) => {
    if (!file) return;
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
    setVideoResult(null);
  };

  const analyzeVideo = async () => {
    if (!videoFile) return;
    setVideoLoading(true);
    setVideoResult(null);
    try {
      const form = new FormData();
      form.append("file", videoFile);
      const res = await fetch(`${API}/analyze/video`, { method: "POST", body: form });
      const data = await res.json();
      if (data.sentiment) {
        data.displaySentiment = translateSentiment(data.sentiment, currentLanguage);
      }
      setVideoResult(data);
      addHistory("video", videoFile.name, data);
      await saveToUser(videoFile.name, data, 'video');
    } catch {
      setVideoResult({ error: true });
    }
    setVideoLoading(false);
  };

  const handleFusionFile = (file) => {
    if (!file) return;
    setFusionFile(file);
    setFusionPreview(URL.createObjectURL(file));
    setFusionResult(null);
    setFusionTextResult(null);
    setFusionImageResult(null);
  };

  const analyzeFusion = async () => {
    if (!fusionText.trim() || !fusionFile) return;
    setFusionLoading(true);
    setFusionResult(null);
    setFusionTextResult(null);
    setFusionImageResult(null);
    try {
      const form = new FormData();
      form.append("text", fusionText);
      form.append("file", fusionFile);
      form.append("text_weight", textWeight / 100);
      form.append("image_weight", (100 - textWeight) / 100);
      const res = await fetch(`${API}/analyze/multimodal`, { method: "POST", body: form });
      const data = await res.json();
      if (data.sentiment) {
        data.displaySentiment = translateSentiment(data.sentiment, currentLanguage);
      }
      setFusionResult(data);
      if (data.text_result) {
        data.text_result.displaySentiment = translateSentiment(data.text_result.sentiment, currentLanguage);
        setFusionTextResult(data.text_result);
      }
      if (data.image_result) {
        data.image_result.displaySentiment = translateSentiment(data.image_result.sentiment, currentLanguage);
        setFusionImageResult(data.image_result);
      }
      addHistory("fusion", "text + image", data);
      await saveToUser(`${fusionText} + ${fusionFile.name}`, data, 'fusion');
    } catch {
      setFusionResult({ error: true });
    }
    setFusionLoading(false);
  };

  return (
    <div className="app">
      {saveSuccess && <div className="toast-success">{saveSuccess}</div>}

      <header className="app-header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-logo">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="28" height="28" rx="6" fill="url(#logoBg)"/>
                <defs>
                  <linearGradient id="logoBg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6"/>
                    <stop offset="100%" stopColor="#8b5cf6"/>
                  </linearGradient>
                </defs>
                <text x="14" y="19" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="Inter, sans-serif">K</text>
              </svg>
            </div>
            <span className="brand-name">KairosAI</span>
            <span className="brand-badge">Multimodal Sentiment</span>
          </div>
          <div className="header-right">
            <LanguageSelector currentLang={currentLanguage} onLanguageChange={setCurrentLanguage} />
            <div className="header-stats">
              <span className="header-stat"><span className="header-stat-dot dot-pos" />{translateSentiment('POSITIVE', currentLanguage)}</span>
              <span className="header-stat"><span className="header-stat-dot dot-neg" />{translateSentiment('NEGATIVE', currentLanguage)}</span>
              <span className="header-stat"><span className="header-stat-dot dot-neu" />{translateSentiment('NEUTRAL', currentLanguage)}</span>
              <span className="header-stat-divider" />
              <span className="header-stat muted">{history.length} analyzed</span>
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="model-strip">
          {MODEL_CARDS.map((m) => (
            <div
              key={m.label}
              className={`model-card ${activeTab === m.label.toLowerCase() ? "model-card-active" : ""}`}
              onClick={() => setActiveTab(m.label.toLowerCase())}
            >
              <span className="model-card-icon">{m.icon}</span>
              <div className="model-card-info">
                <span className="model-card-label">{m.label}</span>
                <span className="model-card-model">{m.model}</span>
              </div>
            </div>
          ))}
        </div>

        <nav className="tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              className={`tab ${activeTab === tab ? "tab-active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              <span className="tab-icon">{TAB_ICONS[tab]}</span>
              {TAB_LABELS[tab]}
            </button>
          ))}
        </nav>

        {/* TEXT TAB */}
        {activeTab === "text" && (
          <div className="panel">
            <div className="analysis-layout">
              <div className="analysis-input">
                <div className="card">
                  <div className="card-label">Input text</div>
                  <textarea
                    className="textarea"
                    placeholder="Paste a review, tweet, message, or anything you want to analyze…"
                    value={text}
                    maxLength={2000}
                    onChange={(e) => setText(e.target.value)}
                    style={{ direction: isRTL ? 'rtl' : 'ltr' }}
                  />
                  <div className={`char-count ${text.length > 1800 ? "char-warn" : ""}`}>
                    {text.length} / 2000
                  </div>
                  <div className="sample-row">
                    <span className="sample-row-label">Try a sample:</span>
                    {SAMPLES.map((s) => (
                      <button key={s.label} className="btn-chip" onClick={() => setText(s.text)}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <div className="action-row">
                    <button className="btn-primary" onClick={analyzeText} disabled={!text.trim() || textLoading}>
                      {textLoading ? <><span className="spinner" /> Analyzing…</> : "Analyze Text"}
                    </button>
                    <button className="btn-ghost" onClick={() => { setText(""); setTextResult(null); setTextScores(null); }}>
                      Clear
                    </button>
                  </div>
                </div>
                <div className="info-card">
                  <div className="info-card-title">How it works</div>
                  <div className="info-steps">
                    <div className="info-step"><span className="info-step-num">1</span><span>Text is processed by Mamba-130m state-space model + emotion detector</span></div>
                    <div className="info-step"><span className="info-step-num">2</span><span>Language auto-detected ({Object.keys(SUPPORTED_LANGUAGES).length} languages supported)</span></div>
                    <div className="info-step"><span className="info-step-num">3</span><span>Sarcasm detection analyzes patterns, contradictions, and exaggerations</span></div>
                    <div className="info-step"><span className="info-step-num">4</span><span>Results appear in your preferred language with sarcasm warnings</span></div>
                  </div>
                </div>
              </div>
              <div className="analysis-result">
                <div className="result-pane-label">Result</div>
                {!textResult && !textLoading && (
                  <div className="idle-hint">
                    <span className="idle-hint-icon">📊</span>
                    <p className="idle-hint-text">Enter text and click <strong>Analyze Text</strong> to see results</p>
                    <p className="idle-hint-sub">Powered by Mamba-130m + emotion detector + sarcasm detection · {Object.keys(SUPPORTED_LANGUAGES).length} languages supported</p>
                  </div>
                )}
                {textLoading && (
                  <div className="loading-pane">
                    <span className="loading-spinner-lg" />
                    <p>Analyzing text with Mamba-130m and sarcasm detection…</p>
                  </div>
                )}
                {textResult && !textResult.error && (
                  <ResultCard 
                    result={textResult} 
                    extra={<ScoreBreakdown scores={textScores} />} 
                    meta={`Analyzed with Mamba-130m · Language: ${SUPPORTED_LANGUAGES[detectedLanguage]?.name || 'English'} · Sarcasm detection: ${textResult.is_sarcastic ? 'Enabled' : 'Active'}`}
                  />
                )}
                {textResult?.error && (
                  <div className="error-card">Could not connect to the API. Make sure the backend is running on port 8000.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* IMAGE TAB */}
        {activeTab === "image" && (
          <div className="panel">
            <div className="analysis-layout">
              <div className="analysis-input">
                <div className="card">
                  <div className="card-label">Upload image</div>
                  <UploadZone accept="image/*" label="Drop an image or click to browse" hint="JPG, PNG, WEBP — max 10 MB" onFile={handleImageFile} preview={imagePreview} previewType="image" />
                  {imageFile && <p className="filename">{imageFile.name}</p>}
                  <div className="action-row" style={{ marginTop: "0.75rem" }}>
                    <button className="btn-primary" onClick={analyzeImage} disabled={!imageFile || imageLoading}>
                      {imageLoading ? <><span className="spinner" /> Analyzing…</> : "Analyze Image"}
                    </button>
                    {imageFile && (<button className="btn-ghost" onClick={() => { setImageFile(null); setImagePreview(null); setImageResult(null); }}>Clear</button>)}
                  </div>
                </div>
                <div className="info-card">
                  <div className="info-card-title">How it works</div>
                  <div className="info-steps">
                    <div className="info-step"><span className="info-step-num">1</span><span>Image is encoded with CLIP ViT-L/14 (large model, 14px patches)</span></div>
                    <div className="info-step"><span className="info-step-num">2</span><span>Ensemble of 6 sentiment prompts per class (happiness, sadness, anger, neutral)</span></div>
                    <div className="info-step"><span className="info-step-num">3</span><span>Scores are averaged across all prompts per class and normalized</span></div>
                  </div>
                </div>
              </div>
              <div className="analysis-result">
                <div className="result-pane-label">Result</div>
                {!imageResult && !imageLoading && (
                  <div className="idle-hint">
                    <span className="idle-hint-icon">🖼️</span>
                    <p className="idle-hint-text">Upload an image to analyze its sentiment</p>
                    <p className="idle-hint-sub">Powered by CLIP ViT-L/14 · 6-prompts per class ensemble</p>
                  </div>
                )}
                {imageLoading && (<div className="loading-pane"><span className="loading-spinner-lg" /><p>Analyzing image with CLIP ViT-L/14…</p></div>)}
                {imageResult && !imageResult.error && (<ResultCard result={imageResult} meta="Analyzed via CLIP ViT-L/14 · ensemble prompts (6 per class)" />)}
                {imageResult?.error && (<div className="error-card">Could not connect to the API.</div>)}
              </div>
            </div>
          </div>
        )}

        {/* VIDEO TAB */}
        {activeTab === "video" && (
          <div className="panel">
            <div className="analysis-layout">
              <div className="analysis-input">
                <div className="card">
                  <div className="card-label">Upload video</div>
                  <UploadZone accept="video/*,image/gif" label="Drop a video or click to browse" hint="MP4, GIF — max 30 seconds" onFile={handleVideoFile} preview={videoPreview} previewType="video" />
                  {videoFile && <p className="filename">{videoFile.name}</p>}
                  <div className="action-row" style={{ marginTop: "0.75rem" }}>
                    <button className="btn-primary" onClick={analyzeVideo} disabled={!videoFile || videoLoading}>
                      {videoLoading ? <><span className="spinner" /> Analyzing…</> : "Analyze Video"}
                    </button>
                    {videoFile && (<button className="btn-ghost" onClick={() => { setVideoFile(null); setVideoPreview(null); setVideoResult(null); }}>Clear</button>)}
                  </div>
                </div>
                <div className="info-card">
                  <div className="info-card-title">How it works</div>
                  <div className="info-steps">
                    <div className="info-step"><span className="info-step-num">1</span><span>12 frames are uniformly sampled from the video (max 30 seconds)</span></div>
                    <div className="info-step"><span className="info-step-num">2</span><span>Each frame is scored independently via CLIP ViT-L/14</span></div>
                    <div className="info-step"><span className="info-step-num">3</span><span>Weighted majority vote determines the final sentiment</span></div>
                  </div>
                </div>
              </div>
              <div className="analysis-result">
                <div className="result-pane-label">Result</div>
                {!videoResult && !videoLoading && (
                  <div className="idle-hint">
                    <span className="idle-hint-icon">🎥</span>
                    <p className="idle-hint-text">Upload a video to see frame-by-frame analysis</p>
                    <p className="idle-hint-sub">12 frames sampled · weighted majority vote</p>
                  </div>
                )}
                {videoLoading && (<div className="loading-pane"><span className="loading-spinner-lg" /><p>Sampling frames with CLIP… this may take a moment</p></div>)}
                {videoResult && !videoResult.error && (<ResultCard result={videoResult} meta="12 frames sampled · weighted majority vote via CLIP ViT-L/14" />)}
                {videoResult?.error && (<div className="error-card">Could not connect to the API. Video may exceed 30 seconds.</div>)}
              </div>
            </div>
          </div>
        )}

        {/* FUSION TAB */}
        {activeTab === "fusion" && (
          <div className="panel">
            <div className="fusion-weight-bar">
              <div className="fusion-weight-labels">
                <span>Text <strong>{textWeight}%</strong></span>
                <span className="fusion-weight-title">Fusion weights</span>
                <span>Image <strong>{100 - textWeight}%</strong></span>
              </div>
              <div className="fusion-slider-wrap">
                <span className="fusion-slider-icon">📝</span>
                <input type="range" min={0} max={100} step={5} value={textWeight} onChange={(e) => setTextWeight(Number(e.target.value))} className="weight-slider" />
                <span className="fusion-slider-icon">🖼️</span>
              </div>
            </div>
            <div className="fusion-inputs">
              <div className="card">
                <div className="card-label">Text input</div>
                <textarea 
                  className="textarea" 
                  placeholder="Enter text for fusion analysis…" 
                  value={fusionText} 
                  onChange={(e) => setFusionText(e.target.value)} 
                  style={{ minHeight: "120px", direction: isRTL ? 'rtl' : 'ltr' }}
                />
              </div>
              <div className="card">
                <div className="card-label">Image input</div>
                <UploadZone accept="image/*" label="Click to upload" hint="JPG, PNG, WEBP" onFile={handleFusionFile} preview={fusionPreview} previewType="image" />
              </div>
            </div>
            <div className="action-row" style={{ marginTop: "1rem" }}>
              <button className="btn-primary btn-wide" onClick={analyzeFusion} disabled={!fusionText.trim() || !fusionFile || fusionLoading}>
                {fusionLoading ? <><span className="spinner" /> Running Fusion Analysis…</> : "Run Fusion Analysis"}
              </button>
            </div>
            {fusionResult && !fusionResult.error && (
              <div className="fusion-result-area">
                {(fusionTextResult || fusionImageResult) && (
                  <div className="modality-row">
                    {fusionTextResult && (
                      <div className="modality-card">
                        <div className="card-label">Text modality (Mamba-130m)</div>
                        <div className="modality-sentiment">
                          <SentimentDot sentiment={fusionTextResult.sentiment} />
                          {fusionTextResult.displaySentiment || SENTIMENT_CONFIG[fusionTextResult.sentiment]?.label}
                          <span className="modality-pct">{Math.round(fusionTextResult.confidence * 100)}%</span>
                        </div>
                      </div>
                    )}
                    <div className="modality-arrow">→</div>
                    {fusionImageResult && (
                      <div className="modality-card">
                        <div className="card-label">Image modality (CLIP)</div>
                        <div className="modality-sentiment">
                          <SentimentDot sentiment={fusionImageResult.sentiment} />
                          {fusionImageResult.displaySentiment || SENTIMENT_CONFIG[fusionImageResult.sentiment]?.label}
                          <span className="modality-pct">{Math.round(fusionImageResult.confidence * 100)}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="card-label" style={{ marginTop: "1rem" }}>Fused result</div>
                <ResultCard result={fusionResult} />
              </div>
            )}
          </div>
        )}

        {/* CAMERA TAB - NEW! */}
        {activeTab === "camera" && (
          <div className="panel">
            <CameraAnalyzer />
          </div>
        )}

        {/* USER TIMELINE TAB */}
        {activeTab === "user" && (
          <div className="panel">
            {isLoading ? (
              <div className="loading-pane">
                <span className="loading-spinner-lg" />
                <p>Loading user data...</p>
              </div>
            ) : (
              <div className="user-timeline-container">
                <div className="user-management-bar">
                  <div className="user-selector">
                    <span className="label">👤 Select User:</span>
                    <div className="user-buttons">
                      {users.map(user => (
                        <button
                          key={user.userId}
                          className={`user-btn ${selectedUser?.userId === user.userId ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedUser(user);
                            loadUserData(user.userId);
                          }}
                        >
                          <img src={user.avatar} alt={user.username} />
                          {user.username}
                          <span className="delete-user" onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteUser(user.userId);
                          }}>×</span>
                        </button>
                      ))}
                      <button className="user-btn create" onClick={() => setShowCreateUser(true)}>+ Create User</button>
                    </div>
                  </div>
                </div>

                {selectedUser ? (
                  <div className="user-dashboard-panel">
                    <div className="dashboard-header">
                      <div>
                        <h3>{selectedUser.username}'s Sentiment Timeline</h3>
                        <p>{userAnalytics?.totalPosts || 0} total analyses • Last activity: {userPosts[0] ? new Date(userPosts[0].timestamp).toLocaleDateString() : 'Never'}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button 
                          className="btn-primary" 
                          style={{ background: '#10b981', padding: '8px 16px' }}
                          onClick={() => setShowShareReport(true)}
                        >
                          📊 Share Report
                        </button>
                        {selectedUser && (
                          <div className="current-user-badge">
                            <img src={selectedUser.avatar} alt={selectedUser.username} />
                            <span>{selectedUser.username}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {userPosts.length > 0 ? (
                      <>
                        <div className="timeline-chart">
                          <h4>📈 Sentiment Over Time</h4>
                          <ResponsiveContainer width="100%" height={280}>
                            <LineChart data={timelineData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
                              <XAxis dataKey="date" stroke="#a0a5bf" />
                              <YAxis stroke="#a0a5bf" />
                              <Tooltip contentStyle={{ background: '#151821', border: '1px solid #2a2d3e' }} />
                              <Legend />
                              <Line type="monotone" dataKey="POSITIVE" stroke={COLORS.POSITIVE} strokeWidth={2} dot={{ r: 4 }} />
                              <Line type="monotone" dataKey="NEUTRAL" stroke={COLORS.NEUTRAL} strokeWidth={2} dot={{ r: 4 }} />
                              <Line type="monotone" dataKey="NEGATIVE" stroke={COLORS.NEGATIVE} strokeWidth={2} dot={{ r: 4 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="user-stats-grid">
                          <div className="stat-card">
                            <div className="stat-value">{userAnalytics?.totalPosts || 0}</div>
                            <div className="stat-label">Total Analyses</div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-value">{((userAnalytics?.avgConfidence || 0) * 100).toFixed(1)}%</div>
                            <div className="stat-label">Avg Confidence</div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-value">
                              {userAnalytics?.avgSentiment > 0.2 ? '😊 Positive' : 
                               userAnalytics?.avgSentiment < -0.2 ? '😞 Negative' : '😐 Neutral'}
                            </div>
                            <div className="stat-label">Overall Mood</div>
                          </div>
                        </div>

                        <div className="user-insights">
                          <div className="insight-box">
                            <h4>🎯 Sentiment Distribution</h4>
                            <ResponsiveContainer width="100%" height={200}>
                              <PieChart>
                                <Pie
                                  data={Object.entries(userAnalytics?.sentimentDistribution || {}).map(([name, value]) => ({
                                    name, value: value || 0
                                  })).filter(item => item.value > 0)}
                                  cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value"
                                >
                                  {Object.keys(COLORS).map(name => (<Cell key={name} fill={COLORS[name]} />))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="insight-box">
                            <h4>📝 Recent Activity</h4>
                            <div className="activity-feed">
                              {userPosts.slice(0, 8).map(post => (
                                <div key={post.postId} className={`activity-feed-item ${post.sentiment.toLowerCase()}`}>
                                  <span className="activity-type">{post.type === 'text' ? '📝' : post.type === 'image' ? '🖼️' : '🎥'}</span>
                                  <span className="activity-content">{post.content.substring(0, 35)}...</span>
                                  <span className={`activity-sentiment ${post.sentiment.toLowerCase()}`}>{post.sentiment}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="timeline-empty-state">
                        <span>📊</span>
                        <h4>No Data Yet</h4>
                        <p>Run analyses in Text, Image, or Video tabs and they will automatically appear here!</p>
                        <small>Make sure you have a user selected above</small>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="timeline-empty-state">
                    <span>👤</span>
                    <h4>No User Selected</h4>
                    <p>Create a user or select an existing one to see their sentiment timeline</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* PREDICTION TAB */}
        {activeTab === "prediction" && (
          <div className="panel">
            {selectedUser ? (
              <SentimentPrediction 
                user={selectedUser}
                posts={userPosts}
                analytics={userAnalytics}
              />
            ) : (
              <div className="idle-hint">
                <span className="idle-hint-icon">🔮</span>
                <p className="idle-hint-text">Select a user first</p>
                <p className="idle-hint-sub">Go to User Timeline tab to select or create a user</p>
              </div>
            )}
          </div>
        )}

        {/* COMPARE TAB */}
        {activeTab === "compare" && (
          <div className="panel">
            {selectedUser ? (
              <ComparisonDashboard 
                currentUser={selectedUser}
                currentUserPosts={userPosts}
                currentUserAnalytics={userAnalytics}
              />
            ) : (
              <div className="idle-hint">
                <span className="idle-hint-icon">⚖️</span>
                <p className="idle-hint-text">Select a user first</p>
                <p className="idle-hint-sub">Go to User Timeline tab to select or create a user</p>
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === "history" && (
          <div className="panel">
            <div className="history-header">
              <div>
                <p className="history-title">Session history</p>
                <p className="history-sub">{history.length === 0 ? "No analyses yet" : `${history.length} ${history.length === 1 ? "analysis" : "analyses"} this session`}</p>
              </div>
              {history.length > 0 && (<button className="btn-ghost" onClick={() => setHistory([])}>Clear all</button>)}
            </div>
            {history.length === 0 ? (
              <div className="idle-hint" style={{ marginTop: 0 }}>
                <span className="idle-hint-icon">🕓</span>
                <p className="idle-hint-text">No analyses yet</p>
                <p className="idle-hint-sub">Run an analysis in any tab to see it here</p>
              </div>
            ) : (
              <div className="history-list">
                {history.map((h, i) => {
                  const cfg = SENTIMENT_CONFIG[h.result?.sentiment] ?? SENTIMENT_CONFIG.NEUTRAL;
                  return (
                    <div key={i} className="history-item">
                      <span className="history-type-icon">{TAB_ICONS[h.type]}</span>
                      <span className="history-text">{h.label}</span>
                      <span className={`history-badge ${cfg.color}`}>{cfg.label}</span>
                      <span className="history-pct">{Math.round((h.result?.confidence ?? 0) * 100)}%</span>
                      <span className="history-time">{h.time}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Create User Modal */}
      {showCreateUser && (
        <div className="modal-overlay" onClick={() => setShowCreateUser(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Create New User</h3>
            <input 
              type="text" 
              placeholder="Enter username" 
              value={newUserName} 
              onChange={(e) => setNewUserName(e.target.value)} 
              onKeyPress={(e) => e.key === 'Enter' && handleCreateUser()} 
              autoFocus 
              style={{ direction: isRTL ? 'rtl' : 'ltr' }}
            />
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowCreateUser(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateUser}>Create User</button>
            </div>
          </div>
        </div>
      )}

      {/* Share Report Modal */}
      {showShareReport && selectedUser && (
        <ShareReport
          user={selectedUser}
          analytics={userAnalytics}
          posts={userPosts}
          onClose={() => setShowShareReport(false)}
        />
      )}
    </div>
  );
}