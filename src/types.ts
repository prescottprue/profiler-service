type ProfilerPlatform = 'native' | string;
type ProfilerBrowser = 'firebase' | string;
type ProfilerOS = 'admin_node' | string;

interface ProfilerUserAgent {
  platform: ProfilerPlatform;
  browser: ProfilerBrowser;
  os: ProfilerOS;
  /* SDK Version ex: 8_12_1 */
  version: string;
  /* "Firebase/5/8.12.1/linux/AdminNode" */
  userAgentString: string;
}

interface ProfilerRemoteAddress {
  address: string;
}
type ProfilerName =
  | 'listener-unlisten'
  | 'concurrent-connect'
  | 'realtime-write'
  | 'realtime-update'
  | string;

export interface ProfilerResult {
  name: ProfilerName;
  timestamp: number;
  path: string[];
  pendingTime: number;
  client: {
    userAgent: ProfilerUserAgent;
    remoteAddress: ProfilerRemoteAddress;
  };
}

export interface ProfilerResultWithExtraValues extends ProfilerResult {
  pathStr: string;
  parentPath: string;
}
