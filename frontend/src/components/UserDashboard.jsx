import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  getAllUsers, createUser, deleteUser, getUserPosts, 
  getUserAnalytics, addPost, getUserById 
} from '../services/userStorage';

const COLORS = {
  POSITIVE: '#10b981',
  NEUTRAL: '#f59e0b',
  NEGATIVE: '#ef4444'
};

export default function UserDashboard({ currentResult, onAddToUser }) {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [userAnalytics, setUserAnalytics] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [timelineData, setTimelineData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Load all users on mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const allUsers = await getAllUsers();
      setUsers(allUsers || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadUserData = async (userId) => {
    setLoading(true);
    try {
      const posts = await getUserPosts(userId);
      const analytics = await getUserAnalytics(userId);
      setUserPosts(posts || []);
      setUserAnalytics(analytics);
      
      // Prepare timeline data for chart
      const timelineMap = {};
      (posts || []).forEach(post => {
        const date = new Date(post.timestamp).toLocaleDateString();
        if (!timelineMap[date]) {
          timelineMap[date] = { date, POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0, count: 0 };
        }
        timelineMap[date][post.sentiment]++;
        timelineMap[date].count++;
      });
      
      setTimelineData(Object.values(timelineMap));
    } catch (error) {
      console.error('Error loading user data:', error);
    }
    setLoading(false);
  };

  const handleCreateUser = async () => {
    if (!newUsername.trim()) return;
    try {
      const newUser = await createUser(newUsername);
      setUsers([newUser, ...users]);
      setShowCreateModal(false);
      setNewUsername('');
      setSelectedUser(newUser);
      await loadUserData(newUser.userId);
      setSuccessMessage(`User "${newUsername}" created successfully!`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error creating user:', error);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Delete this user and all their data? This cannot be undone.')) {
      try {
        await deleteUser(userId);
        if (selectedUser?.userId === userId) {
          setSelectedUser(null);
          setUserPosts([]);
          setUserAnalytics(null);
          setTimelineData([]);
        }
        await loadUsers();
        setSuccessMessage('User deleted successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  };

  const handleAddCurrentResult = async () => {
    if (!selectedUser) {
      alert('Please select a user first');
      return;
    }
    if (!currentResult) {
      alert('No analysis result to add. Please run an analysis first.');
      return;
    }
    
    try {
      await addPost(
        selectedUser.userId, 
        currentResult.content, 
        currentResult.result, 
        currentResult.type
      );
      await loadUserData(selectedUser.userId);
      if (onAddToUser) onAddToUser();
      setSuccessMessage('Analysis added to user timeline!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error adding post:', error);
      alert('Error adding analysis. Please try again.');
    }
  };

  return (
    <div className="user-dashboard">
      {/* Success Message */}
      {successMessage && (
        <div className="success-message">
          ✅ {successMessage}
        </div>
      )}

      {/* User Selector */}
      <div className="user-selector-section">
        <div className="user-header">
          <h3>👥 User Sentiment Timeline</h3>
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
            + New User
          </button>
        </div>
        
        <div className="user-list">
          {users.length === 0 ? (
            <div className="empty-state">
              <p>No users yet. Create your first user!</p>
            </div>
          ) : (
            users.map(user => (
              <div 
                key={user.userId}
                className={`user-card ${selectedUser?.userId === user.userId ? 'active' : ''}`}
                onClick={() => {
                  setSelectedUser(user);
                  loadUserData(user.userId);
                }}
              >
                <img src={user.avatar} alt={user.username} className="user-avatar" />
                <div className="user-info">
                  <div className="user-name">{user.username}</div>
                  <div className="user-stats">
                    {user.totalPosts || 0} posts • 
                    {user.avgSentiment > 0.2 ? ' 😊' : user.avgSentiment < -0.2 ? ' 😞' : ' 😐'}
                  </div>
                </div>
                <button 
                  className="user-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteUser(user.userId);
                  }}
                >
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* User Dashboard */}
      {selectedUser ? (
        <div className="user-dashboard-content">
          <div className="dashboard-header">
            <div className="dashboard-title">
              <img src={selectedUser.avatar} alt={selectedUser.username} className="dashboard-avatar" />
              <div>
                <h2>{selectedUser.username}'s Sentiment Timeline</h2>
                <p>Total Analyses: {userAnalytics?.totalPosts || 0}</p>
              </div>
            </div>
            {currentResult && (
              <button className="btn-primary" onClick={handleAddCurrentResult}>
                + Add Current Analysis
              </button>
            )}
          </div>

          {loading ? (
            <div className="loading-pane">Loading dashboard...</div>
          ) : (
            <>
              {/* Stats Cards */}
              {userAnalytics && (
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-value">{userAnalytics.totalPosts || 0}</div>
                    <div className="stat-label">Total Analyses</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{((userAnalytics.avgConfidence || 0) * 100).toFixed(1)}%</div>
                    <div className="stat-label">Avg Confidence</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">
                      {(userAnalytics.avgSentiment || 0) > 0.2 ? '😊 Positive' : 
                       (userAnalytics.avgSentiment || 0) < -0.2 ? '😞 Negative' : '😐 Neutral'}
                    </div>
                    <div className="stat-label">Overall Sentiment</div>
                  </div>
                </div>
              )}

              {/* Sentiment Timeline Chart */}
              {timelineData.length > 0 && (
                <div className="chart-card">
                  <h4>📈 Sentiment Timeline</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
                      <XAxis dataKey="date" stroke="#a0a5bf" />
                      <YAxis stroke="#a0a5bf" />
                      <Tooltip 
                        contentStyle={{ background: '#151821', border: '1px solid #2a2d3e' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="POSITIVE" stroke={COLORS.POSITIVE} strokeWidth={2} />
                      <Line type="monotone" dataKey="NEUTRAL" stroke={COLORS.NEUTRAL} strokeWidth={2} />
                      <Line type="monotone" dataKey="NEGATIVE" stroke={COLORS.NEGATIVE} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Sentiment Distribution */}
              {userAnalytics && userAnalytics.sentimentDistribution && (
                <div className="charts-grid">
                  <div className="chart-card">
                    <h4>🎯 Sentiment Distribution</h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={Object.entries(userAnalytics.sentimentDistribution).map(([name, value]) => ({
                            name,
                            value: value || 0
                          })).filter(item => item.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {Object.entries(userAnalytics.sentimentDistribution).map(([name], index) => (
                            <Cell key={name} fill={COLORS[name]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Recent Posts */}
                  <div className="chart-card">
                    <h4>📝 Recent Analyses</h4>
                    <div className="recent-posts">
                      {userPosts.length === 0 ? (
                        <div className="empty-state-small">
                          <p>No analyses yet. Add some!</p>
                        </div>
                      ) : (
                        userPosts.slice(0, 10).map(post => (
                          <div key={post.postId} className={`recent-post ${post.sentiment.toLowerCase()}`}>
                            <div className="post-content">{post.content.substring(0, 60)}...</div>
                            <div className="post-meta">
                              <span className={`sentiment-badge ${post.sentiment.toLowerCase()}`}>
                                {post.sentiment}
                              </span>
                              <span className="post-date">{new Date(post.timestamp).toLocaleString()}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Empty state when no data */}
              {userPosts.length === 0 && (
                <div className="idle-hint">
                  <span className="idle-hint-icon">📊</span>
                  <p className="idle-hint-text">No data yet</p>
                  <p className="idle-hint-sub">Run an analysis and click "Add Current Analysis" to start building your timeline</p>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="user-dashboard-content empty">
          <div className="idle-hint">
            <span className="idle-hint-icon">👥</span>
            <p className="idle-hint-text">Select a user to view their sentiment timeline</p>
            <p className="idle-hint-sub">Create a user on the left panel to get started</p>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Create New User</h3>
            <input
              type="text"
              placeholder="Enter username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateUser()}
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateUser}>Create User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}