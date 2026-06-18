import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const ShareReport = ({ user, analytics, posts, onClose }) => {
  const reportRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareLink, setShareLink] = useState('');

  // Generate summary based on sentiment analysis
  const generateSummary = () => {
    const total = analytics?.totalPosts || 0;
    const positive = analytics?.sentimentDistribution?.POSITIVE || 0;
    const negative = analytics?.sentimentDistribution?.NEGATIVE || 0;
    const neutral = analytics?.sentimentDistribution?.NEUTRAL || 0;
    const avgConfidence = ((analytics?.avgConfidence || 0) * 100).toFixed(1);
    
    const positivePercent = total > 0 ? ((positive / total) * 100).toFixed(1) : 0;
    const negativePercent = total > 0 ? ((negative / total) * 100).toFixed(1) : 0;
    const neutralPercent = total > 0 ? ((neutral / total) * 100).toFixed(1) : 0;
    
    let summary = '';
    let recommendation = '';
    let needsHelp = false;
    
    if (positive > negative && positivePercent > 50) {
      summary = `${user.username} shows a positive emotional pattern with ${positivePercent}% of content being uplifting or happy.`;
      recommendation = 'Continue maintaining this positive outlook! Consider sharing what makes you happy with others.';
    } else if (negative > positive && negativePercent > 40) {
      summary = `${user.username} has been expressing ${negativePercent}% negative sentiment, which may indicate distress or difficulty.`;
      recommendation = 'It might be helpful to talk to someone you trust about how you\'re feeling. Remember, seeking help is a sign of strength.';
      needsHelp = true;
    } else {
      summary = `${user.username} maintains a balanced emotional state with mixed sentiments.`;
      recommendation = 'Keep expressing yourself! Journaling your thoughts can help maintain emotional awareness.';
    }
    
    if (avgConfidence > 85) {
      summary += ` The analysis shows high confidence (${avgConfidence}%) in detected sentiments, indicating clear emotional expression.`;
    } else if (avgConfidence < 65) {
      summary += ` The sentiments are expressed with moderate confidence (${avgConfidence}%), suggesting mixed or subtle emotions.`;
    }
    
    return { summary, recommendation, needsHelp, positivePercent, negativePercent, neutralPercent, total, positive, negative, neutral, avgConfidence };
  };
  
  const { summary, recommendation, needsHelp, positivePercent, negativePercent, neutralPercent, total, positive, negative, neutral, avgConfidence } = generateSummary();
  
  // Mental health resources
  const getMentalHealthTips = () => {
    if (needsHelp) {
      return {
        title: "💚 You're Not Alone - Support & Remedies",
        tips: [
          "📞 Talk to someone you trust - Sharing your feelings can lighten the load",
          "🧘 Practice mindfulness - Try deep breathing or meditation for 5 minutes daily",
          "📝 Keep a gratitude journal - Write 3 things you're grateful for each day",
          "🚶 Take a walk - Physical activity boosts mood naturally",
          "🎵 Listen to uplifting music - Create a positive playlist",
          "💤 Prioritize sleep - Aim for 7-9 hours of quality rest"
        ],
        helpline: "📞 Emergency Support: If you're in crisis, please contact your local mental health helpline immediately."
      };
    } else {
      return {
        title: "🌟 Wellness Tips to Maintain Positive Mental Health",
        tips: [
          "🎯 Set small daily goals - Achieve something each day",
          "💪 Practice self-care - Take time for activities you enjoy",
          "📚 Learn something new - Stimulate your mind positively",
          "🤗 Connect with loved ones - Strengthen social bonds",
          "🌅 Start a morning routine - Begin each day intentionally"
        ],
        helpline: ""
      };
    }
  };
  
  const wellnessTips = getMentalHealthTips();

  // Generate Multi-Page PDF
  const generatePDF = async () => {
    if (!reportRef.current) return;
    setIsGenerating(true);
    
    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#0a0c15',
        logging: false,
        useCORS: true
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;
      
      // First page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
      
      // Additional pages
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
      
      pdf.save(`${user.username}_sentiment_report.pdf`);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Failed to generate PDF. Please try again.');
    }
    
    setIsGenerating(false);
  };

  // Generate HTML Report (full version)
  const generateShareableHTML = () => {
    const reportHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${user.username}'s Sentiment Report - KairosAI</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #0a0c15 0%, #0f111a 100%);
            color: #ffffff;
            padding: 40px;
            line-height: 1.6;
          }
          .report-container {
            max-width: 1000px;
            margin: 0 auto;
            background: linear-gradient(135deg, #151821 0%, #1a1d2a 100%);
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0,0,0,0.4);
          }
          .report-header {
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            padding: 40px;
            text-align: center;
          }
          .report-logo {
            font-size: 14px;
            letter-spacing: 2px;
            margin-bottom: 10px;
            opacity: 0.9;
          }
          .report-header h1 {
            font-size: 32px;
            margin-bottom: 10px;
          }
          .report-mood-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 99px;
            margin-top: 15px;
            font-size: 14px;
            font-weight: bold;
          }
          .report-mood-badge.concerning {
            background: rgba(239, 68, 68, 0.2);
            border: 1px solid #ef4444;
            color: #ef4444;
          }
          .report-mood-badge.positive {
            background: rgba(16, 185, 129, 0.2);
            border: 1px solid #10b981;
            color: #10b981;
          }
          .report-content {
            padding: 40px;
          }
          .report-summary {
            background: rgba(59, 130, 246, 0.1);
            border: 1px solid rgba(59, 130, 246, 0.2);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 30px;
          }
          .report-summary h3 {
            margin-bottom: 12px;
            color: #3b82f6;
            font-size: 18px;
          }
          .report-summary p {
            line-height: 1.6;
            margin-bottom: 16px;
          }
          .summary-stats {
            display: flex;
            gap: 20px;
            margin-top: 15px;
            justify-content: center;
            flex-wrap: wrap;
          }
          .summary-stats span {
            font-size: 14px;
            font-weight: bold;
            padding: 4px 12px;
            border-radius: 20px;
          }
          .stat-positive { background: rgba(16, 185, 129, 0.2); color: #10b981; }
          .stat-negative { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
          .stat-neutral { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 30px;
          }
          .stat-card {
            background: rgba(59, 130, 246, 0.1);
            border: 1px solid rgba(59, 130, 246, 0.2);
            border-radius: 16px;
            padding: 24px;
            text-align: center;
          }
          .stat-value {
            font-size: 42px;
            font-weight: bold;
            color: #3b82f6;
            margin-bottom: 8px;
          }
          .stat-label {
            font-size: 14px;
            opacity: 0.7;
          }
          .distribution-section {
            margin-bottom: 30px;
          }
          .distribution-bar {
            display: flex;
            height: 40px;
            border-radius: 20px;
            overflow: hidden;
            margin-bottom: 15px;
          }
          .bar.positive { background: #10b981; }
          .bar.neutral { background: #f59e0b; }
          .bar.negative { background: #ef4444; }
          .distribution-labels {
            display: flex;
            justify-content: space-around;
            font-size: 14px;
            flex-wrap: wrap;
            gap: 16px;
          }
          .report-recommendation {
            background: ${needsHelp ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)'};
            border: 1px solid ${needsHelp ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.2)'};
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 30px;
          }
          .report-recommendation h4 {
            margin-bottom: 12px;
            font-size: 18px;
          }
          .report-wellness {
            background: rgba(245, 158, 11, 0.1);
            border: 1px solid rgba(245, 158, 11, 0.2);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 30px;
          }
          .report-wellness h4 {
            margin-bottom: 16px;
            font-size: 18px;
          }
          .wellness-tips {
            list-style: none;
            padding: 0;
          }
          .wellness-tips li {
            padding: 10px 0;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            font-size: 14px;
          }
          .helpline-box {
            margin-top: 16px;
            padding: 16px;
            background: rgba(239, 68, 68, 0.15);
            border-radius: 12px;
            text-align: center;
            font-weight: bold;
            color: #ef4444;
          }
          .post-list {
            margin-top: 30px;
          }
          .post-list h4 {
            margin-bottom: 16px;
            font-size: 18px;
          }
          .post-item {
            background: rgba(255,255,255,0.05);
            border-left: 3px solid;
            padding: 16px;
            margin-bottom: 12px;
            border-radius: 12px;
          }
          .post-item.positive { border-left-color: #10b981; }
          .post-item.negative { border-left-color: #ef4444; }
          .post-item.neutral { border-left-color: #f59e0b; }
          .post-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 12px;
          }
          .post-content-full {
            margin-bottom: 10px;
            font-size: 14px;
            line-height: 1.5;
          }
          .post-image-note {
            font-size: 11px;
            opacity: 0.6;
            margin: 8px 0;
            font-style: italic;
          }
          .post-meta {
            font-size: 11px;
            opacity: 0.5;
            margin-top: 8px;
          }
          .report-footer {
            text-align: center;
            padding: 24px;
            border-top: 1px solid rgba(255,255,255,0.1);
            font-size: 12px;
            opacity: 0.6;
          }
          @media print {
            body { background: white; padding: 0; }
            .report-container { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="report-container">
          <div class="report-header">
            <div class="report-logo">🎯 KAIROSAI</div>
            <h1>📊 Emotional Intelligence Report</h1>
            <p>Generated for <strong>${user.username}</strong> on ${new Date().toLocaleDateString()}</p>
            <div class="report-mood-badge ${needsHelp ? 'concerning' : 'positive'}">
              ${needsHelp ? '⚠️ Needs Attention' : '✅ Healthy Pattern'}
            </div>
          </div>
          <div class="report-content">
            <div class="report-summary">
              <h3>📋 Executive Summary</h3>
              <p>${summary}</p>
              <div class="summary-stats">
                <span class="stat-positive">😊 Positive: ${positivePercent}%</span>
                <span class="stat-neutral">😐 Neutral: ${neutralPercent}%</span>
                <span class="stat-negative">😞 Negative: ${negativePercent}%</span>
              </div>
            </div>
            
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-value">${total}</div>
                <div class="stat-label">Total Analyses</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${avgConfidence}%</div>
                <div class="stat-label">Analysis Confidence</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${positive > negative ? '😊' : negative > positive ? '😞' : '😐'}</div>
                <div class="stat-label">Overall Mood</div>
              </div>
            </div>
            
            <div class="distribution-section">
              <div class="distribution-bar">
                <div class="bar positive" style="width: ${positivePercent}%"></div>
                <div class="bar neutral" style="width: ${neutralPercent}%"></div>
                <div class="bar negative" style="width: ${negativePercent}%"></div>
              </div>
              <div class="distribution-labels">
                <span>👍 Positive (${positivePercent}%)</span>
                <span>😐 Neutral (${neutralPercent}%)</span>
                <span>👎 Negative (${negativePercent}%)</span>
              </div>
            </div>
            
            <div class="report-recommendation">
              <h4>💡 Personalized Insight</h4>
              <p>${recommendation}</p>
            </div>
            
            <div class="report-wellness">
              <h4>${wellnessTips.title}</h4>
              <ul class="wellness-tips">
                ${wellnessTips.tips.map(tip => `<li>${tip}</li>`).join('')}
              </ul>
              ${wellnessTips.helpline ? `<div class="helpline-box">${wellnessTips.helpline}</div>` : ''}
            </div>
            
            <div class="post-list">
              <h4>📝 Recent Activity Log</h4>
              ${posts.slice(0, 10).map(post => `
                <div class="post-item ${post.sentiment.toLowerCase()}">
                  <div class="post-header">
                    <span>${post.type === 'text' ? '📝 Text Analysis' : post.type === 'image' ? '🖼️ Image Analysis' : '🎥 Video Analysis'}</span>
                    <span>Confidence: ${(post.confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div class="post-content-full">${post.content}</div>
                  ${post.type !== 'text' ? `<div class="post-image-note">${post.type === 'image' ? '🖼️ Visual sentiment analysis performed using CLIP ViT-L/14' : '🎥 Frame-by-frame video sentiment analysis with 12-frame sampling'}</div>` : ''}
                  <div class="post-meta">📅 ${new Date(post.timestamp).toLocaleString()}</div>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="report-footer">
            <p>Generated by KairosAI - Advanced Multimodal Sentiment Analysis Platform</p>
            <p style="margin-top: 8px;">⚠️ This report is for informational purposes. For serious concerns, please consult a mental health professional.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const blob = new Blob([reportHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${user.username}_sentiment_report.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy Share Link
  const copyShareLink = () => {
    const data = {
      user: { username: user.username },
      analytics,
      posts: posts.slice(0, 10),
      timestamp: new Date().toISOString()
    };
    const encoded = btoa(JSON.stringify(data));
    const link = `${window.location.origin}/share/${encoded}`;
    navigator.clipboard.writeText(link);
    setShareLink('Link copied to clipboard!');
    setTimeout(() => setShareLink(''), 3000);
  };

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal-content" onClick={e => e.stopPropagation()}>
        <div className="share-modal-header">
          <h3>📄 Share Report: {user.username}</h3>
          <button className="share-modal-close" onClick={onClose}>×</button>
        </div>
        
        {/* Report Preview */}
        <div ref={reportRef} className="share-report-preview">
          <div className="report-preview-header">
            <div className="report-logo">🎯 KAIROSAI</div>
            <h2>📊 Emotional Intelligence Report</h2>
            <p>Generated for <strong>{user.username}</strong> on {new Date().toLocaleDateString()}</p>
            <div className={`report-mood-badge ${needsHelp ? 'concerning' : 'positive'}`}>
              {needsHelp ? '⚠️ Needs Attention' : '✅ Healthy Pattern'}
            </div>
          </div>
          
          <div className="report-summary">
            <h3>📋 Executive Summary</h3>
            <p>{summary}</p>
            <div className="summary-stats">
              <span className="stat-positive">😊 Positive: {positivePercent}%</span>
              <span className="stat-neutral">😐 Neutral: {neutralPercent}%</span>
              <span className="stat-negative">😞 Negative: {negativePercent}%</span>
            </div>
          </div>
          
          <div className="report-preview-stats">
            <div className="preview-stat">
              <div className="preview-stat-value">{total}</div>
              <div className="preview-stat-label">Total Analyses</div>
            </div>
            <div className="preview-stat">
              <div className="preview-stat-value">{avgConfidence}%</div>
              <div className="preview-stat-label">Confidence</div>
            </div>
            <div className="preview-stat">
              <div className="preview-stat-value">{positive > negative ? '😊' : negative > positive ? '😞' : '😐'}</div>
              <div className="preview-stat-label">Overall Mood</div>
            </div>
          </div>
          
          <div className="distribution-section">
            <div className="distribution-bar">
              <div className="bar positive" style={{ width: `${positivePercent}%` }}></div>
              <div className="bar neutral" style={{ width: `${neutralPercent}%` }}></div>
              <div className="bar negative" style={{ width: `${negativePercent}%` }}></div>
            </div>
            <div className="distribution-labels">
              <span>👍 Positive ({positivePercent}%)</span>
              <span>😐 Neutral ({neutralPercent}%)</span>
              <span>👎 Negative ({negativePercent}%)</span>
            </div>
          </div>
          
          <div className="report-recommendation">
            <h4>💡 Personalized Insight</h4>
            <p>{recommendation}</p>
          </div>
          
          <div className="report-wellness">
            <h4>{wellnessTips.title}</h4>
            <ul className="wellness-tips">
              {wellnessTips.tips.slice(0, 4).map((tip, idx) => (
                <li key={idx}>{tip}</li>
              ))}
            </ul>
          </div>
          
          <div className="report-preview-posts">
            <h4>📝 Recent Activity</h4>
            {posts.slice(0, 5).map(post => (
              <div key={post.postId} className={`preview-post ${post.sentiment.toLowerCase()}`}>
                <div className="post-header">
                  <span>{post.type === 'text' ? '📝 Text' : post.type === 'image' ? '🖼️ Image' : '🎥 Video'}</span>
                  <span>{(post.confidence * 100).toFixed(1)}%</span>
                </div>
                <div className="post-content-full">{post.content.substring(0, 80)}...</div>
                <div className="post-meta">{new Date(post.timestamp).toLocaleString()}</div>
              </div>
            ))}
          </div>
          
          <div className="report-footer">
            <p>Generated by KairosAI - Multimodal Sentiment Analysis</p>
          </div>
        </div>
        
        <div className="share-modal-actions">
          <button className="btn-primary" onClick={generatePDF} disabled={isGenerating}>
            {isGenerating ? '📄 Generating PDF...' : '📄 Download PDF Report'}
          </button>
          <button className="btn-primary" onClick={generateShareableHTML}>
            📥 Download HTML Report
          </button>
          <button className="btn-ghost" onClick={copyShareLink}>
            🔗 Copy Share Link
          </button>
        </div>
        
        {shareLink && (
          <div className="share-link-success">
            ✅ {shareLink}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShareReport;