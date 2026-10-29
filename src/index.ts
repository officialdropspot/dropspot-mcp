#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const API_KEY = process.env.DROPSPOT_API_KEY || '';
const BASE_URL = (process.env.DROPSPOT_API_BASE_URL || process.env.DROPSPOT_BASE_URL || 'https://portal.godropspot.com').replace(/\/+$/, '');

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Support both full paths and /api/v1 paths
  const cleanEndpoint = endpoint.startsWith('/api/v1')
    ? (BASE_URL.endsWith('/api/v1') ? endpoint.replace('/api/v1', '') : endpoint)
    : (BASE_URL.endsWith('/api/v1') ? endpoint : `/api/v1${endpoint}`);

  const url = `${BASE_URL}${cleanEndpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_KEY}`,
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  const data = (await response.json()) as any;

  if (!response.ok) {
    throw new Error(data?.error || `API request failed with HTTP ${response.status}`);
  }

  return data as T;
}

const server = new Server(
  {
    name: 'dropspot-mcp',
    version: '1.1.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ----------------------------------------------------------------------------
// 1. LIST TOOLS
// ----------------------------------------------------------------------------
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'create_intake_request',
        description:
          'Create a new Drop Spot client document intake request (dossier). Generates a zero-password magic upload link and optionally emails the client.',
        inputSchema: {
          type: 'object',
          properties: {
            clientName: {
              type: 'string',
              description: 'Full name of the client (e.g. "Jane Doe")',
            },
            clientEmail: {
              type: 'string',
              description: 'Email address of the client where the magic link will be sent',
            },
            clientPhone: {
              type: 'string',
              description: 'Optional phone number for SMS reminders',
            },
            title: {
              type: 'string',
              description: 'Title of the intake request (e.g. "2026 Tax Return Documentation")',
            },
            dueAt: {
              type: 'string',
              description: 'ISO 8601 deadline date (optional, defaults to 14 days from now)',
            },
            sendInvitationEmail: {
              type: 'boolean',
              description: 'Whether to automatically email the client the invitation link (defaults to true)',
            },
            items: {
              type: 'array',
              description: 'Checklist of items and documents required from the client',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Name of the required document' },
                  description: { type: 'string', description: 'Helpful instructions for the client' },
                  isRequired: { type: 'boolean', description: 'Whether this item is mandatory (default: true)' },
                  allowMultiple: { type: 'boolean', description: 'Allow uploading multiple files for this item' },
                  category: { type: 'string', description: 'Grouping category (e.g. "Tax", "Identification")' },
                },
                required: ['title'],
              },
            },
          },
          required: ['clientName', 'clientEmail', 'title', 'items'],
        },
      },
      {
        name: 'list_intake_requests',
        description:
          'List client intake requests in the Drop Spot workspace. Filter by status or client email.',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['in_process', 'completed', 'canceled'],
              description: 'Filter by dossier status',
            },
            clientEmail: {
              type: 'string',
              description: 'Filter by specific client email',
            },
            limit: {
              type: 'number',
              description: 'Number of requests to return (default: 20, max: 100)',
            },
          },
        },
      },
      {
        name: 'get_intake_request',
        description:
          'Retrieve full details for an intake request by ID, including checklist items, upload progress, and file metadata.',
        inputSchema: {
          type: 'object',
          properties: {
            requestId: {
              type: 'string',
              description: 'The UUID of the intake request',
            },
          },
          required: ['requestId'],
        },
      },
      {
        name: 'review_item',
        description:
          'Approve or reject a document uploaded by a client. If rejected, sends automated feedback asking the client to re-upload.',
        inputSchema: {
          type: 'object',
          properties: {
            itemId: {
              type: 'string',
              description: 'The UUID of the checklist item to review',
            },
            decision: {
              type: 'string',
              enum: ['approve', 'reject'],
              description: 'Approval decision',
            },
            rejectionNote: {
              type: 'string',
              description: 'Reason for rejection to help client correct the issue (e.g. "Photo is blurry, please retake")',
            },
          },
          required: ['itemId', 'decision'],
        },
      },
      {
        name: 'get_file_download_link',
        description:
          'Generate a secure, temporary presigned download URL for an uploaded file so an AI or operator can inspect the document contents.',
        inputSchema: {
          type: 'object',
          properties: {
            fileId: {
              type: 'string',
              description: 'The UUID of the uploaded file record',
            },
            expiresInSeconds: {
              type: 'number',
              description: 'Expiration in seconds (default: 300 = 5 minutes for privacy)',
            },
          },
          required: ['fileId'],
        },
      },
      // CLIENTS MANAGEMENT TOOLS
      {
        name: 'list_clients',
        description:
          'List and search clients in the Drop Spot directory. Filter by name, email, or company.',
        inputSchema: {
          type: 'object',
          properties: {
            search: {
              type: 'string',
              description: 'Search string to filter clients by name, email, or company name',
            },
            limit: {
              type: 'number',
              description: 'Max number of clients to return (default: 50, max: 100)',
            },
          },
        },
      },
      {
        name: 'get_client',
        description:
          'Retrieve detailed profile information for a specific client, including their active and historical document requests.',
        inputSchema: {
          type: 'object',
          properties: {
            clientId: {
              type: 'string',
              description: 'The UUID of the client',
            },
          },
          required: ['clientId'],
        },
      },
      {
        name: 'create_or_update_client',
        description:
          'Add a new client to the directory or update an existing client’s contact details, phone, company, or notes.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Full name of the client',
            },
            email: {
              type: 'string',
              description: 'Email address of the client',
            },
            phone: {
              type: 'string',
              description: 'Optional phone number',
            },
            company: {
              type: 'string',
              description: 'Company or business name',
            },
            notes: {
              type: 'string',
              description: 'Internal notes about this client',
            },
          },
          required: ['name', 'email'],
        },
      },
      // TEMPLATES MANAGEMENT TOOLS
      {
        name: 'list_templates',
        description:
          'List available checklist templates (including starter packages for tax returns, KYC, and mortgage underwriting).',
        inputSchema: {
          type: 'object',
          properties: {
            includeStarters: {
              type: 'boolean',
              description: 'Whether to include built-in starter templates (default: true)',
            },
          },
        },
      },
      {
        name: 'get_template',
        description:
          'Get full details and checklist items for a specific reusable template.',
        inputSchema: {
          type: 'object',
          properties: {
            templateId: {
              type: 'string',
              description: 'The UUID or starter identifier of the template',
            },
          },
          required: ['templateId'],
        },
      },
      {
        name: 'create_template',
        description:
          'Create a new reusable document checklist template with predefined items and categories.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Template title (e.g. "Q1 Bookkeeping Review")',
            },
            description: {
              type: 'string',
              description: 'Description of when to use this checklist',
            },
            isShared: {
              type: 'boolean',
              description: 'Whether this template is visible to the entire workspace team (default: true)',
            },
            items: {
              type: 'array',
              description: 'The list of checklist items',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Name of the required document' },
                  description: { type: 'string', description: 'Instructions for the client' },
                  isRequired: { type: 'boolean', description: 'Whether item is mandatory (default: true)' },
                  allowMultiple: { type: 'boolean', description: 'Allow multiple files (default: false)' },
                  category: { type: 'string', description: 'Item category' },
                },
                required: ['title'],
              },
            },
          },
          required: ['name', 'items'],
        },
      },
      {
        name: 'update_template',
        description:
          'Edit an existing custom checklist template (update name, description, or checklist items).',
        inputSchema: {
          type: 'object',
          properties: {
            templateId: {
              type: 'string',
              description: 'The UUID of the template to edit',
            },
            name: {
              type: 'string',
              description: 'Updated template name',
            },
            description: {
              type: 'string',
              description: 'Updated description',
            },
            items: {
              type: 'array',
              description: 'Updated list of items',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  isRequired: { type: 'boolean' },
                  allowMultiple: { type: 'boolean' },
                  category: { type: 'string' },
                },
                required: ['title'],
              },
            },
          },
          required: ['templateId'],
        },
      },
    ],
  };
});

// ----------------------------------------------------------------------------
// 2. CALL TOOL HANDLERS
// ----------------------------------------------------------------------------
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!API_KEY) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: 'DROPSPOT_API_KEY environment variable is not configured. Please supply a valid Drop Spot API key.',
        },
      ],
    };
  }

  try {
    switch (name) {
      case 'create_intake_request': {
        const payload = {
          clientName: args?.clientName,
          clientEmail: args?.clientEmail,
          clientPhone: args?.clientPhone,
          title: args?.title,
          dueAt: args?.dueAt,
          sendInvitationEmail: args?.sendInvitationEmail ?? true,
          items: args?.items,
        };

        const res = await apiRequest<any>('/requests', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        return {
          content: [
            {
              type: 'text',
              text: `✅ Intake request created successfully!\n\n` +
                `• ID: ${res.data.id}\n` +
                `• Title: ${res.data.title}\n` +
                `• Client: ${res.data.clientName} (${res.data.clientEmail})\n` +
                `• Magic Portal URL: ${res.data.portalUrl}\n` +
                `• Due Date: ${new Date(res.data.dueAt).toLocaleDateString()}\n` +
                `• Items Requested: ${res.data.items?.length || 0}\n` +
                `• Invitation Email Sent: ${res.data.invitationEmailSent ? 'Yes' : 'No'}`,
            },
          ],
        };
      }

      case 'list_intake_requests': {
        const params = new URLSearchParams();
        if (args?.status) params.set('status', String(args.status));
        if (args?.clientEmail) params.set('client_email', String(args.clientEmail));
        if (args?.limit) params.set('limit', String(args.limit));

        const res = await apiRequest<any>(`/requests?${params.toString()}`);
        const requests = res.data || [];

        if (requests.length === 0) {
          return {
            content: [{ type: 'text', text: 'No intake requests found matching the criteria.' }],
          };
        }

        const formatted = requests
          .map((r: any) => {
            return `• [${r.status.toUpperCase()}] ${r.title} — ${r.clientName} (${r.clientEmail})\n` +
              `  ID: ${r.id} | Progress: ${r.completedItemsCount}/${r.itemsCount} items approved | Due: ${new Date(r.dueAt).toLocaleDateString()}`;
          })
          .join('\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `Found ${requests.length} intake requests:\n\n${formatted}`,
            },
          ],
        };
      }

      case 'get_intake_request': {
        const requestId = String(args?.requestId);
        const res = await apiRequest<any>(`/requests/${requestId}`);
        const d = res.data;

        let itemsReport = (d.items || [])
          .map((item: any, idx: number) => {
            const statusIcon =
              item.status === 'approved' ? '✅' : item.status === 'rejected' ? '❌' : item.status === 'uploaded' ? '📥' : '⏳';
            let fileDetails = '';
            if (item.files && item.files.length > 0) {
              fileDetails = item.files
                .map((f: any) => `\n    - File: ${f.filename} (${Math.round(f.sizeBytes / 1024)} KB) [File ID: ${f.id}]`)
                .join('');
            }
            const rejection = item.rejectionNote ? `\n    - Note: "${item.rejectionNote}"` : '';
            return `${idx + 1}. ${statusIcon} ${item.title} [Status: ${item.status}]${rejection}${fileDetails}`;
          })
          .join('\n');

        const summary =
          `📋 Intake Dossier: ${d.title}\n` +
          `• ID: ${d.id}\n` +
          `• Client: ${d.clientName} <${d.clientEmail}>\n` +
          `• Status: ${d.status}\n` +
          `• Progress: ${d.progress.approvedItems}/${d.progress.requiredItems} required items approved (${d.progress.percent}%)\n` +
          `• Due Date: ${new Date(d.dueAt).toLocaleString()}\n\n` +
          `Checklist Items:\n${itemsReport}`;

        return {
          content: [{ type: 'text', text: summary }],
        };
      }

      case 'review_item': {
        const itemId = String(args?.itemId);
        const decision = String(args?.decision);
        const rejectionNote = args?.rejectionNote ? String(args.rejectionNote) : undefined;

        const res = await apiRequest<any>(`/items/${itemId}/review`, {
          method: 'POST',
          body: JSON.stringify({ decision, rejectionNote }),
        });

        const icon = decision === 'approve' ? '✅' : '❌';
        return {
          content: [
            {
              type: 'text',
              text: `${icon} Item "${res.data.item.title}" has been marked as ${decision.toUpperCase()}.\n` +
                (decision === 'reject' ? `• Rejection feedback dispatched to client: "${res.data.item.rejectionNote}"\n` : '') +
                `• Dossier Completed: ${res.data.request.completed ? 'YES (All required items approved!)' : 'No (Items remaining)'}`,
            },
          ],
        };
      }

      case 'get_file_download_link': {
        const fileId = String(args?.fileId);
        const expiresIn = args?.expiresInSeconds ? Number(args.expiresInSeconds) : 300;

        const res = await apiRequest<any>(`/files/${fileId}/download?expires_in=${expiresIn}`);
        const f = res.data;

        return {
          content: [
            {
              type: 'text',
              text: `🔗 Secure download link generated (valid for ${Math.round(f.expiresInSeconds / 60)} minutes):\n\n` +
                `• Filename: ${f.filename}\n` +
                `• MIME Type: ${f.mimeType}\n` +
                `• Size: ${(f.sizeBytes / 1024).toFixed(1)} KB\n` +
                `• SHA-256: ${f.sha256Hash}\n` +
                `• Direct URL: ${f.downloadUrl}`,
            },
          ],
        };
      }

      // CLIENT HANDLERS
      case 'list_clients': {
        const params = new URLSearchParams();
        if (args?.search) params.set('search', String(args.search));
        if (args?.limit) params.set('limit', String(args.limit));

        const res = await apiRequest<any>(`/clients?${params.toString()}`);
        const clients = res.data || [];

        if (clients.length === 0) {
          return {
            content: [{ type: 'text', text: 'No clients found matching the search criteria.' }],
          };
        }

        const formatted = clients
          .map((c: any) => {
            const company = c.company ? ` | Company: ${c.company}` : '';
            const phone = c.phone ? ` | Phone: ${c.phone}` : '';
            return `• ${c.name} <${c.email}>${company}${phone}\n  ID: ${c.id}`;
          })
          .join('\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `Found ${clients.length} clients:\n\n${formatted}`,
            },
          ],
        };
      }

      case 'get_client': {
        const clientId = String(args?.clientId);
        const res = await apiRequest<any>(`/clients/${clientId}`);
        const c = res.data;

        let requestsSummary = 'No document requests yet.';
        if (c.requests && c.requests.length > 0) {
          requestsSummary = c.requests
            .map((r: any) => `  - [${r.status.toUpperCase()}] ${r.title} (ID: ${r.id})`)
            .join('\n');
        }

        const report =
          `👤 Client Profile: ${c.name}\n` +
          `• ID: ${c.id}\n` +
          `• Email: ${c.email}\n` +
          `• Phone: ${c.phone || 'Not provided'}\n` +
          `• Company: ${c.company || 'Not provided'}\n` +
          `• Notes: ${c.notes || 'None'}\n\n` +
          `Document Intake Requests:\n${requestsSummary}`;

        return {
          content: [{ type: 'text', text: report }],
        };
      }

      case 'create_or_update_client': {
        const payload = {
          name: args?.name,
          email: args?.email,
          phone: args?.phone,
          company: args?.company,
          notes: args?.notes,
        };

        const res = await apiRequest<any>('/clients', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        const c = res.data;
        const actionLabel = c.updatedExisting ? 'Updated existing client record' : 'Created new client record';

        return {
          content: [
            {
              type: 'text',
              text: `✅ ${actionLabel}:\n\n` +
                `• ID: ${c.id}\n` +
                `• Name: ${c.name}\n` +
                `• Email: ${c.email}\n` +
                `• Phone: ${c.phone || 'N/A'}\n` +
                `• Company: ${c.company || 'N/A'}\n` +
                `• Notes: ${c.notes || 'N/A'}`,
            },
          ],
        };
      }

      // TEMPLATE HANDLERS
      case 'list_templates': {
        const params = new URLSearchParams();
        if (args?.includeStarters !== undefined) {
          params.set('includeStarters', String(args.includeStarters));
        }

        const res = await apiRequest<any>(`/templates?${params.toString()}`);
        const templates = res.data || [];

        if (templates.length === 0) {
          return {
            content: [{ type: 'text', text: 'No checklist templates found in this workspace.' }],
          };
        }

        const formatted = templates
          .map((t: any) => {
            const badge = t.isStarter ? ' [STARTER]' : '';
            return `• ${t.name}${badge}\n` +
              `  ID: ${t.id} | Items: ${t.items?.length || 0}\n` +
              `  ${t.description || 'No description'}`;
          })
          .join('\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `Found ${templates.length} templates:\n\n${formatted}`,
            },
          ],
        };
      }

      case 'get_template': {
        const templateId = String(args?.templateId);
        const res = await apiRequest<any>(`/templates/${templateId}`);
        const t = res.data;

        const itemsList = (t.items || [])
          .map((it: any, idx: number) => {
            const req = it.isRequired ? '(Required)' : '(Optional)';
            const multi = it.allowMultiple ? '[Multiple files]' : '';
            return `  ${idx + 1}. ${it.title} ${req} ${multi}\n     ${it.description || ''}`;
          })
          .join('\n');

        const report =
          `📝 Template: ${t.name}\n` +
          `• ID: ${t.id}\n` +
          `• Description: ${t.description || 'None'}\n` +
          `• Starter Template: ${t.isStarter ? 'Yes' : 'No'}\n\n` +
          `Checklist Items (${t.items?.length || 0}):\n${itemsList}`;

        return {
          content: [{ type: 'text', text: report }],
        };
      }

      case 'create_template': {
        const payload = {
          name: args?.name,
          description: args?.description,
          isShared: args?.isShared ?? true,
          items: args?.items,
        };

        const res = await apiRequest<any>('/templates', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        const t = res.data;
        return {
          content: [
            {
              type: 'text',
              text: `✅ Template created successfully!\n\n` +
                `• ID: ${t.id}\n` +
                `• Name: ${t.name}\n` +
                `• Items: ${t.items?.length || 0}\n` +
                `• Description: ${t.description || 'None'}`,
            },
          ],
        };
      }

      case 'update_template': {
        const templateId = String(args?.templateId);
        const payload: Record<string, any> = {};
        if (args?.name !== undefined) payload.name = args.name;
        if (args?.description !== undefined) payload.description = args.description;
        if (args?.items !== undefined) payload.items = args.items;

        const res = await apiRequest<any>(`/templates/${templateId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });

        const t = res.data;
        return {
          content: [
            {
              type: 'text',
              text: `✅ Template updated successfully!\n\n` +
                `• ID: ${t.id}\n` +
                `• Name: ${t.name}\n` +
                `• Items: ${t.items?.length || 0}\n` +
                `• Description: ${t.description || 'None'}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `❌ Drop Spot MCP Error: ${error.message || String(error)}`,
        },
      ],
    };
  }
});

// ----------------------------------------------------------------------------
// 3. RESOURCES: Dynamic Drop Spot Dossier Inspection
// ----------------------------------------------------------------------------
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'dropspot://requests/active',
        name: 'Active Client Intake Requests',
        description: 'Real-time JSON dossier feed of all open document requests in the active workspace.',
        mimeType: 'application/json',
      },
      {
        uri: 'dropspot://clients/all',
        name: 'Workspace Client Directory',
        description: 'Complete client roster including names, emails, phone numbers, and company metadata.',
        mimeType: 'application/json',
      },
      {
        uri: 'dropspot://templates/all',
        name: 'Checklist Templates',
        description: 'All reusable document checklist templates available in the workspace.',
        mimeType: 'application/json',
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  if (uri === 'dropspot://requests/active') {
    const res = await apiRequest<any>('/requests?status=in_process');
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(res.data, null, 2),
        },
      ],
    };
  }

  if (uri === 'dropspot://clients/all') {
    const res = await apiRequest<any>('/clients');
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(res.data, null, 2),
        },
      ],
    };
  }

  if (uri === 'dropspot://templates/all') {
    const res = await apiRequest<any>('/templates');
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(res.data, null, 2),
        },
      ],
    };
  }

  throw new Error(`Resource not found: ${uri}`);
});

// ----------------------------------------------------------------------------
// 4. SERVER INITIALIZATION & TRANSPORT
// ----------------------------------------------------------------------------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Drop Spot MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error initializing Drop Spot MCP server:', error);
  process.exit(1);
});
