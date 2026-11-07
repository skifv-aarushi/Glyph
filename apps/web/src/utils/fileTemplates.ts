// apps/web/src/utils/fileTemplates.ts

/**
 * Returns clean, idiomatic starter boilerplate for a given file path based on its extension.
 */
export function getFileExtensionTemplate(filePath: string, owner = 'workspace', repo = 'project'): string {
  const cleanPath = filePath.replace(/^\/+/, '');
  const ext = cleanPath.split('.').pop()?.toLowerCase() || '';

  switch (ext) {
    case 'py':
      return `# File: ${cleanPath} (${owner}/${repo})
"""
Spatial Workspace active for ${cleanPath}.
Live collaborative execution and visual layer annotations.
"""

def main() -> None:
    print(f"Spatial Workspace active for {cleanPath}")


if __name__ == "__main__":
    main()
`;

    case 'rs':
      return `// File: ${cleanPath} (${owner}/${repo})
// Spatial Workspace active.

fn main() {
    println!("Spatial Workspace active for ${cleanPath}");
}
`;

    case 'go':
      return `// File: ${cleanPath} (${owner}/${repo})
package main

import "fmt"

func main() {
\tfmt.Println("Spatial Workspace active for ${cleanPath}")
}
`;

    case 'cpp':
    case 'cc':
    case 'cxx':
      return `// File: ${cleanPath} (${owner}/${repo})
#include <iostream>

int main() {
    std::cout << "Spatial Workspace active for ${cleanPath}" << std::endl;
    return 0;
}
`;

    case 'c':
    case 'h':
      return `// File: ${cleanPath} (${owner}/${repo})
#include <stdio.h>

int main(void) {
    printf("Spatial Workspace active for %s\\n", "${cleanPath}");
    return 0;
}
`;

    case 'java': {
      // Extract class name from file name or default to Main
      const fileName = cleanPath.split('/').pop() || 'Main';
      const className = fileName.replace(/\.java$/i, '') || 'Main';
      return `// File: ${cleanPath} (${owner}/${repo})
public class ${className} {
    public static void main(String[] args) {
        System.out.println("Spatial Workspace active for ${cleanPath}");
    }
}
`;
    }

    case 'ts':
      return `// File: ${cleanPath} (${owner}/${repo})
export function main(): void {
  console.log("Spatial Workspace active for ${cleanPath}");
}

main();
`;

    case 'tsx':
    case 'jsx':
      return `import React from 'react';

export default function Component() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>${cleanPath}</h1>
      <p>Spatial Workspace active for ${owner}/${repo}</p>
    </div>
  );
}
`;

    case 'js':
    case 'mjs':
      return `// File: ${cleanPath} (${owner}/${repo})
export function main() {
  console.log("Spatial Workspace active for ${cleanPath}");
}

main();
`;

    case 'html':
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${cleanPath}</title>
  <style>
    body {
      margin: 0;
      padding: 2rem;
      font-family: system-ui, -apple-system, sans-serif;
      background: #09090b;
      color: #f4f4f5;
    }
  </style>
</head>
<body>
  <h1>Spatial Workspace</h1>
  <p>Active for <code>${cleanPath}</code></p>
</body>
</html>
`;

    case 'css':
    case 'scss':
      return `/* File: ${cleanPath} (${owner}/${repo}) */
:root {
  --primary-accent: #3b82f6;
  --bg-surface: #09090b;
  --text-main: #f4f4f5;
}

body {
  margin: 0;
  background-color: var(--bg-surface);
  color: var(--text-main);
  font-family: monospace;
}
`;

    case 'json':
      return `{
  "name": "${cleanPath.replace(/\.json$/i, '')}",
  "version": "1.0.0",
  "workspace": "${owner}/${repo}",
  "active": true
}
`;

    case 'sql':
      return `-- File: ${cleanPath} (${owner}/${repo})
CREATE TABLE IF NOT EXISTS records (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO records (name) VALUES ('Initial Entry');
SELECT * FROM records;
`;

    case 'sh':
    case 'bash':
      return `#!/usr/bin/env bash
# File: ${cleanPath} (${owner}/${repo})
echo "Spatial Workspace active for ${cleanPath}"
`;

    case 'md':
    case 'markdown':
      return `# ${cleanPath}

Spatial collaborative workspace for **${owner}/${repo}**.

- Ground-truth code execution via Monaco
- Visual architecture diagramming via Tldraw
- Multi-layer file scoping
`;

    case 'yml':
    case 'yaml':
      return `# File: ${cleanPath} (${owner}/${repo})
version: '1'
services:
  workspace:
    image: glyph:latest
    status: active
`;

    default:
      return `// File: ${cleanPath} (${owner}/${repo})
// Spatial Workspace active for ${cleanPath}
`;
  }
}

