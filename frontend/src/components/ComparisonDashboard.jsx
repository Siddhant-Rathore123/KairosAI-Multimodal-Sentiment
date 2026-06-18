import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getAllUsers, getUserPosts, getUserAnalytics } from '../services/userStorage';

const COLORS = {
  POSITIVE: '#10b981',
  NEUTRAL: '#f59e0b',
  NEGATIVE: '#ef4444'
};

const ComparisonDashboard = ({ currentUser, currentUserPosts, currentUserAnalytics }) => {
  const [allUsers, setAllUsers] = useState([]);
  const [compareUserId, setCompareUserId] = useState(null);
  const [compareUser, setCompareUser] = useState(null);
  const [compareUserPosts, setCompareUserPosts] = useState([]);
  const [compareUserAnalytics, setCompareUserAnalytics] = useState(null);
  const [comparisonMode, setComparisonMode] = useState('user');
  const [timeRange, setTimeRange] = useState('week');

  useEffect(() => {
    loadAllUsers();
  }, []);

  const loadAllUsers = async () => {
    const users = await getAllUsers();
    setAllUsers(users.filter(u => u.userId !== currentUser?.userId));
  };

  const loadCompareUserData = async (userId) => {
    const posts = await getUserPosts(userId);
    const analytics = await getUserAnalytics(userId);
    setCompareUserPosts(posts);
    setCompareUserAnalytics(analytics);
    const user = allUsers.find(u => u.userId === userId);
    setCompareUser(user);
  };

  const filterByTimeRange = (posts) => {
    const now = new Date();
    const ranges = { week: 7, month: 30, all: Infinity };
    const days = ranges[timeRange];
    return posts.filter(post => {
      const postDate = new Date(post.timestamp);
      const diffDays = (now - postDate) / (1000 * 60 * 60 * 24);
      return diffDays <= days;
    });
  };

  const currentFilteredPosts = filterByTimeRange(currentUserPosts);
  const compareFilteredPosts = filterByTimeRange(compareUserPosts);

  const getSentimentCounts = (posts) => {
    const counts = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 };
    posts.forEach(post => counts[post.sentiment]++);
    return counts;
  };

  const currentCounts = getSentimentCounts(currentFilteredPosts);
  const compareCounts = getSentimentCounts(compareFilteredPosts);

  // CORRECTED: Calculate average sentiment score (0-100 scale)
  const calculateAvgSentimentScore = (posts) => {
    if (posts.length === 0) return 50;
    let totalScore = 0;
    posts.forEach(post => {
      if (post.sentiment === 'POSITIVE') {
        totalScore += post.confidence * 100;
      } else if (post.sentiment === 'NEGATIVE') {
        totalScore += (1 - post.confidence) * 100;
      } else {
        totalScore += 50;
      }
    });
    return totalScore / posts.length;
  };

  // Calculate scores - THESE ARE THE REAL VALUES (75.8% and 12.1%)
  const currentAvgScore = calculateAvgSentimentScore(currentFilteredPosts);
  const compareAvgScore = calculateAvgSentimentScore(compareFilteredPosts);

  // Calculate counts and percentages
  const currentTotal = currentCounts.POSITIVE + currentCounts.NEUTRAL + currentCounts.NEGATIVE;
  const compareTotal = compareCounts.POSITIVE + compareCounts.NEUTRAL + compareCounts.NEGATIVE;
  
  const currentPositivePercent = currentTotal > 0 ? ((currentCounts.POSITIVE / currentTotal) * 100) : 0;
  const comparePositivePercent = compareTotal > 0 ? ((compareCounts.POSITIVE / compareTotal) * 100) : 0;

  // Data for pie charts
  const currentPieData = [
    { name: 'Positive', value: currentCounts.POSITIVE, color: COLORS.POSITIVE },
    { name: 'Neutral', value: currentCounts.NEUTRAL, color: COLORS.NEUTRAL },
    { name: 'Negative', value: currentCounts.NEGATIVE, color: COLORS.NEGATIVE }
  ].filter(item => item.value > 0);

  const comparePieData = [
    { name: 'Positive', value: compareCounts.POSITIVE, color: COLORS.POSITIVE },
    { name: 'Neutral', value: compareCounts.NEUTRAL, color: COLORS.NEUTRAL },
    { name: 'Negative', value: compareCounts.NEGATIVE, color: COLORS.NEGATIVE }
  ].filter(item => item.value > 0);

  // Timeline data
  const getTimelineData = () => {
    const timeline = new Map();
    
    const last14Days = [];
    for (let i = 13; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString();
      last14Days.push(dateStr);
      timeline.set(dateStr, { date: dateStr, [currentUser?.username || 'User 1']: null, [compareUser?.username || 'User 2']: null });
    }
    
    currentFilteredPosts.forEach(post => {
      const date = new Date(post.timestamp).toLocaleDateString();
      if (timeline.has(date)) {
        let score = 50;
        if (post.sentiment === 'POSITIVE') score = post.confidence * 100;
        else if (post.sentiment === 'NEGATIVE') score = (1 - post.confidence) * 100;
        else score = 50;
        
        const currentVal = timeline.get(date)[currentUser?.username];
        if (currentVal === null) {
          timeline.get(date)[currentUser?.username] = score;
        } else {
          timeline.get(date)[currentUser?.username] = (currentVal + score) / 2;
        }
      }
    });
    
    compareFilteredPosts.forEach(post => {
      const date = new Date(post.timestamp).toLocaleDateString();
      if (timeline.has(date)) {
        let score = 50;
        if (post.sentiment === 'POSITIVE') score = post.confidence * 100;
        else if (post.sentiment === 'NEGATIVE') score = (1 - post.confidence) * 100;
        else score = 50;
        
        const currentVal = timeline.get(date)[compareUser?.username];
        if (currentVal === null) {
          timeline.get(date)[compareUser?.username] = score;
        } else {
          timeline.get(date)[compareUser?.username] = (currentVal + score) / 2;
        }
      }
    });
    
    let lastCurrentValue = 50;
    let lastCompareValue = 50;
    const result = [];
    for (const [date, values] of timeline) {
      if (values[currentUser?.username] === null) values[currentUser?.username] = lastCurrentValue;
      if (values[compareUser?.username] === null) values[compareUser?.username] = lastCompareValue;
      lastCurrentValue = values[currentUser?.username];
      lastCompareValue = values[compareUser?.username];
      result.push(values);
    }
    
    return result;
  };

  const timelineData = getTimelineData();

  // Comparison data for bar chart
  const comparisonData = [
    { name: 'Positive', [currentUser?.username || 'You']: currentCounts.POSITIVE, [compareUser?.username || 'Them']: compareCounts.POSITIVE },
    { name: 'Neutral', [currentUser?.username || 'You']: currentCounts.NEUTRAL, [compareUser?.username || 'Them']: compareCounts.NEUTRAL },
    { name: 'Negative', [currentUser?.username || 'You']: currentCounts.NEGATIVE, [compareUser?.username || 'Them']: compareCounts.NEGATIVE }
  ];

  // CORRECTED: Calculate differences for insights (using avgScore, not positivePercent)
  const scoreDifference = currentAvgScore - compareAvgScore;
  const analysisDifference = currentTotal - compareTotal;
  const positivityRateDifference = currentPositivePercent - comparePositivePercent;

  return (
    <div className="comparison-dashboard">
      <div className="comparison-header">
        <h3>📊 Sentiment Comparison Dashboard</h3>
        <div className="comparison-mode-switch">
          <button className={`mode-btn ${comparisonMode === 'user' ? 'active' : ''}`} onClick={() => setComparisonMode('user')}>
            👥 Compare Users
          </button>
          <button className={`mode-btn ${comparisonMode === 'time' ? 'active' : ''}`} onClick={() => setComparisonMode('time')}>
            📅 Compare Time Periods
          </button>
        </div>
      </div>

      {comparisonMode === 'user' ? (
        <>
          {/* User Selector */}
          <div className="user-selector-compare">
            <div className="current-user-badge-compare" style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid #3b82f6' }}>
              <img src={currentUser?.avatar} alt={currentUser?.username} />
              <span style={{ color: '#3b82f6' }}>{currentUser?.username}</span>
            </div>
            <span className="vs-text">VS</span>
            <select className="compare-user-select" value={compareUserId || ''} onChange={(e) => { setCompareUserId(e.target.value); loadCompareUserData(e.target.value); }}>
              <option value="">Select user to compare</option>
              {allUsers.map(user => (
                <option key={user.userId} value={user.userId}>{user.username}</option>
              ))}
            </select>
          </div>

          {compareUser ? (
            <>
              {/* Stats Cards - Show the REAL scores */}
              <div className="comparison-stats-grid">
                <div className="compare-stat-card" style={{ borderTop: '3px solid #3b82f6' }}>
                  <div className="stat-header">{currentUser?.username}</div>
                  <div className="stat-value">{currentTotal}</div>
                  <div className="stat-label">Total Analyses</div>
                  <div className="stat-percentage" style={{ color: currentAvgScore > 60 ? '#10b981' : currentAvgScore < 40 ? '#ef4444' : '#f59e0b' }}>
                    🎯 Sentiment Score: <strong>{currentAvgScore.toFixed(1)}%</strong>
                  </div>
                  <div className="stat-score">😊 {currentPositivePercent.toFixed(1)}% Positive Posts</div>
                </div>
                <div className="compare-stat-card" style={{ borderTop: '3px solid #8b5cf6' }}>
                  <div className="stat-header">{compareUser?.username}</div>
                  <div className="stat-value">{compareTotal}</div>
                  <div className="stat-label">Total Analyses</div>
                  <div className="stat-percentage" style={{ color: compareAvgScore > 60 ? '#10b981' : compareAvgScore < 40 ? '#ef4444' : '#f59e0b' }}>
                    🎯 Sentiment Score: <strong>{compareAvgScore.toFixed(1)}%</strong>
                  </div>
                  <div className="stat-score">😊 {comparePositivePercent.toFixed(1)}% Positive Posts</div>
                </div>
              </div>

              {/* Side-by-side Pie Charts */}
              <div className="pie-charts-container">
                <div className="pie-chart-box">
                  <h4>{currentUser?.username}'s Distribution</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={currentPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {currentPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#151821', border: '1px solid #2a2d3e' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="pie-chart-box">
                  <h4>{compareUser?.username}'s Distribution</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={comparePieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {comparePieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#151821', border: '1px solid #2a2d3e' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Grouped Bar Chart */}
              <div className="comparison-chart">
                <h4>📊 Sentiment Distribution Comparison</h4>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={comparisonData} margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
                    <XAxis dataKey="name" stroke="#a0a5bf" />
                    <YAxis stroke="#a0a5bf" />
                    <Tooltip contentStyle={{ background: '#151821', border: '1px solid #2a2d3e' }} />
                    <Legend />
                    <Bar dataKey={currentUser?.username} fill="#3b82f6" radius={[8, 8, 0, 0]} />
                    <Bar dataKey={compareUser?.username} fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Timeline Chart */}
              <div className="comparison-chart">
                <h4>📈 Sentiment Trend Comparison (Last 14 days)</h4>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={timelineData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
                    <XAxis dataKey="date" stroke="#a0a5bf" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 10 }} />
                    <YAxis 
                      stroke="#a0a5bf" 
                      domain={[0, 100]} 
                      tickCount={6}
                      label={{ value: 'Sentiment Score (%)', angle: -90, position: 'insideLeft', fill: '#a0a5bf', dy: 50 }}
                    />
                    <Tooltip 
                      contentStyle={{ background: '#151821', border: '1px solid #2a2d3e' }}
                      formatter={(value) => [`${value?.toFixed(1)}%`, 'Sentiment Score']}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Line 
                      type="monotone" 
                      dataKey={currentUser?.username} 
                      stroke="#3b82f6" 
                      strokeWidth={2} 
                      dot={{ r: 4, fill: '#3b82f6' }}
                      activeDot={{ r: 6 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey={compareUser?.username} 
                      stroke="#8b5cf6" 
                      strokeWidth={2} 
                      dot={{ r: 4, fill: '#8b5cf6' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* COMPLETELY FIXED: Comparison Insights - Now uses sentiment scores */}
              <div className="comparison-insights">
                <h4>💡 Comparison Insights</h4>
                <div className="insights-grid">
                  {/* Insight 1: Who has higher sentiment score */}
                  <div className="insight-item">
                    <span className="insight-icon">{currentAvgScore > compareAvgScore ? '🏆' : compareAvgScore > currentAvgScore ? '📊' : '🤝'}</span>
                    <div className="insight-text">
                      {currentAvgScore > compareAvgScore ? (
                        <><strong style={{ color: '#3b82f6' }}>{currentUser?.username}</strong> is <strong style={{ color: '#10b981' }}>{(currentAvgScore - compareAvgScore).toFixed(1)}% more positive</strong> than {compareUser?.username}</>
                      ) : compareAvgScore > currentAvgScore ? (
                        <><strong style={{ color: '#8b5cf6' }}>{compareUser?.username}</strong> is <strong style={{ color: '#10b981' }}>{(compareAvgScore - currentAvgScore).toFixed(1)}% more positive</strong> than {currentUser?.username}</>
                      ) : (
                        <>Both users have similar sentiment scores</>
                      )}
                    </div>
                  </div>
                  
                  {/* Insight 2: Number of analyses */}
                  <div className="insight-item">
                    <span className="insight-icon">📝</span>
                    <div className="insight-text">
                      {currentTotal > compareTotal ? (
                        <><strong style={{ color: '#3b82f6' }}>{currentUser?.username}</strong> has <strong>{currentTotal - compareTotal} more {currentTotal - compareTotal === 1 ? 'analysis' : 'analyses'}</strong> than {compareUser?.username}</>
                      ) : compareTotal > currentTotal ? (
                        <><strong style={{ color: '#8b5cf6' }}>{compareUser?.username}</strong> has <strong>{compareTotal - currentTotal} more {compareTotal - currentTotal === 1 ? 'analysis' : 'analyses'}</strong> than {currentUser?.username}</>
                      ) : (
                        <>Both have the same number of analyses ({currentTotal})</>
                      )}
                    </div>
                  </div>
                  
                  {/* Insight 3: Positivity rate (percentage of positive posts) */}
                  <div className="insight-item">
                    <span className="insight-icon">🎯</span>
                    <div className="insight-text">
                      {currentPositivePercent > comparePositivePercent ? (
                        <><strong style={{ color: '#3b82f6' }}>{currentUser?.username}</strong> has a <strong>{(currentPositivePercent - comparePositivePercent).toFixed(1)}% higher positivity rate</strong> (percentage of positive posts)</>
                      ) : comparePositivePercent > currentPositivePercent ? (
                        <><strong style={{ color: '#8b5cf6' }}>{compareUser?.username}</strong> has a <strong>{(comparePositivePercent - currentPositivePercent).toFixed(1)}% higher positivity rate</strong> (percentage of positive posts)</>
                      ) : (
                        <>Both have equal positivity rates ({currentPositivePercent.toFixed(1)}%)</>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Warning for extreme cases */}
                {currentAvgScore > 70 && compareAvgScore < 30 && (
                  <div className="warning-insight">
                    <span>⚠️</span>
                    <div>
                      <strong>Attention:</strong> {compareUser?.username} is showing significantly lower sentiment scores ({compareAvgScore.toFixed(1)}% vs {currentAvgScore.toFixed(1)}%). Consider checking in on them.
                    </div>
                  </div>
                )}
                
                {compareAvgScore > 70 && currentAvgScore < 30 && (
                  <div className="warning-insight">
                    <span>⚠️</span>
                    <div>
                      <strong>Attention:</strong> {currentUser?.username} is showing significantly lower sentiment scores ({currentAvgScore.toFixed(1)}% vs {compareAvgScore.toFixed(1)}%). Consider checking in on them.
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="select-user-prompt">
              <span>👈</span>
              <p>Select a user from the dropdown to start comparing</p>
            </div>
          )}
        </>
      ) : (
        // Time period comparison mode
        <>
          <div className="time-range-selector">
            <button className={`time-btn ${timeRange === 'week' ? 'active' : ''}`} onClick={() => setTimeRange('week')}>📅 Last 7 Days</button>
            <button className={`time-btn ${timeRange === 'month' ? 'active' : ''}`} onClick={() => setTimeRange('month')}>📅 Last 30 Days</button>
            <button className={`time-btn ${timeRange === 'all' ? 'active' : ''}`} onClick={() => setTimeRange('all')}>📅 All Time</button>
          </div>

          <div className="comparison-stats-grid">
            <div className="compare-stat-card" style={{ borderTop: '3px solid #3b82f6' }}>
              <div className="stat-header">Current Period ({timeRange === 'week' ? '7 days' : timeRange === 'month' ? '30 days' : 'All Time'})</div>
              <div className="stat-value">{currentFilteredPosts.length}</div>
              <div className="stat-label">Analyses</div>
              <div className="stat-percentage">🎯 Score: {currentAvgScore.toFixed(1)}%</div>
            </div>
            <div className="compare-stat-card" style={{ borderTop: '3px solid #6b7280' }}>
              <div className="stat-header">Overall Average</div>
              <div className="stat-value">{currentUserPosts.length}</div>
              <div className="stat-label">Total Analyses</div>
              <div className="stat-percentage">📊 Baseline: {calculateAvgSentimentScore(currentUserPosts).toFixed(1)}%</div>
            </div>
          </div>

          <div className="comparison-chart">
            <h4>📈 Sentiment Evolution Over Time</h4>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={timelineData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
                <XAxis dataKey="date" stroke="#a0a5bf" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 10 }} />
                <YAxis stroke="#a0a5bf" domain={[0, 100]} tickCount={6} label={{ value: 'Sentiment Score (%)', angle: -90, position: 'insideLeft', fill: '#a0a5bf', dy: 50 }} />
                <Tooltip contentStyle={{ background: '#151821', border: '1px solid #2a2d3e' }} formatter={(value) => [`${value?.toFixed(1)}%`, 'Sentiment Score']} />
                <Legend />
                <Area type="monotone" dataKey={currentUser?.username} stroke="#3b82f6" fill="#3b82f633" name="Sentiment Score" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
};

export default ComparisonDashboard;