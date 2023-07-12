import {chmod, mkdir, readFile, writeFile} from 'fs/promises';
import fetch from 'node-fetch';
import {tmpdir} from 'os';
import * as os from 'os';
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
  public githubToken?: string;
  public diffPathSpec = `. ':(exclude,top)vendor' ':(exclude,top)node_modules'`;

  constructor(public appmapToolsURL?: string, appmapToolsPath?: string) {
    this.appmapToolsPath = appmapToolsPath || '/usr/local/bin/appmap';
  }

  async ignoreDotAppmap() {
    let gitignore: string[];
    try {
      gitignore = (await readFile('.gitignore', 'utf8')).split('\n');
    } catch {
      log(LogLevel.Info, `Project has no .gitignore file. Initializing an empty one.`);
      gitignore = [];
    }
    if (!gitignore.includes('/.appmap')) {
      log(LogLevel.Info, `Adding .appmap to .gitignore`);
      gitignore.push('');
      gitignore.push('# Ignore AppMap archives and working files');
      gitignore.push('/.appmap');
      gitignore.push('');
      await writeFile('.gitignore', gitignore.join('\n'));
    }
  }

  async installAppMapTools() {
    let preflightReleaseURL = this.appmapToolsURL;
    let page = 1;
    while (!preflightReleaseURL) {
      const url = `https://api.github.com/repos/applandinc/appmap-js/releases?page=${page}&per_page=100`;
      log(LogLevel.Debug, `Enumerating appmap-js releases: ${url}`);
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
      };
      if (this.githubToken) headers['Authorization'] = `Bearer ${this.githubToken}`;
      const response = await fetch(url, {
        headers,
      });
      if (response.status === 403) {
        let message: string;
        try {
          message = (await response.json()).message;
        } catch (e) {
          log(LogLevel.Warn, (e as Error).toString());
          message = 'GitHub API rate limit exceeded.';
        }
        log(LogLevel.Info, message);
        log(LogLevel.Info, `Waiting for 3 seconds.`);
        log(
          LogLevel.Info,
          `You can avoid the rate limit by setting 'github-token: \${{ secrets.GITHUB_TOKEN }}'`
        );
        await new Promise(resolve => setTimeout(resolve, 3 * 1000));
        continue;
      } else if (response.status > 400) {
        throw new Error(`GitHub API returned ${response.status} ${response.statusText}`);
      }

      const releases = await response.json();
      if (releases.length === 0) break;

      page += 1;
      const release = releases.find((release: any) =>
        release.name.startsWith('@appland/appmap-preflight')
      );

      if (release) {
        const platform = [os.platform() === 'darwin' ? 'macos' : os.platform(), os.arch()].join(
          '-'
        );
        log(
          LogLevel.Info,
          `Using @appland/appmap-preflight release ${release.name} for ${platform}`
        );
        preflightReleaseURL = release.assets.find(
          (asset: any) => asset.name === `appmap-preflight-${platform}`
        ).browser_download_url;
      }
    }

    if (!preflightReleaseURL) throw new Error('Could not find @appland/appmap-preflight release');

    log(LogLevel.Info, `Installing AppMap tools from ${preflightReleaseURL}`);
    const appmapTempPath = join(tmpdir(), 'appmap');
    await downloadFile(new URL(preflightReleaseURL), appmapTempPath);
    try {
      await executeCommand(`mv ${appmapTempPath} ${this.appmapToolsPath}`);
    } catch (e) {
      await executeCommand(`sudo mv ${appmapTempPath} ${this.appmapToolsPath}`);
    }
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
    await executeCommand(`git diff -- ${this.diffPathSpec} > ${patchFileName}`);
    const patch = await readFile(patchFileName, 'utf8');
    log(LogLevel.Debug, `Patch file contents:\n${patch}`);
    return {filename: patchFileName, contents: patch};
  }
}
