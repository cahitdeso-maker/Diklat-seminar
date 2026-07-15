const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "src", "app", "register", "page.tsx");
let content = fs.readFileSync(filePath, "utf-8");
const originalContent = content;

// Fix 1: Camera View - change from conditional to hidden class
// Pattern: a line with "{cameraActive && (" followed by a line with a div containing "aspect-[4/3]"
// We need to replace the entire conditional block with an always-rendered div
const conditionalCameraRegex = /\s*\{cameraActive\s*&&\s*\(\s*\n\s*<div\s+className="relative\s+aspect-\[4\/3\]/;
if (conditionalCameraRegex.test(content)) {
  console.log("Found conditional camera pattern via regex");
  
  // Find the start of the conditional
  const startMatch = content.match(conditionalCameraRegex);
  if (startMatch) {
    const startIndex = content.indexOf(startMatch[0]);
    console.log("Conditional starts at index:", startIndex);
    
    // Find the opening of the div to get the indentation
    const indentMatch = startMatch[0].match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : "                    ";
    
    // Replace the conditional opening
    const oldOpen = startMatch[0].trimStart(); // just the "{cameraActive && (...)" + next line start
    // We need a different approach
    
    // Let's just find the whole section and replace it
    const sectionStart = content.indexOf("{cameraActive && (", startIndex - 100);
    if (sectionStart >= 0) {
      // Find the matching closing: the corresonding ")" after the last </div>
      const sectionBeforeCapture = content.substring(sectionStart);
      
      // We know the structure is:
      //   {cameraActive && (
      //     <div ...>
      //       ... many lines ...
      //     </div>
      //   )}
      //   {/* Captured face preview */}
      
      // Find the end by looking for the pattern: \n                    )}
      // followed by \n                    {/* Captured face preview */}
      const endMarker = "{/* Captured face preview */}";
      const endIdx = sectionBeforeCapture.indexOf(endMarker);
      
      if (endIdx >= 0) {
        // Go back from endIdx to find the ")" that closes the && (
        const beforeCapture = sectionBeforeCapture.substring(0, endIdx);
        const lastClosingParen = beforeCapture.lastIndexOf(")");
        
        if (lastClosingParen >= 0) {
          const sectionToReplace = sectionBeforeCapture.substring(0, lastClosingParen + 1);
          const afterSection = sectionBeforeCapture.substring(lastClosingParen + 1);
          
          console.log("Section to replace length:", sectionToReplace.length);
          console.log("First 120 chars:", sectionToReplace.substring(0, 120));
          
          // Build new section:
          // Remove the outer {cameraActive && (
          // Change the inner div to have dynamic className
          const divStart = sectionToReplace.indexOf('<div className="relative');
          if (divStart >= 0) {
            const beforeDiv = sectionToReplace.substring(0, divStart);
            const afterDivOpening = sectionToReplace.substring(divStart);
            
            // The div opening line: <div className="relative aspect-[4/3] bg-black rounded-xl overflow-hidden mb-4">
            const divOpenEnd = afterDivOpening.indexOf(">");
            const divOpenLine = afterDivOpening.substring(0, divOpenEnd + 1);
            
            // New div opening with hidden class
            const newDivOpen = divOpenLine.replace(
              'className="relative aspect-[4/3] bg-black rounded-xl overflow-hidden mb-4"',
              'className={`relative aspect-[4/3] bg-black rounded-xl overflow-hidden mb-4 ${cameraActive ? "" : "hidden"}`}'
            );
            
            // Before div, we need to remove the extra indentation
            // The beforeDiv contains: whitespace + "{cameraActive && ("
            // We need: just the whitespace
            const wsMatch = beforeDiv.match(/^(\s*)/);
            const whitespace = wsMatch ? wsMatch[1] : "";
            
            // Reconstruct: whitespace + <div className={...hidden...}> + rest of section content + </div>\n
            const restOfSection = afterDivOpening.substring(divOpenEnd + 1);
            // Remove the closing </div> and surrounding whitespace from the original section
            const closingDivIdx = restOfSection.lastIndexOf("</div>");
            const sectionContent = restOfSection.substring(0, closingDivIdx + "</div>".length);
            
            const newSection = whitespace + newDivOpen + "\n" + sectionContent;
            
            const fullNewContent = content.substring(0, sectionStart) + newSection + afterSection;
            content = fullNewContent;
            console.log("Replacement applied!");
          }
        }
      }
    }
  }
} else {
  console.log("Conditional pattern NOT found via regex either");
  // Debug: show lines around "Camera View"
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("Camera View") || lines[i].includes("cameraActive")) {
      console.log(`Line ${i}: ${lines[i].trim()}`);
    }
  }
}

// Write result
fs.writeFileSync(filePath, content, "utf-8");

// Verify
const stillHasBug = content.includes("{cameraActive && (");
const hasHiddenClass = content.includes("hidden");
console.log("\nVerification:");
console.log("  Still has {cameraActive && ( :", stillHasBug);
console.log("  Has 'hidden' in file:", hasHiddenClass);

if (!stillHasBug && hasHiddenClass) {
  console.log("SUCCESS: Fix applied!");
} else {
  console.log("FAILED: Changes not applied as expected");
  console.log("File unchanged:", content === originalContent);
}
