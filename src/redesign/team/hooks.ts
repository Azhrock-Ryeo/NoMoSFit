import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { auth } from '../../config/firebase';
import type { TeamWorkoutActivity } from '../../types/teamActivity';
import { fetchOverview, fetchWeek, fetchMemberPage, type TeamOverview, type HistoryCursor } from './data';
import { createRequestGate, mergeHistory, problemFrom, scopeKey, type HistoryScope, type Problem, type WeeklySummary } from './model';

export function useTeamOverview(viewerUid: string) {
  const [overview, setOverview] = useState<TeamOverview | null>(null);
  const [weekly, setWeekly] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekLoading, setWeekLoading] = useState(false);
  const [error, setError] = useState<Problem | null>(null);
  const [weekError, setWeekError] = useState<Problem | null>(null);
  const busy = useRef(false);
  const currentTeam = useRef<string | null>(null);
  const gate = useRef(createRequestGate()).current;
  const refresh = useCallback(async () => {
    if (busy.current || auth.currentUser?.uid !== viewerUid) return;
    busy.current = true;
    const request = gate.begin();
    const current = () => gate.current(request) && auth.currentUser?.uid === viewerUid;
    setLoading(true); setError(null); setWeekError(null);
    try {
      const result = await fetchOverview(viewerUid);
      if (!current()) return;
      if (currentTeam.current !== result.team?.id) setWeekly(null);
      currentTeam.current = result.team?.id ?? null;
      setOverview(result); setLoading(false);
      if (result.team) {
        setWeekLoading(true);
        try {
          const nextWeek = await fetchWeek(viewerUid, result.team.id);
          if (current()) setWeekly(nextWeek);
        } catch (failure) {
          if (current()) {
            const problem = problemFrom(failure);
            setWeekError(problem);
            if (problem.clearData) { setWeekly(null); setOverview(null); setError(problem); }
          }
        }
      } else { setWeekly(null); }
    } catch (failure) {
      if (current()) {
        const problem = problemFrom(failure);
        setError(problem);
        if (problem.clearData) { setOverview(null); setWeekly(null); currentTeam.current = null; }
      }
    } finally {
      if (gate.current(request)) { busy.current = false; setLoading(false); setWeekLoading(false); }
    }
  }, [viewerUid, gate]);
  useFocusEffect(useCallback(() => {
    void refresh();
    return () => { gate.invalidate(); busy.current = false; };
  }, [refresh, gate]));
  return { overview, weekly, loading, weekLoading, error, weekError, refresh };
}

export type HistoryState = {
  rows: TeamWorkoutActivity[]; cursor: HistoryCursor | null; hasMore: boolean;
  phase: 'loading' | 'refreshing' | 'more' | 'idle'; error: Problem | null; loaded: boolean;
  failedOperation: 'refresh' | 'more' | null;
};
const initial = (): HistoryState => ({ rows: [], cursor: null, hasMore: false, phase: 'loading', error: null, loaded: false, failedOperation: null });

/** Independent state for each opened member, never filter a global 25-item feed. */
export function useMemberHistory(scope: HistoryScope) {
  const [state, setState] = useState<HistoryState>(initial);
  const latest = useRef(state);
  const busy = useRef(false);
  const gate = useRef(createRequestGate()).current;
  const key = scopeKey(scope);
  const update = useCallback((updater: (old: HistoryState) => HistoryState) => {
    latest.current = updater(latest.current);
    setState(latest.current);
  }, []);
  const requestPage = useCallback(async (reset: boolean) => {
    if (busy.current || auth.currentUser?.uid !== scope.viewerUid) return;
    if (!reset && (!latest.current.hasMore || !latest.current.cursor)) return;
    busy.current = true;
    const request = gate.begin();
    const cursor = reset ? null : latest.current.cursor;
    update(old => ({ ...old, phase: reset ? (old.rows.length ? 'refreshing' : 'loading') : 'more', error: null, failedOperation: null }));
    const current = () => gate.current(request) && auth.currentUser?.uid === scope.viewerUid;
    try {
      const page = await fetchMemberPage(scope, cursor);
      if (!current()) return;
      update(old => ({ rows: mergeHistory(reset ? [] : old.rows, page.items, scope),
        cursor: page.cursor, hasMore: page.hasMore, phase: 'idle', error: null, loaded: true, failedOperation: null }));
    } catch (failure) {
      if (current()) {
        const problem = problemFrom(failure);
        update(old => ({ ...old, ...(problem.clearData ? { rows: [], cursor: null, hasMore: false } : {}), phase: 'idle', error: problem, failedOperation: reset || problem.clearData ? 'refresh' : 'more' }));
        // Keep the SDK's diagnostic information available; do not suppress Firestore warnings.
        console.warn('[NoMoSFit Team history]', problem.code, problem.indexUrl ?? problem.title);
      }
    } finally {
      if (gate.current(request)) busy.current = false;
    }
  }, [key, gate, update]);
  useEffect(() => {
    latest.current = initial(); setState(latest.current);
    void requestPage(true);
    return () => { gate.invalidate(); busy.current = false; };
  }, [requestPage, gate]);
  return { ...state, refresh: () => requestPage(true), loadMore: () => requestPage(false), retry: () => requestPage(state.failedOperation !== 'more') };
}
