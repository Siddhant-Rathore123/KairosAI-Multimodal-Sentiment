// User sentiment timeline storage service
import { openDB } from 'idb';

const DB_NAME = 'KairosAI_UsersDB';
const DB_VERSION = 4;

// Initialize database
export const initDB = async () => {
  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Drop existing stores if they exist
      if (db.objectStoreNames.contains('users')) {
        db.deleteObjectStore('users');
      }
      if (db.objectStoreNames.contains('posts')) {
        db.deleteObjectStore('posts');
      }
      if (db.objectStoreNames.contains('analytics')) {
        db.deleteObjectStore('analytics');
      }
      
      // Store for users
      const userStore = db.createObjectStore('users', { keyPath: 'userId' });
      userStore.createIndex('username', 'username');
      userStore.createIndex('createdAt', 'createdAt');
      
      // Store for sentiment posts
      const postStore = db.createObjectStore('posts', { keyPath: 'postId' });
      postStore.createIndex('userId', 'userId');
      postStore.createIndex('timestamp', 'timestamp');
      postStore.createIndex('sentiment', 'sentiment');
      postStore.createIndex('userId_timestamp', ['userId', 'timestamp']);
      
      // Store for user analytics
      const analyticsStore = db.createObjectStore('analytics', { keyPath: 'userId' });
      analyticsStore.createIndex('lastUpdated', 'lastUpdated');
    },
  });
  return db;
};

// User Management
export const createUser = async (username, avatar = null) => {
  const db = await initDB();
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const user = {
    userId,
    username,
    avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=3b82f6&color=fff&bold=true`,
    createdAt: new Date().toISOString(),
    totalPosts: 0,
    avgSentiment: 0,
    avgConfidence: 0,
    sentimentDistribution: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 }
  };
  
  await db.add('users', user);
  
  const analytics = {
    userId,
    totalPosts: 0,
    sentimentDistribution: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
    avgConfidence: 0,
    avgSentiment: 0,
    lastUpdated: new Date().toISOString()
  };
  await db.add('analytics', analytics);
  
  return user;
};

export const getAllUsers = async () => {
  const db = await initDB();
  const users = await db.getAllFromIndex('users', 'createdAt');
  return users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

export const getUserById = async (userId) => {
  const db = await initDB();
  return await db.get('users', userId);
};

export const deleteUser = async (userId) => {
  const db = await initDB();
  const posts = await getUserPosts(userId);
  for (const post of posts) {
    await db.delete('posts', post.postId);
  }
  await db.delete('users', userId);
  await db.delete('analytics', userId);
};

export const addPost = async (userId, content, sentimentResult, type = 'text') => {
  const db = await initDB();
  
  const postId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const confidence = typeof sentimentResult.confidence === 'number' 
    ? Math.min(Math.max(sentimentResult.confidence, 0), 1) 
    : 0.5;
  
  const post = {
    postId,
    userId,
    content: typeof content === 'string' ? content.substring(0, 200) : (content.name || 'Media content'),
    sentiment: sentimentResult.sentiment,
    confidence: confidence,
    type,
    timestamp: new Date().toISOString(),
    date: new Date().toDateString()
  };
  
  await db.add('posts', post);
  await updateUserAnalytics(userId);
  
  return post;
};

export const getUserPosts = async (userId, limit = 100, offset = 0) => {
  const db = await initDB();
  const index = db.transaction('posts').store.index('userId_timestamp');
  let posts = await index.getAll(IDBKeyRange.bound([userId, ''], [userId, 'zzzz']));
  posts = posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return posts.slice(offset, offset + limit);
};

export const updateUserAnalytics = async (userId) => {
  const db = await initDB();
  const posts = await getUserPosts(userId);
  
  const sentimentCount = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 };
  let totalConfidence = 0;
  let totalSentimentScore = 0;
  
  posts.forEach(post => {
    sentimentCount[post.sentiment]++;
    
    const conf = typeof post.confidence === 'number' ? post.confidence : 0.5;
    totalConfidence += conf;
    
    let sentimentScore = 0;
    if (post.sentiment === 'POSITIVE') sentimentScore = 1;
    else if (post.sentiment === 'NEUTRAL') sentimentScore = 0;
    else if (post.sentiment === 'NEGATIVE') sentimentScore = -1;
    totalSentimentScore += sentimentScore;
  });
  
  const total = posts.length;
  const avgConfidence = total > 0 ? totalConfidence / total : 0;
  const avgSentiment = total > 0 ? totalSentimentScore / total : 0;
  
  const analytics = {
    userId,
    totalPosts: total,
    sentimentDistribution: sentimentCount,
    avgConfidence: parseFloat(avgConfidence.toFixed(3)),
    avgSentiment: parseFloat(avgSentiment.toFixed(3)),
    lastUpdated: new Date().toISOString()
  };
  
  await db.put('analytics', analytics);
  
  const user = await db.get('users', userId);
  if (user) {
    user.totalPosts = total;
    user.avgSentiment = avgSentiment;
    user.avgConfidence = avgConfidence;
    user.sentimentDistribution = sentimentCount;
    await db.put('users', user);
  }
  
  return analytics;
};

export const getUserAnalytics = async (userId) => {
  const db = await initDB();
  let analytics = await db.get('analytics', userId);
  if (!analytics) {
    analytics = await updateUserAnalytics(userId);
  }
  return analytics;
};