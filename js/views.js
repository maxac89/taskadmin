// views.js — DOM rendering for list, detail, form, messages, modal, toast.

import { filterByStatus } from "./model.js";

const $ = (id) => document.getElementById(id);

const VIEWS = ["list-view", "detail-view", "form-view", "notfound-view"];

let toastTimer = null;

/** Show one view section and hide the others. */
export function showView(name) {
  const target = `${name}-view`;
  for (const id of VIEWS) $(id).hidden = id !== target;
}

/** Format an ISO timestamp for display. */
function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function badgeClass(label) {
  return "badge " + label.toLowerCase().replace(/\s+/g, "-");
}

// ---------- List ----------

export function renderList(tasks, statusFilter) {
  const list = $("task-list");
  list.textContent = "";

  const visible = filterByStatus(tasks, statusFilter);
  for (const task of visible) {
    const li = document.createElement("li");
    li.className = "task-item";

    const link = document.createElement("a");
    link.href = `#/tasks/${task.id}`;
    link.className = "task-title";
    link.textContent = task.title;

    const badges = document.createElement("div");
    badges.className = "badges";

    const status = document.createElement("span");
    status.className = badgeClass(task.status);
    status.textContent = task.status;

    const priority = document.createElement("span");
    priority.className = badgeClass(task.priority);
    priority.textContent = task.priority;

    badges.append(status, priority);
    if (task.dueDate) {
      const due = document.createElement("span");
      due.className = "due";
      due.textContent = `Due ${task.dueDate}`;
      badges.append(due);
    }

    li.append(link, badges);
    list.append(li);
  }

  $("empty-state").hidden = !(tasks.length === 0);
  $("empty-filter").hidden = !(tasks.length > 0 && visible.length === 0);
}

// ---------- Detail ----------

export function renderDetail(task) {
  $("detail-title").textContent = task.title;
  $("detail-description").textContent = task.description || "No description";

  const status = $("detail-status");
  status.className = badgeClass(task.status);
  status.textContent = task.status;

  const priority = $("detail-priority");
  priority.className = badgeClass(task.priority);
  priority.textContent = task.priority;

  $("detail-due").textContent = task.dueDate || "—";

  const completedRow = $("detail-completed-row");
  completedRow.hidden = !task.completedAt;
  if (task.completedAt) $("detail-completed").textContent = fmtDateTime(task.completedAt);

  $("detail-edit-btn").dataset.id = task.id;
  $("detail-delete-btn").dataset.id = task.id;
}

// ---------- Form ----------

export function showForm(task) {
  $("form-heading").textContent = task ? "Edit Task" : "New Task";
  $("title").value = task ? task.title : "";
  $("description").value = task ? task.description : "";
  $("status").value = task ? task.status : "To Do";
  $("priority").value = task ? task.priority : "Medium";
  $("dueDate").value = task ? task.dueDate : "";
  clearFormErrors();
}

export function getFormData() {
  return {
    title: $("title").value,
    description: $("description").value,
    status: $("status").value,
    priority: $("priority").value,
    dueDate: $("dueDate").value,
  };
}

export function clearFormErrors() {
  $("form-alert").hidden = true;
  $("form-alert").textContent = "";
  for (const field of ["title", "description", "status", "priority", "dueDate"]) {
    const err = $(`${field}-error`);
    err.hidden = true;
    err.textContent = "";
    $(field).removeAttribute("aria-invalid");
    $(field).removeAttribute("aria-describedby");
  }
}

/** Display validation errors inline; keeps all entered values in the form. */
export function showFormErrors(fields) {
  clearFormErrors();
  const first = Object.values(fields)[0];
  $("form-alert").textContent = first;
  $("form-alert").hidden = false;
  for (const [field, message] of Object.entries(fields)) {
    const input = $(field);
    const err = $(`${field}-error`);
    if (!input || !err) continue;
    err.textContent = message;
    err.hidden = false;
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", `${field}-error`);
  }
}

// ---------- Not found ----------

export function showNotFound() {
  showView("notfound");
}

// ---------- Toast ----------

export function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.hidden = false;
  // Force a reflow so the transition runs on repeat shows.
  void toast.offsetWidth;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.hidden = true;
    }, 300);
  }, 3000);
}

// ---------- Delete confirmation ----------

/**
 * Open the confirmation modal.
 * Resolves true on Confirm, false on Cancel / Escape / backdrop click.
 */
export function confirmDelete(taskTitle) {
  return new Promise((resolve) => {
    const dialog = $("delete-dialog");
    $("delete-dialog-task").textContent = taskTitle || "";
    dialog.returnValue = "cancel";
    dialog.addEventListener(
      "close",
      () => resolve(dialog.returnValue === "confirm"),
      { once: true }
    );
    dialog.showModal();
  });
}
