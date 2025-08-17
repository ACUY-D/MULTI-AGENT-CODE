import { promises as fs } from 'fs';
import { join } from 'path';
import { vi } from 'vitest';

/**
 * Mock file system for testing
 */
export class MockFileSystem {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();

  constructor() {
    this.reset();
  }

  /**
   * Add a file to the mock filesystem
   */
  addFile(path: string, content: string): void {
    this.files.set(path, content);
    this.addDirectory(this.dirname(path));
  }

  /**
   * Add a directory to the mock filesystem
   */
  addDirectory(path: string): void {
    this.directories.add(path);
    // Add parent directories
    const parent = this.dirname(path);
    if (parent && parent !== path && parent !== '/') {
      this.addDirectory(parent);
    }
  }

  /**
   * Check if a file exists
   */
  fileExists(path: string): boolean {
    return this.files.has(path);
  }

  /**
   * Check if a directory exists
   */
  directoryExists(path: string): boolean {
    return this.directories.has(path);
  }

  /**
   * Read file content
   */
  readFile(path: string): string {
    if (!this.files.has(path)) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return this.files.get(path)!;
  }

  /**
   * Write file content
   */
  writeFile(path: string, content: string): void {
    this.addFile(path, content);
  }

  /**
   * Delete a file
   */
  deleteFile(path: string): void {
    if (!this.files.has(path)) {
      throw new Error(`ENOENT: no such file or directory, unlink '${path}'`);
    }
    this.files.delete(path);
  }

  /**
   * Delete a directory
   */
  deleteDirectory(path: string): void {
    if (!this.directories.has(path)) {
      throw new Error(`ENOENT: no such file or directory, rmdir '${path}'`);
    }

    // Check if directory is empty
    const hasChildren =
      Array.from(this.files.keys()).some((file) => file.startsWith(path + '/')) ||
      Array.from(this.directories).some((dir) => dir !== path && dir.startsWith(path + '/'));

    if (hasChildren) {
      throw new Error(`ENOTEMPTY: directory not empty, rmdir '${path}'`);
    }

    this.directories.delete(path);
  }

  /**
   * List directory contents
   */
  readdir(path: string): string[] {
    if (!this.directories.has(path)) {
      throw new Error(`ENOENT: no such file or directory, scandir '${path}'`);
    }

    const items = new Set<string>();

    // Add files
    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(path + '/')) {
        const relativePath = filePath.slice(path.length + 1);
        const firstPart = relativePath.split('/')[0];
        items.add(firstPart);
      }
    }

    // Add directories
    for (const dirPath of this.directories) {
      if (dirPath !== path && dirPath.startsWith(path + '/')) {
        const relativePath = dirPath.slice(path.length + 1);
        const firstPart = relativePath.split('/')[0];
        items.add(firstPart);
      }
    }

    return Array.from(items);
  }

  /**
   * Get file stats
   */
  stat(path: string): any {
    const isFile = this.files.has(path);
    const isDirectory = this.directories.has(path);

    if (!isFile && !isDirectory) {
      throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
    }

    return {
      isFile: () => isFile,
      isDirectory: () => isDirectory,
      size: isFile ? this.files.get(path)!.length : 0,
      mtime: new Date(),
      ctime: new Date(),
      atime: new Date(),
    };
  }

  /**
   * Reset the mock filesystem
   */
  reset(): void {
    this.files.clear();
    this.directories.clear();
    this.directories.add('/');
  }

  /**
   * Get dirname of a path
   */
  private dirname(path: string): string {
    const parts = path.split('/');
    parts.pop();
    return parts.join('/') || '/';
  }

  /**
   * Get all files
   */
  getAllFiles(): Map<string, string> {
    return new Map(this.files);
  }

  /**
   * Get all directories
   */
  getAllDirectories(): Set<string> {
    return new Set(this.directories);
  }
}

/**
 * Create mock fs module
 */
export function createMockFs() {
  const mockFs = new MockFileSystem();

  return {
    promises: {
      readFile: vi.fn(async (path: string) => {
        return Buffer.from(mockFs.readFile(path));
      }),

      writeFile: vi.fn(async (path: string, content: string | Buffer) => {
        mockFs.writeFile(path, content.toString());
      }),

      unlink: vi.fn(async (path: string) => {
        mockFs.deleteFile(path);
      }),

      rmdir: vi.fn(async (path: string) => {
        mockFs.deleteDirectory(path);
      }),

      mkdir: vi.fn(async (path: string, options?: any) => {
        mockFs.addDirectory(path);
      }),

      readdir: vi.fn(async (path: string) => {
        return mockFs.readdir(path);
      }),

      stat: vi.fn(async (path: string) => {
        return mockFs.stat(path);
      }),

      access: vi.fn(async (path: string) => {
        if (!mockFs.fileExists(path) && !mockFs.directoryExists(path)) {
          throw new Error(`ENOENT: no such file or directory, access '${path}'`);
        }
      }),

      rm: vi.fn(async (path: string, options?: any) => {
        if (options?.recursive) {
          // Remove directory and all contents
          const toRemove = [
            ...Array.from(mockFs.getAllFiles().keys()).filter((f) => f.startsWith(path)),
            ...Array.from(mockFs.getAllDirectories()).filter((d) => d.startsWith(path)),
          ];

          toRemove.forEach((item) => {
            mockFs.getAllFiles().delete(item);
            mockFs.getAllDirectories().delete(item);
          });
        } else {
          mockFs.deleteFile(path);
        }
      }),
    },

    existsSync: vi.fn((path: string) => {
      return mockFs.fileExists(path) || mockFs.directoryExists(path);
    }),

    readFileSync: vi.fn((path: string) => {
      return mockFs.readFile(path);
    }),

    writeFileSync: vi.fn((path: string, content: string) => {
      mockFs.writeFile(path, content);
    }),

    mkdirSync: vi.fn((path: string, options?: any) => {
      mockFs.addDirectory(path);
    }),

    rmSync: vi.fn((path: string, options?: any) => {
      if (options?.recursive) {
        // Remove directory and all contents
        const toRemove = [
          ...Array.from(mockFs.getAllFiles().keys()).filter((f) => f.startsWith(path)),
          ...Array.from(mockFs.getAllDirectories()).filter((d) => d.startsWith(path)),
        ];

        toRemove.forEach((item) => {
          mockFs.getAllFiles().delete(item);
          mockFs.getAllDirectories().delete(item);
        });
      } else {
        mockFs.deleteFile(path);
      }
    }),

    // Expose the mock filesystem for testing
    __mockFs: mockFs,
  };
}

/**
 * Setup mock fs in tests
 */
export function setupMockFs() {
  const mockFs = createMockFs();

  vi.mock('fs', () => mockFs);
  vi.mock('fs/promises', () => mockFs.promises);

  return mockFs;
}

/**
 * Create a mock file tree
 */
export function createMockFileTree(tree: Record<string, string | null>) {
  const mockFs = new MockFileSystem();

  for (const [path, content] of Object.entries(tree)) {
    if (content === null) {
      // Directory
      mockFs.addDirectory(path);
    } else {
      // File
      mockFs.addFile(path, content);
    }
  }

  return mockFs;
}

/**
 * Mock fs utilities
 */
export const mockFsUtils = {
  /**
   * Create a temp directory structure
   */
  createTempStructure(baseDir = '/tmp/test') {
    const mockFs = new MockFileSystem();

    mockFs.addDirectory(baseDir);
    mockFs.addDirectory(join(baseDir, 'src'));
    mockFs.addDirectory(join(baseDir, 'tests'));
    mockFs.addDirectory(join(baseDir, 'dist'));

    mockFs.addFile(
      join(baseDir, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
      }),
    );

    mockFs.addFile(
      join(baseDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
        },
      }),
    );

    return mockFs;
  },

  /**
   * Assert file exists with content
   */
  assertFileContent(mockFs: MockFileSystem, path: string, expectedContent: string) {
    if (!mockFs.fileExists(path)) {
      throw new Error(`File ${path} does not exist`);
    }

    const content = mockFs.readFile(path);
    if (content !== expectedContent) {
      throw new Error(`File ${path} content mismatch.\nExpected: ${expectedContent}\nActual: ${content}`);
    }
  },

  /**
   * Assert directory structure
   */
  assertDirectoryStructure(mockFs: MockFileSystem, baseDir: string, expectedStructure: string[]) {
    for (const path of expectedStructure) {
      const fullPath = join(baseDir, path);
      if (!mockFs.directoryExists(fullPath) && !mockFs.fileExists(fullPath)) {
        throw new Error(`Path ${fullPath} does not exist`);
      }
    }
  },
};
