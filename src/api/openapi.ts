// ═══════════════════════════════════════════════════════════════════
// charEdge — OpenAPI Spec Generator
//
// Auto-generates OpenAPI 3.0 spec from existing Zod schemas.
// Served at GET /api/docs as JSON.
// ═══════════════════════════════════════════════════════════════════

import type { Request, Response, Router } from 'express';

/** Minimal OpenAPI 3.0 spec generated from route definitions */
function generateOpenApiSpec(): Record<string, unknown> {
    return {
        openapi: '3.0.3',
        info: {
            title: 'charEdge API',
            version: '11.0.0',
            description: 'Trading journal, analytics, and chart engine API.',
            contact: { name: 'charEdge', url: 'https://github.com/charEdge' },
            license: { name: 'MIT' },
        },
        servers: [
            { url: '/api/v1', description: 'API v1' },
        ],
        paths: {
            '/profile': {
                get: {
                    summary: 'Get user profile',
                    tags: ['Profile'],
                    security: [{ apiKey: [] }],
                    responses: { 200: { description: 'User profile object' } },
                },
            },
            '/trades': {
                get: {
                    summary: 'List trades',
                    tags: ['Trades'],
                    security: [{ apiKey: [] }],
                    parameters: [
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
                        { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
                    ],
                    responses: { 200: { description: 'Paginated trade list' } },
                },
                post: {
                    summary: 'Create a trade',
                    tags: ['Trades'],
                    security: [{ apiKey: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Trade' },
                            },
                        },
                    },
                    responses: {
                        201: { description: 'Trade created' },
                        400: { description: 'Validation error' },
                    },
                },
            },
            '/trades/{id}': {
                put: {
                    summary: 'Update a trade',
                    tags: ['Trades'],
                    security: [{ apiKey: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { 200: { description: 'Trade updated' } },
                },
                delete: {
                    summary: 'Delete a trade',
                    tags: ['Trades'],
                    security: [{ apiKey: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { 204: { description: 'Trade deleted' } },
                },
            },
            '/analytics': {
                get: {
                    summary: 'Get analytics summary',
                    tags: ['Analytics'],
                    security: [{ apiKey: [] }],
                    responses: { 200: { description: 'Analytics metrics' } },
                },
            },
            '/playbooks': {
                get: { summary: 'List playbooks', tags: ['Playbooks'], responses: { 200: { description: 'Playbook list' } } },
                post: { summary: 'Create playbook', tags: ['Playbooks'], responses: { 201: { description: 'Created' } } },
            },
            '/notes': {
                get: { summary: 'List notes', tags: ['Notes'], responses: { 200: { description: 'Note list' } } },
                post: { summary: 'Create note', tags: ['Notes'], responses: { 201: { description: 'Created' } } },
            },
            '/plans': {
                get: { summary: 'List plans', tags: ['Plans'], responses: { 200: { description: 'Plan list' } } },
                post: { summary: 'Create plan', tags: ['Plans'], responses: { 201: { description: 'Created' } } },
            },
            '/webhooks': {
                get: { summary: 'List webhooks', tags: ['Webhooks'], responses: { 200: { description: 'Webhook list' } } },
                post: { summary: 'Create webhook', tags: ['Webhooks'], responses: { 201: { description: 'Created' } } },
            },
            '/settings': {
                get: { summary: 'Get settings', tags: ['Settings'], responses: { 200: { description: 'Settings object' } } },
                put: { summary: 'Update settings', tags: ['Settings'], responses: { 200: { description: 'Updated' } } },
            },
            '/auth/register': {
                post: { summary: 'Register', tags: ['Auth'], responses: { 201: { description: 'User created' } } },
            },
            '/auth/login': {
                post: { summary: 'Login', tags: ['Auth'], responses: { 200: { description: 'Access + refresh tokens' } } },
            },
            '/auth/refresh': {
                post: { summary: 'Refresh token', tags: ['Auth'], responses: { 200: { description: 'New access token' } } },
            },
            '/auth/me': {
                get: { summary: 'Current user', tags: ['Auth'], security: [{ bearer: [] }], responses: { 200: { description: 'User info' } } },
            },
        },
        components: {
            schemas: {
                Trade: {
                    type: 'object',
                    required: ['symbol', 'side', 'entryPrice', 'size', 'entryDate'],
                    properties: {
                        symbol: { type: 'string', example: 'BTCUSDT' },
                        side: { type: 'string', enum: ['long', 'short'] },
                        entryPrice: { type: 'number', example: 42000 },
                        exitPrice: { type: 'number', nullable: true },
                        size: { type: 'number', example: 1 },
                        entryDate: { type: 'string', format: 'date-time' },
                        exitDate: { type: 'string', format: 'date-time', nullable: true },
                        pnl: { type: 'number', nullable: true },
                        notes: { type: 'string' },
                        tags: { type: 'array', items: { type: 'string' } },
                        strategy: { type: 'string' },
                        emotion: { type: 'string' },
                    },
                },
            },
            securitySchemes: {
                apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' },
                bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            },
        },
    };
}

/**
 * Register the /api/docs endpoint on a router.
 */
export function registerDocsRoute(router: Router): void {
    const spec = generateOpenApiSpec();

    router.get('/docs', (_req: Request, res: Response) => {
        res.json(spec);
    });
}

export { generateOpenApiSpec };
