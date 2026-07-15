const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "src", "app", "register", "page.tsx");
let content = fs.readFileSync(filePath, "utf-8");

// Fix 1: Remove stray "}" that was left from the old "{cameraActive && (" closing
// The pattern:                      </div>}
// Should be:                        </div>
content = content.replace(
  "                      </div>}\n\n                    {/* Captured face preview */}",
  "                      </div>\n\n                    {/* Captured face preview */}"
);

// Fix 2: Fix indentation - the content inside the div is over-indented
// because it was originally wrapped in {cameraActive && (
// Lines with 24 spaces (the content div) should have 20 spaces
// Let me check the actual indentation...
// Currently it looks like:
//   <div className={`...`}>
//       <video ... />     (28 spaces indent - was inside conditional + div)
//       <div className="absolute ...">  (24 spaces)
// Need to reduce by 4 spaces for all content between the new opening div and its closing

// Find the section boundaries
const sectionStart = content.indexOf('className={`relative aspect-[4/3]');
const sectionEnd = content.indexOf('{/* Captured face preview */}', sectionStart);

if (sectionStart >= 0 && sectionEnd >= 0) {
  // Get the line from sectionStart
  const beforeSection = content.substring(0, sectionStart);
  const lastNewline = beforeSection.lastIndexOf('\n');
  const startLine = lastNewline >= 0 ? beforeSection.substring(lastNewline + 1) : beforeSection;
  
  // Find the opening line end
  const divOpenLineEnd = content.indexOf('>', sectionStart);
  
  if (divOpenLineEnd >= 0 && divOpenLineEnd < sectionEnd) {
    // The content starts after the opening div line's >
    let contentStart = content.indexOf('\n', divOpenLineEnd);
    if (contentStart >= 0) {
      contentStart = contentStart + 1; // skip the newline
      
      // The content between contentStart and sectionEnd
      const innerContent = content.substring(contentStart, sectionEnd);
      
      // Check current indentation
      const indentMatch = innerContent.match(/^(\s+)/);
      if (indentMatch) {
        const currentIndent = indentMatch[1];
        const reducedIndent = currentIndent.substring(4); // remove 4 spaces
        
        // Replace all occurrences of currentIndent with reducedIndent in the inner content
        // But only at the beginning of lines
        const fixedInner = innerContent.replace(
          new RegExp(`^${currentIndent}`, 'gm'),
          reducedIndent
        );
        
        content = content.substring(0, contentStart) + fixedInner + content.substring(sectionEnd);
        console.log("Indentation fixed!");
      }
    }
  }
}

// Fix 3: Close the div properly - ensure the closing </div> has proper indentation
// The closing div is:                       </div> 
// Should be at same level as the opening (20 spaces, not 22)

fs.writeFileSync(filePath, content, "utf-8");
console.log("File written!");

// Verify
const hasStrayBrace = content.includes("</div>}");
console.log("Stray brace after </div>:", hasStrayBrace);
const hasOldConditional = content.includes("{cameraActive && (");
console.log("Old conditional still present:", hasOldConditional);

if (!hasStrayBrace && !hasOldConditional) {
  console.log("SUCCESS!");
} else {
  console.log("NEEDS MORE FIXES");
}
