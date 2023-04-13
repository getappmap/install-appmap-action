import {chmod, mkdir, readFile, writeFile} from 'fs/promises';
import fetch from 'node-fetch';
import {tmpdir} from 'os';
import {join} from 'path';
import {downloadFile} from './downloadFile';
import {executeCommand} from './executeCommand';
import log, {LogLevel} from './log';

export default class Installer {
  public appmapConfig?: string;
  public appmapToolsPath: string;
  public projectType?: string;
  public installerName?: string;
  public buildFile?: string;

  constructor(public appmapToolsURL?: string) {
    this.appmapToolsPath = join(tmpdir(), 'appmap');
  }

  async ignoreDotAppmap() {
    const gitignore = (await readFile('.gitignore', 'utf8')).split('\n');
    if (!gitignore.includes('.appmap')) {
      log(LogLevel.Info, `Adding .appmap to .gitignore`);
      await writeFile('.gitignore', [gitignore, '.appmap'].join('\n'));
    }
  }

  async installAppMapTools() {
    let preflightReleaseURL = this.appmapToolsURL;
    let page = 1;
    while (!preflightReleaseURL) {
      const releases = await (
        await fetch(
          `https://api.github.com/repos/applandinc/appmap-js/releases?page=${page}&per_page=100`,
          {
            headers: {Accept: 'application/vnd.github+json'},
          }
        )
      ).json();
      if (releases.length === 0) break;

      page += 1;
      preflightReleaseURL = releases.find((release: any) =>
        release.name.startsWith('@appland/appmap-preflight')
      );
    }

    if (!preflightReleaseURL) throw new Error('Could not find @appland/appmap-preflight release');

    log(LogLevel.Info, `Installing AppMap tools from ${preflightReleaseURL}`);
    await downloadFile(new URL(preflightReleaseURL), this.appmapToolsPath);
    await chmod(this.appmapToolsPath, 0o755);
    log(LogLevel.Info, `AppMap tools are installed at ${this.appmapToolsPath}`);
  }

  async installAppMapLibrary() {
    if (this.appmapConfig) {
      log(LogLevel.Info, `Installing the appmap.yml configuration provided by action input.`);
      await writeFile('appmap.yml', this.appmapConfig);
    }
    let cmd = `${this.appmapToolsPath} install --no-interactive --no-overwrite-appmap-config`;
    if (this.projectType) cmd += ` --project-type ${this.projectType}`;
    if (this.buildFile) cmd += ` --build-file ${this.buildFile}`;
    if (this.installerName) cmd += ` --installer-name ${this.installerName}`;
    await executeCommand(cmd);

    log(LogLevel.Info, `AppMap language library has been installed and configured.`);
  }

  async buildPatchFile(): Promise<{filename: string; contents: string}> {
    const patchFileName = join('.appmap', 'appmap-install.patch');
    await executeCommand(`git add -N .`);
    await mkdir('.appmap', {recursive: true});
    await executeCommand(`git diff > ${patchFileName}`);
    const patch = await readFile(patchFileName, 'utf8');
    log(LogLevel.Debug, `Patch file contents:\n${patch}`);
    return {filename: patchFileName, contents: patch};
  }
}
