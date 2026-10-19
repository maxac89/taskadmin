// storage.js — the only module that touches localStorage.
// Layout: localStorage["tasks"] = JSON.stringify(Task[])
// Reads/writes go through these functions; mutations save the full array atomically.

import {
  createTask,
  validateTask,
  applyStatusEffects,
  NotFoundError,
  ValidationError,
} from "./model.js";

const KEY = "tasks";

/** True when localStorage is usable in this browser/context. */
export function storageAvailable() {
  try {
    const probe = "__probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** Read every task (stored order: newest first). Never throws; returns [] on bad data. */
export function loadTasks() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Could not read tasks from localStorage:", err);
    return [];
  }
}

/** Persist the full array in one write. Throws a friendly error on quota overflow. */
export function saveTasks(tasks) {
  try {
    localStorage.setItem(KEY, JSON.stringify(tasks));
  } catch (err) {
    if (err && (err.name === "QuotaExceededError" || err.code === 22)) {
      throw new Error("Storage is full — the task could not be saved.");
    }
    throw err;
  }
}

/** Create and persist a task. Throws ValidationError when invalid. */
export function addTask(data) {
  const task = createTask(data);
  const tasks = loadTasks();
  tasks.unshift(task); // newest first
  saveTasks(tasks);
  return task;
}

/** Look up one task by id; returns null when not found. */
export function getTask(id) {
  return loadTasks().find((t) => t.id === id) ?? null;
}

/**
 * Update a task by id with a partial change set.
 * Validates the merged result; on failure nothing is written and
 * the original values remain intact. Throws NotFoundError / ValidationError.
 */
export function updateTask(id, changes) {
  const tasks = loadTasks();
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) throw new NotFoundError();

  const merged = { ...tasks[index], ...changes, id: tasks[index].id, createdAt: tasks[index].createdAt };
  const errors = validateTask(merged);
  if (Object.keys(errors).length > 0) throw new ValidationError(errors);

  merged.updatedAt = new Date().toISOString();
  applyStatusEffects(merged);
  tasks[index] = merged;
  saveTasks(tasks);
  return merged;
}

/** Delete a task by id. Returns true when removed, false when the id didn't exist. */
export function deleteTask(id) {
  const tasks = loadTasks();
  const next = tasks.filter((t) => t.id !== id);
  if (next.length === tasks.length) return false;
  saveTasks(next);
  return true;
}

/** Wipe all stored tasks (demo/reset helper). */
export function clearAllTasks() {
  try {
    localStorage.removeItem(KEY);
  } catch (err) {
    console.warn("Could not clear tasks:", err);
  }
}
