/**
 * Example: Building a TODO App with MCP Dev Orchestrator
 *
 * This example demonstrates how to use the orchestrator to build
 * a complete TODO application with React and Node.js
 */

import { OrchestratorRunTool } from '@mcp/dev-orchestrator';

async function buildTodoApp() {
  console.log('🚀 Starting TODO App Development...\n');

  try {
    // Configure the pipeline for a TODO app
    const config = {
      objective: 'Build a full-stack TODO application with React frontend and Node.js backend',
      mode: 'semi', // Use semi mode for approval gates
      context: {
        requirements: [
          'User authentication with JWT',
          'CRUD operations for todos',
          'Mark todos as complete/incomplete',
          'Filter todos by status',
          'Responsive design for mobile and desktop',
          'Data persistence with PostgreSQL',
          'RESTful API design',
          'Input validation and error handling',
        ],
        constraints: [
          'Use React with TypeScript for frontend',
          'Use Express.js for backend API',
          'Use PostgreSQL for database',
          'Implement proper security measures',
          'Include comprehensive tests',
        ],
        technology: ['React', 'TypeScript', 'Node.js', 'Express', 'PostgreSQL', 'JWT', 'Tailwind CSS'],
      },
      agents: {
        architect: {
          enabled: true,
          model: 'gpt-4-turbo',
          temperature: 0.7,
        },
        developer: {
          enabled: true,
          model: 'claude-3-opus',
          temperature: 0.3,
        },
        tester: {
          enabled: true,
          model: 'gpt-4',
          temperature: 0.5,
        },
        debugger: {
          enabled: true,
          model: 'claude-3-opus',
          temperature: 0.2,
        },
      },
      checkpoint: {
        enabled: true,
        interval: 5,
        strategy: 'phase',
      },
    };

    // Execute the pipeline
    console.log('📋 Configuration:', JSON.stringify(config, null, 2));
    console.log('\n🔄 Executing pipeline...\n');

    const result = await OrchestratorRunTool.execute(config);

    // Handle the result
    if (result.success) {
      console.log('✅ TODO App built successfully!\n');
      console.log('📊 Results:');
      console.log(`  - Pipeline ID: ${result.pipelineId}`);
      console.log(`  - Duration: ${result.metrics.totalDuration}ms`);
      console.log(`  - Files Created: ${result.metrics.filesCreated}`);
      console.log(`  - Lines of Code: ${result.metrics.linesOfCode}`);
      console.log(`  - Test Coverage: ${result.metrics.testCoverage}%`);

      console.log('\n📁 Generated Artifacts:');
      console.log(
        '  Frontend:',
        result.artifacts.code.filter((f) => f.includes('frontend')),
      );
      console.log(
        '  Backend:',
        result.artifacts.code.filter((f) => f.includes('backend')),
      );
      console.log('  Tests:', result.artifacts.tests);
      console.log('  Documentation:', result.artifacts.docs);

      console.log('\n🎯 Next Steps:');
      console.log('  1. Review generated code in ./output directory');
      console.log('  2. Install dependencies: npm install');
      console.log('  3. Set up PostgreSQL database');
      console.log('  4. Configure environment variables');
      console.log('  5. Run tests: npm test');
      console.log('  6. Start development server: npm run dev');
    } else {
      console.error('❌ Pipeline failed:', result.error);

      if (result.checkpoint) {
        console.log('\n💾 Checkpoint saved:', result.checkpoint);
        console.log('You can resume from this checkpoint using:');
        console.log(`  mcp-orchestrator resume --checkpoint ${result.checkpoint}`);
      }
    }
  } catch (error) {
    console.error('🔥 Unexpected error:', error);
    process.exit(1);
  }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  buildTodoApp().catch(console.error);
}

export { buildTodoApp };
