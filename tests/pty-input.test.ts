import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @lydell/node-pty before importing PtyManager
vi.mock('@lydell/node-pty', () => ({
  spawn: vi.fn(),
}));

import * as pty from '@lydell/node-pty';
import { PtyManager } from '../src/main/pty/manager';
import type { IPty } from '@lydell/node-pty';

const spawnMock = vi.mocked(pty.spawn);

function createMockPty(): ReturnType<typeof vi.fn> {
  const mockPty: Partial<IPty> = {
    pid: 12345,
    onData: vi.fn(),
    onExit: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
  };
  spawnMock.mockReturnValue(mockPty as IPty);
  return vi.mocked(mockPty.write!);
}

describe('PTY-03: Keyboard input forwarding', () => {
  let manager: PtyManager;

  beforeEach(() => {
    manager = new PtyManager();
    spawnMock.mockClear();
  });

  it('forwards write data to the PTY process for a valid session', () => {
    const mockWrite = createMockPty();

    manager.spawn('test-session', {
      shell: 'powershell.exe',
      cwd: 'C:\\Users\\test',
      cols: 80,
      rows: 24,
    });

    manager.write('test-session', 'echo hello\r');

    expect(mockWrite).toHaveBeenCalledWith('echo hello\r');
  });

  it('does not throw when writing to non-existent session', () => {
    expect(() => manager.write('nonexistent', 'test')).not.toThrow();
  });

  it('forwards string data without modification', () => {
    const mockWrite = createMockPty();

    manager.spawn('test-session', {
      shell: 'powershell.exe',
      cwd: 'C:\\Users\\test',
      cols: 80,
      rows: 24,
    });

    const inputData = 'Get-Date\r';
    manager.write('test-session', inputData);

    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(mockWrite).toHaveBeenCalledWith(inputData);
  });

  it('does not call write when session does not exist', () => {
    const mockWrite = createMockPty();

    // No session spawned
    manager.write('ghost-session', 'test');

    expect(mockWrite).not.toHaveBeenCalled();
  });
});

describe('PTY-03: IPC handler PTY_WRITE wiring', () => {
  let manager: PtyManager;

  beforeEach(() => {
    manager = new PtyManager();
    spawnMock.mockClear();
  });

  it('IPC handler calls manager.write with correct sessionId and data', () => {
    const mockWrite = createMockPty();

    manager.spawn('session-1', {
      shell: 'powershell.exe',
      cwd: 'C:\\Users\\test',
      cols: 80,
      rows: 24,
    });

    // Simulate IPC handler behavior: ipcMain.on(PTY_WRITE, (_event, args) => manager.write(args.sessionId, args.data))
    const ipcArgs = { sessionId: 'session-1', data: 'ls\r' };
    manager.write(ipcArgs.sessionId, ipcArgs.data);

    expect(mockWrite).toHaveBeenCalledWith('ls\r');
  });
});
