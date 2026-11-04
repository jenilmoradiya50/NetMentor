/**
 * NetMentor Persistent AI Generation Manager Context (Milestone 3)
 *
 * Centralizes state management, background polling, cross-tab synchronization,
 * and recovery for all asynchronous AI generation tasks (lessons, quizzes, flashcards).
 *
 * Features:
 * - Recovers active tasks from PostgreSQL backend on mount and after page refresh.
 * - Non-overlapping polling loop (2.5s interval) when active tasks exist.
 * - Graceful degradation on network disconnect (pauses when offline, resumes when online).
 * - Multi-tab synchronization via BroadcastChannel with localStorage fallback.
 * - Strict tenant isolation & zero client-side token consumption.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  tasksApi,
  type ClientGenerationTask,
  type GenerationTaskType,
} from '../lib/api';

const STORAGE_KEY_DISMISSED = 'netmentor_dismissed_tasks_v1';
const STORAGE_KEY_WIDGET_EXPANDED = 'netmentor_widget_expanded_v1';
const STORAGE_KEY_RECENT_TASKS = 'netmentor_recent_tasks_v1';
const POLLING_INTERVAL_MS = 2500;

export interface OpenResultPayload {
  task: ClientGenerationTask;
}

export interface GenerationManagerContextType {
  // Task lists
  tasks: ClientGenerationTask[];
  activeTasks: ClientGenerationTask[];
  completedTasks: ClientGenerationTask[];
  failedTasks: ClientGenerationTask[];
  hasActiveTasks: boolean;
  unviewedCompletedCount: number;

  // Widget visibility state
  isWidgetExpanded: boolean;
  setIsWidgetExpanded: (expanded: boolean) => void;
  toggleWidgetExpanded: () => void;

  // Actions
  startGeneration: (
    taskType: GenerationTaskType,
    inputParams: Record<string, any>
  ) => Promise<ClientGenerationTask>;
  cancelTask: (taskId: string) => Promise<boolean>;
  dismissTask: (taskId: string) => void;
  dismissAllCompleted: () => void;
  retryTask: (taskId: string) => Promise<ClientGenerationTask | null>;
  openTaskResult: (taskId: string) => void;

  // Registration for modal result viewer
  registerResultViewer: (viewer: (payload: OpenResultPayload) => void) => () => void;
}

const GenerationManagerContext = createContext<GenerationManagerContextType | undefined>(undefined);

// Helper to safely load JSON from localStorage
function loadLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

// Helper to safely save JSON to localStorage
function saveLocalStorage(key: string, data: any): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

export const GenerationManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasksMap, setTasksMap] = useState<Map<string, ClientGenerationTask>>(() => {
    // Initialize from recent tasks cache for instant display on reload
    const cached = loadLocalStorage<ClientGenerationTask[]>(STORAGE_KEY_RECENT_TASKS, []);
    const initialMap = new Map<string, ClientGenerationTask>();
    for (const t of cached) {
      initialMap.set(t.id, t);
    }
    return initialMap;
  });

  const [dismissedTaskIds, setDismissedTaskIds] = useState<Set<string>>(() => {
    const list = loadLocalStorage<string[]>(STORAGE_KEY_DISMISSED, []);
    return new Set(list);
  });

  const [isWidgetExpanded, setIsWidgetExpandedState] = useState<boolean>(() => {
    return loadLocalStorage<boolean>(STORAGE_KEY_WIDGET_EXPANDED, false);
  });

  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  // Track viewer callbacks (e.g. from App.tsx)
  const resultViewerRef = useRef<((payload: OpenResultPayload) => void) | null>(null);

  // Concurrency lock for polling requests
  const isPollingRef = useRef<boolean>(false);
  const activePollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // BroadcastChannel for cross-tab synchronization
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  const setIsWidgetExpanded = useCallback((expanded: boolean) => {
    setIsWidgetExpandedState(expanded);
    saveLocalStorage(STORAGE_KEY_WIDGET_EXPANDED, expanded);
  }, []);

  const toggleWidgetExpanded = useCallback(() => {
    setIsWidgetExpandedState((prev) => {
      const next = !prev;
      saveLocalStorage(STORAGE_KEY_WIDGET_EXPANDED, next);
      return next;
    });
  }, []);

  // Save recent tasks cache whenever tasksMap changes
  useEffect(() => {
    const taskList = Array.from(tasksMap.values()).slice(-20); // Keep last 20 tasks
    saveLocalStorage(STORAGE_KEY_RECENT_TASKS, taskList);
  }, [tasksMap]);

  // Save dismissed tasks whenever dismissedTaskIds changes
  useEffect(() => {
    saveLocalStorage(STORAGE_KEY_DISMISSED, Array.from(dismissedTaskIds));
  }, [dismissedTaskIds]);

  // Setup BroadcastChannel for cross-tab synchronization
  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;

    try {
      const channel = new BroadcastChannel('netmentor_tasks_sync_v1');
      broadcastChannelRef.current = channel;

      channel.onmessage = (event) => {
        const { type, task, taskId } = event.data || {};
        if (type === 'TASK_UPSERT' && task) {
          setTasksMap((prev) => {
            const next = new Map(prev);
            next.set(task.id, task);
            return next;
          });
        } else if (type === 'TASK_DISMISS' && taskId) {
          setDismissedTaskIds((prev) => {
            const next = new Set(prev);
            next.add(taskId);
            return next;
          });
        }
      };

      return () => {
        channel.close();
        broadcastChannelRef.current = null;
      };
    } catch {}
  }, []);

  // Broadcast task update to other tabs
  const broadcastTaskUpsert = useCallback((task: ClientGenerationTask) => {
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({ type: 'TASK_UPSERT', task });
      } catch {}
    }
  }, []);

  const broadcastTaskDismiss = useCallback((taskId: string) => {
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({ type: 'TASK_DISMISS', taskId });
      } catch {}
    }
  }, []);

  // Online / Offline listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check backend for active tasks and sync with local state
  const refreshActiveTasks = useCallback(async () => {
    if (isPollingRef.current || !isOnline) return;
    isPollingRef.current = true;

    try {
      const res = await tasksApi.getActiveTasks();
      if (res.data?.success && Array.isArray(res.data.tasks)) {
        const backendActiveTasks = res.data.tasks;
        const activeIds = new Set(backendActiveTasks.map((t) => t.id));

        setTasksMap((prev) => {
          const next = new Map(prev);

          // 1. Update or add all currently active tasks from backend
          for (const serverTask of backendActiveTasks) {
            next.set(serverTask.id, {
              ...next.get(serverTask.id),
              ...serverTask,
            });
          }

          // 2. Identify any local tasks that WERE active, but are no longer in the active list.
          // These tasks finished (completed, failed, or cancelled) while we were polling!
          for (const [id, localTask] of prev.entries()) {
            if (
              (localTask.status === 'queued' || localTask.status === 'processing') &&
              !activeIds.has(id)
            ) {
              // Fetch single task to retrieve final resultData and status
              tasksApi.getTask(id).then((singleRes) => {
                if (singleRes.data?.success && singleRes.data.task) {
                  const finalTask = singleRes.data.task;
                  setTasksMap((current) => {
                    const updated = new Map(current);
                    updated.set(finalTask.id, finalTask);
                    return updated;
                  });
                  broadcastTaskUpsert(finalTask);
                }
              }).catch(() => {});
            }
          }

          return next;
        });
      }
    } catch (err) {
      console.warn('[Generation Manager] Active tasks fetch notice:', err);
    } finally {
      isPollingRef.current = false;
    }
  }, [isOnline, broadcastTaskUpsert]);

  // Initial recovery on mount: Fetch active tasks immediately
  useEffect(() => {
    refreshActiveTasks();
  }, [refreshActiveTasks]);

  // Determine active tasks from current state
  const allTasksList = useMemo(() => {
    return Array.from(tasksMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [tasksMap]);

  const activeTasks = useMemo(() => {
    return allTasksList.filter(
      (t) => t.status === 'queued' || t.status === 'processing'
    );
  }, [allTasksList]);

  const completedTasks = useMemo(() => {
    return allTasksList.filter(
      (t) => t.status === 'completed' && !dismissedTaskIds.has(t.id)
    );
  }, [allTasksList, dismissedTaskIds]);

  const failedTasks = useMemo(() => {
    return allTasksList.filter(
      (t) => t.status === 'failed' && !dismissedTaskIds.has(t.id)
    );
  }, [allTasksList, dismissedTaskIds]);

  const hasActiveTasks = activeTasks.length > 0;
  const unviewedCompletedCount = completedTasks.length;

  // Polling timer: Runs every POLLING_INTERVAL_MS whenever hasActiveTasks is true and online
  useEffect(() => {
    if (!hasActiveTasks || !isOnline) {
      if (activePollTimerRef.current) {
        clearInterval(activePollTimerRef.current);
        activePollTimerRef.current = null;
      }
      return;
    }

    activePollTimerRef.current = setInterval(() => {
      refreshActiveTasks();
    }, POLLING_INTERVAL_MS);

    return () => {
      if (activePollTimerRef.current) {
        clearInterval(activePollTimerRef.current);
        activePollTimerRef.current = null;
      }
    };
  }, [hasActiveTasks, isOnline, refreshActiveTasks]);

  // 1. Action: Start Generation Task
  const startGeneration = useCallback(
    async (
      taskType: GenerationTaskType,
      inputParams: Record<string, any>
    ): Promise<ClientGenerationTask> => {
      const res = await tasksApi.createTask(taskType, inputParams);
      if (!res.data?.success || !res.data.task) {
        throw new Error(res.message || 'Failed to initiate background generation task');
      }

      const newTask = res.data.task;

      setTasksMap((prev) => {
        const next = new Map(prev);
        next.set(newTask.id, newTask);
        return next;
      });

      // Automatically un-dismiss if previously dismissed
      setDismissedTaskIds((prev) => {
        if (!prev.has(newTask.id)) return prev;
        const next = new Set(prev);
        next.delete(newTask.id);
        return next;
      });

      broadcastTaskUpsert(newTask);

      // Force an immediate refresh check
      setTimeout(() => {
        refreshActiveTasks();
      }, 500);

      return newTask;
    },
    [broadcastTaskUpsert, refreshActiveTasks]
  );

  // 2. Action: Cancel Running Task
  const cancelTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      try {
        const res = await tasksApi.cancelTask(taskId);
        if (res.data?.success) {
          setTasksMap((prev) => {
            const next = new Map(prev);
            const existing = next.get(taskId);
            if (existing) {
              const updated: ClientGenerationTask = {
                ...existing,
                status: 'cancelled',
                completedAt: new Date().toISOString(),
              };
              next.set(taskId, updated);
              broadcastTaskUpsert(updated);
            }
            return next;
          });
          return true;
        }
        return false;
      } catch (err: any) {
        console.error('[Generation Manager] Cancel task error:', err);
        return false;
      }
    },
    [broadcastTaskUpsert]
  );

  // 3. Action: Dismiss Task from Floating Widget
  const dismissTask = useCallback(
    (taskId: string) => {
      setDismissedTaskIds((prev) => {
        const next = new Set(prev);
        next.add(taskId);
        return next;
      });
      broadcastTaskDismiss(taskId);
    },
    [broadcastTaskDismiss]
  );

  // 4. Action: Dismiss All Completed Tasks
  const dismissAllCompleted = useCallback(() => {
    setDismissedTaskIds((prev) => {
      const next = new Set(prev);
      for (const t of completedTasks) {
        next.add(t.id);
        broadcastTaskDismiss(t.id);
      }
      return next;
    });
  }, [completedTasks, broadcastTaskDismiss]);

  // 5. Action: Retry Failed Task
  const retryTask = useCallback(
    async (taskId: string): Promise<ClientGenerationTask | null> => {
      const failedTask = tasksMap.get(taskId);
      if (!failedTask) return null;

      let params = failedTask.inputParams;
      if (!params && failedTask.inputParamsJson) {
        try {
          params = JSON.parse(failedTask.inputParamsJson);
        } catch {}
      }

      if (!params) {
        console.error('[Generation Manager] Cannot retry task without input params');
        return null;
      }

      // Dismiss the failed task from active view
      dismissTask(taskId);

      // Re-trigger generation with original configuration
      return startGeneration(failedTask.taskType, params);
    },
    [tasksMap, dismissTask, startGeneration]
  );

  // 6. Action: Open/View Completed Task Result
  const openTaskResult = useCallback(
    (taskId: string) => {
      const task = tasksMap.get(taskId);
      if (!task) return;

      if (resultViewerRef.current) {
        resultViewerRef.current({ task });
      }
    },
    [tasksMap]
  );

  // 7. Register result viewer callback
  const registerResultViewer = useCallback((viewer: (payload: OpenResultPayload) => void) => {
    resultViewerRef.current = viewer;
    return () => {
      if (resultViewerRef.current === viewer) {
        resultViewerRef.current = null;
      }
    };
  }, []);

  const contextValue = useMemo<GenerationManagerContextType>(() => {
    return {
      tasks: allTasksList,
      activeTasks,
      completedTasks,
      failedTasks,
      hasActiveTasks,
      unviewedCompletedCount,
      isWidgetExpanded,
      setIsWidgetExpanded,
      toggleWidgetExpanded,
      startGeneration,
      cancelTask,
      dismissTask,
      dismissAllCompleted,
      retryTask,
      openTaskResult,
      registerResultViewer,
    };
  }, [
    allTasksList,
    activeTasks,
    completedTasks,
    failedTasks,
    hasActiveTasks,
    unviewedCompletedCount,
    isWidgetExpanded,
    setIsWidgetExpanded,
    toggleWidgetExpanded,
    startGeneration,
    cancelTask,
    dismissTask,
    dismissAllCompleted,
    retryTask,
    openTaskResult,
    registerResultViewer,
  ]);

  return (
    <GenerationManagerContext.Provider value={contextValue}>
      {children}
    </GenerationManagerContext.Provider>
  );
};

export function useGenerationManager(): GenerationManagerContextType {
  const context = useContext(GenerationManagerContext);
  if (!context) {
    throw new Error('useGenerationManager must be used within a GenerationManagerProvider');
  }
  return context;
}
