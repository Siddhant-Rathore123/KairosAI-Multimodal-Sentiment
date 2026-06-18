import React from 'react';
import { LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const SentimentPrediction = ({ user, posts, analytics }) => {
  if (!posts || posts.length < 3) {
    return (
      <div className="prediction-empty">
        <span>🔮</span>
        <h4>Not Enough Data</h4>
        <p>Need at least 3 analyses to generate predictions. Keep analyzing!</p>
      </div>
    );
  }

  // Calculate trends and predictions
  const calculateTrend = () => {
    const sentiments = posts.map(p => {
      if (p.sentiment === 'POSITIVE') return 1;
      if (p.sentiment === 'NEUTRAL') return 0;
      return -1;
    });
    
    const sum = sentiments.reduce((a, b) => a + b, 0);
    const avg = sum / sentiments.length;
    const recentAvg = sentiments.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, sentiments.length);
    
    return {
      overallAvg: avg,
      recentAvg: recentAvg,
      trend: recentAvg - avg,
      isImproving: recentAvg > avg
    };
  };

  // Generate predictions for next 7 days
  const generatePredictions = () => {
    const predictions = [];
    const sentimentValues = posts.map(p => {
      if (p.sentiment === 'POSITIVE') return 85 + Math.random() * 10;
      if (p.sentiment === 'NEUTRAL') return 50 + Math.random() * 10;
      return 20 + Math.random() * 15;
    });
    
    const avgConfidence = sentimentValues.reduce((a, b) => a + b, 0) / sentimentValues.length;
    const trend = calculateTrend();
    
    for (let i = 1; i <= 7; i++) {
      let predictedValue = avgConfidence + (trend.trend * 5 * i);
      predictedValue = Math.min(100, Math.max(0, predictedValue));
      
      let predictedSentiment = 'NEUTRAL';
      if (predictedValue > 65) predictedSentiment = 'POSITIVE';
      else if (predictedValue < 35) predictedSentiment = 'NEGATIVE';
      
      predictions.push({
        day: i,
        dayName: ['Today', 'Tomorrow', 'In 2 days', 'In 3 days', 'In 4 days', 'In 5 days', 'In 6 days'][i-1],
        confidence: Math.round(predictedValue),
        sentiment: predictedSentiment
      });
    }
    return predictions;
  };

  const trend = calculateTrend();
  const predictions = generatePredictions();
  const totalPositive = analytics?.sentimentDistribution?.POSITIVE || 0;
  const totalNegative = analytics?.sentimentDistribution?.NEGATIVE || 0;
  const improvementPercent = totalPositive - totalNegative;

  // Prepare historical data for chart
  const historicalData = posts.slice(-14).map((post, index) => ({
    index: index + 1,
    confidence: (post.confidence * 100).toFixed(1),
    sentiment: post.sentiment,
    date: new Date(post.timestamp).toLocaleDateString()
  }));

  return (
    <div className="prediction-dashboard">
      <div className="prediction-header">
        <h3>🔮 Sentiment Prediction & Forecast</h3>
        <p>Based on {posts.length} historical analyses</p>
      </div>

      {/* Trend Analysis Cards */}
      <div className="trend-cards">
        <div className={`trend-card ${trend.isImproving ? 'improving' : 'declining'}`}>
          <div className="trend-icon">{trend.isImproving ? '📈' : '📉'}</div>
          <div className="trend-content">
            <div className="trend-value">
              {trend.isImproving ? '+' : ''}{(trend.trend * 100).toFixed(1)}%
            </div>
            <div className="trend-label">
              {trend.isImproving ? 'Improving Trend' : 'Declining Trend'}
            </div>
          </div>
        </div>

        <div className="trend-card">
          <div className="trend-icon">🎯</div>
          <div className="trend-content">
            <div className="trend-value">
              {improvementPercent > 0 ? '+' : ''}{improvementPercent}
            </div>
            <div className="trend-label">Positivity Score</div>
          </div>
        </div>

        <div className="trend-card">
          <div className="trend-icon">⭐</div>
          <div className="trend-content">
            <div className="trend-value">
              {trend.recentAvg > 0.3 ? '😊 Positive' : trend.recentAvg < -0.3 ? '😞 Negative' : '😐 Neutral'}
            </div>
            <div className="trend-label">Recent Mood</div>
          </div>
        </div>
      </div>

      {/* Historical Trend Chart */}
      <div className="prediction-chart">
        <h4>📊 Historical Sentiment Trend</h4>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={historicalData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
            <XAxis dataKey="index" stroke="#a0a5bf" />
            <YAxis stroke="#a0a5bf" domain={[0, 100]} />
            <Tooltip 
              contentStyle={{ background: '#151821', border: '1px solid #2a2d3e' }}
              labelFormatter={(label) => `Analysis #${label}`}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="confidence" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={{ r: 4, fill: '#3b82f6' }}
              name="Sentiment Confidence %"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Predictions Cards */}
      <div className="predictions-grid">
        <h4>🔮 Predicted Mood for Next Week</h4>
        <div className="prediction-cards">
          {predictions.map((pred, idx) => (
            <div key={idx} className={`prediction-card ${pred.sentiment.toLowerCase()}`}>
              <div className="prediction-day">{pred.dayName}</div>
              <div className="prediction-emotion">
                {pred.sentiment === 'POSITIVE' ? '😊' : pred.sentiment === 'NEGATIVE' ? '😞' : '😐'}
              </div>
              <div className="prediction-confidence">{pred.confidence}%</div>
              <div className="prediction-label">{pred.sentiment}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Insights */}
      <div className="prediction-insights">
        <h4>💡 AI Insights</h4>
        <ul>
          {trend.isImproving ? (
            <>
              <li>✅ Your sentiment is showing positive momentum! Keep up the good work.</li>
              <li>📈 Based on your trend, you're likely to maintain positive mood this week.</li>
              {improvementPercent > 5 && <li>🎉 You've been {improvementPercent}% more positive than negative overall!</li>}
            </>
          ) : (
            <>
              <li>⚠️ Your sentiment trend is showing some decline recently.</li>
              <li>💪 Consider taking breaks and practicing self-care activities.</li>
              <li>🌟 Try the wellness tips in your report for support.</li>
            </>
          )}
          <li>🎯 Tip: Regular check-ins help track emotional patterns better.</li>
        </ul>
      </div>
    </div>
  );
};

export default SentimentPrediction;