import { IncomingMessage, ServerResponse } from "http";
import { getDb } from "../db/mongo";
import { ObjectId } from "mongodb";
import { authenticate } from "./authMongoController";
import { Todo, Reply, Comment } from "../types/todoMongo";
// const db = getDb();
// const tasksCollection = db.collection("tasks");

// Allowed values for tasks
const allowedPriorities = ["low", "medium", "high"];
const allowedStatuses = ["pending", "in-progress", "completed"];
const allowedLabels = ["work", "personal", "urgent", "misc"];

// Helper to send errors
export function sendError(res: ServerResponse, message: string): void {
  res.writeHead(400, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: message }));
}

interface User {
  _id?: ObjectId;
  username: string;
  email: string;
  password: string;
}


export function getTasksCollection() {
  return getDb().collection("tasks");
}

// CREATE TASK
export const createTask = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  try {
    const user = await authenticate(req);
    if (!user) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Unauthorized" }));
      return;
    }

    let body = "";
    req.on("data", (chunk) => { body += chunk.toString(); });

    req.on("end", async () => {
      const { title, description, priority, status, labels, completed }: Partial<Todo> = JSON.parse(body);

      // VALIDATIONS
      if (!title?.trim()) return sendError(res, "Title is required.");
      if (!description?.trim()) return sendError(res, "Description is required.");
      if (!priority?.trim()) return sendError(res, "Priority is required.");
      if (!allowedPriorities.includes(priority)) return sendError(res, "Invalid priority provided.");
      if (!status?.trim()) return sendError(res, "Status is required.");
      if (!allowedStatuses.includes(status)) return sendError(res, "Invalid status provided.");
      if (!labels || !Array.isArray(labels) || labels.length === 0) return sendError(res, "At least one label is required.");
      if (!labels.every((label) => allowedLabels.includes(label))) return sendError(res, "Invalid label(s) provided.");
      if (typeof completed !== "boolean") return sendError(res, "Completed must be boolean");

      const tasksCol = getTasksCollection(); // MongoDB collection

      const newTask: Todo = {
        title: title.trim(),
        description: description.trim(),
        priority,
        status,
        labels,
        completed,
        userId: user._id, // MongoDB user id
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await tasksCol.insertOne(newTask);

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Task created successfully", task: { ...newTask, _id: result.insertedId } }));
    });

  } catch (err) {
    console.error(err);
    sendError(res, "Server error");
  }
};

  // GET TASKS
export const getTasks = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  try {
    const tasksCol = getTasksCollection(); // MongoDB collection for Todo

    // Fetch all tasks
    const tasksArray = await tasksCol.find({}).toArray() as Todo[];

    // Sort newest first
    tasksArray.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Parse query parameters for filtering & pagination
    const fullUrl = new URL(req.url || "", `http://${req.headers.host}`);
    const queryParams = Object.fromEntries(fullUrl.searchParams.entries());

    const page = Math.max(1, parseInt(queryParams.page || "1"));
    const limit = Math.max(1, parseInt(queryParams.limit || "10"));

    // Apply filters
    let filteredTasks = [...tasksArray];
    for (const key in queryParams) {
      const value = queryParams[key].toLowerCase();

      if (key === "search") {
        filteredTasks = filteredTasks.filter(
          task =>
            task.title.toLowerCase().includes(value) ||
            task.description.toLowerCase().includes(value) ||
            (Array.isArray(task.labels) &&
              task.labels.some(label => label.toLowerCase().includes(value)))
        );
      } else if (key === "labels") {
        filteredTasks = filteredTasks.filter(
          task =>
            Array.isArray(task.labels) &&
            task.labels.map(label => label.toLowerCase()).includes(value)
        );
      } else if (key === "status" && allowedStatuses.includes(value)) {
        filteredTasks = filteredTasks.filter(task => task.status === value);
      } else if (key === "priority" && allowedPriorities.includes(value)) {
        filteredTasks = filteredTasks.filter(task => task.priority === value);
      } else if (key === "completed") {
        const isCompleted = value === "true";
        filteredTasks = filteredTasks.filter(task => task.completed === isCompleted);
      }
    }

    // Pagination
    const totalData = filteredTasks.length;
    const totalPages = totalData === 0 ? 0 : Math.ceil(totalData / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const dataSlice = filteredTasks.slice(startIndex, endIndex);

    // Send response
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        totalData,
        totalPages,
        currentPage: page,
        limit,
        data: dataSlice,
      })
    );
  } catch (err) {
    console.error(err);
    sendError(res, "Server error");
  }
};

