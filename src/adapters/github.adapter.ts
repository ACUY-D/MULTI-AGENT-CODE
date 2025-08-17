/**
 * GitHub Adapter
 * Provides integration with GitHub API for repository management and CI/CD
 * Extends BaseProvider for retry logic, circuit breaker, and health checks
 */

import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';
import { BaseProvider, type ProviderConfig, ProviderError } from '../core/providers/base.provider';
import { createLogger } from '../utils/logger';

const logger = createLogger('github-adapter');

// GitHub configuration schema
export const GitHubConfigSchema = z.object({
  token: z.string(),
  owner: z.string(),
  repo: z.string(),
  baseUrl: z.string().optional().default('https://api.github.com'),
  defaultBranch: z.string().optional().default('main'),
  autoAssign: z.array(z.string()).optional(),
  prTemplate: z.string().optional(),
});

export type GitHubConfig = z.infer<typeof GitHubConfigSchema>;

// Branch interface
export interface Branch {
  name: string;
  sha: string;
  protected: boolean;
  createdAt: Date;
}

// Commit interface
export interface Commit {
  sha: string;
  message: string;
  author: string;
  timestamp: Date;
  files: FileChange[];
}

// File change interface
export interface FileChange {
  path: string;
  action: 'add' | 'modify' | 'delete';
  content?: string;
  previousContent?: string;
}

// Pull Request configuration
export interface PRConfig {
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch?: string;
  assignees?: string[];
  reviewers?: string[];
  labels?: string[];
  draft?: boolean;
}

// Pull Request interface
export interface PullRequest {
  id: number;
  number: number;
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
  status: 'open' | 'closed' | 'merged';
  createdAt: Date;
  updatedAt: Date;
  author: string;
  assignees: string[];
  reviewers: string[];
  labels: string[];
  mergeable?: boolean;
  mergeCommitSha?: string;
}

// Issue interface
export interface Issue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  assignees: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Issue filters
export interface IssueFilters {
  state?: 'open' | 'closed' | 'all';
  labels?: string[];
  assignee?: string;
  creator?: string;
  sort?: 'created' | 'updated' | 'comments';
}

// File content interface
export interface FileContent {
  path: string;
  content: string;
  encoding: string;
  sha: string;
  size: number;
}

// Workflow interface
export interface Workflow {
  id: number;
  name: string;
  path: string;
  state: 'active' | 'disabled';
}

// Workflow run interface
export interface WorkflowRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped';
  createdAt: Date;
  updatedAt: Date;
  runNumber: number;
  htmlUrl: string;
}

// Review comment interface
export interface ReviewComment {
  id: number;
  body: string;
  path: string;
  line: number;
  author: string;
  createdAt: Date;
}

// GitHub Adapter class
export class GitHubAdapter extends BaseProvider {
  private client: Client | null = null;
  private githubConfig: GitHubConfig | null = null;
  private token = '';
  private repo = '';
  private owner = '';
  private mcpTransport: StdioClientTransport | null = null;

  constructor(config?: Partial<ProviderConfig>) {
    super({
      name: 'github',
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      ...config,
    });

    logger.info('GitHub adapter initialized with BaseProvider');
  }

  /**
   * Connect to GitHub MCP server
   */
  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to GitHub MCP server');

      // Initialize MCP client
      this.mcpTransport = new StdioClientTransport({
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: {
          ...process.env,
          GITHUB_PERSONAL_ACCESS_TOKEN: this.token,
        },
      });

      this.client = new Client(
        {
          name: 'github-adapter',
          version: '1.0.0',
        },
        {
          capabilities: {},
        },
      );

      await this.client.connect(this.mcpTransport);
      this.connected = true;

      this.logger.info('Successfully connected to GitHub MCP server');
    } catch (error) {
      this.connected = false;
      throw new ProviderError(`Failed to connect to GitHub: ${(error as Error).message}`, 'github', 'connect', true);
    }
  }

  /**
   * Disconnect from GitHub MCP server
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }

    if (this.mcpTransport) {
      await this.mcpTransport.close();
      this.mcpTransport = null;
    }

    this.connected = false;
    this.logger.info('Disconnected from GitHub MCP server');
  }

  /**
   * Check if the provider is healthy
   */
  async isHealthy(): Promise<boolean> {
    if (!this.connected || !this.client) {
      return false;
    }

    try {
      // Try to list available tools as a health check
      const result = await this.client.listTools();
      return result.tools.length > 0;
    } catch (error) {
      this.logger.error('Health check failed', error);
      return false;
    }
  }

  /**
   * Initialize with configuration
   */
  async initialize(config: unknown): Promise<void> {
    this.githubConfig = GitHubConfigSchema.parse(config);
    this.token = this.githubConfig.token;
    this.owner = this.githubConfig.owner;
    this.repo = this.githubConfig.repo;

    await this.connect();
  }

  /**
   * Create a new branch
   */
  async createBranch(name: string, fromBranch?: string): Promise<Branch> {
    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Not connected to GitHub');

      const baseBranch = fromBranch || this.githubConfig?.defaultBranch || 'main';

      this.logger.info(`Creating branch ${name} from ${baseBranch}`);

      // Get base branch SHA
      const baseRef = await this.client.callTool('get_ref', {
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${baseBranch}`,
      });

      // Create new branch
      const result = await this.client.callTool('create_ref', {
        owner: this.owner,
        repo: this.repo,
        ref: `refs/heads/${name}`,
        sha: baseRef.content.object.sha,
      });

      return {
        name,
        sha: result.content.object.sha,
        protected: false,
        createdAt: new Date(),
      };
    }, 'createBranch');
  }

  /**
   * Create a commit with multiple file changes
   */
  async createCommit(branch: string, files: FileChange[], message: string): Promise<Commit> {
    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Not connected to GitHub');

      this.logger.info(`Creating commit on branch ${branch} with ${files.length} file changes`);

      // Format commit message using conventional commits
      const formattedMessage = this.formatCommitMessage(message);

      // Get current tree SHA
      const branchRef = await this.client.callTool('get_ref', {
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${branch}`,
      });

      const currentCommit = await this.client.callTool('get_commit', {
        owner: this.owner,
        repo: this.repo,
        commit_sha: branchRef.content.object.sha,
      });

      // Create blobs for each file
      const blobs = await Promise.all(
        files.map(async (file) => {
          if (file.action === 'delete') {
            return { path: file.path, mode: '100644', type: 'blob', sha: null };
          }

          const blob = await this.client!.callTool('create_blob', {
            owner: this.owner,
            repo: this.repo,
            content: Buffer.from(file.content || '').toString('base64'),
            encoding: 'base64',
          });

          return {
            path: file.path,
            mode: '100644',
            type: 'blob',
            sha: blob.content.sha,
          };
        }),
      );

      // Create tree
      const tree = await this.client.callTool('create_tree', {
        owner: this.owner,
        repo: this.repo,
        base_tree: currentCommit.content.tree.sha,
        tree: blobs.filter((b) => b.sha !== null),
      });

      // Create commit
      const commit = await this.client.callTool('create_commit', {
        owner: this.owner,
        repo: this.repo,
        message: formattedMessage,
        tree: tree.content.sha,
        parents: [branchRef.content.object.sha],
      });

      // Update branch reference
      await this.client.callTool('update_ref', {
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${branch}`,
        sha: commit.content.sha,
      });

      return {
        sha: commit.content.sha,
        message: formattedMessage,
        author: commit.content.author.name,
        timestamp: new Date(commit.content.author.date),
        files,
      };
    }, 'createCommit');
  }

  /**
   * Create a pull request
   */
  async createPullRequest(config: PRConfig): Promise<PullRequest> {
    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Not connected to GitHub');

      const targetBranch = config.targetBranch || this.githubConfig?.defaultBranch || 'main';
      const assignees = config.assignees || this.githubConfig?.autoAssign || [];

      this.logger.info(`Creating PR from ${config.sourceBranch} to ${targetBranch}`);

      // Apply PR template if available
      const body = this.githubConfig?.prTemplate
        ? this.applyPRTemplate(config.description, this.githubConfig.prTemplate)
        : config.description;

      // Create pull request
      const pr = await this.client.callTool('create_pull_request', {
        owner: this.owner,
        repo: this.repo,
        title: config.title,
        head: config.sourceBranch,
        base: targetBranch,
        body,
        draft: config.draft || false,
      });

      const prNumber = pr.content.number;

      // Add assignees
      if (assignees.length > 0) {
        await this.client.callTool('add_assignees', {
          owner: this.owner,
          repo: this.repo,
          issue_number: prNumber,
          assignees,
        });
      }

      // Add reviewers
      if (config.reviewers && config.reviewers.length > 0) {
        await this.client.callTool('request_reviewers', {
          owner: this.owner,
          repo: this.repo,
          pull_number: prNumber,
          reviewers: config.reviewers,
        });
      }

      // Add labels
      if (config.labels && config.labels.length > 0) {
        await this.client.callTool('add_labels', {
          owner: this.owner,
          repo: this.repo,
          issue_number: prNumber,
          labels: config.labels,
        });
      }

      return {
        id: pr.content.id,
        number: prNumber,
        title: config.title,
        description: body,
        sourceBranch: config.sourceBranch,
        targetBranch,
        status: pr.content.state,
        createdAt: new Date(pr.content.created_at),
        updatedAt: new Date(pr.content.updated_at),
        author: pr.content.user.login,
        assignees,
        reviewers: config.reviewers || [],
        labels: config.labels || [],
        mergeable: pr.content.mergeable,
      };
    }, 'createPullRequest');
  }

  /**
   * List issues with filters
   */
  async listIssues(filters?: IssueFilters): Promise<Issue[]> {
    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Not connected to GitHub');

      this.logger.info('Listing issues', { filters });

      const result = await this.client.callTool('list_issues', {
        owner: this.owner,
        repo: this.repo,
        state: filters?.state || 'open',
        labels: filters?.labels?.join(','),
        assignee: filters?.assignee,
        creator: filters?.creator,
        sort: filters?.sort || 'created',
      });

      return result.content.map((issue: any) => ({
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        labels: issue.labels.map((l: any) => l.name),
        assignees: issue.assignees.map((a: any) => a.login),
        createdAt: new Date(issue.created_at),
        updatedAt: new Date(issue.updated_at),
      }));
    }, 'listIssues');
  }

  /**
   * Create an issue
   */
  async createIssue(title: string, body: string, labels?: string[]): Promise<Issue> {
    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Not connected to GitHub');

      this.logger.info(`Creating issue: ${title}`);

      const issue = await this.client.callTool('create_issue', {
        owner: this.owner,
        repo: this.repo,
        title,
        body,
        labels,
      });

      return {
        id: issue.content.id,
        number: issue.content.number,
        title: issue.content.title,
        body: issue.content.body,
        state: issue.content.state,
        labels: issue.content.labels.map((l: any) => l.name),
        assignees: issue.content.assignees.map((a: any) => a.login),
        createdAt: new Date(issue.content.created_at),
        updatedAt: new Date(issue.content.updated_at),
      };
    }, 'createIssue');
  }

  /**
   * Get file content from repository
   */
  async getFileContent(path: string, branch?: string): Promise<FileContent> {
    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Not connected to GitHub');

      const ref = branch || this.githubConfig?.defaultBranch || 'main';

      this.logger.info(`Getting file content: ${path} from ${ref}`);

      const result = await this.client.callTool('get_content', {
        owner: this.owner,
        repo: this.repo,
        path,
        ref,
      });

      return {
        path: result.content.path,
        content: Buffer.from(result.content.content, 'base64').toString('utf-8'),
        encoding: result.content.encoding,
        sha: result.content.sha,
        size: result.content.size,
      };
    }, 'getFileContent');
  }

  /**
   * List workflows in the repository
   */
  async listWorkflows(): Promise<Workflow[]> {
    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Not connected to GitHub');

      this.logger.info('Listing workflows');

      const result = await this.client.callTool('list_workflows', {
        owner: this.owner,
        repo: this.repo,
      });

      return result.content.workflows.map((workflow: any) => ({
        id: workflow.id,
        name: workflow.name,
        path: workflow.path,
        state: workflow.state,
      }));
    }, 'listWorkflows');
  }

  /**
   * Trigger a workflow
   */
  async triggerWorkflow(workflowId: string, inputs?: Record<string, any>): Promise<WorkflowRun> {
    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Not connected to GitHub');

      const ref = this.githubConfig?.defaultBranch || 'main';

      this.logger.info(`Triggering workflow ${workflowId}`);

      // Trigger workflow
      await this.client.callTool('create_workflow_dispatch', {
        owner: this.owner,
        repo: this.repo,
        workflow_id: workflowId,
        ref,
        inputs,
      });

      // Wait a moment for the run to be created
      await this.sleep(2000);

      // Get the latest run
      const runs = await this.client.callTool('list_workflow_runs', {
        owner: this.owner,
        repo: this.repo,
        workflow_id: workflowId,
        per_page: 1,
      });

      const run = runs.content.workflow_runs[0];

      return {
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        createdAt: new Date(run.created_at),
        updatedAt: new Date(run.updated_at),
        runNumber: run.run_number,
        htmlUrl: run.html_url,
      };
    }, 'triggerWorkflow');
  }

  /**
   * Merge a pull request
   */
  async mergePullRequest(prNumber: number, mergeMethod: 'merge' | 'squash' | 'rebase' = 'merge'): Promise<void> {
    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Not connected to GitHub');

      this.logger.info(`Merging PR #${prNumber} with method ${mergeMethod}`);

      await this.client.callTool('merge_pull_request', {
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        merge_method: mergeMethod,
      });
    }, 'mergePullRequest');
  }

  /**
   * Delete a branch
   */
  async deleteBranch(branchName: string): Promise<void> {
    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Not connected to GitHub');

      this.logger.info(`Deleting branch ${branchName}`);

      await this.client.callTool('delete_ref', {
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${branchName}`,
      });
    }, 'deleteBranch');
  }

  /**
   * Add a review comment to a pull request
   */
  async addReviewComment(prNumber: number, body: string, path: string, line: number): Promise<ReviewComment> {
    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Not connected to GitHub');

      this.logger.info(`Adding review comment to PR #${prNumber}`);

      const comment = await this.client.callTool('create_review_comment', {
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        body,
        path,
        line,
        side: 'RIGHT',
      });

      return {
        id: comment.content.id,
        body: comment.content.body,
        path: comment.content.path,
        line: comment.content.line,
        author: comment.content.user.login,
        createdAt: new Date(comment.content.created_at),
      };
    }, 'addReviewComment');
  }

  /**
   * Setup webhook for CI/CD
   */
  async setupWebhook(url: string, events: string[] = ['push', 'pull_request', 'workflow_run']): Promise<void> {
    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Not connected to GitHub');

      this.logger.info(`Setting up webhook for ${url}`);

      await this.client.callTool('create_webhook', {
        owner: this.owner,
        repo: this.repo,
        config: {
          url,
          content_type: 'json',
        },
        events,
        active: true,
      });
    }, 'setupWebhook');
  }

  /**
   * Get repository statistics
   */
  async getRepoStats(): Promise<Record<string, any>> {
    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Not connected to GitHub');

      this.logger.info('Getting repository statistics');

      const [repo, contributors, languages] = await Promise.all([
        this.client.callTool('get_repo', {
          owner: this.owner,
          repo: this.repo,
        }),
        this.client.callTool('list_contributors', {
          owner: this.owner,
          repo: this.repo,
        }),
        this.client.callTool('list_languages', {
          owner: this.owner,
          repo: this.repo,
        }),
      ]);

      return {
        name: repo.content.name,
        fullName: repo.content.full_name,
        description: repo.content.description,
        stars: repo.content.stargazers_count,
        forks: repo.content.forks_count,
        watchers: repo.content.watchers_count,
        openIssues: repo.content.open_issues_count,
        language: repo.content.language,
        languages: languages.content,
        contributors: contributors.content.length,
        createdAt: repo.content.created_at,
        updatedAt: repo.content.updated_at,
      };
    }, 'getRepoStats');
  }

  /**
   * Format commit message using conventional commits
   */
  private formatCommitMessage(message: string): string {
    // If already formatted, return as is
    if (/^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?:/.test(message)) {
      return message;
    }

    // Try to infer type from message
    const lowerMessage = message.toLowerCase();
    let type = 'chore';

    if (lowerMessage.includes('fix') || lowerMessage.includes('bug')) {
      type = 'fix';
    } else if (lowerMessage.includes('feat') || lowerMessage.includes('add')) {
      type = 'feat';
    } else if (lowerMessage.includes('doc')) {
      type = 'docs';
    } else if (lowerMessage.includes('test')) {
      type = 'test';
    } else if (lowerMessage.includes('refactor')) {
      type = 'refactor';
    }

    return `${type}: ${message}`;
  }

  /**
   * Apply PR template to description
   */
  private applyPRTemplate(description: string, template: string): string {
    return template
      .replace('{{description}}', description)
      .replace('{{date}}', new Date().toISOString().split('T')[0])
      .replace('{{author}}', process.env.USER || 'unknown');
  }

  /**
   * Validate branch name
   */
  private validateBranchName(name: string): boolean {
    // Check for valid Git branch name
    const invalidChars = /[\s~^:?*\[\]\\]/;
    const validPrefix = /^(feature|bugfix|hotfix|release|develop|main|master)\//;

    if (invalidChars.test(name)) {
      this.logger.warn(`Invalid branch name: ${name} contains invalid characters`);
      return false;
    }

    if (!validPrefix.test(name) && !['main', 'master', 'develop'].includes(name)) {
      this.logger.warn(`Branch name ${name} should follow naming convention`);
    }

    return true;
  }
}

// Export singleton instance
export const githubAdapter = new GitHubAdapter();
