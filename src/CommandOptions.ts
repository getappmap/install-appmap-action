export interface CommandOptions {
  toolsUrl: string;
  appmapConfig?: string;
  projectType?: string;
  githubToken?: string;
  buildFile?: string;
  installerName?: string;
  ignoreDotAppMap?: boolean;
  installAppMapTools?: boolean;
  installAppMapLibrary?: boolean;
  buildPatchFile?: boolean;
  diffPathSpec?: string;
}
