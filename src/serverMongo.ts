import http from "http";
import { connectToMongo } from "./db/mongo";

import { register, login } from "./controllers/authMongoController";
import {  createTask, getTasks, getTaskById, updateTask, deleteTask, toggleTaskCompletion, likeTask , postTaskComment, replyTaskComment, getTaskComments} from "./controllers/tasksMongoController";

const PORT = process.env.PORT || 8080;

console.log("ServerMongo is running...");
console.log("I am fine today");

const server = http.createServer((req, res) => {
  const url = req.url;
  const method = req.method;

  console.log("Incoming request:", req.url, req.method);

  // Register
  if (url === "/api/register" && method === "POST") {
    return register(req, res);
  }

  // Login
  if (url === "/api/login" && method === "POST") {
    return login(req, res);
    
  }


 // CREATE TASK
  else if (url === "/api/tasks" && method === "POST") {
    return createTask(req, res);
  }

   // get comment
    else if (
      url?.startsWith("/api/tasks/") &&
      url.endsWith("/comments") &&
      method === "GET"
    ) {
      return getTaskComments(req, res);
    }

// GET TASK BY ID
    else if (url?.startsWith("/api/tasks/") && method === "GET") {
      return getTaskById(req, res);
    }


   // GET TASKS
    else if (url && url.startsWith("/api/tasks") && method === "GET") {
      return getTasks(req, res);
    }

 // UPDATE TASK
  else if (url?.startsWith("/api/tasks/") && method === "PUT") {
    return updateTask(req, res);
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


// POST COMMENT
  else if (
    url?.startsWith("/api/tasks/") &&
    url.endsWith("/comments") &&
    method === "POST"
  ) {
    return postTaskComment(req, res);
  }


  // reply to a comment
else if (
  url?.startsWith("/api/tasks/comment/") &&
  url?.endsWith("/reply") &&
  method === "POST"
) {
  return replyTaskComment(req, res);
}



  // DELETE TASK
    else if (url?.startsWith("/api/tasks/") && method === "DELETE") {
      return deleteTask(req, res);
    }


     // LIKE TASK
      else if (
        url?.startsWith("/api/tasks/") &&
        url.endsWith("/like") &&
        method === "POST"
      )
      {
        return likeTask(req, res);
        
      } 


});

connectToMongo().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
