import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

const AppContext = createContext(null);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

export function AppProvider({ children }) {
  // Auth state
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('debugmind_token') || null);
  const [authUser, setAuthUser] = useState(() => {
    const stored = localStorage.getItem('debugmind_auth_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [authError, setAuthError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('debugmind_token'));

  // Legacy user state (for backward compatibility)
  const [user, setUser] = useState(() => localStorage.getItem('debugmind_user') || null);
  const [data, setData] = useState(null);
  const [agentState, setAgentState] = useState(null);
  const [codeAnalysis, setCodeAnalysis] = useState(null); // DEPRECATED: kept for backward compat, no longer actively populated
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [dataStatus, setDataStatus] = useState('unknown'); // 'unknown' | 'no_data' | 'ready'
  const [notifications, setNotifications] = useState([
    { id: 1, message: "Welcome to DebugMind AI!", type: "info", read: false },
  ]);

  // Use ref to track if data was found (to stop polling)
  const dataFoundRef = useRef(false);

  // ============================================
  // AUTHENTICATION FUNCTIONS
  // ============================================

  // Login with email and password
  const login = useCallback(async (email, password) => {
    setAuthError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        const errorMsg = data.message || data.error || 'Login failed';
        setAuthError(errorMsg);
        return { success: false, error: errorMsg };
      }

      // Store auth data
      localStorage.setItem('debugmind_token', data.token);
      localStorage.setItem('debugmind_auth_user', JSON.stringify(data.user));
      localStorage.setItem('debugmind_user', data.user.leetcodeUsername || data.user.userId);
      
      setAuthToken(data.token);
      setAuthUser(data.user);
      setIsAuthenticated(true);
      setUser(data.user.leetcodeUsername || data.user.userId);

      // Try to load user's existing data from DB
      // This also hydrates the backend memory store
      const loadedData = await loadUserDataFromDB(data.user.userId);
      
      // If DB had data, also fetch the enhanced agent state
      // (backend memory store is now hydrated, so this returns full data)
      if (loadedData) {
        await fetchAgentState(data.user.userId);

        // Auto re-fetch after 10s to pick up LLM-enhanced results
        // (The async LLM pipeline runs ~5-10s after extract)
        setTimeout(() => {
          console.log('[AppContext] Delayed re-fetch for LLM-enhanced data');
          loadUserDataFromDB(data.user.userId);
        }, 10000);
      }

      console.log('[AppContext] Login successful:', data.user.userId);
      return { success: true, user: data.user };
    } catch (err) {
      const errorMsg = 'Network error. Please try again.';
      setAuthError(errorMsg);
      console.error('[AppContext] Login error:', err);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  // Signup with email, password, and leetcode username
  const signup = useCallback(async (email, password, leetcodeUsername) => {
    setAuthError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, leetcodeUsername })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        const errorMsg = data.message || data.error || 'Signup failed';
        setAuthError(errorMsg);
        return { success: false, error: errorMsg };
      }

      // Store auth data
      localStorage.setItem('debugmind_token', data.token);
      localStorage.setItem('debugmind_auth_user', JSON.stringify(data.user));
      localStorage.setItem('debugmind_user', leetcodeUsername);
      
      setAuthToken(data.token);
      setAuthUser(data.user);
      setIsAuthenticated(true);
      setUser(leetcodeUsername);

      console.log('[AppContext] Signup successful:', data.user.userId);
      return { success: true, user: data.user };
    } catch (err) {
      const errorMsg = 'Network error. Please try again.';
      setAuthError(errorMsg);
      console.error('[AppContext] Signup error:', err);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  // Guest login (backward compatible)
  const guestLogin = useCallback(async (leetcodeUsername) => {
    setAuthError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/guest-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leetcodeUsername })
      });

      const data = await res.json();

      if (res.ok && data.token) {
        localStorage.setItem('debugmind_token', data.token);
        localStorage.setItem('debugmind_auth_user', JSON.stringify(data.user));
        setAuthToken(data.token);
        setAuthUser(data.user);
      }

      // Always save user for backward compatibility
      localStorage.setItem('debugmind_user', leetcodeUsername);
      setUser(leetcodeUsername);
      
      return { success: true };
    } catch (err) {
      console.error('[AppContext] Guest login error:', err);
      // Still work even if guest login fails
      localStorage.setItem('debugmind_user', leetcodeUsername);
      setUser(leetcodeUsername);
      return { success: true };
    }
  }, []);

  // Load user data from database (for returning users)
  // DB is the source of truth - cache is populated from DB
  const loadUserDataFromDB = useCallback(async (userId) => {
    if (!userId) return null;

    try {
      console.log('[UI] Loading user data from DB for:', userId);
      const res = await fetch(`${API_BASE_URL}/load-user-data/${userId}`);
      
      if (!res.ok) {
        console.log('[UI] No stored data for user');
        setDataStatus('no_data');
        return null;
      }

      const userData = await res.json();
      
      // hasData is based on submissions count (DB is source of truth)
      if (!userData.hasData) {
        console.log('[UI] User exists but no submissions in DB');
        setDataStatus('no_data');
        return null;
      }

      console.log('[UI] DB has data - hydrating state', {
        submissionsCount: userData.submissionDocs?.length || 0,
        hasAgentOutput: !!userData.agentOutput,
        goalsCount: userData.agentOutput?.goals?.length || userData.activeGoals?.length || 0
      });

      // Set submissions count for hasData check
      const submissionsCount = userData.submissionDocs?.length || 0;
      
      // Build agent state - use agentOutput if available, otherwise build minimal state
      const agentStateData = {
        status: 'ready',
        submissions_count: submissionsCount, // Critical for hasData
        goals: userData.agentOutput?.goals || userData.activeGoals || [],
        plan: userData.agentOutput?.plan,
        progress: userData.agentOutput?.monitoring,
        adaptation: userData.agentOutput?.adaptation,
        next_action: userData.agentOutput?.nextAction,
        diagnosis: userData.agentOutput?.diagnosis
      };
      setAgentState(agentStateData);

      // Build data object for UI components
      const goals = agentStateData.goals || [];
      const dataObj = {
        user: userId,
        weak_topics: goals.map(g => ({
          topic: g.topic,
          confidence: g.current_score,
          score: g.current_score,
          goal: `Reach ${g.target_score}% success`,
          strategy: `Focus on ${g.topic?.toLowerCase()} patterns`,
          evidence: [`Current: ${g.current_score}%`, `Target: ${g.target_score}%`]
        })),
        agentic: userData.agentOutput || {},
        submissionDocs: userData.submissionDocs || []
      };
      
      setData(dataObj);
      setDataStatus('ready');
      dataFoundRef.current = true;
      // Stop polling since we have data from DB
      setIsPolling(false);
      localStorage.setItem('debugmind_data', JSON.stringify(dataObj));

      console.log('[UI] ✓ State hydrated from DB - dashboard ready');
      return userData;
    } catch (err) {
      console.error('[UI] Failed to load user data:', err);
      setDataStatus('no_data');
      return null;
    }
  }, []);

  // Auth logout
  const authLogout = useCallback(() => {
    localStorage.removeItem('debugmind_token');
    localStorage.removeItem('debugmind_auth_user');
    localStorage.removeItem('debugmind_user');
    localStorage.removeItem('debugmind_data');
    
    setAuthToken(null);
    setAuthUser(null);
    setIsAuthenticated(false);
    setUser(null);
    setData(null);
    setAgentState(null);
    setIsPolling(false);
    setDataStatus('unknown');
    dataFoundRef.current = false;
    
    console.log('[AppContext] Logged out');
  }, []);

  // ============================================
  // LEGACY FUNCTIONS (kept for backward compatibility)
  // ============================================

  // Save user to localStorage (sanitize to lowercase)
  const saveUser = useCallback((username) => {
    const sanitized = username.toLowerCase().trim();
    console.log('[AppContext] Saving user:', sanitized);
    localStorage.setItem('debugmind_user', sanitized);
    setUser(sanitized);
    setDataStatus('unknown');
    dataFoundRef.current = false;
    
    // Also do guest login in background
    guestLogin(sanitized);
  }, [guestLogin]);

  // Legacy logout (calls authLogout)
  const logout = useCallback(() => {
    authLogout();
  }, [authLogout]);

  // Fetch agent state (from in-memory store on backend)
  const fetchAgentState = useCallback(async (userId) => {
    if (!userId) return null;

    const sanitizedUserId = userId.toLowerCase().trim();
    console.log('[UI] Fetching agent state for:', sanitizedUserId);

    try {
      const res = await fetch(`${API_BASE_URL}/agent-state/${sanitizedUserId}`);
      if (!res.ok) {
        console.error('[UI] Agent state fetch failed:', res.status);
        return null;
      }

      const state = await res.json();
      console.log('[UI] Agent state response:', { 
        status: state.status, 
        submissions_count: state.submissions_count,
        hasGoals: !!state.goals?.length 
      });

      // Check if data is ready (status='ready' with submissions)
      // Accept data even if goals are empty, as long as we have submissions
      if (state.status === 'ready' && state.submissions_count > 0) {
        console.log('[UI] ✓ Data ready! Submissions:', state.submissions_count, 'Goals:', state.goals?.length || 0);
        setDataStatus('ready');
        setAgentState(state);
        dataFoundRef.current = true;
        
        // Stop polling explicitly
        setIsPolling(false);

        // Build data object for hasData check
        const dataObj = {
          user: sanitizedUserId,
          weak_topics: state.goals?.map(g => ({
            topic: g.topic,
            confidence: g.current_score,
            score: g.current_score,
            goal: `Reach ${g.target_score}% success`,
            strategy: `Focus on ${g.topic?.toLowerCase()} patterns`,
            evidence: [`Current: ${g.current_score}%`, `Target: ${g.target_score}%`]
          })) || [],
          recommended_problems: state.plan?.plan?.[0]?.problems || [],
          agentic: state
        };
        setData(dataObj);
        localStorage.setItem('debugmind_data', JSON.stringify(dataObj));

        // Add notification
        if (state.alerts?.length > 0 && state.alerts[0]?.title) {
          const newNotif = {
            id: Date.now(),
            message: state.alerts[0].title,
            type: state.alerts[0].type || 'info',
            read: false
          };
          setNotifications(prev => {
            if (!prev.find(n => n.message === newNotif.message)) {
              return [newNotif, ...prev].slice(0, 10);
            }
            return prev;
          });
        }

        return state;
      } else if (state.status === 'no_data') {
        console.log('[UI] No data yet for user:', sanitizedUserId);
        setDataStatus('no_data');
        return null;
      }

      return null;
    } catch (e) {
      console.error('[UI] Failed to fetch agent state:', e);
      return null;
    }
  }, []);

  // Analyze profile
  const analyze = useCallback(async (profileUrl) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileUrl })
      });
      if (!res.ok) throw new Error('System could not reach the analysis engine.');
      const json = await res.json();
      setData(json);

      // Save to localStorage for persistence
      localStorage.setItem('debugmind_data', JSON.stringify(json));

      if (json.agentic) {
        setAgentState({
          ...json.agentic,
          goals: json.agentic.goals,
          plan: json.agentic.plan,
          progress: json.agentic.progress,
          adaptation: json.agentic.adaptation,
          agent_loop: { current_stage: json.agentic.loop_status, total_runs: 1 },
          metrics: json.agentic.metrics,
          next_action: json.agentic.next_action,
          alerts: json.agentic.alerts,
          decision_timeline: json.agentic.decision_timeline,
          confidence_history: json.agentic.confidence_history,
          strategy_evolution: json.agentic.strategy_evolution
        });
      }

      setIsPolling(true);
      return json;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  // Advance day in plan
  const advanceDay = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE_URL}/plan/${user}/advance`, { method: 'POST' });
      if (res.ok) await fetchAgentState(user);
    } catch (e) {
      console.error('Failed to advance day:', e);
    }
  }, [user, fetchAgentState]);

  // Refresh data
  const refreshData = useCallback(() => {
    if (user) fetchAgentState(user);
  }, [user, fetchAgentState]);

  // Fetch code analysis - DEPRECATED
  // LLM analysis now runs automatically during /extract pipeline
  // Data is available in submissionDocs from loadUserDataFromDB
  const fetchCodeAnalysis = useCallback(async (forceRefresh = false) => {
    console.warn('[AppContext] fetchCodeAnalysis is DEPRECATED. LLM analysis runs automatically during extraction.');
    return null;
  }, []);

  // Mark notification as read
  const markNotificationRead = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  // Clear error
  const clearError = useCallback(() => setError(null), []);

  // Extract latest data (for dashboard button)
  const extractLatestData = useCallback(async () => {
    if (!user) return null;
    
    setLoading(true);
    setDataStatus('unknown');
    dataFoundRef.current = false;
    
    try {
      // Trigger extract via analyze endpoint
      await analyze(`https://leetcode.com/u/${user}`);
      setIsPolling(true);
      return { success: true };
    } catch (err) {
      console.error('[AppContext] Extract failed:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [user, analyze]);

  // Load cached data on mount
  useEffect(() => {
    const cachedData = localStorage.getItem('debugmind_data');
    if (cachedData && user) {
      try {
        setData(JSON.parse(cachedData));
        setIsPolling(true);
      } catch (e) {
        localStorage.removeItem('debugmind_data');
      }
    }

    // Code analysis cache loading removed — LLM analysis now comes from DB via loadUserDataFromDB
  }, [user]);

  // Polling for agent state
  useEffect(() => {
    if (!user || !isPolling) {
      console.log('[AppContext] Polling disabled - user:', !!user, 'isPolling:', isPolling);
      return;
    }

    // If data already found, don't poll
    if (dataFoundRef.current) {
      console.log('[AppContext] Data already found, stopping poll');
      return;
    }

    console.log('[AppContext] Starting polling for user:', user);

    // Initial fetch
    fetchAgentState(user);

    // Set up polling interval (every 3 seconds)
    const interval = setInterval(() => {
      // Stop polling if data was found
      if (dataFoundRef.current) {
        console.log('[AppContext] Data found, clearing interval');
        clearInterval(interval);
        return;
      }
      console.log('[AppContext] Polling tick for:', user);
      fetchAgentState(user);
    }, 3000);

    return () => {
      console.log('[AppContext] Cleaning up polling interval');
      clearInterval(interval);
    };
  }, [user, isPolling, fetchAgentState]);

  const value = {
    // Auth State
    authToken,
    authUser,
    authError,
    isAuthenticated,

    // Legacy State
    user,
    data,
    agentState,
    codeAnalysis,
    loading,
    error,
    isPolling,
    dataStatus,
    notifications,

    // Auth Actions
    login,
    signup,
    guestLogin,
    authLogout,
    loadUserDataFromDB,

    // Legacy Actions
    saveUser,
    logout,
    analyze,
    fetchAgentState,
    fetchCodeAnalysis,
    advanceDay,
    refreshData,
    markNotificationRead,
    clearError,
    setIsPolling,
    setData,
    setCodeAnalysis,
    extractLatestData,

    // Computed - data is ready if we have data/agentState (goals optional)
    hasData: dataStatus === 'ready' && !!data && !!agentState?.submissions_count,
    isWaitingForData: isPolling && dataStatus !== 'ready',
    unreadCount: notifications.filter(n => !n.read).length,
    hasCodeAnalysis: false // DEPRECATED: no longer used
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
