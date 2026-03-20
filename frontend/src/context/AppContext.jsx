import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

const AppContext = createContext(null);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => localStorage.getItem('debugmind_user') || null);
  const [data, setData] = useState(null);
  const [agentState, setAgentState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [dataStatus, setDataStatus] = useState('unknown'); // 'unknown' | 'no_data' | 'ready'
  const [notifications, setNotifications] = useState([
    { id: 1, message: "Welcome to DebugMind AI!", type: "info", read: false },
  ]);

  // Use ref to track if data was found (to stop polling)
  const dataFoundRef = useRef(false);

  // Save user to localStorage (sanitize to lowercase)
  const saveUser = useCallback((username) => {
    const sanitized = username.toLowerCase().trim();
    console.log('[AppContext] Saving user:', sanitized);
    localStorage.setItem('debugmind_user', sanitized);
    setUser(sanitized);
    setDataStatus('unknown');
    dataFoundRef.current = false;
  }, []);

  // Logout user
  const logout = useCallback(() => {
    localStorage.removeItem('debugmind_user');
    localStorage.removeItem('debugmind_data');
    setUser(null);
    setData(null);
    setAgentState(null);
    setIsPolling(false);
  }, []);

  // Fetch agent state
  const fetchAgentState = useCallback(async (userId) => {
    if (!userId) return null;

    const sanitizedUserId = userId.toLowerCase().trim();
    console.log('[AppContext] Fetching agent state for:', sanitizedUserId);

    try {
      const res = await fetch(`${API_BASE_URL}/agent-state/${sanitizedUserId}`);
      if (!res.ok) {
        console.error('[AppContext] Agent state fetch failed:', res.status);
        return null;
      }

      const state = await res.json();
      console.log('[AppContext] Agent state response:', { status: state.status, hasGoals: !!state.goals?.length });

      // Check if data is ready
      if (state.status === 'ready' && state.goals?.length > 0) {
        console.log('[AppContext] Data ready! Goals:', state.goals.length);
        setDataStatus('ready');
        setAgentState(state);
        dataFoundRef.current = true;

        // Build data object for hasData check
        const dataObj = {
          user: sanitizedUserId,
          weak_topics: state.goals?.map(g => ({
            topic: g.topic,
            confidence: g.current_score,
            score: g.current_score,
            goal: `Reach ${g.target_score}% success`,
            strategy: `Focus on ${g.topic.toLowerCase()} patterns`,
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
        console.log('[AppContext] No data yet for user:', sanitizedUserId);
        setDataStatus('no_data');
        return null;
      }

      return null;
    } catch (e) {
      console.error('[AppContext] Failed to fetch agent state:', e);
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

  // Mark notification as read
  const markNotificationRead = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  // Clear error
  const clearError = useCallback(() => setError(null), []);

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
    // State
    user,
    data,
    agentState,
    loading,
    error,
    isPolling,
    dataStatus,
    notifications,

    // Actions
    saveUser,
    logout,
    analyze,
    fetchAgentState,
    advanceDay,
    refreshData,
    markNotificationRead,
    clearError,
    setIsPolling,
    setData,

    // Computed - data is ready only if we have goals
    hasData: dataStatus === 'ready' && !!data && !!agentState?.goals?.length,
    isWaitingForData: isPolling && dataStatus !== 'ready',
    unreadCount: notifications.filter(n => !n.read).length
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
