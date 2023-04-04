import * as core from '@actions/core';
import * as artifact from '@actions/artifact';
import Installer from './Installer';
import verbose from './verbose';
import {readFile} from 'fs/promises';

async function uploadPatchFile(patch: {filename: string; contents: string}) {
  core.setOutput('patch', patch.contents);
  const upload = artifact.create();
  await upload.uploadArtifact('appmap-install.patch', [patch.filename], '.');
}

const Options: Record<string, keyof Installer> = {
  'appmap-config': 'appmapConfig',
  'project-type': 'projectType',
  'installer-name': 'installerName',
  'build-file': 'buildFile',
};

export async function runInGitHub(): Promise<void> {
  verbose(core.getBooleanInput('verbose'));

  const appmapToolsURL = core.getInput('tools-url');
  const installer = new Installer(appmapToolsURL);

  for (const [inputName, fieldName] of Object.entries(Options)) {
    const value = core.getInput(inputName);
    if (value) (installer as any)[fieldName] = value;
  }

  await installer.installAppMapTools();
  await installer.installAppMapLibrary();
  const patch = await installer.buildPatchFile();
  if (patch.contents.length > 0) {
    await uploadPatchFile(patch);
  }
}

if (require.main === module) {
  runInGitHub();
}
