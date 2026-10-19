// app.js — entry point: state, hash routing, event wiring.

import * as views from "./views.js";
import { validateTask } from "./model.js";
import {
  loadTasks,
  addTask,
  getTask,
  updateTask,
  deleteTask,
  storageAvailable,
} from "./storage.js";

const state = {
  filter: "All",
  editingId: null, // null = create mode
};

// ---------- Storage readiness ----------

if (!storageAvailable()) {
  window.addEventListener("DOMContentLoaded", () =>
    views.showToast("Storage is unavailable — changes will not be saved.")
  );
}

// ---------- Views / routing ----------

function showList() {
  state.editingId = null;
  views.renderList(loadTasks(), state.filter);
  views.showView("list");
}

function showDetail(id) {
  const task = getTask(id);
  if (!task) return views.showNotFound();
  views.renderDetail(task);
  views.showView("detail");
}

function showForm(id = null) {
  const task = id ? getTask(id) : null;
  if (id && !task) return views.showNotFound();
  state.editingId = id;
  views.showForm(task);
  views.showView("form");
  document.getElementById("title").focus();
}

function route() {
  const hash = location.hash || "#/";

  let m = hash.match(/^#\/tasks\/([^/]+)\/edit$/);
  if (m) return showForm(m[1]);

  m = hash.match(/^#\/tasks\/([^/]+)$/);
  if (m) return showDetail(m[1]);

  if (hash === "#/new") return showForm(null);

  // Default: the task list ("My Tasks" dashboard).
  showList();
}

// ---------- Form submit (create / update) ----------

document.getElementById("task-form").addEventListener("submit", (event) => {
  event.preventDefault();

  const data = views.getFormData();
  // Client-side pre-validation for instant feedback; storage re-validates authoritatively.
  const errors = validateTask(data, { isNew: !state.editingId });
  if (Object.keys(errors).length > 0) {
    views.showFormErrors(errors);
    return;
  }

  try {
    if (state.editingId) {
      updateTask(state.editingId, data);
      views.showToast("Task updated successfully");
    } else {
      addTask(data);
      views.showToast("Task created successfully");
    }
    navigateHome();
  } catch (err) {
    if (err.name === "NotFoundError") {
      views.showNotFound();
      return;
    }
    if (err.name === "ValidationError") {
      views.showFormErrors(err.fields);
      return;
    }
    views.showToast(err.message || "Something went wrong");
  }
});

// ---------- Navigation helpers ----------

function navigateHome() {
  if (location.hash && location.hash !== "#/") {
    location.hash = "#/"; // triggers route() via hashchange
  } else {
    showList();
  }
}

document.getElementById("new-task-btn").addEventListener("click", () => {
  location.hash = "#/new";
});

document.getElementById("detail-back-btn").addEventListener("click", navigateHome);

document.getElementById("detail-edit-btn").addEventListener("click", (event) => {
  location.hash = `#/tasks/${event.currentTarget.dataset.id}/edit`;
});

document.getElementById("detail-delete-btn").addEventListener("click", async (event) => {
  const id = event.currentTarget.dataset.id;
  const task = getTask(id);
  if (!task) return views.showNotFound();

  const confirmed = await views.confirmDelete(task.title);
  if (!confirmed) return; // Cancel: nothing is called or changed.

  if (deleteTask(id)) {
    views.showToast("Task deleted successfully");
    navigateHome();
  } else {
    views.showToast("Task not found");
  }
});

document.getElementById("form-cancel-btn").addEventListener("click", () => {
  if (state.editingId) {
    location.hash = `#/tasks/${state.editingId}`;
  } else {
    navigateHome();
  }
});

// ---------- Filter ----------

document.getElementById("status-filter").addEventListener("change", (event) => {
  state.filter = event.target.value;
  views.renderList(loadTasks(), state.filter);
});

// ---------- Boot ----------

window.addEventListener("hashchange", route);
route();
