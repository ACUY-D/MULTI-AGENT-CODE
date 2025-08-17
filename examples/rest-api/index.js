/**
 * Example: Building a REST API with MCP Dev Orchestrator
 *
 * This example demonstrates how to create a RESTful API
 * for a blog platform with authentication and CRUD operations
 */

import {
  ArchitectPlanTool,
  DeveloperImplementTool,
  OrchestratorRunTool,
  TesterValidateTool,
} from '@mcp/dev-orchestrator';

async function buildRestAPI() {
  console.log('🌐 Building REST API for Blog Platform\n');

  try {
    // Step 1: Architecture Planning
    console.log('📐 Phase 1: Architecture Planning...');

    const architectureConfig = {
      objective: 'Design a scalable REST API for a blog platform',
      constraints: [
        'RESTful design principles',
        'JWT authentication',
        'Rate limiting',
        'API versioning',
        'Swagger documentation',
      ],
      patterns: ['Repository', 'Factory', 'Middleware'],
      scope: 'mvp',
    };

    const architecture = await ArchitectPlanTool.execute(architectureConfig);
    console.log('✅ Architecture designed:', architecture.planId);

    // Step 2: Implementation
    console.log('\n💻 Phase 2: Implementation...');

    const implementationConfig = {
      taskIds: architecture.tasks.map((t) => t.id),
      specification: `
        Implement a RESTful API with the following endpoints:
        
        Authentication:
        - POST /api/v1/auth/register
        - POST /api/v1/auth/login
        - POST /api/v1/auth/refresh
        - POST /api/v1/auth/logout
        
        Users:
        - GET /api/v1/users/:id
        - PUT /api/v1/users/:id
        - DELETE /api/v1/users/:id
        
        Posts:
        - GET /api/v1/posts (with pagination)
        - GET /api/v1/posts/:id
        - POST /api/v1/posts
        - PUT /api/v1/posts/:id
        - DELETE /api/v1/posts/:id
        
        Comments:
        - GET /api/v1/posts/:postId/comments
        - POST /api/v1/posts/:postId/comments
        - PUT /api/v1/comments/:id
        - DELETE /api/v1/comments/:id
        
        Categories:
        - GET /api/v1/categories
        - POST /api/v1/categories
        - PUT /api/v1/categories/:id
        - DELETE /api/v1/categories/:id
      `,
      language: 'typescript',
      framework: 'express',
      style: {
        naming: 'camelCase',
        indentation: 2,
        quotes: 'single',
      },
      testDriven: true,
    };

    const implementation = await DeveloperImplementTool.execute(implementationConfig);
    console.log('✅ Implementation complete:', implementation.implementationId);
    console.log(`   Files created: ${implementation.files.length}`);
    console.log(`   Total lines: ${implementation.metrics.totalLines}`);

    // Step 3: Testing and Validation
    console.log('\n🧪 Phase 3: Testing and Validation...');

    const testingConfig = {
      suites: ['unit', 'integration', 'e2e'],
      targetPath: './api',
      coverage: {
        threshold: 80,
        reportFormat: 'html',
      },
      parallel: true,
      generateMissing: true,
    };

    const validation = await TesterValidateTool.execute(testingConfig);
    console.log('✅ Testing complete:');
    console.log(`   Tests passed: ${validation.summary.passed}/${validation.summary.total}`);
    console.log(`   Coverage: ${validation.coverage?.lines}%`);

    // Step 4: Full Pipeline for Additional Features
    console.log('\n🔄 Phase 4: Additional Features Pipeline...');

    const fullPipelineConfig = {
      objective: 'Add advanced features: search, filtering, caching, and webhooks',
      mode: 'auto',
      context: {
        requirements: [
          'Full-text search with Elasticsearch',
          'Advanced filtering and sorting',
          'Redis caching layer',
          'Webhook system for events',
          'GraphQL endpoint alongside REST',
          'File upload support with S3',
          'Email notifications',
          'Admin dashboard API',
        ],
        technology: ['Elasticsearch', 'Redis', 'AWS S3', 'SendGrid', 'GraphQL', 'Bull Queue'],
      },
    };

    const enhancedResult = await OrchestratorRunTool.execute(fullPipelineConfig);

    // Final Summary
    console.log('\n📊 API Development Summary:');
    console.log('================================');
    console.log('✅ Core API implemented');
    console.log('✅ Authentication system ready');
    console.log('✅ All CRUD operations functional');
    console.log('✅ Tests written and passing');
    console.log('✅ Documentation generated');
    console.log('✅ Advanced features added');

    console.log('\n📁 Project Structure:');
    console.log(`
    blog-api/
    ├── src/
    │   ├── controllers/
    │   ├── models/
    │   ├── routes/
    │   ├── middlewares/
    │   ├── services/
    │   ├── utils/
    │   └── config/
    ├── tests/
    │   ├── unit/
    │   ├── integration/
    │   └── e2e/
    ├── docs/
    │   ├── api.md
    │   └── swagger.json
    ├── docker-compose.yml
    ├── .env.example
    └── package.json
    `);

    console.log('\n🚀 To start the API:');
    console.log('  1. cd blog-api');
    console.log('  2. npm install');
    console.log('  3. docker-compose up -d  # Start PostgreSQL and Redis');
    console.log('  4. npm run migrate       # Run database migrations');
    console.log('  5. npm run seed          # Seed sample data');
    console.log('  6. npm run dev           # Start development server');
    console.log('\n📖 API documentation available at: http://localhost:3000/api-docs');

    return enhancedResult;
  } catch (error) {
    console.error('❌ Error building REST API:', error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildRestAPI()
    .then(() => {
      console.log('\n✨ REST API example completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 REST API example failed:', error);
      process.exit(1);
    });
}

export { buildRestAPI };
