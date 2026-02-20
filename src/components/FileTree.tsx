import { useState } from 'react'
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react'

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

interface FileTreeProps {
  nodes: FileTreeNode[]
  selectedPath: string | null
  onFileSelect: (path: string) => void
  level?: number
}

function FileTreeItem({ 
  node, 
  selectedPath, 
  onFileSelect, 
  level = 0 
}: { 
  node: FileTreeNode
  selectedPath: string | null
  onFileSelect: (path: string) => void
  level?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const isDirectory = node.type === 'directory'
  const isSelected = selectedPath === node.path

  const handleClick = () => {
    if (isDirectory) {
      setExpanded(!expanded)
    } else {
      onFileSelect(node.path)
    }
  }

  return (
    <div>
      <div
        onClick={handleClick}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
          isSelected 
            ? 'bg-blue-600/20 text-blue-400' 
            : 'text-gray-300 hover:bg-gray-800'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          {isDirectory ? (
            expanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )
          ) : null}
        </span>
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          {isDirectory ? (
            expanded ? (
              <FolderOpen size={16} className="text-blue-400" />
            ) : (
              <Folder size={16} className="text-blue-400" />
            )
          ) : (
            <File size={16} className="text-gray-400" />
          )}
        </span>
        <span className="text-sm truncate">{node.name}</span>
      </div>
      {isDirectory && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              onFileSelect={onFileSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function FileTree({ nodes, selectedPath, onFileSelect }: FileTreeProps) {
  if (!nodes || nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        No files found
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      {nodes.map((node) => (
        <FileTreeItem
          key={node.path}
          node={node}
          selectedPath={selectedPath}
          onFileSelect={onFileSelect}
        />
      ))}
    </div>
  )
}
