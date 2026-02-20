import { memo } from 'react'
import type { ReactNode } from 'react'

type MainLayoutProps = {
  children: ReactNode
  header?: ReactNode
}

const MainLayout = ({ children, header }: MainLayoutProps) => {
  return (
    <div className="main-layout">
      {header && <div className="main-layout-header">{header}</div>}
      <main className="main-layout-content">{children}</main>
    </div>
  )
}

export default memo(MainLayout)