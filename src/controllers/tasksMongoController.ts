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
export const createTask = async (
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> => {
  try {
    const user = await authenticate(req);
    if (!user) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Unauthorized" }));
      return;
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      const {
        title,
        description,
        priority,
        status,
        labels,
        completed,
      }: Partial<Todo> = JSON.parse(body);

      // VALIDATIONS
      if (!title?.trim()) return sendError(res, "Title is required.");
      if (!description?.trim())
        return sendError(res, "Description is required.");
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
      if (typeof completed !== "boolean")
        return sendError(res, "Completed must be boolean");

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
      res.end(
        JSON.stringify({
          message: "Task created successfully",
          task: { ...newTask, _id: result.insertedId },
        })
      );
    });
  } catch (err) {
    console.error(err);
    sendError(res, "Server error");
  }
};

// GET TASKS
export const getTasks = async (
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> => {
  try {
    const tasksCol = getTasksCollection(); // MongoDB collection for Todo

    // Fetch all tasks
    const tasksArray = (await tasksCol.find({}).toArray()) as Todo[];

    // Sort newest first
    tasksArray.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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
      } else if (key === "status" && allowedStatuses.includes(value)) {
        filteredTasks = filteredTasks.filter((task) => task.status === value);
      } else if (key === "priority" && allowedPriorities.includes(value)) {
        filteredTasks = filteredTasks.filter((task) => task.priority === value);
      } else if (key === "completed") {
        const isCompleted = value === "true";
        filteredTasks = filteredTasks.filter(
          (task) => task.completed === isCompleted
        );
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

// GET TASK BY ID
export const getTaskById = async (
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> => {
  try {
    const urlParts = req.url?.split("/") || [];
    const idStr = urlParts[urlParts.length - 1];

    if (!ObjectId.isValid(idStr)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Invalid ID" }));
    }

    const tasksCol = getTasksCollection();
    const task = await tasksCol.findOne({ _id: new ObjectId(idStr) });

    if (!task) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Task not found" }));
      
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(task));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Server error" }));
  }
};

export async function updateTask(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const user = await authenticate(req);
    if (!user) {
      res.writeHead(401, { "Content-Type": "application/json" });
       res.end(JSON.stringify({ message: "Unauthorized" }));
       return
    }

    const urlParts = req.url?.split("/") || [];
    const taskId = urlParts[urlParts.length - 1]; // Mongo _id as string

    let body = "";
    req.on("data", chunk => { body += chunk.toString(); });

    req.on("end", async () => {
      let updatedData: Partial<Pick<Todo, "title" | "description" | "status" | "priority" | "labels">>;
      try {
        updatedData = JSON.parse(body);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ message: "Invalid JSON" }));
      }

      const tasksCol = getTasksCollection();
      const task = await tasksCol.findOne({ _id: new ObjectId(taskId) });

      if (!task) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ message: "Task not found" }));
      }

      if (!task.userId.equals(user._id)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ message: "Forbidden: You can only update your own tasks" }));
      }

      // VALIDATIONS
      const { title, description, status, priority, labels } = updatedData;
      if (title !== undefined && title.trim() === "") return sendError(res, "Title cannot be empty");
      if (description !== undefined && description.trim() === "") return sendError(res, "Description cannot be empty");
      if (status && !allowedStatuses.includes(status.toLowerCase())) return sendError(res, "Invalid status");
      if (priority && !allowedPriorities.includes(priority.toLowerCase())) return sendError(res, "Invalid priority");
      if (labels && (!Array.isArray(labels) || labels.some(l => !allowedLabels.includes(l.toLowerCase()))))
        return sendError(res, "Invalid labels");

      const updatePayload: Partial<Todo> = {
        title: title !== undefined ? title.trim() : task.title,
        description: description !== undefined ? description.trim() : task.description,
        status: status ? (status.toLowerCase() as Todo["status"]) : task.status,
        priority: priority ? (priority.toLowerCase() as Todo["priority"]) : task.priority,
        labels: labels ? labels.map(l => l.toLowerCase()) : task.labels,
        updatedAt: new Date().toISOString(),
      };

      await tasksCol.updateOne({ _id: new ObjectId(taskId) }, { $set: updatePayload });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Task updated successfully", updatedTask: { ...task, ...updatePayload } }));
    });

  } catch (err) {
    console.error(err);
    sendError(res, "Server error");
  }
}
