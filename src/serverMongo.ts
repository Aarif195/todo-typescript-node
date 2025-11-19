import http from "http";
import { connectToMongo } from "./db/mongo";

import { register, login } from "./controllers/authMongoController";
import {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  toggleTaskCompletion,
  likeTask,
  postTaskComment,
  replyTaskComment,
  getTaskComments,
  getMyTasks,
  likeComment,
  likeReply,
  deleteCommentOrReply,
} from "./controllers/tasksMongoController";

const PORT = process.env.PORT || 8080;

console.log("ServerMongo is running...");
console.log("I am fine today");

const server = http.createServer((req, res) => {
  const url = req.url;
  const method = req.method;

  console.log("Incoming request:", req.url, req.method);

  
  if (url === "/api/register" && method === "POST") {
    return register(req, res);
  }
  if (url === "/api/login" && method === "POST") {
    return login(req, res);
  }
  if (url === "/api/user/my-tasks" && method === "GET") {
    return getMyTasks(req, res);
  }

 
  
  // DELETE REPLY
  else if (
    url?.startsWith("/api/tasks/") &&
    url.includes("/comments/") &&
    url.includes("/replies/") &&
    req.method === "DELETE"
  ) {
    return deleteCommentOrReply(req, res);
  }
  
  
  // LIKE/UNLIKE A REPLY
  else if (
    url?.startsWith("/api/tasks/") &&
    url.includes("/replies/") &&
    url.endsWith("/like") &&
    method === "POST"
  ) {
    return likeReply(req, res);
  }

  
  // DELETE COMMENT
  else if (
    url?.startsWith("/api/tasks/") &&
    url.includes("/comments/") &&
    !url.includes("/replies") &&
    req.method === "DELETE"
  ) {
    return deleteCommentOrReply(req, res);
  }
  
 
  // LIKE/UNLIKE A COMMENT
  else if (
    url?.startsWith("/api/tasks/comments/") &&
    url.endsWith("/like") &&
    method === "POST"
  ) {
    return likeComment(req, res);
  }
  
  // REPLY TO A COMMENT
  else if (
    url?.startsWith("/api/tasks/comment/") &&
    url?.endsWith("/reply") &&
    method === "POST"
  ) {
    return replyTaskComment(req, res);
  }

  // POST COMMENT
  else if (
    url?.startsWith("/api/tasks/") &&
    url.endsWith("/comments") &&
    method === "POST"
  ) {
    return postTaskComment(req, res);
  }

  // GET ALL COMMENTS FOR A TASK
  else if (
    url?.startsWith("/api/tasks/") &&
    url.endsWith("/comments") &&
    method === "GET"
  ) {
    return getTaskComments(req, res);
  }

  
  // Mark task as completed
  else if (
    url?.startsWith("/api/tasks/") &&
    url.endsWith("/complete") &&
    method === "PATCH"
  ) {
    return toggleTaskCompletion(req, res);
  }

  // Mark task as incomplete
  else if (
    url?.startsWith("/api/tasks/") &&
    url.endsWith("/incomplete") &&
    method === "PATCH"
  ) {
    return toggleTaskCompletion(req, res);
  }

  // LIKE TASK
  else if (
    url?.startsWith("/api/tasks/") &&
    url.endsWith("/like") &&
    method === "POST"
  ) {
    return likeTask(req, res);
  }

  
  // CREATE TASK
  else if (url === "/api/tasks" && method === "POST") {
    return createTask(req, res);
  }

  // DELETE TASK
  else if (url?.startsWith("/api/tasks/") && method === "DELETE") {
    return deleteTask(req, res);
  }

  // UPDATE TASK
  else if (url?.startsWith("/api/tasks/") && method === "PUT") {
    return updateTask(req, res);
  }

  // GET TASK BY ID 
  else if (url?.startsWith("/api/tasks/") && method === "GET") {
    return getTaskById(req, res);
  }

  // GET TASKS (Most Generic Task GET)
  else if (url && url.startsWith("/api/tasks") && method === "GET") {
    return getTasks(req, res);
  }

  // 404 Handler 
  else {
  res.writeHead(404, { "Content-Type": "application/json" });
res.end(JSON.stringify({ message: "Endpoint not found" }));
}


});

connectToMongo().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
