// Tool-related type definitions

export interface ToolOption {
  id: string;
  label: string;
  installed: boolean;
}

export interface ToolStatus {
  installed: ToolOption[];
  newly_installed: string[];
  shared_tool_ids: Record<string, string[]>;
}

export interface ToolStatusDto extends ToolStatus {
  tools: ToolInfo[];
}

export interface ToolInfo {
  key: string;
  label: string;
  skills_dir: string;
}

export interface SyncTargets {
  [toolId: string]: boolean;
}
