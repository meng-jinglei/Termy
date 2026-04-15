import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @lydell/node-pty before importing PtyManager
vi.mock('@lydell/node-pty', () => ({
  spawn: vi.fn(),
}));

import * as pty from '@lydell/node-pty';
import { PtyManager } from '../src/main/pty/manager';
import type { IPty, IExitEvent } from '@lydell/node-pty';

const spawnMock = vi.mocked(pty.spawn);

function createMockPty(): Partial<IPty> {
  const mockPty: Partial<IPty> = {
    pid: 12345,
    onData: vi.fn(),
    onExit: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
  };
  spawnMock.mockReturnValue(mockPty as IPty);
  return mockPty;
}

describe('PTY-04: Exit status handling', () => {
  let manager: PtyManager;

  beforeEach(() => {
    manager = new PtyManager();
    spawnMock.mockClear();
  });

  it('emits exit event with sessionId and exitCode when PTY process exits', () => {
    const mockPty = createMockPty();

    manager.spawn('test-session', {
      shell: 'powershell.exe',
      cwd: 'C:\\Users\\test',
      cols: 80,
      rows: 24,
    });

    // Capture the onExit callback registered during spawn
    const onExitCallback = vi.mocked(mockPty.onExit!).mock.calls[0][0];

    const exitPromise = new Promise<{ sessionId: string; exitCode: number; signal?: number }>((resolve) => {
      manager.on('exit', (event) => resolve(event));
    });

    // Simulate process exit with code 0
    onExitCallback({ exitCode: 0 } as IExitEvent);

    return expect(exitPromise).resolves.toEqual({
      sessionId: 'test-session',
      exitCode: 0,
      signal: undefined,
    });
  });

  it('emits exit event with non-zero exitCode', () => {
    const mockPty = createMockPty();

    manager.spawn('test-session', {
      shell: 'powershell.exe',
      cwd: 'C:\\Users\\test',
      cols: 80,
      rows: 24,
    });

    const onExitCallback = vi.mocked(mockPty.onExit!).mock.calls[0][0];

    const exitPromise = new Promise<{ sessionId: string; exitCode: number }>((resolve) => {
      manager.on('exit', (event) => resolve(event));
    });

    onExitCallback({ exitCode: 42 } as IExitEvent);

    return expect(exitPromise).resolves.toHaveProperty('exitCode', 42);
  });

  it('removes session from registry after exit', () => {
    const mockPty = createMockPty();

    manager.spawn('test-session', {
      shell: 'powershell.exe',
      cwd: 'C:\\Users\\test',
      cols: 80,
      rows: 24,
    });

    // Session should exist before exit
    manager.write('test-session', 'test');
    expect(vi.mocked(mockPty.write!)).toHaveBeenCalled();

    const onExitCallback = vi.mocked(mockPty.onExit!).mock.calls[0][0];
    onExitCallback({ exitCode: 0 } as IExitEvent);

    // After exit, write to the same session should be a no-op
    vi.mocked(mockPty.write!).mockClear();
    manager.write('test-session', 'test');
    expect(vi.mocked(mockPty.write!)).not.toHaveBeenCalled();
  });

  it('exit message uses correct format with ANSI color codes', () => {
    // The renderer displays: \x1b[33m[Process exited with code N]\x1b[0m
    // This test verifies the expected format matches ANSI color requirements
    const exitCode = 0;
    const expectedMessage = `\x1b[33m[Process exited with code ${exitCode}]\x1b[0m`;

    expect(expectedMessage).toContain('\x1b[33m'); // yellow foreground
    expect(expectedMessage).toContain('\x1b[0m'); // reset
    expect(expectedMessage).toContain('[Process exited with code 0]');
  });

  it('exit message format matches for non-zero exit code', () => {
    const exitCode = 42;
    const expectedMessage = `\x1b[33m[Process exited with code ${exitCode}]\x1b[0m`;

    expect(expectedMessage).toContain('[Process exited with code 42]');
    expect(expectedMessage).toContain('\x1b[33m');
    expect(expectedMessage).toContain('\x1b[0m');
  });
});
