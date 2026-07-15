const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "src", "app", "register", "page.tsx");
let content = fs.readFileSync(filePath, "utf-8");

// Find the stray brace: </div>}  (closing div followed by extra })
// Using a simple replace for </div>}  followed by newlines and comments
content = content.replace(/<\/div>\s*\n\s*\}\s*\n/g, '</div>\n\n');
// Also handle case where it's on same line
content = content.replace(/<\/div>\s*\}/g, '</div>');

fs.writeFileSync(filePath, content, "utf-8");
console.log("Done!");

const hasBrace = content.includes("</div>}");
console.log("Still has stray brace:</div>} ->", hasBrace);
if (!hasBrace) console.log("SUCCESS!");
