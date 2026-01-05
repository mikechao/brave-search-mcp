## Debugging

1. Clone the repo

2. Install Dependencies and build it

```bash
npm install
```

3. Build the app

```bash
npm run build
```

### Use the VS Code Run and Debug Function

⚠ Does not seem to work on Windows 10/11, but works in WSL2

Use the VS Code
[Run and Debug launcher](https://code.visualstudio.com/docs/debugtest/debugging#_start-a-debugging-session) with fully
functional breakpoints in the code:

1. Locate and select the run debug.
2. Select the configuration labeled "`MCP Server Launcher`" in the dropdown.
3. Select the run/debug button.
   We can debug the various tools using [MCP Inspector](https://github.com/modelcontextprotocol/inspector) and VS Code.

### VS Code Debug setup

To set up local debugging with breakpoints:

1. Store Brave API Key in the VS Code
   - Open the Command Palette (Cmd/Ctrl + Shift + P).
   - Type `Preferences: Open User Settings (JSON)`.
   - Add the following snippet:

   ```json
   {
     "brave.search.api.key": "your-api-key-here"
   }
   ```

2. Create or update `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "MCP Server Launcher",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/node_modules/@modelcontextprotocol/inspector/cli/build/cli.js",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "env": {
        "BRAVE_API_KEY": "${config:brave.search.api.key}",
        "DEBUG": "true"
      },
      "args": ["dist/index.js"],
      "sourceMaps": true,
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "preLaunchTask": "npm: build:watch"
    },
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to Debug Hook Process",
      "port": 9332,
      "skipFiles": ["<node_internals>/**"],
      "sourceMaps": true,
      "outFiles": ["${workspaceFolder}/dist/**/*.js"]
    },
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to REPL Process",
      "port": 9333,
      "skipFiles": ["<node_internals>/**"],
      "sourceMaps": true,
      "outFiles": ["${workspaceFolder}/dist/**/*.js"]
    }
  ],
  "compounds": [
    {
      "name": "Attach to MCP Server",
      "configurations": ["Attach to Debug Hook Process", "Attach to REPL Process"]
    }
  ]
}
```

3. Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "type": "npm",
      "script": "build:watch",
      "group": {
        "kind": "build",
        "isDefault": true
      },
      "problemMatcher": ["$tsc"]
    }
  ]
}
```
