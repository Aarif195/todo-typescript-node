import { IncomingMessage, ServerResponse } from "http";
import fs from "fs";
import path from "path";
import { Todo } from "../types/todo";
import { authenticate } from "./authController";

const file = path.join(__dirname, "../../tasks.json");

// Allowed values for tasks
const allowedPriorities = ["low", "medium", "high"];
const allowedStatuses = ["pending", "in-progress", "completed"];
const allowedLabels = ["work", "personal", "urgent", "misc"];

// Helper to send errors
function sendError(res: ServerResponse, message: string): void {
  res.writeHead(400, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: message }));
}

// CREATE TASK
export const createTask = (req: IncomingMessage, res: ServerResponse): void => {
  const user = authenticate(req);
  if (!user) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Unauthorized" }));
    return;
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });

  req.on("end", () => {
    const {
      title,
      description,
      priority,
      status,
      labels,
      completed,
    }: Partial<Todo> = JSON.parse(body);

    //  VALIDATIONS
    if (!title?.trim()) return sendError(res, "Title is required.");
    if (!description?.trim()) return sendError(res, "Description is required.");

    if (!priority?.trim()) return sendError(res, "Priority is required.");
    if (!allowedPriorities.includes(priority))
      return sendError(res, "Invalid priority provided.");

    if (!status?.trim()) return sendError(res, "Status is required.");
    if (!allowedStatuses.includes(status))
      return sendError(res, "Invalid status provided.");

    if (!labels || !Array.isArray(labels) || labels.length === 0)
      return sendError(res, "At least one label is required.");

    if (!labels.every((label) => allowedLabels.includes(label)))
      return sendError(res, "Invalid label(s) provided.");

    if (typeof completed !== "boolean") {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Completed must be boolean" }));
    }

    const tasks: Todo[] = JSON.parse(fs.readFileSync(file, "utf8"));

    const newTask: Todo = {
      id: tasks.length ? tasks[tasks.length - 1].id + 1 : 1,
      title: title.trim(),
      description: description.trim(),
      priority,
      status,
      labels,
      completed,
      userId: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    tasks.push(newTask);
    fs.writeFileSync(file, JSON.stringify(tasks, null, 2));

    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ message: "Task created successfully", task: newTask })
    );
  });
};

// GET TASKS
export function getTasks(req: IncomingMessage, res: ServerResponse): void {
  fs.readFile(file, "utf8", (err, data) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Internal server error" }));
    }

    let tasks: Todo[] = [];
    try {
      tasks = JSON.parse(data);
      if (!Array.isArray(tasks)) tasks = [];
    } catch {
      tasks = [];
    }

    // Sort newest first
    tasks.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const fullUrl = new URL(req.url || "", `http://${req.headers.host}`);
    const queryParams = Object.fromEntries(fullUrl.searchParams.entries());

    const page = Math.max(1, parseInt(queryParams.page || "1"));
    const limit = Math.max(1, parseInt(queryParams.limit || "10"));

    // --- Validate filters ---
    for (const key in queryParams) {
      const value = queryParams[key].toLowerCase();

      if (
        !["page", "limit", "status", "priority", "labels", "search"].includes(
          key
        )
      ) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: `Invalid query key: ${key}` }));
      }

      if (key === "status" && !allowedStatuses.includes(value)) {
        return res.end(
          JSON.stringify({
            totalData: 0,
            totalPages: 0,
            currentPage: page,
            limit,
            data: [],
          })
        );
      }

      if (key === "priority" && !allowedPriorities.includes(value)) {
        return res.end(
          JSON.stringify({
            totalData: 0,
            totalPages: 0,
            currentPage: page,
            limit,
            data: [],
          })
        );
      }

      if (key === "labels" && !allowedLabels.includes(value)) {
        return res.end(
          JSON.stringify({
            totalData: 0,
            totalPages: 0,
            currentPage: page,
            limit,
            data: [],
          })
        );
      }
    }

    // --- Apply filtering ---
    let filteredTasks = [...tasks];
    for (const key in queryParams) {
      const value = queryParams[key].toLowerCase();

      if (key === "search") {
        filteredTasks = filteredTasks.filter(
          (task) =>
            task.title.toLowerCase().includes(value) ||
            task.description.toLowerCase().includes(value) ||
            (Array.isArray(task.labels) &&
              task.labels.some((label) => label.toLowerCase().includes(value)))
        );
      } else if (key === "labels") {
        filteredTasks = filteredTasks.filter(
          (task) =>
            Array.isArray(task.labels) &&
            task.labels.map((label) => label.toLowerCase()).includes(value)
        );
      } else if (key === "status" || key === "priority") {
        filteredTasks = filteredTasks.filter(
          (task) => task[key] && task[key].toLowerCase() === value
        );
      }
    }

    // --- Pagination ---
    const totalData = filteredTasks.length;
    const totalPages = totalData === 0 ? 0 : Math.ceil(totalData / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const dataSlice =
      startIndex < totalData ? filteredTasks.slice(startIndex, endIndex) : [];

    const response = {
      totalData,
      totalPages,
      currentPage: page,
      limit,
      data: dataSlice,
    };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(response));
  });
}

// Mark task as completed or incomplete
export function toggleTaskCompletion(
  req: IncomingMessage,
  res: ServerResponse
): void {
  const user = authenticate(req);
  if (!user) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Unauthorized" }));
    return;
  }

  const urlParts = req.url?.split("/") || [];
  const taskIdStr = urlParts[urlParts.length - 2];
  const action = urlParts[urlParts.length - 1];
  const taskId = parseInt(taskIdStr);

  if (isNaN(taskId)) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Invalid task ID" }));
    return;
  }

  const tasks: Todo[] = JSON.parse(fs.readFileSync(file, "utf8"));
  const task = tasks.find((t) => t.id === taskId && t.userId === user.id);

  if (!task) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Task not found" }));
    return;
  }

  if (action === "complete") task.completed = true;
  else if (action === "incomplete") task.completed = false;
  else {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Invalid action" }));
    return;
  }

  task.updatedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(tasks, null, 2));

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ message: `Task marked as ${action}`, task }));
}

//  get Task By by ID
export function getTaskById(req: IncomingMessage, res: ServerResponse): void {
  const urlParts = req.url?.split("/") || [];
  const idStr = urlParts[urlParts.length - 1];
  const id = parseInt(idStr);

  const data = fs.readFileSync(file, "utf8");
  let tasks: Todo[] = [];
  try {
    tasks = JSON.parse(data);
    if (!Array.isArray(tasks)) tasks = [];
  } catch {
    tasks = [];
  }

  const task = tasks.find((t) => t.id === id);

  if (!task) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Task not found" }));
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(task));
}

// UPDATED
export function updateTask(req: IncomingMessage, res: ServerResponse): void {
  const user = authenticate(req);

  if (!user) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Unauthorized" }));
    return;
  }

  const urlParts = req.url?.split("/") || [];
  const taskId = parseInt(urlParts[urlParts.length - 1]);
  let body = "";

  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", () => {
    let updatedData: Partial<
      Pick<Todo, "title" | "description" | "status" | "priority" | "labels">
    >;

    try {
      updatedData = JSON.parse(body);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Invalid JSON" }));
    }

    const data = fs.readFileSync(file, "utf8");
    const tasks: Todo[] = JSON.parse(data);

    const index = tasks.findIndex((t) => t.id === taskId);
    if (index === -1) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Task not found" }));
    }

    if (tasks[index].userId !== user.id) {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          message: "Forbidden: You can only update your own tasks",
        })
      );
    }

    //  VALIDATIONS
    const { title, description, status, priority, labels } = updatedData;

    if (title !== undefined && title.trim() === "") {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Title cannot be empty" }));
    }

    if (description !== undefined && description.trim() === "") {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({ message: "Description cannot be empty" })
      );
    }

    if (status && !allowedStatuses.includes(status.toLowerCase())) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          message: `Invalid status. Allowed: ${allowedStatuses.join(", ")}`,
        })
      );
    }

    if (priority !== undefined && priority.trim() === "") {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Priority cannot be empty" }));
    }
    if (status !== undefined && status.trim() === "") {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Status cannot be empty" }));
    }
    if (Array.isArray(labels) && labels.length === 0) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Labels cannot be empty" }));
    }

    if (priority && !allowedPriorities.includes(priority.toLowerCase())) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          message: `Invalid priority. Allowed: ${allowedPriorities.join(", ")}`,
        })
      );
    }

    if (labels && Array.isArray(labels)) {
      const invalidLabels = labels.filter(
        (label) => !allowedLabels.includes(label.toLowerCase())
      );
      if (invalidLabels.length > 0) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            message: `Invalid labels: ${invalidLabels.join(
              ", "
            )}. Allowed: ${allowedLabels.join(", ")}`,
          })
        );
      }
    }

    // RETURNING UPDATE TASK 
    const taskToUpdate = tasks[index];

    const updatedTask: Todo = {
      ...taskToUpdate,
      title: title !== undefined ? title.trim() : taskToUpdate.title,
      description:
        description !== undefined
          ? description.trim()
          : taskToUpdate.description,
      status: status
        ? (status.toLowerCase() as Todo["status"])
        : taskToUpdate.status,
      priority: priority
        ? (priority.toLowerCase() as Todo["priority"])
        : taskToUpdate.priority,
      labels: labels ? labels.map((l) => l.toLowerCase()) : taskToUpdate.labels,
      updatedAt: new Date().toISOString(),
    };

    tasks[index] = updatedTask;
    fs.writeFileSync(file, JSON.stringify(tasks, null, 2));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ message: "Task updated successfully", updatedTask })
    );
  });
}
