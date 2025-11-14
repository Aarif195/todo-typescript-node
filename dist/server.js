"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const PORT = process.env.PORT || 8080;
const authController_1 = require("./controllers/authController");
const tasksController_1 = require("./controllers/tasksController");
const server = http_1.default.createServer((req, res) => {
    const url = req.url;
    const method = req.method;
    // Register
    if (url === "/api/register" && method === "POST") {
        return (0, authController_1.register)(req, res);
    }
    // Login
    if (url === "/api/login" && method === "POST") {
        return (0, authController_1.login)(req, res);
    }
    // LIKE/UNLIKE A REPLY
    else if (url?.startsWith("/api/tasks/") &&
        url.includes("/comments/") &&
        url.includes("/replies/") &&
        url.endsWith("/like") &&
        req.method === "POST") {
        return (0, tasksController_1.likeReply)(req, res);
    }
    // LIKE/UNLIKE A COMMENT
    if (url?.startsWith("/api/tasks/") &&
        url.includes("/comments/") &&
        url.endsWith("/like") &&
        method === "POST") {
        return (0, tasksController_1.likeComment)(req, res);
    }
    // 1. EDIT COMMENT
    else if (url?.startsWith("/api/tasks/") &&
        url.includes("/comments/") &&
        !url.includes("/replies") &&
        req.method === "PATCH") {
        return (0, tasksController_1.editCommentOrReply)(req, res);
    }
    // 2. EDIT REPLY
    else if (url?.startsWith("/api/tasks/") &&
        url.includes("/comments/") &&
        url.includes("/replies/") &&
        req.method === "PATCH") {
        return (0, tasksController_1.editCommentOrReply)(req, res);
    }
    // Delete comment
    else if (url?.startsWith("/api/tasks/") &&
        url.includes("/comments/") &&
        !url.includes("/replies") &&
        req.method === "DELETE") {
        return (0, tasksController_1.deleteCommentOrReply)(req, res);
    }
    // Delete reply
    else if (url?.startsWith("/api/tasks/") &&
        url.includes("/comments/") &&
        url.includes("/replies/") &&
        req.method === "DELETE") {
        return (0, tasksController_1.deleteCommentOrReply)(req, res);
    }
    // CREATE TASK
    else if (url === "/api/tasks" && method === "POST") {
        return (0, tasksController_1.createTask)(req, res);
    }
    // get comment
    else if (url?.startsWith("/api/tasks/") &&
        url.endsWith("/comments") &&
        method === "GET") {
        return (0, tasksController_1.getTaskComments)(req, res);
    }
    // GET TASK BY ID
    else if (url?.startsWith("/api/tasks/") && method === "GET") {
        return (0, tasksController_1.getTaskById)(req, res);
    }
    // GET TASKS
    else if (url && url.startsWith("/api/tasks") && method === "GET") {
        return (0, tasksController_1.getTasks)(req, res);
    }
    // UPDATE TASK
    else if (url?.startsWith("/api/tasks/") && method === "PATCH") {
        return (0, tasksController_1.updateTask)(req, res);
    }
    // Mark task as completed
    else if (url?.startsWith("/api/tasks/") &&
        url.endsWith("/complete") &&
        method === "PATCH") {
        return (0, tasksController_1.toggleTaskCompletion)(req, res);
    }
    // Mark task as incomplete
    else if (url?.startsWith("/api/tasks/") &&
        url.endsWith("/incomplete") &&
        method === "PATCH") {
        return (0, tasksController_1.toggleTaskCompletion)(req, res);
    }
    // POST COMMENT
    else if (url?.startsWith("/api/tasks/") &&
        url.endsWith("/comments") &&
        method === "POST") {
        return (0, tasksController_1.postTaskComment)(req, res);
    }
    // reply to a comment
    else if (url?.startsWith("/api/tasks/") &&
        url.includes("/comment/") &&
        url.endsWith("/reply") &&
        method === "POST") {
        return (0, tasksController_1.replyTaskComment)(req, res);
    }
    // DELETE TASK
    else if (url?.startsWith("/api/tasks/") && method === "DELETE") {
        return (0, tasksController_1.deleteTask)(req, res);
    }
    // LIKE TASK
    else if (url?.startsWith("/api/tasks/") &&
        url.endsWith("/like") &&
        method === "POST") {
        return (0, tasksController_1.likeTask)(req, res);
    }
    else if (url === "/api/user/my-tasks" && method === "GET") {
        (0, tasksController_1.getMyTasks)(req, res);
    }
});
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} `);
});
