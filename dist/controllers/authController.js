"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.authenticate = authenticate;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const file = path_1.default.join(__dirname, "../users.json");
console.log("Current file path:", file);
if (!fs_1.default.existsSync(file)) {
    fs_1.default.writeFileSync(file, "[]");
}
// Read and write helpers
function readUsers() {
    if (!fs_1.default.existsSync(file))
        fs_1.default.writeFileSync(file, "[]");
    const data = fs_1.default.readFileSync(file, "utf8");
    return JSON.parse(data);
}
function writeUsers(users) {
    //   console.log("Writing users:", users);
    fs_1.default.writeFileSync(file, JSON.stringify(users, null, 2));
}
// Password hashing
function hashPassword(password) {
    return crypto_1.default.createHash("sha256").update(password).digest("hex");
}
// REGISTER USER
function register(req, res) {
    let body = "";
    req.on("data", (chunk) => {
        body += chunk.toString();
    });
    req.on("end", () => {
        const { username, email, password } = JSON.parse(body);
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
        const newUser = {
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
function login(req, res) {
    let body = "";
    req.on("data", (chunk) => {
        body += chunk.toString();
    });
    req.on("end", () => {
        const { email, password } = JSON.parse(body);
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
        const user = users.find((u) => u.email === email && u.password === hashPassword(password));
        if (!user) {
            res.writeHead(401, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ message: "Invalid credentials" }));
        }
        // Generate a new token for current login
        const token = crypto_1.default.randomBytes(24).toString("hex");
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
function authenticate(req) {
    const authHeader = req.headers["authorization"];
    if (!authHeader)
        return null;
    const parts = authHeader.trim().split(/\s+/);
    if (parts.length !== 2 || parts[0] !== "Bearer")
        return null;
    const token = parts[1];
    // Load users
    const users = JSON.parse(fs_1.default.readFileSync(file, "utf8"));
    const user = users.find(u => u.token === token);
    return user || null;
}
