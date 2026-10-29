# @dropspot/mcp — Drop Spot MCP Server

[![npm version](https://img.shields.io/npm/v/@dropspot/mcp.svg)](https://www.npmjs.com/package/@dropspot/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![MCP Standard](https://img.shields.io/badge/MCP-Standard-emerald.svg)](https://modelcontextprotocol.io)

Official **Model Context Protocol (MCP)** server for [Drop Spot](https://godropspot.com) — the passwordless client document intake and automated follow-up platform for accountants, law firms, and service professionals.

Connect Drop Spot directly to **Claude Desktop**, **Cursor AI**, or **Google Antigravity**. Instruct your AI in plain English to prepare client checklists, dispatch secure zero-password upload links, monitor completion status, and review incoming paperwork—with zero coding required.

---

## ⚡ Quickstart

### 1. Get your Drop Spot API Key
1. Sign in to your Drop Spot workspace at [godropspot.com](https://godropspot.com).
2. Go to **Settings** &rarr; **Developer API & MCP**.
3. Click **Generate New API Key**, select your desired scopes (or Full Access), and copy your token (`ds_live_...`).

---

### 2. Configure Your AI Client

#### Option A: Claude Desktop
Add the following to your `claude_desktop_config.json`:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "dropspot": {
      "command": "npx",
      "args": ["-y", "@dropspot/mcp"],
      "env": {
        "DROPSPOT_API_KEY": "ds_live_YOUR_ACTUAL_KEY_HERE",
        "DROPSPOT_API_BASE_URL": "https://godropspot.com/api/v1"
      }
    }
  }
}
```

#### Option B: Cursor AI
Add to `.cursor/mcp.json` in your project or global settings:

```json
{
  "mcpServers": {
    "dropspot": {
      "command": "npx",
      "args": ["-y", "@dropspot/mcp"],
      "env": {
        "DROPSPOT_API_KEY": "ds_live_YOUR_ACTUAL_KEY_HERE",
        "DROPSPOT_API_BASE_URL": "https://godropspot.com/api/v1"
      }
    }
  }
}
```

#### Option C: Claude Code (CLI)
Add Drop Spot to Claude Code:

```bash
claude mcp add dropspot npx -y @dropspot/mcp --env DROPSPOT_API_KEY=ds_live_YOUR_ACTUAL_KEY_HERE DROPSPOT_API_BASE_URL=https://godropspot.com/api/v1
```

#### Option D: Windsurf / VS Code / Antigravity
Add to your client's MCP configuration (`mcpServers`):

```json
{
  "mcpServers": {
    "dropspot": {
      "command": "npx",
      "args": ["-y", "@dropspot/mcp"],
      "env": {
        "DROPSPOT_API_KEY": "ds_live_YOUR_ACTUAL_KEY_HERE",
        "DROPSPOT_API_BASE_URL": "https://godropspot.com/api/v1"
      }
    }
  }
}
```

---

## 🌐 Public Registries & Discovery

Drop Spot is an open, unproxied MCP server available across major AI registries:

- **Smithery.ai:** Direct registry listing indexed via `smithery.yaml` (Arcade.dev-powered, zero proxy latency).
- **Glama.ai:** Verified MCP listing claimed via `glama.json` ([glama.ai/mcp/servers](https://glama.ai/mcp/servers)).
- **PulseMCP:** Listed in the community catalog ([pulsemcp.com](https://pulsemcp.com)).
- **Official Model Context Protocol:** Cataloged on [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers).
- **npm:** Zero-install direct execution via `npx -y @dropspot/mcp`.

---

## 💬 Prompts Your AI Understands

Once connected, your AI gains native understanding of your Drop Spot workspace:

- *"Create an intake request for Sarah Jenkins using our 2026 Tax Return template."*
- *"Show me our client list and search for Acme Corp."*
- *"Update Sarah's phone number to (555) 234-5678 and add a note that she is a VIP client."*
- *"Check if Sarah uploaded her W-2 form yet."*
- *"Review Sarah's uploaded W-2 and approve it."*
- *"Reject item #2 with the note: 'Page 2 is blurry. Please re-upload a clear scan.' "*
- *"List all our active document requests with pending items."*
- *"Create a reusable checklist template called 'Quarterly Bookkeeping Close'."*

---

## 🛠️ Available MCP Tools (12 Tools)

| Tool Name | Description |
| :--- | :--- |
| `create_intake_request` | Create a new document intake dossier with an itemized checklist. Generates a passwordless magic upload link and optionally emails the client. |
| `list_intake_requests` | List and filter active document requests in the workspace by status or client email. |
| `get_intake_request` | Retrieve complete details of a specific request, including each checklist item, upload statuses, and file metadata. |
| `review_item` | Review an uploaded file: approve it or reject it with custom feedback to prompt the client for a re-upload. |
| `get_file_download_link` | Generate a short-lived (5-minute) secure presigned URL to inspect or download an uploaded client file. |
| `list_clients` | Search and browse your firm's client directory by name, email, or company. |
| `get_client` | Fetch a client record with their full intake history and metadata. |
| `create_or_update_client` | Add a new client or update existing contact details (phone, company, notes). |
| `list_templates` | View your reusable checklist templates (e.g. 1040 Tax Return, KYC, Mortgage Intake). |
| `get_template` | Inspect a specific checklist template and its default items. |
| `create_template` | Create a new reusable checklist template with predefined items and categories. |
| `update_template` | Edit an existing template's name, description, or checklist items. |

---

## 🔒 Security, Privacy & Compliance

- **Zero AI Training:** Client documents and personal data are **never** used to train public or proprietary AI models.
- **Short-Lived Signed URLs:** File downloads use ephemeral 5-minute pre-signed URLs; file binaries are never permanently exposed over the wire.
- **Scoped API Tokens:** Generate API keys restricted strictly to specific operations (`requests:read`, `requests:write`, `items:review`, `clients:write`, etc.).
- **Human-in-the-Loop:** AI tools execute actions on your behalf with complete audit trails. You retain full oversight with real-time logs and 1-click token revocation.

---

## 📄 License
MIT © [Drop Spot Technologies](https://godropspot.com)
