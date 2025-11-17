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

// TOGGLE TASK COMPLETION
export async function toggleTaskCompletion(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const user = await authenticate(req);
    if (!user) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Unauthorized" }));
    }

    const urlParts = req.url?.split("/") || [];

    const taskIdStr = urlParts[urlParts.length - 2];
    const action = urlParts[urlParts.length - 1];

    if (!ObjectId.isValid(taskIdStr)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Invalid task ID" }));
    }

    if (action !== "complete" && action !== "incomplete") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Invalid action" }));
    }

    const taskId = new ObjectId(taskIdStr);
    const tasksCol = getTasksCollection();

    const task = await tasksCol.findOne({ _id: taskId });
    if (!task) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Task not found" }));
      return;
    }

    const taskUserId =
      task.userId && task.userId._bsontype === "ObjectID"
        ? task.userId
        : new ObjectId(task.userId);

    if (!taskUserId.equals(user!._id)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message: "Forbidden: You can only modify your own tasks",
        })
      );
      return;
    }

    const newCompleted = action === "complete";
    await tasksCol.updateOne(
      { _id: taskId },
      { $set: { completed: newCompleted, updatedAt: new Date().toISOString() } }
    );

    // return updated task object (merge original task with changes)
    const updatedTask = {
      ...task,
      completed: newCompleted,
      updatedAt: new Date().toISOString(),
    };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: `Task marked as ${action}`,
        task: updatedTask,
      })
    );
  } catch (err) {
    console.error(err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Server error" }));
  }
}

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

// UPDATED
export async function updateTask(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const user = await authenticate(req);
    if (!user) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Unauthorized" }));
      return;
    }

    const urlParts = req.url?.split("/") || [];
    const taskId = urlParts[urlParts.length - 1];

    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      let updatedData: Partial<
        Pick<Todo, "title" | "description" | "status" | "priority" | "labels">
      >;
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
        return res.end(
          JSON.stringify({
            message: "Forbidden: You can only update your own tasks",
          })
        );
      }

      // VALIDATIONS
      const { title, description, status, priority, labels } = updatedData;
      if (title !== undefined && title.trim() === "")
        return sendError(res, "Title cannot be empty");
      if (description !== undefined && description.trim() === "")
        return sendError(res, "Description cannot be empty");
      if (status && !allowedStatuses.includes(status.toLowerCase()))
        return sendError(res, "Invalid status");
      if (priority && !allowedPriorities.includes(priority.toLowerCase()))
        return sendError(res, "Invalid priority");
      if (
        labels &&
        (!Array.isArray(labels) ||
          labels.some((l) => !allowedLabels.includes(l.toLowerCase())))
      )
        return sendError(res, "Invalid labels");

      const updatePayload: Partial<Todo> = {
        title: title !== undefined ? title.trim() : task.title,
        description:
          description !== undefined ? description.trim() : task.description,
        status: status ? (status.toLowerCase() as Todo["status"]) : task.status,
        priority: priority
          ? (priority.toLowerCase() as Todo["priority"])
          : task.priority,
        labels: labels ? labels.map((l) => l.toLowerCase()) : task.labels,
        updatedAt: new Date().toISOString(),
      };

      await tasksCol.updateOne(
        { _id: new ObjectId(taskId) },
        { $set: updatePayload }
      );

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message: "Task updated successfully",
          updatedTask: { ...task, ...updatePayload },
        })
      );
    });
  } catch (err) {
    console.error(err);
    sendError(res, "Server error");
  }
}

// DELETE TASK
export const deleteTask = async (
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

    const urlParts = req.url?.split("/") || [];
    const taskIdStr = urlParts[urlParts.length - 1];

    // Convert string ID to ObjectId
    const { ObjectId } = await import("mongodb");
    if (!ObjectId.isValid(taskIdStr)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Invalid task ID" }));
      return;
    }
    const taskId = new ObjectId(taskIdStr);

    const tasksCol = getTasksCollection();

    // Find the task
    const task = await tasksCol.findOne({ _id: taskId });
    if (!task) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Task not found" }));
      return;
    }

    // Check ownership
    if (!task.userId.equals(user._id)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message: "Forbidden: You can only delete your own tasks",
        })
      );
      return;
    }

    // Delete task
    const result = await tasksCol.deleteOne({ _id: taskId });

    res.writeHead(204, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: "Task deleted successfully",
        deletedCount: result.deletedCount,
      })
    );
  } catch (err) {
    console.error(err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Server error" }));
  }
};

// LIKE TASK
export const likeTask = async (
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

    const urlParts = req.url?.split("/") || [];
    const taskIdStr = urlParts[urlParts.length - 2]; // assuming /tasks/:id/like
    if (!ObjectId.isValid(taskIdStr)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Invalid task ID" }));

      return;
    }
    const taskId = new ObjectId(taskIdStr);

    const tasksCol = getTasksCollection();
    const task = await tasksCol.findOne({ _id: taskId });

    if (!task) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Task not found" }));
      return;
    }

    // Toggle like
    let message = "";
    let liked = false;
    const likedBy = Array.isArray(task.likedBy) ? task.likedBy : [];

    let newLikedBy: ObjectId[];

    if (likedBy.some((id: ObjectId) => id.equals(user._id))) {
      // User already liked → unlike
      newLikedBy = likedBy.filter((id: ObjectId) => !id.equals(user._id));
      message = "Task unliked!";
      liked = false;
    } else {
      // Like
      newLikedBy = [...likedBy, user._id];
      message = "Task liked!";
      liked = true;
    }

    await tasksCol.updateOne(
      { _id: taskId },
      { $set: { likedBy: newLikedBy, likes: newLikedBy.length } }
    );

    // Send response using updated array
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message,
        task: {
          ...task,
          likedBy: newLikedBy,
          likes: newLikedBy.length,
          liked,
        },
      })
    );
  } catch (err) {
    console.error(err);
    sendError(res, "Server error");
  }
};

// POST COMMENT/ADD
export const postTaskComment = async (
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> => {
  try {
    const user = await authenticate(req);
    if (!user) return sendError(res, "Unauthorized");

    const urlParts = req.url?.split("/") || [];
    const taskIdStr = urlParts[urlParts.length - 2]; // assuming /tasks/:id/comment

    if (!ObjectId.isValid(taskIdStr)) return sendError(res, "Invalid task ID");
    const taskId = new ObjectId(taskIdStr);

    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", async () => {
      let { text }: { text?: string } = {};
      try {
        ({ text } = JSON.parse(body));
      } catch {
        return sendError(res, "Invalid JSON");
      }

      if (!text || text.trim() === "")
        return sendError(res, "Comment cannot be empty");

      const tasksCol = getTasksCollection();
      const task = await tasksCol.findOne({ _id: taskId });
      if (!task) return sendError(res, "Task not found");

      // Prepare comment object
      const newComment: Comment = {
        _id: new ObjectId(),
        userId: user._id,
        username: user.username,
        text: text.trim(),
        replies: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedComments = Array.isArray(task.comments)
        ? [...task.comments, newComment]
        : [newComment];

      await tasksCol.updateOne(
        { _id: taskId },
        {
          $set: {
            comments: updatedComments,
            updatedAt: new Date().toISOString(),
          },
        }
      );

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message: "Comment added successfully",
          comment: newComment,
        })
      );
    });
  } catch (err) {
    console.error(err);
    sendError(res, "Server error");
  }
};

// REPLY TO COMMENT
export const replyTaskComment = async (
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> => {
  try {
    const user = await authenticate(req);
    if (!user) return sendError(res, "Unauthorized");

    const urlParts = req.url?.split("/") || [];
    const commentIdStr = urlParts[urlParts.length - 2]; // Assuming endpoint: /api/tasks/comment/:commentId/reply

    if (!ObjectId.isValid(commentIdStr))
      return sendError(res, "Invalid comment ID");

    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      let replyData: Partial<Reply>;
      try {
        replyData = JSON.parse(body);
      } catch {
        return sendError(res, "Invalid JSON");
      }

      const { text } = replyData;
      if (!text || text.trim() === "")
        return sendError(res, "Text cannot be empty");

      const tasksCol = getTasksCollection();

      // Find the task that contains this comment
      const task = await tasksCol.findOne({
        "comments._id": new ObjectId(commentIdStr),
      });

      if (!task) return sendError(res, "Comment not found");

      // Ensure only the task owner can reply (private)
      if (!task.userId.equals(user._id))
        return sendError(res, "Forbidden: Private task");

      const reply: Reply = {
        _id: new ObjectId(),
        userId: user._id,
        username: user.username,
        text: text.trim(),
        updatedAt: new Date().toISOString(),
      };

      // Push reply into the comment's replies array
      await tasksCol.updateOne(
        { "comments._id": new ObjectId(commentIdStr) },
        { $push: { "comments.$.replies": reply } as any }
      );

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message: "Reply added successfully",
          reply,
        })
      );
    });
  } catch (err) {
    console.error(err);
    sendError(res, "Server error");
  }
};

// GET TASK COMMENTS
export const getTaskComments = async (
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> => {
  try {
    const user = await authenticate(req);
    if (!user) return sendError(res, "Unauthorized");

    const urlParts = req.url?.split("/") || [];
    const taskIdStr = urlParts[urlParts.length - 2];

    if (!ObjectId.isValid(taskIdStr)) return sendError(res, "Invalid task ID");

    const tasksCol = getTasksCollection();
    const task = await tasksCol.findOne({ _id: new ObjectId(taskIdStr) });

    if (!task) return sendError(res, "Task not found");

    // Ensure private: only owner can view
    if (!task.userId.equals(user._id))
      return sendError(
        res,
        "Forbidden: You can only view your own task comments"
      );

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ comments: task.comments || [] }));
  } catch (err) {
    console.error(err);
    sendError(res, "Server error");
  }
};

// GET TASKS CREATED BY THE LOGGED-IN USER
export const getMyTasks = async (
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> => {
  try {
    const user = await authenticate(req);
    if (!user) return sendError(res, "Unauthorized");

    const tasksCol = getTasksCollection();

    // Fetch all tasks created by this user
    const tasksArray = (await tasksCol
      .find({ userId: user._id })
      .toArray()) as Todo[];

    // Sort newest first
    tasksArray.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Parse query parameters
    const fullUrl = new URL(req.url || "", `http://${req.headers.host}`);
    const queryParams = Object.fromEntries(fullUrl.searchParams.entries());

    const page = Math.max(1, parseInt(queryParams.page || "1"));
    const limit = Math.max(1, parseInt(queryParams.limit || "10"));

    // Apply filters if any
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
            task.labels.map((l) => l.toLowerCase()).includes(value)
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

// LIKE/UNLIKE A COMMENT
export const likeComment = async (
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> => {
  try {
    const user = await authenticate(req);
    if (!user) return sendError(res, "Unauthorized");

    const urlParts = req.url?.split("/") || [];
    const commentIdStr = urlParts[urlParts.length - 2];

    if (!ObjectId.isValid(commentIdStr))
      return sendError(res, "Invalid comment ID");

    const tasksCol = getTasksCollection();

    // Find the comment within any task
    const task = await tasksCol.findOne({
      "comments._id": new ObjectId(commentIdStr),
    });
    if (!task) return sendError(res, "Comment not found");

    const comment = task.comments.find((c: Comment) =>
      c._id?.equals(new ObjectId(commentIdStr))
    );

    if (!comment) return sendError(res, "Comment not found");

    // Toggle like
    let liked = false;
    const likedBy: ObjectId[] = Array.isArray(comment.likedBy)
      ? comment.likedBy
      : [];

    let newLikedBy: ObjectId[];

    if (likedBy.some((id) => id.equals(user._id))) {
      // Unlike
      newLikedBy = likedBy.filter((id) => !id.equals(user._id));
      liked = false;
    } else {
      // Like
      newLikedBy = [...likedBy, user._id];
      liked = true;
    }

    // Update the comment's likedBy and likes in MongoDB
    await tasksCol.updateOne(
      { "comments._id": new ObjectId(commentIdStr) },
      {
        $set: {
          "comments.$.likedBy": newLikedBy,
          "comments.$.likes": newLikedBy.length,
          "comments.$.updatedAt": new Date().toISOString(),
        },
      }
    );

    // Update local comment object for response
    comment.likedBy = newLikedBy;
    comment.likes = newLikedBy.length;
    comment.liked = liked;

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: liked ? "Comment liked!" : "Comment unliked!",
        comment,
      })
    );
  } catch (err) {
    console.error(err);
    sendError(res, "Server error");
  }
};

// LIKE/UNLIKE A REPLY
export async function likeReply(req: IncomingMessage, res: ServerResponse) {
  try {
    const user = await authenticate(req);
    if (!user) return sendError(res, "Unauthorized");

    const urlParts = req.url?.split("/") || [];
    const replyIdStr = urlParts[urlParts.length - 2];
    if (!ObjectId.isValid(replyIdStr))
      return sendError(res, "Invalid reply ID");

    const tasksCol = getTasksCollection();

    // Find the task containing the reply
    const task = await tasksCol.findOne({
      "comments.replies._id": new ObjectId(replyIdStr),
    });
    if (!task) return sendError(res, "Reply not found");

    // Find the specific comment containing the reply
    const comment = task.comments.find((c: Comment) =>
      c.replies.some((r: Reply) => r._id?.equals(new ObjectId(replyIdStr)))
    );
    if (!comment) return sendError(res, "Reply not found in any comment");

    // Find the reply
    const reply = comment.replies.find((r: Reply) =>
      r._id?.equals(new ObjectId(replyIdStr))
    );
    if (!reply) return sendError(res, "Reply not found");

    // Initialize likedBy array
    // Toggle like for reply
    let liked = false;
    const likedBy: ObjectId[] = Array.isArray(reply.likedBy)
      ? reply.likedBy
      : [];

    if (likedBy.some((id) => id.equals(user._id))) {
      // Unlike
      const newLikedBy = likedBy.filter((id) => !id.equals(user._id));
      await tasksCol.updateOne(
        { "comments.replies._id": new ObjectId(replyIdStr) },
        {
          $set: {
            "comments.$[].replies.$[r].likedBy": newLikedBy,
            "comments.$[].replies.$[r].likes": newLikedBy.length,
          },
        },
        { arrayFilters: [{ "r._id": new ObjectId(replyIdStr) }] }
      );
      liked = false;
      reply.likes = newLikedBy.length;
      reply.likedBy = newLikedBy;
    } else {
      // Like
      const newLikedBy = [...likedBy, user._id];
      await tasksCol.updateOne(
        { "comments.replies._id": new ObjectId(replyIdStr) },
        {
          $set: {
            "comments.$[].replies.$[r].likedBy": newLikedBy,
            "comments.$[].replies.$[r].likes": newLikedBy.length,
          },
        },
        { arrayFilters: [{ "r._id": new ObjectId(replyIdStr) }] }
      );
      liked = true;
      reply.likes = newLikedBy.length;
      reply.likedBy = newLikedBy;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: liked ? "Reply liked!" : "Reply unliked!",
        reply: { ...reply, liked },
      })
    );
  } catch (err) {
    console.error(err);
    sendError(res, "Server error");
  }
}
