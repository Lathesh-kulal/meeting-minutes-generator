import React from 'react'

export default function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flex: 'none' }}>
      <rect width="32" height="32" rx="8" fill="#FFE066" />
      <rect x="7" y="9" width="18" height="3" rx="1.5" fill="#1C2540" />
      <rect x="7" y="15" width="18" height="3" rx="1.5" fill="#1C2540" />
      <rect x="7" y="21" width="11" height="3" rx="1.5" fill="#1C2540" />
    </svg>
  )
}
