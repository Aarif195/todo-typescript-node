import fs from "fs";
import path from "path";


const file = "tasks.json";
if (!fs.existsSync(file)) {
    fs.writeFileSync(file, "[]");
}