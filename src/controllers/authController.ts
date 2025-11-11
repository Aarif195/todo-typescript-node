// src/controllers/authController.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { User } from "../types/user";
import { IncomingMessage, ServerResponse } from "http";

const file = path.join(__dirname, "../../users.json");

// Read and write helpers
function readUsers(): User[] {
  if (!fs.existsSync(file)) fs.writeFileSync(file, "[]");
  const data = fs.readFileSync(file, "utf8");
  return JSON.parse(data) as User[];
}

function writeUsers(users: User[]): void {
    //   console.log("Writing users:", users);
  fs.writeFileSync(file, JSON.stringify(users, null, 2));
}

// Password hashing
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// REGISTER USER
export function register(req: IncomingMessage, res: ServerResponse): void {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });

  req.on("end", () => {
    const { username, email, password }: { username: string; email: string; password: string } = JSON.parse(body);

    // Basic validation
    if (!username || !email || !password) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "All fields are required" }));
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Invalid email format" }));
    }

    // Password strength validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    if (!passwordRegex.test(password)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        message: "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character"
      }));
    }

    const users = readUsers();

    // Unique email check
    if (users.find(u => u.email === email)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Email already exists" }));
    }

    // Unique username check
    if (users.find(u => u.username === username)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Username already exists" }));
    }

    const newUser: User = {
      id: users.length ? users[users.length - 1].id + 1 : 1,
      username,
      email,
      password: hashPassword(password),
    };

    users.push(newUser);
    writeUsers(users);

    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "User registered successfully" }));
  });
}

// LOGIN USER
export function login(req: IncomingMessage, res: ServerResponse): void {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });

  req.on("end", () => {
    const { email, password }: { email: string; password: string } = JSON.parse(body);

    // Validate required fields
    if (!email || !password) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Email and password are required" }));
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Invalid email format" }));
    }

    const users = readUsers();

    // Check if user exists
    const user: User | undefined = users.find(
      (u) => u.email === email && u.password === hashPassword(password)
    );

    if (!user) {
      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Invalid credentials" }));
    }

    // Generate a new token for current login
    const token = crypto.randomBytes(24).toString("hex");

    // Overwrite all other users' tokens
    users.forEach((u) => {
      u.token = u.id === user.id ? token : undefined;
    });

    // Save users back to file
    writeUsers(users);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      message: "Login successful",
      token,
      user: { id: user.id, username: user.username, email: user.email }
    }));
  });
}

// AUTHENTICATION
export function authenticate(req: IncomingMessage): User | null {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return null;

    const parts = authHeader.trim().split(/\s+/);
    if (parts.length !== 2 || parts[0] !== "Bearer") return null;

    const token = parts[1];

    // Load users
    const users: User[] = JSON.parse(fs.readFileSync(file, "utf8"));
    const user = users.find(u => u.token === token);

    return user || null;
}


