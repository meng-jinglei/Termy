import { existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { ShellProfile } from './types';

export function detectShells(): ShellProfile[] {
  const shells: ShellProfile[] = [];

  // 1. PowerShell 7 (pwsh.exe) — check default install path first
  const pwshPath = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';
  if (existsSync(pwshPath)) {
    shells.push({ id: 'pwsh', label: 'PowerShell 7', path: pwshPath });
  } else if (isInPath('pwsh.exe')) {
    shells.push({ id: 'pwsh', label: 'PowerShell 7', path: 'pwsh.exe' });
  }

  // 2. Windows PowerShell (powershell.exe) — always available
  shells.push({
    id: 'powershell',
    label: 'Windows PowerShell',
    path: 'powershell.exe',
  });

  // 3. Git Bash — check default install paths
  const gitBashPaths = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  ];
  for (const p of gitBashPaths) {
    if (existsSync(p)) {
      shells.push({ id: 'git-bash', label: 'Git Bash', path: p });
      break;
    }
  }

  // 4. WSL Ubuntu
  if (isWslAvailable()) {
    shells.push({
      id: 'wsl',
      label: 'WSL (Ubuntu)',
      path: 'wsl.exe',
      args: ['--distribution', 'Ubuntu'],
    });
  }

  return shells;
}

export function isInPath(executable: string): boolean {
  const pathEnv = process.env.PATH || '';
  const paths = pathEnv.split(';');
  return paths.some(dir => existsSync(join(dir, executable)));
}

export function isWslAvailable(): boolean {
  try {
    execSync('wsl --list --quiet', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
