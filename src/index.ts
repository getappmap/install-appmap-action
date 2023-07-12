import * as core from '@actions/core';
import Installer from './Installer';
import verbose from './verbose';
import {ArgumentParser} from 'argparse';
import assert from 'assert';
import run from './run';
import {GitHubArtifactStore} from './GitHubArtifactStore';
import {DirectoryArtifactStore} from './DirectoryArtifactStore';

const Options: Record<string, keyof Installer> = {
  'appmap-config': 'appmapConfig',
  'project-type': 'projectType',
  'installer-name': 'installerName',
  'build-file': 'buildFile',
};

export async function runInGitHub(): Promise<void> {
  verbose(core.getBooleanInput('verbose'));

  await run(new GitHubArtifactStore(), {
    appmapConfig: core.getInput('appmap-config'),
    projectType: core.getInput('project-type'),
    buildFile: core.getInput('build-file'),
    installerName: core.getInput('installer-name'),
    toolsUrl: core.getInput('tools-url'),
    githubToken: core.getInput('github-token'),
    ignoreDotAppMap: core.getBooleanInput('ignore-dot-appmap'),
    installAppMapTools: core.getBooleanInput('install-appmap-tools'),
    installAppMapLibrary: core.getBooleanInput('install-appmap-library'),
    buildPatchFile: core.getBooleanInput('build-patch-file'),
    diffPathSpec: core.getInput('diff-path-spec'),
  });
}

async function runLocally() {
  const parser = new ArgumentParser({
    description: 'Preflight command',
  });
  parser.add_argument('-v', '--verbose');
  parser.add_argument('-d', '--directory', {help: 'Program working directory'});
  parser.add_argument('--artifact-dir', {default: '.appmap/artifacts'});
  parser.add_argument('--tools-url');
  parser.add_argument('--appmap-config');
  parser.add_argument('--project-type');
  parser.add_argument('--build-file');
  parser.add_argument('--installer-name');
  parser.add_argument('--github-token');
  parser.add_argument('--ignore-dot-appmap', {default: true});
  parser.add_argument('--install-appmap-tools', {default: true});
  parser.add_argument('--install-appmap-library', {default: true});
  parser.add_argument('--build-patch-file', {default: true});
  parser.add_argument('--diff-path-spec');

  const options = parser.parse_args();

  verbose(options.verbose === 'true' || options.verbose === true);
  const directory = options.directory;
  if (directory) process.chdir(directory);
  const artifactDir = options.artifact_dir;
  assert(artifactDir);

  await run(new DirectoryArtifactStore(artifactDir), {
    appmapConfig: options.appmap_config,
    projectType: options.project_type,
    buildFile: options.build_file,
    installerName: options.installer_name,
    githubToken: options.github_token || process.env.GITHUB_TOKEN,
    toolsUrl: options.tools_url,
    ignoreDotAppMap: options.ignore_dot_appmap,
    installAppMapTools: options.install_appmap_tools,
    installAppMapLibrary: options.install_appmap_library,
    buildPatchFile: options.build_patch_file,
    diffPathSpec: options.diff_path_spec,
  });
}

if (require.main === module) {
  if (process.env.CI) runInGitHub();
  else runLocally();
}
