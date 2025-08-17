/**
 * Memory Adapter
 * Provides integration with Memory MCP server for knowledge graph management
 * Extends BaseProvider for retry logic, circuit breaker, and health checks
 */

import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as fs from 'fs/promises';
import { z } from 'zod';
import { BaseProvider, type ProviderConfig, ProviderError } from '../core/providers/base.provider';
import { createLogger } from '../utils/logger';

const logger = createLogger('memory-adapter');

// Memory configuration schema
export const MemoryConfigSchema = z.object({
  serverUrl: z.string().optional(),
  namespace: z.string().optional().default('default'),
  persistenceDir: z.string().optional().default('./.memory-cache'),
  enableVersioning: z.boolean().optional().default(true),
  maxVersions: z.number().optional().default(10),
  enableCache: z.boolean().optional().default(true),
  cacheSize: z.number().optional().default(1000),
  cacheTTL: z.number().optional().default(3600000), // 1 hour
});

export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;

// Metadata interface
export interface Metadata {
  version?: number;
  timestamp?: Date;
  author?: string;
  tags?: string[];
  namespace?: string;
  [key: string]: unknown;
}

// Node interface for knowledge graph
export interface Node {
  id: string;
  name: string;
  type: string;
  properties: Record<string, unknown>;
  observations: string[];
  metadata: Metadata;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// Relationship types
export type RelationType =
  | 'depends_on'
  | 'implements'
  | 'extends'
  | 'uses'
  | 'creates'
  | 'modifies'
  | 'deletes'
  | 'triggers'
  | 'blocks'
  | 'relates_to';

// Path interface for graph traversal
export interface Path {
  nodes: string[];
  edges: Array<{ from: string; to: string; type: RelationType }>;
  length: number;
  weight?: number;
}

// Graph interface
export interface Graph {
  nodes: Map<string, Node>;
  edges: Map<string, Set<{ to: string; type: RelationType }>>;
  metadata: Metadata;
}

// Search filters
export interface SearchFilters {
  type?: string;
  namespace?: string;
  tags?: string[];
  minVersion?: number;
  maxVersion?: number;
  createdAfter?: Date;
  createdBefore?: Date;
}

// Search result
export interface SearchResult {
  node: Node;
  relevance: number;
  highlights?: string[];
}

// Cache entry
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
}

// Memory Adapter class
export class MemoryAdapter extends BaseProvider {
  private client: Client | null = null;
  private memoryConfig: MemoryConfig | null = null;
  private mcpTransport: StdioClientTransport | null = null;

  // Local knowledge graph for fallback and caching
  private localGraph: Graph = {
    nodes: new Map(),
    edges: new Map(),
    metadata: { namespace: 'default', version: 1 },
  };

  // Namespaces
  private namespaces: Map<string, Graph> = new Map();
  private currentNamespace = 'default';

  // Cache
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cacheEnabled = true;

  // Version history
  private versionHistory: Map<string, Node[]> = new Map();

  constructor(config?: Partial<ProviderConfig>) {
    super({
      name: 'memory',
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      ...config,
    });

    // Initialize default namespaces
    this.initializeNamespaces();

    logger.info('Memory adapter initialized with BaseProvider');
  }

  /**
   * Initialize default namespaces
   */
  private initializeNamespaces(): void {
    const defaultNamespaces = ['plan', 'status', 'decisions', 'artifacts', 'default'];

    defaultNamespaces.forEach((ns) => {
      this.namespaces.set(ns, {
        nodes: new Map(),
        edges: new Map(),
        metadata: { namespace: ns, version: 1 },
      });
    });
  }

  /**
   * Connect to Memory MCP server
   */
  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to Memory MCP server');

      // Initialize MCP client
      this.mcpTransport = new StdioClientTransport({
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
      });

      this.client = new Client(
        {
          name: 'memory-adapter',
          version: '1.0.0',
        },
        {
          capabilities: {},
        },
      );

      await this.client.connect(this.mcpTransport);
      this.connected = true;

      // Load persisted data if available
      if (this.memoryConfig?.persistenceDir) {
        await this.loadPersistedData();
      }

      this.logger.info('Successfully connected to Memory MCP server');
    } catch (error) {
      this.connected = false;
      this.logger.warn('Failed to connect to MCP server, using local fallback');
      // Don't throw, use local fallback
    }
  }

  /**
   * Disconnect from Memory MCP server
   */
  async disconnect(): Promise<void> {
    // Persist data before disconnecting
    if (this.memoryConfig?.persistenceDir) {
      await this.persistData();
    }

    if (this.client) {
      await this.client.close();
      this.client = null;
    }

    if (this.mcpTransport) {
      await this.mcpTransport.close();
      this.mcpTransport = null;
    }

    this.connected = false;
    this.logger.info('Disconnected from Memory MCP server');
  }

  /**
   * Check if the provider is healthy
   */
  async isHealthy(): Promise<boolean> {
    // Memory adapter is healthy if local graph is available
    // MCP connection is optional
    return this.localGraph.nodes.size >= 0;
  }

  /**
   * Initialize with configuration
   */
  async initialize(config: unknown): Promise<void> {
    this.memoryConfig = MemoryConfigSchema.parse(config);
    this.cacheEnabled = this.memoryConfig.enableCache;

    await this.connect();
  }

  /**
   * Store a value in the knowledge graph
   */
  async store(key: string, value: unknown, metadata?: Metadata): Promise<void> {
    return this.executeWithRetry(async () => {
      const namespace = metadata?.namespace || this.currentNamespace;
      const nodeId = `${namespace}:${key}`;

      const node: Node = {
        id: nodeId,
        name: key,
        type: typeof value,
        properties: { value },
        observations: [],
        metadata: {
          ...metadata,
          namespace,
          timestamp: new Date(),
          version: 1,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      };

      // Store in MCP if connected
      if (this.client && this.connected) {
        await this.client.callTool('create_entities', {
          entities: [
            {
              name: key,
              entityType: node.type,
              observations: [`Stored value: ${JSON.stringify(value)}`],
            },
          ],
        });
      }

      // Always store locally
      this.storeNodeLocally(node);

      // Invalidate cache
      this.invalidateCache(key);

      this.logger.info(`Stored ${key} in namespace ${namespace}`);
    }, 'store');
  }

  /**
   * Retrieve a value from the knowledge graph
   */
  async retrieve(key: string): Promise<unknown> {
    return this.executeWithRetry(async () => {
      // Check cache first
      if (this.cacheEnabled) {
        const cached = this.getFromCache(key);
        if (cached !== undefined) {
          return cached;
        }
      }

      const nodeId = `${this.currentNamespace}:${key}`;

      // Try MCP first
      if (this.client && this.connected) {
        try {
          const result = await this.client.callTool('open_nodes', {
            names: [key],
          });

          if (result.content.entities && result.content.entities.length > 0) {
            const entity = result.content.entities[0];
            const value = this.parseEntityValue(entity);

            // Update cache
            if (this.cacheEnabled) {
              this.addToCache(key, value);
            }

            return value;
          }
        } catch (error) {
          this.logger.warn(`Failed to retrieve from MCP, using local: ${error}`);
        }
      }

      // Fallback to local
      const graph = this.namespaces.get(this.currentNamespace) || this.localGraph;
      const node = graph.nodes.get(nodeId);

      if (node) {
        const value = node.properties.value;

        // Update cache
        if (this.cacheEnabled) {
          this.addToCache(key, value);
        }

        return value;
      }

      return undefined;
    }, 'retrieve');
  }

  /**
   * Search for nodes in the knowledge graph
   */
  async search(query: string, filters?: SearchFilters): Promise<SearchResult[]> {
    return this.executeWithRetry(async () => {
      const results: SearchResult[] = [];

      // Search in MCP if connected
      if (this.client && this.connected) {
        try {
          const mcpResults = await this.client.callTool('search_nodes', {
            query,
          });

          if (mcpResults.content.results) {
            for (const result of mcpResults.content.results) {
              results.push({
                node: this.convertToNode(result),
                relevance: result.score || 0,
                highlights: result.highlights,
              });
            }
          }
        } catch (error) {
          this.logger.warn(`MCP search failed, using local: ${error}`);
        }
      }

      // Also search locally
      const namespace = filters?.namespace || this.currentNamespace;
      const graph = this.namespaces.get(namespace) || this.localGraph;

      for (const [id, node] of graph.nodes) {
        if (this.matchesSearch(node, query, filters)) {
          const relevance = this.calculateRelevance(node, query);
          results.push({ node, relevance });
        }
      }

      // Sort by relevance and deduplicate
      return this.deduplicateAndSort(results);
    }, 'search');
  }

  /**
   * Create a relationship between nodes
   */
  async createRelationship(from: string, to: string, type: RelationType): Promise<void> {
    return this.executeWithRetry(async () => {
      // Create in MCP if connected
      if (this.client && this.connected) {
        await this.client.callTool('create_relations', {
          relations: [
            {
              from,
              to,
              relationType: type,
            },
          ],
        });
      }

      // Always create locally
      this.createRelationshipLocally(from, to, type);

      this.logger.info(`Created relationship: ${from} --[${type}]--> ${to}`);
    }, 'createRelationship');
  }

  /**
   * Get related nodes with depth traversal
   */
  async getRelatedNodes(nodeId: string, depth = 1): Promise<Node[]> {
    return this.executeWithRetry(async () => {
      const visited = new Set<string>();
      const relatedNodes: Node[] = [];

      await this.traverseGraph(nodeId, depth, visited, relatedNodes);

      return relatedNodes;
    }, 'getRelatedNodes');
  }

  /**
   * Update a node in the graph
   */
  async updateNode(nodeId: string, data: Partial<Node>): Promise<void> {
    return this.executeWithRetry(async () => {
      const existingNode = await this.getNode(nodeId);

      if (!existingNode) {
        throw new Error(`Node ${nodeId} not found`);
      }

      // Version the old node if versioning is enabled
      if (this.memoryConfig?.enableVersioning) {
        this.addToVersionHistory(existingNode);
      }

      const updatedNode: Node = {
        ...existingNode,
        ...data,
        updatedAt: new Date(),
        version: existingNode.version + 1,
      };

      // Update in MCP if connected
      if (this.client && this.connected) {
        await this.client.callTool('add_observations', {
          observations: [
            {
              entityName: nodeId.split(':')[1],
              contents: [`Updated: ${JSON.stringify(data)}`],
            },
          ],
        });
      }

      // Always update locally
      this.storeNodeLocally(updatedNode);

      // Invalidate cache
      this.invalidateCache(nodeId);

      this.logger.info(`Updated node ${nodeId} to version ${updatedNode.version}`);
    }, 'updateNode');
  }

  /**
   * Delete a node from the graph
   */
  async deleteNode(nodeId: string, cascade = false): Promise<void> {
    return this.executeWithRetry(async () => {
      // Delete from MCP if connected
      if (this.client && this.connected) {
        const entityName = nodeId.split(':')[1];
        await this.client.callTool('delete_entities', {
          entityNames: [entityName],
        });
      }

      // Delete locally
      this.deleteNodeLocally(nodeId, cascade);

      // Invalidate cache
      this.invalidateCache(nodeId);

      this.logger.info(`Deleted node ${nodeId}${cascade ? ' with cascade' : ''}`);
    }, 'deleteNode');
  }

  /**
   * Create a new namespace
   */
  async createNamespace(name: string): Promise<void> {
    if (this.namespaces.has(name)) {
      throw new Error(`Namespace ${name} already exists`);
    }

    this.namespaces.set(name, {
      nodes: new Map(),
      edges: new Map(),
      metadata: { namespace: name, version: 1 },
    });

    this.logger.info(`Created namespace: ${name}`);
  }

  /**
   * List all namespaces
   */
  async listNamespaces(): Promise<string[]> {
    return Array.from(this.namespaces.keys());
  }

  /**
   * Switch to a different namespace
   */
  async switchNamespace(name: string): Promise<void> {
    if (!this.namespaces.has(name)) {
      await this.createNamespace(name);
    }

    this.currentNamespace = name;
    this.logger.info(`Switched to namespace: ${name}`);
  }

  /**
   * Find the shortest path between two nodes
   */
  async findPath(from: string, to: string): Promise<Path | null> {
    return this.executeWithRetry(async () => {
      const graph = this.namespaces.get(this.currentNamespace) || this.localGraph;

      // Use Dijkstra's algorithm for shortest path
      const path = this.dijkstra(graph, from, to);

      if (!path) {
        return null;
      }

      // Build edges from path
      const edges: Array<{ from: string; to: string; type: RelationType }> = [];
      for (let i = 0; i < path.length - 1; i++) {
        const fromNode = path[i];
        const toNode = path[i + 1];
        const edge = this.getEdge(graph, fromNode, toNode);

        if (edge) {
          edges.push({ from: fromNode, to: toNode, type: edge.type });
        }
      }

      return {
        nodes: path,
        edges,
        length: path.length - 1,
      };
    }, 'findPath');
  }

  /**
   * Get a subgraph starting from a root node
   */
  async getSubgraph(rootId: string, maxDepth: number): Promise<Graph> {
    return this.executeWithRetry(async () => {
      const subgraph: Graph = {
        nodes: new Map(),
        edges: new Map(),
        metadata: {
          namespace: this.currentNamespace,
          rootNode: rootId,
          maxDepth,
        },
      };

      const visited = new Set<string>();
      await this.buildSubgraph(rootId, 0, maxDepth, visited, subgraph);

      return subgraph;
    }, 'getSubgraph');
  }

  /**
   * Export knowledge in different formats
   */
  async exportKnowledge(format: 'json' | 'cypher' | 'rdf'): Promise<string> {
    return this.executeWithRetry(async () => {
      const graph = this.namespaces.get(this.currentNamespace) || this.localGraph;

      switch (format) {
        case 'json':
          return this.exportAsJSON(graph);
        case 'cypher':
          return this.exportAsCypher(graph);
        case 'rdf':
          return this.exportAsRDF(graph);
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    }, 'exportKnowledge');
  }

  /**
   * Get version history for a node
   */
  async getVersionHistory(nodeId: string): Promise<Node[]> {
    const history = this.versionHistory.get(nodeId) || [];
    return [...history];
  }

  /**
   * Clear all data in current namespace
   */
  async clearNamespace(): Promise<void> {
    const graph = this.namespaces.get(this.currentNamespace);

    if (graph) {
      graph.nodes.clear();
      graph.edges.clear();
      graph.metadata.version++;
    }

    // Clear from MCP if connected
    if (this.client && this.connected) {
      try {
        const allNodes = await this.client.callTool('read_graph', {});
        if (allNodes.content.entities) {
          const entityNames = allNodes.content.entities
            .filter((e: any) => e.name.startsWith(`${this.currentNamespace}:`))
            .map((e: any) => e.name);

          if (entityNames.length > 0) {
            await this.client.callTool('delete_entities', { entityNames });
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to clear MCP data: ${error}`);
      }
    }

    this.logger.info(`Cleared namespace: ${this.currentNamespace}`);
  }

  // === Private helper methods ===

  /**
   * Store node locally
   */
  private storeNodeLocally(node: Node): void {
    const graph = this.namespaces.get(node.metadata.namespace || this.currentNamespace) || this.localGraph;
    graph.nodes.set(node.id, node);
  }

  /**
   * Delete node locally
   */
  private deleteNodeLocally(nodeId: string, cascade: boolean): void {
    const graph = this.namespaces.get(this.currentNamespace) || this.localGraph;

    // Delete the node
    graph.nodes.delete(nodeId);

    // Delete edges
    graph.edges.delete(nodeId);

    if (cascade) {
      // Delete edges pointing to this node
      for (const [fromId, edges] of graph.edges) {
        const filteredEdges = Array.from(edges).filter((e) => e.to !== nodeId);
        if (filteredEdges.length === 0) {
          graph.edges.delete(fromId);
        } else {
          graph.edges.set(fromId, new Set(filteredEdges));
        }
      }
    }
  }

  /**
   * Create relationship locally
   */
  private createRelationshipLocally(from: string, to: string, type: RelationType): void {
    const graph = this.namespaces.get(this.currentNamespace) || this.localGraph;

    if (!graph.edges.has(from)) {
      graph.edges.set(from, new Set());
    }

    graph.edges.get(from)!.add({ to, type });
  }

  /**
   * Get node by ID
   */
  private async getNode(nodeId: string): Promise<Node | undefined> {
    const graph = this.namespaces.get(this.currentNamespace) || this.localGraph;
    return graph.nodes.get(nodeId);
  }

  /**
   * Get edge between two nodes
   */
  private getEdge(graph: Graph, from: string, to: string): { to: string; type: RelationType } | undefined {
    const edges = graph.edges.get(from);
    if (!edges) return undefined;

    for (const edge of edges) {
      if (edge.to === to) {
        return edge;
      }
    }

    return undefined;
  }

  /**
   * Traverse graph with depth limit
   */
  private async traverseGraph(nodeId: string, depth: number, visited: Set<string>, result: Node[]): Promise<void> {
    if (depth === 0 || visited.has(nodeId)) {
      return;
    }

    visited.add(nodeId);

    const node = await this.getNode(nodeId);
    if (node) {
      result.push(node);
    }

    const graph = this.namespaces.get(this.currentNamespace) || this.localGraph;
    const edges = graph.edges.get(nodeId);

    if (edges) {
      for (const edge of edges) {
        await this.traverseGraph(edge.to, depth - 1, visited, result);
      }
    }
  }

  /**
   * Build subgraph recursively
   */
  private async buildSubgraph(
    nodeId: string,
    currentDepth: number,
    maxDepth: number,
    visited: Set<string>,
    subgraph: Graph,
  ): Promise<void> {
    if (currentDepth > maxDepth || visited.has(nodeId)) {
      return;
    }

    visited.add(nodeId);

    const node = await this.getNode(nodeId);
    if (node) {
      subgraph.nodes.set(nodeId, node);
    }

    const graph = this.namespaces.get(this.currentNamespace) || this.localGraph;
    const edges = graph.edges.get(nodeId);

    if (edges) {
      subgraph.edges.set(nodeId, new Set(edges));

      for (const edge of edges) {
        await this.buildSubgraph(edge.to, currentDepth + 1, maxDepth, visited, subgraph);
      }
    }
  }

  /**
   * Dijkstra's algorithm for shortest path
   */
  private dijkstra(graph: Graph, start: string, end: string): string[] | null {
    const distances: Map<string, number> = new Map();
    const previous: Map<string, string | null> = new Map();
    const unvisited = new Set<string>();

    // Initialize
    for (const nodeId of graph.nodes.keys()) {
      distances.set(nodeId, Number.POSITIVE_INFINITY);
      previous.set(nodeId, null);
      unvisited.add(nodeId);
    }

    distances.set(start, 0);

    while (unvisited.size > 0) {
      // Find node with minimum distance
      let current: string | null = null;
      let minDistance = Number.POSITIVE_INFINITY;

      for (const nodeId of unvisited) {
        const distance = distances.get(nodeId)!;
        if (distance < minDistance) {
          minDistance = distance;
          current = nodeId;
        }
      }

      if (!current || minDistance === Number.POSITIVE_INFINITY) {
        break;
      }

      if (current === end) {
        // Build path
        const path: string[] = [];
        let node: string | null = end;

        while (node !== null) {
          path.unshift(node);
          node = previous.get(node)!;
        }

        return path;
      }

      unvisited.delete(current);

      // Update distances for neighbors
      const edges = graph.edges.get(current);
      if (edges) {
        for (const edge of edges) {
          if (unvisited.has(edge.to)) {
            const altDistance = distances.get(current)! + 1; // Weight = 1 for simplicity

            if (altDistance < distances.get(edge.to)!) {
              distances.set(edge.to, altDistance);
              previous.set(edge.to, current);
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Match node against search criteria
   */
  private matchesSearch(node: Node, query: string, filters?: SearchFilters): boolean {
    const queryLower = query.toLowerCase();

    // Check filters
    if (filters) {
      if (filters.type && node.type !== filters.type) return false;
      if (filters.namespace && node.metadata.namespace !== filters.namespace) return false;
      if (filters.tags && !filters.tags.some((tag) => node.metadata.tags?.includes(tag))) return false;
      if (filters.minVersion && node.version < filters.minVersion) return false;
      if (filters.maxVersion && node.version > filters.maxVersion) return false;
      if (filters.createdAfter && node.createdAt < filters.createdAfter) return false;
      if (filters.createdBefore && node.createdAt > filters.createdBefore) return false;
    }

    // Check query match
    return (
      node.name.toLowerCase().includes(queryLower) ||
      node.type.toLowerCase().includes(queryLower) ||
      JSON.stringify(node.properties).toLowerCase().includes(queryLower) ||
      node.observations.some((obs) => obs.toLowerCase().includes(queryLower))
    );
  }

  /**
   * Calculate relevance score for search result
   */
  private calculateRelevance(node: Node, query: string): number {
    const queryLower = query.toLowerCase();
    let score = 0;

    // Exact name match
    if (node.name.toLowerCase() === queryLower) score += 10;
    // Name contains query
    else if (node.name.toLowerCase().includes(queryLower)) score += 5;

    // Type match
    if (node.type.toLowerCase().includes(queryLower)) score += 3;

    // Properties match
    const propsStr = JSON.stringify(node.properties).toLowerCase();
    const propsMatches = (propsStr.match(new RegExp(queryLower, 'g')) || []).length;
    score += propsMatches * 2;

    // Observations match
    node.observations.forEach((obs) => {
      if (obs.toLowerCase().includes(queryLower)) score += 1;
    });

    return score;
  }

  /**
   * Deduplicate and sort search results
   */
  private deduplicateAndSort(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    const unique: SearchResult[] = [];

    for (const result of results) {
      if (!seen.has(result.node.id)) {
        seen.add(result.node.id);
        unique.push(result);
      }
    }

    return unique.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Parse entity value from MCP response
   */
  private parseEntityValue(entity: any): unknown {
    // Try to extract value from observations
    if (entity.observations && entity.observations.length > 0) {
      const valueObs = entity.observations.find((obs: string) => obs.startsWith('Stored value:'));

      if (valueObs) {
        try {
          return JSON.parse(valueObs.replace('Stored value: ', ''));
        } catch {
          return valueObs.replace('Stored value: ', '');
        }
      }
    }

    return entity;
  }

  /**
   * Convert MCP entity to Node
   */
  private convertToNode(entity: any): Node {
    return {
      id: entity.name,
      name: entity.name,
      type: entity.entityType || 'unknown',
      properties: entity.properties || {},
      observations: entity.observations || [],
      metadata: entity.metadata || {},
      createdAt: new Date(entity.createdAt || Date.now()),
      updatedAt: new Date(entity.updatedAt || Date.now()),
      version: entity.version || 1,
    };
  }

  /**
   * Add to version history
   */
  private addToVersionHistory(node: Node): void {
    if (!this.versionHistory.has(node.id)) {
      this.versionHistory.set(node.id, []);
    }

    const history = this.versionHistory.get(node.id)!;
    history.push({ ...node });

    // Limit history size
    const maxVersions = this.memoryConfig?.maxVersions || 10;
    if (history.length > maxVersions) {
      history.shift();
    }
  }

  /**
   * Cache management methods
   */
  private getFromCache(key: string): unknown | undefined {
    const entry = this.cache.get(key);

    if (!entry) return undefined;

    // Check TTL
    const now = Date.now();
    const ttl = this.memoryConfig?.cacheTTL || 3600000;

    if (now - entry.timestamp > ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Update hits
    entry.hits++;

    return entry.data;
  }

  private addToCache(key: string, value: unknown): void {
    const maxSize = this.memoryConfig?.cacheSize || 1000;

    // LRU eviction if cache is full
    if (this.cache.size >= maxSize) {
      let minHits = Number.POSITIVE_INFINITY;
      let evictKey: string | null = null;

      for (const [k, entry] of this.cache) {
        if (entry.hits < minHits) {
          minHits = entry.hits;
          evictKey = k;
        }
      }

      if (evictKey) {
        this.cache.delete(evictKey);
      }
    }

    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      hits: 1,
    });
  }

  private invalidateCache(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Export methods
   */
  private exportAsJSON(graph: Graph): string {
    const nodes = Array.from(graph.nodes.values());
    const edges: any[] = [];

    for (const [from, toSet] of graph.edges) {
      for (const edge of toSet) {
        edges.push({ from, to: edge.to, type: edge.type });
      }
    }

    return JSON.stringify({ nodes, edges, metadata: graph.metadata }, null, 2);
  }

  private exportAsCypher(graph: Graph): string {
    const cypherStatements: string[] = [];

    // Create nodes
    for (const node of graph.nodes.values()) {
      const props = JSON.stringify(node.properties).replace(/"/g, "'");
      cypherStatements.push(
        `CREATE (n:Node {id: '${node.id}', name: '${node.name}', type: '${node.type}', properties: ${props}})`,
      );
    }

    // Create relationships
    for (const [from, edges] of graph.edges) {
      for (const edge of edges) {
        cypherStatements.push(
          `MATCH (a:Node {id: '${from}'}), (b:Node {id: '${edge.to}'}) CREATE (a)-[:${edge.type.toUpperCase()}]->(b)`,
        );
      }
    }

    return cypherStatements.join(';\n') + ';';
  }

  private exportAsRDF(graph: Graph): string {
    const rdfStatements: string[] = [];
    const baseUri = 'http://memory.graph/';

    // Add prefixes
    rdfStatements.push('@prefix : <http://memory.graph/> .');
    rdfStatements.push('@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .');
    rdfStatements.push('@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .');
    rdfStatements.push('');

    // Add nodes
    for (const node of graph.nodes.values()) {
      rdfStatements.push(`:${node.id} rdf:type :${node.type} ;`);
      rdfStatements.push(`  rdfs:label "${node.name}" ;`);

      for (const [key, value] of Object.entries(node.properties)) {
        rdfStatements.push(`  :${key} "${value}" ;`);
      }

      rdfStatements.push('  .');
      rdfStatements.push('');
    }

    // Add relationships
    for (const [from, edges] of graph.edges) {
      for (const edge of edges) {
        rdfStatements.push(`:${from} :${edge.type} :${edge.to} .`);
      }
    }

    return rdfStatements.join('\n');
  }

  private importFromJSON(data: string): Graph {
    const parsed = JSON.parse(data);
    const graph: Graph = {
      nodes: new Map(),
      edges: new Map(),
      metadata: parsed.metadata || {},
    };

    // Import nodes
    for (const node of parsed.nodes) {
      graph.nodes.set(node.id, node);
    }

    // Import edges
    for (const edge of parsed.edges) {
      if (!graph.edges.has(edge.from)) {
        graph.edges.set(edge.from, new Set());
      }
      graph.edges.get(edge.from)!.add({ to: edge.to, type: edge.type });
    }

    return graph;
  }

  private importFromCypher(data: string): Graph {
    // Simplified Cypher import - would need a proper parser in production
    const graph: Graph = {
      nodes: new Map(),
      edges: new Map(),
      metadata: {},
    };

    // Parse CREATE statements for nodes
    const nodeRegex = /CREATE\s+\([^)]+\)/g;
    const nodeMatches = data.match(nodeRegex) || [];

    for (const match of nodeMatches) {
      const idMatch = match.match(/id:\s*'([^']+)'/);
      const nameMatch = match.match(/name:\s*'([^']+)'/);
      const typeMatch = match.match(/type:\s*'([^']+)'/);

      if (idMatch) {
        const node: Node = {
          id: idMatch[1],
          name: nameMatch ? nameMatch[1] : idMatch[1],
          type: typeMatch ? typeMatch[1] : 'unknown',
          properties: {},
          observations: [],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        };

        graph.nodes.set(node.id, node);
      }
    }

    // Parse relationship CREATE statements
    const relRegex = /MATCH.*CREATE\s+\(a\)-\[:([^\]]+)\]->\(b\)/g;
    const relMatches = data.match(relRegex) || [];

    for (const match of relMatches) {
      const fromMatch = match.match(/\{id:\s*'([^']+)'/);
      const toMatch = match.match(/\{id:\s*'([^']+)'.*\{id:\s*'([^']+)'/);
      const typeMatch = match.match(/\[:([^\]]+)\]/);

      if (fromMatch && toMatch && typeMatch) {
        const from = fromMatch[1];
        const to = toMatch[2];
        const type = typeMatch[1].toLowerCase() as RelationType;

        if (!graph.edges.has(from)) {
          graph.edges.set(from, new Set());
        }
        graph.edges.get(from)!.add({ to, type });
      }
    }

    return graph;
  }

  private importFromRDF(data: string): Graph {
    // Simplified RDF import - would need a proper parser in production
    const graph: Graph = {
      nodes: new Map(),
      edges: new Map(),
      metadata: {},
    };

    const lines = data.split('\n');
    let currentNode: Node | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip prefixes and empty lines
      if (trimmed.startsWith('@prefix') || trimmed === '') {
        continue;
      }

      // Parse node definitions
      const nodeMatch = trimmed.match(/^:([^\s]+)\s+rdf:type\s+:([^\s]+)/);
      if (nodeMatch) {
        currentNode = {
          id: nodeMatch[1],
          name: nodeMatch[1],
          type: nodeMatch[2],
          properties: {},
          observations: [],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        };
        graph.nodes.set(currentNode.id, currentNode);
        continue;
      }

      // Parse properties
      if (currentNode && trimmed.includes('rdfs:label')) {
        const labelMatch = trimmed.match(/rdfs:label\s+"([^"]+)"/);
        if (labelMatch) {
          currentNode.name = labelMatch[1];
        }
      }

      // Parse relationships
      const relMatch = trimmed.match(/^:([^\s]+)\s+:([^\s]+)\s+:([^\s]+)/);
      if (relMatch) {
        const from = relMatch[1];
        const type = relMatch[2] as RelationType;
        const to = relMatch[3].replace('.', '');

        if (!graph.edges.has(from)) {
          graph.edges.set(from, new Set());
        }
        graph.edges.get(from)!.add({ to, type });
      }
    }

    return graph;
  }

  private async mergeGraph(importedGraph: Graph): Promise<void> {
    const graph = this.namespaces.get(this.currentNamespace) || this.localGraph;

    // Merge nodes
    for (const [id, node] of importedGraph.nodes) {
      const existingNode = graph.nodes.get(id);

      if (existingNode) {
        // Update existing node
        const mergedNode: Node = {
          ...existingNode,
          ...node,
          version: existingNode.version + 1,
          updatedAt: new Date(),
        };
        graph.nodes.set(id, mergedNode);
      } else {
        // Add new node
        graph.nodes.set(id, node);
      }
    }

    // Merge edges
    for (const [from, edges] of importedGraph.edges) {
      if (!graph.edges.has(from)) {
        graph.edges.set(from, new Set());
      }

      const existingEdges = graph.edges.get(from)!;
      for (const edge of edges) {
        existingEdges.add(edge);
      }
    }
  }

  /**
   * Persistence methods
   */
  private async loadPersistedData(): Promise<void> {
    if (!this.memoryConfig?.persistenceDir) return;

    try {
      const persistPath = path.join(this.memoryConfig.persistenceDir, 'memory-graph.json');
      const data = await fs.readFile(persistPath, 'utf-8');
      const parsed = JSON.parse(data);

      // Restore namespaces
      for (const [nsName, nsData] of Object.entries(parsed.namespaces)) {
        const graph = this.importFromJSON(JSON.stringify(nsData));
        this.namespaces.set(nsName, graph);
      }

      // Restore version history
      if (parsed.versionHistory) {
        this.versionHistory = new Map(Object.entries(parsed.versionHistory));
      }

      this.logger.info('Loaded persisted data successfully');
    } catch (error) {
      this.logger.warn('Failed to load persisted data:', error);
    }
  }

  private async persistData(): Promise<void> {
    if (!this.memoryConfig?.persistenceDir) return;

    try {
      // Ensure directory exists
      await fs.mkdir(this.memoryConfig.persistenceDir, { recursive: true });

      // Prepare data for persistence
      const data = {
        namespaces: {} as Record<string, any>,
        versionHistory: Object.fromEntries(this.versionHistory),
        metadata: {
          persistedAt: new Date().toISOString(),
          version: '1.0.0',
        },
      };

      // Convert namespaces to serializable format
      for (const [name, graph] of this.namespaces) {
        const nodes = Array.from(graph.nodes.values());
        const edges: any[] = [];

        for (const [from, toSet] of graph.edges) {
          for (const edge of toSet) {
            edges.push({ from, to: edge.to, type: edge.type });
          }
        }

        data.namespaces[name] = { nodes, edges, metadata: graph.metadata };
      }

      // Write to file
      const persistPath = path.join(this.memoryConfig.persistenceDir, 'memory-graph.json');
      await fs.writeFile(persistPath, JSON.stringify(data, null, 2));

      this.logger.info('Persisted data successfully');
    } catch (error) {
      this.logger.error('Failed to persist data:', error);
    }
  }
}

// Export singleton instance
export const memoryAdapter = new MemoryAdapter();
